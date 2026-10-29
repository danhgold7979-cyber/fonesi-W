import { Temporal } from '@js-temporal/polyfill';
import { randomUUID } from 'node:crypto';
import { scheduleProfileSchema, idSchema } from '@autoreels/contracts';
import type { ScheduleProfile } from '@autoreels/contracts';
import { contentHash, DomainError } from '@autoreels/domain';
export { spreadJobs } from './spread.js';

export interface PreviewItem {
  id: string;
  revision: number;
}
export interface ProposedSlot {
  contentId: string;
  scheduledUtc: string;
  jitterMinutes: number;
  crossesLocalDay: boolean;
}
export interface SchedulePreview {
  token: string;
  processId: string;
  processRevision: number;
  items: PreviewItem[];
  profileHash: string;
  proposalHash: string;
  expiresAt: string;
  seed: number;
  slots: ProposedSlot[];
}
export function localSlotToUtc(date: string, time: string, timezone: string): string {
  try {
    return Temporal.PlainDate.from(date)
      .toPlainDateTime(Temporal.PlainTime.from(time))
      .toZonedDateTime(timezone, { disambiguation: 'reject' })
      .toInstant()
      .toString();
  } catch {
    throw new DomainError(
      'INVALID_LOCAL_SLOT',
      'Giờ không tồn tại hoặc mơ hồ do DST: ' + date + ' ' + time + ' (' + timezone + ')',
    );
  }
}
function proposalHash(preview: Omit<SchedulePreview, 'proposalHash'> | SchedulePreview): string {
  return contentHash({
    processId: preview.processId,
    processRevision: preview.processRevision,
    items: preview.items,
    profileHash: preview.profileHash,
    seed: preview.seed,
    slots: preview.slots,
    expiresAt: preview.expiresAt,
  });
}
export function createSchedulePreview(args: {
  processId: string;
  processRevision: number;
  profile: ScheduleProfile;
  items: PreviewItem[];
  nowUtc: string;
  seed: number;
  ttlSeconds?: number;
  operationBudget?: number;
}): SchedulePreview {
  idSchema.parse(args.processId);
  const profile = scheduleProfileSchema.parse(args.profile),
    now = Temporal.Instant.from(args.nowUtc),
    seen = new Set<string>();
  if (
    !Number.isSafeInteger(args.processRevision) ||
    args.processRevision < 0 ||
    !Number.isSafeInteger(args.seed)
  )
    throw new DomainError('INVALID_PREVIEW_INPUT', 'Invalid Process revision/seed');
  for (const item of args.items) {
    idSchema.parse(item.id);
    if (!item.id || !Number.isSafeInteger(item.revision) || item.revision < 0 || seen.has(item.id))
      throw new DomainError('INVALID_PREVIEW_ITEMS', 'Duplicate or invalid content identity');
    seen.add(item.id);
  }
  const ttl = args.ttlSeconds ?? 300;
  if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 3600)
    throw new DomainError('INVALID_PREVIEW_TTL', 'Invalid preview lifetime');
  let day = Temporal.PlainDate.from(profile.startDate);
  const today = now.toZonedDateTimeISO(profile.timezone).toPlainDate();
  if (Temporal.PlainDate.compare(day, today) < 0) day = today;
  let state = args.seed >>> 0 || 0x9e3779b9;
  const random = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const candidates: { instant: Temporal.Instant; jitter: number; crosses: boolean }[] = [];
  let operations = 0;
  while (candidates.length < args.items.length) {
    if (++operations > (args.operationBudget ?? 100000))
      throw new DomainError(
        'PREVIEW_RESOURCE_BUDGET',
        'Preview vượt budget thao tác; chia scope hoặc tăng budget có kiểm soát. Không có dữ liệu bị truncate.',
      );
    if (profile.weekdays.includes(day.dayOfWeek)) {
      for (const time of [...profile.slots].sort()) {
        const instant = Temporal.Instant.from(
          localSlotToUtc(day.toString(), time, profile.timezone),
        );
        if (Temporal.Instant.compare(instant, now) <= 0) continue;
        const jitter = Math.floor(random() * (profile.jitterMinutes + 1)),
          shifted = instant.add({ minutes: jitter });
        candidates.push({
          instant: shifted,
          jitter,
          crosses:
            shifted.toZonedDateTimeISO(profile.timezone).toPlainDate().toString() !==
            day.toString(),
        });
      }
    }
    day = day.add({ days: 1 });
  }
  candidates.sort((a, b) => Temporal.Instant.compare(a.instant, b.instant));
  const slots = args.items.map((item, index) => ({
    contentId: item.id,
    scheduledUtc: candidates[index]!.instant.toString(),
    jitterMinutes: candidates[index]!.jitter,
    crossesLocalDay: candidates[index]!.crosses,
  }));
  const preview: SchedulePreview = {
    token: 'preview_' + randomUUID().replaceAll('-', ''),
    processId: args.processId,
    processRevision: args.processRevision,
    items: structuredClone(args.items),
    profileHash: contentHash(profile),
    proposalHash: '',
    expiresAt: now.add({ seconds: ttl }).toString(),
    seed: args.seed,
    slots,
  };
  preview.proposalHash = proposalHash(preview);
  return preview;
}
export function assertPreviewCurrent(
  preview: SchedulePreview,
  current: {
    processId: string;
    revision: number;
    profile: ScheduleProfile;
    items: PreviewItem[];
    nowUtc: string;
  },
): void {
  if (
    Temporal.Instant.compare(
      Temporal.Instant.from(preview.expiresAt),
      Temporal.Instant.from(current.nowUtc),
    ) <= 0
  )
    throw new DomainError('PREVIEW_EXPIRED', 'Preview đã hết hạn.');
  if (preview.proposalHash !== proposalHash(preview))
    throw new DomainError('PREVIEW_TAMPERED', 'Proposal không còn đúng nội dung đã preview.');
  if (
    preview.processId !== current.processId ||
    preview.processRevision !== current.revision ||
    preview.profileHash !== contentHash(scheduleProfileSchema.parse(current.profile)) ||
    contentHash(preview.items) !== contentHash(current.items)
  )
    throw new DomainError('PREVIEW_STALE', 'Process hoặc tập nội dung đã đổi; tạo preview mới.');
}
export function overdueAction(
  policy: ScheduleProfile['overduePolicy'],
  reason: 'NORMAL_QUEUE_DELAY' | 'OFFLINE_GAP' | 'SLEEP_GAP',
  pendingEffect: boolean,
): 'QUEUE' | 'NEXT_FUTURE_SLOT' | 'SKIP' | 'REVIEW' {
  if (pendingEffect) return 'REVIEW';
  if (reason === 'NORMAL_QUEUE_DELAY') return 'QUEUE';
  return policy === 'CATCH_UP' ? 'QUEUE' : policy === 'SKIP' ? 'SKIP' : 'NEXT_FUTURE_SLOT';
}

export { nextAvailableRecoverySlot } from './recovery.js';
export type { RecoverySlot } from './recovery.js';
