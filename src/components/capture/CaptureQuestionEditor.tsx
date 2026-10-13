import React from 'react';
import {questionTypes,protectedQuestions,type FormQuestion,type QuestionType} from '../../../shared/captureFormSchema';
export function CaptureQuestionEditor({questions,onChange}:{questions:FormQuestion[];onChange:(questions:FormQuestion[])=>void}){
  const control='mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm';
  const update=(index:number,patch:Partial<FormQuestion>)=>onChange(questions.map((q,i)=>i===index?{...q,...patch}:q));
  const move=(index:number,offset:number)=>{const next=[...questions];[next[index],next[index+offset]]=[next[index+offset],next[index]];onChange(next);};
  return <div className="space-y-3">
    <p className="text-xs text-slate-500">Los campos de identidad y condiciones de campaña son obligatorios para conservar el registro. Los equipos dependen de modalidad Remota; CONADIS es voluntario. Las condiciones solo pueden referirse a preguntas anteriores.</p>
    {questions.map((q,index)=>{
      const locked=protectedQuestions.includes(q.id),equipment=['computer','usbHeadset','internet'].includes(q.id),inclusion=q.id==='conadis';
      return <details key={q.id} className="rounded-lg border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold">{index+1}. {q.label} <span className="font-normal text-slate-500">· {questionTypes[q.type]} · {q.required?'Obligatoria':'Opcional'}</span></summary>
        <div className="mt-3 space-y-3">
          <label className="block text-sm">Pregunta<input className={control} maxLength={240} value={q.label} onChange={e=>update(index,{label:e.target.value})}/></label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">Sección<input className={control} maxLength={100} value={q.section} onChange={e=>update(index,{section:e.target.value})}/></label>
            <label className="text-sm">Tipo de respuesta<select className={control} disabled={locked||inclusion} value={q.type} onChange={e=>{
              const type=e.target.value as QuestionType;
              update(index,{type,options:['single','multiple','select'].includes(type)?q.options||[{value:'Sí',label:'Sí'},{value:'No',label:'No'}]:undefined,min:undefined,max:undefined,maxLength:undefined});
            }}>{Object.entries(questionTypes).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <label className="block text-sm">Texto de ayuda<input className={control} maxLength={500} value={q.hint||''} onChange={e=>update(index,{hint:e.target.value})}/></label>
          <label className="text-sm"><input type="checkbox" disabled={locked||inclusion} checked={q.required} onChange={e=>update(index,{required:e.target.checked})}/> Obligatoria</label>
          {q.options&&(locked?<p className="text-xs text-slate-500">Las opciones de campaña se definen en las condiciones superiores; el tipo de documento pertenece al sistema.</p>:<label className="block text-sm">Alternativas (una por línea)<textarea className={control} rows={3} disabled={inclusion} value={q.options.map(o=>o.label).join('\n')} onChange={e=>update(index,{options:e.target.value.split('\n').map(label=>({value:label,label}))})}/></label>)}
          {q.type==='number'&&!locked&&<div className="grid grid-cols-2 gap-3">{(['min','max'] as const).map(key=><label key={key} className="text-sm">{key==='min'?'Mínimo':'Máximo'}<input className={control} type="number" value={q[key]??''} onChange={e=>update(index,{[key]:e.target.value===''?undefined:Number(e.target.value)})}/></label>)}</div>}
          {['short','long'].includes(q.type)&&<label className="block text-sm">Máximo de caracteres<input className={control} type="number" min={1} max={4000} value={q.maxLength??(q.type==='long'?4000:240)} onChange={e=>update(index,{maxLength:Number(e.target.value)})}/></label>}
          {!locked&&<div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">Mostrar cuando<select disabled={equipment} className={control} value={q.condition?.field||''} onChange={e=>update(index,{condition:e.target.value?{field:e.target.value,operator:'equals',value:''}:undefined})}><option value="">Siempre</option>{questions.slice(0,index).filter(p=>p.type!=='file').map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
            {q.condition&&<><label className="text-sm">Condición<select disabled={equipment} className={control} value={q.condition.operator} onChange={e=>update(index,{condition:{...q.condition!,operator:e.target.value as 'equals'|'notEquals'|'includes'}})}><option value="equals">Es igual a</option><option value="notEquals">Es diferente de</option><option value="includes">Incluye (múltiple)</option></select></label><label className="text-sm">Respuesta esperada<input disabled={equipment} className={control} maxLength={160} value={q.condition.value} onChange={e=>update(index,{condition:{...q.condition!,value:e.target.value}})}/></label></>}
          </div>}
          <div className="flex flex-wrap gap-2"><button type="button" disabled={index===0} className="rounded border px-3 py-1 disabled:opacity-40" onClick={()=>move(index,-1)}>Subir</button><button type="button" disabled={index===questions.length-1} className="rounded border px-3 py-1 disabled:opacity-40" onClick={()=>move(index,1)}>Bajar</button><button type="button" disabled={locked} className="rounded border px-3 py-1 disabled:opacity-40" onClick={()=>onChange(questions.filter((_,i)=>i!==index))}>Quitar pregunta</button></div>
        </div>
      </details>;
    })}
    <button type="button" disabled={questions.length>=60} className="rounded-lg bg-[#143A56] px-4 py-2 text-sm text-white" onClick={()=>onChange([...questions,{id:'q_'+crypto.randomUUID().replaceAll('-',''),label:'Nueva pregunta',section:'Información adicional',type:'short',required:false}])}>+ Agregar pregunta</button>
  </div>;
}
