import express, { Request, Response } from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
import { initDatabase } from './db/init';
import pool from './db/pool';
import {
  RealtimeState,
  loadRealtimeState,
  persistRealtimeState,
  sanitizeState,
} from './realtime/state';
import { PresenceRegistry, sanitizeIdentity } from './realtime/presence';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use(healthRouter);
app.use(productsRouter);
app.use(ordersRouter);

const presenceRegistry = new PresenceRegistry();

let realtimeState: RealtimeState = {
  prices: {},
  happyHour: false,
  clients: 0,
  clientsCount: 0,
  connectedDevices: [],
  presence: {
    connectedCount: 0,
    connected: [],
    recentlyActive: [],
  },
};

function writeSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcast(event: string, data: unknown): void {
  presenceRegistry.forEachConnectedResponse(response => {
    writeSse(response, event, data);
  });
}

function rebuildPresenceState(): void {
  const snapshot = presenceRegistry.snapshot();
  realtimeState = {
    ...realtimeState,
    clients: snapshot.connectedCount,
    clientsCount: snapshot.connectedCount,
    connectedDevices: snapshot.connected,
    presence: snapshot,
  };
}

function broadcastState(): void {
  rebuildPresenceState();
  broadcast('state', realtimeState);
}

function broadcastClients(): void {
  rebuildPresenceState();
  broadcast('clients', realtimeState.clientsCount);
}

app.get('/api/realtime/state', (_req: Request, res: Response) => {
  rebuildPresenceState();
  res.json(realtimeState);
});

app.post('/api/realtime/presence/heartbeat', (req: Request, res: Response) => {
  const identity = sanitizeIdentity(String(req.body?.deviceId || ''), String(req.body?.deviceName || ''));
  presenceRegistry.markSeen(identity.deviceId, identity.deviceName);
  rebuildPresenceState();
  res.status(200).json({ ok: true });
});

app.post('/api/realtime/presence/rename', (req: Request, res: Response) => {
  const identity = sanitizeIdentity(String(req.body?.deviceId || ''), String(req.body?.deviceName || ''));
  presenceRegistry.renameDevice(identity.deviceId, identity.deviceName);
  presenceRegistry.markSeen(identity.deviceId, identity.deviceName);
  broadcastState();
  broadcastClients();
  res.status(200).json({ ok: true, deviceName: identity.deviceName });
});

app.get('/api/realtime/stream', (req: Request, res: Response) => {
  const identity = sanitizeIdentity(String(req.query.deviceId || ''), String(req.query.deviceName || ''));

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  presenceRegistry.registerConnection({
    response: res,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
  });
  presenceRegistry.markSeen(identity.deviceId, identity.deviceName);

  rebuildPresenceState();
  writeSse(res, 'state', realtimeState);
  broadcastState();
  broadcastClients();

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
    presenceRegistry.markSeen(identity.deviceId, identity.deviceName);
    rebuildPresenceState();
  }, 20000);

  res.on('close', () => {
    clearInterval(keepAlive);
    presenceRegistry.disconnect(identity.deviceId, res);
    rebuildPresenceState();
    broadcastState();
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
      presence: {
        connectedCount: 0,
        connected: [],
        recentlyActive: [],
      },
    };

    setInterval(() => {
      presenceRegistry.cleanupExpired();
      rebuildPresenceState();
      broadcastState();
      broadcastClients();
    }, 15000);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Fatal error:', err);
    process.exit(1);
  }
}

start();
