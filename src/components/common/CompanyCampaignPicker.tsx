import React,{useEffect,useState} from 'react';
import {useTalent} from '../../context/TalentContext';
import {workerApi,getWorkerErrorMessage} from '../../services/workerApi';
export function CompanyCampaignPicker({value,onChange}:{value:string;onChange:(v:string)=>void}){
 const {currentUser}=useTalent();const [rows,setRows]=useState<{id:string;name:string;company_id:string}[]>([]);const [error,setError]=useState('');
 useEffect(()=>{let live=true;if(currentUser.managedCompany)void workerApi<{campaigns:typeof rows}>('/api/org').then(d=>{if(live)setRows(d.campaigns.filter(c=>c.company_id===currentUser.companyId));}).catch(e=>{if(live)setError(getWorkerErrorMessage(e));});return()=>{live=false;};},[currentUser.companyId,currentUser.managedCompany]);
 if(!currentUser.managedCompany)return null;
 return <label className="text-sm">Campaña<select required className="ml-2 rounded-lg border p-2" value={value} onChange={e=>onChange(e.target.value)}><option value="">Seleccionar</option>{rows.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>{error&&<span role="alert" className="text-red-700">{error}</span>}</label>;
}
