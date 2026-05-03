import { useEffect, useRef, useState } from 'react';

interface HeaderProps {
  isHH: boolean;
  onToggleHH: () => void;
  onOpenMenu: () => void;
  onPullRefresh?: () => void | Promise<void>;
}

const PULL_THRESHOLD = 80;
const PULL_MAX = 140;

function formatClock(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default function Header({
  isHH,
  onToggleHH,
  onOpenMenu,
  onPullRefresh,
}: HeaderProps) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    let intervalId: number | null = null;
    const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
    const timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, 60_000);
    }, msUntilNextMinute);
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, []);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (isRefreshing || !onPullRefresh) return;
    if (event.touches.length !== 1) return;
    startYRef.current = event.touches[0].clientY;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (isRefreshing || !onPullRefresh) return;
    if (startYRef.current == null) return;
    const delta = event.touches[0].clientY - startYRef.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    const eased = Math.min(PULL_MAX, delta * 0.6);
    setPullDistance(eased);
  };

  const handleTouchEnd = async () => {
    if (isRefreshing || !onPullRefresh) {
      startYRef.current = null;
      setPullDistance(0);
      return;
    }
    const distance = pullDistance;
    startYRef.current = null;

    if (distance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      try {
        await onPullRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  const ready = pullDistance >= PULL_THRESHOLD;
  const showIndicator = pullDistance > 0 || isRefreshing;
  const indicatorLabel = isRefreshing ? 'Synchronisation…' : ready ? 'Relâcher' : 'Tirer pour actualiser';

  return (
    <div
      className={`header-wrap${isRefreshing ? ' header-wrap-refreshing' : ''}`}
      ref={wrapRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {showIndicator && (
        <div
          className={`pull-refresh${ready ? ' pull-refresh-ready' : ''}${isRefreshing ? ' pull-refresh-active' : ''}`}
          style={{ height: `${pullDistance}px` }}
          aria-live="polite"
        >
          <span className={`pull-refresh-spinner${isRefreshing ? ' spinning' : ''}`} aria-hidden="true">↻</span>
          <span className="pull-refresh-label">{indicatorLabel}</span>
        </div>
      )}
      <div className="header">
        <div className="header-left">
          <button className="title title-btn btn-reset-style" onClick={onOpenMenu} type="button" aria-label="Ouvrir le menu">
            <img src="/logo-192.png" alt="ComBar" className="header-logo" />
            {isHH && <span className="hh-flash">HH</span>}
          </button>
          <span className="header-clock" aria-label="Heure courante">{formatClock(now)}</span>
        </div>
        <div className="header-right">
          <button className="btn-hh" onClick={onToggleHH}>
            {isHH ? 'HH ON' : 'Happy Hour'}
          </button>
        </div>
      </div>
    </div>
  );
}
