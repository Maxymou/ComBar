import { Product } from '../types';
import ProductIcon from './ProductIcon';
import { getCategoryMeta, normalizeCategory } from '../utils/categories';

interface PriceEditorProps {
  products: Product[];
  prices: Record<string, number>;
  isHH: boolean;
  onSetPrice: (id: string, type: string, val: string) => void;
  onResetPrices: () => void;
  onGoBack: () => void;
}

function getPrice(item: Product, isHH: boolean, prices: Record<string, number>): number {
  const key = `${item.id}_${isHH ? 'hh' : 'normal'}`;
  return prices[key] ?? (isHH ? item.hhPrice : item.normalPrice);
}

export default function PriceEditor({ products, prices, isHH, onSetPrice, onResetPrices, onGoBack }: PriceEditorProps) {
  const groupedProducts = products.reduce<Record<string, Product[]>>((acc, product) => {
    const key = normalizeCategory(product.category);
    if (!acc[key]) acc[key] = [];
    acc[key].push(product);
    return acc;
  }, {});

  const groups = Object.entries(groupedProducts)
    .map(([key, items]) => ({ key, items, ...getCategoryMeta(key) }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

  return (
    <div className="prices-screen screen-wrapper">
      <div className="prices-scroll">
        {groups.map(group => (
          <div key={group.key} className="price-group">
            <div className="price-cat-label">{group.label}</div>
            {group.items.map(item => (
              <div key={item.id} className="price-row">
                <span className="price-row-icon"><ProductIcon product={item} /></span>
                <span className="price-row-name">{item.name}</span>
                <div className="price-inputs">
                  <div className="price-input-wrap">
                    <span className="price-input-label">Normal</span>
                    <div className="price-input-row">
                      <input
                        className="price-input"
                        type="number"
                        min="0"
                        step="0.5"
                        value={getPrice(item, false, prices)}
                        onChange={e => onSetPrice(item.id, 'normal', e.target.value)}
                      />
                      <span className="price-euro">€</span>
                    </div>
                  </div>
                  <div className="price-input-wrap">
                    <span className="price-input-label hh-col">HH</span>
                    <div className="price-input-row">
                      <input
                        className="price-input hh-input"
                        type="number"
                        min="0"
                        step="0.5"
                        value={getPrice(item, true, prices)}
                        onChange={e => onSetPrice(item.id, 'hh', e.target.value)}
                      />
                      <span className="price-euro hh-col">€</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="bottom-row">
        <button className="btn-back" onClick={onGoBack}>← Retour</button>
        <button className="btn-reset" onClick={onResetPrices}>↺ Réinitialiser</button>
      </div>
    </div>
  );
}
