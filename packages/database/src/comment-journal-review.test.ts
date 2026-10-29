import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { contentHash } from '@autoreels/domain';
import {
  assessPersistedCommentJournal,
  type PersistedCommentJournalRow,
} from './comment-journal-review.js';
import type { FrozenCommentListPlan, FrozenCommentItem } from './comment-list.js';

const item = (ordinal: number, value: string): FrozenCommentItem => {
  const utf8Hash = createHash('sha256').update(value, 'utf8').digest('hex');
  return {
    ordinal, value, utf8Hash, utf8Bytes: Buffer.byteLength(value, 'utf8'),
    effectKey: contentHash({ domain: 'comment-effect', ordinal, utf8Hash }),
    payloadHash: contentHash({ domain: 'comment-payload', ordinal, utf8Hash }),
  };
};
function fixture() {
  const frozen: FrozenCommentListPlan = {
    scope: 'FROZEN_COMMENT_LIST_NOT_PROVIDER_VERIFIED',
    status: 'FROZEN_COMMENTS_PROVIDER_UNVERIFIED',
    blockers: [], canConfirm: false, canRetry: false, canDispatch: false,
    items: [item(0, 'Bình luận đầu 👋\r\nHai dòng'), item(1, 'Bình luận thứ hai')],
  };
  const row = (ordinal: number, state: string): PersistedCommentJournalRow => ({
    effectKey: frozen.items[ordinal]!.effectKey,
    payloadHash: frozen.items[ordinal]!.payloadHash,
    state,
  });
  return { frozen, row };
}

describe('S100.3 private persisted comment journal list (not provider certified)', () => {
  it('lists all frozen ordinals with no rows as UNVERIFIED and no send/retry rights', () => {
    const f = fixture(), before = JSON.stringify(f);
    const review = assessPersistedCommentJournal({ frozen: f.frozen, rows: [] });
    expect(review).toEqual({
      scope: 'PRIVATE_COMMENT_JOURNAL_NOT_PROVIDER_CERTIFIED',
      status: 'READ_ONLY_UNCERTIFIED', journalCount: 0,
      items: [
        { ordinal: 0, journal: 'NO_JOURNAL_UNVERIFIED' },
        { ordinal: 1, journal: 'NO_JOURNAL_UNVERIFIED' },
      ],
      blockers: [], canConfirm: false, canRetry: false, canDispatch: false,
    });
    expect(JSON.stringify(f)).toBe(before);
    const redacted = JSON.stringify(review);
    for (const secret of [f.frozen.items[0]!.value, f.frozen.items[0]!.effectKey,
      f.frozen.items[0]!.payloadHash, f.frozen.items[0]!.utf8Hash])
      expect(redacted).not.toContain(secret);
  });

  it.each([
    ['INTENT', 'INTENT_JOURNALED'],
    ['ATTEMPT_UNCERTAIN', 'ATTEMPT_UNCERTAIN'],
    ['NEEDS_REVIEW', 'NEEDS_REVIEW'],
    ['CONFIRMED', 'CONFIRMED_DB_ONLY'],
  ])('maps persisted %s to %s without treating it as provider proof', (state, expected) => {
    const f = fixture(), rows = [f.row(0, state)], before = JSON.stringify(rows);
    const review = assessPersistedCommentJournal({ frozen: f.frozen, rows });
    expect(review.status).toBe('READ_ONLY_UNCERTIFIED');
    expect(review.items).toEqual([
      { ordinal: 0, journal: expected },
      { ordinal: 1, journal: 'NO_JOURNAL_UNVERIFIED' },
    ]);
    expect(review.journalCount).toBe(1);
    expect(review.canRetry).toBe(false);
    expect(review.canConfirm).toBe(false);
    expect(review.canDispatch).toBe(false);
    expect(JSON.stringify(rows)).toBe(before);
  });

  it('retains list ordering across out-of-order persisted rows', () => {
    const f = fixture();
    const review = assessPersistedCommentJournal({
      frozen: f.frozen, rows: [f.row(1, 'CONFIRMED'), f.row(0, 'ATTEMPT_UNCERTAIN')],
    });
    expect(review.items).toEqual([
      { ordinal: 0, journal: 'ATTEMPT_UNCERTAIN' },
      { ordinal: 1, journal: 'CONFIRMED_DB_ONLY' },
    ]);
    expect(review.status).toBe('READ_ONLY_UNCERTIFIED');
  });

  it('blocks forged, malformed, duplicate, unbound and over-limit journals without partial results', () => {
    const errors: Array<{
      edit: (f: ReturnType<typeof fixture>, rows: PersistedCommentJournalRow[]) => void;
      blocker: string;
    }> = [
      { edit: (f, rows) => rows.push(f.row(0, 'CONFIRMED')),
        blocker: 'DUPLICATE_JOURNAL' },
      { edit: (_f, rows) => { rows[0]!.effectKey = contentHash('unbound_key'); },
        blocker: 'JOURNAL_BINDING_MISMATCH' },
      { edit: (_f, rows) => { rows[0]!.payloadHash = contentHash('forged_payload'); },
        blocker: 'JOURNAL_BINDING_MISMATCH' },
      { edit: (_f, rows) => { rows[0]!.state = 'DEFINITE_FAILURE_FROM_FIXTURE'; },
        blocker: 'JOURNAL_STATE_UNSUPPORTED' },
      { edit: (_f, rows) => { rows[0]!.effectKey = ''; },
        blocker: 'JOURNAL_SET_INVALID' },
      { edit: (f, rows) => {
        rows.splice(0, 1, ...Array.from({ length: 33 }, (_, i) => ({
          ...f.row(0, 'ATTEMPT_UNCERTAIN'),
          effectKey: contentHash({ forgedRow: i }),
        })));
      }, blocker: 'JOURNAL_SET_INVALID' },
    ];
    for (const { edit, blocker } of errors) {
      const f = fixture(), rows = [f.row(0, 'INTENT')];
      edit(f, rows);
      const before = JSON.stringify({ f, rows });
      const result = assessPersistedCommentJournal({ frozen: f.frozen, rows });
      expect(result).toMatchObject({
        status: 'BLOCKED', items: [], blockers: [blocker],
        canRetry: false, canConfirm: false, canDispatch: false,
      });
      expect(JSON.stringify({ f, rows })).toBe(before);
    }
  });

  it('fails closed on contradictory frozen-list flags and invalid item metadata', () => {
    const mutations: Array<(f: ReturnType<typeof fixture>) => void> = [
      f => { f.frozen.blockers = ['COMMENT_LIST_INVALID']; },
      f => { f.frozen.blockers = null as never; },
      f => { f.frozen.canConfirm = true as never; },
      f => { f.frozen.canRetry = true as never; },
      f => { f.frozen.canDispatch = true as never; },
      f => { delete (f.frozen as { canRetry?: boolean }).canRetry; },
      f => { f.frozen.items[0]!.utf8Hash = contentHash('forged_unicode'); },
      f => { f.frozen.items[1]!.effectKey = f.frozen.items[0]!.effectKey; },
      f => { f.frozen.items[0]!.utf8Bytes++; },
    ];
    for (const mutate of mutations) {
      const f = fixture(); mutate(f);
      const result = assessPersistedCommentJournal({ frozen: f.frozen, rows: [] });
      expect(result).toMatchObject({
        status: 'BLOCKED', items: [], blockers: ['FROZEN_PLAN_INVALID'],
        canConfirm: false, canRetry: false, canDispatch: false,
      });
    }
  });
});
