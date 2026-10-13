import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  DollarSign, 
  MapPin, 
  Clock, 
  Calendar, 
  Users, 
  FileText, 
  ShieldCheck, 
  Plus, 
  Trash2,
  Briefcase
} from 'lucide-react';
import { useTalent } from '../../context/TalentContext';
import { CampaignCall, ProcessType, ManagementType, ConvocatoriaStatus } from '../../types';
import { getWorkerErrorMessage } from '../../services/workerApi';

interface ConvocatoriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  convocatoriaToEdit?: CampaignCall | null;
}

export const ConvocatoriaModal: React.FC<ConvocatoriaModalProps> = ({
  isOpen,
  onClose,
  convocatoriaToEdit
}) => {
  const { createConvocatoria, updateConvocatoria, currentUser, availableUsers } = useTalent();

  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [area, setArea] = useState('Operaciones Contact Center');
  const [serviceType, setServiceType] = useState<'VENTAS_OUTBOUND' | 'VENTAS_INBOUND' | 'ATENCION_CLIENTE' | 'SOPORTE_TECNICO' | 'RETENCIONES' | 'COBRANZAS' | 'STAFF_ADMIN'>('VENTAS_OUTBOUND');
  const [salaryBase, setSalaryBase] = useState(1250);
  const [variableBonus, setVariableBonus] = useState(350);
  const [adminBonus, setAdminBonus] = useState(100);
  const [mobilityBonus, setMobilityBonus] = useState(80);
  const [additionalConditions, setAdditionalConditions] = useState('');
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0]);
  const [processType, setProcessType] = useState<ProcessType>('EXTERNO');
  const [managementType, setManagementType] = useState<ManagementType>('PRESENCIAL');
  const [vacancies, setVacancies] = useState(15);
  const [location, setLocation] = useState('Sede Central - Lima Centro');
  const [shift, setShift] = useState('Lunes a Sábado 09:00 - 18:00');
  const [observations, setObservations] = useState('');
  const [status, setStatus] = useState<ConvocatoriaStatus>('EN_PROCESO');
  const [assignedAnalystId, setAssignedAnalystId] = useState(currentUser.id);
  const [requirementsList, setRequirementsList] = useState<string[]>([
    'Secundaria completa o estudios técnicos',
    'Mínimo 3 meses en atención o ventas',
    'Buena dicción y fluidez verbal'
  ]);
  const [newReq, setNewReq] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (isOpen) setSubmitError('');
    if (convocatoriaToEdit) {
      setCompany(convocatoriaToEdit.company || convocatoriaToEdit.client || '');
      setTitle(convocatoriaToEdit.title);
      setCode(convocatoriaToEdit.code);
      setArea(convocatoriaToEdit.area || 'Operaciones');
      setServiceType(convocatoriaToEdit.serviceType || 'VENTAS_OUTBOUND');
      setSalaryBase(convocatoriaToEdit.salaryBase ?? 1250);
      setVariableBonus(convocatoriaToEdit.variableBonus || 0);
      setAdminBonus(convocatoriaToEdit.adminBonus || 0);
      setMobilityBonus(convocatoriaToEdit.mobilityBonus || 0);
      setAdditionalConditions(convocatoriaToEdit.additionalConditions || '');
      setRequestDate(convocatoriaToEdit.requestDate || new Date().toISOString().split('T')[0]);
      setProcessType(convocatoriaToEdit.processType || 'EXTERNO');
      setManagementType(convocatoriaToEdit.managementType || 'PRESENCIAL');
      setVacancies(convocatoriaToEdit.vacancies ?? 10);
      setLocation(convocatoriaToEdit.location || 'Sede Central - Lima Centro');
      setShift(convocatoriaToEdit.shift || 'Lunes a Sábado 09:00 - 18:00');
      setObservations(convocatoriaToEdit.observations || '');
      setStatus(convocatoriaToEdit.status || 'EN_PROCESO');
      setAssignedAnalystId(convocatoriaToEdit.assignedAnalystId || currentUser.id);
      setRequirementsList(convocatoriaToEdit.requirements || []);
    } else {
      setCompany('');
      setTitle('');
      setCode(`CONV-2026-${Math.floor(100 + Math.random() * 900)}`);
      setArea('Operaciones Contact Center');
      setSalaryBase(1250);
      setVariableBonus(350);
      setAdminBonus(100);
      setMobilityBonus(80);
      setAdditionalConditions('');
      setRequestDate(new Date().toISOString().split('T')[0]);
      setProcessType('EXTERNO');
      setManagementType('PRESENCIAL');
      setVacancies(15);
      setLocation('Sede Central - Lima Centro');
      setShift('Lunes a Sábado 09:00 - 18:00');
      setObservations('');
      setStatus('EN_PROCESO');
      setAssignedAnalystId(currentUser.id);
      setRequirementsList([
        'Secundaria completa o estudios técnicos',
        'Mínimo 3 meses de experiencia en contact center o ventas',
        'Buena modulación verbal y dicción'
      ]);
    }
  }, [convocatoriaToEdit, isOpen, currentUser]);

  if (!isOpen) return null;

  const handleAddRequirement = () => {
    if (!newReq.trim()) return;
    setRequirementsList(prev => [...prev, newReq.trim()]);
    setNewReq('');
  };

  const handleRemoveRequirement = (index: number) => {
    setRequirementsList(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!company.trim() || !title.trim()) return;

    const assignedAnalyst = availableUsers.find(u => u.id === assignedAnalystId);

    const payload: Partial<CampaignCall> = {
      code,
      company: company.trim(),
      title: title.trim(),
      client: company.trim(),
      area,
      serviceType,
      salaryBase: Number(salaryBase),
      variableBonus: Number(variableBonus),
      adminBonus: Number(adminBonus),
      mobilityBonus: Number(mobilityBonus),
      additionalConditions,
      requestDate,
      processType,
      managementType,
      vacancies: Number(vacancies),
      location,
      shift,
      observations,
      status,
      assignedAnalystId,
      assignedAnalystName: assignedAnalyst?.name || currentUser.name,
      requirements: requirementsList
    };

    setIsSubmitting(true);
    setSubmitError('');
    try {
      if (convocatoriaToEdit) await updateConvocatoria(convocatoriaToEdit.id, payload);
      else await createConvocatoria(payload);
      onClose();
    } catch (error) {
      setSubmitError(getWorkerErrorMessage(error, 'No se pudo guardar la convocatoria. Inténtalo nuevamente.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRecruiter = currentUser.role === 'RECLUTADOR';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {convocatoriaToEdit ? 'Editar Convocatoria' : 'Nueva Convocatoria de Selección'}
              </h3>
              <p className="text-xs text-slate-400">
                Registro y configuración del requerimiento operativo (RQ)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {submitError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">{submitError}</div>}
          
          {/* Section 1: Datos Principales */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky-600" />
              1. Identificación del Requerimiento
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Código Convocatoria
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-sky-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Empresa / Cliente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Telefónica Movistar, BCP, Claro"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Área Solicitante
                </label>
                <select
                  value={area}
                  onChange={e => setArea(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-sky-500"
                >
                  <option value="Operaciones Contact Center">Operaciones Contact Center</option>
                  <option value="Banca y Finanzas">Banca y Finanzas</option>
                  <option value="Telecomunicaciones">Telecomunicaciones</option>
                  <option value="Soporte e Infraestructura">Soporte e Infraestructura</option>
                  <option value="Retenciones & Cobranzas">Retenciones & Cobranzas</option>
                  <option value="Staff / Recursos Humanos">Staff / Recursos Humanos</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Puesto / Nombre de la Campaña *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Ejecutivos de Ventas Outbound - Portabilidad Móvil"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-sky-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Línea de Servicio
                </label>
                <select
                  value={serviceType}
                  onChange={e => setServiceType(e.target.value as typeof serviceType)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-sky-500"
                >
                  <option value="VENTAS_OUTBOUND">Ventas Outbound</option>
                  <option value="VENTAS_INBOUND">Ventas Inbound</option>
                  <option value="ATENCION_CLIENTE">Atención al Cliente</option>
                  <option value="SOPORTE_TECNICO">Soporte Técnico N1/N2</option>
                  <option value="RETENCIONES">Retenciones & Fidelización</option>
                  <option value="COBRANZAS">Cobranzas Persuasivas</option>
                  <option value="STAFF_ADMIN">Staff / Administrativo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Remuneración y Bonos */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              2. Estructura Salarial & Beneficios
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-2xs font-bold text-slate-600 mb-1">
                  Sueldo Base (S/.) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={salaryBase}
                  onChange={e => setSalaryBase(Number(e.target.value))}
                  className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-600 mb-1">
                  Bono Variable (S/.)
                </label>
                <input
                  type="number"
                  min="0"
                  value={variableBonus}
                  onChange={e => setVariableBonus(Number(e.target.value))}
                  className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-600 mb-1">
                  Bono Administrativo
                </label>
                <input
                  type="number"
                  min="0"
                  value={adminBonus}
                  onChange={e => setAdminBonus(Number(e.target.value))}
                  className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-600 mb-1">
                  Bono Movilidad
                </label>
                <input
                  type="number"
                  min="0"
                  value={mobilityBonus}
                  onChange={e => setMobilityBonus(Number(e.target.value))}
                  className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="col-span-2 sm:col-span-4 mt-2">
                <label className="block text-2xs font-bold text-slate-600 mb-1">
                  Condiciones Adicionales / Comisiones
                </label>
                <input
                  type="text"
                  placeholder="Ej: Comisiones sin tope + seguro de salud y convenios corporativos"
                  value={additionalConditions}
                  onChange={e => setAdditionalConditions(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Dotación y Operaciones */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              3. Dotación Requerida & Logística
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cantidad Requerida (RQ) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={vacancies}
                  onChange={e => setVacancies(Number(e.target.value))}
                  className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo de Proceso
                </label>
                <select
                  value={processType}
                  onChange={e => setProcessType(e.target.value as ProcessType)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                >
                  <option value="EXTERNO">Externo</option>
                  <option value="INTERNO">Interno</option>
                  <option value="MIXTO">Mixto</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo de Gestión
                </label>
                <select
                  value={managementType}
                  onChange={e => setManagementType(e.target.value as ManagementType)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                >
                  <option value="PRESENCIAL">Presencial</option>
                  <option value="REMOTO">Remoto (Home Office)</option>
                  <option value="HIBRIDO">Híbrido</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sede de Operación
                </label>
                <select
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                >
                  <option value="Sede Central - Lima Centro">Sede Central - Lima Centro</option>
                  <option value="Sede Sur - Miraflores">Sede Sur - Miraflores</option>
                  <option value="Sede Norte - Independencia">Sede Norte - Independencia</option>
                  <option value="Home Office / Remoto Nacional">Home Office / Remoto Nacional</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Horario de Trabajo
                </label>
                <input
                  type="text"
                  value={shift}
                  onChange={e => setShift(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fecha de Solicitud
                </label>
                <input
                  type="date"
                  value={requestDate}
                  onChange={e => setRequestDate(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Analista Responsable
                </label>
                <select
                  value={assignedAnalystId}
                  onChange={e => setAssignedAnalystId(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                >
                  {availableUsers
                    .filter(u => u.role === 'ANALISTA_SELECCION' || u.role === 'JEFE_SELECCION')
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role === 'JEFE_SELECCION' ? 'Jefe' : 'Analista'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estado Inicial
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as ConvocatoriaStatus)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900"
                >
                  <option value="EN_PROCESO">En proceso</option>
                  <option value="PUBLICADO">Publicado</option>
                  <option value="CERRADO">Cerrado</option>
                  <option value="ANULADO">Anulado</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observaciones Generales
                </label>
                <textarea
                  rows={2}
                  placeholder="Instrucciones especiales para los selectores o perfil crítico..."
                  value={observations}
                  onChange={e => setObservations(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Requisitos del Perfil */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600" />
              4. Requisitos Clave del Perfil
            </h4>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Agregar requisito específico (ej: Experiencia mínima, digitación, disponibilidad)..."
                  value={newReq}
                  onChange={e => setNewReq(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRequirement(); } }}
                  className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                />
                <button
                  type="button"
                  onClick={handleAddRequirement}
                  className="px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar
                </button>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {requirementsList.map((req, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700">
                    <span>• {req}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRequirement(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isRecruiter || isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando…' : convocatoriaToEdit ? 'Guardar Cambios' : 'Crear Convocatoria'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
