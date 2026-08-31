# Firebase + R2: ejecución local

## 1. Firebase

Configura el proyecto existente en `.env.local`. Para emuladores, ejecuta:

```powershell
npm run emulators -- --project TU_FIREBASE_PROJECT_ID
```

La UI de emuladores queda disponible en `http://127.0.0.1:4000`.

## 2. R2

Para desarrollo del backend, copia `worker/.dev.vars.example` como `worker/.dev.vars` y completa las variables.

Para despliegue, registra cada valor como secreto de Cloudflare Worker:

```powershell
cd worker
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put R2_BUCKET_NAME
npx wrangler secret put R2_ENDPOINT
```

## 3. Pruebas

```powershell
npm run test:emulators -- --project TU_FIREBASE_PROJECT_ID
npm run lint
npm run build
cd worker
npm install
npm run check
```

## Modelo Firestore

Colecciones principales: `users`, `companies`, `campaigns`, `candidates`, `trainings`, `hiringProcesses`, `auditLogs`.

Subcolecciones: `candidates/{candidateId}/documents` y `trainings/{trainingId}/participants`.

Firestore crea físicamente cada colección con el primer documento; el Worker crea los documentos durante las operaciones autorizadas.
