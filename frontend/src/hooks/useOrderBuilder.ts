import { useMemo } from 'react';
import { OrderLine, Product } from '../types';

function getPrice(item: Product, isHH: boolean, prices: Record<string, number>): number {
  const key = `${item.id}_${isHH ? 'hh' : 'normal'}`;
  return prices[key] ?? (isHH ? item.hhPrice : item.normalPrice);
}

interface UseOrderBuilderArgs {
  products: Product[];
  order: Record<string, number>;
  isHH: boolean;
  prices: Record<string, number>;
}

export interface UseOrderBuilderResult {
  lines: OrderLine[];
  bonusShooters: number;
  total: number;
}

export function useOrderBuilder({ products, order, isHH, prices }: UseOrderBuilderArgs): UseOrderBuilderResult {
  return useMemo(() => {
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
          iconType: i.iconType || 'emoji',
          iconUrl: i.iconType === 'image' ? (i.iconUrl || null) : null,
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
        iconType: 'emoji',
        iconUrl: null,
        quantity: bonusShooters,
        unitPrice: 0,
        subtotal: 0,
        isBonus: true,
        category: 'drink',
      });
    }

    const total = lines.reduce((s, l) => s + l.subtotal, 0);
    return { lines, bonusShooters, total };
  }, [products, order, isHH, prices]);
}
