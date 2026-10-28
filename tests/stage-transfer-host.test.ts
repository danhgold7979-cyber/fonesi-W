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
  }));
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
