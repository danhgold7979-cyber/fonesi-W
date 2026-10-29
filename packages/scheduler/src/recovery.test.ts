import { describe, expect, it } from 'vitest';
import type { ScheduleProfile } from '@autoreels/contracts';
import { nextAvailableRecoverySlot } from './recovery.js';

const profile: ScheduleProfile = {
  timezone: 'Asia/Ho_Chi_Minh',
  startDate: '2026-10-26',
  slots: ['08:00', '12:00'],
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  overduePolicy: 'NEXT_FUTURE_SLOT',
  jitterMinutes: 0,
};

describe('sleep/restart recovery slot planning', () => {
  it('uses exact future local slots and skips reserved device instants, including next calendar day', () => {
    expect(nextAvailableRecoverySlot(profile, '2026-10-26T00:00:00Z', [], 7).scheduledUtc).toBe(
      '2026-10-26T01:00:00Z',
    );
    expect(
      nextAvailableRecoverySlot(profile, '2026-10-26T00:00:00Z', ['2026-10-26T01:00:00Z'], 7)
        .scheduledUtc,
    ).toBe('2026-10-26T05:00:00Z');
    expect(
      nextAvailableRecoverySlot(
        profile,
        '2026-10-26T00:00:00Z',
        ['2026-10-26T01:00:00Z', '2026-10-26T05:00:00Z'],
        7,
      ).scheduledUtc,
    ).toBe('2026-10-27T01:00:00Z');
  });
  it('reproduces seeded jitter and respects valid IANA calendar dates', () => {
    const config = { ...profile, slots: ['23:55'], jitterMinutes: 120 };
    expect(nextAvailableRecoverySlot(config, '2026-10-26T00:00:00Z', [], 123)).toEqual(
      nextAvailableRecoverySlot(config, '2026-10-26T00:00:00Z', [], 123),
    );
    expect(nextAvailableRecoverySlot(profile, '2026-10-26T05:00:00Z', [], 7).scheduledUtc).toBe(
      '2026-10-27T01:00:00Z',
    );
  });
  it('rejects nonexistent DST hour, corrupt input, exhausted budget and unsafe reserved clock', () => {
    const newYork = {
      ...profile,
      timezone: 'America/New_York',
      startDate: '2026-03-08',
      slots: ['02:30'],
    };
    expect(() => nextAvailableRecoverySlot(newYork, '2026-03-08T05:00:00Z', [], 1)).toThrow(
      'DST',
    );
    expect(() => nextAvailableRecoverySlot(profile, 'invalid', [], 1)).toThrow('không hợp lệ');
    expect(() => nextAvailableRecoverySlot(profile, '2026-10-26T00:00:00Z', ['bad'], 1)).toThrow(
      'không hợp lệ',
    );
    expect(() => nextAvailableRecoverySlot(profile, '2026-10-26T00:00:00Z', [], 1, 0)).toThrow(
      'ngân sách',
    );
    expect(() =>
      nextAvailableRecoverySlot({ ...profile, weekdays: [2] }, '2026-10-26T00:00:00Z', [], 1, 1),
    ).toThrow('ngân sách');
  });
});
