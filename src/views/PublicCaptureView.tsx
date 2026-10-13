import React, { useEffect, useRef, useState } from 'react';
import { publicCaptureApi } from '../services/captureApi';
import { TechCenterFields } from '../components/capture/TechCenterFields';
import { TECH_CENTER_FORM, techCenterIntro, techCenterPrivacy, techCenterPrivacyNote } from '../../shared/techCenterForm';
type Turnstile = { render: (el: HTMLElement, options: object) => string; remove: (id: string) => void; reset: (id: string) => void };
export function PublicCaptureView({ token }: { token: string }) {
  const [active, setActive] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(false), [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState(''), widget = useRef<HTMLDivElement>(null), widgetId = useRef(''), requestId = useRef(crypto.randomUUID());
  const [data, setData] = useState({ fullName: '', phone: '', email: '', documentType: 'DNI', documentNumber: '', district: '', consent: false, website: '' });
  const [sitekey, setSitekey] = useState('');
  const [formId, setFormId] = useState('');
  const [techAnswers, setTechAnswers] = useState<Record<string, string>>({});
  const techCenter = formId === TECH_CENTER_FORM;
  useEffect(() => {
    let cancelled = false;
    setActive(false); setChallenge(''); setError(''); setSuccess(false); setSitekey('');
    setFormId(''); setTechAnswers({}); setData({ fullName: '', phone: '', email: '', documentType: 'DNI', documentNumber: '', district: '', consent: false, website: '' });
    requestId.current = crypto.randomUUID();
    publicCaptureApi<{ turnstileSiteKey?: string; securityReady?: boolean; formId?: string }>(token).then(config => {
      if (cancelled) return;
      const key = config.turnstileSiteKey || import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
      setActive(true);
      setFormId(config.formId || '');
      if (!key || config.securityReady === false) {
        setError('Formulario pendiente de configuración de seguridad. Contacta al responsable del enlace.');
        return;
      }
      setSitekey(key);
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [token]);
  useEffect(() => {
    if (!active || !sitekey || !widget.current) return;
    let cancelled = false;
    const failed = () => { if (!cancelled) { setChallenge(''); setError('No se pudo cargar la verificación de seguridad. Revisa tu conexión y recarga la página.'); } };
    const init = () => {
      const api = (window as unknown as { turnstile?: Turnstile }).turnstile;
      if (!cancelled && api && widget.current && !widgetId.current) {
        try {
          widgetId.current = api.render(widget.current, {
            sitekey, action: 'capture',
            callback: (value: string) => { if (!cancelled) { setChallenge(value); setError(''); } },
            'expired-callback': () => { if (!cancelled) setChallenge(''); },
            'error-callback': failed,
          });
        } catch { failed(); }
      }
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-capture-turnstile]');
    const script = existing || document.createElement('script');
    script.addEventListener('load', init); script.addEventListener('error', failed);
    if (!existing) { script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.dataset.captureTurnstile = 'true'; document.head.appendChild(script); } else init();
    return () => { cancelled = true; script.removeEventListener('load', init); script.removeEventListener('error', failed); const api = (window as unknown as { turnstile?: Turnstile }).turnstile; if (widgetId.current) api?.remove(widgetId.current); widgetId.current = ''; };
  }, [active, sitekey]);
  const field = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm';
  return <main className="talent-app min-h-screen bg-slate-50 px-4 py-8"><section className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    {techCenter ? <p className="mb-4 text-lg font-bold tracking-wide text-[#143A56]">TECH CENTER</p> : <img src="/talent-on-sidebar-logo.png" alt="Talent-On" className="mb-5 h-16 rounded-lg bg-[#143a56] p-2" />}
    <h1 className="text-2xl font-bold">{techCenter ? 'Formulario de registro de postulantes' : 'Registra tu postulación'}</h1>
    {techCenter ? techCenterIntro.map(paragraph => <p key={paragraph} className="mt-3 text-sm text-slate-600">{paragraph}</p>) : <p className="mt-2 text-sm text-slate-500">Completa tus datos para que nuestro equipo pueda contactarte.</p>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success ? <p role="status" className="mt-6 rounded-lg bg-emerald-50 p-4 text-emerald-700">Tu postulación fue registrada correctamente. Gracias por tu interés.</p> : active && <form className="mt-5 space-y-4" onSubmit={async e => { e.preventDefault(); if (busy || !challenge) return; setBusy(true); setError(''); try { await publicCaptureApi(token, { ...(techCenter ? { ...techAnswers, privacyAcknowledged: data.consent, website: data.website } : data), turnstileToken: challenge, requestId: requestId.current }); setSuccess(true); } catch(e) { setError(e instanceof Error ? e.message : 'No se pudo enviar.'); const api = (window as unknown as { turnstile?: Turnstile }).turnstile; if(widgetId.current) api?.reset(widgetId.current); setChallenge(''); } finally { setBusy(false); } }}>
    {techCenter ? <TechCenterFields values={techAnswers} onChange={(key, value) => setTechAnswers(previous => ({ ...previous, [key]: value }))} /> : <>
    {([['fullName', 'Nombres y apellidos', 'text'], ['phone', 'Celular', 'tel'], ['email', 'Correo electrónico (opcional)', 'email'], ['documentNumber', 'Número de documento', 'text'], ['district', 'Distrito de residencia', 'text']] as const).map(([key, label, type]) => <label className="block text-sm font-semibold" key={key}>{label}<input className={field} type={type} value={data[key]} required={key !== 'email'} maxLength={key === 'fullName' ? 120 : key === 'email' ? 160 : 80} onChange={e => setData({ ...data, [key]: e.target.value })} /></label>)}
    <label className="block text-sm font-semibold">Tipo de documento<select className={field} value={data.documentType} onChange={e => setData({ ...data, documentType: e.target.value })}><option>DNI</option><option>CE</option><option>PASAPORTE</option></select></label>
    </>}
    <div className="hidden" aria-hidden="true"><input tabIndex={-1} autoComplete="off" value={data.website} onChange={e => setData({ ...data, website: e.target.value })} /></div>
    {techCenter ? <section className="space-y-4 border-t border-slate-200 pt-5">
      <h2 className="text-sm font-bold text-[#143A56]">6. PROTECCIÓN DE DATOS PERSONALES</h2>
      <aside className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600"><b>Aviso de privacidad</b><p className="mt-2">{techCenterPrivacy}</p></aside>
      <p className="text-sm font-semibold">Declaración de conocimiento (*)</p>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={data.consent} onChange={e => setData({ ...data, consent: e.target.checked })} />He leído la información sobre el tratamiento de mis datos personales.</label>
      <p className="text-xs italic text-slate-500">{techCenterPrivacyNote}</p>
    </section> : <>
      <aside className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><b>Aviso de privacidad · capture-v1</b><p className="mt-1">Talent-On registrará tus datos para contactarte y gestionar tu postulación. El acceso estará limitado al personal autorizado. No se te asignará automáticamente a una convocatoria. Para ejercer tus derechos sobre tus datos, contacta a la empresa que publicó este enlace.</p></aside><label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={data.consent} onChange={e => setData({ ...data, consent: e.target.checked })} />He leído el aviso y autorizo el tratamiento de mis datos para mi postulación.</label>
    </>}
    <div ref={widget} /><button disabled={busy || !challenge} className="w-full rounded-lg bg-sky-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Registrando…' : 'Enviar postulación'}</button>
    </form>}</section></main>;
}
