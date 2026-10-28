import { describe, expect, it } from 'vitest';
import { validateWorkflowShape } from '@autoreels/contracts';
import type { WorkflowBundle, WorkflowGraph, WorkflowNode } from '@autoreels/contracts';
import {
  EditorHistory,
  copyPortableSelection,
  parsePortableSelection,
  pastePortableSelection,
  serializePortableSelection,
} from './index.js';

const node = (id: string, type: WorkflowNode['type'], config: WorkflowNode['config'] = {}): WorkflowNode => ({
  id, type, name: id, x: 20, y: 20, config,
});
const graph = (id: string, nodes: WorkflowNode[], edges: WorkflowGraph['edges']): WorkflowGraph => ({
  id,
  nodes,
  edges,
  inputs: [],
  outputs: [],
  groups: [],
});
function fixture(): WorkflowBundle {
  return {
    format: 'autoreels-workflow',
    schemaVersion: 2,
    workflow: { id: 'wf_clipboard', appId: 'fb', name: 'Clipboard fixture', kind: 'main' },
    mainGraphId: 'main',
    inputs: [],
    outputs: [],
    dependencies: [],
    graphs: [
      {
        ...graph(
          'main',
          [
            node('start', 'start'),
            node('call_one', 'subflow', { graphRef: 'child_one', inputMapping: {}, outputMapping: {} }),
            node('log_one', 'log', { level: 'info', messageTemplate: 'done', redactionPolicy: 'default' }),
            node('end', 'end'),
          ],
          [
            { id: 'e1', source: 'start', target: 'call_one', port: 'next' },
            { id: 'e2', source: 'call_one', target: 'log_one', port: 'next' },
            { id: 'e3', source: 'log_one', target: 'end', port: 'next' },
          ],
        ),
        groups: [{ id: 'selected_group', name: 'Selected', nodeIds: ['call_one', 'log_one'] }],
      },
      graph(
        'child_one',
        [
          node('sub_start', 'start'),
          node('call_two', 'subflow', { graphRef: 'child_two', inputMapping: {}, outputMapping: {} }),
          node('sub_end', 'end'),
        ],
        [
          { id: 'ce1', source: 'sub_start', target: 'call_two', port: 'next' },
          { id: 'ce2', source: 'call_two', target: 'sub_end', port: 'next' },
        ],
      ),
      graph(
        'child_two',
        [node('deep_start', 'start'), node('deep_wait', 'wait', { minMs: 500, maxMs: 1000 }), node('deep_end', 'end')],
        [
          { id: 'de1', source: 'deep_start', target: 'deep_wait', port: 'next' },
          { id: 'de2', source: 'deep_wait', target: 'deep_end', port: 'next' },
        ],
      ),
    ],
  };
}
const target = (): WorkflowBundle => ({
  ...fixture(),
  workflow: { id: 'wf_target', appId: 'fb', name: 'Destination', kind: 'main' },
  graphs: [graph('main', [node('target_start', 'start'), node('target_end', 'end')], [
    { id: 'target_edge', source: 'target_start', target: 'target_end', port: 'next' },
  ])],
});

describe('P04 portable graph clipboard', () => {
  it('transfers a transitive local subgraph closure across workflows in one undo transaction', () => {
    const source = fixture();
    expect(validateWorkflowShape(source).ok).toBe(true);
    const before = structuredClone(source);
    const fragment = copyPortableSelection(source, 'main', ['call_one', 'log_one']);
    expect(fragment.graphs.map((g) => g.id).sort()).toEqual(['child_one', 'child_two']);
    expect(fragment.selection.edges.map((e) => e.id)).toEqual(['e2']);
    expect(fragment.selection.groups.map((g) => g.id)).toEqual(['selected_group']);
    const systemText = serializePortableSelection(fragment);
    expect(parsePortableSelection('normal user text')).toBeNull();
    const decoded = parsePortableSelection(systemText)!;
    const history = new EditorHistory(target());
    const beforeTarget = history.bundle;
    let pasted: string[] = [];
    history.mutate((bundle) => { pasted = pastePortableSelection(bundle, 'main', decoded); });
    const saved = history.bundle;
    expect(saved.graphs).toHaveLength(3);
    expect(saved.graphs[0]!.nodes).toHaveLength(4);
    expect(saved.graphs[0]!.edges).toHaveLength(2);
    expect(saved.graphs[0]!.groups).toHaveLength(1);
    expect(saved.graphs[0]!.groups![0]!.nodeIds).toEqual(pasted);
    const call = saved.graphs[0]!.nodes.find((n) => n.id === pasted[0])!;
    expect(call.config.graphRef).not.toBe('child_one');
    const first = saved.graphs.find((g) => g.id === call.config.graphRef)!;
    expect(first).toBeDefined();
    const nextRef = first.nodes.find((n) => n.type === 'subflow')!.config.graphRef;
    expect(saved.graphs.some((g) => g.id === nextRef)).toBe(true);
    expect(saved.graphs.every((g) => g.id !== 'child_one' && g.id !== 'child_two')).toBe(true);
    expect(validateWorkflowShape(saved).ok).toBe(true);
    expect(history.undo()).toEqual(beforeTarget);
    expect(history.redo()).toEqual(saved);
    expect(source).toEqual(before);
  });

  it('creates fresh node, group, edge and graph identities on repeated paste', () => {
    const fragment = copyPortableSelection(fixture(), 'main', ['call_one', 'log_one']);
    const h = new EditorHistory(target());
    h.mutate((b) => { pastePortableSelection(b, 'main', fragment); });
    h.mutate((b) => { pastePortableSelection(b, 'main', fragment, { x: 80, y: 90 }); });
    const b = h.bundle;
    expect(b.graphs).toHaveLength(5);
    expect(new Set(b.graphs.map((g) => g.id)).size).toBe(5);
    const root = b.graphs[0]!;
    expect(new Set(root.nodes.map((n) => n.id)).size).toBe(root.nodes.length);
    expect(new Set(root.edges.map((e) => e.id)).size).toBe(root.edges.length);
    expect(new Set(root.groups!.map((g) => g.id)).size).toBe(root.groups!.length);
    for (const g of b.graphs) {
      expect(new Set(g.nodes.map((n) => n.id)).size).toBe(g.nodes.length);
      expect(new Set(g.edges.map((e) => e.id)).size).toBe(g.edges.length);
    }
  });

  it('refuses incompatible apps and malformed or hostile external clipboard before changing the destination', () => {
    const fragment = copyPortableSelection(fixture(), 'main', ['call_one', 'log_one']);
    const h = new EditorHistory({ ...target(), workflow: { ...target().workflow, appId: 'tt' } });
    const before = h.bundle;
    expect(() => h.mutate((b) => pastePortableSelection(b, 'main', fragment))).toThrow('ứng dụng');
    expect(h.bundle).toEqual(before);
    const raw = serializePortableSelection(fragment);
    expect(() => parsePortableSelection(raw + 'x')).toThrow();
    expect(() => parsePortableSelection(raw.slice(0, raw.indexOf('{')) + '{"__proto__":{}}')).toThrow();
    expect(() => parsePortableSelection(raw + 'x'.repeat(1_048_576))).toThrow('kích thước');
    const broken = structuredClone(fragment);
    broken.selection.edges[0]!.target = 'unselected';
    expect(() => serializePortableSelection(broken)).toThrow('Dây nối');
    expect(h.bundle).toEqual(before);
  });

  it('rejects missing and recursive local graph dependencies instead of orphaning calls', () => {
    const source = fixture();
    source.graphs.pop();
    expect(() => copyPortableSelection(source, 'main', ['call_one'])).toThrow('phụ thuộc');
    const cycle = fixture();
    cycle.graphs[2]!.nodes[1] = node('cycle', 'subflow', {
      graphRef: 'child_one', inputMapping: {}, outputMapping: {},
    });
    expect(() => copyPortableSelection(cycle, 'main', ['call_one'])).toThrow('đệ quy');
  });
});
