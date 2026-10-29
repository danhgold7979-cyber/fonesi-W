import { randomUUID } from 'node:crypto';
import { idSchema } from '@autoreels/contracts';
import type {
  DeviceLease, DeviceStageTransfer, JobStageReviewPage, NativeStageReviewResult,
  NativeStageCleanupReviewResult, OwnedStageCleanupReviewReceipt,
  DeviceStageReconciliation,
} from '@autoreels/contracts';
import { DomainError } from '@autoreels/domain';
import type { OwnedCleanupReadbackSummary } from '@autoreels/devices';
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
  reviewOwnedCleanupAbsence(request: {
    jobId: string; stageId: string; expectedJobRevision: number;
    expectedSnapshotHash: string; lease: DeviceLease;
    transportSerial: string; transportGeneration: number;
  }): Promise<OwnedCleanupReadbackSummary>;
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
  requestOwnedCleanupReview(request: {
    requestId: string; stageId: string; expectedJobRevision: number;
    expectedSnapshotHash: string; lease: DeviceLease;
  }): Promise<
    | { cancelled: true; receipt: null }
    | { cancelled: false; receipt: OwnedStageCleanupReviewReceipt }
  >;
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

  /** Selection is resolved afresh at every native action; never trust a stage ID from UI. */
  private async selectOwnedStage(jobId: string, ordinal: number): Promise<{
    summary: JobStageReviewPage;
    owned: DeviceStageTransfer;
  }> {
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

    return { summary, owned };
  }

  async reobserve(jobId: string, ordinal: number): Promise<NativeStageReviewResult> {
    const { summary, owned } = await this.selectOwnedStage(jobId, ordinal);
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

  /**
   * Native-only, read-only owned remote existence + MediaStore review.
   * Renderer can never provide a stage ID, ADB serial, nonce or MANUAL lease.
   * Neither source reports independently certified deletion.
   */
  async reviewCleanupAbsence(
    jobId: string, ordinal: number,
  ): Promise<OwnedCleanupReadbackSummary> {
    const { summary, owned } = await this.selectOwnedStage(jobId, ordinal);
    const result = await this.devices.withManualStageReviewLease(owned.deviceId,
      async (lease, transport) => this.stageCoordinator.reviewOwnedCleanupAbsence({
        jobId, stageId: owned.id, expectedJobRevision: summary.jobRevision,
        expectedSnapshotHash: owned.snapshotHash, lease,
        transportSerial: transport.serial,
        transportGeneration: transport.generation,
      }));
    if (result.scope !== 'PRIVATE_OWNED_STAGE_ABSENCE_NOT_DELETE_CERTIFIED' ||
        result.canDelete !== false || result.canMarkClean !== false ||
        result.canRetry !== false || result.canDispatch !== false)
      throw new DomainError('OWNED_CLEANUP_READBACK_RECEIPT_INVALID',
        'A read-only recovery result cannot authorize cleanup actions.');
    return result;
  }

  /**
   * One lease across the fresh readback, native yes/no dialog and transactional
   * journaling. Even confirmed requests never authorize Android unlink.
   */
  async requestCleanupReview(
    jobId: string, ordinal: number,
  ): Promise<NativeStageCleanupReviewResult> {
    const { summary, owned } = await this.selectOwnedStage(jobId, ordinal);
    // Bounded public summary avoids unnecessary ADB and duplicate native prompts;
    // transactional DB preflight remains authoritative for older hidden rows.
    if (summary.cleanupRequests.some((item) => item.stageOrdinal === ordinal))
      throw new DomainError('STAGE_CLEANUP_ALREADY_PENDING',
        'This media already has a hardware-pending cleanup review.');
    return this.devices.withManualStageReviewLease(owned.deviceId,
      async (lease, transport): Promise<NativeStageCleanupReviewResult> => {
        const observed = await this.stageCoordinator.reconcileStage({
          requestId: 'native_cleanup_probe_' + randomUUID().replaceAll('-', ''),
          jobId, stageId: owned.id, expectedJobRevision: summary.jobRevision,
          expectedSnapshotHash: owned.snapshotHash, lease,
          transportSerial: transport.serial, transportGeneration: transport.generation,
        });
        if (observed.canDispatch !== false || observed.stageId !== owned.id)
          throw new DomainError('STAGE_REOBSERVE_RECEIPT_INVALID',
            'A matching read-only stage observation is required.');
        if (observed.classification !== 'REMOTE_BYTES_MATCHED' ||
            observed.mediaStoreStatus !== 'NOT_INDEXED')
          throw new DomainError('STAGE_CLEANUP_LIVE_EVIDENCE_BLOCKED',
            'Remote evidence or MediaStore is ambiguous. No cleanup request recorded.');
        const reviewed = await this.stageCoordinator.requestOwnedCleanupReview({
          requestId: 'native_cleanup_request_' + randomUUID().replaceAll('-', ''),
          stageId: owned.id, expectedJobRevision: summary.jobRevision,
          expectedSnapshotHash: owned.snapshotHash, lease,
        });
        if (reviewed.cancelled) return {
          jobId, ordinal, scope: 'LIVE_ANDROID_REVIEW_REQUEST_ONLY',
          status: 'CANCELLED', classification: observed.classification,
          mediaStoreStatus: observed.mediaStoreStatus, recordedAt: null,
          canDelete: false, canDispatch: false,
        };
        if (reviewed.receipt.jobId !== jobId ||
            reviewed.receipt.ordinal !== ordinal ||
            reviewed.receipt.canDelete !== false ||
            reviewed.receipt.canDispatch !== false ||
            reviewed.receipt.status !== 'REVIEW_REQUESTED_HARDWARE_PENDING')
          throw new DomainError('STAGE_CLEANUP_REVIEW_RECEIPT_INVALID',
            'The host returned an invalid non-executable review record.');
        return {
          jobId, ordinal, scope: 'LIVE_ANDROID_REVIEW_REQUEST_ONLY',
          status: 'REVIEW_REQUEST_RECORDED',
          classification: observed.classification,
          mediaStoreStatus: observed.mediaStoreStatus,
          recordedAt: reviewed.receipt.recordedAt,
          canDelete: false, canDispatch: false,
        };
      });
  }
}
