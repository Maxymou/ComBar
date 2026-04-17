import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import DebugOverlay from './components/DebugOverlay';
import { installViewportResolver } from './viewport';
import { isDebugViewportEnabled } from './debug';

const debug = isDebugViewportEnabled();

const buildVersion = import.meta.env.VITE_APP_VERSION || 'dev';
const buildTimestamp = import.meta.env.VITE_BUILD_TIMESTAMP || 'unknown';
const pwaEnabled = import.meta.env.VITE_ENABLE_PWA === 'true';

console.info(`[Build] ComBar version ${buildVersion} built at ${buildTimestamp}`);
console.info(`[Build] PWA enabled: ${pwaEnabled}`);

if (!pwaEnabled && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      void registration.unregister();
    });
  });

  if ('caches' in window) {
    caches.keys().then(keys => {
      keys.forEach(key => {
        void caches.delete(key);
      });
    });
  }
}

installViewportResolver({ debug });

if (debug) {
  document.documentElement.classList.add('viewport-debug');
  document.body.classList.add('viewport-debug');
}

const root = document.getElementById('root')!;
if (debug) {
  root.classList.add('viewport-debug-root');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
    {debug ? <DebugOverlay /> : null}
  </React.StrictMode>,
);
