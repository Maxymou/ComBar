import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SyncState } from '../hooks/useOnlineStatus';
import { PresenceDevice } from '../types';
import OnlineDevices from './OnlineDevices';

type View =
  | 'order'
  | 'prices'
  | 'sync'
  | 'bank'
  | 'salesManagement'
  | 'debug'
  | 'adminPassword';

interface DrawerItem {
  id: View;
  label: string;
  icon: string;
  enabled: boolean;
}

interface SideDrawerProps {
  isOpen: boolean;
  activeView: View;
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
  onClose: () => void;
  onSelect: (view: View) => void;
  onOpenAdministration: () => boolean;
  onForceSync: () => void;
  onApplyUpdate: () => void;
}

const MAIN_MENU_ITEMS: DrawerItem[] = [
  { id: 'bank', label: 'Banque', icon: '🏦', enabled: true },
];

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

const ADMIN_MENU_ITEMS: DrawerItem[] = [
  { id: 'prices', label: 'Gestion des prix', icon: '💰', enabled: true },
  { id: 'salesManagement', label: 'Gestion des produits', icon: '🧾', enabled: true },
  { id: 'sync', label: 'Commandes en attente', icon: '🔁', enabled: true },
  { id: 'adminPassword', label: 'Modifier le MDP', icon: '🔑', enabled: true },
  { id: 'debug', label: 'Débug', icon: '🛠️', enabled: true },
];

export default function SideDrawer({
  isOpen,
  activeView,
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
  onClose,
  onSelect,
  onOpenAdministration,
  onForceSync,
  onApplyUpdate,
}: SideDrawerProps) {
  const [drawerMenu, setDrawerMenu] = useState<'main' | 'administration'>('main');
  const [isDevicesPopoverOpen, setIsDevicesPopoverOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState(localDeviceName);
  const [isRenaming, setIsRenaming] = useState(false);

  const syncClassName =
    !isOnline || syncState === 'offline'
      ? 'offline'
      : syncState === 'pending' || syncState === 'error'
        ? 'pending'
        : syncState === 'syncing'
          ? 'syncing'
          : 'online';

  const syncLabel = useMemo(() => {
    if (!isOnline || syncState === 'offline') return 'Hors ligne';
    if (syncState === 'syncing') return 'Synchronisation...';
    if (syncState === 'error') return `${pendingCount} en attente (erreur réseau)`;
    if (pendingCount > 0 || syncState === 'pending') return `${pendingCount} en attente`;
    return 'Synchronisé';
  }, [isOnline, pendingCount, syncState]);
  const canOpenDevicesPopover = isOnline;

  useEffect(() => {
    setRenameDraft(localDeviceName);
  }, [localDeviceName]);

  useEffect(() => {
    if (!isDevicesPopoverOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDevicesPopoverOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDevicesPopoverOpen]);

  const handleRename = async () => {
    if (isRenaming) return;
    setIsRenaming(true);
    try {
      await onRenameTerminal(renameDraft);
    } finally {
      setIsRenaming(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setDrawerMenu('main');
      return;
    }

    const stateToken = { drawerOpen: true };
    window.history.pushState(stateToken, '');

    const onPopState = (event: PopStateEvent) => {
      if (event.state?.drawerOpen) return;
      onClose();
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [isOpen, onClose]);

  return (
    <>
      <div
        className={`drawer-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
      <aside className={`side-drawer ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen} aria-label="Navigation principale">
        <div className="side-drawer-header">{drawerMenu === 'main' ? 'Navigation' : 'Administration'}</div>
        <nav className="side-drawer-nav" aria-label="Menu latéral">
          {drawerMenu === 'main' ? (
            <>
              <section className="drawer-status-card" aria-label="État de l’application">
                <div className="drawer-status-title">État de l’application</div>
                <button
                  type="button"
                  className={`drawer-sync-row drawer-sync-trigger ${canOpenDevicesPopover ? 'clickable' : ''}`}
                  onClick={() => {
                    if (!canOpenDevicesPopover) return;
                    setIsDevicesPopoverOpen(true);
                  }}
                  disabled={!canOpenDevicesPopover}
                  aria-haspopup={canOpenDevicesPopover ? 'dialog' : undefined}
                  aria-expanded={canOpenDevicesPopover ? isDevicesPopoverOpen : undefined}
                >
                  <span className={`drawer-sync-dot ${syncClassName}`} aria-hidden="true" />
                  <span className="drawer-sync-text">{syncLabel}</span>
                  {canOpenDevicesPopover && (
                    <span className="drawer-sync-more">Terminaux</span>
                  )}
                </button>
                <div className="drawer-status-actions">
                  {isOnline && (
                    <button type="button" className="drawer-status-btn" onClick={onForceSync}>
                      Forcer synchro
                    </button>
                  )}
                  {updateAvailable && (
                    <button type="button" className="drawer-status-btn update" onClick={onApplyUpdate}>
                      Mettre à jour
                    </button>
                  )}
                </div>
                <div className="drawer-build-info">v{buildVersion} · {buildTimestamp} · PWA {pwaEnabled ? 'ON' : 'OFF'}</div>
              </section>
              {MAIN_MENU_ITEMS.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`side-drawer-item ${activeView === item.id ? 'active' : ''}`}
                  onClick={() => {
                    if (!item.enabled) return;
                    onSelect(item.id);
                  }}
                  disabled={!item.enabled}
                  aria-current={activeView === item.id ? 'page' : undefined}
                >
                  <span className="side-drawer-item-icon" aria-hidden="true">{item.icon}</span>
                  <span className="side-drawer-item-text">{item.label}</span>
                  {!item.enabled && <span className="side-drawer-item-badge">Bientôt</span>}
                </button>
              ))}
              <button
                type="button"
                className="side-drawer-item"
                onClick={() => {
                  const unlocked = onOpenAdministration();
                  if (unlocked) {
                    setDrawerMenu('administration');
                  }
                }}
              >
                <span className="side-drawer-item-icon" aria-hidden="true">🔐</span>
                <span className="side-drawer-item-text">Administration</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="side-drawer-back"
                onClick={() => setDrawerMenu('main')}
              >
                ← Retour
              </button>
              {ADMIN_MENU_ITEMS.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`side-drawer-item ${activeView === item.id ? 'active' : ''}`}
                  onClick={() => onSelect(item.id)}
                  aria-current={activeView === item.id ? 'page' : undefined}
                >
                  <span className="side-drawer-item-icon" aria-hidden="true">{item.icon}</span>
                  <span className="side-drawer-item-text">{item.label}</span>
                </button>
              ))}
            </>
          )}
        </nav>
      </aside>
      {isDevicesPopoverOpen && createPortal(
        <div className="terminal-overlay" onClick={() => setIsDevicesPopoverOpen(false)}>
          <div
            className="terminal-popover connected-devices-popover"
            role="dialog"
            aria-modal="true"
            aria-label="Terminaux connectés"
            onClick={event => event.stopPropagation()}
          >
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
            <OnlineDevices devices={connectedDevices} />

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
        </div>,
        document.body,
      )}
    </>
  );
}

export type { View };
