import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { JobSnapshot, WorkflowBundle } from '@autoreels/contracts';
import { contentHash } from '@autoreels/domain';
import { deriveFrozenCommentList } from './comment-list.js';

const caption = 'Tiếng Việt 👩🏽‍💻\r\nDòng thứ hai';
function fixture() {
  const bundle: WorkflowBundle = {
    format: 'autoreels-workflow', schemaVersion: 2,
    workflow: { id: 'workflow_comments', appId: 'fb', name: 'Comments', kind: 'main' },
    mainGraphId: 'main', graphs: [], outputs: [], dependencies: [],
    inputs: [{
      key: 'comments', type: 'list', scope: 'row', required: true, itemType: 'text',
    }],
  };
  const snapshot: JobSnapshot = {
    workflowVersionId: 'version_comments', workflowHash: contentHash(bundle),
    bundle, contentId: 'content_comments',
    fields: { comments: [caption, caption, 'Xin chào!'] }, assetIds: [],
    targetId: 'target_comments', accountId: 'account_comments', networkProfileId: null,
  };
  return {
    jobId: 'job_comments', snapshot, snapshotHash: contentHash(snapshot),
    postEffectId: 'effect_post_confirmed', postEffectKey: 'c'.repeat(64),
    fieldKey: 'comments', scope: 'row' as const,
  };
}
const read = (f: ReturnType<typeof fixture>) => deriveFrozenCommentList(f);

describe('S100.1 private frozen ordered comment items: never provider/dispatch proof', () => {
  it('preserves UTF-8, CRLF and multiline, even duplicate texts have distinct ordinal keys', () => {
    const f = fixture(), before = JSON.stringify(f);
    const result = read(f);
    expect(result).toMatchObject({
      scope: 'FROZEN_COMMENT_LIST_NOT_PROVIDER_VERIFIED',
      status: 'FROZEN_COMMENTS_PROVIDER_UNVERIFIED',
      blockers: [], canDispatch: false, canRetry: false, canConfirm: false,
    });
    expect(result.items).toHaveLength(3);
    expect(result.items.map(x => x.ordinal)).toEqual([0, 1, 2]);
    expect(result.items.map(x => x.value)).toEqual([caption, caption, 'Xin chào!']);
    expect(result.items[0]?.utf8Hash).toBe(
      createHash('sha256').update(caption).digest('hex'),
    );
    expect(result.items[0]?.utf8Bytes).toBe(Buffer.byteLength(caption));
    expect(result.items[0]?.utf8Hash).toBe(result.items[1]?.utf8Hash);
    expect(result.items[0]?.effectKey).not.toBe(result.items[1]?.effectKey);
    expect(result.items[0]?.payloadHash).not.toBe(result.items[1]?.payloadHash);
    expect(JSON.stringify(f)).toBe(before);
  });

  it('uses frozen snapshot, parent publish and scope in each deterministic key', () => {
    const f = fixture(), original = read(f);
    expect(read(f)).toEqual(original);
    const g = fixture(); g.postEffectId = 'effect_other_confirmed';
    expect(read(g).items[0]?.effectKey).not.toBe(original.items[0]?.effectKey);
    const h = fixture(); h.scope = 'process' as 'row';
    h.snapshot.bundle.inputs[0]!.scope = 'process';
    h.snapshot.processFields = { comments: [caption] };
    h.snapshotHash = contentHash(h.snapshot);
    expect(read(h).items[0]?.effectKey).not.toBe(original.items[0]?.effectKey);
    expect(read(h).status).toBe('FROZEN_COMMENTS_PROVIDER_UNVERIFIED');
  });

  const bad: { name: string; code: string; mutate: (f: ReturnType<typeof fixture>) => void; keepHash?: boolean }[] = [
    { name: 'tampered job snapshot', code: 'FROZEN_SNAPSHOT_MISMATCH',
      mutate: f => { f.snapshot.fields.comments = ['Edited after scheduling']; }, keepHash: true },
    { name: 'invalid parent effect', code: 'POST_BINDING_INVALID',
      mutate: f => { f.postEffectId = '../unsafe'; } },
    { name: 'invalid parent effect key', code: 'POST_BINDING_INVALID',
      mutate: f => { f.postEffectKey = 'invalid'; } },
    { name: 'missing list declaration', code: 'COMMENT_DECLARATION_INVALID',
      mutate: f => { f.snapshot.bundle.inputs = []; } },
    { name: 'wrong typed list', code: 'COMMENT_DECLARATION_INVALID',
      mutate: f => { f.snapshot.bundle.inputs[0]!.itemType = 'number'; } },
    { name: 'duplicate declaration', code: 'COMMENT_DECLARATION_INVALID',
      mutate: f => { f.snapshot.bundle.inputs.push({ ...f.snapshot.bundle.inputs[0]! }); } },
    { name: 'wrong field scope', code: 'COMMENT_DECLARATION_INVALID',
      mutate: f => { f.fieldKey = 'unbound'; } },
    { name: 'missing value', code: 'COMMENT_LIST_INVALID',
      mutate: f => { f.snapshot.fields = {}; } },
    { name: 'empty list', code: 'COMMENT_LIST_INVALID',
      mutate: f => { f.snapshot.fields.comments = []; } },
    { name: 'more than 32 comments', code: 'COMMENT_LIST_INVALID',
      mutate: f => { f.snapshot.fields.comments = Array(33).fill('hi'); } },
    { name: 'non-text item', code: 'COMMENT_TEXT_UNSAFE',
      mutate: f => { f.snapshot.fields.comments = ['valid', 3]; } },
    { name: 'empty text item', code: 'COMMENT_TEXT_UNSAFE',
      mutate: f => { f.snapshot.fields.comments = ['valid', '']; } },
    { name: 'unpaired surrogate', code: 'COMMENT_TEXT_UNSAFE',
      mutate: f => { f.snapshot.fields.comments = ['hello\ud800']; } },
    { name: 'bidi override', code: 'COMMENT_TEXT_UNSAFE',
      mutate: f => { f.snapshot.fields.comments = ['hello\u202eevil']; } },
    { name: 'bare CR', code: 'COMMENT_TEXT_UNSAFE',
      mutate: f => { f.snapshot.fields.comments = ['hello\rworld']; } },
    { name: 'control character', code: 'COMMENT_TEXT_UNSAFE',
      mutate: f => { f.snapshot.fields.comments = ['hello\u0000world']; } },
    { name: 'oversized comment', code: 'COMMENT_TEXT_TOO_LARGE',
      mutate: f => { f.snapshot.fields.comments = ['X'.repeat(32769)]; } },
  ];
  for (const { name, code, mutate, keepHash } of bad) {
    it('blocks '+name+' without a partial dispatchable list', () => {
      const f = fixture();
      mutate(f);
      if (!keepHash) f.snapshotHash = contentHash(f.snapshot);
      const before = JSON.stringify(f);
      const result = read(f);
      expect(result.status).toBe('BLOCKED');
      expect(result.blockers).toContain(code);
      expect(result.items).toEqual([]);
      expect(result.canDispatch).toBe(false);
      expect(result.canRetry).toBe(false);
      expect(result.canConfirm).toBe(false);
      expect(JSON.stringify(result)).not.toContain(caption);
      expect(JSON.stringify(f)).toBe(before);
    });
  }
});
