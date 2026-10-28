import type {
  ScannedAsset,
  MediaAssetBinding,
  SourceGrant,
  DeviceLease,
  TransportObservation,
} from '@autoreels/contracts';
import type { StudioDatabase } from '@autoreels/database';
/** This union is never exported through preload, HTTP or the public service dispatcher. */
export type InternalRequest =
  | { command: 'workspace.status' }
  | { command: 'workspace.backup'; path: string }
  | { command: 'workspace.validateBackup'; path: string }
  | { command: 'asset.binding'; processId: string; assetId: string; hostId: string }
  | { command: 'job.mediaPlan'; jobId: string; hostId: string }
  | {
      command: 'stage.prepare';
      jobId: string;
      hostId: string;
      ordinal: number;
      expectedJobRevision: number;
      expectedSnapshotHash: string;
      lease: DeviceLease;
      at: number;
    }
  | {
      command: 'stage.beginAttempt' | 'stage.syncAck';
      stageId: string;
      lease: DeviceLease;
      expectedJobRevision: number;
      at: number;
    }
  | {
      command: 'stage.verifyRemoteBytes';
      stageId: string;
      lease: DeviceLease;
      expectedJobRevision: number;
      observedHash: string;
      observedBytes: number;
      at: number;
    }
  | { command: 'stage.recordMediaStore'; stageId: string; lease: DeviceLease; expectedJobRevision: number; rowId: string; displayName: string; relativePath: string; mimeType: string; observedBytes: number; at: number }
  | { command: 'stage.recordReconciliation'; requestId: string; stageId: string; lease: DeviceLease; expectedJobRevision: number; classification: import('@autoreels/contracts').StageReconciliationClassification; observedHash: string | null; observedBytes: number | null; mediaStoreStatus: import('@autoreels/contracts').DeviceStageReconciliation['mediaStoreStatus']; at: number }
  | { command: 'stage.list'; jobId: string }
  | {
      command: 'stage.assertClaim';
      stageId: string;
      expectedJobRevision: number;
      lease: DeviceLease;
      at: number;
    }
  | { command: 'asset.adoptPreview'; binding: MediaAssetBinding; scanned: ScannedAsset }
  | { command: 'asset.adoptPlan'; token: string; hostId: string }
  | { command: 'asset.adoptApply'; token: string; hostId: string; scanned: ScannedAsset }
  | { command: 'endpoint.list'; hostId: string }
  | {
      command: 'endpoint.set';
      hostId: string;
      endpoint: string;
      desired: boolean;
      expectedRevision?: number;
    }
  | {
      command: 'endpoint.attempt';
      hostId: string;
      endpoint: string;
      resolvedSerial: string | null;
      errorCode: string | null;
      at: number;
    }
  | { command: 'device.invalidate'; hostId: string; deviceId?: string }
  | {
      command: 'device.reconcile';
      hostId: string;
      observations: TransportObservation[];
      at: string;
    }
  | { command: 'device.records'; hostId: string }
  | { command: 'device.resolutionHistory'; deviceId: string; limit: number; cursor: string | null }
  | { command: 'device.conflictReadiness'; hostId: string; deviceId: string; at: number }
  | {
      command: 'device.resolutionPreview';
      hostId: string;
      deviceId: string;
      expectedRevision: number;
      observation: TransportObservation;
      at: number;
    }
  | {
      command: 'device.resolutionApply';
      hostId: string;
      deviceId: string;
      token: string;
      confirmedName: string;
      observation: TransportObservation;
      at: number;
    }
  | {
      command: 'device.update';
      id: string;
      expectedRevision: number;
      patch: { name?: string; enabled?: boolean };
    }
  | {
      command: 'device.assertTransport';
      hostId: string;
      deviceId: string;
      serial: string;
      generation: number;
    }
  | {
      command: 'lease.acquire';
      deviceId: string;
      ownerId: string;
      kind: DeviceLease['ownerKind'];
      at: number;
      ttl: number;
    }
  | { command: 'lease.assert'; lease: DeviceLease; at: number }
  | { command: 'lease.release'; lease: DeviceLease }
  | { command: 'queue.claim'; deviceId: string; ownerId: string; at: number; ttl: number }
  | { command: 'queue.renew'; jobId: string; lease: DeviceLease; at: number; ttl: number }
  | { command: 'queue.recover'; deviceId: string; at: number }
  | { command: 'queue.reconcileSleep'; suspendedAt: number; resumedAt: number }
  | {
      command: 'effect.prepareClaimed';
      jobId: string;
      expectedJobRevision: number;
      expectedSnapshotHash: string;
      nodeId: string;
      kind: 'PUBLISH' | 'COMMENT';
      effectKey: string;
      payloadHash: string;
      lease: DeviceLease;
      at: number;
    }
  | {
      command: 'effect.beginClaimedAttempt';
      effectId: string;
      expectedJobRevision: number;
      lease: DeviceLease;
      at: number;
    }
  | {
      command: 'source.register';
      processId: string;
      expectedRevision: number;
      grants: Omit<SourceGrant, 'id' | 'revision' | 'active'>[];
    }
  | { command: 'source.grant'; id: string; hostId: string }
  | { command: 'source.binding'; id: string }
  | {
      command: 'source.rebind';
      id: string;
      hostId: string;
      expectedRevision: number;
      rootPath: string;
    }
  | { command: 'source.active'; hostId: string }
  | { command: 'source.list'; processId: string; hostId: string }
  | { command: 'source.apply'; grant: SourceGrant; generation: string; asset: ScannedAsset }
  | { command: 'source.finish'; grant: SourceGrant; generation: string }
  | {
      command: 'source.options';
      id: string;
      hostId: string;
      expectedRevision: number;
      options: { recursive: boolean; watch: boolean; active: boolean };
    };
export function dispatchInternal(db: StudioDatabase, request: InternalRequest): unknown {
  switch (request.command) {
    case 'workspace.status':
      return db.workspaceStatus();
    case 'workspace.backup':
      return db.backupVerified(request.path);
    case 'workspace.validateBackup':
      return db.validateBackup(request.path);
    case 'asset.binding':
      return db.mediaAssetBinding(request.processId, request.assetId, request.hostId);
    case 'job.mediaPlan':
      return db.jobMediaPreflightPlan(request.jobId, request.hostId);
    case 'stage.prepare':
      return db.prepareClaimedDeviceStage(request);
    case 'stage.beginAttempt':
      return db.beginClaimedDeviceStageAttempt(request);
    case 'stage.syncAck':
      return db.recordClaimedDeviceStageSyncAck(request);
    case 'stage.verifyRemoteBytes':
      return db.recordClaimedDeviceStageRemoteReadback(request);
    case 'stage.recordMediaStore':
      return db.recordClaimedDeviceStageMediaStore(request);
    case 'stage.recordReconciliation':
      return db.recordClaimedDeviceStageReconciliation(request);
    case 'stage.list':
      return db.listDeviceStageTransfers(request.jobId);
    case 'stage.assertClaim':
      return db.assertClaimedDeviceStageAttempt(
        request.stageId, request.lease, request.expectedJobRevision, request.at,
      );
    case 'asset.adoptPreview':
      return db.previewMediaAdoption(
        request.binding.grant.processId,
        request.binding.assetId,
        request.binding.grant.hostId,
        request.scanned,
        undefined,
        request.binding,
      );
    case 'asset.adoptPlan':
      return db.mediaAdoptionPlan(request.token, request.hostId);
    case 'asset.adoptApply':
      return db.applyMediaAdoption(request.token, request.hostId, request.scanned);
    case 'endpoint.list':
      return db.deviceEndpoints(request.hostId);
    case 'endpoint.set':
      return db.setDeviceEndpoint(
        request.hostId,
        request.endpoint,
        request.desired,
        request.expectedRevision ?? null,
      );
    case 'endpoint.attempt':
      return db.recordEndpointAttempt(
        request.hostId,
        request.endpoint,
        request.resolvedSerial,
        request.errorCode,
        request.at,
      );
    case 'device.invalidate':
      return db.invalidateDeviceTransports(request.hostId, request.deviceId ?? null);
    case 'device.reconcile':
      return db.reconcileDeviceTransports(request.hostId, request.observations, request.at);
    case 'device.records':
      return db.listDeviceRecords(request.hostId);
    case 'device.resolutionHistory':
      return db.deviceResolutionHistory(request.deviceId, request.limit, request.cursor);
    case 'device.conflictReadiness':
      return db.conflictResolutionReadiness(request.hostId, request.deviceId, request.at);
    case 'device.resolutionPreview':
      return db.previewDeviceConflictResolution(
        request.hostId, request.deviceId, request.expectedRevision, request.observation, request.at,
      );
    case 'device.resolutionApply':
      return db.applyDeviceConflictResolution(
        request.hostId, request.deviceId, request.token, request.confirmedName, request.observation,
        request.at,
      );
    case 'device.update':
      return db.updateDevice(request.id, request.expectedRevision, request.patch);
    case 'device.assertTransport':
      return db.assertDeviceTransport(
        request.hostId,
        request.deviceId,
        request.serial,
        request.generation,
      );
    case 'lease.acquire':
      return db.acquireLease(
        request.deviceId,
        request.ownerId,
        request.kind,
        request.at,
        request.ttl,
      );
    case 'lease.assert':
      return db.assertLease(request.lease, request.at);
    case 'lease.release':
      return db.releaseLease(request.lease);
    case 'queue.claim':
      return db.claimDueJob(request.deviceId, request.ownerId, request.at, request.ttl);
    case 'queue.renew':
      return db.renewJobClaim(request.jobId, request.lease, request.at, request.ttl);
    case 'queue.recover':
      return db.recoverExpiredClaims(request.deviceId, request.at);
    case 'queue.reconcileSleep':
      return db.reconcileSleepGap(request.suspendedAt, request.resumedAt);
    case 'effect.prepareClaimed':
      return db.prepareClaimedEffect({
        jobId: request.jobId,
        expectedJobRevision: request.expectedJobRevision,
        expectedSnapshotHash: request.expectedSnapshotHash,
        nodeId: request.nodeId,
        kind: request.kind,
        effectKey: request.effectKey,
        payloadHash: request.payloadHash,
        lease: request.lease,
        at: request.at,
      });
    case 'effect.beginClaimedAttempt':
      return db.beginClaimedEffectAttempt({
        effectId: request.effectId,
        expectedJobRevision: request.expectedJobRevision,
        lease: request.lease,
        at: request.at,
      });
    case 'source.register':
      return db.registerNativeSources(request.processId, request.expectedRevision, request.grants);
    case 'source.grant':
      return db.getSourceGrant(request.id, request.hostId);
    case 'source.binding':
      return db.sourceBinding(request.id);
    case 'source.rebind':
      return db.rebindSource(
        request.id,
        request.expectedRevision,
        request.hostId,
        request.rootPath,
      );
    case 'source.active':
      return db.activeSourceGrants(request.hostId);
    case 'source.list':
      return db.listSources(request.processId, request.hostId);
    case 'source.apply':
      return db.applyScannedAsset(
        request.grant.id,
        request.grant.hostId,
        request.grant.revision,
        request.generation,
        request.asset,
      );
    case 'source.finish':
      return db.finishSourceScan(
        request.grant.id,
        request.grant.hostId,
        request.grant.revision,
        request.generation,
      );
    case 'source.options':
      return db.updateSourceOptions(
        request.id,
        request.hostId,
        request.expectedRevision,
        request.options,
      );
  }
}
