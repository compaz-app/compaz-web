-- ══════════════════════════════════════════════════════════════════════════════
-- Compaz · Bloque 1 · Verificación del esquema real antes de aplicar la migración
-- SOLO LECTURA. Se puede ejecutar en producción (compaz-platform): no crea, modifica
-- ni borra nada, y no devuelve datos personales.
-- Responde: ¿la migración 20261022_captacion.sql choca con algo que ya existe?
-- ══════════════════════════════════════════════════════════════════════════════

begin;
set transaction read only;

-- V1 · Versión de Postgres (la migración usa gen_random_uuid y hashtextextended: PG13+)
select version() as version_postgres;

-- V2 · ¿Ya existe algo con los nombres que crea la migración? (esperado: 0 filas)
select 'tabla' as tipo, table_name as nombre from information_schema.tables
 where table_schema = 'public' and table_name in ('personas', 'postulaciones', 'eventos')
union all
select 'funcion', p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('registrar_postulacion', 'reclamar_envios_airtable',
   'marcar_envio_airtable', 'postulaciones_para_cmc', 'confirmar_entrega_cmc', 'eventos_inmutables')
union all
select 'indice', indexname from pg_indexes where schemaname = 'public' and indexname like any (array['personas_%', 'postulaciones_%', 'eventos_%']);

-- V3 · Roles que la migración menciona (esperado: anon, authenticated, service_role)
select rolname, rolbypassrls from pg_roles where rolname in ('anon', 'authenticated', 'service_role') order by 1;

-- V4 · Permisos por defecto en public (la migración los retira explícitamente de sus tablas)
select pg_get_userbyid(d.defaclrole) as propietario, d.defaclobjtype as tipo_objeto, d.defaclacl as permisos
  from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace
 where n.nspname = 'public';

-- V5 · Extensiones instaladas y su esquema
select extname, extversion, extnamespace::regnamespace as esquema from pg_extension order by 1;

-- V6 · compitas: columnas reales y restricción de estado (para la decisión sobre compitas.estado)
select column_name, data_type, is_nullable, column_default
  from information_schema.columns where table_schema = 'public' and table_name = 'compitas'
 order by ordinal_position;
select conname, pg_get_constraintdef(oid) as definicion
  from pg_constraint where conrelid = 'public.compitas'::regclass and contype in ('c', 'u', 'p');

-- V7 · Distribución de estados de compitas (solo conteos)
select estado, verificado, count(*) from public.compitas group by 1, 2 order by 1, 2;

-- V8 · Tablas públicas con RLS y número de políticas (para confirmar el patrón general)
select c.relname as tabla, c.relrowsecurity as rls, count(p.policyname) as politicas
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
 where n.nspname = 'public' and c.relkind = 'r'
 group by 1, 2 order by 1;

-- V9 · Triggers propios en public (para descartar que algo actúe sobre tablas nuevas por nombre)
select event_object_table as tabla, trigger_name, action_timing, event_manipulation
  from information_schema.triggers where event_object_schema = 'public' order by 1, 2;

rollback;
