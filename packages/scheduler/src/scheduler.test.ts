import { describe, expect, it } from 'vitest';
import type { ScheduleProfile } from '@autoreels/contracts';
import {
  localSlotToUtc,
  createSchedulePreview,
  assertPreviewCurrent,
  overdueAction,
} from './index.js';
const profile: ScheduleProfile = {
  timezone: 'Asia/Ho_Chi_Minh',
  startDate: '2026-10-26',
  slots: ['08:00', '12:00', '19:00'],
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  overduePolicy: 'NEXT_FUTURE_SLOT',
  jitterMinutes: 0,
};
const items = [
  { id: 'one', revision: 0 },
  { id: 'two', revision: 1 },
  { id: 'three', revision: 0 },
];
const input = () => ({
  processId: 'process_1',
  processRevision: 3,
  profile,
  items,
  nowUtc: '2026-10-26T02:00:00Z',
  seed: 123,
});
describe('calendar and immutable schedule proposals', () => {
  it('converts local calendar dates without UTC midnight shifts', () => {
    expect(localSlotToUtc('2026-10-26', '08:00', 'Asia/Ho_Chi_Minh')).toBe('2026-10-26T01:00:00Z');
  });
  it('rejects nonexistent and ambiguous DST times', () => {
    expect(() => localSlotToUtc('2026-03-08', '02:30', 'America/New_York')).toThrow('DST');
    expect(() => localSlotToUtc('2026-11-01', '01:30', 'America/New_York')).toThrow('DST');
  });
  it('starts at future slots and keeps content assignment order', () => {
    const p = createSchedulePreview(input());
    expect(p.slots.map((s) => s.scheduledUtc)).toEqual([
      '2026-10-26T05:00:00Z',
      '2026-10-26T12:00:00Z',
      '2026-10-27T01:00:00Z',
    ]);
    expect(p.slots.map((s) => s.contentId)).toEqual(['one', 'two', 'three']);
  });
  it('keeps seeded jitter proposals stable, even across local day boundaries', () => {
    const args = { ...input(), profile: { ...profile, slots: ['23:55'], jitterMinutes: 120 } };
    const a = createSchedulePreview(args),
      b = createSchedulePreview(args);
    expect(a.slots).toEqual(b.slots);
    expect(a.proposalHash).toBe(b.proposalHash);
    expect(a.slots.some((s) => s.crossesLocalDay)).toBe(true);
  });
  it('rejects stale scope/revisions, tampering and expiry before applying', () => {
    const p = createSchedulePreview(input()),
      current = {
        processId: 'process_1',
        revision: 3,
        profile,
        items,
        nowUtc: '2026-10-26T02:01:00Z',
      };
    expect(() => assertPreviewCurrent(p, current)).not.toThrow();
    expect(() => assertPreviewCurrent(p, { ...current, revision: 4 })).toThrow('đổi');
    expect(() => assertPreviewCurrent(p, { ...current, items: [...items].reverse() })).toThrow(
      'đổi',
    );
    const edited = structuredClone(p);
    edited.slots[0]!.scheduledUtc = '2030-01-01T00:00:00Z';
    expect(() => assertPreviewCurrent(edited, current)).toThrow('Proposal');
    expect(() => assertPreviewCurrent(p, { ...current, nowUtc: '2026-10-26T03:00:00Z' })).toThrow(
      'hết hạn',
    );
  });
  it('rejects duplicate content and exhausted operation budgets without truncating', () => {
    expect(() => createSchedulePreview({ ...input(), items: [items[0]!, items[0]!] })).toThrow(
      'Duplicate',
    );
    expect(() => createSchedulePreview({ ...input(), operationBudget: 0 })).toThrow('budget');
  });
  it('treats normal busy queue delay differently from missed execution and never retries uncertainty', () => {
    expect(overdueAction('SKIP', 'NORMAL_QUEUE_DELAY', false)).toBe('QUEUE');
    expect(overdueAction('NEXT_FUTURE_SLOT', 'OFFLINE_GAP', false)).toBe('NEXT_FUTURE_SLOT');
    expect(overdueAction('SKIP', 'SLEEP_GAP', false)).toBe('SKIP');
    for (const p of ['NEXT_FUTURE_SLOT', 'CATCH_UP', 'SKIP'] as const)
      expect(overdueAction(p, 'OFFLINE_GAP', true)).toBe('REVIEW');
  });
});
