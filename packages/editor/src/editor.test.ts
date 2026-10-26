import { describe, expect, it } from 'vitest';
import { NODE_DEFINITIONS, validateWorkflowShape } from '@autoreels/contracts';
import type { WorkflowBundle } from '@autoreels/contracts';
import {
  EditorHistory,
  addNode,
  connect,
  removeNodes,
  duplicateNodes,
  insertOnEdge,
  createSubgraph,
} from './index.js';

const bundle = (): WorkflowBundle => ({
  format: 'autoreels-workflow',
  schemaVersion: 2,
  workflow: { id: 'wf', appId: 'fb', name: 'Test', kind: 'main' },
  mainGraphId: 'main',
  inputs: [],
  outputs: [],
  dependencies: [],
  graphs: [
    {
      id: 'main',
      nodes: [
        { id: 'start', name: 'Start', type: 'start', x: 0, y: 0, config: {} },
        { id: 'end', name: 'End', type: 'end', x: 400, y: 0, config: {} },
      ],
      edges: [{ id: 'e', source: 'start', target: 'end', port: 'next' }],
      groups: [],
      inputs: [],
      outputs: [],
    },
  ],
});
describe('editor design transactions', () => {
  it('adds all forty types using shape-valid defaults', () => {
    const b = bundle();
    for (const d of NODE_DEFINITIONS) addNode(b.graphs[0]!, d.type, 10, 20);
    const result = validateWorkflowShape(b);
    expect(result.issues).toEqual([]);
  });
  it('keeps one undo transaction and rejects invalid mutation atomically', () => {
    const h = new EditorHistory(bundle());
    h.mutate((b) => {
      addNode(b.graphs[0]!, 'wait', 20, 30);
      b.workflow.name = 'Changed';
    });
    expect(h.bundle.graphs[0]!.nodes).toHaveLength(3);
    expect(h.undo().workflow.name).toBe('Test');
    expect(h.redo().workflow.name).toBe('Changed');
    expect(() =>
      h.mutate((b) => {
        b.graphs[0]!.nodes[0]!.x = NaN;
      }),
    ).toThrow();
    expect(h.bundle.graphs[0]!.nodes[0]!.x).toBe(0);
  });
  it('inserts on an edge and undoes the entire replacement', () => {
    const h = new EditorHistory(bundle());
    h.mutate((b) => insertOnEdge(b.graphs[0]!, 'e', 'wait'));
    expect(h.bundle.graphs[0]!.edges).toHaveLength(2);
    expect(h.undo()).toEqual(bundle());
  });
  it('prevents duplicate-output connections, self loops and free wire cycles', () => {
    const g = bundle().graphs[0]!;
    const wait = addNode(g, 'wait', 10, 10);
    expect(() => connect(g, 'start', 'next', wait)).toThrow('already');
    expect(() => connect(g, wait, 'next', wait)).toThrow('Invalid');
    g.edges = [];
    connect(g, 'start', 'next', wait);
    expect(() => connect(g, wait, 'next', 'start')).toThrow('cycle');
  });
  it('remaps copied nodes/edges and removes group membership consistently', () => {
    const g = bundle().graphs[0]!;
    const ids = duplicateNodes(g, ['start', 'end']);
    expect(new Set(g.nodes.map((n) => n.id)).size).toBe(4);
    expect(g.edges[1]!.source).toBe(ids[0]);
    g.groups = [{ id: 'group', name: 'G', nodeIds: ids }];
    removeNodes(g, ids);
    expect(g.groups).toEqual([]);
    expect(g.edges).toHaveLength(1);
  });
  it('preserves custom fields and subgraphs through undo/redo', () => {
    const h = new EditorHistory(bundle());
    h.mutate((b) => {
      createSubgraph(b, 'Child');
      b.inputs.push({ key: 'zero', type: 'number', scope: 'row', required: false });
    });
    const clone = h.bundle;
    clone.inputs[0]!.key = 'mutated';
    expect(h.bundle.inputs[0]!.key).toBe('zero');
    h.undo();
    expect(h.redo().graphs).toHaveLength(2);
  });
});
