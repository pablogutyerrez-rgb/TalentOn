import React from 'react';
import { useTalent } from '../context/TalentContext';
import { RecruiterSelectionDashboard } from './RecruiterSelectionDashboard';
import { SelectionLeadershipDashboard } from './SelectionLeadershipDashboard';

export const DashboardView: React.FC = () => {
  const { currentUser } = useTalent();

  if (currentUser.role === 'RECLUTADOR') {
    return <RecruiterSelectionDashboard />;
  }

  return <SelectionLeadershipDashboard />;
};
