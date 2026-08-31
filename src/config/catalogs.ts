import { DropoutCategory } from '../types';

export const DISCARD_REASONS = [
  'Perfil no se ajusta al perfil requerido', 'No cumple disponibilidad horaria de la campaña', 'Desiste por expectativas salariales',
  'Mala dicción o modulación verbal deficiente', 'No se presentó a la entrevista (NSP)', 'Falta de experiencia mínima requerida',
  'Velocidad de Internet insuficiente', 'Equipo no cumple requisitos mínimos', 'No cuenta con audífonos apropiados',
  'Ruido ambiental no controlado', 'Sistema operativo incompatible', 'Test psicotécnico desaprobado',
  'Velocidad de tipificación insuficiente', 'Simulación de atención desaprobada', 'Ortografía y redacción no apta',
  'Evaluación técnica desaprobada', 'Documentación obligatoria incompleta o adulterada', 'Antecedentes observados',
  'Registro duplicado en otra convocatoria activa', 'Renuncia voluntaria', 'Reingreso no apto según historial',
];
export const DOCUMENT_TYPES = ['DNI vigente', 'Certificado Único Laboral', 'Recibo de servicios', 'Constancia de cuenta bancaria o CCI', 'Currículum Vitae actualizado', 'Declaración jurada de domicilio y salud', 'Certificado de estudios'];
export const DROPOUT_CATEGORIES: { id: DropoutCategory; label: string; description: string }[] = [
  { id: 'PERSONAL', label: 'Personal o familiar', description: 'Salud, viajes o asuntos familiares' },
  { id: 'LABORAL', label: 'Laboral', description: 'Otra oferta o incompatibilidad horaria' },
  { id: 'EXPECTATIVAS_PUESTO', label: 'Expectativas del puesto', description: 'Perfil, salario, variable o modalidad' },
  { id: 'DIFICULTAD_CAPACITACION', label: 'Dificultad en capacitación', description: 'No alcanzó las notas requeridas' },
  { id: 'INASISTENCIA', label: 'Inasistencia o abandono', description: 'Faltas injustificadas o no se presentó' },
  { id: 'CONECTIVIDAD_EQUIPOS', label: 'Conectividad o equipos', description: 'Fallas técnicas o equipo insuficiente' },
  { id: 'OTRO', label: 'Otro motivo', description: 'Causa no tipificada' },
];
export const DROPOUT_REASONS = DROPOUT_CATEGORIES.map(item => item.label);
