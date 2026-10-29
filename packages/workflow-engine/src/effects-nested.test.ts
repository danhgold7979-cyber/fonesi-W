import { describe, expect, it } from 'vitest';
import type { WorkflowBundle, WorkflowGraph, WorkflowNode, WorkflowEdge } from '@autoreels/contracts';
import { assessEffectPaths, assertStaticEffectPathsSafe, compileWorkflow, validateBundle } from './index.js';

const node = (id: string, type: WorkflowNode['type'], config: WorkflowNode['config'] = {}): WorkflowNode =>
  ({ id, type, name: id, x: 0, y: 0, config });
const edge = (id: string, source: string, port: WorkflowEdge['port'], target: string): WorkflowEdge =>
  ({ id, source, port, target });
const graph = (id: string, nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowGraph =>
  ({ id, nodes, edges, groups: [], inputs: [], outputs: [] });
function pure(): WorkflowBundle {
  return {
    format: 'autoreels-workflow',
    schemaVersion: 2,
    workflow: { id: 'wf_nested_effect', appId: 'fb', name: 'Nested effect admission', kind: 'main' },
    mainGraphId: 'main',
    inputs: [], outputs: [], dependencies: [],
    graphs: [
      graph('main', [
        node('root_start', 'start'),
        node('call', 'subflow', { graphRef: 'child', inputMapping: {}, outputMapping: {} }),
        node('root_end', 'end'),
      ], [
        edge('a', 'root_start', 'next', 'call'),
        edge('b', 'call', 'next', 'root_end'),
      ]),
      graph('child', [
        node('child_start', 'start'),
        node('child_end', 'end'),
      ], [
        edge('c', 'child_start', 'next', 'child_end'),
      ]),
    ],
  };
}
function effectGraph(id = 'child'): WorkflowGraph {
  return graph(id, [
    node('effect_start', 'start'),
    node('effect_intent', 'transaction', {
      effectKind: 'PUBLISH', idempotencyScope: 'content-target', payloadHash: 'frozen',
    }),
    node('effect_publish', 'tap', { selector: '#publish', effectClassification: 'publish' }),
    node('effect_verify', 'verify', { verificationProfile: 'profile', evidenceMapping: {} }),
    node('effect_cleanup', 'cleanup', { ownershipLedgerRef: 'owned', terminalPolicy: 'verified' }),
    node('effect_review', 'review', { reasonCode: 'NEEDS_REVIEW', evidenceRefs: [] }),
    node('effect_end', 'end'),
  ], [
    edge('e1', 'effect_start', 'next', 'effect_intent'),
    edge('e2', 'effect_intent', 'next', 'effect_publish'),
    edge('e3', 'effect_intent', 'error', 'effect_review'),
    edge('e4', 'effect_publish', 'next', 'effect_verify'),
    edge('e5', 'effect_publish', 'error', 'effect_review'),
    edge('e6', 'effect_verify', 'true', 'effect_cleanup'),
    edge('e7', 'effect_verify', 'false', 'effect_review'),
    edge('e8', 'effect_verify', 'error', 'effect_review'),
    edge('e9', 'effect_cleanup', 'next', 'effect_end'),
    edge('e10', 'effect_cleanup', 'error', 'effect_review'),
  ]);
}
const codes = (bundle: WorkflowBundle) => assessEffectPaths(bundle).map((issue) => issue.code);

describe('P05 nested external effect admission (conservative fail-closed)', () => {
  it('keeps pure local nested subflows admissible without a fake provider certificate', () => {
    const bundle = pure();
    expect(validateBundle(bundle)).toEqual([]);
    expect(assessEffectPaths(bundle)).toEqual([]);
    expect(() => assertStaticEffectPathsSafe(compileWorkflow(bundle))).not.toThrow();
  });
  it('blocks even locally valid nested publish/verify/cleanup flows when caller cannot carry journal state', () => {
    const bundle = pure();
    bundle.graphs[1] = effectGraph();
    const before = structuredClone(bundle);
    expect(validateBundle(bundle)).toEqual([]);
    const problems = assessEffectPaths(bundle);
    expect(problems).toContainEqual(expect.objectContaining({
      graphId: 'main',
      nodeId: 'call',
      code: 'NESTED_EFFECT_CONTEXT_UNSUPPORTED',
    }));
    expect(() => assertStaticEffectPathsSafe(compileWorkflow(bundle))).toThrow('journal');
    expect(bundle).toEqual(before);
  });
  it('fences effects hidden behind two subflow levels (a clean parent cannot launder an effect)', () => {
    const bundle = pure();
    bundle.graphs[1] = graph('child', [
      node('child_start', 'start'),
      node('deep_call', 'subflow', { graphRef: 'grandchild', inputMapping: {}, outputMapping: {} }),
      node('child_end', 'end'),
    ], [
      edge('c1', 'child_start', 'next', 'deep_call'),
      edge('c2', 'deep_call', 'next', 'child_end'),
    ]);
    bundle.graphs.push(effectGraph('grandchild'));
    const issues = assessEffectPaths(bundle);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'NESTED_EFFECT_CONTEXT_UNSUPPORTED', graphId: 'main', nodeId: 'call',
      }),
      expect.objectContaining({
        code: 'NESTED_EFFECT_CONTEXT_UNSUPPORTED', graphId: 'child', nodeId: 'deep_call',
      }),
    ]));
  });
  it('rejects effectful loop body graph calls without cross-frame claim propagation', () => {
    const bundle = pure();
    bundle.graphs[0] = graph('main', [
      node('root_start', 'start'),
      node('loop', 'loop', { bodyGraphRef: 'child', maxIterations: 2 }),
      node('root_end', 'end'),
    ], [
      edge('a', 'root_start', 'next', 'loop'),
      edge('b', 'loop', 'done', 'root_end'),
    ]);
    bundle.graphs[1] = effectGraph();
    expect(codes(bundle)).toContain('NESTED_EFFECT_CONTEXT_UNSUPPORTED');
    expect(assessEffectPaths(bundle)).toContainEqual(expect.objectContaining({
      graphId: 'main', nodeId: 'loop', code: 'NESTED_EFFECT_CONTEXT_UNSUPPORTED',
    }));
  });
  it('also blocks a nested gesture that could mutate an app without a journaled effect', () => {
    const bundle = pure();
    bundle.graphs[1] = graph('child', [
      node('child_start', 'start'),
      node('gesture', 'doubletap', { selector: '#action', intervalMs: 100 }),
      node('child_end', 'end'),
    ], [
      edge('g1', 'child_start', 'next', 'gesture'),
      edge('g2', 'gesture', 'next', 'child_end'),
    ]);
    expect(assessEffectPaths(bundle)).toContainEqual(expect.objectContaining({
      code: 'NESTED_EFFECT_CONTEXT_UNSUPPORTED', graphId: 'main', nodeId: 'call',
    }));
  });

});
