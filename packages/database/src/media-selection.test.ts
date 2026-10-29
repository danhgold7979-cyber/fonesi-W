import { describe, expect, it } from 'vitest';
import type {
  ContentAssetInfo, DeviceStageTransfer, JobDefinition, JobSnapshot,
} from '@autoreels/contracts';
import { ownedStageLocation } from '@autoreels/devices';
import { assessPersistedMediaOrder, type PersistedMediaOrderInput } from './media-selection.js';

const jobId = 'job_exact_order_fixture';
const deviceId = 'device_exact_order_fixture';
const snapshotHash = 'c'.repeat(64);
const now = '2026-10-29T00:00:00.000Z';

function fixture(): PersistedMediaOrderInput {
  // The two distinct assets deliberately share a local basename. Selection
  // must bind by frozen asset ID + ordinal, never basename/thumbnail ordering.
  const assets: ContentAssetInfo[] = [0, 1].map((i) => ({
    id: 'asset_exact_order_' + i,
    contentId: 'content_exact_order',
    relativePath: 'same-name.mp4',
    hash: (i ? 'b' : 'a').repeat(64),
    kind: 'video',
    bytes: i ? 102 : 101,
    state: 'READY',
    probe: null,
  }));
  const job: JobDefinition = {
    id: jobId, deviceId,
    contentId: 'content_exact_order',
    processId: 'process_exact_order',
    occurrenceKey: 'd'.repeat(64),
    scheduledUtc: now,
    state: 'NEEDS_REVIEW',
    revision: 1,
    priority: 0,
  };
  const snapshot: JobSnapshot = {
    workflowVersionId: 'version_fixture',
    workflowHash: 'e'.repeat(64),
    bundle: {} as JobSnapshot['bundle'],
    contentId: job.contentId,
    fields: {},
    assetIds: assets.map((asset) => asset.id),
    assets,
    targetId: null,
    networkProfileId: null,
  };
  const stages: DeviceStageTransfer[] = assets.map((asset, ordinal) => {
    const nonce = (ordinal ? '2' : '1').repeat(32);
    const loc = ownedStageLocation({ jobId, ordinal, nonce, extension: '.mp4' });
    return {
      id: 'stage_exact_order_' + ordinal, jobId, deviceId,
      hostId: 'host_exact_order',
      assetId: asset.id, ordinal, snapshotHash,
      expectedHash: asset.hash, expectedBytes: asset.bytes,
      claimGeneration: 7, remotePath: loc.remotePath, nonce,
      state: 'SYNC_ACK_UNVERIFIED',
      remoteReadbackHash: asset.hash, remoteReadbackBytes: asset.bytes,
      remoteReadbackAt: now,
      mediaStoreRowId: String(44 + ordinal),
      mediaStoreDisplayName: loc.displayName,
      mediaStoreRelativePath: loc.relativePath,
      mediaStoreMimeType: 'video/mp4', mediaStoreBytes: asset.bytes,
      mediaStoreAt: now, createdAt: now, updatedAt: now,
    };
  });
  return {
    job, snapshot, snapshotHash, stages,
    claimGeneration: 7,
    hasExternalEffect: false,
    lastObservationByStage: new Map(stages.map((stage) => [
      stage.id, {
        classification: 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED' as const,
        mediaStoreStatus: 'INDEXED_EXACT' as const,
        observedHash: stage.expectedHash,
        observedBytes: stage.expectedBytes,
      },
    ])),
  };
}

describe('S096.1 persisted exact media order (never Android picker permission)', () => {
  it('uses frozen asset ID ordinal, not stage order or a duplicated local basename', () => {
    const input = fixture();
    input.stages = [...input.stages].reverse();
    const before = JSON.stringify(input);
    const result = assessPersistedMediaOrder(input);
    expect(result).toEqual({
      scope: 'PERSISTED_STAGE_ORDER_NOT_PICKER_VERIFIED',
      status: 'INDEXED_CANDIDATES_NOT_PICKER_VERIFIED',
      blockers: [], canSelect: false, canDispatch: false,
      slots: [
        { ordinal: 0, kind: 'VIDEO', evidence: 'INDEXED_ROW_RECORDED_NOT_LIVE', blockers: [] },
        { ordinal: 1, kind: 'VIDEO', evidence: 'INDEXED_ROW_RECORDED_NOT_LIVE', blockers: [] },
      ],
    });
    expect(JSON.stringify(input)).toBe(before);
    const serialized = JSON.stringify(result);
    for (const secret of [
      jobId, deviceId, snapshotHash,
      'same-name.mp4', input.stages[0]!.id,
      input.stages[0]!.remotePath, input.stages[0]!.nonce,
      input.stages[0]!.mediaStoreRowId, input.stages[0]!.expectedHash,
    ]) expect(serialized).not.toContain(secret);
  });

  const blocked: {
    name: string;
    mutate: (input: PersistedMediaOrderInput) => void;
    code: string;
  }[] = [
    {
      name: 'swapped ordinal pointers',
      mutate: (input) => { input.stages = input.stages.map((stage) =>
        ({ ...stage, ordinal: 1 - stage.ordinal })); },
      code: 'STAGE_OWNER_MISMATCH',
    },
    {
      name: 'stage with foreign job owner',
      mutate: (input) => { input.stages = [{ ...input.stages[0]!, jobId: 'other_job' }, input.stages[1]!]; },
      code: 'STAGE_OWNER_MISMATCH',
    },
    {
      name: 'wrong pinned hash at ordinal',
      mutate: (input) => { input.stages = [{ ...input.stages[0]!, assetId: input.stages[1]!.assetId }, input.stages[1]!]; },
      code: 'STAGE_OWNER_MISMATCH',
    },
    {
      name: 'stage remote path escapes owned namespace',
      mutate: (input) => { input.stages = [{ ...input.stages[0]!, remotePath: '/sdcard/DCIM/unowned.mp4' }, input.stages[1]!]; },
      code: 'STAGE_OWNER_MISMATCH',
    },
    {
      name: 'stage remote path traversal',
      mutate: (input) => { input.stages = [{ ...input.stages[0]!, remotePath: input.stages[0]!.remotePath + '/../foreign.mp4' }, input.stages[1]!]; },
      code: 'STAGE_OWNER_MISMATCH',
    },
    {
      name: 'wrong historical claim generation',
      mutate: (input) => { input.claimGeneration = 6; },
      code: 'STAGE_GENERATION_MISMATCH',
    },
    {
      name: 'missing historical claim',
      mutate: (input) => { input.claimGeneration = null; },
      code: 'STAGE_GENERATION_MISMATCH',
    },
    {
      name: 'remote bytes never read back',
      mutate: (input) => { input.stages = [{ ...input.stages[0]!, remoteReadbackHash: null }, input.stages[1]!]; },
      code: 'REMOTE_BYTES_NOT_VERIFIED',
    },
    {
      name: 'state still transfer uncertain',
      mutate: (input) => { input.stages = [{ ...input.stages[0]!, state: 'TRANSFER_UNCERTAIN' }, input.stages[1]!]; },
      code: 'REMOTE_BYTES_NOT_VERIFIED',
    },
    {
      name: 'remote bytes differ from frozen asset',
      mutate: (input) => { input.stages = [{ ...input.stages[0]!, remoteReadbackBytes: 1 }, input.stages[1]!]; },
      code: 'REMOTE_BYTES_NOT_VERIFIED',
    },
    {
      name: 'media store row is absent',
      mutate: (input) => { input.stages = [{ ...input.stages[0]!, mediaStoreRowId: null }, input.stages[1]!]; },
      code: 'MEDIASTORE_ROW_NOT_VERIFIED',
    },
    {
      name: 'duplicate MediaStore provider row ID',
      mutate: (input) => { input.stages = [{ ...input.stages[0]!, mediaStoreRowId: input.stages[1]!.mediaStoreRowId }, input.stages[1]!]; },
      code: 'MEDIASTORE_ROW_COLLISION',
    },
    {
      name: 'duplicate owned remote destination',
      mutate: (input) => { input.stages = [{ ...input.stages[0]!, remotePath: input.stages[1]!.remotePath }, input.stages[1]!]; },
      code: 'STAGE_UNEXPECTED_OR_DUPLICATE',
    },
    {
      name: 'incorrect media store display name',
      mutate: (input) => { input.stages = [{ ...input.stages[0]!, mediaStoreDisplayName: 'same-name.mp4' }, input.stages[1]!]; },
      code: 'MEDIASTORE_ROW_NOT_VERIFIED',
    },
    {
      name: 'MediaStore wrong directory',
      mutate: (input) => { input.stages = [{ ...input.stages[0]!, mediaStoreRelativePath: 'DCIM/Camera/' }, input.stages[1]!]; },
      code: 'MEDIASTORE_ROW_NOT_VERIFIED',
    },
    {
      name: 'MediaStore bad MIME family',
      mutate: (input) => { input.stages = [{ ...input.stages[0]!, mediaStoreMimeType: 'image/jpeg' }, input.stages[1]!]; },
      code: 'MEDIASTORE_ROW_NOT_VERIFIED',
    },
    {
      name: 'MediaStore wrong bytes',
      mutate: (input) => { input.stages = [{ ...input.stages[0]!, mediaStoreBytes: 3 }, input.stages[1]!]; },
      code: 'MEDIASTORE_ROW_NOT_VERIFIED',
    },
    {
      name: 'stale later observation says no indexed row',
      mutate: (input) => {
        input.lastObservationByStage = new Map([[
          input.stages[0]!.id, {
            classification: 'REMOTE_BYTES_MATCHED',
            mediaStoreStatus: 'NOT_INDEXED',
            observedHash: input.stages[0]!.expectedHash,
            observedBytes: input.stages[0]!.expectedBytes,
          },
        ]]);
      },
      code: 'LATEST_OBSERVATION_CONTRADICTS_ROW',
    },
    {
      name: 'existing external publish effect',
      mutate: (input) => { input.hasExternalEffect = true; },
      code: 'EXTERNAL_EFFECT_PRESENT',
    },
    {
      name: 'extra stage outside frozen order',
      mutate: (input) => { input.stages = [...input.stages,
        { ...input.stages[0]!, id: 'stage_unexpected', ordinal: 2 }]; },
      code: 'STAGE_UNEXPECTED_OR_DUPLICATE',
    },
    {
      name: 'missing stage for second asset',
      mutate: (input) => { input.stages = input.stages.slice(0, 1); },
      code: 'STAGE_MISSING',
    },
    {
      name: 'duplicate frozen asset identity',
      mutate: (input) => { input.snapshot.assetIds[1] = input.snapshot.assetIds[0]!; },
      code: 'FROZEN_SELECTION_INVALID',
    },
    {
      name: 'pin is no longer READY',
      mutate: (input) => { input.snapshot.assets![0]!.state = 'CHANGED'; },
      code: 'PINNED_ASSET_INVALID',
    },
  ];
  for (const test of blocked) {
    it('fails closed on ' + test.name, () => {
      const input = fixture();
      test.mutate(input);
      const output = assessPersistedMediaOrder(input);
      expect(output.status).toBe('BLOCKED');
      expect(output.canSelect).toBe(false);
      expect(output.canDispatch).toBe(false);
      expect(output.blockers).toContain(test.code);
    });
  }
  it('text-only jobs do not fabricate a selectable stage', () => {
    const input = fixture();
    input.snapshot.assetIds = [];
    input.snapshot.assets = [];
    input.stages = [];
    input.claimGeneration = null;
    const report = assessPersistedMediaOrder(input);
    expect(report).toMatchObject({
      status: 'NO_MEDIA', slots: [], blockers: [],
      canSelect: false, canDispatch: false,
    });
  });
});
