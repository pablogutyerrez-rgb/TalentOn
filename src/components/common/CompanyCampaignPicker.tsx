import React,{useEffect,useState} from 'react';
import {useTalent} from '../../context/TalentContext';
import {workerApi,getWorkerErrorMessage} from '../../services/workerApi';
type Directory={companies:{id:string;name:string;catalog_managed:boolean}[];campaigns:{id:string;name:string;company_id:string}[]};
export function CompanyCampaignPicker({value,onChange,companyId,onCompanyChange,disabled=false}:{value:string;onChange:(v:string)=>void;companyId:string;onCompanyChange:(v:string)=>void;disabled?:boolean}){
 const {currentUser}=useTalent();const [data,setData]=useState<Directory>(),[error,setError]=useState('');
 useEffect(()=>{let live=true;void workerApi<Directory>('/api/org').then(d=>{if(live)setData(d);}).catch(e=>{if(live)setError(getWorkerErrorMessage(e));});return()=>{live=false;};},[]);
 const companies=data?.companies.filter(c=>currentUser.companies?.some(a=>a.id===c.id))||[];
 const managed=companies.find(c=>c.id===companyId)?.catalog_managed;
 return <div className="grid grow gap-3 sm:grid-cols-2">
  <label className="text-sm">Empresa responsable *<select required disabled={disabled||!data} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2" value={companyId} onChange={e=>{onCompanyChange(e.target.value);onChange('');}}><option value="">Selecciona una empresa</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
  {managed&&<label className="text-sm">Campaña *<select required disabled={disabled} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2" value={value} onChange={e=>onChange(e.target.value)}><option value="">Selecciona una campaña</option>{data?.campaigns.filter(c=>c.company_id===companyId).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 </div>;
}
