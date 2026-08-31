# Cloudflare R2 privado

## Variables requeridas

Configúralas como secretos del Worker. Firebase Spark no utiliza Functions ni Secret Manager.

```env
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
```

## Bucket y CORS

El bucket debe ser privado. No habilites acceso público ni URL pública.

En Cloudflare R2 configura esta regla CORS:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3001", "https://TU-DOMINIO-PRODUCCION"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 300
  }
]
```

Sustituye `https://TU-DOMINIO-PRODUCCION` por el dominio final antes de producción; no uses `*`.

El Worker autoriza el acceso al bucket privado. Las rutas permitidas son:

```text
candidates/{candidateId}/documents/{documentType}/{uuid}-{filename}
contracts/{candidateId}/{uuid}-{filename}
```

No uses DNI, correo ni nombres personales en las rutas de R2.
