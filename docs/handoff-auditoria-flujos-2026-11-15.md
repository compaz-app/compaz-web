# Handoff: auditoría de flujos de Compaz (2026-11-15)

Para pegar o adjuntar al inicio de un chat nuevo. Objetivo: que Juan audite los flujos del sistema él mismo, con la IA como guía, anotadora y arregladora de hallazgos de a uno.

## 1. Rol que debe tomar el nuevo chat

1. Guía de auditoría: propone el siguiente flujo, dice qué hacer paso a paso, qué debería pasar, y qué mirar (pantalla, correo, Telegram, base de datos).
2. Anotadora: registra cada hallazgo con la plantilla de la sección 7.
3. Arregladora: cuando Juan pasa un hallazgo, lo corrige en una rama propia con UN commit local. Nada de push, PR ni merge sin que Juan lo pida.
4. Comunicación: directa y corta, sin suavizar. Sin guiones como viñetas en textos de producto (emails, Telegram, UI). Sin emojis salvo Telegram y estrellas 1 a 5.

## 2. Contexto del proyecto

1. Compaz: plataforma Next.js 16 (App Router) de cuidado para familias venezolanas. Clientes en EE. UU. y otros países, servicio (compitas) en Venezuela.
2. Repo: compaz-app/compaz-web. Carpeta local: /Users/juantenreiro/Desktop/Web/Compaz/compaz.
3. Producción: https://micompaz.com (Netlify, proyecto `compaz-beta`, funciones en IAD/Virginia).
4. Base de datos de producción: Supabase `compaz-prod` (ref `jizckcfuemgfbmopbhbh`, us-east-1, plan Free; pasar a Pro antes del lanzamiento).
5. Proyecto Supabase viejo `qrhkzlzblaknzsxqfney` (São Paulo): ARCHIVADO. No usarlo, no apuntar nada ahí.
6. Servicios: Telegram (bot), Resend (correo, también SMTP de Supabase Auth), Daily (llamadas), Cloudflare Turnstile (código listo, claves pendientes en Netlify), Stripe (no activado; pago simulado), CMC de Luis (hoja de Google + Apps Script). Airtable: retirado (cuota agotada, HTTP 429).
7. Personas: Juan (dueño/admin), Luis (dueño de la integración CMC; la facturación de Netlify está a nombre de Luis Mendoza).
8. Todos los datos actuales son de prueba. Aún no hay clientes reales ni lanzamiento (Meta Ads pendiente).

## 3. Estado de código y PRs (verificado 2026-11-15)

1. `origin/main` = 53588c2, versión 1.1.4-beta.1. En producción corre 1.1.3-beta.1 (la 1.1.4 se unió con `[skip netlify]`, no desplegada).
2. Abiertos, nada unido sin autorización de Juan:
   1. #20 Eliminar perfiles en lote y confirmación simple (1.2.0-beta.1). Es el candidato a desplegar.
   2. #21 Docs: proyecto viejo archivado y resumen para Luis.
   3. #22 Restaurar permisos de service_role en 5 tablas (apilado sobre #19, 1.1.5-beta.1).
   4. #23 (Luis) Docs CMC: etapas 3 y 4 hechas, falta el disparador horario.
3. Orden sugerido para unir: #22 y #21 con `[skip netlify]`, #20 solo como despliegue. Habrá conflictos de versión (1.2.0 vs 1.1.4/1.1.5) y de `docs/migracion-supabase-virginia.md` (#21 y #22 añaden al final): resolver al rebasar.
4. Migración `supabase/migrations/20261113c_restaurar_permisos_service_role.sql` NO aplicada en compaz-prod. Requiere autorización de Juan y Luis. Procedimiento: ejecutar `tests/sql/permisos_service_role_5_tablas.sql` (debe fallar), la migración, y repetir (debe dar OK), con rol postgres en el editor SQL de compaz-prod.
5. Pruebas: `node tests/run.mjs [filtro]` (fake DB), `npx tsc --noEmit`, `npm run build`. Hoy 1384 pruebas pasan. CI: `verificar` es la compuerta. Los trabajos `airtable` y `e2e` de `captacion` fallan por la cuota de Airtable: ignorarlos.

## 4. Reglas de trabajo (permanentes)

1. Cada hallazgo: rama nueva DESDE `origin/main` (la `main` local está vieja), un solo commit local, mensaje claro. Sin push, PR ni merge hasta que Juan lo autorice.
2. Subir versión en `lib/version.ts`, `package.json` y anotarla en `docs/versiones.md` (la prueba 85 lo vigila).
3. Lógica en `lib/`, tipos explícitos, docs actualizadas; si cambia un formato de respuesta, actualizar TODOS los consumidores.
4. Todo componente funciona en 375 px y 1024 px. Estado de pantallas en la URL (tabs, filtros) y restaurable al refrescar.
5. Todo botón lleva un icono ⓘ que explica qué hace. Todo límite o espera explica qué pasó, por qué y cuándo sigue (catálogo en `lib/esperas.ts`).
6. Panel sobrio: botones y avisos compactos, sin adornos. El compita siempre en masculino (el compita, los compitas). Cliente y compita nunca ven los contactos del otro.
7. Cada despliegue de producción cuesta unos 15 créditos de Netlify (plan Personal, 1000 créditos). No desplegar por capricho.
8. Secretos: jamás en el chat ni en commits. Solo en archivos ignorados por git o en la interfaz de Netlify, puestos por Juan.
9. Nunca entrar contraseñas ni claves en formularios por Juan. Nunca pagos ni movimientos de dinero.

## 5. Seguridad al auditar

1. Producción está viva aunque los datos sean de prueba: preferir probar con cuentas de prueba propias; evitar borrados masivos y cualquier acción destructiva en producción sin avisar.
2. No tocar el proyecto Supabase archivado. Para leer producción, usar el conector Supabase (solo lectura salvo autorización) o el panel.
3. Desarrollo local: `.env.local` aún apunta al proyecto VIEJO. Pendiente decidir base de desarrollo (pausar el viejo y crear `compaz-pruebas`, o Supabase local). Hasta entonces, probar en producción con cuidado o con el arnés de pruebas (fake DB).
4. Herramientas disponibles: conectores Supabase y Netlify, extensión de Chrome, navegador integrado, `scripts/migracion/`.

## 6. Flujos a auditar

Fuente principal: `docs/flows.md`. Orden sugerido: del registro al cierre del servicio.

1. Registro de compita (flows 1). Páginas: `/se-compita`, `/onboarding`, `/compita/perfil` y `/compita/perfil/preview`.
2. Registro de cliente (flows 2). Páginas: `/login`, `/dashboard`, `/portal`.
3. Solicitud de entrevista, carrito de compitas (flows 3). Páginas: `/compitas`, `/solicitar`, `/solicitar/hora`, `/pago` (pago simulado).
4. Coordinación de llamada por el equipo (flows 4). Panel: `/panel`; también `/llamada/[sala]` y `/reagendar/[token]`.
5. Visita en tiempo real (flows 5). Páginas: `/sala/[token]`, `/feedback/[visitaId]`.
6. Estados de compita (flows 6) y de solicitud (flows 7): recorrer cada transición y verificar que el panel, los avisos y los correos reflejan el estado.
7. Roles y permisos (flows 8): admin, colaboradores, recorte de datos. Pantalla Equipo y permisos en `/panel`. Comprobar que quien no tiene permiso recibe 403 y no ve datos sensibles.
8. Servicios externos (flows 9): correo (enlace mágico con el SMTP nuevo), Telegram, Daily, Turnstile.
9. Reclutamiento por flyers (flows 11), captación en Supabase (flows 12) y compitas habilitadas en CMC (flows 13). Páginas: `/admin/postulaciones`; CMC en el panel.
10. Eliminar mi cuenta: `/cuenta/eliminar` (anonimiza, 7 días, saldo). El prototipo existe; falta la parte real: no auditar como terminado.
11. Eliminación en lote desde Personas (PR #20, aún sin desplegar): verificar en una rama o previa, no en producción.

Pruebas existentes que describen recorridos (útiles como mapa del comportamiento esperado): `tests/08-recorridos`, `10-planes-y-creditos`, `12-login-por-enlace`, `14-recorrido-compita`, `31-recorrido-automatico`.
Otros documentos: `handoff-panel-nuevo.md`, `ciclo-comunicaciones.md`, `esquema-avisos-eventos.md`, `seguridad-y-operacion.md`, `auditoria-2026-11-11.md`, `revision-2026-11-12.md`, `entorno-de-pruebas-y-respaldos.md`, `docs/cmc/`.

## 7. Método y plantilla de hallazgo

Para cada flujo: leer su sección de `flows.md`, ejecutar los pasos como la persona real (en 375 px y en escritorio), comparar con lo esperado, y comprobar los efectos laterales (fila en base de datos, evento, aviso de Telegram, correo).

Plantilla:

```
Hallazgo N
Flujo y paso:
Esperado:
Observado:
Evidencia (captura, URL, fila, registro):
Gravedad: bloquea lanzamiento / molesta / cosmético
Rama propuesta: fix/<tema>
```

Gravedad: bloqueante = pérdida de datos, fuga de contactos entre cliente y compita, permisos rotos, flujo que no puede completarse. Molesta = se completa pero confunde o falla en móvil. Cosmético = texto, espaciado.

## 8. Problemas conocidos y zonas sin probar

1. Alertas "Cron detenido" en Telegram por los crons de Airtable (escalera-avisos y otros): el vigilante espera latidos; con `POSTULACIONES_DESTINO=solo_supabase` esos crons solo escriben latido. Cortar Airtable queda pendiente hasta que el CMC lea de Supabase.
2. CMC (Luis): `CMC_ESCRITURA_TOKEN` y `CMC_COMPITAS_MODO` no están en Netlify; el POST a `/api/cmc/compitas` solo simula. Falta el "disparador horario".
3. Sin probar de extremo a extremo tras el cambio a Virginia: enlace mágico por correo con el SMTP nuevo, aviso real de Telegram, una llamada en Daily.
4. Rendimiento: el panel ronda 250 a 450 ms; hay picos de 600 a 860 ms en arranque en frío. Objetivo menos de 500 ms.
5. Pendientes antes del lanzamiento: Stripe (quitar `PAGO_SIMULADO` y aplicar el checklist de la sección 6 de `CLAUDE.md`; recordárselo a Juan), claves de Turnstile, texto legal, compaz-prod a Pro con restauración probada, migrar a claves nuevas de Supabase antes de 2027, pausar el proyecto viejo en 1 a 2 semanas.
6. Fotos de compitas: algunas siguen apuntando al proyecto viejo y dejarán de verse cuando se pause.
7. Pendiente de construcción: "¿Qué me toca?", "Tengo una duda", bloqueo compita-cliente, motivo para datos sensibles y tiempo real en la guardia de permisos.

## 9. Primer paso sugerido para el chat nuevo

1. Leer `CLAUDE.md`, `docs/flows.md` y este archivo.
2. Confirmar con `git fetch` y `gh pr list` el estado actual.
3. Proponer a Juan empezar por el flujo 3 (solicitud de entrevista) o el 1 (registro de compita), con la lista de pasos y qué mirar en cada uno.
