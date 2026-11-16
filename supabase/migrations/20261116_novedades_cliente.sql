-- Novedades del cliente: lo que le pasa (compita confirmó, llegó, la visita terminó...) guardado UNA vez, para que el portal las muestre en vivo y para decidir
-- cuándo hace falta el correo de respaldo (si ya la vio en el portal, no se manda). Solo AGREGA: una tabla y una columna. Seguro de repetir.
--  - Cada cliente solo puede LEER las suyas (así el portal se suscribe en tiempo real con su propia sesión). Escribir lo hace solo el servidor.
--  - usuarios.portal_visto_en: la última vez que el portal del cliente avisó que está abierto (un latido cada ~45 s). Con eso se sabe si está mirando.
create table if not exists public.novedades_cliente (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references public.usuarios(id) on delete cascade,
  tipo         text not null,
  nivel        text not null check (nivel in ('critico', 'accionable', 'informativo')),
  titulo       text not null,
  ruta         text not null default '/portal',
  entidad      text,
  entidad_id   uuid,
  clave_unica  text not null unique,
  creada_en    timestamptz not null default now(),
  vista_en     timestamptz,
  actuada_en   timestamptz
);

create index if not exists novedades_cliente_usuario_idx on public.novedades_cliente (usuario_id, creada_en desc);
create index if not exists novedades_cliente_sin_ver_idx on public.novedades_cliente (usuario_id) where vista_en is null;

alter table public.novedades_cliente enable row level security;
drop policy if exists "novedades_cliente_lectura_propia" on public.novedades_cliente;
create policy "novedades_cliente_lectura_propia" on public.novedades_cliente for select to authenticated using (usuario_id = auth.uid());
grant select on table public.novedades_cliente to authenticated;
grant all on table public.novedades_cliente to service_role;

-- Tiempo real: se agrega a la publicación solo si todavía no está.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'novedades_cliente') then
    alter publication supabase_realtime add table public.novedades_cliente;
  end if;
end $$;

alter table public.usuarios add column if not exists portal_visto_en timestamptz;

notify pgrst, 'reload schema';
