import type { NodeType } from './generated/node-registry.js';

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type Port = 'next' | 'true' | 'false' | 'error' | 'body' | 'done' | 'review';
export type FieldType =
  'text' | 'number' | 'boolean' | 'url' | 'identity' | 'datetime' | 'file' | 'file[]' | 'list';
export interface FieldDefinition {
  key: string;
  type: FieldType;
  scope: 'row' | 'process' | 'output';
  required: boolean;
  label?: string;
  description?: string;
  itemType?: 'text' | 'number' | 'boolean' | 'url' | 'identity' | 'datetime';
}
export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
  config: Record<string, JsonValue>;
  w?: number;
  h?: number;
  timeoutMs?: number;
  delayMinMs?: number;
  delayMaxMs?: number;
  maxAttempts?: number;
  description?: string;
  breakpoint?: boolean;
}
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  port: Port;
  reroute?: { x: number; y: number };
}
export interface WorkflowGroup {
  id: string;
  name: string;
  nodeIds: string[];
  collapsed?: boolean;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}
export interface WorkflowGraph {
  id: string;
  name?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  groups?: WorkflowGroup[];
  inputs: FieldDefinition[];
  outputs: FieldDefinition[];
}
export interface WorkflowBundle {
  format: 'autoreels-workflow';
  schemaVersion: 2;
  workflow: { id: string; appId: string; name: string; kind: 'main' | 'sub' };
  mainGraphId: string;
  graphs: WorkflowGraph[];
  inputs: FieldDefinition[];
  outputs: FieldDefinition[];
  dependencies: { id: string; versionId?: string; hash?: string }[];
}
export interface ValidationIssue {
  code: string;
  message: string;
  path: string;
  graphId?: string;
  nodeId?: string;
  edgeId?: string;
}
export type ValidationResult<T> =
  { ok: true; value: T; issues: [] } | { ok: false; issues: ValidationIssue[] };
