import React, { useEffect, useRef, useState } from 'react';
import { publicCaptureApi } from '../services/captureApi';
import { TechCenterFields } from '../components/capture/TechCenterFields';
import { COMPANY_CAPTURE_FORM, companyText, changeCaptureAnswer, selectedCaptureConfig, type CaptureCampaignOption, techCenterIntro, techCenterPrivacy, techCenterPrivacyNote } from '../../shared/techCenterForm';
type Turnstile = { render: (el: HTMLElement, options: object) => string; remove: (id: string) => void; reset: (id: string) => void };
export function PublicCaptureView({ token }: { token: string }) {
  const [active, setActive] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(false), [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState(''), widget = useRef<HTMLDivElement>(null), widgetId = useRef(''), requestId = useRef(crypto.randomUUID());
  const [data, setData] = useState({ fullName: '', phone: '', email: '', documentType: 'DNI', documentNumber: '', district: '', consent: false, website: '' });
  const [sitekey, setSitekey] = useState('');
  const [formId, setFormId] = useState('');
  const [techAnswers, setTechAnswers] = useState<Record<string, string>>({});
  const [companyName, setCompanyName] = useState('');
  const [campaigns, setCampaigns] = useState<CaptureCampaignOption[]>([]);
  const selectedConfig = selectedCaptureConfig(techAnswers,campaigns);
  useEffect(() => {
    let cancelled = false;
    setActive(false); setChallenge(''); setError(''); setSuccess(false); setSitekey('');
    setFormId(''); setCompanyName(''); setCampaigns([]); setTechAnswers({}); setData({ fullName: '', phone: '', email: '', documentType: 'DNI', documentNumber: '', district: '', consent: false, website: '' });
    requestId.current = crypto.randomUUID();
    publicCaptureApi<{ turnstileSiteKey?: string; securityReady?: boolean; formId?: string; companyName?:string; campaigns?:CaptureCampaignOption[] }>(token).then(config => {
      if (cancelled) return;
      const key = config.turnstileSiteKey || import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
      setActive(true);
      setFormId(config.formId || ''); setCompanyName(config.companyName || ''); setCampaigns(config.campaigns || []);
      if(config.formId !== COMPANY_CAPTURE_FORM || !config.companyName){setError('El formulario está actualizándose. Recarga la página en unos momentos.');return;}
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

  return <main className="talent-app min-h-screen bg-slate-50 px-4 py-8"><section className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <p className="mb-4 text-lg font-bold tracking-wide text-[#143A56]">{companyName}</p>
    <h1 className="text-2xl font-bold">Formulario de registro de postulantes</h1>
    {companyName && techCenterIntro.map(paragraph => <p key={paragraph} className="mt-3 text-sm text-slate-600">{companyText(paragraph,companyName)}</p>)}
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success ? <p role="status" className="mt-6 rounded-lg bg-emerald-50 p-4 text-emerald-700">Tu postulación fue registrada correctamente. Gracias por tu interés.</p> : active && formId === COMPANY_CAPTURE_FORM && <form className="mt-5 space-y-4" onSubmit={async e => { e.preventDefault(); if (busy || !challenge || !campaigns.length) return; setBusy(true); setError(''); try { await publicCaptureApi(token, { ...techAnswers, privacyAcknowledged: data.consent, website: data.website, turnstileToken: challenge, requestId: requestId.current }); setSuccess(true); } catch(e) { setError(e instanceof Error ? e.message : 'No se pudo enviar.'); const api = (window as unknown as { turnstile?: Turnstile }).turnstile; if(widgetId.current) api?.reset(widgetId.current); setChallenge(''); } finally { setBusy(false); } }}>
    {!campaigns.length && <p role="status" className="rounded-lg bg-orange-50 p-3 text-sm">Esta empresa no tiene campañas disponibles para postular en este momento.</p>}
    {techAnswers.preferredCampaign && !selectedConfig && <p role="status" className="rounded-lg bg-orange-50 p-3 text-sm">Esta campaña tiene pendiente la configuración del formulario. Contacta al responsable del enlace o selecciona otra campaña.</p>}
    <TechCenterFields companyName={companyName} campaigns={campaigns} values={techAnswers} onChange={(key,value)=>setTechAnswers(previous=>changeCaptureAnswer(previous,key,value,campaigns))} />
    <div className="hidden" aria-hidden="true"><input tabIndex={-1} autoComplete="off" value={data.website} onChange={e => setData({ ...data, website: e.target.value })} /></div>
    <section className="space-y-4 border-t border-slate-200 pt-5">
      <h2 className="text-sm font-bold text-[#143A56]">6. PROTECCIÓN DE DATOS PERSONALES</h2>
      <aside className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600"><b>Aviso de privacidad</b><p className="mt-2">{companyText(techCenterPrivacy,companyName)}</p></aside>
      <p className="text-sm font-semibold">Declaración de conocimiento (*)</p>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={data.consent} onChange={e => setData({ ...data, consent: e.target.checked })} />He leído la información sobre el tratamiento de mis datos personales.</label>
      <p className="text-xs italic text-slate-500">{techCenterPrivacyNote}</p>
    </section>
    <div ref={widget} /><button disabled={busy || !challenge || !selectedConfig} className="w-full rounded-lg bg-sky-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Registrando…' : 'Enviar postulación'}</button>
    </form>}</section></main>;
}
