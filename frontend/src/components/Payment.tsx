import { DENOMINATIONS } from '../data/denominations';

interface PaymentProps {
  total: number;
  given: Record<string, number>;
  isHH: boolean;
  onAddGiven: (id: string) => void;
  onRemoveGiven: (id: string) => void;
  onGoBack: () => void;
  onConfirm: () => void;
}

export default function Payment({ total, given, isHH, onAddGiven, onRemoveGiven, onGoBack, onConfirm }: PaymentProps) {
  const totalGiven = DENOMINATIONS.reduce((s, m) => s + m.value * (given[m.id] || 0), 0);
  const change = Math.max(0, Math.round((totalGiven - total) * 100) / 100);
  const missing = totalGiven > 0 && totalGiven < total;
  const sufficient = totalGiven >= total;

  const billets = DENOMINATIONS.filter(m => m.type === 'billet');
  const pieces = DENOMINATIONS.filter(m => m.type === 'piece');

  return (
    <div className="monnaie-screen">
      <div className="money-row money-row-total">
        <span className="money-row-label">À payer</span>
        <span className="money-row-amount">{total.toFixed(2)} €</span>
      </div>
      <div className="money-row money-row-given">
        <span className="money-row-label">Reçu</span>
        <span className="money-row-amount given-amount">{totalGiven.toFixed(2)} €</span>
      </div>
      <div className={`money-row money-row-change${change > 0 ? ' change-positive' : missing ? ' change-negative' : ''}`}>
        <span className="money-row-label">{missing ? 'Manque' : 'À rendre'}</span>
        <span className="money-row-amount change-amount">
          {missing ? `−${(total - totalGiven).toFixed(2)} €` : `${change.toFixed(2)} €`}
        </span>
      </div>

      <div className="money-sec">Billets</div>
      <div className="money-grid">
        {billets.map(m => {
          const qty = given[m.id] || 0;
          return (
            <button key={m.id} className={`money-card billet btn-reset-style${qty > 0 ? ' money-on' : ''}`} onClick={() => onAddGiven(m.id)} type="button">
              {qty > 0 && <span className="money-badge">{qty}</span>}
              {qty > 0 && <button className="money-minus" onClick={e => { e.stopPropagation(); onRemoveGiven(m.id); }} type="button">−</button>}
              <span className="money-icon">💶</span>
              <span className="money-label">{m.label}</span>
            </button>
          );
        })}
      </div>

      <div className="money-sec">Pièces</div>
      <div className="money-grid">
        {pieces.map(m => {
          const qty = given[m.id] || 0;
          return (
            <button key={m.id} className={`money-card piece btn-reset-style${qty > 0 ? ' money-on' : ''}`} onClick={() => onAddGiven(m.id)} type="button">
              {qty > 0 && <span className="money-badge">{qty}</span>}
              {qty > 0 && <button className="money-minus" onClick={e => { e.stopPropagation(); onRemoveGiven(m.id); }} type="button">−</button>}
              <span className="money-icon">🪙</span>
              <span className="money-label">{m.label}</span>
            </button>
          );
        })}
      </div>

      <button
        className={`btn-confirm${sufficient ? ' btn-confirm-ready' : ''}`}
        disabled={!sufficient}
        onClick={onConfirm}
      >
        {sufficient ? 'Encaisser' : 'Montant insuffisant'}
      </button>
      <div className="bottom-row">
        <button className="btn-back" onClick={onGoBack}>← Retour</button>
      </div>
    </div>
  );
}
