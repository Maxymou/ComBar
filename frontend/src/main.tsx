import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import DebugOverlay from './components/DebugOverlay';
import { installViewportResolver } from './viewport';
import { isDebugViewportEnabled } from './debug';

const debug = isDebugViewportEnabled();

installViewportResolver({ debug });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    {debug ? <DebugOverlay /> : null}
  </React.StrictMode>,
);
