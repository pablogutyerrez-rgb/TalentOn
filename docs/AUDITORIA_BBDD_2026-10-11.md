# Auditoría de base de datos Talent-On

Fecha: 11 de octubre de 2026. Fases 1 y 2; propuesta de Fase 3 pendiente de sus requisitos de respaldo y pruebas.

## Alcance y evidencia

Revisión de la copia de trabajo actual, incluyendo cambios locales previos: `src/context/TalentContext.tsx`, servicios Firebase/Worker, modelos, dashboards, `worker/src/index.ts`, Rules, índices, funciones heredadas, pruebas y CI. No se hicieron llamadas de escritura a producción, migraciones, cambios de proveedor ni despliegues. Solo se añade este informe.

No se inventarían resultados de inspección de datos: **no se exportaron ni enumeraron Auth, Firestore o R2 de producción en esta revisión**. Los hallazgos confirmados describen código y configuración versionada. Duplicados existentes, huérfanos reales, Rules desplegadas, IAM, índices desplegados, tamaño de la base, permisos públicos R2 y respaldos externos quedan pendientes de comprobación autorizada de solo lectura. La presencia de un problema potencial no prueba que ya haya producido corrupción.

La solicitud actual conserva Firebase y reemplaza el objetivo anterior de migración a Sheets. Las pestañas preparadas en Sheets no constituyen una base operativa; la aplicación revisada continúa usando Firebase Auth/Firestore y Worker/R2.

## Arquitectura efectiva

React inicia sesión en Firebase Auth y lee perfiles y entidades mediante listeners Firestore. Las acciones de negocio llaman por HTTP al Worker con ID Token. El Worker verifica firma RS256, emisor, audiencia y expiración; carga el perfil y valida rol, módulo, empresa y asignación. Accede a Auth/Firestore mediante OAuth de service account y a archivos mediante binding R2 `DOCUMENTS`.

Las Rules bloquean todas las escrituras del navegador. Las escrituras privilegiadas del Worker usan IAM y su propia validación; no basta con endurecer Rules para corregir el Worker. App Check se inicializa opcionalmente en React, pero el Worker no valida App Check. CORS usa orígenes configurados; no sustituye autenticación y acepta solicitudes sin Origin con token válido.

`functions/src/index.ts` conserva implementaciones antiguas con transacciones/batches. No se localizaron llamadas `httpsCallable` en el frontend actual; `firebase.json` no configura despliegue de functions. No se pudo verificar si sobreviven funciones antiguas desplegadas. No asumir equivalencia: contratación antigua escribe `hiringProcesses`; el Worker actual escribe `candidates.hiring`.

## Inventario de entidades y relaciones

| Ruta | Identificador y relaciones | Uso observado |
| --- | --- | --- |
| Firebase Auth | UID; alias técnico derivado de username | Contraseña/estado/nombre; relacionado con `users/{uid}` |
| `users/{uid}` | UID de Auth; companyId, scope/scopeCampaignIds, subordinateUserIds | Perfil RBAC, módulos, avatar, apodo y frase; servidor mantiene campos históricos compatibles |
| `companies/{companyId}` | Empresa de perfiles y recursos | Rules permiten lectura por empresa; no hay CRUD actual en Worker |
| `campaigns/{id}` | Nuevos IDs `CMP-{UUID}`; código comercial separado | Empresa, assignedAnalystId, assignedUserIds, responsibles, metas, fuentes e historial |
| `candidates/{id}` | Nuevos IDs `CAN-{DNI normalizado}` | campaignId, recruiterId, analystId, trainingId; mapas selection/training/ojt/hiring y resúmenes documentales |
| `candidates/{id}/documents/{documentId}` | Documento + objectKey R2 | Tipo, estado, obligatorio, archivo, carga/validación/observación |
| `trainings/{id}` | Nuevos IDs `TRN-{UUID}` | campaignId/companyId, trainerId/coordinatorId, participantIds, fechas, configuración e historial |
| `trainings/{id}/participants/{candidateId}` | ID candidato bajo el grupo | Asistencia, evaluaciones, estado, OJT y trazabilidad; duplicados en candidate.training/ojt |
| `attendanceUnlockRequests/{grupo-fecha}` | Clave determinista grupo/fecha | Solicitud, decisión y auditoría anidada; Worker, sin match específico Rules |
| `systemSettings/{empresa normalizada}` | Empresa o global | Umbrales y configuración; Worker, sin match específico Rules |
| `hiringProcesses/{id}` | Flujo antiguo usa candidateId | Rules y funciones heredadas; no es destino del flujo actual de contratación del Worker |
| `auditLogs/{UUID}` | actorUid, entityType/entityId | Auditoría separada, timestamp servidor; faltan companyId/requestId en escritor actual |
| R2 `companies/.../candidates/.../documents/...` | objectKey en subdocumento | Archivo binario; metadatos candidateId/documentId; reemplazo crea clave nueva |

No hay esquema de integridad referencial impuesto por Firestore. El servidor debe comprobar existencia y empresa de las relaciones. El DNI determina una identidad global, no una identidad por empresa; cambiar esa decisión requiere análisis contractual y de histórico, no renombrado automático de IDs.

## Hallazgos priorizados

### P0 — acceso e integridad del flujo final

1. **Lectura de auditoría sin aislamiento por empresa.** `firestore.rules`, match auditLogs, permite a jefes autorizados leer toda la colección. `writeAdminAudit` (Worker, línea aproximada 808) no escribe companyId. Riesgo de exposición de acciones de otras empresas y valores anteriores/nuevos. Corrección: definir política de auditoría por rol/empresa y añadir empresa a nuevos eventos; tratar eventos históricos sin empresa de forma explícita y restrictiva. No aplicar Rules nuevas sin demostrar compatibilidad con consultas y registros antiguos.

2. **Atajos de asignación en Rules omiten rol/módulo.** En candidates, `resource.data.trainerId == request.auth.uid`; en trainings y participants, rama coordinatorId sin exigir rol/módulo; participants incluye coordinador con rol pero sin módulo en una rama. Sigue existiendo control de empresa y cuenta activa, pero un usuario activo reasignado a otro rol puede conservar lectura por estos campos. El Worker exige FORMACION y roles concretos, creando divergencia. Corrección propuesta: misma matriz RBAC en Rules/Worker, con pruebas negativas de cambio de rol y retiro de módulo. No se verificó una explotación en producción.

3. **Aprobación teórica/OJT insuficientemente validada en servidor.** `appendParticipantHistory` (474) acepta result de evaluación enviado por cliente aunque valida límites score/maxScore; `ojtParticipant` (502) inicia OJT por resultados registrados y admite resultados finales sin comprobar estado previo, criterios, duración, asistencia ni matriz de habilidades. `calculateEligibility` deriva aprobación de esos estados. Esto puede permitir aprobación a través de HTTP aunque la UI imponga condiciones. Corrección: acordar y aplicar política vigente desde configuración del grupo/empresa, calcular resultados en servidor, validar estados y requisitos antes del alta; conservar contrato público. Pruebas adversariales con nota baja/result APROBADO y OJT final sin inicio.

### P1 — concurrencia, pérdida y recuperación

4. **Pérdida de actualizaciones concurrentes.** `firestore` (120) hace PATCH con máscara, sin precondición de updateTime. `FirestoreDocument` no conserva updateTime. Muchos endpoints leen mapas/listas completos y los reescriben (selection, attendance, evaluations, ojt, histories). Dos peticiones pueden perder una edición o duplicar eventos; verificaciones de idempotencia por lectura no garantizan exclusión. Corrección: conservar versión del documento, commit con precondiciones o transacción REST y reintentos limitados; conflictos explícitos. No reintentar indiscriminadamente acciones con efectos externos.

5. **Grupo creado parcialmente o candidato asignado a dos grupos.** `createTrainingFromSelection` (296) valida primero, crea training y luego participant/candidate uno a uno. Un fallo intermedio deja relaciones incompletas; dos ejecuciones simultáneas pueden superar el chequeo trainingId. `createCandidate` usa comprobar-404 y PATCH sin exists:false: dos creaciones del mismo DNI pueden sobrescribirse. Corrección: creación condicional y commit atómico con precondiciones para documentos relacionados, control de tamaño y clave de operación estable. Comprobar empresa desde campaña: actualmente se deriva actor.companyId incluso para ADMIN con campaña de otra empresa.

6. **Proyecciones desincronizadas.** Participante y candidate se guardan separados; `syncCandidateTraining` (460) no copia dropoutRecord ni trainingApproved/finalGrade. `registerParticipantDropout` persiste motivo/categoría en participante pero su proyección no los incorpora. Dashboards que leen candidate pueden omitir causas o mostrar estado distinto del dato original. Corrección: definir participante como fuente y guardar proyección con los campos existentes en el mismo commit; probar equivalencia. Reparaciones históricas requieren informe y autorización específica.

7. **Reemplazo R2 elimina archivo anterior inmediatamente.** `replaceCandidateDocument` (604–615) sube nuevo objeto, cambia referencia y borra el anterior. Si falla la proyección posterior puede devolver error después de mutar; dos reemplazos concurrentes pueden dejar objetos sin referencia. No hay conservación/versiones recuperables en este flujo. Corrección: conservar referencias y objeto previo con política de retención aprobada; CAS de metadata, checksum y reconciliación. Ninguna limpieza de huérfanos automática.

8. **Auth/perfil/auditoría sin atomicidad común.** Crear/actualizar usuario modifica Auth y luego Firestore/auditoría; el rollback solo intenta borrar Auth recién creado si falla el perfil. Puede fallar compensación, o auditoría tras éxito, y dejar respuestas ambiguas. createUser reutiliza Auth existente sin perfil; metadata de perfil se valida después de crear Auth. updateUser puede tomar empresa del actor cuando input.companyId falta, mover perfiles y borrar teléfono/cargo/alcance omitidos. Corrección: validar todo antes de efectos, preservar semántica de campos omitidos tras análisis del contrato, registrar operación recuperable y reconciliar Auth/perfil, proteger último ADMIN activo. Tests de cada punto de fallo y reintentos.

9. **Listados REST truncables.** `listFirestore` (145) devuelve solo documents de una respuesta y no procesa nextPageToken. Lo usan documentos y usuarios asignables. Afecta permisos prácticos, completitud y elegibilidad al superar una página. Corrección: paginar, límites de seguridad y consultas filtradas por empresa cuando sea posible; prueba de múltiples páginas sin duplicados.

10. **Lectura puede escribir participante.** `trainingParticipant` (379) crea un participante vacío cuando no existe pero participantIds lo contiene. Puede ocultar pérdida y reconstruir estado sin historia. Corrección: separar lectura de recuperación, fallar con integridad pendiente y proponer reconciliación explícita; no rehidratar producción automáticamente.

11. **Sin procedimiento de recuperación probado en repositorio.** No se halló herramienta de backup/restauración conjunta de Auth, Firestore y R2 ni manifiesto/checksums. No prueba ausencia de backups externos. Corrección: exportación paginada de solo lectura con metadatos/tipos/IDs/subcolecciones, objetos y hashes, cifrado y acceso restringido; ensayo en entorno aislado. No depender de servicios de backup que obliguen a cambiar Spark. Exportación de contraseñas Auth requiere mecanismo oficial y privilegios específicos; no prometer recuperación de login sin comprobarlo.

### P2 — datos, métricas y rendimiento

12. **Indicadores Formación no representan completamente los originales.** `FormacionDashboardView.tsx` (180–233, 287): base Día 1 es todo trainingCandidates, OJT incluye cualquier status truthy (también NO_INICIADO); falta del día 1 puede contar como deserción aunque no sea baja; Math.min/Math.max puede esconder errores y producir retroceso desde Día 1; Día 1 OJT repite fin teoría; evolución semanal agrupa por día de semana de inicio/postulación, no eventos de una semana. Umbrales 80 difieren de configuración; período acepta fechas futuras o ausentes y el filtro de grupos deja pasar candidatos cuando filteredCohorts está vacío. Corrección: especificación por KPI con denominador, evento, fecha y fuente; pruebas de referencia, cero datos, etapas, semanas y filtros. La fuente es candidate y puede estar desincronizada según hallazgo 6.

13. **Consultas sin paginación y alcance cortado a 30.** TalentContext (272–311, 374) escucha colecciones completas para ADMIN/empresa, corta scope/campaigns/trainingIds a 30 y convierte errores de snapshot en listas vacías. Riesgo de consumo de cuota, dashboards incompletos y errores ocultos. Corrección: consultas acotadas, partición deduplicada de alcance, paginación/listeners por vista y estado de error explícito sin alterar diseño. Los índices versionados cubren las parejas principales companyId/campaignId, analystId, recruiterId, trainingId, trainerId/coordinatorId y assignedUserIds; falta comprobar índices desplegados, no hay evidencia suficiente para añadir índices a ciegas.

14. **Token OAuth nuevo por cada operación Firestore/Auth.** googleAccessToken (110) importa clave, firma y solicita token en cada llamada. Multiplica latencia y llamadas externas en creación de grupo. Corrección: caché por identidad/proyecto hasta margen previo a expirar, deduplicación de renovación y aislamiento de claves. Medir número de llamadas y probar expiración/fallo.

15. **Historiales sin límite en documentos.** Asistencias/evaluaciones/contactos/OJT/trazabilidad crecen como arrays y maps. Riesgo de límites de documento y reescrituras costosas. Corrección inicial: límites y medición con errores claros; cualquier extracción a subcolecciones requiere compatibilidad y aprobación, sin mover histórico en esta fase.

16. **Desbloqueo y validación de fechas incompletos.** La hora se toma del Worker (positivo), pero APROBADA mantiene desbloqueo indefinido para grupo/fecha; decisión puede cambiar sin exigir estado PENDIENTE; regex fecha no valida pertenencia al cronograma. Corrección: política explícita de expiración, transiciones CAS, calendario válido y auditoría atómica; no modificar ventanas por interpretación sin validar negocio.

17. **Revocación e identidad.** verifyToken comprueba JWT pero no consulta revocación/disabled Auth; bloqueo de perfil sí funciona por request. profileFor acepta uid almacenado distinto del sub verificado. Corrección: vincular siempre actor UID al token y analizar revocación con tokensValidAfterTime/lookup sin incrementar indiscriminadamente coste. Tests con uid distinto, cuenta deshabilitada en Auth pero perfil activo y cambio de contraseña.

## Verificación de datos reales pendiente

Auditoría de solo lectura con service account acotada, presupuesto de lecturas y exportación protegida:

- Comparar UID Auth/perfil; username normalizado y alias; companyId existente; módulos y referencias scope/usuarios; contar admins activos por política.
- Comparar path ID con campo id, DNI normalizado, códigos y duplicados lógicos. No publicar valores personales en informe.
- campaign/candidate/training/company consistentes; asignaciones a usuarios activos de rol/módulo correctos.
- participantIds únicos; documentos participants presentes; relación inversa trainingId/cohortId; candidatos en varios grupos; diferencias completas de proyecciones.
- Comparar contratación en candidate.hiring con hiringProcesses sin declarar una copia obsoleta sin datos.
- Enumerar R2 y referencias Firestore con paginación: faltantes, no referenciados, tamaño/MIME/checksum/tenant; HEAD/lectura autorizada. Un huérfano no se borra.
- Validar formatos/tipos de fechas, enums históricos, números finitos, montos/notas/horas y umbrales. Enumerar subcolecciones adicionales para no omitir histórico.

## Plan controlado de implementación y pruebas

1. Congelar diagnóstico sobre una revisión concreta (la copia tiene cambios previos); conservar diff/parche recuperable y ejecutar snapshot protegido de datos + R2 con manifiesto. Restaurar una muestra aislada y comparar hashes/conteos/referencias. La existencia de un ZIP de código no es backup de datos.
2. Añadir pruebas que reproduzcan cada hallazgo antes de cambiar comportamiento; fixtures únicamente en mocks/emulador, nunca en producción. Negativos por todos los roles, empresas, módulos, asignaciones obsoletas y estados de cuenta; queries reales de listeners además de getDoc.
3. Priorizar CAS/creación condicional/paginación, commit grupo+participantes+proyecciones y auditoría. Dos requests simultáneos: no sobrescritura, una sola asignación, sin dobles eventos; fallos inyectados en cada escritura: todo o nada o compensación documentada. Conservar contratos y errores HTTP consumidos por frontend.
4. Aprobar matriz de lectura de auditoría/Rules y requisitos académicos. Tests anteriores deben pasar con casos históricos; pruebas nuevas deben demostrar aislamiento y resultados calculados por servidor. Si cambia un permiso, documentar usuarios afectados antes de propuesta de despliegue.
5. R2/Auth requieren recuperación compensada: simular put/commit/delete/audit y timeout tras éxito; repetir solicitud con misma clave y verificar mismo resultado. Preservar objeto previo. Probar restauración conjunta sin tocar histórico.
6. Verificar métricas con dataset de referencia aislado: base Día 1 estable, bajas acumuladas sin dobles conteos, último porcentaje igual total, grupos vacíos, registros futuros/ausentes, más de 30 asignaciones, OJT NO_INICIADO, filtros y semanas exactas. Comparar cálculo con fuente y proyección.
7. Medir lecturas/escrituras/tokens/latencia y evitar operaciones globales innecesarias; verificar consumo Spark con volumen real. Ejecutar frontend check/build, Worker check/tests/bundle dry-run y Rules en Linux CI.
8. Presentar diff, resultados, cambios de permisos/contratos, limitaciones, snapshot y rollback. Despliegue solo con autorización explícita; reparación de datos históricos necesita autorización independiente. Rollback de código no revierte efectos persistidos: incluir restauración/compensación validada.

## Resultados ejecutados en esta revisión

| Verificación | Resultado |
| --- | --- |
| Frontend `npm run check` | PASS |
| Frontend `npm run build` | PASS; aviso bundle Firebase >500 kB |
| Worker `npm run check` | PASS |
| Worker `npm test` | PASS, 18/18; mocks HTTP, no certifican Firestore/R2 reales |
| Rules local | No repetidas: limitación Java NIO/loopback documentada; sin PASS actual |
| Rules CI | Workflow exige Node 22, Temurin 21, npm ci y test:emulators; resultados actuales y protección de rama no comprobados en esta revisión |
| Pruebas históricas Rules | Documento previo registra 28/28 Linux; evidencia histórica, no resultado nuevo |
| Concurrencia/rollback/R2/KPI E2E | Pendientes; suite actual Worker es de administración/asignación/configuración |
| Producción: datos/IAM/backup/restauración | No inspeccionados ni modificados |

No se implementaron cambios funcionales: el usuario solicita presentar primero diagnóstico, impacto y plan de pruebas, y el respaldo recuperable requerido no está validado todavía.

## Referencias técnicas

- Atomicidad y transacciones: https://firebase.google.com/docs/firestore/manage-data/transactions
- Paginación REST listDocuments/nextPageToken: https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/listDocuments

Las propuestas usan API REST oficial y capacidades de Firestore existentes; no requieren Cloud Functions ni proponen cambiar a Blaze.
