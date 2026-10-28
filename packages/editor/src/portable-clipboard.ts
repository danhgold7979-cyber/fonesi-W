import { assertJsonSafe, idSchema, validateWorkflowShape } from '@autoreels/contracts';
import type { WorkflowBundle, WorkflowGraph, WorkflowNode } from '@autoreels/contracts';
import { copySelection, graphById, pasteSelection } from './index.js';
import type { GraphClipboard } from './index.js';

const HEADER = 'AUTOREELS_STUDIO_NODES_V1\n';
const MAX_CHARACTERS = 1_048_576;
const MAX_NODES = 4096;
const MAX_GRAPHS = 64;

export interface PortableGraphClipboard {
  format: 'autoreels-node-selection';
  version: 1;
  appId: string;
  selection: GraphClipboard;
  graphs: WorkflowGraph[];
}

function localGraphRef(node: WorkflowNode): string | null {
  const value =
    node.type === 'subflow'
      ? node.config.graphRef
      : node.type === 'loop'
        ? node.config.bodyGraphRef
        : null;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('Tham chiếu graph không hợp lệ.');
  return value;
}

function validateFragment(fragment: PortableGraphClipboard): void {
  idSchema.parse(fragment.appId);
  if (!fragment.selection.nodes.length || fragment.selection.nodes.length > MAX_NODES)
    throw new Error('Vùng chọn không hợp lệ hoặc vượt giới hạn node.');
  if (fragment.graphs.length > MAX_GRAPHS)
    throw new Error('Clipboard vượt giới hạn graph.');
  const graphIds = new Set<string>();
  let nodeCount = fragment.selection.nodes.length;
  for (const graph of fragment.graphs) {
    idSchema.parse(graph.id);
    if (graphIds.has(graph.id)) throw new Error('Graph trùng ID.');
    graphIds.add(graph.id);
    nodeCount += graph.nodes.length;
  }
  if (nodeCount > MAX_NODES) throw new Error('Clipboard vượt giới hạn node.');
  const checkGraph = (nodes: WorkflowNode[], edges: GraphClipboard['edges'], groups: GraphClipboard['groups']) => {
    const nodeIds = new Set<string>();
    for (const node of nodes) {
      idSchema.parse(node.id);
      if (nodeIds.has(node.id)) throw new Error('Node trùng ID.');
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y))
        throw new Error('Tọa độ node không hợp lệ.');
      nodeIds.add(node.id);
    }
    const edgeIds = new Set<string>();
    for (const edge of edges) {
      idSchema.parse(edge.id);
      if (edgeIds.has(edge.id) || !nodeIds.has(edge.source) || !nodeIds.has(edge.target))
        throw new Error('Dây nối không thuộc vùng chọn.');
      edgeIds.add(edge.id);
    }
    const groupIds = new Set<string>();
    for (const group of groups) {
      idSchema.parse(group.id);
      if (
        groupIds.has(group.id) ||
        !group.nodeIds.length ||
        group.nodeIds.some((nodeId) => !nodeIds.has(nodeId))
      ) throw new Error('Nhóm không thuộc vùng chọn.');
      groupIds.add(group.id);
    }
    for (const node of nodes) {
      const ref = localGraphRef(node);
      if (ref && !graphIds.has(ref)) throw new Error('Thiếu graph phụ thuộc: ' + ref);
    }
  };
  checkGraph(fragment.selection.nodes, fragment.selection.edges, fragment.selection.groups);
  for (const graph of fragment.graphs)
    checkGraph(graph.nodes, graph.edges, graph.groups ?? []);
}

/** Only local graph closure crosses the clipboard boundary; no Process/device/account state. */
export function copyPortableSelection(
  bundle: WorkflowBundle,
  graphId: string,
  selected: readonly string[],
): PortableGraphClipboard {
  const original = validateWorkflowShape(bundle);
  if (!original.ok) throw new Error('Workflow nguồn không hợp lệ.');
  if (new Set(selected).size !== selected.length) throw new Error('Node chọn bị trùng.');
  const selection = copySelection(graphById(bundle, graphId), selected);
  if (!selection.nodes.length || selection.nodes.length !== selected.length)
    throw new Error('Vùng chọn không hợp lệ.');
  const byId = new Map(bundle.graphs.map((graph) => [graph.id, graph]));
  const included = new Map<string, WorkflowGraph>();
  const active = new Set<string>();
  const visit = (ref: string) => {
    if (active.has(ref) || ref === graphId)
      throw new Error('Graph phụ thuộc đệ quy vào vùng gốc.');
    if (included.has(ref)) return;
    const graph = byId.get(ref);
    if (!graph) throw new Error('Không tìm thấy graph phụ thuộc: ' + ref);
    if (included.size >= MAX_GRAPHS) throw new Error('Clipboard vượt giới hạn graph.');
    active.add(ref);
    for (const node of graph.nodes) {
      const child = localGraphRef(node);
      if (child) visit(child);
    }
    active.delete(ref);
    included.set(ref, structuredClone(graph));
  };
  for (const node of selection.nodes) {
    const ref = localGraphRef(node);
    if (ref) visit(ref);
  }
  const fragment: PortableGraphClipboard = {
    format: 'autoreels-node-selection',
    version: 1,
    appId: bundle.workflow.appId,
    selection,
    graphs: [...included.values()],
  };
  validateFragment(fragment);
  serializePortableSelection(fragment);
  return fragment;
}

export function serializePortableSelection(fragment: PortableGraphClipboard): string {
  assertJsonSafe(fragment);
  if (fragment.format !== 'autoreels-node-selection' || fragment.version !== 1)
    throw new Error('Định dạng clipboard không hỗ trợ.');
  validateFragment(fragment);
  const text = HEADER + JSON.stringify(fragment);
  if (text.length > MAX_CHARACTERS) throw new Error('Clipboard vượt giới hạn kích thước.');
  return text;
}

export function parsePortableSelection(text: string): PortableGraphClipboard | null {
  if (!text.startsWith(HEADER)) return null;
  if (text.length > MAX_CHARACTERS) throw new Error('Clipboard vượt giới hạn kích thước.');
  const input: unknown = JSON.parse(text.slice(HEADER.length));
  assertJsonSafe(input);
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    !('format' in input) ||
    input.format !== 'autoreels-node-selection' ||
    !('version' in input) ||
    input.version !== 1 ||
    !('appId' in input) ||
    typeof input.appId !== 'string' ||
    !('selection' in input) ||
    !input.selection ||
    typeof input.selection !== 'object' ||
    Array.isArray(input.selection) ||
    !('graphs' in input) ||
    !Array.isArray(input.graphs)
  ) throw new Error('Clipboard workflow không hợp lệ.');
  const selection = input.selection;
  if (
    !('nodes' in selection) ||
    !Array.isArray(selection.nodes) ||
    !('edges' in selection) ||
    !Array.isArray(selection.edges) ||
    !('groups' in selection) ||
    !Array.isArray(selection.groups) ||
    !selection.nodes.every((n: unknown) => n !== null && typeof n === 'object' && !Array.isArray(n) && 'id' in n && typeof n.id === 'string' && 'x' in n && typeof n.x === 'number' && 'y' in n && typeof n.y === 'number' && 'config' in n && n.config !== null && typeof n.config === 'object' && !Array.isArray(n.config)) ||
    !selection.edges.every((e: unknown) => e !== null && typeof e === 'object' && !Array.isArray(e) && 'id' in e && typeof e.id === 'string' && 'source' in e && typeof e.source === 'string' && 'target' in e && typeof e.target === 'string') ||
    !selection.groups.every((g: unknown) => g !== null && typeof g === 'object' && !Array.isArray(g) && 'id' in g && typeof g.id === 'string' && 'nodeIds' in g && Array.isArray(g.nodeIds)) ||
    !input.graphs.every((g: unknown) => g !== null && typeof g === 'object' && !Array.isArray(g) && 'id' in g && typeof g.id === 'string' && 'nodes' in g && Array.isArray(g.nodes) && 'edges' in g && Array.isArray(g.edges) && 'groups' in g && (g.groups === undefined || Array.isArray(g.groups)))
  ) throw new Error('Clipboard graph không hợp lệ.');
  const fragment = input as unknown as PortableGraphClipboard;
  validateFragment(fragment);
  return fragment;
}

/** Call inside one EditorHistory.mutate transaction to ensure validation/undo are atomic. */
export function pastePortableSelection(
  bundle: WorkflowBundle,
  graphId: string,
  fragment: PortableGraphClipboard,
  offset = { x: 28, y: 28 },
): string[] {
  // Re-serialize for the same safety limits even if supplied by an in-memory reference.
  const safe = parsePortableSelection(serializePortableSelection(fragment));
  if (!safe) throw new Error('Clipboard workflow không hợp lệ.');
  if (safe.appId !== bundle.workflow.appId)
    throw new Error('Không thể dán node giữa hai ứng dụng khác nhau.');
  const target = graphById(bundle, graphId);
  const idMap = new Map(safe.graphs.map((graph) => [graph.id, 'graph_' + crypto.randomUUID().replaceAll('-', '')]));
  const replaceRef = (node: WorkflowNode): void => {
    const key = node.type === 'subflow' ? 'graphRef' : node.type === 'loop' ? 'bodyGraphRef' : null;
    if (key && typeof node.config[key] === 'string' && node.config[key])
      node.config[key] = idMap.get(node.config[key])!;
  };
  const children = safe.graphs.map((graph) => {
    const nodeMap = new Map(graph.nodes.map((node) => [node.id, 'node_' + crypto.randomUUID().replaceAll('-', '')]));
    const cloned: WorkflowGraph = structuredClone(graph);
    cloned.id = idMap.get(graph.id)!;
    cloned.nodes = cloned.nodes.map((node) => {
      node.id = nodeMap.get(node.id)!;
      replaceRef(node);
      return node;
    });
    cloned.edges = cloned.edges.map((edge) => ({
      ...edge,
      id: 'edge_' + crypto.randomUUID().replaceAll('-', ''),
      source: nodeMap.get(edge.source)!,
      target: nodeMap.get(edge.target)!,
    }));
    cloned.groups = cloned.groups?.map((group) => ({
      ...group,
      id: 'group_' + crypto.randomUUID().replaceAll('-', ''),
      nodeIds: group.nodeIds.map((nodeId) => nodeMap.get(nodeId)!),
    }));
    return cloned;
  });
  const root = structuredClone(safe.selection);
  for (const node of root.nodes) replaceRef(node);
  const ids = pasteSelection(target, root, offset);
  bundle.graphs.push(...children);
  // A failed shape check must never be published: EditorHistory.mutate works on a clone.
  const result = validateWorkflowShape(bundle);
  if (!result.ok) throw new Error(result.issues[0]?.message ?? 'Clipboard tạo workflow không hợp lệ.');
  return ids;
}
