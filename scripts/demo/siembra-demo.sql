-- ══════════════════════════════════════════════════════════════════════════════
-- Compaz — Siembra de actividad ficticia para GRABAR el demo.
-- SOLO para la base de demostración (la vieja de São Paulo). NUNCA correr en compaz-prod.
-- Repetible: borra lo demo (ids dede000X-… y correos @demo.compaz.test) y lo vuelve a crear con fechas relativas a hoy.
-- ══════════════════════════════════════════════════════════════════════════════
do $demo$
declare
  v_ids_c uuid[]; v_ids_u uuid[]; v_ids_v uuid[]; v_ids_s uuid[];
begin
  if current_database() <> 'postgres' then raise exception 'base inesperada'; end if;
  -- Salvaguarda: no correr en producción (compaz-prod tiene la marca).
  if exists (select 1 from public.ajustes where clave = '__es_produccion__') then raise exception 'ESTA ES PRODUCCION, no se siembra'; end if;

  v_ids_c := array(select ('dede0001-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,24) n);
  v_ids_u := array(select ('dede0002-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,16) n);
  v_ids_v := array(select ('dede0003-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,80) n);
  v_ids_s := array(select ('dede0004-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,40) n);

  -- ── Limpieza de una siembra anterior ────────────────────────────────────────
  delete from public.mensajes where visit_id = any(v_ids_v);
  delete from public.reportes_visita where visita_id = any(v_ids_v);
  delete from public.resenas where visita_id = any(v_ids_v);
  delete from public.cancelaciones where usuario_id = any(v_ids_u);
  delete from public.reservas_horario where cliente_id = any(v_ids_u);
  delete from public.cambios_lugar where cliente_id = any(v_ids_u);
  delete from public.reportes_compita where compita_id = any(v_ids_c);
  delete from public.bloqueos_compita_cliente where compita_id = any(v_ids_c);
  delete from public.pausas_contacto where persona_id = any(v_ids_c) or persona_id = any(v_ids_u);
  delete from public.notas_persona where persona_id = any(v_ids_c) or persona_id = any(v_ids_u);
  delete from public.novedades_cliente where usuario_id = any(v_ids_u);
  delete from public.avisos where destinatario_id = any(v_ids_c) or destinatario_id = any(v_ids_u);
  delete from public.admin_flags where nota like '[demo]%';
  delete from public.actividad_admin where resumen like '[demo]%';
  delete from public.eventos where actor = 'demo';
  delete from public.solicitudes_pago where usuario_id = any(v_ids_u);
  delete from public.pagos_plan where usuario_id = any(v_ids_u);
  delete from public.visitas where id = any(v_ids_v) or usuario_id = any(v_ids_u);
  delete from public.solicitudes where id = any(v_ids_s) or cliente_id = any(v_ids_u);
  delete from public.postulaciones where nombre_declarado like '%(Demo)';
  delete from public.equipo where correo like '%@demo.compaz.test';
  delete from public.equipo_historial where correo like '%@demo.compaz.test';
  delete from public.usuarios where id = any(v_ids_u);
  delete from auth.users where email like '%@demo.compaz.test';
  delete from public.compitas where id = any(v_ids_c);

  -- ── 24 compitas, uno por estado, reales para el panel (es_demo=false) y con Telegram ficticio ──
  insert into public.compitas (id, nombre, apellido, zona, estado, verificado, es_demo, visitas_realizadas, telegram_chat_id, foto_url, youtube_url, descripcion, servicios, horarios_disponibles, codigo, rating_promedio, total_ratings, fecha_ingreso, created_at)
  select ('dede0001-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, nombre, apellido||' (Demo)', zona,
    case when n in (9,17) then 'inactivo' else 'activo' end,
    n not in (9,17,24), false, 0, 'demo-'||n,
    'https://api.dicebear.com/9.x/avataaars/svg?seed=compaz-demo-'||sem,
    'https://www.youtube.com/watch?v=3SWQCDJz6R8',
    'Perfil de demostración, no es una persona real. Existe solo para mostrar cómo se ve el sistema en '||split_part(zona,' — ',1)||'.',
    serv,
    (select jsonb_agg(jsonb_build_object('dia',d,'inicio','09:00','fin','17:00')) from unnest(array['lunes','martes','miércoles','jueves','viernes']) d),
    'COM-'||(9000+n), null, 0, current_date - (n*9), now() - (n*9 || ' days')::interval
  from (values
   (1,'Andrea','Rojas','Amazonas — Atures','amz',array['Compañía','Asistencia personal']),
   (2,'Carlos','Mendoza','Anzoátegui — Simón Bolívar','anz',array['Compañía','Traslados médicos']),
   (3,'Rosa','Linares','Apure — San Fernando','apu',array['Compañía','Preparación de alimentos']),
   (4,'Mariela','Ochoa','Aragua — Girardot','ara',array['Asistencia personal','Ejercicios terapéuticos']),
   (5,'José','Paredes','Barinas — Barinas','bar',array['Compañía','Asistencia personal']),
   (6,'Nelly','Carvajal','Bolívar — Angostura del Orinoco','bol',array['Compañía','Preparación de alimentos']),
   (7,'Daniel','Escalona','Carabobo — Valencia','car',array['Asistencia personal','Traslados médicos']),
   (8,'Yaneth','Rivas','Cojedes — San Carlos','coj',array['Compañía','Asistencia personal']),
   (9,'Luis','Maita','Delta Amacuro — Tucupita','del',array['Compañía','Preparación de alimentos']),
   (10,'Gabriela','Salcedo','Distrito Capital — Libertador','dc',array['Compañía','Asistencia personal','Traslados médicos']),
   (11,'Pedro','Colmenares','Falcón — Carirubana','fal',array['Compañía','Ejercicios terapéuticos']),
   (12,'Zoraida','Mujica','Guárico — Leonardo Infante','gua',array['Compañía','Preparación de alimentos']),
   (13,'Alejandro','Giménez','Lara — Iribarren','lar',array['Asistencia personal','Traslados médicos']),
   (14,'Beatriz','Dávila','Mérida — Libertador','mer',array['Compañía','Ejercicios terapéuticos']),
   (15,'Wilmer','Hernández','Miranda — Sucre','mir',array['Compañía','Asistencia personal']),
   (16,'Karina','Salazar','Monagas — Maturín','mon',array['Compañía','Preparación de alimentos']),
   (17,'Ramón','Marcano','Nueva Esparta — Mariño','nue',array['Compañía','Asistencia personal']),
   (18,'Elena','Pinto','Portuguesa — Guanare','por',array['Compañía','Preparación de alimentos']),
   (19,'Oswaldo','Brito','Sucre — Sucre','suc',array['Asistencia personal','Traslados médicos']),
   (20,'Lisbeth','Cárdenas','Táchira — San Cristóbal','tac',array['Compañía','Ejercicios terapéuticos']),
   (21,'Ana','Briceño','Trujillo — Valera','tru',array['Compañía','Asistencia personal']),
   (22,'Tomás','Ibarra','Vargas — Vargas','var',array['Compañía','Preparación de alimentos']),
   (23,'Mireya','Torrealba','Yaracuy — San Felipe','yar',array['Compañía','Asistencia personal']),
   (24,'Jesús','Fernández','Zulia — Maracaibo','zul',array['Compañía','Asistencia personal','Traslados médicos'])
  ) t(n,nombre,apellido,zona,sem,serv);

  -- ── 16 clientes (cuentas de acceso ficticias, nadie inicia sesión con ellas) ──
  insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new)
  select '00000000-0000-0000-0000-000000000000', ('dede0002-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, 'authenticated','authenticated',
    'cliente'||n||'@demo.compaz.test','',now(),'{"provider":"email","providers":["email"]}','{}', now() - (n*6||' days')::interval, now(),'','','',''
  from generate_series(1,16) n;

  delete from public.usuarios where id = any(v_ids_u); -- un trigger de auth.users ya creó una fila vacía
  insert into public.usuarios (id,nombre,email,zona,plan,plan_contratado,plan_inicio,activado,compita_id,familiar_nombre,familiar_edad,familiar_condicion,familiar_notas,telefono,pais,parentesco,portal_nuevo,terminos_version,terminos_aceptados_en,created_at)
  select ('dede0002-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, nombre||' (Demo)', 'cliente'||n||'@demo.compaz.test', zona,
    null, case when n<=13 then (array['carta','quincenal','semanal'])[1+(n%3)] else null end,
    case when n<=13 then now() - ((n*3)||' days')::interval end,
    n<=14, case when n<=13 then ('dede0001-0000-4000-8000-'||lpad(((n*5)%24+1)::text,12,'0'))::uuid end,
    fam, 70+(n*2)%20, cond, 'Datos de demostración.', '+1305555'||lpad((1000+n)::text,4,'0'), pais, par, true, 'provisional-1', now() - ((n*6)||' days')::interval, now() - ((n*6)||' days')::interval
  from (values
   (1,'Mariana Pérez','Distrito Capital — Libertador','Estados Unidos','Hija','Elena Pérez','Movilidad reducida'),
   (2,'Jorge Salas','Miranda — Sucre','España','Hijo','Carmen Salas','Vive sola'),
   (3,'Verónica Núñez','Carabobo — Valencia','Estados Unidos','Hija','Raúl Núñez','Diabetes'),
   (4,'Gustavo Lara','Zulia — Maracaibo','Chile','Hijo','Isabel Lara','Alzheimer inicial'),
   (5,'Patricia Ortega','Lara — Iribarren','Panamá','Hija','Luis Ortega','Recuperación de cadera'),
   (6,'Rafael Medina','Aragua — Girardot','Estados Unidos','Hijo','Marta Medina','Soledad'),
   (7,'Claudia Ferrer','Mérida — Libertador','Colombia','Hija','Pedro Ferrer','Hipertensión'),
   (8,'Andrés Vivas','Táchira — San Cristóbal','España','Hijo','Rosa Vivas','Vive sola'),
   (9,'Lucía Barrios','Anzoátegui — Simón Bolívar','Estados Unidos','Hija','Josefina Barrios','Movilidad reducida'),
   (10,'Héctor Bravo','Bolívar — Angostura del Orinoco','Canadá','Hijo','Nicolás Bravo','Parkinson'),
   (11,'Silvia Rangel','Monagas — Maturín','Estados Unidos','Hija','Aura Rangel','Soledad'),
   (12,'Mauricio Duarte','Falcón — Carirubana','Chile','Hijo','Hilda Duarte','Diabetes'),
   (13,'Adriana Quintero','Portuguesa — Guanare','Estados Unidos','Hija','Tomás Quintero','Recuperación de cirugía'),
   (14,'Fernando Alcalá','Sucre — Sucre','España','Hijo','Dilia Alcalá','Vive sola'),
   (15,'Beatriz Toro','Trujillo — Valera','Estados Unidos','Hija','Manuel Toro','Alzheimer inicial'),
   (16,'Esteban Cova','Yaracuy — San Felipe','Panamá','Hijo','Gladys Cova','Hipertensión')
  ) t(n,nombre,zona,pais,par,fam,cond);
end
$demo$;
