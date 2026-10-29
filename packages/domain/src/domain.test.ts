import { describe, expect, it } from 'vitest';
import { SEED_APPS } from '@autoreels/contracts';
import type { DeviceAppProfile, WorkflowReceipt } from '@autoreels/contracts';
import {
  addApp,
  canonicalJson,
  contentHash,
  workflowReady,
  assertJobTransition,
  canCleanup,
  canRetryEffect,
  dedupeKey,
  freezeSnapshot,
} from './index.js';

describe('version and eligibility invariants', () => {
  const profile: DeviceAppProfile = {
    deviceId: 'phone_1',
    packageName: 'com.example.app',
    versionCode: 1,
    versionName: '1',
    locale: 'vi_VN',
    androidVersion: '13',
    selectorProfileId: 'profile_1',
  };
  const hash = contentHash({ graphs: ['main', 'child'] });
  const receipt: WorkflowReceipt = {
    workflowHash: hash,
    profile,
    kind: 'DEVICE_TEST',
    result: 'PASS',
    readyByUser: true,
  };
  it('canonicalizes object keys but preserves asset/list order and data types', () => {
    expect(canonicalJson({ b: 0, a: false })).toBe(canonicalJson({ a: false, b: 0 }));
    expect(contentHash(['a', 'b'])).not.toBe(contentHash(['b', 'a']));
    expect(contentHash(0)).not.toBe(contentHash('0'));
  });
  it('gates readiness on exact version/profile and explicit user readiness', () => {
    expect(workflowReady(hash, profile, receipt).eligible).toBe(true);
    expect(workflowReady(hash, { ...profile, versionCode: 2 }, receipt).eligible).toBe(false);
    expect(workflowReady(contentHash({ changed: true }), profile, receipt).eligible).toBe(false);
    expect(workflowReady(hash, profile, { ...receipt, readyByUser: false }).eligible).toBe(false);
    expect(workflowReady(hash, profile).eligible).toBe(false);
    expect(
      workflowReady('not-a-hash', profile, { ...receipt, workflowHash: 'not-a-hash' }).eligible,
    ).toBe(false);
  });
  it('does not mutate scheduled snapshots when editing the source', () => {
    const original = { content: { caption: 'old' }, assets: ['a'] };
    const frozen = freezeSnapshot(original);
    original.content.caption = 'new';
    original.assets.push('b');
    expect(frozen.content.caption).toBe('old');
    expect(frozen.assets).toEqual(['a']);
    expect(Object.isFrozen(frozen.content)).toBe(true);
  });
  it('registers an open app without granting execution capability', () => {
    const app = {
      id: 'custom',
      name: 'Custom',
      packages: ['com.example.app'],
      mediaKinds: ['text'],
      targetKinds: ['custom'],
      certification: 'NOT_RUN',
    };
    const registry = addApp(SEED_APPS, app);
    expect(registry).toHaveLength(6);
    expect(SEED_APPS).toHaveLength(5);
    expect(() => addApp(registry, { ...app, id: 'other' })).toThrow('already registered');
  });
});
describe('durable effects policies', () => {
  it('does not allow unknown publish/comment results to become retryable failures', () => {
    expect(() => assertJobTransition('POST_PENDING', 'FAILED', true)).toThrow('uncertain');
    expect(() => assertJobTransition('COMMENT_PENDING', 'SUCCESS_WITH_WARNINGS', true)).toThrow(
      'uncertain',
    );
    expect(() => assertJobTransition('POST_PENDING', 'NEEDS_REVIEW', true)).not.toThrow();
    expect(canRetryEffect('ATTEMPT_UNCERTAIN')).toBe(false);
    expect(canRetryEffect('NEEDS_REVIEW')).toBe(false);
    expect(canRetryEffect('DEFINITIVELY_REJECTED')).toBe(true);
  });
  it('keeps comment-only failure separate from reposting', () => {
    expect(() => assertJobTransition('COMMENT_PENDING', 'SUCCESS_WITH_WARNINGS')).not.toThrow();
    expect(() => assertJobTransition('COMMENT_PENDING', 'POST_INTENT')).toThrow();
    expect(() => assertJobTransition('SUCCESS', 'QUEUED')).toThrow();
  });
  it('allows cleanup only for verified terminal results without recovery needs', () => {
    expect(canCleanup(true, false, false, 'SUCCESS_WITH_WARNINGS')).toBe(true);
    expect(canCleanup(true, true, false, 'SUCCESS')).toBe(false);
    expect(canCleanup(false, false, false, 'SUCCESS')).toBe(false);
    expect(canCleanup(true, false, true, 'SUCCESS')).toBe(false);
  });
  it('dedupes per app/target and preserves ordered multi-asset meaning', () => {
    const x = { assetHashes: ['a', 'b'], text: 'hello' };
    expect(dedupeKey('fb', 'one', x)).not.toBe(dedupeKey('fb', 'two', x));
    expect(dedupeKey('fb', 'one', x)).not.toBe(dedupeKey('tt', 'one', x));
    expect(dedupeKey('fb', 'one', x)).not.toBe(
      dedupeKey('fb', 'one', { ...x, assetHashes: ['b', 'a'] }),
    );
    expect(dedupeKey('th', 'one', { assetHashes: [], text: 'e\u0301\r\n' })).toBe(
      dedupeKey('th', 'one', { assetHashes: [], text: 'é\n' }),
    );
  });
});
