import { describe, expect, it } from 'vitest';
import type { NativeEffectManualReviewResult } from '@autoreels/contracts';
import type { InternalRequest } from '../apps/desktop/src/host/internal.js';
import { NativeEffectReviewService } from '../apps/desktop/src/host/native-effect-review.js';

const at = Date.parse('2026-10-30T00:00:00.000Z');
const target = {
  jobId: 'job_effect_review_fixture',
  jobRevision: 9,
  ordinal: 0,
  effectId: 'effect_private_review_fixture',
  kind: 'PUBLISH' as const,
  state: 'ATTEMPT_UNCERTAIN' as const,
  canConfirm: false as const, canRetry: false as const, canDispatch: false as const,
};
function fakeDb(options: {
  target?: typeof target;
  forgedTarget?: boolean;
  forgedReceipt?: boolean;
} = {}) {
  const calls: InternalRequest[] = [];
  const db = {
    async internal<T>(request: InternalRequest): Promise<T> {
      calls.push(request);
      if (request.command === 'effect.reviewTarget') {
        return {
          ...(options.target ?? target),
          ...(options.forgedTarget ? { canRetry: true } : {}),
        } as T;
      }
      if (request.command === 'effect.reviewRecord') {
        const receipt = {
          requestId: request.requestId,
          jobId: request.jobId,
          effectId: request.effectId,
          jobRevision: request.expectedJobRevision,
          reasonCode: request.reasonCode,
          disposition: request.disposition,
          evidenceCount: request.evidenceRefs.length,
          createdAt: new Date(request.at).toISOString(),
          alreadyRecorded: false,
          canConfirm: false,
          canRetry: options.forgedReceipt ? true : false,
          canDispatch: false,
        };
        return receipt as T;
      }
      throw new Error('Unexpected private worker command: ' + request.command);
    },
  };
  return { db, calls };
}
const input = {
  jobId: target.jobId,
  ordinal: 0,
  actorId: 'operator_self_reported',
  reasonCode: 'PROVIDER_EVIDENCE_MISSING' as const,
  disposition: 'AWAITING_EVIDENCE' as const,
  evidenceRefs: [] as string[],
};

describe('S101.3 native-only manual effect review note', () => {
  it('resolves effect ID privately and records missing provider evidence without fake references', async () => {
    const { db, calls } = fakeDb();
    const service = new NativeEffectReviewService(db, 'host_effect_review_fixture', () => at);
    const result: NativeEffectManualReviewResult = await service.recordManualReview(input);
    expect(result).toEqual({
      jobId: target.jobId, ordinal: 0, kind: 'PUBLISH',
      state: 'ATTEMPT_UNCERTAIN',
      reasonCode: 'PROVIDER_EVIDENCE_MISSING', disposition: 'AWAITING_EVIDENCE',
      evidenceCount: 0, createdAt: new Date(at).toISOString(),
      alreadyRecorded: false,
      scope: 'PRIVATE_EFFECT_MANUAL_REVIEW_NOTE_NOT_CERTIFIED',
      canConfirm: false, canRetry: false, canDispatch: false,
    });
    expect(calls[0]).toEqual({
      command: 'effect.reviewTarget', jobId: target.jobId, ordinal: 0,
    });
    expect(calls[1]).toMatchObject({
      command: 'effect.reviewRecord', jobId: target.jobId,
      effectId: target.effectId, expectedJobRevision: target.jobRevision,
      expectedEffectState: target.state, actorId: input.actorId,
      reasonCode: input.reasonCode, disposition: input.disposition,
      evidenceRefs: [], at,
    });
    const redacted = JSON.stringify(result);
    const secondCall = calls[1];
    const persistedRequestId = secondCall?.command === 'effect.reviewRecord'
      ? secondCall.requestId : '';
    for (const secret of [
      target.effectId, input.actorId, persistedRequestId, 'effect_review_',
    ]) expect(redacted).not.toContain(secret);
  });

  it('rejects invalid inputs before reading a target or writing a note', async () => {
    const { db, calls } = fakeDb();
    const service = new NativeEffectReviewService(db, 'host_effect_review_fixture', () => at);
    await expect(service.recordManualReview({
      ...input, reasonCode: 'UNKNOWN_EFFECT', evidenceRefs: [],
    })).rejects.toMatchObject({ code: 'NATIVE_EFFECT_REVIEW_INPUT_INVALID' });
    await expect(service.recordManualReview({
      ...input, actorId: '', evidenceRefs: ['evidence_one'],
    })).rejects.toMatchObject({ code: 'NATIVE_EFFECT_REVIEW_INPUT_INVALID' });
    await expect(service.recordManualReview({
      ...input, evidenceRefs: ['same_id', 'same_id'],
    })).rejects.toMatchObject({ code: 'NATIVE_EFFECT_REVIEW_INPUT_INVALID' });
    expect(calls).toEqual([]);
  });

  it('rejects a forged private target or a receipt that grants confirmation/retry rights', async () => {
    const forgedTarget = fakeDb({ forgedTarget: true });
    await expect(new NativeEffectReviewService(
      forgedTarget.db, 'host_effect_review_fixture', () => at,
    ).recordManualReview(input)).rejects.toMatchObject({
      code: 'NATIVE_EFFECT_REVIEW_TARGET_INVALID',
    });
    expect(forgedTarget.calls).toHaveLength(1);

    const forgedReceipt = fakeDb({ forgedReceipt: true });
    await expect(new NativeEffectReviewService(
      forgedReceipt.db, 'host_effect_review_fixture', () => at,
    ).recordManualReview(input)).rejects.toMatchObject({
      code: 'NATIVE_EFFECT_REVIEW_RECEIPT_INVALID',
    });
    expect(forgedReceipt.calls.map((x) => x.command))
      .toEqual(['effect.reviewTarget', 'effect.reviewRecord']);
  });
});
