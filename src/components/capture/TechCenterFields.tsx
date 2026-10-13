import React from 'react';
import { companySections, optionLabel, optionValue, type CaptureCampaignOption } from '../../../shared/techCenterForm';

export function TechCenterFields({ values, onChange, companyName, campaigns }: { values: Record<string, string>; onChange: (key: string, value: string) => void; companyName:string; campaigns:CaptureCampaignOption[] }) {
  const control = 'mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100';
  return <>{companySections(companyName,campaigns).filter(section => !section.when || section.when(values)).map(section =>
    <fieldset key={section.title} className="space-y-5 border-t border-slate-200 pt-5">
      <legend className="px-1 text-sm font-bold text-[#143A56]">{section.title}</legend>
      {section.hint && <p className="text-sm italic text-slate-500">{section.hint}</p>}
      {section.fields.filter(field => !field.when || field.when(values)).map(field => <label key={field.key} className="block text-sm font-semibold text-slate-700">
        {field.label}{field.required && ' (*)'}
        {field.options ? <select className={control} required={field.required} value={values[field.key] || ''} onChange={e => onChange(field.key, e.target.value)}>
          <option value="">Selecciona una opción</option>{field.options.map(option => <option key={optionValue(option)} value={optionValue(option)}>{optionLabel(option)}</option>)}
        </select> : field.type === 'textarea' ? <textarea className={control} rows={3} required={field.required} maxLength={field.max} value={values[field.key] || ''} onChange={e => onChange(field.key, e.target.value)} />
          : <input className={control} type={field.type || 'text'} required={field.required} maxLength={field.max} value={values[field.key] || ''} onChange={e => onChange(field.key, e.target.value)} />}
        {field.hint && <span className="mt-1 block text-xs font-normal text-slate-500">{field.hint}</span>}
      </label>)}
    </fieldset>)}</>;
}
