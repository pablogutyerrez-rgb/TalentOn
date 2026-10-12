# Selección Fase 2 — implementación local

## Decisión de negocio confirmada
Una persona tiene una sola convocatoria activa. Se mantiene `candidates/{id}` como expediente único y proyección de la participación vigente. `selectionApplications` conserva por separado cada participación y su resultado cerrado. No se duplican expedientes ni se migran registros existentes.

Una vinculación nueva exige captación autorizada sin conflicto de identidad, convocatoria autorizada, responsable asignado, ausencia de otra participación activa y ausencia de un proceso downstream activo. La inscripción persona/convocatoria tiene ID determinista; los reintentos no crean otra inscripción. Una participación cerrada en la misma convocatoria no se reinscribe silenciosamente.

Las participaciones antiguas se habilitan manualmente para gestión avanzada sin reiniciar etapas ni resultados. Solo se cierran con NO_APTO, DESCARTADO o APTO_CAPACITACION y motivo obligatorio, mientras el proceso sigue en Selección. El cierre congela selección, metadatos documentales y los registros avanzados. La nueva vinculación conserva ese resultado y actualiza solo la proyección vigente. Los archivos R2 siguen usando los controles actuales: la instantánea conserva referencias, no crea versiones físicas de archivos.

## Pantallas integradas
- Captación > Expediente: Vincular convocatoria, seleccionando convocatoria y versión del proceso. No hay asignaciones automáticas.
- Pipeline & Kanban > Proceso y plantillas: configuración versionada por empresa/convocatoria/puesto, responsables, requisitos, preguntas de entrevista, evaluaciones y reglas internas; plantillas de comunicaciones.
- Ficha 360 > Gestión avanzada: participaciones, entrevistas, evaluaciones configuradas, comunicaciones, historial y alertas/requisitos. Históricos cerrados de solo consulta.

No se creó un directorio o módulo paralelo. Las entrevistas y evaluaciones existentes permanecen para procesos sin plantilla. Con plantilla, el formulario configurado registra la entrevista y las evaluaciones en los campos compatibles de la ficha vigente; mantiene aparte cada intento y la definición aplicada. No se encontraron componentes independientes de competencias digitales/ofimática para reutilizar; se conserva el sistema de evaluaciones disponible y su formato de resultados.

## Plantillas, entrevistas y evaluación
El orden base del Kanban se conserva. Las plantillas definen requisitos adicionales, evaluaciones por etapa y criterios objetivos, pero no sustituyen transiciones existentes. Versiones/familias se crean mediante transacciones; ninguna edición actualiza las instantáneas ya aplicadas. Responsables se validan en servidor, por empresa y rol; la plantilla no concede por sí misma acceso a la convocatoria.

Entrevistas: Programada, Realizada, Reprogramada, Cancelada; fecha/hora, modalidad, responsable, respuestas y observaciones. Se conserva el historial de cambios; entrevistas realizadas o canceladas no se reescriben. El resultado registrado no cambia automáticamente la etapa ni descarta al candidato. Un reclutador registra una entrevista realizada solo si es el entrevistador designado.

Evaluaciones: preguntas cerradas calificadas en servidor y abiertas con puntaje manual acotado. Cada intento conserva versión, definición y resultados. La ficha vigente proyecta el último intento de cada evaluación, sin borrar los anteriores del expediente de participación. El pase manual a APTO mantiene las comprobaciones originales y añade los umbrales de la plantilla aplicada. El cliente no puede eludir la calificación enviando una definición/puntaje por el endpoint heredado.

Los requisitos de etapa son verificados manualmente, con evidencia y auditoría; no se interpretan con IA. Los cambios concurrentes de etapas/contactos/evaluaciones y registros de selección utilizan precondición de versión Firestore para rechazar escrituras obsoletas durante una vinculación o cierre.

## Comunicaciones y automatizaciones
Plantillas para citación, recordatorio, confirmación, resultados y reprogramación. Variables permitidas: nombre, convocatoria, fecha y horario. Cada preparación conserva plantilla y contenido en el historial; se puede copiar. No hay proveedor de envío configurado ni se implementó uno nuevo. PREPARADO no significa enviado.

Las reglas habilitan alertas internas de asignación, entrevistas próximas/vencidas, evaluaciones pendientes y cambios de etapa. Se calculan al consultar Gestión avanzada, con identificadores estables; repetir la consulta no crea actividades duplicadas. Las acciones que originan las alertas quedan auditadas. Se pueden activar/desactivar. No existen jobs en segundo plano, correos automáticos ni recordatorios fuera de la aplicación. No se aprueban/rechazan candidatos ni se cambian convocatorias automáticamente.

## API autenticada (Worker)
- GET/POST `/api/selection/campaigns/:campaignId`: consultar/crear versiones de proceso.
- POST `/api/selection/link`: vinculación manual desde captación.
- GET `/api/selection/candidates/:candidateId`: participaciones autorizadas.
- POST `/api/selection/candidates/:candidateId/initialize`: habilitación manual del proceso vigente sin reiniciarlo.
- POST `/api/selection/candidates/:candidateId/close`: cierre y congelamiento de resultados.
- GET `/api/selection/applications/:applicationId`: participación autorizada y alertas internas.
- POST `/api/selection/applications/:applicationId/interviews`.
- POST `/api/selection/applications/:applicationId/evaluations`.
- POST `/api/selection/applications/:applicationId/communications`.
- POST `/api/selection/applications/:applicationId/rules`.
- POST `/api/selection/applications/:applicationId/requirements`.
- GET/POST `/api/selection/messages/:campaignId`: plantillas de comunicación.

ID Token, perfil activo, empresa y permisos se verifican en servidor. Captaciones, documentos y registros ajenos no se vuelven visibles por compartir identidad. El acceso histórico exige autorización vigente de convocatoria; los reclutadores además deben ser responsables de la participación. Managers conservan los alcances existentes. Plantillas y reglas las administran ADMIN, JEFE_SELECCION o ANALISTA_SELECCION autorizado.

## Modelo y archivos
Nuevas colecciones privadas: `selectionApplications`, `selectionTemplates`, `selectionTemplateFamilies`, `selectionMessages`. Denegadas a lectura/escritura directa por las Rules existentes (no se modificaron Rules). Proyección de candidatos: `selectionApplicationId`, `selectionActive`, `selectionProcessSnapshot`; mantiene los contratos básicos de la ficha, selección y Pipeline. Captaciones originales intactas.

Nuevos archivos:
- worker/src/selectionAdvanced.ts
- src/services/selectionAdvancedApi.ts
- src/components/candidates/CaptureLinkToCampaign.tsx
- src/components/candidates/SelectionProcessConfiguration.tsx
- src/components/candidates/SelectionAdvancedPanel.tsx

Integraciones: worker/src/index.ts, worker/src/capture.ts (reutilización de Store transaccional), Candidate360Modal.tsx, CaptureDossierPanel.tsx, MisConvocatoriasView.tsx, workerApi.ts (mensajes de errores), worker/tests/capture.test.ts y tests/rules/firestore.rules.test.ts.

No se cambiaron los módulos Formación/OJT, los dashboards ni sus fórmulas, autenticación, navegación global o diseño global. Los indicadores existentes seguirán reflejando la participación vigente; no se añadió consolidación histórica nueva a los dashboards.

## Validación y pendientes
- 61 pruebas Worker correctas en conjunto: 18 de Fase 2, además de las pruebas previas.
- Pruebas de REST simulado: vinculación manual, única convocatoria activa, inscripción idempotente, cierre/revinculación, concurrencia, versiones inmutables, aislamiento, rechazo de conflictos y downstream, entrevistas/historial, calificación servidor, intentos idempotentes, comunicación sin envío, reglas sin decisiones automáticas y preservación de procesos heredados.
- Typecheck frontend y Worker correctos. Build frontend y dry-run Worker correctos. Advertencia conocida de tamaño del bundle Firebase; no es error de compilación.
- Prueba de Rules ampliada para las nuevas colecciones, pendiente de ejecución en CI. Se conserva la limitación local Java/loopback documentada; no se afirma que las Rules se hayan probado localmente.

Pendiente: pruebas reales de UI/servicios con dos reclutadores y manager en entorno de prueba, incluidos documentos y regreso al Pipeline; publicación autorizada del Worker y frontend. **No se desplegó esta revisión ni se escribieron datos reales.**

Límites: cuerpo JSON de 8 KiB, hasta 10 evaluaciones/20 preguntas por evaluación, 20 campos de entrevista, 30 responsables, consultas de 201 versiones/participaciones y 200 acciones por participación. Firestore conserva su límite de documento; historiales muy grandes requieren paginación/subcolecciones antes de ampliar volumen. No se eliminaron datos para reducir tamaño ni se migró a Supabase.
