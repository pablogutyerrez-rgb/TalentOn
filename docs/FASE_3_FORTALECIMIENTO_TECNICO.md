# Talent-On — Fase 3: Fortalecimiento técnico

Fecha: 1 de octubre de 2026.

## Resultado

Se reforzaron validaciones del Worker sin cambiar la arquitectura ni realizar despliegues. Las mutaciones privilegiadas continúan en Cloudflare Worker; Firestore mantiene las escrituras directas bloqueadas por Rules.

## Correcciones y seguridad

- Perfiles históricos activos que solo poseen `module` y no incluyen `enabled`/`allowedModules` conservan acceso compatible; un `enabled: false` sigue bloqueado.
- La creación de candidatos ignora campos administrativos inyectados por el cliente, fija el proceso inicial en Selección y toma analista desde la convocatoria. Si se selecciona un reclutador distinto al actor, verifica perfil real, empresa, rol, módulo y estado.
- La creación de capacitaciones elimina participantes repetidos, rechaza candidatos ya vinculados a un grupo y no acepta campos administrativos inyectados como `trainerId` o `companyId`.
- Reasignar el mismo formador es idempotente: no escribe ni duplica auditoría.
- Solicitudes de desbloqueo de asistencia, evaluaciones y métricas OJT repetidas devuelven conflicto en vez de duplicar registros.
- El pase a Gestión de Talento es idempotente y no añade trazabilidad duplicada si ya fue procesado.
- Las transiciones genéricas de participante se limitan a transiciones permitidas; las bajas y OJT siguen sus endpoints especializados.
- Se normalizaron errores de conflicto HTTP 409 y mensajes claros del frontend para los nuevos códigos.
- `/health` del contenedor ahora devuelve JSON explícito y conserva el fallback SPA para rutas de la aplicación.

## Pruebas ejecutadas

- `npm run check`: correcto.
- `npm run build`: correcto.
- `docker build -t talent-on .`: correcto.
- Contenedor local: `/health` respondió `200 {"ok":true}`; ruta SPA inexistente respondió `200`.
- En `worker/`: `npm run check`: correcto.
- En `worker/`: `npm test`: 18/18 correctas.
- En `worker/`: `npx wrangler deploy --dry-run`: correcto, sin despliegue.
- Windows local: `npm run test:emulators` no ejecuta aserciones porque Firestore Emulator no inicia. El log reporta `Unable to establish loopback connection` / `failed to open a new selector` en Java/Windows; no es evidencia de una falla de Rules.
- Linux/CI equivalente: `npm run test:emulators` aprobado con Node 22, OpenJDK 21 y Firebase CLI 15.28.2: **28/28** pruebas de Firestore Rules aprobadas.

## Archivos de esta fase

- `worker/src/index.ts`
- `worker/tests/admin.test.ts`
- `src/services/workerApi.ts`
- `Caddyfile`
- `docs/FASE_3_FORTALECIMIENTO_TECNICO.md`

## Riesgos y pendientes reales

- Las pruebas de Firestore Rules deben ejecutarse en CI o en una máquina con emulador Java funcional.
- El workflow `Validación` ejecuta las Rules en `pull_request` y `push` a `main`, y ahora instala explícitamente Temurin 21. Falta habilitar en GitHub la protección de `main` que exija el check `Validación / frontend`: el remoto configurado no es accesible desde esta copia, por lo que no fue posible verificar ni modificar esa política.
- La creación concurrente de un mismo candidato o grupo entre múltiples pestañas depende de la semántica de escritura de Firestore REST; para garantía transaccional absoluta requeriría una operación transaccional adicional.
- Vite mantiene una advertencia de tamaño para el bundle de Firebase; no bloquea compilación ni ejecución.
