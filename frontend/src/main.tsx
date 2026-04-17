import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import DebugOverlay from './components/DebugOverlay';
import { installViewportResolver } from './viewport';
import { isDebugViewportEnabled } from './debug';
import { registerSW } from 'virtual:pwa-register';

const debug = isDebugViewportEnabled();

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(swUrl) {
    console.info('[PWA] Service worker registered:', swUrl);
  },
  onRegisterError(error) {
    console.error('[PWA] Service worker registration error:', error);
  },
  onNeedRefresh() {
    console.info('[PWA] New service worker detected, updating now...');
    void updateSW(true);
  },
  onOfflineReady() {
    console.info('[PWA] App is ready to work offline.');
  },
});

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
