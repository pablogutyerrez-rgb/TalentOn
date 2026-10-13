# Integración multiempresa — 12 octubre 2026

## Estado verificable

- Implementado localmente: selector de empresa, contexto de sesión validado por servidor, administración de empresas/catálogos/membresías, selector de campañas en convocatorias y captación, indicadores consolidados, identidad opaca compartida y validación empresarial de documentos laborales.
- Supabase remoto: 007/008, 009 y 010 aplicadas atómicamente y confirmadas durante esta ejecución. 011 se inició con respaldo, pero no se recuperó su resultado final; verificar su hash remoto antes de continuar. 012 se preparó después y **no se aplicó remotamente**.
- Respaldo lógico privado antes de cada aplicación en `supabase/.local/multiempresa-backup-*.json`, excluido de Git. Se restauraron 74 tablas inicialmente y 82 en aplicaciones posteriores en PostgreSQL WASM aislado, comprobando conteos y FK. Este respaldo cubre datos/esquema de aplicación, no credenciales de Supabase Auth ni objetos R2, que no se modificaron.
- Acceso global inicial explícito: cuenta canónica existente `admin`, con membresías a Talent Up, Techcenter y Konectados. No se concedió acceso global a los demás usuarios ADMIN. Las empresas nuevas no recibieron datos operativos históricos.
- Secrets `IDENTITY_HASH_SECRET` y `CAPTURE_HASH_SECRET` registrados en Worker durante la ejecución. No regenerarlos: son claves estables de identificación. Ningún valor se incorpora al repositorio.
- Worker multiempresa **no desplegado ni activado**. `ORG_ENABLED` permanece ausente. Frontend nuevo pendiente de publicación. No confundir estructura aplicada con disponibilidad en Railway.

## Seguridad y comportamiento

La cabecera `X-Talent-Company` solicita el contexto; Supabase verifica identidad Auth, membresía, rol y campañas. El Worker usa el actor autenticado y nunca el enviado en el cuerpo. Los perfiles de contexto conservan la identidad canónica sin crear cuentas Auth adicionales. Formadores conservan la restricción de grupos asignados; reclutadores conservan propiedad de captaciones/postulaciones. Las tablas operativas mantienen RLS deny-by-default y las RPC de servicio comprueban autorización explícita.

007 agrega catálogo, integridad, RLS, auditoría y resumen; 008 adapta contexto/runtime; 009 reserva identidades HMAC; 010 protege al administrador global; 011 retira del selector la empresa hogar revocada; 012 bloquea colisiones de identificadores entre perfiles canónicos y evita mezclar sus datos en el roster.

Cambios administrativos usan versión esperada y bloqueos. Reasignar empresa/campaña histórica sigue prohibido. Nuevas personas con documento pueden compartir un ID opaco: la coincidencia no habilita lectura de datos ajenos. No se deduplicó ni reclasificó información histórica. La reserva HMAC anterior al commit puede quedar sin referencias si el commit falla; el reintento reutiliza la reserva, sin guardar PII global.

## Límites funcionales explícitos

- Se integraron los roles y módulos ya operativos. Coordinador de Operaciones y Calidad continúan como diseño/esquema preparado; no se agregaron flujos completos ni se presentan como roles funcionales nuevos.
- Razón social y RUC requieren valores reales en Administración. La generación actual de contratos conserva su contrato de metadatos, no genera un PDF nuevo.
- La captación pública requiere configuración de Turnstile; no se desactivó esa protección.
- Identidades históricas sin vínculo compartido no pueden deduplicarse de forma garantizada en el consolidado.

## Validación y bloqueo final

Las 12 migraciones y suites SQL `invariants`, `relational`, `first-password` y `multiempresa` pasaron en PostgreSQL 17 embebido. Typecheck frontend y Worker pasó. **110 pruebas Worker pasaron** usando una carpeta temporal dentro de `worker/node_modules` para evitar el error de acceso al temporal externo del sandbox. Una ejecución anterior a 012 confirmó build frontend. La última repetición de build encontró `EPERM` en `realpath` de Windows; no es evidencia de una regresión funcional, pero tampoco confirma el build final. El workflow PostgreSQL 17 incluye pruebas SQL y concurrencia; resultado remoto pendiente.

La sesión pasó a un entorno con red restringida: PostgreSQL devolvió `ENOTFOUND`; resolución DNS de GitHub y Cloudflare devolvió `Acceso denegado`. No se pudo verificar 011 ni aplicar 012, desplegar Worker o publicar en GitHub. No desactivar TLS ni modificar certificados para solventar este bloqueo.

## Continuación autorizada cuando haya acceso de red

1. Configurar `PG_MODULE` con la instalación local de `pg` y conservar `SUPABASE_CA_CERT` en `.env.postgres.local`. El script verifica CA, hostname, proyecto y hashes aplicados.
2. Desde la raíz ejecutar, en orden:

```powershell
node --env-file=.env.local --env-file=.env.postgres.local scripts/apply-multiempresa.mjs --execute --context
node --env-file=.env.local --env-file=.env.postgres.local scripts/apply-multiempresa.mjs --execute --profile
```

3. Verificar typecheck, tests Worker, build frontend y CI SQL. Mantener intactos los archivos de migraciones aplicadas.
4. Agregar `ORG_ENABLED = "true"` en `[vars]` de `worker/wrangler.toml` y ejecutar `npm run deploy` dentro de `worker`. Verificar `/api/session`, `/api/org`, cambio de empresa, rechazo 401/403 y CORS en el dominio Railway real.
5. Publicar los cambios en `talenton/main` (`pablogutyerrez-rgb/TalentOn`), comprobar CI y despliegue Railway. Probar selector, catálogo, asignaciones y operaciones con sesión autorizada; sin crear registros ficticios en producción.

Los archivos principales modificados están en `src/components/common/OrganizationAdmin.tsx`, `CompanyCampaignPicker.tsx`, Header, formularios de convocatoria/captación, contexto/cliente HTTP; Worker `organization.ts`, `supabaseSession.ts`, `relationalRuntime.ts`, `index.ts`; migraciones 007–012, suites SQL/Worker, workflow y script de aplicación con respaldo.
