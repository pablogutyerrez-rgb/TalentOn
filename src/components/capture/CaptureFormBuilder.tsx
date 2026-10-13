import React,{useEffect,useState} from 'react';
import {workerApi,getWorkerErrorMessage} from '../../services/workerApi';
import {captureWorkdays,type CaptureCampaignConfig} from '../../../shared/captureCampaignConfig';
import {defaultCaptureForm,validateFormBundle,effectiveQuestions,type CaptureForm,type CaptureFormBundle,type FormAnswers} from '../../../shared/captureFormSchema';
import {CaptureQuestionEditor} from './CaptureQuestionEditor';
import {CaptureFormFields} from './CaptureFormFields';
type Campaign={id:string;name:string;companyId:string;companyName:string;version:number|null;configuration:CaptureCampaignConfig|null;draft:CaptureFormBundle|null;published:CaptureFormBundle|null;formVersion:number|null;publishedRevision:number|null};
export default function CaptureFormBuilder(){
  const [rows,setRows]=useState<Campaign[]>([]),[selectedKey,setSelectedKey]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{let live=true;setLoading(true);void workerApi<Campaign[]>('/api/capture/forms').then(data=>{if(live){setRows(data);setError('');}}).catch(e=>{if(live)setError(getWorkerErrorMessage(e));}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[refresh]);
  const selected=rows.find(c=>c.companyId+'|'+c.id===selectedKey);
  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
    <header><h1 className="text-2xl font-bold">Formularios de captación</h1><p className="mt-1 text-sm text-slate-500">Crea y edita el formulario por empresa y campaña. Guardar borrador no modifica lo publicado.</p></header>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3">
      <label className="grow text-sm">Empresa y campaña<select className="mt-1 w-full rounded-lg border border-slate-200 p-2" disabled={loading} value={selectedKey} onChange={e=>setSelectedKey(e.target.value)}><option value="">Selecciona una campaña</option>{rows.map(c=><option key={c.companyId+'|'+c.id} value={c.companyId+'|'+c.id}>{c.companyName} · {c.name} · {c.published?'Publicado':c.draft?'Borrador':c.configuration?'Formulario base':'Sin configurar'}</option>)}</select></label>
      <button type="button" className="self-end rounded-lg border px-3 py-2 text-sm" onClick={()=>setRefresh(v=>v+1)} disabled={loading}>Actualizar</button>
    </div>
    {loading?<p role="status">Cargando formularios…</p>:selected?<FormEditor key={selectedKey+':'+refresh} campaign={selected} onSaved={saved=>setRows(previous=>previous.map(c=>c.companyId===saved.companyId&&c.id===saved.id?saved:c))}/>:<p className="text-sm text-slate-500">Selecciona una campaña para crear su formulario o modificar el existente.</p>}
  </section>;
}
function FormEditor({campaign,onSaved}:{key?:string;campaign:Campaign;onSaved:(campaign:Campaign)=>void}){
  const initial=campaign.draft||campaign.published;
  const config=initial?.configuration||campaign.configuration;
  const [form,setForm]=useState<CaptureForm>(()=>initial?.form||defaultCaptureForm());
  const [min,setMin]=useState(config?String(config.minAge):''),[max,setMax]=useState(config?.maxAge==null?'':String(config.maxAge));
  const [days,setDays]=useState<string[]>(config?.workdays||[]),[schedules,setSchedules]=useState(config?.schedules.join('\n')||''),[modality,setModality]=useState(config?.modality||'');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[preview,setPreview]=useState<CaptureFormBundle|null>(null),[previewValues,setPreviewValues]=useState<FormAnswers>({});
  const control='mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm';
  const bundle=()=>{if(!min.trim())throw new Error('Indica la edad mínima de la campaña.');return validateFormBundle({form,configuration:{minAge:Number(min),maxAge:max.trim()?Number(max):null,workdays:days,schedules:schedules.split('\n').map(v=>v.trim()).filter(Boolean),modality}});};
  const save=async(publish:boolean)=>{
    setError('');setNotice('');
    try{
      const draft=bundle();setBusy(true);
      const result=await workerApi<{formVersion:number;publishedRevision:number|null;settingsVersion:number|null;draft:CaptureFormBundle;published:CaptureFormBundle|null}>('/api/capture/forms',{method:'POST',body:JSON.stringify({companyId:campaign.companyId,id:campaign.id,version:campaign.version,formVersion:campaign.formVersion,bundle:draft,publish})});
      onSaved({...campaign,...result,configuration:publish?draft.configuration:campaign.configuration,version:result.settingsVersion??campaign.version});
      setForm(result.draft.form);
      setNotice(publish?'Formulario publicado. Los enlaces de esta campaña usan esta versión.':'Borrador guardado. El formulario público no cambió.');
    }catch(e){setError(getWorkerErrorMessage(e));}finally{setBusy(false);}
  };
  return <div className="space-y-5">
    <p className="text-xs text-slate-500">Versión publicada: {campaign.publishedRevision??'formulario base'} · Los registros anteriores se conservan. Edición reservada al administrador global.</p>
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="text-sm text-emerald-700">{notice}</p>}
    <fieldset disabled={busy} className="space-y-4">
      <legend className="font-semibold">Condiciones de la campaña</legend>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">Edad mínima (*)<input className={control} type="number" min="0" max="120" step="1" value={min} onChange={e=>setMin(e.target.value)}/></label>
        <label className="text-sm">Edad máxima (vacío: sin límite superior)<input className={control} type="number" min={min||'0'} max="120" step="1" value={max} onChange={e=>setMax(e.target.value)}/></label>
      </div>
      <div className="text-sm"><p>Jornadas ofrecidas (*)</p><div className="mt-2 flex flex-wrap gap-4">{captureWorkdays.map(day=><label key={day}><input type="checkbox" checked={days.includes(day)} onChange={e=>setDays(previous=>e.target.checked?[...previous,day]:previous.filter(d=>d!==day))}/> {day}</label>)}</div></div>
      <label className="block text-sm">Horarios ofrecidos (uno por línea) (*)<textarea className={control} rows={3} value={schedules} onChange={e=>setSchedules(e.target.value)}/></label>
      <label className="block text-sm">Modalidad (*)<select className={control} value={modality} onChange={e=>setModality(e.target.value)}><option value="">Selecciona modalidad</option><option>Presencial</option><option>Remota</option></select></label>
      <div className="border-t pt-4">
        <h2 className="font-semibold">Editor de preguntas</h2>
        <label className="mt-3 block text-sm">Título del formulario<input className={control} maxLength={160} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></label>
        <label className="mt-3 block text-sm">Descripción<textarea className={control} rows={2} maxLength={2000} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></label>
      </div>
      <CaptureQuestionEditor questions={form.questions} onChange={questions=>setForm(f=>({...f,questions}))}/>
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={()=>{setError('');try{const draft=bundle();setPreview(draft);setPreviewValues({preferredCampaign:campaign.id,modality:draft.configuration.modality});}catch(e){setError(getWorkerErrorMessage(e));}}}>Vista previa</button>
        <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={()=>void save(false)}>Guardar borrador</button>
        <button type="button" className="rounded-lg bg-[#143A56] px-4 py-2 text-sm text-white" onClick={()=>void save(true)}>{busy?'Guardando…':campaign.published?'Publicar cambios':'Crear y publicar formulario'}</button>
      </div>
    </fieldset>
    {preview&&<section aria-label="Vista previa del formulario" className="rounded-xl border border-sky-200 bg-slate-50 p-4">
      <button type="button" className="mb-3 rounded-lg border px-3 py-2 text-sm" onClick={()=>setPreview(null)}>Cerrar vista previa</button>
      <p className="text-xs text-slate-500">Vista previa: no envía ni guarda postulaciones.</p><h2 className="mt-2 text-xl font-semibold">{preview.form.title}</h2><p className="text-sm">{preview.form.description}</p>
      <CaptureFormFields questions={effectiveQuestions(preview.form,preview.configuration,campaign,campaign.companyName)} values={previewValues} onChange={(key,value)=>setPreviewValues(v=>({...v,[key]:value}))} preview/>
    </section>}
  </div>;
}
