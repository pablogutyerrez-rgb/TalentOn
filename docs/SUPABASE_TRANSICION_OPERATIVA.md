# Transición operativa — 12 octubre 2026

Frontend: Supabase Auth → Worker → PostgreSQL de Supabase; documentos privados en R2. No se copiaron datos históricos de Firebase ni se crearon fixtures en producción. La pantalla temporal de bloqueo fue sustituida por los módulos, manteniendo el cambio obligatorio de contraseña.

## Validación realizada

- Typecheck frontend y Worker: correcto. Build frontend: correcto.
- 97 pruebas Worker: correctas. Incluyen SQL real PostgreSQL 17 embebido, concurrencia/CAS, aislamiento por empresa/rol/formador, convocatoria, candidato, selección, grupo/asignación, asistencia atómica y ventana del servidor, evaluación, OJT, documentos y alta/contratación.
- Auth, R2 y Turnstile se simulan en las pruebas aisladas; esto no constituye una prueba E2E de esos servicios de producción.
- PostgreSQL remoto: conexión de lectura validada con CA oficial, hostname y SSL obligatorios. Migración 006 aplicada con respaldo privado previo de 70 tablas. No se ha ensayado la restauración de ese respaldo.
- Worker desplegado: `dbfccfcd-da70-4988-ae57-b8d184b81d26`. Health HTTP 200 (`provider=supabase`, `modulesReady=true`); bootstrap sin sesión HTTP 401.

## Integridad y operación

Los contratos existentes se proyectan sobre tablas tipadas y claves foráneas. Los cambios de cada petición se confirman juntos, con revisión de tenant y versiones de fila. Asistencia masiva es una única petición. Se conservan versiones anteriores de archivos; un fallo de commit elimina únicamente objetos nuevos de esa petición.

Los cambios entre Auth y PostgreSQL no pueden ser una transacción distribuida: las modificaciones de Auth se ejecutan después de confirmar el perfil, con bloqueo conservador de acceso ante errores. Revisar/reintentar cualquier fallo parcial; no asumir éxito por el estado del formulario.

El runtime rechaza conjuntos mayores de 2001 registros por tabla: requiere paginación antes de operar a esa escala. No devuelve un consolidado truncado como completo. La generación de contrato conserva el comportamiento existente de metadatos; no equivale a generación/firma electrónica de un PDF.

## Pendientes externos

- Railway: la sesión CLI disponible no presenta el proyecto Talent-On; no se desplegó al proyecto ajeno disponible. Configurar el frontend con `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ADMIN_API_URL` y `VITE_WORKER_API_URL` y reconstruir en el proyecto correcto. Nunca usar la secret key en Vite.
- Captación pública: configurar `TURNSTILE_SECRET_KEY` y `CAPTURE_HASH_SECRET` como Worker Secrets y `VITE_TURNSTILE_SITE_KEY` para el frontend. No se omite la protección mientras falten. Validar el widget para los dominios local/producción.
- Validación visual autenticada y E2E de servicios reales pendiente; las pruebas aisladas no la sustituyen.

Los backups, `.env.local`, `.dev.vars` y certificados privados no deben publicarse. Las migraciones ya aplicadas son inmutables: nuevas correcciones SQL van en una migración posterior.
