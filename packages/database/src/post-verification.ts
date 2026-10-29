import { hashSchema, idSchema } from '@autoreels/contracts';
import type { FrozenComposeManifest } from './compose-review.js';

/** Trusted-host *input shape*, not a credential or provider certification. */
export interface PendingPublishEffect {
  effectId: string;
  jobId: string;
  snapshotHash: string;
  effectKey: string;
  payloadHash: string;
  kind: 'PUBLISH';
  state: 'ATTEMPT_UNCERTAIN';
  attemptedAt: string;
}
export interface ProviderPostObservation {
  /** Private provider readback identifier, never returned in a public summary. */
  observationId: string;
  source: 'PROVIDER_READBACK';
  providerAppId: string;
  accountId: string;
  targetId: string;
  externalPostId: string;
  postedAt: string;
  observedAt: string;
  orderedMedia: { hash: string; bytes: number }[];
  orderedFields: {
    ordinal: number;
    scope: 'row' | 'process';
    kind: 'TEXT' | 'URL';
    utf8Hash: string;
    utf8Bytes: number;
  }[];
}
export type PostCandidateBlocker =
  | 'EXPECTATION_INVALID' | 'EFFECT_NOT_UNCERTAIN' | 'OBSERVATION_SET_INVALID'
  | 'OBSERVATION_INVALID' | 'OBSERVATION_STALE'
  | 'EXTERNAL_ID_COLLISION' | 'MULTIPLE_EXACT_CANDIDATES'
  | 'NO_EXACT_CANDIDATE';
export interface PostCandidateSummary {
  scope: 'PRIVATE_CANDIDATE_NOT_PROVIDER_CERTIFIED';
  status: 'BLOCKED' | 'NO_EXACT_CANDIDATE_REVIEW' |
    'AMBIGUOUS_REVIEW' | 'EXACT_CANDIDATE_UNCERTIFIED';
  observationsChecked: number;
  exactCandidates: number;
  blockers: PostCandidateBlocker[];
  /** An exact comparison is not independent proof that a provider posted. */
  canConfirm: false;
  canRetry: false;
  canDispatch: false;
}

export interface PostCandidateAssessment {
  /** Never serialize the private matching observation through StudioApi. */
  candidate: ProviderPostObservation | null;
  summary: PostCandidateSummary;
}

const MAX_OBSERVATIONS = 32;
const MAX_MEDIA = 32;
const MAX_FIELDS = 64;
const MAX_READBACK_AGE_MS = 10 * 60 * 1000;
const MAX_POST_DELAY_MS = 30 * 60 * 1000;
const CLOCK_SKEW_MS = 10000;
const externalIdValid = (id: unknown): id is string =>
  typeof id === 'string' && /^[A-Za-z0-9._:-]{4,180}$/.test(id);
const isoTime = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const t = Date.parse(value);
  return Number.isFinite(t) && new Date(t).toISOString() === value ? t : null;
};
const validBytes = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;

/**
 * S098 pre-verifier: compare an independently supplied private readback
 * against exact frozen bindings. Even an exact candidate is NOT a confirmed
 * provider post, and absence is NEVER proof of a definitely failed post.
 */
export function assessProviderPostCandidates(input: {
  expectedJobId: string;
  manifest: FrozenComposeManifest;
  effect: PendingPublishEffect;
  observations: readonly ProviderPostObservation[];
  at: number;
}): PostCandidateAssessment {
  const blockers: PostCandidateBlocker[] = [];
  const block = (code: PostCandidateBlocker): void => {
    if (!blockers.includes(code)) blockers.push(code);
  };
  let exactCandidates = 0;
  const report = (
    status: PostCandidateSummary['status'],
    candidate: ProviderPostObservation | null = null,
  ): PostCandidateAssessment => ({
    candidate,
    summary: {
      scope: 'PRIVATE_CANDIDATE_NOT_PROVIDER_CERTIFIED',
      status, observationsChecked: Array.isArray(input.observations)
        ? Math.min(MAX_OBSERVATIONS, input.observations.length) : 0,
      exactCandidates, blockers,
      canConfirm: false, canRetry: false, canDispatch: false,
    },
  });
  const { manifest, effect } = input;
  const media = manifest?.orderedAssets;
  const fields = manifest?.fields;
  if (!idSchema.safeParse(input.expectedJobId).success ||
      !idSchema.safeParse(manifest?.workflowAppId).success ||
      !hashSchema.safeParse(manifest?.snapshotHash).success ||
      !hashSchema.safeParse(manifest?.workflowHash).success ||
      !idSchema.safeParse(manifest?.accountId).success ||
      !idSchema.safeParse(manifest?.targetId).success ||
      !idSchema.safeParse(manifest?.contentId).success ||
      !Array.isArray(media) || media.length > MAX_MEDIA ||
      !Array.isArray(fields) || fields.length > MAX_FIELDS ||
      !Array.isArray(manifest?.orderedAssetIds) ||
      manifest.orderedAssetIds.length !== media.length ||
      new Set(manifest.orderedAssetIds).size !== media.length ||
      media.some((item, ordinal) =>
        !item || item.ordinal !== ordinal ||
        item.assetId !== manifest.orderedAssetIds[ordinal] ||
        !idSchema.safeParse(item.assetId).success ||
        !hashSchema.safeParse(item.pinnedHash).success ||
        !validBytes(item.pinnedBytes) ||
        !['IMAGE', 'VIDEO'].includes(item.kind)) ||
      fields.some((item, index) =>
        !item || !Number.isSafeInteger(item.ordinal) ||
        item.ordinal < 0 || item.ordinal >= MAX_FIELDS ||
        (index > 0 && item.ordinal <= fields[index - 1]!.ordinal) ||
        !['row', 'process'].includes(item.scope) ||
        !['TEXT', 'URL'].includes(item.kind) ||
        !hashSchema.safeParse(item.utf8Hash).success ||
        !Number.isSafeInteger(item.utf8Bytes) || item.utf8Bytes < 0)) {
    block('EXPECTATION_INVALID');
    return report('BLOCKED');
  }
  const attempted = isoTime(effect?.attemptedAt);
  if (!idSchema.safeParse(effect?.effectId).success ||
      effect?.jobId !== input.expectedJobId ||
      effect?.snapshotHash !== manifest.snapshotHash ||
      !hashSchema.safeParse(effect?.effectKey).success ||
      !hashSchema.safeParse(effect?.payloadHash).success ||
      effect?.kind !== 'PUBLISH' ||
      effect?.state !== 'ATTEMPT_UNCERTAIN' ||
      attempted === null) {
    block('EFFECT_NOT_UNCERTAIN');
    return report('BLOCKED');
  }
  if (!Number.isSafeInteger(input.at) || input.at < attempted ||
      !Array.isArray(input.observations) ||
      input.observations.length > MAX_OBSERVATIONS) {
    block('OBSERVATION_SET_INVALID');
    return report('BLOCKED');
  }
  const observedIds = new Set<string>();
  const providerIds = new Set<string>();
  const candidates: ProviderPostObservation[] = [];
  for (const record of input.observations) {
    const postedAt = isoTime(record?.postedAt);
    const observedAt = isoTime(record?.observedAt);
    if (!record || !idSchema.safeParse(record.observationId).success ||
        record.source !== 'PROVIDER_READBACK' ||
        !idSchema.safeParse(record.providerAppId).success ||
        !idSchema.safeParse(record.accountId).success ||
        !idSchema.safeParse(record.targetId).success ||
        !externalIdValid(record.externalPostId) ||
        postedAt === null || observedAt === null ||
        observedAt < postedAt || observedAt > input.at ||
        !Array.isArray(record.orderedMedia) ||
        record.orderedMedia.length > MAX_MEDIA ||
        record.orderedMedia.some((item: ProviderPostObservation['orderedMedia'][number]) =>
          !item || !hashSchema.safeParse(item.hash).success || !validBytes(item.bytes)) ||
        !Array.isArray(record.orderedFields) ||
        record.orderedFields.length > MAX_FIELDS ||
        record.orderedFields.some((item: ProviderPostObservation['orderedFields'][number], index: number) =>
          !item || !Number.isSafeInteger(item.ordinal) ||
          item.ordinal < 0 || item.ordinal >= MAX_FIELDS ||
          (index > 0 && item.ordinal <= record.orderedFields[index - 1]!.ordinal) ||
          !['row','process'].includes(item.scope) ||
          !['TEXT','URL'].includes(item.kind) ||
          !hashSchema.safeParse(item.utf8Hash).success ||
          !Number.isSafeInteger(item.utf8Bytes) || item.utf8Bytes < 0)) {
      block('OBSERVATION_INVALID');
      continue;
    }
    if (observedIds.has(record.observationId)) block('OBSERVATION_SET_INVALID');
    observedIds.add(record.observationId);
    // Reused external IDs from the same scan cannot be considered unique proof.
    if (providerIds.has(record.externalPostId)) block('EXTERNAL_ID_COLLISION');
    providerIds.add(record.externalPostId);
    if (input.at - observedAt > MAX_READBACK_AGE_MS) {
      block('OBSERVATION_STALE');
      continue;
    }
    const exactMedia = record.orderedMedia.length === media.length &&
      record.orderedMedia.every((item: ProviderPostObservation['orderedMedia'][number], i: number) =>
        item.hash === media[i]!.pinnedHash && item.bytes === media[i]!.pinnedBytes);
    const exactFields = record.orderedFields.length === fields.length &&
      record.orderedFields.every((item: ProviderPostObservation['orderedFields'][number], i: number) =>
        item.ordinal === fields[i]!.ordinal &&
        item.scope === fields[i]!.scope &&
        item.kind === fields[i]!.kind &&
        item.utf8Hash === fields[i]!.utf8Hash &&
        item.utf8Bytes === fields[i]!.utf8Bytes);
    if (record.providerAppId === manifest.workflowAppId &&
        record.accountId === manifest.accountId &&
        record.targetId === manifest.targetId &&
        postedAt >= attempted - CLOCK_SKEW_MS &&
        postedAt <= attempted + MAX_POST_DELAY_MS &&
        exactMedia && exactFields)
      candidates.push(record);
  }
  exactCandidates = candidates.length;
  if (blockers.length) return report('BLOCKED');
  if (exactCandidates > 1) {
    block('MULTIPLE_EXACT_CANDIDATES');
    return report('AMBIGUOUS_REVIEW');
  }
  if (exactCandidates === 0) {
    block('NO_EXACT_CANDIDATE');
    return report('NO_EXACT_CANDIDATE_REVIEW');
  }
  // Candidate is private. A separate certified provider + durable evidence
  // transaction is required to move ATTEMPT_UNCERTAIN to CONFIRMED.
  return report('EXACT_CANDIDATE_UNCERTIFIED', candidates[0]!);
}
