import { useCallback, useEffect, useRef, useState } from 'react';
import { PresenceDevice, Product, RealtimeState } from '../types';
import {
  fetchRealtimeState,
  renameTerminal,
  sendPresenceHeartbeat,
} from '../services/api';
import {
  connectRealtimeStream,
  enqueueRealtimeChange,
  flushQueuedRealtimeChanges,
  shouldApplyIncomingState,
} from '../services/sync';
import { useDeviceIdentity } from './useDeviceIdentity';

const REALTIME_STATE_KEY = 'combar.realtime.state';
const HEARTBEAT_INTERVAL_MS = 25000;

function readCachedRealtimeState(): Partial<RealtimeState> | null {
  try {
    const raw = localStorage.getItem(REALTIME_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RealtimeState>;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistRealtimeState(state: Partial<RealtimeState>): void {
  localStorage.setItem(REALTIME_STATE_KEY, JSON.stringify(state));
}

export function initPrices(products: Product[]): Record<string, number> {
  const p: Record<string, number> = {};
  products.forEach(i => {
    p[`${i.id}_normal`] = i.normalPrice;
    p[`${i.id}_hh`] = i.hhPrice;
  });
  return p;
}

interface UseRealtimeStateOptions {
  products: Product[];
  isOnline: boolean;
  lastSyncAt: string | null;
  onHappyHourChanged?: () => void;
}

export interface UseRealtimeStateResult {
  prices: Record<string, number>;
  isHH: boolean;
  onlineUsers: number;
  connectedDevices: PresenceDevice[];
  recentlyActiveDevices: PresenceDevice[];
  identity: { deviceId: string; deviceName: string };
  setPrices: (next: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  setIsHH: (value: boolean) => void;
  setConnectedDevices: React.Dispatch<React.SetStateAction<PresenceDevice[]>>;
  sendOrQueuePricesUpdate: (nextPrices: Record<string, number>) => Promise<void>;
  sendOrQueueHappyHourUpdate: (next: boolean) => Promise<void>;
  handleRenameTerminal: (nextName: string) => Promise<void>;
}

export function useRealtimeState({ products, isOnline, lastSyncAt, onHappyHourChanged }: UseRealtimeStateOptions): UseRealtimeStateResult {
  const [prices, setPrices] = useState<Record<string, number>>(() => initPrices(products));
  const [isHH, setIsHHRaw] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [connectedDevices, setConnectedDevices] = useState<PresenceDevice[]>([]);
  const [recentlyActiveDevices, setRecentlyActiveDevices] = useState<PresenceDevice[]>([]);

  const lastAppliedStateRef = useRef<Partial<RealtimeState> | null>(readCachedRealtimeState());
  const heartbeatTimerRef = useRef<number | null>(null);
  const onHHChangedRef = useRef(onHappyHourChanged);
  onHHChangedRef.current = onHappyHourChanged;

  const { identity, updateDeviceName } = useDeviceIdentity();

  const setIsHH = useCallback((value: boolean) => {
    setIsHHRaw(prev => {
      if (prev !== value) onHHChangedRef.current?.();
      return value;
    });
  }, []);

  const applyRealtimeState = useCallback((newState: Partial<RealtimeState>) => {
    if (!shouldApplyIncomingState(lastAppliedStateRef.current, newState)) {
      return;
    }

    if (newState.prices && typeof newState.prices === 'object') {
      setPrices(prev => ({ ...prev, ...newState.prices }));
    }

    if (typeof newState.happyHour === 'boolean') {
      setIsHH(newState.happyHour);
    }

    const nextClientsCount =
      typeof newState.clientsCount === 'number'
        ? newState.clientsCount
        : typeof newState.clients === 'number'
          ? newState.clients
          : undefined;
    if (typeof nextClientsCount === 'number') {
      setOnlineUsers(nextClientsCount);
    }

    if (newState.presence) {
      if (Array.isArray(newState.presence.connected)) {
        setConnectedDevices(newState.presence.connected);
      }
      if (Array.isArray(newState.presence.recentlyActive)) {
        setRecentlyActiveDevices(newState.presence.recentlyActive);
      }
      if (typeof newState.presence.connectedCount === 'number') {
        setOnlineUsers(newState.presence.connectedCount);
      }
    } else if (Array.isArray(newState.connectedDevices)) {
      setConnectedDevices(newState.connectedDevices);
    }

    lastAppliedStateRef.current = {
      ...lastAppliedStateRef.current,
      ...newState,
    };
    persistRealtimeState(lastAppliedStateRef.current);
  }, [setIsHH]);

  // Hydrate from cache on mount / when products list changes (defaults).
  useEffect(() => {
    const defaults = initPrices(products);
    const cached = readCachedRealtimeState();

    if (cached) {
      setPrices({ ...defaults, ...(cached.prices || {}) });
      setIsHHRaw(Boolean(cached.happyHour));
      const cachedClientsCount =
        typeof cached.clientsCount === 'number'
          ? cached.clientsCount
          : typeof cached.clients === 'number'
            ? cached.clients
            : 0;
      setOnlineUsers(cachedClientsCount);
      setConnectedDevices(Array.isArray(cached.connectedDevices) ? cached.connectedDevices : []);
      setRecentlyActiveDevices(Array.isArray(cached.presence?.recentlyActive) ? cached.presence.recentlyActive : []);
    } else {
      setPrices(defaults);
    }
  }, [products]);

  // On reconnect, fetch latest state and flush any queued changes.
  useEffect(() => {
    if (!isOnline) return;
    fetchRealtimeState().then(applyRealtimeState).catch(() => undefined);
    void flushQueuedRealtimeChanges();
  }, [isOnline, applyRealtimeState]);

  // After a successful order sync, refresh realtime state.
  useEffect(() => {
    if (!isOnline || !lastSyncAt) return;
    fetchRealtimeState().then(applyRealtimeState).catch(() => undefined);
  }, [isOnline, lastSyncAt, applyRealtimeState]);

  // SSE subscription + heartbeat.
  useEffect(() => {
    if (!isOnline) {
      if (heartbeatTimerRef.current) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      return;
    }

    const disconnect = connectRealtimeStream(identity, {
      onStateUpdate: applyRealtimeState,
      onPresenceUpdate: devices => {
        applyRealtimeState({
          connectedDevices: devices,
          clients: devices.length,
          clientsCount: devices.length,
          presence: {
            connectedCount: devices.length,
            connected: devices,
            recentlyActive: [],
          },
        });
      },
    });

    const sendHeartbeat = () => {
      void sendPresenceHeartbeat(identity.deviceId, identity.deviceName).catch(() => undefined);
    };
    sendHeartbeat();
    heartbeatTimerRef.current = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      disconnect();
      if (heartbeatTimerRef.current) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [applyRealtimeState, identity, isOnline]);

  const sendOrQueuePricesUpdate = useCallback(async (nextPrices: Record<string, number>) => {
    persistRealtimeState({
      prices: nextPrices,
      happyHour: isHH,
      clients: onlineUsers,
      clientsCount: onlineUsers,
      connectedDevices,
    });
    enqueueRealtimeChange({ type: 'updatePrices', payload: nextPrices });
    if (isOnline) {
      await flushQueuedRealtimeChanges();
    }
  }, [connectedDevices, isHH, isOnline, onlineUsers]);

  const sendOrQueueHappyHourUpdate = useCallback(async (nextHappyHour: boolean) => {
    persistRealtimeState({
      prices,
      happyHour: nextHappyHour,
      clients: onlineUsers,
      clientsCount: onlineUsers,
      connectedDevices,
    });
    enqueueRealtimeChange({ type: 'toggleHappyHour', payload: nextHappyHour });
    if (isOnline) {
      await flushQueuedRealtimeChanges();
    }
  }, [connectedDevices, isOnline, onlineUsers, prices]);

  const handleRenameTerminal = useCallback(async (nextName: string) => {
    const nextIdentity = updateDeviceName(nextName);
    setConnectedDevices(prev => prev.map(device => (
      device.deviceId === nextIdentity.deviceId
        ? { ...device, deviceName: nextIdentity.deviceName }
        : device
    )));

    if (!isOnline) return;

    try {
      await renameTerminal(nextIdentity.deviceId, nextIdentity.deviceName);
      await sendPresenceHeartbeat(nextIdentity.deviceId, nextIdentity.deviceName);
      const latestState = await fetchRealtimeState();
      applyRealtimeState(latestState);
    } catch {
      // Local rename stays persisted; server will catch up later.
    }
  }, [applyRealtimeState, isOnline, updateDeviceName]);

  return {
    prices,
    isHH,
    onlineUsers,
    connectedDevices,
    recentlyActiveDevices,
    identity,
    setPrices,
    setIsHH: setIsHHRaw,
    setConnectedDevices,
    sendOrQueuePricesUpdate,
    sendOrQueueHappyHourUpdate,
    handleRenameTerminal,
  };
}
