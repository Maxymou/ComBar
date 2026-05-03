import { Router, Request, Response, NextFunction } from 'express';
import { spawn, ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'child_process';
import pool from '../db/pool';
import { config } from '../config';
import { logger } from '../logger';

const router = Router();

type UpdateMode = 'normal' | 'force-pwa';

interface CommandStep {
  cmd: string;
  args: string[];
  options?: SpawnOptionsWithoutStdio;
}

interface CommandResult {
  cmd: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
  timedOut?: boolean;
}

let isUpdateRunning = false;

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

function truncateLog(text: string, maxBytes: number): string {
  if (!text) return '';
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) {
    return text;
  }
  const buf = Buffer.from(text, 'utf8');
  const head = buf.slice(0, Math.floor(maxBytes / 2)).toString('utf8');
  const tail = buf.slice(buf.length - Math.floor(maxBytes / 2)).toString('utf8');
  return `${head}\n...[tronqué ${buf.length - maxBytes} octets]...\n${tail}`;
}

function runCommand(
  cmd: string,
  args: string[],
  options: SpawnOptionsWithoutStdio = {},
  timeoutMs: number,
  maxBytes: number,
): Promise<CommandResult> {
  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    let settled = false;

    const finish = (exitCode: number | null, error?: string) => {
      if (settled) return;
      settled = true;
      resolve({
        cmd,
        args,
        exitCode,
        stdout: truncateLog(stdout, maxBytes),
        stderr: truncateLog(stderr, maxBytes),
        error,
        timedOut: timedOut || undefined,
      });
    };

    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(cmd, args, {
        cwd: config.debug.workdir,
        ...options,
        env: { ...process.env, ...(options.env || {}) },
      });
    } catch (err) {
      finish(null, err instanceof Error ? err.message : String(err));
      return;
    }

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, timeoutMs);

    child.stdout?.on('data', chunk => {
      const text = chunk.toString();
      stdoutBytes += Buffer.byteLength(text, 'utf8');
      if (stdoutBytes <= maxBytes * 2) {
        stdout += text;
      }
    });

    child.stderr?.on('data', chunk => {
      const text = chunk.toString();
      stderrBytes += Buffer.byteLength(text, 'utf8');
      if (stderrBytes <= maxBytes * 2) {
        stderr += text;
      }
    });

    child.on('error', err => {
      clearTimeout(timer);
      finish(null, err.message);
    });

    child.on('close', code => {
      clearTimeout(timer);
      finish(code, timedOut ? 'Timeout dépassé, processus interrompu' : undefined);
    });
  });
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

  let dockerPs: CommandResult | null = null;
  try {
    dockerPs = await runCommand(
      'docker',
      ['compose', 'ps'],
      {},
      5000,
      8 * 1024,
    );
  } catch (err) {
    dockerPs = {
      cmd: 'docker',
      args: ['compose', 'ps'],
      exitCode: null,
      stdout: '',
      stderr: '',
      error: err instanceof Error ? err.message : String(err),
    };
  }

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
    dockerPs: dockerPs
      ? {
          ok: dockerPs.exitCode === 0,
          stdout: dockerPs.stdout,
          stderr: dockerPs.stderr,
          error: dockerPs.error,
        }
      : undefined,
  });
});

router.post('/api/debug/update', requireDebugToken, async (req, res) => {
  const mode = req.body?.mode as UpdateMode;

  if (mode !== 'normal' && mode !== 'force-pwa') {
    res.status(400).json({ ok: false, error: `Mode invalide: ${String(mode)}` });
    return;
  }

  if (isUpdateRunning) {
    res.status(409).json({ ok: false, error: 'Une mise à jour est déjà en cours' });
    return;
  }

  isUpdateRunning = true;
  const startedAt = new Date().toISOString();

  const cacheBust = String(Date.now());
  const scripts: Record<UpdateMode, CommandStep[]> = {
    normal: [
      { cmd: 'git', args: ['pull'] },
      { cmd: 'docker', args: ['compose', 'up', '-d', '--build'] },
    ],
    'force-pwa': [
      { cmd: 'git', args: ['pull', 'origin', 'main'] },
      {
        cmd: 'docker',
        args: ['compose', 'up', '-d', '--build'],
        options: { env: { CACHE_BUST: cacheBust } },
      },
      { cmd: 'docker', args: ['compose', 'ps'] },
      { cmd: 'curl', args: ['-sS', '--max-time', '10', 'http://127.0.0.1:8080/health'] },
    ],
  };

  const steps = scripts[mode];
  const results: CommandResult[] = [];
  const maxBytes = config.debug.maxLogBytes;

  try {
    for (const step of steps) {
      const result = await runCommand(
        step.cmd,
        step.args,
        step.options || {},
        config.debug.updateTimeoutMs,
        maxBytes,
      );
      results.push(result);
      if (result.exitCode !== 0) {
        break;
      }
    }

    const finishedAt = new Date().toISOString();
    const last = results[results.length - 1];
    const aggregatedStdout = truncateLog(
      results
        .map(r => `$ ${r.cmd} ${r.args.join(' ')}\n${r.stdout}`.trim())
        .join('\n\n'),
      maxBytes,
    );
    const aggregatedStderr = truncateLog(
      results
        .filter(r => r.stderr || r.error)
        .map(r => `$ ${r.cmd} ${r.args.join(' ')}\n${r.stderr || ''}${r.error ? `\n[err] ${r.error}` : ''}`.trim())
        .join('\n\n'),
      maxBytes,
    );

    const ok = results.length > 0 && results.every(r => r.exitCode === 0);

    res.status(ok ? 200 : 500).json({
      ok,
      mode,
      startedAt,
      finishedAt,
      exitCode: last ? last.exitCode : null,
      stdout: aggregatedStdout,
      stderr: aggregatedStderr,
      error: ok ? undefined : last?.error || 'Une étape a échoué',
      steps: results.map(r => ({
        cmd: r.cmd,
        args: r.args,
        exitCode: r.exitCode,
        stdout: r.stdout,
        stderr: r.stderr,
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Debug update failed');
    res.status(500).json({
      ok: false,
      mode,
      startedAt,
      finishedAt: new Date().toISOString(),
      exitCode: null,
      stdout: '',
      stderr: '',
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    isUpdateRunning = false;
  }
});

export default router;
