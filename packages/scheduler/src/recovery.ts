import { Temporal } from '@js-temporal/polyfill';
import { scheduleProfileSchema } from '@autoreels/contracts';
import type { ScheduleProfile } from '@autoreels/contracts';
import { DomainError } from '@autoreels/domain';

export interface RecoverySlot {
  scheduledUtc: string;
  jitterMinutes: number;
  crossesLocalDay: boolean;
}

/**
 * Deterministic, bounded future calendar slot search after an observed clock gap.
 * Only scheduled instants are considered; duration/occupancy of a device is not
 * inferred from UI card geometry or guesses. Real queue ownership is separate.
 */
export function nextAvailableRecoverySlot(
  input: ScheduleProfile,
  afterUtc: string,
  reservedUtc: Iterable<string>,
  seed: number,
  maxDays = 366,
): RecoverySlot {
  const profile = scheduleProfileSchema.parse(input);
  if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(maxDays) || maxDays < 1 || maxDays > 3660)
    throw new DomainError('INVALID_RECOVERY_BUDGET', 'Seed hoặc ngân sách lịch không hợp lệ.');
  let instant: Temporal.Instant;
  try {
    instant = Temporal.Instant.from(afterUtc);
  } catch {
    throw new DomainError('INVALID_RECOVERY_CLOCK', 'Thời điểm khôi phục không hợp lệ.');
  }
  const reserved = new Set<string>();
  for (const item of reservedUtc) {
    if (reserved.size >= 5000)
      throw new DomainError('RECOVERY_RESOURCE_BUDGET', 'Quá nhiều lịch đặt trước; cần xem thủ công.');
    try {
      reserved.add(Temporal.Instant.from(item).toString());
    } catch {
      throw new DomainError('INVALID_RECOVERY_RESERVATION', 'Giờ đã đặt trước không hợp lệ.');
    }
  }
  let state = seed >>> 0 || 0x9e3779b9;
  const random = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const today = instant.toZonedDateTimeISO(profile.timezone).toPlainDate();
  let day = Temporal.PlainDate.from(profile.startDate);
  if (Temporal.PlainDate.compare(day, today) < 0) day = today;
  for (let scanned = 0; scanned < maxDays; scanned++, day = day.add({ days: 1 })) {
    if (!profile.weekdays.includes(day.dayOfWeek)) continue;
    const candidates: { instant: Temporal.Instant; jitter: number }[] = [];
    for (const time of [...profile.slots].sort()) {
      let scheduled: Temporal.Instant;
      try {
        scheduled = day
          .toPlainDateTime(Temporal.PlainTime.from(time))
          .toZonedDateTime(profile.timezone, { disambiguation: 'reject' })
          .toInstant();
      } catch {
        throw new DomainError(
          'INVALID_LOCAL_SLOT',
          'Khung giờ lịch mơ hồ hoặc không tồn tại do DST: ' + day.toString() + ' ' + time,
        );
      }
      const jitter = Math.floor(random() * (profile.jitterMinutes + 1)),
        candidate = scheduled.add({ minutes: jitter });
      if (
        Temporal.Instant.compare(candidate, instant) > 0 &&
        !reserved.has(candidate.toString())
      ) candidates.push({ instant: candidate, jitter });
    }
    if (candidates.length) {
      candidates.sort((a, b) => Temporal.Instant.compare(a.instant, b.instant));
      const first = candidates[0]!;
      return {
        scheduledUtc: first.instant.toString(),
        jitterMinutes: first.jitter,
        crossesLocalDay:
          first.instant.toZonedDateTimeISO(profile.timezone).toPlainDate().toString() !==
          day.toString(),
      };
    }
  }
  throw new DomainError(
    'RECOVERY_SLOT_EXHAUSTED',
    'Không tìm thấy giờ trống trong ngân sách; cần xem thủ công.',
  );
}
