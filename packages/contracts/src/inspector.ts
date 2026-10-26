import { z } from 'zod';
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
export function queryUiElements(nodes: UiElement[], raw: unknown): UiElement[] {
  const selector = uiSelectorSchema.parse(raw);
  return nodes.filter(
    (n) =>
      (selector.clickable === undefined || selector.clickable === n.clickable) &&
      (selector.enabled === undefined || selector.enabled === n.enabled) &&
      selector.all.every((p) => {
        if (n.password && (p.field === 'text' || p.field === 'description')) return false;
        return p.op === 'EQ' ? n[p.field] === p.value : n[p.field].includes(p.value);
      }),
  );
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
