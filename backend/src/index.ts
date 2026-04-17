import express, { Request, Response } from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
import { initDatabase } from './db/init';
import pool from './db/pool';
import {
  ConnectedDevice,
  RealtimeState,
  loadRealtimeState,
  persistRealtimeState,
  sanitizeState,
} from './realtime/state';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use(healthRouter);
app.use(productsRouter);
app.use(ordersRouter);

let realtimeState: RealtimeState = {
  prices: {},
  happyHour: false,
  clients: 0,
  clientsCount: 0,
  connectedDevices: [],
};

interface SseClient {
  response: Response;
  deviceId: string;
  deviceName: string;
  connectedAt: string;
}

const sseClientsByDevice = new Map<string, SseClient>();

function writeSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcast(event: string, data: unknown): void {
  for (const client of sseClientsByDevice.values()) {
    writeSse(client.response, event, data);
  }
}

function broadcastState(): void {
  broadcast('state', realtimeState);
}

function broadcastClients(): void {
  broadcast('clients', realtimeState.clientsCount);
}

function getConnectedDevicesSnapshot(): ConnectedDevice[] {
  return Array.from(sseClientsByDevice.values()).map(client => ({
    deviceId: client.deviceId,
    deviceName: client.deviceName,
    connectedAt: client.connectedAt,
  }));
}

function refreshConnectedClientsState(): void {
  const connectedDevices = getConnectedDevicesSnapshot();
  const clientsCount = connectedDevices.length;
  realtimeState = {
    ...realtimeState,
    clients: clientsCount,
    clientsCount,
    connectedDevices,
  };
}

app.get('/api/realtime/state', (_req: Request, res: Response) => {
  res.json(realtimeState);
});

app.get('/api/realtime/stream', (req: Request, res: Response) => {
  const rawDeviceId = String(req.query.deviceId || '').trim();
  const rawDeviceName = String(req.query.deviceName || '').trim();
  const deviceId = rawDeviceId || `anon-${crypto.randomUUID()}`;
  const deviceName = rawDeviceName || `Terminal ${deviceId.slice(-4).toUpperCase()}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const existingClient = sseClientsByDevice.get(deviceId);
  if (existingClient) {
    existingClient.response.end();
    sseClientsByDevice.delete(deviceId);
  }

  sseClientsByDevice.set(deviceId, {
    response: res,
    deviceId,
    deviceName,
    connectedAt: new Date().toISOString(),
  });
  refreshConnectedClientsState();
  writeSse(res, 'state', realtimeState);
  broadcastClients();

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 20000);

  res.on('close', () => {
    clearInterval(keepAlive);
    const currentClient = sseClientsByDevice.get(deviceId);
    if (currentClient?.response === res) {
      sseClientsByDevice.delete(deviceId);
    }
    refreshConnectedClientsState();
    broadcastClients();
  });
});

app.post('/api/realtime/prices', async (req: Request, res: Response) => {
  const nextState = sanitizeState({ ...realtimeState, prices: req.body?.prices });
  realtimeState = {
    ...realtimeState,
    prices: nextState.prices,
  };

  broadcastState();

  try {
    await persistRealtimeState(realtimeState);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Realtime] Failed to persist prices update:', err);
    res.status(500).json({ error: 'Failed to persist prices' });
  }
});

app.post('/api/realtime/happy-hour', async (req: Request, res: Response) => {
  realtimeState = {
    ...realtimeState,
    happyHour: Boolean(req.body?.happyHour),
  };

  broadcastState();

  try {
    await persistRealtimeState(realtimeState);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Realtime] Failed to persist happy hour update:', err);
    res.status(500).json({ error: 'Failed to persist happy hour' });
  }
});

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

    const persisted = await loadRealtimeState();
    realtimeState = {
      ...persisted,
      clients: 0,
      clientsCount: 0,
      connectedDevices: [],
    };

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Fatal error:', err);
    process.exit(1);
  }
}

start();
