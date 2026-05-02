import { useEffect, useState } from 'react';

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
  onClose: () => void;
  onSelect: (view: View) => void;
  onOpenAdministration: () => boolean;
}

const MAIN_MENU_ITEMS: DrawerItem[] = [
  { id: 'bank', label: 'Banque', icon: '🏦', enabled: true },
  { id: 'settings', label: 'Paramètres', icon: '⚙️', enabled: false },
];

const ADMIN_MENU_ITEMS: DrawerItem[] = [
  { id: 'prices', label: 'Gestion des prix', icon: '💰', enabled: true },
  { id: 'sync', label: 'Commandes en attente', icon: '🔁', enabled: true },
];

export default function SideDrawer({ isOpen, activeView, onClose, onSelect, onOpenAdministration }: SideDrawerProps) {
  const [drawerMenu, setDrawerMenu] = useState<'main' | 'administration'>('main');
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
