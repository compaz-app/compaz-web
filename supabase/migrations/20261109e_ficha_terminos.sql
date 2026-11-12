-- Ficha obligatoria del familiar con consentimiento y términos (Lote 2).
-- SOLO AGREGA columnas a usuarios; nada existente cambia. Seguro de repetir. Ejecutar completo en el SQL Editor de Supabase.

alter table public.usuarios
  add column if not exists pais                  text,
  add column if not exists parentesco            text,
  add column if not exists lugar_privado         boolean,
  add column if not exists ficha_personas        text,      -- nombres de quienes estarán en el lugar (null si nadie más)
  add column if not exists ficha_sin_nadie       boolean,   -- true = "no habrá nadie más"
  add column if not exists terminos_version      text,      -- versión de los términos que aceptó
  add column if not exists terminos_aceptados_en timestamptz;

comment on column public.usuarios.terminos_version is
  'Versión del texto de términos aceptado. Mientras el texto sea provisional empieza por "provisional".';
