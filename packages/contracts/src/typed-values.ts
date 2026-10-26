import type { FieldDefinition, JsonValue, ValidationIssue } from './types.js';
import { isSafeKey, assertJsonSafe } from './validation.js';
import { timezoneSchema, localDateSchema } from './models.js';

function isRef(v: unknown, key: string): boolean {
  return (
    typeof v === 'object' &&
    v !== null &&
    Object.keys(v).length === 1 &&
    typeof (v as Record<string, unknown>)[key] === 'string' &&
    /^[A-Za-z][A-Za-z0-9_-]*$/.test(String((v as Record<string, unknown>)[key]))
  );
}
function valid(
  type: FieldDefinition['type'],
  value: unknown,
  itemType?: FieldDefinition['itemType'],
): boolean {
  switch (type) {
    case 'text':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'url': {
      try {
        const u = new URL(String(value));
        return typeof value === 'string' && ['http:', 'https:'].includes(u.protocol);
      } catch {
        return false;
      }
    }
    case 'identity':
      return isRef(value, 'identityId');
    case 'file':
      return isRef(value, 'assetId');
    case 'file[]':
      return Array.isArray(value) && value.every((v) => isRef(v, 'assetId'));
    case 'datetime': {
      if (!value || typeof value !== 'object') return false;
      const d = value as Record<string, unknown>;
      return (
        Object.keys(d).length === 2 &&
        typeof d.instant === 'string' &&
        /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(d.instant) &&
        localDateSchema.safeParse(d.instant.slice(0, 10)).success &&
        Number.isFinite(Date.parse(d.instant)) &&
        timezoneSchema.safeParse(d.timezone).success
      );
    }
    case 'list':
      return Array.isArray(value) && value.every((v) => valid(itemType ?? 'text', v));
  }
}
export function validateTypedValues(
  fields: readonly FieldDefinition[],
  values: Record<string, JsonValue>,
  scope?: FieldDefinition['scope'],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  try {
    assertJsonSafe(values);
  } catch {
    return [{ code: 'UNSAFE_VALUES', message: 'Unsafe typed values', path: '' }];
  }
  const keys = new Set<string>();
  const allowed = new Set<string>();
  for (const f of fields) {
    if (!isSafeKey(f.key) || keys.has(f.key))
      issues.push({
        code: 'INVALID_FIELD_KEY',
        message: 'Unsafe or duplicate field key',
        path: f.key,
      });
    keys.add(f.key);
    if (scope && f.scope !== scope) continue;
    allowed.add(f.key);
    if (!Object.hasOwn(values, f.key)) {
      if (f.required)
        issues.push({ code: 'REQUIRED', message: 'Required value is missing', path: f.key });
      continue;
    }
    if (!valid(f.type, values[f.key], f.itemType))
      issues.push({
        code: 'TYPE_MISMATCH',
        message: 'Value does not match ' + f.type,
        path: f.key,
      });
  }
  for (const key of Object.keys(values))
    if (!allowed.has(key))
      issues.push({
        code: 'UNKNOWN_FIELD',
        message: 'Unknown field or wrong value scope',
        path: key,
      });
  return issues;
}
