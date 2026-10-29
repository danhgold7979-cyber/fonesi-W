import { hashSchema, idSchema } from '@autoreels/contracts';
import { bundleHash } from '@autoreels/domain';
import type {
  FrozenComposeBlocker, FrozenComposePreflight, JobDefinition, JobSnapshot,
  PersistedOrderedMediaReport,
} from '@autoreels/contracts';
import type { FrozenUnicodeTextPlan } from './unicode-compose.js';

/**
 * Private, frozen source-only expectation for an eventual provider adapter.
 * No live screen, account, picker or Unicode typing proof is represented here.
 */
export interface FrozenComposeManifest {
  workflowAppId: string;
  workflowVersionId: string;
  workflowHash: string;
  accountId: string;
  targetId: string;
  contentId: string;
  orderedAssetIds: string[];
  /** Private exact pinned media identities; never return to renderer or HTTP. */
  orderedAssets: {
    ordinal: number;
    assetId: string;
    kind: 'IMAGE' | 'VIDEO';
    pinnedHash: string;
    pinnedBytes: number;
  }[];
  fields: {
    ordinal: number;
    scope: 'row' | 'process';
    kind: 'TEXT' | 'URL';
    utf8Hash: string;
    utf8Bytes: number;
  }[];
}

export function deriveFrozenComposeExpectation(input: {
  job: JobDefinition;
  snapshot: JobSnapshot;
  mediaOrder: PersistedOrderedMediaReport;
  unicode: FrozenUnicodeTextPlan;
  hasExternalEffect: boolean;
}): { manifest: FrozenComposeManifest | null; summary: FrozenComposePreflight } {
  const { job, snapshot, mediaOrder, unicode, hasExternalEffect } = input;
  const blockers: FrozenComposeBlocker[] = [];
  const block = (reason: FrozenComposeBlocker): void => {
    if (!blockers.includes(reason)) blockers.push(reason);
  };

  const appId = snapshot.bundle?.workflow?.appId;
  const appPinned = idSchema.safeParse(appId).success &&
    idSchema.safeParse(snapshot.bundle?.workflow?.id).success &&
    idSchema.safeParse(snapshot.workflowVersionId).success &&
    hashSchema.safeParse(snapshot.workflowHash).success &&
    snapshot.bundle.schemaVersion === 2;
  const accountPinned = idSchema.safeParse(snapshot.accountId).success;
  const targetPinned = idSchema.safeParse(snapshot.targetId).success;
  const contentPinned = idSchema.safeParse(snapshot.contentId).success &&
    idSchema.safeParse(job.contentId).success && snapshot.contentId === job.contentId;
  if (job.state !== 'PREFLIGHT') block('JOB_NOT_PREFLIGHT');
  if (!appPinned) block('WORKFLOW_BINDING_INVALID');
  // A well-formed hash is not proof that these are the pinned workflow bytes.
  let workflowBytesMatch = false;
  if (appPinned) {
    try {
      workflowBytesMatch = bundleHash(snapshot.bundle) === snapshot.workflowHash;
    } catch {
      // Malformed or unsafe JSON must fail closed, never escape raw input details.
    }
    if (!workflowBytesMatch) block('WORKFLOW_FINGERPRINT_MISMATCH');
  }
  if (!accountPinned) block('ACCOUNT_NOT_PINNED');
  if (!targetPinned) block('TARGET_NOT_PINNED');
  if (!contentPinned) block('CONTENT_BINDING_MISMATCH');
  if (hasExternalEffect) block('EXTERNAL_EFFECT_PRESENT');

  const ids = snapshot.assetIds;
  const validIds = Array.isArray(ids) && ids.length <= 32 &&
    new Set(ids).size === ids.length && ids.every((id) => idSchema.safeParse(id).success);
  const mediaSlots = validIds ? ids.length : 0;
  const mediaSourceConsistent = validIds && mediaOrder.canSelect === false &&
    mediaOrder.canDispatch === false &&
    mediaOrder.scope === 'PERSISTED_STAGE_ORDER_NOT_PICKER_VERIFIED' &&
    (ids.length === 0
      ? mediaOrder.status === 'NO_MEDIA' && mediaOrder.slots.length === 0 &&
        mediaOrder.blockers.length === 0
      : mediaOrder.status === 'INDEXED_CANDIDATES_NOT_PICKER_VERIFIED' &&
        mediaOrder.blockers.length === 0 &&
        mediaOrder.slots.length === ids.length &&
        mediaOrder.slots.every((slot, index) => slot.ordinal === index &&
          slot.evidence === 'INDEXED_ROW_RECORDED_NOT_LIVE' &&
          slot.blockers.length === 0));
  if (!mediaSourceConsistent) block('MEDIA_ORDER_NOT_VERIFIED');

  // Bind every selected ordinal to exactly one immutable asset fingerprint.
  // A MediaStore-row summary alone must never create a complete media manifest.
  const frozenAssets = snapshot.assets;
  const orderedAssets: FrozenComposeManifest['orderedAssets'] = [];
  let frozenMediaValid = validIds &&
    (mediaSlots === 0
      ? frozenAssets === undefined || (Array.isArray(frozenAssets) && frozenAssets.length === 0)
      : Array.isArray(frozenAssets) && frozenAssets.length === mediaSlots);
  if (validIds && Array.isArray(frozenAssets)) {
    for (const [ordinal, assetId] of ids.entries()) {
      const matches = frozenAssets.filter((asset) => asset && asset.id === assetId);
      const asset = matches[0];
      const kind = asset?.kind === 'video' ? 'VIDEO'
        : asset?.kind === 'image' ? 'IMAGE' : null;
      if (matches.length !== 1 || !asset ||
          !idSchema.safeParse(asset.contentId).success ||
          asset.state !== 'READY' || kind === null ||
          !hashSchema.safeParse(asset.hash).success ||
          !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 ||
          mediaOrder.slots[ordinal]?.kind !== kind) {
        frozenMediaValid = false;
        continue;
      }
      orderedAssets.push({
        ordinal, assetId, kind, pinnedHash: asset.hash, pinnedBytes: asset.bytes,
      });
    }
  }
  if (!frozenMediaValid || orderedAssets.length !== mediaSlots)
    block('FROZEN_MEDIA_BINDING_INVALID');

  const redacted = unicode.summary;
  const unicodeSourceConsistent =
    redacted.scope === 'FROZEN_UNICODE_NOT_ANDROID_INPUT' &&
    redacted.canType === false && redacted.canDispatch === false &&
    redacted.blockers.length === 0 &&
    unicode.entries.length <= 64 &&
    (redacted.status === 'NO_TEXT_FIELDS'
      ? unicode.entries.length === 0 && redacted.fields.length === 0
      : redacted.status === 'EXACT_FROZEN_TEXT_METHOD_UNVERIFIED' &&
        unicode.entries.length > 0 &&
        unicode.entries.every((entry) => redacted.fields.some((field) =>
          field.ordinal === entry.ordinal &&
          field.kind === entry.kind &&
          field.scope === entry.scope.toUpperCase() &&
          field.evidence === 'EXACT_FROZEN_TEXT' &&
          field.blockers.length === 0)));
  if (!unicodeSourceConsistent) block('UNICODE_SOURCE_INVALID');
  const textFields = unicodeSourceConsistent ? unicode.entries.length : 0;
  if (mediaSlots === 0 && textFields === 0 && validIds && unicodeSourceConsistent)
    block('EMPTY_FROZEN_CONTENT');

  const summary: FrozenComposePreflight = {
    scope: 'FROZEN_COMPOSE_NOT_ANDROID_VERIFIED',
    status: blockers.length ? 'BLOCKED' : 'FROZEN_EXPECTATIONS_LIVE_UNVERIFIED',
    app: appPinned ? 'PINNED_NOT_OBSERVED' : 'MISSING',
    account: accountPinned ? 'PINNED_NOT_OBSERVED' : 'MISSING',
    target: targetPinned ? 'PINNED_NOT_OBSERVED' : 'MISSING',
    content: contentPinned ? 'PINNED_NOT_OBSERVED' : 'MISSING',
    mediaSlots, textFields, blockers,
    canVerify: false, canPublish: false, canDispatch: false,
  };
  if (blockers.length) return { manifest: null, summary };

  // Only the trusted private caller may consume raw binding IDs and digests.
  // The public jobStageReview DTO receives summary alone.
  const manifest: FrozenComposeManifest = {
    workflowAppId: appId as string,
    workflowVersionId: snapshot.workflowVersionId,
    workflowHash: snapshot.workflowHash,
    accountId: snapshot.accountId as string,
    targetId: snapshot.targetId as string,
    contentId: snapshot.contentId,
    orderedAssetIds: [...ids],
    orderedAssets,
    fields: unicode.entries.map(({ ordinal, scope, kind, utf8Hash, utf8Bytes }) =>
      ({ ordinal, scope, kind, utf8Hash, utf8Bytes })),
  };
  return { manifest, summary };
}
