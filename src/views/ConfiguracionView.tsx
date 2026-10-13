import React, { useEffect, useState } from 'react';
import { 
  Settings, 
  ShieldCheck, 
  FileText, 
  Check, 
  Building,
  ArrowRight
} from 'lucide-react';
import { DROPOUT_REASONS, DISCARD_REASONS, DOCUMENT_TYPES } from '../config/catalogs';
import { useTalent } from '../context/TalentContext';
import {OrganizationAdmin} from '../components/common/OrganizationAdmin';

export const ConfiguracionView: React.FC = () => {
  const { setActiveModule, getSystemSettings, updateSystemSettings } = useTalent();
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [minPassGrade, setMinPassGrade] = useState(80);
  const [minAttendancePct, setMinAttendancePct] = useState(85);
  const [slaSelectionDays, setSlaSelectionDays] = useState(5);
  const [ojtDurationDays, setOjtDurationDays] = useState(5);

  useEffect(() => {
    let active = true;
    void getSystemSettings()
      .then(settings => {
        if (!active) return;
        setCompanyName(settings.companyName);
        setMinPassGrade(settings.minPassGrade);
        setMinAttendancePct(settings.minAttendancePct);
        setSlaSelectionDays(settings.slaSelectionDays);
        setOjtDurationDays(settings.ojtDurationDays);
      })
      .catch(() => active && setError('No se pudo cargar la configuración.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(''); setSavedSuccess(false);
    try {
      await updateSystemSettings({ companyName, minPassGrade, minAttendancePct, slaSelectionDays, ojtDurationDays });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      setError('No se pudo guardar la configuración. Verifica los valores e inténtalo nuevamente.');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <OrganizationAdmin/>
      
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-700" />
            Configuración del Sistema de Talento
          </h2>
          <p className="text-xs text-slate-500">
            Parámetros de evaluación, etapas configurables, motivos de descarte y reglas operativas
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            <Check className="w-4 h-4" />
            <span>Configuración guardada correctamente</span>
          </div>
        )}
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">{error}</div>}
      </div>

      {/* RBAC Users Direct Banner */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-5 rounded-2xl shadow-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-purple-300">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Gestión de Usuarios, Roles y Permisos por Módulo</h3>
            <p className="text-xs text-purple-200">
              Administra qué roles tienen acceso a Selección, Formación, Talento, Analítica o Administración.
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveModule('ADMIN_USUARIOS')}
          className="px-4 py-2 bg-white hover:bg-purple-50 text-purple-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <span>Ir a Usuarios & Roles</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Parametros Generales */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4 text-sky-600" />
            Parámetros Institucionales & Umbrales de Calidad
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-[11px] font-medium text-slate-600">Razón Social Empresa / BPO</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full mt-1 bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600">Nota Mínima Aprobatoria en Formación (0-100)</label>
              <input
                type="number"
                value={minPassGrade}
                onChange={(e) => setMinPassGrade(Number(e.target.value))}
                className="w-full mt-1 bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold text-indigo-700"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600">Asistencia Mínima Obligatoria (%)</label>
              <input
                type="number"
                value={minAttendancePct}
                onChange={(e) => setMinAttendancePct(Number(e.target.value))}
                className="w-full mt-1 bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold text-emerald-700"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600">SLA Máximo en Selección (Días hábiles)</label>
              <input
                type="number"
                value={slaSelectionDays}
                onChange={(e) => setSlaSelectionDays(Number(e.target.value))}
                className="w-full mt-1 bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600">Duración Estándar de OJT (Días)</label>
              <input
                type="number"
                value={ojtDurationDays}
                onChange={(e) => setOjtDurationDays(Number(e.target.value))}
                className="w-full mt-1 bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Motivos de Descarte y Deserción */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Motivos de Descarte en Selección */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
              Motivos Tipificados de Descarte en Selección
            </h3>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {DISCARD_REASONS.map((reason, idx) => (
                <div key={idx} className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-700">
                  {reason}
                </div>
              ))}
            </div>
          </div>

          {/* Motivos de Deserción en Formación / OJT */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
              Motivos Tipificados de Deserción / Baja en Capacitación & OJT
            </h3>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {DROPOUT_REASONS.map((reason, idx) => (
                <div key={idx} className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-700">
                  {reason}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Documentos Obligatorios para Alta */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            Checklist de Documentos Obligatorios para Contratación (Apto para Alta)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {DOCUMENT_TYPES.map((doc, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium text-slate-800">{doc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || saving}
            className="px-6 py-2.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md transition-colors cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading ? 'Cargando…' : saving ? 'Guardando…' : 'Guardar Cambios de Configuración'}
          </button>
        </div>
      </form>

    </div>
  );
};
