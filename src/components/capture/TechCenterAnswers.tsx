import React from 'react';
import { visibleTechCenterFields, optionLabel, optionValue } from '../../../shared/techCenterForm';

export function TechCenterAnswers({ answers }: { answers?: Record<string, string> }) {
  if (!answers) return null;
  return <details className="mt-3 rounded-lg bg-slate-50 p-3">
    <summary className="cursor-pointer text-sm font-semibold text-[#143A56]">Respuestas del formulario TECH CENTER</summary>
    <dl className="mt-3 space-y-3 text-sm">{visibleTechCenterFields(answers).map(field => {
      const value = answers[field.key];
      if (!value) return null;
      const option = field.options?.find(item => optionValue(item) === value);
      return <div key={field.key}><dt className="text-xs text-slate-500">{field.label}</dt><dd className="whitespace-pre-wrap break-words">{option ? optionLabel(option) : value}</dd></div>;
    })}</dl>
  </details>;
}
