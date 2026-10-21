import React, { useEffect, useState } from 'react';
import { operationsApi, type OperationsRq } from '../services/operationsApi';
import { getWorkerErrorMessage } from '../services/workerApi';
import { ConvocatoriaModal } from '../components/modals/ConvocatoriaModal';

export function SelectionRqView() {
  const [items, setItems] = useState<OperationsRq[]>([]);
  const [selected, setSelected] = useState<OperationsRq | null>(null);
  const [error, setError] = useState('');
  const refresh = () => operationsApi.requests().then(setItems).catch(cause => setError(getWorkerErrorMessage(cause)));
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 30000); return () => window.clearInterval(timer); }, []);
  const pending = items.filter(item => item.status === 'PENDIENTE');
  return <div className="space-y-5 p-6">
    <div><h1 className="text-2xl font-bold text-slate-900">Alertas de RQ · Selección</h1><p className="text-sm text-slate-500">Solicitudes de Operaciones pendientes de convertir en convocatoria.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <p role="status" className={`rounded-lg p-3 text-sm ${pending.length ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-800'}`}>{pending.length ? `${pending.length} RQ pendiente${pending.length === 1 ? '' : 's'} de atención` : 'No hay RQ pendientes.'}</p>
    <div className="space-y-3">{pending.map(item => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-[#143A56]">{item.profileRequired}</h2><p className="text-sm text-slate-600">{item.companyName} · {item.gerencia} · {item.kind === 'STAFF' ? 'Staff' : item.campaignName} · {item.fts} FT</p><p className="text-sm text-slate-600">Solicitante: {item.requesterName} · Criticidad: {item.criticality} · Ingreso: {item.expectedStart}</p><p className="text-sm text-slate-600">S/ {item.salary} · {item.schedule} · {item.location}</p>{item.observations && <p className="mt-1 text-sm">{item.observations}</p>}</div><button onClick={() => setSelected(item)} className="rounded-lg bg-[#143A56] px-4 py-2 text-sm text-white">Crear convocatoria desde RQ</button></div></article>)}</div>
    {selected && <ConvocatoriaModal isOpen onClose={() => setSelected(null)} initialRq={selected} onRqLinked={() => { void refresh(); }} />}
  </div>;
}
