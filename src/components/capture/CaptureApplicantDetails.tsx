import React from 'react';
import type { CaptureEvent } from '../../services/captureApi';
import { CaptureFormAnswers } from './CaptureFormAnswers';
import { TechCenterAnswers } from './TechCenterAnswers';

export function CaptureApplicantDetails({ event }: { event: CaptureEvent }) {
  const { applicant } = event;
  const identity = [
    ['Nombre declarado', applicant.fullName],
    ['Tipo de documento', applicant.documentType],
    ['Número de documento', applicant.documentNumber],
    ['Celular / WhatsApp', applicant.phone],
    ['Correo electrónico', applicant.email],
    ['Distrito declarado', applicant.district],
  ];
  return <div className="mt-3 space-y-3">
    <section className="rounded-lg border border-slate-200 p-3">
      <h5 className="text-sm font-semibold text-[#143A56]">Datos enviados en esta captación</h5>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">{identity.map(([label,value])=><div key={label}>
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="whitespace-pre-wrap break-words">{value||<span className="text-slate-500">Sin respuesta registrada</span>}</dd>
      </div>)}</dl>
    </section>
    {applicant.formSubmission
      ? <CaptureFormAnswers eventId={event.id} submission={applicant.formSubmission} inline />
      : applicant.techCenterAnswers
        ? <TechCenterAnswers answers={applicant.techCenterAnswers} inline />
        : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Este registro anterior no contiene respuestas de un cuestionario adicional.</p>}
  </div>;
}
