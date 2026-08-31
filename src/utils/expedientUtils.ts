import { CandidateRecord, DocumentItem, ExpedientStatus, SalaryAccountDetails } from '../types';

export interface MandatoryDocDef {
  type: string;
  label: string;
  description: string;
  iconName?: string;
}

export const MANDATORY_DOC_DEFS: MandatoryDocDef[] = [
  {
    type: 'DNI',
    label: 'DNI Vigente (Ambas Caras)',
    description: 'Documento Nacional de Identidad legible por anverso y reverso.'
  },
  {
    type: 'CV',
    label: 'Currículum Vitae (CV)',
    description: 'Hoja de vida actualizada con datos de contacto y experiencia.'
  },
  {
    type: 'CUL_ANTECEDENTES',
    label: 'Certificado Único Laboral (CUL)',
    description: 'Certificado oficial del MTPE / Certijoven o antecedentes policiales y penales.'
  },
  {
    type: 'RECIBO_SERVICIOS',
    label: 'Recibo de Servicios Reciente',
    description: 'Recibo de Luz, Agua o Gas no mayor a 3 meses para verificación de domicilio.'
  }
];

export const OPTIONAL_DOC_DEFS: MandatoryDocDef[] = [
  {
    type: 'CUENTA_BANCARIA',
    label: 'Constancia de Cuenta / CCI',
    description: 'Comprobante bancario que certifique el número de cuenta y CCI.'
  },
  {
    type: 'DECLARACION_JURADA',
    label: 'Declaración Jurada Domicilio / Salud',
    description: 'Formato firmado de declaración jurada.'
  },
  {
    type: 'CERTIFICADO_ESTUDIOS',
    label: 'Certificado de Estudios / Grado',
    description: 'Constancia de estudios superiores o secundaria completa.'
  }
];

/**
 * Normalizes document type matching across legacy or alternate keys
 */
export function normalizeDocType(type: string): string {
  if (type === 'DNI_FRONT' || type === 'DNI_BACK' || type === 'DNI') return 'DNI';
  if (type === 'ANTECEDENTES' || type === 'CUL_ANTECEDENTES') return 'CUL_ANTECEDENTES';
  if (type === 'CV') return 'CV';
  if (type === 'RECIBO_SERVICIOS') return 'RECIBO_SERVICIOS';
  if (type === 'CUENTA_BANCARIA') return 'CUENTA_BANCARIA';
  if (type === 'DECLARACION_JURADA') return 'DECLARACION_JURADA';
  if (type === 'CERTIFICADO_ESTUDIOS') return 'CERTIFICADO_ESTUDIOS';
  return type;
}

/**
 * Returns candidate documents from the single unified source
 */
export function getCandidateDocuments(candidate: CandidateRecord): DocumentItem[] {
  if (candidate.documents && candidate.documents.length > 0) {
    return candidate.documents;
  }
  if (candidate.selection?.documents && candidate.selection.documents.length > 0) {
    return candidate.selection.documents;
  }
  return [];
}

/**
 * Finds a document matching a mandatory definition
 */
export function findDocumentByType(docs: DocumentItem[], type: string): DocumentItem | undefined {
  const normTarget = normalizeDocType(type);
  return docs.find(d => normalizeDocType(d.type) === normTarget);
}

/**
 * Evaluates the status of personal data required for hiring
 */
export function checkPersonalDataComplete(candidate: CandidateRecord): {
  isComplete: boolean;
  missingFields: string[];
} {
  const missing: string[] = [];
  if (!candidate.dni || candidate.dni.trim().length < 8) missing.push('DNI');
  if (!candidate.fullName || candidate.fullName.trim().length < 4) missing.push('Nombres y Apellidos');
  if (!candidate.birthDate) missing.push('Fecha de Nacimiento');
  if (!candidate.phone || candidate.phone.trim().length < 7) missing.push('Teléfono');
  if (!candidate.email || !candidate.email.includes('@')) missing.push('Correo electrónico');
  if (!candidate.city && !candidate.district && !candidate.address) missing.push('Dirección y Distrito');

  return {
    isComplete: missing.length === 0,
    missingFields: missing
  };
}

/**
 * Evaluates the status of salary account information
 */
export function checkSalaryAccountStatus(salaryAccount?: SalaryAccountDetails): {
  isConfigured: boolean;
  type: 'CUENTA_PROPIA' | 'SOLICITUD_APERTURA' | 'NO_CONFIGURADO';
  detail: string;
} {
  if (!salaryAccount) {
    return {
      isConfigured: false,
      type: 'NO_CONFIGURADO',
      detail: 'Pendiente de registrar cuenta bancaria o solicitud de apertura'
    };
  }

  if (salaryAccount.hasAccount) {
    const hasBank = !!salaryAccount.bank;
    const hasAccountNum = !!salaryAccount.accountNumber && salaryAccount.accountNumber.trim().length > 5;
    if (hasBank && hasAccountNum) {
      return {
        isConfigured: true,
        type: 'CUENTA_PROPIA',
        detail: `Cuenta ${salaryAccount.bank} N° ${salaryAccount.accountNumber}`
      };
    }
    return {
      isConfigured: false,
      type: 'NO_CONFIGURADO',
      detail: 'Cuenta propia incompleta (falta banco o número de cuenta)'
    };
  }

  if (salaryAccount.requestOpening) {
    return {
      isConfigured: true,
      type: 'SOLICITUD_APERTURA',
      detail: `Apertura corporativa solicitada (${salaryAccount.openingStatus || 'SOLICITADO'})`
    };
  }

  return {
    isConfigured: false,
    type: 'NO_CONFIGURADO',
    detail: 'Pendiente de definir opción de pago de haberes'
  };
}

export interface ExpedientProgressItem {
  id: string;
  label: string;
  category: 'DATOS_PERSONALES' | 'DOCUMENTO' | 'CUENTA_SUELDO';
  isMandatory: boolean;
  status: 'VALIDADO' | 'CARGADO' | 'PENDIENTE' | 'OBSERVADO';
  detail?: string;
  observationReason?: string;
  validatedBy?: string;
  docId?: string;
}

export interface ExpedientAnalysis {
  status: ExpedientStatus;
  statusLabel: string;
  percentage: number;
  totalMandatoryItems: number;
  completedMandatoryItems: number;
  items: ExpedientProgressItem[];
  observedCount: number;
  pendingCount: number;
  validatedCount: number;
  missingMandatoryLabels: string[];
  observedMandatoryLabels: string[];
  personalDataStatus: { isComplete: boolean; missingFields: string[] };
  salaryAccountStatus: { isConfigured: boolean; type: string; detail: string };
  docsStatus: { totalCount: number; completedCount: number; isComplete: boolean; pendingDocs: string[] };
}

/**
 * Calculates complete status and progress metrics for candidate dossier
 */
export function getExpedientAnalysis(candidate: CandidateRecord): ExpedientAnalysis {
  const docs = getCandidateDocuments(candidate);
  const items: ExpedientProgressItem[] = [];

  // 1. Personal Data item
  const personalDataCheck = checkPersonalDataComplete(candidate);
  items.push({
    id: 'ITEM_PERSONAL_DATA',
    label: 'Datos Personales para Contratación',
    category: 'DATOS_PERSONALES',
    isMandatory: true,
    status: personalDataCheck.isComplete ? 'VALIDADO' : 'PENDIENTE',
    detail: personalDataCheck.isComplete 
      ? `DNI ${candidate.dni} • ${candidate.birthDate} • ${candidate.district || candidate.city || 'Lima'}`
      : `Faltan: ${personalDataCheck.missingFields.join(', ')}`
  });

  // 2. Mandatory Documents
  const missingMandatoryLabels: string[] = [];
  const observedMandatoryLabels: string[] = [];

  MANDATORY_DOC_DEFS.forEach(def => {
    const doc = findDocumentByType(docs, def.type);
    if (!doc) {
      items.push({
        id: `MANDATORY_${def.type}`,
        label: def.label,
        category: 'DOCUMENTO',
        isMandatory: true,
        status: 'PENDIENTE',
        detail: 'Documento no adjuntado aún'
      });
      missingMandatoryLabels.push(def.label);
    } else {
      let itemStatus: ExpedientProgressItem['status'] = 'PENDIENTE';
      if (doc.status === 'VALIDADO') itemStatus = 'VALIDADO';
      else if (doc.status === 'OBSERVADO') {
        itemStatus = 'OBSERVADO';
        observedMandatoryLabels.push(def.label);
      } else if (doc.status === 'CARGADO') itemStatus = 'CARGADO';
      else if (doc.status === 'RECHAZADO') {
        itemStatus = 'OBSERVADO';
        observedMandatoryLabels.push(def.label);
      }

      if (itemStatus === 'PENDIENTE') {
        missingMandatoryLabels.push(def.label);
      }

      items.push({
        id: `MANDATORY_${def.type}`,
        docId: doc.id,
        label: def.label,
        category: 'DOCUMENTO',
        isMandatory: true,
        status: itemStatus,
        detail: doc.name || def.description,
        observationReason: doc.observationReason || doc.notes,
        validatedBy: doc.validatedBy
      });
    }
  });

  // 3. Salary Account item
  const salaryCheck = checkSalaryAccountStatus(candidate.salaryAccount);
  items.push({
    id: 'ITEM_SALARY_ACCOUNT',
    label: 'Cuenta Sueldo / Solicitud Apertura',
    category: 'CUENTA_SUELDO',
    isMandatory: true,
    status: salaryCheck.isConfigured ? 'VALIDADO' : 'PENDIENTE',
    detail: salaryCheck.detail
  });

  // Calculate stats over mandatory requirements (6 total mandatory checkpoints)
  const mandatoryItems = items.filter(i => i.isMandatory);
  const totalMandatoryItems = mandatoryItems.length;
  const completedMandatoryItems = mandatoryItems.filter(i => i.status === 'VALIDADO').length;
  const observedCount = items.filter(i => i.status === 'OBSERVADO').length;
  const pendingCount = items.filter(i => i.status === 'PENDIENTE').length;
  const loadedCount = items.filter(i => i.status === 'CARGADO').length;
  const validatedCount = items.filter(i => i.status === 'VALIDADO').length;

  const percentage = Math.round((completedMandatoryItems / totalMandatoryItems) * 100);

  // Document specific metrics
  const docItems = items.filter(i => i.category === 'DOCUMENTO' && i.isMandatory);
  const completedDocsCount = docItems.filter(i => i.status === 'VALIDADO').length;
  const docsStatus = {
    totalCount: docItems.length,
    completedCount: completedDocsCount,
    isComplete: completedDocsCount === docItems.length,
    pendingDocs: missingMandatoryLabels
  };

  // Overall ExpedientStatus determination:
  // - OBSERVADO if any document is observed
  // - COMPLETO if 100% of mandatory items are VALIDADO
  // - PENDIENTE_VALIDACION if all docs are uploaded (CARGADO or VALIDADO, no PENDIENTE in docs) but not all are VALIDADO yet
  // - INCOMPLETO if any mandatory item is PENDIENTE
  let status: ExpedientStatus = 'INCOMPLETO';
  let statusLabel = 'Expediente incompleto';

  if (observedCount > 0) {
    status = 'OBSERVADO';
    statusLabel = 'Observado';
  } else if (completedMandatoryItems === totalMandatoryItems) {
    status = 'COMPLETO';
    statusLabel = 'Completo';
  } else if (pendingCount === 0 && loadedCount > 0 && personalDataCheck.isComplete && salaryCheck.isConfigured) {
    status = 'PENDIENTE_VALIDACION';
    statusLabel = 'Pendiente de validación';
  } else {
    status = 'INCOMPLETO';
    statusLabel = 'Expediente incompleto';
  }

  return {
    status,
    statusLabel,
    percentage,
    totalMandatoryItems,
    completedMandatoryItems,
    items,
    observedCount,
    pendingCount,
    validatedCount,
    missingMandatoryLabels,
    observedMandatoryLabels,
    personalDataStatus: personalDataCheck,
    salaryAccountStatus: salaryCheck,
    docsStatus
  };
}

/**
 * Checks if a candidate is eligible to be given Alta ("Dar de alta" button check)
 * Rule: ONLY enabled if Formación/OJT is approved AND Documentation is complete & validated.
 */
export function evaluateAltaReadiness(candidate: CandidateRecord): {
  canApprove: boolean;
  isTrainingApproved: boolean;
  isExpedientComplete: boolean;
  reasons: string[];
  blockSummary: string;
  analysis: ExpedientAnalysis;
} {
  const analysis = getExpedientAnalysis(candidate);
  const reasons: string[] = [];

  // Check 1: Capacitación Teórica Aprobada
  const isTheoreticalTrainingPassed = 
    candidate.training?.status === 'APROBADO_OJT' || 
    candidate.training?.finalResult === 'APROBADO_OJT' ||
    candidate.training?.status === 'APTO_ALTA' || 
    candidate.training?.finalResult === 'APTO_ALTA' ||
    candidate.training?.status === 'EN_OJT' ||
    candidate.selection.trainingPassed === true ||
    candidate.currentStage === 'APTO_ALTA' ||
    candidate.currentStage === 'GESTION_TALENTO';

  if (!isTheoreticalTrainingPassed) {
    reasons.push('Capacitación teórica no está marcada como aprobada.');
  }

  // Check 2: OJT (Piso de operaciones) Aprobado
  const isOjtPassed = 
    candidate.ojt?.status === 'APTO_ALTA' || 
    candidate.ojt?.status === 'OJT_APROBADO' ||
    candidate.currentStage === 'APTO_ALTA' ||
    candidate.currentStage === 'GESTION_TALENTO';

  if (!isOjtPassed) {
    reasons.push('Periodo OJT (en piso) no está aprobado / finalizado como Apto para Alta.');
  }

  const isTrainingAndOjtApproved = isTheoreticalTrainingPassed && isOjtPassed;

  // Check 3: Expedient Complete & Validated (DNI, CV, CUL, Recibo + Datos Personales)
  const isExpedientComplete = analysis.status === 'COMPLETO';

  if (analysis.status === 'OBSERVADO') {
    reasons.push(`Existen documentos observados que deben ser subsanados: ${analysis.observedMandatoryLabels.join(', ')}.`);
  } else if (analysis.status !== 'COMPLETO') {
    if (!analysis.personalDataStatus.isComplete) {
      reasons.push(`Faltan datos personales obligatorios: ${analysis.personalDataStatus.missingFields.join(', ')}.`);
    }
    if (analysis.missingMandatoryLabels.length > 0) {
      reasons.push(`Faltan documentos obligatorios por cargar: ${analysis.missingMandatoryLabels.join(', ')}.`);
    }
    if (analysis.items.some(i => i.status === 'CARGADO')) {
      reasons.push('Hay documentos cargados pendientes de ser revisados y validados por el analista.');
    }
  }

  // Check 4: Cuenta Sueldo o Solicitud de Apertura
  const isSalaryAccountConfigured = analysis.salaryAccountStatus.isConfigured;
  if (!isSalaryAccountConfigured) {
    reasons.push('Falta registrar los datos de cuenta sueldo o formalizar la solicitud de apertura.');
  }

  const canApprove = isTrainingAndOjtApproved && isExpedientComplete && isSalaryAccountConfigured;

  let blockSummary = '';
  if (!canApprove) {
    if (isTrainingAndOjtApproved && (!isExpedientComplete || !isSalaryAccountConfigured)) {
      blockSummary = 'Capacitación y OJT aprobados – Pendiente de documentación o cuenta sueldo';
    } else if (!isTrainingAndOjtApproved && isExpedientComplete && isSalaryAccountConfigured) {
      blockSummary = 'Expediente completo – Pendiente de finalizar y aprobar Formación / OJT';
    } else {
      blockSummary = 'Formación/OJT en curso y documentación/cuenta sueldo pendiente';
    }
  } else {
    blockSummary = 'Listo para dar de Alta en Gestión de Talento';
  }

  return {
    canApprove,
    isTrainingApproved: isTrainingAndOjtApproved,
    isExpedientComplete: isExpedientComplete && isSalaryAccountConfigured,
    reasons,
    blockSummary,
    analysis
  };
}
