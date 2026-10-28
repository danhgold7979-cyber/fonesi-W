import {
  appDefinitionSchema,
  hashSchema,
  idSchema,
  jobSchema,
  profileSchema,
  validateWorkflowShape,
  workflowReceiptSchema,
} from '@autoreels/contracts';
import type {
  AppDefinition,
  ContentAssetInfo,
  DeviceAppProfile,
  DeviceRecord,
  JobDefinition,
  JobSnapshot,
  WorkflowBundle,
  WorkflowReceipt,
} from '@autoreels/contracts';

/**
 * Provenance is supplied by the future trusted host, never by public IPC.
 * Comparison alone cannot establish proof or authorize a device operation.
 */
export interface PreflightMediaCheck {
  assetId: string;
  expectedHash: string;
  observedHash: string | null;
  state: ContentAssetInfo['state'];
  checkedAt: number;
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
  observedTargetId: string | null;
  observedAccountId: string | null;
  observedNetworkProfileId: string | null;
  networkObserved: boolean;
  observedAt: number;
  at: number;
}
export interface JobPreflightAssessment {
  evidenceConsistent: boolean;
  /** A pure comparison never owns a lease or provider; it cannot dispatch. */
  dispatchAuthorized: false;
  /** Stable named codes only: no device identifiers, paths or snapshot values. */
  blockers: string[];
}
interface Primitives {
  bundleHash: (bundle: WorkflowBundle) => string;
  contentHash: (value: unknown) => string;
  workflowReady: (
    hash: string, profile: DeviceAppProfile, receipt?: WorkflowReceipt,
  ) => { eligible: boolean; reason: string | null };
}
const MAX_AGE_MS = 30000;
const MAX_ASSETS = 250;
const MAX_BLOCKERS = 32;
const observedFresh = (observed: number, at: number): boolean =>
  Number.isSafeInteger(observed) &&
  Number.isSafeInteger(at) &&
  at >= observed &&
  at - observed <= MAX_AGE_MS;
const isoFresh = (value: string, at: number): boolean => {
  const parsed = Date.parse(value);
  return observedFresh(parsed, at);
};
const pinnedTextPresent = (snapshot: JobSnapshot): boolean =>
  snapshot.bundle.inputs.some((field) => {
    if (field.type !== 'text') return false;
    const values = field.scope === 'row' ? snapshot.fields :
      field.scope === 'process' ? snapshot.processFields ?? {} : {};
    const value = values[field.key];
    return typeof value === 'string' && value.trim().length > 0;
  });

/**
 * Pure evidence comparison without ADB, DB writes, filesystem or public API.
 * The trusted private executor must still assert its JOB lease/claim, re-probe
 * every observation and journal the attempted effect immediately before input.
 */
export function compareJobPreflightEvidence(
  input: JobPreflightEvidence,
  primitives: Primitives,
): JobPreflightAssessment {
  const blockers: string[] = [];
  const seen = new Set<string>();
  const block = (code: string): void => {
    if (!seen.has(code) && blockers.length < MAX_BLOCKERS) {
      seen.add(code);
      blockers.push(code);
    }
  };

  if (!observedFresh(input.observedAt, input.at)) block('OBSERVATION_STALE');
  if (!jobSchema.safeParse(input.job).success) block('INVALID_JOB_SHAPE');
  if (input.job.state !== 'PREFLIGHT') block('JOB_NOT_PREFLIGHT');
  if (input.snapshot.contentId !== input.job.contentId)
    block('CONTENT_BINDING_MISMATCH');
  const shape = validateWorkflowShape(input.snapshot.bundle);
  if (!shape.ok) block('WORKFLOW_INVALID');

  let workflowHash: string | null = null;
  try {
    workflowHash = primitives.bundleHash(input.snapshot.bundle);
    if (!hashSchema.safeParse(input.snapshot.workflowHash).success ||
        workflowHash !== input.snapshot.workflowHash)
      block('WORKFLOW_HASH_MISMATCH');
    if (!hashSchema.safeParse(input.snapshotHash).success ||
        primitives.contentHash(input.snapshot) !== input.snapshotHash)
      block('SNAPSHOT_HASH_MISMATCH');
  } catch {
    block('SNAPSHOT_INVALID');
  }

  const validApp = input.app && appDefinitionSchema.safeParse(input.app).success;
  if (!validApp || input.snapshot.bundle.workflow.appId !== input.app?.id)
    block('APP_BINDING_MISMATCH');
  if (!validApp || input.app?.certification !== 'SUPPORTED_PROFILES_ONLY')
    block('APP_ADAPTER_NOT_CERTIFIED');

  if (!input.device ||
      input.device.id !== input.job.deviceId ||
      !input.device.enabled ||
      input.device.identity !== 'VERIFIED_PROPERTIES')
    block('DEVICE_IDENTITY_UNAVAILABLE');
  if (!input.device?.capabilities.connected)
    block('DEVICE_NOT_CONNECTED');
  const verifiedTransports = input.device?.transports.filter((transport) =>
    transport.state === 'CONNECTED' && transport.identityVerified) ?? [];
  if (!verifiedTransports.length) block('TRANSPORT_NOT_VERIFIED');
  else if (!verifiedTransports.some((transport) =>
    Number.isSafeInteger(transport.generation) &&
    transport.generation > 0 &&
    isoFresh(transport.lastSeen, input.at)))
    block('TRANSPORT_STALE');
  if (!input.device?.owner ||
      input.device.owner.kind !== 'JOB' ||
      !Number.isSafeInteger(input.device.owner.expiresAt) ||
      input.device.owner.expiresAt <= input.at)
    block('JOB_OWNER_UNAVAILABLE');

  const parsedProfile = profileSchema.safeParse(input.observedProfile);
  if (!parsedProfile.success || !input.observedProfile) {
    block('PROFILE_UNAVAILABLE');
  } else {
    const profile = input.observedProfile;
    if (profile.deviceId !== input.job.deviceId) block('PROFILE_DEVICE_MISMATCH');
    if (!validApp || !input.app!.packages.includes(profile.packageName))
      block('PROFILE_PACKAGE_MISMATCH');
    if (!input.device?.metadata ||
        input.device.metadata.locale !== profile.locale ||
        input.device.metadata.androidVersion !== profile.androidVersion)
      block('PROFILE_DEVICE_PROPERTIES_MISMATCH');
    if (!input.trustedReceipt || !workflowReceiptSchema.safeParse(input.trustedReceipt).success ||
        input.trustedReceipt.kind !== 'DEVICE_TEST')
      block('DEVICE_TEST_KIND_REQUIRED');
    if (!workflowHash || !hashSchema.safeParse(workflowHash).success) {
      block('WORKFLOW_NOT_VERIFIED');
    } else {
      const match = primitives.workflowReady(
        workflowHash, profile, input.trustedReceipt ?? undefined,
      );
      if (!match.eligible) block(match.reason ?? 'DEVICE_TEST_REQUIRED');
    }
  }

  if (!input.snapshot.targetId ||
      input.observedTargetId !== input.snapshot.targetId ||
      !idSchema.safeParse(input.observedTargetId).success)
    block('TARGET_NOT_OBSERVED');
  if (!input.snapshot.accountId ||
      input.observedAccountId !== input.snapshot.accountId ||
      !idSchema.safeParse(input.observedAccountId).success)
    block('ACCOUNT_NOT_OBSERVED');
  if (!input.networkObserved ||
      input.observedNetworkProfileId !== input.snapshot.networkProfileId)
    block('NETWORK_NOT_OBSERVED');

  const ids = input.snapshot.assetIds;
  if (!Array.isArray(ids) ||
      !Array.isArray(input.mediaChecks) ||
      ids.length > MAX_ASSETS ||
      input.mediaChecks.length > MAX_ASSETS ||
      new Set(ids).size !== ids.length)
    block('MEDIA_SCOPE_INVALID');
  else if (!ids.length) {
    if (!validApp || !input.app!.mediaKinds.includes('text') ||
        !pinnedTextPresent(input.snapshot))
      block('CONTENT_MEDIA_REQUIRED');
    if (input.mediaChecks.length)
      block('MEDIA_ORDER_MISMATCH');
  } else {
    if (ids.length !== input.mediaChecks.length ||
        ids.some((id, index) => input.mediaChecks[index]?.assetId !== id))
      block('MEDIA_ORDER_MISMATCH');
    const frozenAssets = input.snapshot.assets ?? [];
    if (frozenAssets.length > MAX_ASSETS)
      block('MEDIA_SCOPE_INVALID');
    const frozen = new Map(frozenAssets.map((asset) => [asset.id, asset]));
    for (const id of ids) {
      const matches = input.mediaChecks.filter((item) => item.assetId === id);
      const observed = matches.length === 1 ? matches[0] : null;
      const pinned = frozen.get(id);
      if (!idSchema.safeParse(id).success || !pinned || pinned.state !== 'READY' ||
          !hashSchema.safeParse(pinned.hash).success || !Number.isSafeInteger(pinned.bytes) ||
          pinned.bytes <= 0 ||
          !observed || !hashSchema.safeParse(observed.expectedHash).success ||
          pinned.hash !== observed.expectedHash)
        block('MEDIA_PIN_MISMATCH');
      if (!observed || !hashSchema.safeParse(observed.observedHash).success ||
          observed.observedHash !== observed.expectedHash || observed.state !== 'READY')
        block('MEDIA_NOT_READY');
      if (!observed || !observedFresh(observed.checkedAt, input.at))
        block('MEDIA_OBSERVATION_STALE');
    }
  }
  return {
    evidenceConsistent: blockers.length === 0,
    dispatchAuthorized: false,
    blockers,
  };
}
