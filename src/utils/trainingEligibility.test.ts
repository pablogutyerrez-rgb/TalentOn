import { describe, expect, it } from 'vitest';
import type { CandidateRecord } from '../types';
import { isCandidateAlreadyInTraining, isCandidateReadyForTraining } from './trainingEligibility';

const candidate = (patch: Record<string, unknown> = {}) => ({
  campaignId: 'campaign-a',
  currentStage: 'APTO_CAPACITACION',
  selection: { stage: 'APTO_CAPACITACION' },
  ...patch,
}) as unknown as CandidateRecord;

describe('disponibilidad para capacitación', () => {
  it('selecciona solo aptos de la convocatoria sin grupo previo', () => {
    expect(isCandidateReadyForTraining(candidate(), 'campaign-a')).toBe(true);
    expect(isCandidateReadyForTraining(candidate(), 'campaign-b')).toBe(false);
    expect(isCandidateReadyForTraining(candidate({ selection: { stage: 'NUEVO' } }), 'campaign-a')).toBe(false);
  });

  it('excluye inscripciones existentes incluso si el estado general sigue siendo apto', () => {
    expect(isCandidateAlreadyInTraining(candidate({ trainingId: 'group-1' }))).toBe(true);
    expect(isCandidateReadyForTraining(candidate({ trainingId: 'group-1' }), 'campaign-a')).toBe(false);
    expect(isCandidateReadyForTraining(candidate({ training: { cohortId: 'group-2' } }), 'campaign-a')).toBe(false);
  });
});
