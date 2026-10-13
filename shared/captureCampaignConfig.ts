export const captureWorkdays = ['Full time', 'Semi full', 'Part time'] as const;
export type CaptureCampaignConfig = {
  minAge: number;
  maxAge: number | null;
  workdays: string[];
  schedules: string[];
  modality: 'Presencial' | 'Remota';
};

// Shared by administration and the Worker. No inferred/default campaign offerings.
export function validateCaptureCampaignConfig(raw: unknown): CaptureCampaignConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Configura las condiciones de la campaña.');
  const v = raw as Record<string, unknown>;
  if (!Number.isInteger(v.minAge) || Number(v.minAge) < 0 || Number(v.minAge) > 120 ||
      (v.maxAge !== null && (!Number.isInteger(v.maxAge) || Number(v.maxAge) < Number(v.minAge) || Number(v.maxAge) > 120)))
    throw new Error('Revisa el rango de edad.');
  if (!Array.isArray(v.workdays) || !v.workdays.length || v.workdays.length > 3 ||
      v.workdays.some(x => !captureWorkdays.includes(x)) || new Set(v.workdays).size !== v.workdays.length)
    throw new Error('Selecciona las jornadas que ofrece la campaña.');
  if (!Array.isArray(v.schedules) || !v.schedules.length || v.schedules.length > 20 ||
      v.schedules.some(x => typeof x !== 'string' || !x.trim() || x.trim().length > 160))
    throw new Error('Indica los horarios de la campaña (uno por línea, máximo 20).');
  const schedules = v.schedules.map(x => String(x).normalize('NFKC').trim());
  if (new Set(schedules).size !== schedules.length) throw new Error('Los horarios no deben repetirse.');
  if (v.modality !== 'Presencial' && v.modality !== 'Remota') throw new Error('Selecciona presencial o remota.');
  return {minAge: Number(v.minAge), maxAge: v.maxAge === null ? null : Number(v.maxAge),
    workdays: [...v.workdays], schedules, modality: v.modality};
}
export function captureConfig(raw: unknown): CaptureCampaignConfig | undefined {
  try { return validateCaptureCampaignConfig(raw); } catch { return undefined; }
}
