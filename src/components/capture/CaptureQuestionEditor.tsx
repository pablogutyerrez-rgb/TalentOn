import React,{useState} from 'react';
import {questionTypes,protectedQuestions,sensitiveQuestionIds,type FormQuestion,type QuestionType} from '../../../shared/captureFormSchema';
export function CaptureQuestionEditor({questions,onChange}:{questions:FormQuestion[];onChange:(questions:FormQuestion[])=>void}){
  const control='mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm';
  const [opened,setOpened]=useState(''),[search,setSearch]=useState('');
  const update=(index:number,patch:Partial<FormQuestion>)=>onChange(questions.map((q,i)=>i===index?{...q,...patch}:q));
  const move=(index:number,offset:number)=>{const next=[...questions];[next[index],next[index+offset]]=[next[index+offset],next[index]];onChange(next);};
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Preguntas ({questions.length})</h2><input aria-label="Buscar pregunta" placeholder="Buscar pregunta…" className="rounded-lg border border-slate-200 p-2 text-sm" value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <p className="text-sm text-slate-500">Abre una pregunta para editarla. Elige el tipo de respuesta y si es obligatoria. Las reglas adicionales están en Opciones avanzadas.</p>
    {questions.map((q,index)=>{
      const conditionOptions=questions.find(p=>p.id===q.condition?.field)?.options;
      const locked=protectedQuestions.includes(q.id),equipment=['computer','usbHeadset','internet'].includes(q.id),inclusion=q.id==='conadis',sensitive=sensitiveQuestionIds.includes(q.id as typeof sensitiveQuestionIds[number]);
      if(!q.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()))return null;
      return <details key={q.id} open={opened===q.id} className="rounded-lg border border-slate-200 bg-white p-3">
        <summary onClick={e=>{e.preventDefault();setOpened(opened===q.id?'':q.id);}} className="cursor-pointer text-sm font-semibold">{index+1}. {q.label.replace(/^\d+\.\s*/,'')} <span className="font-normal text-slate-500">· {questionTypes[q.type]} · {q.required?'Obligatoria':'Opcional'}</span></summary>
        <div className="mt-3 space-y-3">
          <label className="block text-sm">Pregunta<input className={control} maxLength={240} value={q.label} onChange={e=>update(index,{label:e.target.value})}/></label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">Tipo de respuesta<select className={control} disabled={locked||inclusion} value={q.type} onChange={e=>{
              const type=e.target.value as QuestionType;
              update(index,{type,options:['single','multiple','select'].includes(type)?q.options||[{value:'Sí',label:'Sí'},{value:'No',label:'No'}]:undefined,min:undefined,max:undefined,maxLength:undefined});
            }}>{Object.entries(questionTypes).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <label className="text-sm"><input type="checkbox" disabled={locked||sensitive} checked={q.required} onChange={e=>update(index,{required:e.target.checked})}/> Obligatoria{sensitive&&<span className="ml-2 text-xs text-slate-500">Divulgación voluntaria</span>}</label>
          {q.options&&(locked?<p className="text-xs text-slate-500">Las opciones se completan desde Datos de la campaña; el tipo de documento pertenece al sistema.</p>:<div className="space-y-2"><p className="text-sm font-medium">Alternativas de respuesta</p>{q.options.map((option,i)=><div key={i} className="flex gap-2"><input aria-label={`Alternativa ${i+1}`} className={control} disabled={inclusion} value={option.label} onChange={e=>update(index,{options:q.options!.map((o,j)=>j===i?{...o,label:e.target.value}:o)})}/><button type="button" aria-label={`Quitar alternativa ${i+1}`} disabled={inclusion} className="rounded border px-3" onClick={()=>update(index,{options:q.options!.filter((_,j)=>j!==i)})}>Quitar</button></div>)}{!inclusion&&<button type="button" className="rounded border px-3 py-1 text-sm" onClick={()=>update(index,{options:[...q.options!,{value:'option_'+crypto.randomUUID().slice(0,8),label:'Nueva opción'}]})}>+ Agregar alternativa</button>}</div>)}
          <details className="rounded-lg bg-slate-50 p-3"><summary className="cursor-pointer text-sm">Opciones avanzadas: sección, ayuda y condiciones</summary><div className="mt-3 space-y-3">
          <label className="block text-sm">Sección<input className={control} maxLength={100} value={q.section} onChange={e=>update(index,{section:e.target.value})}/></label>
          <label className="block text-sm">Texto de ayuda<input className={control} maxLength={500} value={q.hint||''} onChange={e=>update(index,{hint:e.target.value})}/></label>
          {q.type==='number'&&!locked&&<div className="grid grid-cols-2 gap-3">{(['min','max'] as const).map(key=><label key={key} className="text-sm">{key==='min'?'Mínimo':'Máximo'}<input className={control} type="number" value={q[key]??''} onChange={e=>update(index,{[key]:e.target.value===''?undefined:Number(e.target.value)})}/></label>)}</div>}
          {['short','long'].includes(q.type)&&<label className="block text-sm">Máximo de caracteres<input className={control} type="number" min={1} max={4000} value={q.maxLength??(q.type==='long'?4000:240)} onChange={e=>update(index,{maxLength:Number(e.target.value)})}/></label>}
          {!locked&&<div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">Mostrar cuando<select disabled={equipment||q.id==='disabilityDetails'} className={control} value={q.condition?.field||''} onChange={e=>update(index,{condition:e.target.value?{field:e.target.value,operator:'equals',value:''}:undefined})}><option value="">Siempre</option>{questions.slice(0,index).filter(p=>p.type!=='file').map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
            {q.condition&&<><label className="text-sm">Condición<select disabled={equipment||q.id==='disabilityDetails'} className={control} value={q.condition.operator} onChange={e=>update(index,{condition:{...q.condition!,operator:e.target.value as 'equals'|'notEquals'|'includes'}})}><option value="equals">Es igual a</option><option value="notEquals">Es diferente de</option><option value="includes">Incluye (múltiple)</option></select></label><label className="text-sm">Respuesta esperada{conditionOptions?<select disabled={equipment||q.id==='disabilityDetails'} className={control} value={q.condition.value} onChange={e=>update(index,{condition:{...q.condition!,value:e.target.value}})}><option value="">Selecciona una respuesta</option>{conditionOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<input disabled={equipment||q.id==='disabilityDetails'} className={control} maxLength={160} value={q.condition.value} onChange={e=>update(index,{condition:{...q.condition!,value:e.target.value}})}/>}</label></>}
          </div>}
          </div></details>
          <div className="flex flex-wrap gap-2"><button type="button" disabled={index===0} className="rounded border px-3 py-1 disabled:opacity-40" onClick={()=>move(index,-1)}>Subir</button><button type="button" disabled={index===questions.length-1} className="rounded border px-3 py-1 disabled:opacity-40" onClick={()=>move(index,1)}>Bajar</button><button type="button" disabled={locked} className="rounded border px-3 py-1 disabled:opacity-40" onClick={()=>{if(window.confirm('¿Quitar esta pregunta del borrador? Los registros anteriores se conservan.'))onChange(questions.filter((_,i)=>i!==index));}}>Quitar pregunta</button></div>
        </div>
      </details>;
    })}
    <button type="button" disabled={questions.length>=60} className="rounded-lg bg-[#143A56] px-4 py-2 text-sm text-white" onClick={()=>{const id='q_'+crypto.randomUUID().replaceAll('-','');setSearch('');setOpened(id);onChange([...questions,{id,label:'Nueva pregunta',section:'Información adicional',type:'short',required:false}]);}}>+ Agregar pregunta</button>
  </div>;
}
