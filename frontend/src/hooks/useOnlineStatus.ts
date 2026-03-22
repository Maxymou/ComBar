import { useState, useEffect, useCallback } from 'react';
import { trySyncOrders } from '../services/sync';
import { getUnsyncedOrders } from '../services/db';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncCount, setLastSyncCount] = useState(0);

  const checkPending = useCallback(async () => {
    const unsynced = await getUnsyncedOrders();
    setPendingCount(unsynced.length);
  }, []);

  const doSync = useCallback(async () => {
    const synced = await trySyncOrders();
    if (synced > 0) {
      setLastSyncCount(synced);
      await checkPending();
    }
  }, [checkPending]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      doSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic sync every 30s when online
    const interval = setInterval(() => {
      if (navigator.onLine) doSync();
    }, 30000);

    // Initial check
    checkPending();
    if (navigator.onLine) doSync();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [doSync, checkPending]);

  return { isOnline, pendingCount, lastSyncCount, refreshPending: checkPending };
}
