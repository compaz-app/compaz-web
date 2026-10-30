-- Migración: agregar columna apellido a compitas
-- Ejecutar en Supabase Studio > SQL Editor

ALTER TABLE compitas ADD COLUMN IF NOT EXISTS apellido text;

-- Poblar apellido para las 19 compitas demo (segundo token del nombre)
UPDATE compitas SET apellido = split_part(nombre, ' ', 2)
WHERE es_demo = true AND apellido IS NULL AND nombre LIKE '% %';

-- "Demo Compita 1" no tiene apellido real — dejar como NULL
-- UPDATE compitas SET apellido = NULL WHERE nombre = 'Demo Compita 1';

-- Verificar resultado:
-- SELECT id, nombre, apellido FROM compitas WHERE es_demo = true ORDER BY apellido;
