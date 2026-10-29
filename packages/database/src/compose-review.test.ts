import { createHash } from 'node:crypto';
import { bundleHash } from '@autoreels/domain';
import { describe, expect, it } from 'vitest';
import type {
  ContentAssetInfo, FieldDefinition, JobDefinition, JobSnapshot,
  PersistedOrderedMediaReport, WorkflowBundle,
} from '@autoreels/contracts';
import { deriveFrozenComposeExpectation } from './compose-review.js';
import { deriveFrozenUnicodeTextPlan } from './unicode-compose.js';

const frozenCaption = 'Tiếng Việt 👨‍👩‍👧‍👦\r\nChính xác từng byte';
function setup() {
  const inputs: FieldDefinition[] = [
    { key: 'caption', type: 'text', scope: 'row', required: true },
  ];
  const bundle: WorkflowBundle = {
    format: 'autoreels-workflow', schemaVersion: 2,
    workflow: { id: 'workflow_compose', appId: 'fb', name: 'Compose', kind: 'main' },
    mainGraphId: 'main', graphs: [], inputs, outputs: [], dependencies: [],
  };
  const assets: ContentAssetInfo[] = ['a', 'b'].map((value, ordinal) => ({
    id: 'asset_' + value, contentId: 'content_compose',
    relativePath: 'same-name.mp4',
    hash: value.repeat(64), kind: 'video', bytes: ordinal ? 202 : 101,
    state: 'READY', probe: null,
  }));
  const snapshot: JobSnapshot = {
    workflowVersionId: 'version_compose', workflowHash: bundleHash(bundle),
    bundle, contentId: 'content_compose', fields: { caption: frozenCaption },
    assetIds: ['asset_a', 'asset_b'], assets, targetId: 'target_compose',
    accountId: 'account_compose', networkProfileId: null,
  };
  const job: JobDefinition = {
    id: 'job_compose', occurrenceKey: 'b'.repeat(64),
    deviceId: 'device_compose', processId: 'process_compose',
    contentId: snapshot.contentId, scheduledUtc: '2026-10-29T00:00:00.000Z',
    state: 'PREFLIGHT', revision: 3, priority: 0,
  };
  const mediaOrder: PersistedOrderedMediaReport = {
    scope: 'PERSISTED_STAGE_ORDER_NOT_PICKER_VERIFIED',
    status: 'INDEXED_CANDIDATES_NOT_PICKER_VERIFIED', canSelect: false,
    canDispatch: false, blockers: [], slots: [
      { ordinal: 0, kind: 'VIDEO', evidence: 'INDEXED_ROW_RECORDED_NOT_LIVE', blockers: [] },
      { ordinal: 1, kind: 'VIDEO', evidence: 'INDEXED_ROW_RECORDED_NOT_LIVE', blockers: [] },
    ],
  };
  return { job, snapshot, mediaOrder, hasExternalEffect: false };
}
function assess(value = setup()) {
  return deriveFrozenComposeExpectation({
    ...value, unicode: deriveFrozenUnicodeTextPlan(value.snapshot),
  });
}

describe('S096.3 frozen compose source expectation without Android/PUBLISH capability', () => {
  it('keeps private exact app/account/target/content, media ordinals and UTF-8 digests', () => {
    const v = setup(), before = JSON.stringify(v);
    const result = assess(v);
    expect(result.summary).toEqual({
      scope: 'FROZEN_COMPOSE_NOT_ANDROID_VERIFIED',
      status: 'FROZEN_EXPECTATIONS_LIVE_UNVERIFIED',
      app: 'PINNED_NOT_OBSERVED', account: 'PINNED_NOT_OBSERVED',
      target: 'PINNED_NOT_OBSERVED', content: 'PINNED_NOT_OBSERVED',
      mediaSlots: 2, textFields: 1, blockers: [],
      canVerify: false, canPublish: false, canDispatch: false,
    });
    expect(result.manifest).toMatchObject({
      workflowAppId: 'fb', workflowVersionId: 'version_compose',
      workflowHash: bundleHash(v.snapshot.bundle), accountId: 'account_compose',
      targetId: 'target_compose', contentId: 'content_compose',
      orderedAssetIds: ['asset_a', 'asset_b'],
      orderedAssets: [
        { ordinal: 0, assetId: 'asset_a', kind: 'VIDEO', pinnedHash: 'a'.repeat(64), pinnedBytes: 101 },
        { ordinal: 1, assetId: 'asset_b', kind: 'VIDEO', pinnedHash: 'b'.repeat(64), pinnedBytes: 202 },
      ],
      fields: [{ ordinal: 0, scope: 'row', kind: 'TEXT', utf8Bytes: Buffer.byteLength(frozenCaption) }],
    });
    expect(result.manifest?.fields[0]?.utf8Hash)
      .toBe(createHash('sha256').update(frozenCaption).digest('hex'));
    expect(JSON.stringify(v)).toBe(before);
    const dto = JSON.stringify(result.summary);
    for (const sensitive of [
      'account_compose', 'target_compose', 'content_compose', 'asset_a',
      'same-name.mp4', 'a'.repeat(64), 'b'.repeat(64),
      'version_compose', 'workflow_compose', 'Tiếng Việt',
      createHash('sha256').update(frozenCaption).digest('hex'),
    ]) expect(dto).not.toContain(sensitive);
  });

  it('derives canonical selected order from assetIds, not descriptor insertion order or basename', () => {
    const v = setup();
    v.snapshot.assets!.reverse();
    const result = assess(v);
    expect(result.summary.status).toBe('FROZEN_EXPECTATIONS_LIVE_UNVERIFIED');
    expect(result.manifest?.orderedAssetIds).toEqual(['asset_a', 'asset_b']);
    expect(result.manifest?.orderedAssets).toEqual([
      { ordinal: 0, assetId: 'asset_a', kind: 'VIDEO', pinnedHash: 'a'.repeat(64), pinnedBytes: 101 },
      { ordinal: 1, assetId: 'asset_b', kind: 'VIDEO', pinnedHash: 'b'.repeat(64), pinnedBytes: 202 },
    ]);
    expect(result.summary.canPublish).toBe(false);
  });

  it('permits a text-only source expectation without fabricating a picker slot', () => {
    const v = setup();
    v.snapshot.assetIds = [];
    v.snapshot.assets = [];
    v.mediaOrder = { ...v.mediaOrder, status: 'NO_MEDIA', slots: [] };
    const result = assess(v);
    expect(result.summary.status).toBe('FROZEN_EXPECTATIONS_LIVE_UNVERIFIED');
    expect(result.summary.mediaSlots).toBe(0);
    expect(result.summary.textFields).toBe(1);
    expect(result.manifest?.orderedAssetIds).toEqual([]);
    expect(result.manifest?.orderedAssets).toEqual([]);
    expect(result.summary.canPublish).toBe(false);
  });

  const bad: { name: string; mutate: (v: ReturnType<typeof setup>) => void; code: string }[] = [
    { name: 'missing account', mutate: v => { v.snapshot.accountId = null; }, code: 'ACCOUNT_NOT_PINNED' },
    { name: 'invalid account identifier', mutate: v => { v.snapshot.accountId = '../secret'; }, code: 'ACCOUNT_NOT_PINNED' },
    { name: 'missing target', mutate: v => { v.snapshot.targetId = null; }, code: 'TARGET_NOT_PINNED' },
    { name: 'invalid target identifier', mutate: v => { v.snapshot.targetId = 'x@y'; }, code: 'TARGET_NOT_PINNED' },
    { name: 'unbound workflow app', mutate: v => { v.snapshot.bundle.workflow.appId = ''; }, code: 'WORKFLOW_BINDING_INVALID' },
    { name: 'invalid workflow hash', mutate: v => { v.snapshot.workflowHash = 'short'; }, code: 'WORKFLOW_BINDING_INVALID' },
    { name: 'valid-format but wrong workflow SHA', mutate: v => { v.snapshot.workflowHash = 'f'.repeat(64); }, code: 'WORKFLOW_FINGERPRINT_MISMATCH' },
    { name: 'modified bundle under unchanged workflow SHA', mutate: v => { v.snapshot.bundle.workflow.name = 'Edited'; }, code: 'WORKFLOW_FINGERPRINT_MISMATCH' },
    { name: 'missing frozen media descriptors', mutate: v => { delete v.snapshot.assets; }, code: 'FROZEN_MEDIA_BINDING_INVALID' },
    { name: 'selected media descriptor missing', mutate: v => { v.snapshot.assets!.pop(); }, code: 'FROZEN_MEDIA_BINDING_INVALID' },
    { name: 'extra frozen media descriptor', mutate: v => { v.snapshot.assets!.push({ ...v.snapshot.assets![0]!, id: 'asset_extra' }); }, code: 'FROZEN_MEDIA_BINDING_INVALID' },
    { name: 'duplicated selected descriptor', mutate: v => { v.snapshot.assets![1] = { ...v.snapshot.assets![0]! }; }, code: 'FROZEN_MEDIA_BINDING_INVALID' },
    { name: 'modified pinned hash', mutate: v => { v.snapshot.assets![0]!.hash = 'e'.repeat(64); }, code: 'FROZEN_MEDIA_BINDING_INVALID' },
    { name: 'missing pinned hash', mutate: v => { v.snapshot.assets![0]!.hash = ''; }, code: 'FROZEN_MEDIA_BINDING_INVALID' },
    { name: 'zero pinned media bytes', mutate: v => { v.snapshot.assets![0]!.bytes = 0; }, code: 'FROZEN_MEDIA_BINDING_INVALID' },
    { name: 'changed pinned media state', mutate: v => { v.snapshot.assets![0]!.state = 'CHANGED'; }, code: 'FROZEN_MEDIA_BINDING_INVALID' },
    { name: 'wrong asset media kind', mutate: v => { v.snapshot.assets![0]!.kind = 'image'; }, code: 'FROZEN_MEDIA_BINDING_INVALID' },
    { name: 'media report wrong kind', mutate: v => { v.mediaOrder.slots[0]!.kind = 'IMAGE'; }, code: 'FROZEN_MEDIA_BINDING_INVALID' },
    { name: 'different job content', mutate: v => { v.job.contentId = 'content_other'; }, code: 'CONTENT_BINDING_MISMATCH' },
    { name: 'not preflight', mutate: v => { v.job.state = 'NEEDS_REVIEW'; }, code: 'JOB_NOT_PREFLIGHT' },
    { name: 'prior external effect', mutate: v => { v.hasExternalEffect = true; }, code: 'EXTERNAL_EFFECT_PRESENT' },
    { name: 'missing stage', mutate: v => { v.mediaOrder = { ...v.mediaOrder, status: 'BLOCKED' }; }, code: 'MEDIA_ORDER_NOT_VERIFIED' },
    { name: 'swapped media ordinals', mutate: v => { v.mediaOrder.slots[0]!.ordinal = 1; }, code: 'MEDIA_ORDER_NOT_VERIFIED' },
    { name: 'duplicate asset IDs', mutate: v => { v.snapshot.assetIds = ['asset_a', 'asset_a']; }, code: 'MEDIA_ORDER_NOT_VERIFIED' },
    { name: 'invalid Unicode', mutate: v => { v.snapshot.fields.caption = 'bad\u202eText'; }, code: 'UNICODE_SOURCE_INVALID' },
    { name: 'empty source content', mutate: v => {
      v.snapshot.assetIds = [];
      v.snapshot.assets = [];
      v.mediaOrder = { ...v.mediaOrder, status: 'NO_MEDIA', slots: [] };
      v.snapshot.bundle.inputs = [];
      v.snapshot.workflowHash = bundleHash(v.snapshot.bundle);
      v.snapshot.fields = {};
    }, code: 'EMPTY_FROZEN_CONTENT' },
  ];
  for (const { name, mutate, code } of bad) {
    it('blocks '+name+' without a private manifest or side effect', () => {
      const v = setup();
      mutate(v);
      const before = JSON.stringify(v);
      const result = assess(v);
      expect(result.summary.status).toBe('BLOCKED');
      expect(result.summary.blockers).toContain(code);
      expect(result.manifest).toBeNull();
      expect(result.summary.canVerify).toBe(false);
      expect(result.summary.canPublish).toBe(false);
      expect(result.summary.canDispatch).toBe(false);
      expect(JSON.stringify(v)).toBe(before);
      expect(JSON.stringify(result.summary)).not.toContain(frozenCaption);
    });
  }
});
