import { Product } from '../types';

interface PriceEditorProps {
  products: Product[];
  prices: Record<string, number>;
  isHH: boolean;
  onSetPrice: (id: string, type: string, val: string) => void;
  onResetPrices: () => void;
  onGoBack: () => void;
}

const CAT_LABELS: Record<string, string> = {
  drink: '🍺 Boissons',
  consigne: '🫙 Consignes',
  food: '🥙 Sandwiches',
};

function getPrice(item: Product, isHH: boolean, prices: Record<string, number>): number {
  const key = `${item.id}_${isHH ? 'hh' : 'normal'}`;
  return prices[key] ?? (isHH ? item.hhPrice : item.normalPrice);
}

export default function PriceEditor({ products, prices, isHH, onSetPrice, onResetPrices, onGoBack }: PriceEditorProps) {
  return (
    <div className="prices-screen screen-wrapper">
      <div className="prices-scroll">
        {(['drink', 'consigne', 'food'] as const).map(cat => {
          const catItems = products.filter(p => p.category === cat);
          return (
            <div key={cat} className="price-group">
              <div className="price-cat-label">{CAT_LABELS[cat]}</div>
              {catItems.map(item => (
                <div key={item.id} className="price-row">
                  <span className="price-row-icon">{item.icon}</span>
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
          );
        })}
      </div>
      <div className="bottom-row">
        <button className="btn-back" onClick={onGoBack}>← Retour</button>
        <button className="btn-reset" onClick={onResetPrices}>↺ Réinitialiser</button>
      </div>
    </div>
  );
}
