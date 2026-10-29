import { validateWorkflow as checkWorkflow } from './generated/workflow-validator.js';
import type { ValidationResult, WorkflowBundle } from './types.js';

const reserved = new Set(['__proto__', 'prototype', 'constructor']);
export function isSafeKey(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !reserved.has(key);
}
export function assertJsonSafe(
  value: unknown,
  limits = { depth: 64, entries: 200000, stringLength: 1048576 },
): void {
  let count = 0;
  let characters = 0;
  const active = new WeakSet<object>();
  function visit(v: unknown, depth: number): void {
    if (++count > limits.entries || depth > limits.depth)
      throw new Error('JSON resource budget exceeded');
    if (v === null || typeof v === 'boolean') return;
    if (typeof v === 'string') {
      characters += v.length;
      if (v.length > limits.stringLength || characters > 8388608)
        throw new Error('String budget exceeded');
      return;
    }
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) throw new Error('Non-finite number');
      return;
    }
    if (typeof v !== 'object') throw new Error('Only JSON values are accepted');
    const proto: unknown = Object.getPrototypeOf(v);
    if (!Array.isArray(v) && proto !== Object.prototype && proto !== null)
      throw new Error('Non-plain object');
    if (active.has(v)) throw new Error('Cyclic JSON value');
    active.add(v);
    if (
      Array.isArray(v) &&
      (proto !== Array.prototype ||
        Object.keys(v).length !== v.length ||
        Object.keys(v).some((key, index) => key !== String(index)))
    )
      throw new Error('Sparse, extended or non-plain array');
    if (Object.getOwnPropertySymbols(v).length) throw new Error('Symbol keys are unsupported');
    for (const [key, d] of Object.entries(Object.getOwnPropertyDescriptors(v))) {
      if (Array.isArray(v) && key === 'length') continue;
      if (reserved.has(key) || d.get || d.set) throw new Error('Unsafe key or accessor');
      visit(d.value as unknown, depth + 1);
    }
    active.delete(v);
  }
  visit(value, 0);
}

/** Shape only. Graph topology, effects and hardware eligibility are separate validators. */
export function validateWorkflowShape(input: unknown): ValidationResult<WorkflowBundle> {
  try {
    assertJsonSafe(input);
  } catch (e) {
    return {
      ok: false,
      issues: [
        { code: 'UNSAFE_JSON', path: '', message: e instanceof Error ? e.message : 'Invalid JSON' },
      ],
    };
  }
  if (!checkWorkflow(input))
    return {
      ok: false,
      issues: (checkWorkflow.errors ?? []).map((e) => ({
        code: 'INVALID_SHAPE',
        path: e.instancePath,
        message: e.message ?? 'Invalid workflow',
      })),
    };
  return { ok: true, value: input, issues: [] };
}
