import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProcessDefinition, JobSnapshot, JobDefinition } from '@autoreels/contracts';
import { contentHash } from '@autoreels/domain';
import { StudioDatabase } from './index.js';
import { DatabaseSync } from 'node:sqlite';
import { migration, migrations } from './schema.js';

describe('immutable external workflow closure', () => {
  it('pins full dependency bytes in the stored parent version and keeps them after child edits/restart', () => {
    const child = db.createWorkflow('fb', 'Reusable child'),
      childVersion = db.createVersion(child.workflowId, 0);
    const parent = db.createWorkflow('fb', 'Parent'),
      graph = parent.bundle.graphs[0]!;
    const pin = { id: child.workflowId, versionId: childVersion.id, hash: childVersion.hash };
    parent.bundle.dependencies = [pin];
    const end = graph.nodes.find((n) => n.type === 'end')!;
    graph.nodes.push({
      id: 'external_call',
      type: 'subflow',
      name: 'Reusable call',
      x: 100,
      y: 0,
      config: { workflowVersionRef: { ...pin }, inputMapping: {}, outputMapping: {} },
    });
    graph.edges[0]!.target = 'external_call';
    graph.edges.push({ id: 'return_call', source: 'external_call', target: end.id, port: 'next' });
    const saved = db.saveDraft(parent.bundle, 0),
      pinned = db.createVersion(parent.workflowId, saved.revision);
    expect(pinned.bundle.graphs).toHaveLength(2);
    expect(
      pinned.bundle.graphs[0]!.nodes.find((n) => n.id === 'external_call')!.config
        .workflowVersionRef,
    ).toBeUndefined();
    expect(
      db.getDraft(parent.workflowId).bundle.graphs[0]!.nodes.find((n) => n.id === 'external_call')!
        .config.workflowVersionRef,
    ).toEqual(pin);
    child.bundle.workflow.name = 'Changed child draft';
    db.saveDraft(child.bundle, 0);
    db.close();
    db = new StudioDatabase(join(dir, 'studio.sqlite'));
    closes.push(db);
    expect(db.getVersion(pinned.id)).toEqual(pinned);
    expect(db.resolveWorkflow(JSON.parse(JSON.stringify(pinned.bundle)))).toEqual(pinned.bundle);
  });
  it('rejects a missing pin before creating an immutable version and leaves the draft unchanged', () => {
    const draft = db.createWorkflow('fb', 'Missing dependency'),
      g = draft.bundle.graphs[0]!;
    const end = g.nodes.find((n) => n.type === 'end')!;
    const pin = { id: 'wf_missing', versionId: 'ver_missing', hash: 'a'.repeat(64) };
    draft.bundle.dependencies = [pin];
    g.nodes.push({
      id: 'call_missing',
      type: 'subflow',
      name: 'Missing',
      x: 100,
      y: 0,
      config: { workflowVersionRef: pin },
    });
    g.edges[0]!.target = 'call_missing';
    g.edges.push({ id: 'back', source: 'call_missing', target: end.id, port: 'next' });
    const saved = db.saveDraft(draft.bundle, 0);
    expect(() => db.createVersion(draft.workflowId, saved.revision)).toThrow('unavailable');
    expect(db.listVersions(draft.workflowId)).toEqual([]);
    expect(db.getDraft(draft.workflowId)).toEqual(saved);
  });
});

let dir: string, db: StudioDatabase;
const closes: StudioDatabase[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'autoreels-db-'));
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  closes.push(db);
});
afterEach(() => {
  for (const d of closes.splice(0)) {
    try {
      d.close();
    } catch {
      /* already closed in restart tests */
    }
  }
  rmSync(dir, { recursive: true, force: true });
});
const processInput = (id = 'process_1'): ProcessDefinition => ({
  id,
  name: id,
  appId: 'fb',
  workflowId: null,
  workflowVersionId: null,
  deviceId: null,
  accountId: null,
  targetId: null,
  revision: 0,
  archived: false,
  schedule: {
    timezone: 'Asia/Ho_Chi_Minh',
    startDate: '2026-10-26',
    slots: ['08:00', '12:00', '19:00'],
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    overduePolicy: 'NEXT_FUTURE_SLOT',
    jitterMinutes: 0,
  },
});
function fixtureJob(id = 'job_1'): { job: JobDefinition; snapshot: JobSnapshot } {
  db.registerObservedDevice('phone_1', 'Fixture phone');
  const draft = db.createWorkflow('fb', 'Fixture workflow'),
    version = db.createVersion(draft.workflowId, 0);
  const p = processInput();
  p.deviceId = 'phone_1';
  p.workflowId = draft.workflowId;
  p.workflowVersionId = version.id;
  db.saveProcess(p, null);
  db.saveContent(
    {
      id: 'content_1',
      processId: p.id,
      revision: 0,
      fields: { caption: 'old' },
      assetIds: [],
      ignored: false,
    },
    null,
  );
  const job: JobDefinition = {
    id,
    occurrenceKey: contentHash(id),
    processId: p.id,
    deviceId: 'phone_1',
    contentId: 'content_1',
    scheduledUtc: '2026-10-27T01:00:00.000Z',
    state: 'SCHEDULED',
    revision: 0,
    priority: 0,
  };
  const snapshot: JobSnapshot = {
    workflowVersionId: version.id,
    workflowHash: version.hash,
    bundle: version.bundle,
    contentId: 'content_1',
    fields: { caption: 'old' },
    assetIds: [],
    targetId: 'target_1',
    networkProfileId: null,
  };
  return { job, snapshot };
}

describe('Process archive lifecycle', () => {
  it('preserves content/jobs across archive and restart, excludes new claims, then restores explicitly', () => {
    const { job, snapshot } = fixtureJob();
    db.createJob(job, snapshot);
    const process = db.getProcess(job.processId);
    const archived = db.saveProcess({ ...process, archived: true }, process.revision);
    expect(db.listProcesses()).toEqual([]);
    expect(db.listProcesses(true)[0]!.archived).toBe(true);
    expect(
      db.claimDueJob(job.deviceId, 'worker_archive', Date.parse('2030-01-01T00:00:00Z')).status,
    ).toBe('EMPTY');
    expect(db.getJob(job.id).job.state).toBe('SCHEDULED');
    expect(db.getJob(job.id).snapshot).toEqual(snapshot);
    const content = db.listContent(job.processId);
    db.close();
    db = new StudioDatabase(join(dir, 'studio.sqlite'));
    closes.push(db);
    expect(db.listContent(job.processId)).toEqual(content);
    expect(() => db.saveProcess({ ...process, archived: false }, process.revision)).toThrow(
      'changed',
    );
    const restored = db.saveProcess({ ...archived, archived: false }, archived.revision);
    expect(db.listProcesses()).toEqual([restored]);
    expect(db.getJob(job.id).snapshot).toEqual(snapshot);
    expect(
      db.claimDueJob(job.deviceId, 'worker_archive', Date.parse('2030-01-01T00:00:00Z')).status,
    ).toBe('CLAIMED');
  });
});

describe('workflow persistence', () => {
  it('starts with no fake phones/accounts/jobs or workflows', () => {
    expect(db.listDevices()).toEqual([]);
    expect(db.listWorkflows()).toEqual([]);
    expect(db.listApps()).toHaveLength(5);
  });
  it('saves, restarts and clones a full subgraph/custom-field bundle', () => {
    const draft = db.createWorkflow('fb', 'Full bundle');
    draft.bundle.graphs.push({
      id: 'custom',
      nodes: [{ id: 'finish', type: 'end', name: 'Child', x: 0, y: 0, config: {} }],
      edges: [],
      inputs: [],
      outputs: [],
    });
    draft.bundle.inputs.push({
      key: 'customValue',
      type: 'boolean',
      scope: 'row',
      required: false,
    });
    expect(db.saveDraft(draft.bundle, 0).revision).toBe(1);
    db.close();
    db = new StudioDatabase(join(dir, 'studio.sqlite'));
    closes.push(db);
    const loaded = db.getDraft(draft.workflowId);
    expect(loaded.bundle.graphs).toHaveLength(2);
    expect(loaded.bundle.inputs[0]?.key).toBe('customValue');
    const clone = db.cloneWorkflow(draft.workflowId);
    expect(clone.workflowId).not.toBe(draft.workflowId);
    expect(clone.bundle.graphs).toEqual(loaded.bundle.graphs);
    expect(clone.bundle.inputs).toEqual(loaded.bundle.inputs);
  });
  it('rejects stale saves and leaves the latest revision untouched', () => {
    const d = db.createWorkflow('fb', 'One');
    db.saveDraft(d.bundle, 0);
    expect(() => db.saveDraft(d.bundle, 0)).toThrow('changed');
    expect(db.getDraft(d.workflowId).revision).toBe(1);
  });
  it('pins immutable versions even after draft changes and archival', () => {
    const d = db.createWorkflow('fb', 'Original'),
      v = db.createVersion(d.workflowId, 0);
    d.bundle.workflow.name = 'Changed';
    db.saveDraft(d.bundle, 0);
    db.archiveWorkflow(d.workflowId);
    expect(db.listWorkflows()).toEqual([]);
    expect(db.getVersion(v.id).bundle.workflow.name).toBe('Original');
    expect(db.getVersion(v.id).hash).toBe(v.hash);
  });
  it('rejects malformed imports before creating any record', () => {
    const d = db.createWorkflow('fb', 'Original');
    Reflect.set(d.bundle.graphs[0]!.nodes[0]!, 'type', 'shell');
    expect(() => db.importWorkflow(d.bundle)).toThrow();
    expect(db.listWorkflows()).toHaveLength(1);
    expect(() => db.createWorkflow('not_registered', 'Wrong')).toThrow();
    expect(db.listWorkflows()).toHaveLength(1);
  });
});
describe('Process and content scopes', () => {
  it('persists independent schedules/preferences and rejects app/version mismatch', () => {
    const a = processInput('p_a'),
      b = processInput('p_b');
    b.schedule.slots = ['09:30'];
    db.saveProcess(a, null);
    db.saveProcess(b, null);
    db.savePreference('theme', 'dark', 0);
    expect(db.getProcess('p_a').schedule.slots).toHaveLength(3);
    expect(db.getProcess('p_b').schedule.slots).toEqual(['09:30']);
    expect(db.getPreference('theme')?.value).toBe('dark');
    expect(() => db.savePreference('theme', 'light', 0)).toThrow('changed');
    const wf = db.createWorkflow('tt', 'TikTok');
    expect(() => db.saveProcess({ ...a, workflowId: wf.workflowId }, 0)).toThrow('apps differ');
  });
  it('keeps typed zero/false/list and ordered reusable assets', () => {
    db.saveProcess(processInput(), null);
    for (const id of ['asset_a', 'asset_b'])
      db.registerAsset({
        id,
        sourceRef: 'test_only_ref',
        relativePath: id + '.mp4',
        hash: contentHash(id),
        bytes: 12,
        mtimeMs: 1,
        kind: 'video',
      });
    const item = {
      id: 'row_1',
      processId: 'process_1',
      revision: 0,
      fields: { count: 0, enabled: false, comments: ['a\nb', 'c'] },
      assetIds: ['asset_b', 'asset_a'],
      ignored: false,
    };
    db.saveContent(item, null);
    db.saveContent({ ...item, id: 'row_2' }, null);
    expect(db.listContent('process_1')[0]?.assetIds).toEqual(['asset_b', 'asset_a']);
    expect(db.listContent('process_1')[0]?.fields).toEqual(item.fields);
    db.saveContent({ ...item, ignored: true }, 0);
    expect(db.listContent('process_1')).toHaveLength(1);
  });
  it('rolls back an asset reference failure and rejects cross-Process row edits', () => {
    db.saveProcess(processInput(), null);
    db.saveProcess(processInput('other'), null);
    const row = {
      id: 'row_1',
      processId: 'process_1',
      revision: 0,
      fields: {},
      assetIds: [],
      ignored: false,
    };
    expect(() => db.saveContent({ ...row, assetIds: ['missing'] }, null)).toThrow();
    expect(db.listContent('process_1')).toEqual([]);
    db.saveContent(row, null);
    expect(() => db.saveContent({ ...row, processId: 'other' }, 0)).toThrow('another Process');
    expect(db.listContent('process_1')).toHaveLength(1);
  });
});
describe('snapshots, leases and effect durability', () => {
  it('pins job content/version and blocks duplicate occurrences or fabricated success', () => {
    const { job, snapshot } = fixtureJob();
    db.createJob(job, snapshot);
    db.saveContent(
      {
        id: 'content_1',
        processId: 'process_1',
        revision: 0,
        fields: { caption: 'new' },
        assetIds: [],
        ignored: false,
      },
      0,
    );
    expect(db.getJob(job.id).snapshot.fields.caption).toBe('old');
    expect(() => db.createJob({ ...job, id: 'another_job' }, snapshot)).toThrow();
    expect(() =>
      db.createJob(
        { ...job, id: 'fake', occurrenceKey: contentHash('fake'), state: 'SUCCESS' },
        snapshot,
      ),
    ).toThrow('scheduled');
  });
  it('allows one owner across two connections and keeps fencing monotonic after release', () => {
    db.registerObservedDevice('phone_1', 'Fixture');
    const other = new StudioDatabase(join(dir, 'studio.sqlite'));
    closes.push(other);
    const first = db.acquireLease('phone_1', 'owner_1', 'MANUAL', 100, 1000);
    expect(() => other.acquireLease('phone_1', 'owner_2', 'JOB', 101)).toThrow('owned');
    db.releaseLease(first);
    const next = other.acquireLease('phone_1', 'owner_2', 'JOB', 102);
    expect(next.generation).toBeGreaterThan(first.generation);
    expect(() => db.assertLease(first, 103)).toThrow('expired');
    db.releaseLease(first);
    expect(() => other.assertLease(next, 103)).not.toThrow();
  });
  it('persists uncertainty before a possible device action and rejects redispatch', () => {
    const { job, snapshot } = fixtureJob();
    db.createJob(job, snapshot);
    const lease = db.acquireLease('phone_1', job.id, 'JOB', 1000);
    const effect = db.recordIntent(
      job.id,
      'publish',
      'PUBLISH',
      contentHash('effect'),
      contentHash('payload'),
    );
    db.beginEffectAttempt(effect, lease, 1001);
    expect(db.effectState(effect)).toBe('ATTEMPT_UNCERTAIN');
    expect(() => db.beginEffectAttempt(effect, lease, 1002)).toThrow('dispatched');
    db.close();
    db = new StudioDatabase(join(dir, 'studio.sqlite'));
    closes.push(db);
    expect(db.effectState(effect)).toBe('ATTEMPT_UNCERTAIN');
    expect(() => db.acquireLease('phone_1', 'another', 'JOB', 40000)).toThrow('review');
    expect(() =>
      db.recordIntent(job.id, 'publish', 'PUBLISH', contentHash('effect'), contentHash('payload')),
    ).toThrow();
  });
  it('does not allow a lease from a different phone to authorize an effect', () => {
    const { job, snapshot } = fixtureJob();
    db.createJob(job, snapshot);
    db.registerObservedDevice('phone_2', 'Other fixture');
    const lease = db.acquireLease('phone_2', job.id, 'JOB', 1000);
    const effect = db.recordIntent(
      job.id,
      'publish',
      'PUBLISH',
      contentHash('effect'),
      contentHash('payload'),
    );
    expect(() => db.beginEffectAttempt(effect, lease, 1001)).toThrow('dispatched');
    expect(db.effectState(effect)).toBe('INTENT');
  });
});

describe('schema v18 to v19 durable reconciliation migration', () => {
  it('backfills old JOB observations with their historical claim generation', () => {
    const path = join(dir, 'legacy-stage-v18.sqlite');
    const old = new DatabaseSync(path);
    old.exec('PRAGMA foreign_keys=OFF');
    // One fixture transaction: 18 autocommitted DDL/checksum writes caused
    // avoidable Windows filesystem sync contention under parallel CI tests.
    old.exec('BEGIN IMMEDIATE');
    try {
      for (const step of migrations.filter((item) => item.version <= 18)) {
        old.exec(step.sql);
        old.prepare('INSERT INTO schema_migrations VALUES(?,?)')
          .run(step.version, contentHash(step.sql));
      }
      old.exec('PRAGMA user_version=18');
      old.prepare('INSERT INTO device_stage_reconciliations VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
        .run('legacy_audit', 'legacy_request', 'legacy_stage', 'legacy_job',
          'legacy_device', 'legacy_host', 7, 'REMOTE_BYTES_MATCHED',
          'a'.repeat(64), 24, 'NOT_INDEXED', '2026-10-28T00:00:00.000Z');
      old.exec('COMMIT');
    } catch (error) {
      old.exec('ROLLBACK');
      throw error;
    } finally {
      old.close();
    }
    const migrated = new StudioDatabase(path);
    migrated.close();
    const read = new DatabaseSync(path);
    try {
      const row = read.prepare(
        'SELECT claim_generation,lease_owner_kind,lease_generation FROM device_stage_reconciliations WHERE id=?',
      ).get('legacy_audit');
      expect(row).toMatchObject({
        claim_generation: 7, lease_owner_kind: 'JOB', lease_generation: 7,
      });
      expect(read.prepare('PRAGMA user_version').get()?.user_version).toBe(20);
      expect(read.prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='device_stage_cleanup_reviews'",
      ).get()).toBeTruthy();
    } finally {
      read.close();
    }
  });
});


describe('schema v19 to v20 immutable cleanup review migration', () => {
  it('upgrades a historical v19 database without touching old migration checksums', () => {
    const path = join(dir, 'legacy-cleanup-v19.sqlite'), legacy = new DatabaseSync(path);
    legacy.exec('PRAGMA foreign_keys=OFF');
    legacy.exec('BEGIN IMMEDIATE');
    try {
      for (const step of migrations.filter((item) => item.version <= 19)) {
        legacy.exec(step.sql);
        legacy.prepare('INSERT INTO schema_migrations VALUES(?,?)')
          .run(step.version, contentHash(step.sql));
      }
      legacy.exec('PRAGMA user_version=19');
      legacy.exec('COMMIT');
    } catch (error) {
      legacy.exec('ROLLBACK');
      throw error;
    } finally { legacy.close(); }
    const migrated = new StudioDatabase(path);
    expect(migrated.integrity()).toBe('ok');
    migrated.close();
    const conn = new DatabaseSync(path);
    try {
      expect(conn.prepare('PRAGMA user_version').get()?.user_version).toBe(20);
      const first19 = conn.prepare(
        'SELECT version,checksum FROM schema_migrations WHERE version<=19 ORDER BY version',
      ).all();
      expect(first19).toHaveLength(19);
      for (const [index, row] of first19.entries()) {
        expect(row?.version).toBe(index + 1);
        expect(row?.checksum).toBe(contentHash(migrations[index]!.sql));
      }
      expect(conn.prepare('SELECT COUNT(*) AS count FROM device_stage_cleanup_reviews')
        .get()?.count).toBe(0);
      expect(conn.prepare(
        "SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='cleanup_reviews_immutable_update'",
      ).get()).toBeTruthy();
    } finally { conn.close(); }
  });
});

describe('backup/restore', () => {
  it('migrates a v1 database and restores an older backup through staging', async () => {
    const path = join(dir, 'v1.sqlite'),
      old = new DatabaseSync(path);
    old.exec(migration);
    old.prepare('INSERT INTO schema_migrations VALUES(1,?)').run(contentHash(migration));
    old.exec('PRAGMA user_version=1');
    old.close();
    await db.restoreFrom(path);
    expect(db.integrity()).toBe('ok');
    expect(db.listSources('missing', 'host')).toEqual([]);
  }, 30000);
  it('backs up WAL consistently and restores workflow revisions without losing the previous DB', async () => {
    const draft = db.createWorkflow('fb', 'Before');
    const path = join(dir, 'backup.sqlite');
    await db.backupTo(path);
    draft.bundle.workflow.name = 'After';
    db.saveDraft(draft.bundle, 0);
    await db.restoreFrom(path);
    expect(db.getDraft(draft.workflowId).bundle.workflow.name).toBe('Before');
    expect(db.integrity()).toBe('ok');
  });
  it('rejects corrupt input without replacing the active DB', async () => {
    const draft = db.createWorkflow('fb', 'Keep');
    const path = join(dir, 'corrupt.sqlite');
    writeFileSync(path, 'invalid');
    await expect(db.restoreFrom(path)).rejects.toThrow();
    expect(db.getDraft(draft.workflowId).bundle.workflow.name).toBe('Keep');
    expect(db.integrity()).toBe('ok');
  });
});

describe('host source persistence', () => {
  it('dedupes scans, preserves changed snapshots and keeps ignored media out after reconcile', () => {
    db.saveProcess(processInput(), null);
    const source = db.registerNativeSource({
      processId: 'process_1',
      kind: 'FOLDER',
      rootPath: dir,
      recursive: false,
      watch: false,
      hostId: 'host_test',
    });
    const asset = {
      relativePath: 'video.mp4',
      hash: contentHash('bytes'),
      bytes: 5,
      mtimeMs: 100,
      kind: 'video' as const,
      probe: { status: 'UNAVAILABLE' as const, reason: 'fixture' },
    };
    expect(db.applyScannedAsset(source.id, 'host_test', 0, 'scan1', asset)).toBe('added');
    expect(db.applyScannedAsset(source.id, 'host_test', 0, 'scan2', asset)).toBe('unchanged');
    expect(db.listContent('process_1')).toHaveLength(1);
    expect(
      db.applyScannedAsset(source.id, 'host_test', 0, 'scan3', {
        ...asset,
        hash: contentHash('changed'),
      }),
    ).toBe('changed');
    const row = db.listContent('process_1')[0]!;
    db.ignoreContent(row.id, 0);
    expect(db.applyScannedAsset(source.id, 'host_test', 0, 'scan4', asset)).toBe('ignored');
    expect(db.listContent('process_1')).toEqual([]);
  });
  it('rejects grants from another host and callbacks from a replaced source', () => {
    db.saveProcess(processInput(), null);
    const source = db.registerNativeSource({
      processId: 'process_1',
      kind: 'FOLDER',
      rootPath: dir,
      recursive: false,
      watch: false,
      hostId: 'host_test',
    });
    expect(() => db.getSourceGrant(source.id, 'different_host')).toThrow('another host');
    expect(db.listSources('process_1', 'different_host')[0]?.requiresRebind).toBe(true);
    db.registerNativeSource({
      processId: 'process_1',
      kind: 'FOLDER',
      rootPath: dir,
      recursive: true,
      watch: false,
      hostId: 'host_test',
    });
    expect(() => db.finishSourceScan(source.id, 'host_test', 0, 'late_scan')).toThrow('changed');
  });
});
