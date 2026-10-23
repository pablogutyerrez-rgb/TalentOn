export const captureWorkdays = ['Full time', 'Semi full', 'Part time'] as const;
export const captureShifts = ['Turno mañana', 'Turno tarde'] as const;
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
  if (!Array.isArray(v.schedules) || v.schedules.length !== captureShifts.length ||
      v.schedules.some((x, i) => x !== captureShifts[i]))
    throw new Error('Solo se permiten Turno mañana y Turno tarde.');
  if (v.modality !== 'Presencial' && v.modality !== 'Remota') throw new Error('Selecciona presencial o remota.');
  return {minAge: Number(v.minAge), maxAge: v.maxAge === null ? null : Number(v.maxAge),
    workdays: [...v.workdays], schedules: [...captureShifts], modality: v.modality};
}
export function captureConfig(raw: unknown): CaptureCampaignConfig | undefined {
  try {
    // Read old published schedules without changing stored configuration or historical answers.
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const legacy = raw as Record<string, unknown>;
    if (!Array.isArray(legacy.schedules) || !legacy.schedules.length ||
        legacy.schedules.some(x => typeof x !== 'string' || !x.trim())) return undefined;
    return validateCaptureCampaignConfig({...legacy, schedules: [...captureShifts]});
  } catch { return undefined; }
}
