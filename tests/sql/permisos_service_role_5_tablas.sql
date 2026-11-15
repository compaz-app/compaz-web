-- Comprobación de solo lectura de los permisos de service_role en 5 tablas (migración 20261113c).
-- Uso: psql "$DB_URL" -v ON_ERROR_STOP=1 -f tests/sql/permisos_service_role_5_tablas.sql
-- Termina con "OK" o falla con la lista de diferencias. No cambia nada.
-- El estado esperado es el del proyecto de São Paulo, que sirvió producción hasta el 12-nov: esta misma comprobación debe pasar allí.
do $$
declare
  fallos text[] := '{}';
  t text;
  p text;
  solo_leer text[] := array['eventos', 'personas', 'postulaciones'];
  todos text[] := array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'];
begin
  -- eventos, personas, postulaciones: service_role solo lee
  foreach t in array solo_leer loop
    if to_regclass('public.' || t) is null then fallos := fallos || (t || ': no existe'); continue; end if;
    if not has_table_privilege('service_role', 'public.' || t, 'SELECT') then fallos := fallos || (t || ': service_role sin SELECT'); end if;
    foreach p in array todos loop
      if has_table_privilege('service_role', 'public.' || t, p) then fallos := fallos || (t || ': service_role conserva ' || p); end if;
    end loop;
    if current_setting('server_version_num')::int >= 170000 and has_table_privilege('service_role', 'public.' || t, 'MAINTAIN') then
      fallos := fallos || (t || ': service_role conserva MAINTAIN');
    end if;
  end loop;

  -- chat_requests (tabla en desuso): service_role sin acceso a los datos
  if to_regclass('public.chat_requests') is null then fallos := fallos || 'chat_requests: no existe'::text;
  else
    foreach p in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      if has_table_privilege('service_role', 'public.chat_requests', p) then fallos := fallos || ('chat_requests: service_role conserva ' || p); end if;
    end loop;
  end if;

  -- admin_emails: service_role lee, añade y borra (la limpieza diaria la copia de ADMIN_EMAILS) pero NO actualiza
  if to_regclass('public.admin_emails') is null then fallos := fallos || 'admin_emails: no existe'::text;
  else
    foreach p in array array['SELECT','INSERT','DELETE'] loop
      if not has_table_privilege('service_role', 'public.admin_emails', p) then fallos := fallos || ('admin_emails: service_role sin ' || p); end if;
    end loop;
    if has_table_privilege('service_role', 'public.admin_emails', 'UPDATE') then fallos := fallos || 'admin_emails: service_role conserva UPDATE'::text; end if;
  end if;

  if array_length(fallos, 1) > 0 then
    raise exception 'FALLA: %', array_to_string(fallos, '; ');
  end if;
  raise notice 'OK: eventos, personas y postulaciones solo se leen; chat_requests sin datos; admin_emails sin UPDATE (service_role)';
end
$$;
