# Interfaz unificada por empresa

La plataforma no cambia de sesión ni de navegación al cambiar de empresa. La empresa
es un atributo obligatorio del registro operativo:

- Al crear una convocatoria o un enlace de captación se selecciona la empresa.
- Las pantallas de convocatorias, candidatos, formación y captación agregan los
  registros autorizados y muestran o filtran su empresa.
- Al editar un registro, el Worker resuelve su empresa en el servidor. El valor del
  navegador no puede trasladarlo a otra empresa.
- El rol, módulos y alcance se vuelven a validar dentro del contexto de esa empresa.

## Despliegue seguro

1. Aplicar la migración `202610160019_unified_record_context.sql` con el ejecutor
   existente. `PG_MODULE` debe apuntar al módulo local `pg`; las variables de
   Supabase y el certificado CA se cargan desde los archivos privados:
   `node --env-file=.env.local --env-file=.env.postgres.local scripts/apply-multiempresa.mjs --execute --unified`.
   El ejecutor realiza una copia recuperable y una prueba aislada antes de confirmar.
2. Desplegar el Worker. La migración debe ir antes que el frontend para que la API
   pueda resolver la empresa propietaria de cada registro.
3. Publicar el frontend con las variables `VITE_ADMIN_API_URL` o
   `VITE_WORKER_API_URL` ya configuradas.

No se modifican registros históricos, Firebase, Supabase Auth ni R2. Identificadores
de postulantes repetidos entre empresas se califican internamente en la vista unificada;
una URL antigua ambigua se rechaza antes de escribir.
