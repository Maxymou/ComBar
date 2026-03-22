import { Router, Request, Response } from 'express';
import pool from '../db/pool';

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

export default router;
