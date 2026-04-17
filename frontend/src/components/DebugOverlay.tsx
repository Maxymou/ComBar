import { useEffect, useState } from 'react';
import {
  ViewportMetrics,
  ResolverState,
  collectMetrics,
  subscribeViewport,
  getLastState,
} from '../viewport';

interface Row {
  label: string;
  value: string;
  warn?: boolean;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'n/a';
  if (typeof n === 'number' && Number.isFinite(n)) return String(Math.round(n * 100) / 100);
  return String(n);
}

function buildRows(metrics: ViewportMetrics, state: ResolverState | null): Row[] {
  const candidates = state?.candidates ?? {};
  const maxCandidate = Math.max(0, ...Object.values(candidates));
  const innerShort = metrics.innerHeight > 0 && maxCandidate - metrics.innerHeight > 60;
  const clientShort = metrics.clientHeight > 0 && maxCandidate - metrics.clientHeight > 60;
  const vvShort =
    metrics.visualViewportHeight != null &&
    maxCandidate - metrics.visualViewportHeight > 60;

  return [
    { label: 'UA', value: metrics.userAgent },
    { label: 'nav.standalone', value: String(metrics.navigatorStandalone) },
    { label: 'mm.standalone', value: String(metrics.matchMediaStandalone) },
    { label: 'isIOSStandalone', value: String(metrics.isIOSStandalone) },
    { label: 'orientation', value: metrics.orientation },
    { label: 'dpr', value: fmt(metrics.devicePixelRatio) },
    { label: 'inner', value: `${metrics.innerWidth} x ${metrics.innerHeight}`, warn: innerShort },
    { label: 'outer', value: `${metrics.outerWidth} x ${metrics.outerHeight}` },
    { label: 'screen', value: `${metrics.screenWidth} x ${metrics.screenHeight}` },
    {
      label: 'client',
      value: `${metrics.clientWidth} x ${metrics.clientHeight}`,
      warn: clientShort,
    },
    {
      label: 'body',
      value: `client:${metrics.bodyClientHeight} scroll:${metrics.bodyScrollHeight}`,
    },
    {
      label: '#root',
      value: `client:${metrics.rootClientHeight} offset:${metrics.rootOffsetHeight}`,
    },
    { label: '.app-shell', value: `${metrics.appShellClientHeight}` },
    { label: '.app', value: `${metrics.appClientHeight}` },
    { label: '.app-content', value: `${metrics.appContentClientHeight}` },
    { label: '.screen-wrapper', value: `${metrics.screenWrapperClientHeight}` },
    { label: '.validate-actions', value: `${metrics.validateActionsClientHeight}` },
    {
      label: 'vv',
      value: `${fmt(metrics.visualViewportWidth)} x ${fmt(metrics.visualViewportHeight)}`,
      warn: vvShort,
    },
    {
      label: 'vv.offset',
      value: `${fmt(metrics.visualViewportOffsetLeft)}, ${fmt(metrics.visualViewportOffsetTop)}`,
    },
    { label: '--app-height', value: metrics.appHeightVar || 'n/a' },
    { label: '--vvh', value: metrics.vvhVar || 'n/a' },
    {
      label: 'safe-area',
      value: `t:${metrics.safeAreaTop} r:${metrics.safeAreaRight} b:${metrics.safeAreaBottom} l:${metrics.safeAreaLeft}`,
    },
    {
      label: 'candidates',
      value: Object.entries(candidates)
        .map(([k, v]) => `${k}=${Math.round(v)}`)
        .join(' | ') || 'n/a',
    },
    {
      label: 'chosen',
      value: `${state?.chosenSource ?? 'n/a'} → ${state?.stableHeight ?? 0}px`,
    },
    { label: 'visible', value: `${state?.visibleHeight ?? 0}px` },
    {
      label: 'chain-diff',
      value: `vvh-appShell=${fmt((metrics.visualViewportHeight ?? 0) - metrics.appShellClientHeight)} | appShell-app=${fmt(metrics.appShellClientHeight - metrics.appClientHeight)} | app-appContent=${fmt(metrics.appClientHeight - metrics.appContentClientHeight)}`,
      warn: (metrics.visualViewportHeight ?? 0) - metrics.appShellClientHeight > 8,
    },
  ];
}

export default function DebugOverlay() {
  const [metrics, setMetrics] = useState<ViewportMetrics>(() => collectMetrics());
  const [state, setState] = useState<ResolverState | null>(() => getLastState());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const unsub = subscribeViewport((newState, newMetrics) => {
      setState({ ...newState });
      setMetrics(newMetrics);
    });
    return unsub;
  }, []);

  const rows = buildRows(metrics, state);

  return (
    <div
      style={{
        position: 'fixed',
        top: 'env(safe-area-inset-top, 0px)',
        right: 4,
        zIndex: 99999,
        maxWidth: collapsed ? 72 : 360,
        maxHeight: collapsed ? 28 : '60vh',
        overflow: 'auto',
        background: 'rgba(0, 0, 0, 0.82)',
        color: '#0f0',
        font: '11px/1.3 ui-monospace, Menlo, Consolas, monospace',
        padding: '4px 6px',
        border: '1px solid #0f0',
        borderRadius: 4,
        pointerEvents: 'auto',
      }}
      onClick={() => setCollapsed(c => !c)}
      title="Tap to toggle"
    >
      {collapsed ? (
        <span>DBG {state?.stableHeight ?? '?'}</span>
      ) : (
        <>
          <div style={{ color: '#ff0', marginBottom: 2 }}>VIEWPORT DEBUG (tap to hide)</div>
          {rows.map(r => (
            <div
              key={r.label}
              style={{
                display: 'flex',
                gap: 4,
                color: r.warn ? '#f55' : '#0f0',
                wordBreak: 'break-all',
              }}
            >
              <span style={{ color: '#9ae', flexShrink: 0, minWidth: 86 }}>{r.label}</span>
              <span>{r.value}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
