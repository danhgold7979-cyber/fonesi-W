import { createHash } from 'node:crypto';
import { hashSchema } from '@autoreels/contracts';
import type { FrozenCommentListPlan } from './comment-list.js';

/** SQLite-only input. These rows are NOT independently certified provider results. */
export interface PersistedCommentJournalRow {
  effectKey: string;
  payloadHash: string;
  state: string;
}

export type CommentJournalOrdinalState =
  | 'NO_JOURNAL_UNVERIFIED'
  | 'INTENT_JOURNALED'
  | 'ATTEMPT_UNCERTAIN'
  | 'NEEDS_REVIEW'
  | 'CONFIRMED_DB_ONLY';
export type CommentJournalReviewBlocker =
  | 'FROZEN_PLAN_INVALID'
  | 'JOURNAL_SET_INVALID'
  | 'JOURNAL_BINDING_MISMATCH'
  | 'DUPLICATE_JOURNAL'
  | 'JOURNAL_STATE_UNSUPPORTED';
export interface CommentJournalListReview {
  scope: 'PRIVATE_COMMENT_JOURNAL_NOT_PROVIDER_CERTIFIED';
  status: 'BLOCKED' | 'READ_ONLY_UNCERTIFIED';
  /** Only ordinal/status. No comment value, hash, journal ID or account identity. */
  items: Array<{ ordinal: number; journal: CommentJournalOrdinalState }>;
  journalCount: number;
  blockers: CommentJournalReviewBlocker[];
  canConfirm: false;
  canRetry: false;
  canDispatch: false;
}
const MAX_ITEMS = 32;
const MAX_BYTES = 32768;

/**
 * S100.3 read-only journal reconciliation. The database can attest what it
 * recorded, NOT what a provider actually published. A missing journal never
 * authorizes a new send; even DB-only CONFIRMED cannot certify a provider post.
 */
export function assessPersistedCommentJournal(input: {
  frozen: FrozenCommentListPlan;
  rows: readonly PersistedCommentJournalRow[];
}): CommentJournalListReview {
  const blockers: CommentJournalReviewBlocker[] = [];
  const block = (reason: CommentJournalReviewBlocker): void => {
    if (!blockers.includes(reason)) blockers.push(reason);
  };
  const report = (
    items: CommentJournalListReview['items'] = [],
  ): CommentJournalListReview => ({
    scope: 'PRIVATE_COMMENT_JOURNAL_NOT_PROVIDER_CERTIFIED',
    status: blockers.length ? 'BLOCKED' : 'READ_ONLY_UNCERTIFIED',
    items: blockers.length ? [] : items,
    journalCount: Array.isArray(input.rows)
      ? Math.min(MAX_ITEMS, input.rows.length) : 0,
    blockers,
    canConfirm: false,
    canRetry: false,
    canDispatch: false,
  });
  const frozenItems = input.frozen?.items;
  if (input.frozen?.scope !== 'FROZEN_COMMENT_LIST_NOT_PROVIDER_VERIFIED' ||
      input.frozen?.status !== 'FROZEN_COMMENTS_PROVIDER_UNVERIFIED' ||
      !Array.isArray(input.frozen?.blockers) || input.frozen.blockers.length !== 0 ||
      input.frozen.canConfirm !== false || input.frozen.canRetry !== false ||
      input.frozen.canDispatch !== false ||
      !Array.isArray(frozenItems) || frozenItems.length === 0 ||
      frozenItems.length > MAX_ITEMS ||
      frozenItems.some((item, ordinal) =>
        !item || item.ordinal !== ordinal || typeof item.value !== 'string' ||
        !hashSchema.safeParse(item.utf8Hash).success ||
        !hashSchema.safeParse(item.effectKey).success ||
        !hashSchema.safeParse(item.payloadHash).success ||
        !Number.isSafeInteger(item.utf8Bytes) || item.utf8Bytes <= 0 ||
        item.utf8Bytes > MAX_BYTES ||
        Buffer.byteLength(item.value, 'utf8') !== item.utf8Bytes ||
        createHash('sha256').update(item.value, 'utf8').digest('hex') !== item.utf8Hash)) {
    block('FROZEN_PLAN_INVALID');
    return report();
  }

  const expected = new Map(frozenItems.map(item => [item.effectKey, item]));
  if (expected.size !== frozenItems.length) {
    block('FROZEN_PLAN_INVALID');
    return report();
  }
  if (!Array.isArray(input.rows) || input.rows.length > MAX_ITEMS) {
    block('JOURNAL_SET_INVALID');
    return report();
  }

  const byKey = new Map<string, CommentJournalOrdinalState>();
  for (const row of input.rows) {
    if (!row || !hashSchema.safeParse(row.effectKey).success ||
        !hashSchema.safeParse(row.payloadHash).success) {
      block('JOURNAL_SET_INVALID');
      continue;
    }
    const item = expected.get(row.effectKey);
    if (!item || row.payloadHash !== item.payloadHash) {
      block('JOURNAL_BINDING_MISMATCH');
      continue;
    }
    if (byKey.has(row.effectKey)) {
      block('DUPLICATE_JOURNAL');
      continue;
    }
    const state: CommentJournalOrdinalState | null =
      row.state === 'INTENT' ? 'INTENT_JOURNALED' :
      row.state === 'ATTEMPT_UNCERTAIN' ? 'ATTEMPT_UNCERTAIN' :
      row.state === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' :
      row.state === 'CONFIRMED' ? 'CONFIRMED_DB_ONLY' : null;
    if (!state) {
      block('JOURNAL_STATE_UNSUPPORTED');
      continue;
    }
    byKey.set(row.effectKey, state);
  }
  if (blockers.length) return report();
  return report(frozenItems.map(item => ({
    ordinal: item.ordinal,
    journal: byKey.get(item.effectKey) ?? 'NO_JOURNAL_UNVERIFIED',
  })));
}
