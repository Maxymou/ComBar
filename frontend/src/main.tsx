import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Robust viewport height for iOS PWA (standalone) where 100vh / 100dvh
// can be miscalculated around the home indicator. The visualViewport API
// yields the actual visible area; fall back to innerHeight otherwise.
function setAppHeight() {
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${h}px`);
}

setAppHeight();
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', () => {
  // iOS reports stale dimensions immediately after orientation change
  setAppHeight();
  setTimeout(setAppHeight, 200);
});
window.visualViewport?.addEventListener('resize', setAppHeight);
window.visualViewport?.addEventListener('scroll', setAppHeight);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
