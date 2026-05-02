import { useEffect, useMemo, useState } from 'react';
import { Category, Product, ProductManagementPayload } from '../types';
import { createProduct, deleteProduct, fetchAllProductsForManagement, fetchCategories, updateProduct } from '../services/api';
import { getCategoryMeta } from '../utils/categories';

interface SalesManagementViewProps {
  onGoBack: () => void;
  onProductsChanged: () => Promise<unknown> | void;
}

const QUICK_ICONS = ['🍺','🍻','🥃','🍷','🥂','🥤','🧃','☕','🫙','🪣','🥪','🥙','🍔','🍟','🛒'];

type FormState = ProductManagementPayload;
const EMPTY_FORM: FormState = { name:'', icon:'🛒', customIcon:'', category:'drink', normalPrice:0, hhPrice:0, hhBonus:false, bonusParentProductId:null, displayOrder:0, active:true };

export default function SalesManagementView({ onGoBack, onProductsChanged }: SalesManagementViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [isProductCardOpen, setIsProductCardOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const loadData = async () => { setLoading(true); setError(null); try { const [p,c] = await Promise.all([fetchAllProductsForManagement(), fetchCategories()]); setProducts(p); setCategories(c); } catch { setError('Impossible de charger les produits.'); } finally { setLoading(false);} };
  useEffect(() => { void loadData(); }, []);

  const sortedProducts = useMemo(() => [...products].sort((a,b)=> a.displayOrder===b.displayOrder ? a.name.localeCompare(b.name) : a.displayOrder-b.displayOrder), [products]);
  const categoryOptions = useMemo(() => categories.filter(c => ['drink','consigne','soft','sandwich','food'].includes(c.name)), [categories]);

  const resetForm = () => { setIsEditingId(null); setIsProductCardOpen(false); setForm({ ...EMPTY_FORM, category: categoryOptions[0]?.name || 'drink' }); };
  const openNew = () => { setIsEditingId(null); setError(null); setForm({ ...EMPTY_FORM, category: categoryOptions[0]?.name || 'drink' }); setIsProductCardOpen(true); };
  const openEdit = (product: Product) => { setIsEditingId(product.id); setError(null); setForm({ ...product, customIcon:'', bonusParentProductId: product.bonusParentProductId ?? null, active: product.active ?? true }); setIsProductCardOpen(true); };

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Le nom du produit est obligatoire.';
    if (!form.icon.trim()) return 'Veuillez sélectionner une icône.';
    if (!form.category) return 'La catégorie est obligatoire.';
    if (Number.isNaN(Number(form.normalPrice)) || Number(form.normalPrice) < 0) return 'Le prix doit être valide (>= 0).';
    if (Number.isNaN(Number(form.hhPrice)) || Number(form.hhPrice) < 0) return 'Le prix Happy Hour doit être valide (>= 0).';
    if (form.hhBonus && !form.bonusParentProductId) return 'Sélectionnez le produit rattaché pour le bonus HH.';
    if (form.hhBonus && isEditingId && form.bonusParentProductId === isEditingId) return 'Un produit ne peut pas être rattaché à lui-même.';
    return null;
  };

  const submitForm = async () => {
    setError(null); setSuccess(null);
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    try {
      const payload = { ...form, name: form.name.trim(), icon: form.customIcon?.trim() || form.icon, bonusParentProductId: form.hhBonus ? form.bonusParentProductId : null };
      if (isEditingId) { await updateProduct(isEditingId, payload); setSuccess('Produit modifié.'); } else { await createProduct(payload); setSuccess('Produit ajouté.'); }
      resetForm(); await loadData(); await onProductsChanged();
    } catch { setError('Erreur lors de l’enregistrement du produit.'); }
  };

  const handleDeactivate = async (id: string) => { if (!window.confirm('Désactiver ce produit ?')) return; setError(null); setSuccess(null); try { await deleteProduct(id); setSuccess('Produit désactivé.'); await loadData(); await onProductsChanged(); } catch { setError('Erreur lors de la désactivation.'); } };

  return <section className="sales-management-view">
    <header className="sales-management-header">
      <button type="button" className="placeholder-back-btn" onClick={onGoBack}>← Retour</button>
      <h2>Gestion des ventes</h2><p>Produits disponibles à la vente</p>
    </header>
    {error && <p className="sales-feedback error">{error}</p>}
    {success && <p className="sales-feedback success">{success}</p>}
    <button type="button" className="new-product-button" onClick={openNew}>+ Nouveau produit</button>
    {loading && <p>Chargement...</p>}
    {!loading && <div className="sales-product-list">{sortedProducts.map(product => <article key={product.id} className="sales-product-item"><div className="sales-item-main"><span className="sales-product-icon">{product.icon}</span><div><strong>{product.name}</strong><p>{getCategoryMeta(product.category).label.replace(/^\S+\s/, '')}</p></div></div><div className="sales-item-prices"><span>{product.normalPrice.toFixed(2)}€</span><span>HH {product.hhPrice.toFixed(2)}€</span></div><div className="sales-badges">{product.hhBonus && <span className="badge">Bonus HH</span>}<span className={`badge ${product.active ? 'active' : 'inactive'}`}>{product.active ? 'Actif' : 'Inactif'}</span>{product.bonusParentProductName && <span className="badge">Bonus de : {product.bonusParentProductName}</span>}</div><div className="sales-item-actions"><button type="button" onClick={()=>openEdit(product)}>Modifier</button><button type="button" onClick={()=>handleDeactivate(product.id)}>{product.active ? 'Désactiver' : 'Supprimer'}</button></div></article>)}</div>}
    {isProductCardOpen && <div className="product-editor-overlay" onClick={resetForm}><article className="product-editor-card" onClick={e=>e.stopPropagation()}><h3>{isEditingId ? 'Modifier le produit' : 'Nouveau produit'}</h3>
      <label>Nom du produit<input placeholder="Ex : Bière 25cl" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></label>
      <label>Prix<div className="price-input"><input type="number" min="0" step="0.01" value={form.normalPrice} onChange={e=>setForm({...form,normalPrice:Number(e.target.value)})} /><span>€</span></div></label>
      <label>Prix Happy Hour<div className="price-input"><input type="number" min="0" step="0.01" value={form.hhPrice} onChange={e=>setForm({...form,hhPrice:Number(e.target.value)})} /><span>€</span></div></label>
      <label>Icône<div className="icon-grid">{QUICK_ICONS.map(icon => <button key={icon} type="button" className={form.icon===icon ? 'selected' : ''} onClick={()=>setForm({...form,icon,customIcon:''})}>{icon}</button>)}</div><input placeholder="Icône personnalisée (optionnel)" value={form.customIcon || ''} onChange={e=>setForm({...form,customIcon:e.target.value,icon:e.target.value || form.icon})} /></label>
      <label>Catégorie<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categoryOptions.map(c => <option key={c.id} value={c.name}>{getCategoryMeta(c.name).label.replace(/^\S+\s/, '')}</option>)}</select></label>
      <label className="toggle-row"><input type="checkbox" checked={form.hhBonus} onChange={e=>setForm({...form,hhBonus:e.target.checked,bonusParentProductId:e.target.checked ? form.bonusParentProductId : null})} /> Bonus HH</label>
      {form.hhBonus && <label>Rattaché au produit<select value={form.bonusParentProductId || ''} onChange={e=>setForm({...form,bonusParentProductId:e.target.value || null})}><option value="">Sélectionner un produit</option>{products.filter(p=>p.id!==isEditingId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      <label className="toggle-row"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})} /> Actif</label>
      <div className="sales-form-actions"><button type="button" onClick={submitForm}>Enregistrer</button><button type="button" onClick={resetForm}>Annuler</button></div>
    </article></div>}
  </section>;
}
