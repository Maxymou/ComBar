import pool from '../db/pool';
import { PresenceDevice } from './presence';
import { logger } from '../logger';

export interface RealtimePresenceSnapshot {
  connectedCount: number;
  connected: PresenceDevice[];
  recentlyActive: PresenceDevice[];
}

export interface RealtimeState {
  prices: Record<string, number>;
  happyHour: boolean;
  clients: number;
  clientsCount: number;
  connectedDevices: PresenceDevice[];
  presence: RealtimePresenceSnapshot;
  version: number;
  updatedAt: string;
}

const DEFAULT_STATE: RealtimeState = {
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
  updatedAt: new Date(0).toISOString(),
};

function sanitizePrices(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};

  const input = value as Record<string, unknown>;
  const sanitized: Record<string, number> = {};

  for (const [key, raw] of Object.entries(input)) {
    if (typeof raw !== 'number' || Number.isNaN(raw) || raw < 0) continue;
    sanitized[key] = Math.round(raw * 100) / 100;
  }

  return sanitized;
}

function sanitizeUpdatedAt(value: unknown): string {
  if (typeof value !== 'string') {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

export function sanitizeState(value: unknown): RealtimeState {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_STATE, updatedAt: new Date().toISOString() };
  }

  const input = value as Partial<RealtimeState>;

  return {
    prices: sanitizePrices(input.prices),
    happyHour: Boolean(input.happyHour),
    clients: 0,
    clientsCount: 0,
    connectedDevices: [],
    presence: {
      connectedCount: 0,
      connected: [],
      recentlyActive: [],
    },
    version: typeof input.version === 'number' && Number.isFinite(input.version) ? Math.max(0, Math.floor(input.version)) : 0,
    updatedAt: sanitizeUpdatedAt(input.updatedAt),
  };
}

export async function loadRealtimeState(): Promise<RealtimeState> {
  try {
    const result = await pool.query(
      `SELECT value FROM app_settings WHERE key = 'realtime_state' LIMIT 1`
    );

    if (result.rows.length === 0) {
      return { ...DEFAULT_STATE, updatedAt: new Date().toISOString() };
    }

    return sanitizeState(result.rows[0].value);
  } catch (err) {
    logger.error({ err }, 'Failed to load realtime state from DB');
    return { ...DEFAULT_STATE, updatedAt: new Date().toISOString() };
  }
}

export async function persistRealtimeState(state: RealtimeState): Promise<void> {
  const persisted = {
    prices: sanitizePrices(state.prices),
    happyHour: Boolean(state.happyHour),
    version: Math.max(0, Math.floor(state.version || 0)),
    updatedAt: sanitizeUpdatedAt(state.updatedAt),
  };

  await pool.query(
    `INSERT INTO app_settings(key, value)
     VALUES ('realtime_state', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(persisted)]
  );
}
