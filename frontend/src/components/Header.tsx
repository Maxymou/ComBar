interface HeaderProps {
  isHH: boolean;
  isOnline: boolean;
  pendingCount: number;
  buildVersion: string;
  buildTimestamp: string;
  onToggleHH: () => void;
  onNavigatePrices: () => void;
}

export default function Header({
  isHH,
  isOnline,
  pendingCount,
  buildVersion,
  buildTimestamp,
  onToggleHH,
  onNavigatePrices,
}: HeaderProps) {
  return (
    <div className="header-wrap">
      <div className="header">
        <div className="header-left">
          <button className="title title-btn btn-reset-style" onClick={onNavigatePrices} type="button">
            <img src="/logo-192.png" alt="ComBar" className="header-logo" />
            {isHH && <span className="hh-flash">HH</span>}
          </button>
        </div>
        <div className="header-right">
          <div className={`sync-indicator ${isOnline ? 'online' : 'offline'}`}>
            <span className="sync-dot" />
            <span className="sync-text">
              {isOnline ? 'En ligne' : 'Hors ligne'}
              {pendingCount > 0 && ` (${pendingCount})`}
            </span>
          </div>
          <button className="btn-hh" onClick={onToggleHH}>
            {isHH ? 'HH ON' : 'Happy Hour'}
          </button>
        </div>
      </div>
      <div className="build-info" aria-label="build-version">
        v{buildVersion} · {buildTimestamp}
      </div>
    </div>
  );
}
