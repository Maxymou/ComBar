import { useCallback, useEffect, useState } from 'react';
import { PendingOrder } from '../types';
import { deletePendingOrder, getUnsyncedOrders } from '../services/db';

interface PendingOrdersViewProps {
  syncState: string;
  pendingCount: number;
  onForceSync: () => void;
  onGoBack: () => void;
}

const SYNC_STATE_LABEL: Record<string, string> = {
  offline: 'Hors ligne',
  syncing: 'Synchronisation…',
  synced: 'Synchronisé',
  pending: 'En attente',
  error: 'Erreur réseau',
};

export default function PendingOrdersView({ syncState, pendingCount, onForceSync, onGoBack }: PendingOrdersViewProps) {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getUnsyncedOrders();
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setOrders(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, pendingCount, syncState]);

  const handleDelete = useCallback(async (id: string) => {
    const ok = window.confirm('Supprimer cette commande sans la synchroniser ?');
    if (!ok) return;
    await deletePendingOrder(id);
    await refresh();
  }, [refresh]);

  const stateLabel = SYNC_STATE_LABEL[syncState] || syncState;
  const stateClass =
    syncState === 'offline'
      ? 'offline'
      : syncState === 'syncing'
        ? 'syncing'
        : syncState === 'error' || syncState === 'pending'
          ? 'pending'
          : 'online';

  return (
    <section className="pending-orders-view">
      <header className="pending-orders-header">
        <button type="button" className="btn-back pending-orders-back" onClick={onGoBack}>← Retour</button>
        <h2 className="pending-orders-title">Commandes en attente</h2>
        <div className="pending-orders-status">
          <span className={`pending-orders-dot ${stateClass}`} aria-hidden="true" />
          <span className="pending-orders-status-label">{stateLabel}</span>
          <span className="pending-orders-counter">{pendingCount} en attente</span>
        </div>
        <div className="pending-orders-actions">
          <button type="button" className="pending-orders-btn primary" onClick={onForceSync}>
            Réessayer maintenant
          </button>
          <button type="button" className="pending-orders-btn" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Chargement…' : 'Rafraîchir'}
          </button>
        </div>
      </header>

      {orders.length === 0 ? (
        <div className="pending-orders-empty">
          <span className="pending-orders-empty-icon" aria-hidden="true">✓</span>
          <span>Aucune commande en attente</span>
        </div>
      ) : (
        <ul className="pending-orders-list">
          {orders.map(o => (
            <li key={o.id} className="pending-orders-card">
              <div className="pending-orders-card-head">
                <span className="pending-orders-card-total">{o.total.toFixed(2)} €</span>
                <span className="pending-orders-card-date">{new Date(o.createdAt).toLocaleString()}</span>
              </div>
              <div className="pending-orders-card-meta">
                <span>{o.lines.length} ligne{o.lines.length > 1 ? 's' : ''}</span>
                <span>Tentatives : {o.retries ?? 0}</span>
              </div>
              {o.lastError && (
                <div className="pending-orders-card-error">Erreur : {o.lastError}</div>
              )}
              {o.lastAttemptAt && (
                <div className="pending-orders-card-attempt">
                  Dernière tentative : {new Date(o.lastAttemptAt).toLocaleString()}
                </div>
              )}
              <div className="pending-orders-card-actions">
                <button
                  type="button"
                  className="pending-orders-btn danger"
                  onClick={() => void handleDelete(o.id)}
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
