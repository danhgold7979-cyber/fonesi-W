import { validateWorkflowShape } from '@autoreels/contracts';
import type { ValidationIssue, WorkflowBundle, WorkflowNode, Port } from '@autoreels/contracts';

/**
 * Conservative intragraph admission audit for irreversible external effects.
 *
 * This never dispatches an effect or certifies a provider. One call frame starts
 * without an intent. Subflow/loop graphs are audited independently until the
 * real executor can propagate journaled effect tokens across frames.
 */
type EffectKind = 'PUBLISH' | 'COMMENT';
type Intent = EffectKind | null;
interface FlowState {
  intent: Intent;
  outstanding: boolean;
  verified: boolean;
}
const terminalEffect = (node: WorkflowNode): EffectKind | null => {
  if (node.type !== 'tap') return null;
  const kind = String(node.config.effectClassification ?? '').toUpperCase();
  return kind === 'PUBLISH' || kind === 'COMMENT' ? kind : null;
};
const declaredIntent = (node: WorkflowNode): EffectKind | null => {
  if (node.type !== 'transaction') return null;
  const kind = String(node.config.effectKind ?? '').toUpperCase();
  return kind === 'PUBLISH' || kind === 'COMMENT' ? kind : null;
};
const stateKey = (nodeId: string, state: FlowState): string =>
  [nodeId, state.intent ?? 'NONE', Number(state.outstanding), Number(state.verified)].join('|');

export function assessEffectPaths(input: WorkflowBundle): ValidationIssue[] {
  const shape = validateWorkflowShape(input);
  if (!shape.ok) return shape.issues;
  const issues: ValidationIssue[] = [];
  const seenIssues = new Set<string>();
  const add = (code: string, message: string, graphId: string, nodeId: string): void => {
    const key = [code, graphId, nodeId].join(':');
    if (seenIssues.has(key)) return;
    seenIssues.add(key);
    issues.push({ code, message, path: 'graphs.' + graphId + '.nodes.' + nodeId, graphId, nodeId });
  };
  // Intragraph analysis cannot carry journal/verification tokens across calls.
  // Conservatively block nested graphs with any effect-sensitive operation,
  // including a transitive sensitive grandchild. Pure subflows stay admitted.
  const graphs = new Map(shape.value.graphs.map((graph) => [graph.id, graph]));
  const cache = new Map<string, boolean>();
  const active = new Set<string>();
  const riskyNode = (node: WorkflowNode): boolean =>
    [
      'transaction', 'verify', 'cleanup', 'stage', 'selectmedia',
      'tap', 'doubletap', 'hold', 'drag', 'swipe', 'scroll', 'pinch',
      'type', 'clear', 'keyboard',
    ].includes(node.type);
  const childRef = (node: WorkflowNode): string | null => {
    if (node.type === 'subflow')
      return typeof node.config.graphRef === 'string' ? node.config.graphRef : null;
    if (node.type === 'loop')
      return typeof node.config.bodyGraphRef === 'string' ? node.config.bodyGraphRef : null;
    return null;
  };
  function requiresCrossFrameJournal(graphId: string, depth: number): boolean {
    if (depth > 64 || active.has(graphId)) return true;
    const prior = cache.get(graphId);
    if (prior !== undefined) return prior;
    const graph = graphs.get(graphId);
    if (!graph) return true;
    active.add(graphId);
    let risky = false;
    for (const node of graph.nodes) {
      if (riskyNode(node)) {
        risky = true;
        break;
      }
      const child = childRef(node);
      if (child && requiresCrossFrameJournal(child, depth + 1)) {
        risky = true;
        break;
      }
      if (node.type === 'subflow' && node.config.workflowVersionRef && !child) {
        // Unresolved pinned external calls must not be presumed pure.
        risky = true;
        break;
      }
    }
    active.delete(graphId);
    cache.set(graphId, risky);
    return risky;
  }
  for (const graph of shape.value.graphs) {
    for (const node of graph.nodes) {
      const child = childRef(node);
      if (
        (child && requiresCrossFrameJournal(child, 0)) ||
        (node.type === 'subflow' && node.config.workflowVersionRef && !child)
      )
        add(
          'NESTED_EFFECT_CONTEXT_UNSUPPORTED',
          'Nested graph may require a journal/verification token across call frames; real execution is blocked until certified cross-frame propagation exists',
          graph.id,
          node.id,
        );
    }
  }
  const MAX_VISITS = 120000;
  for (const graph of shape.value.graphs) {
    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    const start = graph.nodes.find((node) => node.type === 'start');
    if (!start) {
      add('MISSING_EFFECT_ENTRY', 'Graph has no start for effect audit', graph.id, graph.id);
      continue;
    }
    const routes = new Map<string, { port: Port; target: string }[]>();
    for (const edge of graph.edges) {
      const outputs = routes.get(edge.source) ?? [];
      outputs.push({ port: edge.port, target: edge.target });
      routes.set(edge.source, outputs);
    }
    const queue: { id: string; state: FlowState }[] = [
      { id: start.id, state: { intent: null, outstanding: false, verified: false } },
    ];
    const visited = new Set<string>();
    const enqueued = new Set<string>([stateKey(start.id, queue[0]!.state)]);
    for (let index = 0; index < queue.length; index++) {
      if (visited.size >= MAX_VISITS) {
        add(
          'EFFECT_PATH_BUDGET',
          'Effect path analysis exceeded its resource budget; execution is not eligible',
          graph.id,
          start.id,
        );
        break;
      }
      const item = queue[index]!;
      const key = stateKey(item.id, item.state);
      if (visited.has(key)) continue;
      visited.add(key);
      const node = byId.get(item.id);
      if (!node) {
        add('EFFECT_UNKNOWN_NODE', 'Effect path references missing node', graph.id, item.id);
        continue;
      }
      let state = item.state;
      const kind = terminalEffect(node);
      if (
        node.type === 'tap' &&
        String(node.config.effectClassification ?? 'unknown-external-write').toLowerCase() ===
          'unknown-external-write'
      )
        add(
          'UNCLASSIFIED_EXTERNAL_WRITE',
          'Unknown external write cannot be automatically admitted for real execution',
          graph.id,
          node.id,
        );
      if (kind) {
        if (state.intent !== kind)
          add(
            'MISSING_EFFECT_INTENT',
            'Every path to ' + kind + ' requires a matching successful transaction intent',
            graph.id,
            node.id,
          );
        if (state.outstanding)
          add(
            'UNVERIFIED_SECOND_EFFECT',
            'Resolve or review the previous external effect before a second effect',
            graph.id,
            node.id,
          );
        state = { intent: null, outstanding: true, verified: false };
      } else if (node.type === 'cleanup') {
        if (!state.verified || state.outstanding)
          add(
            'UNVERIFIED_CLEANUP',
            'Owned media cleanup requires confirmed verification on every reachable path',
            graph.id,
            node.id,
          );
      } else if (node.type === 'end' && state.outstanding)
        add(
          'UNVERIFIED_EFFECT_EXIT',
          'Uncertain external effect must be verified or routed to explicit review',
          graph.id,
          node.id,
        );
      if (node.type === 'transaction' && !declaredIntent(node))
        add(
          'INVALID_EFFECT_INTENT_KIND',
          'Transaction must declare a PUBLISH or COMMENT effect kind',
          graph.id,
          node.id,
        );
      for (const edge of routes.get(node.id) ?? []) {
        let next = state;
        if (node.type === 'transaction')
          next = { ...state, intent: edge.port === 'next' ? declaredIntent(node) : null };
        else if (node.type === 'verify')
          next =
            edge.port === 'true'
              ? { ...state, outstanding: false, verified: state.outstanding || state.verified }
              : { ...state, verified: false };
        const nextKey = stateKey(edge.target, next);
        if (!enqueued.has(nextKey)) {
          enqueued.add(nextKey);
          if (enqueued.size > MAX_VISITS) {
            add(
              'EFFECT_PATH_BUDGET',
              'Effect path frontier exceeds safe resource budget',
              graph.id,
              node.id,
            );
            break;
          }
          queue.push({ id: edge.target, state: next });
        }
      }
    }
  }
  return issues;
}
