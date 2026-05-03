#!/usr/bin/env node
const http = require('http');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');

const COMBAR_ROOT = process.env.COMBAR_ROOT || '/opt/ComBar';
const PORT = Number.parseInt(process.env.COMBAR_DEBUG_HOST_API_PORT || '4878', 10);
const BIND = process.env.COMBAR_DEBUG_HOST_API_BIND || '127.0.0.1';
const MAX_LOG_BYTES = Number.parseInt(process.env.COMBAR_DEBUG_MAX_LOG_BYTES || String(64 * 1024), 10);
const UPDATE_TIMEOUT_MS = Number.parseInt(process.env.COMBAR_DEBUG_UPDATE_TIMEOUT_MS || String(5 * 60 * 1000), 10);
const STATUS_TIMEOUT_MS = Number.parseInt(process.env.COMBAR_DEBUG_STATUS_TIMEOUT_MS || '4000', 10);

let isUpdateRunning = false;

function truncateLog(text, maxBytes) {
  if (!text) return '';
  const size = Buffer.byteLength(text, 'utf8');
  if (size <= maxBytes) return text;
  const buf = Buffer.from(text, 'utf8');
  const half = Math.floor(maxBytes / 2);
  const head = buf.slice(0, half).toString('utf8');
  const tail = buf.slice(buf.length - half).toString('utf8');
  return `${head}\n...[truncated ${size - maxBytes} bytes]...\n${tail}`;
}

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let outBytes = 0;
    let errBytes = 0;
    let settled = false;
    let timedOut = false;

    const finish = (exitCode, error) => {
      if (settled) return;
      settled = true;
      resolve({
        cmd,
        args,
        exitCode,
        stdout: truncateLog(stdout, MAX_LOG_BYTES),
        stderr: truncateLog(stderr, MAX_LOG_BYTES),
        error,
        timedOut: timedOut || undefined,
      });
    };

    let child;
    try {
      child = spawn(cmd, args, {
        cwd: COMBAR_ROOT,
        env: { ...process.env, ...(options.env || {}) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      finish(null, err instanceof Error ? err.message : String(err));
      return;
    }

    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : UPDATE_TIMEOUT_MS;
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGKILL'); } catch (_) {}
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      outBytes += Buffer.byteLength(text, 'utf8');
      if (outBytes <= MAX_LOG_BYTES * 2) stdout += text;
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      errBytes += Buffer.byteLength(text, 'utf8');
      if (errBytes <= MAX_LOG_BYTES * 2) stderr += text;
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      finish(null, err.message);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      finish(code, timedOut ? 'Timeout exceeded, process killed' : undefined);
    });
  });
}

async function runStatus() {
  const checks = await Promise.all([
    runCommand('git', ['--version'], { timeoutMs: STATUS_TIMEOUT_MS }),
    runCommand('docker', ['--version'], { timeoutMs: STATUS_TIMEOUT_MS }),
    runCommand('docker', ['compose', 'version'], { timeoutMs: STATUS_TIMEOUT_MS }),
  ]);

  return {
    available: true,
    cwd: COMBAR_ROOT,
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    rootExists: fs.existsSync(COMBAR_ROOT),
    gitAvailable: checks[0].exitCode === 0,
    dockerAvailable: checks[1].exitCode === 0 && checks[2].exitCode === 0,
    checks: {
      git: checks[0],
      docker: checks[1],
      dockerCompose: checks[2],
    },
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk.toString();
      if (raw.length > 1024 * 1024) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function send(res, code, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/status') {
    const status = await runStatus();
    send(res, 200, status);
    return;
  }

  if (req.method === 'POST' && req.url === '/update') {
    if (isUpdateRunning) {
      send(res, 409, { ok: false, error: 'Update already running' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      send(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
      return;
    }

    const mode = body && body.mode;
    if (mode !== 'normal' && mode !== 'force-pwa') {
      send(res, 400, { ok: false, error: `Invalid mode: ${String(mode)}` });
      return;
    }

    const cacheBust = String(Date.now());
    const scripts = {
      normal: [
        { cmd: 'git', args: ['pull'] },
        { cmd: 'docker', args: ['compose', 'up', '-d', '--build'] },
      ],
      'force-pwa': [
        { cmd: 'git', args: ['pull', 'origin', 'main'] },
        { cmd: 'docker', args: ['compose', 'up', '-d', '--build'], options: { env: { CACHE_BUST: cacheBust } } },
        { cmd: 'docker', args: ['compose', 'ps'] },
        { cmd: 'curl', args: ['http://127.0.0.1:8080/health'] },
      ],
    };

    isUpdateRunning = true;
    const startedAt = new Date().toISOString();
    const steps = [];

    try {
      for (const step of scripts[mode]) {
        const result = await runCommand(step.cmd, step.args, step.options || {});
        steps.push(result);
        if (result.exitCode !== 0) break;
      }

      const finishedAt = new Date().toISOString();
      const ok = steps.length > 0 && steps.every((s) => s.exitCode === 0);
      const last = steps[steps.length - 1];
      send(res, ok ? 200 : 500, {
        ok,
        mode,
        startedAt,
        finishedAt,
        exitCode: last ? last.exitCode : null,
        stdout: truncateLog(steps.map((s) => `$ ${s.cmd} ${s.args.join(' ')}\n${s.stdout}`.trim()).join('\n\n'), MAX_LOG_BYTES),
        stderr: truncateLog(steps.filter((s) => s.stderr || s.error).map((s) => `$ ${s.cmd} ${s.args.join(' ')}\n${s.stderr || ''}${s.error ? `\n[err] ${s.error}` : ''}`.trim()).join('\n\n'), MAX_LOG_BYTES),
        error: ok ? undefined : (last && (last.error || 'A step failed')),
        steps,
      });
    } finally {
      isUpdateRunning = false;
    }
    return;
  }

  send(res, 404, { ok: false, error: 'Not found' });
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`[ComBar Debug Host API] Port ${PORT} déjà utilisé sur ${BIND}. Le service est peut-être déjà lancé.`);
  } else {
    console.error('[ComBar Debug Host API] server error', err);
  }
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('[ComBar Debug Host API] uncaughtException', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('[ComBar Debug Host API] unhandledRejection', err);
  process.exit(1);
});

console.log(`[ComBar Debug Host API] root=${COMBAR_ROOT} bind=${BIND} port=${PORT}`);

server.listen(PORT, BIND, () => {
  process.stdout.write(`[ComBar Debug Host API] listening on http://${BIND}:${PORT}\n`);
});
