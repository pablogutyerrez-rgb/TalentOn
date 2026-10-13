# Configuración del formulario por campaña

Actualización 13/10/2026: migración 016 aplicada en producción con autorización del usuario. Respaldo privado de 82 tablas y restauración aislada verificados (`supabase/.local/multiempresa-backup-2026-10-13T17-25-46-132Z.json`). Históricos, Auth y R2 conservados. Verificación local: 130 pruebas Worker, typecheck de ambos proyectos, build frontend y render del formulario correctos.

Worker publicado: `ec8406c8-78a6-4d5c-9fc7-365a4d4a81da`. Consulta PostgreSQL de solo lectura con CA y hostname verificados: migración registrada, catálogo administrativo disponible para las cuatro empresas (9 campañas; ninguna configurada aún).

## Administración

Administración → Configuración → Administración multiempresa → **Formulario de captación · Condiciones por campaña** (administrador global).

Seleccionar empresa y campaña activa; configurar edad mínima y máxima opcional, jornadas Full time/Semi full/Part time, horarios (uno por línea) y modalidad Presencial o Remota. Ninguna oferta ni rango se presupone. Part time aparece solamente si se habilita.

Las campañas sin configuración muestran un aviso y no admiten nuevas postulaciones con el nuevo formulario. Antes de activar el frontend/Worker se deben completar las condiciones reales. La configuración es independiente de las convocatorias operativas; aplica a los enlaces de esa campaña en esa empresa.

## Comportamiento

- Q4: edad numérica; límites validados por campaña en navegador y servidor.
- Q14/Q15/Q17: listas exclusivas de la campaña elegida; al cambiar de campaña se limpian jornada, horario, modalidad y equipos. La modalidad se selecciona automáticamente.
- Q9/Q10: experiencia en call center; respuesta Sí exige meses y campañas.
- Equipos: PC/laptop, headset (audífonos con micrófono) e internet se muestran solo para campañas remotas. Los campos ocultos se descartan en servidor.
- Q21: Sí/No, respuesta voluntaria. Q22: apoyo para entrevista/evaluación, con ejemplos accesibles y sin solicitar diagnósticos.
- Las respuestas anteriores (incluida edad Sí/No y modalidad Ambas) permanecen legibles. No se reescriben postulaciones, consentimientos ni perfiles; no hay aprobación/descarte automático por inclusión.
- API administrativa restringida a administrador global y RPC service-only. Escritura con control de versión, bloqueo transaccional y auditoría. El catálogo público solo expone campos necesarios y pertenece a la empresa del enlace, nunca a un companyId aportado por el navegador.

## Despliegue y configuración

1. Aplicar migración aditiva `202610130016_capture_campaign_settings.sql` mediante el ejecutor existente, con respaldo y ensayo de restauración:
   `node --env-file=.env.local --env-file=.env.postgres.local scripts/apply-multiempresa.mjs --execute --capture-settings`.
   Requiere `PG_MODULE` y CA PostgreSQL ya configurados. No desactivar TLS. Ejecutado y confirmado; el comando es idempotente.
2. Publicar Worker y frontend coordinadamente. **Pendiente operativo del administrador:** configurar las campañas antes de compartir los formularios. No se han cargado rangos ni horarios ficticios.
3. Verificar el formulario público con las opciones reales. Pruebas locales no equivalen a validación de producción.

## Verificación

- `npm run check`, `npm run build`.
- `npx tsx scripts/check-capture-form.tsx`: render real React, opciones/modalidades, preguntas condicionales y respuestas históricas.
- En worker: `npm run check`, `npm test`: validación de campos, aislamiento de catálogo, guardado PostgreSQL aislado, permisos, CAS y auditoría.
- `supabase/tests/run-embedded.mjs`: migraciones y suites SQL en PostgreSQL WASM aislado. No verifica concurrencia multisesión; eso corresponde al workflow PostgreSQL 17.
