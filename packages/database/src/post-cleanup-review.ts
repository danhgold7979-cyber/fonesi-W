import { extname } from 'node:path';
import { hashSchema, idSchema } from '@autoreels/contracts';
import type { DeviceStageTransfer, JobDefinition, JobSnapshot } from '@autoreels/contracts';
import { bundleHash, contentHash } from '@autoreels/domain';
import { assertOwnedStageLocation } from '@autoreels/devices';

/** DB-only effect rows do not attest what a remote provider actually posted. */
export interface PostCleanupEffectRow {
  kind: string;
  state: string;
}
export type PostCleanupBlocker =
  | 'JOB_NOT_SUCCESSFUL'
  | 'FROZEN_SNAPSHOT_INVALID'
  | 'OWNED_MEDIA_MISSING'
  | 'LEDGER_SET_INVALID'
  | 'LEDGER_BINDING_MISMATCH'
  | 'STAGE_TRANSFER_PENDING'
  | 'REMOTE_READBACK_UNVERIFIED'
  | 'MEDIASTORE_PICKER_UNVERIFIED'
  | 'PUBLISH_JOURNAL_MISSING_OR_UNCONFIRMED'
  | 'EXTERNAL_EFFECT_UNRESOLVED'
  | 'JOB_CLAIM_PENDING'
  | 'STAGE_CLEANUP_REVIEW_PENDING'
  | 'PROVIDER_CERTIFICATION_UNAVAILABLE';

export interface PostCleanupReadiness {
  scope: 'PRIVATE_JOB_OWNED_CLEANUP_NOT_PROVIDER_CERTIFIED';
  status: 'BLOCKED';
  ledger: 'INVALID' | 'EMPTY' | 'INCOMPLETE' | 'MATCHED_DB_ONLY';
  frozenMediaCount: number;
  stageCount: number;
  blockers: PostCleanupBlocker[];
  canDelete: false;
  canDispatch: false;
  canRetry: false;
  canMarkClean: false;
}
const MAX_MEDIA = 32;
const MAX_EFFECTS = 33;
const MAX_BYTES = 512 * 1024 * 1024;
const supportedExtensions = new Set([
  '.mp4', '.mov', '.mkv', '.webm', '.m4v', '.avi',
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp',
]);
const isIso = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString() === value;
};

/**
 * S102.1: compare the COMPLETE immutable job/media ledger before considering
 * cleanup. Even a perfectly matching synthetic DB ledger is not external
 * provider or Android picker proof; no runtime cleanup permission is returned.
 */
export function assessPostCleanupReadiness(input: {
  job: JobDefinition;
  snapshot: JobSnapshot;
  snapshotHash: string;
  stages: readonly DeviceStageTransfer[];
  effects: readonly PostCleanupEffectRow[];
  hasJobClaim: boolean;
  pendingCleanupReviewCount: number;
}): PostCleanupReadiness {
  const blockers: PostCleanupBlocker[] = [];
  const block = (code: PostCleanupBlocker): void => {
    if (!blockers.includes(code)) blockers.push(code);
  };
  let ledger: PostCleanupReadiness['ledger'] = 'INCOMPLETE';
  const mediaCount = Array.isArray(input.snapshot?.assetIds) ?
    Math.min(MAX_MEDIA, input.snapshot.assetIds.length) : 0;
  const stageCount = Array.isArray(input.stages) ?
    Math.min(MAX_MEDIA, input.stages.length) : 0;
  const report = (): PostCleanupReadiness => ({
    scope: 'PRIVATE_JOB_OWNED_CLEANUP_NOT_PROVIDER_CERTIFIED',
    status: 'BLOCKED',
    ledger,
    frozenMediaCount: mediaCount,
    stageCount,
    blockers,
    canDelete: false, canDispatch: false, canRetry: false, canMarkClean: false,
  });

  if (!['SUCCESS', 'SUCCESS_WITH_WARNINGS'].includes(input.job?.state))
    block('JOB_NOT_SUCCESSFUL');
  let snapshotValid = false;
  try {
    snapshotValid =
      idSchema.safeParse(input.job?.id).success &&
      idSchema.safeParse(input.job?.deviceId).success &&
      hashSchema.safeParse(input.snapshotHash).success &&
      input.snapshot?.contentId === input.job.contentId &&
      hashSchema.safeParse(input.snapshot.workflowHash).success &&
      bundleHash(input.snapshot.bundle) === input.snapshot.workflowHash &&
      contentHash(input.snapshot) === input.snapshotHash &&
      Array.isArray(input.snapshot.assetIds) &&
      Array.isArray(input.snapshot.assets) &&
      input.snapshot.assetIds.length <= MAX_MEDIA &&
      new Set(input.snapshot.assetIds).size === input.snapshot.assetIds.length &&
      input.snapshot.assetIds.every((id) => idSchema.safeParse(id).success) &&
      input.snapshot.assets.length <= MAX_MEDIA &&
      input.snapshot.assetIds.every(id =>
        input.snapshot.assets!.filter(a =>
          a?.id === id && a.state === 'READY' &&
          hashSchema.safeParse(a.hash).success &&
          Number.isSafeInteger(a.bytes) && a.bytes > 0 && a.bytes <= MAX_BYTES,
        ).length === 1);
  } catch {
    // Corrupt/unserializable snapshots never become cleanup input.
  }
  if (!snapshotValid) {
    ledger = 'INVALID';
    block('FROZEN_SNAPSHOT_INVALID');
  }

  if (!Array.isArray(input.stages) || input.stages.length > MAX_MEDIA ||
      !Array.isArray(input.effects) || input.effects.length > MAX_EFFECTS ||
      typeof input.hasJobClaim !== 'boolean' ||
      !Number.isSafeInteger(input.pendingCleanupReviewCount) ||
      input.pendingCleanupReviewCount < 0) {
    ledger = 'INVALID';
    block('LEDGER_SET_INVALID');
  }
  if (input.hasJobClaim !== false) block('JOB_CLAIM_PENDING');
  if (input.pendingCleanupReviewCount !== 0)
    block('STAGE_CLEANUP_REVIEW_PENDING');

  if (snapshotValid && Array.isArray(input.stages) &&
      input.stages.length <= MAX_MEDIA) {
    const ids = input.snapshot.assetIds;
    if (ids.length === 0 && input.stages.length === 0) {
      ledger = 'EMPTY';
      block('OWNED_MEDIA_MISSING');
    } else if (ids.length !== input.stages.length ||
        new Set(input.stages.map(s => s?.ordinal)).size !== input.stages.length ||
        new Set(input.stages.map(s => s?.id)).size !== input.stages.length) {
      ledger = 'INCOMPLETE';
      block('LEDGER_SET_INVALID');
    } else {
      let bindingOk = true;
      let stageEvidenceOk = true;
      for (let ordinal = 0; ordinal < ids.length; ordinal++) {
        const id = ids[ordinal]!;
        const pinned = input.snapshot.assets!.find(a => a.id === id)!;
        const stage = input.stages.find(s => s?.ordinal === ordinal);
        if (!stage) {
          bindingOk = false;
          continue;
        }
        let canonical = false;
        try {
          const extension = extname(stage.remotePath).toLowerCase();
          if (supportedExtensions.has(extension)) {
            const location = assertOwnedStageLocation({
              jobId: input.job.id, ordinal, nonce: stage.nonce,
              extension, remotePath: stage.remotePath,
            });
            canonical =
              stage.mediaStoreRelativePath === location.relativePath &&
              stage.mediaStoreDisplayName === location.displayName;
          }
        } catch {
          // A non-owned Android path is never accepted, even if the DB row says READY.
        }
        if (!canonical ||
            !idSchema.safeParse(stage.id).success ||
            stage.jobId !== input.job.id ||
            stage.deviceId !== input.job.deviceId ||
            stage.ordinal !== ordinal ||
            stage.assetId !== id ||
            stage.snapshotHash !== input.snapshotHash ||
            stage.expectedHash !== pinned.hash ||
            stage.expectedBytes !== pinned.bytes ||
            !Number.isSafeInteger(stage.claimGeneration) ||
            stage.claimGeneration < 1) {
          bindingOk = false;
          continue;
        }
        if (stage.state !== 'SYNC_ACK_UNVERIFIED') {
          stageEvidenceOk = false;
          block('STAGE_TRANSFER_PENDING');
        }
        if (stage.remoteReadbackHash !== pinned.hash ||
            stage.remoteReadbackBytes !== pinned.bytes ||
            !isIso(stage.remoteReadbackAt)) {
          stageEvidenceOk = false;
          block('REMOTE_READBACK_UNVERIFIED');
        }
        if (typeof stage.mediaStoreRowId !== 'string' ||
            !stage.mediaStoreRowId.length ||
            typeof stage.mediaStoreMimeType !== 'string' ||
            !stage.mediaStoreMimeType.length ||
            stage.mediaStoreBytes !== pinned.bytes ||
            !isIso(stage.mediaStoreAt)) {
          stageEvidenceOk = false;
          block('MEDIASTORE_PICKER_UNVERIFIED');
        }
      }
      if (!bindingOk) {
        ledger = 'INVALID';
        block('LEDGER_BINDING_MISMATCH');
      } else {
        ledger = stageEvidenceOk ? 'MATCHED_DB_ONLY' : 'INCOMPLETE';
      }
    }
  }

  if (!Array.isArray(input.effects) || input.effects.length > MAX_EFFECTS)
    block('EXTERNAL_EFFECT_UNRESOLVED');
  else {
    const publish = input.effects.filter(e => e?.kind === 'PUBLISH');
    if (publish.length !== 1 || publish[0]?.state !== 'CONFIRMED')
      block('PUBLISH_JOURNAL_MISSING_OR_UNCONFIRMED');
    if (input.effects.some(e =>
      !e || !['PUBLISH', 'COMMENT'].includes(e.kind) ||
      !['CONFIRMED', 'DEFINITIVELY_REJECTED'].includes(e.state)))
      block('EXTERNAL_EFFECT_UNRESOLVED');
  }
  // This verifier is not implemented. Never accept a booleans-only caller
  // assertion, SQL CONFIRMED row or MediaStore fixture in place of it.
  block('PROVIDER_CERTIFICATION_UNAVAILABLE');
  return report();
}
