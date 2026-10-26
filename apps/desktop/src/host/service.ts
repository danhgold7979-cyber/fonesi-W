import { z } from 'zod';
import {
  idSchema,
  processSchema,
  appDefinitionSchema,
  assertJsonSafe,
  validateTypedValues,
} from '@autoreels/contracts';
import type { ContentItem } from '@autoreels/contracts';
import { StudioDatabase } from '@autoreels/database';
import { DomainError } from '@autoreels/domain';
import { validateBundle, traceWorkflow } from '@autoreels/workflow-engine';

const id = z.strictObject({ id: idSchema });
const revision = z.number().int().nonnegative();
const schemas = {
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
      ignored: z.boolean(),
    }),
    expectedRevision: revision.nullable(),
  }),
} as const;
export const envelopeSchema = z.strictObject({
  operationId: idSchema,
  command: z.enum(Object.keys(schemas) as [keyof typeof schemas, ...Array<keyof typeof schemas>]),
  input: z.unknown(),
});
export async function dispatch(db: StudioDatabase, raw: unknown): Promise<unknown> {
  assertJsonSafe(raw);
  const request = envelopeSchema.parse(raw),
    input = schemas[request.command].parse(request.input);
  // Parse per case to retain exact static DTO types after runtime validation.
  switch (request.command) {
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
