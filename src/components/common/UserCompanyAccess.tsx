import React, {useEffect,useState} from 'react';
import {CompanyAccess,UserRole} from '../../types';
import {workerApi,getWorkerErrorMessage} from '../../services/workerApi';
type Directory={companies:{id:string;name:string;catalog_managed:boolean;status:string}[];campaigns:{id:string;company_id:string;name:string}[];memberships:{auth_user_id:string;company_id:string;role:UserRole;enabled:boolean;all_campaigns:boolean;scopes:string[];version:number}[]};
const roles:UserRole[]=['ADMIN','JEFE_SELECCION','ANALISTA_SELECCION','RECLUTADOR','JEFE_FORMACION','COORDINADOR_FORMACION','FORMADOR','JEFE_TALENTO','ANALISTA_TALENTO'];
export function UserCompanyAccess({userId,defaultRole,value,onChange}:{userId?:string;defaultRole:UserRole;value:CompanyAccess[]|undefined;onChange:(v:CompanyAccess[]|undefined)=>void}){
 const [directory,setDirectory]=useState<Directory>();const [error,setError]=useState('');
 useEffect(()=>{let live=true;onChange(undefined);setError('');void workerApi<Directory>('/api/org').then(d=>{if(!live)return;setDirectory(d);onChange(d.companies.filter(c=>c.catalog_managed&&c.status==='ACTIVA').map(c=>{const m=d.memberships.find(m=>m.auth_user_id===userId&&m.company_id===c.id);return {companyId:c.id,role:m?.role||defaultRole,enabled:m?.enabled??false,allCampaigns:m?.all_campaigns??false,scopes:m?.scopes||[],version:m?.version??null};}));}).catch(e=>{if(live)setError(getWorkerErrorMessage(e));});return()=>{live=false;};},[userId]);
 const change=(id:string,patch:Partial<CompanyAccess>)=>onChange(value?.map(v=>v.companyId===id?{...v,...patch}:v));
 return <section className="space-y-3 border-t border-slate-200 pt-4"><h3 className="text-sm font-semibold">Empresas y permisos asignados</h3><p className="text-xs text-slate-500">Selecciona una o varias empresas. Define el rol y las campañas de cada una; no otorga acceso global a Talent-On.</p>
 {error&&<p role="alert" className="text-red-700">{error}</p>}{!value&&!error&&<p role="status">Cargando empresas…</p>}
 {value?.map(v=><div key={v.companyId} className="rounded-lg border border-slate-200 p-3 space-y-2"><label className="flex items-center gap-2 font-semibold text-sm"><input type="checkbox" checked={v.enabled} onChange={e=>change(v.companyId,{enabled:e.target.checked})}/>{directory?.companies.find(c=>c.id===v.companyId)?.name}</label>
 {v.enabled&&<><select aria-label={'Rol en '+v.companyId} className="w-full rounded-lg border p-2 text-sm" value={v.role} onChange={e=>change(v.companyId,{role:e.target.value as UserRole,...(e.target.value==='FORMADOR'?{allCampaigns:false}:{})})}>{roles.map(r=><option key={r} value={r}>{r.replaceAll('_',' ')}</option>)}</select>
 <label className="flex items-center gap-2 text-xs"><input type="checkbox" disabled={v.role==='FORMADOR'} checked={v.allCampaigns} onChange={e=>change(v.companyId,{allCampaigns:e.target.checked})}/>Todas las campañas de esta empresa</label>
 {!v.allCampaigns&&<div className="flex flex-wrap gap-3">{directory?.campaigns.filter(c=>c.company_id===v.companyId).map(c=><label className="text-xs flex items-center gap-1" key={c.id}><input type="checkbox" checked={v.scopes.includes(c.id)} onChange={e=>change(v.companyId,{scopes:e.target.checked?[...v.scopes,c.id]:v.scopes.filter(id=>id!==c.id)})}/>{c.name}</label>)}</div>}
 {v.role==='FORMADOR'&&<p className="text-xs text-slate-500">También requiere asignación al grupo de capacitación.</p>}</>}
 </div>)}</section>;
}
