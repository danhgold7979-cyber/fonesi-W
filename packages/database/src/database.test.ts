import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProcessDefinition, JobSnapshot, JobDefinition } from '@autoreels/contracts';
import { contentHash } from '@autoreels/domain';
import { StudioDatabase } from './index.js';

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
describe('backup/restore', () => {
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
