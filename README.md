# Talent-On

Plataforma web de selección, formación, OJT y gestión de talento. El frontend usa React + Vite, Firebase Authentication/Firestore y una API administrativa desplegada en Cloudflare Workers.

## Desarrollo local

Requisitos: Node.js 22 y npm.

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Complete `.env.local` con la configuración web de Firebase y la URL pública del Worker. Los archivos `.env.local`, `.dev.vars`, credenciales de servicio, claves privadas y secretos R2 están excluidos de Git.

Validaciones locales:

```powershell
npm run check
npm run build
```

## Publicación del frontend en Railway

Railway detecta automáticamente el `Dockerfile`. La compilación genera `dist/` y Caddy sirve la SPA con fallback a `index.html`, compresión y un endpoint de salud en `/health`.

1. En Railway elija **New Project → Deploy from GitHub repo** y seleccione este repositorio.
2. En el servicio abra **Variables** y registre las variables públicas de compilación:

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
VITE_ADMIN_API_URL=https://<worker>.workers.dev
VITE_WORKER_API_URL=https://<worker>.workers.dev
```

3. En **Settings → Networking**, genere el dominio público.
4. Configure `/health` como healthcheck del servicio.
5. Agregue el dominio final a los dominios autorizados de Firebase Authentication.
6. Configure ese origen exacto en `PRODUCTION_ORIGIN` del Cloudflare Worker y vuelva a desplegar el Worker. CORS no debe usar `*`.

Las variables con prefijo `VITE_` forman parte del bundle del navegador. Nunca coloque allí `FIREBASE_PRIVATE_KEY`, cuentas de servicio, claves R2 ni otros secretos.

## Cloudflare Worker

El backend administrativo permanece en [`worker/`](worker/README.md). Sus secretos se registran exclusivamente con Wrangler. Railway publica solo el frontend y no sustituye el Worker.

## Arquitectura

```text
Navegador (Railway/Caddy)
  ├─ Firebase Auth + Firestore (Spark)
  └─ Cloudflare Worker
       ├─ Firebase REST con cuenta de servicio
       └─ Cloudflare R2 para documentos
```
