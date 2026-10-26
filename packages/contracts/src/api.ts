import type { AppDefinition, ProcessDefinition } from './models.js';
import type { WorkflowBundle, JsonValue, ValidationIssue } from './types.js';
import type { WorkflowDraft, WorkflowVersion, ContentItem } from './persistence.js';

export interface WorkflowSummary {
  id: string;
  appId: string;
  name: string;
  kind: string;
  archived: boolean;
  revision: number;
}
export interface BootstrapData {
  apps: AppDefinition[];
  workflows: WorkflowSummary[];
  processes: ProcessDefinition[];
  devices: { id: string; name: string; enabled: boolean }[];
  preferences: { revision: number; value: JsonValue } | null;
  hardware: { connected: false; reason: string };
}
export interface TraceReportDto {
  mode: 'TRACE';
  status: string;
  events: { graphId: string; nodeId: string; type: string; status: string; detail: string }[];
  outputs: Record<string, JsonValue>;
  issues: ValidationIssue[];
}
export interface StudioApi {
  previewSchedule(
    processId: string,
    contentIds: string[],
  ): Promise<{
    token: string;
    expiresAt: string;
    slots: {
      contentId: string;
      scheduledUtc: string;
      jitterMinutes: number;
      crossesLocalDay: boolean;
    }[];
    warnings: string[];
  }>;
  bootstrap(): Promise<BootstrapData>;
  registerApp(input: AppDefinition): Promise<AppDefinition>;
  createWorkflow(appId: string, name: string): Promise<WorkflowDraft>;
  loadWorkflow(id: string): Promise<WorkflowDraft>;
  saveWorkflow(bundle: WorkflowBundle, expectedRevision: number): Promise<WorkflowDraft>;
  cloneWorkflow(id: string): Promise<WorkflowDraft>;
  archiveWorkflow(id: string): Promise<void>;
  createVersion(id: string, expectedRevision: number): Promise<WorkflowVersion>;
  versions(id: string): Promise<WorkflowVersion[]>;
  importWorkflow(bundle: unknown): Promise<WorkflowDraft>;
  validateWorkflow(bundle: WorkflowBundle): Promise<ValidationIssue[]>;
  traceWorkflow(bundle: WorkflowBundle, row: Record<string, JsonValue>): Promise<TraceReportDto>;
  savePreference(
    value: JsonValue,
    expectedRevision: number,
  ): Promise<{ revision: number; value: JsonValue }>;
  listProcesses(): Promise<ProcessDefinition[]>;
  saveProcess(
    process: ProcessDefinition,
    expectedRevision: number | null,
  ): Promise<ProcessDefinition>;
  content(processId: string): Promise<ContentItem[]>;
  saveContent(item: ContentItem, expectedRevision: number | null): Promise<ContentItem>;
}
export type ApiCommand =
  | 'previewSchedule'
  | 'bootstrap'
  | 'registerApp'
  | 'createWorkflow'
  | 'loadWorkflow'
  | 'saveWorkflow'
  | 'cloneWorkflow'
  | 'archiveWorkflow'
  | 'createVersion'
  | 'versions'
  | 'importWorkflow'
  | 'validateWorkflow'
  | 'traceWorkflow'
  | 'savePreference'
  | 'listProcesses'
  | 'saveProcess'
  | 'content'
  | 'saveContent';
export type Transport = (command: ApiCommand, input: unknown) => Promise<unknown>;
export function createStudioApi(transport: Transport): StudioApi {
  const call = <T>(command: ApiCommand, input: unknown = {}): Promise<T> =>
    transport(command, input) as Promise<T>;
  return {
    previewSchedule: (processId, contentIds) => call('previewSchedule', { processId, contentIds }),
    bootstrap: () => call('bootstrap'),
    registerApp: (input) => call('registerApp', { app: input }),
    createWorkflow: (appId, name) => call('createWorkflow', { appId, name }),
    loadWorkflow: (id) => call('loadWorkflow', { id }),
    saveWorkflow: (bundle, expectedRevision) => call('saveWorkflow', { bundle, expectedRevision }),
    cloneWorkflow: (id) => call('cloneWorkflow', { id }),
    archiveWorkflow: (id) => call('archiveWorkflow', { id }),
    createVersion: (id, expectedRevision) => call('createVersion', { id, expectedRevision }),
    versions: (id) => call('versions', { id }),
    importWorkflow: (bundle) => call('importWorkflow', { bundle }),
    validateWorkflow: (bundle) => call('validateWorkflow', { bundle }),
    traceWorkflow: (bundle, row) => call('traceWorkflow', { bundle, row }),
    savePreference: (value, expectedRevision) =>
      call('savePreference', { value, expectedRevision }),
    listProcesses: () => call('listProcesses'),
    saveProcess: (process, expectedRevision) => call('saveProcess', { process, expectedRevision }),
    content: (processId) => call('content', { processId }),
    saveContent: (item, expectedRevision) => call('saveContent', { item, expectedRevision }),
  };
}
