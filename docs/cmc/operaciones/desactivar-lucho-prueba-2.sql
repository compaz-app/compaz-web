-- ══════════════════════════════════════════════════════════════════════════════
-- Retirar «Lucho Prueba 2» de la oferta pública
-- Estado: PREPARADO, NO EJECUTADO. Requiere autorización de Luis.
--
-- Situación (10-nov-2026): Compita de prueba con es_demo = false, activa, verificada y
-- con Telegram → aparece ante las familias como si fuera real.
-- Tiene 2 clientes asignados, 2 visitas activas y 3 solicitudes (0 pendientes), todos de
-- prueba. Este cambio NO los toca (su limpieza es el pendiente 6 de CLAUDE.md).
--
-- Efecto: igual que el botón «Desactivar» del dashboard (desactivarCompita): sale de la
-- oferta y no recibe solicitudes ni asignaciones nuevas. Conserva Telegram e historial.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Comprobación previa (debe devolver 1 fila: activo, true, false, null)
select id, nombre, estado, verificado, es_demo, codigo
from public.compitas
where id = '86b7a7a8-f04a-4026-bd5e-6c11f95d6274';

-- 2. Cambio, solo si sigue en el estado comprobado (debe devolver 1 fila)
update public.compitas
set estado = 'inactivo', verificado = false
where id = '86b7a7a8-f04a-4026-bd5e-6c11f95d6274'
  and nombre = 'Lucho Prueba 2'
  and estado = 'activo'
  and es_demo = false
  and codigo is null
returning id, nombre, estado, verificado;

-- Reversión:
-- update public.compitas set estado = 'activo', verificado = true
-- where id = '86b7a7a8-f04a-4026-bd5e-6c11f95d6274' and estado = 'inactivo';
