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
  clientOrderId?: string;
  clientId?: string;
  total: number;
  isHappyHour: boolean;
  paymentGiven?: number;
  paymentChange?: number;
  lines: OrderLineInput[];
  syncedFromOffline?: boolean;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  serverTotal: number;
  clientPriced: boolean;
}

/**
 * Validate and prepare an order. Returns server-computed total and client_priced flag.
 */
async function validateOrder(body: OrderInput): Promise<ValidationResult> {
  if (!body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
    return { valid: false, error: 'Order must have at least one line', serverTotal: 0, clientPriced: false };
  }
  if (typeof body.isHappyHour !== 'boolean') {
    return { valid: false, error: 'isHappyHour must be a boolean', serverTotal: 0, clientPriced: false };
  }

  // Load product prices from DB for comparison
  const productIds = body.lines.map(l => l.productId).filter(id => id && id !== '_bonus');
  let dbPrices: Record<string, { normalPrice: number; hhPrice: number }> = {};
  if (productIds.length > 0) {
    const result = await pool.query(
      `SELECT id, normal_price, hh_price FROM products WHERE id = ANY($1)`,
      [productIds]
    );
    for (const row of result.rows) {
      dbPrices[row.id] = {
        normalPrice: parseFloat(row.normal_price),
        hhPrice: parseFloat(row.hh_price),
      };
    }
  }

  let serverTotal = 0;
  let clientPriced = false;

  for (let i = 0; i < body.lines.length; i++) {
    const line = body.lines[i];

    if (typeof line.quantity !== 'number' || !Number.isInteger(line.quantity) || line.quantity <= 0) {
      return { valid: false, error: `Line ${i}: quantity must be a positive integer`, serverTotal: 0, clientPriced: false };
    }
    if (typeof line.unitPrice !== 'number' || line.unitPrice < 0) {
      return { valid: false, error: `Line ${i}: unitPrice must be >= 0`, serverTotal: 0, clientPriced: false };
    }

    // Verify subtotal = quantity * unitPrice (tolerance for float rounding)
    const expectedSubtotal = Math.round(line.quantity * line.unitPrice * 100) / 100;
    if (typeof line.subtotal !== 'number' || Math.abs(line.subtotal - expectedSubtotal) > 0.01) {
      // Recalculate — don't trust client subtotal
      line.subtotal = expectedSubtotal;
    }

    serverTotal += line.subtotal;

    // Check if price matches DB price (skip bonus lines)
    if (line.productId && line.productId !== '_bonus' && dbPrices[line.productId]) {
      const dbPrice = body.isHappyHour
        ? dbPrices[line.productId].hhPrice
        : dbPrices[line.productId].normalPrice;
      if (Math.abs(line.unitPrice - dbPrice) > 0.01) {
        clientPriced = true;
      }
    }
  }

  serverTotal = Math.round(serverTotal * 100) / 100;

  // Log warning if client total doesn't match
  if (typeof body.total === 'number' && Math.abs(body.total - serverTotal) > 0.01) {
    console.warn(`[Orders] Total mismatch: client=${body.total}, server=${serverTotal}`);
  }

  return { valid: true, serverTotal, clientPriced };
}

/**
 * Insert an order idempotently using client_order_id.
 * Returns { id, alreadyExisted }.
 */
async function insertOrderIdempotent(
  client: import('pg').PoolClient,
  body: OrderInput,
  serverTotal: number,
  clientPriced: boolean,
  syncedFromOffline: boolean
): Promise<{ id: number; alreadyExisted: boolean }> {
  const clientOrderId = body.clientOrderId ?? null;

  // If we have a clientOrderId, check for existing order first
  if (clientOrderId) {
    const existing = await client.query(
      `SELECT id FROM orders WHERE client_order_id = $1`,
      [clientOrderId]
    );
    if (existing.rows.length > 0) {
      return { id: existing.rows[0].id, alreadyExisted: true };
    }
  }

  const orderResult = await client.query(
    `INSERT INTO orders (client_order_id, client_id, total, is_happy_hour, payment_given, payment_change, synced_from_offline, client_priced)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      clientOrderId,
      body.clientId ?? null,
      serverTotal,
      body.isHappyHour ?? false,
      body.paymentGiven ?? null,
      body.paymentChange ?? null,
      syncedFromOffline,
      clientPriced,
    ]
  );

  const orderId = orderResult.rows[0].id;

  for (const line of body.lines) {
    await client.query(
      `INSERT INTO order_lines (order_id, product_id, product_name, quantity, unit_price, subtotal, is_bonus)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [orderId, line.productId, line.productName, line.quantity, line.unitPrice, line.subtotal, line.isBonus ?? false]
    );
  }

  return { id: orderId, alreadyExisted: false };
}

// POST /api/orders — Create a single order (idempotent via clientOrderId)
router.post('/api/orders', async (req: Request, res: Response) => {
  const body = req.body as OrderInput;

  const validation = await validateOrder(body);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id, alreadyExisted } = await insertOrderIdempotent(
      client, body, validation.serverTotal, validation.clientPriced, body.syncedFromOffline ?? false
    );
    await client.query('COMMIT');
    res.status(alreadyExisted ? 200 : 201).json({ id, status: alreadyExisted ? 'existing' : 'created' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Orders] Error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

// POST /api/orders/sync — Batch sync offline orders (idempotent per order)
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
        const validation = await validateOrder(body);
        if (!validation.valid) {
          results.push({ index: i, error: validation.error });
          continue;
        }

        await client.query('BEGIN');
        const { id } = await insertOrderIdempotent(
          client, body, validation.serverTotal, validation.clientPriced, true
        );
        await client.query('COMMIT');
        results.push({ index: i, id });
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
