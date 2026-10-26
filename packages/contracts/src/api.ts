import type {
  ContentFormat,
  ContentPreviewDto,
  ContentApplyResult,
  ContentDownload,
  BulkContentRequest,
} from './content-data.js';
import type { SchedulePreviewDto, JobQuery, ScheduledJobSummary } from './schedule.js';
import type {
  SourceState,
  SourceDefinition,
  SourceScanProgress,
  ContentAssetInfo,
} from './media.js';
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
  previewContentImport(
    processId: string,
    expectedRevision: number,
    format: ContentFormat,
    data: string,
  ): Promise<ContentPreviewDto>;
  previewBulkContent(
    processId: string,
    expectedRevision: number,
    request: BulkContentRequest,
  ): Promise<ContentPreviewDto>;
  applyContentPreview(token: string): Promise<ContentApplyResult>;
  exportContent(
    processId: string,
    contentIds: string[],
    format: ContentFormat,
  ): Promise<ContentDownload>;
  mediaCapabilities(): Promise<{ nativeChooser: boolean }>;
  chooseSource(
    processId: string,
    expectedRevision: number,
    kind: 'FOLDER' | 'FILE',
    recursive: boolean,
    watch: boolean,
  ): Promise<{ cancelled: boolean; sources: SourceDefinition[] }>;
  sources(processId: string): Promise<SourceState[]>;
  scanSource(id: string): Promise<SourceScanProgress>;
  cancelSourceScan(id: string): Promise<void>;
  updateSource(
    id: string,
    expectedRevision: number,
    options: { recursive: boolean; watch: boolean; active: boolean },
  ): Promise<SourceDefinition>;
  contentAssets(processId: string): Promise<ContentAssetInfo[]>;
  ignoreContent(id: string, expectedRevision: number): Promise<void>;
  previewSchedule(processId: string, contentIds: string[]): Promise<SchedulePreviewDto>;
  applySchedule(token: string): Promise<{ jobIds: string[]; alreadyApplied: boolean }>;
  jobs(query: JobQuery): Promise<{ jobs: ScheduledJobSummary[]; hasMore: boolean }>;
  rescheduleJob(
    id: string,
    expectedRevision: number,
    localDate: string,
    localTime: string,
    timezone: string,
  ): Promise<void>;
  cancelScheduledJob(id: string, expectedRevision: number): Promise<void>;
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
  | 'previewContentImport'
  | 'previewBulkContent'
  | 'applyContentPreview'
  | 'exportContent'
  | 'mediaCapabilities'
  | 'chooseSource'
  | 'sources'
  | 'scanSource'
  | 'cancelSourceScan'
  | 'updateSource'
  | 'contentAssets'
  | 'ignoreContent'
  | 'applySchedule'
  | 'jobs'
  | 'rescheduleJob'
  | 'cancelScheduledJob'
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
    previewContentImport: (processId, expectedRevision, format, data) =>
      call('previewContentImport', { processId, expectedRevision, format, data }),
    previewBulkContent: (processId, expectedRevision, request) =>
      call('previewBulkContent', { processId, expectedRevision, request }),
    applyContentPreview: (token) => call('applyContentPreview', { token }),
    exportContent: (processId, contentIds, format) =>
      call('exportContent', { processId, contentIds, format }),
    mediaCapabilities: () => call('mediaCapabilities'),
    chooseSource: (processId, expectedRevision, kind, recursive, watch) =>
      call('chooseSource', { processId, expectedRevision, kind, recursive, watch }),
    sources: (processId) => call('sources', { processId }),
    scanSource: (id) => call('scanSource', { id }),
    cancelSourceScan: (id) => call('cancelSourceScan', { id }),
    updateSource: (id, expectedRevision, options) =>
      call('updateSource', { id, expectedRevision, options }),
    contentAssets: (processId) => call('contentAssets', { processId }),
    ignoreContent: (id, expectedRevision) => call('ignoreContent', { id, expectedRevision }),
    previewSchedule: (processId, contentIds) => call('previewSchedule', { processId, contentIds }),
    applySchedule: (token) => call('applySchedule', { token }),
    jobs: (query) => call('jobs', { query }),
    rescheduleJob: (id, expectedRevision, localDate, localTime, timezone) =>
      call('rescheduleJob', { id, expectedRevision, localDate, localTime, timezone }),
    cancelScheduledJob: (id, expectedRevision) =>
      call('cancelScheduledJob', { id, expectedRevision }),
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
