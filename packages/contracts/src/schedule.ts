import type { JobDefinition } from './persistence.js';
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
  processId?: string | undefined;
  deviceId?: string | undefined;
  state?: JobDefinition['state'] | undefined;
  fromUtc?: string | undefined;
  toUtc?: string | undefined;
  limit?: number | undefined;
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
