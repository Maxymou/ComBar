import { Product, PendingOrder, RealtimeState } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/api/products`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchRealtimeState(): Promise<RealtimeState> {
  const res = await fetch(`${API_BASE}/api/realtime/state`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function updateRealtimePrices(prices: Record<string, number>): Promise<void> {
  const res = await fetch(`${API_BASE}/api/realtime/prices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prices }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function updateRealtimeHappyHour(happyHour: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/api/realtime/happy-hour`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ happyHour }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function syncOrders(orders: PendingOrder[]): Promise<{ synced: { index: number; id?: number; error?: string }[] }> {
  const payload = orders.map(o => ({
    clientOrderId: o.id,
    clientId: o.clientId,
    total: o.total,
    isHappyHour: o.isHappyHour,
    paymentGiven: o.paymentGiven,
    paymentChange: o.paymentChange,
    lines: o.lines.map(l => ({
      productId: l.productId,
      productName: l.productName,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      subtotal: l.subtotal,
      isBonus: l.isBonus,
    })),
    syncedFromOffline: true,
  }));

  const res = await fetch(`${API_BASE}/api/orders/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function submitOrder(order: PendingOrder): Promise<{ id: number }> {
  const res = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientOrderId: order.id,
      clientId: order.clientId,
      total: order.total,
      isHappyHour: order.isHappyHour,
      paymentGiven: order.paymentGiven,
      paymentChange: order.paymentChange,
      lines: order.lines.map(l => ({
        productId: l.productId,
        productName: l.productName,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        subtotal: l.subtotal,
        isBonus: l.isBonus,
      })),
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}


export async function sendPresenceHeartbeat(deviceId: string, deviceName: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/realtime/presence/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, deviceName }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function renameTerminal(deviceId: string, deviceName: string): Promise<{ ok: true; deviceName: string }> {
  const res = await fetch(`${API_BASE}/api/realtime/presence/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, deviceName }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
