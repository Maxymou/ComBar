import { OrderLine, Product } from '../types';
import ProductIcon from './ProductIcon';
import { getCategoryMeta, normalizeCategory } from '../utils/categories';

interface SummaryProps {
  lines: OrderLine[];
  bonusShooters: number;
  total: number;
  checked: Record<string, number>;
  isHH: boolean;
  onCheckItem: (id: string, max: number) => void;
  onUncheckItem: (id: string) => void;
  onGoPayment: () => void;
  onConfirmPayment: () => void;
  onGoBack: () => void;
  onReset: () => void;
}

export default function Summary({
  lines, bonusShooters, total, checked, isHH,
  onCheckItem, onUncheckItem, onGoPayment, onConfirmPayment, onGoBack, onReset,
}: SummaryProps) {
  const totalChecked = lines.filter(l => !l.isBonus).reduce((s, l) => s + (checked[l.productId] || 0), 0);
  const totalToCheck = lines.filter(l => !l.isBonus).reduce((s, l) => s + l.quantity, 0);
  const allChecked = totalToCheck > 0 && totalChecked === totalToCheck;

  const groupedLines = lines
    .filter(l => !l.isBonus)
    .reduce<Record<string, OrderLine[]>>((acc, line) => {
      const key = normalizeCategory(line.category);
      if (!acc[key]) acc[key] = [];
      acc[key].push(line);
      return acc;
    }, {});

  const groups = Object.entries(groupedLines)
    .map(([key, categoryLines]) => ({
      key,
      lines: categoryLines,
      ...getCategoryMeta(key),
    }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

  const hasDrinkGroup = groups.some(group => group.key === 'drink');

  return (
    <div className="summary screen-wrapper">
      <div className={`total-card${allChecked ? ' total-done' : ''}`}>
        <div>
          <div className="total-label">Total à payer</div>
          <div className="total-progress">{totalChecked}/{totalToCheck} préparé{totalChecked > 1 ? 's' : ''}</div>
        </div>
        <span className="total-amount">{total.toFixed(2)} €</span>
      </div>

      <div className="lines-box">
        {groups.map(group => (
          <div key={group.key} className="cat-group">
            <div className="cat-label">{group.label}</div>
            {group.lines.map(l => {
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
            {group.key === 'drink' && bonusShooters > 0 && (
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
        ))}

        {!hasDrinkGroup && bonusShooters > 0 && (
          <div className="cat-group">
            <div className="cat-label">{getCategoryMeta('drink').label}</div>
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
          </div>
        )}
      </div>

      <button
        className="btn-confirm btn-confirm-ready summary-cash-btn"
        onClick={onConfirmPayment}
        disabled={total <= 0}
        type="button"
      >
        Encaisser
      </button>
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
