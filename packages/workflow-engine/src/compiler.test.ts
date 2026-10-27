import { describe, expect, it } from 'vitest';
import type { WorkflowBundle, WorkflowVersion } from '@autoreels/contracts';
import { bundleHash } from '@autoreels/domain';
import { compileWorkflow, traceWorkflow } from './index.js';

function plain(id = 'wf_root'): WorkflowBundle {
  return {
    format: 'autoreels-workflow',
    schemaVersion: 2,
    workflow: { id, appId: 'fb', name: id, kind: 'sub' },
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
          { id: 'end', type: 'end', name: 'End', x: 200, y: 0, config: {} },
        ],
        edges: [{ id: 'e', source: 'start', target: 'end', port: 'next' }],
      },
    ],
  };
}
function version(bundle = plain('wf_child'), id = 'ver_child'): WorkflowVersion {
  return {
    id,
    workflowId: bundle.workflow.id,
    number: 1,
    hash: bundleHash(bundle),
    bundle,
    createdAt: '2026-10-27T00:00:00.000Z',
  };
}
function call(bundle: WorkflowBundle, child: WorkflowVersion) {
  const pin = { id: child.workflowId, versionId: child.id, hash: child.hash };
  if (!bundle.dependencies.some((p) => p.id === pin.id)) bundle.dependencies.push(pin);
  const graph = bundle.graphs[0]!,
    nodeId = 'call_' + graph.nodes.length;
  graph.nodes.push({
    id: nodeId,
    type: 'subflow',
    name: 'Call',
    x: 100,
    y: 0,
    config: { workflowVersionRef: { ...pin }, inputMapping: {}, outputMapping: {} },
  });
  graph.edges.find((e) => e.target === 'end')!.target = nodeId;
  graph.edges.push({ id: 'edge_' + nodeId, source: nodeId, target: 'end', port: 'next' });
  return graph.nodes.at(-1)!;
}
describe('immutable dependency compiler', () => {
  it('compiles named routes/source maps and freezes every nested instruction without freezing the editor source', () => {
    const source = plain(),
      ir = compileWorkflow(source);
    expect(ir.graphs[0]).toMatchObject({
      id: 'main',
      entryId: 'start',
      instructions: [
        {
          graphId: 'main',
          nodeId: 'start',
          routes: { next: 'end' },
          defaultError: 'STOP_FOR_REVIEW',
        },
        { graphId: 'main', nodeId: 'end', routes: {}, defaultError: 'STOP_FOR_REVIEW' },
      ],
    });
    expect(() => {
      ir.graphs[0]!.instructions[0]!.routes.next = 'missing';
    }).toThrow();
    source.graphs[0]!.nodes[0]!.name = 'Edited';
    expect(ir.bundle.graphs[0]!.nodes[0]!.name).toBe('Start');
    expect(ir.closureHash).toBe(bundleHash(ir.bundle));
  });
  it('resolves nested versions once per namespace and executes the resulting self-contained graph closure', async () => {
    const grand = version(plain('wf_grand'), 'ver_grand');
    const childBundle = plain('wf_child');
    call(childBundle, grand);
    const child = version(childBundle),
      source = plain();
    call(source, child);
    call(source, child);
    const records = new Map([
      [grand.id, grand],
      [child.id, child],
    ]);
    const ir = compileWorkflow(source, (id) => records.get(id)!);
    expect(ir.bundle.graphs).toHaveLength(3);
    expect(new Set(ir.bundle.graphs.map((g) => g.id)).size).toBe(3);
    expect(ir.bundle.graphs.flatMap((g) => g.nodes).some((n) => n.config.workflowVersionRef)).toBe(
      false,
    );
    expect(ir.bundle.dependencies).toHaveLength(2);
    expect((await traceWorkflow(ir.bundle)).status).toBe('COMPLETED');
    expect(source.graphs[0]!.nodes.at(-1)!.config.workflowVersionRef).toBeDefined();
  });
  it('verifies declared pins and canonical bytes instead of accepting a matching metadata hash', () => {
    const child = version(),
      source = plain();
    call(source, child);
    expect(() => compileWorkflow(source)).toThrow('resolver');
    expect(() =>
      compileWorkflow(source, () => {
        throw new Error('missing');
      }),
    ).toThrow('unavailable');
    child.bundle.workflow.name = 'Tampered';
    expect(() => compileWorkflow(source, () => child)).toThrow('bytes');
  });
  it('rejects unpinned/undeclared calls, app mismatch and duplicate dependency declarations', () => {
    const child = version(),
      source = plain(),
      node = call(source, child);
    source.dependencies = [];
    expect(() => compileWorkflow(source, () => child)).toThrow('declaration');
    source.dependencies.push({ id: child.workflowId, versionId: child.id, hash: child.hash });
    node.config.workflowVersionRef = { id: child.workflowId };
    expect(() => compileWorkflow(source, () => child)).toThrow('id/versionId/hash');
    node.config.workflowVersionRef = { ...source.dependencies[0]! };
    source.dependencies.push({ ...source.dependencies[0]! });
    expect(() => compileWorkflow(source, () => child)).toThrow('Duplicate');
    const foreign = plain('wf_foreign');
    foreign.workflow.appId = 'tt';
    const other = version(foreign, 'ver_foreign'),
      root = plain();
    call(root, other);
    expect(() => compileWorkflow(root, () => other)).toThrow('different app');
  });
  it('does not resolve a missing child-local graph against a same-named graph in its caller', () => {
    const childBundle = plain('wf_child'),
      childGraph = childBundle.graphs[0]!;
    childGraph.nodes.push({
      id: 'bad',
      type: 'subflow',
      name: 'Bad',
      x: 50,
      y: 0,
      config: { graphRef: 'outside' },
    });
    childGraph.edges[0]!.target = 'bad';
    childGraph.edges.push({ id: 'return', source: 'bad', target: 'end', port: 'next' });
    const child = version(childBundle),
      source = plain();
    call(source, child);
    source.graphs.push({ ...structuredClone(plain().graphs[0]!), id: 'outside' });
    expect(() => compileWorkflow(source, () => child)).toThrow('bundle scope');
  });
  it('rejects oversized closure and unsafe accessor input before it can run a getter', () => {
    const source = plain();
    for (let i = 1; i <= 256; i++)
      source.graphs.push({ ...structuredClone(source.graphs[0]!), id: 'graph_' + i });
    expect(() => compileWorkflow(source)).toThrow('256');
    let reads = 0;
    const unsafe = plain();
    Object.defineProperty(unsafe, 'inputs', {
      get: () => {
        reads++;
        return [];
      },
    });
    expect(() => compileWorkflow(unsafe)).toThrow('Unsafe');
    expect(reads).toBe(0);
  });
});
