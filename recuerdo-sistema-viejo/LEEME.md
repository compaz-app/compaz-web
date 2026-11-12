# Recuerdo del primer sistema de Compaz (panel de administración viejo)

Capturas tomadas el 2026-11-12 desde micompaz.com, justo antes de que el panel nuevo (`/panel`) sustituyera a `/admin`.
Todas son del sistema en producción con los datos de prueba de ese día (versión 0.1.0, antes de la 1.0.0-beta.1).

Carpetas
1. `panel-admin/`: el "Compaz Admin" viejo. Visitas activas (agendadas y cerradas), Clientes (lista, ficha lateral, invitar cliente), Compitas (lista, ficha lateral, invitar, registrar directamente), Desactivados, Historial, Solicitudes, Accesos rápidos, Reseñas, Atención y Demo.
2. `portal-cliente-viejo/`: lo que veía el cliente. Marketplace "Encuentra tu Compita" y el dashboard del cliente en tres estados (nuevo sin compita, coordinando visita con chat, y con compita sin plan).
3. `registro-compita-viejo/`: el formulario de registro de la compita.

Notas
1. La pestaña Reseñas se quedaba en "Cargando reseñas..." (09): así estaba en producción ese día.
2. En el panel viejo todo estaba en una sola página con pestañas; la pestaña actual iba en la URL (`/admin?tab=clientes`).
3. No se capturaron los correos ni el bot de Telegram.
4. Estas imágenes tienen nombres y correos de prueba. La carpeta está en `.gitignore`: no se sube a GitHub.
