import { describe, expect, it } from 'vitest';
import type { DeviceStageTransfer, JobDefinition, JobSnapshot } from '@autoreels/contracts';
import { bundleHash, contentHash } from '@autoreels/domain';
import {
  assessPostCleanupReadiness,
  type PostCleanupEffectRow,
} from './post-cleanup-review.js';

const observedAt = '2026-10-29T12:00:00.000Z';
const nonce = 'a'.repeat(32);
function fixture() {
  const job: JobDefinition = {
    id: 'job_cleanup_probe', occurrenceKey: contentHash('cleanup_occurrence'),
    processId: 'process_cleanup_probe', deviceId: 'device_cleanup_probe',
    contentId: 'content_cleanup_probe', scheduledUtc: observedAt,
    state: 'SUCCESS', revision: 9, priority: 0,
  };
  const bundle = { workflow: { appId: 'fb' }, graphs: [], inputs: [] } as unknown as
    JobSnapshot['bundle'];
  const snapshot = {
    workflowVersionId: 'version_cleanup_probe', workflowHash: bundleHash(bundle),
    bundle, contentId: job.contentId, fields: {},
    assetIds: ['asset_cleanup_probe'],
    assets: [{
      id: 'asset_cleanup_probe', hash: 'b'.repeat(64),
      bytes: 1234, state: 'READY', kind: 'video',
    }],
    targetId: null, networkProfileId: null,
  } as unknown as JobSnapshot;
  const snapshotHash = contentHash(snapshot);
  const remotePath = '/sdcard/Download/AutoReelsStudio/job-' + job.id +
    '/asset-000-' + nonce + '.mp4';
  const stage: DeviceStageTransfer = {
    id: 'stage_cleanup_probe', jobId: job.id, deviceId: job.deviceId,
    hostId: 'host_cleanup_probe', assetId: snapshot.assetIds[0]!,
    ordinal: 0, snapshotHash, expectedHash: snapshot.assets![0]!.hash,
    expectedBytes: 1234, claimGeneration: 2, remotePath, nonce,
    state: 'SYNC_ACK_UNVERIFIED',
    remoteReadbackHash: snapshot.assets![0]!.hash,
    remoteReadbackBytes: 1234, remoteReadbackAt: observedAt,
    mediaStoreRowId: 'media_row_fixture',
    mediaStoreDisplayName: 'asset-000-' + nonce + '.mp4',
    mediaStoreRelativePath: 'Download/AutoReelsStudio/job-' + job.id + '/',
    mediaStoreMimeType: 'video/mp4', mediaStoreBytes: 1234,
    mediaStoreAt: observedAt, createdAt: observedAt, updatedAt: observedAt,
  };
  const effects: PostCleanupEffectRow[] = [{ kind: 'PUBLISH', state: 'CONFIRMED' }];
  return {
    job, snapshot, snapshotHash, stages: [stage], effects,
    hasJobClaim: false, pendingCleanupReviewCount: 0,
  };
}
const assess = (f: ReturnType<typeof fixture>) => assessPostCleanupReadiness(f);
const noRights = {
  status: 'BLOCKED', canDelete: false, canDispatch: false,
  canRetry: false, canMarkClean: false,
};

describe('S102.1 job-wide post cleanup ledger is never Android-delete authorization', () => {
  it('matches the exact DB-only owned media but still requires real provider certification', () => {
    const f = fixture(), before = JSON.stringify(f);
    const result = assess(f);
    expect(result).toEqual({
      scope: 'PRIVATE_JOB_OWNED_CLEANUP_NOT_PROVIDER_CERTIFIED',
      ...noRights, ledger: 'MATCHED_DB_ONLY', frozenMediaCount: 1, stageCount: 1,
      blockers: ['PROVIDER_CERTIFICATION_UNAVAILABLE'],
    });
    expect(JSON.stringify(f)).toBe(before);
    const redacted = JSON.stringify(result);
    for (const secret of [f.job.id, f.stages[0]!.id, f.stages[0]!.remotePath,
      f.stages[0]!.nonce, f.stages[0]!.expectedHash,
      f.snapshotHash, f.stages[0]!.mediaStoreRowId!])
      expect(redacted).not.toContain(secret);
  });

  it('blocks every nonterminal or operator-review job phase', () => {
    for (const state of ['SCHEDULED', 'QUEUED', 'PREFLIGHT', 'RUNNING',
      'POST_PENDING', 'POSTED', 'COMMENT_PENDING', 'NEEDS_REVIEW'] as const) {
      const f = fixture(); f.job.state = state;
      expect(assess(f)).toMatchObject({
        ...noRights, ledger: 'MATCHED_DB_ONLY',
        blockers: ['JOB_NOT_SUCCESSFUL', 'PROVIDER_CERTIFICATION_UNAVAILABLE'],
      });
    }
  });

  it('does not interpret missing stages or text-only snapshots as deletable', () => {
    const f = fixture(); f.stages = [];
    expect(assess(f)).toMatchObject({
      ...noRights, ledger: 'INCOMPLETE',
      blockers: ['LEDGER_SET_INVALID', 'PROVIDER_CERTIFICATION_UNAVAILABLE'],
    });
    const textOnly = fixture();
    textOnly.snapshot.assetIds = [];
    textOnly.snapshot.assets = [];
    textOnly.snapshotHash = contentHash(textOnly.snapshot);
    textOnly.stages = [];
    expect(assess(textOnly)).toMatchObject({
      ...noRights, ledger: 'EMPTY', frozenMediaCount: 0, stageCount: 0,
      blockers: ['OWNED_MEDIA_MISSING', 'PROVIDER_CERTIFICATION_UNAVAILABLE'],
    });
  });

  it('rejects duplicate/extra stage or duplicate frozen asset descriptors', () => {
    const f = fixture(); f.stages.push({ ...f.stages[0]!, id: 'stage_copy' });
    expect(assess(f)).toMatchObject({
      ...noRights, ledger: 'INCOMPLETE', blockers: ['LEDGER_SET_INVALID'],
    });
    const bad = fixture();
    bad.snapshot.assets!.push({ ...bad.snapshot.assets![0]! });
    bad.snapshotHash = contentHash(bad.snapshot);
    expect(assess(bad)).toMatchObject({
      ...noRights, ledger: 'INVALID', blockers: ['FROZEN_SNAPSHOT_INVALID'],
    });
  });

  it('rejects foreign, traversal, mismatched or forged owned-stage identity', () => {
    const cases: Array<(f: ReturnType<typeof fixture>) => void> = [
      f => { f.stages[0]!.remotePath = '/sdcard/DCIM/Camera/shared.mp4'; },
      f => { f.stages[0]!.remotePath += '/../sibling.mp4'; },
      f => { f.stages[0]!.nonce = 'f'.repeat(32); },
      f => { f.stages[0]!.assetId = 'asset_other'; },
      f => { f.stages[0]!.expectedHash = 'c'.repeat(64); },
      f => { f.stages[0]!.expectedBytes += 1; },
      f => { f.stages[0]!.deviceId = 'device_foreign'; },
      f => { f.stages[0]!.snapshotHash = contentHash('foreign_snapshot'); },
    ];
    for (const mutate of cases) {
      const f = fixture(); mutate(f);
      expect(assess(f)).toMatchObject({
        ...noRights, ledger: 'INVALID',
        blockers: ['LEDGER_BINDING_MISMATCH'],
      });
    }
  });

  it('keeps remote and MediaStore claims separate from owned-path identity', () => {
    for (const mutate of [
      (f: ReturnType<typeof fixture>) => { f.stages[0]!.state = 'NEEDS_REVIEW'; },
      (f: ReturnType<typeof fixture>) => { f.stages[0]!.remoteReadbackHash = null; },
      (f: ReturnType<typeof fixture>) => { f.stages[0]!.remoteReadbackBytes = 0; },
      (f: ReturnType<typeof fixture>) => { f.stages[0]!.remoteReadbackAt = 'forged'; },
      (f: ReturnType<typeof fixture>) => { f.stages[0]!.mediaStoreRowId = null; },
      (f: ReturnType<typeof fixture>) => { f.stages[0]!.mediaStoreRelativePath = 'Download/'; },
      (f: ReturnType<typeof fixture>) => { f.stages[0]!.mediaStoreDisplayName = 'foreign.mp4'; },
      (f: ReturnType<typeof fixture>) => { f.stages[0]!.mediaStoreBytes = 5000; },
    ]) {
      const f = fixture(); mutate(f);
      expect(assess(f)).toMatchObject({
        ...noRights, ledger: 'INCOMPLETE',
        blockers: expect.arrayContaining(['PROVIDER_CERTIFICATION_UNAVAILABLE']),
      });
      expect(assess(f).blockers).not.toContain('LEDGER_BINDING_MISMATCH');
    }
  });

  it('requires a post journal and rejects uncertainty regardless of synthetic job success', () => {
    const f = fixture();
    f.effects = [];
    expect(assess(f)).toMatchObject({
      ...noRights, blockers: [
        'PUBLISH_JOURNAL_MISSING_OR_UNCONFIRMED', 'PROVIDER_CERTIFICATION_UNAVAILABLE',
      ],
    });
    for (const state of ['INTENT', 'ATTEMPT_UNCERTAIN', 'NEEDS_REVIEW',
      'DEFINITIVELY_REJECTED', 'FAKE_SUCCESS']) {
      const pending = fixture(); pending.effects = [{ kind: 'PUBLISH', state }];
      expect(assess(pending).blockers).toContain('PUBLISH_JOURNAL_MISSING_OR_UNCONFIRMED');
      expect(assess(pending).canDelete).toBe(false);
    }
    const comment = fixture();
    comment.effects.push({ kind: 'COMMENT', state: 'ATTEMPT_UNCERTAIN' });
    expect(assess(comment).blockers).toEqual(expect.arrayContaining([
      'EXTERNAL_EFFECT_UNRESOLVED', 'PROVIDER_CERTIFICATION_UNAVAILABLE',
    ]));
  });

  it('preserves recovery claim and unresolved manual stage review blockers', () => {
    const f = fixture(); f.hasJobClaim = true; f.pendingCleanupReviewCount = 1;
    expect(assess(f)).toMatchObject({
      ...noRights, ledger: 'MATCHED_DB_ONLY',
      blockers: ['JOB_CLAIM_PENDING', 'STAGE_CLEANUP_REVIEW_PENDING',
        'PROVIDER_CERTIFICATION_UNAVAILABLE'],
    });
  });

  it('fails closed for oversized journal/stage sets and forged snapshot hash', () => {
    const f = fixture();
    f.stages = Array.from({ length: 33 }, (_, i) =>
      ({ ...f.stages[0]!, id: 'stage_excess_' + i, ordinal: i }));
    expect(assess(f)).toMatchObject({
      ...noRights, ledger: 'INVALID', blockers: expect.arrayContaining(['LEDGER_SET_INVALID']),
    });
    const many = fixture();
    many.effects = Array.from({length: 34}, () => ({kind: 'COMMENT',state: 'CONFIRMED'}));
    expect(assess(many).blockers).toEqual(expect.arrayContaining([
      'EXTERNAL_EFFECT_UNRESOLVED', 'PROVIDER_CERTIFICATION_UNAVAILABLE',
    ]));
    const corrupt = fixture();
    corrupt.snapshotHash = contentHash('invalid_frozen_snapshot');
    expect(assess(corrupt)).toMatchObject({
      ...noRights, ledger: 'INVALID', blockers: ['FROZEN_SNAPSHOT_INVALID'],
    });
  });
});
