import { createHash } from 'node:crypto';
import { hashSchema, idSchema } from '@autoreels/contracts';
import type { FrozenCommentListPlan } from './comment-list.js';

/** Private proposed readback only. A provider/author identity is not certified by this type. */
export interface ProviderCommentObservation {
  observationId: string;
  source: 'PROVIDER_READBACK';
  providerAppId: string;
  accountId: string;
  authorAccountId: string;
  targetId: string;
  externalPostId: string;
  externalCommentId: string;
  commentCreatedAt: string;
  observedAt: string;
  bodyUtf8Hash: string;
  bodyUtf8Bytes: number;
}
export interface PendingCommentEffect {
  effectId: string;
  jobId: string;
  state: 'ATTEMPT_UNCERTAIN';
  kind: 'COMMENT';
  effectKey: string;
  payloadHash: string;
  /** SQLite INTENT timestamp: not proof of actual device input time. */
  intentCreatedAt: string;
}
export type CommentCandidateBlocker =
  | 'EXPECTATION_INVALID'
  | 'EFFECT_NOT_UNCERTAIN'
  | 'READBACK_SET_INVALID'
  | 'READBACK_INVALID'
  | 'READBACK_STALE'
  | 'EXTERNAL_COMMENT_ID_COLLISION'
  | 'DUPLICATE_FROZEN_COMMENT_TEXT'
  | 'MULTIPLE_EXACT_CANDIDATES'
  | 'NO_EXACT_CANDIDATE';
export interface CommentCandidateSummary {
  scope: 'PRIVATE_COMMENT_CANDIDATE_NOT_PROVIDER_CERTIFIED';
  status: 'BLOCKED' | 'NO_EXACT_CANDIDATE_REVIEW' |
    'AMBIGUOUS_REVIEW' | 'EXACT_CANDIDATE_UNCERTIFIED';
  observationsChecked: number;
  exactCandidates: number;
  blockers: CommentCandidateBlocker[];
  canConfirm: false;
  canRetry: false;
  canDispatch: false;
}
export interface CommentCandidateAssessment {
  /** Never serialize candidate or raw frozen plan through StudioApi. */
  candidate: ProviderCommentObservation | null;
  summary: CommentCandidateSummary;
}

const MAX_OBSERVATIONS = 32;
const MAX_ITEMS = 32;
const MAX_BYTES = 32768;
const MAX_AGE_MS = 10 * 60 * 1000;
const MAX_AFTER_INTENT_MS = 30 * 60 * 1000;
const CLOCK_SKEW_MS = 10000;
const externalIdValid = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9._:-]{4,180}$/.test(v);
const isoTime = (v: unknown): number | null => {
  if (typeof v !== 'string') return null;
  const at = Date.parse(v);
  return Number.isFinite(at) && new Date(at).toISOString() === v ? at : null;
};

/**
 * S100.2 pre-verifier: a *single structurally matching* provider readback
 * remains uncertified; no match never proves a failed/unused comment attempt.
 * Duplicate frozen text across ordinals cannot be attributed by body alone.
 */
export function assessProviderCommentCandidates(input: {
  jobId: string;
  appId: string;
  accountId: string | null;
  targetId: string | null;
  parentExternalPostId: string;
  ordinal: number;
  effect: PendingCommentEffect;
  frozen: FrozenCommentListPlan;
  observations: readonly ProviderCommentObservation[];
  at: number;
}): CommentCandidateAssessment {
  const blockers: CommentCandidateBlocker[] = [];
  const block = (code: CommentCandidateBlocker): void => {
    if (!blockers.includes(code)) blockers.push(code);
  };
  let exactCandidates = 0;
  const report = (
    status: CommentCandidateSummary['status'],
    candidate: ProviderCommentObservation | null = null,
  ): CommentCandidateAssessment => ({
    candidate,
    summary: {
      scope: 'PRIVATE_COMMENT_CANDIDATE_NOT_PROVIDER_CERTIFIED',
      status,
      observationsChecked: Array.isArray(input.observations)
        ? Math.min(MAX_OBSERVATIONS, input.observations.length) : 0,
      exactCandidates, blockers,
      canConfirm: false, canRetry: false, canDispatch: false,
    },
  });
  const items = input.frozen?.items;
  if (!idSchema.safeParse(input.jobId).success ||
      !idSchema.safeParse(input.appId).success ||
      !idSchema.safeParse(input.accountId).success ||
      !idSchema.safeParse(input.targetId).success ||
      !externalIdValid(input.parentExternalPostId) ||
      !Number.isSafeInteger(input.ordinal) ||
      input.ordinal < 0 || input.ordinal >= MAX_ITEMS ||
      input.frozen?.scope !== 'FROZEN_COMMENT_LIST_NOT_PROVIDER_VERIFIED' ||
      input.frozen?.status !== 'FROZEN_COMMENTS_PROVIDER_UNVERIFIED' ||
      !Array.isArray(input.frozen?.blockers) || input.frozen.blockers.length !== 0 ||
      input.frozen.canConfirm !== false || input.frozen.canRetry !== false ||
      input.frozen.canDispatch !== false ||
      !Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS ||
      items.some((item, i) =>
        !item || item.ordinal !== i || typeof item.value !== 'string' ||
        !hashSchema.safeParse(item.utf8Hash).success ||
        !hashSchema.safeParse(item.effectKey).success ||
        !hashSchema.safeParse(item.payloadHash).success ||
        !Number.isSafeInteger(item.utf8Bytes) ||
        item.utf8Bytes <= 0 || item.utf8Bytes > MAX_BYTES ||
        Buffer.byteLength(item.value, 'utf8') !== item.utf8Bytes ||
        createHash('sha256').update(item.value, 'utf8').digest('hex') !== item.utf8Hash) ||
      !items[input.ordinal]) {
    block('EXPECTATION_INVALID');
    return report('BLOCKED');
  }
  const selected = items[input.ordinal]!;
  const intentTime = isoTime(input.effect?.intentCreatedAt);
  if (!idSchema.safeParse(input.effect?.effectId).success ||
      input.effect?.jobId !== input.jobId ||
      input.effect?.state !== 'ATTEMPT_UNCERTAIN' ||
      input.effect?.kind !== 'COMMENT' ||
      input.effect?.effectKey !== selected.effectKey ||
      input.effect?.payloadHash !== selected.payloadHash ||
      intentTime === null) {
    block('EFFECT_NOT_UNCERTAIN');
    return report('BLOCKED');
  }
  if (!Number.isSafeInteger(input.at) || input.at < intentTime ||
      !Array.isArray(input.observations) ||
      input.observations.length > MAX_OBSERVATIONS) {
    block('READBACK_SET_INVALID');
    return report('BLOCKED');
  }
  const readbackIds = new Set<string>(), providerCommentIds = new Set<string>();
  const matches: ProviderCommentObservation[] = [];
  for (const obs of input.observations) {
    const commentAt = isoTime(obs?.commentCreatedAt),
      observedAt = isoTime(obs?.observedAt);
    if (!obs || !idSchema.safeParse(obs.observationId).success ||
        obs.source !== 'PROVIDER_READBACK' ||
        !idSchema.safeParse(obs.providerAppId).success ||
        !idSchema.safeParse(obs.accountId).success ||
        !idSchema.safeParse(obs.authorAccountId).success ||
        !idSchema.safeParse(obs.targetId).success ||
        !externalIdValid(obs.externalPostId) ||
        !externalIdValid(obs.externalCommentId) ||
        !hashSchema.safeParse(obs.bodyUtf8Hash).success ||
        !Number.isSafeInteger(obs.bodyUtf8Bytes) ||
        obs.bodyUtf8Bytes <= 0 || obs.bodyUtf8Bytes > MAX_BYTES ||
        commentAt === null || observedAt === null ||
        observedAt < commentAt || observedAt > input.at) {
      block('READBACK_INVALID');
      continue;
    }
    if (readbackIds.has(obs.observationId)) block('READBACK_SET_INVALID');
    readbackIds.add(obs.observationId);
    if (providerCommentIds.has(obs.externalCommentId))
      block('EXTERNAL_COMMENT_ID_COLLISION');
    providerCommentIds.add(obs.externalCommentId);
    if (input.at - observedAt > MAX_AGE_MS) {
      block('READBACK_STALE');
      continue;
    }
    if (obs.providerAppId === input.appId &&
        obs.accountId === input.accountId &&
        obs.authorAccountId === input.accountId &&
        obs.targetId === input.targetId &&
        obs.externalPostId === input.parentExternalPostId &&
        commentAt >= intentTime - CLOCK_SKEW_MS &&
        commentAt <= intentTime + MAX_AFTER_INTENT_MS &&
        obs.bodyUtf8Hash === selected.utf8Hash &&
        obs.bodyUtf8Bytes === selected.utf8Bytes)
      matches.push(obs);
  }
  exactCandidates = matches.length;
  if (blockers.length) return report('BLOCKED');
  if (items.some((item, i) =>
    i !== input.ordinal && item.utf8Hash === selected.utf8Hash &&
    item.utf8Bytes === selected.utf8Bytes)) {
    block('DUPLICATE_FROZEN_COMMENT_TEXT');
    return report('AMBIGUOUS_REVIEW');
  }
  if (matches.length > 1) {
    block('MULTIPLE_EXACT_CANDIDATES');
    return report('AMBIGUOUS_REVIEW');
  }
  if (matches.length === 0) {
    block('NO_EXACT_CANDIDATE');
    return report('NO_EXACT_CANDIDATE_REVIEW');
  }
  return report('EXACT_CANDIDATE_UNCERTIFIED', matches[0]!);
}
