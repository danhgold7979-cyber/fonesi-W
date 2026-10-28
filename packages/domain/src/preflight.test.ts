import { describe, expect, it } from 'vitest';
import { SEED_APPS } from '@autoreels/contracts';
import type {
  AppDefinition, JobDefinition, JobSnapshot, DeviceRecord, DeviceAppProfile,
  WorkflowReceipt, WorkflowBundle,
} from '@autoreels/contracts';
import {
  assessJobPreflightEvidence,
  bundleHash,
  contentHash,
  type JobPreflightEvidence,
} from './index.js';

const at = Date.parse('2026-10-28T08:00:00.000Z');
function fixture(withMedia = true): JobPreflightEvidence {
  const app: AppDefinition = {
    ...SEED_APPS.find((x) => x.id === 'fb')!,
    certification: 'SUPPORTED_PROFILES_ONLY',
  };
  const bundle: WorkflowBundle = {
    format: 'autoreels-workflow', schemaVersion: 2,
    workflow: { id: 'wf_preflight', appId: 'fb', name: 'Preflight', kind: 'main' },
    mainGraphId: 'main', inputs: [
      { key: 'caption', type: 'text', scope: 'row', required: true },
    ], outputs: [], dependencies: [],
    graphs: [{
      id: 'main', groups: [], inputs: [], outputs: [],
      nodes: [
        { id: 'start', type: 'start', name: 'Start', x: 0, y: 0, config: {} },
        { id: 'end', type: 'end', name: 'End', x: 180, y: 0, config: {} },
      ],
      edges: [{ id: 'edge', source: 'start', target: 'end', port: 'next' }],
    }],
  };
  const workflowHash = bundleHash(bundle), assetHash = 'a'.repeat(64);
  const snapshot: JobSnapshot = {
    workflowVersionId: 'version_preflight', workflowHash, bundle,
    contentId: 'content_preflight',
    fields: { caption: 'CONFIDENTIAL CAPTION' },
    accountId: 'account_preflight', targetId: 'target_preflight',
    assetIds: withMedia ? ['asset_preflight'] : [],
    assets: withMedia ? [{
      id: 'asset_preflight', contentId: 'content_preflight',
      relativePath: 'private/video.mp4', hash: assetHash,
      kind: 'video', bytes: 1024, state: 'READY', probe: null,
    }] : [],
    networkProfileId: null,
  };
  const job: JobDefinition = {
    id: 'job_preflight', processId: 'process_preflight', deviceId: 'device_preflight',
    contentId: 'content_preflight', occurrenceKey: contentHash('preflight-occurrence'),
    scheduledUtc: new Date(at).toISOString(), state: 'PREFLIGHT',
    revision: 2, priority: 0,
  };
  const device: DeviceRecord = {
    id: job.deviceId, name: 'Fixture phone', enabled: true, revision: 1,
    metadata: {
      hardwareSerial: 'SECRET_HARDWARE_ID',
      manufacturer: 'Fixture', model: 'Pixel', product: 'test_product',
      androidVersion: '14', sdk: 34, locale: 'vi-VN',
    },
    identity: 'VERIFIED_PROPERTIES',
    transports: [{
      serial: 'SECRET_USB_SERIAL', kind: 'USB', state: 'CONNECTED',
      generation: 3, identityVerified: true, lastSeen: new Date(at - 1000).toISOString(),
    }],
    owner: { kind: 'JOB', expiresAt: at + 10000 },
    capabilities: {
      connected: true, manualControl: true, screenshot: true,
      stream: false, automation: false, reasons: [],
    },
  };
  const profile: DeviceAppProfile = {
    deviceId: job.deviceId, packageName: app.packages[0]!,
    versionCode: 1, versionName: '1.0',
    locale: 'vi-VN', androidVersion: '14',
    selectorProfileId: 'selector_preflight',
  };
  const receipt: WorkflowReceipt = {
    workflowHash, profile, kind: 'DEVICE_TEST', result: 'PASS', readyByUser: true,
  };
  return {
    job, snapshot, snapshotHash: contentHash(snapshot),
    device, app, observedProfile: profile, trustedReceipt: receipt,
    mediaChecks: withMedia ? [{
      assetId: 'asset_preflight', expectedHash: assetHash,
      observedHash: assetHash, state: 'READY', checkedAt: at - 1000,
    }] : [],
    observedTargetId: 'target_preflight',
    observedAccountId: 'account_preflight',
    observedNetworkProfileId: null,
    networkObserved: true,
    observedAt: at - 1000, at,
  };
}
const codes = (input: JobPreflightEvidence): string[] =>
  assessJobPreflightEvidence(input).blockers;

describe('P11/S094 pure live-evidence comparator, no dispatch authorization', () => {
  it('compares consistent synthetic proof without authorizing any real Android action', () => {
    const input = fixture(), before = structuredClone(input);
    expect(assessJobPreflightEvidence(input)).toEqual({
      evidenceConsistent: true, dispatchAuthorized: false, blockers: [],
    });
    expect(input).toEqual(before);
  });
  it('rejects invalid job phase, content references, workflow and snapshot hash', () => {
    const f = fixture();
    expect(codes({ ...f, job: { ...f.job, state: 'RUNNING' } })).toContain('JOB_NOT_PREFLIGHT');
    expect(codes({ ...f, snapshot: { ...f.snapshot, contentId: 'mismatch' } }))
      .toEqual(expect.arrayContaining(['CONTENT_BINDING_MISMATCH', 'SNAPSHOT_HASH_MISMATCH']));
    expect(codes({ ...f, snapshotHash: contentHash('wrong') }))
      .toContain('SNAPSHOT_HASH_MISMATCH');
    expect(codes({ ...f, snapshot: { ...f.snapshot, workflowHash: contentHash('wrong') } }))
      .toContain('WORKFLOW_HASH_MISMATCH');
    expect(codes({ ...f, app: { ...f.app!, certification: 'NOT_RUN' } }))
      .toContain('APP_ADAPTER_NOT_CERTIFIED');
  });
  it('rejects unverified device, disconnected or stale transport and manual ownership', () => {
    const f = fixture(), d = f.device!;
    expect(codes({ ...f, device: { ...d, identity: 'CONFLICT' } }))
      .toContain('DEVICE_IDENTITY_UNAVAILABLE');
    expect(codes({ ...f, device: { ...d, enabled: false } }))
      .toContain('DEVICE_IDENTITY_UNAVAILABLE');
    expect(codes({ ...f, device: { ...d, capabilities: { ...d.capabilities, connected: false } } }))
      .toContain('DEVICE_NOT_CONNECTED');
    expect(codes({ ...f, device: { ...d, transports: [] } }))
      .toContain('TRANSPORT_NOT_VERIFIED');
    expect(codes({ ...f, device: {
      ...d, transports: d.transports.map((t) => ({ ...t, lastSeen: new Date(at - 30001).toISOString() })),
    } })).toContain('TRANSPORT_STALE');
    expect(codes({ ...f, device: { ...d, owner: { kind: 'MANUAL', expiresAt: at + 1000 } } }))
      .toContain('JOB_OWNER_UNAVAILABLE');
    expect(codes({ ...f, device: { ...d, owner: { kind: 'JOB', expiresAt: at } } }))
      .toContain('JOB_OWNER_UNAVAILABLE');
  });
  it('requires exact observed app profile and trusted confirmed DEVICE_TEST receipt', () => {
    const f = fixture();
    expect(codes({ ...f, observedProfile: { ...f.observedProfile!, deviceId: 'wrong_device' } }))
      .toContain('PROFILE_DEVICE_MISMATCH');
    expect(codes({ ...f, observedProfile: { ...f.observedProfile!, packageName: 'com.other.app' } }))
      .toContain('PROFILE_PACKAGE_MISMATCH');
    expect(codes({ ...f, observedProfile: { ...f.observedProfile!, versionCode: 99 } }))
      .toContain('STALE_RECEIPT');
    expect(codes({ ...f, observedProfile: { ...f.observedProfile!, locale: 'en-US' } }))
      .toContain('PROFILE_DEVICE_PROPERTIES_MISMATCH');
    expect(codes({ ...f, trustedReceipt: null }))
      .toEqual(expect.arrayContaining(['DEVICE_TEST_KIND_REQUIRED', 'DEVICE_TEST_REQUIRED']));
    expect(codes({ ...f, trustedReceipt: {
      ...f.trustedReceipt!, kind: 'ADAPTER_CERTIFICATION',
    } })).toContain('DEVICE_TEST_KIND_REQUIRED');
    expect(codes({ ...f, trustedReceipt: {
      ...f.trustedReceipt!, readyByUser: false,
    } })).toContain('DEVICE_TEST_REQUIRED');
  });
  it('requires exact target/account/network identities, not general boolean agreement', () => {
    const f = fixture();
    expect(codes({ ...f, observedTargetId: 'target_other' })).toContain('TARGET_NOT_OBSERVED');
    expect(codes({ ...f, observedAccountId: 'account_other' })).toContain('ACCOUNT_NOT_OBSERVED');
    expect(codes({ ...f, networkObserved: false })).toContain('NETWORK_NOT_OBSERVED');
    expect(codes({ ...f, observedNetworkProfileId: 'network_other' }))
      .toContain('NETWORK_NOT_OBSERVED');
  });
  it('compares stable ordered media, fresh hash/state and bounded list without trusting file names', () => {
    const f = fixture();
    expect(codes({ ...f, mediaChecks: [] })).toContain('MEDIA_ORDER_MISMATCH');
    expect(codes({ ...f, mediaChecks: [{ ...f.mediaChecks[0]!, observedHash: contentHash('wrong') }] }))
      .toContain('MEDIA_NOT_READY');
    expect(codes({ ...f, mediaChecks: [{ ...f.mediaChecks[0]!, state: 'CHANGED' }] }))
      .toContain('MEDIA_NOT_READY');
    expect(codes({ ...f, mediaChecks: [{ ...f.mediaChecks[0]!, checkedAt: at - 30001 }] }))
      .toContain('MEDIA_OBSERVATION_STALE');
    expect(codes({ ...f, mediaChecks: [{ ...f.mediaChecks[0]!, assetId: 'wrong_asset' }] }))
      .toEqual(expect.arrayContaining(['MEDIA_ORDER_MISMATCH', 'MEDIA_PIN_MISMATCH']));
    expect(codes({ ...f, snapshot: {
      ...f.snapshot, assetIds: Array.from({ length: 251 }, (_, i) => 'asset_' + i),
    } })).toContain('MEDIA_SCOPE_INVALID');
  });
  it('allows valid text-only content without inventing a media attachment', () => {
    const f = fixture(false);
    expect(codes(f)).toEqual([]);
    expect(assessJobPreflightEvidence(f).dispatchAuthorized).toBe(false);
    expect(codes({ ...f, snapshot: {
      ...f.snapshot, fields: { caption: ' ' },
    } })).toContain('CONTENT_MEDIA_REQUIRED');
    expect(codes({ ...f, app: {
      ...f.app!, mediaKinds: ['video'],
    } })).toContain('CONTENT_MEDIA_REQUIRED');
  });
  it('fences future or stale evidence clocks and returns only redacted named codes', () => {
    const f = fixture();
    for (const observedAt of [at + 1, at - 30001, Number.NaN])
      expect(codes({ ...f, observedAt })).toContain('OBSERVATION_STALE');
    const report = assessJobPreflightEvidence({ ...f, device: {
      ...f.device!, identity: 'CONFLICT',
    } });
    const output = JSON.stringify(report);
    for (const secret of [
      'SECRET_HARDWARE_ID', 'SECRET_USB_SERIAL', 'private/video.mp4',
      'CONFIDENTIAL CAPTION', 'target_preflight',
    ]) expect(output).not.toContain(secret);
    expect(report.dispatchAuthorized).toBe(false);
    expect(report.blockers.length).toBeLessThanOrEqual(32);
  });
});
