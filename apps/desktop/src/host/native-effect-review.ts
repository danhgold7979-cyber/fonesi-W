import { randomUUID } from 'node:crypto';
import { idSchema } from '@autoreels/contracts';
import type {
  NativeEffectManualReviewResult,
  NativeEffectReviewApi,
} from '@autoreels/contracts';
import { DomainError } from '@autoreels/domain';
import type { InternalRequest } from './internal.js';

interface NativeEffectReviewDbPort {
  internal<T>(request: InternalRequest): Promise<T>;
}

/**
 * Electron-main-only audit-note writer. Actor IDs are self-declared metadata,
 * not authentication. This service never resolves an effect or job outcome.
 */
export class NativeEffectReviewService implements NativeEffectReviewApi {
  constructor(
    private readonly db: NativeEffectReviewDbPort,
    private readonly hostId: string,
    private readonly clock: () => number = Date.now,
  ) {}

  async recordManualReview(input: {
    jobId: string;
    ordinal: number;
    actorId: string;
    reasonCode: NativeEffectManualReviewResult['reasonCode'];
    disposition: NativeEffectManualReviewResult['disposition'];
    evidenceRefs: string[];
  }): Promise<NativeEffectManualReviewResult> {
    idSchema.parse(input.jobId);
    idSchema.parse(input.actorId);
    if (!idSchema.safeParse(this.hostId).success ||
        !Number.isSafeInteger(input.ordinal) || input.ordinal < 0 || input.ordinal >= 20 ||
        !['UNKNOWN_EFFECT', 'CANCEL_REQUESTED', 'PROVIDER_EVIDENCE_MISSING',
          'COMMENT_UNCERTAIN'].includes(input.reasonCode) ||
        !['AWAITING_EVIDENCE', 'ESCALATED', 'INSPECTED_UNCERTIFIED']
          .includes(input.disposition) ||
        !Array.isArray(input.evidenceRefs) || input.evidenceRefs.length > 8 ||
        input.evidenceRefs.some((ref) => !idSchema.safeParse(ref).success) ||
        new Set(input.evidenceRefs).size !== input.evidenceRefs.length ||
        (input.evidenceRefs.length === 0 &&
          !(input.reasonCode === 'PROVIDER_EVIDENCE_MISSING' &&
            input.disposition === 'AWAITING_EVIDENCE')))
      throw new DomainError('NATIVE_EFFECT_REVIEW_INPUT_INVALID',
        'A bounded self-declared operator note and valid evidence references are required.');

    const target = await this.db.internal<{
      jobId: string; jobRevision: number; ordinal: number; effectId: string;
      kind: 'PUBLISH' | 'COMMENT';
      state: 'INTENT' | 'ATTEMPT_UNCERTAIN' | 'NEEDS_REVIEW';
      canConfirm: false; canRetry: false; canDispatch: false;
    }>({ command: 'effect.reviewTarget', jobId: input.jobId, ordinal: input.ordinal });
    if (target.jobId !== input.jobId || target.ordinal !== input.ordinal ||
        !idSchema.safeParse(target.effectId).success ||
        !Number.isSafeInteger(target.jobRevision) || target.jobRevision < 0 ||
        !['PUBLISH', 'COMMENT'].includes(target.kind) ||
        !['INTENT', 'ATTEMPT_UNCERTAIN', 'NEEDS_REVIEW'].includes(target.state) ||
        target.canConfirm !== false || target.canRetry !== false ||
        target.canDispatch !== false)
      throw new DomainError('NATIVE_EFFECT_REVIEW_TARGET_INVALID',
        'The selected persisted effect is not a valid unresolved review target.');

    const at = this.clock();
    if (!Number.isSafeInteger(at) || !Number.isFinite(new Date(at).getTime()))
      throw new DomainError('NATIVE_EFFECT_REVIEW_CLOCK_INVALID',
        'Local review timestamp is invalid.');
    const requestId = 'effect_review_' + randomUUID().replaceAll('-', '');
    const receipt = await this.db.internal<{
      requestId: string; jobId: string; effectId: string; jobRevision: number;
      reasonCode: string; disposition: string; evidenceCount: number;
      createdAt: string; alreadyRecorded: boolean;
      canConfirm: false; canRetry: false; canDispatch: false;
    }>({
      command: 'effect.reviewRecord', requestId, jobId: input.jobId,
      effectId: target.effectId, expectedJobRevision: target.jobRevision,
      expectedEffectState: target.state, actorId: input.actorId,
      reasonCode: input.reasonCode, disposition: input.disposition,
      evidenceRefs: input.evidenceRefs, at,
    });
    if (receipt.requestId !== requestId || receipt.jobId !== input.jobId ||
        receipt.effectId !== target.effectId ||
        receipt.jobRevision !== target.jobRevision ||
        receipt.reasonCode !== input.reasonCode ||
        receipt.disposition !== input.disposition ||
        receipt.evidenceCount !== input.evidenceRefs.length ||
        !Number.isFinite(Date.parse(receipt.createdAt)) ||
        receipt.canConfirm !== false || receipt.canRetry !== false ||
        receipt.canDispatch !== false)
      throw new DomainError('NATIVE_EFFECT_REVIEW_RECEIPT_INVALID',
        'The effect review receipt is malformed or grants an unsafe capability.');

    return {
      jobId: input.jobId, ordinal: input.ordinal,
      kind: target.kind, state: target.state,
      reasonCode: input.reasonCode, disposition: input.disposition,
      evidenceCount: receipt.evidenceCount, createdAt: receipt.createdAt,
      alreadyRecorded: receipt.alreadyRecorded,
      scope: 'PRIVATE_EFFECT_MANUAL_REVIEW_NOTE_NOT_CERTIFIED',
      canConfirm: false, canRetry: false, canDispatch: false,
    };
  }
}
