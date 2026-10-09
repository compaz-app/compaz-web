-- Límite de visitas por plan contratado. Ejecutar ANTES del deploy que incluye los límites.
alter table public.usuarios add column if not exists plan_contratado text;
alter table public.usuarios add column if not exists plan_inicio timestamptz;

-- El cliente no puede cambiar su propio plan (ni el de ciclo): solo el servidor (service_role)
create or replace function public.proteger_columnas_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and (
       new.plan is distinct from old.plan
    or new.plan_contratado is distinct from old.plan_contratado
    or new.plan_inicio is distinct from old.plan_inicio
    or new.compita_id is distinct from old.compita_id
    or new.email is distinct from old.email
    or new.id is distinct from old.id
  ) then
    raise exception 'No puedes modificar plan, compita_id ni email';
  end if;
  return new;
end;
$$;
