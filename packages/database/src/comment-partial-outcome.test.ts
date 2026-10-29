import { describe, expect, it } from 'vitest';
import {
  assessPersistedCommentPartialOutcome,
  type PersistedPublishReviewRow,
} from './comment-partial-outcome.js';
import type {
  CommentJournalListReview,
  CommentJournalOrdinalState,
} from './comment-journal-review.js';

function fixture() {
  const parentEffectId = 'effect_confirmed_parent';
  const publishRows: PersistedPublishReviewRow[] = [{
    id: parentEffectId, kind: 'PUBLISH', state: 'CONFIRMED',
  }];
  const commentJournal: CommentJournalListReview = {
    scope: 'PRIVATE_COMMENT_JOURNAL_NOT_PROVIDER_CERTIFIED',
    status: 'READ_ONLY_UNCERTIFIED',
    items: [
      { ordinal: 0, journal: 'NO_JOURNAL_UNVERIFIED' },
      { ordinal: 1, journal: 'NO_JOURNAL_UNVERIFIED' },
      { ordinal: 2, journal: 'NO_JOURNAL_UNVERIFIED' },
    ],
    journalCount: 0,
    blockers: [],
    canConfirm: false, canRetry: false, canDispatch: false,
  };
  const set = (...states: CommentJournalOrdinalState[]) => {
    commentJournal.items = states.map((journal, ordinal) => ({ ordinal, journal }));
    commentJournal.journalCount = states.filter(
      s => s !== 'NO_JOURNAL_UNVERIFIED',
    ).length;
  };
  return {
    jobState: 'NEEDS_REVIEW', parentEffectId, publishRows,
    commentJournal, set,
  };
}

describe('S101.2 DB-only partial comment outcome cannot certify a provider result', () => {
  it('treats absent frozen comment journals as unresolved, not safe to send', () => {
    const f = fixture(), before = JSON.stringify(f);
    const result = assessPersistedCommentPartialOutcome(f);
    expect(result).toEqual({
      scope: 'PRIVATE_COMMENT_PARTIAL_OUTCOME_NOT_PROVIDER_CERTIFIED',
      status: 'COMMENT_UNCERTAIN_REVIEW',
      totalOrdinals: 3, dbConfirmed: 0, dbRejected: 0, unresolvedOrUnsent: 3,
      blockers: [], providerCertification: 'NOT_AVAILABLE',
      canMarkSuccessWithWarnings: false,
      canConfirm: false, canRetry: false, canDispatch: false, canCleanup: false,
    });
    expect(JSON.stringify(f)).toBe(before);
  });
  it('classifies only complete DB journals with a definite rejection as partial review', () => {
    const f = fixture();
    f.set('CONFIRMED_DB_ONLY', 'DEFINITIVELY_REJECTED_DB_ONLY',
      'CONFIRMED_DB_ONLY');
    const result = assessPersistedCommentPartialOutcome(f);
    expect(result).toMatchObject({
      status: 'PARTIAL_DB_ONLY_REVIEW',
      totalOrdinals: 3, dbConfirmed: 2, dbRejected: 1, unresolvedOrUnsent: 0,
      providerCertification: 'NOT_AVAILABLE',
      canMarkSuccessWithWarnings: false, canRetry: false, canCleanup: false,
    });
    expect(JSON.stringify(result)).not.toContain(f.parentEffectId);
  });
  it('never treats persisted confirmation of every comment as external success', () => {
    const f = fixture();
    f.set('CONFIRMED_DB_ONLY', 'CONFIRMED_DB_ONLY', 'CONFIRMED_DB_ONLY');
    expect(assessPersistedCommentPartialOutcome(f)).toMatchObject({
      status: 'ALL_COMMENTS_DB_ONLY_REVIEW',
      dbConfirmed: 3, dbRejected: 0, unresolvedOrUnsent: 0,
      canConfirm: false, canMarkSuccessWithWarnings: false,
    });
  });
  it('keeps uncertainty above alleged DB rejection even if another ordinal is confirmed', () => {
    const f = fixture();
    for (const unsafe of [
      'NO_JOURNAL_UNVERIFIED', 'INTENT_JOURNALED',
      'ATTEMPT_UNCERTAIN', 'NEEDS_REVIEW',
    ] as const) {
      f.set('CONFIRMED_DB_ONLY', 'DEFINITIVELY_REJECTED_DB_ONLY', unsafe);
      expect(assessPersistedCommentPartialOutcome(f)).toMatchObject({
        status: 'COMMENT_UNCERTAIN_REVIEW',
        dbConfirmed: 1, dbRejected: 1, unresolvedOrUnsent: 1,
        canDispatch: false, canRetry: false,
      });
    }
  });
  it('rejects job phase, missing/duplicate/wrong parent and forged noncertified journal rights', () => {
    const invalidCases: Array<{
      name: string;
      edit: (f: ReturnType<typeof fixture>) => void;
      blocker: string;
    }> = [
      { name: 'wrong job state', edit: f => { f.jobState = 'RUNNING'; },
        blocker: 'JOB_REVIEW_PHASE_INVALID' },
      { name: 'wrong post identity', edit: f => { f.publishRows[0]!.id = 'effect_wrong'; },
        blocker: 'PUBLISH_JOURNAL_INVALID' },
      { name: 'no post record', edit: f => { f.publishRows = []; },
        blocker: 'PUBLISH_JOURNAL_INVALID' },
      { name: 'two post records', edit: f => {
        f.publishRows.push({ ...f.publishRows[0]!, id: 'effect_second' });
      }, blocker: 'PUBLISH_JOURNAL_INVALID' },
      { name: 'wrong post kind', edit: f => { f.publishRows[0]!.kind = 'COMMENT'; },
        blocker: 'PUBLISH_JOURNAL_INVALID' },
      { name: 'post still uncertain', edit: f => {
        f.publishRows[0]!.state = 'ATTEMPT_UNCERTAIN';
      }, blocker: 'PUBLISH_JOURNAL_INVALID' },
      { name: 'invalid post ID', edit: f => { f.parentEffectId = ''; },
        blocker: 'PUBLISH_JOURNAL_INVALID' },
      { name: 'forged review scope', edit: f => {
        f.commentJournal.scope = 'FORGED' as never;
      }, blocker: 'COMMENT_JOURNAL_INVALID' },
      { name: 'pretend certified review', edit: f => {
        f.commentJournal.canConfirm = true as never;
      }, blocker: 'COMMENT_JOURNAL_INVALID' },
      { name: 'pretend retry rights', edit: f => {
        f.commentJournal.canRetry = true as never;
      }, blocker: 'COMMENT_JOURNAL_INVALID' },
      { name: 'nonempty blockers', edit: f => {
        f.commentJournal.status = 'BLOCKED';
        f.commentJournal.blockers = ['JOURNAL_BINDING_MISMATCH'];
      }, blocker: 'COMMENT_JOURNAL_INVALID' },
      { name: 'wrong journal count', edit: f => {
        f.set('CONFIRMED_DB_ONLY', 'DEFINITIVELY_REJECTED_DB_ONLY');
        f.commentJournal.journalCount = 0;
      }, blocker: 'COMMENT_JOURNAL_INVALID' },
      { name: 'duplicate ordinal', edit: f => {
        f.commentJournal.items[1]!.ordinal = 0;
      }, blocker: 'COMMENT_JOURNAL_INVALID' },
      { name: 'unknown state', edit: f => {
        f.commentJournal.items[1]!.journal = 'CERTIFIED' as never;
      }, blocker: 'COMMENT_JOURNAL_INVALID' },
      { name: 'oversized list', edit: f => {
        f.set(...Array.from({ length: 33 }, () => 'CONFIRMED_DB_ONLY' as const));
      }, blocker: 'COMMENT_JOURNAL_INVALID' },
      { name: 'truncated summary', edit: f => { f.commentJournal.items = []; },
        blocker: 'COMMENT_JOURNAL_INVALID' },
    ];
    for (const {name,edit,blocker} of invalidCases) {
      const f = fixture(); edit(f);
      const before = JSON.stringify(f);
      const result = assessPersistedCommentPartialOutcome(f);
      expect(result, name).toMatchObject({
        status: 'BLOCKED', totalOrdinals: 0, dbConfirmed: 0, dbRejected: 0,
        unresolvedOrUnsent: 0, blockers: [blocker],
        canMarkSuccessWithWarnings: false,
        canConfirm: false, canRetry: false, canDispatch: false, canCleanup: false,
      });
      expect(JSON.stringify(f), name).toBe(before);
    }
  });
});
