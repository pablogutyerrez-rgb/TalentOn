import type { Env } from './index';

export type Data = Record<string, any>;
type Actor = { uid: string; role: string; companyId: string; allowedModules: string[]; subordinateUserIds?: string[] };
export type Helpers = { token: (env: Env) => Promise<string>; encode: (data: Data) => any; decode: (data: any) => Data };
export const captureSources = ['Facebook', 'TikTok', 'LinkedIn', 'WhatsApp', 'Referidos', 'Otros'];
export const captureStates = ['Nuevo', 'Contactado', 'No responde', 'Interesado', 'No interesado'];
export class CaptureError extends Error { constructor(message: string, public status = 400) { super(message); } }
const text = (v: unknown, max: number) => typeof v === 'string' ? v.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, max) : '';
const digits = (v: unknown) => text(v, 40).replace(/\D/g, '');
const phone = (v: unknown) => { const n = digits(v); return n.length === 11 && n.startsWith('51') ? n.slice(2) : n; };
export function captureInput(v: Data) {
  const fullName = text(v.fullName, 120), documentType = text(v.documentType, 20);
  const documentNumber = text(v.documentNumber, 24).toUpperCase().replace(/[\s-]/g, '');
  const normalizedPhone = phone(v.phone), email = text(v.email, 160).toLowerCase(), district = text(v.district, 80);
  if (fullName.length < 5 || !fullName.includes(' ') || !['DNI', 'CE', 'PASAPORTE'].includes(documentType) ||
    !(documentType === 'DNI' ? /^\d{8}$/.test(documentNumber) : /^[A-Z0-9]{6,20}$/.test(documentNumber)) ||
    !/^9\d{8}$/.test(normalizedPhone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || district.length < 2 || v.consent !== true || v.website) throw new CaptureError('Revisa tus datos y acepta el aviso de privacidad.');
  return { fullName, documentType, documentNumber, phone: normalizedPhone, email, district };
}
function allowed(actor: Actor) {
  if (actor.role !== 'ADMIN' && (!['RECLUTADOR', 'ANALISTA_SELECCION'].includes(actor.role) || !actor.allowedModules.includes('SELECCION'))) throw new CaptureError('FORBIDDEN', 403);
}
export function owns(actor: Actor, record: Data) {
  allowed(actor);
  if (actor.role === 'ANALISTA_SELECCION') throw new CaptureError('FORBIDDEN', 403);
  if (actor.role !== 'ADMIN' && (record.ownerUid !== actor.uid || record.companyId !== actor.companyId)) throw new CaptureError('FORBIDDEN', 403);
}
async function digest(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
const randomToken = () => [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
export function matchIdentity(applicant: Data, candidates: Data[]) {
  const documentMatches = candidates.filter(c => (c.documentType || 'DNI') === applicant.documentType && text(c.documentNumber || c.dni, 24).toUpperCase().replace(/[\s-]/g, '') === applicant.documentNumber);
  const contacts = candidates.filter(c => phone(c.phone) === applicant.phone || (applicant.email && text(c.email, 160).toLowerCase() === applicant.email));
  const confirmed = documentMatches.length === 1 ? documentMatches[0] : undefined;
  const conflict = documentMatches.length > 1 || contacts.some(c => c.id !== confirmed?.id);
  return { candidateId: confirmed?.id as string | undefined, conflict, possibleIds: [...new Set([...documentMatches, ...contacts].map(c => c.id))] };
}

export class Store {
  private root: string;
  constructor(private env: Env, private helpers: Helpers, private token: string) { this.root = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`; }
  private async call(path: string, body?: Data, method = 'POST'): Promise<any> {
    const r = await fetch(this.root + path, { method, headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (r.status === 404) return undefined;
    if (!r.ok) throw new CaptureError(r.status === 409 ? 'CAPTURE_RETRY' : 'Servicio de captación temporalmente no disponible.', r.status === 409 ? 409 : 502);
    return r.json();
  }
  async get(path: string, tx?: string): Promise<Data | undefined> {
    if(this.env.DATA_PROVIDER!=='firebase') return this.env.RELATIONAL_RUNTIME!.get(path);
    const d = await this.call(`/${path}${tx ? `?transaction=${encodeURIComponent(tx)}` : ''}`, undefined, 'GET');
    return d ? { ...this.helpers.decode(d.fields || {}), id: path.split('/').pop() } : undefined;
  }
  async query(collection: string, filters: Data, tx?: string, limit = 201): Promise<Data[]> {
    if(this.env.DATA_PROVIDER!=='firebase') return this.env.RELATIONAL_RUNTIME!.query(collection,filters,limit);
    const ff = Object.entries(filters).map(([fieldPath, value]) => ({ fieldFilter: { field: { fieldPath }, op: 'EQUAL', value: this.helpers.encode({ value }).value } }));
    const result = await this.call(':runQuery', { ...(tx ? { transaction: tx } : {}), structuredQuery: { from: [{ collectionId: collection }], ...(ff.length ? { where: ff.length === 1 ? ff[0] : { compositeFilter: { op: 'AND', filters: ff } } } : {}), limit } });
    return result.flatMap((item: any) => item.document ? [{ ...this.helpers.decode(item.document.fields || {}), id: item.document.name.split('/').pop() }] : []);
  }
  async atomic<T>(work: (tx: string) => Promise<{ result: T; writes: { path: string; data: Data; create?: boolean; patch?: boolean }[] }>): Promise<T> {
    if(this.env.DATA_PROVIDER!=='firebase') { const result=await work('RELATIONAL_REQUEST_TRANSACTION');for(const w of result.writes)await this.env.RELATIONAL_RUNTIME!.write(w.path,w.data,w.create);return result.result; }
    for (let attempt = 0; attempt < 3; attempt++) {
      const { transaction } = await this.call(':beginTransaction', { options: { readWrite: {} } });
      try {
        const { result, writes } = await work(transaction);
        await this.call(':commit', { transaction, writes: writes.map(w => ({ update: { name: this.root.replace('https://firestore.googleapis.com/v1/', '') + '/' + w.path, fields: this.helpers.encode(w.data) }, ...(w.create ? { currentDocument: { exists: false } } : {}), ...(w.patch ? { updateMask: { fieldPaths: Object.keys(w.data) } } : {}) })) });
        return result;
      } catch (e) {
        await this.call(':rollback', { transaction }).catch(() => undefined);
        if (!(e instanceof CaptureError) || e.message !== 'CAPTURE_RETRY' || attempt === 2) throw e;
      }
    }
    throw new CaptureError('Inténtalo nuevamente.', 409);
  }
}

export async function body(request: Request): Promise<Data> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new CaptureError('INVALID_CONTENT_TYPE');
  const reader = request.body?.getReader(); if (!reader) throw new CaptureError('INVALID_BODY');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > 8192) { await reader.cancel(); throw new CaptureError('Solicitud demasiado grande.', 413); } chunks.push(chunk.value); }
  const bytes = new Uint8Array(size); let offset = 0; chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.length; }); const raw = new TextDecoder().decode(bytes);
  try { const data = JSON.parse(raw); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); return data; } catch { throw new CaptureError('INVALID_BODY'); }
}
async function challenge(request: Request, env: Env, input: Data) {
  if (!env.CAPTURE_HASH_SECRET || !env.TURNSTILE_SECRET_KEY) throw new CaptureError('Captación pública pendiente de configuración.', 503);
  const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: text(input.turnstileToken, 2048), remoteip: request.headers.get('cf-connecting-ip') || '', idempotency_key: input.requestId }) });
  const verified = await result.json<{ success?: boolean; hostname?: string; action?: string }>();
  const hostnames = [env.ALLOWED_ORIGIN, env.PRODUCTION_ORIGIN].flatMap(s => (s || '').split(',')).map(s => { try { return new URL(s.trim()).hostname; } catch { return ''; } });
  if (!result.ok || !verified.success || verified.action !== 'capture' || !hostnames.includes(verified.hostname || '')) throw new CaptureError('No se pudo verificar el envío. Reintenta la verificación.', 403);
}

export async function handleCapture(request: Request, env: Env, actor: Actor | undefined, helpers: Helpers): Promise<Response | undefined> {
  const url = new URL(request.url), path = url.pathname;
  if (!path.startsWith('/api/capture') && !path.startsWith('/api/public/capture/')) return;
  const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
  if (!actor && !path.startsWith('/api/public/')) return;
  if (actor) allowed(actor);
  const store = new Store(env, helpers, await helpers.token(env));
  const managerOwners = async () => {
    const users = await store.query('users', actor?.role === 'ADMIN' ? {} : { companyId: actor?.companyId }, undefined, 2001);
    if (users.length > 2000) throw new CaptureError('El equipo supera el límite de consulta gerencial. Requiere paginación.', 503);
    return users.filter(u => actor?.role === 'ADMIN' || (u.role === 'RECLUTADOR' && actor?.subordinateUserIds?.includes(u.id))).map(u => ({ uid: u.id, name: u.displayName || u.name || u.username || 'Sin nombre', companyId: u.companyId, role: u.role, active: u.status === 'ACTIVO' && u.enabled !== false }));
  };
  if (path === '/api/capture/management' && request.method === 'GET') {
    if (!actor || !['ADMIN', 'ANALISTA_SELECCION'].includes(actor.role)) throw new CaptureError('FORBIDDEN', 403);
    const owners = await managerOwners(), ids = new Set(owners.map(u => u.uid));
    const scoped = (e: Data) => actor.role === 'ADMIN' || (e.companyId === actor.companyId && ids.has(e.ownerUid));
    const queryScope = actor.role === 'ADMIN' ? {} : { companyId: actor.companyId };
    const links = await store.query('captureLinks', queryScope, undefined, 2001), events = await store.query('captations', queryScope, undefined, 2001);
    if (links.length > 2000 || events.length > 2000) throw new CaptureError('Los registros superan el límite gerencial. Se requiere paginación antes de consolidar.', 503);
    return reply({ owners, links: links.filter(scoped), events: events.filter(scoped).map(({ possibleIds, ...e }) => actor.role === 'ADMIN' ? { ...e, possibleIds } : e), generatedAt: new Date().toISOString() });
  }
  const pub = path.match(/^\/api\/public\/capture\/([a-f0-9]{48})$/);
  if (pub && ['GET', 'POST'].includes(request.method)) {
    const link = await store.get(`captureLinks/${pub[1]}`);
    if (!link || link.active !== true) throw new CaptureError('Este enlace no está disponible.', 404);
    const owner = await store.get(`users/${link.ownerUid}`);
    if (!owner || owner.enabled === false || owner.status !== 'ACTIVO' || !['ADMIN', 'RECLUTADOR'].includes(owner.role) || owner.companyId !== link.companyId || (owner.role !== 'ADMIN' && !(owner.allowedModules || owner.module || []).includes('SELECCION'))) throw new CaptureError('Este enlace no está disponible.', 404);
    if (request.method === 'GET') return reply({
      active: true, noticeVersion: 'capture-v1',
      turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
      securityReady: Boolean(env.CAPTURE_HASH_SECRET && env.TURNSTILE_SECRET_KEY),
    });
    const input = await body(request), applicant = captureInput(input);
    if (!/^[a-f0-9-]{36}$/.test(input.requestId || '')) throw new CaptureError('INVALID_REQUEST_ID');
    if (!env.CAPTURE_HASH_SECRET) throw new CaptureError('Captación pública pendiente de configuración.', 503);
    const requestKey = await digest(env.CAPTURE_HASH_SECRET!, `request:${pub[1]}:${input.requestId}`);
    const fingerprint = await digest(env.CAPTURE_HASH_SECRET!, JSON.stringify(applicant));
    const retry = await store.get(`captureRequests/${requestKey}`);
    if (retry) { if (retry.fingerprint !== fingerprint) throw new CaptureError('INVALID_RETRY', 409); return reply({ ok: true }, 201); }
    await challenge(request, env, input);
    const now = new Date().toISOString();
    const rateKey = await digest(env.CAPTURE_HASH_SECRET!, `ip:${request.headers.get('cf-connecting-ip') || 'local'}:${Math.floor(Date.now() / 60000)}`);
    const lockKey = await digest(env.CAPTURE_HASH_SECRET!, `identity:${link.companyId}:${applicant.documentType}:${applicant.documentNumber}`);
    const result = await store.atomic(async tx => {
      const current = await store.get(`captureLinks/${pub[1]}`, tx);
      if (!current?.active) throw new CaptureError('Este enlace no está disponible.', 404);
      const currentOwner = await store.get(`users/${link.ownerUid}`, tx);
      if (!currentOwner || currentOwner.enabled === false || currentOwner.status !== 'ACTIVO' || currentOwner.companyId !== link.companyId || !['ADMIN', 'RECLUTADOR'].includes(currentOwner.role) || (currentOwner.role !== 'ADMIN' && !(currentOwner.allowedModules || currentOwner.module || []).includes('SELECCION'))) throw new CaptureError('Este enlace no está disponible.', 404);
      const previous = await store.get(`captureRequests/${requestKey}`, tx);
      if (previous) { if (previous.fingerprint !== fingerprint) throw new CaptureError('INVALID_RETRY', 409); return { result: { ok: true }, writes: [] }; }
      const rate = await store.get(`captureRateLimits/${rateKey}`, tx);
      if ((rate?.count || 0) >= 5) throw new CaptureError('Demasiados envíos. Espera un minuto.', 429);
      const identity = await store.get(`captureIdentities/${lockKey}`, tx);
      const candidates = await store.query('candidates', { companyId: link.companyId }, tx, 2001);
      if (candidates.length > 2000) throw new CaptureError('La revisión de identidad requiere configuración administrativa.', 503);
      if (identity && !candidates.some(c => c.id === identity.candidateId)) throw new CaptureError('La identidad requiere revisión administrativa.', 409);
      const matched = matchIdentity(applicant, candidates);
      const candidateId = identity?.candidateId || matched.candidateId || `CAP-${crypto.randomUUID()}`;
      const eventId = crypto.randomUUID(), conflict = matched.conflict;
      const event = { id: eventId, candidateId, linkId: pub[1], companyId: link.companyId, ownerUid: link.ownerUid, source: link.source, createdAt: now, status: 'Nuevo', applicant, conflict, possibleIds: matched.possibleIds, consent: { accepted: true, version: 'capture-v1', acceptedAt: now }, history: [{ at: now, actorUid: 'PUBLIC', action: 'Registro', status: 'Nuevo', note: '' }] };
      const writes: { path: string; data: Data; create?: boolean }[] = [
        { path: `captations/${eventId}`, data: event, create: true },
        { path: `captureRequests/${requestKey}`, data: { fingerprint, createdAt: now }, create: true },
        { path: `captureRateLimits/${rateKey}`, data: { count: (rate?.count || 0) + 1, expiresAt: new Date(Date.now() + 86400000).toISOString() } },
      ];
      if (!identity) writes.push({ path: `captureIdentities/${lockKey}`, data: { candidateId, companyId: link.companyId }, create: true });
      if (!identity && !matched.candidateId) writes.push({ path: `candidates/${candidateId}`, data: { id: candidateId, companyId: link.companyId, captureOnly: true, dni: applicant.documentNumber, documentType: applicant.documentType, documentNumber: applicant.documentNumber, fullName: applicant.fullName, phone: applicant.phone, email: applicant.email, district: applicant.district, city: applicant.district, recruiterId: link.ownerUid, campaignId: '', createdAt: now }, create: true });
      return { result: { ok: true }, writes };
    });
    return reply(result, 201);
  }
  if (!actor) throw new CaptureError('NOT_FOUND', 404);
  if (actor.role === 'ANALISTA_SELECCION' && !/^\/api\/capture\/candidates\/[^/]+$/.test(path)) throw new CaptureError('FORBIDDEN', 403);
  const filter = actor.role === 'ADMIN' ? {} : { ownerUid: actor.uid };
  if (path === '/api/capture/links' && request.method === 'GET') {
    const data = (await store.query('captureLinks', filter)).filter(x => actor.role === 'ADMIN' || x.companyId === actor.companyId);
    return reply({ items: data.slice(0, 200), truncated: data.length > 200 });
  }
  if (path === '/api/capture/links' && request.method === 'POST') {
    if (!['ADMIN', 'RECLUTADOR'].includes(actor.role)) throw new CaptureError('FORBIDDEN', 403);
    const input = await body(request); if (!captureSources.includes(input.source) || !actor.companyId) throw new CaptureError('INVALID_SOURCE_OR_COMPANY');
    const id = randomToken(), link = { id, source: input.source,companyCampaignId:input.companyCampaignId, ownerUid: actor.uid, companyId: actor.companyId, active: true, createdAt: new Date().toISOString() };
    await store.atomic(async () => ({ result: undefined, writes: [{ path: `captureLinks/${id}`, data: link, create: true }, { path: `captureAudit/${crypto.randomUUID()}`, data: { at: link.createdAt, actorUid: actor.uid, linkId: id, action: 'Creación enlace' }, create: true }] }));
    return reply(link, 201);
  }
  const linkPath = path.match(/^\/api\/capture\/links\/([a-f0-9]{48})$/);
  if (linkPath && request.method === 'PATCH') {
    const input = await body(request); if (typeof input.active !== 'boolean') throw new CaptureError('INVALID_STATE');
    await store.atomic(async tx => {
      const link = await store.get(`captureLinks/${linkPath[1]}`, tx); if (!link) throw new CaptureError('NOT_FOUND', 404); owns(actor, link);
      const at = new Date().toISOString();
      return { result: undefined, writes: [{ path: `captureLinks/${linkPath[1]}`, data: { active: input.active, updatedAt: at }, patch: true }, { path: `captureAudit/${crypto.randomUUID()}`, data: { at, actorUid: actor.uid, linkId: link.id, active: input.active, action: 'Estado enlace' }, create: true }] };
    }); return reply({ ok: true });
  }
  if (path === '/api/capture/inbox' && request.method === 'GET') {
    const events = (await store.query('captations', filter)).filter(x => actor.role === 'ADMIN' || x.companyId === actor.companyId);
    return reply({ items: events.slice(0, 200).map(({ possibleIds, ...e }) => actor.role === 'ADMIN' ? { ...e, possibleIds } : e), truncated: events.length > 200 });
  }
  const eventPath = path.match(/^\/api\/capture\/events\/([a-f0-9-]{36})$/);
  if (eventPath && request.method === 'PATCH') {
    const input = await body(request); if (!captureStates.includes(input.status) || (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 1000))) throw new CaptureError('INVALID_MANAGEMENT');
    await store.atomic(async tx => {
      const event = await store.get(`captations/${eventPath[1]}`, tx); if (!event) throw new CaptureError('NOT_FOUND', 404); owns(actor, event);
      if ((event.history || []).length >= 500) throw new CaptureError('Historial completo. Contacta al administrador.', 409);
      return { result: undefined, writes: [{ path: `captations/${event.id}`, data: { status: input.status, history: [...event.history, { at: new Date().toISOString(), actorUid: actor.uid, action: 'Gestión', previousStatus: event.status, status: input.status, note: text(input.note, 1000) }] }, patch: true }] };
    }); return reply({ ok: true });
  }
  const dossier = path.match(/^\/api\/capture\/candidates\/([a-zA-Z0-9_-]{1,100})$/);
  if (dossier && request.method === 'GET') {
    const supervised = actor.role === 'ANALISTA_SELECCION' ? new Set((await managerOwners()).map(u => u.uid)) : new Set<string>();
    const events = (await store.query('captations', { candidateId: dossier[1] }, undefined, 501)).filter(e => actor.role === 'ADMIN' || (e.companyId === actor.companyId && (e.ownerUid === actor.uid || supervised.has(e.ownerUid))));
    if (!events.length) throw new CaptureError('FORBIDDEN', 403);
    const candidate = await store.get(`candidates/${dossier[1]}`); if (!candidate) throw new CaptureError('NOT_FOUND', 404);
    if (actor.role !== 'ADMIN' && candidate.companyId !== actor.companyId) throw new CaptureError('FORBIDDEN', 403);
    // A recruiter sees only personal information they received, never another recruiter's history.
    const applicant = actor.role === 'ADMIN' ? { fullName: candidate.fullName, phone: candidate.phone, email: candidate.email, documentType: candidate.documentType || 'DNI', documentNumber: candidate.documentNumber || candidate.dni, district: candidate.district || candidate.city } : events[0].applicant;
    return reply({ candidate: { id: candidate.id, ...applicant }, events: events.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).map(({ possibleIds, ...e }) => actor.role === 'ADMIN' ? { ...e, possibleIds } : e) });
  }
  throw new CaptureError('NOT_FOUND', 404);
}
