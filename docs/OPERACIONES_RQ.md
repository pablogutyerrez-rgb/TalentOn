# Operaciones · RQ públicos

Migración `202610210001_operations_rq.sql` aplicada en Supabase el 21/10/2026. Worker desplegado en Cloudflare; la interfaz se publica desde GitHub/Railway.

## Activación controlada

1. Aplicar la migración SQL en el proyecto Supabase correcto y verificar que finalice sin errores.
2. Desplegar el Worker con `CAPTURE_HASH_SECRET`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY` y orígenes permitidos ya configurados. El desafío público usa la acción `operations`.
3. Desplegar la interfaz. No generar enlaces hasta comprobar ambos despliegues.
4. En Usuarios, completar el DNI de ocho dígitos de cada solicitante existente. Los nuevos usuarios requieren DNI; los anteriores siguen pudiendo iniciar sesión, pero no enviar RQ hasta completarlo.
5. En Operaciones, cargar al menos una gerencia por empresa y generar el enlace. Copiarlo al momento: en la base solo se guarda su hash. Revocar desde el mismo panel cuando corresponda.

El enlace fija la empresa. El solicitante selecciona empresa y gerencia, introduce DNI y resuelve Turnstile; el nombre completo se toma de su perfil activo con acceso a esa empresa. No se pide validación por correo ni teléfono. **DNI + enlace no prueban identidad**: una persona que conozca ambos podría suplantar al solicitante. El límite de intentos, el enlace revocable, la verificación anti-bot y la vigencia corta de la consulta reducen abuso, pero no eliminan ese riesgo.

Los RQ aparecen a Administrador, Jefe de Selección y Analistas de Selección con acceso a la empresa. La conversión abre el formulario de convocatoria existente. `sourceRqId` vincula el RQ con la nueva convocatoria en la misma transacción SQL; no se crea un segundo proceso de selección. Los RQ de staff usan el catálogo interno `staff-rq`, sin mostrar una campaña al solicitante.

## Perfiles de Operaciones

La migración posterior `202610210002_operations_roles.sql`, aplicada el 21/10/2026, agrega el módulo `OPERACIONES` y los perfiles Jefe y Coordinador de Operaciones. Administrador conserva su acceso. Ambos perfiles ven los RQ, configuran gerencias y administran enlaces únicamente en sus empresas autorizadas. No reciben campañas ni módulos de Selección, Formación, Talento, Analítica o Administración; la vinculación con convocatorias continúa reservada a Selección. Las cuentas y empresas se asignan desde Usuarios; la migración no crea cuentas ficticias.

## Verificación realizada

- `npm run check` y `npm run build` en la aplicación.
- `npm run check` y `npm test -- --maxWorkers=1` en `worker`.
- Pruebas SQL aisladas: alcance por empresa, lookup de DNI, envío idempotente, revocación de enlace y vínculo atómico con convocatoria.

La migración remota se aplicó atómicamente tras verificar TLS, proyecto y respaldo con restauración aislada. El Worker se desplegó y las pruebas locales pasaron (150/150). La activación de enlaces sigue requiriendo cargar DNI y gerencias reales.
