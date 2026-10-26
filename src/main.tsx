import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppErrorBoundary } from './components/common/AppErrorBoundary.tsx';
import { reloadOnceForAssetError } from './utils/assetRecovery.ts';
import './index.css';

window.addEventListener('vite:preloadError', event => {
  if (reloadOnceForAssetError(new Error('Preload error'))) event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
);
