import { useCallback, useEffect, useState } from 'react';
import { PendingOrder } from '../types';
import { deletePendingOrder, getUnsyncedOrders } from '../services/db';

interface PendingOrdersViewProps {
  syncState: string;
  pendingCount: number;
  onForceSync: () => void;
  onGoBack: () => void;
}

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

  const handleRetry = useCallback(() => {
    onForceSync();
  }, [onForceSync]);

  return (
    <div className="pending-orders-view">
      <div className="pending-orders-header">
        <button type="button" className="placeholder-back-btn" onClick={onGoBack}>
          ← Retour
        </button>
        <div className="pending-orders-title">Commandes en attente</div>
        <div className="pending-orders-meta">
          État : <strong>{syncState}</strong> · {pendingCount} en attente
        </div>
        <div className="pending-orders-actions">
          <button type="button" onClick={handleRetry}>Réessayer maintenant</button>
          <button type="button" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Chargement…' : 'Rafraîchir'}
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="pending-orders-empty">Aucune commande en attente.</div>
      ) : (
        <ul className="pending-orders-list">
          {orders.map(o => (
            <li key={o.id} className="pending-orders-item">
              <div className="pending-orders-item-row">
                <span className="pending-orders-item-total">{o.total.toFixed(2)} €</span>
                <span className="pending-orders-item-date">{new Date(o.createdAt).toLocaleString()}</span>
              </div>
              <div className="pending-orders-item-row">
                <span>{o.lines.length} ligne(s)</span>
                <span>Tentatives : {o.retries ?? 0}</span>
              </div>
              {o.lastError && (
                <div className="pending-orders-item-error">
                  Erreur : {o.lastError}
                </div>
              )}
              {o.lastAttemptAt && (
                <div className="pending-orders-item-attempt">
                  Dernière tentative : {new Date(o.lastAttemptAt).toLocaleString()}
                </div>
              )}
              <div className="pending-orders-item-actions">
                <button type="button" onClick={() => void handleDelete(o.id)}>
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
