import { useState, useEffect, useCallback } from 'react';
import { trySyncOrders } from '../services/sync';
import { getUnsyncedOrders } from '../services/db';

export type SyncState = 'offline' | 'syncing' | 'synced' | 'pending' | 'error';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>(navigator.onLine ? 'synced' : 'offline');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const checkPending = useCallback(async () => {
    const unsynced = await getUnsyncedOrders();
    setPendingCount(unsynced.length);
    if (!navigator.onLine) {
      setSyncState('offline');
    } else if (unsynced.length > 0) {
      setSyncState('pending');
    } else {
      setSyncState('synced');
    }
    return unsynced.length;
  }, []);

  const doSync = useCallback(async (force = false) => {
    if (!navigator.onLine) {
      setSyncState('offline');
      return;
    }

    setSyncState('syncing');
    const report = await trySyncOrders({
      force,
      maxAutoRetries: Number(import.meta.env.VITE_SYNC_MAX_AUTO_RETRIES || '10'),
    });
    const remaining = await checkPending();

    if (report.synced > 0) {
      setLastSyncAt(new Date().toISOString());
    }

    if (report.attempted > 0 && report.synced === 0 && remaining > 0) {
      setSyncState('error');
      return;
    }

    setSyncState(remaining > 0 ? 'pending' : 'synced');
  }, [checkPending]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void doSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncState('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const intervalMs = Number(import.meta.env.VITE_SYNC_INTERVAL_MS || '30000');
    const interval = window.setInterval(() => {
      if (navigator.onLine) {
        void doSync();
      }
    }, intervalMs);

    void checkPending();
    if (navigator.onLine) {
      void doSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(interval);
    };
  }, [doSync, checkPending]);

  return {
    isOnline,
    pendingCount,
    syncState,
    lastSyncAt,
    refreshPending: checkPending,
    forceSync: () => doSync(true),
  };
}
