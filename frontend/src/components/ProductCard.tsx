import { Product } from '../types';

interface ProductCardProps {
  item: Product;
  qty: number;
  price: number;
  isHH: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

export default function ProductCard({ item, qty, price, isHH, onAdd, onRemove }: ProductCardProps) {
  const showBonus = isHH && item.hhBonus;
  const cat = item.category;
  const activeClass = qty > 0
    ? cat === 'drink' ? ' on-drink' : cat === 'consigne' ? ' on-csg' : ' on-food'
    : '';
  const cardClass = `card${cat === 'consigne' ? ' csg' : ''}${cat === 'food' ? ' food-card' : ''}${activeClass}`;
  const priceLabel = showBonus ? `${price}€+🥃` : `${price} €`;

  return (
    <div className={cardClass} onClick={onAdd}>
      {showBonus && <span className="hh-tag">+🥃</span>}
      {qty > 0 && <span className="qty-badge">{qty}</span>}
      {qty > 0 && <span className="card-price-top">{priceLabel}</span>}
      {qty > 0 && (
        <button className="minus-btn" onClick={e => { e.stopPropagation(); onRemove(); }}>−</button>
      )}
      <span className="card-icon">{item.icon}</span>
      <span className="card-name">{item.name}</span>
      <span className="card-price" style={{ visibility: qty > 0 ? 'hidden' : 'visible' }}>{priceLabel}</span>
    </div>
  );
}
