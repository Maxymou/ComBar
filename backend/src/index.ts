import express, { Request, Response } from 'express';
import path from 'node:path';
import cors from 'cors';
import pinoHttp from 'pino-http';
import healthRouter from './routes/health';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
import debugRouter from './routes/debug';
import { initDatabase } from './db/init';
import pool from './db/pool';
import {
  RealtimeState,
  loadRealtimeState,
  persistRealtimeState,
  sanitizeState,
} from './realtime/state';
import { PresenceRegistry, sanitizeIdentity, loadPresence, persistPresence } from './realtime/presence';
import { RealtimeServer } from './realtime/server';
import { config } from './config';
import { logger } from './logger';

const app = express();
const PORT = config.port;

app.use(pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'debug';
  },
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

const presenceRegistry = new PresenceRegistry();
const realtimeServer = new RealtimeServer();

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
  version: 0,
  updatedAt: new Date().toISOString(),
};

app.locals.realtimeServer = realtimeServer;

app.use(healthRouter);
app.use(productsRouter);
app.use(ordersRouter);
app.use(debugRouter);

if (!config.debug.adminToken) {
  logger.warn('DEBUG_ADMIN_TOKEN n’est pas défini : les routes /api/debug/* sont accessibles sans authentification. Ne pas exposer en public.');
}

function buildPresenceState(): RealtimeState {
  const snapshot = presenceRegistry.snapshot();
  return {
    ...realtimeState,
    clients: snapshot.connectedCount,
    clientsCount: snapshot.connectedCount,
    connectedDevices: snapshot.connected,
    presence: snapshot,
  };
}

function publishStateUpdate(): void {
  realtimeState = buildPresenceState();
  realtimeServer.broadcastState(realtimeState);
}

function publishPresenceUpdate(): void {
  const snapshot = presenceRegistry.snapshot();
  realtimeState = {
    ...realtimeState,
    clients: snapshot.connectedCount,
    clientsCount: snapshot.connectedCount,
    connectedDevices: snapshot.connected,
    presence: snapshot,
  };
  realtimeServer.broadcastPresence(snapshot.connected);
  void persistPresence(presenceRegistry).catch(err => {
    logger.warn({ err }, 'Failed to persist presence');
  });
}

function nextStateVersion(): number {
  return (realtimeState.version || 0) + 1;
}

function touchStateMetadata(): Pick<RealtimeState, 'version' | 'updatedAt'> {
  return {
    version: nextStateVersion(),
    updatedAt: new Date().toISOString(),
  };
}

app.get('/api/realtime/state', (_req: Request, res: Response) => {
  realtimeState = buildPresenceState();
  res.json(realtimeState);
});

app.post('/api/realtime/presence/heartbeat', (req: Request, res: Response) => {
  const identity = sanitizeIdentity(String(req.body?.deviceId || ''), String(req.body?.deviceName || ''));
  presenceRegistry.markSeen(identity.deviceId, identity.deviceName);
  publishPresenceUpdate();
  res.status(200).json({ ok: true });
});

app.post('/api/realtime/presence/rename', (req: Request, res: Response) => {
  const identity = sanitizeIdentity(String(req.body?.deviceId || ''), String(req.body?.deviceName || ''));
  presenceRegistry.renameDevice(identity.deviceId, identity.deviceName);
  presenceRegistry.markSeen(identity.deviceId, identity.deviceName);
  publishStateUpdate();
  publishPresenceUpdate();
  res.status(200).json({ ok: true, deviceName: identity.deviceName });
});

app.get('/api/realtime/stream', (req: Request, res: Response) => {
  const identity = sanitizeIdentity(String(req.query.deviceId || ''), String(req.query.deviceName || ''));

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  realtimeServer.connect(res);
  presenceRegistry.registerConnection({
    response: res,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
  });
  presenceRegistry.markSeen(identity.deviceId, identity.deviceName);

  realtimeState = buildPresenceState();
  realtimeServer.sendInitialState(res, realtimeState);
  publishPresenceUpdate();

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
    presenceRegistry.markSeen(identity.deviceId, identity.deviceName);
    realtimeState = buildPresenceState();
  }, config.realtime.sseKeepAliveMs);

  res.on('close', () => {
    clearInterval(keepAlive);
    realtimeServer.disconnect(res);
    presenceRegistry.disconnect(identity.deviceId, res);
    publishStateUpdate();
    publishPresenceUpdate();
  });
});

app.post('/api/realtime/prices', async (req: Request, res: Response) => {
  const nextState = sanitizeState({ ...realtimeState, prices: req.body?.prices });
  realtimeState = {
    ...realtimeState,
    prices: nextState.prices,
    ...touchStateMetadata(),
  };

  publishStateUpdate();

  try {
    await persistRealtimeState(realtimeState);
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Failed to persist prices update');
    res.status(500).json({ error: 'Failed to persist prices' });
  }
});

app.post('/api/realtime/happy-hour', async (req: Request, res: Response) => {
  realtimeState = {
    ...realtimeState,
    happyHour: Boolean(req.body?.happyHour),
    ...touchStateMetadata(),
  };

  publishStateUpdate();

  try {
    await persistRealtimeState(realtimeState);
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Failed to persist happy hour update');
    res.status(500).json({ error: 'Failed to persist happy hour' });
  }
});

async function waitForDb(retries = config.db.waitRetries, delay = config.db.waitDelayMs): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      logger.info('Database connection established');
      return;
    } catch {
      logger.info({ attempt: i + 1, retries }, 'Waiting for database');
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

    await loadPresence(presenceRegistry);

    setInterval(() => {
      presenceRegistry.cleanupExpired();
      realtimeState = buildPresenceState();
      publishPresenceUpdate();
    }, config.presence.cleanupIntervalMs);

    app.listen(PORT, '0.0.0.0', () => {
      logger.info({ port: PORT }, 'Server running');
    });
  } catch (err) {
    logger.fatal({ err }, 'Server fatal error');
    process.exit(1);
  }
}

start();
