import { beforeEach, afterEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  DeviceLease, DeviceStageTransfer, JobDefinition, ProcessDefinition,
  NativeStageCleanupAbsenceResult,
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
    cleanupRechecks: [],
    mediaOrder: {
      scope: 'PERSISTED_STAGE_ORDER_NOT_PICKER_VERIFIED', status: 'BLOCKED',
      canSelect: false, canDispatch: false,
      blockers: ['STAGE_MISSING'],
      slots: [{ ordinal: 0, kind: 'VIDEO', evidence: 'BLOCKED', blockers: ['STAGE_MISSING'] }],
    },
    frozenUnicode: expect.objectContaining({
      scope: 'FROZEN_UNICODE_NOT_ANDROID_INPUT', canType: false, canDispatch: false,
    }),
    compose: expect.objectContaining({
      scope: 'FROZEN_COMPOSE_NOT_ANDROID_VERIFIED', status: 'BLOCKED',
      canVerify: false, canPublish: false, canDispatch: false,
      blockers: expect.arrayContaining([
        'ACCOUNT_NOT_PINNED', 'TARGET_NOT_PINNED', 'MEDIA_ORDER_NOT_VERIFIED',
      ]),
    }),
    effectReview: {
      scope: 'PERSISTED_EFFECT_JOURNAL_NOT_PROVIDER_VERIFIED',
      status: 'NO_EFFECTS', total: 0, hasMore: false, hasUnresolved: false,
      entries: [], canConfirm: false, canRetry: false, canDispatch: false,
    },
    hasMore: false, nextCursor: null,
  });
  expect(page.frozenUnicode.canType).toBe(false);
  expect(page.frozenUnicode.canDispatch).toBe(false);
  expect(page.compose.mediaSlots).toBe(1);
  expect(page.compose.textFields).toBe(0);
  expect(page.compose.canVerify).toBe(false);
  expect(page.compose.canPublish).toBe(false);
  expect(page.compose.canDispatch).toBe(false);
  expect(JSON.stringify(page.compose)).not.toContain(f.snapshotHash);
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


it('projects durable effect uncertainty without leaking effect IDs, keys or evidence', async () => {
  const f = fixture(), before = db.getJob(f.jobId).job;
  const key = contentHash('private_effect_key'), payload = contentHash('private_payload');
  const effectId = db.recordIntent(f.jobId, 'publish_node', 'PUBLISH', key, payload);
  const first = db.jobStageReview(f.jobId);
  expect(first.effectReview).toEqual({
    scope: 'PERSISTED_EFFECT_JOURNAL_NOT_PROVIDER_VERIFIED',
    status: 'REVIEW_REQUIRED', total: 1, hasMore: false, hasUnresolved: true,
    entries: [{
      ordinal: 0, kind: 'PUBLISH', state: 'INTENT',
      manualReviewCount: 0, latestManualReview: null,
    }],
    canConfirm: false, canRetry: false, canDispatch: false,
  });
  const publicPage = await dispatch(db, {
    operationId: 'op_effect_status_only', command: 'jobStageReview',
    input: { id: f.jobId },
  });
  for (const secret of [effectId, key, payload, 'publish_node']) {
    expect(JSON.stringify(first)).not.toContain(secret);
    expect(JSON.stringify(publicPage)).not.toContain(secret);
  }
  expect(db.getJob(f.jobId).job).toEqual(before);
  expect(db.effectState(effectId)).toBe('INTENT');
  db.close();
  db = new StudioDatabase(dbPath());
  expect(db.jobStageReview(f.jobId).effectReview).toEqual(first.effectReview);
  expect(db.effectState(effectId)).toBe('INTENT');
});

it('checks the full durable effect journal for hidden unresolved attempts beyond the newest page', () => {
  const f = fixture(), before = db.getJob(f.jobId).job;
  sql((connection) => {
    const insert = connection.prepare(
      'INSERT INTO effects(id,job_id,node_id,kind,effect_key,payload_hash,' +
      'state,evidence_ref,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
    );
    for (let i = 0; i < 24; i++) {
      insert.run(
        'effect_private_' + i, f.jobId, 'publish_fixture', 'PUBLISH',
        contentHash('key_' + i), contentHash('payload_' + i),
        i === 0 ? 'ATTEMPT_UNCERTAIN' : 'CONFIRMED',
        i === 0 ? 'private_post_evidence' : null,
        new Date(Date.parse('2026-10-28T00:00:00.000Z') + i * 1000).toISOString(),
      );
    }
  });
  const p = db.jobStageReview(f.jobId);
  expect(p.effectReview).toMatchObject({
    status: 'REVIEW_REQUIRED', total: 24, hasMore: true, hasUnresolved: true,
    canConfirm: false, canRetry: false, canDispatch: false,
  });
  expect(p.effectReview.entries).toHaveLength(20);
  expect(p.effectReview.entries.every((e) => e.state === 'CONFIRMED')).toBe(true);
  expect(JSON.stringify(p)).not.toContain('private_post_evidence');
  expect(JSON.stringify(p)).not.toContain('effect_private_0');
  expect(db.getJob(f.jobId).job).toEqual(before);
  sql((connection) => connection.prepare(
    "UPDATE effects SET state='DEFINITIVELY_REJECTED' WHERE id='effect_private_0'",
  ).run());
  const resolved = db.jobStageReview(f.jobId).effectReview;
  expect(resolved.status).toBe('RECORDED_NOT_LIVE_VERIFIED');
  expect(resolved.hasUnresolved).toBe(false);
  expect(resolved.canRetry).toBe(false);
  expect(resolved.canConfirm).toBe(false);
});
it('derives persisted exact MediaStore candidate evidence from the frozen job, never picker readiness', () => {
  const f = fixture();
  const stage = readyForReconciliation(f);
  const before = db.getJob(f.jobId).job;
  const original = db.listDeviceStageTransfers(f.jobId)[0]!;
  const staged = db.recordClaimedDeviceStageMediaStore({
    stageId: stage.id, lease: f.lease, expectedJobRevision: f.jobRevision,
    rowId: '4242', displayName: stage.remotePath.split('/').at(-1)!,
    relativePath: 'Download/AutoReelsStudio/job-' + f.jobId + '/',
    mimeType: 'video/mp4', observedBytes: stage.expectedBytes, at: at + 235,
  });
  expect(staged.mediaStoreRowId).toBe('4242');
  let eventsBefore = -1;
  sql((conn) => {
    eventsBefore = Number(conn.prepare(
      'SELECT COUNT(*) AS total FROM queue_events WHERE job_id=?',
    ).get(f.jobId)?.total);
  });
  const page = db.jobStageReview(f.jobId);
  expect(page.mediaOrder).toEqual({
    scope: 'PERSISTED_STAGE_ORDER_NOT_PICKER_VERIFIED',
    status: 'INDEXED_CANDIDATES_NOT_PICKER_VERIFIED',
    canSelect: false, canDispatch: false,
    blockers: [], slots: [{
      ordinal: 0, kind: 'VIDEO', evidence: 'INDEXED_ROW_RECORDED_NOT_LIVE', blockers: [],
    }],
  });
  const json = JSON.stringify(page);
  for (const secret of [
    stage.id, stage.assetId, stage.remotePath, stage.nonce,
    stage.expectedHash, f.snapshotHash, '4242', hostId,
  ]) expect(json).not.toContain(secret);
  const publicPage = dispatchInternal(db, { command: 'stage.list', jobId: f.jobId });
  expect(publicPage).toHaveLength(1);
  expect(db.getJob(f.jobId).job).toEqual(before);
  expect(db.listDeviceStageTransfers(f.jobId)[0]).toEqual(staged);
  sql((conn) => expect(Number(conn.prepare(
    'SELECT COUNT(*) AS total FROM queue_events WHERE job_id=?',
  ).get(f.jobId)?.total)).toBe(eventsBefore));
  db.close(); db = new StudioDatabase(dbPath());
  expect(db.jobStageReview(f.jobId).mediaOrder).toEqual(page.mediaOrder);

  // A newer MANUAL/JOB reconciliation that contradicts the indexed row must
  // invalidate historical candidate evidence, without deleting its journal.
  db.recordClaimedDeviceStageReconciliation({
    requestId: 'stage_index_later_contradiction', stageId: stage.id,
    lease: f.lease, expectedJobRevision: f.jobRevision, at: at + 240,
    classification: 'REMOTE_MISMATCH',
    observedHash: 'b'.repeat(64), observedBytes: stage.expectedBytes,
    mediaStoreStatus: 'NOT_INDEXED',
  });
  const blocked = db.jobStageReview(f.jobId).mediaOrder;
  expect(blocked.status).toBe('BLOCKED');
  expect(blocked.blockers).toContain('LATEST_OBSERVATION_CONTRADICTS_ROW');
  expect(blocked.canSelect).toBe(false);
  expect(db.getJob(f.jobId).job).toEqual(before);
  expect(db.listDeviceStageTransfers(f.jobId)[0]).toEqual(staged);
  expect(original.state).toBe('SYNC_ACK_UNVERIFIED');
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
  })).toThrow('already pending for this stage');
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


it('blocks a second cleanup request across later MANUAL lease generations while preserving idempotent replay', () => {
  const f = fixture(), stage = readyForReconciliation(f);
  db.recoverExpiredClaims(f.deviceId, at + 3000);
  const first = db.acquireLease(f.deviceId, 'cleanup_first_operator', 'MANUAL', at + 3001, 5000);
  const revision = db.getJob(f.jobId).job.revision;
  db.recordClaimedDeviceStageReconciliation({
    requestId: 'cleanup_first_observation', stageId: stage.id, hostId,
    expectedSnapshotHash: f.snapshotHash, expectedJobRevision: revision,
    lease: first, classification: 'REMOTE_BYTES_MATCHED',
    observedHash: stage.expectedHash, observedBytes: stage.expectedBytes,
    mediaStoreStatus: 'NOT_INDEXED', at: at + 3010,
  });
  const original = {
    requestId: 'cleanup_first_pending', stageId: stage.id, hostId,
    expectedJobRevision: revision, expectedSnapshotHash: f.snapshotHash,
    lease: first, at: at + 3011, confirmed: true as const,
  };
  const receipt = db.recordOwnedStageCleanupReviewRequest(original);
  expect(db.recordOwnedStageCleanupReviewRequest(original)).toEqual(receipt);
  expect(db.assessOwnedStageCleanup(original).blockers)
    .toEqual(['CLEANUP_REVIEW_ALREADY_PENDING']);
  db.releaseLease(first);
  const second = db.acquireLease(
    f.deviceId, 'cleanup_second_operator', 'MANUAL', at + 3020, 5000,
  );
  db.recordClaimedDeviceStageReconciliation({
    requestId: 'cleanup_second_observation', stageId: stage.id, hostId,
    expectedSnapshotHash: f.snapshotHash, expectedJobRevision: revision,
    lease: second, classification: 'REMOTE_BYTES_MATCHED',
    observedHash: stage.expectedHash, observedBytes: stage.expectedBytes,
    mediaStoreStatus: 'NOT_INDEXED', at: at + 3030,
  });
  const fresh = { ...original, requestId: 'cleanup_second_pending',
    lease: second, at: at + 3031 };
  expect(db.assessOwnedStageCleanup(fresh).blockers)
    .toEqual(['CLEANUP_REVIEW_ALREADY_PENDING']);
  expect(() => db.recordOwnedStageCleanupReviewRequest(fresh))
    .toThrow('already pending for this stage');
  expect(() => db.recordOwnedStageCleanupReviewRequest({
    ...original, lease: second, at: at + 3031,
  })).toThrow('already bound to another observation');
  expect(db.listOwnedStageCleanupReviewRequests(f.jobId)).toEqual([receipt]);
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(db.listDeviceStageTransfers(f.jobId)[0]).toMatchObject({
    id: stage.id, state: 'SYNC_ACK_UNVERIFIED',
  });
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


it('reviews full post-success cleanup readiness from SQLite without deleting or trusting synthetic provider state', async () => {
  const f = fixture(), stage = readyForReconciliation(f);
  const req = {
    command: 'stage.postCleanupReview' as const,
    jobId: f.jobId, expectedSnapshotHash: f.snapshotHash,
  };
  const counts = () => {
    const conn = new DatabaseSync(dbPath());
    try {
      return [
        Number(conn.prepare('SELECT COUNT(*) AS n FROM effects WHERE job_id=?').get(f.jobId)?.n),
        Number(conn.prepare('SELECT COUNT(*) AS n FROM queue_events WHERE job_id=?').get(f.jobId)?.n),
        Number(conn.prepare('SELECT COUNT(*) AS n FROM device_stage_transfers WHERE job_id=?')
          .get(f.jobId)?.n),
      ];
    } finally { conn.close(); }
  };
  const review = () => dispatchInternal(db, req) as
    ReturnType<StudioDatabase['reviewPostCleanupReadiness']>;
  let before = counts();
  const initial = review();
  expect(initial).toMatchObject({
    scope: 'PRIVATE_JOB_OWNED_CLEANUP_NOT_PROVIDER_CERTIFIED',
    status: 'BLOCKED', ledger: 'INCOMPLETE',
    frozenMediaCount: 1, stageCount: 1,
    blockers: expect.arrayContaining([
      'JOB_NOT_SUCCESSFUL', 'MEDIASTORE_PICKER_UNVERIFIED',
      'PUBLISH_JOURNAL_MISSING_OR_UNCONFIRMED',
      'JOB_CLAIM_PENDING', 'PROVIDER_CERTIFICATION_UNAVAILABLE',
    ]),
    canDelete: false, canDispatch: false, canRetry: false, canMarkClean: false,
  });
  expect(counts()).toEqual(before);
  await expect(dispatch(db, {
    operationId: 'op_forged_post_cleanup_review',
    command: 'stage.postCleanupReview' as never,
    input: req,
  })).rejects.toThrow();
  expect(() => db.reviewPostCleanupReadiness({
    ...req, expectedSnapshotHash: contentHash('other_job_snapshot'),
  })).toThrow('exact frozen job snapshot');

  // Synthetic DB-only provider and MediaStore rows used to exercise ledger
  // shape; they are NEVER a certified Facebook/Android result or delete grant.
  sql((conn) => {
    conn.prepare(
      'UPDATE device_stage_transfers SET ' +
      'mediastore_row_id=?,mediastore_display_name=?,mediastore_relative_path=?,' +
      'mediastore_mime_type=?,mediastore_bytes=?,mediastore_at=? WHERE id=?',
    ).run(
      'synthetic_mediastore_row', 'asset-000-' + stage.nonce + '.mp4',
      'Download/AutoReelsStudio/job-' + f.jobId + '/',
      'video/mp4', stage.expectedBytes, new Date(at + 400).toISOString(), stage.id,
    );
    conn.prepare(
      "UPDATE jobs SET state='SUCCESS',revision=revision+1 WHERE id=?",
    ).run(f.jobId);
    conn.prepare('DELETE FROM job_claims WHERE job_id=?').run(f.jobId);
    conn.prepare(
      'INSERT INTO effects(id,job_id,node_id,kind,effect_key,payload_hash,state,evidence_ref,created_at) ' +
      'VALUES(?,?,?,?,?,?,?,?,?)',
    ).run(
      'effect_synthetic_cleanup_parent', f.jobId, 'publish', 'PUBLISH',
      contentHash('synthetic_cleanup_publish_key'), contentHash('synthetic_cleanup_payload'),
      'CONFIRMED', null, new Date(at + 450).toISOString(),
    );
  });
  db.releaseLease(f.lease);
  before = counts();
  const complete = review();
  expect(complete).toEqual({
    scope: 'PRIVATE_JOB_OWNED_CLEANUP_NOT_PROVIDER_CERTIFIED',
    status: 'BLOCKED', ledger: 'MATCHED_DB_ONLY',
    frozenMediaCount: 1, stageCount: 1,
    blockers: ['PROVIDER_CERTIFICATION_UNAVAILABLE'],
    canDelete: false, canDispatch: false, canRetry: false, canMarkClean: false,
  });
  const redacted = JSON.stringify(complete);
  for (const sensitive of [
    f.jobId, stage.id, stage.remotePath, stage.nonce,
    stage.expectedHash, stage.expectedBytes.toString(), f.snapshotHash,
  ]) expect(redacted).not.toContain(sensitive);
  expect(counts()).toEqual(before);
  const frozen = db.getJob(f.jobId).job;
  db.close(); db = new StudioDatabase(dbPath());
  expect(review()).toEqual(complete);
  expect(db.getJob(f.jobId).job).toEqual(frozen);
  expect(counts()).toEqual(before);
  expect(db.listDeviceStageTransfers(f.jobId)).toHaveLength(1);

  sql(conn => conn.prepare('UPDATE device_stage_transfers SET remote_path=? WHERE id=?')
    .run('/sdcard/DCIM/Camera/someone-elses-file.mp4', stage.id));
  const malformed = review();
  expect(malformed).toMatchObject({
    status: 'BLOCKED', ledger: 'INVALID',
    blockers: ['LEDGER_BINDING_MISMATCH', 'PROVIDER_CERTIFICATION_UNAVAILABLE'],
    canDelete: false,
  });
  expect(JSON.stringify(malformed)).not.toContain('/sdcard/DCIM/');
  sql(conn => conn.prepare('UPDATE device_stage_transfers SET remote_path=? WHERE id=?')
    .run(stage.remotePath, stage.id));
  sql(conn => conn.prepare(
    'INSERT INTO effects(id,job_id,node_id,kind,effect_key,payload_hash,state,evidence_ref,created_at)' +
    ' VALUES(?,?,?,?,?,?,?,?,?)',
  ).run('effect_pending_comment_cleanup', f.jobId, 'comment', 'COMMENT',
    contentHash('cleanup_pending_comment_key'), contentHash('cleanup_pending_comment_payload'),
    'ATTEMPT_UNCERTAIN', null, new Date(at + 460).toISOString()));
  expect(review()).toMatchObject({
    ledger: 'MATCHED_DB_ONLY',
    blockers: ['EXTERNAL_EFFECT_UNRESOLVED', 'PROVIDER_CERTIFICATION_UNAVAILABLE'],
    canDelete: false, canRetry: false,
  });
  expect(db.listDeviceStageTransfers(f.jobId)[0]!.remotePath).toBe(stage.remotePath);
});


it('journals exactly three non-executable MANUAL cleanup rechecks and survives restart without altering job/effects', async () => {
  const f = fixture(), stage = readyForReconciliation(f);
  expect(db.recoverExpiredClaims(f.deviceId, at + 3000))
    .toEqual({ requeued: [], review: [f.jobId] });
  const manual = db.acquireLease(
    f.deviceId, 'operator_recheck_fixture', 'MANUAL', at + 3001, 120000,
  );
  const jobBefore = db.getJob(f.jobId).job;
  const stageBefore = db.listDeviceStageTransfers(f.jobId)[0]!;
  const counts = () => {
    const conn = new DatabaseSync(dbPath());
    try {
      return [
        Number(conn.prepare('SELECT COUNT(*) AS n FROM queue_events WHERE job_id=?')
          .get(f.jobId)?.n),
        Number(conn.prepare('SELECT COUNT(*) AS n FROM effects WHERE job_id=?')
          .get(f.jobId)?.n),
        Number(conn.prepare('SELECT COUNT(*) AS n FROM device_stage_cleanup_rechecks WHERE stage_id=?')
          .get(stage.id)?.n),
      ];
    } finally { conn.close(); }
  };
  const safeAbsence: NativeStageCleanupAbsenceResult = {
    scope: 'PRIVATE_OWNED_STAGE_ABSENCE_NOT_DELETE_CERTIFIED',
    status: 'ABSENCE_CANDIDATE_UNCERTIFIED',
    remote: 'ABSENT', mediaStore: 'NOT_INDEXED',
    blockers: ['PROVIDER_AND_CLEANUP_UNCERTIFIED'],
    canDelete: false, canMarkClean: false, canRetry: false, canDispatch: false,
  };
  const req = {
    command: 'stage.cleanupRecheckRecord' as const,
    requestId: 'cleanup_recheck_first',
    stageId: stage.id, hostId,
    expectedJobRevision: jobBefore.revision,
    expectedSnapshotHash: f.snapshotHash,
    lease: manual, result: safeAbsence, at: at + 3010,
  };
  const before = counts();
  const first = dispatchInternal(db, req) as
    ReturnType<StudioDatabase['recordOwnedStageCleanupRecheck']>;
  expect(first).toEqual({
    requestId: req.requestId, ordinal: 0, attemptOrdinal: 1,
    status: 'ABSENCE_CANDIDATE_UNCERTIFIED',
    recordedAt: new Date(req.at).toISOString(),
    alreadyRecorded: false,
    canDelete: false, canMarkClean: false, canRetry: false, canDispatch: false,
  });
  expect(dispatchInternal(db, req)).toMatchObject({
    attemptOrdinal: 1, alreadyRecorded: true, canDelete: false,
  });
  const second = db.recordOwnedStageCleanupRecheck({
    ...req, requestId: 'cleanup_recheck_second', at: at + 3011,
    result: {
      ...safeAbsence, status: 'REMOTE_PRESENT_REVIEW', remote: 'PRESENT',
      blockers: ['REMOTE_STILL_PRESENT', 'PROVIDER_AND_CLEANUP_UNCERTIFIED'],
    },
  });
  expect(second).toMatchObject({
    attemptOrdinal: 2, status: 'REMOTE_PRESENT_REVIEW', canRetry: false,
  });
  const third = db.recordOwnedStageCleanupRecheck({
    ...req, requestId: 'cleanup_recheck_third', at: at + 3012,
    result: {
      ...safeAbsence, status: 'MEDIASTORE_PRESENT_REVIEW', mediaStore: 'INDEXED_EXACT',
      blockers: ['MEDIASTORE_STILL_INDEXED', 'PROVIDER_AND_CLEANUP_UNCERTIFIED'],
    },
  });
  expect(third).toMatchObject({
    attemptOrdinal: 3, status: 'MEDIASTORE_PRESENT_REVIEW', canMarkClean: false,
  });
  expect(() => db.recordOwnedStageCleanupRecheck({
    ...req, requestId: 'cleanup_recheck_fourth', at: at + 3013,
  })).toThrow('Three read-only recheck records');
  expect(db.recordOwnedStageCleanupRecheck({
    ...req, requestId: 'cleanup_recheck_third', at: at + 3012,
    result: {
      ...safeAbsence, status: 'MEDIASTORE_PRESENT_REVIEW', mediaStore: 'INDEXED_EXACT',
      blockers: ['MEDIASTORE_STILL_INDEXED', 'PROVIDER_AND_CLEANUP_UNCERTIFIED'],
    },
  })).toMatchObject({ attemptOrdinal: 3, alreadyRecorded: true });

  const history = dispatchInternal(db, {
    command: 'stage.cleanupRecheckHistory', jobId: f.jobId,
  }) as ReturnType<StudioDatabase['listOwnedStageCleanupRechecks']>;
  expect(history).toMatchObject({
    scope: 'PRIVATE_CLEANUP_RECHECK_HISTORY_NOT_DELETE_CERTIFIED',
    items: expect.arrayContaining([
      { ordinal: 0, attemptOrdinal: 1,
        status: 'ABSENCE_CANDIDATE_UNCERTIFIED', remote: 'ABSENT',
        mediaStore: 'NOT_INDEXED', recordedAt: first.recordedAt },
      { ordinal: 0, attemptOrdinal: 2,
        status: 'REMOTE_PRESENT_REVIEW', remote: 'PRESENT',
        mediaStore: 'NOT_INDEXED', recordedAt: second.recordedAt },
      { ordinal: 0, attemptOrdinal: 3,
        status: 'MEDIASTORE_PRESENT_REVIEW', remote: 'ABSENT',
        mediaStore: 'INDEXED_EXACT', recordedAt: third.recordedAt },
    ]),
    canDelete: false, canMarkClean: false, canRetry: false, canDispatch: false,
  });
  const publicPage = db.jobStageReview(f.jobId);
  expect(publicPage.cleanupRechecks).toEqual(history.items.map((item) => ({
    stageOrdinal: item.ordinal, attemptOrdinal: item.attemptOrdinal,
    status: item.status, remote: item.remote,
    mediaStore: item.mediaStore, recordedAt: item.recordedAt,
  })));
  expect(publicPage.canDispatch).toBe(false);
  const publicText = JSON.stringify(publicPage.cleanupRechecks);
  for (const secret of [
    stage.id, stage.remotePath, stage.nonce, manual.ownerId,
    f.snapshotHash, stage.expectedHash,
    'cleanup_recheck_first', 'cleanup_recheck_second', 'cleanup_recheck_third',
  ]) expect(publicText).not.toContain(secret);
  const text = JSON.stringify(history);
  for (const secret of [stage.id, stage.remotePath, stage.nonce,
    f.snapshotHash, manual.ownerId, stage.expectedHash])
    expect(text).not.toContain(secret);
  expect(counts()).toEqual([before[0], before[1], 3]);
  expect(db.getJob(f.jobId).job).toEqual(jobBefore);
  expect(db.listDeviceStageTransfers(f.jobId)[0]).toEqual(stageBefore);
  expect(db.claimDueJob(f.deviceId, 'replay_not_permitted', at + 3200).status)
    .toBe('NEEDS_REVIEW');
  await expect(dispatch(db, {
    operationId: 'op_forged_cleanup_recheck', command: 'stage.cleanupRecheckRecord' as never,
    input: req,
  })).rejects.toThrow();

  db.close(); db = new StudioDatabase(dbPath());
  expect(db.listOwnedStageCleanupRechecks(f.jobId)).toEqual(history);
  expect(db.jobStageReview(f.jobId).cleanupRechecks).toEqual(publicPage.cleanupRechecks);
  expect(db.getJob(f.jobId).job).toEqual(jobBefore);
  expect(counts()).toEqual([before[0], before[1], 3]);
  sql((conn) => {
    expect(() => conn.prepare(
      "UPDATE device_stage_cleanup_rechecks SET result_status='BLOCKED' WHERE request_id=?",
    ).run(req.requestId)).toThrow('immutable');
    expect(() => conn.prepare(
      'DELETE FROM device_stage_cleanup_rechecks WHERE request_id=?',
    ).run(req.requestId)).toThrow('immutable');
  });
});

it('rejects forged cleanup recheck rights, contradictory status or mutated request identity without effects', async () => {
  const f = fixture(), stage = readyForReconciliation(f);
  const early = db.acquireLease(f.deviceId, 'recheck_job_still_claimed', 'MANUAL',
    at + 3010, 120000);
  const base: Parameters<StudioDatabase['recordOwnedStageCleanupRecheck']>[0] = {
    requestId: 'cleanup_recheck_invalid', stageId: stage.id, hostId,
    expectedJobRevision: db.getJob(f.jobId).job.revision,
    expectedSnapshotHash: f.snapshotHash,
    lease: early, at: at + 3020,
    result: {
      scope: 'PRIVATE_OWNED_STAGE_ABSENCE_NOT_DELETE_CERTIFIED',
      status: 'ABSENCE_CANDIDATE_UNCERTIFIED', remote: 'ABSENT',
      mediaStore: 'NOT_INDEXED', blockers: ['PROVIDER_AND_CLEANUP_UNCERTIFIED'],
      canDelete: false, canMarkClean: false, canRetry: false, canDispatch: false,
    },
  };
  expect(() => db.recordOwnedStageCleanupRecheck(base)).toThrow();
  db.releaseLease(early);
  db.recoverExpiredClaims(f.deviceId, at + 5000);
  const manual = db.acquireLease(f.deviceId, 'cleanup_recheck_operator', 'MANUAL',
    at + 5001, 120000);
  const revision = db.getJob(f.jobId).job.revision;
  const valid = { ...base, lease: manual, expectedJobRevision: revision, at: at + 5010 };
  const count = (): number => {
    let n = -1;
    sql(conn => { n = Number(conn.prepare(
      'SELECT COUNT(*) AS n FROM device_stage_cleanup_rechecks WHERE stage_id=?',
    ).get(stage.id)?.n); });
    return n;
  };
  for (const bad of [
    { ...valid, hostId: 'host_foreign' },
    { ...valid, expectedJobRevision: revision - 1 },
    { ...valid, expectedSnapshotHash: contentHash('wrong_snapshot') },
    { ...valid, requestId: '' },
    { ...valid, at: Number.NaN },
    { ...valid, result: { ...valid.result, canDelete: true as never } },
    { ...valid, result: { ...valid.result, canRetry: true as never } },
    { ...valid, result: { ...valid.result, canDispatch: true as never } },
    { ...valid, result: { ...valid.result, remotePath: '/sdcard/DCIM/Camera/private.mp4' } },
    { ...valid, result: { ...valid.result, blockers: [] } },
    { ...valid, result: { ...valid.result, blockers: ['REMOTE_STAT_INVALID'] as never } },
    { ...valid, result: { ...valid.result, status: 'MEDIASTORE_PRESENT_REVIEW' as never } },
    { ...valid, result: { ...valid.result, mediaStore: 'INDEXED_EXACT' as never } },
    { ...valid, result: { ...valid.result, status: 'BLOCKED' as never } },
  ]) {
    expect(() => db.recordOwnedStageCleanupRecheck(bad)).toThrow();
    expect(count()).toBe(0);
  }
  const result = db.recordOwnedStageCleanupRecheck(valid);
  expect(result).toMatchObject({ attemptOrdinal: 1, alreadyRecorded: false });
  expect(() => db.recordOwnedStageCleanupRecheck({
    ...valid, result: {
      ...valid.result, status: 'REMOTE_PRESENT_REVIEW',
      remote: 'PRESENT',
      blockers: ['REMOTE_STILL_PRESENT', 'PROVIDER_AND_CLEANUP_UNCERTIFIED'],
    },
  })).toThrow('already bound to different evidence');
  expect(count()).toBe(1);
  db.releaseLease(manual);
  expect(() => db.recordOwnedStageCleanupRecheck({
    ...valid, requestId: 'cleanup_recheck_lease_lost', at: at + 5020,
  })).toThrow();
  expect(count()).toBe(1);
});

it('rejects recheck if frozen owned path is altered or historical review state is no longer current', () => {
  const f = fixture(), stage = readyForReconciliation(f);
  db.recoverExpiredClaims(f.deviceId, at + 3000);
  const manual = db.acquireLease(f.deviceId, 'cleanup_recheck_fence', 'MANUAL',
    at + 3001, 120000);
  const valid: Parameters<StudioDatabase['recordOwnedStageCleanupRecheck']>[0] = {
    requestId: 'recheck_path_fence', stageId: stage.id, hostId,
    expectedJobRevision: db.getJob(f.jobId).job.revision,
    expectedSnapshotHash: f.snapshotHash, lease: manual, at: at + 3011,
    result: {
      scope: 'PRIVATE_OWNED_STAGE_ABSENCE_NOT_DELETE_CERTIFIED',
      status: 'REMOTE_PRESENT_REVIEW', remote: 'PRESENT', mediaStore: 'NOT_INDEXED',
      blockers: ['REMOTE_STILL_PRESENT', 'PROVIDER_AND_CLEANUP_UNCERTIFIED'],
      canDelete: false, canMarkClean: false, canRetry: false, canDispatch: false,
    },
  };
  sql(conn => conn.prepare('UPDATE device_stage_transfers SET remote_path=? WHERE id=?')
    .run('/sdcard/DCIM/Camera/not-owned.mp4', stage.id));
  expect(() => db.recordOwnedStageCleanupRecheck(valid)).toThrow();
  sql(conn => conn.prepare('UPDATE device_stage_transfers SET remote_path=? WHERE id=?')
    .run(stage.remotePath, stage.id));
  sql(conn => conn.prepare('UPDATE jobs SET revision=revision+1 WHERE id=?').run(f.jobId));
  expect(() => db.recordOwnedStageCleanupRecheck(valid)).toThrow();
  sql(conn => conn.prepare('UPDATE jobs SET revision=revision-1 WHERE id=?').run(f.jobId));
  expect(db.listOwnedStageCleanupRechecks(f.jobId).items).toHaveLength(0);
});
