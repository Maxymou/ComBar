import { Product } from '../types';
import ProductCard from './ProductCard';

interface ProductGridProps {
  products: Product[];
  order: Record<string, number>;
  isHH: boolean;
  prices: Record<string, number>;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onValidate: () => void;
  onCancel: () => void;
}

function getPrice(item: Product, isHH: boolean, prices: Record<string, number>): number {
  const key = `${item.id}_${isHH ? 'hh' : 'normal'}`;
  return prices[key] ?? (isHH ? item.hhPrice : item.normalPrice);
}

export default function ProductGrid({ products, order, isHH, prices, onAdd, onRemove, onValidate, onCancel }: ProductGridProps) {
  const drinks = products.filter(p => p.category === 'drink');
  const consignes = products.filter(p => p.category === 'consigne');
  const food = products.filter(p => p.category === 'food');
  const totalItems = Object.values(order).reduce((s, v) => s + v, 0);

  return (
    <div className="select-screen">
      <div className="select-scroll">
        <div className="sec">Boissons</div>
        <div className="grid drinks">
          {drinks.map(item => (
            <ProductCard
              key={item.id}
              item={item}
              qty={order[item.id] || 0}
              price={getPrice(item, isHH, prices)}
              isHH={isHH}
              onAdd={() => onAdd(item.id)}
              onRemove={() => onRemove(item.id)}
            />
          ))}
        </div>

        <div className="sec">Consignes</div>
        <div className="grid consignes">
          {consignes.map(item => (
            <ProductCard
              key={item.id}
              item={item}
              qty={order[item.id] || 0}
              price={getPrice(item, false, prices)}
              isHH={false}
              onAdd={() => onAdd(item.id)}
              onRemove={() => onRemove(item.id)}
            />
          ))}
        </div>

        <div className="sec">Sandwiches</div>
        <div className="grid food">
          {food.map(item => (
            <ProductCard
              key={item.id}
              item={item}
              qty={order[item.id] || 0}
              price={getPrice(item, false, prices)}
              isHH={false}
              onAdd={() => onAdd(item.id)}
              onRemove={() => onRemove(item.id)}
            />
          ))}
        </div>
      </div>

      <button className="btn-validate" disabled={totalItems === 0} onClick={onValidate}>
        Valider
        {totalItems > 0 && <span className="validate-count">{totalItems} article{totalItems > 1 ? 's' : ''}</span>}
      </button>
      <button className="btn-cancel-order" disabled={totalItems === 0} onClick={onCancel}>
        Annuler la sélection
      </button>
    </div>
  );
}
