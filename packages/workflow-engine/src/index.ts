import { performance } from 'node:perf_hooks';
import { setImmediate as yieldImmediate } from 'node:timers/promises';
import {
  NODE_DEFINITIONS,
  validateWorkflowShape,
  isSafeKey,
  validateTypedValues,
} from '@autoreels/contracts';
import type {
  WorkflowBundle,
  WorkflowNode,
  ValidationIssue,
  JsonValue,
  Port,
} from '@autoreels/contracts';
import { evaluate, renderTemplate, validateExpression } from './dsl.js';
import type { Bindings } from './dsl.js';
export * from './dsl.js';
export * from './debug.js';

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
      g.nodes
        .filter(
          (n) =>
            n.type === 'loop' &&
            typeof n.config.bodyGraphRef === 'string' &&
            n.config.bodyGraphRef.length > 0,
        )
        .map((n) => String(n.config.bodyGraphRef)),
    ),
  );
  const normalGraphs = new Set([
    bundle.mainGraphId,
    ...bundle.graphs.flatMap((g) =>
      g.nodes.filter((n) => n.type === 'subflow').map((n) => String(n.config.graphRef)),
    ),
  ]);
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
    const outsideLoop = new Set<string>();
    function walkOutside(id: string): void {
      if (outsideLoop.has(id)) return;
      outsideLoop.add(id);
      const node = graph.nodes.find((n) => n.id === id);
      for (const edge of graph.edges.filter(
        (e) => e.source === id && !(node?.type === 'loop' && e.port === 'body'),
      ))
        walkOutside(edge.target);
    }
    for (const start of graph.nodes.filter((n) => n.type === 'start')) walkOutside(start.id);
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
        !(loopBodies.has(graph.id) && !normalGraphs.has(graph.id)) &&
        (!loopRegion.has(node.id) || outsideLoop.has(node.id))
      )
        issue('LOOP_SCOPE', 'break/continue outside loop body', graph.id, node.id);
      if (node.type === 'loop' && node.config.bodyGraphRef) {
        const target = bundle.graphs.find((g) => g.id === node.config.bodyGraphRef);
        if (!target)
          issue(
            'UNRESOLVED_GRAPH',
            'Loop body graph reference is missing/unresolved',
            graph.id,
            node.id,
          );
        if (graph.edges.some((e) => e.source === node.id && e.port === 'body'))
          issue(
            'AMBIGUOUS_LOOP_BODY',
            'Choose bodyGraphRef or an inline body wire',
            graph.id,
            node.id,
          );
        if (target && (target.inputs.length || target.outputs.length))
          issue(
            'LOOP_BODY_MAPPING_UNSUPPORTED',
            'Loop body schemas require explicit mapping support; do not discard declarations',
            graph.id,
            node.id,
          );
      }
      if (node.type === 'subflow') {
        const ref = node.config.graphRef;
        if (typeof ref !== 'string' || !graphIds.has(ref))
          issue(
            'UNRESOLVED_GRAPH',
            'Graph reference is missing/unresolved; pinned external dependency requires its resolver',
            graph.id,
            node.id,
          );
        const child = bundle.graphs.find((g) => g.id === ref);
        if (child) {
          const input = mappingObject(node.config.inputMapping),
            output = mappingObject(node.config.outputMapping);
          for (const field of child.inputs)
            if (field.required && !Object.hasOwn(input, field.key))
              issue(
                'MISSING_INPUT_MAPPING',
                'Required subflow input: ' + field.key,
                graph.id,
                node.id,
              );
          for (const [key, expression] of Object.entries(input)) {
            const field = child.inputs.find((f) => f.key === key);
            if (!field || !isSafeKey(key)) {
              issue('UNKNOWN_INPUT_MAPPING', 'Unknown subflow input: ' + key, graph.id, node.id);
              continue;
            }
            try {
              validateExpression(expression);
              if (
                expression &&
                typeof expression === 'object' &&
                !Array.isArray(expression) &&
                expression.kind === 'literal'
              ) {
                if (validateTypedValues([field], { [key]: expression.value! }).length)
                  issue(
                    'INPUT_MAPPING_TYPE',
                    'Subflow input type mismatch: ' + key,
                    graph.id,
                    node.id,
                  );
              }
            } catch {
              issue(
                'INVALID_MAPPING_EXPRESSION',
                'Invalid input expression: ' + key,
                graph.id,
                node.id,
              );
            }
          }
          const targets = new Set<string>();
          for (const [key, target] of Object.entries(output)) {
            const parts = typeof target === 'string' ? target.split('.') : [];
            if (
              !child.outputs.some((f) => f.key === key) ||
              parts.length !== 2 ||
              parts[0] !== 'local' ||
              !isSafeKey(parts[1]!) ||
              targets.has(String(target))
            )
              issue(
                'INVALID_OUTPUT_MAPPING',
                'Output must map a declared field to a unique local key',
                graph.id,
                node.id,
              );
            targets.add(String(target));
          }
        }
      }
      try {
        if (node.type === 'condition' || node.type === 'setvar')
          validateExpression(node.config.expression);
        if (node.type === 'output')
          for (const expression of Object.values(mappingObject(node.config.valueMapping)))
            validateExpression(expression);
      } catch {
        issue('INVALID_EXPRESSION', 'Invalid expression AST', graph.id, node.id);
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
        if (
          !(node.type === 'loop' && node.config.bodyGraphRef && port === 'body') &&
          !outputs.has(node.id + ':' + port)
        )
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
function mappingObject(value: JsonValue | undefined): Record<string, JsonValue> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
export interface TraceBoundary {
  graphId: string;
  nodeId: string;
  depth: number;
  stack: { graphId: string; nodeId: string }[];
  bindings: Bindings;
  breakpoint: boolean;
}
export interface TraceOptions {
  maxSteps?: number;
  maxDurationMs?: number;
  signal?: AbortSignal;
  beforeStep?: (boundary: TraceBoundary) => Promise<void>;
  onEvent?: (event: TraceEvent) => void;
}
export async function traceWorkflow(
  bundle: WorkflowBundle,
  data: { row?: Record<string, JsonValue>; process?: Record<string, JsonValue> } = {},
  options: TraceOptions = {},
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
  const maxSteps = options.maxSteps ?? 5000,
    maxDurationMs = options.maxDurationMs ?? 10000;
  if (
    !Number.isSafeInteger(maxSteps) ||
    maxSteps < 1 ||
    maxSteps > 100000 ||
    !Number.isSafeInteger(maxDurationMs) ||
    maxDurationMs < 1 ||
    maxDurationMs > 60000
  ) {
    report.status = 'ERROR';
    report.issues.push({
      code: 'TRACE_BUDGET',
      path: 'options',
      message: 'Invalid TRACE step/time budget',
    });
    return report;
  }
  const started = performance.now();
  let suspended = 0;
  const frames: { graphId: string; nodeId: string }[] = [];
  const emit = (event: TraceEvent) => {
    events.push(event);
    options.onEvent?.(structuredClone(event));
  };
  let depth = 0;
  let steps = 0;
  type Signal = 'RETURN' | 'BREAK' | 'CONTINUE' | 'STOP';
  async function runGraph(graphId: string, loop = false, entryId?: string): Promise<Signal> {
    if (++depth > 64) {
      depth--;
      throw new Error('Call depth budget exceeded');
    }
    frames.push({ graphId, nodeId: entryId ?? '' });
    try {
      return await runFrame(graphId, loop, entryId);
    } finally {
      frames.pop();
      depth--;
    }
  }
  async function runFrame(graphId: string, loop = false, entryId?: string): Promise<Signal> {
    const graph = frozen.graphs.find((g) => g.id === graphId)!,
      start = graph.nodes.find((n) => n.type === 'start')!;
    let node: WorkflowNode | undefined = entryId
      ? graph.nodes.find((n) => n.id === entryId)
      : start;
    while (node) {
      if (steps && steps % 128 === 0) await yieldImmediate();
      frames.at(-1)!.nodeId = node.id;
      if (options.beforeStep) {
        const waitingAt = performance.now();
        await options.beforeStep({
          graphId,
          nodeId: node.id,
          depth,
          stack: structuredClone(frames),
          bindings: structuredClone(bindings),
          breakpoint: !!node.breakpoint,
        });
        suspended += performance.now() - waitingAt;
      }
      if (options.signal?.aborted) {
        report.status = 'CANCELLED';
        return 'STOP';
      }
      if (performance.now() - started - suspended > maxDurationMs)
        throw new Error('Time budget exceeded');
      if (++steps > maxSteps) throw new Error('Step budget exceeded');
      const current = node;
      let port: Port = 'next';
      if (current.type === 'end') {
        emit({
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
        emit({
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
        emit({
          graphId,
          nodeId: current.id,
          type: current.type,
          status: 'DONE',
          detail: current.type === 'break' ? 'Break nearest loop' : 'Continue nearest loop',
        });
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
        const caller = { ...bindings },
          child = frozen.graphs.find((g) => g.id === current.config.graphRef)!;
        const values: Record<string, JsonValue> = {};
        for (const [key, expression] of Object.entries(mappingObject(current.config.inputMapping)))
          values[key] = structuredClone(evaluate(expression, bindings));
        const invalid = validateTypedValues(child.inputs, values);
        if (invalid.length)
          throw new Error('Subflow input ' + invalid[0]!.path + ': ' + invalid[0]!.message);
        bindings.row = structuredClone(caller.row);
        bindings.process = structuredClone(caller.process);
        for (const field of child.inputs)
          if (Object.hasOwn(values, field.key)) {
            if (field.scope === 'output') throw new Error('Subflow input cannot have output scope');
            bindings[field.scope][field.key] = values[field.key]!;
          }
        bindings.local = {};
        bindings.output = {};
        let signal: Signal;
        let results: Record<string, JsonValue> = {};
        try {
          signal = await runGraph(String(current.config.graphRef));
          if (signal !== 'STOP') {
            const invalid = validateTypedValues(child.outputs, bindings.output);
            if (child.outputs.length && invalid.length)
              throw new Error('Subflow output ' + invalid[0]!.path + ': ' + invalid[0]!.message);
            results = structuredClone(bindings.output);
          }
        } finally {
          Object.assign(bindings, caller);
        }
        if (signal === 'STOP') return signal;
        // Validate all return bindings before applying any of them to the caller.
        const mapped = Object.entries(mappingObject(current.config.outputMapping)).map(
          ([key, target]) => {
            if (!Object.hasOwn(results, key))
              throw new Error('Mapped subflow output is missing: ' + key);
            return [String(target).split('.')[1]!, structuredClone(results[key]!)] as const;
          },
        );
        for (const [key, value] of mapped) bindings.local[key] = value;
      } else if (current.type === 'loop') {
        const body = graph.edges.find((e) => e.source === current.id && e.port === 'body'),
          bodyRef = current.config.bodyGraphRef;
        if (!body && !bodyRef) throw new Error('Loop body is not connected');
        const key = String(current.config.itemBinding ?? 'item');
        if (!isSafeKey(key)) throw new Error('Unsafe loop binding');
        const old = bindings.local[key],
          had = Object.hasOwn(bindings.local, key);
        try {
          for (let index = 0; index < Number(current.config.maxIterations); index++) {
            bindings.local[key] = index;
            const signal = await runGraph(
              bodyRef ? String(bodyRef) : graphId,
              true,
              bodyRef ? undefined : body!.target,
            );
            if (signal === 'STOP') return signal;
            if (signal === 'BREAK') break;
          }
        } finally {
          if (had) bindings.local[key] = old!;
          else delete bindings.local[key];
        }
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
        emit({
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
          ? renderTemplate(String(current.config.messageTemplate ?? ''), bindings, true)
          : current.type === 'wait'
            ? 'TRACE records the wait; no device action'
            : 'Trace ' + current.type;
      emit({ graphId, nodeId: current.id, type: current.type, status: 'DONE', detail });
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
    emit({
      graphId: '',
      nodeId: '',
      type: 'runtime',
      status: 'ERROR',
      detail: error instanceof Error ? error.message : 'Trace failed',
    });
  }
  return report;
}
