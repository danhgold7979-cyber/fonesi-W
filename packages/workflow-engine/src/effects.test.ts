import { describe, expect, it } from 'vitest';
import type { WorkflowBundle, WorkflowNode, WorkflowEdge } from '@autoreels/contracts';
import { assessEffectPaths, compileWorkflow, assertStaticEffectPathsSafe, validateBundle } from './index.js';

const node = (
  id: string,
  type: WorkflowNode['type'],
  config: WorkflowNode['config'] = {},
): WorkflowNode => ({ id, type, name: id, x: 100, y: 100, config });
const edge = (id: string, source: string, port: WorkflowEdge['port'], target: string): WorkflowEdge => ({
  id, source, port, target,
});

function good(): WorkflowBundle {
  return {
    format: 'autoreels-workflow',
    schemaVersion: 2,
    workflow: { id: 'wf_effect_audit', appId: 'fb', kind: 'main', name: 'Effect path audit' },
    mainGraphId: 'main',
    inputs: [],
    outputs: [],
    dependencies: [],
    graphs: [{
      id: 'main',
      name: 'Main',
      inputs: [],
      outputs: [],
      nodes: [
        node('start', 'start'),
        node('intent', 'transaction', {
          effectKind: 'PUBLISH',
          idempotencyScope: 'content-target',
          payloadHash: 'pinned-payload',
        }),
        node('publish', 'tap', { selector: '#publish', effectClassification: 'publish' }),
        node('verify', 'verify', { verificationProfile: 'profile', evidenceMapping: {} }),
        node('cleanup', 'cleanup', { ownershipLedgerRef: 'owned-ledger', terminalPolicy: 'verified' }),
        node('review', 'review', { reasonCode: 'UNKNOWN_EFFECT', evidenceRefs: [] }),
        node('end', 'end'),
      ],
      edges: [
        edge('s', 'start', 'next', 'intent'),
        edge('t-next', 'intent', 'next', 'publish'),
        edge('t-error', 'intent', 'error', 'review'),
        edge('publish-next', 'publish', 'next', 'verify'),
        edge('publish-error', 'publish', 'error', 'review'),
        edge('verify-true', 'verify', 'true', 'cleanup'),
        edge('verify-false', 'verify', 'false', 'review'),
        edge('verify-error', 'verify', 'error', 'review'),
        edge('cleanup-next', 'cleanup', 'next', 'end'),
        edge('cleanup-error', 'cleanup', 'error', 'review'),
      ],
      groups: [],
    }],
  };
}
const codes = (bundle: WorkflowBundle): string[] => assessEffectPaths(bundle).map((i) => i.code);

describe('P05 effect-path audit: every branch needs a durable intent and verified cleanup', () => {
  it('certifies only intragraph path structure, embeds it in immutable IR, never claims device execution', () => {
    const workflow = good();
    expect(validateBundle(workflow)).toEqual([]);
    const compiled = compileWorkflow(workflow);
    expect(compiled.effectPathAudit.scope).toBe('STATIC_INTRAGRAPH_ONLY');
    expect(compiled.effectPathAudit.issues).toEqual([]);
    expect(() => assertStaticEffectPathsSafe(compiled)).not.toThrow();
    expect(Object.isFrozen(compiled.effectPathAudit)).toBe(true);
    expect(Object.isFrozen(compiled.effectPathAudit.issues)).toBe(true);
    expect(workflow.graphs[0]!.nodes.find((n) => n.id === 'intent')!.config.effectKind).toBe(
      'PUBLISH',
    );
  });
  it('rejects transaction.error bypass even when immediate predecessor is a transaction', () => {
    const workflow = good(), graph = workflow.graphs[0]!;
    graph.edges.find((e) => e.id === 't-error')!.target = 'publish';
    expect(validateBundle(workflow)).toEqual([]);
    expect(codes(workflow)).toContain('MISSING_EFFECT_INTENT');
    const compiled = compileWorkflow(workflow);
    expect(compiled.effectPathAudit.issues.some((i) => i.nodeId === 'publish')).toBe(true);
    expect(() => assertStaticEffectPathsSafe(compiled)).toThrow('Every path');
  });
  it('rejects a typed-intent mismatch and missing declared kind', () => {
    const workflow = good();
    workflow.graphs[0]!.nodes.find((n) => n.id === 'intent')!.config.effectKind = 'COMMENT';
    expect(codes(workflow)).toContain('MISSING_EFFECT_INTENT');
    workflow.graphs[0]!.nodes.find((n) => n.id === 'intent')!.config.effectKind = '';
    expect(codes(workflow)).toEqual(expect.arrayContaining([
      'INVALID_EFFECT_INTENT_KIND',
      'MISSING_EFFECT_INTENT',
    ]));
  });
  it('rejects cleanup on verify.false/error or before a confirmed effect', () => {
    const workflow = good();
    workflow.graphs[0]!.edges.find((e) => e.id === 'verify-false')!.target = 'cleanup';
    expect(codes(workflow)).toContain('UNVERIFIED_CLEANUP');
    const withoutProof = good(), graph = withoutProof.graphs[0]!;
    graph.edges.find((e) => e.id === 's')!.target = 'cleanup';
    expect(codes(withoutProof)).toContain('UNVERIFIED_CLEANUP');
  });
  it('reports an unresolved publish reaching a normal success end but permits explicit review', () => {
    const workflow = good(), graph = workflow.graphs[0]!;
    graph.edges.find((e) => e.id === 'publish-next')!.target = 'end';
    expect(codes(workflow)).toContain('UNVERIFIED_EFFECT_EXIT');
    graph.edges.find((e) => e.id === 'publish-next')!.target = 'review';
    expect(codes(workflow)).not.toContain('UNVERIFIED_EFFECT_EXIT');
  });
  it('rejects two irreversible effects before verification even with a second intent', () => {
    const workflow = good(), graph = workflow.graphs[0]!;
    graph.nodes.push(
      node('comment-intent', 'transaction', { effectKind: 'COMMENT' }),
      node('comment', 'tap', { effectClassification: 'comment', selector: '#comment' }),
    );
    graph.edges.find((e) => e.id === 'publish-next')!.target = 'comment-intent';
    graph.edges.push(
      edge('comment-intent-next', 'comment-intent', 'next', 'comment'),
      edge('comment-intent-error', 'comment-intent', 'error', 'review'),
      edge('comment-next', 'comment', 'next', 'verify'),
      edge('comment-error', 'comment', 'error', 'review'),
    );
    expect(codes(workflow)).toContain('UNVERIFIED_SECOND_EFFECT');
  });
  it('does not admit unclassified external taps or assume arbitrary device gestures are safe posting', () => {
    const workflow = good();
    workflow.graphs[0]!.nodes.find((n) => n.id === 'publish')!.config.effectClassification =
      'unknown-external-write';
    expect(codes(workflow)).toContain('UNCLASSIFIED_EXTERNAL_WRITE');
    expect(() => assertStaticEffectPathsSafe(compileWorkflow(workflow))).toThrow();
  });
  it('is bounded across converging paths and preserves branch-dependent audit state', () => {
    const workflow = good(), graph = workflow.graphs[0]!;
    for (let i = 0; i < 80; i++) {
      const id = 'branch_' + i;
      graph.nodes.push(node(id, 'condition', { expression: { kind: 'literal', value: true } }));
    }
    // Deliberately branch into one shared graph tail many times; path-state dedup
    // must not explode by enumerating every input route.
    graph.edges.find((e) => e.id === 's')!.target = 'branch_0';
    for (let i = 0; i < 80; i++) {
      const id = 'branch_' + i;
      graph.edges.push(edge('a_' + i, id, 'true', i === 79 ? 'intent' : 'branch_' + (i + 1)));
      graph.edges.push(edge('b_' + i, id, 'false', i === 79 ? 'intent' : 'branch_' + (i + 1)));
    }
    expect(codes(workflow)).toEqual([]);
  });
});
