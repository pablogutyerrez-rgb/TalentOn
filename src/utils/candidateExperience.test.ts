import { describe, expect, it } from 'vitest';
import { formatCandidateExperience, hasExperienceAnswer } from './candidateExperience';

describe('experiencia declarada en captación', () => {
  it('muestra el texto del formulario predeterminado aunque no exista experienceMonths', () => {
    const answers = { contactCenterExperience: 'Sí', experienceDetails: '1 año en Migraciones Bitel' };
    expect(hasExperienceAnswer(answers)).toBe(true);
    expect(formatCandidateExperience(answers)).toBe('1 año en Migraciones Bitel');
  });

  it('conserva meses y campañas de formularios anteriores', () => {
    expect(formatCandidateExperience({ experienceMonths: '8', experienceDetails: 'Ventas y retenciones' }))
      .toBe('8 meses en contact center · Ventas y retenciones');
  });

  it('respeta la respuesta negativa y no inventa experiencia', () => {
    expect(formatCandidateExperience({ contactCenterExperience: 'No' }, 12))
      .toBe('Sin experiencia en contact center declarada');
    expect(formatCandidateExperience(undefined)).toBe('No informada');
  });
});
