import type { StudioApi, ApiCommand } from '@autoreels/contracts';
const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');
const send = <T,>(command: ApiCommand, input: unknown = {}): Promise<T> =>
  ipcRenderer.invoke('studio:request', { command, input }) as Promise<T>;
const api: StudioApi = {
  mediaCapabilities: () => send('mediaCapabilities'),
  chooseSource: (processId, expectedRevision, kind, recursive, watch) =>
    send('chooseSource', { processId, expectedRevision, kind, recursive, watch }),
  sources: (processId) => send('sources', { processId }),
  scanSource: (id) => send('scanSource', { id }),
  cancelSourceScan: (id) => send('cancelSourceScan', { id }),
  updateSource: (id, expectedRevision, options) =>
    send('updateSource', { id, expectedRevision, options }),
  contentAssets: (processId) => send('contentAssets', { processId }),
  ignoreContent: (id, expectedRevision) => send('ignoreContent', { id, expectedRevision }),
  previewSchedule: (processId, contentIds) => send('previewSchedule', { processId, contentIds }),
  applySchedule: (token) => send('applySchedule', { token }),
  jobs: (query) => send('jobs', { query }),
  rescheduleJob: (id, expectedRevision, localDate, localTime, timezone) =>
    send('rescheduleJob', { id, expectedRevision, localDate, localTime, timezone }),
  cancelScheduledJob: (id, expectedRevision) =>
    send('cancelScheduledJob', { id, expectedRevision }),
  bootstrap: () => send('bootstrap'),
  registerApp: (app) => send('registerApp', { app }),
  createWorkflow: (appId, name) => send('createWorkflow', { appId, name }),
  loadWorkflow: (id) => send('loadWorkflow', { id }),
  saveWorkflow: (bundle, expectedRevision) => send('saveWorkflow', { bundle, expectedRevision }),
  cloneWorkflow: (id) => send('cloneWorkflow', { id }),
  archiveWorkflow: (id) => send('archiveWorkflow', { id }),
  createVersion: (id, expectedRevision) => send('createVersion', { id, expectedRevision }),
  versions: (id) => send('versions', { id }),
  importWorkflow: (bundle) => send('importWorkflow', { bundle }),
  validateWorkflow: (bundle) => send('validateWorkflow', { bundle }),
  traceWorkflow: (bundle, row) => send('traceWorkflow', { bundle, row }),
  savePreference: (value, expectedRevision) => send('savePreference', { value, expectedRevision }),
  listProcesses: () => send('listProcesses'),
  saveProcess: (process, expectedRevision) => send('saveProcess', { process, expectedRevision }),
  content: (processId) => send('content', { processId }),
  saveContent: (item, expectedRevision) => send('saveContent', { item, expectedRevision }),
};
contextBridge.exposeInMainWorld('studioApi', api);
