# Reparación de administrador global — 14/10/2026

Aplicada con autorización explícita del propietario. Respaldo recuperable y restauración ensayada: `supabase/.local/multiempresa-backup-2026-10-14T22-46-00-455Z.json` (84 tablas). La cuenta quedó global, con contexto Talent-On y acceso a las cuatro empresas; directorio y consulta global de usuarios verificados. Typecheck, build y 141 pruebas Worker aprobados.

El primer ensayo detectó una colisión de identidad en la auditoría restaurada y abortó antes de escribir en producción. El restaurador ahora ajusta esa secuencia exclusivamente en la copia WASM antes de ensayar la asignación; el segundo ensayo y la activación finalizaron correctamente.

## Causa y alcance

La cuenta confirmada por el propietario, `administra.p`, tenía ADMIN en Techcenter, Talent Up y Konectados, pero no autorización en `talent_org.global_admins`. Su perfil tenía `companyAccessManaged=true`: por diseño, el hogar Talent-On no era un acceso implícito. El editor multiempresa depende de la autorización global, no solo de la etiqueta ADMIN.

Se conserva esta separación para los demás usuarios. La corrección es una asignación explícita a esta cuenta, no una promoción automática de todos los ADMIN. No requiere modificar el esquema ni reinstalar el Worker: el servidor consulta estos permisos en cada sesión/petición.

## Ejecución controlada

Ejecutor: `scripts/apply-multiempresa.mjs --execute --grant-global-admin administra.p`, con las variables PostgreSQL y CA existentes. El modo es independiente de las migraciones y no aplica SQL pendiente.

- Verifica proyecto Supabase, certificado CA y hostname, hashes de migraciones y administrador autorizante.
- Respalda las tablas en la carpeta privada ignorada `supabase/.local`, restaura en PostgreSQL WASM y ensaya la asignación y el contexto.
- Bajo transacción y bloqueo, comprueba que no cambiaron los datos durante el respaldo.
- Asigna solo a un perfil ADMIN activo, con contraseña inicial ya cambiada; conserva Auth, contraseña, módulos y membresías.
- Registra auditoría con el actor autorizante. Repetir la asignación activa no duplica el registro ni su auditoría.
- Comprueba acceso al hogar y cuatro empresas, módulo Administración, directorio y listado global.

La recuperación consiste en restaurar el estado previo de la autorización global a partir del respaldo, con una operación explícita aprobada; no borrar históricos ni restaurar indiscriminadamente toda la base. El administrador global anterior permanece habilitado.

## Verificación

Prueba aislada de integración: reproduce ADMIN multiempresa sin acceso al hogar y rechazo al asignar empresas; ejecuta el mismo SQL operativo; verifica acceso global, dashboard, creación de usuario en dos empresas y edición desde otra empresa. Comprueba auditoría, idempotencia y rechazo del otorgamiento por un Formador.

No se crean usuarios de prueba en producción ni se cambia la contraseña de la cuenta. La interfaz muestra mensajes traducidos del cliente HTTP en lugar de códigos como FORBIDDEN. Para recibir el contexto actualizado, recargar la plataforma o cerrar sesión e ingresar nuevamente.

La verificación automática de creación/edición usa PostgreSQL aislado y dobles de Auth; no equivale a iniciar sesión en el navegador con la cuenta real.
