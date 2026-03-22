import { useState, useEffect } from 'react';
import { Product } from '../types';
import { DEFAULT_PRODUCTS } from '../data/defaultCatalog';
import { fetchProducts } from '../services/api';
import { saveProducts, getLocalProducts } from '../services/db';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 1. Try local first (instant)
      try {
        const local = await getLocalProducts();
        if (!cancelled && local.length > 0) {
          setProducts(local);
        }
      } catch {
        // IndexedDB error — use defaults
      }

      // 2. Try API (network)
      try {
        const remote = await fetchProducts();
        if (!cancelled && remote.length > 0) {
          setProducts(remote);
          await saveProducts(remote);
        }
      } catch {
        // Offline — local or defaults already set
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { products, loading };
}
