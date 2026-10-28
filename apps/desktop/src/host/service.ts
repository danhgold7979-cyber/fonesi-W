import { z } from 'zod';
import {
  idSchema,
  processSchema,
  appDefinitionSchema,
  assertJsonSafe,
  jobStateSchema,
  localDateSchema,
  timezoneSchema,
  packageNameSchema,
  processCloneOptionsSchema,
  jobChangeRequestSchema,
} from '@autoreels/contracts';
import type { ContentItem } from '@autoreels/contracts';
import { StudioDatabase } from '@autoreels/database';
import { parseContentFile, exportContentFile } from '@autoreels/import-export';
import { contentHash } from '@autoreels/domain';
import { DomainError } from '@autoreels/domain';
import { CompilationError, traceWorkflow } from '@autoreels/workflow-engine';
import { localSlotToUtc } from '@autoreels/scheduler';
import { workspaceSchemas } from './workspace-service.js';

const id = z.strictObject({ id: idSchema });
const revision = z.number().int().nonnegative();
export const mediaSchemas = {
  previewMediaAdoption: z.strictObject({ processId: idSchema, assetId: idSchema }),
  applyMediaAdoption: z.strictObject({ token: idSchema }),
  rebindSource: z.strictObject({ id: idSchema, expectedRevision: revision }),
  mediaCapabilities: z.strictObject({}),
  chooseSource: z.strictObject({
    processId: idSchema,
    expectedRevision: revision,
    kind: z.enum(['FOLDER', 'FILE']),
    recursive: z.boolean(),
    watch: z.boolean(),
  }),
  sources: z.strictObject({ processId: idSchema }),
  scanSource: id,
  cancelSourceScan: id,
  updateSource: id.extend({
    expectedRevision: revision,
    options: z.strictObject({ recursive: z.boolean(), watch: z.boolean(), active: z.boolean() }),
  }),
} as const;
const coordinate = z.number().int().min(0).max(8191);
export const deviceSchemas = {
  deviceSnapshot: z.strictObject({}),
  previewDeviceConflictResolution: id.extend({ expectedRevision: revision }),
  applyDeviceConflictResolution: id.extend({
    token: idSchema,
    confirmedName: z.string().min(1).max(120),
  }),
  scanDevices: z.strictObject({}),
  cancelDeviceScan: z.strictObject({}),
  chooseAdbSdk: z.strictObject({}),
  startAdbServer: z.strictObject({}),
  connectDevice: z.strictObject({
    endpoint: z.string().max(256),
    reconnect: z.boolean().default(true),
  }),
  setDeviceReconnect: z.strictObject({
    endpoint: z.string().max(256),
    expectedRevision: revision,
    desired: z.boolean(),
  }),
  pairDevice: z.strictObject({ endpoint: z.string().max(256), code: z.string().regex(/^\d{6}$/) }),
  updateDevice: id.extend({
    expectedRevision: revision,
    patch: z.strictObject({
      name: z.string().trim().min(1).max(120).optional(),
      enabled: z.boolean().optional(),
    }),
  }),
  inspectDevice: id,
  captureDevice: id,
  devicePackages: id,
  disconnectDevice: id,
  deviceAction: id.extend({
    action: z.discriminatedUnion('type', [
      z.strictObject({
        type: z.literal('KEY'),
        key: z.enum(['BACK', 'HOME', 'RECENT', 'POWER', 'VOLUME_UP', 'VOLUME_DOWN']),
      }),
      z.strictObject({ type: z.literal('TAP'), captureId: idSchema, x: coordinate, y: coordinate }),
      z.strictObject({
        type: z.literal('SWIPE'),
        captureId: idSchema,
        x1: coordinate,
        y1: coordinate,
        x2: coordinate,
        y2: coordinate,
        durationMs: z.number().int().min(50).max(10000),
      }),
      z.strictObject({ type: z.enum(['LAUNCH', 'FORCE_STOP']), packageName: packageNameSchema }),
      z.strictObject({
        type: z.literal('SYSTEM'),
        target: z.enum(['SETTINGS', 'FILES', 'GALLERY', 'BROWSER', 'VPN']),
      }),
    ]),
  }),
} as const;
const formatSchema = z.enum(['JSON', 'CSV', 'XLSX']);
export const debugSchemas = {
  startDebug: z.strictObject({ bundle: z.unknown(), row: z.record(z.string(), z.json()) }),
  debugSnapshot: id,
  controlDebug: id.extend({
    action: z.enum(['CONTINUE', 'PAUSE', 'STEP_INTO', 'STEP_OVER', 'STEP_OUT', 'STOP']),
  }),
} as const;
const schemas = {
  previewProcessClone: id.extend({
    expectedRevision: revision,
    options: processCloneOptionsSchema,
  }),
  applyProcessClone: z.strictObject({ token: idSchema }),
  ...debugSchemas,
  ...deviceSchemas,
  previewContentImport: z.strictObject({
    processId: idSchema,
    expectedRevision: revision,
    format: formatSchema,
    data: z.string().max(5592408),
  }),
  previewBulkContent: z.strictObject({
    processId: idSchema,
    expectedRevision: revision,
    request: z.strictObject({
      selection: z.array(id.extend({ revision })).min(1).max(1000),
      fieldKey: z.string().max(160),
      operation: z.enum(['SET', 'APPEND', 'PREPEND', 'REMOVE']),
      value: z.json().optional(),
    }),
  }),
  applyContentPreview: z.strictObject({ token: idSchema }),
  exportContent: z.strictObject({
    processId: idSchema,
    contentIds: z.array(idSchema).min(1).max(1000),
    format: formatSchema,
  }),
  ...mediaSchemas,
  ...workspaceSchemas,
  contentAssets: z.strictObject({ processId: idSchema }),
  ignoreContent: id.extend({ expectedRevision: revision }),
  previewSchedule: z.strictObject({
    processId: idSchema,
    contentIds: z.array(idSchema).min(1).max(1000),
  }),
  applySchedule: z.strictObject({ token: idSchema }),
  previewJobChanges: z.strictObject({ request: jobChangeRequestSchema }),
  applyJobChanges: z.strictObject({ token: idSchema }),
  jobs: z.strictObject({
    query: z.strictObject({
      cursor: z.string().min(1).max(4096).optional(),
      appId: idSchema.optional(),
      processId: idSchema.optional(),
      deviceId: idSchema.optional(),
      state: jobStateSchema.optional(),
      fromUtc: z.string().datetime().optional(),
      toUtc: z.string().datetime().optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    }),
  }),
  rescheduleJob: id.extend({
    expectedRevision: revision,
    localDate: localDateSchema,
    localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timezone: timezoneSchema,
  }),
  cancelScheduledJob: id.extend({ expectedRevision: revision }),
  bootstrap: z.strictObject({}),
  registerApp: z.strictObject({ app: appDefinitionSchema }),
  createWorkflow: z.strictObject({ appId: idSchema, name: z.string().trim().min(1).max(160) }),
  loadWorkflow: id,
  cloneWorkflow: id,
  archiveWorkflow: id,
  saveWorkflow: z.strictObject({ bundle: z.unknown(), expectedRevision: revision }),
  createVersion: id.extend({ expectedRevision: revision }),
  versions: id,
  importWorkflow: z.strictObject({ bundle: z.unknown() }),
  resolveWorkflow: z.strictObject({ bundle: z.unknown() }),
  validateWorkflow: z.strictObject({ bundle: z.unknown() }),
  traceWorkflow: z.strictObject({ bundle: z.unknown(), row: z.record(z.string(), z.unknown()) }),
  savePreference: z.strictObject({ value: z.unknown(), expectedRevision: revision }),
  listProcesses: z.strictObject({ includeArchived: z.boolean().default(false) }),
  saveProcess: z.strictObject({ process: processSchema, expectedRevision: revision.nullable() }),
  content: z.strictObject({ processId: idSchema }),
  saveContent: z.strictObject({
    item: z.strictObject({
      id: idSchema,
      processId: idSchema,
      revision,
      fields: z.record(z.string(), z.unknown()),
      assetIds: z.array(idSchema),
      ignored: z.literal(false),
    }),
    expectedRevision: revision.nullable(),
  }),
} as const;
export const envelopeSchema = z.strictObject({
  operationId: idSchema,
  command: z.enum(Object.keys(schemas) as [keyof typeof schemas, ...Array<keyof typeof schemas>]),
  input: z.unknown(),
});
export async function dispatch(
  db: StudioDatabase,
  raw: unknown,
  hostId: string | null = null,
): Promise<unknown> {
  assertJsonSafe(raw);
  const request = envelopeSchema.parse(raw),
    input = schemas[request.command].parse(request.input);
  // Parse per case to retain exact static DTO types after runtime validation.
  switch (request.command) {
    case 'workspaceStatus':
    case 'createWorkspaceBackup':
      throw new DomainError(
        'HOST_REQUIRED',
        'Sao lưu và chẩn đoán cần workspace service của host.',
      );
    case 'previewProcessClone': {
      const p = schemas.previewProcessClone.parse(input);
      return db.previewProcessClone(p.id, p.expectedRevision, p.options, hostId);
    }
    case 'applyProcessClone':
      return db.applyProcessClone(schemas.applyProcessClone.parse(input).token, hostId);
    case 'startDebug':
    case 'debugSnapshot':
    case 'controlDebug':
      throw new DomainError('HOST_REQUIRED', 'Debug cần session service của host.');
    case 'deviceSnapshot':
    case 'previewDeviceConflictResolution':
    case 'applyDeviceConflictResolution':
    case 'scanDevices':
    case 'cancelDeviceScan':
    case 'chooseAdbSdk':
    case 'startAdbServer':
    case 'setDeviceReconnect':
    case 'connectDevice':
    case 'pairDevice':
    case 'updateDevice':
    case 'inspectDevice':
    case 'captureDevice':
    case 'devicePackages':
    case 'deviceAction':
    case 'disconnectDevice':
      throw new DomainError('HOST_REQUIRED', 'Thao tác thiết bị cần device service của host.');
    case 'previewContentImport': {
      const p = schemas.previewContentImport.parse(input),
        process = db.getProcess(p.processId);
      const schema = db.inputSchema(process)?.inputs.filter((field) => field.scope === 'row') ?? [];
      const document = await parseContentFile(p.format, p.data, schema);
      return db.previewContentImport(
        p.processId,
        p.expectedRevision,
        document,
        contentHash(schema),
      );
    }
    case 'previewBulkContent': {
      const p = schemas.previewBulkContent.parse(input);
      return db.previewBulkContent(p.processId, p.expectedRevision, p.request);
    }
    case 'applyContentPreview':
      return db.applyContentPreview(schemas.applyContentPreview.parse(input).token);
    case 'exportContent': {
      const p = schemas.exportContent.parse(input);
      return exportContentFile(db.exportContent(p.processId, p.contentIds), p.format);
    }
    case 'mediaCapabilities':
    case 'previewMediaAdoption':
    case 'applyMediaAdoption':
    case 'rebindSource':
    case 'chooseSource':
    case 'sources':
    case 'scanSource':
    case 'cancelSourceScan':
    case 'updateSource':
      throw new DomainError('HOST_REQUIRED', 'Thao tác nguồn cần media service của host.');
    case 'contentAssets':
      return db.listContentAssets(schemas.contentAssets.parse(input).processId);
    case 'ignoreContent': {
      const p = schemas.ignoreContent.parse(input);
      db.ignoreContent(p.id, p.expectedRevision);
      return null;
    }
    case 'previewSchedule': {
      const p = schemas.previewSchedule.parse(input);
      return db.previewSchedule(p.processId, p.contentIds, hostId);
    }
    case 'applySchedule':
      return db.applySchedule(schemas.applySchedule.parse(input).token, hostId);
    case 'jobs':
      return db.listJobs(schemas.jobs.parse(input).query);
    case 'previewJobChanges':
      return db.previewJobChanges(schemas.previewJobChanges.parse(input).request, hostId);
    case 'applyJobChanges':
      return db.applyJobChanges(schemas.applyJobChanges.parse(input).token, hostId);
    case 'rescheduleJob': {
      const p = schemas.rescheduleJob.parse(input);
      db.rescheduleJob(
        p.id,
        p.expectedRevision,
        localSlotToUtc(p.localDate, p.localTime, p.timezone),
      );
      return null;
    }
    case 'cancelScheduledJob': {
      const p = schemas.cancelScheduledJob.parse(input);
      db.cancelScheduledJob(p.id, p.expectedRevision);
      return null;
    }
    case 'bootstrap':
      return {
        apps: db.listApps(),
        workflows: db.listWorkflows(),
        processes: db.listProcesses(),
        devices: db.listDevices(),
        preferences: db.getPreference('workspace'),
        hardware: {
          connected: false,
          reason: 'Backend Android chưa được triển khai; dữ liệu thiết bị sẽ đến từ kết nối thực.',
        },
      };
    case 'registerApp':
      return db.registerApp(schemas.registerApp.parse(input).app);
    case 'createWorkflow': {
      const p = schemas.createWorkflow.parse(input);
      return db.createWorkflow(p.appId, p.name);
    }
    case 'loadWorkflow':
      return db.getDraft(id.parse(input).id);
    case 'saveWorkflow': {
      const p = schemas.saveWorkflow.parse(input);
      return db.saveDraft(p.bundle, p.expectedRevision);
    }
    case 'cloneWorkflow':
      return db.cloneWorkflow(id.parse(input).id);
    case 'archiveWorkflow':
      db.archiveWorkflow(id.parse(input).id);
      return null;
    case 'createVersion': {
      const p = schemas.createVersion.parse(input);
      try {
        return db.createVersion(p.id, p.expectedRevision);
      } catch (error) {
        if (error instanceof CompilationError)
          throw new DomainError('INVALID_WORKFLOW', error.message);
        throw error;
      }
    }
    case 'versions':
      return db.listVersions(id.parse(input).id);
    case 'importWorkflow':
      return db.importWorkflow(schemas.importWorkflow.parse(input).bundle);
    case 'resolveWorkflow': {
      try {
        return db.resolveWorkflow(schemas.resolveWorkflow.parse(input).bundle);
      } catch (error) {
        if (error instanceof CompilationError)
          throw new DomainError('INVALID_WORKFLOW', error.message);
        throw error;
      }
    }
    case 'validateWorkflow': {
      try {
        db.resolveWorkflow(schemas.validateWorkflow.parse(input).bundle);
        return [];
      } catch (error) {
        if (error instanceof CompilationError) return error.issues;
        throw error;
      }
    }
    case 'traceWorkflow': {
      const p = schemas.traceWorkflow.parse(input);
      try {
        const bundle = db.resolveWorkflow(p.bundle);
        return traceWorkflow(bundle, {
          row: p.row as Record<string, import('@autoreels/contracts').JsonValue>,
        });
      } catch (error) {
        if (error instanceof CompilationError)
          return { mode: 'TRACE', status: 'ERROR', events: [], outputs: {}, issues: error.issues };
        throw error;
      }
    }
    case 'savePreference': {
      const p = schemas.savePreference.parse(input);
      return db.savePreference(
        'workspace',
        p.value as import('@autoreels/contracts').JsonValue,
        p.expectedRevision,
      );
    }
    case 'listProcesses':
      return db.listProcesses(schemas.listProcesses.parse(input).includeArchived);
    case 'saveProcess': {
      const p = schemas.saveProcess.parse(input);
      return db.saveProcess(p.process, p.expectedRevision);
    }
    case 'content':
      return db.listContent(schemas.content.parse(input).processId);
    case 'saveContent': {
      const p = schemas.saveContent.parse(input);
      return db.saveContentValidated(p.item as ContentItem, p.expectedRevision);
    }
  }
}
