import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Filter,
  GraduationCap,
  Headphones,
  LineChart as LineChartIcon,
  Target,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTalent } from '../context/TalentContext';
import { DROPOUT_CATEGORIES } from '../config/catalogs';
import { CandidateRecord, TrainingCohort } from '../types';
import { AssignTrainerModal } from '../components/modals/AssignTrainerModal';
import { createDemoTrainingData, DEMO_FORMACION_ENABLED } from '../data/demoTrainingData';

const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

const validDate = (value?: string) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

const dateInPeriod = (value: string | undefined, period: string) => {
  if (period === 'ALL') return true;
  const date = validDate(value);
  if (!date) return true;
  const days = period === 'WEEK' ? 7 : 30;
  return Date.now() - date.getTime() <= days * 86_400_000;
};

const isTrainingCandidate = (candidate: CandidateRecord) =>
  Boolean(candidate.training?.cohortId) ||
  ['CAPACITACION', 'OJT', 'APTO_ALTA', 'GESTION_TALENTO', 'CONTRATADO', 'BAJA'].includes(candidate.currentStage) ||
  Boolean(candidate.training?.status);

const isDropout = (candidate: CandidateRecord) =>
  candidate.training?.status === 'DESERTO' ||
  candidate.training?.status === 'BAJA_CAPACITACION' ||
  Boolean(candidate.training?.dropoutRecord) ||
  candidate.ojt?.status === 'BAJA_DESERCION' ||
  candidate.ojt?.status === 'ABANDONO' ||
  (candidate.currentStage === 'BAJA' && Boolean(candidate.training?.cohortId));

const isPassedToOjt = (candidate: CandidateRecord) =>
  candidate.training?.status === 'EN_OJT' ||
  candidate.training?.status === 'APROBADO_OJT' ||
  candidate.training?.status === 'APTO_ALTA' ||
  candidate.training?.finalResult === 'APROBADO_OJT' ||
  ['OJT', 'APTO_ALTA', 'GESTION_TALENTO', 'CONTRATADO'].includes(candidate.currentStage);

const isReadyForHiring = (candidate: CandidateRecord) =>
  candidate.currentStage === 'APTO_ALTA' ||
  candidate.currentStage === 'GESTION_TALENTO' ||
  candidate.currentStage === 'CONTRATADO' ||
  candidate.training?.finalResult === 'APTO_ALTA' ||
  candidate.ojt?.status === 'APTO_ALTA' ||
  candidate.ojt?.status === 'OJT_APROBADO';

const isAttendanceOk = (status?: string) =>
  ['PRESENTE', 'TARDANZA', 'JUSTIFICADO', 'FALTA_JUSTIFICADA'].includes(status || '');

const cohortStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    PENDIENTE_ASIGNACION: 'Pendiente',
    PROGRAMADA: 'Programada',
    EN_CAPACITACION: 'En proceso',
    EN_OJT: 'En OJT',
    EXTENSION_OJT: 'Extensión',
    FINALIZADA: 'Finalizado',
    CANCELADA: 'Cancelada',
  };
  return labels[status] || status.replaceAll('_', ' ');
};

const cohortStageLabel = (cohort: TrainingCohort) => {
  if (cohort.status === 'EN_OJT' || cohort.status === 'EXTENSION_OJT') return 'OJT';
  if (cohort.status === 'FINALIZADA') return 'Finalizado';
  if (cohort.status === 'PROGRAMADA') return 'Programado';
  if (cohort.status === 'PENDIENTE_ASIGNACION') return 'Por asignar';
  return 'Teoría';
};

type IconType = React.ComponentType<{ className?: string }>;

type TrainerStat = {
  name: string;
  participants: number;
  attendanceOk: number;
  attendanceTotal: number;
  evaluationsOk: number;
  evaluationsTotal: number;
  ojt: number;
  dropouts: number;
  ready: number;
};

const KpiCard: React.FC<{ label: string; value: string; detail: string; icon: IconType; tone: string }> = ({ label, value, detail, icon: Icon, tone }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-xs font-semibold leading-tight text-slate-600">{label}</span>
    </div>
    <div className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{value}</div>
    <div className="mt-2 text-[11px] text-slate-500">{detail}</div>
  </article>
);

const EmptyState: React.FC<{ text: string; className?: string }> = ({ text, className = 'h-48' }) => (
  <div className={`flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400 ${className}`}>{text}</div>
);

export const FormacionDashboardView: React.FC = () => {
  const {
    cohorts: liveCohorts,
    candidates: liveCandidates,
    campaigns: liveCampaigns,
    currentUser,
    setActiveModule,
    setSelectedCohortId,
  } = useTalent();

  const [period, setPeriod] = useState('ALL');
  const [campaignFilter, setCampaignFilter] = useState('TODAS');
  const [assignModalCohort, setAssignModalCohort] = useState<TrainingCohort | null>(null);
  const demoData = useMemo(() => createDemoTrainingData(currentUser), [currentUser]);
  const shouldUseDemoData = DEMO_FORMACION_ENABLED;
  const sourceCohorts = shouldUseDemoData ? demoData.cohorts : liveCohorts;
  const sourceCandidates = shouldUseDemoData ? demoData.candidates : liveCandidates;
  const sourceCampaigns = shouldUseDemoData ? demoData.campaigns : liveCampaigns;
  const isTrainerDashboard = currentUser.role === 'FORMADOR';
  const cohorts = useMemo(() => isTrainerDashboard
    ? sourceCohorts.filter(cohort => cohort.trainerId === currentUser.id)
    : sourceCohorts, [currentUser.id, isTrainerDashboard, sourceCohorts]);
  const assignedCohortIds = useMemo(() => new Set(cohorts.map(cohort => cohort.id)), [cohorts]);
  const candidates = useMemo(() => isTrainerDashboard
    ? sourceCandidates.filter(candidate => Boolean(candidate.training?.cohortId && assignedCohortIds.has(candidate.training.cohortId)))
    : sourceCandidates, [assignedCohortIds, isTrainerDashboard, sourceCandidates]);
  const campaigns = useMemo(() => {
    if (!isTrainerDashboard) return sourceCampaigns;
    const campaignIds = new Set(cohorts.map(cohort => cohort.campaignId));
    return sourceCampaigns.filter(campaign => campaignIds.has(campaign.id));
  }, [cohorts, isTrainerDashboard, sourceCampaigns]);

  const filteredCohorts = useMemo(() => cohorts.filter(cohort => {
    if (campaignFilter !== 'TODAS' && cohort.campaignId !== campaignFilter) return false;
    return dateInPeriod(cohort.startDate || cohort.endDate, period);
  }), [campaignFilter, cohorts, period]);

  const filteredCohortIds = useMemo(() => new Set(filteredCohorts.map(cohort => cohort.id)), [filteredCohorts]);

  const filteredCandidates = useMemo(() => candidates.filter(candidate => {
    if (campaignFilter !== 'TODAS' && candidate.campaignId !== campaignFilter) return false;
    if (candidate.training?.cohortId && filteredCohorts.length > 0 && !filteredCohortIds.has(candidate.training.cohortId)) return false;
    return dateInPeriod(candidate.training?.startDate || candidate.applicationDate, period);
  }), [campaignFilter, candidates, filteredCohortIds, filteredCohorts.length, period]);

  const trainingCandidates = useMemo(() => filteredCandidates.filter(isTrainingCandidate), [filteredCandidates]);
  const baseParticipants = trainingCandidates.length;
  const activeParticipants = trainingCandidates.filter(candidate =>
    !isDropout(candidate) &&
    (candidate.currentStage === 'CAPACITACION' ||
      candidate.currentStage === 'OJT' ||
      candidate.training?.status === 'EN_CAPACITACION' ||
      candidate.training?.status === 'EN_OJT' ||
      candidate.ojt?.status === 'EN_PISO')
  ).length;

  const attendanceRecords = trainingCandidates.flatMap(candidate => candidate.training?.attendance || []);
  const attendanceAverage = percent(attendanceRecords.filter(item => isAttendanceOk(item.status)).length, attendanceRecords.length);

  const evaluationRecords = trainingCandidates.flatMap(candidate => candidate.training?.evaluations || []);
  const theoryApprovalFromEvaluations = percent(evaluationRecords.filter(item => item.score >= item.minRequired).length, evaluationRecords.length);
  const candidatesWithGrades = trainingCandidates.filter(candidate => typeof candidate.training?.finalGrade === 'number');
  const theoryApprovalFromGrades = percent(
    candidatesWithGrades.filter(candidate => Number(candidate.training?.finalGrade || 0) >= 80).length,
    candidatesWithGrades.length
  );
  const theoryApproval = evaluationRecords.length ? theoryApprovalFromEvaluations : theoryApprovalFromGrades;

  const passedToOjt = trainingCandidates.filter(isPassedToOjt).length;
  const readyForHiring = trainingCandidates.filter(isReadyForHiring).length;
  const totalDropouts = trainingCandidates.filter(isDropout).length;
  const ojtPopulation = trainingCandidates.filter(candidate => isPassedToOjt(candidate) || candidate.ojt?.status).length;
  const passToOjtRate = percent(passedToOjt, baseParticipants);
  const ojtEffectiveness = percent(readyForHiring, ojtPopulation);
  const dropoutRate = percent(totalDropouts, baseParticipants);

  const dayOneDropouts = trainingCandidates.filter(candidate =>
    candidate.training?.status === 'NSP' ||
    candidate.training?.attendance?.some(item => item.dayNumber === 1 && ['NSP', 'FALTA', 'FALTA_INJUSTIFICADA'].includes(item.status))
  ).length;
  const theoryDropouts = trainingCandidates.filter(candidate =>
    candidate.training?.dropoutRecord?.stage === 'CAPACITACION_TEORICA' ||
    candidate.training?.status === 'BAJA_CAPACITACION' ||
    (candidate.training?.status === 'DESERTO' && candidate.currentStage !== 'OJT')
  ).length;
  const ojtDropouts = trainingCandidates.filter(candidate =>
    candidate.training?.dropoutRecord?.stage === 'OJT' ||
    candidate.ojt?.status === 'BAJA_DESERCION' ||
    candidate.ojt?.status === 'ABANDONO'
  ).length;
  const accumulatedTheoryDropouts = Math.min(totalDropouts, Math.max(dayOneDropouts, theoryDropouts));
  const accumulatedOjtDropouts = Math.min(totalDropouts, Math.max(accumulatedTheoryDropouts, theoryDropouts + ojtDropouts));

  const dropoutFunnel = [
    { label: 'Día 1', value: percent(dayOneDropouts, baseParticipants), color: '#154E7D' },
    { label: 'Fin de teoría', value: percent(accumulatedTheoryDropouts, baseParticipants), color: '#2D9CDB' },
    { label: 'Día 1 OJT', value: percent(accumulatedTheoryDropouts, baseParticipants), color: '#4CA899' },
    { label: 'Fin de OJT', value: percent(accumulatedOjtDropouts, baseParticipants), color: '#E9AA34' },
    { label: 'Ingresos', value: dropoutRate, color: '#F68565' },
    { label: 'Deserción total', value: dropoutRate, color: '#E94B3C' },
  ];

  const alerts = [
    {
      label: 'Asistencia bajo meta',
      detail: 'Participantes con asistencia menor a 80%',
      value: trainingCandidates.filter(candidate => {
        const records = candidate.training?.attendance || [];
        return records.length > 0 && percent(records.filter(item => isAttendanceOk(item.status)).length, records.length) < 80;
      }).length,
      icon: UserMinus,
      tone: 'bg-rose-50 text-rose-600',
    },
    {
      label: 'Evaluaciones pendientes',
      detail: 'Participantes sin evaluación registrada',
      value: trainingCandidates.filter(candidate =>
        !isDropout(candidate) &&
        (candidate.currentStage === 'CAPACITACION' || candidate.training?.status === 'EN_CAPACITACION') &&
        !(candidate.training?.evaluations || []).length
      ).length,
      icon: ClipboardCheck,
      tone: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Grupos bajo meta',
      detail: 'Menos de 80% de avance',
      value: filteredCohorts.filter(cohort => (cohort.progressPercent || 0) < 80 && cohort.status !== 'CANCELADA').length,
      icon: Target,
      tone: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Participantes próximos a corte',
      detail: 'Fin de grupo en los próximos 3 días',
      value: filteredCohorts.filter(cohort => {
        const end = validDate(cohort.endDate);
        if (!end) return false;
        const diff = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
        return diff >= 0 && diff <= 3;
      }).reduce((sum, cohort) => sum + (cohort.activeCount || 0), 0),
      icon: CalendarDays,
      tone: 'bg-violet-50 text-violet-600',
    },
    {
      label: 'Pendientes de alta',
      detail: 'Aptos para alta aún no contratados',
      value: trainingCandidates.filter(candidate => isReadyForHiring(candidate) && candidate.currentStage !== 'CONTRATADO').length,
      icon: UserCheck,
      tone: 'bg-sky-50 text-sky-600',
    },
  ];

  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const weeklyData = weekDays.map((day, index) => {
    const dayCandidates = trainingCandidates.filter(candidate => {
      const date = validDate(candidate.training?.startDate || candidate.applicationDate);
      return date?.getDay() === index;
    });
    const dayDropouts = dayCandidates.filter(isDropout).length;
    return {
      day,
      participantes: dayCandidates.length,
      aptos: dayCandidates.filter(isReadyForHiring).length,
      deserciones: dayDropouts,
    };
  });

  const groupStats: TrainerStat[] = Array.from(trainingCandidates.reduce<Map<string, TrainerStat>>((map, candidate) => {
    const cohortId = candidate.training?.cohortId || 'sin-grupo';
    const cohort = cohorts.find(item => item.id === cohortId);
    const groupName = cohort ? cohort.code : candidate.training?.cohortCode || 'Sin grupo';
    const current: TrainerStat = map.get(cohortId) || {
      name: groupName,
      participants: 0,
      attendanceOk: 0,
      attendanceTotal: 0,
      evaluationsOk: 0,
      evaluationsTotal: 0,
      ojt: 0,
      dropouts: 0,
      ready: 0,
    };
    const attendance = candidate.training?.attendance || [];
    const evaluations = candidate.training?.evaluations || [];
    current.participants += 1;
    current.attendanceOk += attendance.filter(item => isAttendanceOk(item.status)).length;
    current.attendanceTotal += attendance.length;
    current.evaluationsOk += evaluations.filter(item => item.score >= item.minRequired).length;
    current.evaluationsTotal += evaluations.length;
    current.ojt += isPassedToOjt(candidate) ? 1 : 0;
    current.dropouts += isDropout(candidate) ? 1 : 0;
    current.ready += isReadyForHiring(candidate) ? 1 : 0;
    map.set(cohortId, current);
    return map;
  }, new Map<string, TrainerStat>()).values() as Iterable<TrainerStat>).sort((a, b) => b.participants - a.participants);

  const trainerStats: TrainerStat[] = Array.from(trainingCandidates.reduce<Map<string, TrainerStat>>((map, candidate) => {
    const trainer = candidate.training?.trainerName || 'Sin asignar';
    const current: TrainerStat = map.get(trainer) || {
      name: trainer,
      participants: 0,
      attendanceOk: 0,
      attendanceTotal: 0,
      evaluationsOk: 0,
      evaluationsTotal: 0,
      ojt: 0,
      dropouts: 0,
      ready: 0,
    };
    const attendance = candidate.training?.attendance || [];
    const evaluations = candidate.training?.evaluations || [];
    current.participants += 1;
    current.attendanceOk += attendance.filter(item => isAttendanceOk(item.status)).length;
    current.attendanceTotal += attendance.length;
    current.evaluationsOk += evaluations.filter(item => item.score >= item.minRequired).length;
    current.evaluationsTotal += evaluations.length;
    current.ojt += isPassedToOjt(candidate) ? 1 : 0;
    current.dropouts += isDropout(candidate) ? 1 : 0;
    current.ready += isReadyForHiring(candidate) ? 1 : 0;
    map.set(trainer, current);
    return map;
  }, new Map<string, TrainerStat>()).values() as Iterable<TrainerStat>).sort((a, b) => b.participants - a.participants);

  const dropoutByCause = DROPOUT_CATEGORIES.map(category => {
    const count = trainingCandidates.filter(candidate => candidate.training?.dropoutRecord?.category === category.id).length;
    return { ...category, count, pct: percent(count, totalDropouts) };
  });

  const totalTrainer: TrainerStat = trainerStats.reduce<TrainerStat>((acc, item) => ({
    name: 'Total general',
    participants: acc.participants + item.participants,
    attendanceOk: acc.attendanceOk + item.attendanceOk,
    attendanceTotal: acc.attendanceTotal + item.attendanceTotal,
    evaluationsOk: acc.evaluationsOk + item.evaluationsOk,
    evaluationsTotal: acc.evaluationsTotal + item.evaluationsTotal,
    ojt: acc.ojt + item.ojt,
    dropouts: acc.dropouts + item.dropouts,
    ready: acc.ready + item.ready,
  }), { name: 'Total general', participants: 0, attendanceOk: 0, attendanceTotal: 0, evaluationsOk: 0, evaluationsTotal: 0, ojt: 0, dropouts: 0, ready: 0 });

  const formatRate = (value: number) => `${value}%`;
  const performanceRows = isTrainerDashboard ? groupStats : trainerStats;
  const performanceTitle = isTrainerDashboard ? 'Rendimiento por grupo' : 'Rendimiento por formador';
  const performanceEmptyText = isTrainerDashboard ? 'Sin rendimiento por grupo para mostrar.' : 'Sin rendimiento por formador para mostrar.';

  return (
    <div className="space-y-5 pb-10">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-xs text-slate-500 shadow-sm">
          <CalendarDays className="h-4 w-4 text-slate-600" />
          <span>Periodo</span>
          <select value={period} onChange={event => setPeriod(event.target.value)} className="min-w-0 flex-1 bg-transparent font-semibold text-slate-800 outline-none">
            <option value="ALL">Histórico completo</option>
            <option value="MONTH">Últimos 30 días</option>
            <option value="WEEK">Últimos 7 días</option>
          </select>
        </label>
        <label className="flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-xs text-slate-500 shadow-sm">
          <Filter className="h-4 w-4 text-slate-600" />
          <span>Campaña</span>
          <select value={campaignFilter} onChange={event => setCampaignFilter(event.target.value)} className="min-w-0 flex-1 bg-transparent font-semibold text-slate-800 outline-none">
            <option value="TODAS">Todas las campañas</option>
            {campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}
          </select>
        </label>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Participantes activos" value={`${activeParticipants}`} detail={`${filteredCohorts.length} grupos filtrados`} icon={Users} tone="bg-sky-50 text-sky-600" />
        <KpiCard label="% Asistencia promedio" value={formatRate(attendanceAverage)} detail={attendanceRecords.length ? `${attendanceRecords.length} registros` : 'Sin asistencias registradas'} icon={CalendarDays} tone="bg-emerald-50 text-emerald-600" />
        <KpiCard label="% Aprobación teórica" value={formatRate(theoryApproval)} detail={evaluationRecords.length ? `${evaluationRecords.length} evaluaciones` : 'Sin evaluaciones registradas'} icon={GraduationCap} tone="bg-teal-50 text-teal-600" />
        <KpiCard label="% Pase a OJT" value={formatRate(passToOjtRate)} detail={`${passedToOjt} de ${baseParticipants} participantes`} icon={Headphones} tone="bg-sky-50 text-sky-600" />
        <KpiCard label="% Efectividad OJT" value={formatRate(ojtEffectiveness)} detail={`${readyForHiring} aptos para alta`} icon={Award} tone="bg-amber-50 text-amber-600" />
        <KpiCard label="% Deserción" value={formatRate(dropoutRate)} detail={baseParticipants ? 'Acumulada sobre Día 1' : 'Sin base Día 1'} icon={TrendingDown} tone="bg-rose-50 text-rose-600" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.45fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Filter className="h-5 w-5 text-sky-700" />
            Embudo de deserción
          </h3>
          {baseParticipants ? (
            <>
              <div className="mt-5 space-y-1.5">
                {dropoutFunnel.map((item, index) => (
                  <div key={item.label} className="grid grid-cols-[1fr_135px_52px] items-center gap-3 text-xs">
                    <div className="flex justify-center">
                      <div
                        className="h-9 rounded-md"
                        style={{
                          width: `${100 - index * 10}%`,
                          backgroundColor: item.color,
                          clipPath: 'polygon(5% 0, 95% 0, 86% 100%, 14% 100%)',
                        }}
                      />
                    </div>
                    <span className="flex items-center gap-2 font-semibold text-slate-700">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.label}
                    </span>
                    <strong className="text-right text-slate-900">{item.value}%</strong>
                  </div>
                ))}
              </div>
              <div className="mx-auto mt-5 flex max-w-xs justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                Deserción total: <span className="ml-2 text-rose-600">{dropoutRate}%</span>
              </div>
            </>
          ) : <EmptyState text="Sin participantes para calcular deserción." className="mt-5 h-72" />}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <LineChartIcon className="h-5 w-5 text-sky-700" />
            {isTrainerDashboard ? 'Estado de mis grupos' : 'Estado de grupos'}
          </h3>
          <div className="mt-4 overflow-x-auto">
            <table className={`w-full text-left text-xs ${isTrainerDashboard ? 'min-w-[680px]' : 'min-w-[780px]'}`}>
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-3">Grupo</th>
                  <th>Campaña</th>
                  <th>Etapa</th>
                  <th>Participantes</th>
                  <th>Avance</th>
                  {!isTrainerDashboard && <th>Formador</th>}
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCohorts.slice(0, 7).map(cohort => {
                  const progress = cohort.progressPercent || 0;
                  const statusTone = cohort.status === 'FINALIZADA'
                    ? 'bg-emerald-50 text-emerald-700'
                    : cohort.status === 'CANCELADA'
                    ? 'bg-rose-50 text-rose-700'
                    : cohort.status === 'PENDIENTE_ASIGNACION'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-sky-50 text-sky-700';
                  const barTone = progress >= 85 ? 'bg-emerald-500' : progress >= 60 ? 'bg-amber-500' : 'bg-rose-500';
                  return (
                    <tr
                      key={cohort.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => {
                        setSelectedCohortId(cohort.id);
                        setActiveModule('FORMACION_CAPACITACIONES');
                      }}
                    >
                      <td className="py-3 font-semibold text-sky-900">{cohort.code}</td>
                      <td><strong className="text-slate-800">{cohort.campaignName || cohort.name}</strong><div className="text-[10px] text-slate-500">{cohort.location || cohort.company || 'Sin sede'}</div></td>
                      <td>{cohortStageLabel(cohort)}</td>
                      <td><strong>{cohort.activeCount || 0}</strong> / {cohort.enrolledCount || 0}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${barTone}`} style={{ width: `${Math.min(100, progress)}%` }} />
                          </div>
                          <strong>{progress}%</strong>
                        </div>
                      </td>
                      {!isTrainerDashboard && <td>{cohort.trainerName || 'Sin asignar'}</td>}
                      <td><span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusTone}`}>{cohortStatusLabel(cohort.status)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filteredCohorts.length && <EmptyState text="No hay grupos para los filtros seleccionados." className="mt-4 h-56" />}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.45fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Bell className="h-5 w-5 text-sky-700" />
              Alertas y pendientes
            </h3>
            <span className="text-xs font-semibold text-sky-700">Ver todas</span>
          </div>
          <div className="divide-y divide-slate-100">
            {alerts.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="grid grid-cols-[42px_1fr_44px] items-center gap-3 py-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full ${item.tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">{item.label}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{item.detail}</div>
                  </div>
                  <span className="rounded-lg bg-slate-50 px-2 py-1.5 text-center text-sm font-bold text-slate-900">{item.value}</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <TrendingUp className="h-5 w-5 text-sky-700" />
              Evolución semanal
            </h3>
            <span className="text-xs font-semibold text-sky-700">Ver detalle</span>
          </div>
          {trainingCandidates.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#143A56' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#143A56' }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="participantes" name="Participantes" stroke="#1A73E8" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="aptos" name="Aptos para alta" stroke="#12A866" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="deserciones" name="Deserciones" stroke="#F04E37" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState text="Sin datos suficientes para graficar evolución." className="h-72" />}
        </article>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.95fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Users className="h-5 w-5 text-sky-700" />
              {performanceTitle}
            </h3>
            <span className="text-xs font-semibold text-sky-700">Ver todas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-3">{isTrainerDashboard ? 'Grupo' : 'Formador'}</th>
                  <th>Participantes</th>
                  <th>Asistencia</th>
                  <th>Aprobación teoría</th>
                  <th>{isTrainerDashboard ? 'Efectividad OJT' : 'OJT'}</th>
                  <th>Deserción</th>
                  <th>{isTrainerDashboard ? 'Aptos para alta' : 'Aptos'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...performanceRows.slice(0, 6), ...(!isTrainerDashboard && performanceRows.length ? [totalTrainer] : [])].map(item => {
                  const isTotal = item.name === 'Total general';
                  return (
                    <tr key={item.name} className={isTotal ? 'bg-sky-50/60 font-semibold text-sky-950' : ''}>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {!isTotal && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-sky-900">{item.name.slice(0, 2).toUpperCase()}</span>}
                          <span>{item.name}</span>
                        </div>
                      </td>
                      <td>{item.participants}</td>
                      <td className="font-semibold text-emerald-700">{formatRate(percent(item.attendanceOk, item.attendanceTotal))}</td>
                      <td className="font-semibold text-emerald-700">{formatRate(percent(item.evaluationsOk, item.evaluationsTotal))}</td>
                      <td className="font-semibold text-emerald-700">{formatRate(percent(item.ojt, item.participants))}</td>
                      <td className="font-semibold text-rose-600">{formatRate(percent(item.dropouts, item.participants))}</td>
                      <td className="font-bold text-sky-950">{item.ready}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!performanceRows.length && <EmptyState text={performanceEmptyText} className="mt-4 h-56" />}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <AlertTriangle className="h-5 w-5 text-sky-700" />
              Deserción por causa
            </h3>
            <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">{totalDropouts} bajas</span>
          </div>
          {totalDropouts ? (
            <div className="space-y-4">
              {dropoutByCause.map((item, index) => (
                <div key={item.id} className="grid grid-cols-[1fr_120px_28px_42px] items-center gap-3 text-xs">
                  <span className="truncate font-medium text-slate-700">{item.label}</span>
                  <div className="h-1.5 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${item.pct}%`,
                        backgroundColor: ['#F04E37', '#F68565', '#E9AA34', '#12A866', '#4CA899', '#8B5CF6', '#F472B6'][index % 7],
                      }}
                    />
                  </div>
                  <strong className="text-right text-slate-900">{item.count}</strong>
                  <span className="text-right text-slate-500">{item.pct}%</span>
                </div>
              ))}
            </div>
          ) : <EmptyState text="No hay bajas registradas por causa." className="h-64" />}
        </article>
      </section>

      <p className="text-center text-[11px] text-slate-400">Las métricas se actualizan con los datos disponibles de Formación & OJT.</p>

      {assignModalCohort && (
        <AssignTrainerModal
          isOpen={true}
          onClose={() => setAssignModalCohort(null)}
          cohort={assignModalCohort}
        />
      )}
    </div>
  );
};
