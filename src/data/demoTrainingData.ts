import { CampaignCall, CandidateRecord, LeadSourceType, TrainingCohort, UserProfile } from '../types';

export const DEMO_FORMACION_ENABLED = import.meta.env.VITE_USE_DEMO_FORMACION_DATA === 'true';

const day = (offset: number) => {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
};

const baseTrainers = [
  { id: 'demo-trainer-1', name: 'Paloma Huamán' },
  { id: 'demo-trainer-2', name: 'Dayana Rojas' },
  { id: 'demo-trainer-3', name: 'Óscar Mendoza' },
  { id: 'demo-trainer-4', name: 'Ximena Arce' },
];

const trainerPool = (viewer: UserProfile) =>
  viewer.role === 'FORMADOR'
    ? [{ id: viewer.id, name: viewer.name }, ...baseTrainers.slice(0, 3)]
    : baseTrainers;

const sources: LeadSourceType[] = ['Facebook Gratis', 'Mantra', 'Referidos', 'Grupo WhatsApp', 'Indeed', 'Reingreso'];

const attendanceFor = (candidateIndex: number, days: number, dropout = false) =>
  Array.from({ length: days }, (_, index) => {
    const dayNumber = index + 1;
    const missed = dropout && dayNumber >= Math.max(2, days - 1);
    const occasionalMiss = !dropout && (candidateIndex + dayNumber) % 13 === 0;
    return {
      date: day(-days + dayNumber),
      dayNumber,
      status: missed ? 'FALTA_INJUSTIFICADA' as const : occasionalMiss ? 'TARDANZA' as const : 'PRESENTE' as const,
      notes: missed ? 'Inasistencia registrada en base local' : undefined,
    };
  });

const evaluationsFor = (candidateIndex: number, days: number, dropout = false) => {
  if (dropout || days < 3) return [];
  return [
    {
      id: `demo-training-eval-${candidateIndex}-1`,
      moduleName: 'Evaluación teórica',
      dayNumber: 3,
      date: day(-4),
      score: 72 + (candidateIndex % 24),
      maxScore: 100,
      minRequired: 80,
      feedback: 'Evaluación registrada en base local',
      evaluator: baseTrainers[candidateIndex % baseTrainers.length].name,
    },
  ];
};

export const createDemoTrainingData = (viewer: UserProfile): { campaigns: CampaignCall[]; cohorts: TrainingCohort[]; candidates: CandidateRecord[] } => {
  const trainers = trainerPool(viewer);
  const campaignSeed = [
    { id: 'demo-form-camp-1', code: 'FORM-001', title: 'Atención al Cliente', company: 'Bitel', location: 'Lima Centro', vacancies: 25 },
    { id: 'demo-form-camp-2', code: 'FORM-002', title: 'Ventas Outbound', company: 'Mantra', location: 'Arequipa', vacancies: 20 },
    { id: 'demo-form-camp-3', code: 'FORM-003', title: 'Soporte Técnico', company: 'Talent-On', location: 'Trujillo', vacancies: 22 },
  ];

  const campaigns: CampaignCall[] = campaignSeed.map((seed, index) => ({
    id: seed.id,
    code: seed.code,
    company: seed.company,
    title: seed.title,
    client: seed.company,
    area: index === 0 ? 'Operaciones Contact Center' : index === 1 ? 'Ventas' : 'Soporte',
    serviceType: index === 0 ? 'ATENCION_CLIENTE' : index === 1 ? 'VENTAS_OUTBOUND' : 'SOPORTE_TECNICO',
    salaryBase: 1250,
    variableBonus: 350,
    adminBonus: 100,
    mobilityBonus: 80,
    requestDate: day(-35 + index * 4),
    startDate: day(-28 + index * 4),
    endDate: day(12 + index * 3),
    processType: 'EXTERNO',
    managementType: index === 1 ? 'HIBRIDO' : 'PRESENCIAL',
    vacancies: seed.vacancies,
    positionsCovered: 6 + index * 3,
    positionsPending: Math.max(0, seed.vacancies - (6 + index * 3)),
    location: seed.location,
    shift: 'Lunes a sábado 09:00-16:00',
    status: 'EN_PROCESO',
    assignedAnalystId: viewer.id,
    assignedAnalystName: viewer.name,
    responsibles: [],
    sources: sources.slice(0, 4).map((source, sourceIndex) => ({
      sourceName: source,
      isEnabled: true,
      link: '',
      leadsCount: 18 - sourceIndex * 3,
    })),
    statusHistory: [{ date: day(-35 + index * 4), previousStatus: 'BORRADOR', newStatus: 'PUBLICADO', changedBy: 'Base local' }],
  }));

  const cohortSeed = [
    { id: 'demo-cohort-1', code: 'GPO-101', campaign: campaigns[0], trainer: trainers[0], enrolled: 25, active: 24, passed: 18, dropout: 1, progress: 92, status: 'EN_OJT' as const },
    { id: 'demo-cohort-2', code: 'GPO-102', campaign: campaigns[1], trainer: trainers[1], enrolled: 20, active: 18, passed: 15, dropout: 2, progress: 86, status: 'EN_CAPACITACION' as const },
    { id: 'demo-cohort-3', code: 'GPO-103', campaign: campaigns[2], trainer: trainers[2], enrolled: 22, active: 19, passed: 12, dropout: 3, progress: 72, status: 'EN_CAPACITACION' as const },
    { id: 'demo-cohort-4', code: 'GPO-104', campaign: campaigns[0], trainer: trainers[3], enrolled: 18, active: 15, passed: 10, dropout: 3, progress: 64, status: 'EN_OJT' as const },
    { id: 'demo-cohort-5', code: 'GPO-105', campaign: campaigns[1], trainer: trainers[0], enrolled: 16, active: 13, passed: 9, dropout: 3, progress: 48, status: 'EN_CAPACITACION' as const },
    { id: 'demo-cohort-6', code: 'GPO-106', campaign: campaigns[2], trainer: trainers[1], enrolled: 19, active: 19, passed: 19, dropout: 0, progress: 100, status: 'FINALIZADA' as const },
  ];

  const cohorts: TrainingCohort[] = cohortSeed.map((seed, index) => ({
    id: seed.id,
    code: seed.code,
    name: `${seed.campaign.title} - Semana ${index + 1}`,
    campaignId: seed.campaign.id,
    campaignName: seed.campaign.title,
    company: seed.campaign.company,
    convocatoriaId: seed.campaign.id,
    convocatoriaCode: seed.campaign.code,
    coordinatorId: viewer.id,
    coordinatorName: viewer.name,
    trainerId: seed.trainer.id,
    trainerName: seed.trainer.name,
    startDate: day(-12 + index),
    endDate: day(5 + index),
    ojtStartDate: day(-2 + index),
    ojtEndDate: day(10 + index),
    totalDays: 10,
    ojtTotalDays: 5,
    schedule: '09:00-16:00',
    modality: index % 2 === 0 ? 'PRESENCIAL' : 'HIBRIDO',
    location: seed.campaign.location,
    roomOrLink: 'Aula demo',
    enrolledCount: seed.enrolled,
    activeCount: seed.active,
    passedCount: seed.passed,
    dropoutCount: seed.dropout,
    passingMinGrade: 80,
    product: seed.campaign.title,
    status: seed.status,
    progressPercent: seed.progress,
    participantIds: [],
  }));

  const names = ['Ana Pérez', 'Luis Campos', 'María López', 'Juan Carlos Pérez', 'Rosa Méndez', 'Pedro Antonio León', 'Andrea Torres', 'Jorge Luis Vega', 'Nicolás Castillo', 'Valeria Suárez'];
  const dropoutCategories = ['INASISTENCIA', 'CONECTIVIDAD_EQUIPOS', 'DIFICULTAD_CAPACITACION', 'LABORAL', 'PERSONAL', 'EXPECTATIVAS_PUESTO'] as const;

  const candidates: CandidateRecord[] = cohorts.flatMap((cohort, cohortIndex) =>
    Array.from({ length: cohort.enrolledCount }, (_, localIndex) => {
      const globalIndex = cohortIndex * 30 + localIndex;
      const dropped = localIndex >= cohort.activeCount;
      const ready = !dropped && localIndex < cohort.passedCount;
      const inOjt = !dropped && (cohort.status === 'EN_OJT' || ready || localIndex % 4 === 0);
      const campaign = campaigns.find(item => item.id === cohort.campaignId) || campaigns[0];
      const score = 70 + (globalIndex % 28);
      const dropoutCategory = dropoutCategories[globalIndex % dropoutCategories.length];
      return {
        id: `demo-training-candidate-${globalIndex + 1}`,
        dni: `74${String(829100 + globalIndex).slice(-6)}`,
        fullName: `${names[globalIndex % names.length]} ${Math.floor(globalIndex / names.length) + 1}`,
        email: `formacion.demo${globalIndex + 1}@talent-on.invalid`,
        phone: `984${String(710000 + globalIndex).slice(-6)}`,
        city: campaign.location,
        district: campaign.location,
        address: 'Av. Demo 123',
        birthDate: '1997-08-15',
        age: 27,
        experienceMonths: 8 + (globalIndex % 30),
        englishLevel: 'BASICO',
        avatarUrl: '',
        source: sources[globalIndex % sources.length],
        campaignId: campaign.id,
        campaignCode: campaign.code,
        campaignName: campaign.title,
        jobProfile: campaign.title,
        recruiterId: 'demo-rec-formacion',
        recruiterName: 'Reclutador demo',
        applicationDate: day(-18 + (globalIndex % 8)),
        currentStage: dropped ? 'BAJA' : ready ? 'APTO_ALTA' : inOjt ? 'OJT' : 'CAPACITACION',
        currentProcess: ready ? 'GESTION_TALENTO' : 'FORMACION',
        selection: {
          callId: campaign.id,
          stage: 'APTO_CAPACITACION',
          status: 'APTO_CAPACITACION',
          scores: { psicometrico: 84, vozDiccion: 88, tipificacionWPM: 42, simulacionRoleplay: 86, overall: 86 },
          contactHistory: [],
          evaluationsList: [],
          evaluations: [],
          documents: [],
          observations: [],
          traceability: [],
          attendedDay1: !dropped || localIndex % 3 !== 0,
          trainingPassed: ready || inOjt,
          hiringConfirmed: false,
        },
        training: {
          cohortId: cohort.id,
          cohortName: cohort.name,
          cohortCode: cohort.code,
          trainerName: cohort.trainerName,
          coordinatorName: cohort.coordinatorName,
          startDate: cohort.startDate,
          endDate: cohort.endDate,
          ojtStartDate: cohort.ojtStartDate,
          ojtEndDate: cohort.ojtEndDate,
          status: dropped ? 'DESERTO' : inOjt ? 'EN_OJT' : 'EN_CAPACITACION',
          attendance: attendanceFor(globalIndex, Math.min(8, 4 + (globalIndex % 5)), dropped),
          evaluations: evaluationsFor(globalIndex, 6, dropped),
          finalGrade: dropped ? undefined : score,
          dropoutRecord: dropped ? {
            id: `demo-dropout-${globalIndex + 1}`,
            date: day(-1 - (globalIndex % 7)),
            stage: globalIndex % 3 === 0 ? 'OJT' : 'CAPACITACION_TEORICA',
            category: dropoutCategory,
            categoryLabel: dropoutCategory,
            observation: 'Baja registrada en base local de prueba',
            user: cohort.trainerName,
          } : undefined,
          dropoutReason: dropped ? 'Baja registrada en base local de prueba' : undefined,
          dropoutDate: dropped ? day(-1 - (globalIndex % 7)) : undefined,
          promotedToOjtDate: inOjt ? day(-2) : undefined,
          finalResult: ready ? 'APTO_ALTA' : inOjt ? 'APROBADO_OJT' : undefined,
          finalResultDate: ready ? day(-1) : undefined,
        },
        ojt: {
          coachName: cohort.trainerName,
          startDate: cohort.ojtStartDate,
          targetEndDate: cohort.ojtEndDate,
          status: dropped && globalIndex % 3 === 0 ? 'BAJA_DESERCION' : ready ? 'APTO_ALTA' : inOjt ? 'EN_PISO' : 'NO_INICIADO',
          dailyMetrics: inOjt ? [{ date: day(-1), dayNumber: 1, attendance: 'PRESENTE', sales: 2 + (globalIndex % 4), calls: 40 + globalIndex % 20, qaScore: 82 + globalIndex % 12 }] : [],
          skillsMatrix: { manejoObjeciones: 4, diccionModulacion: 4, velocidadSistemas: 3, empatiaEscucha: 4, tecnicaCierre: 3, cumplimientoProcesos: 4 },
          coachingFeedbacks: [],
          readyForHiringDate: ready ? day(0) : undefined,
        },
        hiring: {
          status: ready ? 'EN_REVISION' : 'PENDIENTE_CONTRATACION',
          documentsValidated: ready && globalIndex % 2 === 0,
          laborData: { contractType: 'PLAZO_FIJO_3_MESES', baseSalary: campaign.salaryBase, variableBonus: campaign.variableBonus, shift: 'MANANA_08_17', assignedSupervisor: 'Supervisor demo', workLocation: 'SEDE_CENTRAL_LIMA', officialStartDate: day(3) },
          contract: { contractNumber: '', generatedDate: '', signatureStatus: 'PENDIENTE', contractVersion: '1' },
          welcomeEmailSent: false,
        },
      };
    })
  );

  return { campaigns, cohorts, candidates };
};
