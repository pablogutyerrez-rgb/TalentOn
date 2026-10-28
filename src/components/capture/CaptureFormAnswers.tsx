import React,{useState} from 'react';
import type {CaptureApplicant} from '../../services/captureApi';
export function CaptureFormAnswers({eventId,submission,inline=false}:{eventId:string;submission:NonNullable<CaptureApplicant['formSubmission']>;inline?:boolean}){
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const questions=submission.questions??[],answers=submission.answers??{},attachments=submission.attachments??[];
  const attachmentButton=(file:typeof attachments[number])=><button type="button" disabled={busy} className="underline" onClick={async()=>{
    setBusy(true);setError('');
    try{
      const {workerDownload}=await import('../../services/workerApi');
      const blob=await workerDownload('/api/capture/attachments/'+encodeURIComponent(eventId)+'/'+encodeURIComponent(file.id));
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
    }catch(e){const {getWorkerErrorMessage}=await import('../../services/workerApi');setError(getWorkerErrorMessage(e));}finally{setBusy(false);}
  }}>Descargar {file.name} ({Math.ceil(file.size/1024)} KB)</button>;
  const content = <>
    {error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    <dl className="mt-3 space-y-3 text-sm">{questions.map(q=>{
      const value=answers[q.id],file=attachments.find(f=>f.id===q.id);
      const label=(v:string)=>q.options?.find(o=>o.value===v)?.label||v;
      return <div key={q.id}><dt className="text-xs text-slate-500">{q.label}</dt><dd className="whitespace-pre-wrap break-words">
        {value!==undefined && value!=='' && <span>{Array.isArray(value)?value.map(label).join(', '):label(value)}</span>}
        {file && <span className="block">{attachmentButton(file)}</span>}
        {(value===undefined||value==='')&&!file&&<span className="text-slate-500">Sin respuesta</span>}
      </dd></div>;
    })}
    {Object.entries(answers).filter(([id])=>!questions.some(q=>q.id===id)).map(([id,value])=><div key={id}>
      <dt className="text-xs text-slate-500">{id.replace(/([a-z])([A-Z])/g,'$1 $2')}</dt>
      <dd className="whitespace-pre-wrap break-words">{Array.isArray(value)?value.join(', '):value}</dd>
    </div>)}
    {attachments.filter(file=>!questions.some(q=>q.id===file.id)).map(file=><div key={file.id}>
      <dt className="text-xs text-slate-500">Adjunto: {file.id}</dt><dd>{attachmentButton(file)}</dd>
    </div>)}</dl>
  </>;
  const heading = `${submission.title} · Versión ${submission.revision}`;
  return inline ? <section className="mt-3 rounded-lg bg-slate-50 p-3"><h5 className="text-sm font-semibold">{heading}</h5>{content}</section>
    : <details className="mt-3 rounded-lg bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-semibold">{heading}</summary>{content}</details>;
}
