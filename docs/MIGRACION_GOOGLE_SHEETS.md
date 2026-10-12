# Preparación de migración a Google Drive y Google Sheets

## Decisión de seguridad

Google Sheets y Drive no se expondrán al navegador. Los usuarios seguirán siendo creados exclusivamente desde Talent-On, sin requerir una cuenta Google. El Cloudflare Worker reemplazará Firebase Authentication con inicio de sesión propio, sesiones `HttpOnly` firmadas y RBAC del lado servidor.

Las contraseñas nunca se guardarán en texto plano: el Worker almacenará únicamente un hash fuerte con salt individual. Los secretos de firma de sesión y la cuenta de servicio de Google vivirán solo como Cloudflare Worker Secrets.

## Alcance identificado

La base actual usa Firestore para `users`, `campaigns`, `candidates`, `trainings`, `hiringProcesses` y `auditLogs`; los documentos binarios están en R2. Las pestañas candidatas del libro son:

| Pestaña | Origen | Clave estable |
| --- | --- | --- |
| Usuarios | `users` | `uid` |
| Convocatorias | `campaigns` | `id` |
| Candidatos | `candidates` | `id` |
| Capacitaciones | `trainings` | `id` |
| Participantes capacitación | datos anidados de capacitación/candidato | `trainingId:candidateId` |
| Contrataciones | `hiringProcesses` | `id` |
| Auditoría | `auditLogs` | `id` |
| Metadatos | control de versión y migración | `entity:id` |

Las listas y objetos anidados se serializan como JSON controlado por el Worker; no se deben fragmentar en celdas ni usar el número de fila como identificador.

## Arquitectura objetivo

```text
React → Cloudflare Worker (login, sesión y RBAC) → Google Sheets API / Drive API
```

El Worker necesitará únicamente secretos privados:

- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY`
- `SESSION_SIGNING_SECRET`

El libro debe compartirse explícitamente con la cuenta de servicio y estar dentro de un Drive corporativo controlado. Ninguno de esos valores va en variables `VITE_*`, código fuente, commits ni navegador.

## Plan reversible

1. Definir propietario corporativo del libro, carpeta/Shared Drive y responsables de acceso.
2. Crear el libro y sus pestañas con las claves y encabezados anteriores.
3. Implementar en el Worker autenticación propia: hash de contraseña, bloqueo temporal por intentos, cookies `HttpOnly`/`Secure`, expiración de sesión y revocación mediante versión de sesión del usuario.
4. Implementar en el Worker un adaptador de Sheets con validación, control de versión y auditoría.
5. Migrar CV, contratos y documentos de R2 a la carpeta restringida de Google Drive, almacenando solo el `fileId` y metadatos en Sheets.
6. Ejecutar exportación de Firestore en modo solo lectura, generar conteos y hashes por entidad y cargar una copia inicial.
7. Verificar conteos, IDs, referencias, PII y permisos sin cambiar la fuente de verdad.
8. Activar escritura dual temporal: Firestore continúa como fuente de verdad y Sheets recibe réplica auditable.
9. Comparar cambios y corregir divergencias antes de un cambio de lectura.
10. Cambiar autenticación y lecturas gradualmente, mantener rollback a Firebase hasta una aceptación formal; solo entonces retirar Firebase.

## Restricciones operativas

- Sheets no ofrece las mismas transacciones, consultas, listeners en tiempo real ni Rules de Firestore.
- Las escrituras deben incluir `id`, `companyId`, `updatedAt`, `updatedBy` y una versión para detectar conflictos.
- El Worker debe limitar tamaño de fila, paginar listados y bloquear cambios concurrentes sobre la misma entidad.
- Los permisos del Drive deben ser más restrictivos que los de la aplicación; los usuarios finales no deben recibir acceso directo al libro.
- Los archivos CV, contratos y documentos se migran a Drive en una fase separada y verificable; el navegador los descarga siempre a través del Worker.

## Estado actual

No hay migración de datos ejecutada ni datos de Talent-On copiados. Firebase Auth, Firestore, Rules y el Worker existentes permanecen intactos hasta completar la migración reversible.

## Destinos verificados el 7 de octubre de 2026

- Libro recibido: `BBDD` (`1x3-attF4oY8NDbpLhPZVMmoVuSkMsro9YSgtANygYGQ`).
- Carpeta recibida: `C&M` (`1_63zwO_EWg3jFBKA7zIhlTuPrPKZOEd6`).
- Ambos están compartidos como **cualquiera con enlace: editor**. Esta configuración bloquea la migración de PII de Talent-On.
- El libro contiene pestañas de otra plataforma (`TEAMS`, `ADVISORS`, `EVALUATIONS`, `APP_STATE`, entre otras) y pestañas `*_conflict`; no es un espacio aislado para la plataforma.

Antes de cualquier escritura, el propietario debe retirar el permiso público de edición de libro y carpeta, y crear o autorizar un libro exclusivo de Talent-On dentro de una carpeta restringida. La cuenta de servicio del Worker recibirá acceso de editor; los usuarios de la aplicación no.

## Estructura preparada en los destinos recibidos

El 7 de octubre de 2026 se añadieron, sin modificar ninguna pestaña existente ni copiar datos personales, las pestañas vacías con encabezados versionados: `TO_METADATA`, `TO_USERS`, `TO_CAMPAIGNS`, `TO_CANDIDATES`, `TO_TRAININGS`, `TO_TRAINING_PARTICIPANTS`, `TO_HIRING_PROCESSES`, `TO_AUDIT_LOGS`, `TO_FILES` y `TO_SESSIONS`.

También se creó una carpeta vacía para futuros objetos: `Talent-On | Archivos (estructura vacía)` (`1pJpVocOvZ-LTWGeoS2hyBFMj0olwv6j4`) dentro de `C&M`.

Estas estructuras no son todavía una fuente de datos operativa. No se deben cargar usuarios, contraseñas, candidatos, CVs ni documentos hasta restringir el acceso de ambos destinos y configurar la cuenta de servicio del Worker.
