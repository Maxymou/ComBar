import { Router, Request, Response, NextFunction } from 'express';
import pool from '../db/pool';
import { config } from '../config';

const router = Router();

type UpdateMode = 'normal' | 'force-pwa';

function requireDebugToken(req: Request, res: Response, next: NextFunction): void {
  const expected = config.debug.adminToken;
  if (!expected) {
    next();
    return;
  }
  const provided = req.header('x-debug-token') || req.header('X-Debug-Token');
  if (!provided || provided !== expected) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }
  next();
}

async function fetchHostApi(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; payload: any }> {
  try {
    const res = await fetch(`${config.debug.hostApiUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
    const text = await res.text();
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }
    return { ok: res.ok, status: res.status, payload };
  } catch (err) {
    return {
      ok: false,
      status: 503,
      payload: {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

router.get('/api/debug/health', requireDebugToken, async (_req, res) => {
  const startedAt = new Date().toISOString();
  let dbState: 'connected' | 'disconnected' = 'disconnected';
  let dbError: string | undefined;

  try {
    await pool.query('SELECT 1');
    dbState = 'connected';
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const hostApiResult = await fetchHostApi('/status', { method: 'GET' });

  res.json({
    ok: dbState === 'connected',
    timestamp: startedAt,
    uptime: process.uptime(),
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'development',
    cwd: process.cwd(),
    workdir: config.debug.workdir,
    db: dbState,
    dbError,
    hostApi: {
      available: hostApiResult.ok,
      url: config.debug.hostApiUrl,
      status: hostApiResult.payload,
      error: hostApiResult.ok ? undefined : "Host API indisponible. Le service combar-debug-host-api n’est pas démarré sur l’hôte.",
    },
  });
});

router.post('/api/debug/update', requireDebugToken, async (req, res) => {
  const mode = req.body?.mode as UpdateMode;
  if (mode !== 'normal' && mode !== 'force-pwa') {
    res.status(400).json({ ok: false, error: `Mode invalide: ${String(mode)}` });
    return;
  }

  const hostApiResult = await fetchHostApi('/update', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });

  const payload = hostApiResult.payload || { ok: false, error: 'Réponse invalide Host API' };
  if (!hostApiResult.ok && typeof payload.error === 'string') {
    if (payload.error.includes('spawn git ENOENT')) {
      payload.error = 'La commande git a été lancée depuis le conteneur backend. Il faut démarrer la Host API sur l’hôte.';
    } else if (payload.error.includes('ECONNREFUSED')) {
      payload.error = 'Host API indisponible sur l’hôte.';
    } else if (payload.error.includes('spawn docker ENOENT')) {
      payload.error = 'Docker CLI introuvable sur l’hôte ou dans le PATH du service.';
    }
  }

  res.status(hostApiResult.ok ? 200 : hostApiResult.status).json(payload);
});

export default router;
