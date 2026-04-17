export interface Product {
  id: string;
  name: string;
  icon: string;
  normalPrice: number;
  hhPrice: number;
  hhBonus: boolean;
  category: 'drink' | 'consigne' | 'food';
  displayOrder: number;
}

export interface OrderLine {
  productId: string;
  productName: string;
  icon: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isBonus: boolean;
  category: string;
}

export interface PendingOrder {
  id: string; // Used as clientOrderId for deduplication
  clientId?: string;
  total: number;
  isHappyHour: boolean;
  paymentGiven?: number;
  paymentChange?: number;
  lines: OrderLine[];
  createdAt: string;
  synced: boolean;
}

export type Screen = 'select' | 'summary' | 'monnaie' | 'prices';

export interface Denomination {
  id: string;
  label: string;
  value: number;
  type: 'billet' | 'piece';
}

export interface PresenceDevice {
  deviceId: string;
  deviceName: string;
  connected: boolean;
  connectedAt: string | null;
  lastSeenAt: string;
  lastDisconnectedAt: string | null;
}

export interface RealtimePresenceSnapshot {
  connectedCount: number;
  connected: PresenceDevice[];
  recentlyActive: PresenceDevice[];
}

export interface RealtimeState {
  prices: Record<string, number>;
  happyHour: boolean;
  clients: number; // Legacy counter kept for backward compatibility
  clientsCount: number;
  connectedDevices: PresenceDevice[];
  presence: RealtimePresenceSnapshot;
}
