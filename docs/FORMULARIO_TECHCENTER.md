# Formulario TECH CENTER

Versión: techcenter-v1. Fecha: 13 de octubre de 2026.

- Se selecciona exclusivamente por companyId=techcenter del enlace guardado, no por parámetros manipulables del navegador.
- 22 preguntas del texto solicitado; experiencia y compromisos requieren detalle cuando corresponde. Herramientas se muestran para Remota y Ambas modalidades. Inclusión y adaptación son opcionales, sin decisiones automáticas de aptitud.
- Se omitieron los datos adicionales del responsable y el párrafo de información pendiente por instrucción expresa del usuario. Se conserva el aviso breve y la declaración de conocimiento. Esta implementación no certifica cumplimiento legal ni convierte dicha declaración en consentimiento para datos sensibles.
- Las respuestas permitidas se guardan en las anotaciones existentes de cada captación, con validación en servidor y lectura en el expediente. No se sobrescriben datos históricos ni se asigna automáticamente la campaña preferida.
- Declaración registrada como privacyAcknowledgement, con versión y fecha del servidor, no como consentimiento genérico. Las respuestas condicionales ocultas se descartan.
- Formularios de otras empresas y captaciones históricas conservan su comportamiento. Turnstile, límites, idempotencia y permisos siguen activos.

## Uso

Seleccionar TECH CENTER como empresa, abrir Captación y crear/copiar su enlace con una campaña autorizada. Un enlace anterior de Talent-On o Konectados no se transforma en un enlace de TECH CENTER.

Al verificar los enlaces activos existentes, solo se encontraron enlaces de Talent-On y Konectados; no se creó ningún enlace ni postulante ficticio en producción.

## Pruebas

- Frontend: typecheck y build correctos.
- Worker: typecheck y 124 pruebas correctas.
- PostgreSQL aislado: enlace TECH CENTER, selección automática del formulario, rechazo de formulario incompleto, envío válido, reintento sin duplicados, lectura de respuestas, conservación al cambiar estado y rechazo de otro tenant.
- Datos opcionales, condicionales, enums, límites de longitud, documento alternativo, declaración y compatibilidad del formulario genérico probados.
- Sin migraciones SQL necesarias.
