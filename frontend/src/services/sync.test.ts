import { describe, expect, it } from 'vitest';
import { shouldApplyIncomingState } from './sync';

describe('shouldApplyIncomingState', () => {
  it('applies any state when no current state exists', () => {
    expect(shouldApplyIncomingState(null, { version: 1 })).toBe(true);
  });

  it('applies states without version or timestamp', () => {
    expect(shouldApplyIncomingState({ version: 5 }, { prices: {} })).toBe(true);
  });

  it('rejects strictly older timestamps', () => {
    const current = { updatedAt: '2025-01-02T00:00:00Z', version: 5 };
    const incoming = { updatedAt: '2025-01-01T00:00:00Z', version: 6 };
    expect(shouldApplyIncomingState(current, incoming)).toBe(false);
  });

  it('uses version as tiebreaker when timestamps equal', () => {
    const current = { updatedAt: '2025-01-01T00:00:00Z', version: 5 };
    const incomingHigher = { updatedAt: '2025-01-01T00:00:00Z', version: 6 };
    const incomingLower = { updatedAt: '2025-01-01T00:00:00Z', version: 4 };
    expect(shouldApplyIncomingState(current, incomingHigher)).toBe(true);
    expect(shouldApplyIncomingState(current, incomingLower)).toBe(false);
  });

  it('applies newer timestamps regardless of version', () => {
    const current = { updatedAt: '2025-01-01T00:00:00Z', version: 10 };
    const incoming = { updatedAt: '2025-01-02T00:00:00Z', version: 1 };
    expect(shouldApplyIncomingState(current, incoming)).toBe(true);
  });
});
