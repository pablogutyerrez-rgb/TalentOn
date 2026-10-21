import React, { useEffect, useState } from 'react';
import { useTalent } from '../../context/TalentContext';
import { operationsApi } from '../../services/operationsApi';

export function SelectionRqAlert() {
  const { currentUser, setActiveModule } = useTalent();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!['ADMIN', 'JEFE_SELECCION', 'ANALISTA_SELECCION'].includes(currentUser.role)) return;
    const refresh = () => { void operationsApi.requests().then(items => setCount(items.filter(item => item.status === 'PENDIENTE').length)).catch(() => setCount(0)); };
    refresh(); const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [currentUser.role]);
  if (!count) return null;
  return <button onClick={() => setActiveModule('SELECCION_RQ')} className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-900">{count} RQ de Operaciones pendiente{count === 1 ? '' : 's'} · Ver alertas de Selección →</button>;
}
