import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { QueueClaimResult, ProcessDefinition } from '@autoreels/contracts';
import { contentHash } from '@autoreels/domain';
import { StudioDatabase } from './index.js';
import { DbClient } from '../../../apps/desktop/dist/host/host/db-client.js';

let db: StudioDatabase, dir: string;
const clients: DbClient[] = [];
const now = Date.parse('2026-10-27T00:00:00Z');
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'autoreels-queue-'));
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
});
afterEach(async () => {
  for (const client of clients.splice(0)) await client.close();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
function fixture(deviceId = 'device_1', index = '1', overduePolicy: ProcessDefinition['schedule']['overduePolicy'] = 'CATCH_UP'): string[] {
  db.registerObservedDevice(deviceId, deviceId);
  const draft = db.createWorkflow('fb', 'Queue fixture'),
    version = db.createVersion(draft.workflowId, 0);
  const process: ProcessDefinition = {
    id: 'process_' + index,
    name: 'Process ' + index,
    appId: 'fb',
    workflowId: draft.workflowId,
    workflowVersionId: version.id,
    deviceId,
    accountId: null,
    targetId: null,
    revision: 0,
    archived: false,
    schedule: {
      timezone: 'Asia/Ho_Chi_Minh',
      startDate: '2026-10-26',
      slots: ['08:00', '12:00'],
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      overduePolicy,
      jitterMinutes: 0,
    },
  };
  db.saveProcess(process, null);
  const ids = ['content_' + index + '_a', 'content_' + index + '_b'];
  for (const id of ids)
    db.saveContent(
      { id, processId: process.id, revision: 0, fields: {}, assetIds: [], ignored: false },
      null,
    );
  const p = db.previewSchedule(process.id, ids, null, '2026-10-26T00:00:00Z', 1);
  return db.applySchedule(p.token, null, '2026-10-26T00:00:00Z').jobIds;
}
function claim(device = 'device_1', owner = 'worker_1', at = now, ttl = 1000) {
  const result = db.claimDueJob(device, owner, at, ttl);
  expect(result.status).toBe('CLAIMED');
  if (result.status !== 'CLAIMED') throw new Error('Fixture claim failed');
  return result;
}
it('serializes actual concurrent DB workers for one phone while another phone remains independent', async () => {
  fixture();
  fixture('device_2', '2');
  const a = new DbClient(join(dir, 'studio.sqlite')),
    b = new DbClient(join(dir, 'studio.sqlite'));
  clients.push(a, b);
  await Promise.all([a.request('bootstrap'), b.request('bootstrap')]);
  const results = await Promise.all([
    a.internal<QueueClaimResult>({
      command: 'queue.claim',
      deviceId: 'device_1',
      ownerId: 'worker_a',
      at: now,
      ttl: 1000,
    }),
    b.internal<QueueClaimResult>({
      command: 'queue.claim',
      deviceId: 'device_1',
      ownerId: 'worker_b',
      at: now,
      ttl: 1000,
    }),
  ]);
  expect(results.filter((r) => r.status === 'CLAIMED')).toHaveLength(1);
  expect(results.filter((r) => r.status === 'DEVICE_BUSY')).toHaveLength(1);
  expect(
    (
      await b.internal<QueueClaimResult>({
        command: 'queue.claim',
        deviceId: 'device_2',
        ownerId: 'worker_c',
        at: now,
        ttl: 1000,
      })
    ).status,
  ).toBe('CLAIMED');
  await expect(
    a.request('queue.claim' as never, { deviceId: 'device_1', ownerId: 'forged' }),
  ).rejects.toThrow();
});
it('honors due time and priority, never allocates a lease for empty or disabled devices', () => {
  const ids = fixture(),
    sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  sql
    .prepare('UPDATE jobs SET scheduled_utc=?,priority=? WHERE id=?')
    .run(new Date(now - 100).toISOString(), 1, ids[0]!);
  sql
    .prepare('UPDATE jobs SET scheduled_utc=?,priority=? WHERE id=?')
    .run(new Date(now - 100).toISOString(), 2, ids[1]!);
  expect(claim().job.id).toBe(ids[1]);
  db.registerObservedDevice('device_empty', 'Empty');
  expect(db.claimDueJob('device_empty', 'worker_2', now).status).toBe('EMPTY');
  expect(sql.prepare('SELECT 1 FROM leases WHERE device_id=?').get('device_empty')).toBeUndefined();
  sql.prepare('UPDATE devices SET enabled=0 WHERE id=?').run('device_empty');
  expect(db.claimDueJob('device_empty', 'worker_2', now).status).toBe('DEVICE_DISABLED');
  sql.close();
});
it('does not displace manual owners and does not claim future jobs', () => {
  fixture();
  const manual = db.acquireLease('device_1', 'manual_1', 'MANUAL', now, 1000);
  expect(db.claimDueJob('device_1', 'worker_1', now).status).toBe('DEVICE_BUSY');
  db.assertLease(manual, now + 1);
  db.releaseLease(manual);
  expect(db.claimDueJob('device_1', 'worker_1', Date.parse('2026-10-25T00:00:00Z')).status).toBe(
    'EMPTY',
  );
});
it('renews both ownership records and rejects expired/stale/invalid clocks', () => {
  fixture();
  const c = claim(),
    renewed = db.renewJobClaim(c.job.id, c.lease, now + 500, 2000);
  expect(renewed.expiresAt).toBe(now + 2500);
  expect(db.renewJobClaim(c.job.id, renewed, now + 600, 1).expiresAt).toBe(renewed.expiresAt);
  db.assertLease(renewed, now + 1500);
  expect(db.recoverExpiredClaims('device_1', now + 1500)).toEqual({ requeued: [], review: [] });
  for (const at of [NaN, Infinity, Number.MAX_SAFE_INTEGER])
    expect(() => db.claimDueJob('device_1', 'worker_x', at)).toThrow();
  expect(() => db.assertLease(renewed, NaN)).toThrow('clock');
  expect(() =>
    db.renewJobClaim(c.job.id, { ...renewed, generation: renewed.generation - 1 }, now + 1600),
  ).toThrow();
  expect(() => db.renewJobClaim(c.job.id, renewed, now + 2500)).toThrow('expired');
});
it('recovers preflight without effects after restart, retaining the same job/snapshot and fencing the old owner', () => {
  fixture();
  const c = claim(),
    hash = c.snapshotHash;
  db.close();
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.recoverExpiredClaims('device_1', now + 1000)).toEqual({
    requeued: [c.job.id],
    review: [],
  });
  expect(db.recoverExpiredClaims('device_1', now + 1000)).toEqual({ requeued: [], review: [] });
  const next = claim('device_1', 'worker_new', now + 1001);
  expect(next.job.id).toBe(c.job.id);
  expect(next.snapshotHash).toBe(hash);
  expect(next.lease.generation).toBe(c.lease.generation + 1);
  expect(() => db.assertLease(c.lease, now + 1002)).toThrow('superseded');
  expect(db.listJobs().jobs).toHaveLength(2);
});
it('moves running or journaled claims to review instead of replaying input', () => {
  fixture();
  const c = claim();
  db.transitionJob(c.job.id, 'RUNNING', c.job.revision);
  expect(db.recoverExpiredClaims('device_1', now + 1000)).toEqual({
    requeued: [],
    review: [c.job.id],
  });
  expect(db.claimDueJob('device_1', 'worker_new', now + 1001).status).toBe('NEEDS_REVIEW');
  fixture('device_2', '2');
  const other = claim('device_2', 'worker_two');
  const effect = db.recordIntent(
    other.job.id,
    'node_publish',
    'PUBLISH',
    contentHash('effect'),
    contentHash('payload'),
  );
  db.beginEffectAttempt(effect, other.lease, now + 1);
  expect(db.recoverExpiredClaims('device_2', now + 1000).review).toEqual([other.job.id]);
  expect(db.effectState(effect)).toBe('ATTEMPT_UNCERTAIN');
  expect(db.getJob(other.job.id).snapshotHash).toBe(other.snapshotHash);
});
it('preserves a newer manual lease during recovery and blocks active jobs without a matching claim', () => {
  fixture();
  const c = claim(),
    manual = db.acquireLease('device_1', 'manual_new', 'MANUAL', now + 1000, 5000);
  expect(db.recoverExpiredClaims('device_1', now + 1001).requeued).toEqual([c.job.id]);
  db.assertLease(manual, now + 1002);
  expect(db.claimDueJob('device_1', 'worker_new', now + 1002).status).toBe('DEVICE_BUSY');
  db.releaseLease(manual);
  db.transitionJob(c.job.id, 'PREFLIGHT', db.getJob(c.job.id).job.revision);
  expect(db.claimDueJob('device_1', 'worker_new', now + 1003).status).toBe('DEVICE_BUSY');
});


it('reconciles a real sleep gap using frozen policies without reissuing external actions', () => {
  const began = Date.parse('2026-10-25T23:00:00Z'),
    resumed = Date.parse('2026-10-26T06:00:00Z');
  const catchUp = fixture('device_1', '1', 'CATCH_UP');
  const skip = fixture('device_2', '2', 'SKIP');
  const next = fixture('device_3', '3', 'NEXT_FUTURE_SLOT');
  // Mutating Process settings after scheduling must not change pinned job policy.
  const process = db.getProcess('process_2');
  db.saveProcess(
    { ...process, schedule: { ...process.schedule, overduePolicy: 'CATCH_UP' } },
    process.revision,
  );
  const frozen = new Map([...catchUp, ...skip, ...next].map((id) => [id, db.getJob(id).snapshotHash]));
  const result = db.reconcileSleepGap(began, resumed);
  expect(result.queued).toEqual(catchUp);
  expect(result.skipped).toEqual(skip);
  expect(result.postponed.map((item) => item.jobId)).toEqual(next);
  expect(new Set(result.postponed.map((item) => item.scheduledUtc)).size).toBe(next.length);
  for (const id of catchUp) expect(db.getJob(id).job.state).toBe('QUEUED');
  for (const id of skip) expect(db.getJob(id).job.state).toBe('SKIPPED');
  for (const id of next) expect(db.getJob(id).job.state).toBe('SCHEDULED');
  for (const id of frozen.keys()) expect(db.getJob(id).snapshotHash).toBe(frozen.get(id));
  expect(db.reconcileSleepGap(began, resumed)).toEqual({
    queued: [], skipped: [], postponed: [], review: [],
  });
  db.close();
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.reconcileSleepGap(began, resumed)).toEqual({
    queued: [], skipped: [], postponed: [], review: [],
  });
});

it('never replays claimed jobs or jobs with any effect, and keeps the old snapshot immutable', () => {
  const ids = fixture('device_1', '1', 'CATCH_UP'),
    began = Date.parse('2026-10-25T23:00:00Z'),
    resumed = Date.parse('2026-10-27T00:00:00Z');
  const old = db.getJob(ids[0]!).snapshotHash;
  db.recordIntent(ids[0]!, 'publish_node', 'PUBLISH', contentHash('sleep-effect'), contentHash('payload'));
  expect(db.reconcileSleepGap(began, resumed)).toEqual({
    queued: [ids[1]!], skipped: [], postponed: [], review: [ids[0]!],
  });
  expect(db.getJob(ids[0]!).job.state).toBe('NEEDS_REVIEW');
  expect(db.getJob(ids[0]!).snapshotHash).toBe(old);
  expect(db.claimDueJob('device_1', 'worker_new', resumed + 1).status).toBe('NEEDS_REVIEW');
  const another = fixture('device_2', '2', 'SKIP');
  db.claimDueJob('device_2', 'manual_worker', resumed, 1000);
  const second = db.reconcileSleepGap(began, resumed);
  expect(second.skipped).not.toContain(another[0]);
  expect(db.getJob(another[0]!).job.state).toBe('PREFLIGHT');
});

it('bounds sleep gap inputs and excludes normal queue delay and future jobs', () => {
  const ids = fixture();
  for (const [a, b] of [
    [NaN, now],
    [now, now],
    [now, now + 20000],
    [now, now + 8 * 86400000],
    [Number.MAX_SAFE_INTEGER, now],
  ])
    expect(() => db.reconcileSleepGap(a, b)).toThrow();
  const result = db.reconcileSleepGap(
    Date.parse('2026-10-27T00:00:00Z'),
    Date.parse('2026-10-27T01:00:00Z'),
  );
  expect(result).toEqual({ queued: [], skipped: [], postponed: [], review: [] });
  for (const id of ids) expect(db.getJob(id).job.state).toBe('SCHEDULED');
});
