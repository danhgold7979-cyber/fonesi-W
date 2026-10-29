import { DatabaseSync, backup } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { dirname, resolve, basename, isAbsolute, extname } from 'node:path';
import { mkdirSync, existsSync, renameSync, rmSync } from 'node:fs';
import {
  appDefinitionSchema,
  processSchema,
  idSchema,
  hashSchema,
  jobSchema,
  SEED_APPS,
  validateWorkflowShape,
  assertJsonSafe,
  validateTypedValues,
  inputReferences,
  processCloneOptionsSchema,
  replaceAssetReferences,
  jobChangeRequestSchema,
  scheduleProfileSchema,
} from '@autoreels/contracts';
import type {
  AppDefinition,
  WorkspaceDatabaseStatus,
  WorkflowBundle,
  WorkflowDraft,
  WorkflowVersion,
  ProcessDefinition,
  ProcessCloneOptions,
  ProcessClonePreview,
  ProcessCloneResult,
  MediaAssetBinding,
  MediaAdoptionPreview,
  MediaAdoptionResult,
  MediaAdoptionPlan,
  ContentItem,
  ContentQuery,
  ContentPage,
  JobPreflightReport,
  JobStageReviewPage,
  MediaAsset,
  JobDefinition,
  JobSnapshot,
  DeviceLease,
  JsonValue,
  SourceGrant,
  SourceDefinition,
  ScannedAsset,
  ContentAssetInfo,
  JobMediaPreflightPlan,
  DeviceStageTransfer,
  DeviceStageReconciliation,
  StageReconciliationClassification,
  ReviewedStageMediaSnapshot,
  OwnedStageCleanupAssessment,
  OwnedStageCleanupReviewReceipt,
  SchedulePreviewDto,
  JobChangeRequest,
  JobChangePreview,
  JobChangeResult,
  JobQuery,
  JobPage,
  ContentImportDocument,
  BulkContentRequest,
  ContentPreviewDto,
  ContentApplyResult,
  ContentExportDocument,
  ContentImportRecord,
  QueueClaimResult,
  TransportObservation,
  DeviceRecord,
  DeviceMetadata,
  DeviceEndpointPolicy,
  DeviceResolutionPreview,
  DeviceResolutionResult,
  DeviceResolutionAuditPage,
  DeviceResolutionAuditEntry,
} from '@autoreels/contracts';
import {
  DomainError,
  canonicalJson,
  contentHash,
  bundleHash,
  addApp,
  assertJobTransition,
} from '@autoreels/domain';
import { randomInt } from 'node:crypto';
import {
  createSchedulePreview,
  assertPreviewCurrent,
  spreadJobs,
  overdueAction,
  nextAvailableRecoverySlot,
  type SchedulePreview,
} from '@autoreels/scheduler';
import { validateBundle, compileWorkflow } from '@autoreels/workflow-engine';
import { deviceFingerprint, parseEndpoint, assertOwnedStageLocation } from '@autoreels/devices';
import { bulkPatch } from '@autoreels/import-export';
import { migrations, SCHEMA_VERSION } from './schema.js';
import { assessPersistedMediaOrder, type LastStageObservation } from './media-selection.js';
import { deriveFrozenUnicodeTextPlan } from './unicode-compose.js';
import { deriveFrozenComposeExpectation } from './compose-review.js';

const makeId = (prefix: string): string => prefix + '_' + randomUUID().replaceAll('-', '');
const now = (): string => new Date().toISOString();
const parse = <T>(value: unknown): T => JSON.parse(String(value)) as T;
const requireBundle = (value: unknown): WorkflowBundle => {
  const result = validateWorkflowShape(value);
  if (!result.ok)
    throw new DomainError('INVALID_WORKFLOW', result.issues[0]?.message ?? 'Invalid bundle');
  return result.value;
};

interface StoredContentPreview {
  contextHash: string;
  dto: ContentPreviewDto;
  mutations: { before: ContentItem | null; next: ContentItem }[];
}
interface FrozenScheduleContext {
  process: ProcessDefinition;
  rows: ContentItem[];
  version: WorkflowVersion | null;
  assets: ContentAssetInfo[];
  jobs: JobDefinition[];
}
interface StoredSchedule {
  preview: SchedulePreview;
  context: FrozenScheduleContext;
}
const terminalJobStates = new Set([
  'SUCCESS',
  'SUCCESS_WITH_WARNINGS',
  'FAILED',
  'CANCELLED',
  'SKIPPED',
]);
/** Owned by one serialized host/DB worker. No SQL or filesystem API is exposed to renderer. */
export class StudioDatabase {
  private db: DatabaseSync;
  readonly path: string;
  constructor(path: string) {
    this.path = path === ':memory:' ? path : resolve(path);
    if (path !== ':memory:') mkdirSync(dirname(this.path), { recursive: true });
    this.db = this.open();
    try {
      this.migrate();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  private open(): DatabaseSync {
    const db = new DatabaseSync(this.path);
    db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    return db;
  }
  private migrate(): void {
    const version = Number(this.db.prepare('PRAGMA user_version').get()?.user_version);
    if (version > SCHEMA_VERSION)
      throw new DomainError('NEWER_DATABASE', 'Database was created by a newer application');
    for (const item of migrations) {
      const checksum = contentHash(item.sql);
      if (item.version <= version) {
        if (
          this.db
            .prepare('SELECT checksum FROM schema_migrations WHERE version=?')
            .get(item.version)?.checksum !== checksum
        )
          throw new DomainError('MIGRATION_MISMATCH', 'Migration checksum mismatch');
      } else
        this.transaction(() => {
          this.db.exec(item.sql);
          this.db.prepare('INSERT INTO schema_migrations VALUES(?,?)').run(item.version, checksum);
          if (item.version === 1)
            for (const app of SEED_APPS)
              this.db.prepare('INSERT INTO apps VALUES(?,?)').run(app.id, canonicalJson(app));
          this.db.exec('PRAGMA user_version=' + item.version);
        });
    }
  }
  private transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  close(): void {
    this.db.close();
  }
  integrity(): string {
    return String(this.db.prepare('PRAGMA integrity_check').get()?.integrity_check);
  }
  workspaceStatus(): WorkspaceDatabaseStatus {
    return this.transaction(() => {
      const count = (table: 'workflows' | 'processes' | 'content_items' | 'jobs' | 'devices') =>
        Number(this.db.prepare('SELECT COUNT(*) AS n FROM ' + table).get()!.n);
      return {
        schemaVersion: Number(this.db.prepare('PRAGMA user_version').get()!.user_version),
        integrity:
          this.db.prepare('PRAGMA quick_check').get()?.quick_check === 'ok' ? 'ok' : 'error',
        counts: {
          workflows: count('workflows'),
          processes: count('processes'),
          contentItems: count('content_items'),
          jobs: count('jobs'),
          devices: count('devices'),
          pendingEffects: Number(
            this.db
              .prepare(
                "SELECT COUNT(*) AS n FROM effects WHERE state IN ('ATTEMPT_UNCERTAIN','NEEDS_REVIEW')",
              )
              .get()!.n,
          ),
        },
      };
    });
  }
  validateBackup(path: string): { schemaVersion: number } {
    let candidate: DatabaseSync | undefined;
    try {
      candidate = new DatabaseSync(path, { readOnly: true });
      const source = candidate;
      const schemaVersion = Number(candidate.prepare('PRAGMA user_version').get()?.user_version);
      if (
        schemaVersion < 1 ||
        schemaVersion > SCHEMA_VERSION ||
        !Number.isInteger(schemaVersion) ||
        candidate.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok' ||
        candidate.prepare('PRAGMA foreign_key_check').get() ||
        migrations
          .filter((m) => m.version <= schemaVersion)
          .some(
            (m) =>
              source
                .prepare('SELECT checksum FROM schema_migrations WHERE version=?')
                .get(m.version)?.checksum !== contentHash(m.sql),
          )
      )
        throw new DomainError(
          'INVALID_BACKUP',
          'Bản sao lưu không đạt integrity/schema/migration checks.',
        );
      return { schemaVersion };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('INVALID_BACKUP', 'Không đọc được cơ sở dữ liệu sao lưu hợp lệ.');
    } finally {
      candidate?.close();
    }
  }
  async backupVerified(path: string): Promise<{ schemaVersion: number }> {
    await this.backupTo(path);
    // A completed portable backup must not depend on WAL/SHM sidecars.
    const completed = new DatabaseSync(path);
    try {
      const checkpoint = completed.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
      if (
        Number(checkpoint?.busy) !== 0 ||
        completed.prepare('PRAGMA journal_mode=DELETE').get()?.journal_mode !== 'delete'
      )
        throw new DomainError('BACKUP_BUSY', 'Chưa thể đóng WAL của bản sao lưu.');
    } finally {
      completed.close();
    }
    return this.validateBackup(path);
  }

  listApps(): AppDefinition[] {
    return this.db
      .prepare('SELECT metadata FROM apps ORDER BY rowid')
      .all()
      .map((r) => appDefinitionSchema.parse(parse(r.metadata)));
  }
  registerApp(input: unknown): AppDefinition {
    return this.transaction(() => {
      const apps = addApp(this.listApps(), input),
        app = apps[apps.length - 1]!;
      this.db.prepare('INSERT INTO apps VALUES(?,?)').run(app.id, canonicalJson(app));
      return app;
    });
  }
  listWorkflows(includeArchived = false): {
    id: string;
    appId: string;
    name: string;
    kind: string;
    archived: boolean;
    revision: number;
  }[] {
    return this.db
      .prepare(
        'SELECT w.*,d.revision FROM workflows w JOIN workflow_drafts d ON d.workflow_id=w.id WHERE (?=1 OR w.archived=0) ORDER BY w.rowid DESC',
      )
      .all(Number(includeArchived))
      .map((r) => ({
        id: String(r.id),
        appId: String(r.app_id),
        name: String(r.name),
        kind: String(r.kind),
        archived: Boolean(r.archived),
        revision: Number(r.revision),
      }));
  }
  private insertBundle(bundle: WorkflowBundle): WorkflowDraft {
    const at = now();
    this.db
      .prepare('INSERT INTO workflows(id,app_id,name,kind) VALUES(?,?,?,?)')
      .run(bundle.workflow.id, bundle.workflow.appId, bundle.workflow.name, bundle.workflow.kind);
    this.db
      .prepare('INSERT INTO workflow_drafts VALUES(?,0,?,?)')
      .run(bundle.workflow.id, canonicalJson(bundle), at);
    return { workflowId: bundle.workflow.id, revision: 0, bundle, updatedAt: at };
  }
  createWorkflow(appId: string, name: string): WorkflowDraft {
    idSchema.parse(appId);
    if (!name.trim() || name.length > 160)
      throw new DomainError('INVALID_NAME', 'Workflow name is required (max 160 characters)');
    const bundle: WorkflowBundle = {
      format: 'autoreels-workflow',
      schemaVersion: 2,
      workflow: { id: makeId('wf'), appId, name: name.trim(), kind: 'main' },
      mainGraphId: 'main',
      graphs: [
        {
          id: 'main',
          nodes: [
            { id: 'start', type: 'start', name: 'Bắt đầu', x: 80, y: 140, config: {} },
            { id: 'end', type: 'end', name: 'Kết thúc', x: 480, y: 140, config: {} },
          ],
          edges: [{ id: 'start_end', source: 'start', target: 'end', port: 'next' }],
          groups: [],
          inputs: [],
          outputs: [],
        },
      ],
      inputs: [],
      outputs: [],
      dependencies: [],
    };
    return this.transaction(() => this.insertBundle(requireBundle(bundle)));
  }
  getDraft(workflowId: string): WorkflowDraft {
    const row = this.db
      .prepare('SELECT * FROM workflow_drafts WHERE workflow_id=?')
      .get(workflowId);
    if (!row) throw new DomainError('NOT_FOUND', 'Workflow not found');
    return {
      workflowId,
      revision: Number(row.revision),
      bundle: requireBundle(parse(row.bundle)),
      updatedAt: String(row.updated_at),
    };
  }
  saveDraft(input: unknown, expectedRevision: number): WorkflowDraft {
    const bundle = requireBundle(input);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
      throw new DomainError('INVALID_REVISION', 'Invalid revision');
    return this.transaction(() => {
      const current = this.getDraft(bundle.workflow.id);
      if (current.revision !== expectedRevision)
        throw new DomainError('REVISION_CONFLICT', 'Workflow changed; reload before saving');
      if (
        current.bundle.workflow.appId !== bundle.workflow.appId ||
        current.bundle.workflow.kind !== bundle.workflow.kind
      )
        throw new DomainError(
          'BINDING_CHANGE',
          'Changing workflow app/kind requires an explicit migration',
        );
      const at = now(),
        revision = expectedRevision + 1;
      this.db
        .prepare(
          'UPDATE workflow_drafts SET revision=?,bundle=?,updated_at=? WHERE workflow_id=? AND revision=?',
        )
        .run(revision, canonicalJson(bundle), at, bundle.workflow.id, expectedRevision);
      this.db
        .prepare('UPDATE workflows SET name=? WHERE id=?')
        .run(bundle.workflow.name, bundle.workflow.id);
      return {
        workflowId: bundle.workflow.id,
        revision,
        bundle: structuredClone(bundle),
        updatedAt: at,
      };
    });
  }
  cloneWorkflow(workflowId: string): WorkflowDraft {
    const bundle = structuredClone(this.getDraft(workflowId).bundle);
    bundle.workflow.id = makeId('wf');
    bundle.workflow.name += ' (bản sao)';
    return this.transaction(() => this.insertBundle(bundle));
  }
  importWorkflow(input: unknown): WorkflowDraft {
    const bundle = structuredClone(requireBundle(input));
    bundle.workflow.id = makeId('wf');
    return this.transaction(() => this.insertBundle(bundle));
  }
  archiveWorkflow(workflowId: string): void {
    if (!this.db.prepare('UPDATE workflows SET archived=1 WHERE id=?').run(workflowId).changes)
      throw new DomainError('NOT_FOUND', 'Workflow not found');
  }
  createVersion(workflowId: string, expectedRevision: number): WorkflowVersion {
    return this.transaction(() => {
      const draft = this.getDraft(workflowId);
      if (draft.revision !== expectedRevision)
        throw new DomainError('REVISION_CONFLICT', 'Draft changed before version creation');
      const resolved = this.resolveWorkflow(draft.bundle);
      const number = Number(
        this.db
          .prepare(
            'SELECT COALESCE(MAX(number),0)+1 AS n FROM workflow_versions WHERE workflow_id=?',
          )
          .get(workflowId)?.n,
      );
      const version: WorkflowVersion = {
        id: makeId('ver'),
        workflowId,
        number,
        hash: bundleHash(resolved),
        bundle: resolved,
        createdAt: now(),
      };
      this.db
        .prepare('INSERT INTO workflow_versions VALUES(?,?,?,?,?,?)')
        .run(
          version.id,
          workflowId,
          number,
          version.hash,
          canonicalJson(version.bundle),
          version.createdAt,
        );
      return version;
    });
  }
  listVersions(workflowId: string): WorkflowVersion[] {
    return this.db
      .prepare('SELECT * FROM workflow_versions WHERE workflow_id=? ORDER BY number DESC')
      .all(workflowId)
      .map((r) => ({
        id: String(r.id),
        workflowId,
        number: Number(r.number),
        hash: String(r.hash),
        bundle: requireBundle(parse(r.bundle)),
        createdAt: String(r.created_at),
      }));
  }
  getVersion(versionId: string): WorkflowVersion {
    const r = this.db.prepare('SELECT * FROM workflow_versions WHERE id=?').get(versionId);
    if (!r) throw new DomainError('NOT_FOUND', 'Version not found');
    return {
      id: versionId,
      workflowId: String(r.workflow_id),
      number: Number(r.number),
      hash: String(r.hash),
      bundle: requireBundle(parse(r.bundle)),
      createdAt: String(r.created_at),
    };
  }
  resolveWorkflow(input: unknown): WorkflowBundle {
    const bundle = requireBundle(input);
    return structuredClone(compileWorkflow(bundle, (id) => this.getVersion(id)).bundle);
  }

  listProcesses(includeArchived = false): ProcessDefinition[] {
    return this.db
      .prepare('SELECT definition FROM processes WHERE (?=1 OR archived=0) ORDER BY rowid DESC')
      .all(Number(includeArchived))
      .map((r) => processSchema.parse(parse(r.definition)));
  }
  getProcess(id: string): ProcessDefinition {
    const row = this.db.prepare('SELECT definition FROM processes WHERE id=?').get(id);
    if (!row) throw new DomainError('NOT_FOUND', 'Process not found');
    return processSchema.parse(parse(row.definition));
  }
  saveProcess(input: unknown, expectedRevision: number | null): ProcessDefinition {
    assertJsonSafe(input);
    const process = processSchema.parse(input);
    return this.transaction(() => {
      const existing = this.db.prepare('SELECT revision FROM processes WHERE id=?').get(process.id);
      if (
        (existing && Number(existing.revision) !== expectedRevision) ||
        (!existing && expectedRevision !== null)
      )
        throw new DomainError('REVISION_CONFLICT', 'Process changed');
      if (existing && expectedRevision === null)
        throw new DomainError('REVISION_CONFLICT', 'Process already exists');
      if (
        process.workflowId &&
        this.getDraft(process.workflowId).bundle.workflow.appId !== process.appId
      )
        throw new DomainError('APP_MISMATCH', 'Workflow and Process apps differ');
      if (process.workflowVersionId) {
        const version = this.getVersion(process.workflowVersionId);
        if (
          version.workflowId !== process.workflowId ||
          version.bundle.workflow.appId !== process.appId
        )
          throw new DomainError('VERSION_MISMATCH', 'Version and Process workflow differ');
      }
      for (const identityId of [process.accountId, process.targetId])
        if (identityId) {
          const identity = this.db
            .prepare('SELECT app_id,device_id FROM identities WHERE id=?')
            .get(identityId);
          if (
            !identity ||
            identity.app_id !== process.appId ||
            identity.device_id !== process.deviceId
          )
            throw new DomainError(
              'IDENTITY_MISMATCH',
              'Identity does not match Process app/device',
            );
        }
      this.assertInputValues(process, process.fields ?? {}, 'process', false);
      process.revision = existing ? Number(existing.revision) + 1 : 0;
      this.writeProcess(process);
      return process;
    });
  }
  private writeProcess(process: ProcessDefinition): void {
    this.db
      .prepare(
        'INSERT INTO processes VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET app_id=excluded.app_id,workflow_id=excluded.workflow_id,workflow_version_id=excluded.workflow_version_id,device_id=excluded.device_id,account_id=excluded.account_id,target_id=excluded.target_id,revision=excluded.revision,archived=excluded.archived,definition=excluded.definition',
      )
      .run(
        process.id,
        process.appId,
        process.workflowId,
        process.workflowVersionId,
        process.deviceId,
        process.accountId,
        process.targetId,
        process.revision,
        Number(process.archived),
        canonicalJson(process),
      );
  }
  private processCloneContext(id: string, options: ProcessCloneOptions) {
    const process = this.getProcess(id),
      bundle = this.inputSchema(process);
    const count = Number(
      this.db
        .prepare('SELECT COUNT(*) AS n FROM content_items WHERE process_id=? AND ignored=0')
        .get(id)!.n,
    );
    if (options.includeContent && count > 5000)
      throw new DomainError(
        'RESOURCE_BUDGET',
        'Nhân bản tối đa5000 nội dung trong một thao tác; có thể chỉ nhân bản cấu hình.',
      );
    const rows = options.includeContent ? this.listContent(id) : [];
    const sources = options.includeSources
      ? this.db
          .prepare('SELECT * FROM sources WHERE process_id=? ORDER BY id')
          .all(id)
          .map((s) => ({
            id: String(s.id),
            kind: String(s.kind),
            rootPath: String(s.root_path),
            recursive: Boolean(s.recursive),
            watch: Boolean(s.watch),
            active: Boolean(s.active),
            revision: Number(s.revision),
            hostId: String(s.host_id),
          }))
      : [];
    const entries = options.includeSources
      ? this.db
          .prepare(
            'SELECT e.* FROM source_entries e JOIN sources s ON s.id=e.source_id WHERE s.process_id=? ORDER BY e.source_id,e.relative_path',
          )
          .all(id)
          .map((e) => ({
            sourceId: String(e.source_id),
            relativePath: String(e.relative_path),
            hash: String(e.hash),
            observedHash: String(e.observed_hash),
            assetId: String(e.asset_id),
            contentId: String(e.content_id),
            state: String(e.state),
          }))
      : [];
    const ignores = options.includeSources
      ? this.db
          .prepare(
            'SELECT i.* FROM source_ignores i JOIN sources s ON s.id=i.source_id WHERE s.process_id=? ORDER BY i.source_id,i.relative_path,i.hash',
          )
          .all(id)
          .map((i) => ({
            sourceId: String(i.source_id),
            relativePath: String(i.relative_path),
            hash: String(i.hash),
          }))
      : [];
    return {
      process,
      rows,
      sources,
      entries,
      ignores,
      schema: bundle?.inputs ?? [],
      assets: options.includeContent ? this.listContentAssets(id) : [],
      workflowRevision: process.workflowVersionId
        ? this.getVersion(process.workflowVersionId).hash
        : process.workflowId
          ? this.getDraft(process.workflowId).revision
          : null,
    };
  }
  private processCloneFields(
    context: ReturnType<StudioDatabase['processCloneContext']>,
    options: ProcessCloneOptions,
  ) {
    const removed = new Map<string, ProcessClonePreview['removedFields'][number]>();
    const clean = (values: Record<string, JsonValue>, scope: 'row' | 'process') => {
      const fields = structuredClone(values);
      for (const key of Object.keys(fields)) {
        const field = context.schema.find((f) => f.scope === scope && f.key === key);
        const reason =
          /password|passwd|secret|token|credential|authorization|cookie|twofactor|2fa|otp/i.test(
            key,
          )
            ? 'Thông tin bảo mật'
            : field?.type === 'identity' ||
                (field?.type === 'list' && field.itemType === 'identity')
              ? 'Liên kết tài khoản/đích'
              : !options.includeContent && ['file', 'file[]'].includes(field?.type ?? '')
                ? 'Không sao chép nội dung/media'
                : null;
        if (reason) {
          delete fields[key];
          removed.set(scope + ':' + key, { scope, key, reason });
        }
      }
      const issues = validateTypedValues(context.schema, fields, scope).filter(
        (i) => i.code !== 'REQUIRED',
      );
      if (issues.length)
        throw new DomainError('INVALID_INPUTS', issues[0]!.path + ': ' + issues[0]!.message);
      return fields;
    };
    const fields = clean(context.process.fields ?? {}, 'process');
    const rows = context.rows.map((row) => ({ ...row, fields: clean(row.fields, 'row') }));
    return { fields, rows, removedFields: [...removed.values()] };
  }
  previewProcessClone(
    id: string,
    expectedRevision: number,
    rawOptions: ProcessCloneOptions,
    hostId: string | null = null,
    at = now(),
  ): ProcessClonePreview {
    assertJsonSafe(rawOptions);
    const options = processCloneOptionsSchema.parse(rawOptions);
    return this.transaction(() => {
      const context = this.processCloneContext(id, options);
      if (context.process.revision !== expectedRevision)
        throw new DomainError('REVISION_CONFLICT', 'Tiến trình đã đổi; xem trước lại.');
      const cleaned = this.processCloneFields(context, options),
        token = makeId('clone');
      const expiresAt = new Date(Date.parse(at) + 300000).toISOString();
      const payload = { options, contextHash: contentHash(context) };
      this.db
        .prepare('INSERT INTO process_clone_previews VALUES(?,?,?,?,?,?,NULL)')
        .run(token, id, hostId, canonicalJson(payload), contentHash(payload), expiresAt);
      return {
        token,
        expiresAt,
        sourceProcessId: id,
        name: options.name,
        contentCount: context.rows.length,
        sourceCount: context.sources.length,
        assetCount: new Set(context.rows.flatMap((r) => r.assetIds)).size,
        keepDevice: options.keepDevice,
        removedFields: cleaned.removedFields,
        warnings: [
          'Không sao chép jobs, lịch sử, tài khoản/đích hoặc thông tin đăng nhập. Khung giờ chỉ là cấu hình.',
          ...(!options.includeSources && context.rows.some((r) => r.assetIds.length)
            ? ['Media giữ ID nhưng cần gắn lại nguồn trước khi lên lịch.']
            : []),
          ...(context.sources.some((s) => s.hostId !== hostId)
            ? ['Nguồn thuộc máy khác tiếp tục yêu cầu chọn lại trên host.']
            : []),
        ],
      };
    });
  }
  applyProcessClone(token: string, hostId: string | null = null, at = now()): ProcessCloneResult {
    idSchema.parse(token);
    return this.transaction(() => {
      const record = this.db
        .prepare('SELECT * FROM process_clone_previews WHERE token=?')
        .get(token);
      if (!record) throw new DomainError('NOT_FOUND', 'Không tìm thấy bản xem trước nhân bản.');
      if (record.host_id !== hostId)
        throw new DomainError('CLONE_HOST', 'Bản xem trước thuộc host khác.');
      if (record.result !== null) {
        const result = parse<{ processId: string; contentIds: string[] }>(record.result);
        return {
          process: this.getProcess(result.processId),
          contentIds: result.contentIds,
          alreadyApplied: true,
        };
      }
      if (Date.parse(at) >= Date.parse(String(record.expires_at)))
        throw new DomainError('PREVIEW_EXPIRED', 'Bản xem trước đã hết hạn.');
      const payload = parse<{ options: ProcessCloneOptions; contextHash: string }>(record.payload);
      if (contentHash(payload) !== record.payload_hash)
        throw new DomainError('PREVIEW_TAMPERED', 'Checksum bản xem trước không khớp.');
      const options = processCloneOptionsSchema.parse(payload.options);
      const context = this.processCloneContext(String(record.process_id), options);
      if (contentHash(context) !== payload.contextHash)
        throw new DomainError(
          'PREVIEW_STALE',
          'Tiến trình, nội dung, schema hoặc nguồn đã đổi; xem trước lại.',
        );
      const cleaned = this.processCloneFields(context, options);
      const process: ProcessDefinition = {
        ...context.process,
        id: makeId('process'),
        name: options.name,
        revision: 0,
        archived: false,
        deviceId: options.keepDevice ? context.process.deviceId : null,
        accountId: null,
        targetId: null,
        fields: cleaned.fields,
      };
      this.writeProcess({ ...process, fields: {} });
      const ids = new Map(cleaned.rows.map((r) => [r.id, makeId('content')]));
      for (const row of cleaned.rows)
        this.insertContent(
          { ...row, id: ids.get(row.id)!, processId: process.id, revision: 0 },
          null,
        );
      const sourceIds = new Map(context.sources.map((s) => [s.id, makeId('source')]));
      for (const source of context.sources)
        this.db
          .prepare(
            'INSERT INTO sources(id,process_id,kind,root_path,recursive,watch,revision,active,host_id) VALUES(?,?,?,?,?,?,?,?,?)',
          )
          .run(
            sourceIds.get(source.id)!,
            process.id,
            source.kind,
            source.rootPath,
            Number(source.recursive),
            Number(source.watch),
            0,
            Number(source.active),
            source.hostId,
          );
      for (const entry of context.entries) {
        const contentId =
          ids.get(entry.contentId) ??
          ids.get(cleaned.rows.find((r) => r.assetIds.includes(entry.assetId))?.id ?? '');
        if (contentId)
          this.db
            .prepare('INSERT INTO source_entries VALUES(?,?,?,?,?,?,?,?)')
            .run(
              sourceIds.get(entry.sourceId)!,
              entry.relativePath,
              entry.hash,
              entry.observedHash,
              entry.assetId,
              contentId,
              entry.state,
              'clone_' + token,
            );
      }
      for (const ignore of context.ignores)
        this.db
          .prepare('INSERT INTO source_ignores VALUES(?,?,?)')
          .run(sourceIds.get(ignore.sourceId)!, ignore.relativePath, ignore.hash);
      this.assertInputValues(process, process.fields ?? {}, 'process', false);
      for (const row of cleaned.rows) this.assertInputValues(process, row.fields, 'row', false);
      this.writeProcess(process);
      const contentIds = [...ids.values()];
      this.db
        .prepare('UPDATE process_clone_previews SET result=? WHERE token=?')
        .run(canonicalJson({ processId: process.id, contentIds }), token);
      return { process, contentIds, alreadyApplied: false };
    });
  }
  getPreference(key: string): { revision: number; value: JsonValue } | null {
    const r = this.db.prepare('SELECT * FROM preferences WHERE key=?').get(key);
    return r ? { revision: Number(r.revision), value: parse<JsonValue>(r.value) } : null;
  }
  savePreference(
    key: string,
    value: JsonValue,
    expectedRevision: number,
  ): { revision: number; value: JsonValue } {
    idSchema.parse(key);
    assertJsonSafe(value);
    return this.transaction(() => {
      const current = this.getPreference(key);
      if ((current?.revision ?? 0) !== expectedRevision)
        throw new DomainError('REVISION_CONFLICT', 'Preference changed');
      const revision = expectedRevision + 1;
      this.db
        .prepare(
          'INSERT INTO preferences VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET revision=excluded.revision,value=excluded.value',
        )
        .run(key, revision, canonicalJson(value));
      return { revision, value: structuredClone(value) };
    });
  }

  inputSchema(process: ProcessDefinition): WorkflowBundle | null {
    return process.workflowVersionId
      ? this.getVersion(process.workflowVersionId).bundle
      : process.workflowId
        ? this.getDraft(process.workflowId).bundle
        : null;
  }
  assertInputValues(
    process: ProcessDefinition,
    values: Record<string, JsonValue>,
    scope: 'row' | 'process',
    requireAll = true,
    cached?: { bundle: WorkflowBundle | null; allowed: Set<string> },
  ): string[] {
    assertJsonSafe(values);
    const bundle = cached ? cached.bundle : this.inputSchema(process);
    if (!bundle) {
      if (Object.keys(values).length)
        throw new DomainError(
          'INPUT_SCHEMA_MISSING',
          'Chọn workflow trước khi gán trường dữ liệu.',
        );
      return [];
    }
    const issues = validateTypedValues(bundle.inputs, values, scope).filter(
      (issue) => requireAll || issue.code !== 'REQUIRED',
    );
    if (issues.length)
      throw new DomainError('INVALID_INPUTS', issues[0]!.path + ': ' + issues[0]!.message);
    const refs = inputReferences(bundle.inputs, values, scope),
      allowed =
        cached?.allowed ??
        new Set(
          refs.assets.length ? this.listContentAssets(process.id).map((asset) => asset.id) : [],
        );
    if (refs.assets.some((id) => !allowed.has(id)))
      throw new DomainError(
        'INVALID_ASSET_SCOPE',
        'Chỉ chọn media đã đăng ký trong tiến trình này.',
      );
    for (const id of refs.identities) {
      const identity = this.db
        .prepare('SELECT app_id,device_id FROM identities WHERE id=?')
        .get(id);
      if (!identity || identity.app_id !== process.appId || identity.device_id !== process.deviceId)
        throw new DomainError(
          'IDENTITY_MISMATCH',
          'Tài khoản tham chiếu không thuộc app/điện thoại của tiến trình.',
        );
    }
    return refs.assets;
  }
  saveContentValidated(item: ContentItem, expectedRevision: number | null): ContentItem {
    return this.transaction(() => {
      this.assertContentItem(item);
      return this.insertContent(item, expectedRevision);
    });
  }
  private assertContentItem(
    item: ContentItem,
    cached?: { process: ProcessDefinition; bundle: WorkflowBundle | null; allowed: Set<string> },
  ): void {
    const process = cached?.process ?? this.getProcess(item.processId);
    if (process.archived || item.ignored)
      throw new DomainError('CONTENT_NOT_EDITABLE', 'Nội dung hoặc tiến trình không còn dùng.');
    const refs = this.assertInputValues(process, item.fields, 'row', true, cached);
    const allowed =
      cached?.allowed ?? new Set(this.listContentAssets(process.id).map((asset) => asset.id));
    if (
      item.assetIds.some((id) => !allowed.has(id)) ||
      refs.some((id) => !item.assetIds.includes(id))
    )
      throw new DomainError(
        'INVALID_ASSET_SCOPE',
        'Chỉ chọn media đã đăng ký trong tiến trình này và gắn đủ media vào nội dung.',
      );
  }

  deviceEndpoints(hostId: string): DeviceEndpointPolicy[] {
    return this.db
      .prepare('SELECT * FROM device_endpoint_policies WHERE host_id=? ORDER BY endpoint')
      .all(hostId)
      .map((row) => ({
        endpoint: String(row.endpoint),
        resolvedSerial: row.resolved_serial === null ? null : String(row.resolved_serial),
        desired: Boolean(row.desired),
        revision: Number(row.revision),
        failures: Number(row.failures),
        nextAttemptUtc: row.next_attempt_utc === null ? null : String(row.next_attempt_utc),
        lastErrorCode: row.last_error_code === null ? null : String(row.last_error_code),
        deviceId: (() => {
          const device = this.db
            .prepare(
              'SELECT device_id FROM device_transports WHERE host_id=? AND (serial=? OR serial=?) ORDER BY last_seen DESC LIMIT 1',
            )
            .get(hostId, String(row.endpoint), row.resolved_serial ?? '');
          return device ? String(device.device_id) : null;
        })(),
      }));
  }
  setDeviceEndpoint(
    hostId: string,
    endpoint: string,
    desired: boolean,
    expectedRevision: number | null = null,
  ): void {
    endpoint = parseEndpoint(endpoint);
    this.transaction(() => {
      const row = this.db
        .prepare('SELECT revision FROM device_endpoint_policies WHERE host_id=? AND endpoint=?')
        .get(hostId, endpoint);
      if (expectedRevision !== null && (!row || Number(row.revision) !== expectedRevision))
        throw new DomainError(
          'REVISION_CONFLICT',
          'Endpoint policy đã đổi; tải lại trước khi sửa.',
        );
      this.db
        .prepare(
          'INSERT INTO device_endpoint_policies VALUES(?,?,NULL,?,0,0,NULL,NULL) ON CONFLICT(host_id,endpoint) DO UPDATE SET desired=excluded.desired,revision=revision+1,failures=0,next_attempt_utc=NULL,last_error_code=NULL',
        )
        .run(hostId, endpoint, Number(desired));
    });
  }
  recordEndpointAttempt(
    hostId: string,
    endpoint: string,
    resolvedSerial: string | null,
    errorCode: string | null,
    at: number,
  ): void {
    endpoint = parseEndpoint(endpoint);
    if (
      !Number.isSafeInteger(at) ||
      !Number.isFinite(new Date(at).getTime()) ||
      (errorCode && !/^[A-Z0-9_]{1,80}$/.test(errorCode))
    )
      throw new DomainError('INVALID_ENDPOINT_ATTEMPT', 'Endpoint attempt không hợp lệ.');
    const row = this.db
      .prepare('SELECT failures FROM device_endpoint_policies WHERE host_id=? AND endpoint=?')
      .get(hostId, endpoint);
    if (!row) return;
    const failures = errorCode ? Number(row.failures) + 1 : 0,
      next = errorCode
        ? new Date(at + Math.min(300000, 2000 * 2 ** Math.min(failures - 1, 8))).toISOString()
        : null;
    this.db
      .prepare(
        'UPDATE device_endpoint_policies SET resolved_serial=coalesce(?,resolved_serial),failures=?,next_attempt_utc=?,last_error_code=? WHERE host_id=? AND endpoint=?',
      )
      .run(resolvedSerial, failures, next, errorCode, hostId, endpoint);
  }
  invalidateDeviceTransports(hostId: string, deviceId: string | null = null): void {
    this.db
      .prepare(
        "UPDATE device_transports SET state='DISCONNECTED',identity_verified=0,generation=generation+1 WHERE host_id=? AND (? IS NULL OR device_id=?) AND state<>'DISCONNECTED'",
      )
      .run(hostId, deviceId, deviceId);
  }
  reconcileDeviceTransports(
    hostId: string,
    observations: TransportObservation[],
    at = now(),
  ): void {
    assertJsonSafe(observations);
    if (
      new Set(observations.map((o) => o.serial)).size !== observations.length ||
      observations.length > 10000
    )
      throw new DomainError('DEVICE_SCAN_INVALID', 'Scan transport trùng hoặc vượt budget.');
    this.transaction(() => {
      const seen = new Set<string>(),
        grouped = new Map<string, string[]>();
      for (const observation of observations) {
        if (
          !observation.serial ||
          observation.serial.length > 220 ||
          !['CONNECTED', 'UNAUTHORIZED', 'OFFLINE', 'NO_PERMISSIONS', 'DISCONNECTED'].includes(
            observation.state,
          ) ||
          !['USB', 'TCP', 'EMULATOR'].includes(observation.kind)
        )
          throw new DomainError('DEVICE_SCAN_INVALID', 'Transport không hợp lệ.');
        seen.add(observation.serial);
        const old = this.db
          .prepare('SELECT * FROM device_transports WHERE host_id=? AND serial=?')
          .get(hostId, observation.serial);
        // Metadata is fresh identity evidence only for an authorized/connected
        // transport. Offline/unauthorized callbacks cannot promote or rebind it.
        const freshMetadata =
          observation.state === 'CONNECTED' ? observation.metadata : null;
        const evidence = deviceFingerprint(freshMetadata, hostId, observation.serial);
        const previous = old
          ? this.db
              .prepare('SELECT * FROM device_profiles WHERE device_id=?')
              .get(String(old.device_id))
          : undefined;
        // An already-verified transport alias is not permission to bind a different
        // physical phone to its historical Process/jobs. This is an identity
        // contradiction, not a discovery event. Preserve the old binding and
        // revoke input capability until an explicitly audited resolution exists.
        if (
          old &&
          previous &&
          (previous.identity === 'VERIFIED_PROPERTIES' || previous.identity === 'CONFLICT') &&
          observation.state === 'CONNECTED' &&
          !evidence.provisional &&
          evidence.fingerprint !== previous.fingerprint
        ) {
          const candidate = this.db
            .prepare('SELECT device_id FROM device_profiles WHERE fingerprint=?')
            .get(evidence.fingerprint);
          this.db
            .prepare(
              "UPDATE device_profiles SET identity='CONFLICT',revision=revision+1 WHERE device_id=? AND identity<>'CONFLICT'",
            )
            .run(String(old.device_id));
          if (candidate && candidate.device_id !== old.device_id)
            this.db
              .prepare(
                "UPDATE device_profiles SET identity='CONFLICT',revision=revision+1 WHERE device_id=? AND identity<>'CONFLICT'",
              )
              .run(String(candidate.device_id));
          const changed =
            old.state !== observation.state ||
            old.kind !== observation.kind ||
            Boolean(old.identity_verified);
          this.db
            .prepare(
              'UPDATE device_transports SET kind=?,state=?,generation=?,last_seen=?,identity_verified=0 WHERE host_id=? AND serial=?',
            )
            .run(
              observation.kind,
              observation.state,
              Number(old.generation) + Number(changed),
              at,
              hostId,
              observation.serial,
            );
          // Do not create or auto-verify a new record, and do not move a lease,
          // existing content, queued jobs, or historical device references.
          continue;
        }
        let profile = this.db
          .prepare('SELECT * FROM device_profiles WHERE fingerprint=?')
          .get(evidence.fingerprint);
        if (!profile && old) {
          const previous = this.db
            .prepare('SELECT * FROM device_profiles WHERE device_id=?')
            .get(String(old.device_id));
          // Incomplete (provisional) hardware evidence cannot migrate an existing
          // verified transport to a new identity or overwrite historical metadata.
          if (previous?.identity === 'PROVISIONAL' || evidence.provisional) profile = previous;
        }
        let deviceId = profile ? String(profile.device_id) : null;
        const metadata =
          !evidence.provisional && freshMetadata
            ? canonicalJson(freshMetadata)
            : profile?.metadata
              ? String(profile.metadata)
              : freshMetadata
                ? canonicalJson(freshMetadata)
                : null;
        const identity =
          profile?.identity === 'CONFLICT'
            ? 'CONFLICT'
            : evidence.provisional
              ? (profile?.identity ?? 'PROVISIONAL')
              : 'VERIFIED_PROPERTIES';
        let profileChanged = false;
        if (!deviceId) {
          deviceId = makeId('device');
          this.db
            .prepare('INSERT INTO devices(id,name) VALUES(?,?)')
            .run(deviceId, freshMetadata?.model ?? observation.serial);
          this.db
            .prepare('INSERT INTO device_profiles VALUES(?,?,?,?,0)')
            .run(deviceId, evidence.fingerprint, metadata, identity);
          profileChanged = true;
        } else if (
          metadata !== profile!.metadata ||
          (!evidence.provisional && profile!.fingerprint !== evidence.fingerprint) ||
          identity !== profile!.identity
        ) {
          this.db
            .prepare(
              'UPDATE device_profiles SET fingerprint=?,metadata=?,identity=?,revision=revision+1 WHERE device_id=?',
            )
            .run(
              evidence.provisional ? String(profile!.fingerprint) : evidence.fingerprint,
              metadata,
              identity,
              deviceId,
            );
          profileChanged = true;
        }
        const fresh =
          observation.state === 'CONNECTED' &&
          !evidence.provisional &&
          freshMetadata !== null;
        const changed =
          !old ||
          Boolean(old.identity_verified) !== fresh ||
          old.device_id !== deviceId ||
          old.state !== observation.state ||
          profileChanged;
        const generation = Number(old?.generation ?? 0) + (changed ? 1 : 0);
        this.db
          .prepare(
            'INSERT INTO device_transports VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(host_id,serial) DO UPDATE SET device_id=excluded.device_id,kind=excluded.kind,state=excluded.state,generation=excluded.generation,last_seen=excluded.last_seen,identity_verified=excluded.identity_verified',
          )
          .run(
            hostId,
            observation.serial,
            deviceId,
            observation.kind,
            observation.state,
            generation,
            at,
            Number(fresh),
          );
        if (
          observation.kind === 'USB' &&
          observation.state === 'CONNECTED' &&
          !evidence.provisional
        ) {
          const list = grouped.get(deviceId) ?? [];
          list.push(observation.serial);
          grouped.set(deviceId, list);
        }
      }
      for (const old of this.db
        .prepare('SELECT serial FROM device_transports WHERE host_id=?')
        .all(hostId))
        if (!seen.has(String(old.serial)))
          this.db
            .prepare(
              "UPDATE device_transports SET state='DISCONNECTED',identity_verified=0,generation=generation+1 WHERE host_id=? AND serial=? AND state<>'DISCONNECTED'",
            )
            .run(hostId, String(old.serial));
      for (const [deviceId, serials] of grouped)
        if (serials.length > 1)
          this.db
            .prepare(
              "UPDATE device_profiles SET identity='CONFLICT',revision=revision+1 WHERE device_id=? AND identity<>'CONFLICT'",
            )
            .run(deviceId);
    });
  }
  listDeviceRecords(hostId: string, at = Date.now()): DeviceRecord[] {
    return this.db
      .prepare(
        'SELECT d.*,p.metadata,p.identity,coalesce(p.revision,0) AS revision FROM devices d LEFT JOIN device_profiles p ON p.device_id=d.id ORDER BY d.rowid',
      )
      .all()
      .map((row) => {
        const id = String(row.id),
          transports = this.db
            .prepare(
              "SELECT * FROM device_transports WHERE host_id=? AND device_id=? ORDER BY CASE kind WHEN 'USB' THEN 0 ELSE 1 END,serial",
            )
            .all(hostId, id)
            .map((t) => ({
              serial: String(t.serial),
              kind: t.kind as TransportObservation['kind'],
              state: t.state as TransportObservation['state'],
              generation: Number(t.generation),
              identityVerified: Boolean(t.identity_verified),
              lastSeen: String(t.last_seen),
            }));
        const connected = transports.some((t) => t.state === 'CONNECTED'),
          fresh = transports.some((t) => t.state === 'CONNECTED' && t.identityVerified),
          verified = row.identity === 'VERIFIED_PROPERTIES',
          enabled = Boolean(row.enabled),
          reasons: string[] = [];
        if (!connected) reasons.push('Thiết bị chưa kết nối hoặc chưa cấp quyền ADB.');
        if (connected && !fresh)
          reasons.push('Chưa đọc lại được thuộc tính nhận diện trên transport hiện tại.');
        if (!verified)
          reasons.push(
            row.identity === 'CONFLICT'
              ? 'Xung đột nhận diện thiết bị; chưa cho thao tác.'
              : 'Chưa đủ thuộc tính để xác định thiết bị.',
          );
        if (!enabled) reasons.push('Thiết bị đang tắt trong workspace.');
        const owner = this.db
          .prepare(
            'SELECT owner_kind,expires_at FROM leases WHERE device_id=? AND owner_id IS NOT NULL AND expires_at>?',
          )
          .get(id, at);
        return {
          id,
          name: String(row.name),
          enabled,
          revision: Number(row.revision),
          metadata: row.metadata ? parse<DeviceMetadata>(row.metadata) : null,
          identity: (row.identity ?? 'PROVISIONAL') as DeviceRecord['identity'],
          transports,
          owner: owner
            ? { kind: String(owner.owner_kind), expiresAt: Number(owner.expires_at) }
            : null,
          capabilities: {
            connected,
            manualControl: connected && fresh && verified && enabled,
            screenshot: connected && fresh && verified && enabled,
            stream: false,
            automation: false,
            reasons,
          },
        };
      });
  }
  /**
   * Read-only diagnostic. Never authorizes a conflict to be cleared.
   * Personal hardware serials/fingerprints and transport aliases are intentionally absent.
   */
  conflictResolutionReadiness(
    hostId: string,
    deviceId: string,
    at = Date.now(),
  ): {
    deviceId: string;
    revision: number;
    status: 'CONFLICT' | 'NOT_CONFLICT';
    canResolveAutomatically: false;
    blockers: string[];
  } {
    idSchema.parse(hostId);
    idSchema.parse(deviceId);
    if (!Number.isSafeInteger(at) || !Number.isFinite(new Date(at).getTime()))
      throw new DomainError('INVALID_CLOCK', 'Invalid diagnostic clock.');
    const row = this.db
      .prepare('SELECT p.identity,p.revision FROM device_profiles p WHERE p.device_id=?')
      .get(deviceId);
    if (!row) throw new DomainError('NOT_FOUND', 'Không tìm thấy thiết bị đã đăng ký.');
    const blockers: string[] = [];
    if (row.identity !== 'CONFLICT') blockers.push('NOT_CONFLICT');
    const transports = this.db
      .prepare(
        'SELECT state,identity_verified FROM device_transports WHERE host_id=? AND device_id=?',
      )
      .all(hostId, deviceId);
    if (!transports.length || !transports.some((t) => t.state === 'CONNECTED'))
      blockers.push('NO_CONNECTED_TRANSPORT');
    if (!transports.some((t) => t.state === 'CONNECTED' && Boolean(t.identity_verified)))
      blockers.push('NO_FRESH_VERIFIED_PROOF');
    if (
      this.db
        .prepare(
          'SELECT 1 FROM leases WHERE device_id=? AND owner_id IS NOT NULL AND expires_at>? LIMIT 1',
        )
        .get(deviceId, at)
    )
      blockers.push('DEVICE_LEASE_BUSY');
    if (
      this.db
        .prepare(
          "SELECT 1 FROM jobs WHERE device_id=? AND state IN('PREFLIGHT','RUNNING','POST_INTENT','POST_PENDING','POSTED','COMMENT_PENDING','NEEDS_REVIEW') LIMIT 1",
        )
        .get(deviceId)
    )
      blockers.push('ACTIVE_OR_UNCERTAIN_JOB');
    // These are distinct obligations: a good scan cannot prove physical ownership
    // nor establish an operator's informed confirmation of the right handset.
    blockers.push('PHYSICAL_IDENTITY_CONFIRMATION_REQUIRED');
    blockers.push('AUDITED_RESOLUTION_NOT_IMPLEMENTED');
    return {
      deviceId,
      revision: Number(row.revision),
      status: row.identity === 'CONFLICT' ? 'CONFLICT' : 'NOT_CONFLICT',
      canResolveAutomatically: false,
      blockers,
    };
  }

  /** Trusted-host-only proof. The renderer cannot supply transport observations. */
  private conflictRecoveryProof(
    hostId: string,
    deviceId: string,
    expectedRevision: number,
    observation: TransportObservation,
    at: number,
  ): {
    blockers: string[];
    name: string;
    model: string | null;
    proofHash: string | null;
  } {
    idSchema.parse(hostId);
    idSchema.parse(deviceId);
    assertJsonSafe(observation);
    if (
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      !Number.isSafeInteger(at) ||
      !Number.isFinite(new Date(at).getTime())
    )
      throw new DomainError('INVALID_RESOLUTION_INPUT', 'Clock hoặc revision không hợp lệ.');
    const row = this.db
      .prepare(
        'SELECT d.name,p.identity,p.fingerprint,p.metadata,p.revision FROM devices d JOIN device_profiles p ON p.device_id=d.id WHERE d.id=?',
      )
      .get(deviceId);
    if (!row) throw new DomainError('NOT_FOUND', 'Không tìm thấy identity lịch sử.');
    const blockers: string[] = [];
    if (row.identity !== 'CONFLICT') blockers.push('NOT_CONFLICT');
    if (Number(row.revision) !== expectedRevision) blockers.push('REVISION_STALE');
    const transport =
      observation && typeof observation.serial === 'string'
        ? this.db
            .prepare(
              'SELECT * FROM device_transports WHERE host_id=? AND serial=? AND device_id=?',
            )
            .get(hostId, observation.serial, deviceId)
        : undefined;
    if (
      !transport ||
      observation.state !== 'CONNECTED' ||
      transport.state !== 'CONNECTED' ||
      transport.kind !== observation.kind
    )
      blockers.push('TRANSPORT_UNAVAILABLE');
    if (
      !transport ||
      !Number.isFinite(Date.parse(String(transport.last_seen))) ||
      Math.abs(at - Date.parse(String(transport.last_seen))) > 30000
    )
      blockers.push('STALE_TRANSPORT_SCAN');
    const live = deviceFingerprint(
      observation.state === 'CONNECTED' ? observation.metadata : null,
      hostId,
      observation.serial ?? '',
    );
    if (live.provisional) blockers.push('UNVERIFIED_HARDWARE_PROPERTIES');
    else if (live.fingerprint !== row.fingerprint)
      blockers.push('HISTORICAL_FINGERPRINT_MISMATCH');
    const count = Number(
      this.db
        .prepare(
          "SELECT count(*) AS n FROM device_transports WHERE host_id=? AND device_id=? AND state='CONNECTED'",
        )
        .get(hostId, deviceId)!.n,
    );
    if (count !== 1) blockers.push('AMBIGUOUS_ACTIVE_TRANSPORTS');
    if (
      this.db
        .prepare(
          'SELECT 1 FROM leases WHERE device_id=? AND owner_id IS NOT NULL AND expires_at>? LIMIT 1',
        )
        .get(deviceId, at)
    ) blockers.push('DEVICE_LEASE_BUSY');
    if (
      this.db
        .prepare(
          "SELECT 1 FROM jobs WHERE device_id=? AND state IN('PREFLIGHT','RUNNING','POST_INTENT','POST_PENDING','POSTED','COMMENT_PENDING','NEEDS_REVIEW') LIMIT 1",
        )
        .get(deviceId)
    ) blockers.push('ACTIVE_OR_UNCERTAIN_JOB');
    if (
      this.db
        .prepare(
          "SELECT 1 FROM effects e JOIN jobs j ON j.id=e.job_id WHERE j.device_id=? AND e.state IN('INTENT','ATTEMPT_UNCERTAIN','NEEDS_REVIEW') LIMIT 1",
        )
        .get(deviceId)
    ) blockers.push('PENDING_EXTERNAL_EFFECT');
    if (
      this.db
        .prepare('SELECT 1 FROM device_profiles WHERE fingerprint=? AND device_id<>? LIMIT 1')
        .get(live.fingerprint, deviceId)
    ) blockers.push('COMPETING_REGISTERED_IDENTITY');
    const model = row.metadata ? parse<DeviceMetadata>(row.metadata).model : null;
    return {
      blockers,
      name: String(row.name),
      model,
      proofHash:
        blockers.length || !transport
          ? null
          : contentHash({
              hostId,
              deviceId,
              transport: observation.serial,
              generation: Number(transport.generation),
              fingerprint: live.fingerprint,
            }),
    };
  }

  /** Short-lived durable preview. No privileged operation or device input. */
  previewDeviceConflictResolution(
    hostId: string,
    deviceId: string,
    expectedRevision: number,
    observation: TransportObservation,
    at = Date.now(),
  ): DeviceResolutionPreview {
    return this.transaction(() => {
      const checked = this.conflictRecoveryProof(
        hostId, deviceId, expectedRevision, observation, at,
      );
      if (!checked.proofHash) return {
        deviceId,
        expectedRevision,
        name: checked.name,
        model: checked.model,
        token: null,
        expiresAt: null,
        canApply: false,
        blockers: checked.blockers,
      };
      const token = makeId('deviceResolution'),
        expiresAt = new Date(at + 60000).toISOString();
      this.db
        .prepare(
          'INSERT INTO device_resolution_previews(token,host_id,device_id,expected_revision,proof_hash,expires_at,used_at) VALUES(?,?,?,?,?,?,NULL)',
        )
        .run(token, hostId, deviceId, expectedRevision, checked.proofHash, expiresAt);
      return {
        deviceId,
        expectedRevision,
        name: checked.name,
        model: checked.model,
        token,
        expiresAt,
        canApply: true,
        blockers: [],
      };
    });
  }

  /**
   * Explicit, privately confirmed operation. The old device ID is preserved;
   * transport generations are fenced and enabled=false until a further scan
   * and a deliberate re-enable. This never performs any Android input.
   */
  applyDeviceConflictResolution(
    hostId: string,
    deviceId: string,
    token: string,
    confirmedName: string,
    observation: TransportObservation,
    at = Date.now(),
  ): DeviceResolutionResult {
    idSchema.parse(token);
    idSchema.parse(deviceId);
    if (typeof confirmedName !== 'string' || confirmedName.length > 120)
      throw new DomainError('RESOLUTION_CONFIRMATION_REQUIRED', 'Tên xác nhận không hợp lệ.');
    return this.transaction(() => {
      const preview = this.db
        .prepare('SELECT * FROM device_resolution_previews WHERE token=?')
        .get(token);
      if (!preview || preview.host_id !== hostId || preview.device_id !== deviceId)
        throw new DomainError(
          'RESOLUTION_PREVIEW_NOT_FOUND', 'Không tìm thấy phiếu xác minh của host.',
        );
      if (preview.used_at !== null)
        throw new DomainError('RESOLUTION_TOKEN_USED', 'Phiếu đã dùng; phải xác minh lại.');
      if (Date.parse(String(preview.expires_at)) <= at)
        throw new DomainError('RESOLUTION_EXPIRED', 'Phiếu xác minh hết hạn; quét lại.');
      const checked = this.conflictRecoveryProof(
        hostId, deviceId, Number(preview.expected_revision), observation, at,
      );
      if (!checked.proofHash || checked.proofHash !== preview.proof_hash)
        throw new DomainError(
          'RESOLUTION_PROOF_CHANGED', 'Nhận diện/transport hoặc revision đã đổi; quét lại.',
        );
      if (confirmedName.normalize('NFC').trim() !== checked.name.normalize('NFC').trim())
        throw new DomainError(
          'RESOLUTION_CONFIRMATION_REQUIRED',
          'Nhập chính xác tên thiết bị đã đăng ký sau khi kiểm tra vật lý.',
        );
      const previousRevision = Number(preview.expected_revision);
      const changed = this.db
        .prepare(
          "UPDATE device_profiles SET identity='VERIFIED_PROPERTIES',revision=revision+1 WHERE device_id=? AND revision=? AND identity='CONFLICT'",
        )
        .run(deviceId, previousRevision);
      if (Number(changed.changes) !== 1)
        throw new DomainError('RESOLUTION_STALE', 'Identity đã đổi trong khi xác minh.');
      // Never resume automation merely because a human cleared one conflict.
      this.db.prepare('UPDATE devices SET enabled=0 WHERE id=?').run(deviceId);
      this.db
        .prepare(
          'UPDATE device_transports SET identity_verified=0,generation=generation+1 WHERE device_id=?',
        )
        .run(deviceId);
      const auditId = makeId('deviceResolutionAudit');
      this.db
        .prepare(
          'INSERT INTO device_resolution_audit(id,device_id,host_id,previous_revision,new_revision,proof_hash,created_at) VALUES(?,?,?,?,?,?,?)',
        )
        .run(
          auditId, deviceId, hostId, previousRevision, previousRevision + 1,
          checked.proofHash, new Date(at).toISOString(),
        );
      this.db
        .prepare('UPDATE device_resolution_previews SET used_at=? WHERE token=?')
        .run(new Date(at).toISOString(), token);
      return { deviceId, auditId, revision: previousRevision + 1, enabled: false };
    });
  }


  /**
   * Bounded, read-only history. Raw host IDs and proof hashes stay in the DB.
   * Cursor is scope-bound to one registered device and an existing audit anchor.
   */
  deviceResolutionHistory(
    deviceId: string,
    limit = 20,
    cursor: string | null = null,
  ): DeviceResolutionAuditPage {
    idSchema.parse(deviceId);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50)
      throw new DomainError('INVALID_AUDIT_LIMIT', 'Chỉ được xem 1–50 sự kiện một trang.');
    if (!this.db.prepare('SELECT 1 FROM devices WHERE id=?').get(deviceId))
      throw new DomainError('NOT_FOUND', 'Thiết bị chưa đăng ký.');
    let anchor: { id: string; createdAt: string } | null = null;
    if (cursor !== null) {
      if (typeof cursor !== 'string' || !/^[A-Za-z0-9_-]{1,1024}$/.test(cursor))
        throw new DomainError('INVALID_AUDIT_CURSOR', 'Cursor lịch sử không hợp lệ.');
      let decoded: unknown;
      try {
        decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        assertJsonSafe(decoded);
      } catch {
        throw new DomainError('INVALID_AUDIT_CURSOR', 'Cursor lịch sử không hợp lệ.');
      }
      if (
        !decoded ||
        typeof decoded !== 'object' ||
        Array.isArray(decoded) ||
        Object.keys(decoded).sort().join(',') !== 'createdAt,deviceId,id,version'
      )
        throw new DomainError('INVALID_AUDIT_CURSOR', 'Cursor lịch sử không hợp lệ.');
      const c = decoded as { version: unknown; deviceId: unknown; id: unknown; createdAt: unknown };
      if (c.version !== 1 || c.deviceId !== deviceId)
        throw new DomainError('AUDIT_CURSOR_SCOPE', 'Cursor không thuộc thiết bị này.');
      if (
        typeof c.id !== 'string' ||
        typeof c.createdAt !== 'string' ||
        !idSchema.safeParse(c.id).success ||
        !Number.isFinite(Date.parse(c.createdAt)) ||
        new Date(c.createdAt).toISOString() !== c.createdAt
      )
        throw new DomainError('INVALID_AUDIT_CURSOR', 'Cursor lịch sử không hợp lệ.');
      if (
        !this.db
          .prepare(
            'SELECT 1 FROM device_resolution_audit WHERE device_id=? AND id=? AND created_at=?',
          )
          .get(deviceId, c.id, c.createdAt)
      )
        throw new DomainError('AUDIT_CURSOR_STALE', 'Sự kiện neo của cursor đã đổi.');
      anchor = { id: c.id, createdAt: c.createdAt };
    }
    const query =
      'SELECT id,device_id,previous_revision,new_revision,created_at FROM device_resolution_audit WHERE device_id=?' +
      (anchor ? ' AND (created_at<? OR (created_at=? AND id<?))' : '') +
      ' ORDER BY created_at DESC,id DESC LIMIT ?';
    const rows = anchor
      ? this.db.prepare(query).all(deviceId, anchor.createdAt, anchor.createdAt, anchor.id, limit + 1)
      : this.db.prepare(query).all(deviceId, limit + 1);
    const hasMore = rows.length > limit;
    const entries: DeviceResolutionAuditEntry[] = rows.slice(0, limit).map((row) => ({
      id: String(row.id),
      deviceId: String(row.device_id),
      previousRevision: Number(row.previous_revision),
      newRevision: Number(row.new_revision),
      createdAt: String(row.created_at),
    }));
    const last = entries.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(
            JSON.stringify({
              version: 1,
              deviceId,
              id: last.id,
              createdAt: last.createdAt,
            }),
            'utf8',
          ).toString('base64url')
        : null;
    return { entries, hasMore, nextCursor };
  }

  updateDevice(
    id: string,
    expectedRevision: number,
    patch: { name?: string; enabled?: boolean },
  ): void {
    idSchema.parse(id);
    this.transaction(() => {
      const row = this.db
        .prepare(
          'SELECT d.*,p.revision FROM devices d LEFT JOIN device_profiles p ON p.device_id=d.id WHERE d.id=?',
        )
        .get(id);
      if (!row || Number(row.revision ?? 0) !== expectedRevision)
        throw new DomainError('REVISION_CONFLICT', 'Thiết bị đã đổi; tải lại trước khi sửa.');
      if (patch.name !== undefined && (!patch.name.trim() || patch.name.length > 120))
        throw new DomainError('INVALID_DEVICE_NAME', 'Tên thiết bị từ 1–120 ký tự.');
      this.db
        .prepare('UPDATE devices SET name=?,enabled=? WHERE id=?')
        .run(
          patch.name?.trim() ?? String(row.name),
          patch.enabled === undefined ? Number(row.enabled) : Number(patch.enabled),
          id,
        );
      if (row.revision === null)
        this.db
          .prepare("INSERT INTO device_profiles VALUES(?,?,NULL,'PROVISIONAL',1)")
          .run(id, contentHash({ legacyDevice: id }));
      else
        this.db.prepare('UPDATE device_profiles SET revision=revision+1 WHERE device_id=?').run(id);
    });
  }
  assertDeviceTransport(
    hostId: string,
    deviceId: string,
    serial: string,
    generation: number,
  ): void {
    const device = this.listDeviceRecords(hostId).find((d) => d.id === deviceId),
      transport = device?.transports.find((t) => t.serial === serial);
    if (
      !device?.capabilities.manualControl ||
      transport?.state !== 'CONNECTED' ||
      !transport.identityVerified ||
      transport.generation !== generation
    )
      throw new DomainError(
        'STALE_DEVICE_TRANSPORT',
        'Thiết bị/quyền/transport đã đổi; chụp và chọn lại trước khi thao tác.',
      );
  }

  registerObservedDevice(id: string, name: string): void {
    idSchema.parse(id);
    this.db
      .prepare(
        'INSERT INTO devices(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name',
      )
      .run(id, name);
  }
  listDevices(): { id: string; name: string; enabled: boolean }[] {
    return this.db
      .prepare('SELECT * FROM devices')
      .all()
      .map((r) => ({ id: String(r.id), name: String(r.name), enabled: Boolean(r.enabled) }));
  }
  registerAsset(asset: MediaAsset): void {
    idSchema.parse(asset.id);
    hashSchema.parse(asset.hash);
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes < 0 || !Number.isFinite(asset.mtimeMs))
      throw new DomainError('INVALID_ASSET', 'Invalid asset metadata');
    this.db
      .prepare('INSERT INTO assets VALUES(?,?,?,?,?,?,?)')
      .run(
        asset.id,
        asset.sourceRef,
        asset.relativePath,
        asset.hash,
        asset.kind,
        asset.bytes,
        asset.mtimeMs,
      );
  }
  listContent(processId: string): ContentItem[] {
    return this.db
      .prepare('SELECT * FROM content_items WHERE process_id=? AND ignored=0 ORDER BY rowid')
      .all(processId)
      .map((r) => ({
        id: String(r.id),
        processId,
        revision: Number(r.revision),
        fields: parse(r.fields),
        ignored: Boolean(r.ignored),
        assetIds: this.db
          .prepare('SELECT asset_id FROM content_assets WHERE content_id=? ORDER BY ordinal')
          .all(String(r.id))
          .map((a) => String(a.asset_id)),
      }));
  }

  /**
   * Read-only Process-scoped SQLite content query. The legacy editor uses
   * listContent until its selection/scheduling semantics are migrated.
   */
  listContentPage(query: ContentQuery): ContentPage {
    idSchema.parse(query.processId);
    this.getProcess(query.processId);
    const limit = query.limit ?? 100;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 250)
      throw new DomainError('INVALID_CONTENT_QUERY', 'Limit phải từ 1 đến 250.');
    if (
      (query.search !== undefined && (typeof query.search !== 'string' || query.search.length > 120)) ||
      (query.includeIgnored !== undefined && typeof query.includeIgnored !== 'boolean') ||
      (query.sortOrder !== undefined &&
        query.sortOrder !== 'OLDEST_FIRST' &&
        query.sortOrder !== 'NEWEST_FIRST')
    )
      throw new DomainError('INVALID_CONTENT_QUERY', 'Bộ lọc nội dung không hợp lệ.');
    const search = (query.search ?? '').trim(),
      includeIgnored = query.includeIgnored ?? false,
      sortOrder = query.sortOrder ?? 'OLDEST_FIRST';
    const epoch = () => {
      const r = this.db.prepare("SELECT revision FROM query_epochs WHERE name='content'").get();
      if (!r) throw new DomainError('MISSING_QUERY_EPOCH', 'Workspace cần cập nhật migration.');
      return Number(r.revision);
    };
    const revision = epoch(),
      fingerprint = contentHash({ processId: query.processId, search, includeIgnored, sortOrder });
    let lastRowId = 0,
      cursorTotal: number | null = null;
    if (query.cursor !== undefined) {
      try {
        if (query.cursor.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(query.cursor))
          throw new Error('Malformed cursor');
        const decoded: unknown = JSON.parse(
          Buffer.from(query.cursor, 'base64url').toString('utf8'),
        );
        assertJsonSafe(decoded);
        if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded))
          throw new Error('Invalid cursor');
        const c = decoded as Record<string, JsonValue>;
        if (
          Object.keys(c).length !== 5 ||
          c.version !== 1 ||
          typeof c.fingerprint !== 'string' ||
          !Number.isSafeInteger(c.epoch) ||
          !Number.isSafeInteger(c.rowId) ||
          Number(c.rowId) < 1 ||
          !Number.isSafeInteger(c.total) ||
          Number(c.total) < 0
        ) throw new Error('Invalid cursor fields');
        if (c.fingerprint !== fingerprint)
          throw new DomainError('CONTENT_CURSOR_SCOPE', 'Đổi Process hoặc bộ lọc; tải trang đầu.');
        if (c.epoch !== revision)
          throw new DomainError('CONTENT_QUERY_STALE', 'Nội dung đã thay đổi; tải lại trang đầu.');
        lastRowId = Number(c.rowId);
        cursorTotal = Number(c.total);
      } catch (error) {
        if (error instanceof DomainError) throw error;
        throw new DomainError('INVALID_CONTENT_CURSOR', 'Con trỏ nội dung không hợp lệ.');
      }
    }
    const conditions = ['process_id=?'],
      params: (string | number)[] = [query.processId];
    if (!includeIgnored) conditions.push('ignored=0');
    if (search) {
      // Bound parameters, no arbitrary SQL. SQLite lower() casefold is ASCII-oriented;
      // full accent-insensitive search requires a future indexed Unicode search field.
      conditions.push('(instr(lower(fields),lower(?))>0 OR instr(lower(id),lower(?))>0)');
      params.push(search, search);
    }
    const where = conditions.join(' AND ');
    const total =
      cursorTotal ??
      Number(
        this.db
          .prepare('SELECT COUNT(*) AS count FROM content_items WHERE ' + where)
          .get(...params)?.count ?? 0,
      );
    // Direction is an enum, not caller-supplied SQL. The anchor is applied only
    // after the first page, ensuring all rows can be traversed in either order.
    const descending = sortOrder === 'NEWEST_FIRST',
      cursorWhere = query.cursor === undefined ? '' : descending ? ' AND rowid<?' : ' AND rowid>?',
      orderSql = descending ? 'DESC' : 'ASC';
    const records = this.db
      .prepare(
        'SELECT rowid AS ordinal,id,process_id,revision,fields,ignored FROM content_items WHERE ' +
          where + cursorWhere + ' ORDER BY rowid ' + orderSql + ' LIMIT ?',
      )
      .all(...params, ...(query.cursor === undefined ? [] : [lastRowId]), limit + 1);
    const page = records.slice(0, limit);
    const ids = page.map((r) => String(r.id));
    const assets = new Map<string, string[]>();
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      for (const a of this.db
        .prepare(
          'SELECT content_id,asset_id FROM content_assets WHERE content_id IN (' +
            placeholders +
            ') ORDER BY content_id,ordinal',
        )
        .all(...ids)) {
        const key = String(a.content_id),
          array = assets.get(key) ?? [];
        array.push(String(a.asset_id));
        assets.set(key, array);
      }
    }
    const items: ContentItem[] = page.map((r) => ({
      id: String(r.id),
      processId: String(r.process_id),
      revision: Number(r.revision),
      fields: parse(r.fields),
      ignored: Boolean(r.ignored),
      assetIds: assets.get(String(r.id)) ?? [],
    }));
    if (epoch() !== revision)
      throw new DomainError('CONTENT_QUERY_STALE', 'Nội dung đổi trong lúc đọc; tải lại.');
    const hasMore = records.length > limit,
      last = page.at(-1),
      nextCursor =
        hasMore && last
          ? Buffer.from(
              JSON.stringify({
                version: 1,
                epoch: revision,
                fingerprint,
                rowId: Number(last.ordinal),
                total,
              }),
            ).toString('base64url')
          : null;
    return { items, total, hasMore, nextCursor };
  }

  saveContent(input: ContentItem, expectedRevision: number | null): ContentItem {
    return this.transaction(() => this.insertContent(input, expectedRevision));
  }
  private insertContent(input: ContentItem, expectedRevision: number | null): ContentItem {
    idSchema.parse(input.id);
    idSchema.parse(input.processId);
    assertJsonSafe(input.fields);
    const r = this.db
      .prepare('SELECT revision,process_id FROM content_items WHERE id=?')
      .get(input.id);
    if (
      (r && (Number(r.revision) !== expectedRevision || r.process_id !== input.processId)) ||
      (!r && expectedRevision !== null)
    )
      throw new DomainError('REVISION_CONFLICT', 'Content changed or belongs to another Process');
    const item = { ...structuredClone(input), revision: r ? Number(r.revision) + 1 : 0 };
    this.db
      .prepare(
        'INSERT INTO content_items VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,fields=excluded.fields,ignored=excluded.ignored',
      )
      .run(
        item.id,
        item.processId,
        item.revision,
        canonicalJson(item.fields),
        Number(item.ignored),
      );
    this.db.prepare('DELETE FROM content_assets WHERE content_id=?').run(item.id);
    for (const [index, assetId] of item.assetIds.entries())
      this.db.prepare('INSERT INTO content_assets VALUES(?,?,?)').run(item.id, assetId, index);
    return item;
  }
  createJob(job: JobDefinition, snapshot: JobSnapshot): void {
    this.transaction(() => this.insertJob(job, snapshot));
  }
  private insertJob(job: JobDefinition, snapshot: JobSnapshot): void {
    jobSchema.parse(job);
    requireBundle(snapshot.bundle);
    hashSchema.parse(snapshot.workflowHash);
    if (job.state !== 'SCHEDULED' || job.revision !== 0)
      throw new DomainError(
        'INVALID_INITIAL_JOB',
        'New jobs must start scheduled at revision zero',
      );
    if (
      snapshot.workflowHash !== bundleHash(snapshot.bundle) ||
      this.getVersion(snapshot.workflowVersionId).hash !== snapshot.workflowHash ||
      snapshot.contentId !== job.contentId
    )
      throw new DomainError('SNAPSHOT_MISMATCH', 'Snapshot refs/hash do not match');
    const content = this.db
      .prepare('SELECT process_id FROM content_items WHERE id=?')
      .get(job.contentId);
    const process = this.getProcess(job.processId);
    if (
      content?.process_id !== job.processId ||
      process.deviceId !== job.deviceId ||
      process.workflowVersionId !== snapshot.workflowVersionId
    )
      throw new DomainError(
        'JOB_BINDING_MISMATCH',
        'Job bindings do not match Process/content/version',
      );
    this.db
      .prepare('INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(
        job.id,
        job.occurrenceKey,
        job.processId,
        job.deviceId,
        job.contentId,
        new Date(job.scheduledUtc).toISOString(),
        job.state,
        job.revision,
        job.priority,
        canonicalJson(snapshot),
        contentHash(snapshot),
        now(),
      );
  }

  /**
   * Private immutable media plan. Host path grants never leave DB worker except
   * to the trusted host service, and are not accepted from public input.
   */
  jobMediaPreflightPlan(jobId: string, hostId: string): JobMediaPreflightPlan {
    idSchema.parse(jobId);
    idSchema.parse(hostId);
    const { job, snapshot, snapshotHash } = this.getJob(jobId);
    if (!['SCHEDULED', 'QUEUED', 'PREFLIGHT'].includes(job.state))
      throw new DomainError('JOB_MEDIA_PHASE', 'Job is not eligible for media inspection.');
    if (this.db.prepare('SELECT 1 FROM effects WHERE job_id=? LIMIT 1').get(jobId))
      throw new DomainError('JOB_EFFECT_PRESENT', 'External effects require review first.');
    const process = this.getProcess(job.processId);
    if (process.archived)
      throw new DomainError('PROCESS_ARCHIVED', 'Process is archived.');
    if (snapshot.contentId !== job.contentId ||
        snapshot.workflowHash !== bundleHash(snapshot.bundle) ||
        process.deviceId !== job.deviceId)
      throw new DomainError('JOB_MEDIA_SNAPSHOT_INVALID', 'Immutable job bindings do not match.');
    const ids = snapshot.assetIds;
    if (!Array.isArray(ids) || ids.length > 32 || new Set(ids).size !== ids.length)
      throw new DomainError('MEDIA_PREFLIGHT_BUDGET', 'At most 32 distinct owned media in one check.');
    const entries: JobMediaPreflightPlan['entries'] = [];
    for (const assetId of ids) {
      idSchema.parse(assetId);
      const pinned = snapshot.assets?.filter((a) => a.id === assetId) ?? [];
      if (pinned.length !== 1 ||
          pinned[0]!.state !== 'READY' ||
          !Number.isSafeInteger(pinned[0]!.bytes) ||
          pinned[0]!.bytes <= 0 ||
          !hashSchema.safeParse(pinned[0]!.hash).success)
        throw new DomainError('MEDIA_PIN_UNVERIFIED', 'Frozen media evidence is incomplete.');
      const binding = this.mediaAssetBinding(job.processId, assetId, hostId);
      if (
        binding.expectedHash !== pinned[0]!.hash ||
        binding.observedHash !== pinned[0]!.hash ||
        binding.state !== 'READY'
      ) throw new DomainError('MEDIA_LEDGER_CHANGED', 'Registered source no longer matches the job.');
      entries.push({
        assetId, pinnedHash: pinned[0]!.hash,
        pinnedBytes: pinned[0]!.bytes, binding,
      });
    }
    return { jobId, jobRevision: job.revision, snapshotHash, entries };
  }

  getJob(id: string): { job: JobDefinition; snapshot: JobSnapshot; snapshotHash: string } {
    const r = this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id);
    if (!r) throw new DomainError('NOT_FOUND', 'Job not found');
    const snapshot = parse<JobSnapshot>(r.snapshot);
    if (contentHash(snapshot) !== r.snapshot_hash)
      throw new DomainError('CORRUPT_SNAPSHOT', 'Job snapshot hash mismatch');
    const job = jobSchema.parse({
      id,
      occurrenceKey: r.occurrence_key,
      processId: r.process_id,
      deviceId: r.device_id,
      contentId: r.content_id,
      scheduledUtc: r.scheduled_utc,
      state: r.state,
      revision: r.revision,
      priority: r.priority,
    });
    return { job, snapshot, snapshotHash: String(r.snapshot_hash) };
  }
  /**
   * Read-only persisted checks on one pinned job. Never claim the device, mutate
   * a job/effect, invoke ADB or treat stored metadata as live certification.
   */
  inspectJobPreflight(id: string, at = Date.now()): JobPreflightReport {
    idSchema.parse(id);
    if (!Number.isSafeInteger(at) || !Number.isFinite(new Date(at).getTime()))
      throw new DomainError('INVALID_PREFLIGHT_CLOCK', 'Invalid inspection clock.');
    const { job, snapshot } = this.getJob(id);
    const blockers: JobPreflightReport['blockers'] = [];
    const seen = new Set<string>();
    const add = (code: string, message: string): void => {
      if (!seen.has(code) && blockers.length < 24) {
        blockers.push({ code, message });
        seen.add(code);
      }
    };
    if (!['SCHEDULED', 'QUEUED', 'PREFLIGHT'].includes(job.state))
      add('JOB_NOT_PENDING', 'Công việc không ở trạng thái chờ kiểm tra.');
    const process = this.getProcess(job.processId);
    if (process.archived) add('PROCESS_ARCHIVED', 'Tiến trình đã lưu trữ.');
    if (process.deviceId !== job.deviceId)
      add('PROCESS_DEVICE_CHANGED', 'Liên kết điện thoại của tiến trình đã đổi.');
    if (
      snapshot.contentId !== job.contentId ||
      snapshot.workflowHash !== bundleHash(snapshot.bundle)
    ) add('PINNED_SNAPSHOT_MISMATCH', 'Workflow hoặc nội dung đóng băng không khớp.');
    try {
      const version = this.getVersion(snapshot.workflowVersionId);
      if (
        version.hash !== snapshot.workflowHash ||
        version.workflowId !== snapshot.bundle.workflow.id
      ) add('PINNED_VERSION_MISMATCH', 'Phiên bản workflow đã lưu không khớp snapshot.');
    } catch {
      add('PINNED_VERSION_MISSING', 'Phiên bản workflow của công việc không còn khả dụng.');
    }
    try {
      const ir = compileWorkflow(snapshot.bundle, (versionId) => this.getVersion(versionId));
      if (ir.effectPathAudit.issues.length)
        add('STATIC_EFFECT_AUDIT_FAILED', 'Đường đi external effect của workflow chưa an toàn.');
    } catch {
      add('WORKFLOW_COMPILATION_FAILED', 'Không thể kiểm định workflow đã đóng băng.');
    }
    const device = this.db.prepare('SELECT enabled FROM devices WHERE id=?').get(job.deviceId);
    if (!device) add('DEVICE_NOT_REGISTERED', 'Thiết bị của công việc không còn trong registry.');
    else if (!device.enabled) add('DEVICE_DISABLED', 'Thiết bị đã bị tắt trong registry.');
    const profile = this.db.prepare('SELECT identity FROM device_profiles WHERE device_id=?')
      .get(job.deviceId);
    if (profile?.identity !== 'VERIFIED_PROPERTIES')
      add(
        profile?.identity === 'CONFLICT' ? 'DEVICE_IDENTITY_CONFLICT' : 'DEVICE_IDENTITY_UNVERIFIED',
        'Nhận diện phần cứng chưa được xác minh an toàn.',
      );
    const lease = this.db.prepare(
      'SELECT owner_id,expires_at FROM leases WHERE device_id=?',
    ).get(job.deviceId);
    if (lease?.owner_id && Number(lease.expires_at) > at)
      add('DEVICE_LEASE_BUSY', 'Thiết bị đang thuộc quyền thao tác khác.');
    const effects = this.db.prepare('SELECT state FROM effects WHERE job_id=? LIMIT 2').all(id);
    const unresolvedEffect = effects.some((effect) =>
      ['INTENT', 'ATTEMPT_UNCERTAIN', 'NEEDS_REVIEW'].includes(String(effect.state)),
    );
    if (unresolvedEffect)
      add('EXTERNAL_EFFECT_REVIEW', 'Có external effect chưa được đối soát; không tự đăng lại.');
    else if (effects.length)
      add('EXTERNAL_EFFECT_ALREADY_RECORDED', 'Có external effect đã ghi nhận; không tự phát lại.');
    const frozenAssets = snapshot.assets ?? [];
    const assetIds = snapshot.assetIds ?? [];
    if (assetIds.length > 250 || new Set(assetIds).size !== assetIds.length)
      add('MEDIA_SCOPE_INVALID', 'Danh sách media đóng băng vượt giới hạn hoặc trùng ID.');
    else {
      const assetQuery = this.db.prepare('SELECT hash FROM assets WHERE id=?');
      const bindings = this.db.prepare(
        'SELECT e.state,e.hash,e.observed_hash,s.active FROM source_entries e ' +
        'JOIN sources s ON s.id=e.source_id WHERE e.asset_id=? AND s.process_id=?',
      );
      for (const assetId of assetIds) {
        const pinned = frozenAssets.filter((item) => item.id === assetId);
        if (pinned.length !== 1 || pinned[0]?.state !== 'READY') {
          add('MEDIA_SNAPSHOT_UNVERIFIED', 'Media đóng băng thiếu hoặc không ở trạng thái sẵn sàng.');
          continue;
        }
        const stored = assetQuery.get(assetId);
        if (!stored || stored.hash !== pinned[0]!.hash)
          add('MEDIA_HASH_MISMATCH', 'Media không khớp hash đã đóng băng.');
        const entries = bindings.all(assetId, job.processId);
        if (entries.length !== 1) {
          add('MEDIA_SOURCE_UNVERIFIED', 'Chưa xác định duy nhất một nguồn media thuộc tiến trình.');
          continue;
        }
        if (
          !entries[0]!.active ||
          entries[0]!.state !== 'READY' ||
          entries[0]!.hash !== pinned[0]!.hash ||
          entries[0]!.observed_hash !== pinned[0]!.hash
        ) add('MEDIA_CHANGED_OR_MISSING', 'Nguồn media đã đổi, thiếu hoặc chưa được quét hợp lệ.');
      }
    }
    // Last and unconditional: DB-only checks can NEVER certify a real posting.
    blockers.push({
      code: 'LIVE_PROFILE_NOT_CERTIFIED',
      message: 'Chưa có kiểm chứng trực tiếp Android, phiên bản app, tài khoản, đích đăng và nhà cung cấp.',
    });
    return {
      jobId: job.id,
      jobRevision: job.revision,
      inspectedAt: new Date(at).toISOString(),
      scope: 'PERSISTED_ONLY',
      status: unresolvedEffect || job.state === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' : 'BLOCKED',
      canDispatch: false,
      blockers,
    };
  }

  transitionJob(id: string, to: JobDefinition['state'], expectedRevision: number): JobDefinition {
    return this.transaction(() => {
      const { job } = this.getJob(id);
      if (job.revision !== expectedRevision)
        throw new DomainError('REVISION_CONFLICT', 'Job changed');
      const pending = Boolean(
        this.db
          .prepare(
            "SELECT 1 FROM effects WHERE job_id=? AND state IN('ATTEMPT_UNCERTAIN','NEEDS_REVIEW')",
          )
          .get(id),
      );
      assertJobTransition(job.state, to, pending);
      if (to === 'RUNNING' &&
          this.db.prepare('SELECT 1 FROM device_stage_transfers WHERE job_id=? LIMIT 1').get(id))
        throw new DomainError('DEVICE_STAGE_UNVERIFIED', 'Android MediaStore verification missing.');
      this.db.prepare('UPDATE jobs SET state=?,revision=revision+1 WHERE id=?').run(to, id);
      return { ...job, state: to, revision: job.revision + 1 };
    });
  }
  acquireLease(
    deviceId: string,
    ownerId: string,
    kind: DeviceLease['ownerKind'],
    at: number,
    ttl = 30000,
  ): DeviceLease {
    return this.transaction(() => this.insertLease(deviceId, ownerId, kind, at, ttl));
  }
  private insertLease(
    deviceId: string,
    ownerId: string,
    kind: DeviceLease['ownerKind'],
    at: number,
    ttl: number,
  ): DeviceLease {
    idSchema.parse(deviceId);
    idSchema.parse(ownerId);
    if (
      !Number.isSafeInteger(at) ||
      !Number.isSafeInteger(ttl) ||
      !Number.isSafeInteger(at + ttl) ||
      ttl < 1 ||
      ttl > 300000
    )
      throw new DomainError('INVALID_LEASE', 'Invalid lease duration/time');
    const current = this.db.prepare('SELECT * FROM leases WHERE device_id=?').get(deviceId);
    if (current?.owner_id && Number(current.expires_at) > at)
      throw new DomainError('DEVICE_BUSY', 'Device is owned by another operation');
    if (
      ['JOB', 'APK', 'NETWORK'].includes(kind) &&
      this.db
        .prepare(
          "SELECT 1 FROM effects e JOIN jobs j ON e.job_id=j.id WHERE j.device_id=? AND e.state IN('ATTEMPT_UNCERTAIN','NEEDS_REVIEW')",
        )
        .get(deviceId)
    )
      throw new DomainError('DEVICE_NEEDS_REVIEW', 'Uncertain device effects require review');
    const generation = Number(current?.generation ?? 0) + 1,
      expiresAt = at + ttl;
    this.db
      .prepare(
        'INSERT INTO leases VALUES(?,?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET owner_id=excluded.owner_id,owner_kind=excluded.owner_kind,generation=excluded.generation,expires_at=excluded.expires_at',
      )
      .run(deviceId, ownerId, kind, generation, expiresAt);
    return { deviceId, ownerId, ownerKind: kind, generation, expiresAt };
  }
  assertLease(lease: DeviceLease, at: number): void {
    if (!Number.isSafeInteger(at)) throw new DomainError('INVALID_LEASE', 'Invalid lease clock');
    const row = this.db.prepare('SELECT * FROM leases WHERE device_id=?').get(lease.deviceId);
    if (
      !row ||
      row.owner_id !== lease.ownerId ||
      row.owner_kind !== lease.ownerKind ||
      Number(row.generation) !== lease.generation ||
      Number(row.expires_at) <= at
    )
      throw new DomainError('STALE_LEASE', 'Lease is expired or has been superseded');
  }
  releaseLease(lease: DeviceLease): void {
    this.db
      .prepare(
        'UPDATE leases SET owner_id=NULL,owner_kind=NULL,expires_at=0 WHERE device_id=? AND owner_id=? AND generation=?',
      )
      .run(lease.deviceId, lease.ownerId, lease.generation);
  }
  private queueEvent(jobId: string, kind: string, detail: JsonValue, at: number): void {
    this.db
      .prepare('INSERT INTO queue_events VALUES(?,?,?,?,?)')
      .run(makeId('queueEvent'), jobId, kind, canonicalJson(detail), new Date(at).toISOString());
  }

  /**
   * Reconcile only persisted, never-claimed jobs that became due during a real,
   * observed OS sleep gap. No guessed startup gaps, Android input or effect replay.
   */
  reconcileSleepGap(
    suspendedAt: number,
    resumedAt: number,
  ): {
    queued: string[];
    skipped: string[];
    postponed: { jobId: string; scheduledUtc: string }[];
    review: string[];
  } {
    const gap = resumedAt - suspendedAt;
    if (
      !Number.isSafeInteger(suspendedAt) ||
      !Number.isSafeInteger(resumedAt) ||
      !Number.isFinite(new Date(suspendedAt).getTime()) ||
      !Number.isFinite(new Date(resumedAt).getTime()) ||
      gap < 30000 ||
      gap > 7 * 24 * 60 * 60 * 1000
    )
      throw new DomainError(
        'INVALID_SLEEP_GAP',
        'Chỉ xử lý khoảng sleep thực đã quan sát từ 30 giây đến 7 ngày.',
      );
    const beganUtc = new Date(suspendedAt).toISOString(),
      resumedUtc = new Date(resumedAt).toISOString();
    return this.transaction(() => {
      const rows = this.db
        .prepare(
          "SELECT j.id FROM jobs j JOIN processes p ON p.id=j.process_id WHERE p.archived=0 AND j.state IN('SCHEDULED','QUEUED') AND julianday(j.scheduled_utc)>julianday(?) AND julianday(j.scheduled_utc)<=julianday(?) ORDER BY julianday(j.scheduled_utc),j.id LIMIT 5001",
        )
        .all(beganUtc, resumedUtc);
      if (rows.length > 5000)
        throw new DomainError(
          'SLEEP_RECOVERY_BUDGET',
          'Hơn 5000 job bị lỡ; cần xử lý theo các khoảng nhỏ, không truncate.',
        );
      const result: {
        queued: string[];
        skipped: string[];
        postponed: { jobId: string; scheduledUtc: string }[];
        review: string[];
      } = { queued: [], skipped: [], postponed: [], review: [] };
      for (const row of rows) {
        const id = String(row.id),
          record = this.getJob(id),
          originalTime = record.job.scheduledUtc,
          hasEffect = Boolean(
            this.db.prepare('SELECT 1 FROM effects WHERE job_id=?').get(id),
          ),
          frozen = scheduleProfileSchema.safeParse(record.snapshot.scheduleProfile);
        const profile = frozen.success ? frozen.data : null;
        const markReview = (code: string): void => {
          assertJobTransition(record.job.state, 'NEEDS_REVIEW', hasEffect);
          this.db
            .prepare("UPDATE jobs SET state='NEEDS_REVIEW',revision=revision+1 WHERE id=?")
            .run(id);
          this.queueEvent(
            id,
            'SLEEP_NEEDS_REVIEW',
            { code, previousUtc: originalTime, hadEffect: hasEffect },
            resumedAt,
          );
          result.review.push(id);
        };
        if (!profile || hasEffect) {
          markReview(hasEffect ? 'EFFECT_PRESENT' : 'FROZEN_PROFILE_UNAVAILABLE');
          continue;
        }
        const action = overdueAction(profile.overduePolicy, 'SLEEP_GAP', false);
        if (action === 'REVIEW') {
          markReview('RECOVERY_POLICY_REVIEW');
          continue;
        }
        if (action === 'QUEUE') {
          if (record.job.state === 'QUEUED') continue;
          assertJobTransition(record.job.state, 'QUEUED');
          this.db.prepare("UPDATE jobs SET state='QUEUED',revision=revision+1 WHERE id=?").run(id);
          this.queueEvent(id, 'SLEEP_CATCH_UP', { previousUtc: originalTime }, resumedAt);
          result.queued.push(id);
          continue;
        }
        if (action === 'SKIP') {
          assertJobTransition(record.job.state, 'SKIPPED');
          this.db.prepare("UPDATE jobs SET state='SKIPPED',revision=revision+1 WHERE id=?").run(id);
          this.queueEvent(id, 'SLEEP_SKIP', { previousUtc: originalTime }, resumedAt);
          result.skipped.push(id);
          continue;
        }
        try {
          const occupied = this.db
            .prepare(
              "SELECT scheduled_utc FROM jobs WHERE device_id=? AND id<>? AND state NOT IN('SUCCESS','SUCCESS_WITH_WARNINGS','FAILED','CANCELLED','SKIPPED') AND julianday(scheduled_utc)>julianday(?) LIMIT 5001",
            )
            .all(record.job.deviceId, id, resumedUtc);
          if (occupied.length > 5000)
            throw new DomainError(
              'RECOVERY_RESOURCE_BUDGET',
              'Quá nhiều lịch tương lai cùng thiết bị.',
            );
          const seed = parseInt(
            contentHash({ id, occurrenceKey: record.job.occurrenceKey }).slice(0, 8),
            16,
          );
          const slot = nextAvailableRecoverySlot(
            profile,
            resumedUtc,
            occupied.map((r) => String(r.scheduled_utc)),
            seed,
          );
          if (record.job.state !== 'SCHEDULED')
            assertJobTransition(record.job.state, 'SCHEDULED');
          const nextUtc = new Date(Date.parse(slot.scheduledUtc)).toISOString();
          this.db
            .prepare("UPDATE jobs SET state='SCHEDULED',scheduled_utc=?,revision=revision+1 WHERE id=?")
            .run(nextUtc, id);
          this.queueEvent(
            id,
            'SLEEP_NEXT_SLOT',
            {
              previousUtc: originalTime,
              scheduledUtc: nextUtc,
              jitterMinutes: slot.jitterMinutes,
              crossesLocalDay: slot.crossesLocalDay,
            },
            resumedAt,
          );
          result.postponed.push({ jobId: id, scheduledUtc: nextUtc });
        } catch (error) {
          if (!(error instanceof DomainError)) throw error;
          markReview(error.code);
        }
      }
      return result;
    });
  }

  claimDueJob(deviceId: string, ownerId: string, at: number, ttl = 30000): QueueClaimResult {
    idSchema.parse(deviceId);
    idSchema.parse(ownerId);
    if (
      !Number.isSafeInteger(at) ||
      !Number.isSafeInteger(ttl) ||
      !Number.isSafeInteger(at + ttl) ||
      !Number.isFinite(new Date(at).getTime()) ||
      ttl < 1 ||
      ttl > 300000
    )
      throw new DomainError('INVALID_LEASE', 'Invalid queue clock/TTL');
    return this.transaction(() => {
      const device = this.db.prepare('SELECT enabled FROM devices WHERE id=?').get(deviceId);
      if (!device?.enabled) return { status: 'DEVICE_DISABLED' };
      // A latched hardware identity conflict is an operator-review gate even
      // when a previously scheduled job is due. Do not allocate a new lease.
      if (
        this.db
          .prepare("SELECT 1 FROM device_profiles WHERE device_id=? AND identity='CONFLICT'")
          .get(deviceId)
      )
        return { status: 'NEEDS_REVIEW' };
      if (
        this.db
          .prepare("SELECT 1 FROM jobs WHERE device_id=? AND state='NEEDS_REVIEW'")
          .get(deviceId) ||
        this.db
          .prepare(
            "SELECT 1 FROM effects e JOIN jobs j ON j.id=e.job_id WHERE j.device_id=? AND e.state IN('ATTEMPT_UNCERTAIN','NEEDS_REVIEW')",
          )
          .get(deviceId) ||
        this.db.prepare(
          'SELECT 1 FROM device_stage_transfers WHERE device_id=? LIMIT 1',
        ).get(deviceId)
      )
        return { status: 'NEEDS_REVIEW' };
      const owner = this.db
        .prepare('SELECT owner_id,expires_at FROM leases WHERE device_id=?')
        .get(deviceId);
      if (
        (owner?.owner_id && Number(owner.expires_at) > at) ||
        this.db
          .prepare(
            "SELECT 1 FROM jobs WHERE device_id=? AND state IN('PREFLIGHT','RUNNING','POST_INTENT','POST_PENDING','POSTED','COMMENT_PENDING')",
          )
          .get(deviceId)
      )
        return { status: 'DEVICE_BUSY' };
      const due = this.db
        .prepare(
          "SELECT j.id FROM jobs j JOIN processes p ON p.id=j.process_id WHERE j.device_id=? AND j.state IN('SCHEDULED','QUEUED') AND p.archived=0 AND julianday(j.scheduled_utc)<=julianday(?) AND NOT EXISTS(SELECT 1 FROM effects e WHERE e.job_id=j.id) ORDER BY julianday(j.scheduled_utc),j.priority DESC,j.created_at,j.id LIMIT 1",
        )
        .get(deviceId, new Date(at).toISOString());
      if (!due) return { status: 'EMPTY' };
      const original = this.getJob(String(due.id)),
        lease = this.insertLease(deviceId, ownerId, 'JOB', at, ttl);
      const steps = original.job.state === 'SCHEDULED' ? 2 : 1;
      this.db
        .prepare("UPDATE jobs SET state='PREFLIGHT',revision=revision+? WHERE id=?")
        .run(steps, original.job.id);
      this.db
        .prepare(
          'INSERT INTO job_claims VALUES(?,?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET owner_id=excluded.owner_id,generation=excluded.generation,expires_at=excluded.expires_at',
        )
        .run(original.job.id, deviceId, ownerId, lease.generation, lease.expiresAt);
      this.queueEvent(
        original.job.id,
        'CLAIMED',
        { ownerId, generation: lease.generation, mode: 'PREFLIGHT_ONLY' },
        at,
      );
      return { status: 'CLAIMED', ...this.getJob(original.job.id), lease };
    });
  }
  renewJobClaim(jobId: string, lease: DeviceLease, at: number, ttl = 30000): DeviceLease {
    if (!Number.isSafeInteger(ttl) || !Number.isSafeInteger(at + ttl) || ttl < 1 || ttl > 300000)
      throw new DomainError('INVALID_LEASE', 'Invalid renewal TTL');
    return this.transaction(() => {
      this.assertLease(lease, at);
      const claim = this.db.prepare('SELECT * FROM job_claims WHERE job_id=?').get(jobId),
        job = this.getJob(jobId).job;
      if (
        !claim ||
        lease.ownerKind !== 'JOB' ||
        claim.device_id !== lease.deviceId ||
        claim.owner_id !== lease.ownerId ||
        Number(claim.generation) !== lease.generation ||
        ![
          'PREFLIGHT',
          'RUNNING',
          'POST_INTENT',
          'POST_PENDING',
          'POSTED',
          'COMMENT_PENDING',
        ].includes(job.state)
      )
        throw new DomainError('STALE_CLAIM', 'Job claim does not match active owner');
      const expiresAt = Math.max(Number(claim.expires_at), at + ttl);
      this.db
        .prepare('UPDATE leases SET expires_at=? WHERE device_id=?')
        .run(expiresAt, lease.deviceId);
      this.db.prepare('UPDATE job_claims SET expires_at=? WHERE job_id=?').run(expiresAt, jobId);
      this.queueEvent(jobId, 'LEASE_RENEWED', { generation: lease.generation, expiresAt }, at);
      return { ...lease, expiresAt };
    });
  }
  recoverExpiredClaims(deviceId: string, at: number): { requeued: string[]; review: string[] } {
    idSchema.parse(deviceId);
    if (!Number.isSafeInteger(at) || !Number.isFinite(new Date(at).getTime()))
      throw new DomainError('INVALID_LEASE', 'Invalid recovery clock');
    return this.transaction(() => {
      const result: { requeued: string[]; review: string[] } = { requeued: [], review: [] };
      for (const claim of this.db
        .prepare('SELECT * FROM job_claims WHERE device_id=? ORDER BY job_id')
        .all(deviceId)) {
        const owner = this.db.prepare('SELECT * FROM leases WHERE device_id=?').get(deviceId),
          matches =
            owner?.owner_id === claim.owner_id &&
            owner?.owner_kind === 'JOB' &&
            Number(owner?.generation) === Number(claim.generation);
        if (matches && Number(owner.expires_at) > at && Number(claim.expires_at) > at) continue;
        const { job } = this.getJob(String(claim.job_id));
        const hasEffect = Boolean(
          this.db.prepare('SELECT 1 FROM effects WHERE job_id=?').get(job.id),
        );
        const hasStage = Boolean(
          this.db.prepare('SELECT 1 FROM device_stage_transfers WHERE job_id=?').get(job.id),
        );
        if (job.state === 'NEEDS_REVIEW' && hasStage) {
          // Historical claim belongs to a previous JOB generation; retain it,
          // without creating duplicate review events during repeated recovery.
          if (matches)
            this.db.prepare(
              'UPDATE leases SET owner_id=NULL,owner_kind=NULL,expires_at=0 WHERE device_id=?',
            ).run(deviceId);
          continue;
        }
        if (job.state === 'PREFLIGHT' && !hasEffect && !hasStage) {
          this.db
            .prepare("UPDATE jobs SET state='QUEUED',revision=revision+1 WHERE id=?")
            .run(job.id);
          result.requeued.push(job.id);
          this.queueEvent(
            job.id,
            'PRECHECK_REQUEUED',
            { lostGeneration: Number(claim.generation) },
            at,
          );
        } else if (
          [
            'PREFLIGHT',
            'RUNNING',
            'POST_INTENT',
            'POST_PENDING',
            'POSTED',
            'COMMENT_PENDING',
          ].includes(job.state)
        ) {
          this.db
            .prepare("UPDATE jobs SET state='NEEDS_REVIEW',revision=revision+1 WHERE id=?")
            .run(job.id);
          result.review.push(job.id);
          this.queueEvent(
            job.id,
            'NEEDS_REVIEW',
            { lostGeneration: Number(claim.generation), previousState: job.state, hasEffect, hasStage },
            at,
          );
        } else
          this.queueEvent(
            job.id,
            'CLAIM_RELEASED',
            { state: job.state, lostGeneration: Number(claim.generation) },
            at,
          );
        if (matches)
          this.db
            .prepare(
              'UPDATE leases SET owner_id=NULL,owner_kind=NULL,expires_at=0 WHERE device_id=?',
            )
            .run(deviceId);
        // Only an expired stage-backed review keeps the old JOB claim.
        if (!(hasStage && result.review.includes(job.id)))
          this.db.prepare('DELETE FROM job_claims WHERE job_id=?').run(job.id);
      }
      return result;
    });
  }



  private stageTransfer(id: string): DeviceStageTransfer {
    idSchema.parse(id);
    const row = this.db.prepare('SELECT * FROM device_stage_transfers WHERE id=?').get(id);
    if (!row) throw new DomainError('STAGE_NOT_FOUND', 'Remote stage intent is missing.');
    return {
      id: String(row.id),
      jobId: String(row.job_id),
      deviceId: String(row.device_id),
      hostId: String(row.host_id),
      assetId: String(row.asset_id),
      ordinal: Number(row.ordinal),
      snapshotHash: String(row.snapshot_hash),
      expectedHash: String(row.expected_hash),
      expectedBytes: Number(row.expected_bytes),
      claimGeneration: Number(row.claim_generation),
      remotePath: String(row.remote_path),
      nonce: String(row.nonce),
      state: row.state as DeviceStageTransfer['state'],
      remoteReadbackHash: row.remote_readback_hash == null ? null : String(row.remote_readback_hash),
      remoteReadbackBytes: row.remote_readback_bytes == null ? null : Number(row.remote_readback_bytes),
      remoteReadbackAt: row.remote_readback_at == null ? null : String(row.remote_readback_at),
      mediaStoreRowId: row.mediastore_row_id == null ? null : String(row.mediastore_row_id),
      mediaStoreDisplayName: row.mediastore_display_name == null ? null : String(row.mediastore_display_name),
      mediaStoreRelativePath: row.mediastore_relative_path == null ? null : String(row.mediastore_relative_path),
      mediaStoreMimeType: row.mediastore_mime_type == null ? null : String(row.mediastore_mime_type),
      mediaStoreBytes: row.mediastore_bytes == null ? null : Number(row.mediastore_bytes),
      mediaStoreAt: row.mediastore_at == null ? null : String(row.mediastore_at),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  /**
   * Redacted read-only operator inventory: stage and append-only observations
   * are persisted facts, NOT a live Android/MediaStore/picker certification.
   * Never serialize stage ids, paths, nonces, hashes or lease owner identifiers.
   */
  jobStageReview(jobId: string, cursor?: string): JobStageReviewPage {
    idSchema.parse(jobId);
    const { job, snapshot, snapshotHash } = this.getJob(jobId);
    let before: { createdAt: string; id: string } | null = null;
    if (cursor !== undefined) {
      if (typeof cursor !== 'string' || !/^[A-Za-z0-9_-]{1,1024}$/.test(cursor))
        throw new DomainError('STAGE_REVIEW_CURSOR_INVALID', 'Invalid stage review cursor.');
      try {
        const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
        if (Buffer.from(decoded).toString('base64url') !== cursor)
          throw new Error('Noncanonical cursor');
        const value: unknown = JSON.parse(decoded);
        if (!value || typeof value !== 'object' || Array.isArray(value))
          throw new Error('Invalid cursor object');
        const entry = value as Record<string, unknown>;
        if (Object.keys(entry).sort().join(',') !== 'createdAt,id,jobId,revision' ||
            !idSchema.safeParse(entry.jobId).success ||
            !Number.isSafeInteger(entry.revision) ||
            Number(entry.revision) < 0 ||
            typeof entry.createdAt !== 'string' ||
            !Number.isFinite(Date.parse(entry.createdAt)) ||
            new Date(entry.createdAt).toISOString() !== entry.createdAt ||
            !idSchema.safeParse(entry.id).success)
          throw new Error('Invalid cursor content');
        if (entry.jobId !== jobId)
          throw new DomainError('STAGE_REVIEW_CURSOR_SCOPE', 'Cursor belongs to another job.');
        if (entry.revision !== job.revision)
          throw new DomainError('STAGE_REVIEW_CURSOR_STALE', 'Job changed; reload stage evidence.');
        before = { createdAt: entry.createdAt, id: String(entry.id) };
      } catch (error) {
        if (error instanceof DomainError) throw error;
        throw new DomainError('STAGE_REVIEW_CURSOR_INVALID', 'Invalid stage review cursor.');
      }
    }

    const stageRows = this.db.prepare(
      'SELECT ordinal,state, ' +
      '(remote_readback_hash=expected_hash AND remote_readback_bytes=expected_bytes AND remote_readback_at IS NOT NULL) AS remote_matched, ' +
      '(mediastore_row_id IS NOT NULL AND mediastore_at IS NOT NULL) AS row_recorded ' +
      'FROM device_stage_transfers WHERE job_id=? ORDER BY ordinal LIMIT 33',
    ).all(jobId);
    if (stageRows.length > 32)
      throw new DomainError('STAGE_REVIEW_LIMIT', 'Stage journal exceeds the job media limit.');
    const stages: JobStageReviewPage['stages'] = stageRows.map((row) => ({
      ordinal: Number(row.ordinal),
      state: row.state as JobStageReviewPage['stages'][number]['state'],
      remoteBytes: Number(row.remote_matched) === 1
        ? 'MATCH_RECORDED_NOT_LIVE' : 'NOT_RECORDED',
      mediaStore: Number(row.row_recorded) === 1
        ? 'ROW_RECORDED_NOT_PICKER_VERIFIED' : 'NOT_RECORDED',
    }));
    const predicate = before
      ? " AND (r.created_at<? OR (r.created_at=? AND r.id<?))" : '';
    const query = 'SELECT r.id,r.created_at,r.classification,r.mediastore_status,r.lease_owner_kind,s.ordinal ' +
      'FROM device_stage_reconciliations r JOIN device_stage_transfers s ON s.id=r.stage_id ' +
      'WHERE r.job_id=?' + predicate + ' ORDER BY r.created_at DESC,r.id DESC LIMIT 21';
    const args: Array<string> = before
      ? [jobId, before.createdAt, before.createdAt, before.id] : [jobId];
    const rows = this.db.prepare(query).all(...args);
    const hasMore = rows.length > 20;
    const page = rows.slice(0, 20);
    const observations: JobStageReviewPage['observations'] = page.map((row) => ({
      stageOrdinal: Number(row.ordinal),
      classification: row.classification as JobStageReviewPage['observations'][number]['classification'],
      mediaStoreStatus: row.mediastore_status == null ? null
        : row.mediastore_status as JobStageReviewPage['observations'][number]['mediaStoreStatus'],
      leaseOwnerKind: row.lease_owner_kind as 'JOB' | 'MANUAL',
      createdAt: String(row.created_at),
    }));
    const reviewRows = this.db.prepare(
      'SELECT r.created_at,r.state,s.ordinal ' +
      'FROM device_stage_cleanup_reviews r ' +
      'JOIN device_stage_transfers s ON s.id=r.stage_id ' +
      'WHERE r.job_id=? ORDER BY r.created_at DESC,r.request_id DESC LIMIT 21',
    ).all(jobId);
    const cleanupHasMore = reviewRows.length > 20;
    const cleanupRequests: JobStageReviewPage['cleanupRequests'] =
      reviewRows.slice(0, 20).map((row) => ({
        stageOrdinal: Number(row.ordinal),
        recordedAt: String(row.created_at),
        status: 'REVIEW_REQUESTED_HARDWARE_PENDING',
      }));
    // S096: ordered frozen media vs immutable, uniquely owned stage/row evidence.
    // No live picker claim; all raw paths/row IDs/hashes remain inside DB worker.
    const ownedStages = this.listDeviceStageTransfers(jobId);
    const claim = this.db.prepare('SELECT generation FROM job_claims WHERE job_id=?')
      .get(jobId);
    const latestByStage = new Map<string, LastStageObservation>();
    const lastAudit = this.db.prepare(
      'SELECT classification,mediastore_status,observed_hash,observed_bytes ' +
      'FROM device_stage_reconciliations WHERE stage_id=? ' +
      'ORDER BY created_at DESC,id DESC LIMIT 1',
    );
    for (const stage of ownedStages) {
      const record = lastAudit.get(stage.id);
      if (!record) continue;
      latestByStage.set(stage.id, {
        classification: String(record.classification) as LastStageObservation['classification'],
        mediaStoreStatus: record.mediastore_status == null ? null
          : String(record.mediastore_status) as LastStageObservation['mediaStoreStatus'],
        observedHash: record.observed_hash == null ? null : String(record.observed_hash),
        observedBytes: record.observed_bytes == null ? null : Number(record.observed_bytes),
      });
    }
    const hasExternalEffect = Boolean(this.db.prepare(
      'SELECT 1 FROM effects WHERE job_id=? LIMIT 1',
    ).get(jobId));
    const mediaOrder = assessPersistedMediaOrder({
      job, snapshot, snapshotHash, stages: ownedStages,
      claimGeneration: claim ? Number(claim.generation) : null,
      hasExternalEffect,
      lastObservationByStage: latestByStage,
    });
    // Compute privately from the immutable snapshot; NEVER return raw Unicode
    // strings, URL text or SHA-256 fingerprints through the renderer/HTTP DTO.
    const unicode = deriveFrozenUnicodeTextPlan(snapshot);
    const frozenUnicode = unicode.summary;
    const compose = deriveFrozenComposeExpectation({
      job, snapshot, snapshotHash, mediaOrder, unicode, hasExternalEffect,
    }).summary;
    const last = page.at(-1);
    const nextCursor = hasMore && last
      ? Buffer.from(JSON.stringify({
          jobId, revision: job.revision,
          createdAt: String(last.created_at), id: String(last.id),
        })).toString('base64url')
      : null;
    return {
      jobId, jobRevision: job.revision, jobState: job.state, scope: 'PERSISTED_ONLY',
      canDispatch: false, stages, observations, cleanupRequests, cleanupHasMore,
      mediaOrder, frozenUnicode, compose, hasMore, nextCursor,
    };
  }

  /** Trusted DB-worker only; never send stage records to public authoring IPC. */
  listDeviceStageTransfers(jobId: string): DeviceStageTransfer[] {
    idSchema.parse(jobId);
    return this.db
      .prepare('SELECT id FROM device_stage_transfers WHERE job_id=? ORDER BY ordinal LIMIT 33')
      .all(jobId)
      .map((row) => this.stageTransfer(String(row.id)));
  }

  /**
   * Persist owner/remote destination before any Android byte write.
   * Only a verified JOB claim and frozen media source may create an intent.
   */
  prepareClaimedDeviceStage(args: {
    jobId: string;
    hostId: string;
    ordinal: number;
    expectedJobRevision: number;
    expectedSnapshotHash: string;
    lease: DeviceLease;
    at: number;
  }): DeviceStageTransfer {
    idSchema.parse(args.jobId);
    idSchema.parse(args.hostId);
    hashSchema.parse(args.expectedSnapshotHash);
    if (!Number.isSafeInteger(args.ordinal) || args.ordinal < 0 || args.ordinal >= 32 ||
        !Number.isSafeInteger(args.expectedJobRevision) || args.expectedJobRevision < 0)
      throw new DomainError('STAGE_INPUT_INVALID', 'Invalid ordinal or job revision.');
    return this.transaction(() => {
      this.assertEffectClaim(args.jobId, args.lease, args.at);
      const { job, snapshotHash } = this.getJob(args.jobId);
      if (job.state !== 'PREFLIGHT' || job.revision !== args.expectedJobRevision ||
          job.deviceId !== args.lease.deviceId ||
          snapshotHash !== args.expectedSnapshotHash)
        throw new DomainError('STAGE_JOB_STALE', 'Claimed job or immutable snapshot changed.');
      if (this.db.prepare('SELECT 1 FROM effects WHERE job_id=? LIMIT 1').get(job.id))
        throw new DomainError('STAGE_EFFECT_PRESENT', 'External effect exists; stage needs review.');
      if (this.db.prepare(
        'SELECT 1 FROM device_stage_transfers WHERE job_id=? AND ordinal=?',
      ).get(job.id, args.ordinal))
        throw new DomainError('STAGE_ALREADY_PREPARED', 'Remote asset already has a durable intent.');
      const plan = this.jobMediaPreflightPlan(job.id, args.hostId);
      const asset = plan.entries[args.ordinal];
      if (!asset || plan.entries.length > 32)
        throw new DomainError('STAGE_ASSET_INVALID', 'No frozen asset at this ordinal.');
      const extension = extname(asset.binding.relativePath).toLowerCase();
      if (!/^\.(?:mp4|mov|mkv|webm|m4v|avi|jpg|jpeg|png|webp|gif|bmp)$/.test(extension) ||
          !Number.isSafeInteger(asset.pinnedBytes) || asset.pinnedBytes <= 0 ||
          asset.pinnedBytes > 512 * 1024 * 1024)
        throw new DomainError('STAGE_ASSET_INVALID', 'Unsupported or overbudget pinned media.');
      const nonce = randomUUID().replaceAll('-', ''),
        remotePath = '/sdcard/Download/AutoReelsStudio/job-' + job.id +
          '/asset-' + String(args.ordinal).padStart(3, '0') + '-' + nonce + extension,
        id = makeId('stage'),
        timestamp = new Date(args.at).toISOString();
      this.db.prepare(
        'INSERT INTO device_stage_transfers(' +
        'id,job_id,device_id,host_id,asset_id,ordinal,snapshot_hash,expected_hash,' +
        'expected_bytes,claim_generation,remote_path,nonce,state,created_at,updated_at' +
        ') VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ).run(
        id, job.id, job.deviceId, args.hostId, asset.assetId, args.ordinal,
        snapshotHash, asset.pinnedHash, asset.pinnedBytes, args.lease.generation,
        remotePath, nonce, 'INTENT', timestamp, timestamp,
      );
      this.queueEvent(job.id, 'DEVICE_STAGE_INTENT', {
        stageId: id, ordinal: args.ordinal, claimGeneration: args.lease.generation,
      }, args.at);
      return this.stageTransfer(id);
    });
  }

  private assertStageClaim(
    stage: DeviceStageTransfer, lease: DeviceLease,
    expectedJobRevision: number, at: number,
  ): void {
    this.assertEffectClaim(stage.jobId, lease, at);
    const { job, snapshotHash } = this.getJob(stage.jobId);
    if (stage.deviceId !== lease.deviceId ||
        stage.claimGeneration !== lease.generation ||
        job.state !== 'PREFLIGHT' ||
        job.revision !== expectedJobRevision ||
        snapshotHash !== stage.snapshotHash ||
        this.db.prepare('SELECT 1 FROM effects WHERE job_id=?').get(job.id))
      throw new DomainError('STAGE_CLAIM_STALE', 'Transfer no longer has a valid claim.');
  }

  /**
   * Private read-only fence invoked before each ADB Sync side-effect.
   * A different owner/generation, phase or snapshot never authorizes I/O.
   */
  assertClaimedDeviceStageAttempt(
    stageId: string, lease: DeviceLease, expectedJobRevision: number, at: number,
  ): void {
    const stage = this.stageTransfer(stageId);
    this.assertStageClaim(stage, lease, expectedJobRevision, at);
    if (stage.state !== 'TRANSFER_UNCERTAIN')
      throw new DomainError('STAGE_ATTEMPT_NOT_ACTIVE', 'Staging attempt is not active.');
  }

  /** Persist uncertainty in SQLite BEFORE the ADB Sync SEND boundary. */
  beginClaimedDeviceStageAttempt(args: {
    stageId: string;
    lease: DeviceLease;
    expectedJobRevision: number;
    at: number;
  }): DeviceStageTransfer {
    return this.transaction(() => {
      const stage = this.stageTransfer(args.stageId);
      this.assertStageClaim(stage, args.lease, args.expectedJobRevision, args.at);
      if (stage.state !== 'INTENT')
        throw new DomainError('STAGE_NOT_ELIGIBLE', 'Remote staging was already attempted.');
      this.db.prepare(
        "UPDATE device_stage_transfers SET state='TRANSFER_UNCERTAIN',updated_at=? WHERE id=?",
      ).run(new Date(args.at).toISOString(), stage.id);
      this.queueEvent(stage.jobId, 'DEVICE_STAGE_TRANSFER_UNCERTAIN', {
        stageId: stage.id, ordinal: stage.ordinal, claimGeneration: stage.claimGeneration,
      }, args.at);
      return this.stageTransfer(stage.id);
    });
  }

  /** ADB Sync ACK does NOT prove a MediaStore index or selected asset. */
  recordClaimedDeviceStageSyncAck(args: {
    stageId: string;
    lease: DeviceLease;
    expectedJobRevision: number;
    at: number;
  }): DeviceStageTransfer {
    return this.transaction(() => {
      const stage = this.stageTransfer(args.stageId);
      this.assertStageClaim(stage, args.lease, args.expectedJobRevision, args.at);
      if (stage.state !== 'TRANSFER_UNCERTAIN')
        throw new DomainError('STAGE_NOT_ELIGIBLE', 'Only uncertain transfers may record ACK.');
      this.db.prepare(
        "UPDATE device_stage_transfers SET state='SYNC_ACK_UNVERIFIED',updated_at=? WHERE id=?",
      ).run(new Date(args.at).toISOString(), stage.id);
      this.queueEvent(stage.jobId, 'DEVICE_STAGE_ACK_NOT_INDEXED', {
        stageId: stage.id, ordinal: stage.ordinal, claimGeneration: stage.claimGeneration,
      }, args.at);
      return this.stageTransfer(stage.id);
    });
  }

  /** Store exact remote byte equality; this does not certify MediaStore indexing. */
  recordClaimedDeviceStageRemoteReadback(args: {
    stageId: string;
    lease: DeviceLease;
    expectedJobRevision: number;
    observedHash: string;
    observedBytes: number;
    at: number;
  }): DeviceStageTransfer {
    idSchema.parse(args.stageId);
    hashSchema.parse(args.observedHash);
    if (!Number.isSafeInteger(args.observedBytes) || args.observedBytes <= 0 ||
        !Number.isSafeInteger(args.at) || !Number.isFinite(new Date(args.at).getTime()))
      throw new DomainError('STAGE_READBACK_INVALID', 'Invalid remote readback evidence.');
    return this.transaction(() => {
      const stage = this.stageTransfer(args.stageId);
      this.assertStageClaim(stage, args.lease, args.expectedJobRevision, args.at);
      if (stage.state !== 'SYNC_ACK_UNVERIFIED')
        throw new DomainError('STAGE_READBACK_NOT_ELIGIBLE', 'Sync ACK is required before readback.');
      if (stage.remoteReadbackHash !== null || stage.remoteReadbackBytes !== null ||
          stage.remoteReadbackAt !== null)
        throw new DomainError('STAGE_READBACK_ALREADY_RECORDED', 'Remote readback evidence is immutable.');
      if (args.observedHash !== stage.expectedHash || args.observedBytes !== stage.expectedBytes)
        throw new DomainError('STAGE_READBACK_MISMATCH', 'Remote bytes differ from pinned media.');
      const timestamp = new Date(args.at).toISOString();
      const changed = this.db.prepare(
        'UPDATE device_stage_transfers SET remote_readback_hash=?,remote_readback_bytes=?,' +
        'remote_readback_at=?,updated_at=? WHERE id=? AND state=? AND remote_readback_hash IS NULL',
      ).run(args.observedHash, args.observedBytes, timestamp, timestamp, stage.id, 'SYNC_ACK_UNVERIFIED');
      if (Number(changed.changes) !== 1)
        throw new DomainError('STAGE_READBACK_CONFLICT', 'Remote readback changed concurrently.');
      this.queueEvent(stage.jobId, 'DEVICE_STAGE_REMOTE_BYTES_VERIFIED', {
        stageId: stage.id, ordinal: stage.ordinal, claimGeneration: stage.claimGeneration,
      }, args.at);
      return this.stageTransfer(stage.id);
    });
  }


  /** Persist one exact MediaStore row only after matching remote byte readback. */
  recordClaimedDeviceStageMediaStore(args: {
    stageId: string; lease: DeviceLease; expectedJobRevision: number;
    rowId: string; displayName: string; relativePath: string; mimeType: string;
    observedBytes: number; at: number;
  }): DeviceStageTransfer {
    idSchema.parse(args.stageId);
    if (!/^\d+$/.test(args.rowId) || args.rowId.length > 20 ||
        typeof args.displayName !== 'string' || args.displayName.length < 1 || args.displayName.length > 180 ||
        typeof args.relativePath !== 'string' || args.relativePath.length > 300 ||
        !/^(?:image|video)\/[a-z0-9.+-]+$/.test(args.mimeType) ||
        !Number.isSafeInteger(args.observedBytes) || args.observedBytes <= 0 ||
        !Number.isSafeInteger(args.at) || !Number.isFinite(new Date(args.at).getTime()))
      throw new DomainError('STAGE_MEDIASTORE_INVALID', 'Invalid MediaStore observation.');
    return this.transaction(() => {
      const stage = this.stageTransfer(args.stageId);
      this.assertStageClaim(stage, args.lease, args.expectedJobRevision, args.at);
      if (stage.state !== 'SYNC_ACK_UNVERIFIED' ||
          stage.remoteReadbackHash !== stage.expectedHash || stage.remoteReadbackBytes !== stage.expectedBytes)
        throw new DomainError('STAGE_MEDIASTORE_READBACK_REQUIRED', 'Matching remote byte readback is required.');
      if (stage.mediaStoreRowId !== null || stage.mediaStoreAt !== null)
        throw new DomainError('STAGE_MEDIASTORE_ALREADY_RECORDED', 'MediaStore evidence is immutable.');
      const expectedName = stage.remotePath.split('/').at(-1);
      const expectedRelative = 'Download/AutoReelsStudio/job-' + stage.jobId + '/';
      const extension = extname(expectedName ?? '').toLowerCase();
      const family = /^\.(?:jpg|jpeg|png|webp|gif|bmp)$/.test(extension) ? 'image/' : 'video/';
      if (!expectedName || args.displayName !== expectedName ||
          args.relativePath.replace(/^\/+/, '') !== expectedRelative ||
          args.observedBytes !== stage.expectedBytes || !args.mimeType.startsWith(family))
        throw new DomainError('STAGE_MEDIASTORE_MISMATCH', 'MediaStore row does not match the owned stage.');
      const timestamp = new Date(args.at).toISOString();
      const changed = this.db.prepare(
        'UPDATE device_stage_transfers SET mediastore_row_id=?,mediastore_display_name=?,' +
        'mediastore_relative_path=?,mediastore_mime_type=?,mediastore_bytes=?,mediastore_at=?,updated_at=? ' +
        'WHERE id=? AND state=? AND mediastore_row_id IS NULL',
      ).run(args.rowId, args.displayName, expectedRelative, args.mimeType,
        args.observedBytes, timestamp, timestamp, stage.id, 'SYNC_ACK_UNVERIFIED');
      if (Number(changed.changes) !== 1)
        throw new DomainError('STAGE_MEDIASTORE_CONFLICT', 'MediaStore evidence changed concurrently.');
      this.queueEvent(stage.jobId, 'DEVICE_STAGE_MEDIASTORE_ROW_MATCHED', {
        stageId: stage.id, ordinal: stage.ordinal, claimGeneration: stage.claimGeneration,
      }, args.at);
      return this.stageTransfer(stage.id);
    });
  }


  /** Only an active MANUAL lease may inspect a stage after expired JOB recovery. */
  assertReviewedDeviceStage(args: {
    stageId: string; hostId: string; expectedJobRevision: number;
    expectedSnapshotHash: string; lease: DeviceLease; at: number;
  }): void {
    idSchema.parse(args.stageId);
    idSchema.parse(args.hostId);
    hashSchema.parse(args.expectedSnapshotHash);
    if (args.lease.ownerKind !== 'MANUAL' ||
        !Number.isSafeInteger(args.expectedJobRevision) || args.expectedJobRevision < 0 ||
        !Number.isSafeInteger(args.at) || !Number.isFinite(new Date(args.at).getTime()))
      throw new DomainError('STAGE_REVIEW_LEASE_REQUIRED', 'A current MANUAL review lease is required.');
    this.assertLease(args.lease, args.at);
    const stage = this.stageTransfer(args.stageId);
    const { job, snapshotHash } = this.getJob(stage.jobId);
    const claim = this.db.prepare('SELECT * FROM job_claims WHERE job_id=?').get(job.id);
    if (stage.hostId !== args.hostId || stage.deviceId !== args.lease.deviceId ||
        stage.snapshotHash !== args.expectedSnapshotHash || snapshotHash !== args.expectedSnapshotHash ||
        job.deviceId !== stage.deviceId || job.state !== 'NEEDS_REVIEW' ||
        job.revision !== args.expectedJobRevision ||
        !['TRANSFER_UNCERTAIN', 'SYNC_ACK_UNVERIFIED'].includes(stage.state) ||
        !claim || claim.device_id !== stage.deviceId ||
        Number(claim.generation) !== stage.claimGeneration ||
        Number(claim.expires_at) > args.at ||
        this.db.prepare('SELECT 1 FROM job_claims WHERE device_id=? AND expires_at>? LIMIT 1')
          .get(stage.deviceId, args.at))
      throw new DomainError('STAGE_REVIEW_NOT_ELIGIBLE', 'Review stage or historical JOB claim is stale.');
    const device = this.db.prepare(
      'SELECT d.enabled,p.identity FROM devices d LEFT JOIN device_profiles p ON p.device_id=d.id WHERE d.id=?',
    ).get(stage.deviceId);
    if (!device?.enabled || device.identity !== 'VERIFIED_PROPERTIES')
      throw new DomainError('STAGE_REVIEW_DEVICE_BLOCKED', 'Verified device identity is required.');
  }

  /** Frozen job asset identity, without accessing mutable local media grants. */
  reviewedDeviceStageMediaSnapshot(args: {
    stageId: string; hostId: string; expectedJobRevision: number;
    expectedSnapshotHash: string; lease: DeviceLease; at: number;
  }): ReviewedStageMediaSnapshot {
    this.assertReviewedDeviceStage(args);
    const stage = this.stageTransfer(args.stageId);
    const { job, snapshot, snapshotHash } = this.getJob(stage.jobId);
    if (snapshot.contentId !== job.contentId ||
        snapshot.workflowHash !== bundleHash(snapshot.bundle) ||
        !Array.isArray(snapshot.assetIds) || snapshot.assetIds.length > 32 ||
        new Set(snapshot.assetIds).size !== snapshot.assetIds.length)
      throw new DomainError('STAGE_REVIEW_SNAPSHOT_STALE', 'Frozen job media bindings are invalid.');
    const assetId = snapshot.assetIds[stage.ordinal];
    const pinned = snapshot.assets?.filter((item) => item.id === assetId) ?? [];
    const extension = extname(stage.remotePath).toLowerCase();
    const expectedRemote = '/sdcard/Download/AutoReelsStudio/job-' + stage.jobId +
      '/asset-' + String(stage.ordinal).padStart(3, '0') + '-' + stage.nonce + extension;
    if (!assetId || pinned.length !== 1 || pinned[0]!.state !== 'READY' ||
        pinned[0]!.hash !== stage.expectedHash ||
        pinned[0]!.bytes !== stage.expectedBytes ||
        stage.assetId !== assetId || stage.remotePath !== expectedRemote ||
        !/^\.(?:mp4|mov|mkv|webm|m4v|avi|jpg|jpeg|png|webp|gif|bmp)$/.test(extension))
      throw new DomainError('STAGE_REVIEW_SNAPSHOT_STALE', 'Frozen stage asset does not match the job.');
    return {
      jobId: stage.jobId, jobRevision: job.revision, snapshotHash,
      ordinal: stage.ordinal, assetId, pinnedHash: stage.expectedHash,
      pinnedBytes: stage.expectedBytes, extension,
    };
  }

  /**
   * Private non-destructive cleanup preflight. Current MANUAL ownership and
   * stored observations are necessary but never sufficient for Android unlink.
   */
  assessOwnedStageCleanup(args: {
    stageId: string; hostId: string; expectedJobRevision: number;
    expectedSnapshotHash: string; lease: DeviceLease; at: number;
  }): OwnedStageCleanupAssessment {
    this.assertReviewedDeviceStage(args);
    const stage = this.stageTransfer(args.stageId);
    const frozen = this.reviewedDeviceStageMediaSnapshot(args);
    assertOwnedStageLocation({
      jobId: stage.jobId, ordinal: stage.ordinal, nonce: stage.nonce,
      extension: frozen.extension, remotePath: stage.remotePath,
    });
    const blockers: OwnedStageCleanupAssessment['blockers'] = [];
    const add = (reason: OwnedStageCleanupAssessment['blockers'][number]): void => {
      if (!blockers.includes(reason)) blockers.push(reason);
    };
    if (stage.state !== 'SYNC_ACK_UNVERIFIED') add('TRANSFER_NOT_ACKNOWLEDGED');
    if (stage.remoteReadbackHash !== stage.expectedHash ||
        stage.remoteReadbackBytes !== stage.expectedBytes ||
        stage.remoteReadbackAt === null)
      add('REMOTE_READBACK_NOT_PINNED');
    if (stage.mediaStoreRowId !== null || stage.mediaStoreAt !== null)
      add('MEDIASTORE_ROW_RECORDED');
    if (this.db.prepare('SELECT 1 FROM effects WHERE job_id=? LIMIT 1').get(stage.jobId))
      add('EXTERNAL_EFFECT_PRESENT');
    // No resolution executor exists: an earlier review remains hardware-pending
    // across restarts and new MANUAL generations, never a new cleanup ticket.
    if (this.db.prepare(
      'SELECT 1 FROM device_stage_cleanup_reviews WHERE stage_id=? LIMIT 1',
    ).get(stage.id))
      add('CLEANUP_REVIEW_ALREADY_PENDING');
    if (this.db.prepare(
      "SELECT 1 FROM device_stage_reconciliations WHERE stage_id=? AND mediastore_status='INDEXED_EXACT' LIMIT 1",
    ).get(stage.id))
      add('MEDIASTORE_EVER_INDEXED');

    const latest = this.db.prepare(
      'SELECT lease_owner_kind,lease_generation,claim_generation,classification,' +
      'observed_hash,observed_bytes,mediastore_status,created_at ' +
      'FROM device_stage_reconciliations WHERE stage_id=? ' +
      'ORDER BY created_at DESC,id DESC LIMIT 1',
    ).get(stage.id);
    const current = latest?.lease_owner_kind === 'MANUAL' &&
      Number(latest.lease_generation) === args.lease.generation &&
      Number(latest.claim_generation) === stage.claimGeneration;
    if (!current) add('CURRENT_MANUAL_OBSERVATION_REQUIRED');
    if (current) {
      const observedAt = Date.parse(String(latest!.created_at));
      if (!Number.isFinite(observedAt) || observedAt > args.at ||
          args.at - observedAt > 30000)
        add('OBSERVATION_STALE');
      if (latest!.classification !== 'REMOTE_BYTES_MATCHED' ||
          latest!.mediastore_status !== 'NOT_INDEXED' ||
          latest!.observed_hash !== stage.expectedHash ||
          Number(latest!.observed_bytes) !== stage.expectedBytes)
        add('REMOTE_OR_INDEX_NOT_CLEARED');
    }
    return {
      jobId: stage.jobId, ordinal: stage.ordinal,
      scope: 'PERSISTED_PREFLIGHT_ONLY',
      status: blockers.length ? 'BLOCKED' : 'PREREQUISITES_MET',
      blockers,
      observationAt: current ? String(latest!.created_at) : null,
      canDelete: false,
      canDispatch: false,
    };
  }

  /**
   * Append an immutable operator review request under an active MANUAL lease.
   * No Android action is queued; persisted consent is NOT deletion permission.
   */
  recordOwnedStageCleanupReviewRequest(args: {
    requestId: string; stageId: string; hostId: string;
    expectedJobRevision: number; expectedSnapshotHash: string;
    lease: DeviceLease; confirmed: true; at: number;
  }): OwnedStageCleanupReviewReceipt {
    idSchema.parse(args.requestId);
    if (args.confirmed !== true)
      throw new DomainError('CLEANUP_REVIEW_CONFIRMATION_REQUIRED',
        'Only a privately confirmed operator request may be stored.');
    return this.transaction(() => {
      // BEGIN IMMEDIATE guarantees revalidation and insert see one state.
      const assessment = this.assessOwnedStageCleanup(args);
      const pendingOnly = assessment.blockers.length === 1 &&
        assessment.blockers[0] === 'CLEANUP_REVIEW_ALREADY_PENDING';
      if (assessment.status !== 'PREREQUISITES_MET' && !pendingOnly)
        throw new DomainError('CLEANUP_REVIEW_NOT_ELIGIBLE',
          'Cleanup review prerequisites changed; no request was stored.');
      const stage = this.stageTransfer(args.stageId);
      const latest = this.db.prepare(
        'SELECT id,lease_owner_kind,lease_generation,claim_generation,classification,' +
        'mediastore_status,observed_hash,observed_bytes,created_at ' +
        'FROM device_stage_reconciliations WHERE stage_id=? ' +
        'ORDER BY created_at DESC,id DESC LIMIT 1',
      ).get(stage.id);
      if (!latest || latest.lease_owner_kind !== 'MANUAL' ||
          Number(latest.lease_generation) !== args.lease.generation ||
          Number(latest.claim_generation) !== stage.claimGeneration ||
          latest.classification !== 'REMOTE_BYTES_MATCHED' ||
          latest.mediastore_status !== 'NOT_INDEXED' ||
          latest.observed_hash !== stage.expectedHash ||
          Number(latest.observed_bytes) !== stage.expectedBytes ||
          assessment.observationAt !== String(latest.created_at))
        throw new DomainError('CLEANUP_REVIEW_OBSERVATION_STALE',
          'Exact current observation is required.');
      const prior = this.db.prepare(
        'SELECT * FROM device_stage_cleanup_reviews WHERE request_id=?',
      ).get(args.requestId);
      if (prior) {
        if (prior.stage_id !== stage.id || prior.job_id !== stage.jobId ||
            prior.device_id !== stage.deviceId || prior.host_id !== args.hostId ||
            prior.snapshot_hash !== args.expectedSnapshotHash ||
            Number(prior.job_revision) !== args.expectedJobRevision ||
            Number(prior.claim_generation) !== stage.claimGeneration ||
            Number(prior.lease_generation) !== args.lease.generation ||
            prior.reconciliation_id !== latest.id)
          throw new DomainError('CLEANUP_REVIEW_IDEMPOTENCY_CONFLICT',
            'Request ID is already bound to another observation.');
        return {
          requestId: String(prior.request_id), jobId: stage.jobId,
          ordinal: stage.ordinal, recordedAt: String(prior.created_at),
          status: 'REVIEW_REQUESTED_HARDWARE_PENDING',
          canDelete: false, canDispatch: false,
        };
      }
      // Same ID is idempotent only while *all* other guards remain current.
      // A distinct ID cannot create a second unresolved request even when a
      // later MANUAL lease produces a new reconciliation audit.
      if (pendingOnly || this.db.prepare(
        'SELECT 1 FROM device_stage_cleanup_reviews WHERE stage_id=? LIMIT 1',
      ).get(stage.id))
        throw new DomainError('CLEANUP_REVIEW_ALREADY_PENDING',
          'A cleanup review is already pending for this stage.');
      const recordedAt = new Date(args.at).toISOString();
      this.db.prepare(
        'INSERT INTO device_stage_cleanup_reviews(' +
        'request_id,stage_id,job_id,device_id,host_id,snapshot_hash,' +
        'job_revision,claim_generation,lease_generation,reconciliation_id,state,created_at) ' +
        'VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
      ).run(
        args.requestId, stage.id, stage.jobId, stage.deviceId, args.hostId,
        args.expectedSnapshotHash, args.expectedJobRevision,
        stage.claimGeneration, args.lease.generation, String(latest.id),
        'REVIEW_REQUESTED_HARDWARE_PENDING', recordedAt,
      );
      return {
        requestId: args.requestId, jobId: stage.jobId, ordinal: stage.ordinal,
        recordedAt, status: 'REVIEW_REQUESTED_HARDWARE_PENDING',
        canDelete: false, canDispatch: false,
      };
    });
  }

  /** Persisted history never doubles as an executable recovery queue. */
  listOwnedStageCleanupReviewRequests(jobId: string): OwnedStageCleanupReviewReceipt[] {
    idSchema.parse(jobId);
    // Fail on unknown jobs instead of exposing whether arbitrary IDs exist in the journal.
    this.getJob(jobId);
    const rows = this.db.prepare(
      'SELECT r.request_id,r.created_at,r.state,s.ordinal ' +
      'FROM device_stage_cleanup_reviews r ' +
      'JOIN device_stage_transfers s ON s.id=r.stage_id ' +
      'WHERE r.job_id=? ORDER BY r.created_at DESC,r.request_id DESC LIMIT 51',
    ).all(jobId);
    if (rows.length > 50)
      throw new DomainError('CLEANUP_REVIEW_HISTORY_LIMIT', 'Review history requires pagination.');
    return rows.map((row) => ({
      requestId: String(row.request_id), jobId, ordinal: Number(row.ordinal),
      recordedAt: String(row.created_at),
      status: 'REVIEW_REQUESTED_HARDWARE_PENDING' as const,
      canDelete: false as const, canDispatch: false as const,
    }));
  }

  /** Append fenced reconciliation evidence; never mutates stage/job state. */
  recordClaimedDeviceStageReconciliation(args: {
    requestId: string; stageId: string; lease: DeviceLease; expectedJobRevision: number;
    hostId?: string; expectedSnapshotHash?: string;
    classification: StageReconciliationClassification; observedHash: string | null;
    observedBytes: number | null; mediaStoreStatus: DeviceStageReconciliation['mediaStoreStatus']; at: number;
  }): DeviceStageReconciliation {
    idSchema.parse(args.requestId); idSchema.parse(args.stageId);
    const allowed: StageReconciliationClassification[] = [
      'REMOTE_BYTES_MATCHED','MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED','REMOTE_MISSING',
      'REMOTE_MISMATCH','PROBE_UNSUPPORTED','REVIEW_REQUIRED',
    ];
    if (!allowed.includes(args.classification) ||
        (args.observedHash !== null && !hashSchema.safeParse(args.observedHash).success) ||
        (args.observedBytes !== null && (!Number.isSafeInteger(args.observedBytes) || args.observedBytes <= 0)) ||
        !Number.isSafeInteger(args.at) || !Number.isFinite(new Date(args.at).getTime()))
      throw new DomainError('STAGE_RECONCILIATION_INVALID','Invalid reconciliation evidence.');
    if (['REMOTE_BYTES_MATCHED','MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED'].includes(args.classification) &&
        (args.observedHash === null || args.observedBytes === null))
      throw new DomainError('STAGE_RECONCILIATION_INVALID','Verified result requires hash and bytes.');
    return this.transaction(() => {
      const stage = this.stageTransfer(args.stageId);
      if (args.lease.ownerKind === 'MANUAL') {
        if (!args.hostId || !args.expectedSnapshotHash)
          throw new DomainError('STAGE_REVIEW_LEASE_REQUIRED', 'Review host and snapshot are required.');
        this.assertReviewedDeviceStage({
          stageId: stage.id, hostId: args.hostId, expectedJobRevision: args.expectedJobRevision,
          expectedSnapshotHash: args.expectedSnapshotHash, lease: args.lease, at: args.at,
        });
      } else {
        this.assertStageClaim(stage,args.lease,args.expectedJobRevision,args.at);
      }
      const old = this.db.prepare('SELECT * FROM device_stage_reconciliations WHERE stage_id=? AND request_id=?')
        .get(stage.id,args.requestId);
      if (old) {
        if (String(old.classification)!==args.classification ||
            (old.observed_hash==null?null:String(old.observed_hash))!==args.observedHash ||
            (old.observed_bytes==null?null:Number(old.observed_bytes))!==args.observedBytes ||
            (old.mediastore_status==null?null:String(old.mediastore_status))!==args.mediaStoreStatus ||
            old.lease_owner_kind !== args.lease.ownerKind ||
            Number(old.lease_generation) !== args.lease.generation)
          throw new DomainError('STAGE_RECONCILIATION_IDEMPOTENCY_CONFLICT','Request ID has different evidence.');
        return {id:String(old.id),requestId:String(old.request_id),stageId:String(old.stage_id),
          jobId:String(old.job_id),deviceId:String(old.device_id),hostId:String(old.host_id),
          claimGeneration:Number(old.claim_generation),
          leaseOwnerKind:old.lease_owner_kind as 'JOB' | 'MANUAL',
          leaseGeneration:Number(old.lease_generation),
          classification:String(old.classification) as StageReconciliationClassification,
          observedHash:old.observed_hash==null?null:String(old.observed_hash),
          observedBytes:old.observed_bytes==null?null:Number(old.observed_bytes),
          mediaStoreStatus:old.mediastore_status==null?null:String(old.mediastore_status) as DeviceStageReconciliation['mediaStoreStatus'],
          createdAt:String(old.created_at)};
      }
      const validMediaStoreStatuses = ['INDEXED_EXACT', 'NOT_INDEXED', 'AMBIGUOUS', 'UNSUPPORTED'];
      if (args.mediaStoreStatus !== null && !validMediaStoreStatuses.includes(args.mediaStoreStatus))
        throw new DomainError('STAGE_RECONCILIATION_INVALID', 'Invalid MediaStore status.');
      const exactBytes = args.observedHash === stage.expectedHash && args.observedBytes === stage.expectedBytes;
      if (args.classification === 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED' &&
          args.mediaStoreStatus !== 'INDEXED_EXACT')
        throw new DomainError('STAGE_RECONCILIATION_INVALID', 'MediaStore-match classification requires an exact indexed row.');
      if (args.classification === 'REMOTE_BYTES_MATCHED' && args.mediaStoreStatus !== 'NOT_INDEXED')
        throw new DomainError('STAGE_RECONCILIATION_INVALID', 'Remote-byte-only classification requires an explicit not-indexed result.');
      if (args.classification === 'REMOTE_MISSING' &&
          (args.observedHash !== null || args.observedBytes !== null || args.mediaStoreStatus === 'INDEXED_EXACT'))
        throw new DomainError('STAGE_RECONCILIATION_INVALID', 'Remote-missing classification cannot carry present-file evidence.');
      if (args.classification === 'REMOTE_MISMATCH' &&
          (exactBytes || args.mediaStoreStatus === 'INDEXED_EXACT'))
        throw new DomainError('STAGE_RECONCILIATION_INVALID', 'Remote-mismatch classification conflicts with matching evidence.');
      if (args.classification === 'PROBE_UNSUPPORTED' && args.mediaStoreStatus !== 'UNSUPPORTED')
        throw new DomainError('STAGE_RECONCILIATION_INVALID', 'Unsupported classification requires an unsupported probe status.');
      if (['REMOTE_BYTES_MATCHED','MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED'].includes(args.classification) &&
          !exactBytes)
        throw new DomainError('STAGE_RECONCILIATION_MISMATCH','Observed bytes do not match pinned stage.');
      const id=makeId('stage_reconcile'), createdAt=new Date(args.at).toISOString();
      this.db.prepare('INSERT INTO device_stage_reconciliations(id,request_id,stage_id,job_id,device_id,host_id,claim_generation,lease_owner_kind,lease_generation,classification,observed_hash,observed_bytes,mediastore_status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(id,args.requestId,stage.id,stage.jobId,stage.deviceId,stage.hostId,stage.claimGeneration,
          args.lease.ownerKind,args.lease.generation,
          args.classification,args.observedHash,args.observedBytes,args.mediaStoreStatus,createdAt);
      this.queueEvent(stage.jobId,'DEVICE_STAGE_RECONCILIATION_RECORDED',{
        stageId:stage.id,claimGeneration:stage.claimGeneration,classification:args.classification,
      },args.at);
      return {id,requestId:args.requestId,stageId:stage.id,jobId:stage.jobId,deviceId:stage.deviceId,
        hostId:stage.hostId,claimGeneration:stage.claimGeneration,
        leaseOwnerKind:args.lease.ownerKind as 'JOB' | 'MANUAL',leaseGeneration:args.lease.generation,
        classification:args.classification,
        observedHash:args.observedHash,observedBytes:args.observedBytes,mediaStoreStatus:args.mediaStoreStatus,createdAt};
    });
  }

  /** Called only inside an SQLite transaction; validates both lease and claim fencing. */
  private assertEffectClaim(jobId: string, lease: DeviceLease, at: number): void {
    idSchema.parse(jobId);
    if (
      !Number.isSafeInteger(at) ||
      !Number.isFinite(new Date(at).getTime()) ||
      lease.ownerKind !== 'JOB'
    ) throw new DomainError('INVALID_EFFECT_CLAIM', 'A current JOB lease is required.');
    this.assertLease(lease, at);
    const claim = this.db.prepare('SELECT * FROM job_claims WHERE job_id=?').get(jobId);
    if (
      !claim ||
      claim.device_id !== lease.deviceId ||
      claim.owner_id !== lease.ownerId ||
      Number(claim.generation) !== lease.generation ||
      Number(claim.expires_at) <= at
    ) throw new DomainError('STALE_EFFECT_CLAIM', 'Job claim no longer belongs to this owner.');
    const device = this.db
      .prepare('SELECT d.enabled,p.identity FROM devices d LEFT JOIN device_profiles p ON p.device_id=d.id WHERE d.id=?')
      .get(lease.deviceId);
    if (!device?.enabled || device.identity !== 'VERIFIED_PROPERTIES')
      throw new DomainError('EFFECT_DEVICE_BLOCKED', 'Verified and enabled device identity is required.');
  }

  /** Commit the matching immutable intent and job phase before ANY external input. */
  prepareClaimedEffect(args: {
    jobId: string;
    expectedJobRevision: number;
    expectedSnapshotHash: string;
    nodeId: string;
    kind: 'PUBLISH' | 'COMMENT';
    effectKey: string;
    payloadHash: string;
    lease: DeviceLease;
    at: number;
  }): { effectId: string; jobId: string; jobRevision: number; state: 'INTENT' } {
    idSchema.parse(args.jobId);
    idSchema.parse(args.nodeId);
    hashSchema.parse(args.effectKey);
    hashSchema.parse(args.payloadHash);
    hashSchema.parse(args.expectedSnapshotHash);
    if (
      !Number.isSafeInteger(args.expectedJobRevision) ||
      args.expectedJobRevision < 0 ||
      (args.kind !== 'PUBLISH' && args.kind !== 'COMMENT')
    ) throw new DomainError('INVALID_EFFECT_INTENT', 'Invalid kind or job revision.');
    return this.transaction(() => {
      this.assertEffectClaim(args.jobId, args.lease, args.at);
      const { job, snapshot, snapshotHash } = this.getJob(args.jobId);
      if (job.deviceId !== args.lease.deviceId || job.revision !== args.expectedJobRevision)
        throw new DomainError('STALE_EFFECT_JOB', 'Job or revision changed.');
      if (snapshotHash !== args.expectedSnapshotHash || contentHash(snapshot) !== snapshotHash)
        throw new DomainError('EFFECT_SNAPSHOT_STALE', 'Pinned job snapshot changed.');
      const nodes = snapshot.bundle.graphs.flatMap((g) => g.nodes).filter(
        (n) => n.id === args.nodeId && n.type === 'tap' &&
          String(n.config.effectClassification ?? '').toUpperCase() === args.kind,
      );
      if (nodes.length !== 1)
        throw new DomainError('EFFECT_NODE_MISMATCH', 'Effect node not in pinned workflow.');
      if (this.db.prepare('SELECT 1 FROM device_stage_transfers WHERE job_id=? LIMIT 1').get(job.id))
        throw new DomainError('DEVICE_STAGE_UNVERIFIED', 'Unverified device media staging blocks effects.');
      const fromState = args.kind === 'PUBLISH' ? 'RUNNING' : 'POSTED';
      const toState = args.kind === 'PUBLISH' ? 'POST_INTENT' : 'COMMENT_PENDING';
      if (job.state !== fromState)
        throw new DomainError('EFFECT_JOB_PHASE', 'Job is not in effect-ready phase.');
      if (this.db.prepare(
        "SELECT 1 FROM effects WHERE job_id=? AND state IN('INTENT','ATTEMPT_UNCERTAIN','NEEDS_REVIEW') LIMIT 1",
      ).get(job.id))
        throw new DomainError('PENDING_EFFECT', 'Review previous external effect before another.');
      if (this.db.prepare('SELECT 1 FROM effects WHERE effect_key=?').get(args.effectKey))
        throw new DomainError('DUPLICATE_EFFECT_KEY', 'Effect key has a durable record.');
      if (
        args.kind === 'PUBLISH' &&
        this.db.prepare("SELECT 1 FROM effects WHERE job_id=? AND kind='PUBLISH'").get(job.id)
      ) throw new DomainError('PUBLISH_ALREADY_ATTEMPTED', 'Publish cannot be repeated for this job.');
      if (
        args.kind === 'COMMENT' &&
        !this.db.prepare(
          "SELECT 1 FROM effects WHERE job_id=? AND kind='PUBLISH' AND state='CONFIRMED' LIMIT 1",
        ).get(job.id)
      ) throw new DomainError('POST_NOT_VERIFIED', 'Comment requires verified publish evidence.');
      assertJobTransition(job.state, toState, false);
      const effectId = makeId('effect');
      this.db.prepare("INSERT INTO effects VALUES(?,?,?,?,?,?,'INTENT',NULL,?)")
        .run(
          effectId, job.id, args.nodeId, args.kind, args.effectKey, args.payloadHash,
          new Date(args.at).toISOString(),
        );
      this.db.prepare('UPDATE jobs SET state=?,revision=revision+1 WHERE id=?')
        .run(toState, job.id);
      this.queueEvent(job.id, 'EFFECT_INTENT_COMMITTED', {
        effectId, kind: args.kind, claimGeneration: args.lease.generation,
      }, args.at);
      return { effectId, jobId: job.id, jobRevision: job.revision + 1, state: 'INTENT' };
    });
  }

  /** Persist uncertainty and job phase together before the provider dispatch boundary. */
  beginClaimedEffectAttempt(args: {
    effectId: string;
    expectedJobRevision: number;
    lease: DeviceLease;
    at: number;
  }): { effectId: string; jobId: string; jobRevision: number; state: 'ATTEMPT_UNCERTAIN' } {
    idSchema.parse(args.effectId);
    if (!Number.isSafeInteger(args.expectedJobRevision) || args.expectedJobRevision < 0)
      throw new DomainError('INVALID_EFFECT_ATTEMPT', 'Invalid job revision.');
    return this.transaction(() => {
      const effect = this.db.prepare(
        'SELECT e.*,j.device_id FROM effects e JOIN jobs j ON j.id=e.job_id WHERE e.id=?',
      ).get(args.effectId);
      if (!effect || effect.state !== 'INTENT')
        throw new DomainError('EFFECT_NOT_ELIGIBLE', 'Unattempted intent not found.');
      const jobId = String(effect.job_id);
      this.assertEffectClaim(jobId, args.lease, args.at);
      const { job, snapshot, snapshotHash } = this.getJob(jobId);
      if (
        job.deviceId !== args.lease.deviceId ||
        job.revision !== args.expectedJobRevision ||
        contentHash(snapshot) !== snapshotHash
      ) throw new DomainError('STALE_EFFECT_JOB', 'Claim or snapshot changed since intent.');
      const publish = effect.kind === 'PUBLISH';
      if (
        (publish && job.state !== 'POST_INTENT') ||
        (!publish && (effect.kind !== 'COMMENT' || job.state !== 'COMMENT_PENDING'))
      ) throw new DomainError('EFFECT_JOB_PHASE', 'Job is not in the prepared effect phase.');
      if (publish) assertJobTransition(job.state, 'POST_PENDING', false);
      this.db.prepare("UPDATE effects SET state='ATTEMPT_UNCERTAIN' WHERE id=? AND state='INTENT'")
        .run(args.effectId);
      if (publish)
        this.db.prepare("UPDATE jobs SET state='POST_PENDING',revision=revision+1 WHERE id=?")
          .run(job.id);
      else this.db.prepare('UPDATE jobs SET revision=revision+1 WHERE id=?').run(job.id);
      this.queueEvent(job.id, 'EFFECT_ATTEMPT_UNCERTAIN', {
        effectId: args.effectId, kind: String(effect.kind), claimGeneration: args.lease.generation,
      }, args.at);
      return {
        effectId: args.effectId, jobId, jobRevision: job.revision + 1,
        state: 'ATTEMPT_UNCERTAIN',
      };
    });
  }

  recordIntent(
    jobId: string,
    nodeId: string,
    kind: 'PUBLISH' | 'COMMENT',
    effectKey: string,
    payloadHash: string,
  ): string {
    hashSchema.parse(effectKey);
    hashSchema.parse(payloadHash);
    idSchema.parse(nodeId);
    const id = makeId('effect');
    this.db
      .prepare("INSERT INTO effects VALUES(?,?,?,?,?,?,'INTENT',NULL,?)")
      .run(id, jobId, nodeId, kind, effectKey, payloadHash, now());
    return id;
  }
  beginEffectAttempt(effectId: string, lease: DeviceLease, at: number): void {
    this.transaction(() => {
      this.assertLease(lease, at);
      const effect = this.db
        .prepare(
          'SELECT e.state,j.device_id FROM effects e JOIN jobs j ON e.job_id=j.id WHERE e.id=?',
        )
        .get(effectId);
      if (
        !effect ||
        effect.device_id !== lease.deviceId ||
        lease.ownerKind !== 'JOB' ||
        effect.state !== 'INTENT'
      )
        throw new DomainError('EFFECT_NOT_ELIGIBLE', 'Effect cannot be dispatched');
      this.db.prepare("UPDATE effects SET state='ATTEMPT_UNCERTAIN' WHERE id=?").run(effectId);
    });
  }
  effectState(id: string): string {
    const r = this.db.prepare('SELECT state FROM effects WHERE id=?').get(id);
    if (!r) throw new DomainError('NOT_FOUND', 'Effect not found');
    return String(r.state);
  }

  async backupTo(path: string): Promise<void> {
    if (resolve(path) === this.path)
      throw new DomainError('INVALID_BACKUP', 'Backup must use another file');
    mkdirSync(dirname(resolve(path)), { recursive: true });
    await backup(this.db, path);
  }
  async restoreFrom(path: string): Promise<void> {
    if (this.path === ':memory:' || resolve(path) === this.path)
      throw new DomainError('INVALID_RESTORE', 'Restore requires a different file-backed database');
    if (
      this.db
        .prepare("SELECT 1 FROM effects WHERE state IN('ATTEMPT_UNCERTAIN','NEEDS_REVIEW')")
        .get() ||
      this.db.prepare('SELECT 1 FROM device_stage_transfers LIMIT 1').get() ||
      this.db
        .prepare('SELECT 1 FROM leases WHERE owner_id IS NOT NULL AND expires_at>?')
        .get(Date.now())
    )
      throw new DomainError(
        'RESTORE_BUSY',
        'Resolve active device operations/effects before restoring',
      );
    const stage = this.path + '.restore-' + randomUUID();
    const source = new DatabaseSync(resolve(path), { readOnly: true });
    try {
      if (
        source.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok' ||
        Number(source.prepare('PRAGMA user_version').get()?.user_version) < 1 ||
        Number(source.prepare('PRAGMA user_version').get()?.user_version) > SCHEMA_VERSION ||
        migrations
          .filter(
            (m) => m.version <= Number(source.prepare('PRAGMA user_version').get()?.user_version),
          )
          .some(
            (m) =>
              source
                .prepare('SELECT checksum FROM schema_migrations WHERE version=?')
                .get(m.version)?.checksum !== contentHash(m.sql),
          )
      )
        throw new DomainError('INVALID_BACKUP', 'Backup integrity/schema mismatch');
      await backup(source, stage);
    } finally {
      source.close();
    }
    const check = new StudioDatabase(stage);
    try {
      if (check.integrity() !== 'ok')
        throw new DomainError('INVALID_BACKUP', 'Staged restore integrity failed');
    } finally {
      check.close();
    }
    const checkpoint = this.db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
    if (Number(checkpoint?.busy) !== 0) {
      rmSync(stage, { force: true });
      throw new DomainError('RESTORE_BUSY', 'Database is busy');
    }
    const previous = this.path + '.before-restore-' + randomUUID();
    this.db.close();
    try {
      renameSync(this.path, previous);
      renameSync(stage, this.path);
      this.db = this.open();
      this.migrate();
    } catch (error) {
      if (existsSync(previous)) {
        if (existsSync(this.path))
          renameSync(this.path, this.path + '.failed-restore-' + randomUUID());
        renameSync(previous, this.path);
      }
      this.db = this.open();
      this.migrate();
      throw error;
    }
  }

  private contentDeltas(
    before: ContentItem | null,
    after: ContentItem,
  ): NonNullable<ContentPreviewDto['changes'][number]['deltas']> {
    const keys = [...new Set([...Object.keys(before?.fields ?? {}), ...Object.keys(after.fields)])];
    const result: NonNullable<ContentPreviewDto['changes'][number]['deltas']> = [];
    for (const key of keys) {
      const beforePresent = Boolean(before && Object.hasOwn(before.fields, key)),
        afterPresent = Object.hasOwn(after.fields, key);
      if (
        beforePresent === afterPresent &&
        (!beforePresent || canonicalJson(before!.fields[key]) === canonicalJson(after.fields[key]))
      )
        continue;
      result.push({
        key,
        beforePresent,
        afterPresent,
        ...(beforePresent ? { before: before!.fields[key]! } : {}),
        ...(afterPresent ? { after: after.fields[key]! } : {}),
      });
    }
    if (canonicalJson(before?.assetIds ?? []) !== canonicalJson(after.assetIds))
      result.push({
        key: 'Media',
        beforePresent: Boolean(before),
        afterPresent: true,
        ...(before ? { before: before.assetIds } : {}),
        after: after.assetIds,
      });
    return result;
  }
  private contentContext(processId: string) {
    const process = this.getProcess(processId);
    if (process.archived) throw new DomainError('PROCESS_ARCHIVED', 'Tiến trình đã lưu trữ.');
    const schema = this.inputSchema(process)?.inputs.filter((field) => field.scope === 'row') ?? [];
    const rows = this.listContent(processId),
      assets = this.listContentAssets(processId);
    const jobs = this.db
      .prepare('SELECT id,content_id,revision,state FROM jobs WHERE process_id=? ORDER BY id')
      .all(processId);
    return { process, schema, rows, assets, jobs };
  }
  exportContent(processId: string, contentIds: string[]): ContentExportDocument {
    const context = this.contentContext(processId);
    this.validateContentSelection(context.rows, contentIds);
    return {
      format: 'autoreels-content',
      version: 1,
      processId,
      schema: context.schema,
      rows: contentIds.map((id) => {
        const row = context.rows.find((row) => row.id === id)!;
        return { contentId: row.id, fields: row.fields, assetIds: row.assetIds };
      }),
    };
  }
  private validateContentSelection(rows: ContentItem[], ids: string[]): void {
    if (
      !ids.length ||
      ids.length > 1000 ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !rows.some((row) => row.id === id))
    )
      throw new DomainError(
        'INVALID_SCOPE',
        'Chọn 1–1000 nội dung còn dùng trong đúng tiến trình.',
      );
  }
  previewContentImport(
    processId: string,
    expectedRevision: number,
    document: ContentImportDocument,
    expectedSchemaHash: string,
    at = now(),
  ): ContentPreviewDto {
    return this.transaction(() =>
      this.buildContentImportPreview(processId, expectedRevision, document, expectedSchemaHash, at),
    );
  }
  private buildContentImportPreview(
    processId: string,
    expectedRevision: number,
    document: ContentImportDocument,
    expectedSchemaHash: string,
    at: string,
  ): ContentPreviewDto {
    assertJsonSafe(document);
    const context = this.contentContext(processId);
    if (
      context.process.revision !== expectedRevision ||
      contentHash(context.schema) !== expectedSchemaHash
    )
      throw new DomainError('PREVIEW_STALE', 'Tiến trình hoặc schema đã đổi; xem trước lại.');
    if (document.processId && document.processId !== processId)
      throw new DomainError('INVALID_SCOPE', 'File thuộc tiến trình khác; không tự remap ID.');
    if (document.schema && contentHash(document.schema) !== contentHash(context.schema))
      throw new DomainError(
        'SCHEMA_MISMATCH',
        'Schema file khác workflow hiện tại; cần mapping rõ trước khi nhập.',
      );
    if (!document.records.length || document.records.length > 1000)
      throw new DomainError('RESOURCE_BUDGET', 'Nhập 1–1000 nội dung mỗi lần.');
    const validation = {
      process: context.process,
      bundle: this.inputSchema(context.process),
      allowed: new Set(context.assets.map((asset) => asset.id)),
    };
    const seen = new Set<string>(),
      mutations: StoredContentPreview['mutations'] = [],
      changes: ContentPreviewDto['changes'] = [];
    for (const [index, record] of document.records.entries()) {
      let matched: ContentItem | null = null;
      try {
        if (record.errors?.length)
          throw new DomainError('IMPORT_CELL_ERRORS', record.errors.join(' '));
        let candidates: ContentItem[] = [];
        if (Object.hasOwn(record, 'contentId'))
          candidates = context.rows.filter((row) => row.id === record.contentId);
        else if (Object.hasOwn(record, 'relativePath')) {
          const ids = new Set(
            context.assets
              .filter(
                (asset) =>
                  asset.relativePath.replaceAll('\\', '/') ===
                    record.relativePath!.replaceAll('\\', '/') &&
                  (!record.sourceId ||
                    this.assetSource(asset.id, processId)?.id === record.sourceId),
              )
              .map((asset) => asset.contentId),
          );
          candidates = context.rows.filter((row) => ids.has(row.id));
        } else if (Object.hasOwn(record, 'filename')) {
          const ids = new Set(
            context.assets
              .filter((asset) => asset.relativePath.split(/[\\/]/).at(-1) === record.filename)
              .map((asset) => asset.contentId),
          );
          candidates = context.rows.filter((row) => ids.has(row.id));
        }
        const hasSelector = ['contentId', 'sourceId', 'relativePath', 'filename'].some((key) =>
          Object.hasOwn(record, key),
        );
        if (hasSelector && candidates.length !== 1)
          throw new DomainError(
            'IMPORT_MATCH',
            candidates.length
              ? 'Nhiều nội dung khớp; dùng contentId hoặc sourceId + relativePath.'
              : 'Không có nội dung khớp selector; không fallback ID sai.',
          );
        matched = candidates[0] ?? null;
        if (matched && seen.has(matched.id))
          throw new DomainError('DUPLICATE_IMPORT', 'Nội dung xuất hiện nhiều lần trong file.');
        if (matched) seen.add(matched.id);
        const fields = { ...(matched?.fields ?? {}), ...record.fields },
          refs = inputReferences(context.schema, fields, 'row').assets;
        const next: ContentItem = {
          id: matched?.id ?? makeId('content'),
          processId,
          revision: matched?.revision ?? 0,
          fields,
          assetIds: record.assetIds ?? [...new Set([...(matched?.assetIds ?? []), ...refs])],
          ignored: false,
        };
        this.assertContentItem(next, validation);
        const unchanged =
          matched &&
          contentHash({ fields: matched.fields, assetIds: matched.assetIds }) ===
            contentHash({ fields: next.fields, assetIds: next.assetIds });
        changes.push({
          line: index + 1,
          contentId: next.id,
          action: unchanged ? 'UNCHANGED' : matched ? 'UPDATE' : 'CREATE',
          fields: this.contentDeltas(matched, next).map((delta) => delta.key),
          deltas: this.contentDeltas(matched, next),
          errors: [],
        });
        if (!unchanged) mutations.push({ before: matched, next });
      } catch (error) {
        changes.push({
          line: index + 1,
          contentId: matched?.id ?? record.contentId ?? null,
          action: 'ERROR',
          fields: Object.keys(record.fields),
          errors: [error instanceof Error ? error.message : 'Dữ liệu không hợp lệ.'],
        });
      }
    }
    return this.storeContentPreview(
      processId,
      contentHash(context),
      mutations,
      changes,
      document.conversions,
      context.jobs
        .filter((job) => mutations.some((change) => change.before?.id === job.content_id))
        .map((job) => String(job.id)),
      at,
    );
  }
  previewBulkContent(
    processId: string,
    expectedRevision: number,
    request: BulkContentRequest,
    at = now(),
  ): ContentPreviewDto {
    return this.transaction(() =>
      this.buildBulkContentPreview(processId, expectedRevision, request, at),
    );
  }
  private buildBulkContentPreview(
    processId: string,
    expectedRevision: number,
    request: BulkContentRequest,
    at: string,
  ): ContentPreviewDto {
    assertJsonSafe(request);
    const context = this.contentContext(processId);
    if (context.process.revision !== expectedRevision)
      throw new DomainError('PREVIEW_STALE', 'Tiến trình đã đổi; xem trước lại.');
    this.validateContentSelection(
      context.rows,
      request.selection.map((row) => row.id),
    );
    const records: ContentImportRecord[] = [];
    for (const selected of request.selection) {
      const row = context.rows.find((row) => row.id === selected.id)!;
      if (row.revision !== selected.revision)
        throw new DomainError(
          'REVISION_CONFLICT',
          'Có nội dung đã đổi; tải lại trước khi sửa hàng loạt.',
        );
      if (!context.schema.some((field) => field.key === request.fieldKey))
        throw new DomainError('UNKNOWN_FIELD', 'Trường không thuộc schema nội dung.');
      const next = bulkPatch(row.fields, request);
      // A bulk REMOVE must remain a removal through the shared sparse-import representation.
      records.push({ contentId: row.id, fields: next, assetIds: row.assetIds });
    }
    if (request.operation !== 'REMOVE')
      return this.buildContentImportPreview(
        processId,
        expectedRevision,
        { records, conversions: [] },
        contentHash(context.schema),
        at,
      );
    const validation = {
      process: context.process,
      bundle: this.inputSchema(context.process),
      allowed: new Set(context.assets.map((asset) => asset.id)),
    };
    const changes: ContentPreviewDto['changes'] = [],
      mutations: StoredContentPreview['mutations'] = [];
    for (const [index, record] of records.entries()) {
      const row = context.rows.find((row) => row.id === record.contentId)!,
        next = { ...row, fields: record.fields };
      try {
        this.assertContentItem(next, validation);
        const changed = contentHash(row.fields) !== contentHash(next.fields);
        changes.push({
          line: index + 1,
          contentId: row.id,
          action: changed ? 'UPDATE' : 'UNCHANGED',
          fields: [request.fieldKey],
          deltas: this.contentDeltas(row, next),
          errors: [],
        });
        if (changed) mutations.push({ before: row, next });
      } catch (error) {
        changes.push({
          line: index + 1,
          contentId: row.id,
          action: 'ERROR',
          fields: [request.fieldKey],
          errors: [error instanceof Error ? error.message : 'Không thể bỏ trường.'],
        });
      }
    }
    return this.storeContentPreview(
      processId,
      contentHash(context),
      mutations,
      changes,
      [],
      context.jobs
        .filter((job) => mutations.some((m) => m.before?.id === job.content_id))
        .map((job) => String(job.id)),
      at,
    );
  }
  private storeContentPreview(
    processId: string,
    contextHash: string,
    mutations: StoredContentPreview['mutations'],
    changes: ContentPreviewDto['changes'],
    conversions: string[],
    impactedJobIds: string[],
    at: string,
  ): ContentPreviewDto {
    const dto: ContentPreviewDto = {
      token: makeId('contentPreview'),
      processId,
      expiresAt: new Date(Date.parse(at) + 300000).toISOString(),
      changes,
      conversions,
      impactedJobIds,
      canApply: !changes.some((change) => change.action === 'ERROR'),
    };
    const payload: StoredContentPreview = { dto, contextHash, mutations };
    this.db
      .prepare('INSERT INTO content_change_previews VALUES(?,?,?,?,?,NULL)')
      .run(dto.token, processId, dto.expiresAt, canonicalJson(payload), contentHash(payload));
    return dto;
  }
  applyContentPreview(token: string, at = now()): ContentApplyResult {
    idSchema.parse(token);
    return this.transaction(() => {
      const record = this.db
        .prepare('SELECT * FROM content_change_previews WHERE token=?')
        .get(token);
      if (!record) throw new DomainError('NOT_FOUND', 'Không tìm thấy bản xem trước nội dung.');
      if (record.result !== null)
        return { ...parse<ContentApplyResult>(record.result), alreadyApplied: true };
      const proposal = parse<StoredContentPreview>(record.payload);
      if (contentHash(proposal) !== record.payload_hash)
        throw new DomainError('PREVIEW_TAMPERED', 'Checksum bản xem trước không khớp.');
      if (Date.parse(proposal.dto.expiresAt) <= Date.parse(at))
        throw new DomainError('PREVIEW_EXPIRED', 'Bản xem trước đã hết hạn.');
      if (!proposal.dto.canApply)
        throw new DomainError(
          'IMPORT_ERRORS',
          'Sửa các lỗi trong bản xem trước trước khi áp dụng.',
        );
      const context = this.contentContext(String(record.process_id));
      if (contentHash(context) !== proposal.contextHash)
        throw new DomainError('PREVIEW_STALE', 'Dữ liệu/schema/media/lịch đã đổi; xem trước lại.');
      const result: ContentApplyResult = {
        contentIds: [],
        created: 0,
        updated: 0,
        alreadyApplied: false,
      };
      const validation = {
        process: context.process,
        bundle: this.inputSchema(context.process),
        allowed: new Set(context.assets.map((asset) => asset.id)),
      };
      for (const mutation of proposal.mutations) {
        this.assertContentItem(mutation.next, validation);
        const saved = this.insertContent(mutation.next, mutation.before?.revision ?? null);
        result.contentIds.push(saved.id);
        result[mutation.before ? 'updated' : 'created']++;
      }
      this.db
        .prepare('UPDATE content_change_previews SET result=? WHERE token=?')
        .run(canonicalJson(result), token);
      return result;
    });
  }

  private scheduleContext(processId: string, contentIds: string[]): FrozenScheduleContext {
    const process = this.getProcess(processId),
      all = this.listContent(processId);
    if (
      !contentIds.length ||
      contentIds.length > 1000 ||
      new Set(contentIds).size !== contentIds.length ||
      contentIds.some((id) => !all.some((row) => row.id === id))
    )
      throw new DomainError(
        'INVALID_SCOPE',
        'Chọn từ 1–1000 nội dung còn dùng trong đúng tiến trình.',
      );
    const selected = new Set(contentIds);
    return {
      process,
      rows: contentIds.map((id) => all.find((row) => row.id === id)!),
      version: process.workflowVersionId ? this.getVersion(process.workflowVersionId) : null,
      assets: this.listContentAssets(processId).filter(
        (asset) =>
          selected.has(asset.contentId) ||
          inputReferences(
            this.inputSchema(process)?.inputs ?? [],
            process.fields ?? {},
            'process',
          ).assets.includes(asset.id),
      ),
      jobs: this.db
        .prepare('SELECT id FROM jobs WHERE process_id=? ORDER BY id')
        .all(processId)
        .map((row) => this.getJob(String(row.id)).job)
        .filter((job) => selected.has(job.contentId)),
    };
  }
  private scheduleBlockers(context: FrozenScheduleContext, hostId: string | null): string[] {
    const { process, rows, version, assets, jobs } = context,
      blockers = new Set<string>();
    if (process.archived) blockers.add('Tiến trình đã lưu trữ.');
    if (!process.deviceId) blockers.add('Chưa gán điện thoại.');
    else if (!this.listDevices().some((device) => device.id === process.deviceId && device.enabled))
      blockers.add('Điện thoại không còn được bật trong workspace.');
    if (!version) blockers.add('Chưa chọn phiên bản workflow.');
    else {
      const invalid = validateBundle(version.bundle);
      if (invalid.length) blockers.add('Workflow chưa hợp lệ: ' + invalid[0]!.message);
      try {
        this.assertInputValues(process, process.fields ?? {}, 'process');
      } catch (error) {
        blockers.add(
          'Trường tiến trình: ' + (error instanceof Error ? error.message : 'Chưa hợp lệ.'),
        );
      }
      for (const row of rows) {
        const issues = validateTypedValues(version.bundle.inputs, row.fields, 'row');
        if (issues.length)
          blockers.add('Nội dung ' + row.id + ': ' + issues[0]!.path + ' — ' + issues[0]!.message);
        const fieldRefs: string[] = [];
        for (const field of version.bundle.inputs.filter((field) => field.scope === 'row')) {
          const value = row.fields[field.key];
          if (field.type === 'file' && value && typeof value === 'object' && !Array.isArray(value))
            fieldRefs.push(String(value.assetId));
          if (field.type === 'file[]' && Array.isArray(value))
            for (const ref of value)
              if (ref && typeof ref === 'object' && !Array.isArray(ref))
                fieldRefs.push(String(ref.assetId));
        }
        if (fieldRefs.some((id) => !row.assetIds.includes(id)))
          blockers.add('Nội dung ' + row.id + ' có tham chiếu media chưa gắn vào snapshot.');
      }
    }
    if (jobs.some((job) => !terminalJobStates.has(job.state)))
      blockers.add('Có nội dung đã có lịch chưa kết thúc; xử lý lịch đó trước.');
    for (const row of rows)
      if (
        this.db
          .prepare(
            "SELECT 1 FROM effects e JOIN jobs j ON j.id=e.job_id WHERE j.content_id=? AND e.state IN('ATTEMPT_UNCERTAIN','NEEDS_REVIEW')",
          )
          .get(row.id)
      )
        blockers.add('Nội dung còn thao tác cần đối soát; chưa tạo lượt mới.');
    for (const asset of assets) {
      if (asset.state !== 'READY')
        blockers.add('Media chưa sẵn có: ' + asset.relativePath + ' (' + asset.state + ').');
      const source = this.assetSource(asset.id, process.id);
      if (
        !source ||
        source.host_id !== hostId ||
        !source.active ||
        source.process_id !== process.id
      )
        blockers.add('Media cần được gắn lại với nguồn trên máy này: ' + asset.relativePath);
    }
    return [...blockers];
  }
  previewSchedule(
    processId: string,
    contentIds: string[],
    hostId: string | null = null,
    at = now(),
    seed = randomInt(0, 2147483647),
  ): SchedulePreviewDto {
    return this.transaction(() => {
      const context = this.scheduleContext(processId, contentIds),
        blockers = this.scheduleBlockers(context, hostId);
      const preview = createSchedulePreview({
        processId,
        processRevision: context.process.revision,
        profile: context.process.schedule,
        items: context.rows.map((row) => ({ id: row.id, revision: row.revision })),
        nowUtc: at,
        seed,
      });
      const payload: StoredSchedule = { preview, context };
      this.db
        .prepare('INSERT INTO schedule_previews VALUES(?,?,?,?,?,NULL)')
        .run(
          preview.token,
          processId,
          preview.expiresAt,
          canonicalJson(payload),
          contentHash(payload),
        );
      return {
        token: preview.token,
        expiresAt: preview.expiresAt,
        timezone: context.process.schedule.timezone,
        slots: preview.slots,
        blockers,
        canApply: blockers.length === 0,
        warnings: [
          'Áp dụng sẽ lưu lịch công việc. Android runtime chưa được triển khai; chưa có thao tác tự đăng.',
          ...(context.assets.length
            ? [
                'Tệp sẽ được kiểm tra lại trước khi thực thi; snapshot giữ nguyên fingerprint đã xem.',
              ]
            : []),
        ],
      };
    });
  }
  applySchedule(
    token: string,
    hostId: string | null = null,
    at = now(),
  ): { jobIds: string[]; alreadyApplied: boolean } {
    idSchema.parse(token);
    return this.transaction(() => {
      const record = this.db.prepare('SELECT * FROM schedule_previews WHERE token=?').get(token);
      if (!record) throw new DomainError('NOT_FOUND', 'Không tìm thấy bản xem trước.');
      if (record.applied_at !== null)
        return {
          jobIds: this.db
            .prepare('SELECT job_id FROM schedule_preview_jobs WHERE token=? ORDER BY ordinal')
            .all(token)
            .map((row) => String(row.job_id)),
          alreadyApplied: true,
        };
      const frozen = parse<StoredSchedule>(record.payload);
      if (contentHash(frozen) !== record.payload_hash)
        throw new DomainError('PREVIEW_TAMPERED', 'Bản xem trước không khớp checksum.');
      const context = this.scheduleContext(
        frozen.context.process.id,
        frozen.preview.items.map((item) => item.id),
      );
      assertPreviewCurrent(frozen.preview, {
        processId: context.process.id,
        revision: context.process.revision,
        profile: context.process.schedule,
        items: context.rows.map((row) => ({ id: row.id, revision: row.revision })),
        nowUtc: at,
      });
      if (contentHash(context) !== contentHash(frozen.context))
        throw new DomainError(
          'PREVIEW_STALE',
          'Dữ liệu, media hoặc lịch đã đổi; tạo bản xem trước mới.',
        );
      const blockers = this.scheduleBlockers(context, hostId);
      if (blockers.length) throw new DomainError('SCHEDULE_BLOCKED', blockers.join(' '));
      if (frozen.preview.slots.some((slot) => Date.parse(slot.scheduledUtc) <= Date.parse(at)))
        throw new DomainError('PREVIEW_TIME_PASSED', 'Có giờ đã qua; tạo bản xem trước mới.');
      const version = context.version!,
        jobIds: string[] = [];
      for (const [index, slot] of frozen.preview.slots.entries()) {
        const row = context.rows[index]!;
        if (row.id !== slot.contentId)
          throw new DomainError('PREVIEW_TAMPERED', 'Preview item order mismatch');
        const job: JobDefinition = {
          id: makeId('job'),
          occurrenceKey: contentHash({ token, contentId: row.id }),
          processId: context.process.id,
          deviceId: context.process.deviceId!,
          contentId: row.id,
          scheduledUtc: slot.scheduledUtc,
          state: 'SCHEDULED',
          revision: 0,
          priority: 0,
        };
        const snapshot: JobSnapshot = {
          workflowVersionId: version.id,
          workflowHash: version.hash,
          bundle: version.bundle,
          contentId: row.id,
          fields: row.fields,
          assetIds: [
            ...new Set([
              ...row.assetIds,
              ...inputReferences(version.bundle.inputs, context.process.fields ?? {}, 'process')
                .assets,
            ]),
          ],
          assets: context.assets.filter(
            (asset) =>
              asset.contentId === row.id ||
              inputReferences(
                version.bundle.inputs,
                context.process.fields ?? {},
                'process',
              ).assets.includes(asset.id),
          ),
          processFields: context.process.fields ?? {},
          accountId: context.process.accountId,
          targetId: context.process.targetId,
          networkProfileId: null,
          processRevision: context.process.revision,
          scheduleProfile: context.process.schedule,
        };
        this.insertJob(job, snapshot);
        this.db
          .prepare('INSERT INTO schedule_preview_jobs VALUES(?,?,?)')
          .run(token, index, job.id);
        jobIds.push(job.id);
      }
      this.db.prepare('UPDATE schedule_previews SET applied_at=? WHERE token=?').run(at, token);
      return { jobIds, alreadyApplied: false };
    });
  }
  listJobs(query: JobQuery = {}): JobPage {
    const limit = query.limit ?? 500;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
      throw new DomainError('INVALID_QUERY', 'Limit must be between 1 and 1000');
    const where: string[] = [],
      params: (string | number)[] = [];
    const epoch = () =>
      Number(
        this.db.prepare("SELECT revision FROM query_epochs WHERE name='jobs'").get()!.revision,
      );
    const revision = epoch();
    const fingerprint = contentHash({
      appId: query.appId ?? null,
      processId: query.processId ?? null,
      deviceId: query.deviceId ?? null,
      state: query.state ?? null,
      fromUtc: query.fromUtc ?? null,
      toUtc: query.toUtc ?? null,
    });
    if (query.appId) {
      idSchema.parse(query.appId);
      where.push("json_extract(snapshot,'$.bundle.workflow.appId')=?");
      params.push(query.appId);
    }
    for (const [key, column] of [
      ['processId', 'process_id'],
      ['deviceId', 'device_id'],
      ['state', 'state'],
      ['fromUtc', 'scheduled_utc'],
      ['toUtc', 'scheduled_utc'],
    ] as const)
      if (query[key]) {
        where.push(
          key === 'fromUtc'
            ? 'julianday(scheduled_utc)>=julianday(?)'
            : key === 'toUtc'
              ? 'julianday(scheduled_utc)<julianday(?)'
              : column + '=?',
        );
        params.push(query[key]!);
      }
    if (query.cursor) {
      try {
        if (query.cursor.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(query.cursor))
          throw new Error('Malformed cursor');
        const cursor: unknown = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'));
        assertJsonSafe(cursor);
        if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor))
          throw new Error('Invalid cursor');
        const c = cursor as Record<string, JsonValue>;
        if (
          Object.keys(c).length !== 7 ||
          c.version !== 1 ||
          typeof c.fingerprint !== 'string' ||
          !Number.isSafeInteger(c.epoch) ||
          !Number.isSafeInteger(c.priority) ||
          typeof c.utc !== 'string' ||
          typeof c.createdAt !== 'string' ||
          typeof c.id !== 'string'
        )
          throw new Error('Invalid cursor');
        jobSchema.shape.scheduledUtc.parse(c.utc);
        jobSchema.shape.scheduledUtc.parse(c.createdAt);
        idSchema.parse(c.id);
        if (c.fingerprint !== fingerprint)
          throw new DomainError('CURSOR_SCOPE', 'Bộ lọc đã đổi; tải lại từ trang đầu.');
        if (c.epoch !== revision)
          throw new DomainError('QUERY_STALE', 'Lịch đã thay đổi; tải lại từ trang đầu.');
        where.push('(julianday(scheduled_utc),-priority,created_at,id)>(julianday(?),?,?,?)');
        params.push(c.utc, -Number(c.priority), c.createdAt, c.id);
      } catch (error) {
        if (error instanceof DomainError) throw error;
        throw new DomainError('INVALID_CURSOR', 'Con trỏ trang không hợp lệ; tải lại lịch.');
      }
    }
    const records = this.db
      .prepare(
        'SELECT id,scheduled_utc,priority,created_at FROM jobs' +
          (where.length ? ' WHERE ' + where.join(' AND ') : '') +
          ' ORDER BY julianday(scheduled_utc),-priority,created_at,id LIMIT ?',
      )
      .all(...params, limit + 1);
    const devices = new Map(this.listDevices().map((device) => [device.id, device.name]));
    const jobs = records.slice(0, limit).map((record) => {
      const { job, snapshot, snapshotHash } = this.getJob(String(record.id)),
        process = this.getProcess(job.processId);
      return {
        ...job,
        processName: process.name,
        deviceName: devices.get(job.deviceId) ?? job.deviceId,
        timezone: snapshot.scheduleProfile?.timezone ?? process.schedule.timezone,
        snapshotHash,
      };
    });
    if (epoch() !== revision)
      throw new DomainError('QUERY_STALE', 'Lịch thay đổi trong khi tải; tải lại từ trang đầu.');
    const hasMore = records.length > limit,
      last = records[Math.min(records.length, limit) - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(
            JSON.stringify({
              version: 1,
              epoch: revision,
              fingerprint,
              utc: String(last.scheduled_utc),
              priority: Number(last.priority),
              createdAt: String(last.created_at),
              id: String(last.id),
            }),
          ).toString('base64url')
        : null;
    return { jobs, hasMore, nextCursor };
  }
  private editableScheduledJob(id: string, expectedRevision: number): JobDefinition {
    const { job } = this.getJob(id);
    if (job.revision !== expectedRevision)
      throw new DomainError('REVISION_CONFLICT', 'Lịch đã thay đổi; tải lại trước khi sửa.');
    if (
      job.state !== 'SCHEDULED' ||
      this.db.prepare('SELECT 1 FROM effects WHERE job_id=?').get(id)
    )
      throw new DomainError(
        'JOB_NOT_EDITABLE',
        'Chỉ sửa lịch chưa bắt đầu và chưa có external intent.',
      );
    return job;
  }
  private jobChangeContext(selection: JobChangeRequest['jobs']) {
    return selection.map((selected) => {
      const { job, snapshot, snapshotHash } = this.getJob(selected.id),
        process = this.getProcess(job.processId);
      return {
        selected,
        job,
        snapshotHash,
        timezone: snapshot.scheduleProfile?.timezone ?? process.schedule.timezone,
        archived: process.archived,
        hasEffect: Boolean(this.db.prepare('SELECT 1 FROM effects WHERE job_id=?').get(job.id)),
      };
    });
  }
  previewJobChanges(
    input: JobChangeRequest,
    hostId: string | null = null,
    at = now(),
    seed = randomInt(0, 4294967296),
  ): JobChangePreview {
    assertJsonSafe(input);
    const request = jobChangeRequestSchema.parse(input),
      scope = new Set(request.jobs.map((j) => j.id));
    if (scope.size !== request.jobs.length)
      throw new DomainError('DUPLICATE_JOB', 'Chọn mỗi công việc đúng một lần.');
    return this.transaction(() => {
      const context = this.jobChangeContext(request.jobs),
        blockers: JobChangePreview['blockers'] = [];
      for (const item of context) {
        if (item.job.revision !== item.selected.revision)
          blockers.push({
            jobId: item.job.id,
            code: 'REVISION_CONFLICT',
            message: 'Lịch đã đổi; tải lại trước khi chọn.',
          });
        if (item.job.state !== 'SCHEDULED' || item.hasEffect)
          blockers.push({
            jobId: item.job.id,
            code: 'JOB_NOT_EDITABLE',
            message: 'Công việc đã bắt đầu hoặc có external intent.',
          });
        if (item.archived)
          blockers.push({
            jobId: item.job.id,
            code: 'PROCESS_ARCHIVED',
            message: 'Tiến trình đã lưu trữ; khôi phục trước khi sửa lịch.',
          });
      }
      const slots =
        request.operation === 'SPREAD'
          ? spreadJobs(
              context.map((item) => ({ ...item.job, timezone: item.timezone })),
              request.minGapMinutes,
              request.maxGapMinutes,
              seed,
            )
          : context.map((item) => ({
              jobId: item.job.id,
              deviceId: item.job.deviceId,
              timezone: item.timezone,
              previousUtc: item.job.scheduledUtc,
              proposedUtc: item.job.scheduledUtc,
              gapMinutes: 0,
              crossesLocalDay: false,
            }));
      if (request.operation === 'SPREAD')
        for (const slot of slots) {
          if (Date.parse(slot.proposedUtc) <= Date.parse(at))
            blockers.push({
              jobId: slot.jobId,
              code: 'INVALID_JOB_TIME',
              message: 'Giờ đề xuất đã qua; sửa anchor sang tương lai trước.',
            });
          // At most 1000 selected IDs can hide an external conflict; the next record suffices.
          const conflict = this.db
            .prepare(
              "SELECT id FROM jobs WHERE device_id=? AND julianday(scheduled_utc)=julianday(?) AND state NOT IN ('CANCELLED','SKIPPED','FAILED','SUCCESS','SUCCESS_WITH_WARNINGS') LIMIT 1001",
            )
            .all(slot.deviceId, slot.proposedUtc)
            .find((j) => !scope.has(String(j.id)));
          if (conflict)
            blockers.push({
              jobId: slot.jobId,
              code: 'TIME_CONFLICT',
              message:
                'Cùng điện thoại/cùng thời điểm với ' + String(conflict.id) + ' ngoài lựa chọn.',
            });
        }
      const token = makeId('jobchange'),
        expiresAt = new Date(Date.parse(at) + 300000).toISOString();
      const warnings =
        request.operation === 'SPREAD'
          ? [
              'Mỗi điện thoại giữ giờ đầu làm mốc; chỉ dịch các công việc đã chọn về sau. Khoảng cách hiện có lớn hơn khoảng giãn được giữ nguyên.',
              'Chỉ kiểm tra trùng thời điểm; chưa có ước lượng thời lượng chạy để giữ chỗ. Queue vẫn khóa một công việc trên mỗi điện thoại.',
            ]
          : ['Chỉ hủy công việc đã chọn chưa bắt đầu; giữ nguyên snapshot và lịch sử.'];
      const crossing = slots.filter((slot) => slot.crossesLocalDay).length;
      if (crossing)
        warnings.push(crossing + ' công việc chuyển sang ngày khác theo múi giờ của công việc.');
      const preview: JobChangePreview = {
        token,
        expiresAt,
        operation: request.operation,
        seed,
        slots,
        warnings,
        blockers,
        canApply: blockers.length === 0,
      };
      const epoch = Number(
        this.db.prepare("SELECT revision FROM query_epochs WHERE name='jobs'").get()!.revision,
      );
      const payload = { request, contextHash: contentHash(context), epoch, preview };
      this.db
        .prepare('INSERT INTO job_change_previews VALUES(?,?,?,?,?,NULL)')
        .run(token, hostId, canonicalJson(payload), contentHash(payload), expiresAt);
      return preview;
    });
  }
  applyJobChanges(token: string, hostId: string | null = null, at = now()): JobChangeResult {
    idSchema.parse(token);
    return this.transaction(() => {
      const record = this.db.prepare('SELECT * FROM job_change_previews WHERE token=?').get(token);
      if (!record) throw new DomainError('NOT_FOUND', 'Không tìm thấy bản xem trước lịch.');
      if (record.host_id !== hostId)
        throw new DomainError('PREVIEW_HOST', 'Bản xem trước thuộc host khác.');
      if (record.result !== null)
        return { ...parse<JobChangeResult>(record.result), alreadyApplied: true };
      if (Date.parse(at) >= Date.parse(String(record.expires_at)))
        throw new DomainError('PREVIEW_EXPIRED', 'Bản xem trước lịch đã hết hạn.');
      const payload = parse<{
        request: JobChangeRequest;
        contextHash: string;
        epoch: number;
        preview: JobChangePreview;
      }>(record.payload);
      if (contentHash(payload) !== record.payload_hash)
        throw new DomainError('PREVIEW_TAMPERED', 'Checksum bản xem trước lịch không khớp.');
      if (!payload.preview.canApply)
        throw new DomainError('PREVIEW_BLOCKED', 'Giải quyết các lý do chặn rồi xem trước lại.');
      const epoch = Number(
        this.db.prepare("SELECT revision FROM query_epochs WHERE name='jobs'").get()!.revision,
      );
      if (
        epoch !== payload.epoch ||
        contentHash(this.jobChangeContext(payload.request.jobs)) !== payload.contextHash
      )
        throw new DomainError(
          'PREVIEW_STALE',
          'Lịch hoặc quyền sửa đã đổi; tải lại và xem trước lại.',
        );
      for (const selected of payload.request.jobs)
        this.editableScheduledJob(selected.id, selected.revision);
      for (const slot of payload.preview.slots) {
        if (payload.request.operation === 'SPREAD') {
          if (Date.parse(slot.proposedUtc) <= Date.parse(at))
            throw new DomainError('INVALID_JOB_TIME', 'Giờ đề xuất đã qua; xem trước lại.');
          this.db
            .prepare('UPDATE jobs SET scheduled_utc=?,revision=revision+1 WHERE id=?')
            .run(new Date(slot.proposedUtc).toISOString(), slot.jobId);
        } else
          this.db
            .prepare("UPDATE jobs SET state='CANCELLED',revision=revision+1 WHERE id=?")
            .run(slot.jobId);
      }
      const result: JobChangeResult = {
        jobIds: payload.request.jobs.map((j) => j.id),
        alreadyApplied: false,
      };
      this.db
        .prepare('UPDATE job_change_previews SET result=? WHERE token=?')
        .run(canonicalJson(result), token);
      return result;
    });
  }
  rescheduleJob(id: string, expectedRevision: number, scheduledUtc: string, at = now()): void {
    if (!Number.isFinite(Date.parse(scheduledUtc)) || Date.parse(scheduledUtc) <= Date.parse(at))
      throw new DomainError('INVALID_JOB_TIME', 'Chọn giờ trong tương lai.');
    this.transaction(() => {
      this.editableScheduledJob(id, expectedRevision);
      this.db
        .prepare('UPDATE jobs SET scheduled_utc=?,revision=revision+1 WHERE id=?')
        .run(new Date(scheduledUtc).toISOString(), id);
    });
  }
  cancelScheduledJob(id: string, expectedRevision: number): void {
    this.transaction(() => {
      this.editableScheduledJob(id, expectedRevision);
      this.db.prepare("UPDATE jobs SET state='CANCELLED',revision=revision+1 WHERE id=?").run(id);
    });
  }

  /** Internal-only entrypoint: caller must obtain a native dialog grant before calling. */
  registerNativeSource(grant: Omit<SourceGrant, 'id' | 'revision' | 'active'>): SourceDefinition {
    return this.transaction(() => this.insertNativeSource(grant));
  }
  /** Batch from one native dialog. No partial registration on stale Process or invalid grant. */
  registerNativeSources(
    processId: string,
    expectedRevision: number,
    grants: Omit<SourceGrant, 'id' | 'revision' | 'active'>[],
  ): SourceDefinition[] {
    return this.transaction(() => {
      const process = this.getProcess(processId);
      if (process.archived || process.revision !== expectedRevision)
        throw new DomainError(
          'REVISION_CONFLICT',
          'Tiến trình đã đổi trong lúc chọn nguồn; chọn lại.',
        );
      if (
        !grants.length ||
        grants.length > 128 ||
        grants.some((g) => g.processId !== processId) ||
        grants.filter((g) => g.kind === 'FOLDER').length > 1
      )
        throw new DomainError('INVALID_GRANT', 'Invalid native source batch');
      return grants.map((grant) => this.insertNativeSource(grant));
    });
  }
  private insertNativeSource(
    grant: Omit<SourceGrant, 'id' | 'revision' | 'active'>,
  ): SourceDefinition {
    idSchema.parse(grant.processId);
    if (
      this.getProcess(grant.processId).archived ||
      !grant.rootPath ||
      !grant.hostId ||
      !['FOLDER', 'FILE'].includes(grant.kind)
    )
      throw new DomainError('INVALID_GRANT', 'Invalid host grant');
    const duplicate = this.listSources(grant.processId, grant.hostId).find(
      (s) => !s.requiresRebind && s.kind === grant.kind && s.displayPath === grant.rootPath,
    );
    if (duplicate) {
      if (
        duplicate.active &&
        duplicate.recursive === grant.recursive &&
        duplicate.watch === grant.watch
      )
        return duplicate;
      if (grant.kind === 'FOLDER')
        this.db
          .prepare(
            "UPDATE sources SET active=0,watch=0,revision=revision+1 WHERE process_id=? AND kind='FOLDER' AND active=1 AND id<>?",
          )
          .run(grant.processId, duplicate.id);
      this.db
        .prepare('UPDATE sources SET recursive=?,watch=?,active=1,revision=revision+1 WHERE id=?')
        .run(Number(grant.kind === 'FOLDER' && grant.recursive), Number(grant.watch), duplicate.id);
      return this.listSources(grant.processId, grant.hostId).find((s) => s.id === duplicate.id)!;
    }
    if (grant.kind === 'FOLDER')
      this.db
        .prepare(
          "UPDATE sources SET active=0,watch=0,revision=revision+1 WHERE process_id=? AND kind='FOLDER' AND active=1",
        )
        .run(grant.processId);
    const id = makeId('source');
    this.db
      .prepare('INSERT INTO sources VALUES(?,?,?,?,?,?,0,1,?)')
      .run(
        id,
        grant.processId,
        grant.kind,
        grant.rootPath,
        Number(grant.recursive),
        Number(grant.watch),
        grant.hostId,
      );
    return {
      id,
      processId: grant.processId,
      kind: grant.kind,
      displayPath: grant.rootPath,
      recursive: grant.recursive,
      watch: grant.watch,
      revision: 0,
      active: true,
      requiresRebind: false,
    };
  }
  activeSourceGrants(hostId: string): SourceGrant[] {
    return this.db
      .prepare(
        'SELECT s.id FROM sources s JOIN processes p ON p.id=s.process_id WHERE s.host_id=? AND s.active=1 AND p.archived=0',
      )
      .all(hostId)
      .map((r) => this.getSourceGrant(String(r.id), hostId));
  }
  updateSourceOptions(
    id: string,
    hostId: string,
    expectedRevision: number,
    options: { recursive: boolean; watch: boolean; active: boolean },
  ): SourceDefinition {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT process_id FROM sources WHERE id=?').get(id);
      if (!row) throw new DomainError('NOT_FOUND', 'Source not found');
      const source = this.listSources(String(row.process_id), hostId).find((s) => s.id === id)!;
      if (source.requiresRebind && options.active)
        throw new DomainError(
          'SOURCE_REBIND_REQUIRED',
          'Chọn lại nguồn trên host trước khi bật theo dõi.',
        );
      if (!source.active || source.revision !== expectedRevision)
        throw new DomainError('SOURCE_CHANGED', 'Nguồn đã đổi; tải lại trước khi sửa.');
      this.db
        .prepare('UPDATE sources SET recursive=?,watch=?,active=?,revision=revision+1 WHERE id=?')
        .run(
          Number(source.kind === 'FOLDER' && options.recursive),
          Number(options.active && options.watch),
          Number(options.active),
          id,
        );
      return this.listSources(source.processId, hostId).find((s) => s.id === id)!;
    });
  }
  listContentAssets(processId: string): ContentAssetInfo[] {
    this.getProcess(processId);
    return this.db
      .prepare(
        `SELECT a.*,ca.content_id,e.state,e.relative_path AS bound_path,m.probe FROM assets a
      JOIN content_assets ca ON ca.asset_id=a.id JOIN content_items c ON c.id=ca.content_id
      LEFT JOIN source_entries e ON e.rowid=(SELECT e2.rowid FROM source_entries e2 JOIN sources s2 ON s2.id=e2.source_id
        WHERE e2.asset_id=a.id AND s2.process_id=c.process_id ORDER BY s2.active DESC,e2.source_id,e2.relative_path LIMIT 1)
      LEFT JOIN asset_metadata m ON m.asset_id=a.id
      WHERE c.process_id=? AND c.ignored=0 ORDER BY c.rowid,ca.ordinal`,
      )
      .all(processId)
      .map((r) => ({
        id: String(r.id),
        contentId: String(r.content_id),
        relativePath: String(r.bound_path ?? r.relative_path),
        hash: String(r.hash),
        kind: r.kind as 'image' | 'video',
        bytes: Number(r.bytes),
        state: (r.state ?? 'UNTRACKED') as ContentAssetInfo['state'],
        probe: r.probe ? parse<ScannedAsset['probe']>(r.probe) : null,
      }));
  }
  private assetSource(assetId: string, processId: string) {
    return this.db
      .prepare(
        'SELECT s.id,s.host_id,s.active,s.process_id FROM sources s JOIN source_entries e ON e.source_id=s.id WHERE e.asset_id=? AND s.process_id=? ORDER BY s.active DESC,s.id LIMIT 1',
      )
      .get(assetId, processId);
  }
  /** Main-only file capability lookup; public adoption calls accept IDs instead of paths. */
  mediaAssetBinding(processId: string, assetId: string, hostId: string): MediaAssetBinding {
    const process = this.getProcess(processId);
    if (process.archived) throw new DomainError('PROCESS_ARCHIVED', 'Tiến trình đã lưu trữ.');
    const asset = this.listContentAssets(processId).find((a) => a.id === assetId);
    const source = this.assetSource(assetId, processId);
    if (!asset || !source)
      throw new DomainError(
        'INVALID_ASSET_SCOPE',
        'Media không có nguồn đã đăng ký trong tiến trình.',
      );
    const grant = this.getSourceGrant(String(source.id), hostId);
    if (!grant.active) throw new DomainError('SOURCE_INACTIVE', 'Nguồn đã ngừng sử dụng.');
    const entries = this.db
      .prepare(
        'SELECT e.* FROM source_entries e JOIN sources s ON s.id=e.source_id WHERE e.asset_id=? AND s.process_id=? AND s.active=1',
      )
      .all(assetId, processId);
    if (entries.length !== 1)
      throw new DomainError(
        'MEDIA_AMBIGUOUS',
        'Media có nhiều source bindings; đối chiếu nguồn trước.',
      );
    const entry = entries[0]!;
    if (entry.state === 'IGNORED') throw new DomainError('MEDIA_IGNORED', 'Media đã bị bỏ qua.');
    return {
      grant,
      assetId,
      relativePath: String(entry.relative_path),
      expectedHash: asset.hash,
      observedHash: String(entry.observed_hash),
      state: entry.state as ContentAssetInfo['state'],
    };
  }
  private mediaAdoptionContext(processId: string, assetId: string, hostId: string) {
    const binding = this.mediaAssetBinding(processId, assetId, hostId),
      process = this.getProcess(processId);
    const schema = this.inputSchema(process)?.inputs ?? [];
    const rows = this.listContent(processId).filter(
      (row) =>
        row.assetIds.includes(assetId) ||
        inputReferences(schema, row.fields, 'row').assets.includes(assetId),
    );
    if (rows.length > 5000)
      throw new DomainError(
        'RESOURCE_BUDGET',
        'Tiếp nhận tối đa5000 nội dung tham chiếu trong một thao tác.',
      );
    return {
      binding,
      process,
      rows,
      schema,
      workflowRevision: process.workflowVersionId
        ? this.getVersion(process.workflowVersionId).hash
        : process.workflowId
          ? this.getDraft(process.workflowId).revision
          : null,
    };
  }
  previewMediaAdoption(
    processId: string,
    assetId: string,
    hostId: string,
    scanned: ScannedAsset,
    at = now(),
    expected?: MediaAssetBinding,
  ): MediaAdoptionPreview {
    assertJsonSafe(scanned);
    hashSchema.parse(scanned.hash);
    return this.transaction(() => {
      const context = this.mediaAdoptionContext(processId, assetId, hostId);
      if (
        expected &&
        (contentHash(expected.grant) !== contentHash(context.binding.grant) ||
          expected.expectedHash !== context.binding.expectedHash ||
          expected.relativePath !== context.binding.relativePath)
      )
        throw new DomainError(
          'SOURCE_CHANGED',
          'Nguồn đã đổi trong khi đọc fingerprint; xem trước lại.',
        );
      if (scanned.relativePath !== context.binding.relativePath)
        throw new DomainError('INVALID_ASSET_SCOPE', 'Fingerprint thuộc binding khác.');
      if (scanned.hash === context.binding.expectedHash)
        throw new DomainError(
          'MEDIA_UNCHANGED',
          'Tệp vẫn khớp hash đã lưu; quét lại nguồn để cập nhật trạng thái.',
        );
      const token = makeId('adopt'),
        expiresAt = new Date(Date.parse(at) + 300000).toISOString();
      const payload = { contextHash: contentHash(context), scanned };
      this.db
        .prepare('INSERT INTO media_adoption_previews VALUES(?,?,?,?,?,?,?,NULL)')
        .run(
          token,
          processId,
          assetId,
          hostId,
          canonicalJson(payload),
          contentHash(payload),
          expiresAt,
        );
      return {
        token,
        expiresAt,
        processId,
        assetId,
        relativePath: scanned.relativePath,
        previousHash: context.binding.expectedHash,
        nextHash: scanned.hash,
        bytes: scanned.bytes,
        contentCount: context.rows.length,
        warnings: [
          'Cập nhật tham chiếu trong tiến trình này; giữ nguyên ID nội dung.',
          'Jobs và snapshot đã tạo tiếp tục giữ hash cũ. Không tự đăng lại hoặc sửa kết quả đã có.',
        ],
      };
    });
  }
  mediaAdoptionPlan(token: string, hostId: string, at = now()): MediaAdoptionPlan {
    idSchema.parse(token);
    const record = this.db
      .prepare('SELECT * FROM media_adoption_previews WHERE token=?')
      .get(token);
    if (!record) throw new DomainError('NOT_FOUND', 'Không tìm thấy bản xem trước media.');
    if (record.host_id !== hostId)
      throw new DomainError('ADOPTION_HOST', 'Bản xem trước thuộc host khác.');
    if (record.result !== null) {
      const result = parse<{
        processId: string;
        oldAssetId: string;
        assetId: string;
        contentIds: string[];
      }>(record.result);
      return {
        status: 'APPLIED',
        result: {
          process: this.getProcess(result.processId),
          oldAssetId: result.oldAssetId,
          assetId: result.assetId,
          contentIds: result.contentIds,
          alreadyApplied: true,
        },
      };
    }
    if (Date.parse(at) >= Date.parse(String(record.expires_at)))
      throw new DomainError('PREVIEW_EXPIRED', 'Bản xem trước media đã hết hạn.');
    const payload = parse<{ contextHash: string; scanned: ScannedAsset }>(record.payload);
    if (contentHash(payload) !== record.payload_hash)
      throw new DomainError('PREVIEW_TAMPERED', 'Checksum media preview không khớp.');
    const context = this.mediaAdoptionContext(
      String(record.process_id),
      String(record.asset_id),
      hostId,
    );
    if (contentHash(context) !== payload.contextHash)
      throw new DomainError('PREVIEW_STALE', 'Nguồn, nội dung hoặc schema đã đổi; xem trước lại.');
    return { status: 'PENDING', binding: context.binding, scanned: payload.scanned };
  }
  applyMediaAdoption(
    token: string,
    hostId: string,
    actual: ScannedAsset,
    at = now(),
  ): MediaAdoptionResult {
    assertJsonSafe(actual);
    hashSchema.parse(actual.hash);
    return this.transaction(() => {
      const plan = this.mediaAdoptionPlan(token, hostId, at);
      if (plan.status === 'APPLIED') return plan.result;
      if (
        actual.hash !== plan.scanned.hash ||
        actual.bytes !== plan.scanned.bytes ||
        actual.mtimeMs !== plan.scanned.mtimeMs ||
        actual.relativePath !== plan.scanned.relativePath ||
        actual.kind !== plan.scanned.kind
      )
        throw new DomainError(
          'MEDIA_CHANGED_AGAIN',
          'Tệp đã đổi thêm sau xem trước; chưa cập nhật dữ liệu.',
        );
      const oldAssetId = plan.binding.assetId,
        processId = plan.binding.grant.processId;
      const context = this.mediaAdoptionContext(processId, oldAssetId, hostId),
        assetId = makeId('asset');
      this.db
        .prepare('INSERT INTO assets VALUES(?,?,?,?,?,?,?)')
        .run(
          assetId,
          plan.binding.grant.id,
          actual.relativePath,
          actual.hash,
          actual.kind,
          actual.bytes,
          actual.mtimeMs,
        );
      this.db
        .prepare('INSERT INTO asset_metadata VALUES(?,?)')
        .run(assetId, canonicalJson(actual.probe));
      this.db
        .prepare(
          "UPDATE source_entries SET asset_id=?,hash=?,observed_hash=?,state='READY' WHERE source_id=? AND asset_id=?",
        )
        .run(assetId, actual.hash, actual.hash, plan.binding.grant.id, oldAssetId);
      const contentIds: string[] = [];
      for (const row of context.rows) {
        this.insertContent(
          {
            ...row,
            fields: replaceAssetReferences(context.schema, row.fields, 'row', oldAssetId, assetId),
            assetIds: row.assetIds.map((id) => (id === oldAssetId ? assetId : id)),
          },
          row.revision,
        );
        contentIds.push(row.id);
      }
      const process: ProcessDefinition = {
        ...context.process,
        revision: context.process.revision + 1,
        fields: replaceAssetReferences(
          context.schema,
          context.process.fields ?? {},
          'process',
          oldAssetId,
          assetId,
        ),
      };
      this.assertInputValues(process, process.fields ?? {}, 'process', false);
      for (const row of this.listContent(processId).filter((r) => contentIds.includes(r.id)))
        this.assertInputValues(process, row.fields, 'row', false);
      this.writeProcess(process);
      this.db
        .prepare('UPDATE media_adoption_previews SET result=? WHERE token=?')
        .run(canonicalJson({ processId, oldAssetId, assetId, contentIds }), token);
      return { process, oldAssetId, assetId, contentIds, alreadyApplied: false };
    });
  }
  getSourceGrant(id: string, hostId: string): SourceGrant {
    const grant = this.sourceBinding(id);
    if (grant.hostId !== hostId)
      throw new DomainError('SOURCE_REBIND_REQUIRED', 'Source belongs to another host');
    return grant;
  }
  /** Private host metadata, exposed only by the main-to-worker internal transport. */
  sourceBinding(id: string): SourceGrant {
    const r = this.db.prepare('SELECT * FROM sources WHERE id=?').get(id);
    if (!r) throw new DomainError('NOT_FOUND', 'Source not found');
    return {
      id,
      processId: String(r.process_id),
      kind: r.kind as 'FOLDER' | 'FILE',
      rootPath: String(r.root_path),
      recursive: Boolean(r.recursive),
      watch: Boolean(r.watch),
      revision: Number(r.revision),
      active: Boolean(r.active) && !this.getProcess(String(r.process_id)).archived,
      hostId: String(r.host_id),
    };
  }
  rebindSource(
    id: string,
    expectedRevision: number,
    hostId: string,
    rootPath: string,
  ): SourceDefinition {
    if (!isAbsolute(rootPath))
      throw new DomainError('INVALID_SOURCE', 'Chọn nguồn qua hộp thoại native.');
    return this.transaction(() => {
      const source = this.sourceBinding(id);
      if (source.revision !== expectedRevision || this.getProcess(source.processId).archived)
        throw new DomainError(
          'SOURCE_CHANGED',
          'Nguồn hoặc tiến trình đã đổi; tải lại trước khi chọn lại.',
        );
      if (source.kind === 'FILE') {
        const entries = this.db
          .prepare('SELECT relative_path FROM source_entries WHERE source_id=?')
          .all(id);
        if (entries.length > 1)
          throw new DomainError(
            'SOURCE_AMBIGUOUS',
            'Nguồn tệp có nhiều binding lịch sử; cần đối chiếu trước khi chọn lại.',
          );
        const name = basename(rootPath);
        this.db
          .prepare('UPDATE source_entries SET relative_path=? WHERE source_id=?')
          .run(name, id);
        this.db
          .prepare('UPDATE source_ignores SET relative_path=? WHERE source_id=?')
          .run(name, id);
      }
      this.db
        .prepare("UPDATE source_entries SET state='MISSING' WHERE source_id=? AND state<>'IGNORED'")
        .run(id);
      this.db
        .prepare('UPDATE sources SET root_path=?,host_id=?,active=1,revision=revision+1 WHERE id=?')
        .run(rootPath, hostId, id);
      return this.listSources(source.processId, hostId).find((s) => s.id === id)!;
    });
  }
  listSources(processId: string, hostId: string): SourceDefinition[] {
    return this.db
      .prepare('SELECT * FROM sources WHERE process_id=? ORDER BY rowid DESC')
      .all(processId)
      .map((r) => ({
        id: String(r.id),
        processId,
        kind: r.kind as 'FOLDER' | 'FILE',
        displayPath: String(r.root_path),
        recursive: Boolean(r.recursive),
        watch: Boolean(r.watch),
        revision: Number(r.revision),
        active: Boolean(r.active),
        requiresRebind: r.host_id !== hostId,
      }));
  }
  applyScannedAsset(
    sourceId: string,
    hostId: string,
    expectedRevision: number,
    scanGeneration: string,
    asset: ScannedAsset,
  ): 'added' | 'unchanged' | 'changed' | 'ignored' {
    assertJsonSafe(asset);
    hashSchema.parse(asset.hash);
    return this.transaction(() => {
      const grant = this.getSourceGrant(sourceId, hostId);
      if (!grant.active || grant.revision !== expectedRevision)
        throw new DomainError('SOURCE_CHANGED', 'Source changed while scan was running');
      const old = this.db
        .prepare('SELECT * FROM source_entries WHERE source_id=? AND relative_path=?')
        .get(sourceId, asset.relativePath);
      const ignored = this.db
        .prepare('SELECT 1 FROM source_ignores WHERE source_id=? AND relative_path=? AND hash=?')
        .get(sourceId, asset.relativePath, asset.hash);
      if (old) {
        const state = ignored ? 'IGNORED' : old.hash === asset.hash ? 'READY' : 'CHANGED';
        if (old.hash === asset.hash)
          this.db
            .prepare('UPDATE asset_metadata SET probe=? WHERE asset_id=?')
            .run(canonicalJson(asset.probe), String(old.asset_id));
        this.db
          .prepare(
            'UPDATE source_entries SET observed_hash=?,state=?,seen_generation=? WHERE source_id=? AND relative_path=?',
          )
          .run(asset.hash, state, scanGeneration, sourceId, asset.relativePath);
        return ignored ? 'ignored' : state === 'READY' ? 'unchanged' : 'changed';
      }
      const assetId =
          'asset_' +
          contentHash({ sourceId, relativePath: asset.relativePath, hash: asset.hash }).slice(
            0,
            32,
          ),
        contentId = makeId('content');
      this.db
        .prepare('INSERT INTO assets VALUES(?,?,?,?,?,?,?)')
        .run(
          assetId,
          sourceId,
          asset.relativePath,
          asset.hash,
          asset.kind,
          asset.bytes,
          asset.mtimeMs,
        );
      this.db
        .prepare('INSERT INTO asset_metadata VALUES(?,?)')
        .run(assetId, canonicalJson(asset.probe));
      const process = this.getProcess(grant.processId),
        fields: Record<string, JsonValue> = {};
      const bundle = process.workflowVersionId
        ? this.getVersion(process.workflowVersionId).bundle
        : process.workflowId
          ? this.getDraft(process.workflowId).bundle
          : null;
      if (bundle?.inputs.some((f) => f.key === 'caption' && f.type === 'text' && f.scope === 'row'))
        fields.caption = asset.relativePath
          .split(/[\\/]/)
          .at(-1)!
          .replace(/\.[^.]+$/, '');
      this.db
        .prepare('INSERT INTO content_items VALUES(?,?,0,?,?)')
        .run(contentId, grant.processId, canonicalJson(fields), Number(Boolean(ignored)));
      this.db.prepare('INSERT INTO content_assets VALUES(?,?,0)').run(contentId, assetId);
      this.db
        .prepare('INSERT INTO source_entries VALUES(?,?,?,?,?,?,?,?)')
        .run(
          sourceId,
          asset.relativePath,
          asset.hash,
          asset.hash,
          assetId,
          contentId,
          ignored ? 'IGNORED' : 'READY',
          scanGeneration,
        );
      return ignored ? 'ignored' : 'added';
    });
  }
  finishSourceScan(
    sourceId: string,
    hostId: string,
    expectedRevision: number,
    generation: string,
  ): number {
    return this.transaction(() => {
      const source = this.getSourceGrant(sourceId, hostId);
      if (!source.active || source.revision !== expectedRevision)
        throw new DomainError('SOURCE_CHANGED', 'Source changed before scan completion');
      return Number(
        this.db
          .prepare(
            "UPDATE source_entries SET state='MISSING' WHERE source_id=? AND seen_generation<>? AND state NOT IN('IGNORED','MISSING')",
          )
          .run(sourceId, generation).changes,
      );
    });
  }
  ignoreContent(id: string, expectedRevision: number): void {
    this.transaction(() => {
      const row = this.db.prepare('SELECT revision FROM content_items WHERE id=?').get(id);
      if (!row || Number(row.revision) !== expectedRevision)
        throw new DomainError('REVISION_CONFLICT', 'Content changed');
      this.db.prepare('UPDATE content_items SET ignored=1,revision=revision+1 WHERE id=?').run(id);
      for (const entry of this.db
        .prepare('SELECT * FROM source_entries WHERE content_id=?')
        .all(id)) {
        this.db
          .prepare('INSERT OR IGNORE INTO source_ignores VALUES(?,?,?)')
          .run(String(entry.source_id), String(entry.relative_path), String(entry.hash));
        this.db.prepare("UPDATE source_entries SET state='IGNORED' WHERE content_id=?").run(id);
      }
    });
  }
}
