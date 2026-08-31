import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  Link2, 
  Copy, 
  Check, 
  ExternalLink, 
  Users, 
  Power, 
  CheckCircle2, 
  Megaphone,
  QrCode
} from 'lucide-react';
import { useTalent } from '../../context/TalentContext';
import { CampaignCall, LeadSourceType } from '../../types';

interface SourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  convocatoria: CampaignCall | null;
}

export const SourcesModal: React.FC<SourcesModalProps> = ({
  isOpen,
  onClose,
  convocatoria
}) => {
  const { toggleConvocatoriaSource } = useTalent();
  const [copiedSourceName, setCopiedSourceName] = useState<string | null>(null);

  if (!isOpen || !convocatoria) return null;

  const sources = convocatoria.sources || [];

  const handleCopyLink = (srcName: LeadSourceType, linkUrl: string) => {
    navigator.clipboard.writeText(linkUrl);
    setCopiedSourceName(srcName);
    setTimeout(() => {
      setCopiedSourceName(null);
    }, 2000);
  };

  const getSourceIconColor = (name: LeadSourceType) => {
    switch (name) {
      case 'Facebook Gratis': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'Mantra': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'Referidos': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'Grupo WhatsApp': return 'text-green-600 bg-green-50 border-green-200';
      case 'Reingreso': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'Indeed': return 'text-indigo-600 bg-indigo-50 border-indigo-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const totalLeadsCaptured = sources.reduce((acc, s) => acc + (s.leadsCount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Publicación & Enlaces por Fuente de Reclutamiento
              </h3>
              <p className="text-xs text-slate-400">
                {convocatoria.title} • {totalLeadsCaptured} leads capturados en total
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          
          <div className="bg-sky-50 border border-sky-200 p-3.5 rounded-xl text-xs text-sky-900 flex items-start gap-2.5">
            <Megaphone className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Tracking automático de postulantes por canal</p>
              <p className="text-2xs text-sky-700 mt-0.5">
                Cada enlace incorpora parámetros únicos con el código de la convocatoria, la fuente de difusión y timestamp de registro para alimentar el embudo de selección.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {sources.map(src => {
              const isCopied = copiedSourceName === src.sourceName;

              return (
                <div 
                  key={src.sourceName}
                  className={`p-4 rounded-xl border transition-all ${
                    src.isEnabled ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getSourceIconColor(src.sourceName)}`}>
                        {src.sourceName}
                      </span>
                      
                      <span className="text-xs text-slate-500 font-medium">
                        Leads capturados: <strong className="text-slate-900 font-bold">{src.leadsCount}</strong>
                      </span>
                    </div>

                    {/* Toggle Switch */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleConvocatoriaSource(convocatoria.id, src.sourceName, !src.isEnabled)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-bold cursor-pointer transition-colors ${
                          src.isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        {src.isEnabled ? 'Canal Activo' : 'Desactivado'}
                      </button>
                    </div>
                  </div>

                  {/* URL Box & Copy */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-2xs font-mono text-slate-700 truncate select-all">
                      {src.link}
                    </div>

                    <button
                      type="button"
                      disabled={!src.isEnabled}
                      onClick={() => handleCopyLink(src.sourceName, src.link)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isCopied 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Listo
          </button>
        </div>

      </div>
    </div>
  );
};
