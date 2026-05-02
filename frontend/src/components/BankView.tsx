interface BankViewProps {
  onGoBack: () => void;
}

export default function BankView({ onGoBack }: BankViewProps) {
  return (
    <div className="placeholder-view">
      <div className="placeholder-title">Banque</div>
      <div className="placeholder-text">Accès direct à la banque (sans code PIN).</div>
      <button
        type="button"
        className="placeholder-back-btn"
        onClick={onGoBack}
      >
        Retour à la commande
      </button>
    </div>
  );
}
