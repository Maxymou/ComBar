import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { RealtimeServer } from '../realtime/server';
import { logger } from '../logger';

const router = Router();

function mapProductRow(r: any) {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    normalPrice: parseFloat(r.normal_price),
    hhPrice: parseFloat(r.hh_price),
    hhBonus: r.hh_bonus,
    category: r.category,
    categoryId: r.category_id,
    displayOrder: r.display_order,
    active: r.active,
  };
}

function slugify(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 50);
}

router.get('/api/products', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.name, p.icon, p.normal_price, p.hh_price, p.hh_bonus,
             c.name as category, p.display_order, p.active
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.active = true
      ORDER BY c.display_order, p.display_order
    `);
    const products = result.rows.map((r) => ({ ...mapProductRow(r), active: undefined, categoryId: undefined }));
    res.json(products);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch products');
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/api/products/manage', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.name, p.icon, p.normal_price, p.hh_price, p.hh_bonus,
             c.name as category, c.id as category_id, p.display_order, p.active
      FROM products p
      JOIN categories c ON p.category_id = c.id
      ORDER BY c.display_order, p.display_order, p.name
    `);
    res.json(result.rows.map(mapProductRow));
  } catch (err) {
    logger.error({ err }, 'Failed to fetch managed products');
    res.status(500).json({ error: 'Failed to fetch managed products' });
  }
});

router.get('/api/categories', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, name, display_order FROM categories ORDER BY display_order, id');
    res.json(result.rows.map((r) => ({ id: r.id, name: r.name, displayOrder: r.display_order })));
  } catch (err) {
    logger.error({ err }, 'Failed to fetch categories');
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/api/products', async (req: Request, res: Response) => {
  const { name, icon, normalPrice, hhPrice, hhBonus, category, displayOrder, active } = req.body ?? {};
  if (!name || Number(normalPrice) < 0 || Number(hhPrice) < 0 || Number.isNaN(Number(displayOrder))) {
    res.status(400).json({ error: 'Invalid payload' }); return;
  }
  try {
    const cat = await pool.query('SELECT id FROM categories WHERE name = $1', [category]);
    if (cat.rows.length === 0) { res.status(400).json({ error: 'Invalid category' }); return; }

    const baseId = slugify(String(name));
    let id = baseId || `product${Date.now()}`;
    let i = 1;
    while ((await pool.query('SELECT 1 FROM products WHERE id = $1', [id])).rows.length > 0) {
      i += 1; id = `${baseId}${i}`;
    }

    const result = await pool.query(
      `INSERT INTO products(id, name, icon, normal_price, hh_price, hh_bonus, category_id, display_order, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, name, icon, normal_price, hh_price, hh_bonus, category_id, display_order, active`,
      [id, name, icon || '🛒', Number(normalPrice), Number(hhPrice), Boolean(hhBonus), cat.rows[0].id, Number(displayOrder), active !== false],
    );
    const realtimeServer = req.app.locals.realtimeServer as RealtimeServer | undefined;
    realtimeServer?.broadcast({ type: 'STATE_UPDATE', payload: { updatedAt: new Date().toISOString() } });
    res.status(201).json(mapProductRow({ ...result.rows[0], category, category_id: cat.rows[0].id }));
  } catch (err) {
    logger.error({ err }, 'Failed to create product');
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.put('/api/products/:id', async (req: Request, res: Response) => {
  const productId = String(req.params.id || '').trim();
  const { name, icon, normalPrice, hhPrice, hhBonus, category, displayOrder, active } = req.body ?? {};
  try {
    const cat = await pool.query('SELECT id FROM categories WHERE name = $1', [category]);
    if (cat.rows.length === 0) { res.status(400).json({ error: 'Invalid category' }); return; }
    const result = await pool.query(
      `UPDATE products SET name=$1, icon=$2, normal_price=$3, hh_price=$4, hh_bonus=$5, category_id=$6, display_order=$7, active=$8
       WHERE id=$9
       RETURNING id, name, icon, normal_price, hh_price, hh_bonus, category_id, display_order, active`,
      [name, icon || '🛒', Number(normalPrice), Number(hhPrice), Boolean(hhBonus), cat.rows[0].id, Number(displayOrder), Boolean(active), productId],
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Product not found' }); return; }
    const realtimeServer = req.app.locals.realtimeServer as RealtimeServer | undefined;
    realtimeServer?.broadcast({ type: 'STATE_UPDATE', payload: { updatedAt: new Date().toISOString() } });
    res.json(mapProductRow({ ...result.rows[0], category, category_id: cat.rows[0].id }));
  } catch (err) {
    logger.error({ err, productId }, 'Failed to update product');
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/api/products/:id', async (req: Request, res: Response) => {
  const productId = String(req.params.id || '').trim();
  try {
    await pool.query('UPDATE products SET active = false WHERE id = $1', [productId]);
    const realtimeServer = req.app.locals.realtimeServer as RealtimeServer | undefined;
    realtimeServer?.broadcast({ type: 'STATE_UPDATE', payload: { updatedAt: new Date().toISOString() } });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, productId }, 'Failed to deactivate product');
    res.status(500).json({ error: 'Failed to deactivate product' });
  }
});

router.patch('/api/products/:id/prices', async (req: Request, res: Response) => {
  const productId = String(req.params.id || '').trim();
  const normalPrice = Number(req.body?.normalPrice);
  const hhPrice = Number(req.body?.hhPrice);

  if (!productId || Number.isNaN(normalPrice) || Number.isNaN(hhPrice) || normalPrice < 0 || hhPrice < 0) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE products
       SET normal_price = $1, hh_price = $2
       WHERE id = $3
       RETURNING id`,
      [normalPrice, hhPrice, productId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const realtimeServer = req.app.locals.realtimeServer as RealtimeServer | undefined;
    realtimeServer?.broadcast({
      type: 'STATE_UPDATE',
      payload: {
        prices: {
          [`${productId}_normal`]: Math.round(normalPrice * 100) / 100,
          [`${productId}_hh`]: Math.round(hhPrice * 100) / 100,
        },
        updatedAt: new Date().toISOString(),
      },
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, productId }, 'Failed to update prices');
    res.status(500).json({ error: 'Failed to update prices' });
  }
});

export default router;
