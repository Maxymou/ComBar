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
  id: string;
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
