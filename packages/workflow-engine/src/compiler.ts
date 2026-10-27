import { createHash } from 'node:crypto';
import { assertJsonSafe, validateWorkflowShape } from '@autoreels/contracts';
import type {
  WorkflowBundle,
  WorkflowGraph,
  WorkflowNode,
  WorkflowVersion,
  Port,
  ValidationIssue,
} from '@autoreels/contracts';
import { bundleHash, contentHash } from '@autoreels/domain';
import { validateBundle } from './index.js';

export class CompilationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(issues[0]?.message ?? 'Workflow compilation failed');
    this.name = 'CompilationError';
  }
}
function fail(code: string, message: string): never {
  throw new CompilationError([{ code, message, path: 'dependencies' }]);
}
export type VersionResolver = (versionId: string) => WorkflowVersion;
type Pin = { id: string; versionId: string; hash: string };

/** Resolve only immutable versions whose exact pin and canonical bytes agree. */
export function resolveWorkflowClosure(
  input: WorkflowBundle,
  resolveVersion?: VersionResolver,
): WorkflowBundle {
  const initial = validateWorkflowShape(input);
  if (!initial.ok) throw new CompilationError(initial.issues);
  const root = structuredClone(initial.value);
  const graphs: WorkflowGraph[] = [],
    pins = new Map<string, Pin>();
  const imported = new Map<string, Map<string, string>>(),
    visiting = new Set<string>();
  let versionBytes = JSON.stringify(root).length;
  function declare(bundle: WorkflowBundle): void {
    const seen = new Set<string>();
    for (const declaration of bundle.dependencies) {
      if (seen.has(declaration.id))
        fail('DUPLICATE_DEPENDENCY', 'Duplicate dependency declaration');
      seen.add(declaration.id);
      if (!declaration.versionId || !declaration.hash)
        fail('UNPINNED_DEPENDENCY', 'Dependency requires version/hash: ' + declaration.id);
      const pin: Pin = {
        id: declaration.id,
        versionId: declaration.versionId,
        hash: declaration.hash,
      };
      const old = pins.get(pin.id);
      if (old && (old.versionId !== pin.versionId || old.hash !== pin.hash))
        fail('DEPENDENCY_CONFLICT', 'Different pins for dependency: ' + pin.id);
      pins.set(pin.id, pin);
      if (pins.size > 64)
        fail('DEPENDENCY_BUDGET', 'Dependency closure exceeds 64 immutable versions');
    }
  }
  function expand(bundle: WorkflowBundle, prefix: string, depth: number): Map<string, string> {
    if (depth > 32) fail('DEPENDENCY_DEPTH', 'Dependency depth exceeds 32');
    declare(bundle);
    const names = new Map(bundle.graphs.map((g) => [g.id, prefix + g.id]));
    if (names.size !== bundle.graphs.length) fail('DUPLICATE_GRAPH', 'Duplicate graph ID');
    for (const original of bundle.graphs) {
      const graph = structuredClone(original);
      graph.id = names.get(original.id)!;
      if (prefix && original.id === bundle.mainGraphId) {
        graph.inputs = structuredClone(bundle.inputs);
        graph.outputs = structuredClone(bundle.outputs);
      }
      if (graphs.some((g) => g.id === graph.id))
        fail('GRAPH_NAMESPACE_CONFLICT', 'Imported graph namespace collision');
      graphs.push(graph);
      if (graphs.length > 256) fail('GRAPH_BUDGET', 'Resolved workflow exceeds 256 graphs');
      for (const node of graph.nodes) {
        if (
          node.type === 'loop' &&
          typeof node.config.bodyGraphRef === 'string' &&
          node.config.bodyGraphRef
        ) {
          if (!names.has(node.config.bodyGraphRef))
            fail('UNRESOLVED_GRAPH', 'Loop body is outside its bundle scope');
          node.config.bodyGraphRef = names.get(node.config.bodyGraphRef)!;
        }
        if (node.type !== 'subflow') continue;
        const raw = node.config.workflowVersionRef;
        if (!raw) {
          if (typeof node.config.graphRef === 'string' && node.config.graphRef) {
            if (!names.has(node.config.graphRef))
              fail('UNRESOLVED_GRAPH', 'Subflow reference is outside its bundle scope');
            node.config.graphRef = names.get(node.config.graphRef)!;
          }
          continue;
        }
        if (
          typeof raw !== 'object' ||
          Array.isArray(raw) ||
          typeof raw.id !== 'string' ||
          typeof raw.versionId !== 'string' ||
          typeof raw.hash !== 'string'
        )
          fail('UNPINNED_DEPENDENCY', 'External call requires id/versionId/hash');
        const pin = raw as Pin;
        const declared = bundle.dependencies.find((p) => p.id === pin.id);
        if (!declared || declared.versionId !== pin.versionId || declared.hash !== pin.hash)
          fail('UNDECLARED_DEPENDENCY', 'External call does not match its dependency declaration');
        if (!resolveVersion)
          fail('DEPENDENCY_RESOLVER_REQUIRED', 'Immutable version resolver is required');
        if (visiting.has(pin.versionId))
          fail('RECURSIVE_DEPENDENCY', 'Recursive immutable dependency');
        let version: WorkflowVersion;
        try {
          version = resolveVersion(pin.versionId);
        } catch {
          fail('DEPENDENCY_NOT_FOUND', 'Pinned version is unavailable: ' + pin.versionId);
        }
        const childShape = validateWorkflowShape(version.bundle);
        if (!childShape.ok) throw new CompilationError(childShape.issues);
        if (
          version.id !== pin.versionId ||
          version.workflowId !== pin.id ||
          version.bundle.workflow.id !== pin.id ||
          version.hash !== pin.hash ||
          bundleHash(version.bundle) !== pin.hash
        )
          fail('DEPENDENCY_HASH_MISMATCH', 'Pinned version identity/hash does not match its bytes');
        if (version.bundle.workflow.appId !== root.workflow.appId)
          fail('DEPENDENCY_APP_MISMATCH', 'External subflow belongs to a different app');
        let childNames = imported.get(pin.versionId);
        if (!childNames) {
          versionBytes += JSON.stringify(version.bundle).length;
          if (versionBytes > 16777216)
            fail('DEPENDENCY_BUDGET', 'Dependency source bytes exceed 16 MiB');
          visiting.add(pin.versionId);
          const namespace =
            'dep_' + createHash('sha256').update(pin.versionId).digest('hex').slice(0, 24) + '_';
          childNames = expand(version.bundle, namespace, depth + 1);
          visiting.delete(pin.versionId);
          imported.set(pin.versionId, childNames);
        }
        const requested =
          typeof node.config.graphRef === 'string' && node.config.graphRef
            ? node.config.graphRef
            : version.bundle.mainGraphId;
        const target = childNames.get(requested);
        if (!target)
          fail('UNRESOLVED_GRAPH', 'Pinned version does not contain the requested graph');
        node.config.graphRef = target;
        delete node.config.workflowVersionRef;
      }
    }
    return names;
  }
  expand(root, '', 0);
  root.graphs = graphs;
  root.dependencies = [...pins.values()];
  try {
    assertJsonSafe(root);
  } catch {
    fail('DEPENDENCY_BUDGET', 'Resolved workflow exceeds JSON resource budgets');
  }
  const issues = validateBundle(root);
  if (issues.length) throw new CompilationError(issues);
  return root;
}

export interface CompiledInstruction {
  graphId: string;
  nodeId: string;
  node: WorkflowNode;
  routes: Partial<Record<Port, string>>;
  defaultError: 'STOP_FOR_REVIEW';
}
export interface CompiledWorkflow {
  format: 'autoreels-ir';
  version: 1;
  sourceHash: string;
  closureHash: string;
  bundle: WorkflowBundle;
  graphs: { id: string; entryId: string; instructions: CompiledInstruction[] }[];
}
function freeze(value: unknown): void {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
}
export function compileWorkflow(
  bundle: WorkflowBundle,
  resolver?: VersionResolver,
): CompiledWorkflow {
  const shape = validateWorkflowShape(bundle);
  if (!shape.ok) throw new CompilationError(shape.issues);
  const source = structuredClone(shape.value),
    sourceHash = bundleHash(source);
  const resolved = resolveWorkflowClosure(source, resolver);
  const compiled: CompiledWorkflow = {
    format: 'autoreels-ir',
    version: 1,
    sourceHash,
    closureHash: contentHash(resolved),
    bundle: resolved,
    graphs: resolved.graphs.map((graph) => ({
      id: graph.id,
      entryId: graph.nodes.find((n) => n.type === 'start')!.id,
      instructions: graph.nodes.map((node) => ({
        graphId: graph.id,
        nodeId: node.id,
        node,
        routes: Object.fromEntries(
          graph.edges.filter((e) => e.source === node.id).map((e) => [e.port, e.target]),
        ),
        defaultError: 'STOP_FOR_REVIEW' as const,
      })),
    })),
  };
  freeze(compiled);
  return compiled;
}
