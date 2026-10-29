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
  copySelection,
  pasteSelection,
  createGroup,
  removeGroup,
  groupBounds,
  moveNodes,
  moveGroup,
  toggleGroup,
  rerouteEdge,
  alignNodes,
  selectionToSubgraph,
  layoutGraph,
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

describe('selection clipboard and visual groups', () => {
  it('copies internal wires and complete groups, remaps all identities and preserves remote references without aliases', () => {
    const b = bundle(),
      g = b.graphs[0]!;
    g.edges[0]!.reroute = { x: 100, y: 20 };
    const group = createGroup(g, ['start', 'end'], 'Selection');
    const copied = copySelection(g, ['start', 'end']);
    const ids = pasteSelection(g, copied, { x: 50, y: 60 });
    expect(g.nodes).toHaveLength(4);
    expect(g.edges).toHaveLength(2);
    expect(g.groups).toHaveLength(2);
    expect(g.edges[1]).toMatchObject({
      source: ids[0],
      target: ids[1],
      reroute: { x: 150, y: 80 },
    });
    expect(g.groups![1]!.id).not.toBe(group);
    expect(g.groups![1]!.nodeIds).toEqual(ids);
    g.nodes[2]!.name = 'Changed';
    expect(copied.nodes[0]!.name).toBe('Start');
    expect(g.nodes[0]!.name).toBe('Start');
    expect(new Set(g.nodes.map((n) => n.id)).size).toBe(4);
  });
  it('excludes crossing wires and incomplete groups and keeps deletion consistent', () => {
    const g = bundle().graphs[0]!;
    createGroup(g, ['start', 'end']);
    expect(copySelection(g, ['start']).edges).toEqual([]);
    expect(copySelection(g, ['start']).groups).toEqual([]);
    const nodes = structuredClone(g.nodes),
      edges = structuredClone(g.edges);
    removeGroup(g, g.groups![0]!.id);
    expect(g.nodes).toEqual(nodes);
    expect(g.edges).toEqual(edges);
    expect(() => createGroup(g, ['start'])).toThrow('hai');
  });
  it('derives outline geometry from current world positions and makes one undo transaction for paste', () => {
    const h = new EditorHistory(bundle());
    h.mutate((b) => {
      createGroup(b.graphs[0]!, ['start', 'end']);
    });
    const before = h.bundle,
      copied = copySelection(before.graphs[0]!, ['start', 'end']);
    h.mutate((b) => pasteSelection(b.graphs[0]!, copied));
    expect(h.bundle.graphs[0]!.groups).toHaveLength(2);
    expect(h.undo()).toEqual(before);
    const g = h.redo().graphs[0]!;
    g.nodes[0]!.x = -50;
    const bounds = groupBounds(g, g.groups![0]!)!;
    expect(bounds).toMatchObject({ x: -70, y: -32 });
    expect(bounds.width).toBe(700);
  });
});

describe('group movement, layout and routed wires', () => {
  it('collapses visually, moves every member and its internal waypoint in one reversible action', () => {
    const h = new EditorHistory(bundle());
    h.mutate((b) => {
      const g = b.graphs[0]!;
      createGroup(g, ['start', 'end']);
      rerouteEdge(g, 'e', { x: 300, y: 40 });
    });
    const before = h.bundle,
      groupId = before.graphs[0]!.groups![0]!.id;
    h.mutate((b) => {
      toggleGroup(b.graphs[0]!, groupId);
      moveGroup(b.graphs[0]!, groupId, -40, 70);
    });
    expect(h.bundle.graphs[0]!.groups![0]!.collapsed).toBe(true);
    expect(h.bundle.graphs[0]!.nodes.map((n) => [n.x, n.y])).toEqual([
      [-40, 70],
      [360, 70],
    ]);
    expect(h.bundle.graphs[0]!.edges[0]!.reroute).toEqual({ x: 260, y: 110 });
    expect(h.undo()).toEqual(before);
  });
  it('keeps crossing waypoints fixed and rejects invalid coordinates before mutation', () => {
    const g = bundle().graphs[0]!;
    rerouteEdge(g, 'e', { x: 100, y: 50 });
    moveNodes(g, [{ id: 'start', x: 20, y: 20 }]);
    expect(g.edges[0]!.reroute).toEqual({ x: 100, y: 50 });
    const before = structuredClone(g);
    expect(() =>
      moveNodes(g, [
        { id: 'end', x: 100, y: 100 },
        { id: 'missing', x: 1, y: 1 },
      ]),
    ).toThrow();
    expect(g).toEqual(before);
    expect(() => rerouteEdge(g, 'e', { x: Infinity, y: 0 })).toThrow();
    rerouteEdge(g, 'e', null);
    expect(g.edges[0]).not.toHaveProperty('reroute');
  });
  it('aligns and distributes using actual widths and lays out large nodes without overlap', () => {
    const g = bundle().graphs[0]!;
    const third = addNode(g, 'wait', 900, 200);
    g.nodes[0]!.w = 500;
    g.nodes[1]!.w = 100;
    g.nodes[2]!.w = 200;
    alignNodes(g, ['start', 'end', third], 'horizontal');
    const [a, b, c] = g.nodes;
    expect(b!.x - a!.x - a!.w!).toBe(c!.x - b!.x - b!.w!);
    alignNodes(g, ['start', 'end', third], 'top');
    expect(new Set(g.nodes.map((n) => n.y)).size).toBe(1);
    rerouteEdge(g, 'e', { x: 100, y: 100 });
    layoutGraph(g);
    expect(g.nodes[1]!.x).toBeGreaterThan(g.nodes[0]!.x + 500);
    expect(g.edges[0]).not.toHaveProperty('reroute');
    createGroup(g, ['start', 'end']);
    expect(() => createGroup(g, ['end', third])).toThrow('nhóm');
  });
});

describe('atomic selection extraction', () => {
  function chain() {
    const b = bundle(),
      g = b.graphs[0]!;
    const first = insertOnEdge(g, 'e', 'wait');
    const last = insertOnEdge(g, g.edges.find((e) => e.source === first)!.id, 'log');
    g.nodes.find((n) => n.id === last)!.config = { messageTemplate: '{{row.caption}}' };
    return { b, g, first, last };
  }
  it('extracts the full selected closure and reconnects external wires with one undo step', () => {
    const { b, first, last } = chain(),
      h = new EditorHistory(b);
    let created: ReturnType<typeof selectionToSubgraph> | undefined;
    h.mutate((next) => {
      created = selectionToSubgraph(next, 'main', [first, last], 'Child');
    });
    const parent = h.bundle.graphs[0]!,
      child = h.bundle.graphs[1]!;
    expect(parent.nodes.map((n) => n.type)).toEqual(['start', 'end', 'subflow']);
    expect(parent.edges.some((e) => e.source === 'start' && e.target === created!.nodeId)).toBe(
      true,
    );
    expect(parent.edges.some((e) => e.source === created!.nodeId && e.target === 'end')).toBe(true);
    expect(child.nodes.filter((n) => [first, last].includes(n.id))).toHaveLength(2);
    expect(child.edges).toHaveLength(3);
    expect(validateWorkflowShape(h.bundle).ok).toBe(true);
    expect(h.undo()).toEqual(b);
    expect(h.redo().graphs).toHaveLength(2);
  });
  it('rejects a branched exit, disconnected nodes and local-dependent code without changing its input', () => {
    const { b, g, first, last } = chain();
    const before = structuredClone(b);
    expect(() => selectionToSubgraph(b, 'main', [first, 'end'], 'Bad')).toThrow();
    expect(b).toEqual(before);
    const node = g.nodes.find((n) => n.id === last)!;
    node.config.messageTemplate = '{{local.value}}';
    const local = structuredClone(b);
    expect(() => selectionToSubgraph(b, 'main', [first, last], 'Bad')).toThrow('local');
    expect(b).toEqual(local);
    node.config.messageTemplate = 'Safe';
    g.edges.push({ id: 'error', source: last, target: 'end', port: 'error' });
    const branched = structuredClone(b);
    expect(() => selectionToSubgraph(b, 'main', [first, last], 'Bad')).toThrow('đường ra');
    expect(b).toEqual(branched);
  });
});
