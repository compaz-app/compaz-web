-- «Ya vio el reporte»: el portal deja de decir «La visita terminó, ¿cómo te fue?» cuando el cliente ya abrió el reporte. Solo AGREGA una columna. Seguro de repetir.
--  - visitas.reporte_visto_en: cuándo el cliente abrió su pestaña de Visitas con el reporte de esa visita ya listo.
alter table public.visitas add column if not exists reporte_visto_en timestamptz;
notify pgrst, 'reload schema';
