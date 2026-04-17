import pool from '../db/pool';

export interface RealtimeState {
  prices: Record<string, number>;
  happyHour: boolean;
  clients: number;
  clientsCount: number;
  connectedDevices: ConnectedDevice[];
}

export interface ConnectedDevice {
  deviceId: string;
  deviceName: string;
  connectedAt: string;
}

const DEFAULT_STATE: RealtimeState = {
  prices: {},
  happyHour: false,
  clients: 0,
  clientsCount: 0,
  connectedDevices: [],
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

export function sanitizeState(value: unknown): RealtimeState {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_STATE };
  }

  const input = value as Partial<RealtimeState>;

  return {
    prices: sanitizePrices(input.prices),
    happyHour: Boolean(input.happyHour),
    clients: 0,
    clientsCount: 0,
    connectedDevices: [],
  };
}

export async function loadRealtimeState(): Promise<RealtimeState> {
  try {
    const result = await pool.query(
      `SELECT value FROM app_settings WHERE key = 'realtime_state' LIMIT 1`
    );

    if (result.rows.length === 0) {
      return { ...DEFAULT_STATE };
    }

    return sanitizeState(result.rows[0].value);
  } catch (err) {
    console.error('[Realtime] Failed to load state from DB:', err);
    return { ...DEFAULT_STATE };
  }
}

export async function persistRealtimeState(state: RealtimeState): Promise<void> {
  const persisted = {
    prices: sanitizePrices(state.prices),
    happyHour: Boolean(state.happyHour),
  };

  await pool.query(
    `INSERT INTO app_settings(key, value)
     VALUES ('realtime_state', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(persisted)]
  );
}
