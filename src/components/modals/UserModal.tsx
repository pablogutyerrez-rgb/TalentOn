import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  Briefcase, 
  ShieldCheck, 
  Layers, 
  Check, 
  Building2, 
  Users, 
  Sparkles,
  CheckSquare,
  Square,
  AlertCircle
} from 'lucide-react';
import { UserProfile, UserRole, AppModuleName } from '../../types';
import { useTalent } from '../../context/TalentContext';
import { IdentityAvatar } from '../common/IdentityAvatar';
import { sanitizeDisplayName } from '../../utils/identity';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit?: UserProfile | null;
}

const DEFAULT_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80'
];

const MODULE_OPTIONS: { id: AppModuleName; label: string; description: string; color: string }[] = [
  { 
    id: 'SELECCION', 
    label: '1. Selección & Reclutamiento', 
    description: 'Convocatorias, pipeline Kanban, base de candidatos y fuentes de captación.',
    color: 'border-sky-200 bg-sky-50 text-sky-900'
  },
  { 
    id: 'FORMACION', 
    label: '2. Formación & OJT', 
    description: 'Panel de formación, control de capacitaciones, asistencia, notas modulares y piso OJT.',
    color: 'border-purple-200 bg-purple-50 text-purple-900'
  },
  { 
    id: 'TALENTO', 
    label: '3. Gestión de Talento & Altas', 
    description: 'Expediente contractual, validación de documentos y confirmación de ingreso.',
    color: 'border-emerald-200 bg-emerald-50 text-emerald-900'
  },
  { 
    id: 'ANALITICA', 
    label: '4. Reportería & Analítica Global', 
    description: 'Embudos de conversión, tiempos de SLA y métricas consolidadas.',
    color: 'border-amber-200 bg-amber-50 text-amber-900'
  },
  { 
    id: 'ADMINISTRACION', 
    label: '5. Administración & Permisos', 
    description: 'Creación y gestión de usuarios, asignación de roles y parámetros institucionales.',
    color: 'border-slate-300 bg-slate-100 text-slate-900'
  }
];

export const getDefaultModulesForRole = (role: UserRole): AppModuleName[] => {
  switch (role) {
    case 'ADMIN':
      return ['SELECCION', 'FORMACION', 'TALENTO', 'ANALITICA', 'ADMINISTRACION'];
    case 'JEFE_SELECCION':
      return ['SELECCION', 'ANALITICA'];
    case 'ANALISTA_SELECCION':
      return ['SELECCION', 'FORMACION'];
    case 'RECLUTADOR':
      return ['SELECCION'];
    case 'JEFE_FORMACION':
      return ['FORMACION', 'ANALITICA'];
    case 'COORDINADOR_FORMACION':
    case 'FORMADOR':
      return ['FORMACION'];
    case 'JEFE_TALENTO':
    case 'ANALISTA_TALENTO':
      return ['TALENTO', 'ANALITICA'];
    default:
      return ['SELECCION'];
  }
};

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  userToEdit
}) => {
  const { campaigns, availableUsers, addUser, updateUser } = useTalent();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState<UserRole>('ANALISTA_SELECCION');
  const [status, setStatus] = useState<'ACTIVO' | 'INACTIVO'>('ACTIVO');
  const [allowedModules, setAllowedModules] = useState<AppModuleName[]>(['SELECCION', 'FORMACION']);
  const [scopeCampaignIds, setScopeCampaignIds] = useState<string[]>([]);
  const [subordinateUserIds, setSubordinateUserIds] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATARS[0]);
  const [customAvatar, setCustomAvatar] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (userToEdit) {
      setName(sanitizeDisplayName(userToEdit.name, ''));
      setEmail(userToEdit.email || '');
      setPassword('');
      setPhone(userToEdit.phone || '');
      setJobTitle(userToEdit.jobTitle || '');
      setRole(userToEdit.role || 'ANALISTA_SELECCION');
      setStatus(userToEdit.status || 'ACTIVO');
      setAllowedModules(userToEdit.allowedModules || getDefaultModulesForRole(userToEdit.role));
      setScopeCampaignIds(userToEdit.scopeCampaignIds || []);
      setSubordinateUserIds(userToEdit.subordinateUserIds || []);
      setAvatarUrl(userToEdit.avatarUrl || DEFAULT_AVATARS[0]);
    } else {
      setName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setJobTitle('Analista de Selección');
      setRole('ANALISTA_SELECCION');
      setStatus('ACTIVO');
      setAllowedModules(getDefaultModulesForRole('ANALISTA_SELECCION'));
      setScopeCampaignIds([]);
      setSubordinateUserIds([]);
      setAvatarUrl(DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)]);
    }
    setErrorMsg(null);
  }, [userToEdit, isOpen]);

  if (!isOpen) return null;

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    // Auto populate default modules when role changes unless user already customized
    setAllowedModules(getDefaultModulesForRole(newRole));
    
    // Auto suggest job title
    if (!userToEdit) {
      switch (newRole) {
        case 'ADMIN':
          setJobTitle('Administrador del Sistema');
          break;
        case 'JEFE_SELECCION':
          setJobTitle('Jefe de Selección');
          break;
        case 'ANALISTA_SELECCION':
          setJobTitle('Analista de Selección');
          break;
        case 'RECLUTADOR':
          setJobTitle('Reclutador Comercial');
          break;
        case 'JEFE_FORMACION':
          setJobTitle('Jefe de Formación & OJT');
          break;
        case 'COORDINADOR_FORMACION':
          setJobTitle('Coordinador de Capacitación');
          break;
        case 'FORMADOR':
          setJobTitle('Formador / Trainer');
          break;
        case 'JEFE_TALENTO':
        case 'ANALISTA_TALENTO':
          setJobTitle('Especialista de Gestión de Talento');
          break;
      }
    }
  };

  const toggleModule = (modId: AppModuleName) => {
    if (allowedModules.includes(modId)) {
      if (allowedModules.length === 1) {
        setErrorMsg('El usuario debe tener al menos un módulo habilitado.');
        return;
      }
      setAllowedModules(allowedModules.filter(m => m !== modId));
    } else {
      setAllowedModules([...allowedModules, modId]);
    }
    setErrorMsg(null);
  };

  const toggleCampaign = (campId: string) => {
    if (scopeCampaignIds.includes(campId)) {
      setScopeCampaignIds(scopeCampaignIds.filter(id => id !== campId));
    } else {
      setScopeCampaignIds([...scopeCampaignIds, campId]);
    }
  };

  const toggleSubordinate = (userId: string) => {
    if (subordinateUserIds.includes(userId)) {
      setSubordinateUserIds(subordinateUserIds.filter(id => id !== userId));
    } else {
      setSubordinateUserIds([...subordinateUserIds, userId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeDisplayName(name, '');
    if (!cleanName || !email.trim()) {
      setErrorMsg('Nombre y usuario son obligatorios.');
      return;
    }

    if (allowedModules.length === 0) {
      setErrorMsg('Debes asignar al menos un módulo de acceso al usuario.');
      return;
    }

    try {
      if (userToEdit) {
        await updateUser(userToEdit.id, {
        name: cleanName,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        jobTitle: jobTitle.trim(),
        role,
        status,
        allowedModules,
        scopeCampaignIds,
        subordinateUserIds,
        avatarUrl
        });
      } else {
        if (password.length < 8) {
          setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
          return;
        }
        await addUser({
        name: cleanName,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        jobTitle: jobTitle.trim() || 'Colaborador',
        role,
        status,
        allowedModules,
        scopeCampaignIds,
        subordinateUserIds,
        avatarUrl,
        password,
        createdAt: new Date().toISOString().split('T')[0]
        });
      }
    } catch (error: unknown) {
      const rawDetail = error instanceof Error ? error.message : 'WORKER_REQUEST_FAILED';
      const detail = rawDetail.includes('Missing or insufficient permissions')
        ? 'No tienes permisos suficientes para modificar usuarios. Usa una cuenta Administrador General o revisa el backend administrativo.'
        : rawDetail.includes('backend administrativo')
          ? rawDetail
          : rawDetail === 'WORKER_NETWORK_UNREACHABLE'
            ? 'No se pudo conectar con el backend administrativo.'
            : rawDetail.includes('internal') || rawDetail.includes('[0]')
              ? 'El backend administrativo devolvió un error interno. Actualiza o despliega el Cloudflare Worker y vuelve a intentar.'
            : rawDetail;
      setErrorMsg(`No fue posible guardar el usuario: ${detail}`);
      return;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {userToEdit ? 'Editar Usuario y Permisos' : 'Crear Nuevo Usuario de Plataforma'}
              </h2>
              <p className="text-xs text-slate-400">
                Define el rol, módulos accesibles y alcance de gestión operativa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar text-xs">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Avatar and Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-slate-100">
            {/* Avatar picker */}
            <div className="md:col-span-1 flex flex-col items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <IdentityAvatar
                src={avatarUrl}
                name={name}
                alt="Avatar del usuario"
                className="w-16 h-16 rounded-full ring-2 ring-sky-500 shadow-xs mb-2 text-sm"
              />
              <span className="text-2xs font-bold text-slate-600 mb-2">Seleccionar Avatar</span>
              
              <div className="grid grid-cols-5 gap-1 max-w-[140px]">
                {DEFAULT_AVATARS.slice(0, 10).map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAvatarUrl(url)}
                    className={`w-5 h-5 rounded-full overflow-hidden border transition-all cursor-pointer ${
                      avatarUrl === url ? 'ring-2 ring-sky-500 scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <IdentityAvatar src={url} name={name} alt={`Avatar ${i + 1}`} className="w-full h-full rounded-full text-[7px]" />
                  </button>
                ))}
              </div>
            </div>

            {/* Basic data inputs */}
            <div className="md:col-span-2 space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Nombre Completo <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Ej. Martín Rodríguez Vega"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Usuario <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="usuario"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {!userToEdit && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Contraseña inicial <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input type="password" required minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="+51 999 888 777"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Cargo / Puesto Operativo
                  </label>
                  <div className="relative">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Ej. Analista Senior"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Estado de la Cuenta
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'ACTIVO' | 'INACTIVO')}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="ACTIVO">🟢 ACTIVO (Permitir Acceso)</option>
                    <option value="INACTIVO">🔴 INACTIVO (Bloqueado)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Role selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span>Rol Funcional en el Sistema (RBAC)</span>
              <button
                type="button"
                onClick={() => setAllowedModules(getDefaultModulesForRole(role))}
                className="text-2xs text-sky-600 font-bold hover:underline cursor-pointer"
              >
                Restablecer módulos sugeridos para este rol
              </button>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { id: 'ADMIN', name: 'Administrador General', tag: 'Acceso Total', color: 'border-purple-300 bg-purple-50/50' },
                { id: 'JEFE_SELECCION', name: 'Jefe de Selección', tag: 'Selección Global', color: 'border-sky-300 bg-sky-50/50' },
                { id: 'ANALISTA_SELECCION', name: 'Analista de Selección', tag: 'Gestión & Capacitación', color: 'border-sky-200' },
                { id: 'RECLUTADOR', name: 'Reclutador / Selector', tag: 'Pipeline & Postulantes', color: 'border-slate-200' },
                { id: 'JEFE_FORMACION', name: 'Jefe de Formación', tag: 'Formación & OJT', color: 'border-indigo-300 bg-indigo-50/50' },
                { id: 'COORDINADOR_FORMACION', name: 'Coordinador Formación', tag: 'Asignación & Cohortes', color: 'border-indigo-200' },
                { id: 'FORMADOR', name: 'Formador / Trainer', tag: 'Mis Capacitaciones & OJT', color: 'border-purple-200' },
                { id: 'JEFE_TALENTO', name: 'Gestión de Talento', tag: 'Contrataciones & Altas', color: 'border-emerald-200 bg-emerald-50/50' }
              ].map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleRoleChange(r.id as UserRole)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                    role === r.id 
                      ? 'border-sky-600 bg-sky-50 shadow-xs ring-1 ring-sky-500' 
                      : `${r.color} hover:bg-slate-50`
                  }`}
                >
                  <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                    <span>{r.name}</span>
                    {role === r.id && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                  </div>
                  <span className="text-2xs text-slate-500 block mt-0.5">{r.tag}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Module Access Assignment */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-600" />
                <span>Módulos de la Plataforma Habilitados para este Usuario</span>
              </label>
              <span className="text-2xs text-slate-500 font-medium">
                {allowedModules.length} de {MODULE_OPTIONS.length} activos
              </span>
            </div>
            <p className="text-2xs text-slate-500">
              El usuario solo verá en su menú lateral y barra de navegación los módulos que estén seleccionados aquí:
            </p>

            <div className="space-y-1.5">
              {MODULE_OPTIONS.map(mod => {
                const isSelected = allowedModules.includes(mod.id);
                return (
                  <div
                    key={mod.id}
                    onClick={() => toggleModule(mod.id)}
                    className={`p-2.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      isSelected
                        ? `${mod.color} border-current/40 shadow-2xs font-semibold`
                        : 'border-slate-200 bg-slate-50/50 text-slate-500 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="mt-0.5">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-sky-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold leading-tight flex items-center gap-2">
                        <span>{mod.label}</span>
                        {isSelected && (
                          <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-white/80 border font-extrabold">
                            Habilitado
                          </span>
                        )}
                      </div>
                      <p className="text-2xs opacity-80 mt-0.5">{mod.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scope: Convocatorias Asignadas (Optional) */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-600" />
                Alcance Operativo: Convocatorias Asignadas ({scopeCampaignIds.length})
              </span>
              <span className="text-2xs text-slate-400 font-normal">
                (Opcional - Si no se selecciona ninguna, aplica el alcance general del rol)
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
              {campaigns.map(camp => {
                const isSelected = scopeCampaignIds.includes(camp.id);
                return (
                  <div
                    key={camp.id}
                    onClick={() => toggleCampaign(camp.id)}
                    className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50 text-sky-900 font-semibold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between text-2xs">
                      <span className="font-mono text-slate-500">{camp.code}</span>
                      {isSelected && <Check className="w-3 h-3 text-sky-600" />}
                    </div>
                    <div className="text-xs font-bold truncate">{camp.title}</div>
                    <div className="text-2xs text-slate-500 truncate">{camp.client || camp.company}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subordinates: Equipo a cargo (For Jefes/Coordinadores/Analistas) */}
          {(role === 'JEFE_SELECCION' || role === 'ANALISTA_SELECCION' || role === 'JEFE_FORMACION' || role === 'COORDINADOR_FORMACION' || role === 'ADMIN') && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-600" />
                Equipo Supervisado / Subordinados ({subordinateUserIds.length})
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                {availableUsers.filter(u => u.id !== userToEdit?.id).map(u => {
                  const isSelected = subordinateUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleSubordinate(u.id)}
                      className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-purple-400 bg-purple-50 text-purple-900 font-semibold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <IdentityAvatar src={u.avatarUrl} name={u.name} className="w-6 h-6 rounded-full text-[8px]" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{u.name}</div>
                        <div className="text-2xs text-slate-500 truncate">{u.role}</div>
                      </div>
                      {isSelected && <Check className="w-3 h-3 text-purple-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-xl shadow-md shadow-sky-600/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{userToEdit ? 'Guardar Cambios' : 'Crear Usuario'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
