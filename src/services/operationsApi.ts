import { workerApi, getWorkerErrorMessage } from './workerApi';

export interface OperationsRq {
  id: string; companyId: string; companyName: string; gerencia: string; requesterName: string;
  kind: 'MASIVA' | 'STAFF'; companyCampaignId: string | null; campaignName: string | null;
  profileRequired: string; fts: number; salary: number; expectedStart: string;
  criticality: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'; schedule: string; location: string; observations: string;
  status: 'PENDIENTE' | 'CONVOCATORIA_CREADA'; campaignId: string | null; createdAt: string;
}
export interface OperationsAdminData {
  companies: { id: string; name: string }[];
  gerencias: { id: string; companyId: string; name: string; active: boolean }[];
  links: { id: string; companyId: string; active: boolean; createdAt: string }[];
}
export const operationsApi = {
  admin: () => workerApi<OperationsAdminData>('/api/operations/admin'),
  saveGerencia: (companyId: string, name: string) => workerApi('/api/operations/gerencias', { method: 'POST', body: JSON.stringify({ companyId, name }) }),
  createLink: (companyId: string) => workerApi<{ id: string; companyId: string; token: string; url: string }>('/api/operations/links', { method: 'POST', body: JSON.stringify({ companyId }) }),
  revokeLink: (id: string) => workerApi(`/api/operations/links/${id}/revoke`, { method: 'POST' }),
  requests: () => workerApi<OperationsRq[]>('/api/operations/requests'),
  linkCampaign: (id: string, companyId: string, campaignId: string) => workerApi(`/api/operations/requests/${id}/link`, { method: 'POST', body: JSON.stringify({ companyId, campaignId }) }),
};

export async function publicOperationsApi<T>(token: string, action = '', data?: object): Promise<T> {
  const base = (import.meta.env.VITE_ADMIN_API_URL || import.meta.env.VITE_WORKER_API_URL)?.replace(/\/$/, '');
  if (!base) throw new Error('El servicio de RQ no está configurado.');
  const response = await fetch(`${base}/api/public/operations/${token}${action ? `/${action}` : ''}`, {
    method: data ? 'POST' : 'GET', headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(getWorkerErrorMessage(new Error(payload.message || ''), 'No se pudo completar la solicitud.'));
  return payload as T;
}
