type ExperienceAnswers = Record<string, string | string[]>;

const answerText = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value.trim() : '';

export function hasExperienceAnswer(answers: ExperienceAnswers | undefined): boolean {
  return Boolean(answers && ['contactCenterExperience', 'experienceMonths', 'experienceDetails']
    .some(key => answerText(answers[key])));
}

export function formatCandidateExperience(answers: ExperienceAnswers | undefined, fallbackMonths?: number): string {
  const details = answerText(answers?.experienceDetails);
  const months = answerText(answers?.experienceMonths);
  const declared = answerText(answers?.contactCenterExperience).toLocaleLowerCase('es-PE');

  if (details) return months ? `${months} meses en contact center · ${details}` : details;
  if (months) return `${months} meses en contact center`;
  if (declared === 'no') return 'Sin experiencia en contact center declarada';
  if (declared === 'sí' || declared === 'si') return 'Con experiencia en contact center; tiempo y campañas no detallados';
  return fallbackMonths ? `${fallbackMonths} meses en contact center` : 'No informada';
}
