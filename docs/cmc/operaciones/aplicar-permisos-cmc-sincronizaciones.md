# Aplicar en compaz-prod los permisos de `cmc_sincronizaciones` (PR #19)

Solo después de la revisión de Juan y la autorización de Luis. No necesita despliegue.

**Base:** `compaz-prod` (`jizckcfuemgfbmopbhbh`). Nunca la base archivada.
**Herramienta:** editor SQL de Supabase (rol `postgres`, dueño de la tabla) o `psql`.

## 0. Estado previo (solo lectura)
```sql
select relacl::text as acl, relrowsecurity as rls,
       (select count(*) from pg_policy where polrelid = c.oid) as politicas,
       (select count(*) from public.cmc_sincronizaciones) as filas
from pg_class c where oid = 'public.cmc_sincronizaciones'::regclass;
```
Esperado el 13-nov:
- acl: `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`;
- rls: true;
- politicas: 0;
- filas: 0.

Si algo difiere, parar y revisar.

## 1. Aplicar
Ejecutar entero `supabase/migrations/20261113b_cmc_sincronizaciones_permisos.sql`.
- Va en una sola transacción.
- Si la tabla no existiera, solo emite un aviso y no cambia nada.

## 2. Comprobación de permisos (solo lectura)
Ejecutar `tests/sql/cmc_sincronizaciones_permisos.sql`. Debe terminar en `OK: cmc_sincronizaciones solo admite SELECT e INSERT de service_role, con RLS y restricciones intactas`.
El ACL esperado es `{postgres=arwdDxtm/postgres,service_role=ar/postgres}`.

## 3. Prueba funcional como `service_role` (termina en ROLLBACK)
Ejecutar `tests/sql/cmc_permisos_prueba_funcional.sql`.
- Lee e inserta una fila de prueba, y comprueba que UPDATE, DELETE y TRUNCATE se rechazan.
- Todo se deshace al final.
- Debe terminar en `OK: service_role lee (...) e inserta; UPDATE, DELETE y TRUNCATE rechazados`.

## 4. Después
- Repetir el paso 0: `filas` debe seguir en 0, porque la prueba funcional no deja nada.
- Confirmar que la sincronización horaria del CMC sigue en OK y que `/panel` carga. Ninguna de las dos usa esta tabla.

## Vuelta atrás (solo si hiciera falta)
```sql
grant all on public.cmc_sincronizaciones to service_role;
```
