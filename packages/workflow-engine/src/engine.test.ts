import { describe, expect, it } from 'vitest';
import type { WorkflowBundle, JsonValue } from '@autoreels/contracts';
import { evaluate, renderTemplate, validateBundle, traceWorkflow } from './index.js';
import type { Bindings } from './index.js';

const initial = (): WorkflowBundle => ({
  format: 'autoreels-workflow',
  schemaVersion: 2,
  workflow: { id: 'wf', appId: 'custom', name: 'Test', kind: 'main' },
  mainGraphId: 'main',
  graphs: [
    {
      id: 'main',
      inputs: [],
      outputs: [],
      nodes: [
        { id: 'start', type: 'start', name: 'Start', x: 0, y: 0, config: {} },
        { id: 'end', type: 'end', name: 'End', x: 200, y: 0, config: {} },
      ],
      edges: [{ id: 'e', source: 'start', target: 'end', port: 'next' }],
    },
  ],
  inputs: [],
  outputs: [],
  dependencies: [],
});
const bindings: Bindings = {
  row: { count: 0, enabled: false, caption: 'Tiếng Việt' },
  process: {},
  local: {},
  output: {},
};
describe('safe DSL', () => {
  it('preserves typed booleans/zero and renders Vietnamese', () => {
    expect(
      evaluate(
        {
          kind: 'binary',
          op: 'eq',
          left: { kind: 'path', path: 'row.count' },
          right: { kind: 'literal', value: 0 },
        },
        bindings,
      ),
    ).toBe(true);
    expect(renderTemplate('{{row.caption}} {{row.count}} {{row.enabled}}', bindings)).toBe(
      'Tiếng Việt 0 false',
    );
  });
  it.each([
    { kind: 'eval', source: 'process.exit()' },
    { kind: 'path', path: 'row.__proto__.x' },
    { kind: 'path', path: 'row.missing' },
    {
      kind: 'binary',
      op: 'eq',
      left: { kind: 'literal', value: '0' },
      right: { kind: 'literal', value: 0 },
    },
  ])('rejects unsafe/missing/type-coercing AST %#', (ast) => {
    expect(() => evaluate(ast as JsonValue, bindings)).toThrow();
  });
});
describe('full-bundle topology', () => {
  it('validates the generic start/end graph', () => expect(validateBundle(initial())).toEqual([]));
  it('rejects duplicate IDs, invalid ports and missing nodes', () => {
    const b = initial();
    b.graphs[0]!.nodes.push({ ...b.graphs[0]!.nodes[0]! });
    b.graphs[0]!.edges.push({ id: 'bad', source: 'end', target: 'missing', port: 'next' });
    expect(validateBundle(b).map((i) => i.code)).toContain('DUPLICATE_NODE');
    expect(validateBundle(b).map((i) => i.code)).toContain('DANGLING_EDGE');
  });
  it('rejects an invalid child graph even when main is valid', () => {
    const b = initial();
    b.graphs.push({ id: 'child', inputs: [], outputs: [], nodes: [], edges: [] });
    expect(validateBundle(b).some((i) => i.graphId === 'child')).toBe(true);
  });
  it('rejects recursion and ordinary wire cycles', () => {
    const b = initial();
    b.graphs[0]!.nodes.push({
      id: 'child',
      type: 'subflow',
      name: 'Recurse',
      x: 0,
      y: 1,
      config: { graphRef: 'main' },
    });
    b.graphs[0]!.edges.push({ id: 'self', source: 'child', target: 'child', port: 'next' });
    const codes = validateBundle(b).map((i) => i.code);
    expect(codes).toContain('WIRE_CYCLE');
    expect(codes).toContain('RECURSIVE_GRAPH');
  });
});
describe('trace-only interpreter', () => {
  it('completes a pure graph without fabricating verified post outputs', async () => {
    const r = await traceWorkflow(initial());
    expect(r.status).toBe('COMPLETED');
    expect(r.mode).toBe('TRACE');
    expect(r.outputs).toEqual({});
  });
  it('never dispatches a hardware/external action from TRACE', async () => {
    const b = initial();
    b.graphs[0]!.nodes.splice(1, 0, {
      id: 'tap',
      type: 'tap',
      name: 'Tap',
      x: 80,
      y: 0,
      config: { selector: 'button' },
    });
    b.graphs[0]!.edges = [
      { id: 'a', source: 'start', target: 'tap', port: 'next' },
      { id: 'b', source: 'tap', target: 'end', port: 'next' },
    ];
    const r = await traceWorkflow(b);
    expect(r.status).toBe('UNSUPPORTED');
    expect(r.outputs).toEqual({});
    expect(r.events.at(-1)?.nodeId).toBe('tap');
  });
  it('handles inline loop regions, continue and step budgets', async () => {
    const b = initial(),
      g = b.graphs[0]!;
    g.nodes.push(
      {
        id: 'loop',
        type: 'loop',
        name: 'Loop',
        x: 80,
        y: 0,
        config: { maxIterations: 3, itemBinding: 'item' },
      },
      {
        id: 'log',
        type: 'log',
        name: 'Log',
        x: 100,
        y: 80,
        config: { messageTemplate: '{{local.item}}' },
      },
      { id: 'continue', type: 'continue', name: 'Continue', x: 200, y: 80, config: {} },
    );
    g.edges = [
      { id: 'a', source: 'start', target: 'loop', port: 'next' },
      { id: 'b', source: 'loop', target: 'log', port: 'body' },
      { id: 'c', source: 'loop', target: 'end', port: 'done' },
      { id: 'd', source: 'log', target: 'continue', port: 'next' },
    ];
    expect(validateBundle(b)).toEqual([]);
    const r = await traceWorkflow(b);
    expect(r.status).toBe('COMPLETED');
    expect(r.events.filter((e) => e.nodeId === 'log').map((e) => e.detail)).toEqual([
      '0',
      '1',
      '2',
    ]);
    expect((await traceWorkflow(b, {}, { maxSteps: 2 })).status).toBe('ERROR');
  });
  it('cancels before sending even a pure step', async () => {
    const c = new AbortController();
    c.abort();
    const r = await traceWorkflow(initial(), {}, { signal: c.signal });
    expect(r.status).toBe('CANCELLED');
    expect(r.events).toEqual([]);
  });
});
