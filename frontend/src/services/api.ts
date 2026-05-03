import { Product, PendingOrder, RealtimeState, Category, ProductManagementPayload } from '../types';

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


export async function fetchAllProductsForManagement(): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/api/products/manage`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/api/categories`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function createProduct(payload: ProductManagementPayload): Promise<Product> {
  const res = await fetch(`${API_BASE}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function updateProduct(id: string, payload: ProductManagementPayload): Promise<Product> {
  const res = await fetch(`${API_BASE}/api/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/products/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}


export async function reorderProducts(items: { id: string; displayOrder: number }[]): Promise<void> {
  const res = await fetch(`${API_BASE}/api/products/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${body}`);
  }
}
