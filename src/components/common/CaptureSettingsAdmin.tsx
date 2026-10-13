import React, {useEffect, useState} from 'react';
import {workerApi, getWorkerErrorMessage} from '../../services/workerApi';
import {captureWorkdays, validateCaptureCampaignConfig, type CaptureCampaignConfig} from '../../../shared/captureCampaignConfig';
type Campaign = {id:string; name:string; companyId:string; companyName:string; version:number|null; configuration:CaptureCampaignConfig|null};
export function CaptureSettingsAdmin() {
  const [campaigns,setCampaigns]=useState<Campaign[]>([]), [company,setCompany]=useState(''), [id,setId]=useState('');
  const [error,setError]=useState(''), [notice,setNotice]=useState(''), [busy,setBusy]=useState(false);
  const [min,setMin]=useState(''), [max,setMax]=useState(''), [days,setDays]=useState<string[]>([]);
  const [schedules,setSchedules]=useState(''), [modality,setModality]=useState('');
  const selected=campaigns.find(c=>c.companyId===company&&c.id===id);
  const companies=Array.from(new Map(campaigns.map(c=>[c.companyId,c.companyName])));
  useEffect(()=>{let live=true;void workerApi<Campaign[]>('/api/org/capture-settings').then(d=>{if(live)setCampaigns(d);}).catch(e=>{if(live)setError(getWorkerErrorMessage(e));});return()=>{live=false;};},[]);
  useEffect(()=>{
    const config=selected?.configuration;
    setMin(config?String(config.minAge):'');setMax(config?.maxAge==null?'':String(config.maxAge));
    setDays(config?.workdays||[]);setSchedules(config?.schedules.join('\n')||'');setModality(config?.modality||'');
  },[selected]);
  const control='mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm';
  return <section className="space-y-4 border-t border-slate-200 pt-4">
    <h3 className="font-semibold">Formulario de captación · Condiciones por campaña</h3>
    <button type="button" disabled={busy} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onClick={async()=>{setBusy(true);setError('');try{setCampaigns(await workerApi<Campaign[]>('/api/org/capture-settings'));setNotice('Configuración actualizada.');}catch(e){setError(getWorkerErrorMessage(e));}finally{setBusy(false);}}}>Actualizar configuración</button>
    <p className="text-sm text-slate-500">La configuración se aplica a todos los enlaces de esta campaña en la empresa elegida. No modifica postulaciones anteriores. Las campañas sin configurar no reciben nuevas postulaciones.</p>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="text-sm text-emerald-700">{notice}</p>}
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm">Empresa<select disabled={busy} className={control} value={company} onChange={e=>{setCompany(e.target.value);setId('');}}><option value="">Selecciona empresa</option>{companies.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
      <label className="text-sm">Campaña<select disabled={busy||!company} className={control} value={id} onChange={e=>setId(e.target.value)}><option value="">Selecciona campaña</option>{campaigns.filter(c=>c.companyId===company).map(c=><option key={c.id} value={c.id}>{c.name}{c.configuration?'':' · Pendiente'}</option>)}</select></label>
    </div>
    {selected&&<fieldset disabled={busy} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">Edad mínima (*)<input aria-label="Edad mínima" className={control} type="number" min="0" max="120" step="1" value={min} onChange={e=>setMin(e.target.value)}/></label>
        <label className="text-sm">Edad máxima (vacío: sin límite superior)<input aria-label="Edad máxima" className={control} type="number" min={min||'0'} max="120" step="1" value={max} onChange={e=>setMax(e.target.value)}/></label>
      </div>
      <div className="text-sm"><p>Jornadas ofrecidas (*)</p><div className="mt-2 flex flex-wrap gap-4">{captureWorkdays.map(day=><label key={day}><input type="checkbox" checked={days.includes(day)} onChange={e=>setDays(previous=>e.target.checked?[...previous,day]:previous.filter(d=>d!==day))}/> {day}</label>)}</div></div>
      <label className="block text-sm">Horarios ofrecidos (uno por línea) (*)<textarea aria-label="Horarios ofrecidos" className={control} rows={3} value={schedules} onChange={e=>setSchedules(e.target.value)} placeholder="Ej.: Lunes a viernes, 09:00–18:00"/></label>
      <label className="block text-sm">Modalidad (*)<select aria-label="Modalidad de campaña" className={control} value={modality} onChange={e=>setModality(e.target.value)}><option value="">Selecciona modalidad</option><option>Presencial</option><option>Remota</option></select></label>
      <button type="button" disabled={busy} className="rounded-lg bg-[#143A56] px-4 py-2 text-sm text-white disabled:opacity-50" onClick={async()=>{
        setError('');setNotice('');
        try{
          if(!min.trim())throw new Error('Indica la edad mínima.');
          const configuration=validateCaptureCampaignConfig({minAge:Number(min),maxAge:max.trim()?Number(max):null,workdays:days,schedules:schedules.split('\n').map(v=>v.trim()).filter(Boolean),modality});
          setBusy(true);
          const saved=await workerApi<{version:number}>('/api/org/capture-settings',{method:'POST',body:JSON.stringify({companyId:company,id,version:selected.version,configuration})});
          setCampaigns(previous=>previous.map(c=>c===selected?{...c,configuration,version:saved.version}:c));
          setNotice('Configuración guardada para los formularios de esta campaña.');
        }catch(e){setError(getWorkerErrorMessage(e));}finally{setBusy(false);}
      }}>{busy?'Guardando…':'Guardar condiciones del formulario'}</button>
    </fieldset>}
  </section>;
}
