import type { ScannedAsset, SourceGrant, DeviceLease } from '@autoreels/contracts';
import type { StudioDatabase } from '@autoreels/database';
/** This union is never exported through preload, HTTP or the public service dispatcher. */
export type InternalRequest =
  | { command: 'queue.claim'; deviceId: string; ownerId: string; at: number; ttl: number }
  | { command: 'queue.renew'; jobId: string; lease: DeviceLease; at: number; ttl: number }
  | { command: 'queue.recover'; deviceId: string; at: number }
  | {
      command: 'source.register';
      processId: string;
      expectedRevision: number;
      grants: Omit<SourceGrant, 'id' | 'revision' | 'active'>[];
    }
  | { command: 'source.grant'; id: string; hostId: string }
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
    case 'queue.claim':
      return db.claimDueJob(request.deviceId, request.ownerId, request.at, request.ttl);
    case 'queue.renew':
      return db.renewJobClaim(request.jobId, request.lease, request.at, request.ttl);
    case 'queue.recover':
      return db.recoverExpiredClaims(request.deviceId, request.at);
    case 'source.register':
      return db.registerNativeSources(request.processId, request.expectedRevision, request.grants);
    case 'source.grant':
      return db.getSourceGrant(request.id, request.hostId);
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
