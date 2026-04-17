interface HeaderProps {
  isHH: boolean;
  isOnline: boolean;
  pendingCount: number;
  onlineUsers: number;
  buildVersion: string;
  buildTimestamp: string;
  pwaEnabled: boolean;
  onToggleHH: () => void;
  onNavigatePrices: () => void;
}

export default function Header({
  isHH,
  isOnline,
  pendingCount,
  onlineUsers,
  buildVersion,
  buildTimestamp,
  pwaEnabled,
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
          <div className="header-status-block">
            <div className={`sync-indicator ${isOnline ? 'online' : 'offline'}`}>
              <span className="sync-dot" />
              <span className="sync-text">
                {isOnline ? 'En ligne' : 'Hors ligne'}
                {pendingCount > 0 && ` (${pendingCount})`}
              </span>
            </div>
            <div className="online-users" aria-live="polite">En ligne : {onlineUsers}</div>
          </div>
          <button className="btn-hh" onClick={onToggleHH}>
            {isHH ? 'HH ON' : 'Happy Hour'}
          </button>
        </div>
      </div>
      <div className="build-info" aria-label="build-version">
        v{buildVersion} · {buildTimestamp} · PWA {pwaEnabled ? 'ON' : 'OFF'}
      </div>
    </div>
  );
}
