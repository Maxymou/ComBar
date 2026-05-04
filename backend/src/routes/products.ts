import express, { Router, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import pool from '../db/pool';
import { RealtimeServer } from '../realtime/server';
import { logger } from '../logger';

const router = Router();
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads/products');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const SUPPORTED_IMAGE_MIME_TYPES = ['image/png'];

const imageUploadParser = express.raw({
  type: [...SUPPORTED_IMAGE_MIME_TYPES, 'application/octet-stream'],
  limit: '5mb',
});


function mapProductRow(r: any) {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    iconType: r.icon_type ?? 'emoji',
    iconUrl: r.icon_url ?? null,
    normalPrice: parseFloat(r.normal_price),
    hhPrice: parseFloat(r.hh_price),
    hhBonus: r.hh_bonus,
    category: r.category,
    categoryId: r.category_id,
    displayOrder: r.display_order,
    active: r.active,
    bonusParentProductId: r.bonus_parent_product_id ?? null,
    bonusParentProductName: r.bonus_parent_product_name ?? null,
  };
}
const slugify = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 50);

const BASE_SELECT = `
SELECT p.id, p.name, p.icon, p.icon_type, p.icon_url, p.normal_price, p.hh_price, p.hh_bonus,
       c.name as category, c.id as category_id, p.display_order, p.active,
       p.bonus_parent_product_id, bp.name as bonus_parent_product_name
FROM products p
JOIN categories c ON p.category_id = c.id
LEFT JOIN products bp ON bp.id = p.bonus_parent_product_id`;

router.post('/api/products/upload', imageUploadParser, async (req: Request, res: Response) => {
  const body = req.body;

  if (!Buffer.isBuffer(body) || body.length === 0) {
    return res.status(400).json({ error: 'Aucun fichier reçu.' });
  }

  const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (contentType && !SUPPORTED_IMAGE_MIME_TYPES.includes(contentType)) {
    return res.status(400).json({ error: 'Format non supporté. Utilisez un fichier PNG.' });
  }

  const originalName = String(req.headers['x-file-name'] || 'product.png');
  const base = slugify(path.parse(originalName).name) || 'product';
  const filename = `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const filepath = path.join(UPLOAD_DIR, filename);

  try {
    await fs.promises.writeFile(filepath, body);
    return res.status(201).json({ url: `/uploads/products/${filename}` });
  } catch (err) {
    logger.error({ err }, 'Failed to store product image upload');
    return res.status(500).json({ error: "Échec de l'enregistrement du fichier." });
  }
});

router.get('/api/products', async (_req, res) => {
  try {
    const result = await pool.query(`${BASE_SELECT} WHERE p.active = true ORDER BY c.display_order, p.display_order`);
    res.json(result.rows.map((r) => ({ ...mapProductRow(r), active: undefined, categoryId: undefined })));
  } catch (err) { logger.error({ err }, 'Failed to fetch products'); res.status(500).json({ error: 'Failed to fetch products' }); }
});
// ... keep rest mostly
router.get('/api/products/manage', async (_req, res) => {
  try { const result = await pool.query(`${BASE_SELECT} ORDER BY c.display_order, p.display_order, p.name`); res.json(result.rows.map(mapProductRow)); }
  catch (err) { logger.error({ err }, 'Failed to fetch managed products'); res.status(500).json({ error: 'Failed to fetch managed products' }); }
});
router.get('/api/categories', async (_req, res) => {
  try { const r = await pool.query('SELECT id, name, display_order FROM categories ORDER BY display_order, id'); res.json(r.rows.map((x) => ({ id: x.id, name: x.name, displayOrder: x.display_order }))); }
  catch (err) { logger.error({ err }, 'Failed to fetch categories'); res.status(500).json({ error: 'Failed to fetch categories' }); }
});
async function validateBonus(parentId: string | null, selfId?: string) {
  if (!parentId) return true;
  if (selfId && parentId === selfId) return false;
  const parent = await pool.query('SELECT 1 FROM products WHERE id = $1', [parentId]);
  return parent.rows.length > 0;
}
const normalizeIconData = (iconTypeRaw: unknown, iconRaw: unknown, iconUrlRaw: unknown) => {
  const iconType = iconTypeRaw === 'image' ? 'image' : 'emoji';
  if (iconTypeRaw && !['emoji', 'image'].includes(String(iconTypeRaw))) return { error: 'iconType invalide' };
  const icon = String(iconRaw || '').trim() || '🛒';
  const iconUrl = iconType === 'image' ? (String(iconUrlRaw || '').trim() || null) : null;
  return { iconType, icon, iconUrl };
};
router.post('/api/products', async (req, res) => {
  const { name, icon, iconType, iconUrl, normalPrice, hhPrice, hhBonus, category, displayOrder, active, bonusParentProductId } = req.body ?? {};
  if (!name || Number(normalPrice) < 0 || Number(hhPrice) < 0 || Number.isNaN(Number(displayOrder))) return res.status(400).json({ error: 'Invalid payload' });
  const normalized = normalizeIconData(iconType, icon, iconUrl); if ('error' in normalized) return res.status(400).json({ error: normalized.error });
  try {
    const cat = await pool.query('SELECT id FROM categories WHERE name = $1', [category]); if (!cat.rows.length) return res.status(400).json({ error: 'Invalid category' });
    const bonusParentId = hhBonus ? (bonusParentProductId || null) : null;
    if (hhBonus && !(await validateBonus(bonusParentId))) return res.status(400).json({ error: 'Invalid bonus parent product' });
    const baseId = slugify(String(name)); let id = baseId || `product${Date.now()}`; let i = 1;
    while ((await pool.query('SELECT 1 FROM products WHERE id = $1', [id])).rows.length > 0) { i += 1; id = `${baseId}${i}`; }
    const result = await pool.query(`INSERT INTO products(id, name, icon, icon_type, icon_url, normal_price, hh_price, hh_bonus, category_id, display_order, active, bonus_parent_product_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id, name, icon, icon_type, icon_url, normal_price, hh_price, hh_bonus, category_id, display_order, active, bonus_parent_product_id`,
      [id, name, normalized.icon, normalized.iconType, normalized.iconUrl, Number(normalPrice), Number(hhPrice), Boolean(hhBonus), cat.rows[0].id, Number(displayOrder), active !== false, bonusParentId]);
    (req.app.locals.realtimeServer as RealtimeServer | undefined)?.broadcast({ type: 'STATE_UPDATE', payload: { updatedAt: new Date().toISOString() } });
    res.status(201).json(mapProductRow({ ...result.rows[0], category, category_id: cat.rows[0].id, bonus_parent_product_name: null }));
  } catch (err) { logger.error({ err }, 'Failed to create product'); res.status(500).json({ error: 'Failed to create product' }); }
});
router.put('/api/products/reorder', async (req: Request, res: Response) => {
/* unchanged */
const { items } = req.body ?? {};
if (!Array.isArray(items)) return res.status(400).json({ error: 'Invalid payload' });
const client = await pool.connect();
try { await client.query('BEGIN'); for (const item of items) { if (!item || typeof item.id !== 'string' || Number.isNaN(Number(item.displayOrder))) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Invalid item payload' }); } const exists = await client.query('SELECT 1 FROM products WHERE id = $1', [item.id]); if (!exists.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: `Product not found: ${item.id}` }); } await client.query('UPDATE products SET display_order = $1 WHERE id = $2', [Number(item.displayOrder), item.id]); }
await client.query('COMMIT'); (req.app.locals.realtimeServer as RealtimeServer | undefined)?.broadcast({ type: 'STATE_UPDATE', payload: { updatedAt: new Date().toISOString() } }); res.json({ ok: true });
} catch (err) { await client.query('ROLLBACK'); logger.error({ err }, 'Failed to reorder products'); res.status(500).json({ error: 'Failed to reorder products' }); } finally { client.release(); }
});
router.put('/api/products/:id', async (req, res) => {
  const productId = String(req.params.id || '').trim();
  const { name, icon, iconType, iconUrl, normalPrice, hhPrice, hhBonus, category, displayOrder, active, bonusParentProductId } = req.body ?? {};
  const normalized = normalizeIconData(iconType, icon, iconUrl); if ('error' in normalized) return res.status(400).json({ error: normalized.error });
  try {
    const cat = await pool.query('SELECT id FROM categories WHERE name = $1', [category]); if (!cat.rows.length) return res.status(400).json({ error: 'Invalid category' });
    const bonusParentId = hhBonus ? (bonusParentProductId || null) : null;
    if (hhBonus && !(await validateBonus(bonusParentId, productId))) return res.status(400).json({ error: 'Invalid bonus parent product' });
    const result = await pool.query(`UPDATE products SET name=$1, icon=$2, icon_type=$3, icon_url=$4, normal_price=$5, hh_price=$6, hh_bonus=$7, category_id=$8, display_order=$9, active=$10, bonus_parent_product_id=$11
       WHERE id=$12
       RETURNING id, name, icon, icon_type, icon_url, normal_price, hh_price, hh_bonus, category_id, display_order, active, bonus_parent_product_id`,
      [name, normalized.icon, normalized.iconType, normalized.iconUrl, Number(normalPrice), Number(hhPrice), Boolean(hhBonus), cat.rows[0].id, Number(displayOrder), Boolean(active), bonusParentId, productId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    (req.app.locals.realtimeServer as RealtimeServer | undefined)?.broadcast({ type: 'STATE_UPDATE', payload: { updatedAt: new Date().toISOString() } });
    res.json(mapProductRow({ ...result.rows[0], category, category_id: cat.rows[0].id, bonus_parent_product_name: null }));
  } catch (err) { logger.error({ err, productId }, 'Failed to update product'); res.status(500).json({ error: 'Failed to update product' }); }
});
router.delete('/api/products/:id', async (req, res) => { const productId = String(req.params.id || '').trim(); try { await pool.query('UPDATE products SET active = false WHERE id = $1', [productId]); (req.app.locals.realtimeServer as RealtimeServer | undefined)?.broadcast({ type: 'STATE_UPDATE', payload: { updatedAt: new Date().toISOString() } }); res.json({ ok: true }); } catch (err) { logger.error({ err, productId }, 'Failed to deactivate product'); res.status(500).json({ error: 'Failed to deactivate product' }); } });

export default router;
