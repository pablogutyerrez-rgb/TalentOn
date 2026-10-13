# Contexto maestro — Talent-On

Nota vigente — 12 octubre 2026: las secciones siguientes conservan el contexto histórico de Firebase. La arquitectura activa ahora es Supabase Auth/PostgreSQL + Worker/R2, documentada en `SUPABASE_TRANSICION_OPERATIVA.md`; repositorio actual `pablogutyerrez-rgb/TalentOn` y frontend `https://talent-on.up.railway.app`. Firebase no debe reactivarse. Multiempresa: 007–010 aplicadas con respaldo restaurado en entorno aislado; 011 pendiente de confirmar y 012 pendiente de aplicar. Integración frontend/Worker implementada localmente; activación/publicación pendientes por restricciones del entorno. Consultar `SUPABASE_MULTIEMPRESA_EJECUCION.md` antes de desplegar.

Contexto histórico: 1 de octubre de 2026 (America/Lima).

## 1. Propósito

Talent-On es una plataforma web para gestionar el ciclo de talento:

- selección y reclutamiento;
- convocatorias, candidatos y ficha 360°;
- formación inicial y grupos de capacitación;
- asistencia, evaluaciones y OJT;
- pase a alta y contratación;
- analítica, configuración y administración de usuarios/RBAC.

El idioma funcional y de interfaz es español. La identidad visual usa Poppins, azul corporativo, superficies claras, verde/turquesa para estados positivos, naranja para alertas y rojo solo para errores o descarte.

## 2. Repositorio y ubicaciones

- GitHub: https://github.com/pablogutierrez-coder/talent-on
- Rama principal: `main`
- Carpeta local: `C:\Users\Pablo Enrique\Documents\Codex\2026-08-29\toma-este-proyecto-generado-en-ai\outputs\talentcc`
- Frontend productivo: https://talent-on-production.up.railway.app
- API Worker: https://talentcc-api.talentcc-techcenter.workers.dev
- Proyecto Firebase: `proyecto-de-prueba-b8928`
- Worker Cloudflare: `talentcc-api`
- Bucket R2 enlazado como `DOCUMENTS`: `techpeople`

Importante: el árbol local contiene cambios todavía no confirmados en Git. Antes de asumir que GitHub representa la última versión, ejecutar `git status`, revisar el diff, validar y hacer commit/push.

## 3. Arquitectura vigente

```text
React + Vite en Railway/Caddy
  ├── Firebase Authentication
  ├── Firestore (plan Spark)
  └── Cloudflare Worker TypeScript
       ├── verifica Firebase ID Tokens
       ├── aplica RBAC en servidor
       ├── usa APIs REST oficiales de Firebase/Google
       ├── actualiza Auth + Firestore
       └── almacena documentos en Cloudflare R2
```

No se deben reintroducir Cloud Functions para las operaciones administrativas ni ejecutar mutaciones privilegiadas desde React.

## 4. Tecnologías

- React 19 y TypeScript.
- Vite 6.
- Tailwind CSS 4.
- Firebase JS SDK 12: Auth, Firestore y App Check opcional.
- Recharts para gráficos.
- Cloudflare Workers + Wrangler 4.
- Cloudflare R2 para documentos.
- Railway + Docker + Caddy para el frontend.
- Vitest y Firebase Rules Unit Testing.
- Node.js 22 en CI.

## 5. Roles y alcance

Roles definidos:

- `ADMIN`
- `JEFE_SELECCION`
- `ANALISTA_SELECCION`
- `RECLUTADOR`
- `JEFE_FORMACION`
- `COORDINADOR_FORMACION`
- `FORMADOR`
- `JEFE_TALENTO`
- `ANALISTA_TALENTO`

Módulos habilitables:

- `SELECCION`
- `FORMACION`
- `TALENTO`
- `ANALITICA`
- `ADMINISTRACION`

Reglas principales de interfaz:

- Administración de usuarios y configuración: solo `ADMIN`.
- Convocatorias administrativas: Admin, Jefe y Analista de Selección.
- Mis convocatorias y candidatos: incluye Reclutador, respetando su alcance.
- Dashboard de Formación: Admin, Jefe, Coordinador y Formador; el Formador solo ve sus datos.
- Capacitaciones administrativas: Admin, Jefe y Coordinador de Formación.
- Mis Capacitaciones: Admin, Coordinador y Formador; el Formador solo ve grupos asignados.
- Contrataciones: Admin, Jefe y Analista de Talento.
- Analítica: Admin y jefaturas autorizadas.

La seguridad real debe aplicarse también en Firestore Rules y en el Worker. Nunca confiar únicamente en ocultar elementos de interfaz.

## 6. Módulos funcionales

### Selección

- Dashboard por rol.
- Convocatorias y responsables.
- Mis convocatorias para reclutadores.
- Directorio de candidatos.
- Registro de postulante.
- Ficha 360° con resumen, perfil, contactos, entrevista, verificación, evaluaciones y documentos.
- Pipeline y trazabilidad de etapas.

### Formación y OJT

- Dashboard de Jefe/Coordinador con métricas reales.
- Dashboard de Formador limitado por `formadorId/userId`.
- Capacitaciones: vista administrativa maestro-detalle.
- Asignación y reasignación de formadores.
- Mis Capacitaciones: listado de grupos propios y workspace de gestión.
- Asistencia por fecha con ventana temporal y solicitudes de desbloqueo.
- Evaluaciones, avance OJT, bajas y resultado final.
- Pase a alta sujeto a reglas de elegibilidad.

### Gestión de Talento

- Datos laborales.
- Estados de contratación.
- Generación, envío y firma de contrato.
- Cuenta sueldo, expediente documental y pase a alta.

### Administración y analítica

- Usuarios, roles, módulos, alcance y estado.
- Restablecimiento de contraseña.
- Configuración general persistida mediante Worker/Firestore.
- Indicadores y gráficos calculados con datos existentes; no usar cifras ficticias en producción.

## 7. API del Worker

El Worker concentra las mutaciones privilegiadas. Principales familias de endpoints:

- `/api/users`: creación, acceso, estado, roles y contraseña.
- `/api/settings`: lectura y actualización de configuración.
- `/api/campaigns`: creación, edición, estado, responsables y fuentes.
- `/api/candidates`: creación, datos personales, etapas, contactos, evaluaciones, observaciones, expediente y documentos.
- `/api/trainings`: creación desde selección, gestión, formador, asistencia, desbloqueos, participantes, evaluaciones, OJT y bajas.
- `/api/talent/candidates`: datos laborales, contratación, contrato y firma.
- `/health`: disponibilidad del Worker.

Todos los endpoints administrativos deben:

1. validar origen CORS;
2. verificar el Firebase ID Token;
3. cargar el perfil del actor desde Firestore;
4. validar estado, rol, empresa y alcance en servidor;
5. validar el cuerpo de entrada;
6. registrar auditoría cuando corresponda.

## 8. Variables y secretos

Variables públicas del frontend:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_APP_CHECK_SITE_KEY=
VITE_USE_FIREBASE_EMULATORS=false
VITE_ADMIN_API_URL=
VITE_WORKER_API_URL=
```

Secretos exclusivos del Worker:

- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Los valores sensibles nunca deben copiarse a un chat, commit, ZIP compartido, `wrangler.toml` ni variable `VITE_*`. Usar Cloudflare Secrets y variables privadas del proveedor correspondiente.

## 9. Comandos habituales

Frontend:

```powershell
npm ci
npm run dev
npm run check
npm run build
npm run test:emulators
```

Worker:

```powershell
cd worker
npm ci
npm run check
npm test
npx wrangler deploy --dry-run
npm run deploy
```

## 10. Validación conocida

En la última validación completa registrada:

- TypeScript frontend: correcto.
- Build frontend: correcto.
- Worker TypeScript: correcto.
- Pruebas Worker: 14/14 correctas.
- Dry-run de Wrangler: correcto.
- Auditoría npm frontend y Worker: 0 vulnerabilidades conocidas.
- Railway y Worker productivos: accesibles.
- CORS productivo y rechazo sin autenticación: correctos.
- No se encontraron escrituras administrativas directas desde React ni llamadas antiguas a `httpsCallable`.

Observaciones:

- El bundle de Firebase genera una advertencia de tamaño, no un error funcional.
- En Windows, el emulador local de Firestore llegó a fallar por `Unable to establish loopback connection` del runtime Java. Las pruebas están configuradas también en CI; no confundir este fallo del entorno con un fallo de reglas.
- El servidor local no necesariamente permanece encendido entre sesiones.

## 11. Cambios locales pendientes al crear este documento

Los siguientes archivos aparecían modificados y deben revisarse antes de publicar:

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

Estos cambios incluyen configuración persistente, analítica con datos reales, descarga documental, mejoras de pruebas/CI y actualización de Wrangler. Revisar el diff; no descartarlos ni sobrescribirlos accidentalmente.

## 12. Restricciones permanentes del producto

- No alterar login, sidebar, rutas, Firebase, permisos o modelos de datos salvo solicitud explícita y justificación técnica.
- Mantener Poppins y el sistema visual Talent-On.
- No hardcodear métricas o registros de demostración en producción.
- Mantener el aislamiento por rol, empresa, campaña, responsable y formador.
- No mostrar datos de otros formadores a un `FORMADOR`.
- No exponer cuentas de servicio, claves privadas ni secretos.
- No degradar operaciones administrativas a llamadas directas desde el navegador.
- Preservar contratos existentes de entrada/salida al modificar el Worker.
- Antes de cerrar un cambio: ejecutar typecheck, build y pruebas pertinentes.

## 13. Archivos clave para comprender el sistema

- `README.md`: instalación y despliegue.
- `src/App.tsx`: vistas y acceso por rol.
- `src/types.ts`: dominio y contratos TypeScript.
- `src/context/TalentContext.tsx`: estado, lecturas y cliente del Worker.
- `src/components/layout/Sidebar.tsx`: navegación por módulos.
- `worker/src/index.ts`: API, autenticación, RBAC y reglas de negocio del servidor.
- `worker/tests/admin.test.ts`: pruebas de la API.
- `firestore.rules`: seguridad de Firestore.
- `tests/rules/firestore.rules.test.ts`: pruebas de reglas.
- `.github/workflows/ci.yml`: validación continua.
- `docs/firebase-setup.md`: configuración Firebase.
- `docs/cloudflare-r2.md`: almacenamiento documental.
- `docs/bootstrap-superadmin.md`: creación inicial del administrador.

## 14. Protocolo recomendado para futuras sesiones

1. Leer este documento y `README.md`.
2. Ejecutar `git status --short` y no pisar cambios existentes.
3. Verificar la solicitud contra roles, alcance y seguridad del servidor.
4. Inspeccionar el flujo actual antes de modificarlo.
5. Cambiar únicamente el módulo solicitado.
6. Usar datos reales o estados vacíos; no inventar información.
7. Ejecutar validaciones proporcionales al cambio.
8. Informar archivos modificados, pruebas ejecutadas y cualquier limitación real.

