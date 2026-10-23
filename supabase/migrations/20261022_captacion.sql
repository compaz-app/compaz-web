-- ══════════════════════════════════════════════════════════════════════════════
-- Compaz · Bloque 1 · Captación de postulaciones en Supabase
--
-- Estado: PENDIENTE DE VALIDAR EN STAGING. No aplicar en producción sin
-- autorización expresa.
--
-- Qué hace:
--   · Crea 3 tablas nuevas: personas, postulaciones y eventos.
--   · Crea las funciones que usa el servidor (solo service_role):
--       registrar_postulacion, reclamar_envios_airtable, marcar_envio_airtable,
--       postulaciones_para_cmc y confirmar_entrega_cmc.
--   · No modifica ninguna tabla existente (compitas, usuarios, visitas…).
--
-- Identidad (decisión del 22 oct):
--   · El uuid de personas es el identificador permanente.
--   · Ni el teléfono ni el correo son únicos. Sirven para detectar coincidencias:
--     solo se reutiliza una persona cuando teléfono Y correo coinciden con ella.
--     Cualquier coincidencia parcial crea una persona nueva marcada para revisión,
--     para no fusionar a dos personas por error.
--
-- Reintento técnico frente a postulación nueva:
--   · Misma clave de idempotencia → reintento técnico: no se crea nada nuevo.
--   · Mismos datos y mismo tipo en los últimos 15 minutos → reintento técnico
--     (doble clic, recarga del formulario): no se crea nada nuevo.
--   · Misma persona y mismo tipo fuera de esa ventana → postulación nueva legítima,
--     guardada como "repetida" y sin reenvío a Airtable (sin segunda bienvenida).
--
-- Si Airtable no acepta registros (límite de 1.000 u otra caída prolongada):
--   · Tras 5 intentos fallidos la postulación queda "agotada" y el CMC puede leerla
--     desde Supabase (postulaciones_para_cmc) y confirmar su recepción
--     (confirmar_entrega_cmc). Una postulación entregada así ya no se envía a
--     Airtable, de modo que nunca entra dos veces al CMC.
--
-- Seguridad:
--   · RLS activado y sin políticas: anon y authenticated no leen ni escriben.
--   · Se retiran explícitamente los permisos por defecto que Supabase concede.
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
  -- Cómo se resolvió la identidad al llegar
  coincidencia              text not null
                              check (coincidencia in ('nueva', 'exacta', 'parcial_telefono', 'parcial_email', 'conflicto')),
  persona_coincidente_id    uuid references public.personas (id),   -- posible duplicado, a revisar
  fuente                    text not null check (fuente in ('home', 'se_compita', 'importacion_airtable', 'otra')),
  utm_source                text check (char_length(utm_source) <= 50),
  utm_medium                text check (char_length(utm_medium) <= 50),
  utm_campaign              text check (char_length(utm_campaign) <= 50),
  utm_content               text check (char_length(utm_content) <= 100),
  utm_term                  text check (char_length(utm_term) <= 100),
  -- Datos declarados tal cual llegaron (personas no se sobrescribe)
  nombre_declarado          text not null check (char_length(nombre_declarado) <= 100),
  telefono_declarado        text not null check (char_length(telefono_declarado) <= 30),
  email_declarado           text not null check (char_length(email_declarado) <= 100),
  ubicacion_declarada       text not null check (char_length(ubicacion_declarada) <= 100),
  clave_idempotencia        uuid not null unique,
  -- Copia temporal a Airtable
  airtable_id               text unique check (airtable_id ~ '^rec[A-Za-z0-9]{14}$'),
  airtable_estado           text not null default 'pendiente'
                              check (airtable_estado in ('pendiente', 'enviada', 'error', 'agotada', 'no_aplica')),
  airtable_intentos         integer not null default 0 check (airtable_intentos >= 0),
  airtable_ultimo_error     text check (char_length(airtable_ultimo_error) <= 500),
  airtable_proximo_intento  timestamptz default now(),
  airtable_reclamada_hasta  timestamptz,
  -- Entrega directa al CMC cuando Airtable no está disponible
  entregada_cmc_en          timestamptz,
  recibida_en               timestamptz not null default now(),
  constraint postulaciones_entrega_unica check (not (airtable_estado = 'enviada' and entregada_cmc_en is not null))
);

create index postulaciones_persona_idx on public.postulaciones (persona_id, tipo, recibida_en desc);
create index postulaciones_airtable_pend_idx on public.postulaciones (airtable_proximo_intento)
  where airtable_estado in ('pendiente', 'error');
create index postulaciones_reintento_idx on public.postulaciones (telefono_declarado, recibida_en desc);
create index postulaciones_agotadas_idx on public.postulaciones (recibida_en)
  where airtable_estado = 'agotada' and entregada_cmc_en is null;

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
-- Las escrituras pasan siempre por las funciones de abajo (security definer).

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. registrar_postulacion
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
  p_utm            jsonb default '{}'::jsonb
) returns table (postulacion_id uuid, persona_id uuid, resultado text, enviar_a_airtable boolean)
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

  -- b) Reintento técnico por clave
  select * into v_previa from public.postulaciones where clave_idempotencia = p_clave;
  if found then
    insert into public.eventos (modulo, entidad, entidad_id, tipo, datos)
      values ('captacion', 'postulacion', v_previa.id, 'reintento_tecnico', jsonb_build_object('motivo', 'misma_clave'));
    return query select v_previa.id, v_previa.persona_id, 'reintento_tecnico'::text, false;
    return;
  end if;

  -- c) Reintento técnico por datos idénticos en 15 minutos (doble clic, recarga)
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
    return query select v_previa.id, v_previa.persona_id, 'reintento_tecnico'::text, false;
    return;
  end if;

  -- d) Identidad: solo coincidencia exacta reutiliza una persona
  if p_telefono_e164 is not null and p_email_norm is not null then
    select id into v_exacta from public.personas
     where telefono_e164 = p_telefono_e164 and email_norm = p_email_norm
     order by creada_en limit 1;
  end if;
  if p_telefono_e164 is not null then
    select id into v_por_tel from public.personas
     where telefono_e164 = p_telefono_e164 order by creada_en limit 1;
  end if;
  if p_email_norm is not null then
    select id into v_por_email from public.personas
     where email_norm = p_email_norm order by creada_en limit 1;
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
     and (persona_id = v_persona
          or (v_coinc = 'parcial_telefono' and persona_id = v_coinc_id))
   order by recibida_en desc limit 1;

  -- Se reenvía a Airtable salvo que sea una repetición de la misma persona.
  -- parcial_email (correo compartido en una familia) sí se envía: puede ser otra persona.
  v_enviar := v_anterior is null;

  insert into public.postulaciones (
    persona_id, tipo, clasificacion, repeticion_de, coincidencia, persona_coincidente_id, fuente,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    nombre_declarado, telefono_declarado, email_declarado, ubicacion_declarada,
    clave_idempotencia, airtable_estado
  ) values (
    v_persona, p_tipo, case when v_anterior is null then 'pendiente' else 'repetida' end,
    v_anterior, v_coinc, v_coinc_id, p_fuente,
    nullif(p_utm->>'source', ''), nullif(p_utm->>'medium', ''), nullif(p_utm->>'campaign', ''),
    nullif(p_utm->>'content', ''), nullif(p_utm->>'term', ''),
    p_nombre, p_telefono_decl, p_email_decl, p_ubicacion_decl,
    p_clave, case when v_enviar then 'pendiente' else 'no_aplica' end
  ) returning id into v_id;

  v_resultado := case when v_anterior is not null then 'repetida' else 'registrada' end;

  insert into public.eventos (modulo, entidad, entidad_id, tipo, datos)
    values ('captacion', 'postulacion', v_id, 'postulacion_recibida',
            jsonb_build_object('resultado', v_resultado, 'tipo', p_tipo, 'fuente', p_fuente,
                               'persona_id', v_persona, 'coincidencia', v_coinc,
                               'persona_coincidente_id', v_coinc_id, 'repeticion_de', v_anterior));

  return query select v_id, v_persona, v_resultado, v_enviar;
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. Cola de envíos a Airtable (reclamar / marcar; segura ante crons solapados)
-- ──────────────────────────────────────────────────────────────────────────────
create function public.reclamar_envios_airtable(p_limite integer default 20)
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
      limit greatest(1, least(p_limite, 100))
      for update skip locked)
  returning p.*;
$$;

create function public.marcar_envio_airtable(p_id uuid, p_ok boolean, p_airtable_id text default null, p_error text default null)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_estado text;
begin
  if p_ok then
    update public.postulaciones
       set airtable_estado = 'enviada', airtable_id = p_airtable_id,
           airtable_reclamada_hasta = null, airtable_ultimo_error = null
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

  if v_estado is not null then
    insert into public.eventos (modulo, entidad, entidad_id, tipo, datos)
      values ('captacion', 'postulacion', p_id, 'airtable_' || v_estado,
              jsonb_build_object('airtable_id', p_airtable_id, 'error', left(p_error, 200)));
  end if;
  return v_estado;   -- null si ya no estaba pendiente (p. ej. entregada al CMC)
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. Entrega directa al CMC (solo postulaciones que Airtable no aceptó)
-- ──────────────────────────────────────────────────────────────────────────────
create function public.postulaciones_para_cmc(p_limite integer default 100)
returns table (
  id uuid, recibida_en timestamptz, tipo text, nombre text, telefono text, email text,
  ubicacion text, utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  coincidencia text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.recibida_en, p.tipo, p.nombre_declarado, p.telefono_declarado, p.email_declarado,
         p.ubicacion_declarada, p.utm_source, p.utm_medium, p.utm_campaign, p.utm_content, p.utm_term,
         p.coincidencia
    from public.postulaciones p
   where p.airtable_estado = 'agotada' and p.entregada_cmc_en is null
   order by p.recibida_en
   limit greatest(1, least(p_limite, 500));
$$;

create function public.confirmar_entrega_cmc(p_ids uuid[], p_actor text default 'cmc')
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_n integer;
begin
  with marcadas as (
    update public.postulaciones
       set entregada_cmc_en = now(), airtable_estado = 'no_aplica'
     where id = any (p_ids) and airtable_estado = 'agotada' and entregada_cmc_en is null
     returning id
  ), ev as (
    insert into public.eventos (modulo, entidad, entidad_id, tipo, actor)
      select 'captacion', 'postulacion', id, 'entregada_cmc', left(p_actor, 120) from marcadas
  )
  select count(*) into v_n from marcadas;
  return v_n;
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. Ejecución: solo service_role
-- ──────────────────────────────────────────────────────────────────────────────
revoke all on function public.registrar_postulacion(uuid, text, text, text, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.reclamar_envios_airtable(integer) from public, anon, authenticated;
revoke all on function public.marcar_envio_airtable(uuid, boolean, text, text) from public, anon, authenticated;
revoke all on function public.postulaciones_para_cmc(integer) from public, anon, authenticated;
revoke all on function public.confirmar_entrega_cmc(uuid[], text) from public, anon, authenticated;
revoke all on function public.eventos_inmutables() from public, anon, authenticated;
grant execute on function public.registrar_postulacion(uuid, text, text, text, text, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.reclamar_envios_airtable(integer) to service_role;
grant execute on function public.marcar_envio_airtable(uuid, boolean, text, text) to service_role;
grant execute on function public.postulaciones_para_cmc(integer) to service_role;
grant execute on function public.confirmar_entrega_cmc(uuid[], text) to service_role;

commit;
