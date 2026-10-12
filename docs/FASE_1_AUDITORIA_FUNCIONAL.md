# Talent-On — Informe de Fase 1

Fecha: 1 de octubre de 2026  
Alcance: comprensión, mapeo, estabilidad, RBAC, seguridad, consumo Firebase Spark y despliegue.  
No se realizaron rediseños ni refactorizaciones generales.

## 1. Resultado general

La arquitectura vigente es coherente con el objetivo del producto: React/Vite consume Firebase Auth y lecturas Firestore protegidas por Rules; las mutaciones de negocio se ejecutan mediante un Cloudflare Worker que valida ID Token, perfil y RBAC. El frontend, el Worker y la imagen Docker construyen correctamente.

Se comprobó y corrigió un riesgo crítico: la edición general de convocatorias aceptaba campos arbitrarios y permitía intentar sobrescribir atributos internos o de aislamiento, incluido `companyId`. Se reemplazó por una lista blanca de campos editables y se añadió una prueba de regresión.

No se desplegó nada a producción.

Limitación de la auditoría: no se ejecutó un recorrido E2E autenticado con cuentas reales de cada rol. La validación de roles se hizo mediante código, pruebas unitarias del Worker y reglas existentes. Las pruebas locales de Firestore Rules no arrancaron por un fallo del runtime Java en Windows, documentado en la sección de validaciones.

## 2. Cambios locales preexistentes

Antes de esta auditoría ya existían cambios sin commit en:

- `.github/workflows/ci.yml`
- `src/components/candidates/Candidate360Modal.tsx`
- `src/context/TalentContext.tsx`
- `src/types.ts`
- `src/views/AnaliticaView.tsx`
- `src/views/ConfiguracionView.tsx`
- `worker/package.json`
- `worker/package-lock.json`
- `worker/src/index.ts`
- `worker/tests/admin.test.ts`
- `worker/wrangler.toml`
- `docs/CHATGPT_PROJECT_CONTEXT.md`
- `docs/CHATGPT_PROJECT_INSTRUCTIONS.md`

No fueron descartados ni revertidos.

## 3. Flujo funcional actual

### 3.1 Recorrido principal

```text
Convocatoria
  → Postulante en Selección
  → Entrevista
  → Verificación técnica
  → Evaluaciones
  → Apto para capacitación
  → Grupo de capacitación
  → Asistencia y evaluaciones teóricas
  → OJT
  → Resultado final
  → Validación de documentos y cuenta sueldo
  → Pase a Gestión de Talento
  → Datos laborales
  → Contrato generado
  → Pendiente de firma
  → Contratado
```

### 3.2 Selección y candidato

**Origen de datos:** `campaigns`, `candidates` y el perfil `users/{uid}`.  
**Roles:** Admin, Jefe de Selección, Analista de Selección y Reclutador según empresa/asignación/alcance.  
**Componentes:** `ConvocatoriasView`, `MisConvocatoriasView`, `CandidatosView`, `CandidateCreateModal`, `Candidate360Modal` y modales de entrevista, descarte, responsables y fuentes.  
**Worker:** `/api/campaigns/*`, `/api/candidates`, `/api/candidates/:id/stage`, contactos, evaluaciones, observaciones, selección y datos personales.  
**Consumidores:** dashboards de selección, directorio, Ficha 360°, analítica y creación de capacitación.

Transiciones de Selección aplicadas en servidor:

```text
NUEVO → CONTACTADO | NO_APTO | DESCARTADO
CONTACTADO → ENTREVISTA | NO_APTO | DESCARTADO
ENTREVISTA → VERIFICACION_TECNICA | NO_APTO | DESCARTADO
VERIFICACION_TECNICA → EVALUACIONES | NO_APTO | DESCARTADO
EVALUACIONES → APTO_CAPACITACION | NO_APTO | DESCARTADO
NO_APTO → NUEVO
DESCARTADO → NUEVO
APTO_CAPACITACION → fin del flujo de selección
```

Para llegar a `APTO_CAPACITACION`, el Worker exige entrevista apta, verificación técnica aprobada/no rechazada y evaluaciones aprobadas.

### 3.3 Capacitación

**Origen de datos:** `trainings`, `trainings/{id}/participants`, `candidates`, `attendanceUnlockRequests`.  
**Roles:** Admin, Jefe de Formación, Coordinador dentro de alcance y Formador asignado.  
**Componentes:** `FormacionDashboardView`, `CapacitacionesView`, `MisCapacitacionesView`, `ParticipantesView`, `AssignTrainerModal` y `RegisterDropoutModal`.  
**Worker:** creación desde selección, asignación de formador, gestión administrativa, ventana de asistencia, desbloqueos, asistencia, evaluaciones, estado y baja.  
**Consumidores:** dashboards de formación, analítica, OJT, resultado final y pase a alta.

Transiciones de grupo aplicadas en servidor:

```text
PENDIENTE_ASIGNACION → PROGRAMADA | CANCELADA
PROGRAMADA → EN_CAPACITACION | CANCELADA
EN_CAPACITACION → EN_OJT | CANCELADA
EN_OJT → EXTENSION_OJT | FINALIZADA
EXTENSION_OJT → FINALIZADA
```

La asistencia se calcula con hora del Worker y zona `-05:00`. Se permite desde el inicio hasta 30 minutos después. Un desbloqueo requiere solicitud del Formador y aprobación del Admin/Jefe/Coordinador con acceso al grupo.

### 3.4 Evaluaciones y OJT

**Origen de datos:** participante del grupo y proyección resumida en `candidates`.  
**Roles:** mismos roles con acceso a la capacitación; el Formador queda limitado por `training.trainerId`.  
**Componentes:** `MisCapacitacionesView`, `OjtView`, `ParticipantesView`.  
**Worker:** evaluaciones, `ojt/start`, `ojt/daily`, `ojt/result`, habilidades, feedback y extensión.

Reglas principales:

- OJT solo inicia desde `EN_CAPACITACION` y con evaluaciones existentes aprobadas.
- No se permite repetir una métrica OJT para la misma fecha.
- Resultados OJT: `OJT_APROBADO`, `OJT_NO_APROBADO`, `DESERTO`, `NSP` o `REPROGRAMADO`.
- La sincronización actualiza la proyección del candidato a `CAPACITACION`, `OJT`, `APTO_ALTA` o `BAJA`.

### 3.5 Resultado final, alta y Gestión de Talento

**Origen de datos:** participante, candidato, documentos y cuenta sueldo.  
**Roles:** Formación para elegibilidad/alta; Jefe y Analista de Talento para contratación, con alcance.  
**Componentes:** `ValidacionAltaModal`, `DocumentacionContratacionTab`, `ContratacionesView`.  
**Worker:** documentos en R2/Firestore, elegibilidad, alta, datos laborales, estados de contratación, contrato y firma.

La elegibilidad exige:

- capacitación aprobada;
- OJT aprobado;
- DNI, CV, antecedentes y recibo de servicios validados;
- cuenta sueldo válida o solicitud de apertura.

Transiciones de contratación:

```text
PENDIENTE_CONTRATACION → EN_REVISION | CANCELADO | REPROGRAMADO
REPROGRAMADO → EN_REVISION | CANCELADO
EN_REVISION → CONTRATO_GENERADO mediante generación del contrato
CONTRATO_GENERADO → PENDIENTE_FIRMA | CANCELADO | REPROGRAMADO
PENDIENTE_FIRMA → CONTRATADO mediante firma, o CANCELADO/REPROGRAMADO
```

## 4. Matriz de dependencias

| Módulo | Datos principales | Worker | Firestore/R2 | Consumidores |
|---|---|---|---|---|
| Autenticación/RBAC | perfil y token | validación de token y perfil | `users` | App, Sidebar, todas las vistas |
| Convocatorias | campaña, responsables, fuentes | `/api/campaigns/*` | `campaigns` | dashboards, selección, capacitación |
| Candidatos | identidad, selección, trazabilidad | `/api/candidates/*` | `candidates` | directorio, ficha 360°, dashboards |
| Capacitación | grupo, fechas, formador, estado | `/api/trainings/*` | `trainings` | panel administrativo y dashboards |
| Participantes | asistencia, notas, estado, OJT | endpoints de participantes | `trainings/{id}/participants` y proyección en `candidates` | Mis Capacitaciones, OJT, analítica |
| Desbloqueo de asistencia | solicitud, decisión y auditoría | attendance-unlocks | `attendanceUnlockRequests`, `auditLogs` | workspace de capacitación |
| Documentos | metadatos y contenido | documentos de candidato | subcolección `documents` + R2 | Ficha 360°, alta, contratación |
| Alta | elegibilidad y pase | eligibility/alta | `candidates`, documentos y participantes | Formación y Talento |
| Contratación | datos laborales, contrato y firma | `/api/talent/candidates/*` | `candidates` | Contrataciones y analítica |
| Configuración | umbrales y empresa | `/api/settings` | `systemSettings`, `auditLogs` | Configuración |
| Analítica | datos derivados | sin endpoint agregado | listeners de campañas/candidatos/grupos | `AnaliticaView` y dashboards |
| Auditoría | actor, acción, entidad y valores | escritura interna | `auditLogs` | líderes y Admin según Rules |

`hiringProcesses` sigue protegido en Firestore Rules y pruebas, pero el flujo actual del Worker persiste contratación dentro de `candidates.hiring`. Debe considerarse una colección heredada hasta decidir una migración explícita.

## 5. Matriz de roles y alcance

| Rol | Módulos/acciones | Alcance efectivo |
|---|---|---|
| `ADMIN` | todos; usuarios, configuración y operación | global, incluso entre empresas por diseño actual |
| `JEFE_SELECCION` | convocatorias, candidatos, selección y analítica | empresa del perfil |
| `ANALISTA_SELECCION` | convocatorias/candidatos asignados y operaciones de selección | campaña en `scope` o asignación directa |
| `RECLUTADOR` | mis convocatorias, registro y gestión de sus candidatos | responsable directo o convocatoria asignada |
| `JEFE_FORMACION` | dashboard, grupos, participantes, OJT, documentos y alta | empresa del perfil |
| `COORDINADOR_FORMACION` | grupos, participantes, asignaciones y alta | campaña en `scope` o grupo donde es coordinador |
| `FORMADOR` | sus grupos, asistencia, evaluaciones, OJT y resultado | únicamente grupo con `trainerId == uid` |
| `JEFE_TALENTO` | contratación, documentos y analítica | empresa del perfil |
| `ANALISTA_TALENTO` | contratación y documentos | campaña/empresa incluida en `scope` |

### Consistencia React → Worker → Rules

- React filtra vistas y consultas por rol/módulo/asignación.
- Worker vuelve a comprobar rol, módulo, empresa, campaña, coordinador o formador antes de mutar.
- Firestore bloquea todas las escrituras directas desde el navegador.
- Las Rules limitan lecturas de Formador usando el `trainerId` del grupo relacionado.
- No se encontraron `addDoc`, `setDoc`, `updateDoc`, `deleteDoc` ni `httpsCallable` en el frontend.

## 6. Riesgos detectados

### CRÍTICO — corregido

#### Edición arbitraria de campos internos de convocatoria

- **Problema:** `PATCH /api/campaigns/:id` propagaba todo el cuerpo hacia Firestore.
- **Causa:** uso de `{ ...input }` sin lista blanca.
- **Impacto:** un usuario de selección autorizado podía intentar alterar `companyId`, asignaciones, creador u otros metadatos internos.
- **Archivos:** `worker/src/index.ts`, `worker/tests/admin.test.ts`.
- **Corrección:** lista blanca estricta, validación de estado y prueba que confirma que campos internos no se escriben.

### ALTO

#### Flujos de múltiples documentos no atómicos ni idempotentes

- **Problema:** creación de capacitación y algunas operaciones escriben grupo, participantes, candidatos y auditoría secuencialmente.
- **Causa:** llamadas REST independientes sin commit conjunto ni clave de idempotencia.
- **Impacto:** una falla intermedia puede dejar grupos, participantes o proyecciones parcialmente creados; un reintento puede duplicar historial.
- **Archivos:** `worker/src/index.ts` (`createTrainingFromSelection`, asignación, documentos y auditoría).
- **Recomendación:** Fase 3, usar Firestore Commit con precondiciones y claves de operación.

#### Estados duplicados y proyecciones potencialmente divergentes

- **Problema:** existen `TrainingStatus`, `ParticipantTrainingStatus`, `OjtStatus`, `AppStage` y estados heredados equivalentes.
- **Causa:** evolución del modelo sin una máquina de estados única.
- **Impacto:** dashboards o filtros pueden interpretar distinto `APTO_ALTA`, `OJT_APROBADO`, `APROBADO_OJT`, `DESERTO`, `BAJA` y `NSP`.
- **Archivos:** `src/types.ts`, `worker/src/index.ts`, dashboards.
- **Recomendación:** Fase 3, catálogo canónico y funciones únicas de proyección/transición.

#### Rechazo de entrevista/verificación no actualiza `selection.stage`

- **Problema:** el Worker marca `currentStage = DESCARTADO` y `selection.status = NO_APTO`, pero conserva la etapa anterior.
- **Causa:** `updateSelectionRecord` no asigna el campo `selection.stage`.
- **Impacto:** candidato descartado con etapa visible contradictoria y reapertura/transiciones difíciles de interpretar.
- **Archivos:** `worker/src/index.ts`, `Candidate360Modal.tsx`.
- **Recomendación:** Fase 3, definir si el estado final es `NO_APTO` o `DESCARTADO` y actualizarlo atómicamente.

#### Configuración global aún no gobierna reglas de negocio

- **Problema:** nota mínima, asistencia mínima y duración OJT se guardan, pero las evaluaciones usan valores de grupo/entrada y no consultan `systemSettings`.
- **Causa:** persistencia agregada sin integración completa con cálculos.
- **Impacto:** el administrador puede creer que cambió una regla que sigue sin aplicarse.
- **Archivos:** `ConfiguracionView.tsx`, `TalentContext.tsx`, `worker/src/index.ts`.
- **Recomendación:** Fase 3, resolver precedencia configuración global → campaña → grupo y aplicarla en servidor.

#### Auditoría central incompleta

- **Problema:** usuarios, asignación de formador, desbloqueos y configuración generan `auditLogs`; varias mutaciones de campaña, selección, capacitación, OJT y contratación solo guardan historia embebida o ninguna auditoría central.
- **Impacto:** trazabilidad desigual y dificultad para investigar cambios administrativos.
- **Archivos:** `worker/src/index.ts`.
- **Recomendación:** Fase 3, política común de auditoría dentro de la misma operación atómica.

### MEDIO

#### Regla de candidato contiene acceso alternativo por `candidate.trainerId`

- **Problema:** las Rules permiten lectura si el campo superior `trainerId` coincide, sin exigir rol/módulo en esa rama.
- **Impacto:** datos heredados o mal migrados podrían ampliar acceso de lectura.
- **Archivo:** `firestore.rules`.
- **Recomendación:** eliminar esa excepción y depender únicamente de `trainingId → trainings/{id}.trainerId`.

#### Límite silencioso de 30 IDs en consultas por alcance

- **Problema:** React aplica `.slice(0, 30)` a campañas y capacitaciones antes de consultas `in`.
- **Impacto:** usuarios con más de 30 asignaciones pueden ver información incompleta.
- **Archivo:** `src/context/TalentContext.tsx`.
- **Recomendación:** paginar/chunkear consultas o mantener relaciones consultables sin listas `in` grandes.

#### Lecturas y listeners costosos para Firebase Spark

- **Problema:** existen listeners permanentes para campañas, capacitaciones y candidatos; al cambiar campañas/grupos se recrea el listener de candidatos. Admin y jefaturas leen colecciones completas de su ámbito.
- **Impacto:** lecturas repetidas y crecimiento de consumo conforme aumentan datos.
- **Archivo:** `src/context/TalentContext.tsx`.
- **Recomendación:** medir lecturas, paginar y separar datos operativos de agregados de dashboard.

#### Enumeración completa de usuarios desde el Worker

- **Problema:** `listAssignableUsers` y `availableTrainingTrainers` descargan `users` y filtran en memoria.
- **Impacto:** costo creciente y latencia en cada apertura de modal.
- **Archivo:** `worker/src/index.ts`.
- **Recomendación:** usar StructuredQuery por empresa, rol, módulo y estado.

#### Diferencia entre acceso a Ficha 360° y descarga documental

- **Problema:** roles de Selección pueden abrir la ficha, pero el endpoint documental solo autoriza Formación administrativa o Talento.
- **Impacto:** el botón de CV puede devolver acceso denegado aunque la ficha sea visible.
- **Archivos:** `Candidate360Modal.tsx`, `worker/src/index.ts`.
- **Recomendación:** definir explícitamente si Selección puede descargar únicamente CV y crear una regla específica de mínimo privilegio.

#### Estados de participante sin matriz de transición

- **Problema:** el endpoint de estado valida una lista, pero no valida estado anterior → estado nuevo.
- **Impacto:** saltos o retrocesos incoherentes por una llamada válida pero fuera de orden.
- **Archivo:** `worker/src/index.ts`.
- **Recomendación:** agregar máquina de estados y razones obligatorias para excepciones.

#### Riesgo de objetos R2 o metadatos huérfanos

- **Problema:** existen compensaciones para algunas fallas de carga, pero una falla posterior al guardar metadatos/proyección puede dejar capas desincronizadas.
- **Archivos:** `worker/src/index.ts`, R2 y subcolección `documents`.
- **Recomendación:** reconciliación programada o estado transaccional de carga.

#### Dependencias reportadas por npm audit

- **Problema:** `npm audit --omit=dev` reporta 4 vulnerabilidades altas en `@grpc/grpc-js` transitivo de Firebase 12.18.0; el build completo reporta además vulnerabilidades de herramientas de desarrollo.
- **Impacto real:** la aplicación desplegada es un bundle de navegador y la imagen final no contiene `node_modules`, por lo que el componente gRPC afectado no funciona como servidor expuesto. Sigue siendo deuda de cadena de suministro.
- **Recomendación:** seguir actualización oficial de Firebase; no aplicar el `--force` sugerido porque propone un downgrade incompatible.

### BAJO

#### `/health` sirve la SPA

- **Problema:** Caddy reescribe `/health` a `/`, devolviendo HTML y 200.
- **Impacto:** Railway comprueba disponibilidad HTTP, no salud semántica.
- **Archivos:** `Caddyfile`, `Dockerfile`.

#### Advertencia por tamaño del bundle Firebase

- **Problema:** chunk Firebase de aproximadamente 668 kB sin comprimir.
- **Impacto:** carga inicial, no corrección funcional.
- **Archivo:** `vite.config.ts`.

#### Cloud Functions heredadas permanecen en el repositorio

- **Problema:** `functions/` conserva implementación antigua y bootstrap.
- **Impacto:** posibilidad de confusión o despliegue accidental; no se usan en producción actual.
- **Recomendación:** Fase 3, archivar claramente solo después de confirmar que ninguna operación depende de ellas.

#### Códigos y valores por defecto incluyen 2026

- **Problema:** generación visual de códigos y algunos defaults contienen año/sede/salario fijos.
- **Impacto:** mantenimiento futuro y posibles códigos inconsistentes.
- **Archivos:** `TalentContext.tsx`, `ConvocatoriaModal.tsx`, `CreateTrainingCohortModal.tsx`.

## 7. Firebase Spark

Patrones observados:

- tres familias principales de listeners en tiempo real;
- consultas paralelas para asignación directa y alcance, luego deduplicación en memoria;
- resuscripción de candidatos cuando cambian IDs de campañas o grupos;
- lectura completa de usuarios desde Worker para listas asignables;
- dashboards calculados en cliente sobre documentos operativos completos;
- duplicación deliberada del estado del participante dentro del candidato para consumo transversal.

No se optimizaron en esta fase. Prioridad recomendada: instrumentar conteo de lecturas por rol y volumen antes de sustituir listeners. La proyección duplicada mejora lectura, pero requiere escrituras atómicas o reconciliación para evitar divergencias.

## 8. Docker, Railway y variables

- `Dockerfile`: build con Node 22, runtime Caddy 2.10; correcto.
- `.dockerignore`: excluye secretos, dependencias, Worker, Functions, pruebas y documentación; correcto para una imagen solo frontend.
- Caddy: fallback SPA, compresión y puerto dinámico; correcto.
- Variables `VITE_*`: se incorporan al bundle y no deben contener secretos.
- Worker: secrets de cuenta de servicio fuera de `wrangler.toml`; correcto.
- CORS: origen local y Railway definidos explícitamente; no usa `*`.
- Docker emitió advertencias por nombres `VITE_FIREBASE_API_KEY`, `AUTH_DOMAIN` y App Check. Son valores públicos del cliente Firebase, no claves privadas.

## 9. Cambios recomendados

### Fase 2 — interfaz y experiencia

1. Unificar mensajes y estados visuales para transiciones rechazadas.
2. Explicar claramente qué umbral proviene de configuración global, campaña o grupo.
3. Corregir el comportamiento del botón CV según autorización real.
4. Mostrar advertencia cuando el alcance supera el límite actualmente cargado.
5. Mantener estados vacíos y retirar cualquier dato demo de compilaciones productivas.

### Fase 3 — lógica, seguridad y consistencia

1. Convertir creación de capacitación y flujos multisistema en operaciones atómicas/idempotentes.
2. Unificar máquinas de estado y proyecciones candidato/participante/OJT.
3. Corregir rechazo de entrevista/verificación y transición de participante.
4. Aplicar `systemSettings` en reglas de servidor con precedencia explícita.
5. Completar auditoría central dentro de la misma operación de negocio.
6. Endurecer la rama `candidate.trainerId` de Firestore Rules y ampliar pruebas negativas.
7. Sustituir lecturas completas/listas `in` truncadas por consultas paginadas e indexadas.
8. Definir reconciliación entre R2, documentos, participante y candidato.
9. Delimitar o retirar código heredado de Cloud Functions.

## 10. Validaciones ejecutadas

| Validación | Resultado |
|---|---|
| `git status --short` y `git diff` | ejecutados; cambios preexistentes preservados |
| `npm run check` | correcto |
| `npm run build` | correcto; advertencia de chunk Firebase |
| `docker build -t talent-on .` | correcto |
| Contenedor local y `GET /health` | 200; devuelve HTML de la SPA |
| Worker `npm run check` | correcto |
| Worker `npm test` | 15/15 correctas después de la corrección |
| `npx wrangler deploy --dry-run` | correcto; no se desplegó |
| `npm run test:emulators` | no ejecutó pruebas: el emulador Firestore salió por fallo Java/loopback del entorno Windows |
| `npm audit --omit=dev` | 4 vulnerabilidades altas transitivas de Firebase/@grpc reportadas |

## 11. Archivos creados o modificados por esta auditoría

- Creado: `docs/FASE_1_AUDITORIA_FUNCIONAL.md`.
- Modificado: `worker/src/index.ts` para proteger edición de convocatorias.
- Modificado: `worker/tests/admin.test.ts` con prueba de regresión.

