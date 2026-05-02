import { describe, expect, it } from 'vitest';
import { PresenceRegistry, sanitizeDeviceName, sanitizeIdentity } from './presence';

describe('sanitizeDeviceName', () => {
  it('truncates names to max length', () => {
    const fallbackId = 'abcdef';
    expect(sanitizeDeviceName('AVeryLongTerminalName', fallbackId).length).toBeLessThanOrEqual(12);
  });

  it('falls back to default when input is empty', () => {
    const name = sanitizeDeviceName('', 'abcdef');
    expect(name.startsWith('Terminal')).toBe(true);
  });

  it('strips disallowed characters', () => {
    expect(sanitizeDeviceName('Bar<>$', 'abcdef')).toBe('Bar');
  });
});

describe('sanitizeIdentity', () => {
  it('generates a UUID when deviceId is empty', () => {
    const result = sanitizeIdentity('', 'Caisse');
    expect(result.deviceId.length).toBeGreaterThan(0);
    expect(result.deviceName).toBe('Caisse');
  });
});

describe('PresenceRegistry import/export', () => {
  it('roundtrips known devices and skips expired ones', () => {
    const registry = new PresenceRegistry();
    const now = Date.now();
    const recent = new Date(now - 60_000).toISOString();
    const old = new Date(now - 10 * 60 * 60 * 1000).toISOString();

    registry.importKnownDevices([
      {
        deviceId: 'd1',
        deviceName: 'Caisse',
        connected: true, // should be reset to false
        connectedAt: recent,
        lastSeenAt: recent,
        lastDisconnectedAt: null,
      },
      {
        deviceId: 'd2',
        deviceName: 'OldOne',
        connected: false,
        connectedAt: null,
        lastSeenAt: old,
        lastDisconnectedAt: old,
      },
    ]);

    const exported = registry.exportKnownDevices();
    expect(exported).toHaveLength(1);
    expect(exported[0].deviceId).toBe('d1');
    expect(exported[0].connected).toBe(false);
  });
});
