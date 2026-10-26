import { assertJsonSafe, isSafeKey } from '@autoreels/contracts';
import type { JsonValue } from '@autoreels/contracts';

export interface Bindings {
  row: Record<string, JsonValue>;
  process: Record<string, JsonValue>;
  local: Record<string, JsonValue>;
  output: Record<string, JsonValue>;
}
export function resolvePath(path: string, bindings: Bindings): JsonValue {
  const parts = path.split('.'),
    root = parts.shift();
  if (
    !root ||
    !['row', 'process', 'local', 'output'].includes(root) ||
    parts.length === 0 ||
    parts.some((k) => !isSafeKey(k) && !/^(0|[1-9]\d*)$/.test(k))
  )
    throw new Error('Unsafe binding path');
  let value: unknown = bindings[root as keyof Bindings];
  for (const part of parts) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, part))
      throw new Error('Missing binding: ' + path);
    value = (value as Record<string, unknown>)[part];
  }
  assertJsonSafe(value);
  return value as JsonValue;
}
export function evaluate(
  expression: JsonValue | undefined,
  bindings: Bindings,
  depth = 0,
): JsonValue {
  if (depth > 32 || !expression || typeof expression !== 'object' || Array.isArray(expression))
    throw new Error('Invalid expression AST');
  const e = expression;
  if (
    e.kind === 'literal' &&
    Object.hasOwn(e, 'value') &&
    Object.keys(e).every((k) => ['kind', 'value'].includes(k))
  ) {
    assertJsonSafe(e.value);
    return e.value!;
  }
  if (e.kind === 'path' && typeof e.path === 'string' && Object.keys(e).length === 2)
    return resolvePath(e.path, bindings);
  if (e.kind === 'not' && Object.keys(e).length === 2) {
    const value = evaluate(e.value, bindings, depth + 1);
    if (typeof value !== 'boolean') throw new Error('not requires boolean');
    return !value;
  }
  if (
    e.kind !== 'binary' ||
    !Object.keys(e).every((k) => ['kind', 'op', 'left', 'right'].includes(k))
  )
    throw new Error('Unknown AST operation');
  const a = evaluate(e.left, bindings, depth + 1);
  if (e.op === 'and' || e.op === 'or') {
    if (typeof a !== 'boolean') throw new Error('Boolean operator requires boolean');
    if (e.op === 'and' && !a) return false;
    if (e.op === 'or' && a) return true;
    const b = evaluate(e.right, bindings, depth + 1);
    if (typeof b !== 'boolean') throw new Error('Boolean operator requires boolean');
    return b;
  }
  const b = evaluate(e.right, bindings, depth + 1);
  if (e.op === 'eq' || e.op === 'neq') {
    if (typeof a !== typeof b || (a !== null && typeof a === 'object'))
      throw new Error('Equality requires same primitive types');
    return e.op === 'eq' ? a === b : a !== b;
  }
  if (typeof a !== 'number' || typeof b !== 'number')
    throw new Error('Comparison requires finite numbers');
  switch (e.op) {
    case 'gt':
      return a > b;
    case 'gte':
      return a >= b;
    case 'lt':
      return a < b;
    case 'lte':
      return a <= b;
    default:
      throw new Error('Unknown comparison operator');
  }
}
export function renderTemplate(template: string, bindings: Bindings): string {
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, path: string) => {
    const value = resolvePath(path.trim(), bindings);
    if (value !== null && typeof value === 'object')
      throw new Error('Template requires a scalar value');
    return String(value ?? '');
  });
}
