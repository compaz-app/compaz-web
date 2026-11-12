# Entorno de pruebas y respaldos (auditoría O-01)

Hoy **local y producción comparten la misma base de Supabase**: cualquier prueba hecha desde tu computadora (cerrar una visita, eliminar una cuenta, registrar un pago) escribe en producción. Mientras todos los datos sean de prueba no pasa nada; **antes del primer cliente real que pague** hay que separarlas y tener respaldos. Esto es lo que debes hacer tú (necesita tu cuenta de Supabase y Netlify), en orden.

## 1. Proyecto de pruebas (≈ 30 minutos)
1. En Supabase, "New project": llámalo `compaz-pruebas` (el plan gratuito basta). Anota su URL, la clave `anon` y la clave `service_role`.
2. En su editor SQL, aplica TODAS las migraciones de `supabase/migrations/` **en este orden** (es el orden del nombre del archivo):

- 20261009_auditoria_seguridad.sql
- 20261009b_plan_limites.sql
- 20261010_pagos_plan.sql
- 20261010b_bloqueo_rls.sql
- 20261010c_solicitudes_pago.sql
- 20261012_admin_rls.sql
- 20261012b_emergencias.sql
- 20261012c_feedback.sql
- 20261022_captacion.sql
- 20261103_avisos.sql
- 20261103b_registrar_evento.sql
- 20261104_avisos_indices.sql
- 20261104_visitas_confirmando_unico.sql
- 20261109_lote1_cimientos.sql
- 20261109b_lote1_permisos.sql
- 20261109c_equipo.sql
- 20261109d_admin_emails_sync.sql
- 20261109e_ficha_terminos.sql
- 20261109f_reservas_horario.sql
- 20261109g_cancelaciones_uso.sql
- 20261109h_cambios_lugar.sql
- 20261110_actividad_admin.sql
- 20261110b_bloqueos_compita_cliente.sql
- 20261110c_pausas_contacto.sql
- 20261110d_cita_confirmacion.sql
- 20261110e_eliminar_cuenta.sql
- 20261110f_portal_nuevo_por_cliente.sql
- 20261111_compita_telefono.sql
- 20261111b_notas_persona.sql
- 20261112_resenas_permiso.sql
- 20261113_indices_panel.sql

   (Las de captación y las de rediseño ya traen `if not exists`; si alguna falla por orden, aplícala otra vez al final.)
3. Authentication, Sign In / Providers: deja igual que en producción: registros desactivados y "Confirm email" activo (ver abajo).
4. En tu `.env.local` cambia SOLO `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` por los de `compaz-pruebas`. Desde ese momento lo que pruebes en local no toca producción.
5. Netlify: en Site configuration, Environment variables, deja las claves reales solo en el contexto "Production". Si usas vistas previas de ramas, dales las claves de pruebas (contexto "Deploy Previews" y "Branch deploys").
6. Crea tu administrador en el proyecto de pruebas: pon tu correo en `ADMIN_EMAILS` de `.env.local` y entra con tu correo.

Los webhooks de Telegram y Daily siguen apuntando a producción: se prueban en vivo.

## 2. Respaldos
- **Lo mejor:** plan Pro de Supabase (copias diarias automáticas, 7 días de retención). Actívalo antes del primer cliente real: Project Settings, Add-ons, Point in Time Recovery si quieres recuperar a un minuto exacto.
- **Copia propia (gratis):** `scripts/respaldo.sh` (necesita `pg_dump`). Córrelo una vez por semana y guarda el archivo fuera de tu computadora (Drive).
- **Una restauración ensayada:** un respaldo que nunca se restauró no es un respaldo. Una vez al mes, restaura el último en `compaz-pruebas` (`gunzip -c archivo.sql.gz | psql URL_DE_PRUEBAS`) y comprueba que el panel carga con datos.

## 3. Comprobaciones de Supabase ya hechas (2026-11-12)
- Registros de usuarios nuevos: **desactivados** (solo entra quien invita el equipo).
- Confirm email: **activo**. Inicios anónimos: **apagados**. Enlace manual de cuentas: **apagado**.
- Resultado: nadie puede registrar el correo de un colaborador sin ser invitado, así que no hereda permisos.

## 4. Antes de abrir al público (resumen)
Proyecto de pruebas separado, respaldos activos y una restauración probada, claves de Turnstile en Netlify, Stripe (CLAUDE.md, sección 6), texto legal definitivo, y limpiar los datos de prueba.
