import { ownedStageLocation } from './owned-stage.js';
import type { AdbClient } from './index.js';

/** Host-only ADB readbacks, never an Android deletion or provider receipt. */
export type OwnedRemoteStatReadback =
  Awaited<ReturnType<AdbClient['statOwnedStage']>>;
export type OwnedMediaStoreReadback =
  Awaited<ReturnType<AdbClient['probeOwnedStageMediaStore']>>;

export type OwnedCleanupReadbackBlocker =
  | 'OWNED_EXPECTATION_INVALID'
  | 'REMOTE_STAT_INVALID'
  | 'REMOTE_BYTES_MISMATCH'
  | 'MEDIASTORE_READBACK_INVALID'
  | 'REMOTE_STILL_PRESENT'
  | 'MEDIASTORE_STILL_INDEXED'
  | 'MEDIASTORE_UNSUPPORTED_OR_AMBIGUOUS'
  | 'PROVIDER_AND_CLEANUP_UNCERTIFIED';

export interface OwnedCleanupReadbackSummary {
  scope: 'PRIVATE_OWNED_STAGE_ABSENCE_NOT_DELETE_CERTIFIED';
  status: 'BLOCKED' | 'REMOTE_PRESENT_REVIEW' |
    'MEDIASTORE_PRESENT_REVIEW' | 'UNSUPPORTED_REVIEW' |
    'ABSENCE_CANDIDATE_UNCERTIFIED';
  /** Structured status only; never raw Android path, nonce or MediaStore row. */
  remote: 'PRESENT' | 'ABSENT' | 'UNKNOWN';
  mediaStore: 'INDEXED_EXACT' | 'NOT_INDEXED' | 'AMBIGUOUS' | 'UNSUPPORTED' | 'UNKNOWN';
  blockers: OwnedCleanupReadbackBlocker[];
  canDelete: false;
  canMarkClean: false;
  canRetry: false;
  canDispatch: false;
}

/**
 * S102.2 post-delete readback pre-verifier. Observations might be genuine,
 * stale, forged or incomplete, and the requested deletion has NOT been
 * authenticated. No combination of ADB STAT and MediaStore proves that a
 * provider-certified job was safely cleaned up.
 */
export function assessOwnedCleanupReadback(input: {
  jobId: string;
  ordinal: number;
  nonce: string;
  extension: string;
  expectedBytes: number;
  remote: OwnedRemoteStatReadback;
  mediaStore: OwnedMediaStoreReadback;
}): OwnedCleanupReadbackSummary {
  const blockers: OwnedCleanupReadbackBlocker[] = [];
  const block = (v: OwnedCleanupReadbackBlocker): void => {
    if (!blockers.includes(v)) blockers.push(v);
  };
  const remoteStatus = input.remote?.status === 'REMOTE_PRESENT_OBSERVED' ? 'PRESENT' :
    input.remote?.status === 'REMOTE_ABSENT_OBSERVED' ? 'ABSENT' : 'UNKNOWN';
  const mediaStoreStatus = ['INDEXED_EXACT', 'NOT_INDEXED', 'AMBIGUOUS', 'UNSUPPORTED']
    .includes(input.mediaStore?.status) ? input.mediaStore.status : 'UNKNOWN';
  const report = (status: OwnedCleanupReadbackSummary['status']): OwnedCleanupReadbackSummary => ({
    scope: 'PRIVATE_OWNED_STAGE_ABSENCE_NOT_DELETE_CERTIFIED',
    status, remote: remoteStatus, mediaStore: mediaStoreStatus,
    blockers, canDelete: false, canMarkClean: false,
    canRetry: false, canDispatch: false,
  });

  let owned: ReturnType<typeof ownedStageLocation> | null = null;
  try {
    if (typeof input.extension !== 'string' ||
        input.extension !== input.extension.toLowerCase() ||
        !Number.isSafeInteger(input.expectedBytes) ||
        input.expectedBytes <= 0 || input.expectedBytes > 512 * 1024 * 1024)
      throw new Error('invalid expectation');
    owned = ownedStageLocation({
      jobId: input.jobId, ordinal: input.ordinal,
      nonce: input.nonce, extension: input.extension,
    });
  } catch {
    block('OWNED_EXPECTATION_INVALID');
  }
  const remote = input.remote;
  if (!owned || !remote || remote.remotePath !== owned.remotePath ||
      remote.canDelete !== false || remote.canMarkClean !== false ||
      (remote.status !== 'REMOTE_PRESENT_OBSERVED' &&
        remote.status !== 'REMOTE_ABSENT_OBSERVED') ||
      (remote.status === 'REMOTE_ABSENT_OBSERVED' &&
        (remote.observedBytes !== null || remote.matchesExpectedBytes !== false)) ||
      (remote.status === 'REMOTE_PRESENT_OBSERVED' &&
        (!Number.isSafeInteger(remote.observedBytes) ||
          remote.observedBytes === null || remote.observedBytes < 0 ||
          remote.matchesExpectedBytes !==
            (remote.observedBytes === input.expectedBytes))))
    block('REMOTE_STAT_INVALID');
  else if (remote.status === 'REMOTE_PRESENT_OBSERVED' &&
      remote.observedBytes !== input.expectedBytes)
    block('REMOTE_BYTES_MISMATCH');

  const ms = input.mediaStore;
  if (!ms || !owned ||
      !['INDEXED_EXACT', 'NOT_INDEXED', 'AMBIGUOUS', 'UNSUPPORTED'].includes(ms.status))
    block('MEDIASTORE_READBACK_INVALID');
  else if (ms.status === 'INDEXED_EXACT') {
    const family = /^\.(?:jpg|jpeg|png|webp|gif|bmp)$/.test(input.extension)
      ? 'image/' : 'video/';
    if (typeof ms.rowId !== 'string' || !/^\d{1,20}$/.test(ms.rowId) ||
        ms.displayName !== owned.displayName ||
        ms.relativePath.replace(/^\/+/, '') !== owned.relativePath ||
        typeof ms.mimeType !== 'string' || !ms.mimeType.startsWith(family) ||
        ms.bytes !== input.expectedBytes)
      block('MEDIASTORE_READBACK_INVALID');
  } else if (Object.keys(ms).length !== 1) {
    // A synthetic NOT_INDEXED with hidden row metadata cannot be treated as
    // a canonical absence observation.
    block('MEDIASTORE_READBACK_INVALID');
  }
  if (blockers.length) {
    block('PROVIDER_AND_CLEANUP_UNCERTIFIED');
    return report('BLOCKED');
  }
  if (remoteStatus === 'PRESENT') {
    block('REMOTE_STILL_PRESENT');
    block('PROVIDER_AND_CLEANUP_UNCERTIFIED');
    return report('REMOTE_PRESENT_REVIEW');
  }
  if (mediaStoreStatus === 'INDEXED_EXACT') {
    block('MEDIASTORE_STILL_INDEXED');
    block('PROVIDER_AND_CLEANUP_UNCERTIFIED');
    return report('MEDIASTORE_PRESENT_REVIEW');
  }
  if (mediaStoreStatus !== 'NOT_INDEXED') {
    block('MEDIASTORE_UNSUPPORTED_OR_AMBIGUOUS');
    block('PROVIDER_AND_CLEANUP_UNCERTIFIED');
    return report('UNSUPPORTED_REVIEW');
  }
  block('PROVIDER_AND_CLEANUP_UNCERTIFIED');
  return report('ABSENCE_CANDIDATE_UNCERTIFIED');
}
