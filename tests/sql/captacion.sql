-- ══════════════════════════════════════════════════════════════════════════════
-- Compaz · Bloque 1 · Pruebas SQL de supabase/migrations/20261022_captacion.sql
--
-- Ejecutar SOLO en staging o en una base local desechable, NUNCA en producción:
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f tests/sql/captacion.sql
-- La primera comprobación aborta si la base se llama como la de producción o si
-- ya contiene postulaciones reales.
-- Todo corre dentro de una transacción que se revierte al final: no deja datos.
-- ══════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
begin;

-- P0 · Salvaguarda de aislamiento: abortar si esto parece producción
--      (en Supabase la base siempre se llama "postgres", así que se mira el contenido)
do $$
begin
  assert (select count(*) from public.postulaciones) = 0,
    'P0 la base ya tiene postulaciones: estas pruebas solo se ejecutan en una base vacía';
  if to_regclass('public.compitas') is not null then
    assert not exists (select 1 from public.compitas),
      'P0 la tabla compitas tiene datos: esto no es staging. Abortado.';
  end if;
  if to_regclass('public.usuarios') is not null then
    assert not exists (select 1 from public.usuarios),
      'P0 la tabla usuarios tiene datos: esto no es staging. Abortado.';
  end if;
end $$;

-- Persona Z de apoyo para el caso de conflicto
set local role service_role;
select * from public.registrar_postulacion('00000000-0000-4000-8000-0000000000a1', 'compita', 'home', 'Zeta Apoyo',
  '+584147770000', 'zeta@ejemplo.com', 'Valencia', 'Carabobo', '+584147770000', 'zeta@ejemplo.com', 'Valencia, Carabobo');

-- P1 · Postulación nueva: persona nueva, se envía a Airtable, guarda las 5 UTM
do $$
declare r record;
begin
  select * into r from public.registrar_postulacion('00000000-0000-4000-8000-000000000001', 'compita', 'home', 'Ana Prueba',
    '+584121234567', 'ana@ejemplo.com', 'Caracas', 'Distrito Capital', '+584121234567', 'ana@ejemplo.com', 'Caracas, Distrito Capital',
    '{"source":"meta","medium":"paid","campaign":"oct","content":"video-3","term":"cuidado"}');
  assert r.resultado = 'registrada', 'P1 resultado: ' || r.resultado;
  assert r.enviar_a_airtable, 'P1 debe enviarse a Airtable';
  assert (select coincidencia = 'nueva' and utm_content = 'video-3' and utm_term = 'cuidado' and utm_source = 'meta'
            from public.postulaciones where id = r.postulacion_id), 'P1 coincidencia o UTM';
  assert (select count(*) from public.eventos where entidad_id = r.postulacion_id and tipo = 'postulacion_recibida') = 1, 'P1 evento';
end $$;

-- P2 · Reintento técnico con la misma clave: no crea nada
do $$
declare r record; n int := (select count(*) from public.postulaciones);
begin
  select * into r from public.registrar_postulacion('00000000-0000-4000-8000-000000000001', 'compita', 'home', 'Ana Prueba',
    '+584121234567', 'ana@ejemplo.com', 'Caracas', 'Distrito Capital', '+584121234567', 'ana@ejemplo.com', 'Caracas, Distrito Capital');
  assert r.resultado = 'reintento_tecnico' and not r.enviar_a_airtable, 'P2 resultado: ' || r.resultado;
  assert (select count(*) from public.postulaciones) = n, 'P2 no debe crear postulaciones';
  assert (select count(*) from public.eventos where entidad_id = r.postulacion_id and tipo = 'reintento_tecnico') = 1, 'P2 evento';
end $$;

-- P3 · Reintento técnico con otra clave y los mismos datos en menos de 15 min (doble clic, recarga)
do $$
declare r record; n int := (select count(*) from public.postulaciones);
begin
  select * into r from public.registrar_postulacion('00000000-0000-4000-8000-000000000002', 'compita', 'home', 'Ana Prueba',
    '+584121234567', 'ana@ejemplo.com', 'Caracas', 'Distrito Capital', '+584121234567', 'ana@ejemplo.com', 'Caracas, Distrito Capital');
  assert r.resultado = 'reintento_tecnico' and not r.enviar_a_airtable, 'P3 resultado: ' || r.resultado;
  assert (select count(*) from public.postulaciones) = n, 'P3 no debe crear postulaciones';
end $$;

-- Simular que la postulación de Ana es de ayer (como superusuario: service_role no puede editar)
reset role;
update public.postulaciones set recibida_en = now() - interval '1 day' where clave_idempotencia = '00000000-0000-4000-8000-000000000001';
set local role service_role;

-- P4 · Postulación nueva legítima de la misma persona: se guarda como repetida, sin Airtable
do $$
declare r record; v_ana uuid := (select persona_id from public.postulaciones where clave_idempotencia = '00000000-0000-4000-8000-000000000001');
begin
  select * into r from public.registrar_postulacion('00000000-0000-4000-8000-000000000003', 'compita', 'se_compita', 'Ana P.',
    '+584121234567', 'ana@ejemplo.com', 'Caracas', 'Distrito Capital', '+584121234567', 'ana@ejemplo.com', 'Caracas');
  assert r.resultado = 'repetida' and not r.enviar_a_airtable, 'P4 resultado: ' || r.resultado;
  assert r.persona_id = v_ana, 'P4 debe ser la misma persona (coincidencia exacta)';
  assert (select coincidencia = 'exacta' and airtable_estado = 'no_aplica' and repeticion_de is not null
            from public.postulaciones where id = r.postulacion_id), 'P4 estado';
  assert (select nombre from public.personas where id = v_ana) = 'Ana Prueba', 'P4 la persona no se sobrescribe';
end $$;

-- P5 · Misma persona, otro tipo (familia): misma persona, sí se envía
do $$
declare r record; v_ana uuid := (select persona_id from public.postulaciones where clave_idempotencia = '00000000-0000-4000-8000-000000000001');
begin
  select * into r from public.registrar_postulacion('00000000-0000-4000-8000-000000000004', 'familia', 'home', 'Ana Prueba',
    '+584121234567', 'ana@ejemplo.com', 'Caracas', 'Distrito Capital', '+584121234567', 'ana@ejemplo.com', 'Caracas, Distrito Capital');
  assert r.resultado = 'registrada' and r.enviar_a_airtable and r.persona_id = v_ana, 'P5 resultado: ' || r.resultado;
end $$;

-- P6 · Mismo teléfono, otro correo: persona NUEVA marcada (no se fusiona); es repetición probable, sin Airtable
do $$
declare r record; v_ana uuid := (select persona_id from public.postulaciones where clave_idempotencia = '00000000-0000-4000-8000-000000000001');
begin
  select * into r from public.registrar_postulacion('00000000-0000-4000-8000-000000000005', 'compita', 'home', 'Ana Prueba',
    '+584121234567', 'ana.nueva@ejemplo.com', 'Caracas', 'Distrito Capital', '+584121234567', 'ana.nueva@ejemplo.com', 'Caracas, Distrito Capital');
  assert r.persona_id <> v_ana, 'P6 no debe reutilizar a Ana';
  assert (select coincidencia = 'parcial_telefono' and persona_coincidente_id = v_ana
            from public.postulaciones where id = r.postulacion_id), 'P6 coincidencia';
  assert r.resultado = 'repetida' and not r.enviar_a_airtable, 'P6 resultado: ' || r.resultado;
end $$;

-- P7 · Otro teléfono, mismo correo (familia que comparte correo): persona nueva marcada, sí se envía
do $$
declare r record;
begin
  select * into r from public.registrar_postulacion('00000000-0000-4000-8000-000000000006', 'compita', 'home', 'Luisa Prueba',
    '+584149998877', 'ana@ejemplo.com', 'Maracay', 'Aragua', '+584149998877', 'ana@ejemplo.com', 'Maracay, Aragua');
  assert (select coincidencia from public.postulaciones where id = r.postulacion_id) = 'parcial_email', 'P7 coincidencia';
  assert r.resultado = 'registrada' and r.enviar_a_airtable, 'P7 resultado: ' || r.resultado;
end $$;

-- P8 · Teléfono de una persona y correo de otra: conflicto, persona nueva
do $$
declare r record;
begin
  select * into r from public.registrar_postulacion('00000000-0000-4000-8000-000000000007', 'familia', 'home', 'Mezcla',
    '+584147770000', 'ana@ejemplo.com', null, null, '+584147770000', 'ana@ejemplo.com', 'Valencia');
  assert (select coincidencia from public.postulaciones where id = r.postulacion_id) = 'conflicto', 'P8 coincidencia';
end $$;

-- P9 · Sin teléfono ni correo: se rechaza
do $$
begin
  perform public.registrar_postulacion('00000000-0000-4000-8000-000000000008', 'compita', 'home', 'Nadie',
    null, null, null, null, 'x', 'x', 'x');
  raise exception 'P9 debería haber fallado';
exception when sqlstate '22023' then null;
end $$;

-- P10 · Cola de Airtable: reclamar sin solaparse, reintentar con espera y agotar a los 5 fallos
do $$
declare v_id uuid; v_estado text; n int; i int;
begin
  select count(*) into n from public.reclamar_envios_airtable(50);
  assert n = (select count(*) from public.postulaciones where airtable_estado = 'pendiente'), 'P10 reclamadas: ' || n;
  select count(*) into n from public.reclamar_envios_airtable(50);
  assert n = 0, 'P10 un segundo cron no debe reclamar lo mismo';

  select id into v_id from public.postulaciones where clave_idempotencia = '00000000-0000-4000-8000-000000000006';
  for i in 1..5 loop
    v_estado := public.marcar_envio_airtable(v_id, false, null, 'HTTP 422');
  end loop;
  assert v_estado = 'agotada', 'P10 tras 5 fallos: ' || coalesce(v_estado, 'null');
  assert (select airtable_proximo_intento > now() + interval '30 minutes' from public.postulaciones where id = v_id), 'P10 espera creciente';

  select id into v_id from public.postulaciones where clave_idempotencia = '00000000-0000-4000-8000-000000000004';
  assert public.marcar_envio_airtable(v_id, true, 'recAAAAAAAAAAAAA1', null) = 'enviada', 'P10 enviada';
end $$;

-- P11 · Entrega directa al CMC: solo las agotadas, una sola vez, y Airtable ya no puede recibirlas
do $$
declare v_id uuid; n int;
begin
  select count(*) into n from public.postulaciones_para_cmc(100);
  assert n = 1, 'P11 pendientes para el CMC: ' || n;
  select id into v_id from public.postulaciones_para_cmc(100);
  assert public.confirmar_entrega_cmc(array[v_id]) = 1, 'P11 confirmar';
  assert public.confirmar_entrega_cmc(array[v_id]) = 0, 'P11 confirmar dos veces no repite';
  assert (select count(*) from public.postulaciones_para_cmc(100)) = 0, 'P11 ya no se ofrece';
  assert public.marcar_envio_airtable(v_id, true, 'recBBBBBBBBBBBBB1', null) is null, 'P11 Airtable no debe recibirla después';
end $$;

-- P12 · eventos es inmutable incluso para el dueño de la tabla
reset role;
do $$
begin
  update public.eventos set tipo = 'x';
  raise exception 'P12 UPDATE debería fallar';
exception when sqlstate 'P0001' then null;
end $$;

-- P13 · service_role no escribe directamente (solo mediante las funciones)
set local role service_role;
do $$
begin
  insert into public.personas (nombre, telefono_e164) values ('x', '+584120000001');
  raise exception 'P13 service_role no debería insertar en personas';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  update public.postulaciones set clasificacion = 'spam';
  raise exception 'P13 service_role no debería editar postulaciones';
exception when insufficient_privilege then null;
end $$;

-- P14 · anon y authenticated no ven ni ejecutan nada
reset role;
set local role anon;
do $$
begin
  perform 1 from public.personas;
  raise exception 'P14 anon no debería leer personas';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.registrar_postulacion(gen_random_uuid(), 'compita', 'home', 'x', '+584120000000', null, null, null, 'x', 'x', 'x');
  raise exception 'P14 anon no debería ejecutar registrar_postulacion';
exception when insufficient_privilege then null;
end $$;
reset role;
set local role authenticated;
do $$
begin
  perform 1 from public.postulaciones_para_cmc(1);
  raise exception 'P14 authenticated no debería leer la entrega al CMC';
exception when insufficient_privilege then null;
end $$;
reset role;

select 'Todas las pruebas SQL de captación pasaron (14)' as resultado;
rollback;
