import React, { useEffect, useState } from 'react';
import { operationsApi, type OperationsAdminData } from '../services/operationsApi';
import { getWorkerErrorMessage } from '../services/workerApi';

export function OperationsAdminView() {
  const [data, setData] = useState<OperationsAdminData>();
  const [companyId, setCompanyId] = useState('');
  const [gerencia, setGerencia] = useState('');
  const [newLink, setNewLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () => operationsApi.admin().then(result => { setData(result); setCompanyId(current => current || result.companies[0]?.id || ''); });
  useEffect(() => { void refresh().catch(error => setError(getWorkerErrorMessage(error))); }, []);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await work(); await refresh(); } catch (cause) { setError(getWorkerErrorMessage(cause)); } finally { setBusy(false); }
  };
  const companyGerencias = data?.gerencias.filter(item => item.companyId === companyId && item.active) || [];
  return <div className="space-y-5 p-6">
    <div><h1 className="text-2xl font-bold text-slate-900">Operaciones · requerimientos</h1><p className="text-sm text-slate-500">Consulta RQ, configura gerencias y entrega enlaces públicos revocables por empresa. La asignación de convocatorias permanece en Selección.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <label className="block text-sm font-semibold">Empresa<select className="mt-1 block w-full max-w-sm rounded-lg border border-slate-300 p-2" value={companyId} onChange={event => { setCompanyId(event.target.value); setNewLink(''); }}><option value="">Selecciona una empresa</option>{data?.companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
      <form onSubmit={event => { event.preventDefault(); void run(async () => { await operationsApi.saveGerencia(companyId, gerencia.trim()); setGerencia(''); }); }} className="flex flex-wrap gap-2 items-end">
        <label className="text-sm font-semibold">Nueva gerencia<input required minLength={2} maxLength={100} className="mt-1 block w-72 rounded-lg border border-slate-300 p-2" value={gerencia} onChange={event => setGerencia(event.target.value)} placeholder="Ej. Gerencia de Operaciones" /></label>
        <button disabled={busy || !companyId} className="rounded-lg bg-[#143A56] px-4 py-2 text-white disabled:opacity-50">Agregar</button>
      </form>
      <p className="text-sm text-slate-600">Gerencias activas: {companyGerencias.length ? companyGerencias.map(item => item.name).join(', ') : 'ninguna. Agrega una antes de generar el enlace.'}</p>
      <button disabled={busy || !companyId || !companyGerencias.length} onClick={() => void run(async () => { const result = await operationsApi.createLink(companyId); const origin = window.location.origin; setNewLink(`${origin}/operaciones/rq/${result.token}`); })} className="rounded-lg bg-[#143A56] px-4 py-2 text-white disabled:opacity-50">Generar enlace público</button>
      {newLink && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p className="font-semibold">Copia el enlace ahora; el token no se guarda en texto legible.</p><input readOnly aria-label="Nuevo enlace RQ" value={newLink} className="mt-2 w-full rounded border p-2" /><button className="mt-2 underline" onClick={() => void navigator.clipboard.writeText(newLink)}>Copiar</button></div>}
    </section>
    <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Enlaces existentes</h2><div className="mt-3 space-y-2">{data?.links.filter(item => item.companyId === companyId).map(item => <div key={item.id} className="flex items-center justify-between border-b py-2 text-sm"><span>{new Date(item.createdAt).toLocaleString('es-PE')} · {item.active ? 'Activo' : 'Revocado'}</span>{item.active && <button disabled={busy} onClick={() => { if (window.confirm('¿Revocar este enlace? Dejará de aceptar RQ.')) void run(() => operationsApi.revokeLink(item.id)); }} className="text-red-700 underline">Revocar</button>}</div>)}{data && !data.links.some(item => item.companyId === companyId) && <p className="text-sm text-slate-500">Sin enlaces.</p>}</div></section>
    <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">RQ recibidos</h2><button type="button" onClick={() => void refresh().catch(cause => setError(getWorkerErrorMessage(cause)))} className="text-sm text-sky-800 underline">Actualizar</button></div><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-2">Fecha</th><th className="p-2">Solicitante</th><th className="p-2">Gerencia</th><th className="p-2">Perfil</th><th className="p-2">FTs</th><th className="p-2">Criticidad</th><th className="p-2">Estado</th></tr></thead><tbody>{data?.requests.filter(item => item.companyId === companyId).map(item => <tr key={item.id} className="border-t border-slate-100"><td className="p-2 whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString('es-PE')}</td><td className="p-2">{item.requesterName}</td><td className="p-2">{item.gerencia}</td><td className="p-2">{item.profileRequired}</td><td className="p-2">{item.fts}</td><td className="p-2">{item.criticality}</td><td className="p-2">{item.status === 'PENDIENTE' ? 'Pendiente de Selección' : 'Convocatoria creada'}</td></tr>)}</tbody></table>{data && !data.requests.some(item => item.companyId === companyId) && <p className="p-3 text-sm text-slate-500">No hay RQ para esta empresa.</p>}</div></section>
  </div>;
}
