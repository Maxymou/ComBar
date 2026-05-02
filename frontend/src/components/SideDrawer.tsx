import { useEffect, useMemo, useState } from 'react';
import { SyncState } from '../hooks/useOnlineStatus';

type View =
  | 'order'
  | 'prices'
  | 'sync'
  | 'bank'
  | 'settings';

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
  { id: 'settings', label: 'Paramètres', icon: '⚙️', enabled: false },
];

const ADMIN_MENU_ITEMS: DrawerItem[] = [
  { id: 'prices', label: 'Gestion des prix', icon: '💰', enabled: true },
  { id: 'sync', label: 'Commandes en attente', icon: '🔁', enabled: true },
];

export default function SideDrawer({
  isOpen,
  activeView,
  isOnline,
  pendingCount,
  syncState,
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
                <div className="drawer-sync-row">
                  <span className={`drawer-sync-dot ${syncClassName}`} aria-hidden="true" />
                  <span className="drawer-sync-text">{syncLabel}</span>
                </div>
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
              {[MAIN_MENU_ITEMS[0]].map(item => (
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
              {[MAIN_MENU_ITEMS[1]].map(item => (
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
    </>
  );
}

export type { View };
