import { CampaignCall, CandidateRecord, LeadSourceType, SelectionStage, UserProfile } from '../types';

export const DEMO_SELECTION_ENABLED = import.meta.env.VITE_USE_DEMO_SELECTION_DATA === 'true';

const day = (offset: number) => {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
};

const recruiterPool = (viewer: UserProfile) => {
  const fixed = [
    { id: 'demo-rec-1', name: 'María Rodríguez' },
    { id: 'demo-rec-2', name: 'Juan Pérez' },
    { id: 'demo-rec-3', name: 'Lucía Fernández' },
    { id: 'demo-rec-4', name: 'Carlos Ruiz' },
  ];
  return viewer.role === 'RECLUTADOR'
    ? [{ id: viewer.id, name: viewer.name }, ...fixed.slice(0, 3)]
    : fixed;
};

export const createDemoSelectionData = (viewer: UserProfile): { campaigns: CampaignCall[]; candidates: CandidateRecord[] } => {
  const recruiters = recruiterPool(viewer);
  const campaignSeed = [
    { id: 'demo-camp-1', code: 'DEM-001', title: 'Ventas Hogar', area: 'Ventas', location: 'Lima', vacancies: 32, request: -35, end: -8 },
    { id: 'demo-camp-2', code: 'DEM-002', title: 'Atención al Cliente', area: 'Servicio', location: 'Arequipa', vacancies: 26, request: -30, end: -4 },
    { id: 'demo-camp-3', code: 'DEM-003', title: 'Retenciones', area: 'Fidelización', location: 'Trujillo', vacancies: 22, request: -24, end: 5 },
    { id: 'demo-camp-4', code: 'DEM-004', title: 'Soporte Técnico', area: 'Operaciones', location: 'Lima', vacancies: 18, request: -18, end: 12 },
  ];

  const campaigns: CampaignCall[] = campaignSeed.map((seed, campaignIndex) => ({
    id: seed.id,
    code: seed.code,
    company: 'Talent-On Demo',
    title: seed.title,
    area: seed.area,
    serviceType: campaignIndex === 0 ? 'VENTAS_OUTBOUND' : campaignIndex === 1 ? 'ATENCION_CLIENTE' : campaignIndex === 2 ? 'RETENCIONES' : 'SOPORTE_TECNICO',
    salaryBase: 1200 + campaignIndex * 100,
    variableBonus: 300,
    adminBonus: 0,
    mobilityBonus: 100,
    requestDate: day(seed.request),
    startDate: day(seed.request + 2),
    endDate: day(seed.end),
    processType: 'EXTERNO',
    managementType: campaignIndex % 2 === 0 ? 'PRESENCIAL' : 'HIBRIDO',
    vacancies: seed.vacancies,
    positionsCovered: 5 + campaignIndex * 2,
    positionsPending: Math.max(0, seed.vacancies - (5 + campaignIndex * 2)),
    location: seed.location,
    shift: campaignIndex % 2 === 0 ? '09:00–18:00' : '13:00–22:00',
    status: campaignIndex < 2 ? 'PUBLICADO' : 'EN_PROCESO',
    responsibles: recruiters.map((recruiter, recruiterIndex) => ({
      userId: recruiter.id,
      userName: recruiter.name,
      userRole: 'RECLUTADOR',
      target: 6 + ((campaignIndex + recruiterIndex) % 4),
      hiredCount: 1 + ((campaignIndex + recruiterIndex) % 3),
    })),
    sources: [
      { sourceName: 'COMPUTRABAJO', isEnabled: true, link: '', leadsCount: 30 },
      { sourceName: 'LINKEDIN', isEnabled: true, link: '', leadsCount: 18 },
      { sourceName: 'Referidos', isEnabled: true, link: '', leadsCount: 14 },
    ],
    statusHistory: [{ date: day(seed.request), previousStatus: 'BORRADOR', newStatus: 'PUBLICADO', changedBy: 'Sistema demo' }],
  }));

  const stages: SelectionStage[] = [
    'NUEVO', 'NUEVO', 'CONTACTADO', 'CONTACTADO', 'ENTREVISTA', 'ENTREVISTA',
    'VERIFICACION_TECNICA', 'EVALUACIONES', 'EVALUACIONES', 'APTO_CAPACITACION',
    'APTO_CAPACITACION', 'APTO_CAPACITACION',
  ];
  const sources: LeadSourceType[] = ['COMPUTRABAJO', 'Facebook Gratis', 'LINKEDIN', 'Referidos', 'Indeed', 'Grupo WhatsApp'];
  const names = ['Andrea Torres', 'Miguel Salazar', 'Valeria Campos', 'José Medina', 'Daniela Rojas', 'Luis Herrera', 'Camila Vargas', 'Renzo Castillo'];

  const candidates: CandidateRecord[] = Array.from({ length: 112 }, (_, index) => {
    const campaign = campaigns[index % campaigns.length];
    const recruiter = recruiters[index % recruiters.length];
    const stage = stages[index % stages.length];
    const downstream = index % 12;
    const isApto = stage === 'APTO_CAPACITACION';
    const isTraining = downstream === 9;
    const isOjt = downstream === 10;
    const isHired = downstream === 11;
    const currentStage = isHired ? 'CONTRATADO' : isOjt ? 'OJT' : isTraining ? 'CAPACITACION' : 'SELECCION';
    const applied = day(-(index % 21));
    const contacted = stage !== 'NUEVO';
    const evaluated = ['EVALUACIONES', 'APTO_CAPACITACION'].includes(stage);
    const candidateName = `${names[index % names.length]} ${Math.floor(index / names.length) + 1}`;

    return {
      id: `demo-candidate-${index + 1}`,
      dni: `70${String(100000 + index).slice(-6)}`,
      fullName: candidateName,
      email: `demo.candidato${index + 1}@talent-on.invalid`,
      phone: `900${String(100000 + index).slice(-6)}`,
      city: campaign.location,
      birthDate: '1998-05-15',
      age: 28,
      experienceMonths: 12 + (index % 36),
      englishLevel: index % 3 === 0 ? 'INTERMEDIO' : 'BASICO',
      avatarUrl: '',
      source: sources[index % sources.length],
      campaignId: campaign.id,
      campaignCode: campaign.code,
      campaignName: campaign.title,
      jobProfile: campaign.title,
      recruiterId: recruiter.id,
      recruiterName: recruiter.name,
      applicationDate: applied,
      currentStage,
      currentProcess: isHired ? 'CONTRATADO' : isTraining || isOjt ? 'FORMACION' : 'SELECCION',
      selection: {
        callId: campaign.id,
        stage,
        status: isApto ? 'APTO_CAPACITACION' : 'ACTIVO',
        scores: { psicometrico: 68 + (index % 29), vozDiccion: 70 + (index % 25), tipificacionWPM: 30 + (index % 28), simulacionRoleplay: 66 + (index % 30), overall: 72 + (index % 24) },
        contactHistory: contacted ? [{ id: `demo-contact-${index}`, date: applied, time: '10:30', type: 'LLAMADA', summary: 'Contacto de demostración', agentName: recruiter.name, outcome: 'CONTESTO' }] : [],
        evaluationsList: evaluated ? [{ id: `demo-eval-${index}`, title: 'Evaluación de selección', evaluator: recruiter.name, date: day(-(index % 14)), score: 78 + (index % 18), maxScore: 100, comments: 'Resultado de demostración', passed: true }] : [],
        evaluations: [],
        documents: [],
        observations: [],
        traceability: [{ id: `demo-trace-${index}`, date: applied, time: `${String(8 + (index % 9)).padStart(2, '0')}:15`, user: recruiter.name, action: contacted ? 'Candidato contactado' : 'Postulante registrado', previousStage: 'NUEVO', newStage: stage, observation: 'Actividad generada por la base local de demostración' }],
        trainingPassed: isOjt || isHired,
        hiringConfirmed: isHired,
      },
      training: {
        status: index % 29 === 0 ? 'NSP' : index % 31 === 0 ? 'DESERTO' : isHired || isOjt ? 'EN_OJT' : isTraining ? 'EN_CAPACITACION' : 'PENDIENTE_INICIO',
        attendance: index % 29 === 0 ? [{ date: day(-2), dayNumber: 1, status: 'NSP' }] : [],
        evaluations: [],
      },
      ojt: {
        status: isHired ? 'OJT_APROBADO' : isOjt ? 'EN_OJT' : 'NO_INICIADO',
        dailyMetrics: [],
        skillsMatrix: { manejoObjeciones: 4, diccionModulacion: 4, velocidadSistemas: 4, empatiaEscucha: 4, tecnicaCierre: 3, cumplimientoProcesos: 4 },
        coachingFeedbacks: [],
      },
      hiring: {
        status: isHired ? 'CONTRATADO' : 'PENDIENTE_CONTRATACION',
        documentsValidated: isHired,
        laborData: { contractType: 'PLAZO_FIJO_3_MESES', baseSalary: campaign.salaryBase, variableBonus: campaign.variableBonus, shift: 'MANANA_08_17', assignedSupervisor: 'Supervisor Demo', workLocation: 'SEDE_CENTRAL_LIMA', officialStartDate: day(3) },
        contract: { contractNumber: isHired ? `DEMO-${index}` : '', generatedDate: isHired ? day(-2) : '', signatureStatus: isHired ? 'FIRMADO_DIGITAL' : 'PENDIENTE', contractVersion: '1' },
        welcomeEmailSent: false,
      },
    };
  });

  return { campaigns, candidates };
};
