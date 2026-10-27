import { Temporal } from '@js-temporal/polyfill';

export type CalendarView = 'LIST' | 'DAY' | 'WEEK' | 'MONTH';
export interface CalendarRange {
  days: string[];
  fromUtc: string;
  toUtc: string;
  leadingDays: number;
}
export function localToday(timezone: string): string {
  return Temporal.Now.instant().toZonedDateTimeISO(timezone).toPlainDate().toString();
}
export function calendarDay(instant: string, timezone: string): string {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(timezone).toPlainDate().toString();
}
export function moveCalendar(anchor: string, view: CalendarView, direction: number): string {
  const date = Temporal.PlainDate.from(anchor);
  return date
    .add(view === 'MONTH' ? { months: direction } : { days: direction * (view === 'WEEK' ? 7 : 1) })
    .toString();
}
export function calendarRange(
  anchor: string,
  view: Exclude<CalendarView, 'LIST'>,
  timezone: string,
): CalendarRange {
  const date = Temporal.PlainDate.from(anchor);
  const start =
    view === 'MONTH'
      ? date.with({ day: 1 })
      : view === 'WEEK'
        ? date.subtract({ days: date.dayOfWeek - 1 })
        : date;
  const end =
    view === 'MONTH' ? start.add({ months: 1 }) : start.add({ days: view === 'WEEK' ? 7 : 1 });
  const boundary = (day: Temporal.PlainDate) => {
    const value = day
      .toPlainDateTime('00:00')
      .toZonedDateTime(timezone, { disambiguation: 'compatible' });
    if (!value.toPlainDate().equals(day))
      throw new Error('Ngày không tồn tại trong múi giờ đã chọn: ' + day.toString());
    return value.toInstant().toString();
  };
  const days: string[] = [];
  for (let day = start; Temporal.PlainDate.compare(day, end) < 0; day = day.add({ days: 1 }))
    days.push(day.toString());
  return {
    days,
    fromUtc: boundary(start),
    toUtc: boundary(end),
    leadingDays: view === 'MONTH' ? start.dayOfWeek - 1 : 0,
  };
}
