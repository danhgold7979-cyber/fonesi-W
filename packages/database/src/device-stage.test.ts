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
