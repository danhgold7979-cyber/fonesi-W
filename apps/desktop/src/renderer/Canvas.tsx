import { createContext, useContext, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  NodeResizer,
  useReactFlow,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from '@xyflow/react';
import type {
  Node,
  NodeProps,
  NodeChange,
  Connection,
  Edge,
  EdgeProps,
  XYPosition,
} from '@xyflow/react';
import { groupBounds } from '@autoreels/editor';
import { NODE_DEFINITIONS } from '@autoreels/contracts';
import type { WorkflowGraph, WorkflowNode, Port } from '@autoreels/contracts';
import '@xyflow/react/dist/style.css';

type StudioViewNode = Node<{ value: WorkflowNode }, 'studio'>;
type GroupViewNode = Node<
  {
    label: string;
    groupId: string;
    collapsed: boolean;
    count: number;
    sources: string[];
    targets: string[];
  },
  'visualGroup'
>;
type ViewNode = StudioViewNode | GroupViewNode;
type RoutedViewEdge = Edge<{ point?: XYPosition }, 'routed'>;
const GroupContext = createContext<(id: string) => void>(() => undefined);
const RouteContext = createContext<(id: string, point: XYPosition) => void>(() => undefined);
const ResizeContext = createContext<
  (id: string, values: { x: number; y: number; width: number; height: number }) => void
>(() => undefined);
function StudioNode({ data, selected }: NodeProps<StudioViewNode>) {
  const node = data.value,
    def = NODE_DEFINITIONS.find((d) => d.type === node.type)!,
    resize = useContext(ResizeContext);
  return (
    <div className={'studio-node ' + (selected ? 'selected' : '')}>
      <NodeResizer
        isVisible={selected}
        minWidth={185}
        minHeight={96}
        onResizeEnd={(_e, p) => resize(node.id, p)}
      />
      {node.type !== 'start' && <Handle type="target" position={Position.Left} id="in" />}
      <div className="node-heading">
        <span className={'node-icon ' + (def.runtime === 'PURE_ENGINE' ? 'green' : 'purple')}>
          {node.type === 'start'
            ? '▷'
            : node.type === 'end'
              ? '□'
              : node.type === 'subflow'
                ? '◇'
                : '↗'}
        </span>
        <div>
          <strong>{node.name}</strong>
          <small>
            {node.type} · {node.id.slice(0, 12)}
          </small>
        </div>
        {node.breakpoint && <i className="breakpoint" />}
      </div>
      <div className="node-detail">
        {node.type === 'subflow'
          ? String(node.config.graphRef || 'Chọn quy trình con')
          : node.description || def.label}
      </div>
      <div className="node-port-labels">
        {def.ports.map((p) => (
          <span key={p}>{p}</span>
        ))}
      </div>
      {def.ports.map((port, index) => (
        <Handle
          key={port}
          type="source"
          position={Position.Right}
          id={port}
          style={{
            top: 35 + index * 18,
            background: port === 'error' ? '#eb6e82' : port === 'false' ? '#eaaa4d' : '#7165ef',
          }}
        />
      ))}
    </div>
  );
}
function VisualGroup({ data }: NodeProps<GroupViewNode>) {
  const toggle = useContext(GroupContext);
  return (
    <div className={'canvas-visual-group ' + (data.collapsed ? 'collapsed' : '')}>
      <div className="group-drag-handle">
        <button
          className="nodrag nopan"
          aria-label={(data.collapsed ? 'Mở nhóm ' : 'Thu nhóm ') + data.label}
          onClick={() => toggle(data.groupId)}
        >
          {data.collapsed ? '▸' : '▾'}
        </button>
        <strong>{data.label}</strong>
        <small>{data.count} node</small>
      </div>
      {data.collapsed && <small className="group-hint">Mở nhóm để sửa node và nối dây</small>}
      {data.collapsed &&
        data.targets.map((handle, i) => (
          <Handle
            key={handle}
            id={handle}
            type="target"
            position={Position.Left}
            isConnectable={false}
            style={{ top: 62 + i * 16 }}
          />
        ))}
      {data.collapsed &&
        data.sources.map((handle, i) => (
          <Handle
            key={handle}
            id={handle}
            type="source"
            position={Position.Right}
            isConnectable={false}
            style={{ top: 62 + i * 16 }}
          />
        ))}
    </div>
  );
}
const nodeTypes = { studio: StudioNode, visualGroup: VisualGroup };

function RoutedEdge(props: EdgeProps<RoutedViewEdge>) {
  const flow = useReactFlow(),
    commit = useContext(RouteContext);
  const [preview, setPreview] = useState<XYPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const point = preview ?? props.data?.point;
  const [normal] = getSmoothStepPath(props);
  const path = point
    ? `M ${props.sourceX} ${props.sourceY} L ${point.x} ${point.y} L ${props.targetX} ${props.targetY}`
    : normal;
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        {...(props.markerEnd ? { markerEnd: props.markerEnd } : {})}
        {...(props.style ? { style: props.style } : {})}
      />
      {props.label && (
        <EdgeLabelRenderer>
          <span
            className="edge-port-label"
            style={{
              transform: `translate(-50%, -50%) translate(${(props.sourceX + props.targetX) / 2}px, ${(props.sourceY + props.targetY) / 2 - 12}px)`,
            }}
          >
            {props.label}
          </span>
        </EdgeLabelRenderer>
      )}
      {point && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="edge-waypoint nodrag nopan"
            aria-label="Kéo điểm bẻ dây"
            title="Kéo để bẻ dây · Esc hủy"
            style={{ transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)` }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(true);
              setPreview(point);
              event.currentTarget.focus();
            }}
            onPointerMove={(event) => {
              if (dragging && event.currentTarget.hasPointerCapture(event.pointerId))
                setPreview(flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
            }}
            onPointerUp={(event) => {
              if (!dragging) return;
              event.currentTarget.releasePointerCapture(event.pointerId);
              const final = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
              setDragging(false);
              setPreview(null);
              commit(props.id, final);
            }}
            onPointerCancel={() => {
              setDragging(false);
              setPreview(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                setDragging(false);
                setPreview(null);
              }
            }}
          >
            ◇
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
const edgeTypes = { routed: RoutedEdge };
export interface CanvasMenu {
  kind: 'canvas' | 'node' | 'edge';
  id?: string;
  x: number;
  y: number;
  world?: XYPosition;
}
interface Props {
  graph: WorkflowGraph;
  selected: string[];
  select: (ids: string[]) => void;
  move: (positions: { id: string; x: number; y: number }[]) => void;
  resize: (id: string, values: { x: number; y: number; width: number; height: number }) => void;
  connect: (source: string, port: Port, target: string) => void;
  menu: (menu: CanvasMenu) => void;
  openNode: (id: string) => void;
  addAt: (type: string, position: XYPosition) => void;
  fitRef: (fit: (selection?: boolean) => void) => void;
  toggleGroup: (id: string) => void;
  reroute: (id: string, point: XYPosition) => void;
}
function Inner(props: Props) {
  const flow = useReactFlow<ViewNode>(),
    [positions, setPositions] = useState<Record<string, XYPosition>>({});
  const owners = new Map<string, string>();
  for (const group of props.graph.groups ?? [])
    if (group.collapsed)
      for (const id of group.nodeIds) if (!owners.has(id)) owners.set(id, 'visual_' + group.id);
  props.fitRef((selection) => {
    void flow.fitView({
      padding: 0.2,
      duration: 150,
      ...(selection && props.selected.length
        ? {
            nodes: [...new Set(props.selected.map((id) => owners.get(id) ?? id))].map((id) => ({
              id,
            })),
          }
        : {}),
    });
  });
  const nodes: ViewNode[] = useMemo(
    () => [
      ...props.graph.nodes.map((n): StudioViewNode => ({
        id: n.id,
        type: 'studio',
        position: positions[n.id] ?? { x: n.x, y: n.y },
        data: { value: n },
        selected: props.selected.includes(n.id),
        hidden: owners.has(n.id),
        width: n.w ?? 210,
        height: n.h ?? 110,
        style: { width: n.w ?? 210, height: n.h ?? 110 },
      })),
      ...(props.graph.groups ?? []).flatMap((group): GroupViewNode[] => {
        const bounds = groupBounds(
          { ...props.graph, nodes: props.graph.nodes.map((n) => ({ ...n, ...positions[n.id] })) },
          group,
        );
        return bounds
          ? [
              {
                id: 'visual_' + group.id,
                type: 'visualGroup',
                position: { x: bounds.x, y: bounds.y },
                data: {
                  label: group.name,
                  groupId: group.id,
                  collapsed: !!group.collapsed,
                  count: group.nodeIds.length,
                  sources: [
                    ...new Set(
                      props.graph.edges
                        .filter(
                          (e) =>
                            owners.get(e.source) === 'visual_' + group.id &&
                            owners.get(e.target) !== 'visual_' + group.id,
                        )
                        .map((e) => e.source + ':' + e.port),
                    ),
                  ],
                  targets: [
                    ...new Set(
                      props.graph.edges
                        .filter(
                          (e) =>
                            owners.get(e.target) === 'visual_' + group.id &&
                            owners.get(e.source) !== 'visual_' + group.id,
                        )
                        .map((e) => e.target + ':in'),
                    ),
                  ],
                },
                draggable: true,
                dragHandle: '.group-drag-handle',
                selectable: false,
                connectable: false,
                focusable: false,
                zIndex: group.collapsed ? 1 : -10,
                style: {
                  width: group.collapsed ? 250 : bounds.width,
                  pointerEvents: group.collapsed ? 'all' : 'none',
                  height: group.collapsed
                    ? 85 +
                      props.graph.edges.filter(
                        (e) =>
                          owners.get(e.source) === 'visual_' + group.id ||
                          owners.get(e.target) === 'visual_' + group.id,
                      ).length *
                        16
                    : bounds.height,
                },
              },
            ]
          : [];
      }),
    ],
    [props.graph, props.selected, positions],
  );
  const edges: RoutedViewEdge[] = props.graph.edges.map((e) => ({
    id: e.id,
    source: owners.get(e.source) ?? e.source,
    target: owners.get(e.target) ?? e.target,
    sourceHandle: owners.has(e.source) ? e.source + ':' + e.port : e.port,
    targetHandle: owners.has(e.target) ? e.target + ':in' : 'in',
    hidden: owners.has(e.source) && owners.get(e.source) === owners.get(e.target),
    type: 'routed',
    data: { ...(e.reroute ? { point: e.reroute } : {}) },
    label: e.port === 'next' ? '' : e.port,
    animated: false,
  }));
  function changes(changes: NodeChange<ViewNode>[]) {
    const selections = changes.filter((c) => c.type === 'select');
    if (selections.length) {
      const ids = new Set(props.selected);
      for (const c of selections)
        if (c.type === 'select') {
          if (c.selected) ids.add(c.id);
          else ids.delete(c.id);
        }
      props.select([...ids]);
    }
    const moved = changes.filter((c) => c.type === 'position');
    if (moved.length)
      setPositions((previous) => {
        const next = { ...previous };
        for (const c of moved)
          if (c.type === 'position' && c.position) {
            const group = props.graph.groups?.find((g) => 'visual_' + g.id === c.id);
            if (group) {
              const bounds = groupBounds(props.graph, group);
              if (bounds)
                for (const n of props.graph.nodes.filter((n) => group.nodeIds.includes(n.id)))
                  next[n.id] = {
                    x: n.x + c.position.x - bounds.x,
                    y: n.y + c.position.y - bounds.y,
                  };
            } else next[c.id] = c.position;
          }
        return next;
      });
  }
  return (
    <ResizeContext.Provider value={props.resize}>
      <GroupContext.Provider value={props.toggleGroup}>
        <RouteContext.Provider value={props.reroute}>
          <div
            className="canvas-wrap"
            tabIndex={0}
            data-testid="canvas"
            onPointerDownCapture={(e) => {
              if (!(e.target as HTMLElement).closest('input,textarea,select,button'))
                e.currentTarget.focus({ preventScroll: true });
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const type = e.dataTransfer.getData('application/autoreels-node');
              props.addAt(type, flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
            }}
          >
            <ReactFlow<ViewNode, RoutedViewEdge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={changes}
              onNodeDragStop={(_e, _node, moved) => {
                const updates = new Map<string, { id: string; x: number; y: number }>();
                for (const n of moved) {
                  const group = props.graph.groups?.find((g) => 'visual_' + g.id === n.id);
                  if (group) {
                    const bounds = groupBounds(props.graph, group);
                    if (bounds)
                      for (const member of props.graph.nodes.filter((n) =>
                        group.nodeIds.includes(n.id),
                      ))
                        updates.set(member.id, {
                          id: member.id,
                          x: member.x + n.position.x - bounds.x,
                          y: member.y + n.position.y - bounds.y,
                        });
                  } else updates.set(n.id, { id: n.id, x: n.position.x, y: n.position.y });
                }
                props.move([...updates.values()]);
                setPositions({});
              }}
              onConnect={(c: Connection) => {
                if (c.source && c.target && c.sourceHandle)
                  props.connect(c.source, c.sourceHandle as Port, c.target);
              }}
              onNodeDoubleClick={(_e, n) => {
                if (n.type === 'visualGroup') props.toggleGroup(n.data.groupId);
                else props.openNode(n.id);
              }}
              onPaneClick={() => props.select([])}
              onNodeContextMenu={(e, n) => {
                e.preventDefault();
                if (n.type === 'visualGroup') return;
                if (!props.selected.includes(n.id)) props.select([n.id]);
                props.menu({ kind: 'node', id: n.id, x: e.clientX, y: e.clientY });
              }}
              onEdgeContextMenu={(e, edge) => {
                e.preventDefault();
                props.menu({
                  kind: 'edge',
                  id: edge.id,
                  x: e.clientX,
                  y: e.clientY,
                  world: flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }),
                });
              }}
              onPaneContextMenu={(e) => {
                e.preventDefault();
                props.menu({
                  kind: 'canvas',
                  x: e.clientX,
                  y: e.clientY,
                  world: flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }),
                });
              }}
              deleteKeyCode={null}
              selectionKeyCode="Shift"
              multiSelectionKeyCode="Shift"
              panActivationKeyCode="Space"
              zoomActivationKeyCode="Control"
              panOnDrag={[1]}
              panOnScroll
              zoomOnScroll={false}
              zoomOnDoubleClick={false}
              minZoom={0.25}
              maxZoom={2}
              fitView
              fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#dbe0ec" gap={20} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable nodeColor="#c9c4f7" />
            </ReactFlow>
          </div>
        </RouteContext.Provider>
      </GroupContext.Provider>
    </ResizeContext.Provider>
  );
}
export function Canvas(props: Props) {
  return (
    <ReactFlowProvider key={props.graph.id}>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}
