import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  Edit3,
  Filter,
  History,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Target,
  Users,
  X,
} from 'lucide-react';
import { useTalent } from '../context/TalentContext';
import { CampaignCall, ConvocatoriaStatus } from '../types';
import { ConvocatoriaModal } from '../components/modals/ConvocatoriaModal';
import { ResponsiblesModal } from '../components/modals/ResponsiblesModal';
import { SourcesModal } from '../components/modals/SourcesModal';
import { ConvocatoriaStatusModal } from '../components/modals/ConvocatoriaStatusModal';

type RiskLevel = 'BAJO' | 'MEDIO' | 'ALTO';

const statusLabel: Record<ConvocatoriaStatus, string> = {
  EN_PROCESO: 'En proceso',
  PUBLICADO: 'Publicado',
  CERRADO: 'Cerrado',
  ANULADO: 'Anulado',
  ACTIVA: 'Activa',
  EN_PAUSA: 'En pausa',
};

const StatusBadge: React.FC<{ status: ConvocatoriaStatus }> = ({ status }) => {
  const style = status === 'PUBLICADO' || status === 'ACTIVA'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : status === 'EN_PROCESO'
      ? 'bg-sky-50 text-sky-700 border-sky-100'
      : status === 'ANULADO'
        ? 'bg-rose-50 text-rose-700 border-rose-100'
        : status === 'EN_PAUSA'
          ? 'bg-amber-50 text-amber-700 border-amber-100'
          : 'bg-slate-100 text-slate-700 border-slate-200';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${style}`}>{statusLabel[status]}</span>;
};

const RiskBadge: React.FC<{ level: RiskLevel }> = ({ level }) => {
  const config = level === 'ALTO'
    ? { dot: 'bg-rose-500', text: 'Alto' }
    : level === 'MEDIO'
      ? { dot: 'bg-amber-500', text: 'Medio' }
      : { dot: 'bg-emerald-500', text: 'Bajo' };
  return <span className="inline-flex items-center gap-2 text-[10px] font-medium text-slate-600"><span className={`h-2 w-2 rounded-full ${config.dot}`} />{config.text}</span>;
};

const KpiCard: React.FC<{ title: string; value: string | number; detail: string; icon: React.ComponentType<{ className?: string }>; alert?: boolean }> = ({ title, value, detail, icon: Icon, alert }) => (
  <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${alert ? 'bg-rose-50 text-rose-600' : 'bg-sky-50 text-sky-700'}`}><Icon className="h-5 w-5" /></span>
      <div><div className="text-[10px] font-medium text-slate-500">{title}</div><div className="text-xl font-bold text-slate-900">{value}</div></div>
    </div>
    <div className="mt-2 pl-[52px] text-[10px] text-slate-400">{detail}</div>
  </article>
);

export const ConvocatoriasView: React.FC = () => {
  const { scopedCampaigns, currentUser, availableUsers, candidates, setSelectedCampaignId, setActiveModule } = useTalent();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [selectedSelector, setSelectedSelector] = useState('ALL');
  const [selectedProcessType, setSelectedProcessType] = useState('ALL');
  const [selectedManagementType, setSelectedManagementType] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [convocatoriaToEdit, setConvocatoriaToEdit] = useState<CampaignCall | null>(null);
  const [convocatoriaForResponsibles, setConvocatoriaForResponsibles] = useState<CampaignCall | null>(null);
  const [convocatoriaForSources, setConvocatoriaForSources] = useState<CampaignCall | null>(null);
  const [convocatoriaForStatus, setConvocatoriaForStatus] = useState<CampaignCall | null>(null);

  const companies = useMemo(() => Array.from(new Map(scopedCampaigns.filter(c=>c.companyId).map(c=>[c.companyId!,c.companyName||c.companyId!])).entries()), [scopedCampaigns]);
  const areas = useMemo(() => Array.from(new Set(scopedCampaigns.map(item => item.area).filter(Boolean))).sort(), [scopedCampaigns]);
  const locations = useMemo(() => Array.from(new Set(scopedCampaigns.map(item => item.location).filter(Boolean))).sort(), [scopedCampaigns]);
  const candidateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    candidates.forEach(candidate => {
      if (candidate.currentStage === 'CONTRATADO' || candidate.selection?.hiringConfirmed) {
        counts.set(candidate.campaignId, (counts.get(candidate.campaignId) || 0) + 1);
      }
    });
    return counts;
  }, [candidates]);

  const campaignMetrics = (campaign: CampaignCall) => {
    const hired = candidateCounts.get(campaign.id) || 0;
    const vacancies = Math.max(1, campaign.vacancies || 0);
    const coverage = Math.min(100, Math.round((hired / vacancies) * 100));
    const deadline = campaign.endDate ? new Date(`${campaign.endDate}T12:00:00`) : null;
    const daysLeft = deadline && !Number.isNaN(deadline.getTime()) ? Math.ceil((deadline.getTime() - Date.now()) / 86_400_000) : null;
    const risk: RiskLevel = campaign.status === 'CERRADO' || coverage >= 100
      ? 'BAJO'
      : daysLeft !== null && (daysLeft < 0 || (daysLeft <= 7 && coverage < 70))
        ? 'ALTO'
        : (daysLeft !== null && daysLeft <= 15) || coverage < 40
          ? 'MEDIO'
          : 'BAJO';
    return { hired, vacancies, coverage, daysLeft, risk };
  };

  const filteredCampaigns = scopedCampaigns.filter(campaign => {
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      if (![campaign.title, campaign.code, campaign.company, campaign.client, campaign.location].some(value => value?.toLowerCase().includes(query))) return false;
    }
    if (selectedCompany !== 'ALL' && campaign.companyId !== selectedCompany) return false;
    if (selectedArea !== 'ALL' && campaign.area !== selectedArea) return false;
    if (selectedSelector !== 'ALL' && !campaign.responsibles?.some(item => item.userId === selectedSelector) && campaign.assignedAnalystId !== selectedSelector) return false;
    if (selectedProcessType !== 'ALL' && campaign.processType !== selectedProcessType) return false;
    if (selectedManagementType !== 'ALL' && campaign.managementType !== selectedManagementType) return false;
    if (selectedLocation !== 'ALL' && campaign.location !== selectedLocation) return false;
    if (selectedStatus !== 'ALL' && campaign.status !== selectedStatus) return false;
    return true;
  });

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCompany('ALL');
    setSelectedArea('ALL');
    setSelectedSelector('ALL');
    setSelectedProcessType('ALL');
    setSelectedManagementType('ALL');
    setSelectedLocation('ALL');
    setSelectedStatus('ALL');
  };

  const activeFilters = [
    searchTerm ? { key: 'search', label: `Búsqueda: ${searchTerm}`, clear: () => setSearchTerm('') } : null,
    selectedStatus !== 'ALL' ? { key: 'status', label: statusLabel[selectedStatus as ConvocatoriaStatus], clear: () => setSelectedStatus('ALL') } : null,
    selectedSelector !== 'ALL' ? { key: 'selector', label: availableUsers.find(user => user.id === selectedSelector)?.name || 'Responsable', clear: () => setSelectedSelector('ALL') } : null,
    selectedCompany !== 'ALL' ? { key: 'company', label: selectedCompany, clear: () => setSelectedCompany('ALL') } : null,
    selectedArea !== 'ALL' ? { key: 'area', label: selectedArea, clear: () => setSelectedArea('ALL') } : null,
    selectedProcessType !== 'ALL' ? { key: 'process', label: selectedProcessType, clear: () => setSelectedProcessType('ALL') } : null,
    selectedManagementType !== 'ALL' ? { key: 'management', label: selectedManagementType, clear: () => setSelectedManagementType('ALL') } : null,
    selectedLocation !== 'ALL' ? { key: 'location', label: selectedLocation, clear: () => setSelectedLocation('ALL') } : null,
  ].filter((item): item is { key: string; label: string; clear: () => void } => Boolean(item));

  const totalVacancies = scopedCampaigns.reduce((sum, campaign) => sum + Number(campaign.vacancies || 0), 0);
  const totalHired = scopedCampaigns.reduce((sum, campaign) => sum + (candidateCounts.get(campaign.id) || 0), 0);
  const averageCoverage = totalVacancies ? Math.round((totalHired / totalVacancies) * 100) : 0;
  const riskCount = scopedCampaigns.filter(campaign => campaignMetrics(campaign).risk === 'ALTO').length;
  const activeCount = scopedCampaigns.filter(campaign => ['PUBLICADO', 'EN_PROCESO', 'ACTIVA'].includes(campaign.status)).length;
  const canCreate = currentUser.role === 'ADMIN' || currentUser.role === 'JEFE_SELECCION' || currentUser.role === 'ANALISTA_SELECCION';

  const openWorkspace = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setActiveModule('MIS_CONVOCATORIAS');
  };

  return <div className="talent-campaigns space-y-5 pb-10">
    <section className="talent-page-heading flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Gestión de Convocatorias</h2>
        <p className="mt-1 text-xs text-slate-500">Administra y monitorea tus convocatorias de selección en curso.</p>
      </div>
      {canCreate && <button type="button" onClick={() => { setConvocatoriaToEdit(null); setIsCreateModalOpen(true); }} className="flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-800"><Plus className="h-4 w-4" />Nueva convocatoria</button>}
    </section>

    <section className="talent-kpi-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard title="Convocatorias activas" value={activeCount} detail={`De ${scopedCampaigns.length} en total`} icon={BriefcaseBusiness} />
      <KpiCard title="Vacantes totales" value={totalVacancies} detail="En todas las convocatorias" icon={Users} />
      <KpiCard title="Cobertura promedio" value={`${averageCoverage}%`} detail="Promedio ponderado" icon={Target} />
      <KpiCard title="Convocatorias en riesgo" value={riskCount} detail={riskCount ? 'Requieren atención prioritaria' : 'Sin riesgos críticos'} icon={AlertTriangle} alert={riskCount > 0} />
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="campaign-compact-filters">
        <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Buscar por código, campaña o puesto..." className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none" /></label>
        <select value={selectedStatus} onChange={event => setSelectedStatus(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700"><option value="ALL">Estado: Todos</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={selectedSelector} onChange={event => setSelectedSelector(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700"><option value="ALL">Responsable: Todos</option>{availableUsers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
        <button type="button" onClick={() => setShowAdvancedFilters(value => !value)} aria-expanded={showAdvancedFilters} className={`flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${showAdvancedFilters ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}><Filter className="h-4 w-4" />Filtros<ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} /></button>
        <button type="button" onClick={resetFilters} disabled={!activeFilters.length} className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><RotateCcw className="h-4 w-4" />Limpiar</button>
      </div>

      {showAdvancedFilters && <div className="mt-3 grid grid-cols-1 gap-2.5 border-t border-slate-100 pt-3 sm:grid-cols-2 xl:grid-cols-5">
        <select aria-label="Filtrar empresa responsable" value={selectedCompany} onChange={event => setSelectedCompany(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs"><option value="ALL">Todas las empresas</option>{companies.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select>
        <select value={selectedArea} onChange={event => setSelectedArea(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs"><option value="ALL">Todas las áreas</option>{areas.map(area => <option key={area}>{area}</option>)}</select>
        <select value={selectedProcessType} onChange={event => setSelectedProcessType(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs"><option value="ALL">Todos los procesos</option><option value="EXTERNO">Externo</option><option value="INTERNO">Interno</option><option value="MIXTO">Mixto</option></select>
        <select value={selectedManagementType} onChange={event => setSelectedManagementType(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs"><option value="ALL">Todas las modalidades</option><option value="PRESENCIAL">Presencial</option><option value="REMOTO">Remoto</option><option value="HIBRIDO">Híbrido</option></select>
        <select value={selectedLocation} onChange={event => setSelectedLocation(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs"><option value="ALL">Todas las sedes</option>{locations.map(location => <option key={location}>{location}</option>)}</select>
      </div>}

      {activeFilters.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"><span className="text-[10px] font-semibold text-slate-500">Filtros activos:</span>{activeFilters.map(filter => <button key={filter.key} type="button" onClick={filter.clear} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-700 hover:border-sky-200 hover:bg-sky-50">{filter.label}<X className="h-3 w-3" /></button>)}</div>}
    </section>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-xs">
          <thead className="bg-[#0C2745] text-white"><tr><th className="px-4 py-3">Convocatoria</th><th className="px-3 py-3">Campaña / Sede</th><th className="px-3 py-3 text-center">Vacantes</th><th className="px-3 py-3">Cobertura</th><th className="px-3 py-3">Responsable</th><th className="px-3 py-3">Fecha límite</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Riesgo</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {!filteredCampaigns.length && <tr><td colSpan={9} className="py-12 text-center text-xs text-slate-500">No se encontraron convocatorias con los filtros aplicados.</td></tr>}
            {filteredCampaigns.map(campaign => {
              const metrics = campaignMetrics(campaign);
              const responsible = campaign.assignedAnalystName || campaign.responsibles?.[0]?.userName || 'Sin asignar';
              return <tr key={campaign.id} className="transition hover:bg-slate-50/80">
                <td className="px-4 py-3"><div className="font-semibold text-slate-900">{campaign.code}</div><div className="mt-1 text-[10px] text-slate-500">{campaign.area || 'Operaciones'}</div><div className="mt-1 flex items-center gap-1 text-[9px] text-slate-400"><CalendarDays className="h-3 w-3" />Publicada: {campaign.requestDate}</div></td>
                <td className="px-3 py-3"><div className="font-semibold text-slate-900">{campaign.title}</div><div className="mt-1 text-[10px] font-semibold text-slate-600">{campaign.companyName||campaign.companyId}</div><div className="mt-1 text-[10px] text-slate-500">{campaign.company || campaign.client}</div><div className="mt-1 text-[10px] text-slate-400">{campaign.location}</div></td>
                <td className="px-3 py-3 text-center"><div className="font-bold text-slate-900">{metrics.vacancies}</div><div className="text-[9px] text-slate-400">Total</div></td>
                <td className="px-3 py-3"><div className={`font-semibold ${metrics.coverage < 40 ? 'text-amber-600' : 'text-emerald-700'}`}>{metrics.coverage}%</div><div className="mt-1.5 h-1.5 w-24 rounded-full bg-slate-200"><div className={`h-full rounded-full ${metrics.coverage < 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${metrics.coverage}%` }} /></div><div className="mt-1 text-[9px] text-slate-400">{metrics.hired} de {metrics.vacancies}</div></td>
                <td className="px-3 py-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-semibold text-slate-600">{responsible.split(' ').map(value => value[0]).slice(0, 2).join('')}</span><div><div className="max-w-[120px] truncate font-medium text-slate-800">{responsible}</div><div className="text-[9px] text-slate-400">Selección</div></div></div></td>
                <td className="px-3 py-3"><div className="flex items-center gap-1.5 font-medium text-slate-700"><CalendarDays className="h-3.5 w-3.5 text-slate-400" />{campaign.endDate || 'Sin definir'}</div><div className={`mt-1 text-[9px] ${metrics.daysLeft !== null && metrics.daysLeft < 0 ? 'text-rose-600' : 'text-slate-400'}`}>{metrics.daysLeft === null ? 'Sin plazo' : metrics.daysLeft < 0 ? `Venció hace ${Math.abs(metrics.daysLeft)} días` : `En ${metrics.daysLeft} días`}</div></td>
                <td className="px-3 py-3"><StatusBadge status={campaign.status} /></td>
                <td className="px-3 py-3"><RiskBadge level={metrics.risk} /></td>
                <td className="px-4 py-3"><div className="flex justify-end gap-1">
                  <button type="button" onClick={() => openWorkspace(campaign.id)} title="Abrir pipeline" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"><ArrowRight className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setConvocatoriaForResponsibles(campaign)} title="Responsables y metas" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"><Users className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setConvocatoriaForSources(campaign)} title="Fuentes de difusión" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"><Share2 className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setConvocatoriaForStatus(campaign)} title="Cambiar estado e historial" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"><History className="h-3.5 w-3.5" /></button>
                  {canCreate && <button type="button" onClick={() => { setConvocatoriaToEdit(campaign); setIsCreateModalOpen(true); }} title="Editar convocatoria" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Edit3 className="h-3.5 w-3.5" /></button>}
                </div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500"><span>Mostrando {filteredCampaigns.length} de {scopedCampaigns.length} convocatorias</span><span>Datos actualizados en tiempo real</span></footer>
    </section>

    <ConvocatoriaModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} convocatoriaToEdit={convocatoriaToEdit} />
    <ResponsiblesModal isOpen={Boolean(convocatoriaForResponsibles)} onClose={() => setConvocatoriaForResponsibles(null)} convocatoria={convocatoriaForResponsibles} />
    <SourcesModal isOpen={Boolean(convocatoriaForSources)} onClose={() => setConvocatoriaForSources(null)} convocatoria={convocatoriaForSources} />
    <ConvocatoriaStatusModal isOpen={Boolean(convocatoriaForStatus)} onClose={() => setConvocatoriaForStatus(null)} convocatoria={convocatoriaForStatus} />
  </div>;
};
