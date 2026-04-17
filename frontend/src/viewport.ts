/**
 * iPhone / iOS PWA viewport height resolver.
 *
 * Problem: on iPhone standalone PWA, `window.innerHeight` is unreliable. It can
 * return a shorter value than the real visible area, leaving a black/white bar
 * at the bottom of the app. Other metrics (documentElement.clientHeight,
 * visualViewport.height) are sometimes more correct, sometimes not.
 *
 * Strategy: collect every credible candidate, pick the tallest one that does
 * not look obviously wrong, and let the stable shell height only grow (never
 * shrink) inside the same orientation. The "live visible" height, used for
 * layout affected by the keyboard, is separately tracked via visualViewport.
 */

export type Orientation = 'portrait' | 'landscape';

export interface ViewportMetrics {
  userAgent: string;
  navigatorStandalone: boolean;
  matchMediaStandalone: boolean;
  isIOS: boolean;
  isIOSStandalone: boolean;
  orientation: Orientation;
  innerWidth: number;
  innerHeight: number;
  outerWidth: number;
  outerHeight: number;
  screenWidth: number;
  screenHeight: number;
  clientWidth: number;
  clientHeight: number;
  visualViewportWidth: number | null;
  visualViewportHeight: number | null;
  visualViewportOffsetTop: number | null;
  visualViewportOffsetLeft: number | null;
  appHeightVar: string;
  vvhVar: string;
  safeAreaTop: string;
  safeAreaBottom: string;
  safeAreaLeft: string;
  safeAreaRight: string;
  devicePixelRatio: number;
}

export interface ResolverState {
  stableHeight: number;
  visibleHeight: number;
  orientation: Orientation;
  chosenSource: string;
  candidates: Record<string, number>;
  isIOSStandalone: boolean;
}

type Listener = (state: ResolverState, metrics: ViewportMetrics) => void;

// Tolerance: metrics within ~2% of each other are considered agreeing.
const AGREEMENT_TOLERANCE_PX = 24;

// If a candidate is shorter than the tallest credible one by more than this,
// it is suspected of being an iOS lie (keyboard, address bar, etc.) and not
// used as the SHELL height.
const SUSPICIOUS_DELTA_PX = 80;

const STABILIZATION_TIMEOUTS_MS = [60, 160, 320, 620, 1000, 1400, 2000];

function getOrientation(): Orientation {
  if (typeof window === 'undefined') return 'portrait';
  if (window.matchMedia?.('(orientation: landscape)').matches) return 'landscape';
  // Fallback: compare dimensions.
  if (window.innerWidth > window.innerHeight) return 'landscape';
  return 'portrait';
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPhone / iPad / iPod + modern iPad that masquerades as Mac with touch.
  const isClassic = /iPad|iPhone|iPod/.test(ua);
  const isModernIPad =
    /Macintosh/.test(ua) && typeof (navigator as Navigator).maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
  return isClassic || isModernIPad;
}

function detectIOSStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const navStandalone =
    'standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const mediaStandalone = window.matchMedia?.('(display-mode: standalone)').matches === true;
  return detectIOS() && (navStandalone || mediaStandalone);
}

function readCssVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function readSafeArea(side: 'top' | 'right' | 'bottom' | 'left'): string {
  if (typeof document === 'undefined') return '';
  // env() cannot be read directly, so we reflect through a --sa* variable.
  const cssName = `--sa${side[0]}`;
  return readCssVar(cssName) || '0px';
}

export function collectMetrics(): ViewportMetrics {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  const doc = typeof document !== 'undefined' ? document.documentElement : null;
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as Navigator);

  return {
    userAgent: nav.userAgent || '',
    navigatorStandalone:
      'standalone' in nav && (nav as Navigator & { standalone?: boolean }).standalone === true,
    matchMediaStandalone:
      typeof window !== 'undefined' &&
      window.matchMedia?.('(display-mode: standalone)').matches === true,
    isIOS: detectIOS(),
    isIOSStandalone: detectIOSStandalone(),
    orientation: getOrientation(),
    innerWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    innerHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    outerWidth: typeof window !== 'undefined' ? window.outerWidth : 0,
    outerHeight: typeof window !== 'undefined' ? window.outerHeight : 0,
    screenWidth: typeof screen !== 'undefined' ? screen.width : 0,
    screenHeight: typeof screen !== 'undefined' ? screen.height : 0,
    clientWidth: doc?.clientWidth ?? 0,
    clientHeight: doc?.clientHeight ?? 0,
    visualViewportWidth: vv ? vv.width : null,
    visualViewportHeight: vv ? vv.height : null,
    visualViewportOffsetTop: vv ? vv.offsetTop : null,
    visualViewportOffsetLeft: vv ? vv.offsetLeft : null,
    appHeightVar: readCssVar('--app-height'),
    vvhVar: readCssVar('--vvh'),
    safeAreaTop: readSafeArea('top'),
    safeAreaRight: readSafeArea('right'),
    safeAreaBottom: readSafeArea('bottom'),
    safeAreaLeft: readSafeArea('left'),
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
  };
}

/**
 * Build the set of height candidates that could reasonably describe the
 * SHELL height (stable viewport). Keyboard-sensitive sources are excluded
 * from the shell selection — they belong to the "visible" height instead.
 */
function collectShellCandidates(metrics: ViewportMetrics): Record<string, number> {
  const candidates: Record<string, number> = {};

  if (metrics.innerHeight > 0) candidates.innerHeight = metrics.innerHeight;
  if (metrics.clientHeight > 0) candidates.clientHeight = metrics.clientHeight;
  if (metrics.visualViewportHeight && metrics.visualViewportHeight > 0) {
    candidates.visualViewportHeight = metrics.visualViewportHeight;
  }

  // Portrait-screen derived estimate: in iOS standalone PWA the device screen
  // height in CSS px is a reliable upper bound when portrait. We only use it
  // as a sanity reference, never as the chosen height on its own.
  if (
    metrics.isIOSStandalone &&
    metrics.orientation === 'portrait' &&
    metrics.screenHeight > 0
  ) {
    candidates.screenHeight = metrics.screenHeight;
  }

  return candidates;
}

/**
 * Pick the most credible stable shell height from the candidates.
 *
 * Heuristic:
 *   1. Drop non-positive and obviously absurd values.
 *   2. If iOS standalone: favor the TALLEST credible candidate. iPhone's
 *      innerHeight is the usual liar; clientHeight and visualViewport.height
 *      tend to be truer. We explicitly avoid picking a value that is much
 *      shorter than another credible one.
 *   3. On other platforms: favor the MEDIAN-ish value — prefer innerHeight
 *      first, falling back to clientHeight, then visualViewport.height.
 */
function pickShellHeight(
  candidates: Record<string, number>,
  metrics: ViewportMetrics,
): { value: number; source: string } {
  const entries = Object.entries(candidates).filter(([, v]) => v > 200 && v < 4000);

  if (entries.length === 0) {
    return { value: metrics.innerHeight || 0, source: 'fallback-innerHeight' };
  }

  if (metrics.isIOSStandalone) {
    // Tallest credible wins. Exclude visualViewportHeight if it is far shorter
    // than the tallest — that means the keyboard is probably open or iOS is
    // reporting a transient shrunken viewport.
    const tallest = entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
    const tallestValue = tallest[1];

    // If innerHeight is suspiciously shorter than clientHeight, we know
    // innerHeight lied — keep the taller one.
    const credible = entries.filter(([, v]) => tallestValue - v <= SUSPICIOUS_DELTA_PX);
    const chosen = credible.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
    return { value: Math.round(chosen[1]), source: `ios-standalone:${chosen[0]}` };
  }

  // Non-iOS or iOS in browser: prefer the established priority.
  const priority = ['innerHeight', 'clientHeight', 'visualViewportHeight', 'screenHeight'];
  for (const key of priority) {
    if (candidates[key] && candidates[key] > 200) {
      return { value: Math.round(candidates[key]), source: key };
    }
  }

  const first = entries[0];
  return { value: Math.round(first[1]), source: first[0] };
}

function pickVisibleHeight(metrics: ViewportMetrics): number {
  // Visible viewport tracks keyboard and scroll chrome — prefer visualViewport.
  if (metrics.visualViewportHeight && metrics.visualViewportHeight > 0) {
    return Math.round(metrics.visualViewportHeight);
  }
  if (metrics.innerHeight > 0) return Math.round(metrics.innerHeight);
  if (metrics.clientHeight > 0) return Math.round(metrics.clientHeight);
  return 0;
}

let currentOrientation: Orientation = getOrientation();
let stableHeight = 0;
let lastState: ResolverState | null = null;
const listeners = new Set<Listener>();
let stabilizationTimers: number[] = [];
let rafId = 0;

function writeViewportVars(state: ResolverState): void {
  if (typeof document === 'undefined') return;
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--app-height', `${state.stableHeight}px`);
  rootStyle.setProperty('--vvh', `${state.visibleHeight}px`);
}

export function updateViewport(forceReset = false): ResolverState {
  const metrics = collectMetrics();
  const nextOrientation = metrics.orientation;
  const orientationChanged = nextOrientation !== currentOrientation;

  if (orientationChanged || forceReset) {
    currentOrientation = nextOrientation;
    stableHeight = 0;
  }

  const candidates = collectShellCandidates(metrics);
  const { value: shellCandidate, source } = pickShellHeight(candidates, metrics);

  // Shell height only grows within the same orientation — transient shrinks
  // (keyboard, scroll chrome, iOS transition frames) must not reduce it.
  if (shellCandidate > stableHeight) {
    stableHeight = shellCandidate;
  }

  const visibleHeight = pickVisibleHeight(metrics);

  const state: ResolverState = {
    stableHeight,
    visibleHeight,
    orientation: nextOrientation,
    chosenSource: source,
    candidates,
    isIOSStandalone: metrics.isIOSStandalone,
  };

  lastState = state;
  writeViewportVars(state);
  listeners.forEach(listener => listener(state, metrics));

  return state;
}

function runStartupStabilization(): void {
  updateViewport(true);

  let pass = 0;
  const rafPasses = 10;
  const rafTick = () => {
    updateViewport();
    pass += 1;
    if (pass < rafPasses) {
      rafId = window.requestAnimationFrame(rafTick);
    }
  };
  rafId = window.requestAnimationFrame(rafTick);

  stabilizationTimers.forEach(window.clearTimeout);
  stabilizationTimers = STABILIZATION_TIMEOUTS_MS.map(delay =>
    window.setTimeout(() => updateViewport(), delay),
  );
}

export function subscribeViewport(listener: Listener): () => void {
  listeners.add(listener);
  if (lastState) listener(lastState, collectMetrics());
  return () => {
    listeners.delete(listener);
  };
}

export function getLastState(): ResolverState | null {
  return lastState;
}

export interface InstallOptions {
  debug?: boolean;
}

export function installViewportResolver(options: InstallOptions = {}): void {
  if (typeof window === 'undefined') return;

  const debug = options.debug === true;

  const logEvent = (event: string) => {
    if (!debug) return;
    const state = lastState;
    const metrics = collectMetrics();
    // eslint-disable-next-line no-console
    console.log(`[viewport:${event}]`, {
      chosenSource: state?.chosenSource,
      stableHeight: state?.stableHeight,
      visibleHeight: state?.visibleHeight,
      orientation: state?.orientation,
      isIOSStandalone: metrics.isIOSStandalone,
      candidates: state?.candidates,
      innerHeight: metrics.innerHeight,
      clientHeight: metrics.clientHeight,
      visualViewportHeight: metrics.visualViewportHeight,
      screenHeight: metrics.screenHeight,
      outerHeight: metrics.outerHeight,
      appHeightVar: metrics.appHeightVar,
      vvhVar: metrics.vvhVar,
      safeAreaTop: metrics.safeAreaTop,
      safeAreaBottom: metrics.safeAreaBottom,
    });
  };

  runStartupStabilization();
  logEvent('startup');

  window.addEventListener('resize', () => {
    updateViewport();
    logEvent('resize');
  });

  window.addEventListener('orientationchange', () => {
    updateViewport(true);
    runStartupStabilization();
    logEvent('orientationchange');
  });

  window.addEventListener('pageshow', () => {
    runStartupStabilization();
    logEvent('pageshow');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      runStartupStabilization();
      logEvent('visibilitychange');
    }
  });

  window.visualViewport?.addEventListener('resize', () => {
    updateViewport();
    logEvent('vv-resize');
  });

  window.visualViewport?.addEventListener('scroll', () => {
    updateViewport();
    logEvent('vv-scroll');
  });

  window.addEventListener('beforeunload', () => {
    if (rafId) window.cancelAnimationFrame(rafId);
    stabilizationTimers.forEach(window.clearTimeout);
  });
}
