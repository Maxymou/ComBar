import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

type Orientation = 'portrait' | 'landscape';

const STABILIZATION_TIMEOUTS = [120, 260, 420, 700, 1050, 1400];

let stableHeight = 0;
let currentOrientation: Orientation = getOrientation();
let rafId = 0;
let stabilizationTimers: number[] = [];

function getOrientation(): Orientation {
  if (window.matchMedia?.('(orientation: landscape)').matches) {
    return 'landscape';
  }

  return 'portrait';
}

function getVisibleHeight(): number {
  return Math.round(window.visualViewport?.height ?? window.innerHeight);
}

function getReliableBaseHeight(): number {
  return Math.round(window.innerHeight);
}

function writeViewportVars(nextStableHeight: number): void {
  const visibleHeight = getVisibleHeight();
  const rootStyle = document.documentElement.style;

  rootStyle.setProperty('--app-height', `${nextStableHeight}px`);
  rootStyle.setProperty('--vvh', `${visibleHeight}px`);
}

function updateViewportHeight(forceReset = false): void {
  const nextOrientation = getOrientation();
  const orientationChanged = nextOrientation !== currentOrientation;

  if (orientationChanged || forceReset) {
    currentOrientation = nextOrientation;
    stableHeight = 0;
  }

  const reliableBase = getReliableBaseHeight();
  stableHeight = Math.max(stableHeight, reliableBase);

  writeViewportVars(stableHeight);
}

function runStartupStabilization(): void {
  updateViewportHeight(true);

  const rafPasses = 8;
  let pass = 0;

  const rafTick = () => {
    updateViewportHeight();
    pass += 1;

    if (pass < rafPasses) {
      rafId = window.requestAnimationFrame(rafTick);
    }
  };

  rafId = window.requestAnimationFrame(rafTick);

  stabilizationTimers.forEach(window.clearTimeout);
  stabilizationTimers = STABILIZATION_TIMEOUTS.map(delay =>
    window.setTimeout(() => updateViewportHeight(), delay),
  );
}

runStartupStabilization();

window.addEventListener('resize', () => updateViewportHeight());
window.addEventListener('orientationchange', () => {
  updateViewportHeight(true);
  runStartupStabilization();
});
window.addEventListener('pageshow', () => runStartupStabilization());

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    runStartupStabilization();
  }
});

window.visualViewport?.addEventListener('resize', () => updateViewportHeight());

window.addEventListener('beforeunload', () => {
  if (rafId) {
    window.cancelAnimationFrame(rafId);
  }

  stabilizationTimers.forEach(window.clearTimeout);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
