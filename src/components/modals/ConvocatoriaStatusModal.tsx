import React, { useState } from 'react';
import { 
  X, 
  Clock, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  Ban, 
  Globe, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { useTalent } from '../../context/TalentContext';
import { CampaignCall, ConvocatoriaStatus } from '../../types';

interface ConvocatoriaStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  convocatoria: CampaignCall | null;
}

export const ConvocatoriaStatusModal: React.FC<ConvocatoriaStatusModalProps> = ({
  isOpen,
  onClose,
  convocatoria
}) => {
  const { updateConvocatoriaStatus, currentUser } = useTalent();

  const [newStatus, setNewStatus] = useState<ConvocatoriaStatus>(convocatoria?.status || 'EN_PROCESO');
  const [reason, setReason] = useState('');

  if (!isOpen || !convocatoria) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newStatus === convocatoria.status) {
      onClose();
      return;
    }

    await updateConvocatoriaStatus(convocatoria.id, newStatus, reason || undefined);
    onClose();
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'PUBLICADO':
        return <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800">Publicado</span>;
      case 'EN_PROCESO':
        return <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-sky-100 text-sky-800">En proceso</span>;
      case 'CERRADO':
        return <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-slate-200 text-slate-800">Cerrado</span>;
      case 'ANULADO':
        return <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-rose-100 text-rose-800">Anulado</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-slate-100 text-slate-700">{st}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Cambio de Estado & Historial
              </h3>
              <p className="text-xs text-slate-400">
                {convocatoria.code} • {convocatoria.title}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800">
              Nuevo Estado de la Convocatoria
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                newStatus === 'EN_PROCESO' ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="status"
                  value="EN_PROCESO"
                  checked={newStatus === 'EN_PROCESO'}
                  onChange={() => setNewStatus('EN_PROCESO')}
                  className="text-sky-600"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">En proceso</div>
                  <div className="text-2xs text-slate-500">Configuración interna y screening</div>
                </div>
              </label>

              <label className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                newStatus === 'PUBLICADO' ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="status"
                  value="PUBLICADO"
                  checked={newStatus === 'PUBLICADO'}
                  onChange={() => setNewStatus('PUBLICADO')}
                  className="text-emerald-600"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">Publicado</div>
                  <div className="text-2xs text-slate-500">Difusión activa en fuentes</div>
                </div>
              </label>

              <label className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                newStatus === 'CERRADO' ? 'bg-slate-100 border-slate-500 ring-2 ring-slate-500/20' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="status"
                  value="CERRADO"
                  checked={newStatus === 'CERRADO'}
                  onChange={() => setNewStatus('CERRADO')}
                  className="text-slate-600"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">Cerrado</div>
                  <div className="text-2xs text-slate-500">Meta cubierta o concluida</div>
                </div>
              </label>

              <label className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                newStatus === 'ANULADO' ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="status"
                  value="ANULADO"
                  checked={newStatus === 'ANULADO'}
                  onChange={() => setNewStatus('ANULADO')}
                  className="text-rose-600"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">Anulado</div>
                  <div className="text-2xs text-slate-500">Cancelado por cliente o HQ</div>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo / Justificación del cambio
              </label>
              <textarea
                rows={2}
                placeholder="Indica el motivo del cambio de estado para la auditoría..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800"
              />
            </div>
          </div>

          {/* Chronological History Log */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Historial de Cambios de Estado
            </h4>

            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2.5 max-h-48 overflow-y-auto">
              {(!convocatoria.statusHistory || convocatoria.statusHistory.length === 0) ? (
                <p className="text-2xs text-slate-500 text-center py-2">Sin historial de cambios registrado.</p>
              ) : (
                convocatoria.statusHistory.map((hist, idx) => (
                  <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-2xs text-slate-500">
                      <span className="font-semibold text-slate-700">{hist.changedBy}</span>
                      <span>{hist.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-2xs line-through">{hist.previousStatus}</span>
                      <span className="text-slate-400 text-2xs">→</span>
                      {getStatusBadge(hist.newStatus)}
                    </div>
                    {hist.reason && (
                      <p className="text-2xs text-slate-600 italic">"{hist.reason}"</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
            >
              Actualizar Estado
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
