import { Product } from '../types';

interface Props { product: Pick<Product, 'name' | 'icon' | 'iconType' | 'iconUrl'>; className?: string; }

export default function ProductIcon({ product, className = '' }: Props) {
  if (product.iconType === 'image' && product.iconUrl) {
    return <img src={product.iconUrl} alt={product.name} className={`product-icon-image ${className}`.trim()} onError={(e) => { (e.currentTarget.style.display = 'none'); }} />;
  }
  return <span className={className}>{product.icon || '🍽️'}</span>;
}
