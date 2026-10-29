import { createHash } from 'node:crypto';
import { isSafeKey } from '@autoreels/contracts';
import type {
  FieldDefinition, FrozenUnicodeBlocker, FrozenUnicodePreflight, JobSnapshot,
} from '@autoreels/contracts';

export interface FrozenUnicodeTextEntry {
  ordinal: number;
  scope: 'row' | 'process';
  kind: 'TEXT' | 'URL';
  /** Exact frozen UTF-16 data, never normalized, trimmed or sent to the public API. */
  value: string;
  /** SHA-256 of the exact UTF-8 encoding, for future on-device readback comparison. */
  utf8Hash: string;
  utf8Bytes: number;
  scalarCount: number;
  isNfc: boolean;
  lineEndings: 'NONE' | 'LF' | 'CRLF' | 'MIXED';
}
export interface FrozenUnicodeTextPlan {
  /** PRIVATE database/host computation. Never serialize values as part of StudioApi. */
  entries: FrozenUnicodeTextEntry[];
  summary: FrozenUnicodePreflight;
}

const MAX_INPUT_DEFINITIONS = 256;
const MAX_TEXT_FIELDS = 64;
const MAX_UTF16_UNITS = 25000;
const MAX_UTF8_BYTES = 32768;
const bidiControls = /[\u202a-\u202e\u2066-\u2069]/u;
function hasForbiddenControls(value: string): boolean {
  if (bidiControls.test(value)) return true;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if ((code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
        code === 0x7f)
      return true;
  }
  return false;
}

/** Reject input which TextEncoder would silently replace with U+FFFD. */
function countScalars(value: string): number | null {
  let count = 0;
  for (let i = 0; i < value.length; i++, count++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (i + 1 >= value.length) return null;
      const next = value.charCodeAt(++i);
      if (next < 0xdc00 || next > 0xdfff) return null;
    } else if (code >= 0xdc00 && code <= 0xdfff) return null;
  }
  return count;
}
function endings(value: string): FrozenUnicodeTextEntry['lineEndings'] {
  const crlf = /\r\n/u.test(value);
  const bareLf = /(^|[^\r])\n/u.test(value);
  return crlf && bareLf ? 'MIXED' : crlf ? 'CRLF' : bareLf ? 'LF' : 'NONE';
}
function hasBareCarriageReturn(value: string): boolean {
  return /\r(?!\n)/u.test(value);
}

/**
 * S096.2: typed immutable data preparation, NOT a Unicode input capability.
 * Values and UTF-8 digests stay in the private plan. Public report contains
 * only declared field ordinals, scope/kind, and finite blocker codes.
 */
export function deriveFrozenUnicodeTextPlan(snapshot: JobSnapshot): FrozenUnicodeTextPlan {
  const blockers: FrozenUnicodeBlocker[] = [];
  const add = (reason: FrozenUnicodeBlocker): void => {
    if (!blockers.includes(reason)) blockers.push(reason);
  };
  const entries: FrozenUnicodeTextEntry[] = [];
  const fields: FrozenUnicodePreflight['fields'] = [];
  const rawDefinitions: unknown = snapshot.bundle?.inputs;
  const rowValues: unknown = snapshot.fields;
  const processValues: unknown = snapshot.processFields ?? {};
  const valuesValid = [rowValues, processValues].every((record) =>
    record && typeof record === 'object' && !Array.isArray(record));
  if (!Array.isArray(rawDefinitions) || rawDefinitions.length > MAX_INPUT_DEFINITIONS ||
      !valuesValid) {
    add('DECLARATION_INVALID');
    return { entries, summary: {
      scope: 'FROZEN_UNICODE_NOT_ANDROID_INPUT', status: 'BLOCKED',
      blockers, fields, canType: false, canDispatch: false,
    } };
  }

  const definitions = rawDefinitions as FieldDefinition[];
  const seen = new Set<string>();
  for (const def of definitions) {
    if (!def || !isSafeKey(def.key) ||
        !['row', 'process', 'output'].includes(def.scope)) {
      add('DECLARATION_INVALID');
      continue;
    }
    if (def.scope === 'output') continue;
    const key = def.scope + ':' + def.key;
    if (seen.has(key)) {
      add('DECLARATION_INVALID');
      continue;
    }
    seen.add(key);
    if (!['text', 'url'].includes(def.type)) continue;
    if (fields.length >= MAX_TEXT_FIELDS) {
      add('DECLARATION_INVALID');
      break;
    }
    const ordinal = fields.length;
    const scope = def.scope === 'row' ? 'ROW' : 'PROCESS';
    const kind = def.type === 'url' ? 'URL' : 'TEXT';
    const values = (def.scope === 'row' ? rowValues : processValues) as Record<string, unknown>;
    const reasons: FrozenUnicodeBlocker[] = [];
    const block = (reason: FrozenUnicodeBlocker): void => {
      if (!reasons.includes(reason)) reasons.push(reason);
      add(reason);
    };
    if (!Object.hasOwn(values, def.key)) {
      if (def.required) block('REQUIRED_VALUE_MISSING');
      else continue;
    } else {
      const value = values[def.key];
      if (typeof value !== 'string') block('VALUE_NOT_TEXT');
      else {
        const units = value.length;
        const scalars = countScalars(value);
        if (scalars === null || hasForbiddenControls(value) || hasBareCarriageReturn(value))
          block('UNSAFE_UNICODE');
        const utf8 = Buffer.from(value, 'utf8');
        if (units > MAX_UTF16_UNITS || utf8.byteLength > MAX_UTF8_BYTES)
          block('TEXT_TOO_LARGE');
        if (def.required && value.length === 0)
          block('REQUIRED_VALUE_MISSING');
        if (kind === 'URL') {
          try {
            const url = new URL(value);
            if (!['https:', 'http:'].includes(url.protocol) ||
                url.username || url.password || !url.hostname)
              block('URL_UNSAFE');
          } catch {
            block('URL_UNSAFE');
          }
        }
        if (!reasons.length && scalars !== null) {
          entries.push({
            ordinal, scope: def.scope, kind, value,
            utf8Hash: createHash('sha256').update(utf8).digest('hex'),
            utf8Bytes: utf8.byteLength, scalarCount: scalars,
            isNfc: value.normalize('NFC') === value,
            lineEndings: endings(value),
          });
        }
      }
    }
    fields.push({
      ordinal, scope, kind,
      evidence: reasons.length ? 'BLOCKED' : 'EXACT_FROZEN_TEXT',
      blockers: reasons,
    });
  }
  // A frozen field may contain non-text typed values; only undeclared keys are
  // unsafe. No mutable Process/Content lookup can fill in omitted values.
  for (const [scope, values] of [
    ['row', rowValues], ['process', processValues],
  ] as const) {
    for (const key of Object.keys(values as Record<string, unknown>)) {
      if (!seen.has(scope + ':' + key)) add('UNDECLARED_VALUE');
    }
  }
  return {
    entries: blockers.length ? [] : entries,
    summary: {
      scope: 'FROZEN_UNICODE_NOT_ANDROID_INPUT',
      status: blockers.length ? 'BLOCKED'
        : entries.length ? 'EXACT_FROZEN_TEXT_METHOD_UNVERIFIED' : 'NO_TEXT_FIELDS',
      blockers, fields, canType: false, canDispatch: false,
    },
  };
}
