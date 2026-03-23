import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
import { initDatabase } from './db/init';
import pool from './db/pool';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use(healthRouter);
app.use(productsRouter);
app.use(ordersRouter);

async function waitForDb(retries = 30, delay = 2000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('[DB] Connection established.');
      return;
    } catch {
      console.log(`[DB] Waiting for database... (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Could not connect to database after retries');
}

async function start(): Promise<void> {
  try {
    await waitForDb();
    await initDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Fatal error:', err);
    process.exit(1);
  }
}

start();
