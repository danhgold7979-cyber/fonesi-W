import { describe, expect, it } from 'vitest';
import type { FrozenComposeManifest } from './compose-review.js';
import {
  assessProviderPostCandidates,
  type PendingPublishEffect, type ProviderPostObservation,
} from './post-verification.js';

const at = Date.parse('2026-10-29T11:15:00.000Z');
function fixture() {
  const manifest: FrozenComposeManifest = {
    workflowAppId: 'fb', workflowVersionId: 'version_post',
    workflowHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64),
    accountId: 'account_pinned', targetId: 'target_pinned',
    contentId: 'content_pinned', orderedAssetIds: ['asset_first', 'asset_second'],
    orderedAssets: [
      { ordinal: 0, assetId: 'asset_first', kind: 'VIDEO',
        pinnedHash: 'c'.repeat(64), pinnedBytes: 101 },
      { ordinal: 1, assetId: 'asset_second', kind: 'VIDEO',
        pinnedHash: 'd'.repeat(64), pinnedBytes: 202 },
    ],
    fields: [
      { ordinal: 0, scope: 'row', kind: 'TEXT',
        utf8Hash: 'e'.repeat(64), utf8Bytes: 55 },
      { ordinal: 1, scope: 'process', kind: 'URL',
        utf8Hash: 'f'.repeat(64), utf8Bytes: 35 },
    ],
  };
  const effect: PendingPublishEffect = {
    effectId: 'effect_post', jobId: 'job_post', snapshotHash: manifest.snapshotHash,
    effectKey: '1'.repeat(64), payloadHash: '2'.repeat(64),
    kind: 'PUBLISH', state: 'ATTEMPT_UNCERTAIN',
    attemptedAt: '2026-10-29T11:00:00.000Z',
  };
  const post: ProviderPostObservation = {
    observationId: 'observation_1', source: 'PROVIDER_READBACK',
    providerAppId: 'fb', accountId: 'account_pinned', targetId: 'target_pinned',
    externalPostId: 'post_123456789', postedAt: '2026-10-29T11:00:10.000Z',
    observedAt: '2026-10-29T11:14:00.000Z',
    orderedMedia: [
      { hash: 'c'.repeat(64), bytes: 101 },
      { hash: 'd'.repeat(64), bytes: 202 },
    ],
    orderedFields: [
      { ordinal: 0, scope: 'row', kind: 'TEXT',
        utf8Hash: 'e'.repeat(64), utf8Bytes: 55 },
      { ordinal: 1, scope: 'process', kind: 'URL',
        utf8Hash: 'f'.repeat(64), utf8Bytes: 35 },
    ],
  };
  return { expectedJobId: effect.jobId, manifest, effect, observations: [post], at };
}
const check = (input: ReturnType<typeof fixture>) =>
  assessProviderPostCandidates(input);

describe('P11/S098 private provider post candidate comparison, never confirmation', () => {
  it('identifies exactly one private candidate but never confirms or retries on a synthetic receipt', () => {
    const v = fixture(), before = JSON.stringify(v);
    const result = check(v);
    expect(result.summary).toEqual({
      scope: 'PRIVATE_CANDIDATE_NOT_PROVIDER_CERTIFIED',
      status: 'EXACT_CANDIDATE_UNCERTIFIED',
      observationsChecked: 1, exactCandidates: 1, blockers: [],
      canConfirm: false, canRetry: false, canDispatch: false,
    });
    expect(result.candidate).toEqual(v.observations[0]);
    expect(JSON.stringify(v)).toBe(before);
    const redacted = JSON.stringify(result.summary);
    for (const sensitive of [
      'account_pinned','target_pinned','post_123456789',
      'content_pinned','asset_first','c'.repeat(64),'e'.repeat(64),
    ]) expect(redacted).not.toContain(sensitive);
  });
  it('preserves frozen ordinal gaps when an optional text field is not populated', () => {
    const v = fixture();
    v.manifest.fields[1]!.ordinal = 3;
    v.observations[0]!.orderedFields[1]!.ordinal = 3;
    const before = JSON.stringify(v);
    const result = check(v);
    expect(result.summary.status).toBe('EXACT_CANDIDATE_UNCERTIFIED');
    expect(result.summary.canConfirm).toBe(false);
    expect(JSON.stringify(v)).toBe(before);
  });
  it('blocks duplicate frozen Unicode ordinals rather than collapsing a field', () => {
    const v = fixture();
    v.manifest.fields[1]!.ordinal = 0;
    const result = check(v);
    expect(result).toMatchObject({
      candidate: null, summary: { status: 'BLOCKED',
        blockers: ['EXPECTATION_INVALID'], canConfirm: false },
    });
  });
  it('never treats empty observation as definitive negative proof', () => {
    const v = fixture(); v.observations = [];
    expect(check(v)).toMatchObject({
      candidate: null,
      summary: { status: 'NO_EXACT_CANDIDATE_REVIEW',
        blockers: ['NO_EXACT_CANDIDATE'], canRetry: false },
    });
  });
  it('blocks ambiguous second exact external post instead of choosing first', () => {
    const v = fixture();
    v.observations.push({
      ...v.observations[0]!, observationId: 'observation_2',
      externalPostId: 'post_999999999',
    });
    expect(check(v)).toMatchObject({
      candidate: null,
      summary: { status: 'AMBIGUOUS_REVIEW', exactCandidates: 2,
        blockers: ['MULTIPLE_EXACT_CANDIDATES'], canConfirm: false },
    });
  });
  it('rejects duplicate provider external post IDs and duplicate observation IDs', () => {
    for (const same of ['externalPostId', 'observationId'] as const) {
      const v = fixture();
      v.observations.push({
        ...v.observations[0]!, observationId: 'observation_2',
        externalPostId: 'post_222222222',
        [same]: v.observations[0]![same],
      });
      expect(check(v).summary.status).toBe('BLOCKED');
    }
  });
  it('does not accept more than 32 untrusted readback results', () => {
    const v = fixture();
    v.observations = Array.from({ length: 33 }, (_, i) => ({
      ...v.observations[0]!,
      observationId: 'observation_' + (i + 1),
      externalPostId: 'post_' + (i + 1),
    }));
    const result = check(v);
    expect(result).toMatchObject({
      candidate: null, summary: { status: 'BLOCKED',
        blockers: ['OBSERVATION_SET_INVALID'], observationsChecked: 32 },
    });
  });
  const invalidCases: {
    name: string; edit: (v: ReturnType<typeof fixture>) => void;
    expected: 'BLOCKED' | 'NO_EXACT_CANDIDATE_REVIEW';
  }[] = [
    { name: 'wrong provider app', edit: v => { v.observations[0]!.providerAppId = 'tt'; }, expected: 'NO_EXACT_CANDIDATE_REVIEW' },
    { name: 'wrong logged-in account', edit: v => { v.observations[0]!.accountId = 'account_other'; }, expected: 'NO_EXACT_CANDIDATE_REVIEW' },
    { name: 'wrong target', edit: v => { v.observations[0]!.targetId = 'target_other'; }, expected: 'NO_EXACT_CANDIDATE_REVIEW' },
    { name: 'changed media hash', edit: v => { v.observations[0]!.orderedMedia[0]!.hash = '3'.repeat(64); }, expected: 'NO_EXACT_CANDIDATE_REVIEW' },
    { name: 'swapped ordered media', edit: v => { v.observations[0]!.orderedMedia.reverse(); }, expected: 'NO_EXACT_CANDIDATE_REVIEW' },
    { name: 'wrong media byte count', edit: v => { v.observations[0]!.orderedMedia[1]!.bytes = 203; }, expected: 'NO_EXACT_CANDIDATE_REVIEW' },
    { name: 'different Unicode UTF-8 hash', edit: v => { v.observations[0]!.orderedFields[0]!.utf8Hash = '4'.repeat(64); }, expected: 'NO_EXACT_CANDIDATE_REVIEW' },
    { name: 'different Unicode byte count', edit: v => { v.observations[0]!.orderedFields[0]!.utf8Bytes = 99; }, expected: 'NO_EXACT_CANDIDATE_REVIEW' },
    { name: 'wrong field scope', edit: v => { v.observations[0]!.orderedFields[0]!.scope = 'process'; }, expected: 'NO_EXACT_CANDIDATE_REVIEW' },
    { name: 'post before attempt window', edit: v => { v.observations[0]!.postedAt = '2026-10-29T10:59:00.000Z'; }, expected: 'NO_EXACT_CANDIDATE_REVIEW' },
    { name: 'post after attempt window', edit: v => { v.observations[0]!.postedAt = '2026-10-29T11:31:00.000Z'; v.observations[0]!.observedAt = '2026-10-29T11:32:00.000Z'; v.at = Date.parse('2026-10-29T11:32:05.000Z'); }, expected: 'NO_EXACT_CANDIDATE_REVIEW' },
    { name: 'stale observation', edit: v => { v.observations[0]!.observedAt = '2026-10-29T11:03:00.000Z'; }, expected: 'BLOCKED' },
    { name: 'missing post identity', edit: v => { v.observations[0]!.externalPostId = ''; }, expected: 'BLOCKED' },
    { name: 'forged observation source', edit: v => { v.observations[0]!.source = 'UI_ONLY' as never; }, expected: 'BLOCKED' },
    { name: 'wrong snapshot hash', edit: v => { v.effect.snapshotHash = '5'.repeat(64); }, expected: 'BLOCKED' },
    { name: 'effect not attempt uncertain', edit: v => { v.effect.state = 'CONFIRMED' as never; }, expected: 'BLOCKED' },
    { name: 'missing expected media', edit: v => { v.manifest.orderedAssets.pop(); }, expected: 'BLOCKED' },
    { name: 'duplicate expectation media ID', edit: v => { v.manifest.orderedAssetIds[1] = v.manifest.orderedAssetIds[0]!; }, expected: 'BLOCKED' },
    { name: 'untrusted future timestamp', edit: v => { v.observations[0]!.observedAt = '2026-10-29T11:16:00.000Z'; }, expected: 'BLOCKED' },
  ];
  for (const { name, edit, expected } of invalidCases) {
    it('fails closed or requires review for '+name, () => {
      const v = fixture(); edit(v);
      const before = JSON.stringify(v);
      const result = check(v);
      expect(result.summary.status).toBe(expected);
      expect(result.candidate).toBeNull();
      expect(result.summary.canConfirm).toBe(false);
      expect(result.summary.canDispatch).toBe(false);
      expect(result.summary.canRetry).toBe(false);
      expect(JSON.stringify(v)).toBe(before);
      expect(JSON.stringify(result.summary)).not.toContain('post_123456789');
    });
  }
});
