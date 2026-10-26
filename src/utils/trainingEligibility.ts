import type { CandidateRecord } from '../types';

export function isCandidateAlreadyInTraining(candidate: CandidateRecord): boolean {
  return Boolean(candidate.trainingId || candidate.training?.cohortId);
}

export function isCandidateReadyForTraining(candidate: CandidateRecord, campaignId: string): boolean {
  return candidate.campaignId === campaignId
    && candidate.selection?.stage === 'APTO_CAPACITACION'
    && !isCandidateAlreadyInTraining(candidate);
}
