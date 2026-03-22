import { Router, Request, Response } from 'express';
import pool from '../db/pool';

const router = Router();

interface OrderLineInput {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isBonus?: boolean;
}

interface OrderInput {
  clientId?: string;
  total: number;
  isHappyHour: boolean;
  paymentGiven?: number;
  paymentChange?: number;
  lines: OrderLineInput[];
  syncedFromOffline?: boolean;
}

router.post('/api/orders', async (req: Request, res: Response) => {
  const body = req.body as OrderInput;

  if (!body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
    res.status(400).json({ error: 'Order must have at least one line' });
    return;
  }
  if (typeof body.total !== 'number' || body.total < 0) {
    res.status(400).json({ error: 'Invalid total' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO orders (client_id, total, is_happy_hour, payment_given, payment_change, synced_from_offline)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        body.clientId || null,
        body.total,
        body.isHappyHour || false,
        body.paymentGiven || null,
        body.paymentChange || null,
        body.syncedFromOffline || false,
      ]
    );
    const orderId = orderResult.rows[0].id;

    for (const line of body.lines) {
      await client.query(
        `INSERT INTO order_lines (order_id, product_id, product_name, quantity, unit_price, subtotal, is_bonus)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, line.productId, line.productName, line.quantity, line.unitPrice, line.subtotal, line.isBonus || false]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: orderId, status: 'created' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Orders] Error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

router.post('/api/orders/sync', async (req: Request, res: Response) => {
  const orders = req.body as OrderInput[];

  if (!Array.isArray(orders)) {
    res.status(400).json({ error: 'Expected array of orders' });
    return;
  }

  const results: { index: number; id?: number; error?: string }[] = [];
  const client = await pool.connect();

  try {
    for (let i = 0; i < orders.length; i++) {
      const body = orders[i];
      try {
        await client.query('BEGIN');

        const orderResult = await client.query(
          `INSERT INTO orders (client_id, total, is_happy_hour, payment_given, payment_change, synced_from_offline)
           VALUES ($1, $2, $3, $4, $5, true)
           RETURNING id`,
          [
            body.clientId || null,
            body.total,
            body.isHappyHour || false,
            body.paymentGiven || null,
            body.paymentChange || null,
          ]
        );
        const orderId = orderResult.rows[0].id;

        for (const line of body.lines) {
          await client.query(
            `INSERT INTO order_lines (order_id, product_id, product_name, quantity, unit_price, subtotal, is_bonus)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [orderId, line.productId, line.productName, line.quantity, line.unitPrice, line.subtotal, line.isBonus || false]
          );
        }

        await client.query('COMMIT');
        results.push({ index: i, id: orderId });
      } catch (err) {
        await client.query('ROLLBACK');
        results.push({ index: i, error: 'Failed to sync order' });
      }
    }

    res.json({ synced: results });
  } finally {
    client.release();
  }
});

export default router;
