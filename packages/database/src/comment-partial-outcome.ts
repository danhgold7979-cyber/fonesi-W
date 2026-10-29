import { idSchema } from '@autoreels/contracts';
import type { CommentJournalListReview, CommentJournalOrdinalState } from './comment-journal-review.js';

/** Persisted effects are DB records, never independently authenticated provider receipts. */
export interface PersistedPublishReviewRow {
  id: string;
  kind: string;
  state: string;
}
export type CommentPartialOutcomeBlocker =
  | 'JOB_REVIEW_PHASE_INVALID'
  | 'PUBLISH_JOURNAL_INVALID'
  | 'COMMENT_JOURNAL_INVALID';
export type CommentPartialOutcomeStatus =
  | 'BLOCKED'
  | 'COMMENT_UNCERTAIN_REVIEW'
  | 'PARTIAL_DB_ONLY_REVIEW'
  | 'ALL_COMMENTS_DB_ONLY_REVIEW';
export interface CommentPartialOutcomeReview {
  scope: 'PRIVATE_COMMENT_PARTIAL_OUTCOME_NOT_PROVIDER_CERTIFIED';
  status: CommentPartialOutcomeStatus;
  /** Only aggregate, redacted DB state counts; not success/proof of failure. */
  totalOrdinals: number;
  dbConfirmed: number;
  dbRejected: number;
  unresolvedOrUnsent: number;
  blockers: CommentPartialOutcomeBlocker[];
  providerCertification: 'NOT_AVAILABLE';
  canMarkSuccessWithWarnings: false;
  canConfirm: false;
  canRetry: false;
  canDispatch: false;
  canCleanup: false;
}
const reviewablePhases = new Set(['POSTED', 'COMMENT_PENDING', 'NEEDS_REVIEW']);
const allowedOrdinalStates = new Set<CommentJournalOrdinalState>([
  'NO_JOURNAL_UNVERIFIED',
  'INTENT_JOURNALED',
  'ATTEMPT_UNCERTAIN',
  'NEEDS_REVIEW',
  'CONFIRMED_DB_ONLY',
  'DEFINITIVELY_REJECTED_DB_ONLY',
]);

/**
 * S101.2 pre-provider partial-result classifier: a DB-only definite-rejection
 * row is never enough to produce SUCCESS_WITH_WARNINGS or to permit retry.
 * Unknown/missing journals always take priority over apparent partial results.
 */
export function assessPersistedCommentPartialOutcome(input: {
  jobState: string;
  parentEffectId: string;
  publishRows: readonly PersistedPublishReviewRow[];
  commentJournal: CommentJournalListReview;
}): CommentPartialOutcomeReview {
  const blockers: CommentPartialOutcomeBlocker[] = [];
  const block = (code: CommentPartialOutcomeBlocker): void => {
    if (!blockers.includes(code)) blockers.push(code);
  };
  const report = (
    status: CommentPartialOutcomeStatus,
    counts: { total: number; confirmed: number; rejected: number; unresolved: number } =
      { total: 0, confirmed: 0, rejected: 0, unresolved: 0 },
  ): CommentPartialOutcomeReview => ({
    scope: 'PRIVATE_COMMENT_PARTIAL_OUTCOME_NOT_PROVIDER_CERTIFIED',
    status,
    totalOrdinals: counts.total,
    dbConfirmed: counts.confirmed,
    dbRejected: counts.rejected,
    unresolvedOrUnsent: counts.unresolved,
    blockers,
    providerCertification: 'NOT_AVAILABLE',
    canMarkSuccessWithWarnings: false,
    canConfirm: false,
    canRetry: false,
    canDispatch: false,
    canCleanup: false,
  });

  if (!reviewablePhases.has(input.jobState))
    block('JOB_REVIEW_PHASE_INVALID');
  if (!idSchema.safeParse(input.parentEffectId).success ||
      !Array.isArray(input.publishRows) || input.publishRows.length !== 1 ||
      !input.publishRows[0] ||
      !idSchema.safeParse(input.publishRows[0].id).success ||
      input.publishRows[0].id !== input.parentEffectId ||
      input.publishRows[0].kind !== 'PUBLISH' ||
      input.publishRows[0].state !== 'CONFIRMED')
    block('PUBLISH_JOURNAL_INVALID');

  const journal = input.commentJournal;
  const items = journal?.items;
  if (journal?.scope !== 'PRIVATE_COMMENT_JOURNAL_NOT_PROVIDER_CERTIFIED' ||
      journal.status !== 'READ_ONLY_UNCERTIFIED' ||
      !Array.isArray(journal.blockers) || journal.blockers.length !== 0 ||
      journal.canConfirm !== false || journal.canRetry !== false ||
      journal.canDispatch !== false ||
      !Array.isArray(items) || items.length === 0 || items.length > 32 ||
      !Number.isSafeInteger(journal.journalCount) ||
      journal.journalCount < 0 || journal.journalCount > 32 ||
      items.some((item, index) =>
        !item || item.ordinal !== index ||
        !allowedOrdinalStates.has(item.journal)))
    block('COMMENT_JOURNAL_INVALID');
  if (blockers.length) return report('BLOCKED');

  const total = items.length;
  let confirmed = 0, rejected = 0, unresolved = 0, found = 0;
  for (const item of items) {
    if (item.journal !== 'NO_JOURNAL_UNVERIFIED') found++;
    if (item.journal === 'CONFIRMED_DB_ONLY') confirmed++;
    else if (item.journal === 'DEFINITIVELY_REJECTED_DB_ONLY') rejected++;
    else unresolved++;
  }
  // Reject forged/truncated journal counts, never infer an unobserved send.
  if (found !== journal.journalCount) {
    block('COMMENT_JOURNAL_INVALID');
    return report('BLOCKED');
  }
  const counts = { total, confirmed, rejected, unresolved };
  if (unresolved > 0) return report('COMMENT_UNCERTAIN_REVIEW', counts);
  if (rejected > 0) return report('PARTIAL_DB_ONLY_REVIEW', counts);
  return report('ALL_COMMENTS_DB_ONLY_REVIEW', counts);
}
