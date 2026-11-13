-- Comprobación de solo lectura de los permisos de public.cmc_sincronizaciones.
-- Uso: psql "$DB_URL" -v ON_ERROR_STOP=1 -f tests/sql/cmc_sincronizaciones_permisos.sql
-- Termina con "OK" o falla con la lista de diferencias. No cambia nada.
do $$
declare
  fallos text[] := '{}';
  p text;
begin
  if to_regclass('public.cmc_sincronizaciones') is null then
    raise exception 'FALLA: no existe public.cmc_sincronizaciones';
  end if;

  -- service_role: solo leer y añadir
  foreach p in array array['SELECT','INSERT'] loop
    if not has_table_privilege('service_role', 'public.cmc_sincronizaciones', p) then
      fallos := fallos || ('service_role sin ' || p);
    end if;
  end loop;
  foreach p in array array['UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
    if has_table_privilege('service_role', 'public.cmc_sincronizaciones', p) then
      fallos := fallos || ('service_role conserva ' || p);
    end if;
  end loop;

  -- Postgres 17 (Supabase): privilegio MAINTAIN
  if current_setting('server_version_num')::int >= 170000
     and has_table_privilege('service_role', 'public.cmc_sincronizaciones', 'MAINTAIN') then
    fallos := fallos || 'service_role conserva MAINTAIN'::text;
  end if;

  -- anon y authenticated: nada
  foreach p in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
    if has_table_privilege('anon', 'public.cmc_sincronizaciones', p) then fallos := fallos || ('anon tiene ' || p); end if;
    if has_table_privilege('authenticated', 'public.cmc_sincronizaciones', p) then fallos := fallos || ('authenticated tiene ' || p); end if;
  end loop;

  -- RLS activada y sin políticas (nadie fuera de service_role lee filas)
  if not (select relrowsecurity from pg_class where oid = 'public.cmc_sincronizaciones'::regclass) then
    fallos := fallos || 'RLS desactivada'::text;
  end if;
  if (select count(*) from pg_policy where polrelid = 'public.cmc_sincronizaciones'::regclass) <> 0 then
    fallos := fallos || 'hay políticas RLS inesperadas'::text;
  end if;

  -- Restricciones de la tabla intactas
  if not exists (select 1 from pg_constraint where conrelid = 'public.cmc_sincronizaciones'::regclass and conname = 'cmc_sincronizaciones_estado_check') then
    fallos := fallos || 'falta cmc_sincronizaciones_estado_check'::text;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.cmc_sincronizaciones'::regclass and contype = 'p') then
    fallos := fallos || 'falta la clave primaria'::text;
  end if;

  if array_length(fallos, 1) > 0 then
    raise exception 'FALLA: %', array_to_string(fallos, '; ');
  end if;
  raise notice 'OK: cmc_sincronizaciones solo admite SELECT e INSERT de service_role, con RLS y restricciones intactas';
end
$$;
