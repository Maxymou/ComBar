import { Product, PendingOrder } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/api/products`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function syncOrders(orders: PendingOrder[]): Promise<{ synced: { index: number; id?: number; error?: string }[] }> {
  const payload = orders.map(o => ({
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
