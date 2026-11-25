-- Velocidad que viven los usuarios reales (Core Web Vitals): una fila por medición, enviada desde el navegador. SOLO AGREGA una tabla. Seguro de repetir.
-- Sin datos personales: no guarda IP, ni usuario, ni dirección completa. `ruta` es solo el primer tramo ("/portal", "/compitas") para no guardar enlaces con token.
-- Solo la escribe el servidor (clave de servicio) y solo se lee desde el panel. Se borra lo de más de 30 días en la limpieza diaria.

create table if not exists public.web_vitals (
  id          bigint generated always as identity primary key,
  creado_en   timestamptz not null default now(),
  nombre      text not null check (nombre in ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')),
  valor       numeric not null check (valor >= 0),
  valoracion  text check (valoracion in ('good', 'needs-improvement', 'poor')),
  ruta        text not null default '/',
  conexion    text,         -- 4g, 3g, 2g, slow-2g (si el navegador la dice)
  movil       boolean       -- pantalla angosta
);

create index if not exists web_vitals_creado_idx on public.web_vitals (creado_en desc);
create index if not exists web_vitals_nombre_ruta_idx on public.web_vitals (nombre, ruta, creado_en desc);

alter table public.web_vitals enable row level security; -- sin políticas: solo el servidor
notify pgrst, 'reload schema';
