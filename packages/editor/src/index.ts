import { NODE_DEFINITIONS, validateWorkflowShape } from '@autoreels/contracts';
import type {
  NodeType,
  WorkflowBundle,
  WorkflowGraph,
  WorkflowNode,
  Port,
  WorkflowEdge,
  WorkflowGroup,
} from '@autoreels/contracts';

const id = (prefix: string): string => prefix + '_' + crypto.randomUUID().replaceAll('-', '');
export function nodeDefaults(type: NodeType): WorkflowNode['config'] {
  switch (type) {
    case 'wait':
      return { minMs: 500, maxMs: 1000 };
    case 'condition':
      return { expression: { kind: 'literal', value: true } };
    case 'loop':
      return { maxIterations: 3, bodyGraphRef: '', itemBinding: 'item' };
    case 'setvar':
      return { targetPath: 'local.value', expression: { kind: 'literal', value: '' } };
    case 'log':
      return { level: 'info', messageTemplate: '{{row.caption}}', redactionPolicy: 'default' };
    case 'type':
      return {
        selector: '',
        textTemplate: '{{row.caption}}',
        unicodeMode: 'verified',
        verifyMode: 'readback',
      };
    case 'subflow':
      return { graphRef: '', inputMapping: {}, outputMapping: {} };
    case 'tap':
      return { selector: '', effectClassification: 'unknown-external-write' };
    case 'launch':
      return { packageRole: 'workflowApp', expectedForeground: 'workflowApp' };
    default:
      return {};
  }
}
export class EditorHistory {
  private current: WorkflowBundle;
  private undoStack: WorkflowBundle[] = [];
  private redoStack: WorkflowBundle[] = [];
  constructor(
    bundle: WorkflowBundle,
    readonly limit = 100,
  ) {
    this.current = structuredClone(bundle);
  }
  get bundle(): WorkflowBundle {
    return structuredClone(this.current);
  }
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  mutate(change: (bundle: WorkflowBundle) => void): WorkflowBundle {
    const next = structuredClone(this.current);
    change(next);
    const valid = validateWorkflowShape(next);
    if (!valid.ok) throw new Error(valid.issues[0]?.message ?? 'Invalid editor change');
    if (JSON.stringify(next) === JSON.stringify(this.current)) return this.bundle;
    this.undoStack.push(this.current);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.current = next;
    this.redoStack = [];
    return this.bundle;
  }
  undo(): WorkflowBundle {
    const previous = this.undoStack.pop();
    if (previous) {
      this.redoStack.push(this.current);
      this.current = previous;
    }
    return this.bundle;
  }
  redo(): WorkflowBundle {
    const next = this.redoStack.pop();
    if (next) {
      this.undoStack.push(this.current);
      this.current = next;
    }
    return this.bundle;
  }
}
export function graphById(bundle: WorkflowBundle, graphId: string): WorkflowGraph {
  const graph = bundle.graphs.find((g) => g.id === graphId);
  if (!graph) throw new Error('Graph not found');
  return graph;
}
export function addNode(graph: WorkflowGraph, type: NodeType, x: number, y: number): string {
  const definition = NODE_DEFINITIONS.find((d) => d.type === type);
  if (!definition) throw new Error('Unknown node type');
  const nodeId = id('node');
  graph.nodes.push({ id: nodeId, type, name: definition.label, x, y, config: nodeDefaults(type) });
  return nodeId;
}
export function connect(graph: WorkflowGraph, source: string, port: Port, target: string): void {
  const node = graph.nodes.find((n) => n.id === source),
    to = graph.nodes.find((n) => n.id === target);
  if (!node || !to || source === target) throw new Error('Invalid connection');
  const definition = NODE_DEFINITIONS.find((d) => d.type === node.type)!;
  if (!(definition.ports as readonly string[]).includes(port))
    throw new Error('Invalid output port');
  if (graph.edges.some((e) => e.source === source && e.port === port))
    throw new Error('Output already connected');
  // Prevent free wire cycles; loops use explicit body graphs.
  const seen = new Set<string>(),
    stack = [target];
  while (stack.length) {
    const next = stack.pop()!;
    if (next === source) throw new Error('Wire cycle is unsupported');
    if (seen.has(next)) continue;
    seen.add(next);
    stack.push(...graph.edges.filter((e) => e.source === next).map((e) => e.target));
  }
  graph.edges.push({ id: id('edge'), source, target, port });
}
export function removeNodes(graph: WorkflowGraph, selected: readonly string[]): void {
  const ids = new Set(selected);
  graph.nodes = graph.nodes.filter((n) => !ids.has(n.id));
  graph.edges = graph.edges.filter((e) => !ids.has(e.source) && !ids.has(e.target));
  graph.groups =
    graph.groups
      ?.map((g) => ({ ...g, nodeIds: g.nodeIds.filter((n) => !ids.has(n)) }))
      .filter((g) => g.nodeIds.length) ?? [];
}
export interface GraphClipboard {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  groups: WorkflowGroup[];
}
export function copySelection(graph: WorkflowGraph, selected: readonly string[]): GraphClipboard {
  const ids = new Set(selected);
  return structuredClone({
    nodes: graph.nodes.filter((n) => ids.has(n.id)),
    edges: graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
    groups: (graph.groups ?? []).filter(
      (g) => g.nodeIds.length && g.nodeIds.every((n) => ids.has(n)),
    ),
  });
}
export function pasteSelection(
  graph: WorkflowGraph,
  clipboard: GraphClipboard,
  offset = { x: 28, y: 28 },
): string[] {
  if (!Number.isFinite(offset.x) || !Number.isFinite(offset.y))
    throw new Error('Invalid paste offset');
  const map = new Map(clipboard.nodes.map((n) => [n.id, id('node')]));
  const nodes = clipboard.nodes.map((n) => ({
    ...structuredClone(n),
    id: map.get(n.id)!,
    x: n.x + offset.x,
    y: n.y + offset.y,
  }));
  const edges = clipboard.edges
    .filter((e) => map.has(e.source) && map.has(e.target))
    .map((e) => ({
      ...structuredClone(e),
      id: id('edge'),
      source: map.get(e.source)!,
      target: map.get(e.target)!,
      ...(e.reroute ? { reroute: { x: e.reroute.x + offset.x, y: e.reroute.y + offset.y } } : {}),
    }));
  const groups = clipboard.groups
    .filter((g) => g.nodeIds.length && g.nodeIds.every((n) => map.has(n)))
    .map((g) => ({
      ...structuredClone(g),
      id: id('group'),
      nodeIds: g.nodeIds.map((n) => map.get(n)!),
      ...(g.x !== undefined ? { x: g.x + offset.x } : {}),
      ...(g.y !== undefined ? { y: g.y + offset.y } : {}),
    }));
  graph.nodes.push(...nodes);
  graph.edges.push(...edges);
  graph.groups = [...(graph.groups ?? []), ...groups];
  return nodes.map((n) => n.id);
}
export function duplicateNodes(
  graph: WorkflowGraph,
  selected: readonly string[],
  offset = 28,
): string[] {
  return pasteSelection(graph, copySelection(graph, selected), { x: offset, y: offset });
}
export function createGroup(
  graph: WorkflowGraph,
  selected: readonly string[],
  name = 'Nhóm node',
): string {
  const nodeIds = graph.nodes.filter((n) => selected.includes(n.id)).map((n) => n.id);
  if (nodeIds.length < 2) throw new Error('Chọn ít nhất hai node để tạo nhóm.');
  if (!name.trim() || name.trim().length > 120) throw new Error('Tên nhóm phải có 1–120 ký tự.');
  if (graph.groups?.some((g) => g.nodeIds.some((n) => nodeIds.includes(n))))
    throw new Error('Node đã thuộc một nhóm; bỏ nhóm cũ trước khi gom lại.');
  const groupId = id('group');
  graph.groups = [...(graph.groups ?? []), { id: groupId, name: name.trim(), nodeIds }];
  return groupId;
}
export function removeGroup(graph: WorkflowGraph, groupId: string): void {
  graph.groups = (graph.groups ?? []).filter((g) => g.id !== groupId);
}
export function toggleGroup(graph: WorkflowGraph, groupId: string): void {
  const group = graph.groups?.find((g) => g.id === groupId);
  if (!group) throw new Error('Không tìm thấy nhóm.');
  group.collapsed = !group.collapsed;
}
export function moveNodes(
  graph: WorkflowGraph,
  positions: readonly { id: string; x: number; y: number }[],
): void {
  const deltas = new Map<string, { x: number; y: number }>();
  for (const position of positions) {
    const node = graph.nodes.find((n) => n.id === position.id);
    if (!node || !Number.isFinite(position.x) || !Number.isFinite(position.y))
      throw new Error('Vị trí node không hợp lệ.');
    deltas.set(node.id, { x: position.x - node.x, y: position.y - node.y });
  }
  for (const edge of graph.edges) {
    const from = deltas.get(edge.source),
      to = deltas.get(edge.target);
    if (edge.reroute && from && to && from.x === to.x && from.y === to.y) {
      edge.reroute.x += from.x;
      edge.reroute.y += from.y;
    }
  }
  for (const position of positions)
    Object.assign(
      graph.nodes.find((n) => n.id === position.id)!,
      { x: position.x, y: position.y },
    );
}
export function moveGroup(graph: WorkflowGraph, groupId: string, dx: number, dy: number): void {
  const group = graph.groups?.find((g) => g.id === groupId);
  if (!group) throw new Error('Không tìm thấy nhóm.');
  moveNodes(
    graph,
    graph.nodes
      .filter((n) => group.nodeIds.includes(n.id))
      .map((n) => ({ id: n.id, x: n.x + dx, y: n.y + dy })),
  );
}
export function rerouteEdge(
  graph: WorkflowGraph,
  edgeId: string,
  point: { x: number; y: number } | null,
): void {
  const edge = graph.edges.find((e) => e.id === edgeId);
  if (!edge) throw new Error('Không tìm thấy dây nối.');
  if (point && (!Number.isFinite(point.x) || !Number.isFinite(point.y)))
    throw new Error('Điểm bẻ dây không hợp lệ.');
  if (point) edge.reroute = { ...point };
  else delete edge.reroute;
}

export function alignNodes(
  graph: WorkflowGraph,
  selected: readonly string[],
  mode: 'left' | 'top' | 'horizontal' | 'vertical',
): void {
  const nodes = graph.nodes.filter((n) => selected.includes(n.id));
  if (nodes.length < 2) throw new Error('Chọn ít nhất hai node để căn chỉnh.');
  const horizontal = mode === 'horizontal',
    distributed = horizontal || mode === 'vertical';
  const axis = mode === 'left' || horizontal ? 'x' : 'y';
  const size = (n: WorkflowNode) => (axis === 'x' ? (n.w ?? 210) : (n.h ?? 110));
  nodes.sort((a, b) => a[axis] - b[axis]);
  const first = nodes[0]!,
    last = nodes.at(-1)!;
  const gap =
    distributed && nodes.length > 2
      ? (last[axis] + size(last) - first[axis] - nodes.reduce((sum, n) => sum + size(n), 0)) /
        (nodes.length - 1)
      : 0;
  if (distributed && nodes.length < 3) throw new Error('Chọn ít nhất ba node để giãn đều.');
  let cursor = first[axis];
  moveNodes(
    graph,
    nodes.map((n) => {
      const position = { id: n.id, x: n.x, y: n.y, [axis]: cursor };
      if (distributed) cursor += size(n) + gap;
      return position;
    }),
  );
}
export function groupBounds(
  graph: WorkflowGraph,
  group: WorkflowGroup,
): { x: number; y: number; width: number; height: number } | null {
  const nodes = graph.nodes.filter((n) => group.nodeIds.includes(n.id));
  if (!nodes.length) return null;
  const x = Math.min(...nodes.map((n) => n.x)) - 20,
    y = Math.min(...nodes.map((n) => n.y)) - 32;
  return {
    x,
    y,
    width: Math.max(...nodes.map((n) => n.x + (n.w ?? 210))) + 20 - x,
    height: Math.max(...nodes.map((n) => n.y + (n.h ?? 110))) + 20 - y,
  };
}
export function insertOnEdge(graph: WorkflowGraph, edgeId: string, type: NodeType): string {
  const edge = graph.edges.find((e) => e.id === edgeId);
  if (!edge) throw new Error('Edge not found');
  const definition = NODE_DEFINITIONS.find((d) => d.type === type)!;
  if (!(definition.ports as readonly string[]).includes('next'))
    throw new Error('Choose a node with a next output');
  const from = graph.nodes.find((n) => n.id === edge.source)!,
    to = graph.nodes.find((n) => n.id === edge.target)!;
  const created = addNode(graph, type, (from.x + to.x) / 2, (from.y + to.y) / 2);
  graph.edges = graph.edges.filter((e) => e.id !== edgeId);
  connect(graph, edge.source, edge.port, created);
  connect(graph, created, 'next', edge.target);
  return created;
}
export function layoutGraph(graph: WorkflowGraph, vertical = false): void {
  // Kahn layers; disconnected nodes get their own final layer.
  const depths = new Map<string, number>(),
    pending = new Set(graph.nodes.map((n) => n.id));
  while (pending.size) {
    const ready = [...pending].filter((n) =>
      graph.edges.filter((e) => e.target === n).every((e) => !pending.has(e.source)),
    );
    if (!ready.length) throw new Error('Cannot layout a cyclic graph');
    for (const n of ready) {
      const parents = graph.edges.filter((e) => e.target === n);
      depths.set(
        n,
        parents.length ? Math.max(...parents.map((e) => depths.get(e.source) ?? 0)) + 1 : 0,
      );
      pending.delete(n);
    }
  }
  const layerSizes = new Map<number, number>();
  for (const node of graph.nodes) {
    const depth = depths.get(node.id) ?? 0;
    layerSizes.set(
      depth,
      Math.max(layerSizes.get(depth) ?? 0, vertical ? (node.h ?? 110) : (node.w ?? 210)),
    );
  }
  const offsets = new Map<number, number>();
  let offset = 0;
  for (const depth of [...layerSizes.keys()].sort((a, b) => a - b)) {
    offsets.set(depth, offset);
    offset += layerSizes.get(depth)! + 70;
  }
  const rows = new Map<number, number>();
  for (const node of graph.nodes) {
    const depth = depths.get(node.id) ?? 0,
      row = rows.get(depth) ?? 0;
    rows.set(depth, row + (vertical ? (node.w ?? 210) : (node.h ?? 110)) + 60);
    node.x = 60 + (vertical ? row : offsets.get(depth)!);
    node.y = 80 + (vertical ? offsets.get(depth)! : row);
  }
  for (const edge of graph.edges) delete edge.reroute;
}

/** Extract only a closed, single-entry/single-exit region whose local scope is unchanged. */
export function selectionToSubgraph(
  bundle: WorkflowBundle,
  graphId: string,
  selected: readonly string[],
  name: string,
): { graphId: string; nodeId: string } {
  const graph = graphById(bundle, graphId),
    ids = new Set(selected);
  const nodes = graph.nodes.filter((n) => ids.has(n.id));
  if (!name.trim() || name.trim().length > 120)
    throw new Error('Tên quy trình con phải có 1–120 ký tự.');
  if (!nodes.length || nodes.length !== ids.size) throw new Error('Vùng chọn không hợp lệ.');
  // A call has an isolated local frame. Do not silently change variables or loop control.
  if (
    nodes.some(
      (n) =>
        [
          'start',
          'end',
          'review',
          'break',
          'continue',
          'loop',
          'setvar',
          'output',
          'transaction',
          'verify',
        ].includes(n.type) || /local\./.test(JSON.stringify(n.config)),
    )
  )
    throw new Error(
      'Vùng chọn chứa điều khiển, biến local hoặc effect cần mapping riêng; hãy chọn vùng độc lập.',
    );
  const incoming = graph.edges.filter((e) => !ids.has(e.source) && ids.has(e.target));
  const outgoing = graph.edges.filter((e) => ids.has(e.source) && !ids.has(e.target));
  const internal = graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  if (
    !incoming.length ||
    new Set(incoming.map((e) => e.target)).size !== 1 ||
    outgoing.length !== 1 ||
    outgoing[0]!.port !== 'next'
  )
    throw new Error('Chuyển subflow cần một điểm vào và đúng một đường ra next.');
  const entry = incoming[0]!.target,
    exit = outgoing[0]!;
  const reached = new Set<string>(),
    active = new Set<string>();
  function walk(nodeId: string): void {
    if (active.has(nodeId)) throw new Error('Vùng chọn chứa vòng dây.');
    if (reached.has(nodeId)) return;
    reached.add(nodeId);
    active.add(nodeId);
    const node = nodes.find((n) => n.id === nodeId)!;
    const edges = internal.filter((e) => e.source === nodeId);
    const ports = NODE_DEFINITIONS.find((d) => d.type === node.type)!.requiredPorts;
    for (const port of ports)
      if (!edges.some((e) => e.port === port) && !(exit.source === nodeId && exit.port === port))
        throw new Error('Vùng chọn có nhánh chưa nối đầy đủ.');
    if (!edges.length && exit.source !== nodeId) throw new Error('Vùng chọn có đường cụt.');
    for (const edge of edges) walk(edge.target);
    active.delete(nodeId);
  }
  walk(entry);
  if (reached.size !== nodes.length) throw new Error('Vùng chọn có node không liên thông.');
  // Everything above is read-only: failed extraction leaves the input bundle unchanged.
  const childId = id('graph'),
    startId = id('start'),
    endId = id('end');
  const child: WorkflowGraph = {
    id: childId,
    name: name.trim(),
    inputs: [],
    outputs: [],
    nodes: [
      { id: startId, type: 'start', name: 'Bắt đầu', x: 0, y: 0, config: {} },
      ...structuredClone(nodes),
      { id: endId, type: 'end', name: 'Kết thúc', x: 0, y: 0, config: {} },
    ],
    edges: [
      { id: id('edge'), source: startId, target: entry, port: 'next' },
      ...structuredClone(internal),
      { id: id('edge'), source: exit.source, target: endId, port: 'next' },
    ],
    groups: structuredClone((graph.groups ?? []).filter((g) => g.nodeIds.every((n) => ids.has(n)))),
  };
  layoutGraph(child);
  const callId = id('node');
  const call: WorkflowNode = {
    id: callId,
    type: 'subflow',
    name: name.trim(),
    x: Math.min(...nodes.map((n) => n.x)),
    y: Math.min(...nodes.map((n) => n.y)),
    config: { graphRef: childId, inputMapping: {}, outputMapping: {} },
  };
  removeNodes(graph, selected);
  graph.nodes.push(call);
  graph.edges.push(...incoming.map((e) => ({ ...e, target: callId })), { ...exit, source: callId });
  bundle.graphs.push(child);
  return { graphId: childId, nodeId: callId };
}
export function createSubgraph(bundle: WorkflowBundle, name: string): string {
  if (!name.trim()) throw new Error('Subflow name is required');
  const graphId = id('graph');
  bundle.graphs.push({
    id: graphId,
    name: name.trim(),
    nodes: [
      { id: 'start', type: 'start', name: 'Bắt đầu', x: 60, y: 100, config: {} },
      { id: 'end', type: 'end', name: 'Kết thúc', x: 400, y: 100, config: {} },
    ],
    edges: [{ id: 'next', source: 'start', target: 'end', port: 'next' }],
    groups: [],
    inputs: [],
    outputs: [],
  });
  return graphId;
}
