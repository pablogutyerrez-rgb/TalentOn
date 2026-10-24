import React, { useEffect, useRef, useState } from 'react';
import { publicOperationsApi } from '../services/operationsApi';
import { CompanyLogo, companyLogoSource } from '../components/common/CompanyLogo';

type Config = { companyId: string; companyName: string; gerencias: { id: string; name: string }[]; campaigns: { id: string; name: string }[]; turnstileSiteKey: string; securityReady: boolean };
type Turnstile = { render: (node: HTMLElement, options: object) => string; remove: (id: string) => void; reset: (id: string) => void };
const steps = ['Identificación', 'Requerimiento', 'Compensación', 'Condiciones', 'Confirmación'] as const;

export function PublicOperationsRqView({ token }: { token: string }) {
  const [config, setConfig] = useState<Config>();
  const [gerenciaId, setGerenciaId] = useState('');
  const [dni, setDni] = useState('');
  const [name, setName] = useState('');
  const [nonce, setNonce] = useState('');
  const [challenge, setChallenge] = useState('');
  const [form, setForm] = useState({ kind: 'MASIVA', companyCampaignId: '', profileRequired: '', fts: 1, salary: 0, variableBonus: 0, mobilityBonus: 0, expectedStart: '', criticality: 'MEDIA', schedule: '', modality: '', observations: '' });
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef('');
  const stepFields = useRef<HTMLDivElement>(null);
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
    if (!config?.companyId || !gerenciaId || !/^\d{8}$/.test(dni) || !challenge) { setError('Selecciona un gerente, escribe un DNI válido y completa la verificación.'); return; }
    setBusy(true); setError(''); resetIdentity();
    try {
      const result = await publicOperationsApi<{ found: boolean; name?: string; nonce?: string }>(token, 'lookup', { dni, turnstileToken: challenge });
      if (!result.found || !result.name || !result.nonce) throw new Error('No se encontró un usuario activo con acceso a esta empresa y DNI.');
      setName(result.name); setNonce(result.nonce); setStep(1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo consultar el DNI.'); }
    finally { setBusy(false); setChallenge(''); if (widgetId.current) (window as unknown as { turnstile?: Turnstile }).turnstile?.reset(widgetId.current); }
  };
  const advance = () => {
    setError('');
    const fields = stepFields.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
    for (const field of fields || []) if (!field.reportValidity()) { field.focus(); return; }
    if (step === 0) { if (nonce) setStep(1); else void lookup(); return; }
    setStep(current => Math.min(current + 1, steps.length - 1));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step < steps.length - 1) { advance(); return; }
    if (!nonce || busy) return;
    if (!gerenciaId || !config?.gerencias.some(item => item.id === gerenciaId)) { setError('Selecciona un gerente de esta empresa.'); setStep(0); return; }
    setBusy(true); setError('');
    try {
      await publicOperationsApi(token, 'submit', { ...form, companyCampaignId: form.kind === 'STAFF' ? null : form.companyCampaignId, gerenciaId, dni, nonce });
      setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo registrar el RQ.'); }
    finally { setBusy(false); }
  };
  const field = 'mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100';
  const summary: [string, string | number][] = [
    ['Empresa', config?.companyName || ''], ['Gerencia', config?.gerencias.find(item => item.id === gerenciaId)?.name.replace(/\s*\([^)]*\)$/, '') || ''],
    ['DNI del solicitante', dni], ['Nombre y apellido', name], ['Tipo de RQ', form.kind === 'MASIVA' ? 'Campaña masiva' : 'Puesto de staff'],
    ...(form.kind === 'MASIVA' ? [['Campaña', config?.campaigns.find(item => item.id === form.companyCampaignId)?.name || ''] as [string, string]] : []),
    ['Perfil requerido', form.profileRequired], ['Cantidad de FTs', form.fts], ['Sueldo (S/)', form.salary],
    ['Bono variable (S/)', form.variableBonus], ['Bono de movilidad (S/)', form.mobilityBonus], ['Fecha esperada de ingreso', form.expectedStart],
    ['Criticidad', form.criticality], ['Horario', form.schedule], ['Modalidad', form.modality === 'PRESENCIAL' ? 'Presencial' : 'Remota'], ['Observaciones', form.observations || '—'],
  ];
  return <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 sm:py-10"><section className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_-30px_rgba(20,58,86,.35)]">
    <header className="grid gap-6 border-b border-slate-200 p-5 sm:p-8 lg:grid-cols-[minmax(240px,1fr)_minmax(0,1.7fr)] lg:gap-10">
      <div className="flex flex-col items-start gap-2 lg:border-r lg:border-slate-200 lg:pr-8"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Empresa solicitante</p>{config && (companyLogoSource(config.companyId, config.companyName) ? <CompanyLogo companyId={config.companyId} companyName={config.companyName} /> : <p className="text-xl font-bold text-[#143A56]">{config.companyName}</p>)}</div>
      <div><h1 className="text-2xl font-bold tracking-tight text-[#143A56] sm:text-3xl">Requerimiento de Reclutamiento (RQ)</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Completa los datos de tu requerimiento para que el equipo de Selección pueda gestionarlo. No necesitas iniciar sesión.</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500"><span>Tiempo estimado: 3–5 min</span><span>Los campos obligatorios están marcados con (*)</span></div></div>
    </header>
    {error && <p role="alert" className="mx-5 mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-8">{error}</p>}
    {done ? <p role="status" className="m-5 rounded-xl bg-emerald-50 p-5 text-emerald-800 sm:m-8">RQ registrado. El equipo de Selección recibió la alerta.</p> : config && <form onSubmit={submit} noValidate className="p-5 sm:p-8">
      <nav aria-label="Progreso del requerimiento" className="mb-7 grid grid-cols-5 gap-1 sm:gap-3">{steps.map((title, index) => <div key={title} aria-current={step === index ? 'step' : undefined} className="min-w-0 text-center"><div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${index === step ? 'bg-sky-700 text-white' : index < step ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</div><p className={`mt-2 text-[10px] leading-tight sm:text-xs ${index === step ? 'font-bold text-[#143A56]' : 'text-slate-500'}`}>{title}</p></div>)}</nav>
      <div role="progressbar" aria-label="Progreso del formulario" aria-valuemin={0} aria-valuemax={5} aria-valuenow={step + 1} className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-700 transition-all" style={{ width: `${(step + 1) * 20}%` }} /></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Paso {step + 1} de {steps.length}</p><h2 className="mt-1 text-xl font-bold">{steps[step]}</h2><p className="mt-1 text-sm text-slate-500">{['Selecciona la gerencia y confirma tu identidad con el DNI.', 'Indica el tipo de requerimiento y el perfil que necesitas.', 'Detalla el sueldo y los bonos ofrecidos.', 'Completa las condiciones de la posición.', 'Revisa los datos antes de enviar el RQ.'][step]}</p>
          {!config.securityReady && <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm">Este formulario aún no tiene la verificación de seguridad configurada.</p>}
          <div ref={stepFields} className="mt-6">
            {step === 0 && <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Empresa<input className={`${field} bg-slate-50`} readOnly value={config.companyName} /></label>
              <label className="text-sm font-semibold">Gerencia *<select required className={field} value={gerenciaId} onChange={event => setGerenciaId(event.target.value)}><option value="">Selecciona una gerencia</option>{config.gerencias.map(item => <option key={item.id} value={item.id}>{item.name.replace(/\s*\([^)]*\)$/, '')}</option>)}</select></label>
              <label className="text-sm font-semibold">DNI del solicitante *<input required className={field} inputMode="numeric" enterKeyHint="go" pattern="[0-9]{8}" maxLength={8} value={dni} onChange={event => { setDni(event.target.value.replace(/\D/g, '')); resetIdentity(); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (!busy) advance(); } }} /></label>
              <label className="text-sm font-semibold">Nombre y apellido<input className={`${field} bg-slate-50`} readOnly value={name} placeholder="Se completará con el DNI" /></label>
            </div>}
            {step === 1 && <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Tipo de RQ *<select required className={field} value={form.kind} onChange={event => setForm(current => ({ ...current, kind: event.target.value, companyCampaignId: '' }))}><option value="MASIVA">Campaña masiva</option><option value="STAFF">Puesto de staff</option></select></label>
              {form.kind === 'MASIVA' && <label className="text-sm font-semibold">Campaña *<select required className={field} value={form.companyCampaignId} onChange={event => setForm(current => ({ ...current, companyCampaignId: event.target.value }))}><option value="">Selecciona una campaña</option>{config.campaigns.filter(item => !item.id.endsWith(':staff-rq')).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
              <label className="text-sm font-semibold">Perfil requerido *<select required className={field} value={form.profileRequired} onChange={event => setForm(current => ({ ...current, profileRequired: event.target.value }))}><option value="">Selecciona un perfil</option>{['Teleoperador de Ventas', 'Live Commerce', 'Streaming'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className="text-sm font-semibold">Cantidad de FTs *<input required type="number" min={1} max={10000} className={field} value={form.fts} onChange={event => setForm(current => ({ ...current, fts: Number(event.target.value) }))} /></label>
            </div>}
            {step === 2 && <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Sueldo (S/) *<input required type="number" min={0} step="0.01" className={field} value={form.salary} onChange={event => setForm(current => ({ ...current, salary: Number(event.target.value) }))} /></label>
              <label className="text-sm font-semibold">Bono variable (S/) *<input required type="number" min={0} step="0.01" className={field} value={form.variableBonus} onChange={event => setForm(current => ({ ...current, variableBonus: Number(event.target.value) }))} /></label>
              <label className="text-sm font-semibold">Bono de movilidad (S/) *<input required type="number" min={0} step="0.01" className={field} value={form.mobilityBonus} onChange={event => setForm(current => ({ ...current, mobilityBonus: Number(event.target.value) }))} /></label>
            </div>}
            {step === 3 && <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Fecha esperada de ingreso *<input required type="date" className={field} value={form.expectedStart} onChange={event => setForm(current => ({ ...current, expectedStart: event.target.value }))} /></label>
              <label className="text-sm font-semibold">Criticidad *<select required className={field} value={form.criticality} onChange={event => setForm(current => ({ ...current, criticality: event.target.value }))}>{['BAJA', 'MEDIA', 'ALTA', 'CRITICA'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className="text-sm font-semibold">Horario *<input required minLength={2} maxLength={200} className={field} value={form.schedule} onChange={event => setForm(current => ({ ...current, schedule: event.target.value }))} /></label>
              <label className="text-sm font-semibold">Modalidad *<select required className={field} value={form.modality} onChange={event => setForm(current => ({ ...current, modality: event.target.value }))}><option value="">Selecciona la modalidad</option><option value="PRESENCIAL">Presencial</option><option value="REMOTA">Remota</option></select></label>
              <label className="block text-sm font-semibold sm:col-span-2">Observaciones<textarea maxLength={2000} rows={4} className={field} value={form.observations} onChange={event => setForm(current => ({ ...current, observations: event.target.value }))} /></label>
            </div>}
            {step === 4 && <dl className="grid gap-3 sm:grid-cols-2">{summary.map(([title, value]) => <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><dt className="text-xs font-semibold text-slate-500">{title}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}</dl>}
          </div>
          <div ref={widget} className={step === 0 && !nonce ? 'mt-5' : 'hidden'} />
          {step === 0 && !nonce && <p className="mt-2 text-xs text-slate-500">Completa la verificación y pulsa Enter en el DNI o “Continuar” para identificarte.</p>}
          <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">{step > 0 && <button type="button" onClick={() => { setError(''); setStep(current => current - 1); }} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-[#143A56] hover:bg-slate-50">Volver</button>}<button type="submit" disabled={busy} className="rounded-xl bg-[#143A56] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0d2d45] disabled:opacity-50">{busy ? 'Procesando…' : step === 4 ? 'Enviar RQ' : 'Continuar →'}</button></div>
        </div>
        <aside className="space-y-4 text-sm"><div className="rounded-2xl bg-sky-50 p-5"><p className="font-bold">Tu requerimiento está protegido</p><p className="mt-2 leading-6 text-slate-600">Solo las personas autorizadas de Operaciones y Selección pueden gestionar estos datos.</p></div><div className="rounded-2xl border border-slate-200 p-5"><p className="font-bold">¿En qué consiste el proceso?</p><ol className="mt-4 space-y-4 text-slate-600"><li><b className="text-[#143A56]">1. Identifícate</b><p>Confirmamos tu usuario mediante DNI.</p></li><li><b className="text-[#143A56]">2. Completa el RQ</b><p>Indica el perfil y las condiciones.</p></li><li><b className="text-[#143A56]">3. Lo recibe Selección</b><p>El equipo verá la alerta para gestionar la convocatoria.</p></li></ol></div></aside>
      </div>
    </form>}
  </section></main>;
}
