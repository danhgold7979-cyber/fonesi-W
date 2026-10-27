import type { StudioApi, ApiCommand } from '@autoreels/contracts';
const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');
const send = <T,>(command: ApiCommand, input: unknown = {}): Promise<T> =>
  ipcRenderer.invoke('studio:request', { command, input }) as Promise<T>;
const api: StudioApi = {
  previewProcessClone: (id, expectedRevision, options) =>
    send('previewProcessClone', { id, expectedRevision, options }),
  applyProcessClone: (token) => send('applyProcessClone', { token }),
  startDebug: (bundle, row) => send('startDebug', { bundle, row }),
  debugSnapshot: (id) => send('debugSnapshot', { id }),
  controlDebug: (id, action) => send('controlDebug', { id, action }),
  deviceSnapshot: () => send('deviceSnapshot'),
  scanDevices: () => send('scanDevices'),
  cancelDeviceScan: () => send('cancelDeviceScan'),
  chooseAdbSdk: () => send('chooseAdbSdk'),
  startAdbServer: () => send('startAdbServer'),
  connectDevice: (endpoint, reconnect = true) => send('connectDevice', { endpoint, reconnect }),
  setDeviceReconnect: (endpoint, expectedRevision, desired) =>
    send('setDeviceReconnect', { endpoint, expectedRevision, desired }),
  pairDevice: (endpoint, code) => send('pairDevice', { endpoint, code }),
  updateDevice: (id, expectedRevision, patch) =>
    send('updateDevice', { id, expectedRevision, patch }),
  inspectDevice: (id) => send('inspectDevice', { id }),
  captureDevice: (id) => send('captureDevice', { id }),
  devicePackages: (id) => send('devicePackages', { id }),
  deviceAction: (id, action) => send('deviceAction', { id, action }),
  disconnectDevice: (id) => send('disconnectDevice', { id }),
  previewContentImport: (processId, expectedRevision, format, data) =>
    send('previewContentImport', { processId, expectedRevision, format, data }),
  previewBulkContent: (processId, expectedRevision, request) =>
    send('previewBulkContent', { processId, expectedRevision, request }),
  applyContentPreview: (token) => send('applyContentPreview', { token }),
  exportContent: (processId, contentIds, format) =>
    send('exportContent', { processId, contentIds, format }),
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
  listProcesses: (includeArchived = false) => send('listProcesses', { includeArchived }),
  saveProcess: (process, expectedRevision) => send('saveProcess', { process, expectedRevision }),
  content: (processId) => send('content', { processId }),
  saveContent: (item, expectedRevision) => send('saveContent', { item, expectedRevision }),
};
contextBridge.exposeInMainWorld('studioApi', api);
