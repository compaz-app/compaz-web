-- ══════════════════════════════════════════════════════════════════════════════
-- Compaz · Restaura los permisos de service_role en 5 tablas (corrección tras el traslado a compaz-prod)
--
-- Estado: PENDIENTE DE APLICAR. Autorización de Juan y Luis necesaria.
--
-- Por qué:
--   Al copiar la base a compaz-prod (12-nov, pg_dump del esquema public) service_role quedó con MÁS
--   privilegios de los que tenía en el proyecto de São Paulo, que fue el que sirvió producción hasta
--   esa fecha. Comparadas las listas de permisos (ACL) tabla por tabla, solo difieren estas 5:
--
--     tabla            en São Paulo (diseño)       sobra en compaz-prod
--     eventos          solo SELECT                 INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
--     personas         solo SELECT                 INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
--     postulaciones    solo SELECT                 INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
--     chat_requests    sin SELECT/INSERT/UPDATE/DELETE (tabla en desuso)   SELECT, INSERT, UPDATE, DELETE
--     admin_emails     sin UPDATE                  UPDATE
--
--   eventos es un registro de auditoría: con la clave del servidor se podría modificar o borrar directamente.
--   Escribir en eventos, personas y postulaciones solo se hace por funciones de la base, no con la clave
--   del servidor, y producción funcionó semanas con estos permisos. Esta migración devuelve ese estado.
--
-- Qué hace (solo REVOKE, nunca GRANT; no toca datos, columnas, restricciones, RLS ni otros roles):
--   · Quita a service_role únicamente lo que sobra, tabla por tabla (lista de arriba).
--   · anon, authenticated y PUBLIC no se tocan: ya coinciden con São Paulo en las 38 combinaciones.
--   · MAINTAIN solo existe desde Postgres 17: se quita únicamente si la versión lo admite.
--
-- Segura e idempotente:
--   · Si una tabla no existe, avisa y sigue con las demás.
--   · REVOKE de un privilegio que no se tiene no cambia nada: se puede ejecutar varias veces.
--   · Todo en una transacción: o se aplica entero o no se aplica.
--   · No depende del historial de migraciones.
--
-- Comprobación: tests/sql/permisos_service_role_5_tablas.sql (debe terminar en "OK"; solo lectura).
-- Vuelta atrás (solo si hiciera falta), con el rol postgres:
--   grant insert, update, delete, truncate, references, trigger, maintain on public.eventos, public.personas, public.postulaciones to service_role;
--   grant select, insert, update, delete on public.chat_requests to service_role;
--   grant update on public.admin_emails to service_role;
-- ══════════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  v record;
  con_maintain boolean := current_setting('server_version_num')::int >= 170000;
begin
  for v in
    select * from (values
      ('eventos',       'insert, update, delete, truncate, references, trigger', true),
      ('personas',      'insert, update, delete, truncate, references, trigger', true),
      ('postulaciones', 'insert, update, delete, truncate, references, trigger', true),
      ('chat_requests', 'select, insert, update, delete',                        false),
      ('admin_emails',  'update',                                                false)
    ) as t(tabla, privilegios, y_maintain)
  loop
    if to_regclass('public.' || v.tabla) is null then
      raise notice 'public.% no existe: no se cambia nada en esa tabla.', v.tabla;
      continue;
    end if;
    execute format('revoke %s%s on table public.%I from service_role',
                   v.privilegios, case when v.y_maintain and con_maintain then ', maintain' else '' end, v.tabla);
  end loop;
end
$$;

commit;
