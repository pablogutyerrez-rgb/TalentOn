import React, { useState } from 'react';
import { 
  X, 
  UserX, 
  AlertTriangle, 
  ShieldAlert, 
  MessageSquare,
  Check
} from 'lucide-react';
import { useTalent } from '../../context/TalentContext';
import { CandidateRecord, SelectionStage } from '../../types';

interface DiscardCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: CandidateRecord | null;
}

const DISCARD_REASONS_BY_STAGE: Record<string, string[]> = {
  'Entrevista': [
    'No cumple perfil de comunicación o dicción',
    'No acepta propuesta salarial o bonificaciones',
    'Incompatibilidad de horarios o disponibilidad',
    'Inasistencia a entrevista programada (No Show)',
    'Falta de experiencia mínima requerida',
    'Desinterés manifiesto en la campaña'
  ],
  'Verificación técnica': [
    'Velocidad de internet insuficiente (< 20 Mbps)',
    'Equipo de cómputo no cumple requisitos de RAM o procesador',
    'Sin headset con cancelación de ruido o ambiente no aislado',
    'Sistema operativo incompatible (requiere Windows 10/11)',
    'No envió capturas técnicas de verificación'
  ],
  'Evaluaciones': [
    'No aprueba prueba psicométrica / perfil conductual',
    'Velocidad de digitación insuficiente (< 30 WPM)',
    'Falla en simulación de llamada / Roleplay',
    'Puntaje global inferior al corte mínimo (65%)',
    'No se presentó a las evaluaciones en línea'
  ],
  'Otros / Administrativo': [
    'Documentación obligatoria incompleta o ilegible',
    'Observación en antecedentes o historial laboral',
    'Postulante duplicado en otra convocatoria activa',
    'Desiste voluntariamente del proceso de selección',
    'No responde a intentos reiterados de contacto'
  ]
};

export const DiscardCandidateModal: React.FC<DiscardCandidateModalProps> = ({
  isOpen,
  onClose,
  candidate
}) => {
  const { updateCandidateSelectionStage } = useTalent();

  const [selectedCategory, setSelectedCategory] = useState<string>('Entrevista');
  const [selectedReason, setSelectedReason] = useState<string>(DISCARD_REASONS_BY_STAGE['Entrevista'][0]);
  const [detail, setDetail] = useState('');

  if (!isOpen || !candidate) return null;

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setSelectedReason(DISCARD_REASONS_BY_STAGE[cat][0]);
  };

  const handleConfirmDiscard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) return;

    updateCandidateSelectionStage(
      candidate.id,
      'DESCARTADO',
      selectedReason,
      detail,
      `Descarte registrado en etapa de ${candidate.selection.stage}: ${selectedReason}. ${detail}`
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-rose-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-rose-200">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Descartar Candidato
              </h3>
              <p className="text-xs text-rose-200">
                {candidate.fullName} • Etapa actual: <span className="font-bold">{candidate.selection.stage}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-rose-200 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleConfirmDiscard} className="p-6 space-y-5">
          
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Registro de motivo estructurado</p>
              <p className="text-2xs text-rose-700 mt-0.5">
                Esta acción marcará al candidato como "No Apto / Descartado" y alimentará el diagrama de Pareto e indicadores de rechazo.
              </p>
            </div>
          </div>

          {/* Category Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Categoría del Motivo
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(DISCARD_REASONS_BY_STAGE).map(cat => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold text-left border transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-rose-50 border-rose-500 text-rose-950 ring-1 ring-rose-500 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Reason options */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Motivo Específico *
            </label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50">
              {DISCARD_REASONS_BY_STAGE[selectedCategory].map((reason, idx) => (
                <label
                  key={idx}
                  className={`p-2 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition-all ${
                    selectedReason === reason
                      ? 'bg-white border-rose-400 font-semibold text-slate-900 shadow-2xs'
                      : 'border-transparent text-slate-600 hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="text-rose-600"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Mandatory Detail */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Detalle / Observación del Descarte
            </label>
            <textarea
              rows={2}
              required
              placeholder="Especifica detalles sobre el descarte para trazabilidad..."
              value={detail}
              onChange={e => setDetail(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer"
            >
              Confirmar Descarte
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
