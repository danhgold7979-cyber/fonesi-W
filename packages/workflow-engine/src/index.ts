import { NODE_DEFINITIONS, validateWorkflowShape, isSafeKey } from '@autoreels/contracts';
import type {
  WorkflowBundle,
  WorkflowNode,
  ValidationIssue,
  JsonValue,
  Port,
} from '@autoreels/contracts';
import { evaluate, renderTemplate } from './dsl.js';
import type { Bindings } from './dsl.js';
export * from './dsl.js';

export function validateBundle(input: unknown): ValidationIssue[] {
  const shape = validateWorkflowShape(input);
  if (!shape.ok) return shape.issues;
  const bundle = shape.value,
    issues: ValidationIssue[] = [],
    graphIds = new Set<string>();
  const issue = (code: string, message: string, graphId?: string, nodeId?: string): void => {
    issues.push({
      code,
      message,
      path: graphId ? 'graphs.' + graphId + (nodeId ? '.nodes.' + nodeId : '') : '',
      ...(graphId ? { graphId } : {}),
      ...(nodeId ? { nodeId } : {}),
    });
  };
  for (const graph of bundle.graphs) {
    if (graphIds.has(graph.id)) issue('DUPLICATE_GRAPH', 'Duplicate graph ID', graph.id);
    graphIds.add(graph.id);
  }
  if (!graphIds.has(bundle.mainGraphId)) issue('MISSING_MAIN', 'Main graph not found');
  const loopBodies = new Set(
    bundle.graphs.flatMap((g) =>
      g.nodes.filter((n) => n.type === 'loop').map((n) => String(n.config.bodyGraphRef)),
    ),
  );
  for (const fields of [
    bundle.inputs,
    bundle.outputs,
    ...bundle.graphs.flatMap((g) => [g.inputs, g.outputs]),
  ]) {
    const keys = new Set<string>();
    for (const field of fields) {
      if (!isSafeKey(field.key) || keys.has(field.key))
        issue('INVALID_FIELD', 'Duplicate/unsafe field key: ' + field.key);
      keys.add(field.key);
    }
  }
  for (const graph of bundle.graphs) {
    const ids = new Set<string>(),
      edgeIds = new Set<string>(),
      outputs = new Set<string>();
    const loopRegion = new Set<string>();
    function collectBody(id: string): void {
      if (loopRegion.has(id)) return;
      loopRegion.add(id);
      if (
        graph.nodes.some(
          (n) => n.id === id && ['end', 'review', 'break', 'continue'].includes(n.type),
        )
      )
        return;
      graph.edges.filter((e) => e.source === id).forEach((e) => collectBody(e.target));
    }
    graph.nodes
      .filter((n) => n.type === 'loop')
      .forEach((n) =>
        graph.edges
          .filter((e) => e.source === n.id && e.port === 'body')
          .forEach((e) => collectBody(e.target)),
      );
    for (const node of graph.nodes) {
      if (ids.has(node.id)) issue('DUPLICATE_NODE', 'Duplicate node ID', graph.id, node.id);
      ids.add(node.id);
      if ((node.delayMinMs ?? 0) > (node.delayMaxMs ?? Infinity))
        issue('INVALID_DELAY', 'Minimum delay exceeds maximum', graph.id, node.id);
      if (
        node.type === 'loop' &&
        (!Number.isSafeInteger(node.config.maxIterations) ||
          Number(node.config.maxIterations) > 1000 ||
          Number(node.config.maxIterations) < 0)
      )
        issue('LOOP_BUDGET', 'Loop requires bounded maxIterations (0–1000)', graph.id, node.id);
      if (
        ['break', 'continue'].includes(node.type) &&
        !loopBodies.has(graph.id) &&
        !loopRegion.has(node.id)
      )
        issue('LOOP_SCOPE', 'break/continue outside loop body', graph.id, node.id);
      if (node.type === 'loop' && node.config.bodyGraphRef)
        issue(
          'LOOP_GRAPH_REF_PENDING',
          'This trace engine uses the body output region; separate bodyGraphRef execution is not enabled yet',
          graph.id,
          node.id,
        );
      if (node.type === 'subflow') {
        const ref = node.config.graphRef;
        if (typeof ref !== 'string' || !graphIds.has(ref))
          issue(
            'UNRESOLVED_GRAPH',
            'Graph reference is missing/unresolved; pinned external dependency requires its resolver',
            graph.id,
            node.id,
          );
      }
      if (
        node.type === 'tap' &&
        ['PUBLISH', 'COMMENT'].includes(String(node.config.effectClassification).toUpperCase())
      ) {
        const predecessors = graph.edges
          .filter((e) => e.target === node.id)
          .map((e) => graph.nodes.find((n) => n.id === e.source));
        if (!predecessors.length || predecessors.some((n) => n?.type !== 'transaction'))
          issue(
            'MISSING_EFFECT_INTENT',
            'Declared side effect requires a preceding transaction intent',
            graph.id,
            node.id,
          );
      }
    }
    for (const edge of graph.edges) {
      if (edgeIds.has(edge.id)) issue('DUPLICATE_EDGE', 'Duplicate edge ID', graph.id);
      edgeIds.add(edge.id);
      const source = graph.nodes.find((n) => n.id === edge.source),
        target = graph.nodes.find((n) => n.id === edge.target);
      if (!source || !target) {
        issue('DANGLING_EDGE', 'Edge endpoint not found', graph.id);
        continue;
      }
      if (
        !(
          NODE_DEFINITIONS.find((n) => n.type === source.type)!.ports as readonly string[]
        ).includes(edge.port)
      )
        issue('INVALID_PORT', 'Output port does not belong to node', graph.id, source.id);
      const key = edge.source + ':' + edge.port;
      if (outputs.has(key))
        issue('DUPLICATE_OUTPUT', 'An output may connect once', graph.id, source.id);
      outputs.add(key);
    }
    for (const node of graph.nodes)
      for (const port of NODE_DEFINITIONS.find((n) => n.type === node.type)!.requiredPorts)
        if (!outputs.has(node.id + ':' + port))
          issue('MISSING_PORT', 'Required port is unconnected: ' + port, graph.id, node.id);
    const starts = graph.nodes.filter((n) => n.type === 'start');
    if (starts.length !== 1) issue('START_COUNT', 'Graph requires exactly one start', graph.id);
    const reached = new Set<string>(),
      active = new Set<string>();
    function walk(id: string): void {
      if (active.has(id)) {
        issue('WIRE_CYCLE', 'Use a loop node instead of a wire cycle', graph.id, id);
        return;
      }
      if (reached.has(id)) return;
      reached.add(id);
      active.add(id);
      for (const edge of graph.edges.filter((e) => e.source === id)) walk(edge.target);
      active.delete(id);
    }
    if (starts[0]) walk(starts[0].id);
    for (const node of graph.nodes)
      if (!reached.has(node.id)) {
        issue('UNREACHABLE_NODE', 'Node is not reachable from start', graph.id, node.id);
        walk(node.id);
      }
    if (!graph.nodes.some((n) => ['end', 'review', 'break', 'continue'].includes(n.type)))
      issue('NO_TERMINAL', 'Graph requires a terminal', graph.id);
    for (const group of graph.groups ?? [])
      if (group.nodeIds.some((id) => !ids.has(id)))
        issue('INVALID_GROUP', 'Group contains missing node', graph.id);
  }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function visit(graphId: string): void {
    if (visiting.has(graphId)) {
      issue('RECURSIVE_GRAPH', 'Recursive subflows/loop graph references are unsupported', graphId);
      return;
    }
    if (visited.has(graphId)) return;
    visiting.add(graphId);
    for (const node of bundle.graphs.find((g) => g.id === graphId)?.nodes ?? [])
      if (node.type === 'subflow' || node.type === 'loop') {
        const ref = node.type === 'loop' ? node.config.bodyGraphRef : node.config.graphRef;
        if (typeof ref === 'string' && graphIds.has(ref)) visit(ref);
      }
    visiting.delete(graphId);
    visited.add(graphId);
  }
  for (const graph of bundle.graphs) visit(graph.id);
  for (const dependency of bundle.dependencies)
    if (!dependency.versionId || !dependency.hash)
      issue('UNPINNED_DEPENDENCY', 'Dependencies require a version and hash');
  return issues;
}

export interface TraceEvent {
  graphId: string;
  nodeId: string;
  type: string;
  status: 'DONE' | 'UNSUPPORTED' | 'REVIEW' | 'ERROR';
  detail: string;
}
export interface TraceReport {
  mode: 'TRACE';
  status: 'COMPLETED' | 'UNSUPPORTED' | 'REVIEW' | 'ERROR' | 'CANCELLED';
  events: TraceEvent[];
  outputs: Record<string, JsonValue>;
  issues: ValidationIssue[];
}
export async function traceWorkflow(
  bundle: WorkflowBundle,
  data: { row?: Record<string, JsonValue>; process?: Record<string, JsonValue> } = {},
  options: { maxSteps?: number; signal?: AbortSignal } = {},
): Promise<TraceReport> {
  const frozen = structuredClone(bundle),
    issues = validateBundle(frozen),
    events: TraceEvent[] = [];
  const bindings: Bindings = {
    row: structuredClone(data.row ?? {}),
    process: structuredClone(data.process ?? {}),
    local: {},
    output: {},
  };
  const report: TraceReport = {
    mode: 'TRACE',
    status: 'COMPLETED',
    events,
    outputs: bindings.output,
    issues,
  };
  if (issues.length) {
    report.status = 'ERROR';
    return report;
  }
  let steps = 0;
  type Signal = 'RETURN' | 'BREAK' | 'CONTINUE' | 'STOP';
  async function runGraph(graphId: string, loop = false, entryId?: string): Promise<Signal> {
    const graph = frozen.graphs.find((g) => g.id === graphId)!,
      start = graph.nodes.find((n) => n.type === 'start')!;
    let node: WorkflowNode | undefined = entryId
      ? graph.nodes.find((n) => n.id === entryId)
      : start;
    while (node) {
      if (options.signal?.aborted) {
        report.status = 'CANCELLED';
        return 'STOP';
      }
      if (++steps > (options.maxSteps ?? 5000)) throw new Error('Step budget exceeded');
      const current = node;
      let port: Port = 'next';
      if (current.type === 'end') {
        events.push({
          graphId,
          nodeId: current.id,
          type: current.type,
          status: 'DONE',
          detail: 'Return',
        });
        return 'RETURN';
      }
      if (current.type === 'review') {
        report.status = 'REVIEW';
        events.push({
          graphId,
          nodeId: current.id,
          type: current.type,
          status: 'REVIEW',
          detail: String(current.config.reasonCode ?? 'Manual review'),
        });
        return 'STOP';
      }
      if (current.type === 'break' || current.type === 'continue') {
        if (!loop) throw new Error('Loop control outside loop');
        return current.type === 'break' ? 'BREAK' : 'CONTINUE';
      }
      if (current.type === 'condition') {
        const value = evaluate(current.config.expression, bindings);
        if (typeof value !== 'boolean') throw new Error('Condition must return boolean');
        port = value ? 'true' : 'false';
      } else if (current.type === 'setvar') {
        const path = String(current.config.targetPath ?? '').split('.');
        if (path.length !== 2 || path[0] !== 'local' || !isSafeKey(path[1]!))
          throw new Error('setvar requires a safe local key');
        bindings.local[path[1]!] = evaluate(current.config.expression, bindings);
      } else if (current.type === 'subflow') {
        const callerLocal = bindings.local;
        bindings.local = {};
        let signal: Signal;
        try {
          signal = await runGraph(String(current.config.graphRef));
        } finally {
          bindings.local = callerLocal;
        }
        if (signal === 'STOP') return signal;
      } else if (current.type === 'loop') {
        const body = graph.edges.find((e) => e.source === current.id && e.port === 'body');
        if (!body) throw new Error('Loop body is not connected');
        const key = String(current.config.itemBinding ?? 'item');
        if (!isSafeKey(key)) throw new Error('Unsafe loop binding');
        const old = bindings.local[key],
          had = Object.hasOwn(bindings.local, key);
        for (let index = 0; index < Number(current.config.maxIterations); index++) {
          bindings.local[key] = index;
          const signal = await runGraph(graphId, true, body.target);
          if (signal === 'STOP') return signal;
          if (signal === 'BREAK') break;
        }
        if (had) bindings.local[key] = old!;
        else delete bindings.local[key];
        port = 'done';
      } else if (current.type === 'output') {
        const mapping = current.config.valueMapping;
        if (mapping && typeof mapping === 'object' && !Array.isArray(mapping))
          for (const [key, expression] of Object.entries(mapping)) {
            if (!isSafeKey(key) || ['postId', 'commentId'].includes(key))
              throw new Error('Reserved/unsafe output requires verified evidence');
            bindings.output[key] = evaluate(expression, bindings);
          }
      } else if (!['start', 'wait', 'row', 'log'].includes(current.type)) {
        report.status = 'UNSUPPORTED';
        events.push({
          graphId,
          nodeId: current.id,
          type: current.type,
          status: 'UNSUPPORTED',
          detail:
            'TRACE cannot dispatch device/external effects; a real provider and device gate are required',
        });
        return 'STOP';
      }
      const detail =
        current.type === 'log'
          ? renderTemplate(String(current.config.messageTemplate ?? ''), bindings)
          : current.type === 'wait'
            ? 'TRACE records the wait; no device action'
            : 'Trace ' + current.type;
      events.push({ graphId, nodeId: current.id, type: current.type, status: 'DONE', detail });
      const edge = graph.edges.find((e) => e.source === current.id && e.port === port);
      if (!edge) throw new Error('Missing execution port: ' + port);
      node = graph.nodes.find((n) => n.id === edge.target);
    }
    throw new Error('Missing target node');
  }
  try {
    await runGraph(frozen.mainGraphId);
  } catch (error) {
    report.status = 'ERROR';
    events.push({
      graphId: '',
      nodeId: '',
      type: 'runtime',
      status: 'ERROR',
      detail: error instanceof Error ? error.message : 'Trace failed',
    });
  }
  return report;
}
