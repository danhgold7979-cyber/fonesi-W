import { z } from 'zod';
import {
  idSchema,
  processSchema,
  appDefinitionSchema,
  assertJsonSafe,
  validateTypedValues,
  jobStateSchema,
  localDateSchema,
  timezoneSchema,
} from '@autoreels/contracts';
import type { ContentItem } from '@autoreels/contracts';
import { StudioDatabase } from '@autoreels/database';
import { DomainError } from '@autoreels/domain';
import { validateBundle, traceWorkflow } from '@autoreels/workflow-engine';
import { localSlotToUtc } from '@autoreels/scheduler';

const id = z.strictObject({ id: idSchema });
const revision = z.number().int().nonnegative();
export const mediaSchemas = {
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
const schemas = {
  ...mediaSchemas,
  contentAssets: z.strictObject({ processId: idSchema }),
  ignoreContent: id.extend({ expectedRevision: revision }),
  previewSchedule: z.strictObject({
    processId: idSchema,
    contentIds: z.array(idSchema).min(1).max(1000),
  }),
  applySchedule: z.strictObject({ token: idSchema }),
  jobs: z.strictObject({
    query: z.strictObject({
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
  validateWorkflow: z.strictObject({ bundle: z.unknown() }),
  traceWorkflow: z.strictObject({ bundle: z.unknown(), row: z.record(z.string(), z.unknown()) }),
  savePreference: z.strictObject({ value: z.unknown(), expectedRevision: revision }),
  listProcesses: z.strictObject({}),
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
    case 'mediaCapabilities':
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
      const p = schemas.createVersion.parse(input),
        draft = db.getDraft(p.id),
        issues = validateBundle(draft.bundle);
      if (issues.length) throw new DomainError('INVALID_WORKFLOW', issues[0]!.message);
      return db.createVersion(p.id, p.expectedRevision);
    }
    case 'versions':
      return db.listVersions(id.parse(input).id);
    case 'importWorkflow':
      return db.importWorkflow(schemas.importWorkflow.parse(input).bundle);
    case 'validateWorkflow':
      return validateBundle(schemas.validateWorkflow.parse(input).bundle);
    case 'traceWorkflow': {
      const p = schemas.traceWorkflow.parse(input),
        issues = validateBundle(p.bundle);
      if (issues.length) return { mode: 'TRACE', status: 'ERROR', events: [], outputs: {}, issues };
      const bundle = dbSafeBundle(p.bundle);
      return traceWorkflow(bundle, {
        row: p.row as Record<string, import('@autoreels/contracts').JsonValue>,
      });
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
      return db.listProcesses();
    case 'saveProcess': {
      const p = schemas.saveProcess.parse(input);
      return db.saveProcess(p.process, p.expectedRevision);
    }
    case 'content':
      return db.listContent(schemas.content.parse(input).processId);
    case 'saveContent': {
      const p = schemas.saveContent.parse(input),
        process = db.getProcess(p.item.processId);
      const bundle = process.workflowVersionId
        ? db.getVersion(process.workflowVersionId).bundle
        : process.workflowId
          ? db.getDraft(process.workflowId).bundle
          : null;
      if (bundle) {
        const errors = validateTypedValues(
          bundle.inputs,
          p.item.fields as Record<string, import('@autoreels/contracts').JsonValue>,
          'row',
        );
        if (errors.length)
          throw new DomainError('INVALID_CONTENT', errors[0]!.path + ': ' + errors[0]!.message);
      }
      const allowedAssets = new Set(db.listContentAssets(p.item.processId).map((a) => a.id));
      const fieldAssets: string[] = [];
      for (const field of bundle?.inputs ?? []) {
        const value = p.item.fields[field.key];
        if (field.scope !== 'row') continue;
        if (field.type === 'file' && value && typeof value === 'object' && !Array.isArray(value))
          fieldAssets.push(String((value as { assetId: string }).assetId));
        if (field.type === 'file[]' && Array.isArray(value))
          for (const ref of value) fieldAssets.push(String((ref as { assetId: string }).assetId));
      }
      if (
        p.item.assetIds.some((id) => !allowedAssets.has(id)) ||
        fieldAssets.some((id) => !allowedAssets.has(id) || !p.item.assetIds.includes(id))
      )
        throw new DomainError(
          'INVALID_ASSET_SCOPE',
          'Chỉ chọn media đã đăng ký trong tiến trình này.',
        );
      return db.saveContent(p.item as ContentItem, p.expectedRevision);
    }
  }
}
import { validateWorkflowShape } from '@autoreels/contracts';
function dbSafeBundle(value: unknown): import('@autoreels/contracts').WorkflowBundle {
  const result = validateWorkflowShape(value);
  if (!result.ok) throw new DomainError('INVALID_WORKFLOW', 'Invalid workflow');
  return result.value;
}
