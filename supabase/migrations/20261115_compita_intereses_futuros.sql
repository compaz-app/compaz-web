-- Servicios futuros que el compita dice querer ofrecer (voluntariado, cuidado de mascotas). Solo AGREGA una columna; seguro de repetir.
-- Es solo interés: no activa nada. El equipo lo usa para llamarlos cuando la línea abra.
alter table public.compitas add column if not exists intereses_futuros text[] not null default '{}';
notify pgrst, 'reload schema';
