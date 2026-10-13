import { describe, expect, it } from 'vitest';
import { candidatePreferences } from '../src/candidatePreferences';
import { workModalities, workSchedules } from '../../shared/candidatePreferences';

describe('Preferencias del postulante', () => {
  it('mantiene compatibilidad con expedientes sin preferencias', () => {
    expect(candidatePreferences({})).toEqual({});
    expect(candidatePreferences({ workModality: '', workSchedule: '' })).toEqual({ workModality: '', workSchedule: '' });
  });
  it('acepta todas las opciones solicitadas, no otros campos', () => {
    for (const workModality of workModalities) for (const workSchedule of workSchedules) {
      expect(candidatePreferences({ workModality, workSchedule, role: 'ADMIN' })).toEqual({ workModality, workSchedule });
    }
  });
  it('rechaza valores arbitrarios y tipos incorrectos', () => {
    for (const value of [null, 1, {}, ['Remoto'], 'Hibrido', 'Otro']) {
      expect(() => candidatePreferences({ workModality: value })).toThrow();
      expect(() => candidatePreferences({ workSchedule: value })).toThrow();
    }
  });
});
