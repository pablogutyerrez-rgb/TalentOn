import React, { useState } from 'react';
import { 
  X, 
  UserMinus, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  FileText,
  Clock
} from 'lucide-react';
import { useTalent } from '../../context/TalentContext';
import { CandidateRecord, DropoutCategory, DropoutStage } from '../../types';
import { DROPOUT_CATEGORIES } from '../../config/catalogs';

interface RegisterDropoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: CandidateRecord | null;
  defaultStage?: DropoutStage;
}

export const RegisterDropoutModal: React.FC<RegisterDropoutModalProps> = ({
  isOpen,
  onClose,
  candidate,
  defaultStage = 'CAPACITACION_TEORICA'
}) => {
  const { registerStructuredDropout } = useTalent();

  const [stage, setStage] = useState<DropoutStage>(
    candidate?.currentStage === 'OJT' ? 'OJT' : defaultStage
  );
  const [category, setCategory] = useState<DropoutCategory>('PERSONAL');
  const [observation, setObservation] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !candidate) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!observation.trim()) {
      setErrorMsg('Debe ingresar el detalle u observación de la deserción / baja.');
      return;
    }

    registerStructuredDropout(candidate.id, {
      stage,
      category,
      observation
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        id="register-dropout-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600/90 text-white flex items-center justify-center shadow-md">
              <UserMinus className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-300">Control de Deserciones</span>
              <h2 className="text-base font-bold text-white">Registrar Baja de Participante</h2>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Candidate Info Card */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{candidate.fullName}</span>
                <span className="text-xs font-mono px-2 py-0.5 bg-slate-200 text-slate-700 rounded">
                  DNI {candidate.dni}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Capacitación: <strong className="text-slate-700">{candidate.training.cohortName || candidate.training.cohortCode || 'Sin grupo'}</strong>
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg">
              {candidate.currentStage === 'OJT' ? 'En OJT' : 'En Teoría'}
            </span>
          </div>

          {/* Stage selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Etapa en que Ocurre la Deserción
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStage('CAPACITACION_TEORICA')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  stage === 'CAPACITACION_TEORICA'
                    ? 'border-rose-500 bg-rose-50/70 text-rose-950 font-bold ring-2 ring-rose-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <div className="text-xs uppercase text-slate-500 mb-0.5">Etapa 1</div>
                <div className="text-sm">Capacitación Teórica</div>
              </button>

              <button
                type="button"
                onClick={() => setStage('OJT')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  stage === 'OJT'
                    ? 'border-rose-500 bg-rose-50/70 text-rose-950 font-bold ring-2 ring-rose-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <div className="text-xs uppercase text-slate-500 mb-0.5">Etapa 2</div>
                <div className="text-sm">OJT (En Piso)</div>
              </button>
            </div>
          </div>

          {/* Structured Category Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Categoría / Motivo Estructurado de Deserción
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DropoutCategory)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none font-medium"
              required
            >
              {DROPOUT_CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Detailed Observations */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Detalle u Observación del Motivo</span>
              <span className="text-[11px] text-slate-400 font-normal">Obligatorio</span>
            </label>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              rows={3}
              placeholder="Explique detalladamente la situación (ej: el postulante comunicó que consiguió empleo más cercano a su domicilio, inasistió 2 días seguidos sin justificar...)"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              required
            />
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Esta acción marcará al postulante con estado <strong>DESERTO</strong> en Formación, moverá su etapa a <strong>BAJA</strong> y alimentará los indicadores de retención por campaña y formador.
            </span>
          </div>

          {/* Footer */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition-colors flex items-center gap-1.5"
            >
              <UserMinus className="w-4 h-4" />
              <span>Confirmar Baja</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
