import { useEffect, useRef, useState } from 'react';
import { ConnectedDevice } from '../types';

interface HeaderProps {
  isHH: boolean;
  isOnline: boolean;
  pendingCount: number;
  onlineUsers: number;
  connectedDevices: ConnectedDevice[];
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
  connectedDevices,
  buildVersion,
  buildTimestamp,
  pwaEnabled,
  onToggleHH,
  onNavigatePrices,
}: HeaderProps) {
  const [isDevicesPopoverOpen, setIsDevicesPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isDevicesPopoverOpen) return;

    function handleOutsideClick(event: MouseEvent | TouchEvent) {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setIsDevicesPopoverOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isDevicesPopoverOpen]);

  const canOpenDevicesPopover = isOnline;
  const formatConnectedAt = (isoDate: string): string => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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
          <div className="header-status-block" ref={popoverRef}>
            <div
              className={`sync-indicator ${isOnline ? 'online' : 'offline'} ${canOpenDevicesPopover ? 'clickable' : ''}`}
              role={canOpenDevicesPopover ? 'button' : undefined}
              tabIndex={canOpenDevicesPopover ? 0 : undefined}
              aria-expanded={canOpenDevicesPopover ? isDevicesPopoverOpen : undefined}
              aria-haspopup={canOpenDevicesPopover ? 'dialog' : undefined}
              onClick={() => {
                if (!canOpenDevicesPopover) return;
                setIsDevicesPopoverOpen(open => !open);
              }}
              onKeyDown={event => {
                if (!canOpenDevicesPopover) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setIsDevicesPopoverOpen(open => !open);
                }
                if (event.key === 'Escape') {
                  setIsDevicesPopoverOpen(false);
                }
              }}
            >
              <span className="sync-dot" />
              <span className="sync-text">
                {isOnline ? `En ligne ${onlineUsers}` : 'Hors ligne'}
                {pendingCount > 0 && ` (${pendingCount})`}
              </span>
            </div>
            {isDevicesPopoverOpen && (
              <div className="connected-devices-popover" role="dialog" aria-label="Terminaux connectés">
                <div className="connected-devices-title">Terminaux connectés</div>
                {connectedDevices.length > 0 ? (
                  <ul className="connected-devices-list">
                    {connectedDevices.map(device => (
                      <li className="connected-device-row" key={device.deviceId}>
                        <span className="connected-device-main">
                          <span className="connected-device-name">{device.deviceName || 'Terminal'}</span>
                          <span className="connected-device-status">en ligne</span>
                        </span>
                        {device.connectedAt && (
                          <span className="connected-device-time">{formatConnectedAt(device.connectedAt)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="connected-devices-fallback">{onlineUsers} terminaux connectés</div>
                )}
              </div>
            )}
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
