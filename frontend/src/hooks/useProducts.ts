import { useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import { DEFAULT_PRODUCTS } from '../data/defaultCatalog';
import { fetchProducts } from '../services/api';
import { saveProducts, getLocalProducts } from '../services/db';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [loading, setLoading] = useState(true);

  const loadProducts = useCallback(async () => {
    setLoading(true);

    try {
      const local = await getLocalProducts();
      if (local.length > 0) setProducts(local);
    } catch {}

    try {
      const remote = await fetchProducts();
      setProducts(remote);
      await saveProducts(remote);
    } catch {}

    setLoading(false);
  }, []);

  const refreshProducts = useCallback(async () => {
    setLoading(true);
    try {
      const remote = await fetchProducts();
      setProducts(remote);
      await saveProducts(remote);
      return remote;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  return { products, loading, refreshProducts };
}
