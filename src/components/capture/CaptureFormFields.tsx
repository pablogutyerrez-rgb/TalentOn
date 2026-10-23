import React from 'react';
import {visibleQuestions,type FormAnswers,type FormQuestion} from '../../../shared/captureFormSchema';
export function CaptureFormFields({questions,values,onChange,onFile,uploadedFiles,preview=false,hideCampaign=false,showQuestion}:{key?:string;questions:FormQuestion[];values:FormAnswers;onChange:(key:string,value:string|string[])=>void;onFile?:(key:string,file:File|undefined)=>void;uploadedFiles?:Record<string,File>;preview?:boolean;hideCampaign?:boolean;showQuestion?:(question:FormQuestion)=>boolean}){
  const control='mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-[#143A56] outline-none transition-colors focus:border-sky-600 focus:ring-2 focus:ring-sky-100 user-invalid:border-red-400';
  const visible=visibleQuestions(questions,values).filter(q=>(!hideCampaign||q.id!=='preferredCampaign')&&(!showQuestion||showQuestion(q)));
  return <div className="grid gap-5 md:grid-cols-2">{visible.map((q,index)=>{
    const id='capture-'+q.id, value=values[q.id], text=typeof value==='string'?value:'';
    const hint=q.hint|| (q.type==='file'?'PDF, JPG o PNG. Máximo 2 MB. El archivo será privado.':'');
    return <React.Fragment key={q.id}>
      {(index===0||visible[index-1].section!==q.section)&&<h3 className="md:col-span-2 border-t border-slate-200 pt-5 text-sm font-bold text-[#143A56]">{q.section}</h3>}
      <div className={`text-sm ${q.type==='long'||q.type==='file'||q.type==='multiple'?'md:col-span-2':''}`}>
        {q.type==='single'||q.type==='multiple'?<fieldset aria-describedby={hint?id+'-hint':undefined}>
          <legend className="font-semibold">{q.label}{q.required?' (*)':' (Opcional)'}</legend>
          <div className="mt-2 flex flex-wrap gap-3">{q.options?.map(o=><label key={o.value} className="flex items-center gap-2">
            <input type={q.type==='single'?'radio':'checkbox'} name={id} value={o.value}
              required={!preview&&q.required&&(q.type==='single'||!(Array.isArray(value)&&value.length))}
              checked={q.type==='single'?value===o.value:Array.isArray(value)&&value.includes(o.value)}
              onChange={e=>onChange(q.id,q.type==='single'?o.value:e.target.checked?[...(Array.isArray(value)?value:[]),o.value]:(Array.isArray(value)?value:[]).filter(x=>x!==o.value))}/>{o.label}
          </label>)}</div>
        </fieldset>:<>
          <label htmlFor={id} className="font-semibold">{q.label}{q.required?' (*)':' (Opcional)'}</label>
          {q.type==='select'?<select id={id} className={control} required={!preview&&q.required} value={text} onChange={e=>onChange(q.id,e.target.value)} aria-describedby={hint?id+'-hint':undefined}>
            <option value="">Selecciona una opción</option>{q.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>:q.type==='long'?<textarea id={id} rows={3} className={control} required={!preview&&q.required} maxLength={q.maxLength??4000} value={text} onChange={e=>onChange(q.id,e.target.value)}/>
          :q.type==='file'?<><input id={id} className={control} type="file" accept=".pdf,.jpg,.jpeg,.png" required={!preview&&q.required&&!uploadedFiles?.[q.id]} onChange={e=>{const file=e.target.files?.[0];if(file&&file.size>2*1024*1024)e.target.value='';onFile?.(q.id,file);}}/>{uploadedFiles?.[q.id]&&<p className="mt-1 text-xs text-emerald-700">Adjunto seleccionado: {uploadedFiles[q.id].name}</p>}</>
          :<input id={id} className={control} type={q.type==='short'?'text':q.type} required={!preview&&q.required} min={q.min} max={q.max} step={q.type==='number'?(['age','experienceMonths'].includes(q.id)?1:'any'):undefined} maxLength={q.maxLength??240} value={text} onChange={e=>onChange(q.id,e.target.value)}/>}
        </>}
        {hint&&<p id={id+'-hint'} className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
    </React.Fragment>;
  })}</div>;
}
