import { useEffect, useMemo, useState } from 'react';
import { Category, Product, ProductManagementPayload } from '../types';
import {
  createProduct,
  deleteProduct,
  fetchAllProductsForManagement,
  fetchCategories,
  updateProduct,
} from '../services/api';

interface SalesManagementViewProps {
  onGoBack: () => void;
  onProductsChanged: () => Promise<void> | void;
}

type FormState = ProductManagementPayload;

const EMPTY_FORM: FormState = {
  name: '',
  icon: '🛒',
  category: '',
  normalPrice: 0,
  hhPrice: 0,
  hhBonus: false,
  displayOrder: 0,
  active: true,
};

export default function SalesManagementView({ onGoBack, onProductsChanged }: SalesManagementViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [productsData, categoriesData] = await Promise.all([
        fetchAllProductsForManagement(),
        fetchCategories(),
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
      if (!form.category && categoriesData.length > 0) {
        setForm(prev => ({ ...prev, category: categoriesData[0].name }));
      }
    } catch {
      setError('Impossible de charger les produits.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadData(); }, []);

  const sortedProducts = useMemo(() => [...products].sort((a, b) => {
    if (a.category === b.category) return a.displayOrder - b.displayOrder;
    return a.category.localeCompare(b.category);
  }), [products]);

  const resetForm = () => {
    setIsEditingId(null);
    setForm({ ...EMPTY_FORM, category: categories[0]?.name || '' });
  };

  const submitForm = async () => {
    setError(null); setSuccess(null);
    try {
      if (isEditingId) {
        await updateProduct(isEditingId, form);
        setSuccess('Produit modifié.');
      } else {
        await createProduct(form);
        setSuccess('Produit ajouté.');
      }
      resetForm();
      await loadData();
      await onProductsChanged();
    } catch {
      setError('Erreur lors de l’enregistrement du produit.');
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!window.confirm('Supprimer ce produit de la vente ?')) return;
    setError(null); setSuccess(null);
    try {
      await deleteProduct(id);
      setSuccess('Produit désactivé.');
      await loadData();
      await onProductsChanged();
    } catch {
      setError('Erreur lors de la suppression.');
    }
  };

  return (
    <section className="sales-management-view">
      <button type="button" className="placeholder-back-btn" onClick={onGoBack}>← Retour commande</button>
      <h2>Gestion des ventes</h2>
      {loading && <p>Chargement...</p>}
      {error && <p className="sales-feedback error">{error}</p>}
      {success && <p className="sales-feedback success">{success}</p>}

      <div className="sales-form-card">
        <h3>{isEditingId ? 'Modifier un produit' : 'Ajouter un produit'}</h3>
        <div className="sales-form-grid">
          <input placeholder="Nom" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Icône" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} />
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <input type="number" min="0" step="0.01" value={form.normalPrice} onChange={e => setForm({ ...form, normalPrice: Number(e.target.value) })} />
          <input type="number" min="0" step="0.01" value={form.hhPrice} onChange={e => setForm({ ...form, hhPrice: Number(e.target.value) })} />
          <input type="number" min="0" step="1" value={form.displayOrder} onChange={e => setForm({ ...form, displayOrder: Number(e.target.value) })} />
          <label><input type="checkbox" checked={form.hhBonus} onChange={e => setForm({ ...form, hhBonus: e.target.checked })} /> Bonus HH</label>
          <label><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Actif</label>
        </div>
        <div className="sales-form-actions">
          <button type="button" onClick={submitForm}>Enregistrer</button>
          <button type="button" onClick={resetForm}>Annuler</button>
        </div>
      </div>

      {!loading && sortedProducts.length === 0 && <p>Aucun produit disponible.</p>}
      <div className="sales-product-list">
        {sortedProducts.map(product => (
          <article key={product.id} className="sales-product-item">
            <div>{product.icon} <strong>{product.name}</strong> · {product.category}</div>
            <div>{product.normalPrice.toFixed(2)}€ / HH {product.hhPrice.toFixed(2)}€ · Bonus {product.hhBonus ? 'Oui' : 'Non'} · Ordre {product.displayOrder} · {product.active ? 'Actif' : 'Inactif'}</div>
            <div className="sales-item-actions">
              <button type="button" onClick={() => { setIsEditingId(product.id); setForm({ ...product, active: product.active ?? true }); }}>Modifier</button>
              <button type="button" onClick={() => handleDeactivate(product.id)}>Supprimer</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
