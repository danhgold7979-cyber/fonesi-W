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

const at = Date.parse('2026-10-28T07:00:00.000Z');
function fixture(): JobPreflightEvidence {
  const app: AppDefinition = {
    ...SEED_APPS.find((x) => x.id === 'fb')!,
    certification: 'SUPPORTED_PROFILES_ONLY',
  };
  const bundle: WorkflowBundle = {
    format: 'autoreels-workflow', schemaVersion: 2,
    workflow: { id: 'wf_preflight', appId: app.id, name: 'Preflight', kind: 'main' },
    mainGraphId: 'main', inputs: [], outputs: [], dependencies: [],
    graphs: [{
      id: 'main', groups: [], inputs: [], outputs: [],
      nodes: [
        { id: 'start', type: 'start', name: 'Start', x: 0, y: 0, config: {} },
        { id: 'end', type: 'end', name: 'End', x: 180, y: 0, config: {} },
      ],
      edges: [{ id: 'edge', source: 'start', target: 'end', port: 'next' }],
    }],
  };
  const workflowHash = bundleHash(bundle);
  const assetHash = 'a'.repeat(64);
  const snapshot: JobSnapshot = {
    workflowVersionId: 'ver_preflight',
    workflowHash,
    bundle,
    contentId: 'content_preflight',
    fields: { caption: 'test' },
    targetId: 'target_preflight',
    accountId: 'account_preflight',
    assetIds: ['asset_preflight'],
    assets: [{
      id: 'asset_preflight', contentId: 'content_preflight',
      relativePath: 'safe/clip.mp4', hash: assetHash,
      kind: 'video', bytes: 1024, state: 'READY', probe: null,
    }],
    networkProfileId: null,
  };
  const job: JobDefinition = {
    id: 'job_preflight',
    processId: 'process_preflight',
    deviceId: 'device_preflight',
    contentId: 'content_preflight',
    occurrenceKey: contentHash('preflight-occurrence'),
    scheduledUtc: new Date(at).toISOString(),
    state: 'PREFLIGHT',
    revision: 2,
    priority: 0,
  };
  const device: DeviceRecord = {
    id: job.deviceId, name: 'Fixture Android', enabled: true, revision: 1,
    metadata: {
      hardwareSerial: 'SECRET_HARDWARE_ID',
      manufacturer: 'Fixture', model: 'Pixel', product: 'fixture_product',
      androidVersion: '14', sdk: 34, locale: 'vi-VN',
    },
    identity: 'VERIFIED_PROPERTIES',
    transports: [{
      serial: 'USB_PRIVATE_SERIAL', kind: 'USB', state: 'CONNECTED',
      generation: 3, identityVerified: true, lastSeen: new Date(at - 1000).toISOString(),
    }],
    owner: { kind: 'JOB', expiresAt: at + 10000 },
    capabilities: {
      connected: true, manualControl: true, screenshot: true,
      stream: false, automation: false, reasons: [],
    },
  };
  const profile: DeviceAppProfile = {
    deviceId: job.deviceId,
    packageName: app.packages[0]!,
    versionCode: 1,
    versionName: '1.0',
    locale: 'vi-VN',
    androidVersion: '14',
    selectorProfileId: 'selector_preflight',
  };
  const receipt: WorkflowReceipt = {
    workflowHash, profile, kind: 'DEVICE_TEST', result: 'PASS', readyByUser: true,
  };
  return {
    job, snapshot, snapshotHash: contentHash(snapshot),
    device, app, observedProfile: profile, trustedReceipt: receipt,
    mediaChecks: [{
      assetId: 'asset_preflight', expectedHash: assetHash,
      observedHash: assetHash, state: 'READY',
    }],
    targetObserved: true,
    accountObserved: true,
    networkObserved: true,
    observedAt: at - 1000,
    at,
  };
}
const codes = (input: JobPreflightEvidence): string[] =>
  assessJobPreflightEvidence(input).blockers;

describe('P11/S094 preflight evidence comparison never grants device execution', () => {
  it('compares a synthetically consistent frozen receipt without authorizing dispatch', () => {
    const input = fixture(), original = structuredClone(input);
    expect(assessJobPreflightEvidence(input)).toEqual({
      evidenceConsistent: true,
      dispatchAuthorized: false,
      blockers: [],
    });
    expect(input).toEqual(original);
  });
  it('blocks wrong job state, content binding and snapshot or workflow changes', () => {
    const input = fixture();
    expect(codes({ ...input, job: { ...input.job, state: 'RUNNING' } })).toContain('JOB_NOT_PREFLIGHT');
    expect(codes({
      ...input, snapshot: { ...input.snapshot, contentId: 'other_content' },
    })).toEqual(expect.arrayContaining(['CONTENT_BINDING_MISMATCH', 'SNAPSHOT_HASH_MISMATCH']));
    expect(codes({
      ...input, snapshotHash: contentHash('other snapshot'),
    })).toContain('SNAPSHOT_HASH_MISMATCH');
    expect(codes({
      ...input, snapshot: {
        ...input.snapshot, workflowHash: contentHash('changed workflow'),
      },
    })).toContain('WORKFLOW_HASH_MISMATCH');
  });
  it('requires current verified enabled identity, transport, profile and matching trusted DEVICE_TEST', () => {
    const input = fixture();
    expect(codes({
      ...input, device: { ...input.device!, identity: 'CONFLICT' },
    })).toContain('DEVICE_IDENTITY_UNAVAILABLE');
    expect(codes({
      ...input, device: { ...input.device!, enabled: false },
    })).toContain('DEVICE_IDENTITY_UNAVAILABLE');
    expect(codes({
      ...input, device: { ...input.device!, transports: [] },
    })).toContain('TRANSPORT_NOT_VERIFIED');
    expect(codes({
      ...input, observedProfile: { ...input.observedProfile!, deviceId: 'other_device' },
    })).toEqual(expect.arrayContaining(['PROFILE_DEVICE_MISMATCH', 'STALE_RECEIPT']));
    expect(codes({
      ...input, observedProfile: { ...input.observedProfile!, versionCode: 999 },
    })).toContain('STALE_RECEIPT');
    expect(codes({ ...input, trustedReceipt: null })).toContain('DEVICE_TEST_REQUIRED');
    expect(codes({
      ...input, trustedReceipt: { ...input.trustedReceipt!, kind: 'ADAPTER_CERTIFICATION' },
    })).toContain('DEVICE_TEST_KIND_REQUIRED');
    expect(codes({
      ...input, app: { ...input.app!, certification: 'NOT_RUN' },
    })).toContain('APP_ADAPTER_NOT_CERTIFIED');
  });
  it('requires exact ordered media hashes and real target/account/network observations', () => {
    const input = fixture();
    expect(codes({ ...input, mediaChecks: [] })).toContain('MEDIA_ORDER_MISMATCH');
    expect(codes({
      ...input, mediaChecks: [{ ...input.mediaChecks[0]!, observedHash: contentHash('wrong') }],
    })).toContain('MEDIA_NOT_READY');
    expect(codes({
      ...input, mediaChecks: [{ ...input.mediaChecks[0]!, state: 'MISSING' }],
    })).toContain('MEDIA_NOT_READY');
    expect(codes({
      ...input, mediaChecks: [{ ...input.mediaChecks[0]!, assetId: 'wrong_asset' }],
    })).toEqual(expect.arrayContaining(['MEDIA_ORDER_MISMATCH', 'MEDIA_PIN_MISMATCH']));
    expect(codes({ ...input, targetObserved: false })).toContain('TARGET_NOT_OBSERVED');
    expect(codes({ ...input, accountObserved: false })).toContain('ACCOUNT_NOT_OBSERVED');
    expect(codes({ ...input, networkObserved: false })).toContain('NETWORK_NOT_OBSERVED');
  });
  it('rejects stale, future or invalid observation clocks and never reveals secrets in result', () => {
    const input = fixture();
    for (const observedAt of [at + 1, at - 30001, Number.NaN])
      expect(codes({ ...input, observedAt })).toContain('OBSERVATION_STALE');
    const serialized = JSON.stringify(assessJobPreflightEvidence({
      ...input,
      device: { ...input.device!, identity: 'CONFLICT' },
    }));
    expect(serialized).not.toContain('SECRET_HARDWARE_ID');
    expect(serialized).not.toContain('USB_PRIVATE_SERIAL');
    expect(serialized).not.toContain('safe/clip.mp4');
    expect(serialized).not.toContain('caption');
  });
});
