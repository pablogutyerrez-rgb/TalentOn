# Talent-On consolidado — 13 octubre 2026

## Uso

Con la cuenta administradora global, seleccionar **Talent-On · Consolidado** en la cabecera. Panel de Selección, Panel de Formación y Analítica muestran la medición conjunta de Talent Up, Techcenter y Konectados, con filtros por empresa, campaña y fechas; comparativo por empresa y totales. Cambiar a una empresa mantiene las vistas operativas habituales.

En **Administración → Usuarios & Permisos**, crear o editar incorpora **Empresas y permisos asignados**: una o varias empresas, rol por empresa y campañas explícitas o todas las de esa empresa. Formador requiere campañas y grupos asignados. El administrador global consulta las cuentas canónicas desde Talent-On y puede editar una cuenta de otra empresa, sin trasladarla.

## Cálculo

- Solo empresas del catálogo multiempresa. Registros históricos del contexto antiguo Talent-On permanecen intactos y no se atribuyen automáticamente a una empresa.
- Deserción sobre Día 1: inscripciones con ingreso Día 1 y al menos una deserción registrada / inscripciones con ingreso Día 1. El total divide sumas, no promedia porcentajes. Múltiples incidencias de una misma inscripción cuentan una vez. Sin denominador: «Sin base».
- Se informa también deserciones de todas las inscripciones, distinguiendo la base de la tasa.
- Fechas: formación usa inicio del grupo; postulaciones, fecha de postulación; altas, fecha oficial de ingreso. Convocatorias representa el catálogo filtrado, sin corte por fecha.
- Personas únicas se deduplican por identidad compartida cuando existe; sin vínculo se conserva la identidad empresarial. No se reclasifica información histórica.
- El endpoint devuelve agregados sin PII. Las vistas operativas conservan su aislamiento empresarial.

## Persistencia y permisos

013: RPC de dashboard, directorio global de cuentas, resolución de empresa de origen y transacción conjunta de perfil/accesos. Solo servicio y administrador global explícito; ADMIN empresarial no adquiere permiso global. Versiones originales del formulario y rollback completo SQL ante conflictos. Auth conserva alta/compensación y actualización diferida; no se afirma atomicidad distribuida PostgreSQL/Auth.

La marca `companyAccessManaged` retira a las cuentas configuradas por este formulario el acceso implícito a la empresa hogar histórica. La sesión elige una empresa asignada y rechaza la empresa hogar, una revocada o no asignada. Cuentas antiguas conservan su acceso hasta guardar asignaciones explícitas. Administrador global conserva su autorización global.

014: orden de creación para evitar que el trigger de membresía inserte módulos antes de que el lote de creación haga su escritura con control de versión. Sin mover ni eliminar registros históricos.

## Validación

114 pruebas: consolidado 2/4 = 50% (no promedio 66,67%); incidencias duplicadas; filtros; denegación de ADMIN no global; creación con dos empresas; revocación a una; denegación de tercera empresa y empresa hogar; rollback por versión obsoleta; creación empresarial y edición desde Talent-On. PostgreSQL embebido real, Auth/R2 dobles. Typechecks y build frontend verificados. Sin registros ficticios en producción.

Aplicación: `scripts/apply-multiempresa.mjs --execute --global` y `--user-order`, con CA/hostname verificados, backup privado y ensayo de restauración de 82 tablas antes de cada aplicación. Backups en `supabase/.local`, excluidos de Git.

Estado remoto: 013 y 014 aplicadas. Worker desplegado `15799f89-a0d3-47de-a61d-b1831aa5b482`. Consulta real de solo lectura verificó igualdad entre totales y suma por empresa; RPC PostgREST HTTP 200. Respaldo 013: `multiempresa-backup-2026-10-13T06-01-44-575Z.json`; respaldo 014: `multiempresa-backup-2026-10-13T06-04-52-347Z.json` (fechas UTC).
