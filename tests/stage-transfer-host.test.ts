import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  DeviceLease, DeviceStageTransfer, ProcessDefinition, JobMediaPreflightPlan,
} from '@autoreels/contracts';
import type { OwnedSyncInput } from '@autoreels/devices';
import { StudioDatabase } from '@autoreels/database';
import { contentHash } from '@autoreels/domain';
import { fingerprint } from '@autoreels/media';
import { HostMediaService } from '../apps/desktop/src/host/media-service.js';
import { HostStageTransferService } from '../apps/desktop/src/host/stage-transfer-service.js';
import { NativeStageReviewService } from '../apps/desktop/src/host/native-stage-review.js';
import { dispatchInternal, type InternalRequest } from '../apps/desktop/src/host/internal.js';
import { dispatch } from '../apps/desktop/src/host/service.js';

let dir: string, db: StudioDatabase, media: HostMediaService, file: string;
const hostId = 'host_transfer_fixture', jobId = 'job_transfer_fixture';
const deviceId = 'device_transfer_fixture', processId = 'process_transfer_fixture';
const events: string[] = [];
const filepath = () => join(dir, 'studio.sqlite');
beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'autoreels-stage-host-')));
  file = join(dir, 'media.mp4');
  await writeFile(file, 'host stage transfer exact test content');
  db = new StudioDatabase(filepath());
  events.length = 0;
  media = new HostMediaService({
    request: async (command, input = {}) =>
      dispatch(db, { command, input, operationId: 'op_transfer_fixture' }),
    internal: async <T>(request: InternalRequest) => {
      events.push(request.command);
      return dispatchInternal(db, request) as T;
    },
  }, hostId, undefined, dir);
});
afterEach(async () => {
  await media.close();
  db.close();
  await rm(dir, { recursive: true, force: true });
});
function sql(action: (conn: DatabaseSync) => void): void {
  const connection = new DatabaseSync(filepath());
  try { action(connection); } finally { connection.close(); }
}
async function fixture() {
  const at = Date.now();
  db.registerObservedDevice(deviceId, 'Safe stage fixture');
  sql((conn) => {
    conn.prepare(
      "INSERT INTO device_profiles(device_id,fingerprint,metadata,identity,revision) VALUES(?,?,NULL,'VERIFIED_PROPERTIES',0)",
    ).run(deviceId, contentHash('stage test only'));
    conn.prepare(
      "INSERT INTO device_transports(host_id,serial,device_id,kind,state,generation,last_seen,identity_verified) VALUES(?,?,?,?,?,?,?,?)",
    ).run(hostId, 'USB_STAGE_FIXTURE', deviceId, 'USB', 'CONNECTED', 1, new Date(at).toISOString(), 1);
  });
  const draft = db.createWorkflow('fb', 'Private transfer test'),
    version = db.createVersion(draft.workflowId, 0);
  const process: ProcessDefinition = {
    id: processId, name: processId, appId: 'fb',
    workflowId: draft.workflowId, workflowVersionId: version.id,
    deviceId, accountId: null, targetId: null,
    revision: 0, archived: false,
    schedule: {
      timezone: 'Asia/Ho_Chi_Minh', startDate: '2026-10-26', slots: ['08:00'],
      weekdays: [1, 2, 3, 4, 5, 6, 7], overduePolicy: 'CATCH_UP',
      jitterMinutes: 0,
    },
  };
  db.saveProcess(process, null);
  const grant = db.registerNativeSource({
    processId, kind: 'FILE', rootPath: await realpath(file),
    recursive: false, watch: false, hostId,
  });
  const fp = await fingerprint(file);
  db.applyScannedAsset(grant.id, hostId, grant.revision, 'gen_host_stage', {
    relativePath: basename(file), kind: 'video',
    hash: fp.hash, bytes: fp.bytes, mtimeMs: fp.mtimeMs,
    probe: { status: 'UNAVAILABLE', reason: 'Test fixture only' },
  });
  const item = db.listContent(processId)[0]!;
  db.createJob({
    id: jobId, occurrenceKey: contentHash('hoststage-unique'),
    processId, deviceId, contentId: item.id,
    scheduledUtc: '2020-01-01T00:00:00.000Z',
    state: 'SCHEDULED', revision: 0, priority: 0,
  }, {
    workflowVersionId: version.id, workflowHash: version.hash,
    bundle: version.bundle, contentId: item.id,
    fields: item.fields, assetIds: item.assetIds,
    assets: db.listContentAssets(processId),
    targetId: null, networkProfileId: null,
  });
  const claim = db.claimDueJob(deviceId, 'job_stage_worker', at, 240000);
  expect(claim.status).toBe('CLAIMED');
  if (claim.status !== 'CLAIMED') throw new Error('Missing actual claim');
  return {
    at, lease: claim.lease, expectedJobRevision: claim.job.revision,
    expectedSnapshotHash: claim.snapshotHash, jobId, ordinal: 0,
    transportSerial: 'USB_STAGE_FIXTURE', transportGeneration: 1,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function coordinator(
  outcome: 'OK' | 'FAIL' | 'WRONG_ACK' | 'WRONG_READBACK' | 'NOT_INDEXED' | 'AMBIGUOUS' | 'UNSUPPORTED' = 'OK',
  confirmReview?: (summary: { jobId: string; ordinal: number }) => Promise<boolean>,
) {
  return new HostStageTransferService({
    internal: async <T>(request: InternalRequest) => {
      events.push(request.command);
      return dispatchInternal(db, request) as T;
    },
  }, media, hostId, dir, () => ({
    scoped: (fence: () => Promise<void>) => ({
      sendOwnedStage: async (input: OwnedSyncInput) => {
        events.push('fake.adb.before');
        await fence();
        const bytes = await readFile(input.localPath);
        expect(bytes.length).toBe(input.expectedBytes);
        expect((await fingerprint(input.localPath)).hash).toBe(input.expectedHash);
        events.push('fake.adb.send');
        if (outcome === 'FAIL') throw new Error('simulated disconnect after SEND');
        return {
          status: 'SYNC_ACK_UNVERIFIED' as const,
          remotePath: outcome === 'WRONG_ACK' ? '/untrusted/path' :
            '/sdcard/Download/AutoReelsStudio/job-' + input.jobId +
            '/asset-' + String(input.ordinal).padStart(3, '0') +
            '-' + input.nonce + '.mp4',
          bytes: input.expectedBytes, canDispatch: false as const,
        };
      },
      readOwnedStage: async (input: {
        serial: string; jobId: string; ordinal: number; nonce: string; extension: string;
        expectedHash: string; expectedBytes: number;
      }) => {
        events.push('fake.adb.readback');
        await fence();
        return {
          remotePath: '/sdcard/Download/AutoReelsStudio/job-' + input.jobId +
            '/asset-' + String(input.ordinal).padStart(3, '0') + '-' + input.nonce + input.extension,
          hash: outcome === 'WRONG_READBACK' ? 'f'.repeat(64) : input.expectedHash,
          bytes: input.expectedBytes,
        };
      },
      probeOwnedStageMediaStore: async (input: {
        serial: string; jobId: string; ordinal: number; nonce: string; extension: string; expectedBytes: number;
      }) => {
        events.push('fake.adb.mediastore');
        await fence();
        if (outcome === 'NOT_INDEXED' || outcome === 'AMBIGUOUS' || outcome === 'UNSUPPORTED')
          return { status: outcome } as const;
        return {
          status: 'INDEXED_EXACT' as const,
          rowId: '42',
          displayName: 'asset-' + String(input.ordinal).padStart(3, '0') + '-' + input.nonce + input.extension,
          relativePath: 'Download/AutoReelsStudio/job-' + input.jobId + '/',
          mimeType: /^\\.(?:jpg|jpeg|png|webp|gif|bmp)$/.test(input.extension) ? 'image/jpeg' : 'video/mp4',
          bytes: input.expectedBytes,
        };
      },
    }),
  }), confirmReview);
}

it('orders host stage → SQLite intent → uncertainty → ADB → ACK without publish', async () => {
  const f = await fixture();
  const source = await readFile(file);
  const result = await coordinator().transfer(f);
  expect(result).toMatchObject({ status: 'SYNC_ACK_UNVERIFIED', canDispatch: false });
  expect(JSON.stringify(result)).not.toContain(dir);
  expect(JSON.stringify(result)).not.toContain('USB_STAGE_FIXTURE');
  const rows = db.listDeviceStageTransfers(jobId);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    id: result.stageId, state: 'SYNC_ACK_UNVERIFIED',
    claimGeneration: f.lease.generation,
  });
  const beforeSend = events.indexOf('fake.adb.send');
  expect(events.indexOf('stage.prepare')).toBeGreaterThanOrEqual(0);
  expect(events.indexOf('stage.beginAttempt')).toBeGreaterThan(events.indexOf('stage.prepare'));
  expect(beforeSend).toBeGreaterThan(events.indexOf('stage.beginAttempt'));
  expect(events.indexOf('stage.syncAck')).toBeGreaterThan(beforeSend);
  expect(events.indexOf('stage.assertClaim')).toBeLessThan(beforeSend);
  expect(await readFile(file)).toEqual(source);
  expect(db.getJob(jobId).job.state).toBe('PREFLIGHT');
  expect(() => db.transitionJob(jobId, 'RUNNING', f.expectedJobRevision))
    .toThrow('MediaStore');
  await expect(coordinator().transfer(f)).rejects.toMatchObject({
    code: 'STAGE_ALREADY_ATTEMPTED',
  });
  expect(db.listDeviceStageTransfers(jobId)).toHaveLength(1);
});

it('persists remote byte readback evidence only after exact match and still blocks dispatch', async () => {
  const f = await fixture();
  const uploaded = await coordinator().transfer(f);
  const receipt = await coordinator().verifyRemoteBytes({
    jobId: f.jobId, stageId: uploaded.stageId,
    expectedJobRevision: f.expectedJobRevision,
    expectedSnapshotHash: f.expectedSnapshotHash,
    lease: f.lease, transportSerial: f.transportSerial,
    transportGeneration: f.transportGeneration,
  });
  expect(receipt).toMatchObject({
    scope: 'REMOTE_BYTES_ONLY', status: 'REMOTE_BYTES_MATCHED', canDispatch: false,
  });
  const stage = db.listDeviceStageTransfers(jobId)[0]!;
  expect(stage).toMatchObject({
    state: 'SYNC_ACK_UNVERIFIED',
    remoteReadbackHash: stage.expectedHash,
    remoteReadbackBytes: stage.expectedBytes,
  });
  expect(stage.remoteReadbackAt).toBeTruthy();
  expect(db.getJob(jobId).job.state).toBe('PREFLIGHT');
  expect(events).toContain('stage.verifyRemoteBytes');
});
it('does not persist mismatched remote hash and never marks it dispatchable', async () => {
  const f = await fixture();
  const uploaded = await coordinator().transfer(f);
  await expect(coordinator('WRONG_READBACK').verifyRemoteBytes({
    jobId: f.jobId, stageId: uploaded.stageId,
    expectedJobRevision: f.expectedJobRevision,
    expectedSnapshotHash: f.expectedSnapshotHash,
    lease: f.lease, transportSerial: f.transportSerial,
    transportGeneration: f.transportGeneration,
  })).rejects.toMatchObject({ code: 'STAGE_READBACK_MISMATCH' });
  expect(db.listDeviceStageTransfers(jobId)[0]).toMatchObject({
    state: 'SYNC_ACK_UNVERIFIED',
    remoteReadbackHash: null, remoteReadbackBytes: null, remoteReadbackAt: null,
  });
});
it('records exact MediaStore row only after matching remote byte readback and never dispatches', async () => {
  const f = await fixture();
  const uploaded = await coordinator().transfer(f);
  await coordinator().verifyRemoteBytes({
    jobId: f.jobId, stageId: uploaded.stageId, expectedJobRevision: f.expectedJobRevision,
    expectedSnapshotHash: f.expectedSnapshotHash, lease: f.lease,
    transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  });
  const receipt = await coordinator().verifyMediaStoreRow({
    jobId: f.jobId, stageId: uploaded.stageId, expectedJobRevision: f.expectedJobRevision,
    expectedSnapshotHash: f.expectedSnapshotHash, lease: f.lease,
    transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  });
  expect(receipt).toMatchObject({
    scope: 'MEDIASTORE_ROW_ONLY', status: 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED',
    canDispatch: false,
  });
  expect(db.listDeviceStageTransfers(jobId)[0]).toMatchObject({
    state: 'SYNC_ACK_UNVERIFIED', mediaStoreRowId: '42',
    mediaStoreDisplayName: expect.stringContaining('asset-000-'),
    mediaStoreRelativePath: 'Download/AutoReelsStudio/job-' + jobId + '/',
    mediaStoreMimeType: 'video/mp4', mediaStoreBytes: expect.any(Number),
  });
  expect(events).toContain('stage.recordMediaStore');
  expect(db.getJob(jobId).job.state).toBe('PREFLIGHT');
});
it('does not persist a MediaStore row when the probe says not indexed', async () => {
  const f = await fixture();
  const upload = await coordinator().transfer(f);
  await coordinator().verifyRemoteBytes({
    jobId: f.jobId, stageId: upload.stageId, expectedJobRevision: f.expectedJobRevision,
    expectedSnapshotHash: f.expectedSnapshotHash, lease: f.lease,
    transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  });
  const receipt = await coordinator('NOT_INDEXED').verifyMediaStoreRow({
    jobId: f.jobId, stageId: upload.stageId, expectedJobRevision: f.expectedJobRevision,
    expectedSnapshotHash: f.expectedSnapshotHash, lease: f.lease,
    transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  });
  expect(receipt).toMatchObject({ status: 'NOT_INDEXED', canDispatch: false });
  expect(db.listDeviceStageTransfers(jobId)[0]?.mediaStoreAt).toBeNull();
});

it('records fresh remote and MediaStore reconciliation without mutating stage/job state', async () => {
  const f = await fixture();
  const upload = await coordinator().transfer(f);
  await coordinator().verifyRemoteBytes({
    jobId: f.jobId, stageId: upload.stageId, expectedJobRevision: f.expectedJobRevision,
    expectedSnapshotHash: f.expectedSnapshotHash, lease: f.lease,
    transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  });
  const before = db.listDeviceStageTransfers(jobId)[0]!;
  const receipt = await coordinator().reconcileStage({
    requestId: 'reconcile_fixture_001', jobId: f.jobId, stageId: upload.stageId,
    expectedJobRevision: f.expectedJobRevision, expectedSnapshotHash: f.expectedSnapshotHash,
    lease: f.lease, transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  });
  expect(receipt).toMatchObject({
    classification: 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED',
    mediaStoreStatus: 'INDEXED_EXACT', canDispatch: false,
  });
  expect(db.listDeviceStageTransfers(jobId)[0]).toEqual(before);
  expect(db.getJob(jobId).job.state).toBe('PREFLIGHT');
  let audit: unknown;
  sql((conn) => { audit = conn.prepare(
    'SELECT classification,observed_hash,observed_bytes FROM device_stage_reconciliations WHERE stage_id=? AND request_id=?',
  ).get(upload.stageId, 'reconcile_fixture_001'); });
  expect(audit).toMatchObject({
    classification: 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED',
    observed_hash: before.expectedHash, observed_bytes: before.expectedBytes,
  });
});
it('classifies fresh absent MediaStore index while preserving matching remote-byte evidence', async () => {
  const f = await fixture();
  const upload = await coordinator().transfer(f);
  await coordinator().verifyRemoteBytes({
    jobId: f.jobId, stageId: upload.stageId, expectedJobRevision: f.expectedJobRevision,
    expectedSnapshotHash: f.expectedSnapshotHash, lease: f.lease,
    transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  });
  const receipt = await coordinator('NOT_INDEXED').reconcileStage({
    requestId: 'reconcile_fixture_002', jobId: f.jobId, stageId: upload.stageId,
    expectedJobRevision: f.expectedJobRevision, expectedSnapshotHash: f.expectedSnapshotHash,
    lease: f.lease, transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  });
  expect(receipt).toMatchObject({ classification: 'REMOTE_BYTES_MATCHED', mediaStoreStatus: 'NOT_INDEXED', canDispatch: false });
  expect(db.listDeviceStageTransfers(jobId)[0]?.state).toBe('SYNC_ACK_UNVERIFIED');
});
it('keeps reconciliation audit immutable and idempotent across SQLite reopen', async () => {
  const f = await fixture();
  const upload = await coordinator().transfer(f);
  await coordinator().verifyRemoteBytes({
    jobId: f.jobId, stageId: upload.stageId, expectedJobRevision: f.expectedJobRevision,
    expectedSnapshotHash: f.expectedSnapshotHash, lease: f.lease,
    transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  });
  const receipt = await coordinator().reconcileStage({
    requestId: 'reconcile_reopen_001', jobId: f.jobId, stageId: upload.stageId,
    expectedJobRevision: f.expectedJobRevision, expectedSnapshotHash: f.expectedSnapshotHash,
    lease: f.lease, transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  });
  const stageBefore = db.listDeviceStageTransfers(jobId)[0]!;
  const jobBefore = db.getJob(jobId).job;
  db.close();
  db = new StudioDatabase(filepath());
  const repeat = db.recordClaimedDeviceStageReconciliation({
    requestId: 'reconcile_reopen_001', stageId: upload.stageId, lease: f.lease,
    expectedJobRevision: f.expectedJobRevision,
    classification: receipt.classification, observedHash: stageBefore.expectedHash,
    observedBytes: stageBefore.expectedBytes, mediaStoreStatus: receipt.mediaStoreStatus, at: Date.now(),
  });
  expect(repeat.id).toBeTruthy();
  expect(repeat.requestId).toBe('reconcile_reopen_001');
  expect(repeat.classification).toBe(receipt.classification);
  expect(db.listDeviceStageTransfers(jobId)[0]).toEqual(stageBefore);
  expect(db.getJob(jobId).job).toEqual(jobBefore);
  let auditCount = 0;
  sql((conn) => {
    auditCount = Number(conn.prepare(
      'SELECT COUNT(*) AS count FROM device_stage_reconciliations WHERE stage_id=? AND request_id=?',
    ).get(upload.stageId, 'reconcile_reopen_001')?.count ?? 0);
  });
  expect(auditCount).toBe(1);
  expect(() => db.recordClaimedDeviceStageReconciliation({
    requestId: 'reconcile_reopen_001', stageId: upload.stageId, lease: f.lease,
    expectedJobRevision: f.expectedJobRevision, classification: 'REMOTE_MISMATCH',
    observedHash: 'f'.repeat(64), observedBytes: stageBefore.expectedBytes,
    mediaStoreStatus: 'UNSUPPORTED', at: Date.now(),
  })).toThrowError(/Request ID has different evidence/);
  expect(db.listDeviceStageTransfers(jobId)[0]).toEqual(stageBefore);
  expect(db.getJob(jobId).job).toEqual(jobBefore);
});
it('keeps unsupported and ambiguous MediaStore probes non-dispatchable during reconciliation', async () => {
  const f = await fixture();
  const upload = await coordinator().transfer(f);
  await coordinator().verifyRemoteBytes({
    jobId: f.jobId, stageId: upload.stageId, expectedJobRevision: f.expectedJobRevision,
    expectedSnapshotHash: f.expectedSnapshotHash, lease: f.lease,
    transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  });
  const before = db.listDeviceStageTransfers(jobId)[0]!;
  const unsupported = await coordinator('UNSUPPORTED').reconcileStage({
    requestId: 'reconcile_unsupported_001', jobId: f.jobId, stageId: upload.stageId,
    expectedJobRevision: f.expectedJobRevision, expectedSnapshotHash: f.expectedSnapshotHash,
    lease: f.lease, transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  });
  expect(unsupported).toMatchObject({
    classification: 'PROBE_UNSUPPORTED', mediaStoreStatus: 'UNSUPPORTED', canDispatch: false,
  });
  const afterUnsupported = db.listDeviceStageTransfers(jobId)[0]!;
  expect(afterUnsupported).toEqual(before);
  const ambiguous = await coordinator('AMBIGUOUS').reconcileStage({
    requestId: 'reconcile_ambiguous_001', jobId: f.jobId, stageId: upload.stageId,
    expectedJobRevision: f.expectedJobRevision, expectedSnapshotHash: f.expectedSnapshotHash,
    lease: f.lease, transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  });
  expect(ambiguous).toMatchObject({
    classification: 'REVIEW_REQUIRED', mediaStoreStatus: 'AMBIGUOUS', canDispatch: false,
  });
  expect(db.listDeviceStageTransfers(jobId)[0]).toEqual(before);
  expect(db.getJob(jobId).job.state).toBe('PREFLIGHT');
  expect(events).not.toContain('fake.adb.send:reconcile');
});

it('reconciles an expired stage under a fresh MANUAL lease without host-source access or new upload', async () => {
  const f = await fixture();
  const upload = await coordinator().transfer(f);
  const before = db.listDeviceStageTransfers(jobId)[0]!;
  // Test-only forced expiry; there is no time travel in the implementation.
  sql((conn) => {
    conn.prepare('UPDATE leases SET expires_at=? WHERE device_id=?').run(f.at - 1, deviceId);
    conn.prepare('UPDATE job_claims SET expires_at=? WHERE job_id=?').run(f.at - 1, jobId);
    conn.prepare("UPDATE source_entries SET state='CHANGED' WHERE asset_id=?")
      .run(before.assetId);
  });
  expect(db.recoverExpiredClaims(deviceId, Date.now()))
    .toEqual({ requeued: [], review: [jobId] });
  const manual = db.acquireLease(deviceId, 'operator_stage_reconciler', 'MANUAL', Date.now(), 240000);
  const jobBefore = db.getJob(jobId).job;
  const receipt = await coordinator().reconcileStage({
    requestId: 'manual_review_host_001', jobId, stageId: upload.stageId,
    expectedJobRevision: jobBefore.revision, expectedSnapshotHash: f.expectedSnapshotHash,
    lease: manual, transportSerial: f.transportSerial,
    transportGeneration: f.transportGeneration,
  });
  expect(receipt).toMatchObject({
    classification: 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED',
    mediaStoreStatus: 'INDEXED_EXACT', canDispatch: false,
  });
  expect(db.getJob(jobId).job).toEqual(jobBefore);
  expect(db.listDeviceStageTransfers(jobId)[0]).toEqual(before);
  expect(events.filter((item) => item === 'fake.adb.send')).toHaveLength(1);
  expect(events.filter((item) => item === 'fake.adb.readback')).toHaveLength(1);
  let audit: unknown;
  sql((conn) => { audit = conn.prepare(
    'SELECT claim_generation,lease_owner_kind,lease_generation FROM device_stage_reconciliations WHERE request_id=?',
  ).get('manual_review_host_001'); });
  expect(audit).toMatchObject({
    claim_generation: f.lease.generation, lease_owner_kind: 'MANUAL',
    lease_generation: manual.generation,
  });
  expect(db.claimDueJob(deviceId, 'forbidden_retry', Date.now()).status).toBe('NEEDS_REVIEW');
});

it('rejects a MANUAL review before recovery, on wrong host or after lease release without readback', async () => {
  const f = await fixture();
  const upload = await coordinator().transfer(f);
  const before = db.listDeviceStageTransfers(jobId)[0]!;
  await expect(coordinator().reconcileStage({
    requestId: 'manual_while_job_live', jobId, stageId: upload.stageId,
    expectedJobRevision: f.expectedJobRevision, expectedSnapshotHash: f.expectedSnapshotHash,
    lease: { ...f.lease, ownerKind: 'MANUAL' }, transportSerial: f.transportSerial,
    transportGeneration: f.transportGeneration,
  })).rejects.toThrow();
  sql((conn) => {
    conn.prepare('UPDATE leases SET expires_at=? WHERE device_id=?').run(f.at - 1, deviceId);
    conn.prepare('UPDATE job_claims SET expires_at=? WHERE job_id=?').run(f.at - 1, jobId);
  });
  db.recoverExpiredClaims(deviceId, Date.now());
  const manual = db.acquireLease(deviceId, 'manual_check', 'MANUAL', Date.now(), 240000);
  const revision = db.getJob(jobId).job.revision;
  await expect(coordinator().reconcileStage({
    requestId: 'manual_wrong_revision', jobId, stageId: upload.stageId,
    expectedJobRevision: f.expectedJobRevision, expectedSnapshotHash: f.expectedSnapshotHash,
    lease: manual, transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  })).rejects.toThrow();
  db.releaseLease(manual);
  await expect(coordinator().reconcileStage({
    requestId: 'manual_released', jobId, stageId: upload.stageId,
    expectedJobRevision: revision, expectedSnapshotHash: f.expectedSnapshotHash,
    lease: manual, transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  })).rejects.toThrow();
  expect(events).not.toContain('fake.adb.readback');
  expect(db.listDeviceStageTransfers(jobId)[0]).toEqual(before);
  expect(db.getJob(jobId).job.state).toBe('NEEDS_REVIEW');
});


it('performs cleanup eligibility as a private DB-only fenced dry run with no new ADB I/O', async () => {
  const f = await fixture();
  const uploaded = await coordinator().transfer(f);
  await coordinator().verifyRemoteBytes({
    jobId, stageId: uploaded.stageId, expectedJobRevision: f.expectedJobRevision,
    expectedSnapshotHash: f.expectedSnapshotHash, lease: f.lease,
    transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  });
  const stageBefore = db.listDeviceStageTransfers(jobId)[0]!;
  sql((conn) => {
    conn.prepare('UPDATE leases SET expires_at=? WHERE device_id=?').run(f.at - 1, deviceId);
    conn.prepare('UPDATE job_claims SET expires_at=? WHERE job_id=?').run(f.at - 1, jobId);
  });
  expect(db.recoverExpiredClaims(deviceId, Date.now()))
    .toEqual({ requeued: [], review: [jobId] });
  const manual = db.acquireLease(deviceId, 'cleanup_guard_operator', 'MANUAL', Date.now(), 240000);
  const jobBefore = db.getJob(jobId).job;
  await coordinator('NOT_INDEXED').reconcileStage({
    requestId: 'cleanup_fresh_manual_probe', jobId, stageId: uploaded.stageId,
    expectedJobRevision: jobBefore.revision, expectedSnapshotHash: f.expectedSnapshotHash,
    lease: manual, transportSerial: f.transportSerial,
    transportGeneration: f.transportGeneration,
  });
  events.length = 0;
  const report = await coordinator().inspectOwnedCleanupReadiness({
    stageId: uploaded.stageId, expectedJobRevision: jobBefore.revision,
    expectedSnapshotHash: f.expectedSnapshotHash, lease: manual,
  });
  expect(report).toMatchObject({
    jobId, ordinal: 0, scope: 'PERSISTED_PREFLIGHT_ONLY',
    status: 'PREREQUISITES_MET', blockers: [], canDelete: false, canDispatch: false,
  });
  expect(events).toEqual(['stage.cleanupReadiness']);
  expect(db.getJob(jobId).job).toEqual(jobBefore);
  expect(db.listDeviceStageTransfers(jobId)[0]).toEqual(stageBefore);
  await expect(coordinator().inspectOwnedCleanupReadiness({
    stageId: uploaded.stageId, expectedJobRevision: jobBefore.revision,
    expectedSnapshotHash: f.expectedSnapshotHash, lease: f.lease,
  })).rejects.toMatchObject({ code: 'STAGE_CLEANUP_REVIEW_REQUIRED' });
  db.releaseLease(manual);
  await expect(coordinator().inspectOwnedCleanupReadiness({
    stageId: uploaded.stageId, expectedJobRevision: jobBefore.revision,
    expectedSnapshotHash: f.expectedSnapshotHash, lease: manual,
  })).rejects.toMatchObject({ code: 'STALE_LEASE' });
  expect(events).not.toContain('fake.adb.send');
  expect(events).not.toContain('fake.adb.readback');
  expect(events).not.toContain('fake.adb.mediastore');
});


async function cleanupReviewFixture() {
  const f = await fixture();
  const uploaded = await coordinator().transfer(f);
  await coordinator().verifyRemoteBytes({
    jobId, stageId: uploaded.stageId, expectedJobRevision: f.expectedJobRevision,
    expectedSnapshotHash: f.expectedSnapshotHash, lease: f.lease,
    transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  });
  sql((conn) => {
    conn.prepare('UPDATE leases SET expires_at=? WHERE device_id=?').run(f.at - 1, deviceId);
    conn.prepare('UPDATE job_claims SET expires_at=? WHERE job_id=?').run(f.at - 1, jobId);
  });
  db.recoverExpiredClaims(deviceId, Date.now());
  const manual = db.acquireLease(
    deviceId, 'operator_cleanup_native', 'MANUAL', Date.now(), 240000,
  );
  const jobBefore = db.getJob(jobId).job;
  await coordinator('NOT_INDEXED').reconcileStage({
    requestId: 'cleanup_native_preflight_observation',
    jobId, stageId: uploaded.stageId,
    expectedJobRevision: jobBefore.revision,
    expectedSnapshotHash: f.expectedSnapshotHash,
    lease: manual, transportSerial: f.transportSerial,
    transportGeneration: f.transportGeneration,
  });
  return {
    requestId: 'cleanup_native_operator_request',
    stageId: uploaded.stageId, lease: manual,
    expectedJobRevision: jobBefore.revision,
    expectedSnapshotHash: f.expectedSnapshotHash,
    jobBefore, stageBefore: db.listDeviceStageTransfers(jobId)[0]!,
  };
}

it('native confirmation records a durable non-executable cleanup review and survives SQLite reopen', async () => {
  const ready = await cleanupReviewFixture();
  const confirmSeen: string[] = [];
  const native = coordinator('OK', async ({ jobId: confirmedJob, ordinal }) => {
    confirmSeen.push(confirmedJob + ':' + ordinal);
    events.push('native.cleanup.review');
    return true;
  });
  events.length = 0;
  const accepted = await native.requestOwnedCleanupReview(ready);
  expect(accepted.cancelled).toBe(false);
  if (accepted.cancelled) throw new Error('Expected a native review receipt');
  expect(accepted.receipt).toMatchObject({
    requestId: ready.requestId, jobId, ordinal: 0,
    status: 'REVIEW_REQUESTED_HARDWARE_PENDING',
    canDelete: false, canDispatch: false,
  });
  expect(confirmSeen).toEqual([jobId + ':0']);
  expect(events).toEqual([
    'stage.cleanupReadiness', 'native.cleanup.review', 'stage.cleanupReviewRecord',
  ]);
  expect(db.getJob(jobId).job).toEqual(ready.jobBefore);
  expect(db.listDeviceStageTransfers(jobId)[0]).toEqual(ready.stageBefore);
  db.close();
  db = new StudioDatabase(filepath());
  expect(db.listOwnedStageCleanupReviewRequests(jobId)).toEqual([accepted.receipt]);
  expect(db.claimDueJob(deviceId, 'no_dispatch_worker', Date.now()).status)
    .toBe('NEEDS_REVIEW');
  expect(events).not.toContain('fake.adb.send');
  expect(events).not.toContain('fake.adb.readback');
  expect(events).not.toContain('fake.adb.mediastore');
});

it('requires native confirmation: cancellation and missing native host produce no journal write', async () => {
  const ready = await cleanupReviewFixture();
  await expect(coordinator().requestOwnedCleanupReview(ready))
    .rejects.toMatchObject({ code: 'NATIVE_DIALOG_REQUIRED' });
  expect(db.listOwnedStageCleanupReviewRequests(jobId)).toHaveLength(0);
  const cancelled = await coordinator('OK', async () => false).requestOwnedCleanupReview(ready);
  expect(cancelled).toEqual({ cancelled: true, receipt: null });
  expect(db.listOwnedStageCleanupReviewRequests(jobId)).toHaveLength(0);
  await expect(dispatch(db, {
    operationId: 'op_cleanup_review_forged', command: 'stage.cleanupReviewRecord' as never,
    input: { ...ready, hostId, confirmed: true, at: Date.now() },
  })).rejects.toThrow();
  expect(db.listOwnedStageCleanupReviewRequests(jobId)).toHaveLength(0);
});

it('revalidates the MANUAL lease after the native prompt and rejects a TOCTOU release', async () => {
  const ready = await cleanupReviewFixture();
  const native = coordinator('OK', async () => {
    db.releaseLease(ready.lease);
    return true;
  });
  await expect(native.requestOwnedCleanupReview(ready))
    .rejects.toMatchObject({ code: 'STALE_LEASE' });
  expect(db.listOwnedStageCleanupReviewRequests(jobId)).toHaveLength(0);
  expect(db.getJob(jobId).job).toEqual(ready.jobBefore);
  expect(db.listDeviceStageTransfers(jobId)[0]).toEqual(ready.stageBefore);
});

it('an abort during the native prompt cannot append a cleanup request', async () => {
  const ready = await cleanupReviewFixture();
  const controller = new AbortController();
  const native = coordinator('OK', async () => {
    controller.abort();
    return true;
  });
  await expect(native.requestOwnedCleanupReview(ready, controller.signal))
    .rejects.toMatchObject({ code: 'CANCELLED' });
  expect(db.listOwnedStageCleanupReviewRequests(jobId)).toHaveLength(0);
  expect(db.getJob(jobId).job).toEqual(ready.jobBefore);
  expect(db.listDeviceStageTransfers(jobId)[0]).toEqual(ready.stageBefore);
});


/** Real SQLite + private host service. The Android adapter/lease source is a fixture. */
function nativeStageService(
  outcome: Parameters<typeof coordinator>[0] = 'NOT_INDEXED',
  ownerHost = hostId,
  beforeLeaseTask?: () => void,
  confirmReview?: (summary: { jobId: string; ordinal: number }) => Promise<boolean>,
) {
  const adapter = coordinator(outcome, confirmReview);
  return new NativeStageReviewService({
    request: async (command, input) =>
      dispatch(db, { operationId: 'op_native_review_fixture', command, input }),
    internal: async <T>(request: InternalRequest) => {
      events.push(request.command);
      return dispatchInternal(db, request) as T;
    },
  }, {
    withManualStageReviewLease: async <T>(
      selectedDevice: string,
      task: (lease: DeviceLease, transport: { serial: string; generation: number }) => Promise<T>,
    ): Promise<T> => {
      events.push('native.manual.actor');
      expect(selectedDevice).toBe(deviceId);
      const lease = db.acquireLease(deviceId, 'native_review_fixture', 'MANUAL',
        Date.now(), 60000);
      try {
        beforeLeaseTask?.();
        return await task(lease, { serial: 'USB_STAGE_FIXTURE', generation: 1 });
      } finally {
        db.releaseLease(lease);
      }
    },
  }, adapter, ownerHost);
}

it('re-observes one expired JOB stage with new MANUAL lease, records evidence, never uploads or dispatches', async () => {
  const f = await fixture();
  const staged = await coordinator().transfer(f);
  sql((conn) => {
    conn.prepare('UPDATE leases SET expires_at=? WHERE device_id=?')
      .run(f.at - 1, deviceId);
    conn.prepare('UPDATE job_claims SET expires_at=? WHERE job_id=?')
      .run(f.at - 1, jobId);
  });
  expect(db.recoverExpiredClaims(deviceId, Date.now()))
    .toEqual({ requeued: [], review: [jobId] });
  const before = db.getJob(jobId).job;
  const stageBefore = db.listDeviceStageTransfers(jobId)[0]!;
  events.length = 0;
  const observed = await nativeStageService('NOT_INDEXED').reobserve(jobId, 0);
  expect(observed).toMatchObject({
    jobId, ordinal: 0,
    scope: 'LIVE_ANDROID_OBSERVATION_NOT_PICKER_VERIFIED',
    classification: 'REMOTE_BYTES_MATCHED', mediaStoreStatus: 'NOT_INDEXED',
    canDelete: false, canDispatch: false,
  });
  expect(Date.parse(observed.completedAt)).not.toBeNaN();
  for (const secret of [
    staged.stageId, f.expectedSnapshotHash, 'USB_STAGE_FIXTURE',
    f.lease.ownerId, stageBefore.remotePath, stageBefore.nonce, stageBefore.expectedHash,
  ]) expect(JSON.stringify(observed)).not.toContain(secret);
  expect(events).toContain('native.manual.actor');
  expect(events).toContain('fake.adb.readback');
  expect(events).toContain('fake.adb.mediastore');
  expect(events).toContain('stage.recordReconciliation');
  expect(events).not.toContain('fake.adb.send');
  expect(db.getJob(jobId).job).toEqual(before);
  expect(db.listDeviceStageTransfers(jobId)[0]).toEqual(stageBefore);
  const projected = db.jobStageReview(jobId);
  expect(projected.observations[0]).toMatchObject({
    classification: 'REMOTE_BYTES_MATCHED', mediaStoreStatus: 'NOT_INDEXED',
    leaseOwnerKind: 'MANUAL',
  });
  sql((conn) => expect(conn.prepare(
    'SELECT owner_id FROM leases WHERE device_id=?',
  ).get(deviceId)?.owner_id).toBeNull());
  await expect(dispatch(db, {
    operationId: 'op_forged_native_reobserve',
    command: 'stage.reobserve' as never, input: { jobId, ordinal: 0 },
  })).rejects.toThrow();
});

it('does not acquire a lease or touch ADB for wrong job state, ordinal or foreign stage host', async () => {
  const f = await fixture();
  await coordinator().transfer(f);
  events.length = 0;
  await expect(nativeStageService().reobserve(jobId, 0)).rejects.toMatchObject({
    code: 'STAGE_REOBSERVE_NOT_REVIEW',
  });
  expect(events).not.toContain('native.manual.actor');
  sql((conn) => {
    conn.prepare('UPDATE leases SET expires_at=? WHERE device_id=?')
      .run(f.at - 1, deviceId);
    conn.prepare('UPDATE job_claims SET expires_at=? WHERE job_id=?')
      .run(f.at - 1, jobId);
  });
  db.recoverExpiredClaims(deviceId, Date.now());
  events.length = 0;
  await expect(nativeStageService().reobserve(jobId, 1)).rejects.toMatchObject({
    code: 'STAGE_REOBSERVE_UNAVAILABLE',
  });
  await expect(nativeStageService().reobserve(jobId, -1)).rejects.toMatchObject({
    code: 'STAGE_REOBSERVE_INVALID',
  });
  await expect(nativeStageService('NOT_INDEXED', 'foreign_host').reobserve(jobId, 0))
    .rejects.toMatchObject({ code: 'STAGE_REOBSERVE_OWNER_MISMATCH' });
  expect(events).not.toContain('native.manual.actor');
  expect(events).not.toContain('fake.adb.readback');
});

it('fails closed on job revision changes or rejected MANUAL ownership before Android readback', async () => {
  const f = await fixture();
  await coordinator().transfer(f);
  sql((conn) => {
    conn.prepare('UPDATE leases SET expires_at=? WHERE device_id=?')
      .run(f.at - 1, deviceId);
    conn.prepare('UPDATE job_claims SET expires_at=? WHERE job_id=?')
      .run(f.at - 1, jobId);
  });
  db.recoverExpiredClaims(deviceId, Date.now());
  events.length = 0;
  const badRevision = nativeStageService('NOT_INDEXED', hostId, () => {
    sql((conn) => conn.prepare('UPDATE jobs SET revision=revision+1 WHERE id=?').run(jobId));
  });
  await expect(badRevision.reobserve(jobId, 0)).rejects.toThrow();
  expect(events).not.toContain('fake.adb.readback');
  sql((conn) => conn.prepare('UPDATE jobs SET revision=revision-1 WHERE id=?').run(jobId));
  const held = db.acquireLease(deviceId, 'other_operator', 'MANUAL', Date.now(), 60000);
  try {
    events.length = 0;
    await expect(nativeStageService().reobserve(jobId, 0)).rejects.toMatchObject({
      code: 'DEVICE_BUSY',
    });
    expect(events).not.toContain('fake.adb.readback');
  } finally {
    db.releaseLease(held);
  }
});

it('records ambiguous or unsupported MediaStore as review evidence, not as picker or deletion proof', async () => {
  const f = await fixture();
  await coordinator().transfer(f);
  sql((conn) => {
    conn.prepare('UPDATE leases SET expires_at=? WHERE device_id=?').run(f.at - 1, deviceId);
    conn.prepare('UPDATE job_claims SET expires_at=? WHERE job_id=?').run(f.at - 1, jobId);
  });
  db.recoverExpiredClaims(deviceId, Date.now());
  const ambiguous = await nativeStageService('AMBIGUOUS').reobserve(jobId, 0);
  expect(ambiguous).toMatchObject({
    classification: 'REVIEW_REQUIRED', mediaStoreStatus: 'AMBIGUOUS',
    canDelete: false, canDispatch: false,
  });
  const unsupported = await nativeStageService('UNSUPPORTED').reobserve(jobId, 0);
  expect(unsupported).toMatchObject({
    classification: 'PROBE_UNSUPPORTED', mediaStoreStatus: 'UNSUPPORTED',
    canDelete: false, canDispatch: false,
  });
  expect(db.getJob(jobId).job.state).toBe('NEEDS_REVIEW');
  expect(db.jobStageReview(jobId).observations).toHaveLength(2);
});


async function nativeCleanupRequestFixture() {
  const f = await fixture();
  const stage = await coordinator().transfer(f);
  // DB cleanup preflight requires the earlier pinned remote-readback receipt.
  await coordinator().verifyRemoteBytes({
    jobId, stageId: stage.stageId, expectedJobRevision: f.expectedJobRevision,
    expectedSnapshotHash: f.expectedSnapshotHash, lease: f.lease,
    transportSerial: f.transportSerial, transportGeneration: f.transportGeneration,
  });
  sql((conn) => {
    conn.prepare('UPDATE leases SET expires_at=? WHERE device_id=?')
      .run(f.at - 1, deviceId);
    conn.prepare('UPDATE job_claims SET expires_at=? WHERE job_id=?')
      .run(f.at - 1, jobId);
  });
  expect(db.recoverExpiredClaims(deviceId, Date.now()))
    .toEqual({ requeued: [], review: [jobId] });
  return { ...f, stageId: stage.stageId };
}

it('native cleanup review uses ONE MANUAL lease for fresh readback, confirmation and immutable record', async () => {
  const f = await nativeCleanupRequestFixture();
  const beforeJob = db.getJob(jobId).job;
  const beforeStage = db.listDeviceStageTransfers(jobId)[0]!;
  const prompts: string[] = [];
  events.length = 0;
  const native = nativeStageService('NOT_INDEXED', hostId, undefined, async (summary) => {
    prompts.push(summary.jobId + ':' + summary.ordinal);
    events.push('native.review.confirm');
    return true;
  });
  const receipt = await native.requestCleanupReview(jobId, 0);
  expect(receipt).toMatchObject({
    jobId, ordinal: 0, scope: 'LIVE_ANDROID_REVIEW_REQUEST_ONLY',
    status: 'REVIEW_REQUEST_RECORDED', classification: 'REMOTE_BYTES_MATCHED',
    mediaStoreStatus: 'NOT_INDEXED', canDelete: false, canDispatch: false,
  });
  expect(receipt.recordedAt).toEqual(expect.any(String));
  expect(prompts).toEqual([jobId + ':0']);
  expect(events.filter((name) => name === 'fake.adb.readback')).toHaveLength(1);
  expect(events.filter((name) => name === 'fake.adb.mediastore')).toHaveLength(1);
  expect(events.filter((name) => name === 'native.manual.actor')).toHaveLength(1);
  expect(events.indexOf('stage.recordReconciliation')).toBeLessThan(
    events.indexOf('native.review.confirm'));
  expect(events.indexOf('native.review.confirm')).toBeLessThan(
    events.indexOf('stage.cleanupReviewRecord'));
  expect(events).not.toContain('fake.adb.send');
  expect(db.getJob(jobId).job).toEqual(beforeJob);
  expect(db.listDeviceStageTransfers(jobId)[0]).toEqual(beforeStage);
  const privateReceipt = db.listOwnedStageCleanupReviewRequests(jobId)[0]!;
  expect(privateReceipt).toMatchObject({
    jobId, ordinal: 0, recordedAt: receipt.recordedAt,
    canDelete: false, canDispatch: false,
  });
  for(const secret of [
    f.stageId, f.expectedSnapshotHash, beforeStage.nonce, beforeStage.remotePath,
    beforeStage.expectedHash, f.lease.ownerId, 'USB_STAGE_FIXTURE',
    privateReceipt.requestId,
  ]) expect(JSON.stringify(receipt)).not.toContain(secret);
  sql((conn) => expect(conn.prepare(
    'SELECT owner_id FROM leases WHERE device_id=?',
  ).get(deviceId)?.owner_id).toBeNull());
  db.close();
  db = new StudioDatabase(filepath());
  expect(db.jobStageReview(jobId).cleanupRequests).toHaveLength(1);
  events.length = 0;
  await expect(nativeStageService('NOT_INDEXED', hostId, undefined, async () => {
    throw new Error('Duplicate native confirmation must never open');
  }).requestCleanupReview(jobId, 0)).rejects.toMatchObject({
    code: 'STAGE_CLEANUP_ALREADY_PENDING',
  });
  expect(events).not.toContain('native.manual.actor');
  expect(events).not.toContain('fake.adb.readback');
  expect(db.claimDueJob(deviceId, 'no_worker_post_request', Date.now()).status)
    .toBe('NEEDS_REVIEW');
  await expect(dispatch(db, {
    operationId: 'op_forged_native_cleanup', command: 'stage.cleanupReviewRecord' as never,
    input: { jobId, ordinal: 0 },
  })).rejects.toThrow();
});

it('native cleanup review cancel still saves the observation but never saves consent', async () => {
  await nativeCleanupRequestFixture();
  const native = nativeStageService('NOT_INDEXED', hostId, undefined, async () => {
    events.push('native.review.cancel');
    return false;
  });
  events.length = 0;
  const result = await native.requestCleanupReview(jobId, 0);
  expect(result).toMatchObject({
    status: 'CANCELLED', recordedAt: null, classification: 'REMOTE_BYTES_MATCHED',
    mediaStoreStatus: 'NOT_INDEXED', canDelete: false, canDispatch: false,
  });
  expect(events).toContain('fake.adb.readback');
  expect(events).toContain('native.review.cancel');
  expect(events).not.toContain('stage.cleanupReviewRecord');
  expect(db.jobStageReview(jobId).observations).toHaveLength(1);
  expect(db.listOwnedStageCleanupReviewRequests(jobId)).toHaveLength(0);
  expect(db.getJob(jobId).job.state).toBe('NEEDS_REVIEW');
});

it('native cleanup review refuses ambiguous/indexed/unsupported proof before prompting or journaling', async () => {
  await nativeCleanupRequestFixture();
  for (const outcome of ['OK', 'AMBIGUOUS', 'UNSUPPORTED'] as const) {
    let confirmed = false;
    events.length = 0;
    await expect(nativeStageService(outcome, hostId, undefined, async () => {
      confirmed = true;
      return true;
    }).requestCleanupReview(jobId, 0)).rejects.toMatchObject({
      code: 'STAGE_CLEANUP_LIVE_EVIDENCE_BLOCKED',
    });
    expect(confirmed).toBe(false);
    expect(events.filter((name) => name === 'fake.adb.readback')).toHaveLength(1);
    expect(events).not.toContain('stage.cleanupReviewRecord');
  }
  expect(db.listOwnedStageCleanupReviewRequests(jobId)).toHaveLength(0);
  expect(db.getJob(jobId).job.state).toBe('NEEDS_REVIEW');
});

it('native cleanup review rejects wrong host, stage, job revision and lost lease', async () => {
  await nativeCleanupRequestFixture();
  events.length = 0;
  await expect(nativeStageService('NOT_INDEXED', 'foreign_host', undefined,
    async () => true).requestCleanupReview(jobId, 0))
    .rejects.toMatchObject({ code: 'STAGE_REOBSERVE_OWNER_MISMATCH' });
  await expect(nativeStageService('NOT_INDEXED', hostId, undefined,
    async () => true).requestCleanupReview(jobId, 1))
    .rejects.toMatchObject({ code: 'STAGE_REOBSERVE_UNAVAILABLE' });
  expect(events).not.toContain('native.manual.actor');
  const badRevision = nativeStageService('NOT_INDEXED', hostId, () => {
    sql((conn) => conn.prepare('UPDATE jobs SET revision=revision+1 WHERE id=?').run(jobId));
  }, async () => true);
  await expect(badRevision.requestCleanupReview(jobId, 0)).rejects.toThrow();
  expect(events).not.toContain('stage.cleanupReviewRecord');
  sql((conn) => conn.prepare('UPDATE jobs SET revision=revision-1 WHERE id=?').run(jobId));
  const losingLease = nativeStageService('NOT_INDEXED', hostId, undefined, async () => {
    // Same actor currently owns the device; supersede/release its lease before consent.
    sql((conn) => conn.prepare(
      'UPDATE leases SET owner_id=NULL,owner_kind=NULL,expires_at=0 WHERE device_id=?',
    ).run(deviceId));
    return true;
  });
  await expect(losingLease.requestCleanupReview(jobId, 0))
    .rejects.toMatchObject({ code: 'STALE_LEASE' });
  expect(db.listOwnedStageCleanupReviewRequests(jobId)).toHaveLength(0);
});

it('retains uncertainty after a simulated mid-send failure and restart', async () => {
  const f = await fixture();
  await expect(coordinator('FAIL').transfer(f)).rejects.toThrow('simulated disconnect');
  expect(db.listDeviceStageTransfers(jobId)[0]?.state).toBe('TRANSFER_UNCERTAIN');
  await expect(coordinator().transfer(f)).rejects.toMatchObject({
    code: 'STAGE_ALREADY_ATTEMPTED',
  });
  db.close();
  db = new StudioDatabase(filepath());
  expect(db.listDeviceStageTransfers(jobId)[0]?.state).toBe('TRANSFER_UNCERTAIN');
  expect(db.recoverExpiredClaims(deviceId, f.at + 240000))
    .toEqual({ requeued: [], review: [jobId] });
  expect(db.getJob(jobId).job.state).toBe('NEEDS_REVIEW');
});

it('blocks forged ACK without recording success and rejects stale transport before intent', async () => {
  const f = await fixture();
  await expect(coordinator('WRONG_ACK').transfer(f)).rejects.toMatchObject({
    code: 'STAGE_SYNC_ACK_MISMATCH',
  });
  expect(db.listDeviceStageTransfers(jobId)[0]?.state).toBe('TRANSFER_UNCERTAIN');
});
it('rejects unauthorized transport before creating remote intent', async () => {
  const f = await fixture();
  sql((conn) => conn.prepare(
    "UPDATE device_transports SET identity_verified=0 WHERE host_id=? AND serial=?",
  ).run(hostId, 'USB_STAGE_FIXTURE'));
  await expect(coordinator().transfer(f)).rejects.toMatchObject({
    code: 'STALE_DEVICE_TRANSPORT',
  });
  expect(db.listDeviceStageTransfers(jobId)).toHaveLength(0);
  expect(events).not.toContain('fake.adb.send');
});
it('does not expose private stage transfer in the public service command registry', async () => {
  const f = await fixture();
  await expect(dispatch(db, {
    operationId: 'op_fake_stage_transfer', command: 'stage.transfer' as never,
    input: f,
  })).rejects.toThrow();
  expect(db.listDeviceStageTransfers(jobId)).toHaveLength(0);
});
