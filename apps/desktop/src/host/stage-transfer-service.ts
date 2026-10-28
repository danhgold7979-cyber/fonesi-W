import { extname, join, resolve } from 'node:path';
import { idSchema, hashSchema } from '@autoreels/contracts';
import type {
  DeviceLease, DeviceRecord, DeviceStageTransfer, DeviceStageReconciliation, JobMediaPreflightPlan,
} from '@autoreels/contracts';
import type { OwnedSyncInput, OwnedSyncAck } from '@autoreels/devices';
import type { HostStageResult } from '@autoreels/media';
import { DomainError } from '@autoreels/domain';
import type { InternalRequest } from './internal.js';

export interface ClaimedStageRequest {
  jobId: string;
  ordinal: number;
  expectedJobRevision: number;
  expectedSnapshotHash: string;
  lease: DeviceLease;
  transportSerial: string;
  transportGeneration: number;
}
export interface ClaimedStageResult {
  jobId: string;
  stageId: string;
  ordinal: number;
  status: 'SYNC_ACK_UNVERIFIED';
  /** A transport ACK never certifies MediaStore or a publish result. */
  canDispatch: false;
}
interface StageDbPort {
  internal<T>(request: InternalRequest): Promise<T>;
}
interface StageMediaPort {
  stageJobHostMedia(jobId: string): Promise<HostStageResult>;
}
interface SyncSender {
  sendOwnedStage(input: OwnedSyncInput, signal?: AbortSignal): Promise<OwnedSyncAck>;
  probeOwnedStageMediaStore?(input: { serial: string; jobId: string; ordinal: number; nonce: string; extension: string; expectedBytes: number }, signal?: AbortSignal): Promise<{ status: 'INDEXED_EXACT'; rowId: string; displayName: string; relativePath: string; mimeType: string; bytes: number } | { status: 'NOT_INDEXED' | 'AMBIGUOUS' | 'UNSUPPORTED' }>;
  readOwnedStage(input: {
    serial: string; jobId: string; ordinal: number; nonce: string; extension: string;
    expectedHash: string; expectedBytes: number;
  }, signal?: AbortSignal): Promise<{ remotePath: string; hash: string; bytes: number }>;
}
interface SyncFactory {
  scoped(fence: () => Promise<void>): SyncSender;
}
/**
 * Strictly private host bridge. Call ONLY after a trusted physical-device JOB
 * claim and preflight. No public method invokes this class automatically.
 */
export class HostStageTransferService {
  constructor(
    private readonly db: StageDbPort,
    private readonly media: StageMediaPort,
    private readonly hostId: string,
    private readonly appDataDirectory: string,
    private readonly adapter: () => SyncFactory,
  ) {}

  /**
   * Explicit private verification step. A successful receipt proves byte
   * equality at the generated remote path, not Android MediaStore indexing.
   */

  /** Fresh read-only reconciliation. Never retries upload, deletes files, or dispatches. */
  async reconcileStage(request: {
    requestId: string; jobId: string; stageId: string; expectedJobRevision: number;
    expectedSnapshotHash: string; lease: DeviceLease; transportSerial: string; transportGeneration: number;
  }, signal?: AbortSignal): Promise<{
    requestId: string; stageId: string;
    classification: import('@autoreels/contracts').StageReconciliationClassification;
    mediaStoreStatus: DeviceStageReconciliation['mediaStoreStatus']; canDispatch: false;
  }> {
    idSchema.parse(request.requestId); idSchema.parse(request.jobId); idSchema.parse(request.stageId);
    hashSchema.parse(request.expectedSnapshotHash);
    if (request.lease.ownerKind !== 'JOB' || !request.lease.deviceId ||
        !Number.isSafeInteger(request.expectedJobRevision) || request.expectedJobRevision < 0 ||
        !Number.isSafeInteger(request.transportGeneration) || request.transportGeneration < 1 ||
        !/^[A-Za-z0-9][A-Za-z0-9_.:[\\]-]{0,199}$/.test(request.transportSerial) || signal?.aborted)
      throw new DomainError('STAGE_RECONCILE_REQUEST_INVALID', 'Invalid trusted reconciliation request.');
    const fence = async (): Promise<void> => {
      if (signal?.aborted) throw new DomainError('CANCELLED', 'Stage reconciliation cancelled.');
      await this.db.internal({ command: 'lease.assert', lease: request.lease, at: Date.now() });
      await this.db.internal({ command: 'device.assertTransport', hostId: this.hostId,
        deviceId: request.lease.deviceId, serial: request.transportSerial, generation: request.transportGeneration });
      const records = await this.db.internal<DeviceRecord[]>({ command: 'device.records', hostId: this.hostId });
      const device = records.find((item) => item.id === request.lease.deviceId);
      const transport = device?.transports.find((item) => item.serial === request.transportSerial &&
        item.generation === request.transportGeneration && item.state === 'CONNECTED' && item.identityVerified);
      const seenAt = transport ? Date.parse(transport.lastSeen) : NaN;
      if (!device?.enabled || device.identity !== 'VERIFIED_PROPERTIES' || !transport ||
          !Number.isFinite(seenAt) || Date.now() < seenAt || Date.now() - seenAt > 30000)
        throw new DomainError('STAGE_TRANSPORT_STALE', 'Trusted transport observation is stale.');
    };
    const rows = await this.db.internal<DeviceStageTransfer[]>({ command: 'stage.list', jobId: request.jobId });
    const stage = rows.find((item) => item.id === request.stageId);
    if (!stage || stage.hostId !== this.hostId || stage.deviceId !== request.lease.deviceId ||
        stage.claimGeneration !== request.lease.generation || stage.snapshotHash !== request.expectedSnapshotHash ||
        !['TRANSFER_UNCERTAIN', 'SYNC_ACK_UNVERIFIED'].includes(stage.state))
      throw new DomainError('STAGE_RECONCILE_NOT_ELIGIBLE', 'Stage identity or state requires operator review.');
    const plan = await this.db.internal<JobMediaPreflightPlan>({
      command: 'job.mediaPlan', jobId: request.jobId, hostId: this.hostId,
    });
    const asset = plan.entries[stage.ordinal];
    if (!asset || plan.jobRevision !== request.expectedJobRevision || plan.snapshotHash !== request.expectedSnapshotHash ||
        asset.assetId !== stage.assetId || asset.pinnedHash !== stage.expectedHash || asset.pinnedBytes !== stage.expectedBytes)
      throw new DomainError('STAGE_SNAPSHOT_STALE', 'Pinned asset or job snapshot changed.');
    const extension = extname(asset.binding.relativePath).toLowerCase();
    if (!/^\\.(?:mp4|mov|mkv|webm|m4v|avi|jpg|jpeg|png|webp|gif|bmp)$/.test(extension))
      throw new DomainError('STAGE_EXTENSION_INVALID', 'Pinned media format is unsupported.');
    let classification: import('@autoreels/contracts').StageReconciliationClassification = 'REVIEW_REQUIRED';
    let observedHash: string | null = null, observedBytes: number | null = null;
    let mediaStoreStatus: DeviceStageReconciliation['mediaStoreStatus'] = null;
    const adapter = this.adapter().scoped(fence);
    await fence();
    try {
      const remote = await adapter.readOwnedStage({
        serial: request.transportSerial, jobId: stage.jobId, ordinal: stage.ordinal,
        nonce: stage.nonce, extension, expectedHash: stage.expectedHash, expectedBytes: stage.expectedBytes,
      }, signal);
      observedHash = remote.hash; observedBytes = remote.bytes;
      if (remote.remotePath !== stage.remotePath || remote.hash !== stage.expectedHash || remote.bytes !== stage.expectedBytes) {
        classification = 'REMOTE_MISMATCH';
      } else if (!adapter.probeOwnedStageMediaStore) {
        classification = 'PROBE_UNSUPPORTED'; mediaStoreStatus = 'UNSUPPORTED';
      } else {
        const probe = await adapter.probeOwnedStageMediaStore({
          serial: request.transportSerial, jobId: stage.jobId, ordinal: stage.ordinal,
          nonce: stage.nonce, extension, expectedBytes: stage.expectedBytes,
        }, signal);
        mediaStoreStatus = probe.status;
        classification = probe.status === 'INDEXED_EXACT' ? 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED'
          : probe.status === 'NOT_INDEXED' ? 'REMOTE_BYTES_MATCHED' : 'PROBE_UNSUPPORTED';
      }
    } catch (error) {
      if (error instanceof DomainError && ['ADB_SYNC_READ_HASH', 'ADB_SYNC_READ_LENGTH'].includes(error.code))
        classification = 'REMOTE_MISMATCH';
      else if (error instanceof DomainError && error.code === 'ADB_SYNC_READ_FAILED')
        classification = 'REMOTE_MISSING';
      else if (error instanceof DomainError && error.code === 'ADB_COMMAND_FAILED') {
        classification = 'PROBE_UNSUPPORTED'; mediaStoreStatus = 'UNSUPPORTED';
      } else throw error;
    }
    await fence();
    const recorded = await this.db.internal<DeviceStageReconciliation>({
      command: 'stage.recordReconciliation', requestId: request.requestId, stageId: stage.id,
      lease: request.lease, expectedJobRevision: request.expectedJobRevision,
      classification, observedHash, observedBytes, mediaStoreStatus, at: Date.now(),
    });
    if (recorded.classification !== classification)
      throw new DomainError('STAGE_RECONCILE_NOT_STORED', 'Reconciliation evidence was not persisted.');
    return { requestId: request.requestId, stageId: stage.id, classification, mediaStoreStatus, canDispatch: false };
  }

  async verifyMediaStoreRow(request: {
    jobId: string; stageId: string; expectedJobRevision: number; expectedSnapshotHash: string;
    lease: DeviceLease; transportSerial: string; transportGeneration: number;
  }, signal?: AbortSignal): Promise<{
    jobId: string; stageId: string; scope: 'MEDIASTORE_ROW_ONLY';
    status: 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED' | 'NOT_INDEXED' | 'AMBIGUOUS' | 'UNSUPPORTED';
    canDispatch: false;
  }> {
    idSchema.parse(request.jobId);
    idSchema.parse(request.stageId);
    hashSchema.parse(request.expectedSnapshotHash);
    if (request.lease.ownerKind !== 'JOB' || !request.lease.deviceId ||
        !Number.isSafeInteger(request.expectedJobRevision) || request.expectedJobRevision < 0 ||
        !Number.isSafeInteger(request.transportGeneration) || request.transportGeneration < 1 ||
        !/^[A-Za-z0-9][A-Za-z0-9_.:[\]-]{0,199}$/.test(request.transportSerial) || signal?.aborted)
      throw new DomainError('STAGE_MEDIASTORE_REQUEST_INVALID', 'Invalid trusted MediaStore probe request.');
    const fence = async (): Promise<void> => {
      if (signal?.aborted) throw new DomainError('CANCELLED', 'MediaStore probe cancelled.');
      await this.db.internal({ command: 'lease.assert', lease: request.lease, at: Date.now() });
      await this.db.internal({ command: 'device.assertTransport', hostId: this.hostId,
        deviceId: request.lease.deviceId, serial: request.transportSerial, generation: request.transportGeneration });
      const records = await this.db.internal<DeviceRecord[]>({ command: 'device.records', hostId: this.hostId });
      const device = records.find((item) => item.id === request.lease.deviceId);
      const transport = device?.transports.find((item) => item.serial === request.transportSerial &&
        item.generation === request.transportGeneration && item.state === 'CONNECTED' && item.identityVerified);
      const seenAt = transport ? Date.parse(transport.lastSeen) : NaN;
      if (!device?.enabled || device.identity !== 'VERIFIED_PROPERTIES' || !transport ||
          !Number.isFinite(seenAt) || Date.now() < seenAt || Date.now() - seenAt > 30000)
        throw new DomainError('STAGE_TRANSPORT_STALE', 'Trusted transport observation is stale.');
    };
    const stages = await this.db.internal<DeviceStageTransfer[]>({ command: 'stage.list', jobId: request.jobId });
    const stage = stages.find((item) => item.id === request.stageId);
    if (!stage || stage.jobId !== request.jobId || stage.hostId !== this.hostId ||
        stage.deviceId !== request.lease.deviceId || stage.claimGeneration !== request.lease.generation ||
        stage.snapshotHash !== request.expectedSnapshotHash || stage.state !== 'SYNC_ACK_UNVERIFIED' ||
        stage.remoteReadbackHash !== stage.expectedHash || stage.remoteReadbackBytes !== stage.expectedBytes)
      throw new DomainError('STAGE_MEDIASTORE_NOT_ELIGIBLE', 'Matching remote byte evidence is required.');
    if (stage.mediaStoreRowId !== null || stage.mediaStoreAt !== null)
      throw new DomainError('STAGE_MEDIASTORE_ALREADY_RECORDED', 'MediaStore evidence already exists.');
    const plan = await this.db.internal<JobMediaPreflightPlan>({
      command: 'job.mediaPlan', jobId: request.jobId, hostId: this.hostId,
    });
    const asset = plan.entries[stage.ordinal];
    if (!asset || plan.jobRevision !== request.expectedJobRevision ||
        plan.snapshotHash !== request.expectedSnapshotHash || asset.assetId !== stage.assetId ||
        asset.pinnedHash !== stage.expectedHash || asset.pinnedBytes !== stage.expectedBytes)
      throw new DomainError('STAGE_SNAPSHOT_STALE', 'Pinned media or job snapshot changed.');
    const extension = extname(asset.binding.relativePath).toLowerCase();
    if (!/^\.(?:mp4|mov|mkv|webm|m4v|avi|jpg|jpeg|png|webp|gif|bmp)$/.test(extension))
      throw new DomainError('STAGE_EXTENSION_INVALID', 'Pinned media format is unsupported.');
    const adapter = this.adapter().scoped(fence);
    if (!adapter.probeOwnedStageMediaStore) return {
      jobId: stage.jobId, stageId: stage.id, scope: 'MEDIASTORE_ROW_ONLY',
      status: 'UNSUPPORTED', canDispatch: false,
    };
    await fence();
    const result = await adapter.probeOwnedStageMediaStore({
      serial: request.transportSerial, jobId: stage.jobId, ordinal: stage.ordinal,
      nonce: stage.nonce, extension, expectedBytes: stage.expectedBytes,
    }, signal);
    await fence();
    if (result.status !== 'INDEXED_EXACT') return {
      jobId: stage.jobId, stageId: stage.id, scope: 'MEDIASTORE_ROW_ONLY',
      status: result.status, canDispatch: false,
    };
    const recorded = await this.db.internal<DeviceStageTransfer>({
      command: 'stage.recordMediaStore', stageId: stage.id, lease: request.lease,
      expectedJobRevision: request.expectedJobRevision, rowId: result.rowId,
      displayName: result.displayName, relativePath: result.relativePath,
      mimeType: result.mimeType, observedBytes: result.bytes, at: Date.now(),
    });
    if (recorded.mediaStoreRowId !== result.rowId || recorded.mediaStoreAt === null)
      throw new DomainError('STAGE_MEDIASTORE_NOT_STORED', 'MediaStore row evidence was not persisted.');
    return {
      jobId: stage.jobId, stageId: stage.id, scope: 'MEDIASTORE_ROW_ONLY',
      status: 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED', canDispatch: false,
    };
  }

  async verifyRemoteBytes(request: {
    jobId: string;
    stageId: string;
    expectedJobRevision: number;
    expectedSnapshotHash: string;
    lease: DeviceLease;
    transportSerial: string;
    transportGeneration: number;
  }, signal?: AbortSignal): Promise<{
    jobId: string; stageId: string; ordinal: number;
    scope: 'REMOTE_BYTES_ONLY'; status: 'REMOTE_BYTES_MATCHED'; canDispatch: false;
  }> {
    idSchema.parse(request.jobId);
    idSchema.parse(request.stageId);
    idSchema.parse(this.hostId);
    hashSchema.parse(request.expectedSnapshotHash);
    if (request.lease.ownerKind !== 'JOB' ||
        !Number.isSafeInteger(request.expectedJobRevision) || request.expectedJobRevision < 0 ||
        !Number.isSafeInteger(request.transportGeneration) || request.transportGeneration < 1 ||
        !/^[A-Za-z0-9][A-Za-z0-9_.:[\]-]{0,199}$/.test(request.transportSerial) ||
        signal?.aborted)
      throw new DomainError('STAGE_READBACK_REQUEST_INVALID', 'Invalid trusted readback request.');

    const fence = async (): Promise<void> => {
      if (signal?.aborted) throw new DomainError('CANCELLED', 'Remote readback cancelled.');
      await this.db.internal({
        command: 'lease.assert', lease: request.lease, at: Date.now(),
      });
      await this.db.internal({
        command: 'device.assertTransport', hostId: this.hostId,
        deviceId: request.lease.deviceId, serial: request.transportSerial,
        generation: request.transportGeneration,
      });
      const records = await this.db.internal<DeviceRecord[]>({
        command: 'device.records', hostId: this.hostId,
      });
      const device = records.find((record) => record.id === request.lease.deviceId);
      const transport = device?.transports.find((item) =>
        item.serial === request.transportSerial &&
        item.generation === request.transportGeneration &&
        item.state === 'CONNECTED' && item.identityVerified);
      const seenAt = transport ? Date.parse(transport.lastSeen) : NaN;
      if (!device?.enabled || device.identity !== 'VERIFIED_PROPERTIES' ||
          !transport || !Number.isFinite(seenAt) || Date.now() < seenAt ||
          Date.now() - seenAt > 30000)
        throw new DomainError('STAGE_TRANSPORT_STALE', 'Trusted transport observation is stale.');
    };

    const stages = await this.db.internal<DeviceStageTransfer[]>({
      command: 'stage.list', jobId: request.jobId,
    });
    const stage = stages.find((item) => item.id === request.stageId);
    if (!stage || stage.jobId !== request.jobId || stage.hostId !== this.hostId ||
        stage.deviceId !== request.lease.deviceId ||
        stage.claimGeneration !== request.lease.generation ||
        stage.snapshotHash !== request.expectedSnapshotHash ||
        stage.state !== 'SYNC_ACK_UNVERIFIED')
      throw new DomainError('STAGE_READBACK_NOT_ELIGIBLE', 'Stage ownership/state does not permit readback.');
    if (stage.remoteReadbackHash !== null || stage.remoteReadbackBytes !== null ||
        stage.remoteReadbackAt !== null)
      throw new DomainError('STAGE_READBACK_ALREADY_RECORDED', 'Readback evidence already exists.');

    const plan = await this.db.internal<JobMediaPreflightPlan>({
      command: 'job.mediaPlan', jobId: request.jobId, hostId: this.hostId,
    });
    const asset = plan.entries[stage.ordinal];
    if (!asset || plan.jobRevision !== request.expectedJobRevision ||
        plan.snapshotHash !== request.expectedSnapshotHash ||
        asset.assetId !== stage.assetId || asset.pinnedHash !== stage.expectedHash ||
        asset.pinnedBytes !== stage.expectedBytes)
      throw new DomainError('STAGE_SNAPSHOT_STALE', 'Pinned asset or job snapshot changed.');
    const extension = extname(asset.binding.relativePath).toLowerCase();
    if (!/^\.(?:mp4|mov|mkv|webm|m4v|avi|jpg|jpeg|png|webp|gif|bmp)$/.test(extension))
      throw new DomainError('STAGE_EXTENSION_INVALID', 'Pinned media format is unsupported.');

    await fence();
    const readback = await this.adapter().scoped(fence).readOwnedStage({
      serial: request.transportSerial, jobId: stage.jobId, ordinal: stage.ordinal,
      nonce: stage.nonce, extension, expectedHash: stage.expectedHash,
      expectedBytes: stage.expectedBytes,
    }, signal);
    if (readback.remotePath !== stage.remotePath ||
        readback.hash !== stage.expectedHash || readback.bytes !== stage.expectedBytes)
      throw new DomainError('STAGE_READBACK_MISMATCH', 'Remote bytes do not match the durable stage intent.');
    await fence();
    const recorded = await this.db.internal<DeviceStageTransfer>({
      command: 'stage.verifyRemoteBytes', stageId: stage.id, lease: request.lease,
      expectedJobRevision: request.expectedJobRevision,
      observedHash: readback.hash, observedBytes: readback.bytes, at: Date.now(),
    });
    if (recorded.remoteReadbackHash !== stage.expectedHash ||
        recorded.remoteReadbackBytes !== stage.expectedBytes ||
        recorded.remoteReadbackAt === null)
      throw new DomainError('STAGE_READBACK_NOT_STORED', 'Readback evidence was not durably recorded.');
    return {
      jobId: stage.jobId, stageId: stage.id, ordinal: stage.ordinal,
      scope: 'REMOTE_BYTES_ONLY', status: 'REMOTE_BYTES_MATCHED', canDispatch: false,
    };
  }

  async transfer(request: ClaimedStageRequest, signal?: AbortSignal): Promise<ClaimedStageResult> {
    idSchema.parse(request.jobId);
    idSchema.parse(this.hostId);
    hashSchema.parse(request.expectedSnapshotHash);
    if (
      request.lease.ownerKind !== 'JOB' ||
      !Number.isSafeInteger(request.expectedJobRevision) ||
      request.expectedJobRevision < 0 ||
      !Number.isSafeInteger(request.ordinal) ||
      request.ordinal < 0 || request.ordinal >= 32 ||
      !Number.isSafeInteger(request.transportGeneration) ||
      request.transportGeneration < 1 ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:[\]-]{0,199}$/.test(request.transportSerial) ||
      signal?.aborted
    ) throw new DomainError('STAGE_REQUEST_INVALID', 'Invalid trusted JOB stage request.');
    if (request.lease.deviceId.length === 0)
      throw new DomainError('STAGE_REQUEST_INVALID', 'Device binding is required.');

    const fenceTransport = async (): Promise<void> => {
      if (signal?.aborted)
        throw new DomainError('CANCELLED', 'Staging was cancelled.');
      await this.db.internal({
        command: 'lease.assert', lease: request.lease, at: Date.now(),
      });
      await this.db.internal({
        command: 'device.assertTransport', hostId: this.hostId,
        deviceId: request.lease.deviceId,
        serial: request.transportSerial, generation: request.transportGeneration,
      });
      const devices = await this.db.internal<DeviceRecord[]>({
        command: 'device.records', hostId: this.hostId,
      });
      const record = devices.find((d) => d.id === request.lease.deviceId);
      const observed = record?.transports.find(
        (t) => t.serial === request.transportSerial &&
          t.generation === request.transportGeneration &&
          t.state === 'CONNECTED' && t.identityVerified,
      );
      const observedAt = observed ? Date.parse(observed.lastSeen) : NaN;
      if (!record?.enabled || record.identity !== 'VERIFIED_PROPERTIES' ||
          !observed || !Number.isFinite(observedAt) ||
          Date.now() < observedAt || Date.now() - observedAt > 30000)
        throw new DomainError('STAGE_TRANSPORT_STALE', 'Trusted transport observation is stale.');
    };

    // Existing uncertain intents always require review; NEVER create another
    // nonce/path or re-send a remote file with unknown previous outcome.
    if ((await this.db.internal<DeviceStageTransfer[]>({
      command: 'stage.list', jobId: request.jobId,
    })).length)
      throw new DomainError('STAGE_ALREADY_ATTEMPTED', 'Remote staging needs reconciliation.');

    // This may copy bytes locally, but sends no Android input.
    const local = await this.media.stageJobHostMedia(request.jobId);
    if (local.status === 'NO_MEDIA' || local.mediaCount <= request.ordinal)
      throw new DomainError('STAGE_ASSET_INVALID', 'No owned host-stage asset at ordinal.');
    const plan = await this.db.internal<JobMediaPreflightPlan>({
      command: 'job.mediaPlan', jobId: request.jobId, hostId: this.hostId,
    });
    const asset = plan.entries[request.ordinal];
    if (!asset || plan.snapshotHash !== request.expectedSnapshotHash ||
        plan.jobRevision !== request.expectedJobRevision ||
        local.mediaCount !== plan.entries.length)
      throw new DomainError('STAGE_SNAPSHOT_STALE', 'Host stage or immutable job changed.');
    const extension = extname(asset.binding.relativePath).toLowerCase();
    if (!/^\.(?:mp4|mov|mkv|webm|m4v|avi|jpg|jpeg|png|webp|gif|bmp)$/.test(extension))
      throw new DomainError('STAGE_EXTENSION_INVALID', 'Pinned media format is unsupported.');
    await fenceTransport();
    const stage = await this.db.internal<DeviceStageTransfer>({
      command: 'stage.prepare', jobId: request.jobId, hostId: this.hostId,
      ordinal: request.ordinal, expectedJobRevision: request.expectedJobRevision,
      expectedSnapshotHash: request.expectedSnapshotHash,
      lease: request.lease, at: Date.now(),
    });
    if (stage.deviceId !== request.lease.deviceId ||
        stage.jobId !== request.jobId ||
        stage.ordinal !== request.ordinal ||
        stage.assetId !== asset.assetId ||
        stage.expectedHash !== asset.pinnedHash ||
        stage.expectedBytes !== asset.pinnedBytes ||
        stage.snapshotHash !== request.expectedSnapshotHash ||
        stage.claimGeneration !== request.lease.generation ||
        stage.hostId !== this.hostId || stage.state !== 'INTENT')
      throw new DomainError('STAGE_INTENT_MISMATCH', 'Durable stage intent differs from job plan.');

    // From this instant the remote upload could have happened: any exception
    // must leave the SQLite state uncertain, and there is no blind retry.
    await this.db.internal<DeviceStageTransfer>({
      command: 'stage.beginAttempt', stageId: stage.id,
      lease: request.lease,
      expectedJobRevision: request.expectedJobRevision, at: Date.now(),
    });
    const fenceAttempt = async (): Promise<void> => {
      await fenceTransport();
      await this.db.internal({
        command: 'stage.assertClaim', stageId: stage.id,
        lease: request.lease,
        expectedJobRevision: request.expectedJobRevision, at: Date.now(),
      });
    };
    await fenceAttempt();
    const localPath = resolve(this.appDataDirectory, 'owned-media-stage',
      'job-' + stage.jobId, 'asset-' + String(stage.ordinal).padStart(3, '0') + extension);
    if (localPath !== join(resolve(this.appDataDirectory), 'owned-media-stage',
      'job-' + stage.jobId, 'asset-' + String(stage.ordinal).padStart(3, '0') + extension))
      throw new DomainError('STAGE_LOCAL_PATH', 'Owned stage path is invalid.');
    const receipt = await this.adapter().scoped(fenceAttempt).sendOwnedStage({
      serial: request.transportSerial,
      localPath, jobId: stage.jobId, ordinal: stage.ordinal,
      nonce: stage.nonce,
      expectedHash: stage.expectedHash, expectedBytes: stage.expectedBytes,
    }, signal);
    if (receipt.status !== 'SYNC_ACK_UNVERIFIED' ||
        receipt.remotePath !== stage.remotePath ||
        receipt.bytes !== stage.expectedBytes ||
        receipt.canDispatch !== false)
      throw new DomainError('STAGE_SYNC_ACK_MISMATCH', 'ADB Sync ACK does not match durable intent.');
    await fenceAttempt();
    const accepted = await this.db.internal<DeviceStageTransfer>({
      command: 'stage.syncAck', stageId: stage.id, lease: request.lease,
      expectedJobRevision: request.expectedJobRevision, at: Date.now(),
    });
    if (accepted.state !== 'SYNC_ACK_UNVERIFIED')
      throw new DomainError('STAGE_ACK_NOT_STORED', 'ADB ACK is not durably recorded.');
    return {
      jobId: request.jobId, stageId: stage.id,
      ordinal: stage.ordinal, status: 'SYNC_ACK_UNVERIFIED', canDispatch: false,
    };
  }
}
