# Administrador nuevo — 12/10/2026

Supabase destino: proyecto configurado gvwaqlvphvfzhnhlnuuv. Baseline previo comprobado: sin tablas de aplicación ni cuentas Auth. No se accedió a Firebase durante la inicialización.

Se aplicaron migraciones 001–005 dentro de una única transacción DDL y se registraron sus hashes en talent_private.applied_migrations. Baseline/hash local en supabase/.local/new-project-baseline.json, ignorado por Git. No es una exportación de datos históricos: el destino estaba vacío.

Se creó exclusivamente la empresa inicial Talent-On, cuenta Auth admin y perfil ADMIN con cinco módulos. La contraseña temporal autorizada por el usuario no se registra en este documento, scripts ni tablas.

must_change_password=true se mantiene en perfil privado servidor. Prueba negativa remota usando service_role/talent_group_page: rechazado con PASSWORD_CHANGE_REQUIRED. Esta prueba no cambia la contraseña. Además, pruebas PostgreSQL 17.5 aisladas y 78 pruebas del Worker aprobaron.

Nuevas funciones relacionales de sesión y cambio están implementadas en worker/src/supabaseSession.ts y rutas GET /api/session y POST /api/session/password. Su implementación verifica el token en Supabase Auth, deriva el actor del token, cambia exclusivamente su contraseña y solo después levanta el bloqueo vía CAS. Nueva contraseña: al menos 12 caracteres. El frontend no puede borrar el flag ni cambiar el rol por user_metadata.

## Pendiente real

El login operativo, listeners y endpoints de negocio de Talent-On siguen dependiendo de Firebase. Las nuevas rutas no están desplegadas. No se habilitó un frontend parcialmente conectado ni se afirma que el primer-login UI esté terminado. Completar adaptación relacional de frontend/Worker y pantalla obligatoria antes de activar el proveedor y permitir operar al nuevo administrador.

El registro público de Supabase estaba habilitado en la última lectura; desactivarlo en el panel antes del corte. Las cuentas sin perfil privado no obtienen permisos de Talent-On.

No se borró Firebase, no se copió historial, no se desplegó la aplicación, no se desactivó SSL y no se simuló funcionalidad de módulos pendientes.
