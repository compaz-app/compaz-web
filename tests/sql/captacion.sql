-- ══════════════════════════════════════════════════════════════════════════════
-- Compaz · Bloque 1 · Pruebas SQL de supabase/migrations/20261022_captacion.sql
--
-- Ejecutar SOLO en staging o en una base local desechable, NUNCA en producción:
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f tests/sql/captacion.sql
-- La comprobación P0 aborta si la base tiene datos de operación (compitas,
-- usuarios) o postulaciones previas.
-- Todo corre en una transacción que se revierte al final: no deja datos.
-- ══════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
begin;

-- P0 · Salvaguarda de aislamiento
do $$
begin
  assert (select count(*) from public.postulaciones) = 0, 'P0 la base ya tiene postulaciones. Abortado.';
  if to_regclass('public.compitas') is not null then
    assert not exists (select 1 from public.compitas), 'P0 la tabla compitas tiene datos: esto no es staging. Abortado.';
  end if;
  if to_regclass('public.usuarios') is not null then
    assert not exists (select 1 from public.usuarios), 'P0 la tabla usuarios tiene datos: esto no es staging. Abortado.';
  end if;
end $$;

-- Atajo: registrar con los datos de Ana
create temp table if not exists _r (k text primary key, postulacion_id uuid, persona_id uuid, resultado text, enviar boolean, recibida timestamptz);
grant all on _r to service_role;

set local role service_role;
select * from public.registrar_postulacion('00000000-0000-4000-8000-0000000000a1', 'compita', 'home', 'Zeta Apoyo',
  '+584147770000', 'zeta@ejemplo.com', 'Valencia', 'Carabobo', '+584147770000', 'zeta@ejemplo.com', 'Valencia, Carabobo');

-- S1 · Postulación nueva: se guarda, se envía y queda reservada para el primer intento de la ruta
do $$
declare r record;
begin
  select * into r from public.registrar_postulacion('00000000-0000-4000-8000-000000000001', 'compita', 'home', 'Ana Prueba',
    '+584121234567', 'ana@ejemplo.com', 'Caracas', 'Distrito Capital', '+584121234567', 'ana@ejemplo.com', 'Caracas, Distrito Capital',
    '{"source":"meta","medium":"paid","campaign":"oct","content":"video-3","term":"cuidado"}');
  insert into _r values ('ana', r.postulacion_id, r.persona_id, r.resultado, r.enviar_a_airtable, r.recibida_en);
  assert r.resultado = 'registrada' and r.enviar_a_airtable, 'S1 resultado: ' || r.resultado;
  assert r.recibida_en = date_trunc('milliseconds', r.recibida_en), 'S1 recibida_en debe tener precisión de ms (huella)';
  assert (select coincidencia = 'nueva' and utm_content = 'video-3' and utm_term = 'cuidado'
                 and airtable_reclamada_hasta > now() and airtable_proximo_intento > now()
            from public.postulaciones where id = r.postulacion_id), 'S1 reserva o UTM';
  assert (select count(*) from public.reclamar_envios_airtable(50)) = 0, 'S1 el cron no debe tomar una fila reservada para la ruta';
end $$;

-- S2 · Reintento técnico con la misma clave
do $$
declare r record; n int := (select count(*) from public.postulaciones);
begin
  select * into r from public.registrar_postulacion('00000000-0000-4000-8000-000000000001', 'compita', 'home', 'Ana Prueba',
    '+584121234567', 'ana@ejemplo.com', 'Caracas', 'Distrito Capital', '+584121234567', 'ana@ejemplo.com', 'Caracas, Distrito Capital');
  assert r.resultado = 'reintento_tecnico' and not r.enviar_a_airtable, 'S2 resultado: ' || r.resultado;
  assert r.recibida_en = (select recibida from _r where k = 'ana'), 'S2 devuelve la misma huella';
  assert (select count(*) from public.postulaciones) = n, 'S2 no crea postulaciones';
end $$;

-- S3 · Reintento técnico: otra clave, mismos datos en menos de 15 min
do $$
declare r record; n int := (select count(*) from public.postulaciones);
begin
  select * into r from public.registrar_postulacion('00000000-0000-4000-8000-000000000002', 'compita', 'home', 'Ana Prueba',
    '+584121234567', 'ana@ejemplo.com', 'Caracas', 'Distrito Capital', '+584121234567', 'ana@ejemplo.com', 'Caracas, Distrito Capital');
  assert r.resultado = 'reintento_tecnico' and not r.enviar_a_airtable, 'S3 resultado: ' || r.resultado;
  assert (select count(*) from public.postulaciones) = n, 'S3 no crea postulaciones';
end $$;

reset role;
update public.postulaciones set recibida_en = recibida_en - interval '3 days' where clave_idempotencia = '00000000-0000-4000-8000-000000000001';
update _r set recibida = recibida - interval '3 days' where k = 'ana';
set local role service_role;

-- S4 · La misma persona se postula días después: nueva postulación "repetida", sin copia a Airtable
do $$
declare r record; v_ana uuid := (select persona_id from _r where k = 'ana');
begin
  select * into r from public.registrar_postulacion('00000000-0000-4000-8000-000000000003', 'compita', 'se_compita', 'Ana P.',
    '+584121234567', 'ana@ejemplo.com', 'Caracas', 'Distrito Capital', '+584121234567', 'ana@ejemplo.com', 'Caracas');
  assert r.resultado = 'repetida' and not r.enviar_a_airtable and r.persona_id = v_ana, 'S4 resultado: ' || r.resultado;
  assert (select coincidencia = 'exacta' and airtable_estado = 'no_aplica' and repeticion_de is not null
            from public.postulaciones where id = r.postulacion_id), 'S4 estado';
  assert (select nombre from public.personas where id = v_ana) = 'Ana Prueba', 'S4 la persona no se sobrescribe';
end $$;

-- S5 · Misma persona como familia: misma persona, sí se envía
do $$
declare r record;
begin
  select * into r from public.registrar_postulacion('00000000-0000-4000-8000-000000000004', 'familia', 'home', 'Ana Prueba',
    '+584121234567', 'ana@ejemplo.com', 'Caracas', 'Distrito Capital', '+584121234567', 'ana@ejemplo.com', 'Caracas, Distrito Capital');
  assert r.resultado = 'registrada' and r.enviar_a_airtable and r.persona_id = (select persona_id from _r where k = 'ana'), 'S5';
  insert into _r values ('familia', r.postulacion_id, r.persona_id, r.resultado, r.enviar_a_airtable, r.recibida_en);
end $$;

-- S6 · Mismo teléfono, otro correo: persona nueva marcada; repetición probable, sin copia
do $$
declare r record; v_ana uuid := (select persona_id from _r where k = 'ana');
begin
  select * into r from public.registrar_postulacion('00000000-0000-4000-8000-000000000005', 'compita', 'home', 'Ana Prueba',
    '+584121234567', 'ana.nueva@ejemplo.com', 'Caracas', 'Distrito Capital', '+584121234567', 'ana.nueva@ejemplo.com', 'Caracas, Distrito Capital');
  assert r.persona_id <> v_ana, 'S6 no debe reutilizar a Ana';
  assert (select coincidencia = 'parcial_telefono' and persona_coincidente_id = v_ana from public.postulaciones where id = r.postulacion_id), 'S6';
  assert r.resultado = 'repetida' and not r.enviar_a_airtable, 'S6 resultado: ' || r.resultado;
end $$;

-- S7 · Otro teléfono, mismo correo (familia que comparte correo): persona nueva, sí se envía
do $$
declare r record;
begin
  select * into r from public.registrar_postulacion('00000000-0000-4000-8000-000000000006', 'compita', 'home', 'Luisa Prueba',
    '+584149998877', 'ana@ejemplo.com', 'Maracay', 'Aragua', '+584149998877', 'ana@ejemplo.com', 'Maracay, Aragua');
  assert (select coincidencia from public.postulaciones where id = r.postulacion_id) = 'parcial_email', 'S7';
  assert r.resultado = 'registrada' and r.enviar_a_airtable, 'S7 resultado: ' || r.resultado;
  insert into _r values ('luisa', r.postulacion_id, r.persona_id, r.resultado, r.enviar_a_airtable, r.recibida_en);
end $$;

-- S8 · Teléfono de una persona y correo de otra: conflicto; S9 · sin contacto: error
do $$
declare r record;
begin
  select * into r from public.registrar_postulacion('00000000-0000-4000-8000-000000000007', 'familia', 'home', 'Mezcla',
    '+584147770000', 'ana@ejemplo.com', null, null, '+584147770000', 'ana@ejemplo.com', 'Valencia');
  assert (select coincidencia from public.postulaciones where id = r.postulacion_id) = 'conflicto', 'S8';
  begin
    perform public.registrar_postulacion('00000000-0000-4000-8000-000000000008', 'compita', 'home', 'Nadie',
      null, null, null, null, 'x', 'x', 'x');
    raise exception 'S9 debería haber fallado';
  exception when sqlstate '22023' then null;
  end;
end $$;

-- S10 · Marcar: "enviada" exige un id válido de Airtable
do $$
begin
  perform public.marcar_envio_airtable((select postulacion_id from _r where k = 'familia'), 'enviada', null, null);
  raise exception 'S10 debería exigir id';
exception when sqlstate '22023' then null;
end $$;

-- S11 · Primer intento correcto (Airtable guarda y Supabase confirma)
do $$
begin
  assert public.marcar_envio_airtable((select postulacion_id from _r where k = 'familia'), 'enviada', 'recFAMILIA0000001', null) = 'enviada', 'S11';
  assert (select airtable_reclamada_hasta is null from public.postulaciones where id = (select postulacion_id from _r where k = 'familia')), 'S11 libera la reserva';
end $$;

-- Expirar las reservas (la ruta "murió" o nunca confirmó)
reset role;
update public.postulaciones set airtable_reclamada_hasta = now() - interval '1 second', airtable_proximo_intento = now() - interval '1 second'
 where airtable_estado = 'pendiente';
set local role service_role;

-- S12 · Confirmación perdida: Airtable guardó pero Supabase no lo supo. La conciliación lo
--       encuentra por su huella (Contacto + Fecha) y lo vincula: no se crea otro registro.
do $$
declare v_id uuid := (select postulacion_id from _r where k = 'luisa'); v_rec timestamptz := (select recibida from _r where k = 'luisa');
begin
  assert (select airtable_estado from public.postulaciones where id = v_id) = 'pendiente', 'S12 sigue pendiente';
  assert public.conciliar_registro_airtable('recLUISA000000001', v_rec, 'compita', 'Luisa Prueba', '+584149998877', 'ana@ejemplo.com',
    'Maracay, Aragua', '+584149998877', 'ana@ejemplo.com', 'Maracay', 'Aragua') = 'adoptada', 'S12 adoptada';
  assert (select airtable_estado = 'enviada' and airtable_id = 'recLUISA000000001' from public.postulaciones where id = v_id), 'S12 vinculada';
  assert public.conciliar_registro_airtable('recLUISA000000001', v_rec, 'compita', 'Luisa Prueba', '+584149998877', 'ana@ejemplo.com',
    'Maracay, Aragua', '+584149998877', 'ana@ejemplo.com', 'Maracay', 'Aragua') = 'ya_vinculada', 'S12 idempotente';
end $$;

-- S13 · Cola: el cron toma lo pendiente sin solaparse; 5 fallos → agotada → bandeja
do $$
declare v_id uuid; v_estado text; n int; i int;
begin
  select count(*) into n from public.reclamar_envios_airtable(50);
  assert n = (select count(*) from public.postulaciones where airtable_estado = 'pendiente'), 'S13 reclamadas: ' || n;
  assert (select count(*) from public.reclamar_envios_airtable(50)) = 0, 'S13 un segundo cron no toma lo mismo';
  select postulacion_id into v_id from _r where k = 'ana';
  for i in 1..5 loop v_estado := public.marcar_envio_airtable(v_id, 'error', null, 'HTTP 422 límite de registros'); end loop;
  assert v_estado = 'agotada', 'S13 tras 5 fallos: ' || coalesce(v_estado, 'null');
  assert exists (select 1 from public.postulaciones_por_resolver() where id = v_id), 'S13 aparece en la bandeja';
end $$;

-- S14 · Ruta de respaldo: un registro de Airtable que Supabase no conoce se importa, una sola vez
do $$
declare v_res text; v_id uuid;
begin
  v_res := public.conciliar_registro_airtable('recRESPALDO000001', '2026-10-25T14:00:00.123Z', 'compita', 'Pedro Respaldo',
    '+584161112233', 'pedro@ejemplo.com', 'Mérida, Mérida', '+584161112233', 'pedro@ejemplo.com', 'Mérida', 'Mérida', '{"source":"ig"}');
  assert v_res = 'importada', 'S14 ' || v_res;
  select id into v_id from public.postulaciones where airtable_id = 'recRESPALDO000001';
  assert (select fuente = 'respaldo_airtable' and airtable_estado = 'enviada' and recibida_en = '2026-10-25T14:00:00.123Z'::timestamptz
            and utm_source = 'ig' from public.postulaciones where id = v_id), 'S14 datos';
  assert not exists (select 1 from public.reclamar_envios_airtable(50) where id = v_id), 'S14 no se vuelve a copiar a Airtable';
  assert public.conciliar_registro_airtable('recRESPALDO000001', '2026-10-25T14:00:00.123Z', 'compita', 'Pedro Respaldo',
    '+584161112233', 'pedro@ejemplo.com', 'Mérida, Mérida', '+584161112233', 'pedro@ejemplo.com', 'Mérida', 'Mérida') = 'ya_vinculada', 'S14 idempotente';
  assert (select count(*) from public.postulaciones where telefono_declarado = '+584161112233') = 1, 'S14 una sola fila';
end $$;

-- S15 · Huella ambigua: no se vincula ni se importa
reset role;
insert into public.postulaciones (persona_id, tipo, coincidencia, fuente, nombre_declarado, telefono_declarado, email_declarado,
  ubicacion_declarada, clave_idempotencia, recibida_en, airtable_estado)
select persona_id, tipo, 'exacta', fuente, nombre_declarado, telefono_declarado, email_declarado, ubicacion_declarada,
       '00000000-0000-4000-8000-0000000000d1', recibida_en, 'pendiente'
  from public.postulaciones where id = (select postulacion_id from _r where k = 'ana');
set local role service_role;
do $$
declare v_rec timestamptz := (select recibida from _r where k = 'ana');
begin
  assert public.conciliar_registro_airtable('recAMBIGUO0000001', v_rec, 'compita', 'Ana Prueba', '+584121234567', 'ana@ejemplo.com',
    'Caracas, Distrito Capital', '+584121234567', 'ana@ejemplo.com', 'Caracas', 'Distrito Capital') = 'ambigua', 'S15';
  assert not exists (select 1 from public.postulaciones where airtable_id = 'recAMBIGUO0000001'), 'S15 no vincula ni importa';
end $$;

-- S16 · Bandeja: se resuelve con autor y nota; deja de aparecer; no se resuelve dos veces
do $$
declare v_id uuid := (select postulacion_id from _r where k = 'ana');
begin
  begin
    perform public.resolver_postulacion(v_id, 'registrada_en_cmc', 'soycompaz@gmail.com', null);
    raise exception 'S16 debería exigir nota';
  exception when sqlstate '22023' then null;
  end;
  assert public.resolver_postulacion(v_id, 'registrada_en_cmc', 'soycompaz@gmail.com', 'Registrada a mano como COM-1099'), 'S16 resolver';
  assert not exists (select 1 from public.postulaciones_por_resolver() where id = v_id), 'S16 sale de la bandeja';
  assert not public.resolver_postulacion(v_id, 'no_procede', 'juantenreiro@gmail.com', 'otra'), 'S16 no se resuelve dos veces';
  assert (select count(*) from public.eventos where entidad_id = v_id and tipo = 'resuelta_registrada_en_cmc' and actor = 'soycompaz@gmail.com') = 1, 'S16 evento';
  -- Si después aparece en Airtable, no se cambia lo resuelto a mano
  assert public.marcar_envio_airtable(v_id, 'enviada', 'recTARDIO00000001', null) is null, 'S16 no se pisa una resolución manual';
end $$;

-- S17 · eventos es inmutable incluso para el dueño de la tabla
reset role;
do $$
begin
  update public.eventos set tipo = 'x';
  raise exception 'S17 UPDATE debería fallar';
exception when sqlstate 'P0001' then null;
end $$;

-- S18 · service_role no escribe directamente (solo mediante las funciones)
set local role service_role;
do $$
begin
  insert into public.personas (nombre, telefono_e164) values ('x', '+584120000001');
  raise exception 'S18 service_role no debería insertar en personas';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  update public.postulaciones set clasificacion = 'spam';
  raise exception 'S18 service_role no debería editar postulaciones';
exception when insufficient_privilege then null;
end $$;

-- S19 · anon y authenticated no ven ni ejecutan nada
reset role;
set local role anon;
do $$
begin
  perform 1 from public.personas;
  raise exception 'S19 anon no debería leer personas';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.registrar_postulacion(gen_random_uuid(), 'compita', 'home', 'x', '+584120000000', null, null, null, 'x', 'x', 'x');
  raise exception 'S19 anon no debería ejecutar registrar_postulacion';
exception when insufficient_privilege then null;
end $$;
reset role;
set local role authenticated;
do $$
begin
  perform 1 from public.postulaciones_por_resolver(1);
  raise exception 'S19 authenticated no debería leer la bandeja';
exception when insufficient_privilege then null;
end $$;
reset role;

select 'Todas las pruebas SQL de captación pasaron (19)' as resultado;
rollback;
