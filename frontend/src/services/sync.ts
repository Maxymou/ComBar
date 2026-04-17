import { deleteSyncedOrders, getUnsyncedOrders, markOrdersSynced, recordSyncAttempt } from './db';
import { syncOrders } from './api';

export interface SyncReport {
  attempted: number;
  synced: number;
  remaining: number;
}

interface TrySyncOptions {
  force?: boolean;
  maxAutoRetries?: number;
}

let syncing = false;

export async function trySyncOrders(options: TrySyncOptions = {}): Promise<SyncReport> {
  if (syncing) {
    const remaining = (await getUnsyncedOrders()).length;
    return { attempted: 0, synced: 0, remaining };
  }

  const { force = false, maxAutoRetries = 10 } = options;
  syncing = true;

  try {
    const unsynced = await getUnsyncedOrders();
    const candidates = force ? unsynced : unsynced.filter(order => (order.retries ?? 0) < maxAutoRetries);

    if (candidates.length === 0) {
      return { attempted: 0, synced: 0, remaining: unsynced.length };
    }

    const now = new Date().toISOString();
    const result = await syncOrders(candidates);
    const successIds: string[] = [];

    await Promise.all(
      result.synced.map(async item => {
        const orderId = candidates[item.index]?.id;
        if (!orderId) return;

        if (!item.error) {
          successIds.push(orderId);
          await recordSyncAttempt(orderId, { lastAttemptAt: now, lastError: undefined });
          return;
        }

        const target = candidates[item.index];
        await recordSyncAttempt(orderId, {
          retries: (target.retries ?? 0) + 1,
          lastAttemptAt: now,
          lastError: item.error,
        });
      }),
    );

    if (successIds.length > 0) {
      await markOrdersSynced(successIds);
      await deleteSyncedOrders();
    }

    const remaining = (await getUnsyncedOrders()).length;
    return { attempted: candidates.length, synced: successIds.length, remaining };
  } catch {
    const now = new Date().toISOString();
    const unsynced = await getUnsyncedOrders();
    const targets = force ? unsynced : unsynced.filter(order => (order.retries ?? 0) < maxAutoRetries);

    await Promise.all(
      targets.map(order => recordSyncAttempt(order.id, {
        retries: (order.retries ?? 0) + 1,
        lastAttemptAt: now,
        lastError: 'network_error',
      })),
    );

    return {
      attempted: targets.length,
      synced: 0,
      remaining: unsynced.length,
    };
  } finally {
    syncing = false;
  }
}
