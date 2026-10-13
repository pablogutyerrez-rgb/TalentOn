# Editor de formularios en Captación

Estado al 13/10/2026: migración 017 aplicada en producción con autorización del usuario. Respaldo privado de 83 tablas y restauración aislada verificados: `supabase/.local/multiempresa-backup-2026-10-13T18-34-44-120Z.json`. Históricos conservados; Auth/R2 sin modificaciones por la migración.

Worker publicado: `3c8b2dbc-bae7-4e5c-8d54-3fc5f4bf6380`. Consulta PostgreSQL de solo lectura con CA y hostname verificados: proyecto correcto, migración registrada y catálogo de 9 campañas disponible. No se crearon formularios ni postulaciones ficticias. El frontend se publica mediante el despliegue automático de Railway al subir este cambio a GitHub.

## Uso

Actualización de permisos 018 (13/10/2026): aplicada con respaldo privado de 84 tablas y restauración aislada verificada (`supabase/.local/multiempresa-backup-2026-10-13T19-01-45-859Z.json`). Typecheck, build, 140 pruebas Worker y cuatro suites SQL aprobados. Nuevas pruebas verifican lectura, borrador/publicación para ambos roles y rechazo de otra empresa/campaña, módulo revocado y administración de empresas. No se alteraron usuarios, formularios ni respuestas históricas.

**Selección → Captación → Formularios · Crear y editar**. Disponible para administrador global, Reclutador y Analista de Selección (estos dos requieren el módulo Selección habilitado). La migración 018 limita lectura, borrador y publicación a empresas/campañas autorizadas; no concede administración de empresas, usuarios ni catálogos. El formulario es compartido por campaña, no personal de cada reclutador; se conserva el control de versiones para evitar sobrescrituras.

1. Elegir empresa y campaña del catálogo real.
2. Completar edad mínima/máxima opcional, jornadas ofrecidas, horarios y modalidad.
3. Crear el formulario a partir de las 22 preguntas existentes; cambiar título, descripción, secciones, textos, ayudas, obligatoriedad, alternativas y orden; agregar o quitar preguntas.
4. Configurar condiciones contra preguntas anteriores: igual, diferente o incluye (selección múltiple).
5. Revisar **Vista previa**, **Guardar borrador** o **Crear y publicar formulario / Publicar cambios**.

Hay un formulario activo por empresa/campaña y un borrador independiente. Guardar borrador exige una definición válida pero no cambia el formulario público. Actualizar recarga la versión del servidor y permite resolver conflictos de edición.

Tipos: texto corto, texto largo, número, selección única, selección múltiple, desplegable, correo, teléfono, fecha y archivo. Campos adicionales admiten obligatorio/opcional. Identidad, campaña, edad y condiciones laborales mantienen tipos y validación obligatorios por contrato de registro. CONADIS sigue voluntario.

## Correcciones conservadas

- Edad numérica dentro del rango configurado.
- Full time / Semi full; Part time solo si está ofrecido.
- Horarios y modalidad exclusivos de la campaña.
- Experiencia en call center: Sí solicita meses de experiencia y campañas.
- PC/laptop, headset y conexión solo para modalidad remota; respuestas ocultas se descartan.
- CONADIS Sí/No. Pregunta 22 explica apoyos para entrevista/evaluación con ejemplos, sin solicitar diagnósticos.

## Servidor y datos

- /api/capture/forms GET/POST: sesión Supabase, roles autorizados y RPC service-only. Supabase verifica nuevamente rol, módulo, empresa y campaña; no confía en los IDs enviados por el cliente.
- Nueva tabla talent_org.capture_forms: borrador, versión publicada y versión de concurrencia. Publicación y condiciones se guardan en la misma transacción; conflicto de versión devuelve 409 sin sobrescribir.
- Formularios publicados se obtienen por empresa del enlace, nunca por empresa enviada por el navegador. Borradores no se exponen.
- Servidor valida tipos, alternativas, rangos, campos obligatorios y condiciones. Rechaza identificadores duplicados, ciclos y referencias inválidas.
- El evento conserva applicant.formSubmission con versión, textos de preguntas, respuestas tipadas y referencias privadas de adjuntos. Los formularios anteriores siguen usando techCenterAnswers sin migrar ni sobrescribir históricos.
- Un formulario modificado mientras estaba abierto requiere recargar; la versión enviada debe coincidir con la publicada.

## Adjuntos

Máximo tres campos de archivo por formulario; un archivo por campo, hasta 2 MB cada uno. Solo PDF/JPEG/PNG, comprobando MIME, extensión, tamaño y firma binaria. Máximo 7 MB por petición multipart; 128 KiB para respuestas/definición.

Se envían junto a la postulación; no existe un endpoint público de subida libre. Turnstile y límite de envíos existentes siguen activos. R2 almacena objetos privados bajo empresa/evento/pregunta. Descarga autenticada desde el expediente con verificación de alcance y Content-Disposition: attachment, nosniff, sin caché.

El wrapper transaccional elimina los objetos recién subidos si falla el guardado SQL. Reintentos exitosos no duplican eventos ni archivos. No hay antivirus integrado: validar firma no certifica ausencia de malware. Si falla también la eliminación de R2 por indisponibilidad, se requiere reconciliación de objetos; no se elimina ningún archivo histórico automáticamente.

## Verificación local

- Typecheck frontend y Worker.
- Build frontend.
- 139 pruebas Worker: incluye crear/editar borrador, publicar, conflictos CAS, permisos, empresa ajena, versiones públicas, selección múltiple, adjunto obligatorio, MIME falso, descarga privada, historial y compensación R2 ante fallo SQL.
- Render React de editor, formulario público y respuestas versionadas (npx tsx scripts/check-capture-form.tsx).
- Todas las migraciones y suites SQL en PostgreSQL 17 WASM aislado.
- No se ha validado todavía una sesión de navegador contra el editor desplegado ni concurrencia multisesión para la nueva RPC. No se crearon postulaciones de prueba en producción.

## Activación

Migración ejecutada con el script de respaldo/restauración (comando idempotente):

node --env-file=.env.local --env-file=.env.postgres.local scripts/apply-multiempresa.mjs --execute --capture-builder

Requiere PG_MODULE y CA oficial configurados; conservar TLS y validación de hostname. Luego publicar Worker y frontend coordinadamente. Las condiciones existentes se conservan y se usan como punto de partida; una campaña sin condiciones continúa sin aceptar postulaciones hasta configurarla. No hay cambios de Firebase/Auth, proveedor, navegación ajena ni datos históricos.
