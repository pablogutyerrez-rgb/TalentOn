import React,{useState} from 'react';
import {useTalent} from '../../context/TalentContext';
export function SupabaseAccessGate() {
 const {currentUser,mustChangePassword,changeInitialPassword,logout}=useTalent();
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(event:React.FormEvent) {
  event.preventDefault();setError('');
  if(password.length<12){setError('Usa al menos 12 caracteres.');return;}
  if(password!==confirm){setError('Las contraseñas no coinciden.');return;}
  setBusy(true);
  try {await changeInitialPassword(password);}
  catch {setError('No se pudo completar el cambio. El acceso sigue bloqueado.');}
  finally {setBusy(false);}
 }
 return <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
  <section className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-8 shadow-sm">
   <h1 className="text-xl font-semibold text-slate-900">{mustChangePassword?'Cambia tu contraseña temporal':'Supabase conectado'}</h1>
   <p className="mt-3 text-sm text-slate-600">{mustChangePassword?'Debes elegir una contraseña nueva antes de acceder. Después iniciarás sesión nuevamente.':`Sesión de ${currentUser.name} validada. Firebase está desconectado. Los módulos de negocio siguen en adaptación y todavía no están disponibles.`}</p>
   {mustChangePassword&&<form onSubmit={submit} className="mt-6 space-y-4">
    <label className="block text-sm">Nueva contraseña<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 p-3"/></label>
    <label className="block text-sm">Confirmar contraseña<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 p-3"/></label>
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
    <button disabled={busy} type="submit" className="w-full rounded-lg bg-sky-900 px-4 py-3 text-white disabled:opacity-50">{busy?'Guardando…':'Cambiar contraseña'}</button>
   </form>}
   {!mustChangePassword&&<p className="mt-5 text-sm text-amber-700" role="status">No se mostrarán dashboards ni acciones incompletas como si estuvieran operativos.</p>}
   <button disabled={busy} onClick={()=>void logout().catch(()=>setError('No se pudo cerrar la sesión.'))} className="mt-5 text-sm text-sky-900">Cerrar sesión</button>
  </section>
 </main>;
}
