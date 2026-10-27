import { describe, expect, it } from 'vitest';
import type { DebugSnapshot, WorkflowBundle } from '@autoreels/contracts';
import { TraceDebugSession, traceWorkflow, validateBundle } from './index.js';

export function debugBundle(): WorkflowBundle {
  return {
    format: 'autoreels-workflow',
    schemaVersion: 2,
    workflow: { id: 'debug_workflow', appId: 'fb', name: 'Debugger test', kind: 'main' },
    mainGraphId: 'main',
    inputs: [],
    outputs: [],
    dependencies: [],
    graphs: [
      {
        id: 'main',
        inputs: [],
        outputs: [],
        nodes: [
          { id: 'start', type: 'start', name: 'Start', x: 0, y: 0, config: {} },
          {
            id: 'call',
            type: 'subflow',
            name: 'Call',
            x: 100,
            y: 0,
            config: { graphRef: 'child' },
          },
          {
            id: 'after',
            type: 'log',
            name: 'After',
            x: 200,
            y: 0,
            config: { messageTemplate: 'Returned' },
          },
          { id: 'end', type: 'end', name: 'End', x: 300, y: 0, config: {} },
        ],
        edges: [
          { id: 'a', source: 'start', target: 'call', port: 'next' },
          { id: 'b', source: 'call', target: 'after', port: 'next' },
          { id: 'c', source: 'after', target: 'end', port: 'next' },
        ],
      },
      {
        id: 'child',
        inputs: [],
        outputs: [],
        nodes: [
          { id: 'start', type: 'start', name: 'Start', x: 0, y: 0, config: {} },
          { id: 'wait', type: 'wait', name: 'Wait', x: 100, y: 0, config: {} },
          { id: 'end', type: 'end', name: 'End', x: 200, y: 0, config: {} },
        ],
        edges: [
          { id: 'a', source: 'start', target: 'wait', port: 'next' },
          { id: 'b', source: 'wait', target: 'end', port: 'next' },
        ],
      },
    ],
  };
}
async function changed(session: TraceDebugSession, revision: number): Promise<DebugSnapshot> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const snapshot = session.snapshot;
    if (
      snapshot.revision > revision &&
      snapshot.state !== 'RUNNING' &&
      snapshot.state !== 'STOPPING'
    )
      return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error('Debugger did not reach a boundary');
}
describe('semantic TRACE debugger', () => {
  it('steps into/over/out using actual call depth and keeps snapshots isolated', async () => {
    const session = new TraceDebugSession(debugBundle());
    try {
      expect(session.snapshot).toMatchObject({
        state: 'PAUSED',
        reason: 'entry',
        current: { nodeId: 'start', depth: 1 },
      });
      const copied = session.snapshot;
      copied.current!.stack[0]!.nodeId = 'mutated';
      expect(session.snapshot.current!.nodeId).toBe('start');
      let revision = session.snapshot.revision;
      session.control('STEP_INTO');
      let snapshot = await changed(session, revision);
      expect(snapshot.current).toMatchObject({ graphId: 'main', nodeId: 'call', depth: 1 });
      revision = snapshot.revision;
      session.control('STEP_INTO');
      snapshot = await changed(session, revision);
      expect(snapshot.current).toMatchObject({ graphId: 'child', nodeId: 'start', depth: 2 });
      revision = snapshot.revision;
      session.control('STEP_OVER');
      snapshot = await changed(session, revision);
      expect(snapshot.current).toMatchObject({ graphId: 'child', nodeId: 'wait', depth: 2 });
      revision = snapshot.revision;
      session.control('STEP_OUT');
      snapshot = await changed(session, revision);
      expect(snapshot.current).toMatchObject({ graphId: 'main', nodeId: 'after', depth: 1 });
      expect(() => session.control('STEP_OUT')).toThrow('caller');
      session.control('CONTINUE');
      await session.completion;
      expect(session.snapshot.state).toBe('COMPLETED');
    } finally {
      await session.close();
    }
  });
  it('step-over skips child frames but still honors a child breakpoint exactly once', async () => {
    const b = debugBundle();
    b.graphs[1]!.nodes[1]!.breakpoint = true;
    const session = new TraceDebugSession(b);
    try {
      let revision = session.snapshot.revision;
      session.control('STEP_OVER');
      let snapshot = await changed(session, revision);
      expect(snapshot.current!.nodeId).toBe('call');
      revision = snapshot.revision;
      session.control('STEP_OVER');
      snapshot = await changed(session, revision);
      expect(snapshot).toMatchObject({
        reason: 'breakpoint',
        current: { graphId: 'child', nodeId: 'wait' },
      });
      session.control('CONTINUE');
      await session.completion;
      expect(session.snapshot.state).toBe('COMPLETED');
      expect(
        session.snapshot.events.filter((e) => e.graphId === 'child' && e.nodeId === 'wait'),
      ).toHaveLength(1);
    } finally {
      await session.close();
    }
  });
  it('stops a suspended session without executing its pending node', async () => {
    const session = new TraceDebugSession(debugBundle());
    await session.close();
    expect(session.snapshot).toMatchObject({ state: 'CANCELLED', events: [], totalEvents: 0 });
  });
  it('honors a pause request at the next boundary and redacts secret bindings in logs and snapshots', async () => {
    const b = debugBundle(),
      graph = b.graphs[0]!;
    graph.nodes[1] = {
      id: 'call',
      type: 'setvar',
      name: 'Set secret',
      x: 100,
      y: 0,
      config: {
        targetPath: 'local.password',
        expression: { kind: 'literal', value: 'fixture-private-value' },
      },
    };
    graph.nodes[2]!.config.messageTemplate = '{{local.password}}';
    const session = new TraceDebugSession(b);
    try {
      const revision = session.snapshot.revision;
      session.control('CONTINUE');
      session.control('PAUSE');
      let snapshot = await changed(session, revision);
      expect(snapshot).toMatchObject({
        state: 'PAUSED',
        reason: 'pause',
        current: { nodeId: 'call' },
      });
      session.control('STEP_OVER');
      snapshot = await changed(session, snapshot.revision);
      expect(snapshot.current!.locals.password).toBe('[REDACTED]');
      session.control('CONTINUE');
      await session.completion;
      expect(session.snapshot.events.find((e) => e.nodeId === 'after')!.detail).toBe('[REDACTED]');
    } finally {
      await session.close();
    }
  });
  it('does not consume execution time budgets while a debugger is suspended', async () => {
    const report = await traceWorkflow(
      debugBundle(),
      {},
      { maxDurationMs: 20, beforeStep: () => new Promise((resolve) => setTimeout(resolve, 30)) },
    );
    expect(report.status).toBe('COMPLETED');
  });
});

describe('typed subflow frames and return mapping', () => {
  function typed() {
    const b = debugBundle(),
      child = b.graphs[1]!,
      call = b.graphs[0]!.nodes[1]!;
    child.inputs = [
      { key: 'count', type: 'number', scope: 'row', required: true },
      { key: 'enabled', type: 'boolean', scope: 'process', required: true },
    ];
    child.outputs = [{ key: 'result', type: 'number', scope: 'output', required: true }];
    child.nodes[1] = {
      id: 'wait',
      type: 'output',
      name: 'Return value',
      x: 100,
      y: 0,
      config: { valueMapping: { result: { kind: 'path', path: 'row.count' } } },
    };
    call.config.inputMapping = {
      count: { kind: 'path', path: 'row.zero' },
      enabled: { kind: 'literal', value: false },
    };
    call.config.outputMapping = { result: 'local.returned' };
    b.graphs[0]!.nodes[2]!.config.messageTemplate = '{{local.returned}} {{row.zero}}';
    return b;
  }
  it('keeps zero/false types, isolates outputs and atomically maps declared returns to caller locals', async () => {
    const b = typed();
    expect(validateBundle(b)).toEqual([]);
    const report = await traceWorkflow(b, { row: { zero: 0 } });
    expect(report.status).toBe('COMPLETED');
    expect(report.outputs).toEqual({});
    expect(report.events.find((e) => e.nodeId === 'after')!.detail).toBe('0 0');
  });
  it('rejects missing/unknown/literal type errors and unsafe output destinations before running', () => {
    const b = typed(),
      call = b.graphs[0]!.nodes[1]!;
    call.config.inputMapping = {
      count: { kind: 'literal', value: '0' },
      extra: { kind: 'literal', value: true },
    };
    call.config.outputMapping = { result: 'row.value' };
    const codes = validateBundle(b).map((i) => i.code);
    expect(codes).toContain('MISSING_INPUT_MAPPING');
    expect(codes).toContain('INPUT_MAPPING_TYPE');
    expect(codes).toContain('UNKNOWN_INPUT_MAPPING');
    expect(codes).toContain('INVALID_OUTPUT_MAPPING');
  });
  it('rejects dynamic type mismatches instead of coercing values or continuing after a bad call', async () => {
    const report = await traceWorkflow(typed(), { row: { zero: '0' } });
    expect(report.status).toBe('ERROR');
    expect(report.events.some((e) => e.graphId === 'child')).toBe(false);
    expect(report.events.some((e) => e.nodeId === 'after')).toBe(false);
  });
});
