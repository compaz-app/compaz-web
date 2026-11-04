# Rediseño: cómo se separa lo nuevo de lo viejo y cómo se vuelve atrás

## Puntos de retorno

1. Etiqueta `antes-del-rediseno`: marca el último commit publicado antes del rediseño (`9ad9c3f`).
2. Rama `main`: siempre lo publicado y estable. El rediseño no se mezcla en `main` hasta que cada pieza esté probada.
3. Rama `rediseno`: todo el trabajo nuevo, incluido el prototipo (`app/prototipo/`) y los documentos.

## Cómo volver al viejo

1. Código: volver a `main` o a la etiqueta (`git switch main`, o `git checkout antes-del-rediseno`). El código viejo sigue intacto porque el rediseño se construye al lado, en rutas y archivos nuevos.
2. Publicación: en Netlify se puede republicar un despliegue anterior con un clic.
3. Base de datos: solo se AGREGAN tablas y columnas nuevas. Nunca se cambia ni se borra lo existente. Así el código viejo sigue funcionando con la base nueva.

## Reglas de trabajo

1. Rutas nuevas para lo nuevo (por ejemplo la Bandeja y el portal nuevos), visibles solo para el admin hasta que igualen a lo actual. Después se redirige y se retira lo viejo.
2. `notificar()` envuelve a `sendTelegramMessage` y `sendEmail` actuales; los flujos se migran de uno en uno.
3. La carpeta `app/prototipo/` NO debe publicarse en producción: antes de llevar la rama a `main`, bloquearla en producción o quitarla.
4. La base de datos es compartida entre local y producción: cualquier migración afecta producción. Confirmar las copias de seguridad de Supabase antes de la primera migración.
5. Cada capa se prueba con `node tests/run.mjs` y `npx tsc --noEmit`, y debe poder deshacerse sola.
6. Solo commit; el push lo decide el usuario. Hoy `main` pide pull request y la cuenta del usuario salta esa regla por permisos de administrador.

## Pendiente de lanzamiento: respaldo de datos

Ver `CLAUDE.md`, sección 6. Hoy no hay copias de seguridad en Supabase y los compitas son personas reales. Antes del primer cliente real que pague: copias automáticas con restauración probada y base de desarrollo separada de la de producción.
