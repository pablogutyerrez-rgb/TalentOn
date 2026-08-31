import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Upload, 
  CreditCard, 
  User, 
  ShieldCheck, 
  ShieldAlert, 
  Plus, 
  History, 
  Save, 
  Building2, 
  FileCheck2, 
  FileWarning, 
  Eye, 
  RotateCcw, 
  Check, 
  HelpCircle,
  Sparkles,
  Info,
  Calendar,
  Phone,
  Mail,
  MapPin,
  X,
  Lock,
  Download
} from 'lucide-react';
import { 
  CandidateRecord, 
  DocumentItem, 
  SalaryAccountDetails,
  TraceabilityItem
} from '../../types';
import { useTalent } from '../../context/TalentContext';
import { 
  MANDATORY_DOC_DEFS, 
  OPTIONAL_DOC_DEFS, 
  getExpedientAnalysis, 
  findDocumentByType,
  getCandidateDocuments
} from '../../utils/expedientUtils';
import { ExpedientBadge } from '../common/ExpedientBadge';

interface DocumentacionContratacionTabProps {
  candidate: CandidateRecord;
}

const getDocumentErrorMessage = (error: unknown, fallback: string) => {
  const code = error instanceof Error ? error.message : '';
  if (code === 'WORKER_NETWORK_UNREACHABLE' || code === 'FIREBASE_TOKEN_UNAVAILABLE') {
    return 'No se pudo sincronizar la documentación. Verifica tu conexión e inténtalo nuevamente.';
  }
  if (code === 'Worker API no está configurada o no existe sesión.') {
    return 'El servicio de documentos no está disponible en este momento.';
  }
  return fallback;
};

export const DocumentacionContratacionTab: React.FC<DocumentacionContratacionTabProps> = ({
  candidate
}) => {
  const { 
    currentUser, 
    updateCandidatePersonalData, 
    updateCandidateSalaryAccount, 
    updateDocumentStatus, 
    addCandidateDocument,
    listCandidateDocuments,
    replaceCandidateDocument,
    downloadCandidateDocument
  } = useTalent();

  // Personal data editing state
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [remoteDocuments, setRemoteDocuments] = useState<DocumentItem[]>(() => getCandidateDocuments(candidate));
  const [operationError, setOperationError] = useState('');
  const [personalForm, setPersonalForm] = useState({
    dni: candidate.dni || '',
    fullName: candidate.fullName || '',
    birthDate: candidate.birthDate || '',
    phone: candidate.phone || '',
    email: candidate.email || '',
    district: candidate.district || candidate.city || '',
    address: candidate.address || ''
  });

  // Calculate age automatically from birthDate
  const calculateAge = (bDate: string) => {
    if (!bDate) return candidate.age || 0;
    const diff = Date.now() - new Date(bDate).getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  useEffect(() => {
    setPersonalForm({
      dni: candidate.dni || '',
      fullName: candidate.fullName || '',
      birthDate: candidate.birthDate || '',
      phone: candidate.phone || '',
      email: candidate.email || '',
      district: candidate.district || candidate.city || '',
      address: candidate.address || ''
    });
  }, [candidate]);

  const refreshDocuments = async () => {
    setOperationError('');
    try {
      setRemoteDocuments(await listCandidateDocuments(candidate.id));
    } catch (error) {
      // La ficha puede seguir mostrando la copia disponible en el candidato aunque
      // el servicio documental esté temporalmente fuera de línea.
      setRemoteDocuments(getCandidateDocuments(candidate));
      const code = error instanceof Error ? error.message : '';
      if (code !== 'WORKER_NETWORK_UNREACHABLE') {
        setOperationError(getDocumentErrorMessage(error, 'No fue posible cargar la documentación.'));
      }
    }
  };

  useEffect(() => {
    setRemoteDocuments(getCandidateDocuments(candidate));
    void refreshDocuments();
  }, [candidate.id]);

  const handleSavePersonal = (e: React.FormEvent) => {
    e.preventDefault();
    const age = calculateAge(personalForm.birthDate);
    updateCandidatePersonalData(candidate.id, {
      ...personalForm,
      age: age > 0 ? age : candidate.age,
      city: personalForm.district || candidate.city
    });
    setIsEditingPersonal(false);
  };

  // Salary Account State
  const initialSalary: SalaryAccountDetails = candidate.salaryAccount || {
    hasAccount: true,
    bank: 'BCP',
    accountNumber: '',
    cci: '',
    currency: 'PEN',
    requestOpening: false,
    openingStatus: 'SOLICITADO'
  };

  const [salaryForm, setSalaryForm] = useState<SalaryAccountDetails>(initialSalary);
  const [isSalarySavedNotice, setIsSalarySavedNotice] = useState(false);

  useEffect(() => {
    if (candidate.salaryAccount) {
      setSalaryForm(candidate.salaryAccount);
    }
  }, [candidate.salaryAccount]);

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    setOperationError('');
    try { await updateCandidateSalaryAccount(candidate.id, salaryForm); setIsSalarySavedNotice(true); setTimeout(() => setIsSalarySavedNotice(false), 3000); }
    catch (error) { setOperationError(getDocumentErrorMessage(error, 'No fue posible guardar la cuenta sueldo.')); }
  };

  // Document Upload Modal / State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<string>('DNI');
  const [uploadDocName, setUploadDocName] = useState<string>('DNI Vigente (Ambas Caras)');
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Observation Modal State
  const [observingDoc, setObservingDoc] = useState<DocumentItem | null>(null);
  const [observationText, setObservationText] = useState('');

  // Subsanar Modal State
  const [subsanarDoc, setSubsanarDoc] = useState<DocumentItem | null>(null);
  const [subsanarFileName, setSubsanarFileName] = useState('');
  const [subsanarFile, setSubsanarFile] = useState<File | null>(null);

  // Calculations
  const candidateWithDocuments: CandidateRecord = { ...candidate, documents: remoteDocuments, selection: { ...candidate.selection, documents: remoteDocuments } };
  const analysis = getExpedientAnalysis(candidateWithDocuments);
  const docs = getCandidateDocuments(candidateWithDocuments);

  const handleOpenUpload = (type: string, defaultName: string) => {
    setUploadDocType(type);
    setUploadDocName(defaultName);
    setUploadFileName(''); setUploadFile(null); setOperationError('');
    setIsUploadModalOpen(true);
  };

  const handleConfirmUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return setOperationError('Selecciona un archivo PDF, JPG o PNG.');
    setIsSaving(true); setOperationError('');
    try {
      await addCandidateDocument(candidate.id, { name: uploadDocName, type: uploadDocType as DocumentItem['type'], status: 'CARGADO', uploadDate: new Date().toISOString().split('T')[0], fileSize: `${uploadFile.size} bytes`, isMandatory: MANDATORY_DOC_DEFS.some(definition => definition.type === uploadDocType) }, uploadFile);
      await refreshDocuments(); setIsUploadModalOpen(false); setUploadFile(null);
    } catch (error) { setOperationError(getDocumentErrorMessage(error, 'No fue posible subir el documento.')); }
    finally { setIsSaving(false); }
  };

  const handleOpenObserve = (doc: DocumentItem) => {
    setObservingDoc(doc);
    setObservationText(doc.observationReason || doc.notes || '');
  };
  const validateDocument = async (documentId: string) => {
    setOperationError('');
    try { await updateDocumentStatus(candidate.id, documentId, 'VALIDADO'); await refreshDocuments(); }
    catch (error) { setOperationError(getDocumentErrorMessage(error, 'No fue posible validar el documento.')); }
  };

  const handleConfirmObserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!observingDoc) return;
    try { await updateDocumentStatus(candidate.id, observingDoc.id, 'OBSERVADO', observationText || 'Documento no legible o no vigente'); await refreshDocuments(); setObservingDoc(null); setObservationText(''); }
    catch (error) { setOperationError(getDocumentErrorMessage(error, 'No fue posible observar el documento.')); }
  };

  const handleOpenSubsanar = (doc: DocumentItem) => {
    setSubsanarDoc(doc);
    setSubsanarFileName(''); setSubsanarFile(null); setOperationError('');
  };

  const handleConfirmSubsanar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subsanarDoc || !subsanarFile) return setOperationError('Selecciona el archivo corregido.');
    try { await replaceCandidateDocument(candidate.id, subsanarDoc.id, subsanarFile); await refreshDocuments(); setSubsanarDoc(null); setSubsanarFile(null); }
    catch (error) { setOperationError(getDocumentErrorMessage(error, 'No fue posible actualizar el documento.')); }
  };

  // Filter traceability for document-related entries
  const documentTraceability = (candidate.selection?.traceability || []).filter(
    t => t.action === 'CARGA_DOCUMENTO' || 
         t.action === 'OBSERVACION' || 
         t.observation.toLowerCase().includes('document') || 
         t.observation.toLowerCase().includes('cuenta') || 
         t.observation.toLowerCase().includes('expediente') ||
         t.observation.toLowerCase().includes('alta')
  );

  return (
    <div className="space-y-6 text-xs animate-in fade-in duration-200">
      {operationError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-rose-700 font-semibold">{operationError}</div>}
      
      {/* 1. HEADER HERO: EXPEDIENT SUMMARY & PROGRESS */}
      <div className={`p-5 rounded-2xl border transition-all ${
        analysis.status === 'COMPLETO'
          ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100 border-emerald-300'
          : analysis.status === 'OBSERVADO'
          ? 'bg-gradient-to-r from-rose-50 via-amber-50 to-rose-100 border-rose-300'
          : 'bg-gradient-to-r from-slate-50 via-sky-50 to-slate-100 border-slate-300'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-sky-700" />
                Expediente Único para Contratación
              </span>
              <ExpedientBadge candidate={candidate} size="md" />
            </div>

            <p className="text-slate-600 text-xs max-w-2xl leading-relaxed">
              Esta sección concentra la documentación requerida para la contratación del postulante. 
              <strong> Pertenece a la persona</strong> y se mantiene activa durante 
              <strong> Selección, Formación y Gestión de Talento</strong>.
            </p>
          </div>

          {/* Metrics summary cards */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-slate-200 shadow-2xs text-center min-w-[90px]">
              <span className="block text-[10px] uppercase font-bold text-slate-500">Progreso</span>
              <span className={`text-lg font-black ${analysis.status === 'COMPLETO' ? 'text-emerald-700' : 'text-slate-900'}`}>
                {analysis.percentage}%
              </span>
            </div>

            <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-slate-200 shadow-2xs text-center min-w-[100px]">
              <span className="block text-[10px] uppercase font-bold text-slate-500">Obligatorios</span>
              <span className="text-lg font-black text-slate-900">
                <span className="text-emerald-600">{analysis.completedMandatoryItems}</span>
                <span className="text-slate-400">/{analysis.totalMandatoryItems}</span>
              </span>
            </div>

            <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-slate-200 shadow-2xs text-center min-w-[90px]">
              <span className="block text-[10px] uppercase font-bold text-slate-500">Observados</span>
              <span className={`text-lg font-black ${analysis.observedCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                {analysis.observedCount}
              </span>
            </div>
          </div>

        </div>

        {/* Visual Progress Bar */}
        <div className="mt-4 pt-3 border-t border-slate-200/60">
          <div className="flex justify-between items-center text-[11px] font-semibold text-slate-700 mb-1.5">
            <span>Estado de Cumplimiento Documental</span>
            <span className="font-mono">{analysis.completedMandatoryItems} de {analysis.totalMandatoryItems} requisitos validados</span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                analysis.status === 'COMPLETO' 
                  ? 'bg-emerald-500' 
                  : analysis.status === 'OBSERVADO'
                  ? 'bg-amber-500'
                  : 'bg-sky-500'
              }`}
              style={{ width: `${analysis.percentage}%` }}
            />
          </div>
        </div>

        {/* Business Rule Notice Banner */}
        <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-700 bg-white/70 p-2.5 rounded-lg border border-slate-200/80">
          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <div>
            <strong>Regla de Negocio:</strong> El postulante puede ser promovido a <em>Apto para Capacitación</em> e ingresar a Formación aún con documentación pendiente. 
            Sin embargo, el <strong>pase a Alta hacia Gestión de Talento</strong> quedará bloqueado hasta que el expediente esté 100% validado.
          </div>
        </div>
      </div>


      {/* 2. SECCIÓN: DATOS PERSONALES PARA CONTRATACIÓN */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-sky-600" />
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
              1. Datos Personales para Contratación
            </h4>
            {analysis.personalDataStatus.isComplete ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <Check className="w-3 h-3" /> Conforme
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Faltan datos
              </span>
            )}
          </div>

          {!isEditingPersonal ? (
            <button
              type="button"
              onClick={() => setIsEditingPersonal(true)}
              className="px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-50 border border-sky-200 rounded-lg transition-colors cursor-pointer"
            >
              Editar Datos
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingPersonal(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          )}
        </div>

        {!isEditingPersonal ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">DNI / Documento</span>
              <span className="font-bold text-slate-900 font-mono text-xs">{candidate.dni || 'Sin registrar'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Nombres y Apellidos</span>
              <span className="font-bold text-slate-900 text-xs">{candidate.fullName}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Fecha Nacimiento / Edad</span>
              <span className="text-slate-800 text-xs">
                {candidate.birthDate || 'No definida'} ({candidate.age || 24} años)
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Teléfono / WhatsApp</span>
              <span className="text-slate-800 font-mono text-xs">{candidate.phone}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Correo Electrónico</span>
              <span className="text-slate-800 text-xs">{candidate.email}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Distrito / Ciudad</span>
              <span className="text-slate-800 text-xs">{candidate.district || candidate.city || 'Lima'}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Dirección Domiciliaria</span>
              <span className="text-slate-800 text-xs">{candidate.address || 'Av. Los Próceres 450, Urb. Jardines'}</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSavePersonal} className="p-4 bg-sky-50/50 rounded-xl border border-sky-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  DNI (8 dígitos) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={personalForm.dni}
                  onChange={e => setPersonalForm({ ...personalForm, dni: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nombres y Apellidos Completos *
                </label>
                <input
                  type="text"
                  required
                  value={personalForm.fullName}
                  onChange={e => setPersonalForm({ ...personalForm, fullName: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Fecha de Nacimiento *
                </label>
                <input
                  type="date"
                  required
                  value={personalForm.birthDate}
                  onChange={e => setPersonalForm({ ...personalForm, birthDate: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Teléfono Móvil *
                </label>
                <input
                  type="text"
                  required
                  value={personalForm.phone}
                  onChange={e => setPersonalForm({ ...personalForm, phone: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={personalForm.email}
                  onChange={e => setPersonalForm({ ...personalForm, email: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Distrito / Ciudad *
                </label>
                <input
                  type="text"
                  required
                  value={personalForm.district}
                  onChange={e => setPersonalForm({ ...personalForm, district: e.target.value })}
                  placeholder="Ej: Los Olivos / Lima"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Dirección Domiciliaria Completa *
                </label>
                <input
                  type="text"
                  required
                  value={personalForm.address}
                  onChange={e => setPersonalForm({ ...personalForm, address: e.target.value })}
                  placeholder="Ej: Av. Las Palmeras 1234, Dpto 301"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-sky-200">
              <button
                type="button"
                onClick={() => setIsEditingPersonal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                Guardar Datos Personales
              </button>
            </div>
          </form>
        )}
      </div>


      {/* 3. SECCIÓN: DOCUMENTACIÓN REQUERIDA & CHECKLIST */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-sky-600" />
              2. Checklist & Control Documental Obligatorio
            </h4>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Revise, cargue y valide los 4 documentos indispensables para la conformación del contrato.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleOpenUpload('OTROS', 'Documento Adicional')}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Adjuntar Otro Documento
          </button>
        </div>

        {/* Mandatory Docs Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {MANDATORY_DOC_DEFS.map((def, idx) => {
            const doc = findDocumentByType(docs, def.type);
            const isUploaded = !!doc;
            const status = doc?.status || 'PENDIENTE';
            const isObserved = status === 'OBSERVADO';
            const isValidated = status === 'VALIDADO';
            const isLoaded = status === 'CARGADO';

            return (
              <div 
                key={def.type}
                className={`p-4 rounded-xl border transition-all ${
                  isValidated
                    ? 'bg-emerald-50/60 border-emerald-200'
                    : isObserved
                    ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-400/20'
                    : isLoaded
                    ? 'bg-sky-50/60 border-sky-200'
                    : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-slate-400">0{idx + 1}.</span>
                      <h5 className="font-bold text-slate-900 text-xs">{def.label}</h5>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 font-semibold">
                        Obligatorio
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-tight">
                      {def.description}
                    </p>

                    {/* Document details if uploaded */}
                    {doc && (
                      <div className="pt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          <FileText className="w-3 h-3 text-sky-600" />
                          {doc.name}
                        </span>
                        <span>•</span>
                        <span>Cargado: {doc.uploadDate}</span>
                        {doc.validatedBy && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-700 font-bold">Validado por: {doc.validatedBy}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status Pill */}
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    isValidated ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                    isObserved ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                    isLoaded ? 'bg-sky-100 text-sky-800 border border-sky-300' :
                    'bg-slate-200 text-slate-600'
                  }`}>
                    {status === 'CARGADO' ? 'Pendiente Revisión' : status}
                  </span>
                </div>

                {/* Observation reason banner if observed */}
                {isObserved && (
                  <div className="mt-2.5 p-2 bg-rose-100/80 border border-rose-300 rounded-lg text-[11px] text-rose-900 space-y-1">
                    <div className="flex items-center gap-1 font-bold">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                      <span>Motivo de Observación:</span>
                    </div>
                    <p className="text-[11px] text-rose-800 italic pl-4">
                      "{doc.observationReason || doc.notes || 'Documento no legible o incompleto. Requiere reemplazo.'}"
                    </p>
                    {doc.observedBy && (
                      <div className="text-[10px] text-rose-600 pl-4">
                        Por: {doc.observedBy} • {doc.observedAt || 'Reciente'}
                      </div>
                    )}
                  </div>
                )}

                {/* Document Actions Toolbar */}
                <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {!isUploaded ? (
                      <button
                        type="button"
                        onClick={() => handleOpenUpload(def.type, def.label)}
                        className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      >
                        <Upload className="w-3 h-3" />
                        Subir Documento
                      </button>
                    ) : (
                      <>
                        <button type="button" onClick={() => downloadCandidateDocument(candidate.id, doc.id, doc.name)} className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer">
                          <Download className="w-3 h-3" /> Descargar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenSubsanar(doc)}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Reemplazar archivo"
                        >
                          <Upload className="w-3 h-3" />
                          Reemplazar
                        </button>

                        {isObserved && (
                          <button
                            type="button"
                            onClick={() => handleOpenSubsanar(doc)}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Subsanar
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Review / Validation Actions (Analyst & Trainer) */}
                  {isUploaded && (
                    <div className="flex items-center gap-1.5">
                      {!isValidated && (
                        <button
                          type="button"
                          onClick={() => void validateDocument(doc.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                          title="Validar documento como conforme"
                        >
                          <Check className="w-3 h-3" />
                          Validar Conforme
                        </button>
                      )}

                      {!isObserved && (
                        <button
                          type="button"
                          onClick={() => handleOpenObserve(doc)}
                          className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Registrar observación"
                        >
                          <AlertCircle className="w-3 h-3" />
                          Observar
                        </button>
                      )}
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>

        {/* Additional / Optional Documents Table if any */}
        {docs.filter(d => !MANDATORY_DOC_DEFS.some(m => m.type === d.type)).length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
            <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Documentos Adicionales / Complementarios
            </h5>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Documento</th>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3">Fecha</th>
                    <th className="py-2 px-3 text-center">Estado</th>
                    <th className="py-2 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {docs.filter(d => !MANDATORY_DOC_DEFS.some(m => m.type === d.type)).map(d => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-800 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>{d.name}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{d.type}</td>
                      <td className="py-2 px-3 text-slate-500 text-[11px]">{d.uploadDate}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.status === 'VALIDADO' ? 'bg-emerald-100 text-emerald-800' :
                          d.status === 'OBSERVADO' ? 'bg-rose-100 text-rose-800' :
                          'bg-sky-100 text-sky-800'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button type="button" onClick={() => downloadCandidateDocument(candidate.id, d.id, d.name)} className="px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded text-[10px] font-bold">Descargar</button>
                          {d.status !== 'VALIDADO' && (
                            <button
                              type="button"
                              onClick={() => void validateDocument(d.id)}
                              className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold"
                            >
                              Validar
                            </button>
                          )}
                          {d.status !== 'OBSERVADO' && (
                            <button
                              type="button"
                              onClick={() => handleOpenObserve(d)}
                              className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold"
                            >
                              Observar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>


      {/* 4. SECCIÓN: CUENTA SUELDO PARA HABERES */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-sky-600" />
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
              3. Disposición de Cuenta Sueldo para Pago de Haberes
            </h4>
            {analysis.salaryAccountStatus.isConfigured ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <Check className="w-3 h-3" /> Configurado
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Pendiente
              </span>
            )}
          </div>

          {isSalarySavedNotice && (
            <span className="text-emerald-700 font-bold text-[11px] animate-in fade-in flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Cambios guardados en expediente
            </span>
          )}
        </div>

        <form onSubmit={handleSaveSalary} className="space-y-4">
          {/* Radio Options: Tengo Cuenta vs Solicitar Apertura */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Option A: Tengo Cuenta Activa */}
            <label className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
              salaryForm.hasAccount
                ? 'bg-sky-50/70 border-sky-400 ring-2 ring-sky-500/20 text-sky-950 font-semibold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}>
              <input
                type="radio"
                name="salary_option"
                checked={salaryForm.hasAccount === true}
                onChange={() => setSalaryForm({ ...salaryForm, hasAccount: true, requestOpening: false })}
                className="mt-0.5 text-sky-600 focus:ring-sky-500"
              />
              <div className="space-y-0.5">
                <span className="block font-bold text-xs text-slate-900">
                  Tengo cuenta bancaria activa
                </span>
                <p className="text-[11px] text-slate-500">
                  El postulante ya posee una cuenta a su nombre para el depósito mensual de haberes.
                </p>
              </div>
            </label>

            {/* Option B: Solicitar Apertura Corporativa */}
            <label className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
              !salaryForm.hasAccount
                ? 'bg-sky-50/70 border-sky-400 ring-2 ring-sky-500/20 text-sky-950 font-semibold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}>
              <input
                type="radio"
                name="salary_option"
                checked={salaryForm.hasAccount === false}
                onChange={() => setSalaryForm({ 
                  ...salaryForm, 
                  hasAccount: false, 
                  requestOpening: true,
                  openingStatus: salaryForm.openingStatus || 'SOLICITADO',
                  openingRequestDate: salaryForm.openingRequestDate || new Date().toISOString().split('T')[0]
                })}
                className="mt-0.5 text-sky-600 focus:ring-sky-500"
              />
              <div className="space-y-0.5">
                <span className="block font-bold text-slate-900 text-xs">
                  Solicitar apertura por la empresa
                </span>
                <p className="text-[11px] text-slate-500">
                  Gestión de Talento tramitará la apertura de cuenta sueldo corporativa con el banco por convenio.
                </p>
              </div>
            </label>

          </div>

          {/* Conditional fields based on selection */}
          {salaryForm.hasAccount ? (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 animate-in fade-in">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Entidad Bancaria *
                </label>
                <select
                  value={salaryForm.bank || 'BCP'}
                  onChange={e => setSalaryForm({ ...salaryForm, bank: e.target.value as SalaryAccountDetails['bank'] })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900"
                >
                  <option value="BCP">Banco de Crédito (BCP)</option>
                  <option value="BBVA">BBVA Perú</option>
                  <option value="INTERBANK">Interbank</option>
                  <option value="SCOTIABANK">Scotiabank</option>
                  <option value="BANCO_NACION">Banco de la Nación</option>
                  <option value="BANBIF">BanBif</option>
                  <option value="PICHINCHA">Banco Pichincha</option>
                  <option value="OTRO">Otro Banco</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Número de Cuenta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 191-12345678-0-12"
                  value={salaryForm.accountNumber || ''}
                  onChange={e => setSalaryForm({ ...salaryForm, accountNumber: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  CCI (Código Interbancario - 20 dígitos)
                </label>
                <input
                  type="text"
                  maxLength={20}
                  placeholder="00219100123456780012"
                  value={salaryForm.cci || ''}
                  onChange={e => setSalaryForm({ ...salaryForm, cci: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Moneda de Abono
                </label>
                <select
                  value={salaryForm.currency || 'PEN'}
                  onChange={e => setSalaryForm({ ...salaryForm, currency: e.target.value as SalaryAccountDetails['currency'] })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                >
                  <option value="PEN">Soles (PEN - S/.)</option>
                  <option value="USD">Dólares (USD - $)</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in">
              <div>
                <label className="block text-[11px] font-bold text-amber-900 mb-1">
                  Banco Convenio para Trámite
                </label>
                <select
                  value={salaryForm.bank || 'BCP'}
                  onChange={e => setSalaryForm({ ...salaryForm, bank: e.target.value as SalaryAccountDetails['bank'] })}
                  className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900"
                >
                  <option value="BCP">BCP (Convenio Principal)</option>
                  <option value="BBVA">BBVA Convenio Planilla</option>
                  <option value="INTERBANK">Interbank Planilla</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-900 mb-1">
                  Estado de la Solicitud
                </label>
                <select
                  value={salaryForm.openingStatus || 'SOLICITADO'}
                  onChange={e => setSalaryForm({ ...salaryForm, openingStatus: e.target.value as SalaryAccountDetails['openingStatus'] })}
                  className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900"
                >
                  <option value="SOLICITADO">Solicitud Registrada</option>
                  <option value="EN_TRAMITE">En Trámite con el Banco</option>
                  <option value="APERTURADO">Cuenta Aperturada</option>
                  <option value="OBSERVADO">Observado por Entidad</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-900 mb-1">
                  Fecha de Solicitud
                </label>
                <input
                  type="date"
                  value={salaryForm.openingRequestDate || new Date().toISOString().split('T')[0]}
                  onChange={e => setSalaryForm({ ...salaryForm, openingRequestDate: e.target.value })}
                  className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                  Notas de Apertura / Comentarios:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Trámite corporativo coordinado con ejecutiva BCP Sede Central."
                  value={salaryForm.notes || ''}
                  onChange={e => setSalaryForm({ ...salaryForm, notes: e.target.value })}
                  className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar Disposición de Cuenta Sueldo
            </button>
          </div>
        </form>
      </div>


      {/* 5. SECCIÓN: TRAZABILIDAD DOCUMENTAL */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs flex items-center gap-2">
          <History className="w-4 h-4 text-sky-600" />
          4. Bitácora de Trazabilidad Documental & Observaciones
        </h4>
        <p className="text-slate-500 text-[11px]">
          Historial inmutable de cargas, revisiones, observaciones y validaciones de este expediente.
        </p>

        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto custom-scrollbar">
          {documentTraceability.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-xs">
              No hay movimientos documentales registrados todavía.
            </div>
          ) : (
            documentTraceability.map((tr, idx) => (
              <div key={idx} className="p-3 text-xs flex items-start justify-between gap-3 hover:bg-slate-50">
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900">{tr.observation}</div>
                  {tr.details && (
                    <div className="text-[11px] text-slate-600 italic">"{tr.details}"</div>
                  )}
                  <div className="text-[10px] text-slate-400">
                    Registrado por <strong>{tr.user}</strong> • {tr.date} {tr.time}
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-700 shrink-0">
                  {tr.action}
                </span>
              </div>
            ))
          )}
        </div>
      </div>


      {/* MODAL: SUBIR DOCUMENTO */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-400" />
                Cargar Documento al Expediente
              </h4>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmUpload} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre del Documento *</label>
                <input
                  type="text"
                  required
                  value={uploadDocName}
                  onChange={e => setUploadDocName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-900 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipo de Documento *</label>
                <select
                  value={uploadDocType}
                  onChange={e => setUploadDocType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-900 text-xs"
                >
                  <option value="DNI">DNI Vigente (ambas caras)</option>
                  <option value="CV">Currículum Vitae (CV)</option>
                  <option value="CUL_ANTECEDENTES">Certificado Único Laboral (CUL / Antecedentes)</option>
                  <option value="RECIBO_SERVICIOS">Recibo de Servicios (Luz/Agua/Gas)</option>
                  <option value="CUENTA_BANCARIA">Constancia de Cuenta Bancaria / CCI</option>
                  <option value="DECLARACION_JURADA">Declaración Jurada</option>
                  <option value="CERTIFICADO_ESTUDIOS">Certificado de Estudios</option>
                  <option value="OTROS">Otro Documento</option>
                </select>
              </div>

              {/* Drag and Drop Zone */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Seleccionar Archivo (PDF, JPG, PNG)</label>
                <label className="block border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                  <input type="file" accept="application/pdf,image/jpeg,image/png" required className="sr-only" onChange={event => { const file = event.target.files?.[0] ?? null; setUploadFile(file); setUploadFileName(file?.name ?? ''); }} />
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <span className="text-slate-600 block text-xs font-semibold">
                    {uploadFileName || 'Arrastra el archivo o haz clic para examinar'}
                  </span>
                  <span className="text-[10px] text-slate-400">Tamaño máximo: 10 MB</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !uploadFile}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {isSaving ? 'Subiendo…' : 'Confirmar y Subir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: OBSERVAR DOCUMENTO */}
      {observingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-rose-200 overflow-hidden">
            <div className="bg-rose-900 text-white p-4 flex items-center justify-between">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-300" />
                Observar Documento: {observingDoc.name}
              </h4>
              <button onClick={() => setObservingDoc(null)} className="text-rose-200 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmObserve} className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Indique claramente el motivo por el cual este documento es observado (falta de legibilidad, vencido, incompleto, etc.).
              </p>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Motivo de la Observación *
                </label>
                <textarea
                  required
                  rows={3}
                  value={observationText}
                  onChange={e => setObservationText(e.target.value)}
                  placeholder="Ej: El DNI adjuntado no cuenta con el reverso legible / CUL emitido con fecha vencida."
                  className="w-full bg-rose-50/50 border border-rose-300 rounded-lg p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setObservingDoc(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Registrar Observación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUBSANAR DOCUMENTO */}
      {subsanarDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-amber-200 overflow-hidden">
            <div className="bg-amber-900 text-white p-4 flex items-center justify-between">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-300" />
                Subsanar Documento: {subsanarDoc.name}
              </h4>
              <button onClick={() => setSubsanarDoc(null)} className="text-amber-200 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSubsanar} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-950">
                <span className="font-bold block text-[11px]">Observación previa:</span>
                <p className="text-[11px] italic mt-0.5">"{subsanarDoc.observationReason || subsanarDoc.notes}"</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Cargar Archivo Corregido / Subsanado *</label>
                <label className="block border-2 border-dashed border-amber-300 rounded-xl p-4 text-center bg-amber-50/40 cursor-pointer">
                  <input type="file" accept="application/pdf,image/jpeg,image/png" required className="sr-only" onChange={event => { const file = event.target.files?.[0] ?? null; setSubsanarFile(file); setSubsanarFileName(file?.name ?? ''); }} />
                  <Upload className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                  <span className="text-slate-700 block text-xs font-semibold">
                    {subsanarFileName}
                  </span>
                  <span className="text-[10px] text-slate-500">El estado pasará a "Cargado" para que el analista lo revise.</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSubsanarDoc(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!subsanarFile}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Subsanar y Enviar a Revisión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
