import { describe, expect, it } from 'vitest';
import { contentHash } from '@autoreels/domain';
import { createHash } from 'node:crypto';
import {
  assessProviderCommentCandidates,
  type PendingCommentEffect,
  type ProviderCommentObservation,
} from './comment-verification.js';
import type { FrozenCommentListPlan, FrozenCommentItem } from './comment-list.js';

const attemptedAt = '2026-10-29T11:00:00.000Z';
const now = Date.parse('2026-10-29T11:15:00.000Z');
const item = (ordinal: number, value: string): FrozenCommentItem => {
  const utf8Hash = createHash('sha256').update(value, 'utf8').digest('hex');
  return {
    ordinal, value, utf8Hash, utf8Bytes: Buffer.byteLength(value, 'utf8'),
    effectKey: contentHash({ domain: 'effect', ordinal, utf8Hash }),
    payloadHash: contentHash({ domain: 'payload', ordinal, utf8Hash }),
  };
};
function fixture() {
  const frozen: FrozenCommentListPlan = {
    scope: 'FROZEN_COMMENT_LIST_NOT_PROVIDER_VERIFIED',
    status: 'FROZEN_COMMENTS_PROVIDER_UNVERIFIED', blockers: [],
    items: [item(0, 'Thứ nhất 👋\r\nDòng 2'), item(1, 'Bình luận thứ hai')],
    canConfirm: false, canRetry: false, canDispatch: false,
  };
  const effect: PendingCommentEffect = {
    effectId: 'effect_comment', jobId: 'job_comment',
    kind: 'COMMENT', state: 'ATTEMPT_UNCERTAIN',
    effectKey: frozen.items[0]!.effectKey,
    payloadHash: frozen.items[0]!.payloadHash,
    intentCreatedAt: attemptedAt,
  };
  const observation: ProviderCommentObservation = {
    observationId: 'observation_comment',
    source: 'PROVIDER_READBACK',
    providerAppId: 'fb', accountId: 'account_pinned', authorAccountId: 'account_pinned',
    targetId: 'target_pinned',
    externalPostId: 'post_123456', externalCommentId: 'comment_123456',
    commentCreatedAt: '2026-10-29T11:00:10.000Z',
    observedAt: '2026-10-29T11:14:00.000Z',
    bodyUtf8Hash: frozen.items[0]!.utf8Hash,
    bodyUtf8Bytes: frozen.items[0]!.utf8Bytes,
  };
  return {
    jobId: 'job_comment', appId: 'fb', accountId: 'account_pinned',
    targetId: 'target_pinned', parentExternalPostId: 'post_123456',
    ordinal: 0, effect, frozen, observations: [observation], at: now,
  };
}
const assess = (f: ReturnType<typeof fixture>) => assessProviderCommentCandidates(f);

describe('S100.2 private comment candidate readback, never certified or safe retry', () => {
  it('identifies a single exact candidate only privately, never certifies a comment', () => {
    const f = fixture(), before = JSON.stringify(f);
    const result = assess(f);
    expect(result.summary).toEqual({
      scope: 'PRIVATE_COMMENT_CANDIDATE_NOT_PROVIDER_CERTIFIED',
      status: 'EXACT_CANDIDATE_UNCERTIFIED',
      observationsChecked: 1, exactCandidates: 1, blockers: [],
      canConfirm: false, canRetry: false, canDispatch: false,
    });
    expect(result.candidate).toEqual(f.observations[0]);
    const shown = JSON.stringify(result.summary);
    for (const secret of ['account_pinned','post_123456','comment_123456',
      'Thứ nhất','Bình luận thứ hai', f.frozen.items[0]!.effectKey,
      f.frozen.items[0]!.utf8Hash])
      expect(shown).not.toContain(secret);
    expect(JSON.stringify(f)).toBe(before);
  });
  it('rejects forged frozen planning blockers and execution rights before matching', () => {
    const mutations: Array<(f: ReturnType<typeof fixture>) => void> = [
      f => { f.frozen.blockers = ['UNVERIFIED'] as never; },
      f => { f.frozen.blockers = null as never; },
      f => { f.frozen.canConfirm = true as never; },
      f => { f.frozen.canRetry = true as never; },
      f => { f.frozen.canDispatch = true as never; },
      f => { delete (f.frozen as { canRetry?: boolean }).canRetry; },
    ];
    for (const mutate of mutations) {
      const f = fixture();
      mutate(f);
      const before = JSON.stringify(f);
      expect(assess(f)).toMatchObject({
        candidate: null,
        summary: {
          status: 'BLOCKED', blockers: ['EXPECTATION_INVALID'],
          exactCandidates: 0, canConfirm: false, canRetry: false, canDispatch: false,
        },
      });
      expect(JSON.stringify(f)).toBe(before);
    }
  });
  it('cannot use an empty scan to infer definitive failure or permission to retry', () => {
    const f = fixture();f.observations = [];
    expect(assess(f)).toMatchObject({
      candidate: null, summary: { status: 'NO_EXACT_CANDIDATE_REVIEW',
        blockers: ['NO_EXACT_CANDIDATE'], canRetry: false, canConfirm: false,
      },
    });
  });
  it('refuses to attribute identical comments to an ordinal based on body alone', () => {
    const f = fixture();f.frozen.items[1] = item(1,f.frozen.items[0]!.value);
    expect(assess(f)).toMatchObject({
      candidate: null,summary:{status:'AMBIGUOUS_REVIEW',
      blockers:['DUPLICATE_FROZEN_COMMENT_TEXT'],exactCandidates:1},
    });
  });
  it('refuses a second identical candidate with a distinct provider comment ID', () => {
    const f=fixture();f.observations.push({...f.observations[0]!,
      observationId:'observation_other',externalCommentId:'comment_other'});
    expect(assess(f)).toMatchObject({
      candidate:null,summary:{status:'AMBIGUOUS_REVIEW',
        blockers:['MULTIPLE_EXACT_CANDIDATES'],exactCandidates:2},
    });
  });
  it('blocks duplicate provider/observation IDs rather than counting a repeated scan as proof', () => {
    for(const field of ['observationId','externalCommentId'] as const){
      const f=fixture(),second={...f.observations[0]!,
        observationId:'observation_other',externalCommentId:'comment_other'};
      second[field]=f.observations[0]![field];
      f.observations.push(second);
      expect(assess(f).summary.status).toBe('BLOCKED');
    }
  });
  it('blocks more than 32 observations without selecting from a truncated result',()=>{
    const f=fixture();f.observations=Array.from({length:33},(_,i)=>({
      ...f.observations[0]!,observationId:'observed_'+i,
      externalCommentId:'comment_'+i,
    }));
    expect(assess(f)).toMatchObject({candidate:null,
      summary:{status:'BLOCKED',blockers:['READBACK_SET_INVALID'],
        observationsChecked:32,canRetry:false}});
  });
  const cases: {name:string; edit:(f:ReturnType<typeof fixture>)=>void;
    expected:'BLOCKED'|'NO_EXACT_CANDIDATE_REVIEW'}[]=[
    {name:'wrong provider app',edit:f=>{f.observations[0]!.providerAppId='tt';},expected:'NO_EXACT_CANDIDATE_REVIEW'},
    {name:'wrong provider account',edit:f=>{f.observations[0]!.accountId='account_other';},expected:'NO_EXACT_CANDIDATE_REVIEW'},
    {name:'wrong comment author',edit:f=>{f.observations[0]!.authorAccountId='account_other';},expected:'NO_EXACT_CANDIDATE_REVIEW'},
    {name:'wrong destination target',edit:f=>{f.observations[0]!.targetId='target_other';},expected:'NO_EXACT_CANDIDATE_REVIEW'},
    {name:'wrong parent external post',edit:f=>{f.observations[0]!.externalPostId='post_999999';},expected:'NO_EXACT_CANDIDATE_REVIEW'},
    {name:'wrong exact Unicode hash',edit:f=>{f.observations[0]!.bodyUtf8Hash='a'.repeat(64);},expected:'NO_EXACT_CANDIDATE_REVIEW'},
    {name:'wrong byte count',edit:f=>{f.observations[0]!.bodyUtf8Bytes++;},expected:'NO_EXACT_CANDIDATE_REVIEW'},
    {name:'comment before window',edit:f=>{f.observations[0]!.commentCreatedAt='2026-10-29T10:59:00.000Z';},expected:'NO_EXACT_CANDIDATE_REVIEW'},
    {name:'comment after bounded window',edit:f=>{f.observations[0]!.commentCreatedAt='2026-10-29T11:32:00.000Z';f.observations[0]!.observedAt='2026-10-29T11:32:10.000Z';f.at=Date.parse('2026-10-29T11:32:20.000Z');},expected:'NO_EXACT_CANDIDATE_REVIEW'},
    {name:'stale readback',edit:f=>{f.observations[0]!.observedAt='2026-10-29T11:03:00.000Z';},expected:'BLOCKED'},
    {name:'future readback',edit:f=>{f.observations[0]!.observedAt='2026-10-29T11:16:00.000Z';},expected:'BLOCKED'},
    {name:'invalid source',edit:f=>{f.observations[0]!.source='UI_ONLY' as never;},expected:'BLOCKED'},
    {name:'invalid external comment ID',edit:f=>{f.observations[0]!.externalCommentId='';},expected:'BLOCKED'},
    {name:'corrupt snapshot-derived hash',edit:f=>{f.frozen.items[0]!.utf8Hash='f'.repeat(64);},expected:'BLOCKED'},
    {name:'unverified parent account',edit:f=>{f.accountId=null as never;},expected:'BLOCKED'},
    {name:'non-uncertain persisted effect',edit:f=>{f.effect.state='CONFIRMED' as never;},expected:'BLOCKED'},
    {name:'mismatched journal payload',edit:f=>{f.effect.payloadHash='b'.repeat(64);},expected:'BLOCKED'},
    {name:'wrong frozen ordinal',edit:f=>{f.ordinal=1;},expected:'BLOCKED'},
    {name:'missing expected parent external ID',edit:f=>{f.parentExternalPostId='';},expected:'BLOCKED'},
    {name:'malformed observation timestamp',edit:f=>{f.observations[0]!.observedAt='tomorrow';},expected:'BLOCKED'},
  ];
  for(const {name,edit,expected} of cases){
    it('fails closed or requires review for '+name,()=>{
      const f=fixture();edit(f);const before=JSON.stringify(f);
      const result=assess(f);
      expect(result.summary.status).toBe(expected);
      expect(result.candidate).toBeNull();
      expect(result.summary.canRetry).toBe(false);
      expect(result.summary.canConfirm).toBe(false);
      expect(result.summary.canDispatch).toBe(false);
      expect(JSON.stringify(f)).toBe(before);
      expect(JSON.stringify(result.summary)).not.toContain('account_pinned');
    });
  }
});
