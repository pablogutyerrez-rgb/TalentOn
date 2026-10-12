# Captación de postulantes — Fase 1

## Alcance implementado
Selección > Captación, visible para RECLUTADOR con módulo Selección y ADMIN. Mis enlaces: fuentes Facebook, TikTok, LinkedIn, WhatsApp, Referidos y Otros; creación, copia, activación y desactivación. Mi bandeja: búsqueda, estado, fuente, observaciones, gestión auditada y expediente. ADMIN supervisa globalmente; reclutador solo su empresa y sus eventos/enlaces.

Formulario independiente `/captacion/<token>` sin login, nombre, correo o UID del reclutador. Token aleatorio de 192 bits. El servidor obtiene propietario/fuente del enlace; nunca del formulario. Recoge nombre, celular peruano, correo opcional, DNI/CE/pasaporte, distrito y consentimiento versionado.

Los expedientes se guardan en **candidates**, no en un directorio paralelo. Se preservan los documentos previos y cada captación. Los nuevos registros tienen `captureOnly: true`, `campaignId: ''` y no tienen etapa de selección. El contexto excluye únicamente estos registros nuevos de los procesos existentes para no alterar sus indicadores ni el Kanban. La bandeja accede al mismo ID canónico mediante Worker. La ficha 360 existente incluye acceso a origen e historial cuando el rol es ADMIN/RECLUTADOR.

## Endpoints
- `GET/POST /api/capture/links`: listar/crear.
- `PATCH /api/capture/links/:token`: activar/desactivar.
- `GET /api/capture/inbox`: bandeja autorizada.
- `PATCH /api/capture/events/:id`: estado y observación.
- `GET /api/capture/candidates/:id`: datos personales e historial dentro del alcance.
- `GET /api/public/capture/:token`: verificar disponibilidad, sin revelar atribución.
- `POST /api/public/capture/:token`: recibir postulación con consentimiento, requestId y token Turnstile.

La API privada reutiliza la verificación Firebase ID Token, estado del perfil y CORS existentes. La pública valida enlace y estado/permisos del propietario. Las respuestas no se cachean. Registros, consentimiento, identidad, idempotencia y contador de envíos se confirman mediante transacción Firestore. Se reintenta hasta tres veces ante contención. Gestión y cambio de estado también son transaccionales.

## Datos nuevos
- `captureLinks`: fuente, empresa, propietario, fechas, activo.
- `captations`: candidato canónico, enlace, atribución original, datos recibidos, consentimiento, conflicto e historial de gestión.
- `captureIdentities`: índice HMAC por empresa/tipo/documento; no expone el documento en la clave.
- `captureRequests`: idempotencia por enlace/requestId y huella del contenido.
- `captureRateLimits`: contador por HMAC de IP/minuto; máximo 5 envíos correctos por minuto.
- `captureAudit`: creación/activación/desactivación del enlace.
- `candidates`: solo inserción de expedientes iniciales cuando no se confirma coincidencia documental. No se sobrescriben datos históricos ni propietario.

Estas colecciones auxiliares no tienen acceso directo desde React; las reglas existentes las deniegan por defecto. No se modificaron Firestore Rules. Los datos se gestionan mediante service account del Worker, por lo que la autorización explícita en servidor es obligatoria.

Coincidencia documental exacta reutiliza el expediente sin sobrescribirlo; teléfono/correo normalizados marcan conflictos y no transfieren propiedad. El reclutador nunca recibe identificadores de otros candidatos coincidentes ni historial de otro reclutador, aunque compartan expediente. ADMIN puede revisar las referencias de conflicto. No se implementó fusión ni resolución automática de conflictos.

## Configuración pendiente (sin secretos reales)
Frontend/Railway:
```env
VITE_ADMIN_API_URL=https://<worker>
VITE_TURNSTILE_SITE_KEY=<clave-publica-del-widget>
```
También se acepta VITE_WORKER_API_URL. Docker declara la nueva variable de build. Registrar localhost y el dominio productivo en el widget Turnstile y conservar los orígenes CORS autorizados.

Worker:
```powershell
cd worker
npx wrangler secret put CAPTURE_HASH_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
```
Generar CAPTURE_HASH_SECRET con al menos 32 bytes aleatorios, sin compartir su valor. Es estable: no rotarlo sin planificar índices e idempotencia existentes. Mantener los secretos Firebase ya configurados. Para desarrollo copiar únicamente la plantilla a `.dev.vars` y completar en privado. La recepción pública falla de forma cerrada mientras falten secretos o la clave pública del widget. No hay bypass de Turnstile en producción.

Una vez autorizada la publicación:
```powershell
cd worker
npm run check
npm test
npx wrangler deploy --dry-run
# Solo con autorización: npm run deploy
```
Recompilar el frontend con la clave pública y la URL del Worker. Este trabajo **no ejecuta deploy**.

## Pruebas y límites explícitos
37 pruebas Worker correctas en conjunto (incluye 19 de Captación): campos, atribución, ausencia de permisos, falta de autenticación, privacidad pública, registro/consentimiento, idempotencia, identidad, conservación de históricos, aislamiento, desactivación, auditoría, dossier filtrado, contención, límite de envíos, propietario deshabilitado, hostname Turnstile inválido y configuración ausente. Usan REST simulado y datos exclusivamente de test, no producción.

Typecheck frontend y Worker correctos. Build frontend y dry-run Worker correctos. Se agregó una prueba de Rules que deniega lecturas/escrituras directas sobre las seis colecciones auxiliares, incluso para ADMIN; permanece pendiente de ejecución real en CI por la limitación Java/loopback local documentada. No se certifica una transacción real contra Firestore a partir de mocks.

Pendientes antes de habilitar producción:
1. Configurar widget/secrets y aprobar el aviso de privacidad con responsable y canal de ejercicio de derechos de la empresa. El texto incorporado es un aviso funcional básico, no una aprobación legal.
2. Probar punta a punta con dos reclutadores y ADMIN en entorno de prueba: copiar/enviar, bandeja correcta, rechazos cruzados, desactivar y reintentar. No se enviaron datos ni se crearon enlaces reales durante esta implementación.
3. Revisar el coste Spark: la comparación con históricos normaliza los candidatos de la empresa en una consulta transaccional limitada a 2000. Por encima se rechaza el envío, no se elude el control de duplicados. Para mayor volumen se necesita un índice de identidades normalizadas con un procedimiento autorizado, sin sobrescribir históricos.
4. Listados muestran hasta 200 registros y avisan si se truncaron; expediente hasta 501 eventos y cada gestión hasta 500 entradas. La paginación para volumen mayor queda pendiente; no hay un listado ilimitado que consuma cuotas sin control.
5. Contadores incluyen expiresAt informativo; no se habilitó TTL ni eliminación automática en Spark. Definir conservación/limpieza autorizada de datos auxiliares y auditoría. No borrar consentimientos o captaciones históricas.

## Archivos
Nuevos: worker/src/capture.ts, worker/tests/capture.test.ts, src/services/captureApi.ts, src/views/CaptacionView.tsx, src/views/PublicCaptureView.tsx, src/components/candidates/CaptureDossierPanel.tsx y este documento.
Integración: worker/src/index.ts, src/App.tsx, src/types.ts, Sidebar.tsx, Header.tsx, TalentContext.tsx, Candidate360Modal.tsx, tests/rules/firestore.rules.test.ts, Dockerfile y ejemplos de variables. No se modificaron estilos globales ni la autenticación existente.

Referencias técnicas: [transacciones REST de Firestore](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/beginTransaction), [validación servidor de Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## Vista gerencial por rol
- RECLUTADOR conserva Mis enlaces y Mi bandeja, sin acceso al consolidado.
- ADMIN ve el Panel gerencial global: indicadores, rendimiento por responsable, enlaces activos/totales, distribución por fuente/estado y captaciones del equipo. Filtra periodo, responsable, fuente y estado; consulta expedientes.
- ANALISTA_SELECCION tiene la misma organización gerencial, solo de lectura, limitada a los UID de `subordinateUserIds` de su perfil **cargado por el Worker**, cuyos perfiles deben pertenecer a su empresa y tener rol RECLUTADOR. No se toma el equipo del frontend ni de parámetros de la URL. Sin asignaciones devuelve vacío, nunca datos globales. No se modifican asignaciones ni permisos existentes.
- Nuevo endpoint autenticado `GET /api/capture/management`. Lecturas completas hasta 2000 registros por colección; si se supera, se rechaza el consolidado en lugar de presentar métricas parciales como globales. El límite y la futura paginación siguen siendo una condición de escala explícita.
- Enlaces activos refleja su estado actual; el periodo filtra las captaciones, no elimina enlaces que fueron creados antes pero siguen activos.
- Nuevo archivo `src/views/CaptureManagementView.tsx`; integración en CaptacionView, captureApi, navegación, tipos de perfil servidor y capture.ts.
- Verificación: 43 pruebas Worker correctas, typecheck frontend/Worker y build frontend correctos. No se modificaron registros reales ni se publicaron automáticamente estos cambios. La publicación previa del Worker corresponde a la Fase 1 original; el nuevo endpoint gerencial requiere publicar esta revisión.
