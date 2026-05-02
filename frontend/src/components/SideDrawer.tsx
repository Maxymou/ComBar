import { useEffect } from 'react';

type View =
  | 'order'
  | 'prices'
  | 'sync'
  | 'history'
  | 'actions'
  | 'service'
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
}

const ADMIN_ITEMS: DrawerItem[] = [
  { id: 'prices', label: 'Gestion des prix', icon: '💰', enabled: true },
  { id: 'sync', label: 'Commandes en attente', icon: '🔁', enabled: true },
];

const MENU_ITEMS: DrawerItem[] = [
  { id: 'history', label: 'Journal de caisse', icon: '📜', enabled: false },
  { id: 'actions', label: 'Journal des actions', icon: '🧾', enabled: false },
  { id: 'service', label: 'Service', icon: '📊', enabled: false },
  { id: 'settings', label: 'Paramètres', icon: '⚙️', enabled: false },
];

export default function SideDrawer({ isOpen, activeView, onClose, onSelect }: SideDrawerProps) {
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
    if (!isOpen) return;

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
        <div className="side-drawer-header">Navigation</div>
        <nav className="side-drawer-nav" aria-label="Menu latéral">
          <div className="side-drawer-section" aria-label="Administration">
            <div className="side-drawer-section-title">Administration</div>
            <div className="side-drawer-subnav">
              {ADMIN_ITEMS.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`side-drawer-item side-drawer-subitem ${activeView === item.id ? 'active' : ''}`}
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
            </div>
          </div>
          {MENU_ITEMS.map(item => (
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
        </nav>
      </aside>
    </>
  );
}

export type { View };
