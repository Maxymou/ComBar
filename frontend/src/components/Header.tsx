import { useEffect, useMemo, useRef, useState } from 'react';
import { PresenceDevice } from '../types';
import { SyncState } from '../hooks/useOnlineStatus';

interface HeaderProps {
  isHH: boolean;
  isOnline: boolean;
  pendingCount: number;
  syncState: SyncState;
  onlineUsers: number;
  connectedDevices: PresenceDevice[];
  recentlyActiveDevices: PresenceDevice[];
  localDeviceName: string;
  onRenameTerminal: (nextName: string) => Promise<void>;
  buildVersion: string;
  buildTimestamp: string;
  pwaEnabled: boolean;
  updateAvailable: boolean;
  onToggleHH: () => void;
  onOpenMenu: () => void;
  onForceSync: () => void;
  onApplyUpdate: () => void;
}

function formatLastSeen(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'dernière activité inconnue';
  }

  const now = Date.now();
  const diffSeconds = Math.floor((now - date.getTime()) / 1000);
  if (diffSeconds < 60) return 'à l’instant';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `il y a ${diffMinutes} min`;
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Header({
  isHH,
  isOnline,
  pendingCount,
  syncState,
  onlineUsers,
  connectedDevices,
  recentlyActiveDevices,
  localDeviceName,
  onRenameTerminal,
  buildVersion,
  buildTimestamp,
  pwaEnabled,
  updateAvailable,
  onToggleHH,
  onOpenMenu,
  onForceSync,
  onApplyUpdate,
}: HeaderProps) {
  const [isDevicesPopoverOpen, setIsDevicesPopoverOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState(localDeviceName);
  const [isRenaming, setIsRenaming] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRenameDraft(localDeviceName);
  }, [localDeviceName]);

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
  const syncClassName =
    !isOnline || syncState === 'offline'
      ? 'offline'
      : syncState === 'pending' || syncState === 'error'
        ? 'pending'
        : syncState === 'syncing'
          ? 'syncing'
          : 'online';
  const syncLabel = useMemo(() => {
    if (!isOnline || syncState === 'offline') return '🔴 Hors ligne';
    if (syncState === 'syncing') return '🔄 Synchronisation...';
    if (pendingCount > 0 || syncState === 'pending') return `🟡 ${pendingCount} en attente`;
    if (syncState === 'error') return `🟡 ${pendingCount} en attente (erreur réseau)`;
    return '🟢 Synchronisé';
  }, [isOnline, pendingCount, syncState]);

  const handleRename = async () => {
    if (isRenaming) return;
    setIsRenaming(true);
    try {
      await onRenameTerminal(renameDraft);
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <div className="header-wrap">
      <div className="header">
        <div className="header-left">
          <button className="title title-btn btn-reset-style" onClick={onOpenMenu} type="button" aria-label="Ouvrir le menu">
            <img src="/logo-192.png" alt="ComBar" className="header-logo" />
            {isHH && <span className="hh-flash">HH</span>}
          </button>
        </div>
        <div className="header-right">
          <div className="header-status-block" ref={popoverRef}>
            <div
              className={`sync-indicator ${syncClassName} ${canOpenDevicesPopover ? 'clickable' : ''}`}
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
                {syncLabel}
              </span>
            </div>
            <div className="sync-actions-row">
              {isOnline && (
                <button type="button" className="sync-action-btn" onClick={onForceSync}>
                  Forcer synchro
                </button>
              )}
              {updateAvailable && (
                <button type="button" className="sync-action-btn update" onClick={onApplyUpdate}>
                  Mettre à jour
                </button>
              )}
            </div>
            {isDevicesPopoverOpen && (
              <div className="connected-devices-popover" role="dialog" aria-label="Terminaux connectés">
                <div className="connected-devices-title">Terminaux</div>
                <div className="connected-devices-summary">{onlineUsers} connectés · {syncLabel}</div>

                <div className="terminal-rename-row">
                  <input
                    className="terminal-rename-input"
                    value={renameDraft}
                    maxLength={12}
                    onChange={event => setRenameDraft(event.target.value)}
                    placeholder="Nom du terminal"
                    aria-label="Nom du terminal"
                  />
                  <button className="terminal-rename-btn" onClick={handleRename} disabled={isRenaming} type="button">
                    {isRenaming ? '...' : 'Renommer'}
                  </button>
                </div>

                <div className="devices-section-title">Connectés</div>
                {connectedDevices.length > 0 ? (
                  <ul className="connected-devices-list">
                    {connectedDevices.map(device => (
                      <li className="connected-device-row" key={device.deviceId}>
                        <span className="connected-device-main">
                          <span className="connected-device-name">{device.deviceName || 'Terminal'}</span>
                          <span className="connected-device-status">en ligne</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="connected-devices-fallback">Aucun terminal connecté</div>
                )}

                <div className="devices-section-title">Actifs récemment</div>
                {recentlyActiveDevices.length > 0 ? (
                  <ul className="connected-devices-list">
                    {recentlyActiveDevices.map(device => (
                      <li className="connected-device-row" key={device.deviceId}>
                        <span className="connected-device-main">
                          <span className="connected-device-name">{device.deviceName || 'Terminal'}</span>
                          <span className="connected-device-time">{formatLastSeen(device.lastSeenAt)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="connected-devices-fallback">Aucune activité récente</div>
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
