# Supabase: preparación de base de datos y Auth

> Sustituido como guía de esquema por SUPABASE_MODELO_RELACIONAL.md (12/10/2026). No usar el bootstrap documental --execute ni sus RPC con el modelo relacional; la ejecución de ese bootstrap está bloqueada preventivamente. Las instrucciones históricas siguientes no activan el nuevo modelo.

## Estado y alcance

Se prepararon el esquema PostgreSQL, RPC transaccionales, adaptadores de servidor y Auth, diagnóstico y bootstrap de administrador. **La aplicación todavía utiliza Firebase:** estos adaptadores no están conectados al contexto de datos ni a las rutas del Worker. Configurar variables no activa el cambio. No se migraron datos, crearon usuarios remotos ni desplegaron cambios.

El esquema conserva documentos JSON y sus identificadores lógicos para evitar cambiar los contratos existentes. Los nuevos usuarios usan UUID de Supabase Auth. Una migración futura de usuarios Firebase necesita un mapa explícito de identificadores; no reutilizar automáticamente sus UID.

## Configuración

1. Crear un proyecto Supabase vacío y guardar su URL y claves de forma privada.
2. Ejecutar una sola vez `supabase/migrations/202610110001_talent_foundation.sql` en SQL Editor. No ejecutarlo sobre tablas existentes sin revisión y respaldo. El archivo crea objetos nuevos y no elimina historial.
3. En Authentication, desactivar registro público y proveedores no utilizados. Solo el servidor administrativo debe crear cuentas. El bootstrap confirma el correo virtual de cada cuenta; no depende de entregar correo a ese dominio. Configurar la URL local y, posteriormente, la URL productiva autorizada. `supabase/config.toml` configura desarrollo local, no cambia automáticamente las opciones del proyecto alojado.
4. Frontend: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca colocar una clave secreta/service-role en una variable VITE.
5. Worker: registrar `SUPABASE_URL` y `SUPABASE_SECRET_KEY` mediante `npx wrangler secret put NOMBRE`, desde `worker`. Alternativa heredada: `SUPABASE_SERVICE_ROLE_KEY`. Mantener los secretos fuera del repositorio. Estas claves son solo de servidor.

## Diagnóstico y primer administrador

Desde la raíz del proyecto, crear un archivo privado `.env.supabase.private` (ignorado por Git) con las variables anteriores y estas adicionales:

```dotenv
TALENT_COMPANY_ID=identificador-de-empresa
TALENT_COMPANY_NAME=Nombre de empresa
TALENT_ADMIN_USERNAME=usuario.admin
TALENT_ADMIN_DISPLAY_NAME=Administrador
TALENT_ADMIN_PASSWORD=
```

Usar una contraseña nueva de al menos 12 caracteres. No compartirla por chat. Verificar los nombres exactos en el script antes de ejecutar.

```powershell
node --env-file=.env.supabase.private scripts/check-supabase.mjs
node --env-file=.env.supabase.private --import=tsx scripts/bootstrap-supabase-admin.mjs
# Solo cuando se autorice crear la empresa/perfil y cuenta:
node --env-file=.env.supabase.private --import=tsx scripts/bootstrap-supabase-admin.mjs --execute
```

El diagnóstico es de solo lectura. El bootstrap sin `--execute` no crea nada. Con esa opción crea exclusivamente una cuenta nueva y su perfil administrativo; rechaza duplicados. Si falla la escritura del perfil, intenta bloquear la cuenta recién creada. No guarda contraseñas en documentos.

## Seguridad y concurrencia

- RLS sin acceso directo de anon/authenticated a los datos. RPC restringidas a servidor.
- El servidor verifica la sesión contra Supabase Auth y exige perfil activo. Antes de usar el repositorio, cada endpoint debe aplicar los permisos existentes por rol/empresa/campaña; la clave de servidor no sustituye RBAC.
- Escrituras atómicas con versiones esperadas, validación de referencias y control de cambios de colección. Restricción de una postulación activa por candidato/empresa.
- Ningún endpoint de eliminación histórica o migración automática.

## Activación pendiente (no sustituir por un simple cambio de variables)

Con credenciales configuradas y SQL validado, conectar el login/contexto y las lecturas/escrituras actuales al proveedor preparado, adaptar las tres operaciones administrativas y verificar todos los alcances y funcionalidades. Mantener R2 y contratos existentes. Antes del corte, probar creación, acceso, bloqueo, reset, aislamiento entre empresas, concurrencia y flujos Selección/Formación. No mezclar tokens Firebase con endpoints Supabase.

## Validación

Frontend typecheck/build y pruebas del Worker se ejecutan localmente. Las pruebas del adaptador son simuladas, no una confirmación de conectividad remota.

El workflow `.github/workflows/supabase-schema.yml` ejecuta esquema e invariantes en PostgreSQL 17 efímero. Los fixtures de `supabase/tests` son únicamente para CI; no aplicarlos a producción. Su resultado remoto debe comprobarse antes de activar. Localmente no fue posible ejecutar SQL: Docker no tiene el daemon activo y no hay psql instalado.

El análisis de dependencias detectó 31 vulnerabilidades en el árbol instalado; requieren revisión separada antes de producción. No se aplicaron actualizaciones forzadas ajenas a este cambio.
