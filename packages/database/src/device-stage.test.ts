import { beforeEach, afterEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  DeviceLease, DeviceStageTransfer, JobDefinition, ProcessDefinition,
} from '@autoreels/contracts';
import { contentHash } from '@autoreels/domain';
import { StudioDatabase } from './index.js';
import { dispatchInternal } from '../../../apps/desktop/src/host/internal.js';
import { dispatch } from '../../../apps/desktop/src/host/service.js';

const at = Date.parse('2026-10-28T00:00:00.000Z');
const hostId = 'host_stage_fixture';
let dir: string, db: StudioDatabase;
const dbPath = () => join(dir, 'studio.sqlite');
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'autoreels-device-stage-'));
  db = new StudioDatabase(dbPath());
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
function sql(action: (value: DatabaseSync) => void) {
  const connection = new DatabaseSync(dbPath());
  try { action(connection); } finally { connection.close(); }
}
function fixture() {
  const deviceId = 'device_stage_fixture', processId = 'process_stage_fixture';
  db.registerObservedDevice(deviceId, 'Stage fixture');
  sql((conn) => {
    conn.prepare(
      "INSERT INTO device_profiles(device_id,fingerprint,metadata,identity,revision) VALUES(?,?,NULL,'VERIFIED_PROPERTIES',0)",
    ).run(deviceId, contentHash('physical fixture only'));
  });
  const draft = db.createWorkflow('fb', 'Durable stage fixture'),
    version = db.createVersion(draft.workflowId, 0);
  const process: ProcessDefinition = {
    id: processId, name: processId, appId: 'fb',
    workflowId: draft.workflowId, workflowVersionId: version.id,
    deviceId, accountId: null, targetId: null, revision: 0, archived: false,
    schedule: {
      timezone: 'Asia/Ho_Chi_Minh', startDate: '2026-10-26',
      slots: ['08:00'], weekdays: [1, 2, 3, 4, 5, 6, 7],
      overduePolicy: 'CATCH_UP', jitterMinutes: 0,
    },
  };
  db.saveProcess(process, null);
  const file = join(dir, 'fixture.mp4');
  writeFileSync(file, 'only local fixture bytes');
  const grant = db.registerNativeSource({
    processId, kind: 'FILE', rootPath: file, recursive: false,
    watch: false, hostId,
  });
  const hash = 'a'.repeat(64);
  db.applyScannedAsset(grant.id, hostId, grant.revision, 'gen_scan_1', {
    relativePath: basename(file), hash, bytes: 24, mtimeMs: 1, kind: 'video',
    probe: { status: 'UNAVAILABLE', reason: 'No ffprobe in fixture' },
  });
  const item = db.listContent(processId)[0]!;
  const snapshot = {
    workflowVersionId: version.id, workflowHash: version.hash, bundle: version.bundle,
    contentId: item.id, fields: item.fields, assetIds: item.assetIds,
    assets: db.listContentAssets(processId),
    targetId: null, networkProfileId: null,
  };
  const jobId = 'job_stage_fixture';
  db.createJob({
    id: jobId, occurrenceKey: contentHash('unique_stage_occurrence'),
    processId, deviceId, contentId: item.id,
    scheduledUtc: '2026-10-26T00:00:00.000Z',
    state: 'SCHEDULED', revision: 0, priority: 0,
  }, snapshot);
  const claimed = db.claimDueJob(deviceId, 'stage_worker', at, 3000);
  expect(claimed.status).toBe('CLAIMED');
  if (claimed.status !== 'CLAIMED') throw new Error('Expected an atomic JOB claim');
  return {
    jobId, deviceId, item, hash, grant, lease: claimed.lease,
    jobRevision: claimed.job.revision, snapshotHash: claimed.snapshotHash,
  };
}
type Fixture = ReturnType<typeof fixture>;
function prepare(f: Fixture, overrides: Partial<{
  jobId: string; hostId: string; ordinal: number; expectedJobRevision: number;
  expectedSnapshotHash: string; lease: DeviceLease; at: number;
}> = {}): DeviceStageTransfer {
  return db.prepareClaimedDeviceStage({
    jobId: f.jobId, hostId, ordinal: 0,
    expectedJobRevision: f.jobRevision, expectedSnapshotHash: f.snapshotHash,
    lease: f.lease, at: at + 100, ...overrides,
  });
}

function readyForReconciliation(f: Fixture): DeviceStageTransfer {
  const stage = prepare(f);
  db.beginClaimedDeviceStageAttempt({
    stageId: stage.id, lease: f.lease, expectedJobRevision: f.jobRevision, at: at + 150,
  });
  db.recordClaimedDeviceStageSyncAck({
    stageId: stage.id, lease: f.lease, expectedJobRevision: f.jobRevision, at: at + 200,
  });
  db.recordClaimedDeviceStageRemoteReadback({
    stageId: stage.id, lease: f.lease, expectedJobRevision: f.jobRevision,
    observedHash: stage.expectedHash, observedBytes: stage.expectedBytes, at: at + 230,
  });
  return db.listDeviceStageTransfers(f.jobId)[0]!;
}

function reconciliationAuditCount(stageId: string): number {
  let count = 0;
  sql((connection) => {
    count = Number(connection.prepare(
      'SELECT COUNT(*) AS count FROM device_stage_reconciliations WHERE stage_id=?',
    ).get(stageId)?.count ?? 0);
  });
  return count;
}

it('commits remote destination before ADB, then uncertainty and ACK without claiming MediaStore', () => {
  const f = fixture();
  const before: JobDefinition = db.getJob(f.jobId).job;
  const stage = prepare(f);
  expect(stage).toMatchObject({
    jobId: f.jobId, deviceId: f.deviceId, hostId,
    state: 'INTENT', claimGeneration: f.lease.generation,
    ordinal: 0, expectedHash: f.hash,
  });
  expect(Object.hasOwn(stage, 'canDispatch')).toBe(false);
  expect(stage.nonce).toMatch(/^[a-f0-9]{32}$/);
  expect(stage.remotePath).toBe(
    '/sdcard/Download/AutoReelsStudio/job-' + f.jobId +
    '/asset-000-' + stage.nonce + '.mp4',
  );
  expect(db.listDeviceStageTransfers(f.jobId)).toHaveLength(1);
  expect(db.getJob(f.jobId).job).toEqual(before);
  expect(() => prepare(f)).toThrow('durable intent');
  const started = db.beginClaimedDeviceStageAttempt({
    stageId: stage.id, expectedJobRevision: f.jobRevision,
    lease: f.lease, at: at + 150,
  });
  expect(started.state).toBe('TRANSFER_UNCERTAIN');
  expect(() => db.beginClaimedDeviceStageAttempt({
    stageId: stage.id, expectedJobRevision: f.jobRevision,
    lease: f.lease, at: at + 160,
  })).toThrow('already attempted');
  const accepted = db.recordClaimedDeviceStageSyncAck({
    stageId: stage.id, lease: f.lease,
    expectedJobRevision: f.jobRevision, at: at + 200,
  });
  expect(accepted.state).toBe('SYNC_ACK_UNVERIFIED');
  expect(db.getJob(f.jobId).job).toEqual(before);
  expect(() => db.transitionJob(f.jobId, 'RUNNING', f.jobRevision))
    .toThrow('MediaStore');
  const rows = db.listDeviceStageTransfers(f.jobId);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: stage.id, remotePath: stage.remotePath });
  sql((connection) => {
    const states = connection.prepare(
      "SELECT kind,detail FROM queue_events WHERE job_id=? ORDER BY created_at,id",
    ).all(f.jobId);
    expect(states.map((row) => row.kind)).toEqual(expect.arrayContaining([
      'DEVICE_STAGE_INTENT', 'DEVICE_STAGE_TRANSFER_UNCERTAIN',
      'DEVICE_STAGE_ACK_NOT_INDEXED',
    ]));
    expect(JSON.stringify(states)).not.toContain('only local fixture bytes');
  });
});

it('persists exact remote readback only for the active claim and keeps stage state non-dispatchable', () => {
  const f = fixture();
  const stage = prepare(f);
  db.beginClaimedDeviceStageAttempt({
    stageId: stage.id, expectedJobRevision: f.jobRevision,
    lease: f.lease, at: at + 150,
  });
  db.recordClaimedDeviceStageSyncAck({
    stageId: stage.id, lease: f.lease,
    expectedJobRevision: f.jobRevision, at: at + 200,
  });
  expect(() => db.recordClaimedDeviceStageRemoteReadback({
    stageId: stage.id, lease: f.lease, expectedJobRevision: f.jobRevision,
    observedHash: contentHash('wrong'), observedBytes: stage.expectedBytes, at: at + 220,
  })).toThrow('differ');
  expect(db.listDeviceStageTransfers(f.jobId)[0]).toMatchObject({
    state: 'SYNC_ACK_UNVERIFIED',
    remoteReadbackHash: null, remoteReadbackBytes: null, remoteReadbackAt: null,
  });
  const verified = db.recordClaimedDeviceStageRemoteReadback({
    stageId: stage.id, lease: f.lease, expectedJobRevision: f.jobRevision,
    observedHash: stage.expectedHash, observedBytes: stage.expectedBytes, at: at + 230,
  });
  expect(verified).toMatchObject({
    state: 'SYNC_ACK_UNVERIFIED',
    remoteReadbackHash: stage.expectedHash,
    remoteReadbackBytes: stage.expectedBytes,
    remoteReadbackAt: new Date(at + 230).toISOString(),
  });
  expect(() => db.recordClaimedDeviceStageRemoteReadback({
    stageId: stage.id, lease: f.lease, expectedJobRevision: f.jobRevision,
    observedHash: stage.expectedHash, observedBytes: stage.expectedBytes, at: at + 240,
  })).toThrow('immutable');
  expect(() => db.transitionJob(f.jobId, 'RUNNING', f.jobRevision)).toThrow('MediaStore');
});
it('retains transferred uncertainty across restart, never requeues or retries stage intent', () => {
  const f = fixture(), stage = prepare(f);
  db.beginClaimedDeviceStageAttempt({
    stageId: stage.id, lease: f.lease,
    expectedJobRevision: f.jobRevision, at: at + 120,
  });
  db.close();
  db = new StudioDatabase(dbPath());
  expect(db.listDeviceStageTransfers(f.jobId)[0]!.state).toBe('TRANSFER_UNCERTAIN');
  expect(db.recoverExpiredClaims(f.deviceId, at + 3000))
    .toEqual({ requeued: [], review: [f.jobId] });
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(db.claimDueJob(f.deviceId, 'second_worker', at + 3001).status)
    .toBe('NEEDS_REVIEW');
  expect(db.listDeviceStageTransfers(f.jobId)[0]).toMatchObject({
    id: stage.id, state: 'TRANSFER_UNCERTAIN',
  });
});

it('a prepared stage alone is enough to route lost JOB claim into operator review', () => {
  const f = fixture(), stage = prepare(f);
  expect(db.recoverExpiredClaims(f.deviceId, at + 3000))
    .toEqual({ requeued: [], review: [f.jobId] });
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(db.listDeviceStageTransfers(f.jobId)[0]).toMatchObject({
    id: stage.id, state: 'INTENT',
  });
});

it('refuses stale lease generation, snapshot hash, foreign host and changed media ledger', () => {
  const f = fixture();
  expect(() => prepare(f, { expectedSnapshotHash: contentHash('wrong') }))
    .toThrow('snapshot');
  expect(() => prepare(f, { lease: { ...f.lease, generation: f.lease.generation + 1 } }))
    .toThrow();
  let hostError: unknown;
  try { prepare(f, { hostId: 'other_host' }); }
  catch (error) { hostError = error; }
  expect(hostError).toMatchObject({ code: 'SOURCE_REBIND_REQUIRED' });
  sql((connection) => connection.prepare(
    "UPDATE source_entries SET state='CHANGED' WHERE asset_id=?",
  ).run(f.item.assetIds[0]));
  expect(() => prepare(f)).toThrow('matches');
  expect(db.listDeviceStageTransfers(f.jobId)).toHaveLength(0);
});

it('rejects contradictory reconciliation classifications without writing audit rows', () => {
  const f = fixture(), stage = readyForReconciliation(f);
  const common = {
    stageId: stage.id, lease: f.lease, expectedJobRevision: f.jobRevision,
    observedHash: stage.expectedHash, observedBytes: stage.expectedBytes, at: at + 240,
  };
  expect(() => db.recordClaimedDeviceStageReconciliation({
    ...common, requestId: 'reconcile_invalid_001',
    classification: 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED', mediaStoreStatus: 'NOT_INDEXED',
  })).toThrow('requires an exact indexed row');
  expect(() => db.recordClaimedDeviceStageReconciliation({
    ...common, requestId: 'reconcile_invalid_002',
    classification: 'REMOTE_BYTES_MATCHED', mediaStoreStatus: 'INDEXED_EXACT',
  })).toThrow('requires an explicit not-indexed result');
  expect(() => db.recordClaimedDeviceStageReconciliation({
    ...common, requestId: 'reconcile_invalid_003',
    classification: 'REMOTE_MISSING', mediaStoreStatus: null,
  })).toThrow('cannot carry present-file evidence');
  expect(() => db.recordClaimedDeviceStageReconciliation({
    ...common, requestId: 'reconcile_invalid_004',
    classification: 'REMOTE_MISMATCH', mediaStoreStatus: null,
  })).toThrow('conflicts with matching evidence');
  expect(() => db.recordClaimedDeviceStageReconciliation({
    ...common, requestId: 'reconcile_invalid_005',
    classification: 'PROBE_UNSUPPORTED', mediaStoreStatus: 'INDEXED_EXACT',
  })).toThrow('requires an unsupported probe status');
  expect(reconciliationAuditCount(stage.id)).toBe(0);
  expect(db.listDeviceStageTransfers(f.jobId)[0]).toEqual(stage);
  expect(db.getJob(f.jobId).job.state).toBe('PREFLIGHT');
});

it('rejects stale generation, stale revision and expired lease before reconciliation audit insert', () => {
  const f = fixture(), stage = readyForReconciliation(f);
  const valid = {
    stageId: stage.id, requestId: 'reconcile_fence_001', lease: f.lease,
    expectedJobRevision: f.jobRevision, classification: 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED' as const,
    observedHash: stage.expectedHash, observedBytes: stage.expectedBytes,
    mediaStoreStatus: 'INDEXED_EXACT' as const, at: at + 240,
  };
  expect(() => db.recordClaimedDeviceStageReconciliation({
    ...valid, lease: { ...f.lease, generation: f.lease.generation + 1 },
  })).toThrow();
  expect(() => db.recordClaimedDeviceStageReconciliation({
    ...valid, requestId: 'reconcile_fence_002', expectedJobRevision: f.jobRevision + 1,
  })).toThrow();
  expect(() => db.recordClaimedDeviceStageReconciliation({
    ...valid, requestId: 'reconcile_fence_003', at: at + 4000,
  })).toThrow();
  expect(reconciliationAuditCount(stage.id)).toBe(0);
  const stored = db.recordClaimedDeviceStageReconciliation(valid);
  expect(stored.classification).toBe('MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED');
  expect(reconciliationAuditCount(stage.id)).toBe(1);
  expect(db.listDeviceStageTransfers(f.jobId)[0]).toEqual(stage);
  expect(db.getJob(f.jobId).job.state).toBe('PREFLIGHT');
});


it('preserves only expired stage-backed claims and allows MANUAL read-only audit under a new generation', () => {
  const f = fixture(), stage = readyForReconciliation(f);
  expect(db.recoverExpiredClaims(f.deviceId, at + 3000))
    .toEqual({ requeued: [], review: [f.jobId] });
  expect(db.recoverExpiredClaims(f.deviceId, at + 3001))
    .toEqual({ requeued: [], review: [] });
  let historical: unknown;
  sql((conn) => { historical = conn.prepare(
    'SELECT generation,expires_at FROM job_claims WHERE job_id=?',
  ).get(f.jobId); });
  expect(historical).toMatchObject({ generation: f.lease.generation, expires_at: at + 3000 });
  expect(db.claimDueJob(f.deviceId, 'another_worker', at + 3001).status).toBe('NEEDS_REVIEW');
  const manual = db.acquireLease(f.deviceId, 'stage_operator', 'MANUAL', at + 3001, 3000);
  const nextRevision = db.getJob(f.jobId).job.revision;
  const frozen = db.reviewedDeviceStageMediaSnapshot({
    stageId: stage.id, hostId, lease: manual,
    expectedJobRevision: nextRevision, expectedSnapshotHash: f.snapshotHash, at: at + 3010,
  });
  expect(frozen).toMatchObject({
    jobId: f.jobId, jobRevision: nextRevision, assetId: stage.assetId,
    pinnedHash: stage.expectedHash, pinnedBytes: stage.expectedBytes, extension: '.mp4',
  });
  const valid = {
    requestId: 'manual_reconcile_001', stageId: stage.id, hostId,
    expectedSnapshotHash: f.snapshotHash, expectedJobRevision: nextRevision, lease: manual,
    classification: 'REMOTE_BYTES_MATCHED' as const,
    observedHash: stage.expectedHash, observedBytes: stage.expectedBytes,
    mediaStoreStatus: 'NOT_INDEXED' as const, at: at + 3010,
  };
  const recorded = db.recordClaimedDeviceStageReconciliation(valid);
  expect(recorded).toMatchObject({
    claimGeneration: f.lease.generation, leaseOwnerKind: 'MANUAL',
    leaseGeneration: manual.generation, classification: 'REMOTE_BYTES_MATCHED',
  });
  expect(db.recordClaimedDeviceStageReconciliation(valid)).toEqual(recorded);
  db.releaseLease(manual);
  const next = db.acquireLease(f.deviceId, 'another_operator', 'MANUAL', at + 3020, 3000);
  expect(() => db.recordClaimedDeviceStageReconciliation({
    ...valid, lease: next, at: at + 3030,
  })).toThrow('Request ID has different evidence');
  expect(reconciliationAuditCount(stage.id)).toBe(1);
  expect(db.listDeviceStageTransfers(f.jobId)[0]).toEqual(stage);
  expect(db.getJob(f.jobId).job).toMatchObject({
    state: 'NEEDS_REVIEW', revision: nextRevision,
  });
});

it('rejects MANUAL reviews with live JOB, invalid lease, stale revision/host/snapshot or historical generation', () => {
  const f = fixture(), stage = readyForReconciliation(f);
  const original = {
    stageId: stage.id, hostId, expectedJobRevision: f.jobRevision,
    expectedSnapshotHash: f.snapshotHash, lease: { ...f.lease, ownerKind: 'MANUAL' as const },
    at: at + 250,
  };
  expect(() => db.reviewedDeviceStageMediaSnapshot(original)).toThrow();
  expect(db.recoverExpiredClaims(f.deviceId, at + 3000))
    .toEqual({ requeued: [], review: [f.jobId] });
  const manual = db.acquireLease(f.deviceId, 'manual_stage_checks', 'MANUAL', at + 3001, 1000);
  const current = { ...original, expectedJobRevision: f.jobRevision + 1, lease: manual, at: at + 3005 };
  expect(() => db.assertReviewedDeviceStage({ ...current, hostId: 'foreign_host' })).toThrow();
  expect(() => db.assertReviewedDeviceStage({
    ...current, expectedSnapshotHash: contentHash('wrong'),
  })).toThrow();
  expect(() => db.assertReviewedDeviceStage({
    ...current, expectedJobRevision: f.jobRevision,
  })).toThrow();
  expect(() => db.assertReviewedDeviceStage({
    ...current, lease: { ...manual, deviceId: 'another_device' },
  })).toThrow();
  expect(() => db.assertReviewedDeviceStage({ ...current, at: manual.expiresAt })).toThrow();
  sql((conn) => conn.prepare(
    'UPDATE job_claims SET generation=generation+1 WHERE job_id=?',
  ).run(f.jobId));
  expect(() => db.assertReviewedDeviceStage(current)).toThrow();
  expect(() => db.recordClaimedDeviceStageReconciliation({
    ...current, requestId: 'manual_bad_generation', classification: 'REMOTE_BYTES_MATCHED',
    observedHash: stage.expectedHash, observedBytes: stage.expectedBytes,
    mediaStoreStatus: 'NOT_INDEXED',
  })).toThrow();
  expect(reconciliationAuditCount(stage.id)).toBe(0);
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(db.listDeviceStageTransfers(f.jobId)[0]).toEqual(stage);
});

it('requeues stage-free expired preflight and deletes its historical claim', () => {
  const f = fixture();
  expect(db.recoverExpiredClaims(f.deviceId, at + 3000))
    .toEqual({ requeued: [f.jobId], review: [] });
  let claims = -1;
  sql((conn) => { claims = Number(conn.prepare(
    'SELECT COUNT(*) AS count FROM job_claims WHERE job_id=?',
  ).get(f.jobId)?.count); });
  expect(claims).toBe(0);
  expect(db.getJob(f.jobId).job.state).toBe('QUEUED');
});


it('projects a stage-free job as a bounded redacted read-only operator inventory', async () => {
  const f = fixture();
  const before = db.getJob(f.jobId).job;
  const page = db.jobStageReview(f.jobId);
  expect(page).toEqual({
    jobId: f.jobId, jobRevision: f.jobRevision, jobState: 'PREFLIGHT',
    scope: 'PERSISTED_ONLY', canDispatch: false,
    stages: [], observations: [], cleanupRequests: [], cleanupHasMore: false,
    hasMore: false, nextCursor: null,
  });
  const publicPage = await dispatch(db, {
    operationId: 'op_review_read_only', command: 'jobStageReview', input: { id: f.jobId },
  });
  expect(publicPage).toEqual(page);
  await expect(dispatch(db, {
    operationId: 'op_review_forged', command: 'jobStageReview',
    input: { id: f.jobId, lease: f.lease, command: 'stage.recordReconciliation' },
  })).rejects.toThrow();
  expect(db.getJob(f.jobId).job).toEqual(before);
  expect(db.listDeviceStageTransfers(f.jobId)).toHaveLength(0);
});

it('paginates redacted JOB and MANUAL audit history without changing review state or leaking ownership bytes', async () => {
  const f = fixture(), stage = readyForReconciliation(f);
  db.recordClaimedDeviceStageReconciliation({
    requestId: 'stage_audit_initial_job', stageId: stage.id,
    lease: f.lease, expectedJobRevision: f.jobRevision,
    classification: 'REMOTE_BYTES_MATCHED',
    observedHash: stage.expectedHash, observedBytes: stage.expectedBytes,
    mediaStoreStatus: 'NOT_INDEXED', at: at + 240,
  });
  expect(db.recoverExpiredClaims(f.deviceId, at + 3000))
    .toEqual({ requeued: [], review: [f.jobId] });
  const manual = db.acquireLease(f.deviceId, 'stage_review_operator', 'MANUAL', at + 3001, 5000);
  const revision = db.getJob(f.jobId).job.revision;
  for (let i = 0; i < 24; i++)
    db.recordClaimedDeviceStageReconciliation({
      requestId: 'stage_audit_manual_' + String(i).padStart(3, '0'),
      stageId: stage.id, hostId, expectedSnapshotHash: f.snapshotHash,
      lease: manual, expectedJobRevision: revision,
      classification: 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED',
      observedHash: stage.expectedHash, observedBytes: stage.expectedBytes,
      mediaStoreStatus: 'INDEXED_EXACT', at: at + 3010 + i,
    });
  const stageBefore = db.listDeviceStageTransfers(f.jobId)[0]!;
  const jobBefore = db.getJob(f.jobId).job;
  const first = db.jobStageReview(f.jobId);
  expect(first).toMatchObject({
    jobId: f.jobId, jobState: 'NEEDS_REVIEW', jobRevision: revision,
    scope: 'PERSISTED_ONLY', canDispatch: false, hasMore: true,
    stages: [{
      ordinal: 0, state: 'SYNC_ACK_UNVERIFIED',
      remoteBytes: 'MATCH_RECORDED_NOT_LIVE', mediaStore: 'NOT_RECORDED',
    }],
  });
  expect(first.observations).toHaveLength(20);
  expect(first.observations[0]).toMatchObject({
    stageOrdinal: 0, leaseOwnerKind: 'MANUAL',
    classification: 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED',
    mediaStoreStatus: 'INDEXED_EXACT',
  });
  expect(first.nextCursor).toEqual(expect.any(String));
  const second = db.jobStageReview(f.jobId, first.nextCursor!);
  expect(second).toMatchObject({ hasMore: false, nextCursor: null });
  expect(second.observations).toHaveLength(5);
  expect(second.observations.at(-1)?.leaseOwnerKind).toBe('JOB');
  expect(second.observations.at(-1)?.classification).toBe('REMOTE_BYTES_MATCHED');
  const merged = [...first.observations, ...second.observations];
  expect(merged).toHaveLength(25);
  expect(new Set(merged.map((r) => r.createdAt)).size).toBe(25);

  for (const page of [first, second]) {
    const serialized = JSON.stringify(page);
    for (const secret of [
      stage.remotePath, stage.nonce, stage.expectedHash, f.deviceId, hostId,
      f.lease.ownerId, manual.ownerId, stage.id, f.snapshotHash,
    ]) expect(serialized).not.toContain(secret);
  }
  const decoded = JSON.parse(Buffer.from(first.nextCursor!, 'base64url').toString('utf8')) as
    { jobId: string; revision: number; createdAt: string; id: string };
  const otherJobCursor = Buffer.from(JSON.stringify({
    ...decoded, jobId: 'another_job',
  })).toString('base64url');
  expect(() => db.jobStageReview(f.jobId, otherJobCursor))
    .toThrow('another job');
  expect(() => db.jobStageReview(f.jobId, 'not/a/base64/cursor'))
    .toThrow('Invalid stage review cursor');
  expect(() => db.jobStageReview(f.jobId, Buffer.from('{}').toString('base64url')))
    .toThrow('Invalid stage review cursor');
  sql((conn) => conn.prepare('UPDATE jobs SET revision=revision+1 WHERE id=?').run(f.jobId));
  expect(() => db.jobStageReview(f.jobId, first.nextCursor!)).toThrow('Job changed');
  expect(db.listDeviceStageTransfers(f.jobId)[0]).toEqual(stageBefore);
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(reconciliationAuditCount(stage.id)).toBe(25);
  expect(jobBefore.state).toBe('NEEDS_REVIEW');
});


it('assesses cleanup preconditions only for a fresh same-MANUAL-generation remote-only observation', async () => {
  const f = fixture(), stage = readyForReconciliation(f);
  expect(db.recoverExpiredClaims(f.deviceId, at + 3000))
    .toEqual({ requeued: [], review: [f.jobId] });
  const manual = db.acquireLease(f.deviceId, 'stage_cleanup_operator', 'MANUAL', at + 3001, 120000);
  const revision = db.getJob(f.jobId).job.revision;
  const input = {
    stageId: stage.id, hostId, expectedJobRevision: revision,
    expectedSnapshotHash: f.snapshotHash, lease: manual, at: at + 3011,
  };
  expect(db.assessOwnedStageCleanup(input)).toMatchObject({
    jobId: f.jobId, ordinal: 0, status: 'BLOCKED',
    blockers: ['CURRENT_MANUAL_OBSERVATION_REQUIRED'], canDelete: false, canDispatch: false,
  });
  db.recordClaimedDeviceStageReconciliation({
    ...input, requestId: 'cleanup_manual_fresh_001',
    classification: 'REMOTE_BYTES_MATCHED', observedHash: stage.expectedHash,
    observedBytes: stage.expectedBytes, mediaStoreStatus: 'NOT_INDEXED', at: at + 3010,
  });
  const stageBefore = db.listDeviceStageTransfers(f.jobId)[0]!,
    jobBefore = db.getJob(f.jobId).job;
  let eventsBefore = -1;
  sql((conn) => { eventsBefore = Number(conn.prepare(
    'SELECT COUNT(*) AS total FROM queue_events WHERE job_id=?',
  ).get(f.jobId)?.total ?? -1); });
  const assessment = db.assessOwnedStageCleanup(input);
  expect(assessment).toEqual({
    jobId: f.jobId, ordinal: 0, scope: 'PERSISTED_PREFLIGHT_ONLY',
    status: 'PREREQUISITES_MET', blockers: [],
    observationAt: new Date(at + 3010).toISOString(),
    canDelete: false, canDispatch: false,
  });
  expect(dispatchInternal(db, { command: 'stage.cleanupReadiness', ...input }))
    .toEqual(assessment);
  await expect(dispatch(db, {
    operationId: 'op_forged_cleanup', command: 'stage.cleanupReadiness' as never, input,
  })).rejects.toThrow();
  expect(db.listDeviceStageTransfers(f.jobId)[0]).toEqual(stageBefore);
  expect(db.getJob(f.jobId).job).toEqual(jobBefore);
  sql((conn) => expect(Number(conn.prepare(
    'SELECT COUNT(*) AS total FROM queue_events WHERE job_id=?',
  ).get(f.jobId)?.total)).toBe(eventsBefore));

  expect(db.assessOwnedStageCleanup({ ...input, at: at + 34012 }).blockers)
    .toContain('OBSERVATION_STALE');
  expect(() => db.assessOwnedStageCleanup({
    ...input, lease: { ...manual, generation: manual.generation + 1 },
  })).toThrow();
  expect(() => db.assessOwnedStageCleanup({
    ...input, expectedJobRevision: revision + 1,
  })).toThrow();
  expect(() => db.assessOwnedStageCleanup({ ...input, hostId: 'foreign_host' }))
    .toThrow();
  db.releaseLease(manual);
  expect(() => db.assessOwnedStageCleanup(input)).toThrow();
});

it('blocks cleanup on unsupported, indexed or uncertain observations and any external effect', () => {
  const f = fixture(), stage = readyForReconciliation(f);
  db.recordClaimedDeviceStageReconciliation({
    stageId: stage.id, requestId: 'cleanup_historical_indexed',
    lease: f.lease, expectedJobRevision: f.jobRevision,
    classification: 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED',
    observedHash: stage.expectedHash, observedBytes: stage.expectedBytes,
    mediaStoreStatus: 'INDEXED_EXACT', at: at + 240,
  });
  db.recoverExpiredClaims(f.deviceId, at + 3000);
  const manual = db.acquireLease(f.deviceId, 'stage_cleanup_operator', 'MANUAL', at + 3001, 120000);
  const input = {
    stageId: stage.id, hostId, expectedJobRevision: db.getJob(f.jobId).job.revision,
    expectedSnapshotHash: f.snapshotHash, lease: manual, at: at + 3021,
  };
  db.recordClaimedDeviceStageReconciliation({
    ...input, requestId: 'cleanup_manual_unsupported',
    classification: 'PROBE_UNSUPPORTED', observedHash: stage.expectedHash,
    observedBytes: stage.expectedBytes, mediaStoreStatus: 'UNSUPPORTED', at: at + 3010,
  });
  let assessment = db.assessOwnedStageCleanup(input);
  expect(assessment.blockers).toEqual(expect.arrayContaining([
    'MEDIASTORE_EVER_INDEXED', 'REMOTE_OR_INDEX_NOT_CLEARED',
  ]));
  db.recordClaimedDeviceStageReconciliation({
    ...input, requestId: 'cleanup_manual_latest_matched',
    classification: 'REMOTE_BYTES_MATCHED', observedHash: stage.expectedHash,
    observedBytes: stage.expectedBytes, mediaStoreStatus: 'NOT_INDEXED', at: at + 3020,
  });
  assessment = db.assessOwnedStageCleanup(input);
  expect(assessment.blockers).toContain('MEDIASTORE_EVER_INDEXED');
  expect(assessment.blockers).not.toContain('REMOTE_OR_INDEX_NOT_CLEARED');
  sql((conn) => conn.prepare(
    'INSERT INTO effects(id,job_id,node_id,kind,effect_key,payload_hash,state,evidence_ref,created_at) ' +
    'VALUES(?,?,?,?,?,?,?,?,?)',
  ).run('effect_cleanup_fixture', f.jobId, 'node_publish', 'PUBLISH',
    contentHash('cleanup effect'), contentHash('cleanup payload'), 'INTENT', null,
    new Date(at + 3000).toISOString()));
  expect(db.assessOwnedStageCleanup(input).blockers).toContain('EXTERNAL_EFFECT_PRESENT');
  sql((conn) => conn.prepare(
    "UPDATE device_stage_transfers SET state='TRANSFER_UNCERTAIN' WHERE id=?",
  ).run(stage.id));
  expect(db.assessOwnedStageCleanup(input).blockers).toContain('TRANSFER_NOT_ACKNOWLEDGED');
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
});

it('fails closed before cleanup preflight on a tampered remote namespace, path or historical claim', () => {
  const f = fixture(), stage = readyForReconciliation(f);
  db.recoverExpiredClaims(f.deviceId, at + 3000);
  const manual = db.acquireLease(f.deviceId, 'stage_cleanup_operator', 'MANUAL', at + 3001, 120000);
  const input = {
    stageId: stage.id, hostId, expectedJobRevision: db.getJob(f.jobId).job.revision,
    expectedSnapshotHash: f.snapshotHash, lease: manual, at: at + 3010,
  };
  for (const foreign of [
    '/sdcard/Download/AutoReelsStudio/job-foreign/asset-000-' + stage.nonce + '.mp4',
    stage.remotePath + '/../not-owned.mp4',
    stage.remotePath.replace(stage.nonce, 'f'.repeat(32)),
  ]) {
    sql((conn) => conn.prepare('UPDATE device_stage_transfers SET remote_path=? WHERE id=?')
      .run(foreign, stage.id));
    expect(() => db.assessOwnedStageCleanup(input)).toThrow();
  }
  sql((conn) => conn.prepare('UPDATE device_stage_transfers SET remote_path=? WHERE id=?')
    .run(stage.remotePath, stage.id));
  sql((conn) => conn.prepare(
    'UPDATE job_claims SET generation=generation+1 WHERE job_id=?',
  ).run(f.jobId));
  expect(() => db.assessOwnedStageCleanup(input)).toThrow();
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
});


it('records a native-confirmed cleanup review durably but never authorizes or mutates the stage', async () => {
  const f = fixture(), stage = readyForReconciliation(f);
  db.recoverExpiredClaims(f.deviceId, at + 3000);
  const manual = db.acquireLease(f.deviceId, 'cleanup_review_operator', 'MANUAL', at + 3001, 5000);
  const revision = db.getJob(f.jobId).job.revision;
  db.recordClaimedDeviceStageReconciliation({
    stageId: stage.id, requestId: 'cleanup_native_evidence_001',
    lease: manual, hostId, expectedJobRevision: revision,
    expectedSnapshotHash: f.snapshotHash, at: at + 3010,
    classification: 'REMOTE_BYTES_MATCHED', observedHash: stage.expectedHash,
    observedBytes: stage.expectedBytes, mediaStoreStatus: 'NOT_INDEXED',
  });
  const record = {
    requestId: 'cleanup_native_request_001', stageId: stage.id, hostId,
    lease: manual, expectedJobRevision: revision,
    expectedSnapshotHash: f.snapshotHash, confirmed: true as const, at: at + 3011,
  };
  const before = db.getJob(f.jobId).job, stageBefore = db.listDeviceStageTransfers(f.jobId)[0]!;
  let queueBefore = -1;
  sql((conn) => { queueBefore = Number(conn.prepare(
    'SELECT COUNT(*) AS count FROM queue_events WHERE job_id=?',
  ).get(f.jobId)?.count); });
  const receipt = db.recordOwnedStageCleanupReviewRequest(record);
  expect(receipt).toEqual({
    requestId: record.requestId, jobId: f.jobId, ordinal: 0,
    recordedAt: new Date(at + 3011).toISOString(),
    status: 'REVIEW_REQUESTED_HARDWARE_PENDING', canDelete: false, canDispatch: false,
  });
  expect(db.recordOwnedStageCleanupReviewRequest(record)).toEqual(receipt);
  const reviewPage = db.jobStageReview(f.jobId);
  expect(reviewPage.cleanupRequests).toEqual([{
    stageOrdinal: 0, recordedAt: receipt.recordedAt,
    status: 'REVIEW_REQUESTED_HARDWARE_PENDING',
  }]);
  expect(reviewPage.cleanupHasMore).toBe(false);
  const redacted = JSON.stringify(reviewPage);
  for (const sensitive of [
    record.requestId, stage.id, stage.remotePath, stage.nonce,
    stage.expectedHash, f.snapshotHash, hostId, manual.ownerId,
  ]) expect(redacted).not.toContain(sensitive);
  expect(dispatchInternal(db, { command: 'stage.cleanupReviewHistory', jobId: f.jobId }))
    .toEqual([receipt]);
  expect(() => db.recordOwnedStageCleanupReviewRequest({
    ...record, requestId: 'cleanup_native_duplicate_002',
  })).toThrow('already has an operator request');
  await expect(dispatch(db, {
    operationId: 'op_forged_cleanup_review', command: 'stage.cleanupReviewRecord' as never,
    input: record,
  })).rejects.toThrow();
  expect(db.getJob(f.jobId).job).toEqual(before);
  expect(db.listDeviceStageTransfers(f.jobId)[0]).toEqual(stageBefore);
  sql((conn) => expect(Number(conn.prepare(
    'SELECT COUNT(*) AS count FROM queue_events WHERE job_id=?',
  ).get(f.jobId)?.count)).toBe(queueBefore));
  db.close();
  db = new StudioDatabase(dbPath());
  expect(db.listOwnedStageCleanupReviewRequests(f.jobId)).toEqual([receipt]);
  expect(db.jobStageReview(f.jobId).cleanupRequests).toEqual([{
    stageOrdinal: 0, recordedAt: receipt.recordedAt,
    status: 'REVIEW_REQUESTED_HARDWARE_PENDING',
  }]);
  expect(db.getJob(f.jobId).job).toEqual(before);
  expect(() => sql((conn) => conn.prepare(
    'UPDATE device_stage_cleanup_reviews SET state=state WHERE request_id=?',
  ).run(record.requestId))).toThrow('cleanup review immutable');
  expect(() => sql((conn) => conn.prepare(
    'DELETE FROM device_stage_cleanup_reviews WHERE request_id=?',
  ).run(record.requestId))).toThrow('cleanup review immutable');
  expect(db.listOwnedStageCleanupReviewRequests(f.jobId)).toEqual([receipt]);
});

it('fences cleanup review journal against consent forgery, changed observations, stale lease and effects', () => {
  const f = fixture(), stage = readyForReconciliation(f);
  db.recoverExpiredClaims(f.deviceId, at + 3000);
  const firstLease = db.acquireLease(f.deviceId, 'cleanup_operator_1', 'MANUAL', at + 3001, 120000);
  const revision = db.getJob(f.jobId).job.revision;
  const common = {
    requestId: 'cleanup_fenced_request', stageId: stage.id, hostId,
    expectedJobRevision: revision, expectedSnapshotHash: f.snapshotHash,
    lease: firstLease, confirmed: true as const, at: at + 3015,
  };
  expect(() => db.recordOwnedStageCleanupReviewRequest({
    ...common, confirmed: false as never,
  })).toThrow('privately confirmed');
  expect(() => db.recordOwnedStageCleanupReviewRequest(common))
    .toThrow('prerequisites changed');
  db.recordClaimedDeviceStageReconciliation({
    ...common, requestId: 'cleanup_native_observation_1',
    classification: 'REMOTE_BYTES_MATCHED', observedHash: stage.expectedHash,
    observedBytes: stage.expectedBytes, mediaStoreStatus: 'NOT_INDEXED', at: at + 3010,
  });
  expect(() => db.recordOwnedStageCleanupReviewRequest({
    ...common, hostId: 'other_host',
  })).toThrow();
  expect(() => db.recordOwnedStageCleanupReviewRequest({
    ...common, expectedJobRevision: revision + 1,
  })).toThrow();
  expect(() => db.recordOwnedStageCleanupReviewRequest({
    ...common, at: at + 34012,
  })).toThrow('prerequisites changed');
  const prior = db.recordOwnedStageCleanupReviewRequest(common);
  db.releaseLease(firstLease);
  expect(() => db.recordOwnedStageCleanupReviewRequest(common)).toThrow();
  const secondLease = db.acquireLease(f.deviceId, 'cleanup_operator_2', 'MANUAL', at + 3020, 4000);
  db.recordClaimedDeviceStageReconciliation({
    ...common, requestId: 'cleanup_native_observation_2', lease: secondLease,
    classification: 'REMOTE_BYTES_MATCHED', observedHash: stage.expectedHash,
    observedBytes: stage.expectedBytes, mediaStoreStatus: 'NOT_INDEXED', at: at + 3025,
  });
  expect(() => db.recordOwnedStageCleanupReviewRequest({
    ...common, lease: secondLease, at: at + 3026,
  })).toThrow('already bound to another observation');
  sql((conn) => conn.prepare(
    'INSERT INTO effects(id,job_id,node_id,kind,effect_key,payload_hash,state,evidence_ref,created_at)' +
    ' VALUES(?,?,?,?,?,?,?,?,?)',
  ).run('cleanup_review_effect', f.jobId, 'node_1', 'PUBLISH',
    contentHash('cleanup_review_effect_key'), contentHash('cleanup_review_payload'),
    'INTENT', null, new Date(at + 3027).toISOString()));
  expect(() => db.recordOwnedStageCleanupReviewRequest({
    ...common, lease: secondLease, requestId: 'cleanup_after_effect',
    at: at + 3028,
  })).toThrow('prerequisites changed');
  expect(db.listOwnedStageCleanupReviewRequests(f.jobId)).toEqual([prior]);
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
});

it('private DB worker tracks one stage; public HTTP dispatcher cannot forge stage intent', async () => {
  const f = fixture();
  await expect(dispatch(db, {
    operationId: 'op_forged_stage', command: 'stage.prepare' as never,
    input: { jobId: f.jobId, lease: f.lease, hostId },
  })).rejects.toThrow();
  const stage = dispatchInternal(db, {
    command: 'stage.prepare', jobId: f.jobId, hostId,
    ordinal: 0, expectedJobRevision: f.jobRevision,
    expectedSnapshotHash: f.snapshotHash, lease: f.lease, at: at + 20,
  }) as DeviceStageTransfer;
  expect(stage.state).toBe('INTENT');
  const began = dispatchInternal(db, {
    command: 'stage.beginAttempt', stageId: stage.id,
    expectedJobRevision: f.jobRevision, lease: f.lease, at: at + 30,
  }) as DeviceStageTransfer;
  expect(began.state).toBe('TRANSFER_UNCERTAIN');
  const accepted = dispatchInternal(db, {
    command: 'stage.syncAck', stageId: stage.id,
    expectedJobRevision: f.jobRevision, lease: f.lease, at: at + 40,
  }) as DeviceStageTransfer;
  expect(accepted.state).toBe('SYNC_ACK_UNVERIFIED');
});

it('atomically rolls back a database insert failure with no phantom stage or event', () => {
  const f = fixture();
  sql((connection) => connection.exec(
    "CREATE TRIGGER fail_stage BEFORE INSERT ON device_stage_transfers BEGIN SELECT RAISE(ABORT,'stage forced failure'); END;",
  ));
  expect(() => prepare(f)).toThrow('stage forced failure');
  expect(db.listDeviceStageTransfers(f.jobId)).toHaveLength(0);
  sql((connection) => expect(
    connection.prepare("SELECT COUNT(*) AS n FROM queue_events WHERE kind='DEVICE_STAGE_INTENT'")
      .get()?.n,
  ).toBe(0));
  expect(db.getJob(f.jobId).job.state).toBe('PREFLIGHT');
});
