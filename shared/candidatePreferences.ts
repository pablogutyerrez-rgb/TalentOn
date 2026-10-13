export const workModalities = ['Remoto', 'Presencial'] as const;
export const workSchedules = ['Fulltime', 'Semifull', 'Part'] as const;
export interface CandidatePreferences {
  workModality?: '' | typeof workModalities[number];
  workSchedule?: '' | typeof workSchedules[number];
}
