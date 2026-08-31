# Talent-On API en Cloudflare Workers

Firebase permanece en Spark para Authentication y Firestore. Las operaciones administrativas de usuarios se ejecutan exclusivamente en este Worker mediante las APIs REST oficiales de Google; la cuenta de servicio y su clave privada nunca llegan al navegador.

## Contrato administrativo

- `POST /api/users` — equivalente a `provisionUser`.
- `PATCH /api/users/:uid/access` — equivalente a `updateUserAccess`.
- `POST /api/users/:uid/reset-password` — equivalente a `resetUserPassword`.

Los tres endpoints exigen un Firebase ID Token válido y un perfil activo `users/{uid}` con rol `ADMIN`. La identidad, rol y empresa del actor se leen en el servidor: nunca se aceptan desde el body como autorización. Las operaciones actualizan Firebase Authentication, el documento `users/{uid}` y `auditLogs` igual que las Functions originales.

## Configuración

Variables no secretas en `wrangler.toml`:

- `FIREBASE_PROJECT_ID`: ID del proyecto Firebase.
- `ALLOWED_ORIGIN`: orígenes locales permitidos, separados por coma.
- `PRODUCTION_ORIGIN`: origen web de producción; no use `*`.

Secrets obligatorios para Administración:

- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Los secrets `R2_*` y el binding `DOCUMENTS` pertenecen a los endpoints documentales ya existentes; no son utilizados por las tres operaciones administrativas.

En el frontend configure la URL pública sin secretos:

```env
VITE_ADMIN_API_URL=https://talentcc-api.<tu-subdominio>.workers.dev
```

## Desarrollo local

```powershell
cd worker
npm install
Copy-Item .dev.vars.example .dev.vars
npm run dev
```

Complete `.dev.vars` localmente y no lo suba al repositorio. El origen del frontend local debe estar incluido en `ALLOWED_ORIGIN`.

## Registrar secrets y desplegar

```powershell
cd worker
npx wrangler login
npx wrangler secret put FIREBASE_CLIENT_EMAIL
npx wrangler secret put FIREBASE_PRIVATE_KEY
npm run check
npx wrangler deploy --dry-run
npm run deploy
```

Pegue cada valor únicamente cuando Wrangler lo solicite. No lo escriba en el comando, `wrangler.toml`, `.env` ni archivos de React/Vite.

La cuenta de servicio debe pertenecer al mismo proyecto de `FIREBASE_PROJECT_ID` y contar con permisos para administrar Firebase Authentication y leer/escribir Firestore. No es necesario habilitar Blaze ni desplegar las tres Cloud Functions anteriores.
