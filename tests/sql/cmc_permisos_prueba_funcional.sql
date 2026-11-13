-- Prueba funcional de los permisos de public.cmc_sincronizaciones COMO service_role.
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: no deja filas ni cambios.
-- Comprueba que service_role puede LEER e INSERTAR, y que UPDATE, DELETE y TRUNCATE se rechazan.
-- Uso: psql "$DB_URL" -v ON_ERROR_STOP=1 -f tests/sql/cmc_permisos_prueba_funcional.sql
begin;
set local role service_role;
do $$
declare
  fallos text[] := '{}';
  n bigint;
  nuevo uuid;
begin
  -- Lectura
  select count(*) into n from public.cmc_sincronizaciones;
  -- Inserción (se deshace al final)
  insert into public.cmc_sincronizaciones (estado, motivo, recibidas)
  values ('rechazada', 'prueba funcional de permisos (rollback)', 0) returning id into nuevo;

  begin
    update public.cmc_sincronizaciones set motivo = 'x' where id = nuevo;
    fallos := fallos || 'UPDATE permitido'::text;
  exception when insufficient_privilege then null; end;

  begin
    delete from public.cmc_sincronizaciones where id = nuevo;
    fallos := fallos || 'DELETE permitido'::text;
  exception when insufficient_privilege then null; end;

  begin
    execute 'truncate public.cmc_sincronizaciones';
    fallos := fallos || 'TRUNCATE permitido'::text;
  exception when insufficient_privilege then null; end;

  if array_length(fallos, 1) > 0 then
    raise exception 'FALLA: %', array_to_string(fallos, '; ');
  end if;
  raise notice 'OK: service_role lee (% filas antes) e inserta; UPDATE, DELETE y TRUNCATE rechazados. Se deshace todo.', n;
end
$$;
rollback;
