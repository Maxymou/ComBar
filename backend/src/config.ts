function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  port: readInt('PORT', 3001),

  presence: {
    sessionStaleTimeoutMs: readInt('PRESENCE_SESSION_STALE_MS', 75 * 1000),
    recentlyActiveWindowMs: readInt('PRESENCE_RECENTLY_ACTIVE_MS', 15 * 60 * 1000),
    cleanupIntervalMs: readInt('PRESENCE_CLEANUP_INTERVAL_MS', 15 * 1000),
  },

  realtime: {
    sseKeepAliveMs: readInt('SSE_KEEPALIVE_MS', 20 * 1000),
  },

  db: {
    waitRetries: readInt('DB_WAIT_RETRIES', 30),
    waitDelayMs: readInt('DB_WAIT_DELAY_MS', 2000),
  },

  debug: {
    adminToken: process.env.DEBUG_ADMIN_TOKEN || '',
    workdir: process.env.DEBUG_WORKDIR || '/opt/ComBar',
    updateTimeoutMs: readInt('DEBUG_UPDATE_TIMEOUT_MS', 5 * 60 * 1000),
    maxLogBytes: readInt('DEBUG_MAX_LOG_BYTES', 64 * 1024),
  },

  logLevel: process.env.LOG_LEVEL || 'info',
};
