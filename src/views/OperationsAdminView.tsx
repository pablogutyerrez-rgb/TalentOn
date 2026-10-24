import React, { useEffect, useState } from 'react';
import { operationsApi, type OperationsAdminData } from '../services/operationsApi';
import { getWorkerErrorMessage } from '../services/workerApi';

export function OperationsAdminView() {
  const [data, setData] = useState<OperationsAdminData>();
  const [companyId, setCompanyId] = useState('');
  const [newLink, setNewLink] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () => operationsApi.admin().then(result => { setData(result); setCompanyId(current => current || result.companies[0]?.id || ''); });
  useEffect(() => { void refresh().catch(error => setError(getWorkerErrorMessage(error))); }, []);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await work(); await refresh(); } catch (cause) { setError(getWorkerErrorMessage(cause)); } finally { setBusy(false); }
  };
  const companyGerencias = data?.gerencias.filter(item => item.companyId === companyId && item.active) || [];
  const copyLink = async (url: string, id: string) => {
    try { await navigator.clipboard.writeText(url); setCopiedId(id); setError(''); }
    catch { setError('No se pudo copiar el enlace. Selecciónalo y cópialo manualmente.'); }
  };
  return <div className="space-y-5 p-6">
    <div><h1 className="text-2xl font-bold text-slate-900">Operaciones · requerimientos</h1><p className="text-sm text-slate-500">Consulta RQ y entrega enlaces públicos revocables por empresa. El gerente se elige al completar el formulario; la asignación de convocatorias permanece en Selección.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <label className="block text-sm font-semibold">Empresa<select className="mt-1 block w-full max-w-sm rounded-lg border border-slate-300 p-2" value={companyId} onChange={event => { setCompanyId(event.target.value); setNewLink(''); }}><option value="">Selecciona una empresa</option>{data?.companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
      {!companyGerencias.length && companyId && <p className="text-sm text-amber-700">La lista de gerentes de esta empresa aún no está disponible.</p>}
      <button disabled={busy || !companyId || !companyGerencias.length} onClick={() => void run(async () => { const result = await operationsApi.createLink(companyId); const origin = window.location.origin; setNewLink(`${origin}/operaciones/rq/${result.token}`); })} className="rounded-lg bg-[#143A56] px-4 py-2 text-white disabled:opacity-50">Generar enlace público</button>
      {newLink && <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm"><p className="font-semibold">Enlace generado. También quedará disponible en “Enlaces existentes”.</p><input readOnly aria-label="Nuevo enlace RQ" value={newLink} className="mt-2 w-full rounded border p-2" onFocus={event => event.currentTarget.select()} /><button type="button" className="mt-2 underline" onClick={() => void copyLink(newLink, 'new')}>{copiedId === 'new' ? 'Copiado' : 'Copiar enlace'}</button></div>}
    </section>
    <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Enlaces existentes</h2><div className="mt-3 space-y-3">{data?.links.filter(item => item.companyId === companyId).map(item => <div key={item.id} className="border-b pb-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span>{new Date(item.createdAt).toLocaleString('es-PE')} · {item.active ? 'Activo' : 'Revocado'}</span>{item.active && <button type="button" disabled={busy} onClick={() => { if (window.confirm('¿Revocar este enlace? Dejará de aceptar RQ.')) void run(() => operationsApi.revokeLink(item.id)); }} className="text-red-700 underline">Revocar</button>}</div>{item.url ? <div className="mt-2 flex flex-wrap items-center gap-2"><input readOnly aria-label={`Enlace RQ del ${new Date(item.createdAt).toLocaleString('es-PE')}`} value={item.url} onFocus={event => event.currentTarget.select()} className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-slate-700" /><button type="button" onClick={() => void copyLink(item.url!, item.id)} className="rounded border border-slate-300 px-3 py-1 text-sky-900">{copiedId === item.id ? 'Copiado' : 'Copiar enlace'}</button></div> : <p className="mt-2 text-slate-500">Enlace anterior no recuperable. Genera uno nuevo para obtener su dirección.</p>}</div>)}{data && !data.links.some(item => item.companyId === companyId) && <p className="text-sm text-slate-500">Sin enlaces.</p>}</div></section>
    <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">RQ recibidos</h2><button type="button" onClick={() => void refresh().catch(cause => setError(getWorkerErrorMessage(cause)))} className="text-sm text-sky-800 underline">Actualizar</button></div><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-2">Fecha</th><th className="p-2">Solicitante</th><th className="p-2">Gerencia</th><th className="p-2">Perfil</th><th className="p-2">FTs</th><th className="p-2">Criticidad</th><th className="p-2">Estado</th></tr></thead><tbody>{data?.requests.filter(item => item.companyId === companyId).map(item => <tr key={item.id} className="border-t border-slate-100"><td className="p-2 whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString('es-PE')}</td><td className="p-2">{item.requesterName}</td><td className="p-2">{item.gerencia}</td><td className="p-2">{item.profileRequired}</td><td className="p-2">{item.fts}</td><td className="p-2">{item.criticality}</td><td className="p-2">{item.status === 'PENDIENTE' ? 'Pendiente de Selección' : 'Convocatoria creada'}</td></tr>)}</tbody></table>{data && !data.requests.some(item => item.companyId === companyId) && <p className="p-3 text-sm text-slate-500">No hay RQ para esta empresa.</p>}</div></section>
  </div>;
}
