import { getUnsyncedOrders, markOrdersSynced, deleteSyncedOrders } from './db';
import { syncOrders } from './api';

let syncing = false;

export async function trySyncOrders(): Promise<number> {
  if (syncing) return 0;
  syncing = true;

  try {
    const unsynced = await getUnsyncedOrders();
    if (unsynced.length === 0) return 0;

    const result = await syncOrders(unsynced);
    const successIds = result.synced
      .filter(r => r.id !== undefined)
      .map(r => unsynced[r.index].id);

    if (successIds.length > 0) {
      await markOrdersSynced(successIds);
      // Clean up synced orders from IndexedDB
      await deleteSyncedOrders();
    }

    return successIds.length;
  } catch {
    // Network error — will retry later
    return 0;
  } finally {
    syncing = false;
  }
}
