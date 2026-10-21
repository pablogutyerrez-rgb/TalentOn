import React, { useEffect, useRef, useState } from 'react';
import { publicOperationsApi } from '../services/operationsApi';

type Config = { companyId: string; companyName: string; gerencias: { id: string; name: string }[]; campaigns: { id: string; name: string }[]; turnstileSiteKey: string; securityReady: boolean };
type Turnstile = { render: (node: HTMLElement, options: object) => string; remove: (id: string) => void; reset: (id: string) => void };

export function PublicOperationsRqView({ token }: { token: string }) {
  const [config, setConfig] = useState<Config>();
  const [company, setCompany] = useState('');
  const [gerenciaId, setGerenciaId] = useState('');
  const [dni, setDni] = useState('');
  const [name, setName] = useState('');
  const [nonce, setNonce] = useState('');
  const [challenge, setChallenge] = useState('');
  const [form, setForm] = useState({ kind: 'MASIVA', companyCampaignId: '', profileRequired: '', fts: 1, salary: 0, expectedStart: '', criticality: 'MEDIA', schedule: '', location: '', observations: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef('');
  useEffect(() => { void publicOperationsApi<Config>(token).then(setConfig).catch(cause => setError(cause instanceof Error ? cause.message : 'Enlace no disponible.')); }, [token]);
  useEffect(() => {
    if (!config?.turnstileSiteKey || !widget.current || !config.securityReady) return;
    let live = true;
    const init = () => {
      const api = (window as unknown as { turnstile?: Turnstile }).turnstile;
      if (live && api && widget.current && !widgetId.current) widgetId.current = api.render(widget.current, { sitekey: config.turnstileSiteKey, action: 'operations', callback: (value: string) => setChallenge(value), 'expired-callback': () => setChallenge(''), 'error-callback': () => setError('No se pudo cargar la verificación.') });
    };
    const script = document.querySelector<HTMLScriptElement>('script[data-operations-turnstile]') || document.createElement('script');
    script.addEventListener('load', init);
    if (!script.parentElement) { script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.dataset.operationsTurnstile = 'true'; document.head.appendChild(script); } else init();
    return () => { live = false; script.removeEventListener('load', init); if (widgetId.current) (window as unknown as { turnstile?: Turnstile }).turnstile?.remove(widgetId.current); widgetId.current = ''; };
  }, [config]);
  const resetIdentity = () => { setName(''); setNonce(''); };
  const lookup = async () => {
    if (!company || !gerenciaId || !/^\d{8}$/.test(dni) || !challenge) { setError('Selecciona empresa y gerencia, escribe un DNI válido y completa la verificación.'); return; }
    setBusy(true); setError(''); resetIdentity();
    try {
      const result = await publicOperationsApi<{ found: boolean; name?: string; nonce?: string }>(token, 'lookup', { dni, turnstileToken: challenge });
      if (!result.found || !result.name || !result.nonce) throw new Error('No se encontró un usuario activo con acceso a esta empresa y DNI.');
      setName(result.name); setNonce(result.nonce);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo consultar el DNI.'); }
    finally { setBusy(false); setChallenge(''); if (widgetId.current) (window as unknown as { turnstile?: Turnstile }).turnstile?.reset(widgetId.current); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!nonce || busy) return;
    setBusy(true); setError('');
    try {
      await publicOperationsApi(token, 'submit', { ...form, companyCampaignId: form.kind === 'STAFF' ? null : form.companyCampaignId, gerenciaId, dni, nonce });
      setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo registrar el RQ.'); }
    finally { setBusy(false); }
  };
  const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm';
  return <main className="min-h-screen bg-slate-100 p-4 text-slate-900"><section className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow-sm space-y-5">
    <div><h1 className="text-2xl font-bold text-[#143A56]">Requerimiento de Reclutamiento (RQ)</h1><p className="text-sm text-slate-600">Operaciones · envío sin iniciar sesión</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {done ? <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">RQ registrado. El equipo de Selección recibió la alerta.</p> : config && <>
      {!config.securityReady && <p className="rounded-lg bg-amber-50 p-3 text-sm">Este formulario aún no tiene la verificación de seguridad configurada.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Empresa *<select required className={field} value={company} onChange={event => { setCompany(event.target.value); setGerenciaId(''); resetIdentity(); }}><option value="">Selecciona la empresa</option><option value={config.companyId}>{config.companyName}</option></select></label>
        <label className="text-sm font-semibold">Gerencia *<select required disabled={!company} className={field} value={gerenciaId} onChange={event => { setGerenciaId(event.target.value); resetIdentity(); }}><option value="">Selecciona la gerencia</option>{config.gerencias.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-sm font-semibold">DNI del solicitante *<input className={field} inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={dni} onChange={event => { setDni(event.target.value.replace(/\D/g, '')); resetIdentity(); }} /></label>
        <label className="text-sm font-semibold">Nombre y apellido<input className={`${field} bg-slate-50`} readOnly value={name} placeholder="Se completará con el DNI" /></label>
      </div>
      {!nonce && <><div ref={widget} /><button type="button" disabled={busy || !config.securityReady} onClick={() => void lookup()} className="rounded-lg bg-[#143A56] px-4 py-2 text-white disabled:opacity-50">Consultar DNI</button></>}
      {nonce && <form onSubmit={submit} className="space-y-4 border-t pt-5">
        <p className="text-sm text-green-700">Identificado: {name}. Completa el requerimiento.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Tipo de RQ *<select required className={field} value={form.kind} onChange={event => setForm(current => ({ ...current, kind: event.target.value, companyCampaignId: '' }))}><option value="MASIVA">Campaña masiva</option><option value="STAFF">Puesto de staff</option></select></label>
          {form.kind === 'MASIVA' && <label className="text-sm font-semibold">Campaña *<select required className={field} value={form.companyCampaignId} onChange={event => setForm(current => ({ ...current, companyCampaignId: event.target.value }))}><option value="">Selecciona una campaña</option>{config.campaigns.filter(item => !item.id.endsWith(':staff-rq')).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          <label className="text-sm font-semibold">Perfil requerido *<input required minLength={2} maxLength={200} className={field} value={form.profileRequired} onChange={event => setForm(current => ({ ...current, profileRequired: event.target.value }))} /></label>
          <label className="text-sm font-semibold">Cantidad de FTs *<input required type="number" min={1} max={10000} className={field} value={form.fts} onChange={event => setForm(current => ({ ...current, fts: Number(event.target.value) }))} /></label>
          <label className="text-sm font-semibold">Sueldo (S/) *<input required type="number" min={0} step="0.01" className={field} value={form.salary} onChange={event => setForm(current => ({ ...current, salary: Number(event.target.value) }))} /></label>
          <label className="text-sm font-semibold">Fecha esperada de ingreso *<input required type="date" className={field} value={form.expectedStart} onChange={event => setForm(current => ({ ...current, expectedStart: event.target.value }))} /></label>
          <label className="text-sm font-semibold">Criticidad *<select required className={field} value={form.criticality} onChange={event => setForm(current => ({ ...current, criticality: event.target.value }))}>{['BAJA', 'MEDIA', 'ALTA', 'CRITICA'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="text-sm font-semibold">Horario *<input required minLength={2} maxLength={200} className={field} value={form.schedule} onChange={event => setForm(current => ({ ...current, schedule: event.target.value }))} /></label>
          <label className="text-sm font-semibold">Ubicación *<input required minLength={2} maxLength={200} className={field} value={form.location} onChange={event => setForm(current => ({ ...current, location: event.target.value }))} /></label>
        </div>
        <label className="block text-sm font-semibold">Observaciones<textarea maxLength={2000} className={field} value={form.observations} onChange={event => setForm(current => ({ ...current, observations: event.target.value }))} /></label>
        <button disabled={busy} className="rounded-lg bg-[#143A56] px-5 py-2 text-white disabled:opacity-50">Enviar RQ</button>
      </form>}
    </>}
  </section></main>;
}
