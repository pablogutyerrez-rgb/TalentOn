import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TechCenterAnswers } from './TechCenterAnswers';
import { CaptureFormAnswers } from './CaptureFormAnswers';

describe('respuestas históricas del postulante', () => {
  it('muestra horario, experiencia y datos antiguos aunque las condiciones actuales sean distintas', () => {
    const html = renderToStaticMarkup(<TechCenterAnswers inline answers={{
      companyName: 'Techcenter', contactCenterExperience: 'No', experienceMonths: '8',
      experienceDetails: 'Migraciones Bitel', workday: 'Full time', availability: 'Turno tarde',
      previousSchedule: '13:00 a 21:00',
    }} />);
    expect(html).toContain('Turno tarde');
    expect(html).toContain('8');
    expect(html).toContain('Migraciones Bitel');
    expect(html).toContain('13:00 a 21:00');
  });

  it('presenta las preguntas y respuestas de un formulario versionado sin desplegables cerrados', () => {
    const html = renderToStaticMarkup(<CaptureFormAnswers eventId="captacion-1" inline submission={{
      revision: 2, title: 'Postulación', attachments: [],
      questions: [
        { id: 'availability', label: 'HORARIO DE TRABAJO', section: 'Disponibilidad', type: 'short', required: true },
        { id: 'experienceDetails', label: 'EXPERIENCIA', section: 'Experiencia', type: 'long', required: false },
      ],
      answers: { availability: 'Turno mañana', experienceDetails: 'Ventas durante 1 año' },
    }} />);
    expect(html).toContain('HORARIO DE TRABAJO');
    expect(html).toContain('Turno mañana');
    expect(html).toContain('Ventas durante 1 año');
    expect(html).not.toContain('<details');
  });
});
