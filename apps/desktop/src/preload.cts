import type { StudioApi, ApiCommand } from '@autoreels/contracts';
const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');
const send = <T,>(command: ApiCommand, input: unknown = {}): Promise<T> =>
  ipcRenderer.invoke('studio:request', { command, input }) as Promise<T>;
const api: StudioApi = {
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
