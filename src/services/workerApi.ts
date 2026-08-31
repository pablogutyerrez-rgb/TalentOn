import { auth } from './firebase';

const baseUrl = (import.meta.env.VITE_ADMIN_API_URL || import.meta.env.VITE_WORKER_API_URL)?.replace(/\/$/, '');

type WorkerErrorPayload = { message?: unknown };

export class WorkerApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'WorkerApiError';
  }
}

export async function workerApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!baseUrl || !auth?.currentUser) throw new Error('Worker API no está configurada o no existe sesión.');
  let token: string;
  try {
    token = await auth.currentUser.getIdToken();
  } catch {
    throw new WorkerApiError(0, 'FIREBASE_TOKEN_UNAVAILABLE');
  }
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    console.error(`[Worker API] ${init.method ?? 'GET'} ${path} network failure from ${window.location.origin}`);
    throw new WorkerApiError(0, 'WORKER_NETWORK_UNREACHABLE');
  }
  if (!response.ok) {
    const payload = await response.json().catch((): WorkerErrorPayload => ({}));
    const message = typeof payload.message === 'string' ? payload.message : 'WORKER_REQUEST_FAILED';
    // Solo se registra método, ruta, status y código seguro del Worker; nunca body ni credenciales.
    console.error(`[Worker API] ${init.method ?? 'GET'} ${path} failed (${response.status}): ${message}`);
    throw new WorkerApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

async function authenticatedToken(): Promise<string> {
  if (!baseUrl || !auth?.currentUser) throw new Error('Worker API no está configurada o no existe sesión.');
  try { return await auth.currentUser.getIdToken(); } catch { throw new WorkerApiError(0, 'FIREBASE_TOKEN_UNAVAILABLE'); }
}

export async function workerUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = await authenticatedToken();
  let result: Response;
  try { result = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }); }
  catch { throw new WorkerApiError(0, 'WORKER_NETWORK_UNREACHABLE'); }
  if (!result.ok) {
    const payload = await result.json().catch((): WorkerErrorPayload => ({}));
    throw new WorkerApiError(result.status, typeof payload.message === 'string' ? payload.message : 'WORKER_REQUEST_FAILED');
  }
  return result.json() as Promise<T>;
}

export async function workerDownload(path: string): Promise<Blob> {
  const token = await authenticatedToken();
  let result: Response;
  try { result = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } }); }
  catch { throw new WorkerApiError(0, 'WORKER_NETWORK_UNREACHABLE'); }
  if (!result.ok) {
    const payload = await result.json().catch((): WorkerErrorPayload => ({}));
    throw new WorkerApiError(result.status, typeof payload.message === 'string' ? payload.message : 'WORKER_REQUEST_FAILED');
  }
  return result.blob();
}
