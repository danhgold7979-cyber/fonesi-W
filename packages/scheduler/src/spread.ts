import { Temporal } from '@js-temporal/polyfill';
import type { JobChangeSlot } from '@autoreels/contracts';
import { DomainError } from '@autoreels/domain';

export function spreadJobs(
  jobs: {
    id: string;
    deviceId: string;
    scheduledUtc: string;
    priority: number;
    timezone: string;
  }[],
  minGapMinutes: number,
  maxGapMinutes: number,
  seed: number,
): JobChangeSlot[] {
  if (
    ![minGapMinutes, maxGapMinutes, seed].every(Number.isSafeInteger) ||
    minGapMinutes < 60 ||
    maxGapMinutes > 120 ||
    minGapMinutes > maxGapMinutes
  )
    throw new DomainError('INVALID_SPREAD', 'Khoảng giãn phải nằm trong 60–120 phút.');
  const seen = new Set<string>();
  for (const job of jobs) {
    if (seen.has(job.id)) throw new DomainError('DUPLICATE_JOB', 'Scope có công việc trùng.');
    seen.add(job.id);
  }
  let state = seed >>> 0 || 0x9e3779b9;
  const previous = new Map<string, Temporal.Instant>();
  return [...jobs]
    .sort(
      (a, b) =>
        Temporal.Instant.compare(
          Temporal.Instant.from(a.scheduledUtc),
          Temporal.Instant.from(b.scheduledUtc),
        ) ||
        b.priority - a.priority ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .map((job) => {
      const original = Temporal.Instant.from(job.scheduledUtc),
        last = previous.get(job.deviceId);
      let proposed = original,
        gapMinutes = 0;
      if (last) {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        gapMinutes =
          minGapMinutes +
          Math.floor(((state >>> 0) / 4294967296) * (maxGapMinutes - minGapMinutes + 1));
        const candidate = last.add({ minutes: gapMinutes });
        if (Temporal.Instant.compare(candidate, original) > 0) proposed = candidate;
      }
      previous.set(job.deviceId, proposed);
      return {
        jobId: job.id,
        deviceId: job.deviceId,
        timezone: job.timezone,
        previousUtc: original.toString(),
        proposedUtc: proposed.toString(),
        gapMinutes,
        crossesLocalDay:
          original.toZonedDateTimeISO(job.timezone).toPlainDate().toString() !==
          proposed.toZonedDateTimeISO(job.timezone).toPlainDate().toString(),
      };
    });
}
