import React, { useEffect, useState } from 'react';
import { 
  X, 
  UserCheck, 
  Calendar, 
  Clock, 
  MapPin, 
  Building2, 
  AlertCircle, 
  CheckCircle2
} from 'lucide-react';
import { useTalent } from '../../context/TalentContext';
import { TrainingCohort, UserProfile } from '../../types';

interface AssignTrainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cohort: TrainingCohort | null;
}

export const AssignTrainerModal: React.FC<AssignTrainerModalProps> = ({
  isOpen,
  onClose,
  cohort
}) => {
  const { listAvailableTrainers, assignTrainerToCohort } = useTalent();

  const [selectedTrainerId, setSelectedTrainerId] = useState<string>(cohort?.trainerId || '');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formadores, setFormadores] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !cohort) return;
    let active = true;
    setSelectedTrainerId(cohort.trainerId || '');
    setNotes('');
    setErrorMsg(null);
    setIsLoading(true);
    void listAvailableTrainers(cohort.id)
      .then(trainers => { if (active) setFormadores(trainers); })
      .catch(error => { if (active) setErrorMsg(error instanceof Error ? error.message : 'No se pudieron cargar los formadores disponibles.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [cohort?.id, cohort?.trainerId, isOpen]);

  if (!isOpen || !cohort) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedTrainerId) {
      setErrorMsg('Debe seleccionar un formador.');
      return;
    }

    const trainer = formadores.find(u => u.id === selectedTrainerId);
    if (!trainer) {
      setErrorMsg('Formador no encontrado.');
      return;
    }

    setIsSaving(true);
    try {
      await assignTrainerToCohort(cohort.id, trainer.id, trainer.name, notes);
      onClose();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      const friendly = code === 'FIRESTORE_404'
        ? 'Esta capacitación no existe en la base de datos. Recarga la vista e inténtalo nuevamente.'
        : code === 'TRAINER_NOT_AVAILABLE' ? 'El formador ya no está activo o no tiene acceso a Formación.'
          : code === 'FORBIDDEN' ? 'No tienes permiso para reasignar esta capacitación.'
            : code || 'No se pudo guardar la asignación.';
      setErrorMsg(friendly);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        id="assign-trainer-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/90 text-white flex items-center justify-center shadow-md">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">Coordinación de Formación</span>
              <h2 className="text-base font-bold text-white">Asignar Formador Responsable</h2>
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Cohort Summary Box */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {cohort.code}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {cohort.enrolledCount} participantes inscritos
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900">{cohort.name}</h4>
            <div className="text-xs text-slate-600 grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{cohort.company || cohort.campaignName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Inicio: {cohort.startDate}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{cohort.schedule}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{cohort.modality} - {cohort.location}</span>
              </div>
            </div>
          </div>

          {/* Trainer Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Seleccionar Formador / Trainer
            </label>
            <select
              value={selectedTrainerId}
              onChange={(e) => setSelectedTrainerId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none font-medium"
              required
              disabled={isLoading || isSaving}
            >
              <option value="">{isLoading ? 'Cargando formadores...' : '-- Seleccione un Formador disponible --'}</option>
              {formadores.map(formador => (
                <option key={formador.id} value={formador.id}>
                  {formador.name} ({formador.email})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              El formador seleccionado tendrá acceso inmediato a registrar asistencias, notas de módulos y métricas de OJT para este grupo.
            </p>
          </div>

          {/* Notes / Special Instructions */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Instrucciones / Observaciones para el Formador
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ej: Énfasis en matriz de objeciones para producto prepago, material entregado por cliente..."
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || isSaving || formadores.length === 0}
              className="px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60 rounded-xl shadow-md shadow-purple-500/20 transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : 'Confirmar Asignación'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
