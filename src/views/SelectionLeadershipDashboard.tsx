import React, { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  MapPin,
  PhoneCall,
  Star,
  Target,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTalent } from '../context/TalentContext';
import { CandidateRecord, CampaignCall } from '../types';
import { createDemoSelectionData, DEMO_SELECTION_ENABLED } from '../data/demoSelectionData';

const COLORS = ['#143A56', '#154E7D', '#4CA899', '#87C6A2', '#F68565', '#E9AA34'];

const percent = (part: number, total: number) => total > 0 ? Math.round((part / total) * 100) : 0;
const validDate = (value?: string) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};
const dayDiff = (from?: string, to?: string) => {
  const start = validDate(from);
  const end = validDate(to);
  return start && end ? Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86_400_000)) : 0;
};
const isApto = (candidate: CandidateRecord) =>
  candidate.selection?.stage === 'APTO_CAPACITACION' ||
  ['CAPACITACION', 'OJT', 'APTO_ALTA', 'GESTION_TALENTO', 'CONTRATADO'].includes(candidate.currentStage);
const isContacted = (candidate: CandidateRecord) =>
  candidate.selection?.stage !== 'NUEVO' || (candidate.selection?.contactHistory?.length || 0) > 0;
const isEvaluated = (candidate: CandidateRecord) =>
  ['EVALUACIONES', 'APTO_CAPACITACION'].includes(candidate.selection?.stage) ||
  (candidate.selection?.evaluationsList?.length || 0) > 0;

type IconType = React.ComponentType<{ className?: string }>;

const KpiCard: React.FC<{ label: string; value: string; detail: string; icon: IconType; tone: string }> = ({ label, value, detail, icon: Icon, tone }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
    </div>
    <div className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{value}</div>
    <div className="mt-2 text-[11px] text-slate-500">{detail}</div>
  </article>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex h-48 items-center justify-center text-sm text-slate-400">{text}</div>
);

export const SelectionLeadershipDashboard: React.FC = () => {
  const { campaigns: liveCampaigns, candidates: liveCandidates, currentUser } = useTalent();
  const demoData = useMemo(() => createDemoSelectionData(currentUser), [currentUser]);
  const campaigns = DEMO_SELECTION_ENABLED ? demoData.campaigns : liveCampaigns;
  const candidates = DEMO_SELECTION_ENABLED ? demoData.candidates : liveCandidates;
  const [period, setPeriod] = useState('ALL');
  const [campaignId, setCampaignId] = useState('ALL');
  const [recruiterId, setRecruiterId] = useState('ALL');
  const [location, setLocation] = useState('ALL');

  const recruiters = useMemo(() => {
    const values = new Map<string, string>();
    candidates.forEach(candidate => {
      if (candidate.recruiterId) values.set(candidate.recruiterId, candidate.recruiterName || 'Sin nombre');
    });
    campaigns.forEach(campaign => campaign.responsibles?.forEach(responsible => values.set(responsible.userId, responsible.userName)));
    return Array.from(values, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [campaigns, candidates]);

  const locations = useMemo(() => Array.from(new Set(campaigns.map(item => item.location).filter(Boolean))).sort(), [campaigns]);

  const filteredCampaigns = useMemo(() => campaigns.filter(campaign => {
    if (campaignId !== 'ALL' && campaign.id !== campaignId) return false;
    if (location !== 'ALL' && campaign.location !== location) return false;
    if (recruiterId !== 'ALL' && !campaign.responsibles?.some(item => item.userId === recruiterId)) return false;
    return true;
  }), [campaignId, campaigns, location, recruiterId]);

  const visibleCampaignIds = useMemo(() => new Set(filteredCampaigns.map(item => item.id)), [filteredCampaigns]);
  const filteredCandidates = useMemo(() => {
    const now = Date.now();
    const limit = period === 'WEEK' ? 7 : period === 'MONTH' ? 30 : null;
    return candidates.filter(candidate => {
      if (!visibleCampaignIds.has(candidate.campaignId)) return false;
      if (recruiterId !== 'ALL' && candidate.recruiterId !== recruiterId) return false;
      if (limit) {
        const applied = validDate(candidate.applicationDate);
        if (!applied || now - applied.getTime() > limit * 86_400_000) return false;
      }
      return true;
    });
  }, [candidates, period, recruiterId, visibleCampaignIds]);

  const total = filteredCandidates.length;
  const contacted = filteredCandidates.filter(isContacted).length;
  const evaluated = filteredCandidates.filter(isEvaluated).length;
  const aptos = filteredCandidates.filter(isApto).length;
  const hired = filteredCandidates.filter(candidate => candidate.currentStage === 'CONTRATADO' || candidate.selection?.hiringConfirmed).length;
  const vacancies = filteredCampaigns.reduce((sum, campaign) => sum + Number(campaign.vacancies || 0), 0);
  const coverage = percent(hired, vacancies);
  const conversion = percent(aptos, total);
  const contactability = percent(contacted, total);
  const aptitude = percent(aptos, evaluated);

  const campaignTimeToFill = filteredCampaigns.map(campaign => {
    const campaignCandidates = filteredCandidates.filter(candidate => candidate.campaignId === campaign.id && (candidate.currentStage === 'CONTRATADO' || candidate.selection?.hiringConfirmed));
    const lastHireDate = campaignCandidates
      .flatMap(candidate => candidate.selection?.traceability || [])
      .filter(item => item.newStage === 'CONTRATADO' || item.action?.toLowerCase().includes('contrat'))
      .map(item => item.date)
      .filter(Boolean)
      .sort()
      .at(-1);
    return dayDiff(campaign.requestDate, lastHireDate || campaign.endDate || new Date().toISOString());
  }).filter(value => value > 0);
  const timeToFill = campaignTimeToFill.length ? Math.round(campaignTimeToFill.reduce((sum, value) => sum + value, 0) / campaignTimeToFill.length) : 0;
  const slaCampaigns = filteredCampaigns.filter(campaign => campaign.requestDate);
  const slaCompliance = percent(slaCampaigns.filter(campaign => dayDiff(campaign.requestDate, campaign.endDate || new Date().toISOString()) <= 30).length, slaCampaigns.length);

  const funnel = [
    { label: 'Postulantes', value: total, color: '#143A56' },
    { label: 'Contactados', value: contacted, color: '#154E7D' },
    { label: 'Entrevistados', value: filteredCandidates.filter(candidate => ['ENTREVISTA', 'VERIFICACION_TECNICA', 'EVALUACIONES', 'APTO_CAPACITACION'].includes(candidate.selection?.stage)).length, color: '#4CA899' },
    { label: 'Verificación técnica', value: filteredCandidates.filter(candidate => ['VERIFICACION_TECNICA', 'EVALUACIONES', 'APTO_CAPACITACION'].includes(candidate.selection?.stage)).length, color: '#87C6A2' },
    { label: 'Evaluados', value: evaluated, color: '#E9AA34' },
    { label: 'Aptos', value: aptos, color: '#F68565' },
  ];

  const recruiterStats = recruiters.map(recruiter => {
    const owned = filteredCandidates.filter(candidate => candidate.recruiterId === recruiter.id);
    const ownedContacted = owned.filter(isContacted).length;
    const ownedAptos = owned.filter(isApto).length;
    const target = filteredCampaigns.reduce((sum, campaign) => sum + Number(campaign.responsibles?.find(item => item.userId === recruiter.id)?.target || 0), 0);
    return { ...recruiter, total: owned.length, aptos: ownedAptos, conversion: percent(ownedAptos, ownedContacted), target };
  }).filter(item => item.total > 0 || item.target > 0).sort((a, b) => b.aptos - a.aptos);

  const sourceData = Object.entries(filteredCandidates.reduce<Record<string, number>>((acc, candidate) => {
    acc[candidate.source || 'Otro'] = (acc[candidate.source || 'Otro'] || 0) + 1;
    return acc;
  }, {})).map(([name, value]) => ({ name, value: Number(value) })).sort((a, b) => b.value - a.value);

  const noShow = filteredCandidates.filter(candidate => candidate.training?.status === 'NSP' || candidate.training?.attendance?.some(item => item.status === 'NSP')).length;
  const dropouts = filteredCandidates.filter(candidate => candidate.training?.status === 'DESERTO' || candidate.currentStage === 'BAJA').length;
  const trainingPopulation = filteredCandidates.filter(candidate => candidate.training?.status || candidate.currentStage === 'CAPACITACION' || candidate.currentStage === 'OJT').length;
  const trainingApproved = filteredCandidates.filter(candidate => candidate.selection?.trainingPassed || ['OJT', 'APTO_ALTA', 'GESTION_TALENTO', 'CONTRATADO'].includes(candidate.currentStage)).length;
  const initialPermanence = percent(hired, Math.max(aptos, hired));

  const weekly = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, index) => {
    const dayCandidates = filteredCandidates.filter(candidate => validDate(candidate.applicationDate)?.getDay() === index);
    return { day, postulantes: dayCandidates.length, aptos: dayCandidates.filter(isApto).length };
  });

  const recentActivity = filteredCandidates.flatMap(candidate => (candidate.selection?.traceability || []).map(item => ({
    id: `${candidate.id}-${item.id || item.date}-${item.time}`,
    candidate: candidate.fullName,
    user: item.user || candidate.recruiterName,
    action: item.action || `${item.previousStage} → ${item.newStage}`,
    date: item.date,
    time: item.time,
  }))).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).slice(0, 6);

  return (
    <div className="space-y-6 pb-12">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-xs text-slate-500 shadow-sm">
          <CalendarDays className="h-4 w-4 text-slate-600" />
          <select value={period} onChange={event => setPeriod(event.target.value)} className="w-full bg-transparent font-semibold text-slate-800 outline-none">
            <option value="ALL">Histórico completo</option><option value="MONTH">Últimos 30 días</option><option value="WEEK">Últimos 7 días</option>
          </select>
        </label>
        <label className="flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-xs text-slate-500 shadow-sm">
          <Filter className="h-4 w-4 text-slate-600" /><span>Convocatoria</span>
          <select value={campaignId} onChange={event => setCampaignId(event.target.value)} className="min-w-0 flex-1 bg-transparent font-semibold text-slate-800 outline-none">
            <option value="ALL">Todas</option>{campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}
          </select>
        </label>
        <label className="flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-xs text-slate-500 shadow-sm">
          <UserRound className="h-4 w-4 text-slate-600" /><span>Reclutador</span>
          <select value={recruiterId} onChange={event => setRecruiterId(event.target.value)} className="min-w-0 flex-1 bg-transparent font-semibold text-slate-800 outline-none">
            <option value="ALL">Todos</option>{recruiters.map(recruiter => <option key={recruiter.id} value={recruiter.id}>{recruiter.name}</option>)}
          </select>
        </label>
        <label className="flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-xs text-slate-500 shadow-sm">
          <MapPin className="h-4 w-4 text-slate-600" /><span>Sede</span>
          <select value={location} onChange={event => setLocation(event.target.value)} className="min-w-0 flex-1 bg-transparent font-semibold text-slate-800 outline-none">
            <option value="ALL">Todas</option>{locations.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="% Cobertura" value={`${coverage}%`} detail={`${hired} de ${vacancies} posiciones`} icon={Users} tone="bg-emerald-50 text-emerald-600" />
        <KpiCard label="Time to Fill" value={`${timeToFill} días`} detail={`${filteredCampaigns.length} convocatorias`} icon={Clock3} tone="bg-sky-50 text-sky-600" />
        <KpiCard label="% Conversión total" value={`${conversion}%`} detail={`${aptos} aptos de ${total}`} icon={Filter} tone="bg-teal-50 text-teal-600" />
        <KpiCard label="% Contactabilidad" value={`${contactability}%`} detail={`${contacted} contactados`} icon={PhoneCall} tone="bg-sky-50 text-sky-600" />
        <KpiCard label="% Aptitud" value={`${aptitude}%`} detail={`${aptos} de ${evaluated} evaluados`} icon={Star} tone="bg-amber-50 text-amber-600" />
        <KpiCard label="% Cumplimiento SLA" value={`${slaCompliance}%`} detail="Objetivo máximo: 30 días" icon={Target} tone="bg-rose-50 text-rose-600" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.3fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Filter className="h-5 w-5 text-sky-700" />Embudo de selección</h3>
          <div className="mt-5 space-y-1.5">
            {funnel.map((item, index) => <div key={item.label} className="grid grid-cols-[1fr_72px_140px] items-center gap-3 text-xs">
              <div className="flex justify-center"><div className="h-9 rounded-md" style={{ width: `${100 - index * 10}%`, backgroundColor: item.color, clipPath: 'polygon(5% 0, 95% 0, 86% 100%, 14% 100%)' }} /></div>
              <strong className="text-right text-slate-900">{item.value}</strong><span className="text-slate-500">{item.label}</span>
            </div>)}
          </div>
          <div className="mt-4 inline-flex rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Conversión total: {conversion}%</div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><TrendingUp className="h-5 w-5 text-sky-700" />Avance de convocatorias</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500"><tr><th className="py-3">Convocatoria</th><th>Cobertura</th><th>Time to Fill</th><th>Responsable</th><th>Avance</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{filteredCampaigns.slice(0, 6).map(campaign => {
                const campaignCandidates = filteredCandidates.filter(candidate => candidate.campaignId === campaign.id);
                const covered = campaignCandidates.filter(candidate => candidate.currentStage === 'CONTRATADO' || candidate.selection?.hiringConfirmed).length;
                const campaignCoverage = percent(covered, campaign.vacancies);
                const progress = percent(campaignCandidates.length, campaign.vacancies);
                return <tr key={campaign.id}><td className="py-3"><strong className="text-slate-900">{campaign.title}</strong><div className="text-[10px] text-slate-500">{campaign.area} · {campaign.location}</div></td><td><strong>{campaignCoverage}%</strong><div className="mt-1 h-1.5 w-20 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, campaignCoverage)}%` }} /></div></td><td className="font-semibold text-emerald-700">{dayDiff(campaign.requestDate, campaign.endDate || new Date().toISOString())} días</td><td>{campaign.responsibles?.[0]?.userName || campaign.assignedAnalystName || 'Sin asignar'}</td><td><strong>{progress}%</strong><div className="mt-1 h-1.5 w-24 rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-600" style={{ width: `${Math.min(100, progress)}%` }} /></div></td></tr>;
              })}</tbody>
            </table>
            {!filteredCampaigns.length && <EmptyState text="No hay convocatorias para los filtros seleccionados." />}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Users className="h-5 w-5 text-sky-700" />Rendimiento por reclutador</h3>
          <div className="mt-4 divide-y divide-slate-100">{recruiterStats.slice(0, 6).map(item => <div key={item.id} className="grid grid-cols-[1fr_55px_80px] items-center gap-3 py-3 text-xs"><div><strong className="text-slate-900">{item.name}</strong><div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, percent(item.aptos, Math.max(1, item.target)))}%` }} /></div></div><strong>{item.aptos}</strong><span className="text-sky-700">{item.conversion}% conv.</span></div>)}</div>
          {!recruiterStats.length && <EmptyState text="Sin actividad por reclutador." />}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><MapPin className="h-5 w-5 text-sky-700" />Postulantes por origen</h3>
          {sourceData.length ? <div className="mt-3 h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={1}>{sourceData.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /><Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer></div> : <EmptyState text="Sin fuentes registradas." />}
          <div className="text-xs text-slate-500">Total: <strong className="text-slate-900">{total}</strong> postulantes</div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Activity className="h-5 w-5 text-sky-700" />No Show y deserción preingreso</h3>
          <div className="mt-5 space-y-6">
            <div className="rounded-xl bg-rose-50 p-4"><span className="text-xs text-slate-600">No Show</span><div className="mt-2 text-3xl font-bold text-rose-600">{percent(noShow, total)}%</div><span className="text-xs text-slate-500">{noShow} de {total}</span></div>
            <div className="rounded-xl bg-amber-50 p-4"><span className="text-xs text-slate-600">Deserción preingreso</span><div className="mt-2 text-3xl font-bold text-amber-600">{percent(dropouts, total)}%</div><span className="text-xs text-slate-500">{dropouts} de {total}</span></div>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><TrendingUp className="h-5 w-5 text-sky-700" />Evolución semanal</h3>
          <div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={weekly}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 10 }} /><Line type="monotone" dataKey="postulantes" name="Postulantes" stroke="#154E7D" strokeWidth={2} /><Line type="monotone" dataKey="aptos" name="Aptos" stroke="#4CA899" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Award className="h-5 w-5 text-sky-700" />Calidad de ingreso</h3>
          <div className="mt-5 space-y-5"><div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50"><BriefcaseBusiness className="h-5 w-5 text-emerald-600" /></span><div><span className="text-xs text-slate-500">Aprobación en capacitación</span><div className="text-2xl font-bold text-emerald-700">{percent(trainingApproved, trainingPopulation)}%</div><span className="text-[10px] text-slate-500">{trainingApproved} de {trainingPopulation}</span></div></div></div><div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-50"><CheckCircle2 className="h-5 w-5 text-sky-600" /></span><div><span className="text-xs text-slate-500">Conversión a contratación</span><div className="text-2xl font-bold text-sky-700">{initialPermanence}%</div><span className="text-[10px] text-slate-500">{hired} contratados</span></div></div></div></div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Clock3 className="h-5 w-5 text-sky-700" />Actividad reciente</h3>
          <div className="mt-4 divide-y divide-slate-100">{recentActivity.map(item => <div key={item.id} className="py-3 text-xs"><div className="flex justify-between gap-3"><strong className="text-slate-900">{item.user}</strong><span className="shrink-0 text-[10px] text-slate-400">{item.date} {item.time}</span></div><div className="mt-1 text-slate-600">{item.action}</div><div className="text-[10px] text-slate-400">{item.candidate}</div></div>)}</div>
          {!recentActivity.length && <EmptyState text="No existe actividad reciente." />}
        </article>
      </section>

      <p className="text-center text-[11px] text-slate-400">Vista global actualizada con los datos disponibles para {currentUser.name}.</p>
    </div>
  );
};
