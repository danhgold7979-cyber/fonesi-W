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
} from '@xyflow/react';
import type { Node, NodeProps, NodeChange, Connection, Edge, XYPosition } from '@xyflow/react';
import { NODE_DEFINITIONS } from '@autoreels/contracts';
import type { WorkflowGraph, WorkflowNode, Port } from '@autoreels/contracts';
import '@xyflow/react/dist/style.css';

type ViewNode = Node<{ value: WorkflowNode }, 'studio'>;
const ResizeContext = createContext<
  (id: string, values: { x: number; y: number; width: number; height: number }) => void
>(() => undefined);
function StudioNode({ data, selected }: NodeProps<ViewNode>) {
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
const nodeTypes = { studio: StudioNode };
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
}
function Inner(props: Props) {
  const flow = useReactFlow<ViewNode>(),
    [positions, setPositions] = useState<Record<string, XYPosition>>({});
  props.fitRef((selection) => {
    void flow.fitView({
      padding: 0.2,
      duration: 150,
      ...(selection && props.selected.length
        ? { nodes: props.selected.map((id) => ({ id })) }
        : {}),
    });
  });
  const nodes: ViewNode[] = useMemo(
    () =>
      props.graph.nodes.map((n) => ({
        id: n.id,
        type: 'studio',
        position: positions[n.id] ?? { x: n.x, y: n.y },
        data: { value: n },
        selected: props.selected.includes(n.id),
        style: { width: n.w ?? 210, ...(n.h ? { height: n.h } : {}) },
      })),
    [props.graph, props.selected, positions],
  );
  const edges: Edge[] = props.graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.port,
    targetHandle: 'in',
    type: 'smoothstep',
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
        for (const c of moved) if (c.type === 'position' && c.position) next[c.id] = c.position;
        return next;
      });
  }
  return (
    <ResizeContext.Provider value={props.resize}>
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
        <ReactFlow<ViewNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={changes}
          onNodeDragStop={(_e, _node, moved) => {
            props.move(moved.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y })));
            setPositions({});
          }}
          onConnect={(c: Connection) => {
            if (c.source && c.target && c.sourceHandle)
              props.connect(c.source, c.sourceHandle as Port, c.target);
          }}
          onNodeDoubleClick={(_e, n) => props.openNode(n.id)}
          onPaneClick={() => props.select([])}
          onNodeContextMenu={(e, n) => {
            e.preventDefault();
            props.select([n.id]);
            props.menu({ kind: 'node', id: n.id, x: e.clientX, y: e.clientY });
          }}
          onEdgeContextMenu={(e, edge) => {
            e.preventDefault();
            props.menu({ kind: 'edge', id: edge.id, x: e.clientX, y: e.clientY });
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
