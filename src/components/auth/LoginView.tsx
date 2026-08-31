import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { useTalent } from '../../context/TalentContext';

export const LoginView: React.FC = () => {
  const { login } = useTalent();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [isBackground, setIsBackground] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const revealTimer = window.setTimeout(() => setIsBackground(true), 5000);
    const video = videoRef.current;
    if (video) void video.play().catch(() => undefined);
    return () => window.clearTimeout(revealTimer);
  }, []);

  const holdLastFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    if (Number.isFinite(video.duration) && video.duration > 0.05) video.currentTime = video.duration - 0.05;
    video.pause();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    const result = await login(username, password, remember);
    setIsSubmitting(false);
    setError(result.success ? '' : result.message || 'No fue posible iniciar sesión.');
  };

  return (
    <main className="talent-login relative flex min-h-screen overflow-hidden bg-white font-sans text-[#082b5c]">
      <video
        ref={videoRef}
        src="/login-intro.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={holdLastFrame}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />

      <section className={`relative z-10 flex min-h-screen w-full items-center justify-center px-5 py-8 transition-all duration-700 ease-out sm:px-10 lg:justify-end lg:px-[8vw] ${isBackground ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`} aria-hidden={!isBackground}>
        <form className="flex w-full max-w-[390px] flex-col justify-center rounded-[22px] border border-white/80 bg-white px-6 py-7 shadow-[0_24px_70px_rgba(4,25,49,0.28)] sm:px-8 lg:min-h-[430px] lg:max-w-[420px] lg:-translate-y-[clamp(3rem,8vh,6rem)] lg:px-10 lg:py-9" onSubmit={handleSubmit}>
            <div className="mb-6 text-center">
              <h1 className="text-[23px] font-bold leading-tight tracking-tight text-[#082b5c] sm:text-[25px]">¡Bienvenido de vuelta!</h1>
              <p className="mt-2.5 text-sm text-slate-500">Inicia sesión para continuar</p>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                Usuario
                <span className="relative mt-2 block">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={username} onChange={event => setUsername(event.target.value)} type="text" required autoComplete="username" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#58c8c0] focus:ring-4 focus:ring-teal-50" placeholder="Ingresa tu usuario" />
                </span>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Contraseña
                <span className="relative mt-2 block">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={password} onChange={event => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} required autoComplete="current-password" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#58c8c0] focus:ring-4 focus:ring-teal-50" placeholder="Ingresa tu contraseña" />
                  <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-[#062a5c] focus:outline-none focus:ring-2 focus:ring-teal-100">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              </label>
            </div>

            <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#082b5c]" />
              Recordarme
            </label>

            {error && <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-[#f47c61]/20 bg-[#f47c61]/10 px-4 py-3 text-sm font-medium text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
            <button disabled={isSubmitting} type="submit" className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-[#082b5c] text-sm font-semibold text-white shadow-md shadow-blue-950/10 transition hover:bg-[#06244d] focus:outline-none focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-70">
              {isSubmitting ? 'Validando…' : 'Iniciar sesión'}
            </button>
        </form>
      </section>
    </main>
  );
};
