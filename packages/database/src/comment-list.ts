import { createHash } from 'node:crypto';
import { hashSchema, idSchema, isSafeKey } from '@autoreels/contracts';
import type { JobSnapshot } from '@autoreels/contracts';
import { contentHash } from '@autoreels/domain';

/** Private DB/host data only. Never send raw comments or digests to StudioApi. */
export interface FrozenCommentItem {
  ordinal: number;
  value: string;
  utf8Hash: string;
  utf8Bytes: number;
  effectKey: string;
  payloadHash: string;
}
export type FrozenCommentBlocker =
  | 'FROZEN_SNAPSHOT_MISMATCH'
  | 'POST_BINDING_INVALID'
  | 'COMMENT_DECLARATION_INVALID'
  | 'COMMENT_LIST_INVALID'
  | 'COMMENT_TEXT_UNSAFE'
  | 'COMMENT_TEXT_TOO_LARGE';
export interface FrozenCommentListPlan {
  scope: 'FROZEN_COMMENT_LIST_NOT_PROVIDER_VERIFIED';
  status: 'BLOCKED' | 'FROZEN_COMMENTS_PROVIDER_UNVERIFIED';
  blockers: FrozenCommentBlocker[];
  items: FrozenCommentItem[];
  canDispatch: false;
  canRetry: false;
  canConfirm: false;
}
const MAX_COMMENT_ITEMS = 32;
const MAX_UTF16_UNITS = 25000;
const MAX_UTF8_BYTES = 32768;
const MAX_TOTAL_UTF8_BYTES = 262144;
const bidiControls = /[\u202a-\u202e\u2066-\u2069]/u;
const bareCarriageReturn = /\r(?!\n)/u;

/** TextEncoder otherwise silently replaces unpaired UTF-16 surrogates. */
function validExactUnicode(value: string): boolean {
  if (bidiControls.test(value) || bareCarriageReturn.test(value)) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if ((code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
        code === 0x7f) return false;
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}

/**
 * S100.1: exact immutable comment preparation, NOT permission to send/retry.
 * A database-side caller must independently check the persisted PUBLISH effect;
 * the provided post effect is a journal binding, not certified provider proof.
 */
export function deriveFrozenCommentList(input: {
  jobId: string;
  snapshot: JobSnapshot;
  snapshotHash: string;
  postEffectId: string;
  postEffectKey: string;
  fieldKey: string;
  scope: 'row' | 'process';
}): FrozenCommentListPlan {
  const blockers: FrozenCommentBlocker[] = [];
  const block = (code: FrozenCommentBlocker): void => {
    if (!blockers.includes(code)) blockers.push(code);
  };
  const report = (items: FrozenCommentItem[] = []): FrozenCommentListPlan => ({
    scope: 'FROZEN_COMMENT_LIST_NOT_PROVIDER_VERIFIED',
    status: blockers.length ? 'BLOCKED' : 'FROZEN_COMMENTS_PROVIDER_UNVERIFIED',
    blockers,
    items: blockers.length ? [] : items,
    canDispatch: false, canRetry: false, canConfirm: false,
  });

  let snapshotMatches = false;
  try {
    snapshotMatches = hashSchema.safeParse(input.snapshotHash).success &&
      contentHash(input.snapshot) === input.snapshotHash;
  } catch {
    // Malformed or unsafe frozen JSON is not usable as an exact source.
  }
  if (!snapshotMatches) block('FROZEN_SNAPSHOT_MISMATCH');
  if (!idSchema.safeParse(input.jobId).success ||
      !idSchema.safeParse(input.postEffectId).success ||
      !hashSchema.safeParse(input.postEffectKey).success)
    block('POST_BINDING_INVALID');
  if (!isSafeKey(input.fieldKey) || !['row', 'process'].includes(input.scope) ||
      !Array.isArray(input.snapshot?.bundle?.inputs) ||
      input.snapshot.bundle.inputs.length > 256) {
    block('COMMENT_DECLARATION_INVALID');
    return report();
  }
  const definitions = input.snapshot.bundle.inputs.filter((d) =>
    d?.key === input.fieldKey && d.scope === input.scope);
  if (definitions.length !== 1 ||
      definitions[0]!.type !== 'list' || definitions[0]!.itemType !== 'text') {
    block('COMMENT_DECLARATION_INVALID');
    return report();
  }
  const record = input.scope === 'row' ? input.snapshot.fields : input.snapshot.processFields;
  if (!record || typeof record !== 'object' || Array.isArray(record) ||
      !Object.hasOwn(record, input.fieldKey)) {
    block('COMMENT_LIST_INVALID');
    return report();
  }
  const raw: unknown = record[input.fieldKey];
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_COMMENT_ITEMS) {
    block('COMMENT_LIST_INVALID');
    return report();
  }
  const items: FrozenCommentItem[] = [];
  let totalBytes = 0;
  for (const [ordinal, value] of raw.entries()) {
    if (typeof value !== 'string' || value.length === 0 ||
        !validExactUnicode(value)) {
      block('COMMENT_TEXT_UNSAFE');
      continue;
    }
    const utf8 = Buffer.from(value, 'utf8');
    totalBytes += utf8.byteLength;
    if (value.length > MAX_UTF16_UNITS || utf8.byteLength > MAX_UTF8_BYTES ||
        totalBytes > MAX_TOTAL_UTF8_BYTES) {
      block('COMMENT_TEXT_TOO_LARGE');
      continue;
    }
    const utf8Hash = createHash('sha256').update(utf8).digest('hex');
    const binding = {
      kind: 'FROZEN_COMMENT_V1',
      jobId: input.jobId,
      snapshotHash: input.snapshotHash,
      postEffectId: input.postEffectId,
      postEffectKey: input.postEffectKey,
      fieldKey: input.fieldKey,
      scope: input.scope,
      ordinal,
      utf8Hash,
      utf8Bytes: utf8.byteLength,
    };
    items.push({
      ordinal, value, utf8Hash, utf8Bytes: utf8.byteLength,
      effectKey: contentHash({ ...binding, domain: 'COMMENT_EFFECT_KEY' }),
      payloadHash: contentHash({ ...binding, domain: 'COMMENT_PAYLOAD' }),
    });
  }
  return report(items);
}
