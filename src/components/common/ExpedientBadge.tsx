import React from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileWarning, 
  ShieldCheck,
  FileCheck2
} from 'lucide-react';
import { CandidateRecord, ExpedientStatus } from '../../types';
import { getExpedientAnalysis } from '../../utils/expedientUtils';

interface ExpedientBadgeProps {
  candidate?: CandidateRecord;
  status?: ExpedientStatus;
  percentage?: number;
  size?: 'xs' | 'sm' | 'md';
  showPercentage?: boolean;
  showIcon?: boolean;
}

export const ExpedientBadge: React.FC<ExpedientBadgeProps> = ({
  candidate,
  status: inputStatus,
  percentage: inputPercentage,
  size = 'sm',
  showPercentage = true,
  showIcon = true
}) => {
  let status: ExpedientStatus = inputStatus || 'INCOMPLETO';
  let percentage = inputPercentage ?? 0;
  let statusLabel = 'Expediente incompleto';

  if (candidate) {
    const analysis = getExpedientAnalysis(candidate);
    status = analysis.status;
    percentage = analysis.percentage;
    statusLabel = analysis.statusLabel;
  }

  let bgClass = 'bg-amber-50 text-amber-800 border-amber-200';
  let IconComponent = FileWarning;

  switch (status) {
    case 'COMPLETO':
      bgClass = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold ring-1 ring-emerald-400/20';
      IconComponent = ShieldCheck;
      statusLabel = 'Completo';
      break;
    case 'PENDIENTE_VALIDACION':
      bgClass = 'bg-sky-50 text-sky-800 border-sky-300 font-medium';
      IconComponent = Clock;
      statusLabel = 'Pendiente de validación';
      break;
    case 'OBSERVADO':
      bgClass = 'bg-rose-50 text-rose-800 border-rose-300 font-bold ring-1 ring-rose-400/20';
      IconComponent = AlertCircle;
      statusLabel = 'Observado';
      break;
    case 'INCOMPLETO':
    default:
      bgClass = 'bg-amber-50 text-amber-800 border-amber-200';
      IconComponent = FileWarning;
      statusLabel = 'Expediente incompleto';
      break;
  }

  const sizeClasses = {
    xs: 'text-[10px] px-2 py-0.5 gap-1',
    sm: 'text-xs px-2.5 py-0.5 gap-1.5',
    md: 'text-xs px-3 py-1 gap-2 font-semibold'
  }[size];

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4'
  }[size];

  return (
    <span 
      className={`inline-flex items-center rounded-full border whitespace-nowrap transition-colors ${bgClass} ${sizeClasses}`}
      title={`Estado del expediente: ${statusLabel} (${percentage}% completado)`}
    >
      {showIcon && <IconComponent className={`${iconSizes} shrink-0`} />}
      <span>{statusLabel}</span>
      {showPercentage && (
        <span className="font-mono text-[10px] opacity-80 font-bold pl-0.5">
          ({percentage}%)
        </span>
      )}
    </span>
  );
};
