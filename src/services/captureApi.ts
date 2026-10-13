import { workerApi } from './workerApi';
export const captureSources = ['Facebook', 'TikTok', 'LinkedIn', 'WhatsApp', 'Referidos', 'Otros'];
export const captureStates = ['Nuevo', 'Contactado', 'No responde', 'Interesado', 'No interesado'];
export interface CaptureApplicant { fullName: string; phone: string; email: string; documentType: string; documentNumber: string; district: string }
export interface CaptureLink { id: string; source: string; ownerUid: string; companyId: string; active: boolean; createdAt: string }
export interface CaptureEvent { id: string; candidateId: string; ownerUid: string; source: string; status: string; createdAt: string; conflict: boolean; applicant: CaptureApplicant; history: { at: string; actorUid: string; action: string; status: string; note: string }[]; possibleIds?: string[] }
export interface CaptureDossier { candidate: CaptureApplicant & { id: string }; events: CaptureEvent[] }
export interface CaptureManagement { owners: { uid: string; name: string; companyId: string; role: string; active: boolean }[]; links: CaptureLink[]; events: CaptureEvent[]; generatedAt: string }
export const captureApi = {
  management: () => workerApi<CaptureManagement>('/api/capture/management'),
  links: () => workerApi<{ items: CaptureLink[]; truncated: boolean }>('/api/capture/links'),
  inbox: () => workerApi<{ items: CaptureEvent[]; truncated: boolean }>('/api/capture/inbox'),
  create: (source: string,companyCampaignId?:string) => workerApi('/api/capture/links', { method: 'POST', body: JSON.stringify({ source,companyCampaignId }) }),
  toggle: (id: string, active: boolean) => workerApi(`/api/capture/links/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }),
  manage: (id: string, status: string, note: string) => workerApi(`/api/capture/events/${id}`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),
  dossier: (id: string) => workerApi<CaptureDossier>(`/api/capture/candidates/${encodeURIComponent(id)}`),
};
export async function publicCaptureApi<T>(token: string, input?: object): Promise<T> {
  const base = (import.meta.env.VITE_ADMIN_API_URL || import.meta.env.VITE_WORKER_API_URL)?.replace(/\/$/, '');
  if (!base) throw new Error('El formulario está pendiente de configuración.');
  const result = await fetch(`${base}/api/public/capture/${token}`, { method: input ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, ...(input ? { body: JSON.stringify(input) } : {}) });
  const data = await result.json(); if (!result.ok) throw new Error(data.message || 'No se pudo enviar la solicitud.'); return data;
}
