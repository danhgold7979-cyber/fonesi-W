import { DatabaseSync, backup } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
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
} from '@autoreels/contracts';
import type {
  AppDefinition,
  WorkflowBundle,
  WorkflowDraft,
  WorkflowVersion,
  ProcessDefinition,
  ContentItem,
  MediaAsset,
  JobDefinition,
  JobSnapshot,
  DeviceLease,
  JsonValue,
} from '@autoreels/contracts';
import {
  DomainError,
  canonicalJson,
  contentHash,
  bundleHash,
  addApp,
  assertJobTransition,
} from '@autoreels/domain';
import { migration, SCHEMA_VERSION } from './schema.js';

const makeId = (prefix: string): string => prefix + '_' + randomUUID().replaceAll('-', '');
const now = (): string => new Date().toISOString();
const parse = <T>(value: unknown): T => JSON.parse(String(value)) as T;
const requireBundle = (value: unknown): WorkflowBundle => {
  const result = validateWorkflowShape(value);
  if (!result.ok)
    throw new DomainError('INVALID_WORKFLOW', result.issues[0]?.message ?? 'Invalid bundle');
  return result.value;
};

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
    const checksum = contentHash(migration);
    if (version === 0)
      this.transaction(() => {
        this.db.exec(migration);
        this.db.prepare('INSERT INTO schema_migrations VALUES(?,?)').run(SCHEMA_VERSION, checksum);
        for (const app of SEED_APPS)
          this.db.prepare('INSERT INTO apps VALUES(?,?)').run(app.id, canonicalJson(app));
        this.db.exec('PRAGMA user_version=' + SCHEMA_VERSION);
      });
    else if (
      this.db.prepare('SELECT checksum FROM schema_migrations WHERE version=?').get(version)
        ?.checksum !== checksum
    )
      throw new DomainError('MIGRATION_MISMATCH', 'Migration checksum mismatch');
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
  listWorkflows(
    includeArchived = false,
  ): {
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
        hash: bundleHash(draft.bundle),
        bundle: draft.bundle,
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
      process.revision = existing ? Number(existing.revision) + 1 : 0;
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
      return process;
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
  saveContent(input: ContentItem, expectedRevision: number | null): ContentItem {
    idSchema.parse(input.id);
    idSchema.parse(input.processId);
    assertJsonSafe(input.fields);
    return this.transaction(() => {
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
    });
  }
  createJob(job: JobDefinition, snapshot: JobSnapshot): void {
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
    this.transaction(() => {
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
          job.scheduledUtc,
          job.state,
          job.revision,
          job.priority,
          canonicalJson(snapshot),
          contentHash(snapshot),
          now(),
        );
    });
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
    idSchema.parse(deviceId);
    idSchema.parse(ownerId);
    if (!Number.isSafeInteger(at) || !Number.isSafeInteger(ttl) || ttl < 1 || ttl > 300000)
      throw new DomainError('INVALID_LEASE', 'Invalid lease duration/time');
    return this.transaction(() => {
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
    });
  }
  assertLease(lease: DeviceLease, at: number): void {
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
        Number(source.prepare('PRAGMA user_version').get()?.user_version) !== SCHEMA_VERSION ||
        source.prepare('SELECT checksum FROM schema_migrations WHERE version=?').get(SCHEMA_VERSION)
          ?.checksum !== contentHash(migration)
      )
        throw new DomainError('INVALID_BACKUP', 'Backup integrity/schema mismatch');
      await backup(source, stage);
    } finally {
      source.close();
    }
    const check = new DatabaseSync(stage, { readOnly: true });
    try {
      if (check.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok')
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
}
