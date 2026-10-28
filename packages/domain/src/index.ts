import { createHash } from 'node:crypto';
import {
  assertJsonSafe,
  appDefinitionSchema,
  profileSchema,
  workflowReceiptSchema,
  hashSchema,
  jobSchema,
} from '@autoreels/contracts';
import type {
  AppDefinition,
  DeviceAppProfile,
  WorkflowReceipt,
  JobState,
  EffectState,
  WorkflowBundle,
  JsonValue,
  JobDefinition,
  JobSnapshot,
  DeviceRecord,
  ContentAssetInfo,
} from '@autoreels/contracts';

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
export function canonicalJson(value: unknown): string {
  assertJsonSafe(value);
  function sorted(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(sorted);
    if (v !== null && typeof v === 'object')
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, sorted((v as Record<string, unknown>)[k])]),
      );
    return v;
  }
  return JSON.stringify(sorted(value));
}
export function contentHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
export function bundleHash(bundle: WorkflowBundle): string {
  return contentHash(bundle);
}
export function addApp(registry: readonly AppDefinition[], input: unknown): AppDefinition[] {
  const app = appDefinitionSchema.parse(input);
  if (registry.some((a) => a.id === app.id || a.packages.some((p) => app.packages.includes(p))))
    throw new DomainError('DUPLICATE_APP', 'App ID/package already registered');
  return [...registry, structuredClone(app)];
}
export function workflowReady(
  hash: string,
  profile: DeviceAppProfile,
  receipt?: WorkflowReceipt,
): { eligible: boolean; reason: string | null } {
  if (!hashSchema.safeParse(hash).success)
    return { eligible: false, reason: 'INVALID_WORKFLOW_HASH' };
  if (!profileSchema.safeParse(profile).success)
    return { eligible: false, reason: 'UNKNOWN_PROFILE' };
  if (
    !workflowReceiptSchema.safeParse(receipt).success ||
    !receipt ||
    receipt.result !== 'PASS' ||
    !receipt.readyByUser
  )
    return { eligible: false, reason: 'DEVICE_TEST_REQUIRED' };
  if (receipt.workflowHash !== hash || canonicalJson(receipt.profile) !== canonicalJson(profile))
    return { eligible: false, reason: 'STALE_RECEIPT' };
  return { eligible: true, reason: null };
}

const transitions: Partial<Record<JobState, readonly JobState[]>> = {
  DRAFT: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['QUEUED', 'SKIPPED', 'CANCELLED', 'WAITING_DEVICE', 'NEEDS_REVIEW'],
  QUEUED: ['PREFLIGHT', 'WAITING_DEVICE', 'WAITING_NETWORK', 'CANCELLED', 'SCHEDULED', 'SKIPPED', 'NEEDS_REVIEW'],
  PREFLIGHT: [
    'RUNNING',
    'WAITING_DEVICE',
    'WAITING_NETWORK',
    'MEDIA_MISSING',
    'MEDIA_CHANGED',
    'TARGET_MISSING',
    'NEEDS_REVIEW',
    'FAILED',
    'CANCELLED',
  ],
  RUNNING: ['POST_INTENT', 'NEEDS_REVIEW', 'FAILED', 'CANCELLED'],
  POST_INTENT: ['POST_PENDING', 'NEEDS_REVIEW'],
  POST_PENDING: ['POSTED', 'NEEDS_REVIEW'],
  POSTED: ['COMMENT_PENDING', 'SUCCESS'],
  COMMENT_PENDING: ['SUCCESS', 'SUCCESS_WITH_WARNINGS', 'NEEDS_REVIEW'],
  NEEDS_REVIEW: ['POSTED', 'COMMENT_PENDING', 'FAILED', 'CANCELLED'],
  WAITING_DEVICE: ['QUEUED', 'CANCELLED', 'SKIPPED'],
  WAITING_NETWORK: ['QUEUED', 'CANCELLED', 'SKIPPED'],
  MEDIA_MISSING: ['QUEUED', 'CANCELLED'],
  MEDIA_CHANGED: ['CANCELLED'],
  TARGET_MISSING: ['QUEUED', 'CANCELLED'],
};
export function assertJobTransition(from: JobState, to: JobState, pendingEffect = false): void {
  if (pendingEffect && to !== 'NEEDS_REVIEW')
    throw new DomainError(
      'PENDING_EFFECT',
      'Resolve uncertain external effect before changing state',
    );
  if (!transitions[from]?.includes(to))
    throw new DomainError('INVALID_TRANSITION', from + ' → ' + to);
}
export function canRetryEffect(state: EffectState): boolean {
  return state === 'DEFINITIVELY_REJECTED';
}
export function canCleanup(
  postVerified: boolean,
  pendingEffect: boolean,
  recoveryNeedsMedia: boolean,
  result: JobState,
): boolean {
  return (
    postVerified &&
    !pendingEffect &&
    !recoveryNeedsMedia &&
    ['SUCCESS', 'SUCCESS_WITH_WARNINGS'].includes(result)
  );
}
export function dedupeKey(
  appId: string,
  targetId: string,
  content: { assetHashes: string[]; text: string },
): string {
  const text = content.text.normalize('NFC').replace(/\r\n?/g, '\n');
  return contentHash({
    appId,
    targetId,
    assetHashes: content.assetHashes,
    text: content.assetHashes.length ? '' : text,
  });
}
export function freezeSnapshot<T extends JsonValue>(input: T): Readonly<T> {
  assertJsonSafe(input);
  const cloned = structuredClone(input);
  const freeze = (value: JsonValue): void => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
  };
  freeze(cloned);
  return cloned;
}


/** Media selection evidence from the trusted staging/source probe, not UI guesses. */
export interface PreflightMediaCheck {
  assetId: string;
  expectedHash: string;
  observedHash: string | null;
  state: ContentAssetInfo['state'];
}
export interface JobPreflightEvidence {
  job: JobDefinition;
  snapshot: JobSnapshot;
  snapshotHash: string;
  device: DeviceRecord | null;
  app: AppDefinition | null;
  observedProfile: DeviceAppProfile | null;
  trustedReceipt: WorkflowReceipt | null;
  mediaChecks: PreflightMediaCheck[];
  targetObserved: boolean;
  accountObserved: boolean;
  networkObserved: boolean;
  observedAt: number;
  at: number;
}
export interface JobPreflightAssessment {
  evidenceConsistent: boolean;
  /** This pure function cannot grant execution; only a private leased runner can. */
  dispatchAuthorized: false;
  blockers: string[];
}

/**
 * Pure, conservative preflight evidence comparison. No app, ADB, SQL, file access
 * or permission to dispatch. A later private worker MUST independently re-probe.
 */
export function assessJobPreflightEvidence(input: JobPreflightEvidence): JobPreflightAssessment {
  const blockers: string[] = [];
  const block = (code: string): void => {
    if (!blockers.includes(code)) blockers.push(code);
  };
  if (!Number.isSafeInteger(input.at) || !Number.isSafeInteger(input.observedAt) ||
      input.at < input.observedAt || input.at - input.observedAt > 30000)
    block('OBSERVATION_STALE');
  const validJob = jobSchema.safeParse(input.job);
  if (!validJob.success) block('INVALID_JOB_SHAPE');
  if (input.job.state !== 'PREFLIGHT') block('JOB_NOT_PREFLIGHT');
  if (input.snapshot.contentId !== input.job.contentId)
    block('CONTENT_BINDING_MISMATCH');
  let workflowHash = '';
  try {
    workflowHash = bundleHash(input.snapshot.bundle);
    if (workflowHash !== input.snapshot.workflowHash)
      block('WORKFLOW_HASH_MISMATCH');
    if (contentHash(input.snapshot) !== input.snapshotHash)
      block('SNAPSHOT_HASH_MISMATCH');
  } catch {
    block('SNAPSHOT_INVALID');
  }
  if (!input.app || input.snapshot.bundle.workflow.appId !== input.app.id)
    block('APP_BINDING_MISMATCH');
  if (!input.app || input.app.certification !== 'SUPPORTED_PROFILES_ONLY')
    block('APP_ADAPTER_NOT_CERTIFIED');
  if (!input.device ||
      input.device.id !== input.job.deviceId ||
      !input.device.enabled ||
      input.device.identity !== 'VERIFIED_PROPERTIES')
    block('DEVICE_IDENTITY_UNAVAILABLE');
  if (!input.device?.transports.some((t) =>
    t.state === 'CONNECTED' && t.identityVerified))
    block('TRANSPORT_NOT_VERIFIED');
  if (!input.observedProfile || !profileSchema.safeParse(input.observedProfile).success)
    block('PROFILE_UNAVAILABLE');
  else {
    if (input.observedProfile.deviceId !== input.job.deviceId)
      block('PROFILE_DEVICE_MISMATCH');
    if (!input.app?.packages.includes(input.observedProfile.packageName))
      block('PROFILE_PACKAGE_MISMATCH');
    const ready = workflowReady(workflowHash, input.observedProfile,
      input.trustedReceipt ?? undefined);
    if (!ready.eligible) block(ready.reason ?? 'DEVICE_TEST_REQUIRED');
    if (input.trustedReceipt?.kind !== 'DEVICE_TEST')
      block('DEVICE_TEST_KIND_REQUIRED');
  }
  if (!input.snapshot.targetId || !input.targetObserved)
    block('TARGET_NOT_OBSERVED');
  if (!input.snapshot.accountId || !input.accountObserved)
    block('ACCOUNT_NOT_OBSERVED');
  if (!input.networkObserved) block('NETWORK_NOT_OBSERVED');
  const expected = input.snapshot.assetIds;
  if (!expected.length) block('MEDIA_REQUIRED');
  if (
    expected.length !== input.mediaChecks.length ||
    expected.some((id, index) => input.mediaChecks[index]?.assetId !== id)
  ) block('MEDIA_ORDER_MISMATCH');
  for (const check of input.mediaChecks) {
    if (!hashSchema.safeParse(check.expectedHash).success ||
        !hashSchema.safeParse(check.observedHash).success ||
        check.observedHash !== check.expectedHash ||
        check.state !== 'READY')
      block('MEDIA_NOT_READY');
    const frozenAsset = input.snapshot.assets?.find((asset) => asset.id === check.assetId);
    if (!frozenAsset || frozenAsset.hash !== check.expectedHash)
      block('MEDIA_PIN_MISMATCH');
  }
  return { evidenceConsistent: blockers.length === 0, dispatchAuthorized: false, blockers };
}
