import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  GraduationCap, 
  Headphones, 
  Briefcase,
  Building,
  Target
} from 'lucide-react';
import { useTalent } from '../context/TalentContext';

export const AnaliticaView: React.FC = () => {
  const { candidates, campaigns, cohorts } = useTalent();

  const total = candidates.length;
  const inSelection = candidates.filter(c => c.currentStage === 'SELECCION').length;
  const inTraining = candidates.filter(c => c.currentStage === 'CAPACITACION').length;
  const inOjt = candidates.filter(c => c.currentStage === 'OJT').length;
  const readyHiring = candidates.filter(c => c.currentStage === 'APTO_ALTA').length;
  const hired = candidates.filter(c => c.currentStage === 'CONTRATADO').length;
  const discarded = candidates.filter(c => c.currentStage === 'DESCARTADO').length;
  const dropouts = candidates.filter(c => c.currentStage === 'BAJA').length;

  const funnelData = [
    { stage: '1. Selección', count: inSelection + inTraining + inOjt + readyHiring + hired + discarded, pct: 100, color: 'bg-sky-500' },
    { stage: '2. Capacitación', count: inTraining + inOjt + readyHiring + hired + dropouts, pct: Math.round(((inTraining + inOjt + readyHiring + hired + dropouts) / (total || 1)) * 100), color: 'bg-indigo-500' },
    { stage: '3. OJT (Piso)', count: inOjt + readyHiring + hired, pct: Math.round(((inOjt + readyHiring + hired) / (total || 1)) * 100), color: 'bg-amber-500' },
    { stage: '4. Apto para Alta', count: readyHiring + hired, pct: Math.round(((readyHiring + hired) / (total || 1)) * 100), color: 'bg-emerald-500' },
    { stage: '5. Contratados', count: hired, pct: Math.round((hired / (total || 1)) * 100), color: 'bg-teal-600' }
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-600" />
            Analítica de Conversión & Eficiencia Operativa
          </h2>
          <p className="text-xs text-slate-500">
            Métricas de embudo, deserciones por etapa, tiempos de ingreso a piso (Time-to-Floor)
          </p>
        </div>
      </div>

      {/* Metric Cards Top */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
          <span className="text-[11px] font-semibold text-slate-500">Total Postulantes Registrados</span>
          <div className="text-2xl font-black text-slate-900">{total}</div>
          <div className="text-[10px] text-slate-500">A través de 5 canales de atracción</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
          <span className="text-[11px] font-semibold text-slate-500">Tasa de Aprobación Selección</span>
          <div className="text-2xl font-black text-sky-600">68.4%</div>
          <div className="text-[10px] text-slate-500">Filtros psicotécnicos y roleplay</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
          <span className="text-[11px] font-semibold text-slate-500">Retención en Formación</span>
          <div className="text-2xl font-black text-indigo-600">91.2%</div>
          <div className="text-[10px] text-slate-500">Bajas controladas en aula</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
          <span className="text-[11px] font-semibold text-slate-500">Time-to-Floor Promedio</span>
          <div className="text-2xl font-black text-emerald-600">14.2 días</div>
          <div className="text-[10px] text-slate-500">De postulación a primera llamada real</div>
        </div>
      </div>

      {/* Funnel Progress Breakdown */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
            Embudo Unificado de Conversión (End-to-End)
          </h3>
          <p className="text-xs text-slate-500">Porcentaje de retención y avance por cada etapa del flujo</p>
        </div>

        <div className="space-y-4">
          {funnelData.map((f, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800">{f.stage}</span>
                <span className="font-semibold text-slate-600">
                  {f.count} personas ({f.pct}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div 
                  className={`${f.color} h-full rounded-full transition-all duration-700`}
                  style={{ width: `${Math.max(5, f.pct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2 Cols: Motivos de Deserción & Campañas Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Deserción por Motivo */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            Principales Motivos de Deserción / Baja
          </h3>
          <div className="space-y-2 text-xs">
            {[
              { reason: 'Incompatibilidad de horarios de estudio', pct: 38 },
              { reason: 'Otra oferta laboral más cercana a domicilio', pct: 26 },
              { reason: 'Desaprobación en examen final de producto', pct: 18 },
              { reason: 'No cumple estándar de calidad QA en OJT', pct: 12 },
              { reason: 'Inasistencia reiterada injustificada', pct: 6 }
            ].map((d, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-700">{d.reason}</span>
                <strong className="text-slate-900">{d.pct}%</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Campañas vs Vacantes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-600" />
            Cumplimiento de Dotación por Campaña
          </h3>
          <div className="space-y-3 text-xs">
            {campaigns.map(camp => {
              const pct = Math.round((camp.hiredCount / camp.vacancies) * 100);
              return (
                <div key={camp.id} className="space-y-1">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-800">{camp.title} ({camp.client})</span>
                    <strong className="text-slate-900">{camp.hiredCount} / {camp.vacancies} ({pct}%)</strong>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
