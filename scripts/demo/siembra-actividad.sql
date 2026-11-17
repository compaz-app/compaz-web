-- Parte 2 de la siembra de demo: actividad en todo el panel. Se corre DESPUÉS de siembra-demo.sql (que crea compitas y clientes y limpia lo anterior).
do $act$
begin
  if exists (select 1 from public.ajustes where clave = '__es_produccion__') then raise exception 'ESTA ES PRODUCCION, no se siembra'; end if;

  -- ── Solicitudes (entrevistas): 13 clientes con compita, 3 pendientes de los clientes sin plan, algunas rechazadas ──
  insert into public.solicitudes (id, cliente_id, compita_id, estado, tipo, mensaje, que, created_at, respondido_at, slot_confirmado, token_respuesta)
  select ('dede0004-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
    ('dede0002-0000-4000-8000-'||lpad(u::text,12,'0'))::uuid,
    ('dede0001-0000-4000-8000-'||lpad(c::text,12,'0'))::uuid,
    est, 'entrevista', 'Hola, quisiera conocerle para que acompañe a mi familiar.', 'compañía',
    now() - (dias||' days')::interval,
    case when est <> 'pendiente' then now() - ((dias-1)||' days')::interval end,
    case when est in ('aceptada','contratada','completada') then now() - ((dias-1)||' days')::interval + interval '1 day' end,
    gen_random_uuid()
  from (
    select n, ((n-1)%16)+1 u, case when ((n-1)%16)+1 <= 13 then (((((n-1)%16)+1)*5)%24)+1 else ((n*7)%24)+1 end c,
      case when ((n-1)%16)+1 <= 13 and n<=16 then 'contratada'
           when ((n-1)%16)+1 > 13 and n<=16 then 'pendiente'
           when n%3=0 then 'rechazada' when n%3=1 then 'aceptada' else 'pendiente' end est,
      30 - n dias
    from generate_series(1,24) n) s;

  -- ── Visitas en todas las etapas ──
  insert into public.visitas (id, compita_id, usuario_id, estado, inicio, fin, fecha_programada, hora_inicio_programada, hora_fin_programada, rating_cliente, comentario_cliente, direccion, indicaciones, created_at)
  select ('dede0003-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
    ('dede0001-0000-4000-8000-'||lpad(c::text,12,'0'))::uuid,
    ('dede0002-0000-4000-8000-'||lpad(u::text,12,'0'))::uuid,
    est,
    case when est in ('terminada') then now() - (n*2||' days')::interval
         when est in ('en_curso','confirmando_inicio') then now() - interval '50 minutes' end,
    case when est = 'terminada' then now() - (n*2||' days')::interval + interval '2 hours' end,
    case when est in ('programada','pre_visita') then current_date + (n-35)%12 + 1
         when est = 'terminada' then (current_date - n*2) end,
    case when est in ('programada','pre_visita') then time '10:00' when est = 'terminada' then time '15:00' end,
    case when est in ('programada','pre_visita') then time '12:00' when est = 'terminada' then time '17:00' end,
    case when est = 'terminada' and n%5 <> 0 then 3 + (n%3) end,
    case when est = 'terminada' and n%5 <> 0 then (array['Excelente, mi mamá quedó feliz.','Muy puntual y cariñoso.','Conversaron mucho y salió a caminar.','Todo bien, gracias.','Mi papá pidió que vuelva pronto.'])[1+(n%5)] end,
    'Urbanización Demo, casa 12',
    'Tocar el timbre dos veces.',
    now() - ((n*2)+3||' days')::interval
  from (
    select n, case when n<=30 then ((n-1)%13)+1 else n-30 end u, (((case when n<=30 then ((n-1)%13)+1 else n-30 end)*5)%24)+1 c,
      case when n<=30 then 'terminada' when n<=34 then 'en_curso' when n<=36 then 'confirmando_inicio' when n<=41 then 'programada' else 'pre_visita' end est
    from generate_series(1,43) n) v;

  -- ── Chat de las visitas ──
  insert into public.mensajes (visit_id, origen, tipo, contenido, created_at)
  select ('dede0003-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, o, 'texto', txt, now() - (n*2||' days')::interval + (k*7||' minutes')::interval
  from generate_series(1,36) n,
    (values (1,'compita','Buenos días, ya llegué y estamos conversando.'),
            (2,'cliente','Qué bueno, gracias por avisar. ¿Cómo la ve hoy?'),
            (3,'compita','Muy animada. Tomó su desayuno completo.'),
            (4,'cliente','Perfecto, mil gracias.'),
            (5,'compita','Estamos terminando, todo en orden.')) m(k,o,txt)
  where n <= 36 and (n <= 12 or n >= 31);
  insert into public.mensajes (visit_id, origen, tipo, contenido, created_at)
  select ('dede0003-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, 'admin','texto','Equipo Compaz: ¿todo bien con la visita?', now() - (n*2||' days')::interval + interval '1 hour' from generate_series(1,4) n;

  -- ── Reportes de visita y reseñas ──
  insert into public.reportes_visita (visita_id, animo, participacion, entorno, fisico, novedad, resumen_ia)
  select ('dede0003-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, 3+(n%3), 3+((n+1)%3), 4, 3+((n+2)%3),
    case when n%4=0 then 'Comió poco y se le notó cansancio.' else 'Sin novedades.' end,
    'Resumen de demostración: visita tranquila, buen ánimo y conversación fluida.'
  from generate_series(1,20) n;
  insert into public.resenas (visita_id, cliente_id, compita_id, estrellas, texto, publicada)
  select v.id, v.usuario_id, v.compita_id, v.rating_cliente, v.comentario_cliente, true
  from public.visitas v where v.id::text like 'dede0003%' and v.estado='terminada' and v.rating_cliente is not null;
  update public.compitas c set visitas_realizadas = coalesce(x.v,0), total_ratings = coalesce(x.r,0), rating_promedio = x.p
  from (select compita_id, count(*) v, count(rating_cliente) r, round(avg(rating_cliente),2) p from public.visitas where id::text like 'dede0003%' and estado='terminada' group by 1) x
  where c.id = x.compita_id;

  -- ── Pagos ──
  insert into public.pagos_plan (usuario_id, plan, tipo, monto_usd, visitas, horas, metodo, estado, inicio, vence, referencia, registrado_por, anulado_motivo, created_at)
  select ('dede0002-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, pl, 'plan', case pl when 'carta' then 45 when 'quincenal' then 120 else 220 end,
    case pl when 'carta' then 1 when 'quincenal' then 4 else 8 end, 2, (array['zelle','transferencia','zelle','otro'])[1+(n%4)],
    case when n=12 then 'anulado' else 'activo' end, now() - (n*3||' days')::interval, now() + ((30-n*3)||' days')::interval, 'REF-DEMO-'||n, 'demo',
    case when n=12 then 'Pago duplicado' end, now() - (n*3||' days')::interval
  from (select n, (array['carta','quincenal','semanal'])[1+(n%3)] pl from generate_series(1,13) n) t;
  insert into public.pagos_plan (usuario_id, plan, tipo, monto_usd, visitas, horas, metodo, estado, inicio, vence, referencia, registrado_por, created_at)
  select ('dede0002-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, 'carta','extra', 45, 1, 2, 'zelle','activo', now() - (n||' days')::interval, now() + interval '20 days', 'EXTRA-DEMO-'||n, 'demo', now() - (n||' days')::interval
  from generate_series(2,4) n;
  insert into public.solicitudes_pago (usuario_id, plan, tipo, monto_usd, horas, metodo, estado, created_at, resuelta_at)
  select ('dede0002-0000-4000-8000-'||lpad(u::text,12,'0'))::uuid, pl, 'plan', mo, 2, me, est, now() - (d||' hours')::interval, case when est <> 'pendiente' then now() - ((d-1)||' hours')::interval end
  from (values (14,'quincenal',120,'zelle','pendiente',5),(15,'semanal',220,'transferencia','pendiente',20),(16,'carta',45,'zelle','pendiente',50),
               (5,'carta',45,'zelle','pendiente',3),(6,'quincenal',120,'transferencia','confirmado',30),(7,'carta',45,'zelle','cancelado',70)) t(u,pl,mo,me,est,d);

  -- ── Postulaciones (captación) ──
  delete from public.personas where email_norm like 'postulante%@demo.compaz.test';
  insert into public.personas (id, nombre, telefono_e164, email_norm, ciudad, region)
  select ('dede0005-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, 'Postulante '||n||' (Demo)', '+58414'||lpad((5550000+n)::text,7,'0'), 'postulante'||n||'@demo.compaz.test', 'Demo', 'Demo' from generate_series(1,12) n;
  insert into public.postulaciones (persona_id, tipo, nombre_declarado, telefono_declarado, email_declarado, ubicacion_declarada, fuente, clasificacion, coincidencia, airtable_estado, clave_idempotencia, recibida_en, utm_source, utm_campaign)
  select ('dede0005-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, tp, nom||' (Demo)', '+58414'||lpad((5550000+n)::text,7,'0'), 'postulante'||n||'@demo.compaz.test', ub, 'home', cl, 'nueva', 'no_aplica', gen_random_uuid(), now() - (n*7||' hours')::interval, (array['meta','instagram','google'])[1+(n%3)], 'demo-lanzamiento'
  from (values
   (1,'familia','Sofía Alcalá','Miami, Estados Unidos','pendiente'),(2,'compita','Yolimar Reyes','Valencia, Carabobo','pendiente'),
   (3,'familia','Daniel Cedeño','Madrid, España','calificada'),(4,'compita','Marisol Quiroz','Barquisimeto, Lara','calificada'),
   (5,'familia','Paola Linares','Santiago, Chile','pendiente'),(6,'compita','Cruz Delgado','Maracay, Aragua','no_calificada'),
   (7,'familia','Iván Sosa','Panamá','pendiente'),(8,'compita','Nancy Peña','Maturín, Monagas','pendiente'),
   (9,'familia','Teresa Gil','Bogotá, Colombia','spam'),(10,'compita','Omar Brito','Mérida','calificada'),
   (11,'familia','Lorena Ávila','Orlando, Estados Unidos','pendiente'),(12,'compita','Karelys Mora','Maracaibo, Zulia','pendiente')
  ) t(n,tp,nom,ub,cl);

  -- ── Señales, bitácora y avisos del equipo ──
  insert into public.admin_flags (entidad_tipo, entidad_id, entidad_nombre, tipo, nota, prioridad, reportado_por, resuelto, resuelto_at, created_at)
  select et, eid, en, 'general', '[demo] '||nota, pr, 'demo', res, case when res then now() - interval '2 hours' end, now() - (h||' hours')::interval
  from (values
   ('visita','dede0003-0000-4000-8000-000000000031','Visita en curso','Llevan más de 50 minutos sin mensaje, revisar.',3,false,2),
   ('compita','dede0001-0000-4000-8000-000000000007','Daniel Escalona (Demo)','Pidió cambiar su horario de la semana.',2,false,10),
   ('cliente','dede0002-0000-4000-8000-000000000004','Gustavo Lara (Demo)','Quiere aumentar la frecuencia de visitas.',1,false,26),
   ('compita','dede0001-0000-4000-8000-000000000012','Zoraida Mujica (Demo)','Faltó a la llamada de confirmación.',3,true,50),
   ('visita','dede0003-0000-4000-8000-000000000012','Visita terminada','Cliente reportó retraso de 15 minutos.',2,true,70)
  ) t(et,eid,en,nota,pr,res,h);
  insert into public.actividad_admin (categoria, nivel, entidad_tipo, entidad_id, entidad_nombre, resumen, creado_en)
  select cat, niv, 'cliente', null, nom, '[demo] '||res, now() - (h||' minutes')::interval
  from (values
   ('accion_equipo','actividad','Mariana Pérez (Demo)','Se registró un pago quincenal de 120 USD.',12),
   ('accion_equipo','actividad','Gustavo Lara (Demo)','Se asignó a Jesús Fernández (Demo).',45),
   ('acceso_chat','actividad','Visita en curso','El equipo abrió el chat de una visita.',90),
   ('acceso_contacto','actividad','Daniel Escalona (Demo)','El equipo vio el teléfono del compita.',130),
   ('accion_equipo','tarea','Lucía Barrios (Demo)','Pago por Zelle pendiente de confirmar.',200),
   ('portal_nuevo','actividad','Verónica Núñez (Demo)','Se activó el portal nuevo.',320),
   ('accion_equipo','urgente','Visita en curso','Visita sin movimiento hace 50 minutos.',20),
   ('accion_equipo','actividad','Postulante (Demo)','Postulación calificada y enviada a reclutamiento.',500)
  ) t(cat,niv,nom,res,h);

  insert into public.avisos (destinatario_tipo, destinatario_id, canal, estado, plantilla, entidad, entidad_id, paso, clave_unica, variables, creado_en, ultimo_intento_en, intentos)
  select dt, did, canal, est, pla, 'visita', ('dede0003-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, 1+(n%4), 'demo-aviso-'||n,
    jsonb_build_object('nombre','Demo'), now() - (n*3||' hours')::interval, now() - (n*3||' hours')::interval, 1
  from (
    select n, case when n%2=0 then 'cliente' else 'compita' end dt,
      case when n%2=0 then ('dede0002-0000-4000-8000-'||lpad(((n%13)+1)::text,12,'0'))::uuid else ('dede0001-0000-4000-8000-'||lpad(((n%24)+1)::text,12,'0'))::uuid end did,
      case when n%2=0 then 'correo' else 'telegram' end canal,
      case when n%9=0 then 'fallido' when n%7=0 then 'pendiente' else 'enviado' end est,
      (array['visita_confirmada','recordatorio_visita','visita_terminada','solicitud_nueva'])[1+(n%4)] pla
    from generate_series(1,24) n) a;

  -- ── Cancelaciones, reportes, bloqueos, pausas, notas, novedades, reservas ──
  insert into public.cancelaciones (solicitud_id, usuario_id, compita_id, visita_id, cancelado_por, tardia, motivo, horas_de_aviso, cuenta_como_usada, creado_en)
  values
   ('dede0004-0000-4000-8000-000000000003','dede0002-0000-4000-8000-000000000003','dede0001-0000-4000-8000-000000000016','dede0003-0000-4000-8000-000000000040','cliente',true,'Imprevisto familiar',3,true, now() - interval '2 days'),
   ('dede0004-0000-4000-8000-000000000005','dede0002-0000-4000-8000-000000000005','dede0001-0000-4000-8000-000000000020','dede0003-0000-4000-8000-000000000041','compita',false,'Enfermedad',30,false, now() - interval '4 days');
  insert into public.reportes_compita (compita_id, usuario_id, cuando, esta_bien, llamar, motivo, resultado, creado_en)
  values ('dede0001-0000-4000-8000-000000000011','dede0002-0000-4000-8000-000000000006','durante',true,false,'Incomodidad con el trato', null, now() - interval '1 day');
  insert into public.notas_persona (persona_id, persona_tipo, autor, texto, creado_en)
  select ('dede0001-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, 'compita', 'Equipo', (array['Muy puntual y atenta.','Pidió más visitas en la mañana.','Verificada por videollamada.'])[1+(n%3)], now() - (n||' days')::interval from generate_series(1,5) n;
  insert into public.notas_persona (persona_id, persona_tipo, autor, texto, creado_en)
  select ('dede0002-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, 'cliente', 'Equipo', (array['Prefiere comunicación por correo.','Familiar con mucha confianza en su compita.'])[1+(n%2)], now() - (n||' days')::interval from generate_series(1,4) n;
  insert into public.novedades_cliente (usuario_id, tipo, nivel, titulo, ruta, clave_unica, creada_en, vista_en)
  select ('dede0002-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, tipo, niv, tit, '/portal', 'demo-nov-'||n||'-'||tipo, now() - (n||' hours')::interval, case when n%3=0 then now() end
  from generate_series(1,8) n, (values ('compita_confirmo','accionable','Tu compita confirmó la visita'),('visita_termino','informativo','La visita terminó, ya puedes ver el reporte')) t(tipo,niv,tit);
  insert into public.reservas_horario (solicitud_id, cliente_id, compita_id, inicio, fin, estado, vence_en)
  values ('dede0004-0000-4000-8000-000000000021','dede0002-0000-4000-8000-000000000014','dede0001-0000-4000-8000-000000000008', now() + interval '2 days', now() + interval '2 days 2 hours','reservada', now() + interval '1 day');

  -- ── Equipo (colaboradores) y eventos ──
  insert into public.equipo (correo, nombre, permisos, activo, creado_por)
  values ('operaciones@demo.compaz.test','Sofía (Demo, operaciones)','{}'::jsonb,true,'demo'), ('pagos@demo.compaz.test','Marcos (Demo, pagos)','{}'::jsonb,true,'demo');
  insert into public.equipo_historial (correo, accion, detalle, hecho_por, hecho_en)
  values ('operaciones@demo.compaz.test','invitado','{}'::jsonb,'demo', now() - interval '5 days'), ('pagos@demo.compaz.test','invitado','{}'::jsonb,'demo', now() - interval '3 days');
  insert into public.eventos (modulo, tipo, entidad, entidad_id, actor, datos, creado_en)
  select (array['captacion','reclutamiento','operacion','comercial','direccion'])[1+(n%5)], (array['postulacion_recibida','compita_verificado','visita_terminada','pago_registrado','reporte_semanal'])[1+(n%5)], 'demo', gen_random_uuid(), 'demo', '{}'::jsonb, now() - (n*4||' hours')::interval
  from generate_series(1,15) n;
end
$act$;
