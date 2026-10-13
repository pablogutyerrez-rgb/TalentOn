import React from 'react';
import { visibleTechCenterFields, optionLabel, optionValue, companyText } from '../../../shared/techCenterForm';

export function TechCenterAnswers({ answers }: { answers?: Record<string, string> }) {
  if (!answers) return null;
  return <details className="mt-3 rounded-lg bg-slate-50 p-3">
    <summary className="cursor-pointer text-sm font-semibold text-[#143A56]">Respuestas del formulario {answers.companyName || 'TECH CENTER'}</summary>
    <dl className="mt-3 space-y-3 text-sm">
    {answers.adult && <div><dt className="text-xs text-slate-500">4. ¿Tienes 18 años o más? (formulario anterior)</dt><dd>{answers.adult}</dd></div>}
    {visibleTechCenterFields({...answers,modality:answers.modality==='Ambas modalidades'?'Remota':answers.modality}).map(field => {
      const value = answers[field.key];
      if (!value) return null;
      const option = field.options?.find(item => optionValue(item) === value);
      const label=field.key==='experienceDetails'&&!answers.experienceMonths?'Experiencia: tiempo y campañas (formulario anterior)':field.label;
      return <div key={field.key}><dt className="text-xs text-slate-500">{companyText(label, answers.companyName || 'TECH CENTER')}</dt><dd className="whitespace-pre-wrap break-words">{option ? optionLabel(option) : value}</dd></div>;
    })}</dl>
  </details>;
}
