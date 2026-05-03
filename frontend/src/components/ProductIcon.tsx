import { useEffect, useMemo, useState } from 'react';
import { Product } from '../types';
import { resolveBackendAssetUrl } from '../utils/url';

type ProductIconData = Pick<Product, 'name' | 'icon' | 'iconType' | 'iconUrl'>;
interface Props { product: ProductIconData; className?: string; }

export default function ProductIcon({ product, className = '' }: Props) {
  const resolvedImageUrl = useMemo(() => resolveBackendAssetUrl(product.iconUrl), [product.iconUrl]);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [resolvedImageUrl]);

  if (product.iconType === 'image' && resolvedImageUrl && !imageLoadFailed) {
    return (
      <img
        src={resolvedImageUrl}
        alt={product.name || 'Icône produit'}
        className={`product-icon-image ${className}`.trim()}
        onError={() => setImageLoadFailed(true)}
      />
    );
  }

  return <span className={className}>{product.icon || '🍽️'}</span>;
}
