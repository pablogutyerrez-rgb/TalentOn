import { workModalities, workSchedules, type CandidatePreferences } from '../../shared/candidatePreferences';
import { CaptureError } from './capture';

// Optional for existing records; never infer a preference from the campaign.
export function candidatePreferences(input: Record<string, unknown>): CandidatePreferences {
  const result: Record<string, string> = {};
  for (const [key, options] of [['workModality', workModalities], ['workSchedule', workSchedules]] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || (value !== '' && !(options as readonly string[]).includes(value))) {
      throw new CaptureError(key === 'workModality' ? 'Selecciona una modalidad válida.' : 'Selecciona una jornada válida.');
    }
    result[key] = value;
  }
  return result;
}
