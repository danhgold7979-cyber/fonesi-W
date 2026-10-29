import { createHash } from 'node:crypto';
import { hashSchema, idSchema, isSafeKey } from '@autoreels/contracts';
import type { DeviceLease } from '@autoreels/contracts';
import { DomainError } from '@autoreels/domain';
import type { InternalRequest } from './internal.js';

/**
 * Trusted host-only port. No renderer, HTTP or preload path may instantiate a
 * provider. Adapter success is a transport observation, NOT a provider post.
 */
export interface FrozenAdapterComment {
  /** Trusted host-only payload, never serialized to StudioApi or logs. */
  ordinal: number;
  value: string;
  utf8Hash: string;
  utf8Bytes: number;
}
export type ClaimedEffectAdapterInput = {
  effectId: string;
  jobId: string;
  nodeId: string;
  lease: DeviceLease;
} & (
  | { kind: 'PUBLISH'; comment?: never }
  | { kind: 'COMMENT'; comment: FrozenAdapterComment }
);
export interface ClaimedEffectAdapter {
  sendOnce(
    input: ClaimedEffectAdapterInput, signal?: AbortSignal,
  ): Promise<'ACK' | 'UNKNOWN'>;
}
interface ClaimedEffectDbPort {
  internal<T>(request: InternalRequest): Promise<T>;
}
export interface ClaimedEffectRequest {
  jobId: string;
  expectedJobRevision: number;
  expectedSnapshotHash: string;
  nodeId: string;
  kind: 'PUBLISH' | 'COMMENT';
  effectKey: string;
  payloadHash: string;
  /** Private frozen list ordinal. No comment text is accepted from renderer. */
  commentSource?: {
    postEffectId: string; fieldKey: string; scope: 'row' | 'process'; ordinal: number;
  };
  lease: DeviceLease;
}
export type ClaimedEffectResult = {
  effectId: string;
  jobId: string;
  state: 'INTENT_HELD_FOR_REVIEW' | 'ATTEMPT_UNCERTAIN';
  observation: 'NOT_DISPATCHED' | 'ACK_UNVERIFIED' | 'UNKNOWN';
  /** An effect is never confirmed by an adapter ACK or a caught exception. */
  canConfirm: false;
  canRetry: false;
  canDispatchAgain: false;
};

/**
 * P11/S097: the DB's durable INTENT and ATTEMPT_UNCERTAIN transactions are
 * strictly ordered before a single adapter invocation. Crash windows are
 * deliberately never retried in this layer. No production adapter is wired.
 */
export class HostClaimedEffectService {
  constructor(
    private readonly db: ClaimedEffectDbPort,
    private readonly adapter: ClaimedEffectAdapter | null = null,
    private readonly clock: () => number = Date.now,
  ) {}

  private now(): number {
    const at = this.clock();
    if (!Number.isSafeInteger(at) || !Number.isFinite(new Date(at).getTime()))
      throw new DomainError('EFFECT_HOST_CLOCK_INVALID', 'Host clock is invalid.');
    return at;
  }

  async attempt(
    request: ClaimedEffectRequest,
    signal?: AbortSignal,
  ): Promise<ClaimedEffectResult> {
    // A missing certified provider must leave SQLite completely unchanged.
    if (!this.adapter)
      throw new DomainError('EFFECT_ADAPTER_UNAVAILABLE', 'No trusted effect provider is configured.');
    if (signal?.aborted)
      throw new DomainError('CANCELLED', 'No external effect was attempted.');
    if (!idSchema.safeParse(request.jobId).success ||
        !idSchema.safeParse(request.nodeId).success ||
        !hashSchema.safeParse(request.effectKey).success ||
        !hashSchema.safeParse(request.payloadHash).success ||
        !hashSchema.safeParse(request.expectedSnapshotHash).success ||
        !Number.isSafeInteger(request.expectedJobRevision) ||
        request.expectedJobRevision < 0 ||
        !['PUBLISH', 'COMMENT'].includes(request.kind) ||
        request.lease.ownerKind !== 'JOB' ||
        (request.kind === 'PUBLISH' && request.commentSource !== undefined) ||
        (request.kind === 'COMMENT' && (
          !request.commentSource ||
          !idSchema.safeParse(request.commentSource.postEffectId).success ||
          !isSafeKey(request.commentSource.fieldKey) ||
          !['row', 'process'].includes(request.commentSource.scope) ||
          !Number.isSafeInteger(request.commentSource.ordinal) ||
          request.commentSource.ordinal < 0 ||
          request.commentSource.ordinal >= 32
        )))
      throw new DomainError('EFFECT_HOST_INPUT_INVALID', 'Trusted claimed effect request is invalid.');

    const at = this.now();
    const intent = await this.db.internal<{
      effectId: string; jobId: string; jobRevision: number; state: 'INTENT';
    }>({
      command: 'effect.prepareClaimed',
      jobId: request.jobId,
      expectedJobRevision: request.expectedJobRevision,
      expectedSnapshotHash: request.expectedSnapshotHash,
      nodeId: request.nodeId,
      kind: request.kind,
      effectKey: request.effectKey,
      payloadHash: request.payloadHash,
      ...(request.commentSource ? { commentSource: request.commentSource } : {}),
      lease: request.lease,
      at,
    });
    if (intent.state !== 'INTENT' || intent.jobId !== request.jobId ||
        !idSchema.safeParse(intent.effectId).success ||
        !Number.isSafeInteger(intent.jobRevision) ||
        intent.jobRevision !== request.expectedJobRevision + 1)
      throw new DomainError('EFFECT_INTENT_RECEIPT_INVALID',
        'The durable journal receipt does not match the claimed job.');
    if (signal?.aborted) {
      return {
        effectId: intent.effectId, jobId: intent.jobId,
        state: 'INTENT_HELD_FOR_REVIEW', observation: 'NOT_DISPATCHED',
        canConfirm: false, canRetry: false, canDispatchAgain: false,
      };
    }

    // This transaction MUST complete before the provider sees any call. A
    // failure leaves the INTENT journal for recovery and prevents dispatch.
    const attempt = await this.db.internal<{
      effectId: string; jobId: string; jobRevision: number; state: 'ATTEMPT_UNCERTAIN';
    }>({
      command: 'effect.beginClaimedAttempt',
      effectId: intent.effectId,
      expectedJobRevision: intent.jobRevision,
      lease: request.lease,
      at: Math.max(at, this.now()),
    });
    if (attempt.state !== 'ATTEMPT_UNCERTAIN' ||
        attempt.effectId !== intent.effectId || attempt.jobId !== request.jobId ||
        !Number.isSafeInteger(attempt.jobRevision) ||
        attempt.jobRevision !== intent.jobRevision + 1)
      throw new DomainError('EFFECT_ATTEMPT_RECEIPT_INVALID',
        'Attempt uncertainty was not durably confirmed.');
    const base = {
      effectId: attempt.effectId, jobId: attempt.jobId,
      state: 'ATTEMPT_UNCERTAIN' as const,
      canConfirm: false as const,
      canRetry: false as const,
      canDispatchAgain: false as const,
    };
    // Cancellation after durable uncertainty cannot turn into a safe retry.
    if (signal?.aborted) return { ...base, observation: 'NOT_DISPATCHED' };

    // Recheck the current JOB lease, generation, snapshot, job revision and
    // effect state after the async journal boundary, immediately before the
    // adapter callback. A rejected/invalid fence NEVER invokes an adapter.
    // The eventual real provider must also fence immediately at Android I/O.
    const fenced = await this.db.internal<true>({
      command: 'effect.assertClaim',
      effectId: attempt.effectId,
      expectedJobRevision: attempt.jobRevision,
      expectedSnapshotHash: request.expectedSnapshotHash,
      lease: request.lease,
      at: this.now(),
    });
    if (fenced !== true)
      throw new DomainError('EFFECT_DISPATCH_FENCE_INVALID',
        'The effect dispatch fence was not confirmed.');
    if (signal?.aborted) return { ...base, observation: 'NOT_DISPATCHED' };

    // Only a durably journaled COMMENT can be rehydrated into exact frozen
    // Unicode text. A mismatched worker receipt cannot reach the adapter.
    let comment: FrozenAdapterComment | null = null;
    if (request.kind === 'COMMENT') {
      const source = request.commentSource!;
      const receipt = await this.db.internal<{
        scope: 'FROZEN_COMMENT_ADAPTER_PRIVATE';
        effectId: string;
        jobId: string;
        ordinal: number;
        value: string;
        utf8Hash: string;
        utf8Bytes: number;
        effectKey: string;
        payloadHash: string;
      }>({
        command: 'comment.resolveClaimed',
        effectId: attempt.effectId,
        jobId: request.jobId,
        expectedJobRevision: attempt.jobRevision,
        expectedSnapshotHash: request.expectedSnapshotHash,
        postEffectId: source.postEffectId,
        fieldKey: source.fieldKey,
        scope: source.scope,
        ordinal: source.ordinal,
        lease: request.lease,
        at: this.now(),
      });
      const utf8 = typeof receipt?.value === 'string'
        ? Buffer.from(receipt.value, 'utf8') : null;
      if (receipt?.scope !== 'FROZEN_COMMENT_ADAPTER_PRIVATE' ||
          receipt.effectId !== attempt.effectId ||
          receipt.jobId !== request.jobId ||
          receipt.ordinal !== source.ordinal ||
          receipt.effectKey !== request.effectKey ||
          receipt.payloadHash !== request.payloadHash ||
          !hashSchema.safeParse(receipt.utf8Hash).success ||
          !Number.isSafeInteger(receipt.utf8Bytes) ||
          !utf8 || utf8.byteLength !== receipt.utf8Bytes ||
          createHash('sha256').update(utf8).digest('hex') !== receipt.utf8Hash)
        throw new DomainError('COMMENT_ADAPTER_PAYLOAD_INVALID',
          'Trusted frozen comment receipt does not match the claimed effect.');
      comment = {
        ordinal: source.ordinal, value: receipt.value,
        utf8Hash: receipt.utf8Hash, utf8Bytes: receipt.utf8Bytes,
      };
    }
    if (signal?.aborted) return { ...base, observation: 'NOT_DISPATCHED' };

    const common = {
      effectId: attempt.effectId, jobId: request.jobId,
      nodeId: request.nodeId, lease: request.lease,
    };
    const adapterInput: ClaimedEffectAdapterInput = request.kind === 'COMMENT'
      ? { ...common, kind: 'COMMENT', comment: comment! }
      : { ...common, kind: 'PUBLISH' };
    try {
      const ack = await this.adapter.sendOnce(adapterInput, signal);
      return { ...base, observation: ack === 'ACK' ? 'ACK_UNVERIFIED' : 'UNKNOWN' };
    } catch {
      // Transport failure, app crash, cancellation and unknown ACK all require
      // independent verification; never leak a provider error or auto-retry.
      return { ...base, observation: 'UNKNOWN' };
    }
  }
}
