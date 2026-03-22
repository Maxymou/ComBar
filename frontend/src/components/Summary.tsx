import { Product, OrderLine } from '../types';

interface SummaryProps {
  lines: OrderLine[];
  bonusShooters: number;
  total: number;
  checked: Record<string, number>;
  isHH: boolean;
  onCheckItem: (id: string, max: number) => void;
  onUncheckItem: (id: string) => void;
  onGoPayment: () => void;
  onGoBack: () => void;
  onReset: () => void;
}

const CAT_LABELS: Record<string, string> = {
  drink: '🍺 Boissons',
  consigne: '🫙 Consignes',
  food: '🥙 Sandwiches',
};

export default function Summary({
  lines, bonusShooters, total, checked, isHH,
  onCheckItem, onUncheckItem, onGoPayment, onGoBack, onReset,
}: SummaryProps) {
  const totalChecked = lines.filter(l => !l.isBonus).reduce((s, l) => s + (checked[l.productId] || 0), 0);
  const totalToCheck = lines.filter(l => !l.isBonus).reduce((s, l) => s + l.quantity, 0);
  const allChecked = totalToCheck > 0 && totalChecked === totalToCheck;

  return (
    <div className="summary">
      <div className={`total-card${allChecked ? ' total-done' : ''}`}>
        <div>
          <div className="total-label">Total à payer</div>
          <div className="total-progress">{totalChecked}/{totalToCheck} préparé{totalChecked > 1 ? 's' : ''}</div>
        </div>
        <span className="total-amount">{total.toFixed(2)} €</span>
      </div>

      <div className="lines-box">
        {(['drink', 'consigne', 'food'] as const).map(cat => {
          const catLines = lines.filter(l => l.category === cat && !l.isBonus);
          if (catLines.length === 0) return null;
          return (
            <div key={cat} className="cat-group">
              <div className="cat-label">{CAT_LABELS[cat]}</div>
              {catLines.map(l => {
                const chk = checked[l.productId] || 0;
                const done = chk >= l.quantity;
                return (
                  <div
                    key={l.productId}
                    className={`line${done ? ' line-done' : ''}`}
                    onClick={() => onCheckItem(l.productId, l.quantity)}
                  >
                    <div className="line-left">
                      <span className="line-icon">{l.icon}</span>
                      <span className="line-name">{l.productName}</span>
                    </div>
                    <div className="line-right">
                      <div className="dots">
                        {Array.from({ length: l.quantity }).map((_, i) => (
                          <span key={i} className={`dot${i < chk ? ' dot-on' : ''}`} />
                        ))}
                      </div>
                      <span
                        className="line-price"
                        onClick={e => { e.stopPropagation(); onUncheckItem(l.productId); }}
                      >
                        {l.subtotal.toFixed(2)} €
                      </span>
                    </div>
                  </div>
                );
              })}
              {cat === 'drink' && bonusShooters > 0 && (
                <div className="line line-free">
                  <div className="line-left">
                    <span className="line-icon">🥃</span>
                    <span className="line-name">Shooters offerts</span>
                  </div>
                  <div className="line-right">
                    <span className="line-qty-free">×{bonusShooters}</span>
                    <span className="line-price-free">Offert</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="btn-monnaies" onClick={onGoPayment}>
        Monnaie
      </button>
      <div className="bottom-row">
        <button className="btn-back" onClick={onGoBack}>← Retour</button>
        <button className="btn-reset" onClick={onReset}>Réinitialiser</button>
      </div>
    </div>
  );
}
