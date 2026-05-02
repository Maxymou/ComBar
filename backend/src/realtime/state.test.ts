import { describe, expect, it } from 'vitest';
import { sanitizeState } from './state';

describe('sanitizeState', () => {
  it('returns empty defaults for non-object input', () => {
    const result = sanitizeState(null);
    expect(result.prices).toEqual({});
    expect(result.happyHour).toBe(false);
    expect(result.version).toBe(0);
  });

  it('rounds prices to 2 decimals and rejects negative or NaN values', () => {
    const result = sanitizeState({
      prices: { a: 1.234, b: -1, c: Number.NaN, d: 2.999 },
      happyHour: true,
    });
    expect(result.prices.a).toBe(1.23);
    expect(result.prices.d).toBe(3);
    expect(result.prices).not.toHaveProperty('b');
    expect(result.prices).not.toHaveProperty('c');
    expect(result.happyHour).toBe(true);
  });

  it('floors version to a non-negative integer', () => {
    expect(sanitizeState({ version: -5 }).version).toBe(0);
    expect(sanitizeState({ version: 3.9 }).version).toBe(3);
    expect(sanitizeState({ version: 'bad' as unknown as number }).version).toBe(0);
  });

  it('keeps presence fields zeroed (state should not carry presence)', () => {
    const result = sanitizeState({ prices: { x: 1 } });
    expect(result.clientsCount).toBe(0);
    expect(result.connectedDevices).toEqual([]);
    expect(result.presence.connectedCount).toBe(0);
  });
});
