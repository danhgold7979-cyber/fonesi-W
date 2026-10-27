import { describe, it, expect } from 'vitest';
import { calendarRange, calendarDay, moveCalendar } from '../apps/desktop/src/renderer/calendar.js';

describe('local calendar ranges for persisted UTC jobs', () => {
  it('uses exclusive local-day boundaries instead of UTC midnight', () => {
    const range = calendarRange('2030-01-02', 'DAY', 'Asia/Ho_Chi_Minh');
    expect(range).toMatchObject({
      fromUtc: '2030-01-01T17:00:00Z',
      toUtc: '2030-01-02T17:00:00Z',
      days: ['2030-01-02'],
    });
    expect(calendarDay('2030-01-01T16:59:00Z', 'Asia/Ho_Chi_Minh')).toBe('2030-01-01');
    expect(calendarDay(range.fromUtc, 'Asia/Ho_Chi_Minh')).toBe('2030-01-02');
    expect(calendarDay(range.toUtc, 'Asia/Ho_Chi_Minh')).toBe('2030-01-03');
  });
  it('keeps DST days at their real 23/25-hour length', () => {
    const spring = calendarRange('2030-03-10', 'DAY', 'America/New_York'),
      fall = calendarRange('2030-11-03', 'DAY', 'America/New_York');
    expect((Date.parse(spring.toUtc) - Date.parse(spring.fromUtc)) / 3600000).toBe(23);
    expect((Date.parse(fall.toUtc) - Date.parse(fall.fromUtc)) / 3600000).toBe(25);
  });
  it('uses Monday-first weeks across year boundaries without changing date scope', () => {
    const range = calendarRange('2030-01-01', 'WEEK', 'UTC');
    expect(range.days).toHaveLength(7);
    expect(range.days[0]).toBe('2029-12-31');
    expect(range.days.at(-1)).toBe('2030-01-06');
    expect(range.toUtc).toBe('2030-01-07T00:00:00Z');
    expect(moveCalendar('2030-01-01', 'WEEK', 1)).toBe('2030-01-08');
  });
  it('covers leap months and constrains month navigation without overflowing into another month', () => {
    const range = calendarRange('2028-02-29', 'MONTH', 'UTC');
    expect(range.days).toHaveLength(29);
    expect(range.days[0]).toBe('2028-02-01');
    expect(range.days.at(-1)).toBe('2028-02-29');
    expect(range.toUtc).toBe('2028-03-01T00:00:00Z');
    expect(range.leadingDays).toBeGreaterThanOrEqual(0);
    expect(range.leadingDays).toBeLessThan(7);
    expect(moveCalendar('2028-01-31', 'MONTH', 1)).toBe('2028-02-29');
  });
  it('rejects invalid dates/timezones and a whole local day skipped by a timezone change', () => {
    expect(() => calendarRange('2030-02-30', 'DAY', 'UTC')).toThrow();
    expect(() => calendarRange('2030-01-01', 'DAY', 'Invalid/Timezone')).toThrow();
    expect(() => calendarRange('2011-12-30', 'DAY', 'Pacific/Apia')).toThrow('Ngày không tồn tại');
  });
});
