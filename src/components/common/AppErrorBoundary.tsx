import React from 'react';
import { reloadOnceForAssetError } from '../../utils/assetRecovery';

type State = { failed: boolean };

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  declare props: { children: React.ReactNode };
  state: State = { failed: false };

  static getDerivedStateFromError(): State { return { failed: true }; }

  componentDidCatch(error: Error) {
    console.error('No se pudo mostrar la aplicación:', error);
    reloadOnceForAssetError(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-900">
      <section role="alert" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-[#143A56]">No pudimos cargar esta vista</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Puede deberse a una actualización reciente o a un problema temporal de conexión. Tus datos guardados no se han modificado.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-[#143A56] px-5 py-3 text-sm font-semibold text-white">Actualizar página</button>
      </section>
    </main>;
  }
}
