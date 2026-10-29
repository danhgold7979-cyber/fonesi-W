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
  appId?: string | undefined;
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

/**
 * Diagnostic only: this DTO is not an execution authorization or a DEVICE_TEST.
 * Do not include media paths, account data, phone serials or snapshot payloads.
 */
export interface JobPreflightReport {
  jobId: string;
  jobRevision: number;
  inspectedAt: string;
  scope: 'PERSISTED_ONLY';
  status: 'BLOCKED' | 'NEEDS_REVIEW';
  canDispatch: false;
  blockers: { code: string; message: string }[];
}

/** S096.1 persisted ordering evidence only; no picker row is a selectable grant. */
export type MediaOrderBlocker =
  | 'JOB_STATE_NOT_REVIEWABLE' | 'EXTERNAL_EFFECT_PRESENT'
  | 'FROZEN_SELECTION_INVALID' | 'PINNED_ASSET_INVALID'
  | 'STAGE_MISSING' | 'STAGE_UNEXPECTED_OR_DUPLICATE'
  | 'STAGE_OWNER_MISMATCH' | 'STAGE_GENERATION_MISMATCH'
  | 'REMOTE_BYTES_NOT_VERIFIED' | 'MEDIASTORE_ROW_NOT_VERIFIED'
  | 'MEDIASTORE_ROW_COLLISION' | 'LATEST_OBSERVATION_CONTRADICTS_ROW';

export interface PersistedOrderedMediaReport {
  scope: 'PERSISTED_STAGE_ORDER_NOT_PICKER_VERIFIED';
  status: 'BLOCKED' | 'INDEXED_CANDIDATES_NOT_PICKER_VERIFIED' | 'NO_MEDIA';
  canSelect: false;
  canDispatch: false;
  blockers: MediaOrderBlocker[];
  slots: {
    ordinal: number;
    kind: 'IMAGE' | 'VIDEO' | 'UNKNOWN';
    evidence: 'INDEXED_ROW_RECORDED_NOT_LIVE' | 'BLOCKED';
    blockers: MediaOrderBlocker[];
  }[];
}
/** Frozen row/process text only; NEVER evidence of Android Unicode input. */
export type FrozenUnicodeBlocker =
  | 'DECLARATION_INVALID' | 'UNDECLARED_VALUE'
  | 'REQUIRED_VALUE_MISSING' | 'VALUE_NOT_TEXT'
  | 'UNSAFE_UNICODE' | 'TEXT_TOO_LARGE' | 'URL_UNSAFE';

export interface FrozenUnicodePreflight {
  scope: 'FROZEN_UNICODE_NOT_ANDROID_INPUT';
  status: 'BLOCKED' | 'EXACT_FROZEN_TEXT_METHOD_UNVERIFIED' | 'NO_TEXT_FIELDS';
  canType: false;
  canDispatch: false;
  blockers: FrozenUnicodeBlocker[];
  fields: {
    ordinal: number;
    scope: 'ROW' | 'PROCESS';
    kind: 'TEXT' | 'URL';
    evidence: 'EXACT_FROZEN_TEXT' | 'BLOCKED';
    blockers: FrozenUnicodeBlocker[];
  }[];
}
/** S096.3 frozen compose *source expectations*, never a live Android target/picker grant. */
export type FrozenComposeBlocker =
  | 'JOB_NOT_PREFLIGHT' | 'WORKFLOW_BINDING_INVALID'
  | 'WORKFLOW_FINGERPRINT_MISMATCH' | 'FROZEN_MEDIA_BINDING_INVALID'
  | 'SNAPSHOT_FINGERPRINT_MISMATCH'
  | 'ACCOUNT_NOT_PINNED' | 'TARGET_NOT_PINNED'
  | 'CONTENT_BINDING_MISMATCH' | 'MEDIA_ORDER_NOT_VERIFIED'
  | 'UNICODE_SOURCE_INVALID' | 'EMPTY_FROZEN_CONTENT'
  | 'EXTERNAL_EFFECT_PRESENT';

export interface FrozenComposePreflight {
  scope: 'FROZEN_COMPOSE_NOT_ANDROID_VERIFIED';
  status: 'BLOCKED' | 'FROZEN_EXPECTATIONS_LIVE_UNVERIFIED';
  app: 'PINNED_NOT_OBSERVED' | 'MISSING';
  account: 'PINNED_NOT_OBSERVED' | 'MISSING';
  target: 'PINNED_NOT_OBSERVED' | 'MISSING';
  content: 'PINNED_NOT_OBSERVED' | 'MISSING';
  mediaSlots: number;
  textFields: number;
  blockers: FrozenComposeBlocker[];
  canVerify: false;
  canPublish: false;
  canDispatch: false;
}

/** SQLite-persisted effect inventory only; never certifies a provider post. */
export interface PersistedEffectReview {
  scope: 'PERSISTED_EFFECT_JOURNAL_NOT_PROVIDER_VERIFIED';
  status: 'NO_EFFECTS' | 'REVIEW_REQUIRED' | 'RECORDED_NOT_LIVE_VERIFIED';
  total: number;
  hasMore: boolean;
  /** From all persisted rows, not just newest 20 visible entries. */
  hasUnresolved: boolean;
  entries: {
    ordinal: number;
    kind: 'PUBLISH' | 'COMMENT' | 'UNKNOWN';
    state: import('./models.js').EffectState | 'UNKNOWN';
  }[];
  canConfirm: false;
  canRetry: false;
  canDispatch: false;
}

/** Operator-visible persistence projection only. No paths, hashes, nonces, serials or owner IDs. */
export interface JobStageReviewPage {
  jobId: string;
  jobRevision: number;
  jobState: JobDefinition['state'];
  scope: 'PERSISTED_ONLY';
  canDispatch: false;
  stages: {
    ordinal: number;
    state: 'INTENT' | 'TRANSFER_UNCERTAIN' | 'SYNC_ACK_UNVERIFIED' | 'NEEDS_REVIEW';
    remoteBytes: 'MATCH_RECORDED_NOT_LIVE' | 'NOT_RECORDED';
    mediaStore: 'ROW_RECORDED_NOT_PICKER_VERIFIED' | 'NOT_RECORDED';
  }[];
  observations: {
    stageOrdinal: number;
    classification: import('./media.js').StageReconciliationClassification;
    mediaStoreStatus: import('./media.js').DeviceStageReconciliation['mediaStoreStatus'];
    leaseOwnerKind: 'JOB' | 'MANUAL';
    createdAt: string;
  }[];
  /** Newest 20 historical review requests, never cleanup permissions. */
  cleanupRequests: {
    stageOrdinal: number;
    recordedAt: string;
    status: 'REVIEW_REQUESTED_HARDWARE_PENDING';
  }[];
  cleanupHasMore: boolean;
  /** Frozen asset order reconciled with owned stage and indexed-row journals. */
  mediaOrder: PersistedOrderedMediaReport;
  frozenUnicode: FrozenUnicodePreflight;
  compose: FrozenComposePreflight;
  effectReview: PersistedEffectReview;
  hasMore: boolean;
  nextCursor: string | null;
}

/** One native Electron-only readback observation. Not picker or posting proof. */
export interface NativeStageReviewResult {
  jobId: string;
  ordinal: number;
  scope: 'LIVE_ANDROID_OBSERVATION_NOT_PICKER_VERIFIED';
  classification: import('./media.js').StageReconciliationClassification;
  mediaStoreStatus: import('./media.js').DeviceStageReconciliation['mediaStoreStatus'];
  completedAt: string;
  canDelete: false;
  canDispatch: false;
}
/** A native-confirmed review request, not authorization to delete or publish. */
export interface NativeStageCleanupReviewResult {
  jobId: string;
  ordinal: number;
  scope: 'LIVE_ANDROID_REVIEW_REQUEST_ONLY';
  status: 'REVIEW_REQUEST_RECORDED' | 'CANCELLED';
  classification: import('./media.js').StageReconciliationClassification;
  mediaStoreStatus: import('./media.js').DeviceStageReconciliation['mediaStoreStatus'];
  recordedAt: string | null;
  canDelete: false;
  canDispatch: false;
}
/** Safe native-only, redacted ADB STAT + MediaStore readback, never deletion proof. */
export interface NativeStageCleanupAbsenceResult {
  scope: 'PRIVATE_OWNED_STAGE_ABSENCE_NOT_DELETE_CERTIFIED';
  status: 'BLOCKED' | 'REMOTE_PRESENT_REVIEW' | 'MEDIASTORE_PRESENT_REVIEW' |
    'UNSUPPORTED_REVIEW' | 'ABSENCE_CANDIDATE_UNCERTIFIED';
  remote: 'PRESENT' | 'ABSENT' | 'UNKNOWN';
  mediaStore: 'INDEXED_EXACT' | 'NOT_INDEXED' | 'AMBIGUOUS' | 'UNSUPPORTED' | 'UNKNOWN';
  blockers: Array<
    'OWNED_EXPECTATION_INVALID' | 'REMOTE_STAT_INVALID' | 'REMOTE_BYTES_MISMATCH' |
    'MEDIASTORE_READBACK_INVALID' | 'REMOTE_STILL_PRESENT' |
    'MEDIASTORE_STILL_INDEXED' | 'MEDIASTORE_UNSUPPORTED_OR_AMBIGUOUS' |
    'PROVIDER_AND_CLEANUP_UNCERTIFIED'
  >;
  canDelete: false;
  canMarkClean: false;
  canRetry: false;
  canDispatch: false;
}
/** Native-only audit receipt: one bounded readback, never an executable cleanup retry. */
export interface NativeStageCleanupRecheckResult {
  jobId: string;
  ordinal: number;
  scope: 'LIVE_ANDROID_CLEANUP_RECHECK_NOT_DELETE_CERTIFIED';
  status: NativeStageCleanupAbsenceResult['status'];
  attemptOrdinal: number;
  recordedAt: string;
  canDelete: false;
  canMarkClean: false;
  canRetry: false;
  canDispatch: false;
}
/** Separate Electron-only bridge: never add this to public StudioApi/ApiCommand. */
export interface NativeStageReviewApi {
  reobserve(jobId: string, ordinal: number): Promise<NativeStageReviewResult>;
  requestCleanupReview(jobId: string, ordinal: number): Promise<NativeStageCleanupReviewResult>;
  reviewCleanupAbsence(jobId: string, ordinal: number): Promise<NativeStageCleanupAbsenceResult>;
  recordCleanupRecheck(jobId: string, ordinal: number): Promise<NativeStageCleanupRecheckResult>;
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
