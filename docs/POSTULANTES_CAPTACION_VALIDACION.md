# Postulantes y captación — 13 de octubre de 2026

## Cambios

- Registrar postulante: modalidad (Remoto/Presencial) y horario/jornada (Fulltime/Semifull/Part). Opcionales para conservar compatibilidad con expedientes anteriores; no se infieren desde la convocatoria.
- Ficha 360, Datos personales: muestra ambas preferencias. El servidor valida las opciones al crear y al editar datos personales.
- Persistencia: usa las anotaciones existentes de `talent.persons`; no requiere migración ni cambios de datos históricos.
- El formulario público obtiene la clave **pública** Turnstile desde el GET de su enlace. Ya no depende de que Railway tenga esa variable incorporada durante el build. Conserva fallback VITE_TURNSTILE_SITE_KEY para Workers anteriores.
- Informa errores de carga/verificación y mantiene Enviar deshabilitado hasta recibir un desafío válido.

## Causa del bloqueo

Faltaban VITE_TURNSTILE_SITE_KEY en el frontend y TURNSTILE_SECRET_KEY en el Worker. Se creó el widget administrado “Talent-On Captacion” y se registró su secreto exclusivamente en Cloudflare Worker Secrets.

La clave pública TURNSTILE_SITE_KEY está en worker/wrangler.toml. Los dominios del widget son talent-on.up.railway.app, talent-on-production.up.railway.app, localhost y 127.0.0.1. CORS y validación servidor de hostname/acción se conservan.

Para futuros cambios: la clave pública y TURNSTILE_SECRET_KEY deben corresponder al mismo widget; registrar el secreto con `npx wrangler secret put TURNSTILE_SECRET_KEY` desde worker. No usar claves de prueba en producción ni prefijar el secreto con VITE_. CAPTURE_HASH_SECRET ya existente se conserva.

Referencia oficial: [administración de widgets Turnstile](https://developers.cloudflare.com/turnstile/get-started/widget-management/api/).

## Validación

- Frontend: typecheck y build correctos.
- Worker: typecheck y 118 pruebas correctas.
- PostgreSQL aislado: creación, lectura posterior, edición y rechazo de jornada inválida sin sobrescribir la preferencia anterior.
- Captación aislada: envío válido, idempotencia, permisos, límite de envíos, rechazo sin secretos/hostname inválido y metadatos sin exponer secretos.
- Worker publicado: 1cbdaf24-f489-4e0b-89be-0518dd164ea8. GET de un enlace activo real devuelve active=true, securityReady=true y la clave pública configurada.
- No se introdujeron postulantes ficticios en producción. La prueba de registro con una persona real corresponde al usuario.
