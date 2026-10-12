# Firebase desconectado — 12/10/2026

## Cambio aplicado

- Frontend local: Firebase no se inicializa; no se importan SDK Auth/Firestore ni existen listeners Firestore activos. Dependencia directa firebase eliminada. Archivo firebase.ts conserva solo exports nulos.
- Login usa Supabase Auth. WorkerApi obtiene exclusivamente token Supabase.
- Cuenta admin nueva validada remotamente; cambio obligatorio registrado en perfil servidor y pantalla de cambio implementada. Al cambiar correctamente se cierra sesión y se exige volver a entrar. No se cambió la contraseña temporal durante las pruebas.
- Worker publicado en modo DATA_PROVIDER=supabase, versión 4b476a81-265e-4828-8641-53271e05214f. Secrets SUPABASE_URL y SUPABASE_SECRET_KEY registrados exclusivamente en Cloudflare.
- La API no invoca Firebase en modo Supabase. Rutas de sesión operativas; módulos no adaptados responden 503 SUPABASE_MODULE_NOT_READY. Cuenta temporal recibe 403 PASSWORD_CHANGE_REQUIRED antes de esas acciones. Captación pública no utiliza Firebase como fallback.
- Sin datos migrados ni eliminación de Firebase/Auth/Firestore/R2. Código legado del Worker se conserva para pruebas históricas explícitas en DATA_PROVIDER=firebase; ese modo no está configurado en el deployment.

## Estado funcional real

Disponible: login Supabase, perfil propio, bloqueo de contraseña inicial, cambio de contraseña por servidor y logout.

No disponible todavía: administración CRUD, selección/captación, formación/OJT, talento y dashboards sobre el modelo relacional. La pantalla autenticada informa el estado; no muestra cifras ni formularios que aparenten funcionar. Adaptar estos módulos es trabajo pendiente, no una migración ya terminada.

**Railway frontend no fue publicado en esta intervención.** Puede seguir sirviendo la versión anterior que usa Firebase; debe configurarse VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY y publicarse el código actualizado. La API ya fue cambiada, de modo que acciones del frontend antiguo no tienen fallback Firebase. No se hizo push de cambios ajenos del worktree.

## Validación

- Frontend typecheck/build PASS; sin bundle Firebase.
- Worker typecheck y 83 pruebas PASS, incluyendo ausencia de llamadas Firebase, bloqueo de contraseña y módulos pendientes.
- API remota health devuelve provider=supabase; login admin + GET session correctos; operación de campaña con contraseña temporal rechazada 403; sesión sin token rechazada 401.
- Secret key ausente del bundle frontend. Solo publishable key/URL se incorporaron a .env.local para Vite.
- El formulario real de cambio no se envió con la cuenta inicial para conservar la contraseña temporal pedida por el usuario. Orden Auth éxito → CAS flag validado con pruebas aisladas.

Acceso local existente: http://localhost:3000/. Recargar para recibir frontend nuevo. La conexión PostgreSQL mantiene CA validada; Worker usa APIs HTTPS de Supabase, no Database URL ni contraseña PostgreSQL en browser.
