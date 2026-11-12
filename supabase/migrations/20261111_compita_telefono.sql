-- Teléfono (WhatsApp) del compita, pedido en el formulario de registro. Solo AGREGA una columna; seguro de repetir.
-- Se guarda normalizado (+código de país y dígitos, ej. +584121234567). Los compitas ya registrados quedan en null.
-- Solo lo ve el panel con el permiso de teléfonos, con motivo si no eres administrador. Cliente y compita nunca ven el contacto del otro.
alter table public.compitas add column if not exists telefono text check (telefono is null or telefono ~ '^\+[1-9][0-9]{7,14}$');
notify pgrst, 'reload schema';
