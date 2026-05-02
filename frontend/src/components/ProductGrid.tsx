import { Product } from '../types';
import { getCategoryMeta, normalizeCategory } from '../utils/categories';
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

function chunkProducts(items: Product[], size = 3): Product[][] {
  const chunks: Product[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export default function ProductGrid({ products, order, isHH, prices, onAdd, onRemove, onValidate, onCancel }: ProductGridProps) {
  const groupedProducts = products.reduce<Record<string, Product[]>>((acc, product) => {
    const key = normalizeCategory(product.category);
    if (!acc[key]) acc[key] = [];
    acc[key].push(product);
    return acc;
  }, {});

  const groups = Object.entries(groupedProducts)
    .map(([key, items]) => ({
      key,
      items: [...items].sort((a, b) => {
        const orderA = Number.isFinite(a.displayOrder) ? a.displayOrder : 9999;
        const orderB = Number.isFinite(b.displayOrder) ? b.displayOrder : 9999;
        return orderA - orderB || a.name.localeCompare(b.name);
      }),
      ...getCategoryMeta(key),
    }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

  const totalItems = Object.values(order).reduce((s, v) => s + v, 0);

  return (
    <div className="select-screen screen-wrapper">
      <div className="select-scroll">
        {groups.map(group => (
          <div key={group.key}>
            <div className="sec">{group.label.replace(/^\S+\s/, '')}</div>
            <div className={`grid ${group.key}`}>
              {chunkProducts(group.items).map((row, rowIndex) => (
                <div key={`${group.key}-${rowIndex}`} className={`product-row product-row-${row.length}`}>
                  {row.map(item => (
                    <ProductCard
                      key={item.id}
                      item={item}
                      qty={order[item.id] || 0}
                      price={getPrice(item, normalizeCategory(item.category) === 'drink' ? isHH : false, prices)}
                      isHH={normalizeCategory(item.category) === 'drink' ? isHH : false}
                      onAdd={() => onAdd(item.id)}
                      onRemove={() => onRemove(item.id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="validate-actions">
        <button className="btn-validate" disabled={totalItems === 0} onClick={onValidate}>
          Valider
          {totalItems > 0 && <span className="validate-count">{totalItems} article{totalItems > 1 ? 's' : ''}</span>}
        </button>
        <button className="btn-cancel-order" disabled={totalItems === 0} onClick={onCancel}>
          Annuler la sélection
        </button>
      </div>
    </div>
  );
}
