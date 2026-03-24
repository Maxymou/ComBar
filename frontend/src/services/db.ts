import { openDB, IDBPDatabase } from 'idb';
import { Product, PendingOrder } from '../types';

const DB_NAME = 'combar';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pendingOrders')) {
        const store = db.createObjectStore('pendingOrders', { keyPath: 'id' });
        store.createIndex('synced', 'synced');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
  });
  return dbInstance;
}

// Products
export async function saveProducts(products: Product[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('products', 'readwrite');
  await tx.store.clear();
  for (const p of products) {
    await tx.store.put(p);
  }
  await tx.done;
}

export async function getLocalProducts(): Promise<Product[]> {
  const db = await getDb();
  return db.getAll('products');
}

// Pending Orders
export async function savePendingOrder(order: PendingOrder): Promise<void> {
  const db = await getDb();
  await db.put('pendingOrders', order);
}

export async function getUnsyncedOrders(): Promise<PendingOrder[]> {
  const db = await getDb();
  const all = await db.getAll('pendingOrders');
  return all.filter((o: PendingOrder) => !o.synced);
}

export async function markOrdersSynced(ids: string[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('pendingOrders', 'readwrite');
  for (const id of ids) {
    const order = await tx.store.get(id);
    if (order) {
      order.synced = true;
      await tx.store.put(order);
    }
  }
  await tx.done;
}

export async function deleteSyncedOrders(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('pendingOrders', 'readwrite');
  const all = await tx.store.getAll();
  for (const order of all) {
    if (order.synced) {
      await tx.store.delete(order.id);
    }
  }
  await tx.done;
}

// Settings (e.g., custom prices, admin PIN)
export async function saveSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put('settings', { key, value });
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  const result = await db.get('settings', key);
  return result?.value as T | undefined;
}
