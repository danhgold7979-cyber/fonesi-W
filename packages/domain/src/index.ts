import { createHash } from 'node:crypto';
import {
  assertJsonSafe,
  appDefinitionSchema,
  profileSchema,
  workflowReceiptSchema,
  hashSchema,
} from '@autoreels/contracts';
import type {
  AppDefinition,
  DeviceAppProfile,
  WorkflowReceipt,
  JobState,
  EffectState,
  WorkflowBundle,
  JsonValue,
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
  SCHEDULED: ['QUEUED', 'SKIPPED', 'CANCELLED', 'WAITING_DEVICE'],
  QUEUED: ['PREFLIGHT', 'WAITING_DEVICE', 'WAITING_NETWORK', 'CANCELLED'],
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
