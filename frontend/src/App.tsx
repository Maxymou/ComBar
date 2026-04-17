import { useState, useCallback, useEffect, useRef } from 'react';
import { Screen, OrderLine, PendingOrder, Product, RealtimeState, PresenceDevice } from './types';
import { useProducts } from './hooks/useProducts';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { savePendingOrder, getSetting, markOrdersSynced } from './services/db';
import {
  submitOrder,
  updateRealtimeHappyHour,
  updateRealtimePrices,
  fetchRealtimeState,
  renameTerminal,
  sendPresenceHeartbeat,
} from './services/api';
import { DENOMINATIONS } from './data/denominations';
import Header from './components/Header';
import ProductGrid from './components/ProductGrid';
import Summary from './components/Summary';
import Payment from './components/Payment';
import PriceEditor from './components/PriceEditor';
import { isDebugViewportEnabled } from './debug';
import { useDeviceIdentity } from './hooks/useDeviceIdentity';
import './App.css';

const REALTIME_STATE_KEY = 'combar.realtime.state';
const REALTIME_QUEUE_KEY = 'combar.realtime.queue';

interface QueuedRealtimeAction {
  type: 'updatePrices' | 'toggleHappyHour';
  payload: Record<string, number> | boolean;
}
function initPrices(products: Product[]): Record<string, number> {
  const p: Record<string, number> = {};
  products.forEach(i => {
    p[`${i.id}_normal`] = i.normalPrice;
    p[`${i.id}_hh`] = i.hhPrice;
  });
  return p;
}

function getPrice(item: Product, isHH: boolean, prices: Record<string, number>): number {
  const key = `${item.id}_${isHH ? 'hh' : 'normal'}`;
  return prices[key] ?? (isHH ? item.hhPrice : item.normalPrice);
}

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

function readActionQueue(): QueuedRealtimeAction[] {
  try {
    const raw = localStorage.getItem(REALTIME_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (action): action is QueuedRealtimeAction =>
        action &&
        (action.type === 'updatePrices' || action.type === 'toggleHappyHour')
    );
  } catch {
    return [];
  }
}

function persistActionQueue(queue: QueuedRealtimeAction[]): void {
  localStorage.setItem(REALTIME_QUEUE_KEY, JSON.stringify(queue));
}

export default function App() {
  const viewportDebug = isDebugViewportEnabled();
  const { products } = useProducts();
  const { isOnline, pendingCount, refreshPending } = useOnlineStatus();

  const [isHH, setIsHH] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [connectedDevices, setConnectedDevices] = useState<PresenceDevice[]>([]);
  const [recentlyActiveDevices, setRecentlyActiveDevices] = useState<PresenceDevice[]>([]);
  const [order, setOrder] = useState<Record<string, number>>({});
  const [screen, setScreen] = useState<Screen>('select');
  const [checked, setChecked] = useState<Record<string, number>>({});
  const [given, setGiven] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<string, number>>(() => initPrices(products));
  const [confirmFeedback, setConfirmFeedback] = useState(false);
  const [adminPin, setAdminPin] = useState('0000');

  const actionQueueRef = useRef<QueuedRealtimeAction[]>(readActionQueue());
  const eventSourceRef = useRef<EventSource | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const { identity, updateDeviceName } = useDeviceIdentity();

  const buildVersion = import.meta.env.VITE_APP_VERSION || 'dev';
  const buildTimestamp = import.meta.env.VITE_BUILD_TIMESTAMP || 'unknown';
  const pwaEnabled =
    import.meta.env.VITE_ENABLE_PWA === undefined
      ? import.meta.env.PROD
      : import.meta.env.VITE_ENABLE_PWA === 'true';

  const reset = useCallback(() => {
    setOrder({});
    setChecked({});
    setGiven({});
    setScreen('select');
  }, []);

  const applyRealtimeState = useCallback((newState: Partial<RealtimeState>) => {
    if (newState.prices && typeof newState.prices === 'object') {
      setPrices(prev => ({ ...prev, ...newState.prices }));
    }

    if (typeof newState.happyHour === 'boolean') {
      const nextHappyHour = newState.happyHour;
      setIsHH(prev => {
        if (prev !== nextHappyHour) {
          setOrder({});
          setChecked({});
          setGiven({});
          setScreen('select');
        }
        return nextHappyHour;
      });
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

    persistRealtimeState(newState);
  }, []);

  const enqueueAction = useCallback((action: QueuedRealtimeAction) => {
    const queue = actionQueueRef.current;

    if (action.type === 'updatePrices') {
      const next = queue.filter(item => item.type !== 'updatePrices');
      next.push(action);
      actionQueueRef.current = next;
      persistActionQueue(next);
      return;
    }

    const next = [...queue, action];
    actionQueueRef.current = next;
    persistActionQueue(next);
  }, []);

  const flushQueuedActions = useCallback(async () => {
    if (!isOnline || actionQueueRef.current.length === 0) return;

    const queue = [...actionQueueRef.current];

    for (const action of queue) {
      try {
        if (action.type === 'updatePrices') {
          await updateRealtimePrices(action.payload as Record<string, number>);
        } else {
          await updateRealtimeHappyHour(Boolean(action.payload));
        }
      } catch {
        return;
      }
    }

    actionQueueRef.current = [];
    persistActionQueue([]);
  }, [isOnline]);

  // Load admin PIN once.
  useEffect(() => {
    getSetting<string>('adminPin').then(pin => {
      if (pin) setAdminPin(pin);
    });
  }, []);

  // Initialize local state from defaults + cache (or legacy IndexedDB setting fallback).
  useEffect(() => {
    let cancelled = false;

    async function hydrateLocalState() {
      const defaults = initPrices(products);
      const cachedState = readCachedRealtimeState();

      if (cachedState) {
        if (!cancelled) {
          setPrices({ ...defaults, ...(cachedState.prices || {}) });
          setIsHH(Boolean(cachedState.happyHour));
          const cachedClientsCount =
            typeof cachedState.clientsCount === 'number'
              ? cachedState.clientsCount
              : typeof cachedState.clients === 'number'
                ? cachedState.clients
                : 0;
          setOnlineUsers(cachedClientsCount);
          setConnectedDevices(Array.isArray(cachedState.connectedDevices) ? cachedState.connectedDevices : []);
          setRecentlyActiveDevices(Array.isArray(cachedState.presence?.recentlyActive) ? cachedState.presence.recentlyActive : []);
        }
        return;
      }

      const legacyPrices = await getSetting<Record<string, number>>('customPrices');
      if (!cancelled) {
        setPrices({ ...defaults, ...(legacyPrices || {}) });
      }
    }

    hydrateLocalState();

    return () => {
      cancelled = true;
    };
  }, [products]);

  // Network reconnection: fetch latest realtime state + flush queued actions.
  useEffect(() => {
    if (!isOnline) return;

    fetchRealtimeState()
      .then(state => applyRealtimeState(state))
      .catch(() => {
        // Keep local cached state if fetch fails.
      });

    flushQueuedActions();
  }, [isOnline, applyRealtimeState, flushQueuedActions]);

  // Realtime stream subscription.
  useEffect(() => {
    if (!isOnline) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (heartbeatTimerRef.current) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      return;
    }

    const streamParams = new URLSearchParams({
      deviceId: identity.deviceId,
      deviceName: identity.deviceName,
    });
    const source = new EventSource(`/api/realtime/stream?${streamParams.toString()}`);
    eventSourceRef.current = source;

    const onState = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as Partial<RealtimeState>;
        applyRealtimeState(parsed);
      } catch {
        // Ignore malformed state payload
      }
    };

    const onClients = (event: MessageEvent<string>) => {
      const count = Number(event.data);
      if (!Number.isNaN(count)) {
        applyRealtimeState({ clients: count, clientsCount: count });
      }
    };

    source.addEventListener('state', onState as EventListener);
    source.addEventListener('clients', onClients as EventListener);

    const sendHeartbeat = () => {
      void sendPresenceHeartbeat(identity.deviceId, identity.deviceName).catch(() => undefined);
    };
    sendHeartbeat();
    heartbeatTimerRef.current = window.setInterval(sendHeartbeat, 25000);

    return () => {
      source.removeEventListener('state', onState as EventListener);
      source.removeEventListener('clients', onClients as EventListener);
      source.close();
      if (heartbeatTimerRef.current) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
      }
    };
  }, [applyRealtimeState, identity.deviceId, identity.deviceName, isOnline]);

  const sendOrQueuePricesUpdate = useCallback(async (nextPrices: Record<string, number>) => {
    persistRealtimeState({
      prices: nextPrices,
      happyHour: isHH,
      clients: onlineUsers,
      clientsCount: onlineUsers,
      connectedDevices,
    });

    if (isOnline) {
      try {
        await updateRealtimePrices(nextPrices);
        return;
      } catch {
        // Falls through to queue mode
      }
    }

    enqueueAction({ type: 'updatePrices', payload: nextPrices });
  }, [connectedDevices, enqueueAction, isHH, isOnline, onlineUsers]);

  const sendOrQueueHappyHourUpdate = useCallback(async (nextHappyHour: boolean) => {
    persistRealtimeState({
      prices,
      happyHour: nextHappyHour,
      clients: onlineUsers,
      clientsCount: onlineUsers,
      connectedDevices,
    });

    if (isOnline) {
      try {
        await updateRealtimeHappyHour(nextHappyHour);
        return;
      } catch {
        // Falls through to queue mode
      }
    }

    enqueueAction({ type: 'toggleHappyHour', payload: nextHappyHour });
  }, [connectedDevices, enqueueAction, isOnline, onlineUsers, prices]);

  const add = (id: string) => setOrder(p => ({ ...p, [id]: (p[id] || 0) + 1 }));
  const remove = (id: string) => setOrder(p => {
    const n = { ...p };
    if ((n[id] || 0) > 1) n[id]--;
    else delete n[id];
    return n;
  });

  const toggleHH = () => {
    const nextHappyHour = !isHH;
    setIsHH(nextHappyHour);
    void sendOrQueueHappyHourUpdate(nextHappyHour);
    setOrder({});
    setChecked({});
    setScreen('select');
  };

  const checkItem = (id: string, max: number) =>
    setChecked(p => { const cur = p[id] || 0; return cur >= max ? p : { ...p, [id]: cur + 1 }; });
  const uncheckItem = (id: string) =>
    setChecked(p => { const cur = p[id] || 0; return cur <= 0 ? p : { ...p, [id]: cur - 1 }; });

  const addGiven = (id: string) => setGiven(p => ({ ...p, [id]: (p[id] || 0) + 1 }));
  const removeGiven = (id: string) => setGiven(p => {
    const n = { ...p };
    if ((n[id] || 0) > 1) n[id]--;
    else delete n[id];
    return n;
  });

  const setPrice = useCallback((id: string, type: string, val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      setPrices(prev => {
        const updated = { ...prev, [`${id}_${type}`]: num };
        void sendOrQueuePricesUpdate(updated);
        return updated;
      });
    }
  }, [sendOrQueuePricesUpdate]);

  const resetPrices = useCallback(() => {
    const fresh = initPrices(products);
    setPrices(fresh);
    void sendOrQueuePricesUpdate(fresh);
  }, [products, sendOrQueuePricesUpdate]);

  // PIN-protected navigation to price editor
  const handleNavigatePrices = useCallback(() => {
    const input = window.prompt('Entrez le PIN admin :');
    if (input === adminPin) {
      setScreen('prices');
    } else if (input !== null) {
      window.alert('PIN incorrect');
    }
  }, [adminPin]);

  // Build order lines
  const bonusShooters = Object.entries(order)
    .filter(([id]) => isHH && products.find(i => i.id === id)?.hhBonus)
    .reduce((s, [, q]) => s + q, 0);

  const lines: OrderLine[] = products
    .filter(i => (order[i.id] || 0) > 0)
    .map(i => {
      const price = getPrice(i, isHH && i.category === 'drink', prices);
      const qty = order[i.id];
      return {
        productId: i.id,
        productName: i.name,
        icon: i.icon,
        quantity: qty,
        unitPrice: price,
        subtotal: price * qty,
        isBonus: false,
        category: i.category,
      };
    });

  if (bonusShooters > 0) {
    lines.push({
      productId: '_bonus',
      productName: 'Shooters offerts',
      icon: '🥃',
      quantity: bonusShooters,
      unitPrice: 0,
      subtotal: 0,
      isBonus: true,
      category: 'drink',
    });
  }

  const total = lines.reduce((s, l) => s + l.subtotal, 0);

  const handleConfirmPayment = useCallback(async () => {
    const totalGiven = DENOMINATIONS.reduce((s, m) => s + m.value * (given[m.id] || 0), 0);
    const change = Math.max(0, Math.round((totalGiven - total) * 100) / 100);

    const pendingOrder: PendingOrder = {
      id: crypto.randomUUID(),
      total,
      isHappyHour: isHH,
      paymentGiven: totalGiven,
      paymentChange: change,
      lines: lines.map(l => ({
        productId: l.productId,
        productName: l.productName,
        icon: l.icon,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        subtotal: l.subtotal,
        isBonus: l.isBonus,
        category: l.category,
      })),
      createdAt: new Date().toISOString(),
      synced: false,
    };

    // Save locally first (always)
    await savePendingOrder(pendingOrder);

    // Try to send to server if online
    if (navigator.onLine) {
      try {
        await submitOrder(pendingOrder);
        await markOrdersSynced([pendingOrder.id]);
      } catch {
        // Will sync later
      }
    }

    await refreshPending();

    // Show feedback then reset
    setConfirmFeedback(true);
    setTimeout(() => {
      setConfirmFeedback(false);
      reset();
    }, 1500);
  }, [given, total, isHH, lines, refreshPending, reset]);

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
      // Local rename stays persisted; server sync will catch up later.
    }
  }, [applyRealtimeState, isOnline, updateDeviceName]);

  if (confirmFeedback) {
    return (
      <div className={`app-shell${isHH ? ' hh' : ''}${viewportDebug ? ' viewport-debug-shell' : ''}`}>
        <div className={`app${isHH ? ' hh' : ''}${viewportDebug ? ' viewport-debug-app' : ''}`}>
          <div className="confirm-overlay">
            <div className="confirm-check">✓</div>
            <div className="confirm-text">Commande enregistrée</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell${isHH ? ' hh' : ''}${viewportDebug ? ' viewport-debug-shell' : ''}`}>
    <div className={`app${isHH ? ' hh' : ''}${viewportDebug ? ' viewport-debug-app' : ''}`}>
      <Header
        isHH={isHH}
        isOnline={isOnline}
        pendingCount={pendingCount}
        onlineUsers={onlineUsers}
        connectedDevices={connectedDevices}
        recentlyActiveDevices={recentlyActiveDevices}
        localDeviceName={identity.deviceName}
        onRenameTerminal={handleRenameTerminal}
        onToggleHH={toggleHH}
        onNavigatePrices={handleNavigatePrices}
        buildVersion={buildVersion}
        buildTimestamp={buildTimestamp}
        pwaEnabled={pwaEnabled}
      />

      <main className={`app-content${viewportDebug ? ' viewport-debug-content' : ''}`} data-screen={screen}>
        {screen === 'select' && (
          <ProductGrid
            products={products}
            order={order}
            isHH={isHH}
            prices={prices}
            onAdd={add}
            onRemove={remove}
            onValidate={() => setScreen('summary')}
            onCancel={() => setOrder({})}
          />
        )}

        {screen === 'summary' && (
          <Summary
            lines={lines}
            bonusShooters={bonusShooters}
            total={total}
            checked={checked}
            isHH={isHH}
            onCheckItem={checkItem}
            onUncheckItem={uncheckItem}
            onGoPayment={() => { setGiven({}); setScreen('monnaie'); }}
            onGoBack={() => setScreen('select')}
            onReset={reset}
          />
        )}

        {screen === 'monnaie' && (
          <Payment
            total={total}
            given={given}
            isHH={isHH}
            onAddGiven={addGiven}
            onRemoveGiven={removeGiven}
            onGoBack={() => setScreen('summary')}
            onConfirm={handleConfirmPayment}
          />
        )}

        {screen === 'prices' && (
          <PriceEditor
            products={products}
            prices={prices}
            isHH={isHH}
            onSetPrice={setPrice}
            onResetPrices={resetPrices}
            onGoBack={() => setScreen('select')}
          />
        )}
      </main>
    </div>
    </div>
  );
}
