import type { InspectorSnapshot, DeviceSelectorLiveReport } from './inspector.js';
import type { WorkspaceStatus, WorkspaceBackupResult } from './workspace.js';
import type { MediaAdoptionPreview, MediaAdoptionResult } from './media.js';
import type { DebugAction, DebugSnapshot } from './debug.js';
import type { ProcessCloneOptions, ProcessClonePreview, ProcessCloneResult } from './processes.js';
import type {
  DeviceSnapshot, DeviceCapture, ManualDeviceAction,
  DeviceResolutionPreview, DeviceResolutionApplyResponse, DeviceResolutionAuditPage,
} from './devices.js';
import type {
  ContentFormat,
  ContentPreviewDto,
  ContentApplyResult,
  ContentDownload,
  BulkContentRequest,
} from './content-data.js';
import type {
  SchedulePreviewDto,
  JobQuery,
  JobPage,
  JobChangeRequest,
  JobChangePreview,
  JobChangeResult,
} from './schedule.js';
import type {
  SourceState,
  SourceDefinition,
  SourceScanProgress,
  ContentAssetInfo,
} from './media.js';
import type { AppDefinition, ProcessDefinition } from './models.js';
import type { WorkflowBundle, JsonValue, ValidationIssue } from './types.js';
import type { WorkflowDraft, WorkflowVersion, ContentItem, ContentPage, ContentQuery } from './persistence.js';

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
  hardware: { connected: boolean; reason: string };
}
export interface TraceReportDto {
  mode: 'TRACE';
  status: string;
  events: { graphId: string; nodeId: string; type: string; status: string; detail: string }[];
  outputs: Record<string, JsonValue>;
  issues: ValidationIssue[];
}
export interface StudioApi {
  workspaceStatus(): Promise<WorkspaceStatus>;
  createWorkspaceBackup(backupId: string): Promise<WorkspaceBackupResult>;
  previewMediaAdoption(processId: string, assetId: string): Promise<MediaAdoptionPreview>;
  applyMediaAdoption(token: string): Promise<MediaAdoptionResult>;
  rebindSource(
    id: string,
    expectedRevision: number,
  ): Promise<{ cancelled: boolean; source: SourceDefinition | null }>;
  previewProcessClone(
    id: string,
    expectedRevision: number,
    options: ProcessCloneOptions,
  ): Promise<ProcessClonePreview>;
  applyProcessClone(token: string): Promise<ProcessCloneResult>;
  startDebug(bundle: WorkflowBundle, row: Record<string, JsonValue>): Promise<DebugSnapshot>;
  debugSnapshot(id: string): Promise<DebugSnapshot>;
  controlDebug(id: string, action: DebugAction): Promise<DebugSnapshot>;
  deviceSnapshot(): Promise<DeviceSnapshot>;
  deviceResolutionHistory(id: string, cursor?: string): Promise<DeviceResolutionAuditPage>;
  previewDeviceConflictResolution(
    id: string, expectedRevision: number,
  ): Promise<DeviceResolutionPreview>;
  applyDeviceConflictResolution(
    id: string, token: string, confirmedName: string,
  ): Promise<DeviceResolutionApplyResponse>;
  scanDevices(): Promise<DeviceSnapshot>;
  cancelDeviceScan(): Promise<void>;
  chooseAdbSdk(): Promise<{ cancelled: boolean; snapshot: DeviceSnapshot }>;
  startAdbServer(): Promise<DeviceSnapshot>;
  connectDevice(endpoint: string, reconnect?: boolean): Promise<DeviceSnapshot>;
  setDeviceReconnect(
    endpoint: string,
    expectedRevision: number,
    desired: boolean,
  ): Promise<DeviceSnapshot>;
  pairDevice(endpoint: string, code: string): Promise<DeviceSnapshot>;
  updateDevice(
    id: string,
    expectedRevision: number,
    patch: { name?: string; enabled?: boolean },
  ): Promise<DeviceSnapshot>;
  inspectDevice(id: string): Promise<InspectorSnapshot>;
  testDeviceSelector(id: string, selector: unknown): Promise<DeviceSelectorLiveReport>;
  captureDevice(id: string): Promise<DeviceCapture>;
  devicePackages(id: string): Promise<{ packages: string[]; foreground: string | null }>;
  deviceAction(id: string, action: ManualDeviceAction): Promise<{ acknowledged: true }>;
  disconnectDevice(id: string): Promise<DeviceSnapshot>;
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
  jobs(query: JobQuery): Promise<JobPage>;
  previewJobChanges(request: JobChangeRequest): Promise<JobChangePreview>;
  applyJobChanges(token: string): Promise<JobChangeResult>;
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
  listProcesses(includeArchived?: boolean): Promise<ProcessDefinition[]>;
  saveProcess(
    process: ProcessDefinition,
    expectedRevision: number | null,
  ): Promise<ProcessDefinition>;
  content(processId: string): Promise<ContentItem[]>;
  contentPage(query: ContentQuery): Promise<ContentPage>;
  saveContent(item: ContentItem, expectedRevision: number | null): Promise<ContentItem>;
}
export type ApiCommand =
  | 'workspaceStatus'
  | 'createWorkspaceBackup'
  | 'previewMediaAdoption'
  | 'applyMediaAdoption'
  | 'rebindSource'
  | 'previewProcessClone'
  | 'applyProcessClone'
  | 'resolveWorkflow'
  | 'startDebug'
  | 'debugSnapshot'
  | 'controlDebug'
  | 'deviceSnapshot'
  | 'deviceResolutionHistory'
  | 'previewDeviceConflictResolution'
  | 'applyDeviceConflictResolution'
  | 'scanDevices'
  | 'cancelDeviceScan'
  | 'chooseAdbSdk'
  | 'startAdbServer'
  | 'setDeviceReconnect'
  | 'connectDevice'
  | 'pairDevice'
  | 'updateDevice'
  | 'inspectDevice'
  | 'testDeviceSelector'
  | 'captureDevice'
  | 'devicePackages'
  | 'deviceAction'
  | 'disconnectDevice'
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
  | 'previewJobChanges'
  | 'applyJobChanges'
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
  | 'contentPage'
  | 'saveContent';
export type Transport = (command: ApiCommand, input: unknown) => Promise<unknown>;
export function createStudioApi(transport: Transport): StudioApi {
  const call = <T>(command: ApiCommand, input: unknown = {}): Promise<T> =>
    transport(command, input) as Promise<T>;
  return {
    workspaceStatus: () => call('workspaceStatus'),
    createWorkspaceBackup: (backupId) => call('createWorkspaceBackup', { backupId }),
    previewMediaAdoption: (processId, assetId) =>
      call('previewMediaAdoption', { processId, assetId }),
    applyMediaAdoption: (token) => call('applyMediaAdoption', { token }),
    rebindSource: (id, expectedRevision) => call('rebindSource', { id, expectedRevision }),
    previewProcessClone: (id, expectedRevision, options) =>
      call('previewProcessClone', { id, expectedRevision, options }),
    applyProcessClone: (token) => call('applyProcessClone', { token }),
    startDebug: (bundle, row) => call('startDebug', { bundle, row }),
    debugSnapshot: (id) => call('debugSnapshot', { id }),
    controlDebug: (id, action) => call('controlDebug', { id, action }),
    deviceSnapshot: () => call('deviceSnapshot'),
    deviceResolutionHistory: (id, cursor) =>
      call('deviceResolutionHistory', { id, ...(cursor ? { cursor } : {}) }),
    previewDeviceConflictResolution: (id, expectedRevision) =>
      call('previewDeviceConflictResolution', { id, expectedRevision }),
    applyDeviceConflictResolution: (id, token, confirmedName) =>
      call('applyDeviceConflictResolution', { id, token, confirmedName }),
    scanDevices: () => call('scanDevices'),
    cancelDeviceScan: () => call('cancelDeviceScan'),
    chooseAdbSdk: () => call('chooseAdbSdk'),
    startAdbServer: () => call('startAdbServer'),
    connectDevice: (endpoint, reconnect = true) => call('connectDevice', { endpoint, reconnect }),
    setDeviceReconnect: (endpoint, expectedRevision, desired) =>
      call('setDeviceReconnect', { endpoint, expectedRevision, desired }),
    pairDevice: (endpoint, code) => call('pairDevice', { endpoint, code }),
    updateDevice: (id, expectedRevision, patch) =>
      call('updateDevice', { id, expectedRevision, patch }),
    inspectDevice: (id) => call('inspectDevice', { id }),
    testDeviceSelector: (id, selector) => call('testDeviceSelector', { id, selector }),
    captureDevice: (id) => call('captureDevice', { id }),
    devicePackages: (id) => call('devicePackages', { id }),
    deviceAction: (id, action) => call('deviceAction', { id, action }),
    disconnectDevice: (id) => call('disconnectDevice', { id }),
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
    previewJobChanges: (request) => call('previewJobChanges', { request }),
    applyJobChanges: (token) => call('applyJobChanges', { token }),
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
    listProcesses: (includeArchived = false) => call('listProcesses', { includeArchived }),
    saveProcess: (process, expectedRevision) => call('saveProcess', { process, expectedRevision }),
    content: (processId) => call('content', { processId }),
    contentPage: (query) => call('contentPage', { query }),
    saveContent: (item, expectedRevision) => call('saveContent', { item, expectedRevision }),
  };
}
