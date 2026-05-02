import { config } from '../config';
import pool from '../db/pool';
import { logger } from '../logger';

export const RECENTLY_ACTIVE_WINDOW_MS = config.presence.recentlyActiveWindowMs;
const SESSION_STALE_TIMEOUT_MS = config.presence.sessionStaleTimeoutMs;
const PRESENCE_PERSIST_KEY = 'presence_known_devices';

const MIN_DEVICE_NAME_LENGTH = 1;
const MAX_DEVICE_NAME_LENGTH = 12;
const DEFAULT_DEVICE_NAME_PREFIX = 'Terminal';

export interface PresenceDevice {
  deviceId: string;
  deviceName: string;
  connected: boolean;
  connectedAt: string | null;
  lastSeenAt: string;
  lastDisconnectedAt: string | null;
}

interface PresenceSession {
  response: import('express').Response;
  deviceId: string;
  deviceName: string;
  connectedAt: string;
  lastSeenAt: string;
}

function sanitizeDeviceId(rawDeviceId: string): string {
  const trimmed = rawDeviceId.trim();
  return trimmed.length > 0 ? trimmed : crypto.randomUUID();
}

function buildDefaultDeviceName(deviceId: string): string {
  return `${DEFAULT_DEVICE_NAME_PREFIX} ${deviceId.slice(-2).toUpperCase()}`;
}

export function sanitizeDeviceName(rawDeviceName: string, fallbackDeviceId: string): string {
  const compact = rawDeviceName
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .slice(0, MAX_DEVICE_NAME_LENGTH)
    .trim();

  if (compact.length >= MIN_DEVICE_NAME_LENGTH) {
    return compact;
  }

  return buildDefaultDeviceName(fallbackDeviceId);
}

export function sanitizeIdentity(rawDeviceId: string, rawDeviceName: string): { deviceId: string; deviceName: string } {
  const deviceId = sanitizeDeviceId(rawDeviceId);
  const deviceName = sanitizeDeviceName(rawDeviceName, deviceId);
  return { deviceId, deviceName };
}

export class PresenceRegistry {
  private sessionsByDevice = new Map<string, PresenceSession>();

  private knownDevices = new Map<string, PresenceDevice>();

  registerConnection(session: { response: import('express').Response; deviceId: string; deviceName: string }): void {
    this.cleanupExpired();

    const nowIso = new Date().toISOString();
    const previous = this.sessionsByDevice.get(session.deviceId);
    if (previous && previous.response !== session.response) {
      previous.response.end();
      this.sessionsByDevice.delete(session.deviceId);
      this.markDisconnected(session.deviceId, nowIso);
    }

    this.sessionsByDevice.set(session.deviceId, {
      response: session.response,
      deviceId: session.deviceId,
      deviceName: session.deviceName,
      connectedAt: nowIso,
      lastSeenAt: nowIso,
    });

    this.knownDevices.set(session.deviceId, {
      deviceId: session.deviceId,
      deviceName: session.deviceName,
      connected: true,
      connectedAt: nowIso,
      lastSeenAt: nowIso,
      lastDisconnectedAt: null,
    });
  }

  disconnect(deviceId: string, response?: import('express').Response): void {
    const session = this.sessionsByDevice.get(deviceId);
    if (!session) {
      return;
    }

    if (response && session.response !== response) {
      return;
    }

    this.sessionsByDevice.delete(deviceId);
    this.markDisconnected(deviceId, new Date().toISOString());
  }

  markSeen(deviceId: string, maybeDeviceName?: string): void {
    const nowIso = new Date().toISOString();
    const session = this.sessionsByDevice.get(deviceId);

    if (session) {
      session.lastSeenAt = nowIso;
      if (maybeDeviceName && maybeDeviceName !== session.deviceName) {
        session.deviceName = maybeDeviceName;
      }
    }

    const known = this.knownDevices.get(deviceId);
    if (!known) {
      const fallbackName = maybeDeviceName ? sanitizeDeviceName(maybeDeviceName, deviceId) : buildDefaultDeviceName(deviceId);
      this.knownDevices.set(deviceId, {
        deviceId,
        deviceName: fallbackName,
        connected: Boolean(session),
        connectedAt: session ? session.connectedAt : null,
        lastSeenAt: nowIso,
        lastDisconnectedAt: session ? null : nowIso,
      });
      return;
    }

    known.lastSeenAt = nowIso;
    if (maybeDeviceName) {
      known.deviceName = maybeDeviceName;
    }
    known.connected = Boolean(session);
    known.connectedAt = session ? session.connectedAt : null;
  }

  renameDevice(deviceId: string, deviceName: string): boolean {
    const normalized = sanitizeDeviceName(deviceName, deviceId);
    const session = this.sessionsByDevice.get(deviceId);
    if (session) {
      session.deviceName = normalized;
      session.lastSeenAt = new Date().toISOString();
    }

    const known = this.knownDevices.get(deviceId);
    if (known) {
      known.deviceName = normalized;
      known.lastSeenAt = new Date().toISOString();
      return true;
    }

    return false;
  }


  forEachConnectedResponse(callback: (response: import('express').Response) => void): void {
    this.cleanupExpired();
    for (const session of this.sessionsByDevice.values()) {
      callback(session.response);
    }
  }

  snapshot(): { connected: PresenceDevice[]; recentlyActive: PresenceDevice[]; connectedCount: number } {
    this.cleanupExpired();
    const now = Date.now();

    const connected = Array.from(this.knownDevices.values())
      .filter(device => device.connected)
      .sort((a, b) => a.deviceName.localeCompare(b.deviceName));

    const recentlyActive = Array.from(this.knownDevices.values())
      .filter(device => !device.connected)
      .filter(device => now - new Date(device.lastSeenAt).getTime() <= RECENTLY_ACTIVE_WINDOW_MS)
      .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

    return {
      connected,
      recentlyActive,
      connectedCount: connected.length,
    };
  }

  cleanupExpired(): void {
    const now = Date.now();

    for (const [deviceId, session] of this.sessionsByDevice.entries()) {
      const sessionAge = now - new Date(session.lastSeenAt).getTime();
      if (sessionAge > SESSION_STALE_TIMEOUT_MS) {
        session.response.end();
        this.sessionsByDevice.delete(deviceId);
        this.markDisconnected(deviceId, new Date().toISOString());
      }
    }

    for (const [deviceId, known] of this.knownDevices.entries()) {
      const inactiveFor = now - new Date(known.lastSeenAt).getTime();
      if (!known.connected && inactiveFor > RECENTLY_ACTIVE_WINDOW_MS) {
        this.knownDevices.delete(deviceId);
      }
    }
  }

  /**
   * Bulk import a list of known devices (e.g. on startup, restoring from DB).
   * All imported devices are marked as disconnected (they have no live session).
   */
  importKnownDevices(devices: PresenceDevice[]): void {
    const now = Date.now();
    for (const device of devices) {
      const lastSeenAt = new Date(device.lastSeenAt).getTime();
      if (Number.isNaN(lastSeenAt)) continue;
      if (now - lastSeenAt > RECENTLY_ACTIVE_WINDOW_MS) continue;

      this.knownDevices.set(device.deviceId, {
        ...device,
        connected: false,
        connectedAt: null,
      });
    }
  }

  exportKnownDevices(): PresenceDevice[] {
    return Array.from(this.knownDevices.values()).map(device => ({
      ...device,
      connected: false,
      connectedAt: null,
    }));
  }

  private markDisconnected(deviceId: string, disconnectedAt: string): void {
    const known = this.knownDevices.get(deviceId);
    if (!known) {
      return;
    }

    known.connected = false;
    known.connectedAt = null;
    known.lastDisconnectedAt = disconnectedAt;
    known.lastSeenAt = disconnectedAt;
  }
}

export async function loadPresence(registry: PresenceRegistry): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT value FROM app_settings WHERE key = $1 LIMIT 1`,
      [PRESENCE_PERSIST_KEY]
    );
    if (result.rows.length === 0) return;
    const raw = result.rows[0].value;
    if (!Array.isArray(raw)) return;
    registry.importKnownDevices(raw as PresenceDevice[]);
  } catch (err) {
    logger.warn({ err }, 'Failed to load presence from DB');
  }
}

export async function persistPresence(registry: PresenceRegistry): Promise<void> {
  const devices = registry.exportKnownDevices();
  await pool.query(
    `INSERT INTO app_settings(key, value)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [PRESENCE_PERSIST_KEY, JSON.stringify(devices)]
  );
}
