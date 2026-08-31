# Bootstrap del primer SUPER_ADMIN

Ejecuta una sola vez desde `functions/`, con credenciales de Firebase Admin disponibles mediante `GOOGLE_APPLICATION_CREDENTIALS` (cuenta de servicio del proyecto):

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\segura\firebase-service-account.json"
npm run bootstrap:superadmin -- --username superadmin --password "cambia-esta-clave" --displayName "Super Administrador"
```

El script crea Firebase Auth con un identificador técnico interno y el documento `users/{uid}`. Solo solicita usuario, contraseña y nombre visible; no guarda la contraseña en Firestore ni expone el identificador técnico.

Después, configura el Worker desde `worker/`. No se despliegan Firebase Functions:

```powershell
cd ..\worker
npx wrangler secret put FIREBASE_CLIENT_EMAIL
npx wrangler secret put FIREBASE_PRIVATE_KEY
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put R2_BUCKET_NAME
npx wrangler secret put R2_ENDPOINT
npx wrangler deploy
cd ..
npx firebase deploy --only firestore:rules,firestore:indexes --project TU_PROJECT_ID
```
