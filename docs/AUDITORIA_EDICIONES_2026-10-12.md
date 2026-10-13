# Auditoría de ediciones

Revisión estática de los métodos de escritura del contexto, sus endpoints y el adaptador relacional; pruebas aisladas con PostgreSQL 17 y Auth/R2 simulados. No se modificaron datos reales. No equivale a ejecutar cada control del navegador en producción.

| Área | Cobertura verificada |
| --- | --- |
| Convocatorias | PATCH completo del formulario, PATCH parcial, conservación de responsables, cuotas, sueldo cero, fechas inválidas y ausencia de cambios tras rechazo |
| Candidatos / selección | Datos personales, entrevista, verificación, etapas, configuración de proceso y vinculación; aislamiento de empresa |
| Formación | Estado, horario, asignación y aislamiento del formador; asistencia por fecha, ventana de servidor y atomicidad masiva |
| Evaluaciones / OJT | Registro de notas y resultados, criterios de avance y bloqueo de alta sin requisitos |
| Documentos / Talento | Carga y validación de documentos, cuenta sueldo, datos laborales y contrato/estado |
| Administración | Creación, cambio obligatorio de contraseña, reset activo/inactivo, configuración y scopes |
| Concurrencia | Conflicto de revisión rechaza sobrescritura, sin reintentos automáticos de escrituras |

## Correcciones de esta revisión

- Validaciones de convocatorias antes de escribir: título, vacantes enteras, importes, fechas reales y orden inicio/fin. No se omiten las restricciones de cuotas.
- Mensajes específicos en lugar del genérico para cuota excedida, fechas, formato, referencias inválidas y restricciones SQL; nunca se devuelve el detalle SQL con datos internos.
- El formulario conserva sueldo cero y no lo sustituye por 1250.
- La promoción a apto devuelve la promesa; botones y selectores revisados muestran rechazos de etapa en lugar de errores asíncronos invisibles.
- Se amplió la regresión al payload completo del formulario, además del cambio de título ya probado.

## Límites y seguimiento

La captura no contiene el código de respuesta ni identifica el campo modificado. La causa exacta de ese intento no está demostrada: la edición completa funciona en las pruebas, pero las cuotas o una referencia inválida pueden impedir un caso concreto. Repetir con la versión actual y recoger el código mostrado si persiste. No afirmar que desapareció un fallo que no se reprodujo.

Notas/evaluaciones ya registradas, métricas diarias duplicadas, bajas y contratos firmados tienen restricciones de negocio e historial: no se habilitó sobrescritura libre. Diseñar una corrección auditada explícita si se necesita editar esos registros.

Pendiente E2E autenticado: recorrer todos los formularios y roles en Railway, incluidas sustitución de archivo y recuperación ante pérdida de red. Las pruebas existentes de servicios simulados no certifican todas las acciones reales.
