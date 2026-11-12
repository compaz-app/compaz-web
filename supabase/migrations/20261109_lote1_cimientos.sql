-- Lote 1 (cimientos) del paso del prototipo al sistema real. Ver docs/construccion-real.md.
-- SOLO AGREGA tablas, columnas, índices, un bucket y un disparador. No cambia ni borra nada existente,
-- así el código viejo sigue funcionando con la base compartida entre local y producción.
-- Seguro de repetir (if not exists). Ejecutar completo en el SQL Editor de Supabase.

-- ═══ 1. Ajustes: fuente única de precios, plazos, topes y textos ═══════════════════════════════════
-- El código tiene un catálogo con los valores por defecto (lib/ajustes.ts); esta tabla solo guarda lo que
-- el administrador cambió. Si falta una fila o la base falla, se usa el valor por defecto del código.
create table if not exists public.ajustes (
  clave           text primary key,
  valor           jsonb not null,
  vigente_desde   timestamptz not null default now(),
  actualizado_por text not null default 'sistema',
  actualizado_en  timestamptz not null default now()
);

-- Historial de cada cambio: quién, cuándo y de qué valor a cuál. Solo inserción.
create table if not exists public.ajustes_historial (
  id             bigint generated always as identity primary key,
  clave          text not null,
  valor_anterior jsonb,
  valor_nuevo    jsonb not null,
  cambiado_por   text not null,
  cambiado_en    timestamptz not null default now(),
  vigente_desde  timestamptz not null default now()
);
create index if not exists ajustes_historial_clave_idx on public.ajustes_historial (clave, cambiado_en desc);

create or replace function public.ajustes_historial_inmutable() returns trigger
language plpgsql as $$
begin
  raise exception 'ajustes_historial es de solo inserción' using errcode = '42501';
end $$;

drop trigger if exists ajustes_historial_sin_cambios on public.ajustes_historial;
create trigger ajustes_historial_sin_cambios
  before update or delete on public.ajustes_historial
  for each row execute function public.ajustes_historial_inmutable();

-- Guarda un ajuste y su historial en UNA sola operación: o quedan los dos o no queda ninguno.
-- p_anterior es el valor que regía antes (el predeterminado del código si aún no había fila).
create or replace function public.guardar_ajuste(
  p_clave    text,
  p_valor    jsonb,
  p_anterior jsonb,
  p_actor    text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_ant jsonb;
begin
  if coalesce(btrim(p_clave), '') = '' or p_valor is null then
    raise exception 'ajuste no válido' using errcode = '22023';
  end if;
  select valor into v_ant from public.ajustes where clave = p_clave for update;
  insert into public.ajustes_historial (clave, valor_anterior, valor_nuevo, cambiado_por)
    values (p_clave, coalesce(v_ant, p_anterior), p_valor, left(coalesce(nullif(btrim(p_actor), ''), 'sistema'), 120));
  insert into public.ajustes (clave, valor, vigente_desde, actualizado_por, actualizado_en)
    values (p_clave, p_valor, now(), left(coalesce(nullif(btrim(p_actor), ''), 'sistema'), 120), now())
    on conflict (clave) do update
      set valor = excluded.valor, vigente_desde = excluded.vigente_desde,
          actualizado_por = excluded.actualizado_por, actualizado_en = excluded.actualizado_en;
end $$;
revoke all on function public.guardar_ajuste(text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.guardar_ajuste(text, jsonb, jsonb, text) to service_role;

-- ═══ 2. Cancelaciones: se registran antes de borrar nada (hoy cancelar borra la visita) ═══════════════
-- visita_id y solicitud_id NO son claves foráneas a propósito: la visita puede borrarse y el registro debe quedar.
create table if not exists public.cancelaciones (
  id              uuid primary key default gen_random_uuid(),
  visita_id       uuid,
  solicitud_id    uuid,
  compita_id      uuid references public.compitas(id),
  usuario_id      uuid references public.usuarios(id),
  cancelado_por   text not null check (cancelado_por in ('cliente', 'compita', 'admin', 'sistema')),
  horas_de_aviso  numeric,
  tardia          boolean not null default false,
  motivo          text,
  justificada     boolean not null default false,
  justificada_por text,
  justificada_en  timestamptz,
  creado_en       timestamptz not null default now()
);
create index if not exists cancelaciones_compita_idx on public.cancelaciones (compita_id, creado_en desc);
create index if not exists cancelaciones_usuario_idx on public.cancelaciones (usuario_id, creado_en desc);

-- ═══ 3. Fotos privadas (llegada, cliente, familiar) con retención ════════════════════════════════════
-- Las fotos de Telegram no se pueden borrar de sus servidores: se COPIAN a este bucket privado y se borran aquí.
insert into storage.buckets (id, name, public)
  values ('fotos-privadas', 'fotos-privadas', false)
  on conflict (id) do nothing;

create table if not exists public.fotos_privadas (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null check (tipo in ('llegada', 'cliente', 'familiar')),
  ruta         text not null,
  visita_id    uuid,
  solicitud_id uuid,
  usuario_id   uuid,
  creado_en    timestamptz not null default now(),
  borrar_en    timestamptz not null,
  borrada_en   timestamptz
);
create index if not exists fotos_privadas_vencidas_idx on public.fotos_privadas (borrar_en) where borrada_en is null;

-- ═══ 4. Columnas nuevas (todas opcionales o con valor por defecto) ═══════════════════════════════════
-- Solicitud: tipo de pedido y lo que el compita ve antes de aceptar.
alter table public.solicitudes
  add column if not exists tipo              text not null default 'entrevista' check (tipo in ('entrevista', 'directa', 'mandado')),
  add column if not exists que               text,
  add column if not exists lugar_privado     boolean,
  add column if not exists personas_en_lugar jsonb,
  add column if not exists foto_cliente_id   uuid;

-- Visita: dirección por cita, quién estará, llegada con foto, sin acceso y salida por seguridad.
alter table public.visitas
  add column if not exists direccion           text,
  add column if not exists indicaciones        text,
  add column if not exists quien_abre          text,
  add column if not exists contacto_nombre     text,
  add column if not exists contacto_tel        text,
  add column if not exists personas_en_lugar   jsonb,
  add column if not exists llegada_en          timestamptz,
  add column if not exists llegada_foto_id     uuid,
  add column if not exists sin_acceso_en       timestamptz,
  add column if not exists salida_seguridad_en timestamptz;

-- Cliente: huso horario, etapa del seguimiento y desde cuándo.
alter table public.usuarios
  add column if not exists zona_horaria text,
  add column if not exists etapa        text,
  add column if not exists etapa_desde  timestamptz;

-- Tareas de la Bandeja: tipo, prioridad (1 urgente, 2 normal, 3 baja) y cuándo vencen.
alter table public.admin_flags
  add column if not exists tipo      text not null default 'general',
  add column if not exists prioridad smallint not null default 2,
  add column if not exists vence_en  timestamptz;

-- ═══ 5. Seguridad: solo el servidor (clave de servicio) toca estas tablas ═════════════════════════════
alter table public.ajustes           enable row level security;
alter table public.ajustes_historial enable row level security;
alter table public.cancelaciones     enable row level security;
alter table public.fotos_privadas    enable row level security;
revoke all on public.ajustes, public.ajustes_historial, public.cancelaciones, public.fotos_privadas from anon, authenticated;
-- Sin políticas: con RLS activa y sin políticas, anon y usuarios autenticados no ven nada.
-- El servidor (service_role) necesita permiso explícito sobre las tablas nuevas (como en la migración de avisos).
grant all on public.ajustes, public.ajustes_historial, public.cancelaciones, public.fotos_privadas to service_role;
