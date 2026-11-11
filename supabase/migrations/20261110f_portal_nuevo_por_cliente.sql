-- Activación por etapas del portal nuevo (/portal). Solo AGREGA una columna.
-- null = sigue el interruptor general (ajuste portal_nuevo); true = ve el portal nuevo; false = sigue con el viejo.
-- Así se prueba primero con el equipo, luego con familias de confianza y al final se enciende para todos.
alter table public.usuarios add column if not exists portal_nuevo boolean;
