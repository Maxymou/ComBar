import { Screen } from '../types';

interface HeaderProps {
  isHH: boolean;
  isOnline: boolean;
  pendingCount: number;
  onToggleHH: () => void;
  onNavigate: (screen: Screen) => void;
}

export default function Header({ isHH, isOnline, pendingCount, onToggleHH, onNavigate }: HeaderProps) {
  return (
    <div className="header">
      <div className="header-left">
        <div className="title title-btn" onClick={() => onNavigate('prices')}>
          <img src="/logo-192.png" alt="ComBar" className="header-logo" />
          {isHH && <span className="hh-flash">HH</span>}
        </div>
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
  );
}
