-- ══════════════════════════════════════════════════════════════════════════════
-- Compaz · Bloque 1 · Captación de postulaciones en Supabase
--
-- Estado: PENDIENTE DE VALIDAR EN STAGING. No aplicar en producción sin
-- autorización expresa.
--
-- Qué hace:
--   · Crea 3 tablas nuevas: personas, postulaciones y eventos.
--   · Crea las funciones que usa el servidor (solo service_role).
--   · No modifica ninguna tabla existente (compitas, usuarios, visitas…).
--
-- Identidad:
--   · El uuid de personas es el identificador permanente.
--   · Teléfono y correo NO son únicos: solo se reutiliza una persona cuando ambos
--     coinciden. Una coincidencia parcial crea otra persona marcada para revisión.
--
-- Reintento técnico frente a postulación nueva:
--   · Misma clave de idempotencia, o mismos datos y tipo en 15 min → reintento
--     técnico: no se crea nada nuevo.
--   · Misma persona y tipo fuera de esa ventana → postulación nueva "repetida",
--     sin copia a Airtable (sin segunda bienvenida).
--
-- Copia a Airtable sin duplicados (Airtable no ofrece claves de idempotencia):
--   · Cada postulación tiene una huella fija en Airtable: Contacto + Fecha, donde
--     Fecha = recibida_en con precisión de milisegundos, igual en todos los intentos.
--   · Primer intento: lo hace la ruta; la fila queda reservada 5 min para que el
--     cron no envíe en paralelo.
--   · Todo intento posterior BUSCA primero la huella en Airtable: si existe, se
--     vincula ese registro en lugar de crear otro (confirmación perdida o timeout).
--     Si hay más de una, queda en "conflicto" para revisión manual. Si la búsqueda
--     falla, no se crea nada.
--
-- Postulaciones que no llegan a Airtable (límite de 1.000, conflicto):
--   · Quedan en la bandeja postulaciones_por_resolver hasta que Luis o Juan las
--     resuelven: vinculándolas a un registro de Airtable, registrándolas
--     directamente en el CMC o marcándolas como no procedentes. Siempre con
--     autor, fecha, nota y evento.
--
-- Ruta de respaldo (Supabase caído → la web guarda directamente en Airtable):
--   · conciliar_registro_airtable importa a Supabase cada registro de Airtable
--     posterior a la activación que no esté vinculado, o lo vincula con la
--     postulación que ya tenga su huella. Es idempotente.
--
-- Seguridad:
--   · RLS activado y sin políticas: anon y authenticated no leen ni escriben.
--   · Se retiran los permisos por defecto de Supabase; service_role solo lee y
--     escribe mediante las funciones (security definer).
--   · eventos es de solo inserción (trigger y permisos).
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. personas
-- ──────────────────────────────────────────────────────────────────────────────
create table public.personas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (char_length(nombre) between 1 and 100),
  telefono_e164   text check (telefono_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email_norm      text check (email_norm = lower(btrim(email_norm)) and char_length(email_norm) <= 100),
  ciudad          text check (char_length(ciudad) <= 100),
  region          text check (char_length(region) <= 100),
  creada_en       timestamptz not null default now(),
  constraint personas_contacto_minimo check (telefono_e164 is not null or email_norm is not null)
);

create index personas_telefono_idx on public.personas (telefono_e164) where telefono_e164 is not null;
create index personas_email_idx on public.personas (email_norm) where email_norm is not null;

comment on table public.personas is
  'Identidad compartida por todos los módulos. El uuid es permanente; teléfono y correo no son únicos.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. postulaciones
-- ──────────────────────────────────────────────────────────────────────────────
create table public.postulaciones (
  id                        uuid primary key default gen_random_uuid(),
  persona_id                uuid not null references public.personas (id) on delete restrict,
  tipo                      text not null check (tipo in ('familia', 'compita', 'desconocido')),
  clasificacion             text not null default 'pendiente'
                              check (clasificacion in ('pendiente', 'calificada', 'no_calificada', 'spam', 'repetida')),
  repeticion_de             uuid references public.postulaciones (id),
  coincidencia              text not null
                              check (coincidencia in ('nueva', 'exacta', 'parcial_telefono', 'parcial_email', 'conflicto')),
  persona_coincidente_id    uuid references public.personas (id),
  fuente                    text not null check (fuente in ('home', 'se_compita', 'respaldo_airtable', 'importacion_airtable', 'otra')),
  utm_source                text check (char_length(utm_source) <= 50),
  utm_medium                text check (char_length(utm_medium) <= 50),
  utm_campaign              text check (char_length(utm_campaign) <= 50),
  utm_content               text check (char_length(utm_content) <= 100),
  utm_term                  text check (char_length(utm_term) <= 100),
  nombre_declarado          text not null check (char_length(nombre_declarado) <= 100),
  telefono_declarado        text not null check (char_length(telefono_declarado) <= 30),
  email_declarado           text not null check (char_length(email_declarado) <= 100),
  ubicacion_declarada       text not null check (char_length(ubicacion_declarada) <= 100),
  clave_idempotencia        uuid not null unique,
  -- Precisión de milisegundos: es la "Fecha" que se envía a Airtable y forma parte de la huella
  recibida_en               timestamptz not null default date_trunc('milliseconds', now()),
  -- Copia temporal a Airtable
  airtable_id               text unique check (airtable_id ~ '^rec[A-Za-z0-9]{14}$'),
  airtable_estado           text not null default 'pendiente'
                              check (airtable_estado in ('pendiente', 'enviada', 'error', 'agotada', 'conflicto', 'no_aplica')),
  airtable_intentos         integer not null default 0 check (airtable_intentos >= 0),
  airtable_ultimo_error     text check (char_length(airtable_ultimo_error) <= 500),
  airtable_proximo_intento  timestamptz default now(),
  airtable_reclamada_hasta  timestamptz,
  -- Resolución manual de lo que no llegó a Airtable (bandeja)
  resolucion                text check (resolucion in ('vinculada_airtable', 'registrada_en_cmc', 'no_procede')),
  resuelta_por              text check (char_length(resuelta_por) <= 120),
  resuelta_en               timestamptz,
  nota_resolucion           text check (char_length(nota_resolucion) <= 500),
  constraint postulaciones_resolucion_completa check (
    (resolucion is null and resuelta_en is null and resuelta_por is null)
    or (resolucion is not null and resuelta_en is not null and resuelta_por is not null)),
  constraint postulaciones_enviada_con_id check (airtable_estado <> 'enviada' or airtable_id is not null)
);

create index postulaciones_persona_idx on public.postulaciones (persona_id, tipo, recibida_en desc);
create index postulaciones_reintento_idx on public.postulaciones (telefono_declarado, recibida_en desc);
create index postulaciones_airtable_pend_idx on public.postulaciones (airtable_proximo_intento)
  where airtable_estado in ('pendiente', 'error');
create index postulaciones_por_resolver_idx on public.postulaciones (recibida_en)
  where airtable_estado in ('agotada', 'conflicto') and resuelta_en is null;

comment on table public.postulaciones is
  'Entrada de captación: familias (futuro Centro de Leads) y aspirantes (CMC). No crea clientes ni Compitas.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. eventos: historial inmutable común a todos los módulos
-- ──────────────────────────────────────────────────────────────────────────────
create table public.eventos (
  id          bigint generated always as identity primary key,
  modulo      text not null check (modulo in ('captacion', 'reclutamiento', 'operacion', 'comercial', 'direccion')),
  entidad     text not null check (char_length(entidad) <= 50),
  entidad_id  uuid not null,
  tipo        text not null check (char_length(tipo) <= 60),
  actor       text not null default 'sistema' check (char_length(actor) <= 120),
  datos       jsonb not null default '{}'::jsonb,
  creado_en   timestamptz not null default now()
);

create index eventos_entidad_idx on public.eventos (entidad, entidad_id, creado_en);

create function public.eventos_inmutables() returns trigger
language plpgsql as $$
begin
  raise exception 'eventos es de solo inserción (% no permitido)', tg_op using errcode = 'P0001';
end $$;

create trigger eventos_sin_update_delete
  before update or delete on public.eventos
  for each row execute function public.eventos_inmutables();

create trigger eventos_sin_truncate
  before truncate on public.eventos
  for each statement execute function public.eventos_inmutables();

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Permisos
-- ──────────────────────────────────────────────────────────────────────────────
alter table public.personas      enable row level security;
alter table public.postulaciones enable row level security;
alter table public.eventos       enable row level security;

revoke all on public.personas, public.postulaciones, public.eventos from public, anon, authenticated, service_role;
grant select on public.personas, public.postulaciones, public.eventos to service_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. registrar_postulacion
--    p_airtable_id y p_recibida_en solo se usan al importar un registro que ya
--    existe en Airtable (ruta de respaldo): entonces no hay copia que hacer.
-- ──────────────────────────────────────────────────────────────────────────────
create function public.registrar_postulacion(
  p_clave          uuid,
  p_tipo           text,
  p_fuente         text,
  p_nombre         text,
  p_telefono_e164  text,
  p_email_norm     text,
  p_ciudad         text,
  p_region         text,
  p_telefono_decl  text,
  p_email_decl     text,
  p_ubicacion_decl text,
  p_utm            jsonb default '{}'::jsonb,
  p_airtable_id    text default null,
  p_recibida_en    timestamptz default null
) returns table (postulacion_id uuid, persona_id uuid, resultado text, enviar_a_airtable boolean, recibida_en timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_previa      public.postulaciones%rowtype;
  v_exacta      uuid;
  v_por_tel     uuid;
  v_por_email   uuid;
  v_persona     uuid;
  v_coinc       text;
  v_coinc_id    uuid;
  v_anterior    uuid;
  v_id          uuid;
  v_enviar      boolean;
  v_resultado   text;
  v_recibida    timestamptz := date_trunc('milliseconds', coalesce(p_recibida_en, now()));
  v_importacion boolean := p_airtable_id is not null;
  k1 bigint; k2 bigint;
begin
  if p_telefono_e164 is null and p_email_norm is null then
    raise exception 'postulación sin teléfono ni correo' using errcode = '22023';
  end if;

  -- a) Serializar envíos de la misma persona (bloqueos en orden fijo: sin interbloqueos)
  k1 := hashtextextended('tel:' || coalesce(p_telefono_e164, ''), 0);
  k2 := hashtextextended('mail:' || coalesce(p_email_norm, ''), 0);
  perform pg_advisory_xact_lock(least(k1, k2));
  perform pg_advisory_xact_lock(greatest(k1, k2));

  -- b) Reintento técnico por clave (también hace idempotente la importación)
  select * into v_previa from public.postulaciones where clave_idempotencia = p_clave;
  if found then
    insert into public.eventos (modulo, entidad, entidad_id, tipo, datos)
      values ('captacion', 'postulacion', v_previa.id, 'reintento_tecnico', jsonb_build_object('motivo', 'misma_clave'));
    return query select v_previa.id, v_previa.persona_id, 'reintento_tecnico'::text, false, v_previa.recibida_en;
    return;
  end if;

  -- c) Reintento técnico por datos idénticos en 15 min (doble clic, recarga).
  --    No aplica a importaciones: un registro de Airtable siempre se conserva.
  if not v_importacion then
    select * into v_previa from public.postulaciones
     where tipo = p_tipo
       and telefono_declarado = p_telefono_decl
       and lower(email_declarado) = lower(p_email_decl)
       and nombre_declarado = p_nombre
       and ubicacion_declarada = p_ubicacion_decl
       and recibida_en > now() - interval '15 minutes'
     order by recibida_en desc limit 1;
    if found then
      insert into public.eventos (modulo, entidad, entidad_id, tipo, datos)
        values ('captacion', 'postulacion', v_previa.id, 'reintento_tecnico',
                jsonb_build_object('motivo', 'mismos_datos_15_min', 'clave_nueva', p_clave));
      return query select v_previa.id, v_previa.persona_id, 'reintento_tecnico'::text, false, v_previa.recibida_en;
      return;
    end if;
  end if;

  -- d) Identidad: solo la coincidencia exacta reutiliza una persona
  if p_telefono_e164 is not null and p_email_norm is not null then
    select id into v_exacta from public.personas
     where telefono_e164 = p_telefono_e164 and email_norm = p_email_norm
     order by creada_en limit 1;
  end if;
  if p_telefono_e164 is not null then
    select id into v_por_tel from public.personas where telefono_e164 = p_telefono_e164 order by creada_en limit 1;
  end if;
  if p_email_norm is not null then
    select id into v_por_email from public.personas where email_norm = p_email_norm order by creada_en limit 1;
  end if;

  if v_exacta is not null then
    v_persona := v_exacta; v_coinc := 'exacta';
  else
    v_coinc := case
      when v_por_tel is null and v_por_email is null then 'nueva'
      when v_por_tel is not null and v_por_email is not null then 'conflicto'
      when v_por_tel is not null then 'parcial_telefono'
      else 'parcial_email' end;
    v_coinc_id := coalesce(v_por_tel, v_por_email);
    insert into public.personas (nombre, telefono_e164, email_norm, ciudad, region)
      values (p_nombre, p_telefono_e164, p_email_norm, p_ciudad, p_region)
      returning id into v_persona;
  end if;

  -- e) Postulación previa del mismo tipo (misma persona, o mismo teléfono si es parcial)
  select id into v_anterior from public.postulaciones
   where tipo = p_tipo
     and (persona_id = v_persona or (v_coinc = 'parcial_telefono' and persona_id = v_coinc_id))
   order by recibida_en desc limit 1;

  v_enviar := v_anterior is null and not v_importacion;

  insert into public.postulaciones (
    persona_id, tipo, clasificacion, repeticion_de, coincidencia, persona_coincidente_id, fuente,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    nombre_declarado, telefono_declarado, email_declarado, ubicacion_declarada,
    clave_idempotencia, recibida_en, airtable_id, airtable_estado,
    airtable_reclamada_hasta, airtable_proximo_intento
  ) values (
    v_persona, p_tipo, case when v_anterior is null then 'pendiente' else 'repetida' end,
    v_anterior, v_coinc, v_coinc_id, p_fuente,
    nullif(p_utm->>'source', ''), nullif(p_utm->>'medium', ''), nullif(p_utm->>'campaign', ''),
    nullif(p_utm->>'content', ''), nullif(p_utm->>'term', ''),
    p_nombre, p_telefono_decl, p_email_decl, p_ubicacion_decl,
    p_clave, v_recibida, p_airtable_id,
    case when v_importacion then 'enviada' when v_enviar then 'pendiente' else 'no_aplica' end,
    -- El primer intento lo hace la ruta: reservado 5 min para que el cron no envíe en paralelo
    case when v_enviar then now() + interval '5 minutes' end,
    case when v_enviar then now() + interval '2 minutes' end
  ) returning id into v_id;

  v_resultado := case when v_anterior is not null then 'repetida' else 'registrada' end;

  insert into public.eventos (modulo, entidad, entidad_id, tipo, datos)
    values ('captacion', 'postulacion', v_id,
            case when v_importacion then 'importada_desde_airtable' else 'postulacion_recibida' end,
            jsonb_build_object('resultado', v_resultado, 'tipo', p_tipo, 'fuente', p_fuente,
                               'persona_id', v_persona, 'coincidencia', v_coinc,
                               'persona_coincidente_id', v_coinc_id, 'repeticion_de', v_anterior,
                               'airtable_id', p_airtable_id));

  return query select v_id, v_persona, v_resultado, v_enviar, v_recibida;
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. Cola de copia a Airtable
-- ──────────────────────────────────────────────────────────────────────────────
create function public.reclamar_envios_airtable(p_limite integer default 10)
returns setof public.postulaciones
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.postulaciones p
     set airtable_reclamada_hasta = now() + interval '5 minutes'
   where p.id in (
     select id from public.postulaciones
      where airtable_estado in ('pendiente', 'error')
        and airtable_proximo_intento <= now()
        and (airtable_reclamada_hasta is null or airtable_reclamada_hasta < now())
      order by recibida_en
      limit greatest(1, least(p_limite, 50))
      for update skip locked)
  returning p.*;
$$;

-- p_estado: 'enviada' (creada o encontrada en Airtable), 'error' o 'conflicto'
create function public.marcar_envio_airtable(p_id uuid, p_estado text, p_airtable_id text default null, p_error text default null)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_estado text;
begin
  if p_estado not in ('enviada', 'error', 'conflicto') then
    raise exception 'estado no válido: %', p_estado using errcode = '22023';
  end if;
  if p_estado = 'enviada' and (p_airtable_id is null or p_airtable_id !~ '^rec[A-Za-z0-9]{14}$') then
    raise exception 'enviada requiere un id de Airtable válido' using errcode = '22023';
  end if;

  if p_estado = 'enviada' then
    -- También desde agotada/conflicto: un registro encontrado más tarde se vincula,
    -- salvo que alguien ya lo haya resuelto a mano.
    update public.postulaciones
       set airtable_estado = 'enviada', airtable_id = p_airtable_id,
           airtable_reclamada_hasta = null, airtable_ultimo_error = null
     where id = p_id and resuelta_en is null
       and airtable_estado in ('pendiente', 'error', 'agotada', 'conflicto')
     returning airtable_estado into v_estado;
  elsif p_estado = 'conflicto' then
    update public.postulaciones
       set airtable_estado = 'conflicto', airtable_ultimo_error = left(p_error, 500), airtable_reclamada_hasta = null
     where id = p_id and airtable_estado in ('pendiente', 'error')
     returning airtable_estado into v_estado;
  else
    update public.postulaciones
       set airtable_intentos = airtable_intentos + 1,
           airtable_estado = case when airtable_intentos + 1 >= 5 then 'agotada' else 'error' end,
           airtable_ultimo_error = left(p_error, 500),
           airtable_proximo_intento = now() + make_interval(mins => power(2, airtable_intentos + 1)::int),
           airtable_reclamada_hasta = null
     where id = p_id and airtable_estado in ('pendiente', 'error')
     returning airtable_estado into v_estado;
  end if;

  insert into public.eventos (modulo, entidad, entidad_id, tipo, datos)
    values ('captacion', 'postulacion', p_id,
            case when v_estado is null then 'airtable_marca_ignorada' else 'airtable_' || v_estado end,
            jsonb_build_object('pedido', p_estado, 'airtable_id', p_airtable_id, 'error', left(p_error, 200)));
  return v_estado;   -- null: la fila ya no admitía ese cambio
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. Conciliación de registros de Airtable (ruta de respaldo y confirmaciones perdidas)
--    Devuelve: ya_vinculada | adoptada | importada | ambigua
-- ──────────────────────────────────────────────────────────────────────────────
create function public.conciliar_registro_airtable(
  p_airtable_id    text,
  p_fecha          timestamptz,
  p_tipo           text,
  p_nombre         text,
  p_telefono_decl  text,
  p_email_decl     text,
  p_ubicacion_decl text,
  p_telefono_e164  text,
  p_email_norm     text,
  p_ciudad         text,
  p_region         text,
  p_utm            jsonb default '{}'::jsonb
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[];
begin
  if p_airtable_id !~ '^rec[A-Za-z0-9]{14}$' then
    raise exception 'id de Airtable no válido' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('airtable:' || p_airtable_id, 0));

  if exists (select 1 from public.postulaciones where airtable_id = p_airtable_id) then
    return 'ya_vinculada';
  end if;

  -- ¿Es la copia de una postulación nuestra cuya confirmación se perdió? (misma huella)
  select array_agg(id) into v_ids from public.postulaciones
   where airtable_id is null
     and recibida_en = date_trunc('milliseconds', p_fecha)
     and telefono_declarado = p_telefono_decl
     and lower(email_declarado) = lower(p_email_decl);

  if coalesce(array_length(v_ids, 1), 0) = 1 then
    if public.marcar_envio_airtable(v_ids[1], 'enviada', p_airtable_id, null) is not null then
      return 'adoptada';
    end if;
    -- Ya resuelta a mano: se deja constancia y no se toca
    insert into public.eventos (modulo, entidad, entidad_id, tipo, datos)
      values ('captacion', 'postulacion', v_ids[1], 'airtable_registro_tardio', jsonb_build_object('airtable_id', p_airtable_id));
    return 'ambigua';
  elsif coalesce(array_length(v_ids, 1), 0) > 1 then
    insert into public.eventos (modulo, entidad, entidad_id, tipo, datos)
      select 'captacion', 'postulacion', unnest(v_ids), 'airtable_conciliacion_ambigua', jsonb_build_object('airtable_id', p_airtable_id);
    return 'ambigua';
  end if;

  -- No existe en Supabase: se importa (guardada por la ruta de respaldo o creada a mano)
  perform public.registrar_postulacion(
    md5('airtable:' || p_airtable_id)::uuid, p_tipo, 'respaldo_airtable', p_nombre,
    p_telefono_e164, p_email_norm, p_ciudad, p_region,
    p_telefono_decl, p_email_decl, p_ubicacion_decl, p_utm, p_airtable_id, p_fecha);
  return 'importada';
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. Bandeja: postulaciones que no llegaron a Airtable, hasta su resolución
-- ──────────────────────────────────────────────────────────────────────────────
create function public.postulaciones_por_resolver(p_limite integer default 200)
returns table (
  id uuid, recibida_en timestamptz, tipo text, nombre text, telefono text, email text, ubicacion text,
  airtable_estado text, airtable_intentos integer, airtable_ultimo_error text, coincidencia text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.recibida_en, p.tipo, p.nombre_declarado, p.telefono_declarado, p.email_declarado,
         p.ubicacion_declarada, p.airtable_estado, p.airtable_intentos, p.airtable_ultimo_error, p.coincidencia
    from public.postulaciones p
   where p.airtable_estado in ('agotada', 'conflicto') and p.resuelta_en is null
   order by p.recibida_en
   limit greatest(1, least(p_limite, 500));
$$;

create function public.resolver_postulacion(
  p_id uuid, p_resolucion text, p_actor text, p_nota text default null, p_airtable_id text default null
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_ok boolean;
begin
  if p_resolucion not in ('vinculada_airtable', 'registrada_en_cmc', 'no_procede') then
    raise exception 'resolución no válida' using errcode = '22023';
  end if;
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'falta el operador' using errcode = '22023';
  end if;
  if p_resolucion = 'vinculada_airtable' and (p_airtable_id is null or p_airtable_id !~ '^rec[A-Za-z0-9]{14}$') then
    raise exception 'vincular requiere un id de Airtable válido' using errcode = '22023';
  end if;
  if p_resolucion <> 'vinculada_airtable' and coalesce(btrim(p_nota), '') = '' then
    raise exception 'esta resolución requiere una nota (p. ej. el ID COM- o el motivo)' using errcode = '22023';
  end if;

  update public.postulaciones
     set resolucion = p_resolucion, resuelta_por = left(p_actor, 120), resuelta_en = now(),
         nota_resolucion = left(p_nota, 500),
         airtable_id = case when p_resolucion = 'vinculada_airtable' then p_airtable_id else airtable_id end,
         airtable_estado = case when p_resolucion = 'vinculada_airtable' then 'enviada' else 'no_aplica' end
   where id = p_id and airtable_estado in ('agotada', 'conflicto') and resuelta_en is null
  returning true into v_ok;

  if v_ok then
    insert into public.eventos (modulo, entidad, entidad_id, tipo, actor, datos)
      values ('captacion', 'postulacion', p_id, 'resuelta_' || p_resolucion, left(p_actor, 120),
              jsonb_build_object('nota', left(p_nota, 200), 'airtable_id', p_airtable_id));
  end if;
  return coalesce(v_ok, false);
end $$;

-- Ids de Airtable ya vinculados desde una fecha (para que la conciliación solo procese lo nuevo)
create function public.airtable_ids_vinculados(p_desde timestamptz)
returns setof text
language sql
security definer
set search_path = public, pg_temp
as $$
  select airtable_id from public.postulaciones
   where airtable_id is not null and recibida_en >= p_desde - interval '1 day';
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 9. Ejecución: solo service_role
-- ──────────────────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.registrar_postulacion(uuid, text, text, text, text, text, text, text, text, text, text, jsonb, text, timestamptz)',
    'public.reclamar_envios_airtable(integer)',
    'public.marcar_envio_airtable(uuid, text, text, text)',
    'public.conciliar_registro_airtable(text, timestamptz, text, text, text, text, text, text, text, text, text, jsonb)',
    'public.postulaciones_por_resolver(integer)',
    'public.resolver_postulacion(uuid, text, text, text, text)',
    'public.airtable_ids_vinculados(timestamptz)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  revoke all on function public.eventos_inmutables() from public, anon, authenticated;
end $$;

commit;
