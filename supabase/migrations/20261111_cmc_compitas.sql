-- ══════════════════════════════════════════════════════════════════════════════
-- Compaz · Integración CMC → compitas (Compitas habilitadas en la selección)
--
-- Estado: PENDIENTE DE AUTORIZACIÓN. No aplicar en producción sin aprobación de Luis.
-- Diseño: docs/cmc/compitas-desde-cmc.md
--
-- Qué hace (solo aditivo, no cambia ningún dato existente):
--   · compitas: 4 columnas nuevas, todas NULL para las filas actuales.
--       cmc_permite                 true/false = lo que dice el CMC; NULL = no gestionada
--                                   por el CMC (Compitas anteriores, demos). NULL nunca
--                                   restringe nada: el comportamiento actual no cambia.
--       cmc_estado                  texto legible para el dashboard («Habilitado · Activo · Acepta: Sí»).
--       cmc_actualizado_en          último cambio aplicado desde el CMC.
--       cmc_bienvenida_enviada_en   reserva atómica del correo de bienvenida (uno por Compita).
--   · compitas.codigo: formato COM-NNNN obligatorio si no es NULL (hoy todos son NULL).
--     La restricción UNIQUE (compitas_codigo_key) ya existe.
--   · cmc_sincronizaciones: registro de cada foto APLICADA o RECHAZADA (las simulaciones
--     no escriben nada). Guarda el antes/después de cada cambio para poder revertir.
--
-- Reversión: las columnas y la tabla no las usa nada fuera del módulo CMC; las guardas
-- tratan NULL como «no gestionada». Ver la sección «Reversión» del documento de diseño.
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.compitas add column if not exists cmc_permite boolean;
alter table public.compitas add column if not exists cmc_estado text;
alter table public.compitas add column if not exists cmc_actualizado_en timestamptz;
alter table public.compitas add column if not exists cmc_bienvenida_enviada_en timestamptz;

alter table public.compitas drop constraint if exists compitas_codigo_formato;
alter table public.compitas add constraint compitas_codigo_formato
  check (codigo is null or codigo ~ '^COM-[0-9]{4,6}$');

comment on column public.compitas.codigo is 'ID Compita del CMC (COM-NNNN). Identificador estable; NULL = Compita anterior al CMC o demo.';
comment on column public.compitas.cmc_permite is 'Permiso del CMC: Habilitado ∧ Estado operativo Activo ∧ Acepta nuevos = Sí. NULL = no gestionada por el CMC.';

create table if not exists public.cmc_sincronizaciones (
  id            uuid primary key default gen_random_uuid(),
  recibida_en   timestamptz not null default now(),
  estado        text not null check (estado in ('aplicada', 'rechazada')),
  motivo        text,                      -- motivo del rechazo (si estado = 'rechazada')
  generado_en   timestamptz,               -- momento en que el CMC generó la foto
  filas_leidas  integer,                   -- filas leídas de la hoja 03 por el Apps Script
  recibidas     integer not null default 0,
  resumen       jsonb not null default '{}'::jsonb,
  cambios       jsonb not null default '[]'::jsonb  -- [{ compita_id, codigo, accion, antes, despues }]
);

create index if not exists cmc_sincronizaciones_recibida_idx on public.cmc_sincronizaciones (recibida_en desc);

-- Solo el servidor (service_role) la usa.
alter table public.cmc_sincronizaciones enable row level security;
revoke all on public.cmc_sincronizaciones from anon, authenticated;
