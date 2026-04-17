import { deleteSyncedOrders, getUnsyncedOrders, markOrdersSynced, recordSyncAttempt } from './db';
import {
  syncOrders,
  updateRealtimeHappyHour,
  updateRealtimePrices,
} from './api';
import { PresenceDevice, RealtimeState } from '../types';

const REALTIME_QUEUE_KEY = 'combar.realtime.queue';

export interface SyncReport {
  attempted: number;
  synced: number;
  remaining: number;
}

interface TrySyncOptions {
  force?: boolean;
  maxAutoRetries?: number;
}

export interface QueuedRealtimeAction {
  type: 'updatePrices' | 'toggleHappyHour';
  payload: Record<string, number> | boolean;
  queuedAt: string;
  retries: number;
}

export interface RealtimeStreamHandlers {
  onStateUpdate: (state: Partial<RealtimeState>) => void;
  onPresenceUpdate?: (devices: PresenceDevice[]) => void;
}

export interface RealtimeIdentity {
  deviceId: string;
  deviceName: string;
}

let syncing = false;

function readRealtimeQueue(): QueuedRealtimeAction[] {
  try {
    const raw = localStorage.getItem(REALTIME_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is QueuedRealtimeAction => (
      item &&
      (item.type === 'updatePrices' || item.type === 'toggleHappyHour') &&
      typeof item.queuedAt === 'string'
    ));
  } catch {
    return [];
  }
}

function writeRealtimeQueue(queue: QueuedRealtimeAction[]): void {
  localStorage.setItem(REALTIME_QUEUE_KEY, JSON.stringify(queue));
}

export function shouldApplyIncomingState(
  currentState: Partial<RealtimeState> | null,
  incomingState: Partial<RealtimeState>,
): boolean {
  if (!incomingState.updatedAt && typeof incomingState.version !== 'number') {
    return true;
  }

  if (!currentState) {
    return true;
  }

  const currentUpdatedAt = currentState.updatedAt ? new Date(currentState.updatedAt).getTime() : 0;
  const incomingUpdatedAt = incomingState.updatedAt ? new Date(incomingState.updatedAt).getTime() : 0;

  if (incomingUpdatedAt > currentUpdatedAt) {
    return true;
  }

  if (incomingUpdatedAt < currentUpdatedAt) {
    return false;
  }

  const currentVersion = typeof currentState.version === 'number' ? currentState.version : 0;
  const incomingVersion = typeof incomingState.version === 'number' ? incomingState.version : 0;

  return incomingVersion >= currentVersion;
}

export function enqueueRealtimeChange(action: Omit<QueuedRealtimeAction, 'queuedAt' | 'retries'>): QueuedRealtimeAction[] {
  const queue = readRealtimeQueue();
  const nextAction: QueuedRealtimeAction = {
    ...action,
    queuedAt: new Date().toISOString(),
    retries: 0,
  };

  if (nextAction.type === 'updatePrices') {
    const deduped = queue.filter(item => item.type !== 'updatePrices');
    deduped.push(nextAction);
    writeRealtimeQueue(deduped);
    return deduped;
  }

  const nextQueue = [...queue, nextAction];
  writeRealtimeQueue(nextQueue);
  return nextQueue;
}

export async function flushQueuedRealtimeChanges(maxRetries = 5): Promise<{ sent: number; pending: number }> {
  const queue = readRealtimeQueue();
  if (queue.length === 0) {
    return { sent: 0, pending: 0 };
  }

  let sent = 0;
  const stillPending: QueuedRealtimeAction[] = [];

  for (const action of queue) {
    if (action.retries >= maxRetries) {
      stillPending.push(action);
      continue;
    }

    try {
      if (action.type === 'updatePrices') {
        await updateRealtimePrices(action.payload as Record<string, number>);
      } else {
        await updateRealtimeHappyHour(Boolean(action.payload));
      }
      sent += 1;
    } catch {
      stillPending.push({ ...action, retries: action.retries + 1 });
    }
  }

  writeRealtimeQueue(stillPending);
  return { sent, pending: stillPending.length };
}

export function connectRealtimeStream(
  identity: RealtimeIdentity,
  handlers: RealtimeStreamHandlers,
): () => void {
  let eventSource: EventSource | null = null;
  let reconnectTimer: number | null = null;
  let attempts = 0;
  let stopped = false;

  const connect = () => {
    if (stopped) return;

    const params = new URLSearchParams({
      deviceId: identity.deviceId,
      deviceName: identity.deviceName,
    });

    const source = new EventSource(`/api/realtime/stream?${params.toString()}`);
    eventSource = source;

    const onState = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as Partial<RealtimeState>;
        handlers.onStateUpdate(payload);
      } catch {
        // Ignore malformed event payload.
      }
    };

    const onPresence = (event: MessageEvent<string>) => {
      if (!handlers.onPresenceUpdate) return;
      try {
        const payload = JSON.parse(event.data) as PresenceDevice[];
        handlers.onPresenceUpdate(payload);
      } catch {
        // Ignore malformed event payload.
      }
    };

    source.addEventListener('STATE_UPDATE', onState as EventListener);
    source.addEventListener('state', onState as EventListener); // backward compatibility
    source.addEventListener('PRESENCE_UPDATE', onPresence as EventListener);

    source.onerror = () => {
      source.close();
      attempts += 1;
      const backoffMs = Math.min(5000, 400 * 2 ** attempts);

      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      reconnectTimer = window.setTimeout(() => {
        connect();
      }, backoffMs);
    };

    source.onopen = () => {
      attempts = 0;
    };
  };

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}

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
