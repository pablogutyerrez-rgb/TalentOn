import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TechCenterAnswers } from './TechCenterAnswers';
import { CaptureFormAnswers } from './CaptureFormAnswers';
import { CaptureApplicantDetails } from './CaptureApplicantDetails';

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
    expect(html).toContain('Sin respuesta registrada');
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

  it('muestra todas las preguntas visibles, incluidas las opcionales vacías, las respuestas antiguas y los adjuntos', () => {
    const html = renderToStaticMarkup(<CaptureFormAnswers eventId="captacion-2" inline submission={{
      revision: 3, title: 'Postulación completa',
      questions: [
        { id: 'experienceDetails', label: 'EXPERIENCIA', section: 'Perfil', type: 'long', required: false },
        { id: 'availability', label: 'HORARIO', section: 'Disponibilidad', type: 'short', required: true },
        { id: 'cvFile', label: 'CV', section: 'Adjuntos', type: 'file', required: false },
      ],
      answers: { experienceDetails: 'Ventas por dos años', availability: 'Turno tarde', oldQuestion: 'Respuesta histórica' },
      attachments: [{ id: 'cvFile', name: 'cv.pdf', size: 1024 }, { id: 'legacyFile', name: 'certificado.pdf', size: 2048 }],
    }} />);
    for (const value of ['EXPERIENCIA', 'Ventas por dos años', 'HORARIO', 'Turno tarde', 'Respuesta histórica', 'cv.pdf', 'certificado.pdf']) expect(html).toContain(value);
    const empty = renderToStaticMarkup(<CaptureFormAnswers eventId="captacion-3" inline submission={{
      revision: 1, title: 'Postulación', questions: [{ id: 'optional', label: 'OBSERVACIONES', section: 'Otros', type: 'long', required: false }], answers: {}, attachments: [],
    }} />);
    expect(empty).toContain('OBSERVACIONES');
    expect(empty).toContain('Sin respuesta');
  });

  it('incluye los datos de identidad y contacto de cada envío junto a todas sus respuestas', () => {
    const html = renderToStaticMarkup(<CaptureApplicantDetails event={{
      id: 'captacion-4', candidateId: 'candidate-1', ownerUid: 'recruiter-1', source: 'Facebook', status: 'Nuevo', createdAt: '2026-10-27T10:00:00Z', conflict: false, history: [],
      applicant: { fullName: 'Ana Prueba', documentType: 'DNI', documentNumber: '12345678', phone: '912345678', email: 'ana@example.com', district: 'Lima', techCenterAnswers: { experienceDetails: 'Campaña de ventas', availability: 'Turno mañana', preferredCampaignId: 'campaign-1' } },
    }} />);
    for (const value of ['Ana Prueba', '12345678', '912345678', 'ana@example.com', 'Lima', 'Campaña de ventas', 'Turno mañana', 'campaign-1']) expect(html).toContain(value);
  });
});
