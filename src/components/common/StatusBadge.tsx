import React from 'react';
import { AppStage, SelectionStage, TrainingStatus, OjtStatus, HiringStatus, AttendanceStatus } from '../../types';

interface StatusBadgeProps {
  type: 'appStage' | 'selectionStage' | 'trainingStatus' | 'ojtStatus' | 'hiringStatus' | 'attendance';
  value: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, value, size = 'md' }) => {
  let label = value;
  let bgClass = 'bg-slate-100 text-slate-700 border-slate-200';

  const sizeClass = size === 'sm' 
    ? 'text-xs px-2 py-0.5' 
    : size === 'lg' 
    ? 'text-sm px-3 py-1 font-semibold' 
    : 'text-xs px-2.5 py-1 font-medium';

  if (type === 'appStage') {
    switch (value as AppStage) {
      case 'SELECCION':
        label = 'Selección';
        bgClass = 'bg-sky-50 text-sky-700 border-sky-200';
        break;
      case 'CAPACITACION':
        label = 'Capacitación';
        bgClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
        break;
      case 'OJT':
        label = 'En OJT';
        bgClass = 'bg-amber-50 text-amber-700 border-amber-200';
        break;
      case 'APTO_ALTA':
        label = 'Apto para Alta';
        bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold ring-1 ring-emerald-400/30';
        break;
      case 'GESTION_TALENTO':
        label = 'Gestión Talento';
        bgClass = 'bg-purple-50 text-purple-700 border-purple-200';
        break;
      case 'CONTRATADO':
        label = 'Contratado';
        bgClass = 'bg-teal-50 text-teal-800 border-teal-300 font-bold ring-1 ring-teal-500/20';
        break;
      case 'DESCARTADO':
        label = 'Descartado';
        bgClass = 'bg-rose-50 text-rose-700 border-rose-200';
        break;
      case 'BAJA':
        label = 'Baja / Deserción';
        bgClass = 'bg-zinc-100 text-zinc-600 border-zinc-300';
        break;
    }
  } else if (type === 'selectionStage') {
    switch (value as SelectionStage) {
      case 'NUEVO':
        label = 'Nuevo Lead';
        bgClass = 'bg-slate-100 text-slate-700 border-slate-200';
        break;
      case 'SCREENING_TELEFONICO':
        label = 'Screening Telefónico';
        bgClass = 'bg-blue-50 text-blue-700 border-blue-200';
        break;
      case 'EVALUACION_PSICOTECNICA':
        label = 'Psicotécnica';
        bgClass = 'bg-cyan-50 text-cyan-700 border-cyan-200';
        break;
      case 'ENTREVISTA_INDIVIDUAL':
        label = 'Entrevista';
        bgClass = 'bg-purple-50 text-purple-700 border-purple-200';
        break;
      case 'ROLEPLAY_SIMULACION':
        label = 'Roleplay / Simulación';
        bgClass = 'bg-amber-50 text-amber-700 border-amber-200';
        break;
      case 'APTO_CAPACITACION':
        label = 'Apto para Capacitación';
        bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-300 font-medium';
        break;
      case 'DESCARTADO':
        label = 'Descartado';
        bgClass = 'bg-rose-50 text-rose-700 border-rose-200';
        break;
    }
  } else if (type === 'trainingStatus') {
    switch (value as TrainingStatus) {
      case 'NO_ASIGNADO':
        label = 'Sin Grupo';
        bgClass = 'bg-slate-100 text-slate-600 border-slate-200';
        break;
      case 'EN_CURSO':
        label = 'En Formación';
        bgClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
        break;
      case 'APROBADO_OJT':
        label = 'Aprobado a OJT';
        bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
      case 'BAJA_CAPACITACION':
        label = 'Baja Capacitación';
        bgClass = 'bg-rose-50 text-rose-700 border-rose-200';
        break;
    }
  } else if (type === 'ojtStatus') {
    switch (value as OjtStatus) {
      case 'NO_INICIADO':
        label = 'Pendiente OJT';
        bgClass = 'bg-slate-100 text-slate-600 border-slate-200';
        break;
      case 'EN_PROCESO':
        label = 'En Proceso OJT';
        bgClass = 'bg-sky-50 text-sky-700 border-sky-200';
        break;
      case 'APTO_ALTA':
        label = 'Apto para Alta';
        bgClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold';
        break;
      case 'EXTENSION':
        label = 'Extensión OJT';
        bgClass = 'bg-amber-50 text-amber-700 border-amber-200';
        break;
      case 'NO_APTO':
        label = 'No Apto';
        bgClass = 'bg-rose-50 text-rose-700 border-rose-200';
        break;
      case 'ABANDONO':
        label = 'Abandono';
        bgClass = 'bg-zinc-100 text-zinc-600 border-zinc-300';
        break;
    }
  } else if (type === 'hiringStatus') {
    switch (value as HiringStatus) {
      case 'PENDIENTE_CONTRATACION':
        label = 'Pendiente de contratación';
        bgClass = 'bg-amber-50 text-amber-700 border-amber-200';
        break;
      case 'EN_REVISION':
        label = 'En revisión';
        bgClass = 'bg-sky-50 text-sky-700 border-sky-200';
        break;
      case 'NO_APTO':
        label = 'No Iniciado';
        bgClass = 'bg-slate-100 text-slate-500 border-slate-200';
        break;
      case 'PENDIENTE_EXPEDIENTE':
        label = 'Expediente Pendiente';
        bgClass = 'bg-amber-50 text-amber-700 border-amber-200';
        break;
      case 'DOCUMENTOS_EN_REVISION':
        label = 'Doc. en Revisión';
        bgClass = 'bg-blue-50 text-blue-700 border-blue-200';
        break;
      case 'CONTRATO_GENERADO':
        label = 'Contrato Generado';
        bgClass = 'bg-purple-50 text-purple-700 border-purple-200';
        break;
      case 'PENDIENTE_FIRMA':
        label = 'Pendiente Firma';
        bgClass = 'bg-orange-50 text-orange-700 border-orange-200';
        break;
      case 'CONTRATADO':
        label = 'Contratado Oficial';
        bgClass = 'bg-emerald-500 text-white border-emerald-600 font-semibold shadow-xs';
        break;
      case 'RECHAZADO':
        label = 'Rechazado';
        bgClass = 'bg-rose-50 text-rose-700 border-rose-200';
        break;
      case 'CANCELADO':
        label = 'Cancelado';
        bgClass = 'bg-rose-50 text-rose-700 border-rose-200';
        break;
      case 'REPROGRAMADO':
        label = 'Reprogramado';
        bgClass = 'bg-orange-50 text-orange-700 border-orange-200';
        break;
    }
  } else if (type === 'attendance') {
    switch (value as AttendanceStatus) {
      case 'PRESENTE':
        label = 'P (Presente)';
        bgClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-medium';
        break;
      case 'TARDANZA':
        label = 'T (Tardanza)';
        bgClass = 'bg-amber-100 text-amber-800 border-amber-300 font-medium';
        break;
      case 'FALTA_JUSTIFICADA':
        label = 'FJ (Justificada)';
        bgClass = 'bg-sky-100 text-sky-800 border-sky-300 font-medium';
        break;
      case 'FALTA_INJUSTIFICADA':
        label = 'F (Injustificada)';
        bgClass = 'bg-rose-100 text-rose-800 border-rose-300 font-medium';
        break;
    }
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border whitespace-nowrap ${bgClass} ${sizeClass}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
      {label}
    </span>
  );
};
