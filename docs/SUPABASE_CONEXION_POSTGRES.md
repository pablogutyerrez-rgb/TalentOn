# Validación PostgreSQL — 12/10/2026

Consulta remota exclusivamente de lectura: correcta. Proyecto de SUPABASE_URL coincide con referencia del usuario PostgreSQL del pooler: gvwaqlvphvfzhnhlnuuv. Base postgres, PostgreSQL 17.11, transaction_read_only=on.

CA configurada en .env.postgres.local (ignorado por Git): certificado oficial prod-ca-2021.crt de Downloads. Validado como CA vigente. SHA256: 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA.

scripts/check-postgres.mjs exige certificado y hostname válidos, rejectUnauthorized=true, TLS cliente autorizado. No utiliza sslmode de la URL para sobrescribir controles. Resultado cliente→pooler: TLSv1.3 y authorized=true. pg_stat_ssl devolvió ssl=false para el tramo interno pooler→PostgreSQL: este diagnóstico no afirma TLS interno ni extremo a extremo; sí verifica el canal local hacia el pooler oficial.

No se ejecutaron migraciones, escrituras, creación de usuarios ni cambios de Firebase. Se hizo BEGIN READ ONLY, SELECT y ROLLBACK. La coincidencia del proyecto se verifica mediante host/usuario de enrutamiento, no leyendo datos de negocio.

Reproducción: con pg instalado en una carpeta temporal, configurar PG_MODULE con su ruta absoluta a lib/index.js y ejecutar desde la raíz:

```powershell
node --env-file=.env.local --env-file=.env.postgres.local scripts/check-postgres.mjs
```

PG_MODULE permite usar el cliente instalado para diagnóstico sin añadir dependencias al frontend. No se ha configurado un proveedor PostgreSQL operativo de Talent-On: la aplicación sigue utilizando Firebase.
