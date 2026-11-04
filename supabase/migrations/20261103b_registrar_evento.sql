-- Función para registrar eventos de operación. Ver docs/esquema-avisos-eventos.md.
-- El servidor NO puede insertar directo en public.eventos (la migración de captación le dejó solo lectura
-- a propósito: es un historial de solo inserción). Los eventos se escriben mediante funciones security
-- definer, igual que los de captación. Esta función solo escribe el módulo 'operacion'.
-- Solo AGREGA una función; no cambia ni borra nada existente. Seguro de repetir (create or replace).

create or replace function public.registrar_evento(
  p_entidad    text,
  p_entidad_id uuid,
  p_tipo       text,
  p_actor      text  default 'sistema',
  p_datos      jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id bigint;
begin
  if p_entidad not in ('solicitud', 'visita', 'pago', 'cliente', 'compita', 'aviso') then
    raise exception 'entidad no válida' using errcode = '22023';
  end if;
  if p_entidad_id is null then
    raise exception 'falta el id de la entidad' using errcode = '22023';
  end if;
  if p_tipo is null or p_tipo !~ '^[a-z][a-z0-9_]{2,59}$' then
    raise exception 'tipo de evento no válido' using errcode = '22023';
  end if;
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'falta el actor' using errcode = '22023';
  end if;
  if length(coalesce(p_datos, '{}'::jsonb)::text) > 4000 then
    raise exception 'datos demasiado grandes' using errcode = '22023';
  end if;

  insert into public.eventos (modulo, entidad, entidad_id, tipo, actor, datos)
    values ('operacion', p_entidad, p_entidad_id, p_tipo, left(p_actor, 120), coalesce(p_datos, '{}'::jsonb))
    returning id into v_id;
  return v_id;
end $$;

comment on function public.registrar_evento(text, uuid, text, text, jsonb) is
  'Registra un evento de operación (solicitud, visita, pago, cliente, compita, aviso). Devuelve el id del evento.';

-- Solo el servidor (clave de servicio) puede ejecutarla.
revoke all on function public.registrar_evento(text, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_evento(text, uuid, text, text, jsonb) to service_role;
