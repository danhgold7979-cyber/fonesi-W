import { randomUUID } from 'node:crypto';
import { idSchema } from '@autoreels/contracts';
import type {
  DeviceLease, DeviceStageTransfer, JobStageReviewPage, NativeStageReviewResult,
  DeviceStageReconciliation,
} from '@autoreels/contracts';
import { DomainError } from '@autoreels/domain';
import type { InternalRequest } from './internal.js';

interface StageReviewDbPort {
  request(command: 'jobStageReview', input: { id: string }): Promise<unknown>;
  internal<T>(request: InternalRequest): Promise<T>;
}
interface StageReviewDevicePort {
  withManualStageReviewLease<T>(
    deviceId: string,
    task: (lease: DeviceLease, transport: { serial: string; generation: number }) => Promise<T>,
  ): Promise<T>;
}
interface StageReviewCoordinatorPort {
  reconcileStage(request: {
    requestId: string; jobId: string; stageId: string; expectedJobRevision: number;
    expectedSnapshotHash: string; lease: DeviceLease; transportSerial: string;
    transportGeneration: number;
  }): Promise<{
    requestId: string; stageId: string;
    classification: DeviceStageReconciliation['classification'];
    mediaStoreStatus: DeviceStageReconciliation['mediaStoreStatus'];
    canDispatch: false;
  }>;
}

/**
 * Native Electron main-only entry point. Untrusted UI chooses only job/ordinal.
 * Every private stage, host, lease, transport, snapshot and audit ID is resolved
 * on trusted host/DB, never returned to renderer or exposed through HTTP.
 */
export class NativeStageReviewService {
  constructor(
    private readonly db: StageReviewDbPort,
    private readonly devices: StageReviewDevicePort,
    private readonly stageCoordinator: StageReviewCoordinatorPort,
    private readonly hostId: string,
  ) {}

  async reobserve(jobId: string, ordinal: number): Promise<NativeStageReviewResult> {
    idSchema.parse(jobId);
    if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= 32)
      throw new DomainError('STAGE_REOBSERVE_INVALID', 'Invalid media ordinal.');
    const summary = await this.db.request('jobStageReview', { id: jobId }) as JobStageReviewPage;
    if (summary.jobId !== jobId || summary.jobState !== 'NEEDS_REVIEW' ||
        summary.canDispatch !== false || summary.scope !== 'PERSISTED_ONLY')
      throw new DomainError('STAGE_REOBSERVE_NOT_REVIEW',
        'Only a persisted NEEDS_REVIEW job can be inspected.');
    const references = summary.stages.filter((item) => item.ordinal === ordinal);
    if (references.length !== 1 ||
        !['TRANSFER_UNCERTAIN', 'SYNC_ACK_UNVERIFIED'].includes(references[0]!.state))
      throw new DomainError('STAGE_REOBSERVE_UNAVAILABLE',
        'No unique uncertain stage exists for this media slot.');
    const privateStages = await this.db.internal<DeviceStageTransfer[]>({
      command: 'stage.list', jobId,
    });
    const candidates = privateStages.filter((item) => item.ordinal === ordinal);
    const owned = candidates[0];
    if (candidates.length !== 1 || !owned ||
        owned.jobId !== jobId || owned.hostId !== this.hostId ||
        owned.state !== references[0]!.state ||
        !['TRANSFER_UNCERTAIN', 'SYNC_ACK_UNVERIFIED'].includes(owned.state))
      throw new DomainError('STAGE_REOBSERVE_OWNER_MISMATCH',
        'The durable stage owner is stale or ambiguous.');

    const receipt = await this.devices.withManualStageReviewLease(owned.deviceId,
      async (lease, transport) => this.stageCoordinator.reconcileStage({
        requestId: 'native_review_' + randomUUID().replaceAll('-', ''),
        jobId, stageId: owned.id,
        expectedJobRevision: summary.jobRevision,
        expectedSnapshotHash: owned.snapshotHash, lease,
        transportSerial: transport.serial, transportGeneration: transport.generation,
      }));
    if (receipt.canDispatch !== false || receipt.stageId !== owned.id)
      throw new DomainError('STAGE_REOBSERVE_RECEIPT_INVALID',
        'Untrusted or mismatched stage evidence.');
    return {
      jobId, ordinal, scope: 'LIVE_ANDROID_OBSERVATION_NOT_PICKER_VERIFIED',
      classification: receipt.classification,
      mediaStoreStatus: receipt.mediaStoreStatus,
      completedAt: new Date().toISOString(),
      canDelete: false, canDispatch: false,
    };
  }
}
