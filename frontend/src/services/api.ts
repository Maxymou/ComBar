import { Product, PendingOrder, RealtimeState, Category, ProductManagementPayload } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

const ALLOWED_PRODUCT_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const MAX_PRODUCT_IMAGE_DIMENSION = 512;
const MAX_PRODUCT_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

function normalizePngFileName(originalName: string): string {
  const trimmed = (originalName || 'product').trim();
  const nameWithoutExt = trimmed.replace(/\.[^/.]+$/u, '') || 'product';
  return `${nameWithoutExt}.png`;
}

async function loadImageForConversion(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Impossible de lire l'image sélectionnée."));
      image.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function convertProductImageToPng(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Le fichier sélectionné n’est pas une image.');
  }
  if (file.type && !ALLOWED_PRODUCT_IMAGE_TYPES.has(file.type)) {
    throw new Error('Format non supporté. Utilisez PNG, JPEG/JPG ou WebP.');
  }

  let sourceImage: ImageBitmap | HTMLImageElement;
  try {
    sourceImage = await loadImageForConversion(file);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Impossible de lire l'image.");
  }

  const width = sourceImage.width;
  const height = sourceImage.height;
  if (!width || !height) {
    throw new Error('Image invalide: dimensions introuvables.');
  }

  const canvas = document.createElement('canvas');
  const squareSize = Math.min(MAX_PRODUCT_IMAGE_DIMENSION, Math.max(width, height));
  canvas.width = squareSize;
  canvas.height = squareSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Conversion impossible: canvas indisponible.');
  }

  ctx.clearRect(0, 0, squareSize, squareSize);
  const scale = Math.min(squareSize / width, squareSize / height);
  const drawWidth = Math.round(width * scale);
  const drawHeight = Math.round(height * scale);
  const offsetX = Math.round((squareSize - drawWidth) / 2);
  const offsetY = Math.round((squareSize - drawHeight) / 2);
  ctx.drawImage(sourceImage, offsetX, offsetY, drawWidth, drawHeight);

  if ('close' in sourceImage && typeof sourceImage.close === 'function') {
    sourceImage.close();
  }

  const pngBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });

  if (!pngBlob) {
    throw new Error('Conversion impossible: export PNG échoué.');
  }
  if (pngBlob.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
    throw new Error('Le PNG converti est trop lourd. Essayez une image plus petite.');
  }

  return pngBlob;
}


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

export async function uploadProductImage(file: File): Promise<string> {
  const pngBlob = await convertProductImageToPng(file);
  const safeFileName = normalizePngFileName(file.name);

  const res = await fetch(`${API_BASE}/api/products/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      'X-File-Name': safeFileName,
    },
    body: pngBlob,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  const body = await res.json() as { url: string };
  return body.url;
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

export type DebugUpdateMode = 'normal' | 'force-pwa';

export interface DebugHealthResponse {
  ok: boolean;
  timestamp: string;
  uptime: number;
  nodeVersion: string;
  env: string;
  cwd: string;
  db: 'connected' | 'disconnected';
  dbError?: string;
  hostApi?: {
    available: boolean;
    url: string;
    status?: unknown;
    error?: string;
  };
}

export interface DebugUpdateResponse {
  ok: boolean;
  mode: DebugUpdateMode;
  startedAt: string;
  finishedAt: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
  steps?: Array<{
    cmd: string;
    args: string[];
    exitCode: number | null;
    stdout: string;
    stderr: string;
  }>;
}

function debugHeaders(): HeadersInit {
  const token = import.meta.env.VITE_DEBUG_ADMIN_TOKEN;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['X-Debug-Token'] = String(token);
  }
  return headers;
}

export async function getDebugHealth(): Promise<DebugHealthResponse> {
  const res = await fetch(`${API_BASE}/api/debug/health`, {
    method: 'GET',
    headers: debugHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${body}`);
  }
  return res.json();
}

export async function runDebugUpdate(mode: DebugUpdateMode): Promise<DebugUpdateResponse> {
  const res = await fetch(`${API_BASE}/api/debug/update`, {
    method: 'POST',
    headers: debugHeaders(),
    body: JSON.stringify({ mode }),
  });
  const text = await res.text();
  let parsed: DebugUpdateResponse | null = null;
  try {
    parsed = text ? (JSON.parse(text) as DebugUpdateResponse) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    if (parsed) {
      return parsed;
    }
    const lowered = text.toLowerCase();
    const isHtml = lowered.includes('<html') || lowered.includes('<!doctype html') || lowered.includes('nginx');
    throw new Error(isHtml ? `HTTP ${res.status} passerelle indisponible` : `HTTP ${res.status} ${text}`);
  }
  if (!parsed) {
    throw new Error('Réponse invalide du serveur');
  }
  return parsed;
}
