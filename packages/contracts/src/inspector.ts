import { z } from 'zod';
import { assertJsonSafe } from './validation.js';
import type { DeviceCapture } from './devices.js';
export interface UiElement {
  id: string;
  parentId: string | null;
  depth: number;
  resourceId: string;
  text: string;
  description: string;
  className: string;
  packageName: string;
  clickable: boolean;
  enabled: boolean;
  focusable: boolean;
  scrollable: boolean;
  password: boolean;
  bounds: { left: number; top: number; right: number; bottom: number };
}
export interface InspectorSnapshot {
  capture: DeviceCapture;
  nodes: UiElement[];
  foreground: string | null;
  startedAt: string;
  durationMs: number;
  correlation: 'BOUNDED_SEQUENTIAL';
}
const predicate = z.strictObject({
  field: z.enum(['resourceId', 'text', 'description', 'className', 'packageName']),
  op: z.enum(['EQ', 'CONTAINS']),
  value: z.string().min(1).max(8192),
});
export const uiSelectorSchema = z.strictObject({
  version: z.literal(1),
  all: z.array(predicate).min(1).max(12),
  clickable: z.boolean().optional(),
  enabled: z.boolean().optional(),
});
export type UiSelector = z.infer<typeof uiSelectorSchema>;
const relativeSelector = z.strictObject({
  all: z.array(predicate).min(1).max(12),
  clickable: z.boolean().optional(),
  enabled: z.boolean().optional(),
});
export const uiSelectorV2Schema = z.strictObject({
  version: z.literal(2),
  strategies: z.array(
    relativeSelector.extend({
      ancestor: z.strictObject({
        all: z.array(predicate).min(1).max(12),
        maxDepth: z.number().int().min(1).max(20),
      }).optional(),
    }),
  ).min(1).max(5),
});
export type UiSelectorV2 = z.infer<typeof uiSelectorV2Schema>;
export interface UiSelectorMatchReport {
  nodes: UiElement[];
  strategyIndex: number | null;
  totalStrategies: number;
  attempts: { strategyIndex: number; count: number }[];
  ambiguous: boolean;
}

function matchPredicate(
  element: UiElement,
  selector: z.infer<typeof relativeSelector>,
): boolean {
  return (
    (selector.clickable === undefined || selector.clickable === element.clickable) &&
    (selector.enabled === undefined || selector.enabled === element.enabled) &&
    selector.all.every((p) => {
      if (element.password && (p.field === 'text' || p.field === 'description')) return false;
      return p.op === 'EQ' ? element[p.field] === p.value : element[p.field].includes(p.value);
    })
  );
}

/**
 * Read-only selector query on one frozen XML tree. Fallback is attempted only
 * for ZERO matches; ambiguous matches remain explicit rather than choosing the
 * first phone element or falling through to a more permissive strategy.
 */
export function inspectUiSelectorMatches(
  nodes: UiElement[],
  raw: unknown,
): UiSelectorMatchReport {
  assertJsonSafe(raw, { depth: 20, entries: 10000, stringLength: 8192 });
  if (nodes.length > 10000) throw new Error('INSPECTOR_NODE_BUDGET');
  const version = raw && typeof raw === 'object' && 'version' in raw
    ? (raw as { version: unknown }).version
    : null;
  const strategies: UiSelectorV2['strategies'] = version === 1
    ? [{ ...uiSelectorSchema.parse(raw) }]
    : uiSelectorV2Schema.parse(raw).strategies;
  const byId = new Map<string, UiElement>();
  for (const element of nodes) {
    if (byId.has(element.id)) throw new Error('INSPECTOR_DUPLICATE_ELEMENT_ID');
    byId.set(element.id, element);
  }
  const attempts: UiSelectorMatchReport['attempts'] = [];
  for (let index = 0; index < strategies.length; index++) {
    const selector = strategies[index]!;
    const matching = nodes.filter((element) => {
      if (!matchPredicate(element, selector)) return false;
      if (!selector.ancestor) return true;
      let parentId = element.parentId;
      const seen = new Set([element.id]);
      for (let depth = 1; depth <= selector.ancestor.maxDepth && parentId; depth++) {
        if (seen.has(parentId)) throw new Error('INSPECTOR_PARENT_CYCLE');
        seen.add(parentId);
        const ancestor = byId.get(parentId);
        if (!ancestor) return false;
        if (matchPredicate(ancestor, selector.ancestor)) return true;
        parentId = ancestor.parentId;
      }
      return false;
    });
    attempts.push({ strategyIndex: index + 1, count: matching.length });
    if (matching.length > 0) {
      return {
        nodes: matching,
        strategyIndex: index + 1,
        totalStrategies: strategies.length,
        attempts,
        ambiguous: matching.length > 1,
      };
    }
  }
  return {
    nodes: [],
    strategyIndex: null,
    totalStrategies: strategies.length,
    attempts,
    ambiguous: false,
  };
}

export function queryUiElements(nodes: UiElement[], raw: unknown): UiElement[] {
  return inspectUiSelectorMatches(nodes, raw).nodes;
}
export function pickUiElement(nodes: UiElement[], x: number, y: number): UiElement | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return (
    nodes
      .filter(
        (n) => x >= n.bounds.left && x < n.bounds.right && y >= n.bounds.top && y < n.bounds.bottom,
      )
      .sort(
        (a, b) =>
          (a.bounds.right - a.bounds.left) * (a.bounds.bottom - a.bounds.top) -
            (b.bounds.right - b.bounds.left) * (b.bounds.bottom - b.bounds.top) ||
          b.depth - a.depth,
      )[0] ?? null
  );
}
export function suggestUiSelector(node: UiElement): UiSelector {
  const field = node.resourceId
    ? 'resourceId'
    : !node.password && node.description
      ? 'description'
      : !node.password && node.text
        ? 'text'
        : 'className';
  const all: UiSelector['all'] = [{ field, op: 'EQ', value: node[field] || 'android.view.View' }];
  if (node.packageName) all.push({ field: 'packageName', op: 'EQ', value: node.packageName });
  return { version: 1, all };
}


/** One fresh, read-only ADB/XML probe. No credential text or tap capability. */
export interface DeviceSelectorLiveReport {
  deviceId: string;
  observedAt: string;
  deviceRevision: number;
  transportGeneration: number;
  foreground: string | null;
  correlation: 'BOUNDED_SEQUENTIAL';
  status: 'NONE' | 'UNIQUE' | 'AMBIGUOUS';
  totalMatches: number;
  strategyIndex: number | null;
  totalStrategies: number;
  attempts: { strategyIndex: number; count: number }[];
  samples: {
    id: string;
    bounds: UiElement['bounds'];
    resourceId: string;
    className: string;
    packageName: string;
  }[];
  truncated: boolean;
}
