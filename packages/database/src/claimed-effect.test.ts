import { beforeEach, afterEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { JobDefinition, JobSnapshot, DeviceLease, ProcessDefinition, WorkflowNode, WorkflowEdge } from '@autoreels/contracts';
import { contentHash } from '@autoreels/domain';
import { StudioDatabase } from './index.js';
import { dispatchInternal } from '../../../apps/desktop/src/host/internal.js';
import { dispatch } from '../../../apps/desktop/src/host/service.js';

const at = Date.parse('2026-10-27T00:00:00Z');
let dir: string, db: StudioDatabase;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'autoreels-effect-claim-'));
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const node = (
  id: string,
  type: WorkflowNode['type'],
  config: WorkflowNode['config'] = {},
): WorkflowNode => ({ id, type, name: id, x: 10, y: 10, config });
const edge = (id: string, source: string, port: WorkflowEdge['port'], target: string): WorkflowEdge =>
  ({ id, source, port, target });
function fixture(deviceId = 'device_1', index = '1') {
  db.registerObservedDevice(deviceId, deviceId);
  const draft = db.createWorkflow('fb', 'Strict effect fixture');
  const bundle = structuredClone(draft.bundle),
    graph = bundle.graphs[0]!;
  graph.nodes = [
    node('start', 'start'),
    node('intent', 'transaction', {
      effectKind: 'PUBLISH', idempotencyScope: 'content-target', payloadHash: 'frozen-payload',
    }),
    node('publish', 'tap', { selector: '#publish', effectClassification: 'publish' }),
    node('verify', 'verify', { verificationProfile: 'profile', evidenceMapping: {} }),
    node('cleanup', 'cleanup', { ownershipLedgerRef: 'owned-ledger', terminalPolicy: 'verified' }),
    node('review', 'review', { reasonCode: 'UNKNOWN_EFFECT', evidenceRefs: [] }),
    node('end', 'end'),
  ];
  graph.edges = [
    edge('s', 'start', 'next', 'intent'),
    edge('intent_next', 'intent', 'next', 'publish'),
    edge('intent_error', 'intent', 'error', 'review'),
    edge('publish_next', 'publish', 'next', 'verify'),
    edge('publish_error', 'publish', 'error', 'review'),
    edge('verify_true', 'verify', 'true', 'cleanup'),
    edge('verify_false', 'verify', 'false', 'review'),
    edge('verify_error', 'verify', 'error', 'review'),
    edge('cleanup_next', 'cleanup', 'next', 'end'),
    edge('cleanup_error', 'cleanup', 'error', 'review'),
  ];
  const saved = db.saveDraft(bundle, draft.revision),
    version = db.createVersion(saved.workflowId, saved.revision);
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
      weekdays: [1,2,3,4,5,6,7],
      overduePolicy: 'CATCH_UP',
      jitterMinutes: 0,
    },
  };
  db.saveProcess(process, null);
  const contentId = 'content_' + index;
  db.saveContent({
    id: contentId, processId: process.id, revision: 0, fields: {}, assetIds: [], ignored: false,
  }, null);
  const preview = db.previewSchedule(process.id, [contentId], null, '2026-10-26T00:00:00Z', 1);
  const [jobId] = db.applySchedule(preview.token, null, '2026-10-26T00:00:00Z').jobIds;
  const claim = db.claimDueJob(deviceId, 'worker_' + index, at, 3000);
  expect(claim.status).toBe('CLAIMED');
  if (claim.status !== 'CLAIMED') throw new Error('Claim fixture must be claimed');
  const running = db.transitionJob(claim.job.id, 'RUNNING', claim.job.revision);
  return { jobId: jobId!, lease: claim.lease, snapshotHash: claim.snapshotHash, running };
}
function prepare(args: {
  jobId: string;
  lease: DeviceLease;
  snapshotHash: string;
  running: JobDefinition;
}, atTime = at + 50, key = contentHash('publish_key')) {
  return db.prepareClaimedEffect({
    jobId: args.jobId,
    lease: args.lease,
    expectedJobRevision: args.running.revision,
    expectedSnapshotHash: args.snapshotHash,
    nodeId: 'publish',
    kind: 'PUBLISH',
    effectKey: key,
    payloadHash: contentHash('frozen_payload'),
    at: atTime,
  });
}

it('commits intent and pending attempt with job phase atomically and never reports a posted success', () => {
  const fixtureData = fixture();
  const intent = prepare(fixtureData);
  expect(intent).toMatchObject({ jobId: fixtureData.jobId, state: 'INTENT' });
  expect(db.effectState(intent.effectId)).toBe('INTENT');
  expect(db.getJob(fixtureData.jobId).job).toMatchObject({
    state: 'POST_INTENT', revision: fixtureData.running.revision + 1,
  });
  expect(db.getJob(fixtureData.jobId).snapshotHash).toBe(fixtureData.snapshotHash);
  const started = db.beginClaimedEffectAttempt({
    effectId: intent.effectId,
    expectedJobRevision: intent.jobRevision,
    lease: fixtureData.lease,
    at: at + 100,
  });
  expect(started).toMatchObject({
    effectId: intent.effectId,
    jobId: fixtureData.jobId,
    state: 'ATTEMPT_UNCERTAIN',
  });
  expect(db.getJob(fixtureData.jobId).job).toMatchObject({
    state: 'POST_PENDING', revision: intent.jobRevision + 1,
  });
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  expect(sql.prepare('SELECT state FROM effects WHERE id=?').get(intent.effectId)?.state).toBe(
    'ATTEMPT_UNCERTAIN',
  );
  const events = sql.prepare(
    "SELECT kind,detail FROM queue_events WHERE job_id=? ORDER BY created_at,kind",
  ).all(fixtureData.jobId);
  expect(events.map((e) => e.kind)).toContain('EFFECT_INTENT_COMMITTED');
  expect(events.map((e) => e.kind)).toContain('EFFECT_ATTEMPT_UNCERTAIN');
  expect(JSON.stringify(events)).not.toContain('frozen_payload');
  expect(JSON.stringify(events)).not.toContain(contentHash('frozen_payload'));
  sql.close();
  expect(() => db.beginClaimedEffectAttempt({
    effectId: intent.effectId, expectedJobRevision: started.jobRevision,
    lease: fixtureData.lease, at: at + 150,
  })).toThrow('Unattempted');
  expect(db.getJob(fixtureData.jobId).snapshotHash).toBe(fixtureData.snapshotHash);
  expect(db.getJob(fixtureData.jobId).job.state).not.toBe('SUCCESS');
});

it('retains committed intent on restart and requires review instead of replaying the same key', () => {
  const f = fixture();
  const intent = prepare(f);
  db.close();
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.effectState(intent.effectId)).toBe('INTENT');
  expect(db.getJob(f.jobId).job.state).toBe('POST_INTENT');
  expect(() => prepare(f, at + 100)).toThrow();
  expect(db.recoverExpiredClaims(f.lease.deviceId, at + 3000)).toEqual({
    requeued: [], review: [f.jobId],
  });
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(db.claimDueJob(f.lease.deviceId, 'after_restart', at + 3001).status).toBe('NEEDS_REVIEW');
  expect(db.effectState(intent.effectId)).toBe('INTENT');
});

it('recovers uncertain attempts without reenqueuing or repeating irreversible actions', () => {
  const f = fixture(), intent = prepare(f);
  db.beginClaimedEffectAttempt({
    effectId: intent.effectId, expectedJobRevision: intent.jobRevision, lease: f.lease, at: at + 200,
  });
  db.close();
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.effectState(intent.effectId)).toBe('ATTEMPT_UNCERTAIN');
  expect(db.recoverExpiredClaims(f.lease.deviceId, at + 3000)).toEqual({
    requeued: [], review: [f.jobId],
  });
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(db.effectState(intent.effectId)).toBe('ATTEMPT_UNCERTAIN');
  expect(db.claimDueJob(f.lease.deviceId, 'retry', at + 3001).status).toBe('NEEDS_REVIEW');
});

it('rejects stale claim generation, expired leases, bad hashes, wrong node and duplicate effect key', () => {
  const f = fixture();
  expect(() => db.prepareClaimedEffect({
    jobId: f.jobId,
    expectedJobRevision: f.running.revision,
    expectedSnapshotHash: f.snapshotHash,
    nodeId: 'start',
    kind: 'PUBLISH',
    effectKey: contentHash('wrong_node'),
    payloadHash: contentHash('payload'),
    lease: f.lease,
    at: at + 10,
  })).toThrow('pinned');
  expect(() => db.prepareClaimedEffect({
    jobId: f.jobId, expectedJobRevision: f.running.revision,
    expectedSnapshotHash: contentHash('wrong_snapshot'),
    nodeId: 'publish', kind: 'PUBLISH',
    effectKey: contentHash('bad_hash'), payloadHash: contentHash('payload'),
    lease: f.lease, at: at + 10,
  })).toThrow('snapshot');
  expect(() => prepare({ ...f, lease: { ...f.lease, generation: f.lease.generation + 1 } })).toThrow();
  expect(() => prepare(f, at + 3000)).toThrow();
  const intent = prepare(f);
  expect(() => prepare(f)).toThrow();
  const other = fixture('device_2', '2');
  expect(() => prepare(other, at + 60, contentHash('publish_key'))).toThrow('durable');
  expect(db.getJob(other.jobId).job.state).toBe('RUNNING');
  expect(db.effectState(intent.effectId)).toBe('INTENT');
});

it('private worker allows explicit guarded intent but public dispatcher refuses effect commands', async () => {
  const f = fixture();
  await expect(
    dispatch(db, {
      operationId: 'op_forged_effect', command: 'effect.prepareClaimed' as never,
      input: { jobId: f.jobId, lease: f.lease, at: at + 10 },
    }),
  ).rejects.toThrow();
  const intent = dispatchInternal(db, {
    command: 'effect.prepareClaimed',
    jobId: f.jobId,
    expectedJobRevision: f.running.revision,
    expectedSnapshotHash: f.snapshotHash,
    nodeId: 'publish',
    kind: 'PUBLISH',
    effectKey: contentHash('worker_key'),
    payloadHash: contentHash('payload'),
    lease: f.lease,
    at: at + 50,
  }) as { effectId: string; jobRevision: number };
  expect(db.effectState(intent.effectId)).toBe('INTENT');
  const attempted = dispatchInternal(db, {
    command: 'effect.beginClaimedAttempt',
    effectId: intent.effectId,
    expectedJobRevision: intent.jobRevision,
    lease: f.lease,
    at: at + 70,
  }) as { state: string };
  expect(attempted.state).toBe('ATTEMPT_UNCERTAIN');
  const lease = f.lease;
  expect(() => db.prepareClaimedEffect({
    jobId: f.jobId,
    expectedJobRevision: intent.jobRevision,
    expectedSnapshotHash: f.snapshotHash,
    nodeId: 'publish', kind: 'PUBLISH',
    effectKey: contentHash('extra'), payloadHash: contentHash('payload'),
    lease, at: at + 100,
  })).toThrow();
});
