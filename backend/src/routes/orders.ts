import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { logger } from '../logger';

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
    logger.warn({ clientTotal: body.total, serverTotal }, 'Order total mismatch');
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
    logger.error({ err, clientOrderId: body.clientOrderId }, 'Failed to create order');
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

// GET /api/orders — Paginated list of orders
router.get('/api/orders', async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
  const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
  const offset = (page - 1) * limit;

  try {
    const [countResult, ordersResult] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM orders`),
      pool.query(
        `SELECT id, client_order_id, total, is_happy_hour, payment_given, payment_change,
                status, created_at, synced_from_offline, client_priced
         FROM orders
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const total = countResult.rows[0]?.total ?? 0;
    const orders = ordersResult.rows.map(r => ({
      id: r.id,
      clientOrderId: r.client_order_id,
      total: parseFloat(r.total),
      isHappyHour: r.is_happy_hour,
      paymentGiven: r.payment_given !== null ? parseFloat(r.payment_given) : null,
      paymentChange: r.payment_change !== null ? parseFloat(r.payment_change) : null,
      status: r.status,
      createdAt: r.created_at,
      syncedFromOffline: r.synced_from_offline,
      clientPriced: r.client_priced,
    }));

    res.json({ orders, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error({ err }, 'Failed to list orders');
    res.status(500).json({ error: 'Failed to list orders' });
  }
});

// GET /api/orders/export.csv — CSV export of all orders (with lines)
router.get('/api/orders/export.csv', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.client_order_id, o.total, o.is_happy_hour, o.payment_given,
              o.payment_change, o.status, o.created_at, o.synced_from_offline, o.client_priced,
              l.product_id, l.product_name, l.quantity, l.unit_price, l.subtotal, l.is_bonus
       FROM orders o
       LEFT JOIN order_lines l ON l.order_id = o.id
       ORDER BY o.created_at DESC, o.id DESC, l.id ASC`
    );

    const header = [
      'order_id', 'client_order_id', 'created_at', 'total', 'is_happy_hour',
      'payment_given', 'payment_change', 'status', 'synced_from_offline', 'client_priced',
      'product_id', 'product_name', 'quantity', 'unit_price', 'subtotal', 'is_bonus',
    ];

    const escape = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };

    const rows = result.rows.map(r => [
      r.id, r.client_order_id, r.created_at, r.total, r.is_happy_hour,
      r.payment_given, r.payment_change, r.status, r.synced_from_offline, r.client_priced,
      r.product_id, r.product_name, r.quantity, r.unit_price, r.subtotal, r.is_bonus,
    ].map(escape).join(','));

    const csv = [header.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.send(csv);
  } catch (err) {
    logger.error({ err }, 'Failed to export orders');
    res.status(500).json({ error: 'Failed to export orders' });
  }
});

// POST /api/orders/archive — Archive (delete) orders older than `before` ISO date
router.post('/api/orders/archive', async (req: Request, res: Response) => {
  const beforeRaw = String(req.body?.before ?? '').trim();
  const before = new Date(beforeRaw);
  if (!beforeRaw || Number.isNaN(before.getTime())) {
    res.status(400).json({ error: 'Invalid `before` ISO date' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `CREATE TABLE IF NOT EXISTS orders_archive (LIKE orders INCLUDING ALL);
       CREATE TABLE IF NOT EXISTS order_lines_archive (LIKE order_lines INCLUDING ALL);`
    );

    const moved = await client.query(
      `WITH moved AS (
         DELETE FROM orders WHERE created_at < $1 RETURNING *
       )
       INSERT INTO orders_archive SELECT * FROM moved RETURNING id`,
      [before.toISOString()]
    );

    await client.query('COMMIT');
    res.json({ archived: moved.rowCount ?? 0 });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, 'Failed to archive orders');
    res.status(500).json({ error: 'Failed to archive orders' });
  } finally {
    client.release();
  }
});

export default router;
