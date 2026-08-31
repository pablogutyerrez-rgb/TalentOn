import React, { useEffect, useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  CreditCard, 
  GraduationCap, 
  UserCheck, 
  Building2, 
  ArrowRight,
  ExternalLink,
  Calendar,
  Lock,
  Sparkles,
  Info
} from 'lucide-react';
import { CandidateEligibility, CandidateRecord } from '../../types';
import { useTalent } from '../../context/TalentContext';
import { evaluateAltaReadiness } from '../../utils/expedientUtils';
import { IdentityAvatar } from '../common/IdentityAvatar';

interface ValidacionAltaModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: CandidateRecord;
  onSuccess?: () => void;
}

export const ValidacionAltaModal: React.FC<ValidacionAltaModalProps> = ({
  isOpen,
  onClose,
  candidate,
  onSuccess
}) => {
  const { 
    currentUser, 
    approveParticipantToTalentAlta, 
    getCandidateEligibility,
    openCandidate360,
    logBlockedAltaAttempt
  } = useTalent();

  const [altaNotes, setAltaNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [eligibility, setEligibility] = useState<CandidateEligibility | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEligibility(null); setSubmitError('');
    void getCandidateEligibility(candidate.id).then(setEligibility).catch(error => setSubmitError(error instanceof Error ? error.message : 'No fue posible validar la elegibilidad.'));
  }, [isOpen, candidate.id]);

  if (!isOpen) return null;

  const readiness = evaluateAltaReadiness(candidate);
  const canApprove = eligibility?.eligible === true;
  const reasons = eligibility?.pending ?? ['Validando requisitos con el servidor…'];
  const analysis = eligibility ? {
    ...readiness.analysis,
    status: eligibility.documentsComplete ? 'COMPLETO' as const : 'INCOMPLETO' as const,
    statusLabel: eligibility.documentsComplete ? 'Completo' : 'Expediente incompleto',
    percentage: eligibility.documentProgress,
    salaryAccountStatus: { ...readiness.analysis.salaryAccountStatus, isConfigured: eligibility.salaryAccountComplete },
  } : readiness.analysis;

  const handleConfirmAlta = async () => {
    if (!canApprove) {
      logBlockedAltaAttempt(candidate.id, reasons);
      return;
    }

    setIsSubmitting(true); setSubmitError('');
    try {
      await approveParticipantToTalentAlta(candidate.id, altaNotes);
      onClose(); if (onSuccess) onSuccess();
    } catch (error) { setSubmitError(error instanceof Error ? error.message : 'No fue posible dar de alta al candidato.'); }
    finally { setIsSubmitting(false); }
  };

  const handleOpen360Docs = () => {
    onClose();
    openCandidate360(candidate.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className={`p-5 text-white flex items-center justify-between shrink-0 ${
          canApprove ? 'bg-gradient-to-r from-emerald-700 to-teal-800' : 'bg-gradient-to-r from-amber-700 to-slate-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md">
              {canApprove ? (
                <ShieldCheck className="w-6 h-6 text-emerald-300" />
              ) : (
                <ShieldAlert className="w-6 h-6 text-amber-300" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white">
                  Control Previo al Alta
                </span>
                <span className="text-xs text-slate-200">
                  {canApprove ? 'Validación Exitosa' : 'Expediente Pendiente'}
                </span>
              </div>
              <h3 className="text-lg font-bold mt-0.5">
                Validación de Alta hacia Gestión de Talento
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar text-xs">
          {submitError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-rose-700 font-semibold">{submitError}</div>}
          
          {/* Candidate Profile Header Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <IdentityAvatar
                src={candidate.avatarUrl}
                name={candidate.fullName}
                className="w-12 h-12 rounded-full border-2 border-white shadow-xs text-xs"
              />
              <div>
                <h4 className="text-sm font-bold text-slate-900">{candidate.fullName}</h4>
                <div className="text-slate-500 text-xs flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="font-mono font-semibold">DNI: {candidate.dni}</span>
                  <span>•</span>
                  <span>Campaña: <strong>{candidate.campaignName}</strong></span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                analysis.status === 'COMPLETO' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : analysis.status === 'OBSERVADO'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                <span>{analysis.statusLabel}</span>
                <span className="font-mono text-[10px]">({analysis.percentage}%)</span>
              </span>
            </div>
          </div>

          {/* Validation Checklist (4 Critical Checkpoints) */}
          <div className="space-y-2.5">
            <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              Requisitos de Conformidad para Alta Laboral
            </h5>

            <div className="grid grid-cols-1 gap-2.5">
              
              {/* Checkpoint 1: Capacitación / OJT Aprobada */}
              <div className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                readiness.isTrainingApproved 
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
                  : 'bg-rose-50/70 border-rose-200 text-rose-950'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg mt-0.5 ${readiness.isTrainingApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">
                      1. Capacitación Teórica & OJT Aprobados
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      {readiness.isTrainingApproved ? (
                        <span>
                          Aprobado satisfactoriamente • Promedio: <strong>{candidate.training?.finalGrade || 16}/20</strong> • Asistencia conforme.
                        </span>
                      ) : (
                        <span className="text-rose-700 font-semibold">
                          Pendiente de aprobación de evaluaciones y cierre de OJT en Formación.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  readiness.isTrainingApproved ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                }`}>
                  {readiness.isTrainingApproved ? 'CONFORME' : 'PENDIENTE'}
                </span>
              </div>

              {/* Checkpoint 2: Expediente Documental Completo */}
              <div className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                analysis.status === 'COMPLETO'
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
                  : 'bg-amber-50/70 border-amber-200 text-amber-950'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg mt-0.5 ${analysis.status === 'COMPLETO' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">
                      2. Expediente Documental Completo & Validado (100%)
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      {analysis.status === 'COMPLETO' ? (
                        <span>
                          DNI, CV, CUL/Antecedentes y Recibo de Servicios 100% revisados y validados.
                        </span>
                      ) : (
                        <span className="text-amber-800">
                          {analysis.observedCount > 0 
                            ? `Existen ${analysis.observedCount} documento(s) observados que requieren subsanación.` 
                            : `Expediente al ${analysis.percentage}%. Faltan validar documentos obligatorios.`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  analysis.status === 'COMPLETO' ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                }`}>
                  {analysis.status === 'COMPLETO' ? 'VALIDADO' : 'INCOMPLETO'}
                </span>
              </div>

              {/* Checkpoint 3: Cuenta Sueldo / Apertura */}
              <div className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                analysis.salaryAccountStatus.isConfigured
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
                  : 'bg-amber-50/70 border-amber-200 text-amber-950'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg mt-0.5 ${analysis.salaryAccountStatus.isConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">
                      3. Disposición de Cuenta Sueldo para Haberes
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      {analysis.salaryAccountStatus.isConfigured ? (
                        <span>
                          {analysis.salaryAccountStatus.type === 'CUENTA_PROPIA'
                            ? `Registrada cuenta activa: ${analysis.salaryAccountStatus.detail}`
                            : `Solicitud de apertura formalizada: ${analysis.salaryAccountStatus.detail}`}
                        </span>
                      ) : (
                        <span className="text-amber-800">
                          Pendiente de registrar cuenta bancaria o formalizar solicitud de apertura.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  analysis.salaryAccountStatus.isConfigured ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                }`}>
                  {analysis.salaryAccountStatus.isConfigured ? 'CONFORME' : 'PENDIENTE'}
                </span>
              </div>

              {/* Checkpoint 4: Autorización y Trazabilidad */}
              <div className="p-3.5 rounded-xl border bg-slate-50 border-slate-200 text-slate-800 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg mt-0.5 bg-slate-200 text-slate-700">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">
                      4. Responsable de Alta & Fecha de Registro
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Autorizado por: <strong>{currentUser.name}</strong> ({currentUser.role}) • {new Date().toLocaleDateString('es-PE')}
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  ACTIVO
                </span>
              </div>

            </div>
          </div>

          {/* Block Alert or Success Info Box */}
          {!canApprove ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-3">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>Alta Bloqueada: El participante no cumple todos los requisitos</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Por política de control documental, el botón <strong>"Dar de alta"</strong> hacia Gestión de Talento está restringido hasta subsanar y validar todos los puntos observados o pendientes:
              </p>
              <ul className="space-y-1 pl-4 list-disc text-[11px] text-amber-900 font-medium">
                {reasons.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
              <div className="pt-2 flex items-center justify-between border-t border-amber-200">
                <span className="text-[10px] text-amber-700 italic">
                  Se registrará en trazabilidad si se intenta dar de alta sin expediente completo.
                </span>
                <button
                  type="button"
                  onClick={handleOpen360Docs}
                  className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Gestionar Documentación en Ficha 360°</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Conformidad Total: Habilitado para envío a Gestión de Talento</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Al confirmar el alta, el postulante será transferido inmediatamente al módulo de <strong>Gestión de Talento</strong> dentro del listado <strong>"Pendientes de contratación"</strong> conservando todo su expediente unificado.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-xs">
                  Observaciones de Alta Laboral (Opcional):
                </label>
                <textarea
                  rows={2}
                  value={altaNotes}
                  onChange={e => setAltaNotes(e.target.value)}
                  placeholder="Ej: Expediente 100% validado por Formación y Selección. Asignar contrato en sede Central."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2">
            {!canApprove ? (
              <button
                type="button"
                onClick={handleOpen360Docs}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Ir a Documentación en 360°</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmAlta}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar y Enviar a Gestión de Talento</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
