import { useCallback, useMemo, useState } from 'react';

const DEVICE_ID_KEY = 'combar.device.id';
const DEVICE_NAME_KEY = 'combar.device.name';
const MAX_DEVICE_NAME_LENGTH = 12;

export interface DeviceIdentity {
  deviceId: string;
  deviceName: string;
}

function buildDefaultDeviceName(deviceId: string): string {
  return `Terminal ${deviceId.slice(-2).toUpperCase()}`;
}

function normalizeDeviceName(input: string, fallbackDeviceId: string): string {
  const cleaned = input
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .slice(0, MAX_DEVICE_NAME_LENGTH)
    .trim();

  return cleaned || buildDefaultDeviceName(fallbackDeviceId);
}

function readOrCreateIdentity(): DeviceIdentity {
  const existingDeviceId = localStorage.getItem(DEVICE_ID_KEY);
  const deviceId = existingDeviceId || crypto.randomUUID();

  const existingDeviceName = localStorage.getItem(DEVICE_NAME_KEY);
  const deviceName = normalizeDeviceName(existingDeviceName || '', deviceId);

  localStorage.setItem(DEVICE_ID_KEY, deviceId);
  localStorage.setItem(DEVICE_NAME_KEY, deviceName);

  return { deviceId, deviceName };
}

export function useDeviceIdentity(): {
  identity: DeviceIdentity;
  updateDeviceName: (nextName: string) => DeviceIdentity;
  normalizeCandidate: (candidate: string) => string;
} {
  const [identity, setIdentity] = useState<DeviceIdentity>(() => readOrCreateIdentity());

  const updateDeviceName = useCallback((nextName: string): DeviceIdentity => {
    const normalized = normalizeDeviceName(nextName, identity.deviceId);
    const nextIdentity = { ...identity, deviceName: normalized };
    setIdentity(nextIdentity);
    localStorage.setItem(DEVICE_NAME_KEY, normalized);
    return nextIdentity;
  }, [identity]);

  const normalizeCandidate = useMemo(
    () => (candidate: string) => normalizeDeviceName(candidate, identity.deviceId),
    [identity.deviceId]
  );

  return {
    identity,
    updateDeviceName,
    normalizeCandidate,
  };
}
