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

function bodyLoop(terminal: 'end' | 'continue' | 'break' | 'review' = 'continue'): WorkflowBundle {
  const b = initial(),
    g = b.graphs[0]!;
  g.nodes.push({
    id: 'loop',
    type: 'loop',
    name: 'Loop ref',
    x: 50,
    y: 0,
    config: { maxIterations: 3, bodyGraphRef: 'body', itemBinding: 'index' },
  });
  g.edges = [
    { id: 'enter', source: 'start', target: 'loop', port: 'next' },
    { id: 'done', source: 'loop', target: 'end', port: 'done' },
  ];
  b.graphs.push({
    id: 'body',
    inputs: [],
    outputs: [],
    nodes: [
      { id: 'start', type: 'start', name: 'Start', x: 0, y: 0, config: {} },
      {
        id: 'log',
        type: 'log',
        name: 'Log index',
        x: 50,
        y: 0,
        config: { messageTemplate: '{{local.index}}' },
      },
      { id: 'terminal', type: terminal, name: 'Terminal', x: 100, y: 0, config: {} },
    ],
    edges: [
      { id: 'a', source: 'start', target: 'log', port: 'next' },
      { id: 'b', source: 'log', target: 'terminal', port: 'next' },
    ],
  });
  return b;
}
describe('lexical body graphs and bounded TRACE frames', () => {
  it('executes a referenced body graph with real index/continue events and handles zero iterations', async () => {
    const b = bodyLoop();
    expect(validateBundle(b)).toEqual([]);
    const report = await traceWorkflow(b);
    expect(report.status).toBe('COMPLETED');
    expect(report.events.filter((e) => e.nodeId === 'log').map((e) => e.detail)).toEqual([
      '0',
      '1',
      '2',
    ]);
    expect(report.events.filter((e) => e.type === 'continue')).toHaveLength(3);
    b.graphs[0]!.nodes.find((n) => n.id === 'loop')!.config.maxIterations = 0;
    expect((await traceWorkflow(b)).events.some((e) => e.graphId === 'body')).toBe(false);
  });
  it('breaks the nearest loop and restores an existing caller index after body return', async () => {
    const b = bodyLoop('break'),
      g = b.graphs[0]!;
    g.nodes.push(
      {
        id: 'pre',
        type: 'setvar',
        name: 'Set index',
        x: 1,
        y: 1,
        config: { targetPath: 'local.index', expression: { kind: 'literal', value: 42 } },
      },
      {
        id: 'after',
        type: 'log',
        name: 'Caller log',
        x: 1,
        y: 1,
        config: { messageTemplate: '{{local.index}}' },
      },
    );
    g.edges = [
      { id: 'a', source: 'start', target: 'pre', port: 'next' },
      { id: 'b', source: 'pre', target: 'loop', port: 'next' },
      { id: 'c', source: 'loop', target: 'after', port: 'done' },
      { id: 'd', source: 'after', target: 'end', port: 'next' },
    ];
    const r = await traceWorkflow(b);
    expect(r.status).toBe('COMPLETED');
    expect(r.events.filter((e) => e.type === 'break')).toHaveLength(1);
    expect(r.events.find((e) => e.nodeId === 'after')!.detail).toBe('42');
  });
  it('preserves the outer cursor when a nested body graph uses the same local index name', async () => {
    const b = bodyLoop('end'),
      body = b.graphs[1]!;
    const child = structuredClone(body);
    child.id = 'innerBody';
    child.nodes.find((n) => n.id === 'log')!.config.messageTemplate = 'inner {{local.index}}';
    b.graphs.push(child);
    body.nodes.push(
      {
        id: 'innerLoop',
        type: 'loop',
        name: 'Inner',
        x: 1,
        y: 1,
        config: { bodyGraphRef: 'innerBody', maxIterations: 2, itemBinding: 'index' },
      },
      {
        id: 'outerAfter',
        type: 'log',
        name: 'Outer after',
        x: 1,
        y: 1,
        config: { messageTemplate: 'outer {{local.index}}' },
      },
    );
    body.edges = [
      { id: 'a', source: 'start', target: 'log', port: 'next' },
      { id: 'b', source: 'log', target: 'innerLoop', port: 'next' },
      { id: 'c', source: 'innerLoop', target: 'outerAfter', port: 'done' },
      { id: 'd', source: 'outerAfter', target: 'terminal', port: 'next' },
    ];
    const r = await traceWorkflow(b);
    expect(r.status).toBe('COMPLETED');
    expect(r.events.filter((e) => e.nodeId === 'outerAfter').map((e) => e.detail)).toEqual([
      'outer 0',
      'outer 1',
      'outer 2',
    ]);
  });
  it('rejects missing/ambiguous references, schema declarations without mappings and ordinary calls to lexical break bodies', () => {
    let b = bodyLoop('break');
    b.graphs[0]!.nodes.find((n) => n.id === 'loop')!.config.bodyGraphRef = 'missing';
    expect(validateBundle(b).map((i) => i.code)).toContain('UNRESOLVED_GRAPH');
    b = bodyLoop();
    b.graphs[0]!.edges.push({ id: 'inline', source: 'loop', target: 'end', port: 'body' });
    expect(validateBundle(b).map((i) => i.code)).toContain('AMBIGUOUS_LOOP_BODY');
    b = bodyLoop();
    b.graphs[1]!.inputs.push({ key: 'value', type: 'number', scope: 'row', required: true });
    expect(validateBundle(b).map((i) => i.code)).toContain('LOOP_BODY_MAPPING_UNSUPPORTED');
    b = bodyLoop('break');
    const g = b.graphs[0]!;
    g.nodes.push({
      id: 'call',
      type: 'subflow',
      name: 'Normal call',
      x: 1,
      y: 1,
      config: { graphRef: 'body' },
    });
    g.edges.find((e) => e.source === 'start')!.target = 'call';
    g.edges.push({ id: 'callNext', source: 'call', target: 'loop', port: 'next' });
    expect(validateBundle(b).map((i) => i.code)).toContain('LOOP_SCOPE');
  });
  it('rejects bypass paths into inline control nodes outside lexical entry', () => {
    const b = bodyLoop('break'),
      g = b.graphs[0]!;
    b.graphs.pop();
    g.nodes.find((n) => n.id === 'loop')!.config.bodyGraphRef = '';
    g.nodes.push(
      { id: 'break', type: 'break', name: 'Break', x: 1, y: 1, config: {} },
      {
        id: 'condition',
        type: 'condition',
        name: 'Branch',
        x: 1,
        y: 1,
        config: { expression: { kind: 'literal', value: true } },
      },
    );
    g.edges = [
      { id: 'a', source: 'start', target: 'condition', port: 'next' },
      { id: 'b', source: 'condition', target: 'loop', port: 'true' },
      { id: 'c', source: 'condition', target: 'break', port: 'false' },
      { id: 'd', source: 'loop', target: 'break', port: 'body' },
      { id: 'e', source: 'loop', target: 'end', port: 'done' },
    ];
    expect(validateBundle(b).map((i) => i.code)).toContain('LOOP_SCOPE');
  });
  it('allows cancellation while pure work is running and rejects invalid step/time options', async () => {
    const b = bodyLoop();
    b.graphs[0]!.nodes.find((n) => n.id === 'loop')!.config.maxIterations = 1000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 0);
    const r = await traceWorkflow(b, {}, { signal: controller.signal, maxSteps: 100000 });
    clearTimeout(timer);
    expect(r.status).toBe('CANCELLED');
    expect(r.events.length).toBeGreaterThan(0);
    expect(r.events.length).toBeLessThan(4000);
    for (const options of [
      { maxSteps: Infinity },
      { maxSteps: 0 },
      { maxDurationMs: 0 },
      { maxDurationMs: 60001 },
    ])
      expect((await traceWorkflow(initial(), {}, options)).issues[0]!.code).toBe('TRACE_BUDGET');
    const timed = await traceWorkflow(b, {}, { maxSteps: 100000, maxDurationMs: 1 });
    expect(timed.status).toBe('ERROR');
    expect(timed.events.at(-1)!.detail).toContain('Time budget');
  });
  it('bounds acyclic call depth and propagates REVIEW without running after the body', async () => {
    const b = initial();
    for (let i = 0; i < 70; i++) {
      const g = structuredClone(initial().graphs[0]!);
      g.id = 'child' + i;
      b.graphs.push(g);
    }
    b.graphs.forEach((g, i) => {
      if (i === b.graphs.length - 1) return;
      g.nodes.push({
        id: 'call',
        type: 'subflow',
        name: 'Child',
        x: 1,
        y: 1,
        config: { graphRef: b.graphs[i + 1]!.id },
      });
      g.edges = [
        { id: 'a', source: 'start', target: 'call', port: 'next' },
        { id: 'b', source: 'call', target: 'end', port: 'next' },
      ];
    });
    const r = await traceWorkflow(b);
    expect(r.status).toBe('ERROR');
    expect(r.events.at(-1)!.detail).toContain('Call depth');
    const review = await traceWorkflow(bodyLoop('review'));
    expect(review.status).toBe('REVIEW');
    expect(review.events.at(-1)!.type).toBe('review');
  });
});
