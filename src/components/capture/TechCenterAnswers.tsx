import React from 'react';
import { techCenterSections, optionLabel, optionValue, companyText } from '../../../shared/techCenterForm';

export function TechCenterAnswers({ answers, inline = false }: { answers?: Record<string, string>; inline?: boolean }) {
  if (!answers) return null;
  const fields = techCenterSections.flatMap(section => section.fields);
  const knownKeys = new Set(fields.map(field => field.key));
  const content = <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
    {answers.adult && <div><dt className="text-xs text-slate-500">4. ¿Tienes 18 años o más? (formulario anterior)</dt><dd>{answers.adult}</dd></div>}
    {fields.map(field => {
      const value = answers[field.key];
      if (!value) return null;
      const option = field.options?.find(item => optionValue(item) === value);
      const label=field.key==='experienceDetails'&&!answers.experienceMonths?'Experiencia: tiempo y campañas (formulario anterior)':field.label;
      return <div key={field.key}><dt className="text-xs text-slate-500">{companyText(label, answers.companyName || 'TECH CENTER')}</dt><dd className="whitespace-pre-wrap break-words">{option ? optionLabel(option) : value}</dd></div>;
    })}
    {Object.entries(answers).filter(([key, value]) => !knownKeys.has(key) && !['adult', 'companyName', 'preferredCampaignId'].includes(key) && value).map(([key, value]) =>
      <div key={key}><dt className="text-xs text-slate-500">{key.replace(/([a-z])([A-Z])/g, '$1 $2')}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd></div>)}</dl>;
  return inline ? <section className="mt-3 rounded-lg bg-slate-50 p-3"><h5 className="text-sm font-semibold text-[#143A56]">Respuestas del formulario {answers.companyName || 'de postulación'}</h5>{content}</section>
    : <details className="mt-3 rounded-lg bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-[#143A56]">Respuestas del formulario {answers.companyName || 'de postulación'}</summary>{content}</details>;
}
