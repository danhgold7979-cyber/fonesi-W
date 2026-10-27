import type { JobDefinition } from './persistence.js';
import { z } from 'zod';
import { idSchema } from './models.js';

const jobSelectionSchema = z
  .array(z.strictObject({ id: idSchema, revision: z.number().int().nonnegative() }))
  .min(1)
  .max(1000);
export const jobChangeRequestSchema = z
  .discriminatedUnion('operation', [
    z.strictObject({
      operation: z.literal('SPREAD'),
      jobs: jobSelectionSchema,
      minGapMinutes: z.number().int().min(60).max(120),
      maxGapMinutes: z.number().int().min(60).max(120),
    }),
    z.strictObject({ operation: z.literal('CANCEL'), jobs: jobSelectionSchema }),
  ])
  .refine(
    (request) => request.operation !== 'SPREAD' || request.minGapMinutes <= request.maxGapMinutes,
    'Khoảng giãn tối thiểu phải nhỏ hơn hoặc bằng tối đa.',
  );
export type JobChangeRequest = z.infer<typeof jobChangeRequestSchema>;
export interface JobChangeSlot {
  jobId: string;
  deviceId: string;
  timezone: string;
  previousUtc: string;
  proposedUtc: string;
  gapMinutes: number;
  crossesLocalDay: boolean;
}
export interface JobChangePreview {
  token: string;
  operation: JobChangeRequest['operation'];
  expiresAt: string;
  seed: number;
  slots: JobChangeSlot[];
  blockers: { jobId: string; code: string; message: string }[];
  warnings: string[];
  canApply: boolean;
}
export interface JobChangeResult {
  jobIds: string[];
  alreadyApplied: boolean;
}
export interface SchedulePreviewDto {
  token: string;
  expiresAt: string;
  timezone: string;
  slots: {
    contentId: string;
    scheduledUtc: string;
    jitterMinutes: number;
    crossesLocalDay: boolean;
  }[];
  warnings: string[];
  blockers: string[];
  canApply: boolean;
}
export interface ScheduledJobSummary extends JobDefinition {
  processName: string;
  deviceName: string;
  timezone: string;
  snapshotHash: string;
}
export interface JobQuery {
  cursor?: string | undefined;
  processId?: string | undefined;
  deviceId?: string | undefined;
  state?: JobDefinition['state'] | undefined;
  fromUtc?: string | undefined;
  toUtc?: string | undefined;
  limit?: number | undefined;
}
export interface JobPage {
  jobs: ScheduledJobSummary[];
  hasMore: boolean;
  nextCursor: string | null;
}

export type QueueClaimResult =
  | {
      status: 'CLAIMED';
      job: JobDefinition;
      snapshot: import('./persistence.js').JobSnapshot;
      snapshotHash: string;
      lease: import('./persistence.js').DeviceLease;
    }
  | { status: 'EMPTY' | 'DEVICE_DISABLED' | 'DEVICE_BUSY' | 'NEEDS_REVIEW' };
