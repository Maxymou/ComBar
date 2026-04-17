import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { RealtimeServer } from '../realtime/server';

const router = Router();

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
    const products = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      normalPrice: parseFloat(r.normal_price),
      hhPrice: parseFloat(r.hh_price),
      hhBonus: r.hh_bonus,
      category: r.category,
      displayOrder: r.display_order,
    }));
    res.json(products);
  } catch (err) {
    console.error('[Products] Error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
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
    console.error('[Products] Error while updating prices:', err);
    res.status(500).json({ error: 'Failed to update prices' });
  }
});

export default router;
