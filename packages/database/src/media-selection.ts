import { extname } from 'node:path';
import type {
  DeviceStageTransfer, JobDefinition, JobSnapshot, MediaOrderBlocker,
  PersistedOrderedMediaReport, StageReconciliationClassification,
  DeviceStageReconciliation,
} from '@autoreels/contracts';
import { ownedStageLocation } from '@autoreels/devices';

/** Only the latest persisted audit for a stage is relevant; not a live picker observation. */
export interface LastStageObservation {
  classification: StageReconciliationClassification;
  mediaStoreStatus: DeviceStageReconciliation['mediaStoreStatus'];
  observedHash: string | null;
  observedBytes: number | null;
}

export interface PersistedMediaOrderInput {
  job: JobDefinition;
  snapshot: JobSnapshot;
  snapshotHash: string;
  stages: readonly DeviceStageTransfer[];
  claimGeneration: number | null;
  hasExternalEffect: boolean;
  lastObservationByStage?: ReadonlyMap<string, LastStageObservation>;
}

const validHash = (hash: unknown): hash is string =>
  typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash);
const validTime = (value: string | null): boolean =>
  value !== null && Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

/**
 * Evidence-only exact-order verifier, never a picker selector or execution grant.
 * The canonical ordering ALWAYS comes from the frozen snapshot.assetIds array,
 * never filenames, stage insertion order, MediaStore query order or thumbnails.
 *
 * No sensitive identifiers, paths, hashes, row IDs or filenames appear in output.
 */
export function assessPersistedMediaOrder(input: PersistedMediaOrderInput): PersistedOrderedMediaReport {
  const blockers: MediaOrderBlocker[] = [];
  const add = (code: MediaOrderBlocker): void => {
    if (!blockers.includes(code)) blockers.push(code);
  };
  const report = (
    status: PersistedOrderedMediaReport['status'],
    slots: PersistedOrderedMediaReport['slots'],
  ): PersistedOrderedMediaReport => ({
    scope: 'PERSISTED_STAGE_ORDER_NOT_PICKER_VERIFIED',
    status, blockers, slots, canSelect: false, canDispatch: false,
  });

  const ids = input.snapshot.assetIds;
  const frozenAssets = input.snapshot.assets ?? [];
  if (!Array.isArray(ids) || ids.length > 32 ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => typeof id !== 'string' || !id.length) ||
      input.snapshot.contentId !== input.job.contentId ||
      !validHash(input.snapshotHash) || !Array.isArray(frozenAssets)) {
    add('FROZEN_SELECTION_INVALID');
    return report('BLOCKED', []);
  }
  if (!['PREFLIGHT', 'RUNNING', 'NEEDS_REVIEW'].includes(input.job.state))
    add('JOB_STATE_NOT_REVIEWABLE');
  if (input.hasExternalEffect) add('EXTERNAL_EFFECT_PRESENT');
  if (input.stages.length > 32) add('STAGE_UNEXPECTED_OR_DUPLICATE');
  if (!ids.length) {
    if (input.stages.length) add('STAGE_UNEXPECTED_OR_DUPLICATE');
    return report(blockers.length ? 'BLOCKED' : 'NO_MEDIA', []);
  }

  const byOrdinal = new Map<number, DeviceStageTransfer[]>();
  for (const stage of input.stages) {
    if (!Number.isSafeInteger(stage.ordinal) || stage.ordinal < 0 ||
        stage.ordinal >= ids.length || stage.jobId !== input.job.id)
      add('STAGE_UNEXPECTED_OR_DUPLICATE');
    const found = byOrdinal.get(stage.ordinal) ?? [];
    found.push(stage);
    byOrdinal.set(stage.ordinal, found);
    if (found.length > 1) add('STAGE_UNEXPECTED_OR_DUPLICATE');
  }

  const rowCounts = new Map<string, number>();
  const pathCounts = new Map<string, number>();
  for (const stage of input.stages) {
    if (stage.mediaStoreRowId !== null)
      rowCounts.set(stage.mediaStoreRowId, (rowCounts.get(stage.mediaStoreRowId) ?? 0) + 1);
    pathCounts.set(stage.remotePath, (pathCounts.get(stage.remotePath) ?? 0) + 1);
  }
  const slots: PersistedOrderedMediaReport['slots'] = [];
  for (const [ordinal, assetId] of ids.entries()) {
    const reasons: MediaOrderBlocker[] = [];
    const block = (reason: MediaOrderBlocker): void => {
      if (!reasons.includes(reason)) reasons.push(reason);
      add(reason);
    };
    const pinned = frozenAssets.filter((candidate) => candidate.id === assetId);
    const asset = pinned[0];
    const kind = asset?.kind === 'image' ? 'IMAGE'
      : asset?.kind === 'video' ? 'VIDEO' : 'UNKNOWN';
    if (pinned.length !== 1 || !asset || asset.state !== 'READY' ||
        !validHash(asset.hash) || !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 ||
        kind === 'UNKNOWN')
      block('PINNED_ASSET_INVALID');

    const matched = byOrdinal.get(ordinal) ?? [];
    if (matched.length === 0) block('STAGE_MISSING');
    if (matched.length > 1) block('STAGE_UNEXPECTED_OR_DUPLICATE');
    const stage = matched.length === 1 ? matched[0]! : null;
    if (stage) {
      if (stage.jobId !== input.job.id || stage.deviceId !== input.job.deviceId ||
          stage.snapshotHash !== input.snapshotHash || stage.assetId !== assetId ||
          !asset || stage.expectedHash !== asset.hash || stage.expectedBytes !== asset.bytes)
        block('STAGE_OWNER_MISMATCH');
      if (!Number.isSafeInteger(input.claimGeneration) ||
          !Number.isSafeInteger(stage.claimGeneration) ||
          stage.claimGeneration <= 0 || stage.claimGeneration !== input.claimGeneration)
        block('STAGE_GENERATION_MISMATCH');
      let path: ReturnType<typeof ownedStageLocation> | null = null;
      if (asset && kind !== 'UNKNOWN') {
        try {
          const extension = extname(asset.relativePath).toLowerCase();
          path = ownedStageLocation({
            jobId: input.job.id, ordinal, nonce: stage.nonce, extension,
          });
          if (stage.remotePath !== path.remotePath)
            block('STAGE_OWNER_MISMATCH');
        } catch {
          block('STAGE_OWNER_MISMATCH');
        }
      }
      if ((pathCounts.get(stage.remotePath) ?? 0) > 1)
        block('STAGE_UNEXPECTED_OR_DUPLICATE');
      if (stage.state !== 'SYNC_ACK_UNVERIFIED' ||
          stage.remoteReadbackHash !== stage.expectedHash ||
          stage.remoteReadbackBytes !== stage.expectedBytes ||
          !validTime(stage.remoteReadbackAt))
        block('REMOTE_BYTES_NOT_VERIFIED');
      const mimeFamily = kind === 'IMAGE' ? 'image/' : 'video/';
      if (!path || stage.mediaStoreRowId === null ||
          !/^\d{1,20}$/.test(stage.mediaStoreRowId) ||
          stage.mediaStoreDisplayName !== path.displayName ||
          stage.mediaStoreRelativePath !== path.relativePath ||
          stage.mediaStoreMimeType === null ||
          !stage.mediaStoreMimeType.startsWith(mimeFamily) ||
          !/^(?:image|video)\/[a-z0-9.+-]+$/.test(stage.mediaStoreMimeType) ||
          stage.mediaStoreBytes !== stage.expectedBytes ||
          !validTime(stage.mediaStoreAt))
        block('MEDIASTORE_ROW_NOT_VERIFIED');
      if (stage.mediaStoreRowId && (rowCounts.get(stage.mediaStoreRowId) ?? 0) > 1)
        block('MEDIASTORE_ROW_COLLISION');

      const latest = input.lastObservationByStage?.get(stage.id);
      if (latest && (latest.classification !== 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED' ||
          latest.mediaStoreStatus !== 'INDEXED_EXACT' ||
          latest.observedHash !== stage.expectedHash ||
          latest.observedBytes !== stage.expectedBytes))
        block('LATEST_OBSERVATION_CONTRADICTS_ROW');
    }
    slots.push({
      ordinal, kind,
      evidence: reasons.length ? 'BLOCKED' : 'INDEXED_ROW_RECORDED_NOT_LIVE',
      blockers: reasons,
    });
  }
  return report(blockers.length ? 'BLOCKED' : 'INDEXED_CANDIDATES_NOT_PICKER_VERIFIED', slots);
}
