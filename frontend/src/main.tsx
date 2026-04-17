import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import DebugOverlay from './components/DebugOverlay';
import { installViewportResolver } from './viewport';
import { isDebugViewportEnabled } from './debug';
import { registerSW } from 'virtual:pwa-register';

const debug = isDebugViewportEnabled();

registerSW({ immediate: true });

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
