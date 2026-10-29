import { beforeEach, afterEach, expect, it } from 'vitest';
import { HostClaimedEffectService } from '../../../apps/desktop/src/host/claimed-effect-service.js';
import type { ClaimedEffectAdapter } from '../../../apps/desktop/src/host/claimed-effect-service.js';
import type { InternalRequest } from '../../../apps/desktop/src/host/internal.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { JobDefinition, DeviceLease, ProcessDefinition, WorkflowNode, WorkflowEdge } from '@autoreels/contracts';
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
function fixture(
  deviceId = 'device_1', index = '1', withComment = false,
  commentValues?: string[],
) {
  db.registerObservedDevice(deviceId, deviceId);
  // A verified profile fixture is required even before the provider preflight.
  const setup = new DatabaseSync(join(dir, 'studio.sqlite'));
  setup.prepare(
    "INSERT INTO device_profiles(device_id,fingerprint,metadata,identity,revision) VALUES(?,?,NULL,'VERIFIED_PROPERTIES',0)",
  ).run(deviceId, contentHash({ deviceId, verifiedFixture: true }));
  if (withComment) {
    // Process must use registered app/device-matching identities. These are
    // deliberately synthetic SQLite fixtures, not observed provider accounts.
    for (const [id, kind] of [
      ['account_comment', 'account'],
      ['target_comment', 'target'],
    ] as const) {
      setup.prepare(
        'INSERT INTO identities(id,app_id,device_id,kind,fingerprint) VALUES(?,?,?,?,?)',
      ).run(id, 'fb', deviceId, kind, contentHash({ id, deviceId, fixture: true }));
    }
  }
  setup.close();
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
  if (withComment) {
    bundle.inputs.push({
      key: 'comments', type: 'list', scope: 'row', required: true, itemType: 'text',
    });
    graph.nodes.push(
      node('commentIntent', 'transaction', {
        effectKind: 'COMMENT', idempotencyScope: 'comment-item', payloadHash: 'pinned-comment',
      }),
      node('comment', 'tap', { selector: '#comment', effectClassification: 'comment' }),
      node('commentVerify', 'verify', { verificationProfile: 'comment', evidenceMapping: {} }),
    );
    graph.edges.find((e) => e.id === 'verify_true')!.target = 'commentIntent';
    graph.edges.push(
      edge('comment_intent_next', 'commentIntent', 'next', 'comment'),
      edge('comment_intent_error', 'commentIntent', 'error', 'review'),
      edge('comment_next', 'comment', 'next', 'commentVerify'),
      edge('comment_error', 'comment', 'error', 'review'),
      edge('comment_verified', 'commentVerify', 'true', 'cleanup'),
      edge('comment_not_verified', 'commentVerify', 'false', 'review'),
      edge('comment_verify_error', 'commentVerify', 'error', 'review'),
    );
  }
  const saved = db.saveDraft(bundle, draft.revision),
    version = db.createVersion(saved.workflowId, saved.revision);
  const process: ProcessDefinition = {
    id: 'process_' + index,
    name: 'Process ' + index,
    appId: 'fb',
    workflowId: draft.workflowId,
    workflowVersionId: version.id,
    deviceId,
    accountId: withComment ? 'account_comment' : null,
    targetId: withComment ? 'target_comment' : null,
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
    id: contentId, processId: process.id, revision: 0,
    fields: withComment
      ? { comments: commentValues ??
          ['Bình luận thứ nhất 👨‍👩‍👧\r\nCâu tiếp', 'Bình luận thứ nhất 👨‍👩‍👧\r\nCâu tiếp'] }
      : {},
    assetIds: [], ignored: false,
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


it('does not allow a comment attempt until the previous publish is explicitly verified', () => {
  const f = fixture('device_1', '1', true);
  const publish = prepare(f);
  const pending = db.beginClaimedEffectAttempt({
    effectId: publish.effectId,
    expectedJobRevision: publish.jobRevision,
    lease: f.lease,
    at: at + 100,
  });
  const commentSource = {
    postEffectId: publish.effectId, fieldKey: 'comments', scope: 'row' as const, ordinal: 0,
  };
  let commentHashes = {
    effectKey: contentHash('comment_ordinal_0'),
    payloadHash: contentHash('comment-payload'),
  };
  const commentInput = (revision: number) => ({
    jobId: f.jobId,
    expectedJobRevision: revision,
    expectedSnapshotHash: f.snapshotHash,
    nodeId: 'comment',
    kind: 'COMMENT' as const,
    ...commentHashes,
    commentSource,
    lease: f.lease,
    at: at + 130,
  });
  expect(() => db.prepareClaimedEffect(commentInput(pending.jobRevision))).toThrow('phase');

  // DB-only verification fixture, not a provider assertion or external post.
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  sql.prepare("UPDATE jobs SET state='POSTED',revision=revision+1 WHERE id=?").run(f.jobId);
  sql.prepare("UPDATE effects SET state='DEFINITIVELY_REJECTED' WHERE id=?").run(publish.effectId);
  const postedRevision = db.getJob(f.jobId).job.revision;
  expect(() => db.prepareClaimedEffect(commentInput(postedRevision))).toThrow('verified');
  sql.prepare("UPDATE effects SET state='CONFIRMED' WHERE id=?").run(publish.effectId);
  sql.close();

  const plan = db.frozenCommentListPlan({
    jobId: f.jobId, expectedSnapshotHash: f.snapshotHash, postEffectId: publish.effectId,
    fieldKey: 'comments', scope: 'row',
  });
  expect(plan.status).toBe('FROZEN_COMMENTS_PROVIDER_UNVERIFIED');
  commentHashes = {
    effectKey: plan.items[0]!.effectKey, payloadHash: plan.items[0]!.payloadHash,
  };
  expect(plan.items[1]!.effectKey).not.toBe(commentHashes.effectKey);
  const intent = db.prepareClaimedEffect(commentInput(postedRevision));
  expect(db.getJob(f.jobId).job.state).toBe('COMMENT_PENDING');
  expect(db.effectState(intent.effectId)).toBe('INTENT');
  const attempted = db.beginClaimedEffectAttempt({
    effectId: intent.effectId,
    expectedJobRevision: intent.jobRevision,
    lease: f.lease,
    at: at + 160,
  });
  expect(attempted.state).toBe('ATTEMPT_UNCERTAIN');
  expect(db.getJob(f.jobId).job.state).toBe('COMMENT_PENDING');
  expect(() => db.prepareClaimedEffect({
    ...commentInput(attempted.jobRevision), effectKey: contentHash('comment_ordinal_1'),
  })).toThrow('phase');
  const after = new DatabaseSync(join(dir, 'studio.sqlite'));
  expect(after.prepare("SELECT COUNT(*) AS n FROM effects WHERE job_id=? AND kind='PUBLISH'").get(f.jobId)?.n).toBe(1);
  expect(after.prepare("SELECT COUNT(*) AS n FROM effects WHERE job_id=? AND kind='COMMENT'").get(f.jobId)?.n).toBe(1);
  after.close();
});

it('blocks new intent on a device that becomes identity-conflicted after queue claim', () => {
  const f = fixture();
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  sql.prepare("UPDATE device_profiles SET identity='CONFLICT' WHERE device_id=?").run(f.lease.deviceId);
  sql.close();
  expect(() => prepare(f)).toThrow('Verified');
  expect(db.getJob(f.jobId).job.state).toBe('RUNNING');
});
const claimedInput = (f: ReturnType<typeof fixture>) => ({
  jobId: f.jobId,
  expectedJobRevision: f.running.revision,
  expectedSnapshotHash: f.snapshotHash,
  nodeId: 'publish',
  kind: 'PUBLISH' as const,
  effectKey: contentHash('host_effect_unique'),
  payloadHash: contentHash('host_exact_frozen_payload'),
  lease: f.lease,
});
function hostEffect(
  adapter: ClaimedEffectAdapter | null,
  options: {
    internal?: <T>(request: InternalRequest) => Promise<T>;
    clock?: () => number;
  } = {},
) {
  return new HostClaimedEffectService({
    internal: options.internal ?? (async <T>(request: InternalRequest): Promise<T> =>
      dispatchInternal(db, request) as T),
  }, adapter, options.clock ?? (() => at + 50));
}

it('does not record an intent when no real provider is installed or the signal is pre-aborted', async () => {
  const f = fixture(), input = claimedInput(f);
  await expect(hostEffect(null).attempt(input)).rejects.toMatchObject({
    code: 'EFFECT_ADAPTER_UNAVAILABLE',
  });
  const controller = new AbortController();
  controller.abort();
  const adapter: ClaimedEffectAdapter = { sendOnce: async () => 'ACK' };
  await expect(hostEffect(adapter).attempt(input, controller.signal))
    .rejects.toMatchObject({ code: 'CANCELLED' });
  expect(db.getJob(f.jobId).job).toEqual(f.running);
  const rows = new DatabaseSync(join(dir, 'studio.sqlite'));
  expect(rows.prepare('SELECT COUNT(*) AS n FROM effects').get()?.n).toBe(0);
  rows.close();
});

it('writes both journal transitions before calling one trusted adapter; ACK is never posting proof', async () => {
  const f = fixture(), events: string[] = [];
  const adapter: ClaimedEffectAdapter = {
    sendOnce: async ({ effectId, lease }) => {
      events.push('adapter');
      expect(lease).toEqual(f.lease);
      expect(db.effectState(effectId)).toBe('ATTEMPT_UNCERTAIN');
      expect(db.getJob(f.jobId).job.state).toBe('POST_PENDING');
      return 'ACK';
    },
  };
  const host = hostEffect(adapter, {
    internal: async <T>(request: InternalRequest): Promise<T> => {
      events.push(request.command);
      return dispatchInternal(db, request) as T;
    },
  });
  const result = await host.attempt(claimedInput(f));
  expect(events).toEqual([
    'effect.prepareClaimed', 'effect.beginClaimedAttempt', 'effect.assertClaim', 'adapter',
  ]);
  expect(result).toMatchObject({
    jobId: f.jobId, state: 'ATTEMPT_UNCERTAIN', observation: 'ACK_UNVERIFIED',
    canConfirm: false, canRetry: false, canDispatchAgain: false,
  });
  expect(db.effectState(result.effectId)).toBe('ATTEMPT_UNCERTAIN');
  await expect(host.attempt(claimedInput(f))).rejects.toThrow();
  expect(events.filter((event) => event === 'adapter')).toHaveLength(1);
});

it('keeps provider failure uncertain across SQLite restart and never replays publish', async () => {
  const f = fixture();
  let sends = 0;
  const adapter: ClaimedEffectAdapter = {
    sendOnce: async () => {
      sends++;
      throw new Error('SENSITIVE_PROVIDER_FAILURE no post ID');
    },
  };
  const output = await hostEffect(adapter).attempt(claimedInput(f));
  expect(output.observation).toBe('UNKNOWN');
  expect(output.state).toBe('ATTEMPT_UNCERTAIN');
  expect(JSON.stringify(output)).not.toContain('SENSITIVE_PROVIDER_FAILURE');
  db.close();
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.effectState(output.effectId)).toBe('ATTEMPT_UNCERTAIN');
  expect(db.recoverExpiredClaims(f.lease.deviceId, at + 3000))
    .toEqual({ requeued: [], review: [f.jobId] });
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  await expect(hostEffect(adapter).attempt(claimedInput(f))).rejects.toThrow();
  expect(sends).toBe(1);
});

it('fails before any external adapter on an invalid snapshot/lease or forged public command', async () => {
  const f = fixture();
  let sends = 0;
  const adapter: ClaimedEffectAdapter = { sendOnce: async () => { sends++; return 'ACK'; } };
  await expect(hostEffect(adapter).attempt({
    ...claimedInput(f), expectedSnapshotHash: contentHash('incorrect-snapshot'),
  })).rejects.toThrow('snapshot');
  await expect(hostEffect(adapter).attempt({
    ...claimedInput(f), lease: { ...f.lease, generation: f.lease.generation + 1 },
  })).rejects.toThrow();
  await expect(dispatch(db, {
    operationId: 'op_forge_host_effect',
    command: 'effect.submitClaimed' as never,
    input: claimedInput(f),
  })).rejects.toThrow();
  await expect(dispatch(db, {
    operationId: 'op_forge_effect_dispatch_fence',
    command: 'effect.assertClaim' as never,
    input: { effectId: 'effect_fake', lease: f.lease, at: at + 100 },
  })).rejects.toThrow();
  expect(sends).toBe(0);
  expect(db.getJob(f.jobId).job.state).toBe('RUNNING');
});

it('keeps an INTENT when the second transaction fails, never entering the provider callback', async () => {
  const f = fixture(), events: string[] = [];
  const adapter: ClaimedEffectAdapter = {
    sendOnce: async () => { events.push('adapter'); return 'ACK'; },
  };
  const host = hostEffect(adapter, {
    internal: async <T>(request: InternalRequest): Promise<T> => {
      events.push(request.command);
      if (request.command === 'effect.beginClaimedAttempt')
        throw new Error('DB_BUSY_SYNTHETIC');
      return dispatchInternal(db, request) as T;
    },
  });
  await expect(host.attempt(claimedInput(f))).rejects.toThrow('DB_BUSY_SYNTHETIC');
  expect(events).toEqual(['effect.prepareClaimed', 'effect.beginClaimedAttempt']);
  const connection = new DatabaseSync(join(dir, 'studio.sqlite'));
  expect(connection.prepare("SELECT state FROM effects WHERE job_id=?").get(f.jobId)?.state)
    .toBe('INTENT');
  connection.close();
  expect(db.getJob(f.jobId).job.state).toBe('POST_INTENT');
  db.close();
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.recoverExpiredClaims(f.lease.deviceId, at + 3000))
    .toEqual({ requeued: [], review: [f.jobId] });
});

it('preserves INTENT when cancelled before begin, with no adapter call', async () => {
  const f = fixture(), controller = new AbortController();
  let sends = 0;
  const adapter: ClaimedEffectAdapter = { sendOnce: async () => { sends++; return 'ACK'; } };
  const output = await hostEffect(adapter, {
    internal: async <T>(request: InternalRequest): Promise<T> => {
      const result = dispatchInternal(db, request) as T;
      if (request.command === 'effect.prepareClaimed') controller.abort();
      return result;
    },
  }).attempt(claimedInput(f), controller.signal);
  expect(output).toMatchObject({
    state: 'INTENT_HELD_FOR_REVIEW', observation: 'NOT_DISPATCHED',
    canRetry: false, canConfirm: false,
  });
  expect(db.effectState(output.effectId)).toBe('INTENT');
  expect(sends).toBe(0);
});

it('preserves ATTEMPT_UNCERTAIN when aborted after begin, never making the tap', async () => {
  const f = fixture(), controller = new AbortController();
  let sends = 0;
  const adapter: ClaimedEffectAdapter = { sendOnce: async () => { sends++; return 'ACK'; } };
  const output = await hostEffect(adapter, {
    internal: async <T>(request: InternalRequest): Promise<T> => {
      const result = dispatchInternal(db, request) as T;
      if (request.command === 'effect.beginClaimedAttempt') controller.abort();
      return result;
    },
  }).attempt(claimedInput(f), controller.signal);
  expect(output).toMatchObject({
    state: 'ATTEMPT_UNCERTAIN', observation: 'NOT_DISPATCHED',
    canRetry: false, canConfirm: false, canDispatchAgain: false,
  });
  expect(db.effectState(output.effectId)).toBe('ATTEMPT_UNCERTAIN');
  expect(sends).toBe(0);
});

it('unknown adapter acknowledgement leaves the durable effect unresolved and never retries', async () => {
  const f = fixture(), events: string[] = [];
  const adapter: ClaimedEffectAdapter = { sendOnce: async () => {
    events.push('adapter');
    return 'UNKNOWN';
  } };
  const host = hostEffect(adapter);
  const result = await host.attempt(claimedInput(f));
  expect(result).toMatchObject({
    state: 'ATTEMPT_UNCERTAIN', observation: 'UNKNOWN', canConfirm: false,
  });
  await expect(host.attempt(claimedInput(f))).rejects.toThrow();
  expect(events).toEqual(['adapter']);
});

it('fences a forged INTENT revision receipt after SQLite commit without dispatch or replay', async () => {
  const f = fixture();
  let sends = 0, journalId = '';
  const adapter: ClaimedEffectAdapter = {
    sendOnce: async () => { sends++; return 'ACK'; },
  };
  const host = hostEffect(adapter, {
    internal: async <T>(request: InternalRequest): Promise<T> => {
      const receipt = dispatchInternal(db, request) as {
        effectId?: string; jobRevision?: number;
      };
      if (request.command === 'effect.prepareClaimed') {
        journalId = receipt.effectId!;
        return { ...receipt, jobRevision: f.running.revision } as T;
      }
      return receipt as T;
    },
  });
  await expect(host.attempt(claimedInput(f))).rejects.toMatchObject({
    code: 'EFFECT_INTENT_RECEIPT_INVALID',
  });
  expect(sends).toBe(0);
  expect(db.effectState(journalId)).toBe('INTENT');
  expect(db.getJob(f.jobId).job.state).toBe('POST_INTENT');
  db.close();
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.recoverExpiredClaims(f.lease.deviceId, at + 3000))
    .toEqual({ requeued: [], review: [f.jobId] });
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(db.effectState(journalId)).toBe('INTENT');
  await expect(hostEffect(adapter).attempt(claimedInput(f))).rejects.toThrow();
  expect(sends).toBe(0);
});

it('fences a forged ATTEMPT revision receipt after SQLite commit without dispatch or replay', async () => {
  const f = fixture();
  let sends = 0, journalId = '';
  const adapter: ClaimedEffectAdapter = {
    sendOnce: async () => { sends++; return 'UNKNOWN'; },
  };
  const host = hostEffect(adapter, {
    internal: async <T>(request: InternalRequest): Promise<T> => {
      const receipt = dispatchInternal(db, request) as {
        effectId?: string; jobRevision?: number;
      };
      if (request.command === 'effect.beginClaimedAttempt') {
        journalId = receipt.effectId!;
        return { ...receipt, jobRevision: receipt.jobRevision! - 1 } as T;
      }
      return receipt as T;
    },
  });
  await expect(host.attempt(claimedInput(f))).rejects.toMatchObject({
    code: 'EFFECT_ATTEMPT_RECEIPT_INVALID',
  });
  expect(sends).toBe(0);
  expect(db.effectState(journalId)).toBe('ATTEMPT_UNCERTAIN');
  expect(db.getJob(f.jobId).job.state).toBe('POST_PENDING');
  db.close();
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.recoverExpiredClaims(f.lease.deviceId, at + 3000))
    .toEqual({ requeued: [], review: [f.jobId] });
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(db.effectState(journalId)).toBe('ATTEMPT_UNCERTAIN');
  await expect(hostEffect(adapter).attempt(claimedInput(f))).rejects.toThrow();
  expect(sends).toBe(0);
});

it('private effect fence checks current lease and never mutates an active uncertain journal', () => {
  const f = fixture(), intent = prepare(f);
  const attempt = db.beginClaimedEffectAttempt({
    effectId: intent.effectId, expectedJobRevision: intent.jobRevision,
    lease: f.lease, at: at + 90,
  });
  const before = db.getJob(f.jobId);
  const countRows = () => {
    const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
    try {
      return [
        Number(sql.prepare('SELECT COUNT(*) AS n FROM effects').get()?.n),
        Number(sql.prepare('SELECT COUNT(*) AS n FROM queue_events').get()?.n),
      ];
    } finally { sql.close(); }
  };
  const counts = countRows();
  const args = {
    effectId: intent.effectId, expectedJobRevision: attempt.jobRevision,
    expectedSnapshotHash: f.snapshotHash, lease: f.lease, at: at + 100,
  };
  expect(db.assertClaimedEffectDispatch(args)).toBe(true);
  expect(db.assertClaimedEffectDispatch(args)).toBe(true);
  expect(() => db.assertClaimedEffectDispatch({
    ...args, expectedSnapshotHash: contentHash('wrong'),
  })).toThrow('frozen job');
  expect(() => db.assertClaimedEffectDispatch({
    ...args, expectedJobRevision: attempt.jobRevision + 1,
  })).toThrow('frozen job');
  expect(() => db.assertClaimedEffectDispatch({
    ...args, at: at + 3000,
  })).toThrow();
  expect(db.getJob(f.jobId)).toEqual(before);
  expect(db.effectState(intent.effectId)).toBe('ATTEMPT_UNCERTAIN');
  expect(countRows()).toEqual(counts);
});

it('fences a released and superseded JOB lease after durable attempt, no adapter call', async () => {
  const f = fixture(), events: string[] = [];
  const adapter: ClaimedEffectAdapter = {
    sendOnce: async () => { events.push('adapter'); return 'ACK'; },
  };
  const host = hostEffect(adapter, {
    internal: async <T>(request: InternalRequest): Promise<T> => {
      events.push(request.command);
      const receipt = dispatchInternal(db, request) as T;
      if (request.command === 'effect.beginClaimedAttempt') {
        db.releaseLease(f.lease);
        const replacement = db.acquireLease(
          f.lease.deviceId, 'operator_replacement', 'MANUAL', at + 80, 5000,
        );
        expect(replacement.generation).toBe(f.lease.generation + 1);
      }
      return receipt;
    },
  });
  await expect(host.attempt(claimedInput(f))).rejects.toThrow();
  expect(events).toEqual([
    'effect.prepareClaimed', 'effect.beginClaimedAttempt', 'effect.assertClaim',
  ]);
  expect(db.getJob(f.jobId).job.state).toBe('POST_PENDING');
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  const effectId = String(sql.prepare('SELECT id FROM effects WHERE job_id=?').get(f.jobId)!.id);
  sql.close();
  expect(db.effectState(effectId)).toBe('ATTEMPT_UNCERTAIN');
  db.close();
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.recoverExpiredClaims(f.lease.deviceId, at + 3000)).toEqual({
    requeued: [], review: [f.jobId],
  });
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  await expect(hostEffect(adapter).attempt(claimedInput(f))).rejects.toThrow();
  expect(events).not.toContain('adapter');
});

it('fences a changed job revision or device identity after SQLite uncertainty', async () => {
  for (const scenario of ['revision', 'identity'] as const) {
    const suffix = scenario === 'revision' ? 'revision' : 'identity';
    const f = fixture('device_fence_' + suffix, suffix);
    let sends = 0;
    const adapter: ClaimedEffectAdapter = {
      sendOnce: async () => { sends++; return 'ACK'; },
    };
    const host = hostEffect(adapter, {
      internal: async <T>(request: InternalRequest): Promise<T> => {
        const receipt = dispatchInternal(db, request) as T;
        if (request.command === 'effect.beginClaimedAttempt') {
          const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
          try {
            if (scenario === 'revision')
              sql.prepare('UPDATE jobs SET revision=revision+1 WHERE id=?').run(f.jobId);
            else sql.prepare("UPDATE device_profiles SET identity='CONFLICT' WHERE device_id=?")
              .run(f.lease.deviceId);
          } finally { sql.close(); }
        }
        return receipt;
      },
    });
    // Effect keys are globally unique; each independent failure fixture must
    // use its own frozen key to reach the dispatch fence under test.
    await expect(host.attempt({
      ...claimedInput(f), effectKey: contentHash('host_fence_' + suffix),
    })).rejects.toThrow();
    expect(sends).toBe(0);
    const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
    const effectId = String(sql.prepare('SELECT id FROM effects WHERE job_id=?').get(f.jobId)!.id);
    sql.close();
    expect(db.effectState(effectId)).toBe('ATTEMPT_UNCERTAIN');
    expect(db.getJob(f.jobId).job.state).toBe('POST_PENDING');
    expect(db.recoverExpiredClaims(f.lease.deviceId, at + 3000))
      .toEqual({ requeued: [], review: [f.jobId] });
  }
});

it('rejects malformed private fence receipt after durable uncertainty without adapter call', async () => {
  const f = fixture();
  let sends = 0;
  const adapter: ClaimedEffectAdapter = {
    sendOnce: async () => { sends++; return 'ACK'; },
  };
  const host = hostEffect(adapter, {
    internal: async <T>(request: InternalRequest): Promise<T> => {
      const receipt = dispatchInternal(db, request);
      if (request.command === 'effect.assertClaim') return false as T;
      return receipt as T;
    },
  });
  await expect(host.attempt(claimedInput(f))).rejects.toMatchObject({
    code: 'EFFECT_DISPATCH_FENCE_INVALID',
  });
  expect(sends).toBe(0);
  expect(db.getJob(f.jobId).job.state).toBe('POST_PENDING');
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  const effectId = String(sql.prepare('SELECT id FROM effects WHERE job_id=?').get(f.jobId)!.id);
  sql.close();
  expect(db.effectState(effectId)).toBe('ATTEMPT_UNCERTAIN');
});

it('refuses an expired lease at dispatch fence even if the earlier attempt was journaled', async () => {
  const f = fixture();
  let sends = 0, reads = 0;
  const adapter: ClaimedEffectAdapter = {
    sendOnce: async () => { sends++; return 'ACK'; },
  };
  const host = hostEffect(adapter, {
    clock: () => reads++ < 2 ? at + 50 : at + 3000,
  });
  await expect(host.attempt(claimedInput(f))).rejects.toThrow();
  expect(sends).toBe(0);
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  const effectId = String(sql.prepare('SELECT id FROM effects WHERE job_id=?').get(f.jobId)!.id);
  sql.close();
  expect(db.effectState(effectId)).toBe('ATTEMPT_UNCERTAIN');
  expect(db.getJob(f.jobId).job.state).toBe('POST_PENDING');
});

it('reads exact frozen comment ordinals only after a persisted confirmed post, never sends', async () => {
  const f = fixture('device_1', '1', true);
  const post = prepare(f);
  const attempted = db.beginClaimedEffectAttempt({
    effectId: post.effectId, expectedJobRevision: post.jobRevision,
    lease: f.lease, at: at + 100,
  });
  const req = {
    command: 'comment.planFrozen' as const,
    jobId: f.jobId, expectedSnapshotHash: f.snapshotHash,
    postEffectId: post.effectId, fieldKey: 'comments', scope: 'row' as const,
  };
  expect(() => dispatchInternal(db, req)).toThrow('not available');
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  // Simulate the distinct persistence gates in order, never an external post.
  sql.prepare("UPDATE jobs SET state='POSTED',revision=revision+1 WHERE id=?")
    .run(f.jobId);
  expect(() => dispatchInternal(db, req)).toThrow('not confirmed');
  sql.prepare("UPDATE effects SET state='CONFIRMED' WHERE id=?").run(post.effectId);
  // Mutable Content may subsequently change without altering the job snapshot.
  const contentId = db.getJob(f.jobId).job.contentId;
  sql.prepare('UPDATE content_items SET fields=? WHERE id=?')
    .run(JSON.stringify({ comments: ['Mutable later edit'] }), contentId);
  const counters = () => [
    Number(sql.prepare('SELECT COUNT(*) AS n FROM effects').get()?.n),
    Number(sql.prepare('SELECT COUNT(*) AS n FROM queue_events').get()?.n),
  ];
  const before = counters();
  const plan = dispatchInternal(db, req) as ReturnType<StudioDatabase['frozenCommentListPlan']>;
  expect(plan).toMatchObject({
    scope: 'FROZEN_COMMENT_LIST_NOT_PROVIDER_VERIFIED',
    status: 'FROZEN_COMMENTS_PROVIDER_UNVERIFIED',
    blockers: [], canDispatch: false, canRetry: false, canConfirm: false,
  });
  expect(plan.items).toHaveLength(2);
  expect(plan.items[0]?.value).toBe('Bình luận thứ nhất 👨‍👩‍👧\r\nCâu tiếp');
  expect(plan.items[1]?.value).toBe(plan.items[0]?.value);
  expect(plan.items[0]?.effectKey).not.toBe(plan.items[1]?.effectKey);
  expect(plan.items[0]?.effectKey).toMatch(/^[a-f0-9]{64}$/);
  expect(counters()).toEqual(before);
  expect(() => db.frozenCommentListPlan({
    ...req, expectedSnapshotHash: contentHash('stale'),
  })).toThrow('not available');
  expect(() => db.frozenCommentListPlan({
    ...req, postEffectId: 'effect_foreign',
  })).toThrow('not confirmed');
  await expect(dispatch(db, {
    operationId: 'op_forge_frozen_comment_plan',
    command: 'comment.planFrozen' as never,
    input: req,
  })).rejects.toThrow();
  sql.close();

  const beforeJob = db.getJob(f.jobId);
  db.close(); db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.getJob(f.jobId)).toEqual(beforeJob);
  expect(dispatchInternal(db, req)).toEqual(plan);
  expect(db.effectState(post.effectId)).toBe('CONFIRMED');
  expect(attempted.state).toBe('ATTEMPT_UNCERTAIN');
});

it('enforces frozen COMMENT ordinal/key/payload before any durable mutation', () => {
  const f = fixture('device_1', '1', true);
  const post = prepare(f);
  db.beginClaimedEffectAttempt({
    effectId: post.effectId, expectedJobRevision: post.jobRevision, lease: f.lease, at: at + 100,
  });
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  sql.prepare("UPDATE jobs SET state='POSTED',revision=revision+1 WHERE id=?").run(f.jobId);
  sql.prepare("UPDATE effects SET state='CONFIRMED' WHERE id=?").run(post.effectId);
  sql.close();
  const exact = db.frozenCommentListPlan({
    jobId: f.jobId, expectedSnapshotHash: f.snapshotHash,
    postEffectId: post.effectId, fieldKey: 'comments', scope: 'row',
  });
  expect(exact.items).toHaveLength(2);
  expect(exact.items[0]!.utf8Hash).toBe(exact.items[1]!.utf8Hash);
  expect(exact.items[0]!.effectKey).not.toBe(exact.items[1]!.effectKey);
  const request = {
    jobId: f.jobId,
    expectedJobRevision: db.getJob(f.jobId).job.revision,
    expectedSnapshotHash: f.snapshotHash,
    nodeId: 'comment', kind: 'COMMENT' as const,
    effectKey: exact.items[0]!.effectKey, payloadHash: exact.items[0]!.payloadHash,
    commentSource: {
      postEffectId: post.effectId, fieldKey: 'comments', scope: 'row' as const, ordinal: 0,
    },
    lease: f.lease, at: at + 130,
  };
  const beforeJob = db.getJob(f.jobId).job;
  const readCounts = () => {
    const conn = new DatabaseSync(join(dir, 'studio.sqlite'));
    try {
      return [
        Number(conn.prepare('SELECT COUNT(*) AS n FROM effects').get()?.n),
        Number(conn.prepare('SELECT COUNT(*) AS n FROM queue_events').get()?.n),
      ];
    } finally { conn.close(); }
  };
  const beforeCounts = readCounts();
  const invalid = [
    { label: 'wrong source ordinal with ordinal-0 key',
      args: { ...request, commentSource: { ...request.commentSource, ordinal: 1 } } },
    { label: 'valid-format but wrong effect key',
      args: { ...request, effectKey: contentHash('unbound_comment_key') } },
    { label: 'valid-format but wrong payload hash',
      args: { ...request, payloadHash: contentHash('unbound_comment_payload') } },
    { label: 'wrong field key',
      args: { ...request, commentSource: { ...request.commentSource, fieldKey: 'unknown' } } },
    { label: 'wrong parent publish ID',
      args: { ...request, commentSource: { ...request.commentSource, postEffectId: 'effect_other' } } },
    { label: 'wrong source scope',
      args: { ...request, commentSource: { ...request.commentSource, scope: 'process' as const } } },
  ];
  for (const testCase of invalid) {
    expect(() => db.prepareClaimedEffect(testCase.args), testCase.label).toThrow();
    expect(db.getJob(f.jobId).job).toEqual(beforeJob);
    expect(readCounts()).toEqual(beforeCounts);
  }
  const { commentSource: boundSource, ...missing } = request;
  expect(boundSource.ordinal).toBe(0);
  expect(() => db.prepareClaimedEffect(missing)).toThrow('exact frozen source');
  expect(() => db.prepareClaimedEffect({
    ...request, commentSource: { ...request.commentSource, ordinal: 32 },
  })).toThrow('exact frozen source');
  expect(() => db.prepareClaimedEffect({
    ...request, kind: 'PUBLISH', nodeId: 'publish',
  })).toThrow('exact frozen source');
  expect(db.getJob(f.jobId).job).toEqual(beforeJob);
  expect(readCounts()).toEqual(beforeCounts);

  const intent = db.prepareClaimedEffect(request);
  expect(intent.state).toBe('INTENT');
  expect(db.effectState(intent.effectId)).toBe('INTENT');
  expect(db.getJob(f.jobId).job.state).toBe('COMMENT_PENDING');
  expect(() => db.prepareClaimedEffect(request)).toThrow();
  expect(readCounts()[0]).toBe(beforeCounts[0]! + 1);
});

it('rejects a host COMMENT without frozen source or a PUBLISH carrying a comment source', async () => {
  const f = fixture();
  let sends = 0;
  const adapter: ClaimedEffectAdapter = { sendOnce: async () => { sends++; return 'ACK'; } };
  await expect(hostEffect(adapter).attempt({
    ...claimedInput(f), kind: 'COMMENT', nodeId: 'comment',
  })).rejects.toMatchObject({ code: 'EFFECT_HOST_INPUT_INVALID' });
  await expect(hostEffect(adapter).attempt({
    ...claimedInput(f),
    commentSource: {
      postEffectId: 'effect_fake', fieldKey: 'comments', scope: 'row', ordinal: 0,
    },
  })).rejects.toMatchObject({ code: 'EFFECT_HOST_INPUT_INVALID' });
  expect(sends).toBe(0);
  expect(db.getJob(f.jobId).job.state).toBe('RUNNING');
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  expect(Number(sql.prepare('SELECT COUNT(*) AS n FROM effects').get()?.n)).toBe(0);
  sql.close();
});

/**
 * Synthetic persisted confirmation is intentionally not a real provider
 * receipt. It exists only to exercise trusted host/SQLite contract ordering.
 */
function confirmedCommentHostFixture(ordinal = 0) {
  const f = fixture('device_comment', 'comment', true);
  const publish = prepare(f);
  db.beginClaimedEffectAttempt({
    effectId: publish.effectId, expectedJobRevision: publish.jobRevision,
    lease: f.lease, at: at + 100,
  });
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  try {
    sql.prepare("UPDATE jobs SET state='POSTED',revision=revision+1 WHERE id=?")
      .run(f.jobId);
    sql.prepare("UPDATE effects SET state='CONFIRMED' WHERE id=?")
      .run(publish.effectId);
  } finally { sql.close(); }
  const source = {
    postEffectId: publish.effectId, fieldKey: 'comments',
    scope: 'row' as const, ordinal,
  };
  const plan = db.frozenCommentListPlan({
    jobId: f.jobId, expectedSnapshotHash: f.snapshotHash,
    postEffectId: publish.effectId, fieldKey: 'comments', scope: 'row',
  });
  expect(plan.status).toBe('FROZEN_COMMENTS_PROVIDER_UNVERIFIED');
  const item = plan.items[ordinal]!;
  const input = {
    jobId: f.jobId,
    expectedJobRevision: db.getJob(f.jobId).job.revision,
    expectedSnapshotHash: f.snapshotHash,
    nodeId: 'comment',
    kind: 'COMMENT' as const,
    effectKey: item.effectKey,
    payloadHash: item.payloadHash,
    commentSource: source,
    lease: f.lease,
  };
  return { f, publish, source, item, input };
}

it('inventories all frozen comment ordinals from SQLite before and after restart without retry rights', async () => {
  const { f, publish, input } = confirmedCommentHostFixture(0);
  // The fixture parent post is DB-CONFIRMED only, never actual provider evidence.
  const req = {
    command: 'comment.reviewList' as const,
    jobId: f.jobId, expectedSnapshotHash: f.snapshotHash,
    postEffectId: publish.effectId, fieldKey: 'comments', scope: 'row' as const,
  };
  const counts = () => {
    const conn = new DatabaseSync(join(dir, 'studio.sqlite'));
    try {
      return [
        Number(conn.prepare('SELECT COUNT(*) AS n FROM effects').get()?.n),
        Number(conn.prepare('SELECT COUNT(*) AS n FROM queue_events').get()?.n),
      ];
    } finally { conn.close(); }
  };
  const review = () => dispatchInternal(db, req) as
    ReturnType<StudioDatabase['reviewPersistedCommentListProgress']>;
  const expectReadOnly = (expected: string, total: number) => {
    const before = counts();
    const result = review();
    expect(result).toMatchObject({
      scope: 'PRIVATE_COMMENT_JOURNAL_NOT_PROVIDER_CERTIFIED',
      status: 'READ_ONLY_UNCERTIFIED', journalCount: total,
      items: [
        { ordinal: 0, journal: expected },
        { ordinal: 1, journal: 'NO_JOURNAL_UNVERIFIED' },
      ],
      canRetry: false, canConfirm: false, canDispatch: false,
    });
    expect(JSON.stringify(result)).not.toContain(input.effectKey);
    expect(counts()).toEqual(before);
    return result;
  };

  expectReadOnly('NO_JOURNAL_UNVERIFIED', 0);
  const intent = db.prepareClaimedEffect({ ...input, at: at + 125 });
  expectReadOnly('INTENT_JOURNALED', 1);
  db.beginClaimedEffectAttempt({
    effectId: intent.effectId, expectedJobRevision: intent.jobRevision,
    lease: f.lease, at: at + 140,
  });
  const uncertain = expectReadOnly('ATTEMPT_UNCERTAIN', 1);
  await expect(dispatch(db, {
    operationId: 'op_forged_list_review',
    command: 'comment.reviewList' as never,
    input: req,
  })).rejects.toThrow();

  db.close(); db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(review()).toEqual(uncertain);
  expect(db.recoverExpiredClaims(f.lease.deviceId, at + 3000))
    .toEqual({ requeued: [], review: [f.jobId] });
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(review()).toEqual(uncertain);

  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  try {
    sql.prepare('UPDATE effects SET payload_hash=? WHERE id=?')
      .run(contentHash('forged_comment_journal_payload'), intent.effectId);
  } finally { sql.close(); }
  const beforeBlocked = counts();
  expect(review()).toMatchObject({
    status: 'BLOCKED', items: [],
    blockers: ['JOURNAL_BINDING_MISMATCH'], canRetry: false,
  });
  expect(counts()).toEqual(beforeBlocked);

  const fix = new DatabaseSync(join(dir, 'studio.sqlite'));
  try {
    fix.prepare("UPDATE effects SET payload_hash=?,state='CONFIRMED' WHERE id=?")
      .run(input.payloadHash, intent.effectId);
  } finally { fix.close(); }
  // Synthetic DB state must never be presented as a certified provider comment.
  expectReadOnly('CONFIRMED_DB_ONLY', 1);
});

it('compares private synthetic comment readback after restart, never writes effect or authorizes resend', async () => {
  const { f, publish, input } = confirmedCommentHostFixture(0);
  // The parent PUBLISH CONFIRMED here is a deliberately synthetic DB-only
  // fixture and cannot attest any real Facebook/TikTok post.
  const intent = db.prepareClaimedEffect({
    ...input, at: at + 125,
  });
  db.beginClaimedEffectAttempt({
    effectId: intent.effectId, expectedJobRevision: intent.jobRevision,
    lease: f.lease, at: at + 140,
  });
  const fixtureReadback = {
    observationId: 'observation_comment_0',
    source: 'PROVIDER_READBACK' as const,
    providerAppId: 'fb',
    accountId: 'account_comment', authorAccountId: 'account_comment',
    targetId: 'target_comment',
    externalPostId: 'post_exact_42', externalCommentId: 'comment_exact_42',
    commentCreatedAt: new Date(at + 135).toISOString(),
    observedAt: new Date(at + 400).toISOString(),
    bodyUtf8Hash: db.frozenCommentListPlan({
      jobId: f.jobId, expectedSnapshotHash: f.snapshotHash,
      postEffectId: publish.effectId, fieldKey: 'comments', scope: 'row',
    }).items[0]!.utf8Hash,
    bodyUtf8Bytes: Buffer.byteLength('Bình luận thứ nhất 👨‍👩‍👧\r\nCâu tiếp'),
  };
  const req = {
    command: 'comment.reviewCandidates' as const,
    jobId: f.jobId, expectedSnapshotHash: f.snapshotHash,
    effectId: intent.effectId, postEffectId: publish.effectId,
    parentExternalPostId: 'post_exact_42',
    fieldKey: 'comments', scope: 'row' as const, ordinal: 0,
    observations: [fixtureReadback],
    at: at + 1000,
  };
  const first = dispatchInternal(db, req) as ReturnType<StudioDatabase['reviewPersistedCommentCandidates']>;
  // Identical frozen text at ordinal 1 is ambiguous even when exactly one
  // provider body is reported: provider readback does not label ordinals.
  expect(first).toMatchObject({
    candidate: null,
    summary: { status: 'AMBIGUOUS_REVIEW',
      blockers: ['DUPLICATE_FROZEN_COMMENT_TEXT'],
      canRetry: false, canConfirm: false, canDispatch: false },
  });
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  const before = [
    Number(sql.prepare('SELECT COUNT(*) AS n FROM effects').get()?.n),
    Number(sql.prepare('SELECT COUNT(*) AS n FROM queue_events').get()?.n),
  ];
  expect(() => db.reviewPersistedCommentCandidates({
    ...req, ordinal: 1,
  })).toThrow('frozen journal');
  expect(db.reviewPersistedCommentCandidates({
    ...req, parentExternalPostId: '../unsafe',
  })).toMatchObject({
    candidate: null, summary: { status: 'BLOCKED', canRetry: false },
  });
  await expect(dispatch(db, {
    operationId: 'op_forged_comment_readback',
    command: 'comment.reviewCandidates' as never,
    input: req,
  })).rejects.toThrow();
  const after = [
    Number(sql.prepare('SELECT COUNT(*) AS n FROM effects').get()?.n),
    Number(sql.prepare('SELECT COUNT(*) AS n FROM queue_events').get()?.n),
  ];
  expect(after).toEqual(before);
  sql.close();
  db.close(); db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(dispatchInternal(db, req)).toEqual(first);
  expect(db.effectState(intent.effectId)).toBe('ATTEMPT_UNCERTAIN');
  expect(db.recoverExpiredClaims(f.lease.deviceId, at + 3000))
    .toEqual({ requeued: [], review: [f.jobId] });
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(dispatchInternal(db, req)).toEqual(first);
  expect(db.effectState(intent.effectId)).toBe('ATTEMPT_UNCERTAIN');
});

it('compares one exact provider comment privately without certifying its synthetic readback', async () => {
  const f = fixture('device_unique_comment', 'unique_comment', true,
    ['Bình luận dòng một 👋\r\nDòng hai', 'Nội dung khác']);
  const publish = prepare(f);
  db.beginClaimedEffectAttempt({
    effectId: publish.effectId, expectedJobRevision: publish.jobRevision,
    lease: f.lease, at: at + 100,
  });
  // This journal state is manually injected for fixture testing only.
  const seeded = new DatabaseSync(join(dir, 'studio.sqlite'));
  seeded.prepare("UPDATE jobs SET state='POSTED',revision=revision+1 WHERE id=?")
    .run(f.jobId);
  seeded.prepare("UPDATE effects SET state='CONFIRMED' WHERE id=?")
    .run(publish.effectId);
  seeded.close();

  const frozen = db.frozenCommentListPlan({
    jobId: f.jobId, expectedSnapshotHash: f.snapshotHash,
    postEffectId: publish.effectId, fieldKey: 'comments', scope: 'row',
  });
  const item = frozen.items[1]!;
  const intent = db.prepareClaimedEffect({
    jobId: f.jobId, expectedJobRevision: db.getJob(f.jobId).job.revision,
    expectedSnapshotHash: f.snapshotHash, nodeId: 'comment', kind: 'COMMENT',
    effectKey: item.effectKey, payloadHash: item.payloadHash,
    commentSource: {
      postEffectId: publish.effectId, fieldKey: 'comments', scope: 'row', ordinal: 1,
    },
    lease: f.lease, at: at + 130,
  });
  db.beginClaimedEffectAttempt({
    effectId: intent.effectId, expectedJobRevision: intent.jobRevision,
    lease: f.lease, at: at + 160,
  });
  const candidate = {
    observationId: 'observation_exact_comment',
    source: 'PROVIDER_READBACK' as const,
    providerAppId: 'fb',
    accountId: 'account_comment',
    authorAccountId: 'account_comment',
    targetId: 'target_comment',
    externalPostId: 'post_exact_42',
    externalCommentId: 'comment_exact_99',
    commentCreatedAt: new Date(at + 180).toISOString(),
    observedAt: new Date(at + 500).toISOString(),
    bodyUtf8Hash: item.utf8Hash, bodyUtf8Bytes: item.utf8Bytes,
  };
  const req = {
    command: 'comment.reviewCandidates' as const,
    jobId: f.jobId, expectedSnapshotHash: f.snapshotHash,
    effectId: intent.effectId, postEffectId: publish.effectId,
    parentExternalPostId: 'post_exact_42', fieldKey: 'comments',
    scope: 'row' as const, ordinal: 1,
    observations: [candidate], at: at + 1000,
  };
  const read = () => {
    const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
    try {
      return [
        Number(sql.prepare('SELECT COUNT(*) AS n FROM effects').get()?.n),
        Number(sql.prepare('SELECT COUNT(*) AS n FROM queue_events').get()?.n),
      ];
    } finally { sql.close(); }
  };
  const before = read();
  const review = dispatchInternal(db, req) as
    ReturnType<StudioDatabase['reviewPersistedCommentCandidates']>;
  expect(review).toMatchObject({
    candidate,
    summary: {
      status: 'EXACT_CANDIDATE_UNCERTIFIED',
      observationsChecked: 1, exactCandidates: 1,
      canConfirm: false, canDispatch: false, canRetry: false,
    },
  });
  expect(JSON.stringify(review.summary)).not.toContain(item.value);
  expect(JSON.stringify(review.summary)).not.toContain(item.utf8Hash);
  expect(read()).toEqual(before);
  expect(db.reviewPersistedCommentCandidates({
    ...req, parentExternalPostId: 'post_other_42',
  })).toMatchObject({
    candidate: null, summary: { status: 'NO_EXACT_CANDIDATE_REVIEW',
      canRetry: false },
  });
  db.close(); db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(dispatchInternal(db, req)).toEqual(review);
  expect(db.effectState(intent.effectId)).toBe('ATTEMPT_UNCERTAIN');
  expect(db.recoverExpiredClaims(f.lease.deviceId, at + 3000))
    .toEqual({ requeued: [], review: [f.jobId] });
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  const afterRecovery = read();
  expect(afterRecovery[0]).toBe(before[0]);
  // Recovery writes a legitimate NEEDS_REVIEW audit event; a read-only
  // provider candidate review must not write another event.
  expect(afterRecovery[1]).toBeGreaterThan(before[1]!);
  expect(dispatchInternal(db, req)).toEqual(review);
  expect(read()).toEqual(afterRecovery);
});

it('hydrates only the exact immutable multiline Unicode COMMENT into the private adapter after durable journal', async () => {
  const { f, item, input } = confirmedCommentHostFixture(1);
  const events: string[] = [];
  let seen = 0;
  const mutable = 'MUTABLE_PRIVATE_AFTER_SCHEDULE_NOT_COMMENT';
  const adapter: ClaimedEffectAdapter = {
    sendOnce: async (arg) => {
      events.push('adapter');
      seen++;
      expect(arg.kind).toBe('COMMENT');
      if (arg.kind !== 'COMMENT') throw new Error('Expected COMMENT adapter input');
      expect(arg.comment).toEqual({
        ordinal: 1, value: item.value, utf8Hash: item.utf8Hash,
        utf8Bytes: item.utf8Bytes,
      });
      expect(arg.comment.value).toBe('Bình luận thứ nhất 👨‍👩‍👧\r\nCâu tiếp');
      expect(arg.comment.value).not.toBe(mutable);
      expect(db.effectState(arg.effectId)).toBe('ATTEMPT_UNCERTAIN');
      expect(db.getJob(f.jobId).job.state).toBe('COMMENT_PENDING');
      return 'ACK';
    },
  };
  const host = hostEffect(adapter, {
    clock: () => at + 150,
    internal: async <T>(request: InternalRequest): Promise<T> => {
      events.push(request.command);
      const receipt = dispatchInternal(db, request) as T;
      if (request.command === 'effect.beginClaimedAttempt') {
        const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
        try {
          sql.prepare('UPDATE content_items SET fields=? WHERE id=?').run(
            JSON.stringify({ comments: [mutable] }), db.getJob(f.jobId).job.contentId,
          );
        } finally { sql.close(); }
      }
      return receipt;
    },
  });
  const result = await host.attempt(input);
  expect(result).toMatchObject({
    state: 'ATTEMPT_UNCERTAIN', observation: 'ACK_UNVERIFIED',
    canConfirm: false, canRetry: false, canDispatchAgain: false,
  });
  expect(events).toEqual([
    'effect.prepareClaimed', 'effect.beginClaimedAttempt', 'effect.assertClaim',
    'comment.resolveClaimed', 'adapter',
  ]);
  expect(seen).toBe(1);
  expect(JSON.stringify(result)).not.toContain(item.value);
  expect(JSON.stringify(result)).not.toContain(item.utf8Hash);
  expect(JSON.stringify(result)).not.toContain(item.effectKey);
  db.close(); db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.effectState(result.effectId)).toBe('ATTEMPT_UNCERTAIN');
  await expect(hostEffect(adapter).attempt(input)).rejects.toThrow();
  expect(seen).toBe(1);
});

it('blocks a mutated durable COMMENT hash after journal commit and before adapter resolution', async () => {
  const { f, input } = confirmedCommentHostFixture();
  let sends = 0, pendingId = '';
  const adapter: ClaimedEffectAdapter = { sendOnce: async () => { sends++; return 'ACK'; } };
  const host = hostEffect(adapter, {
    clock: () => at + 150,
    internal: async <T>(request: InternalRequest): Promise<T> => {
      const reply = dispatchInternal(db, request) as T;
      if (request.command === 'effect.assertClaim') {
        const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
        try {
          const effect = sql.prepare("SELECT id FROM effects WHERE job_id=? AND kind='COMMENT'")
            .get(f.jobId);
          pendingId = String(effect!.id);
          sql.prepare('UPDATE effects SET payload_hash=? WHERE id=?')
            .run(contentHash('changed-synthetic-journal'), pendingId);
        } finally { sql.close(); }
      }
      return reply;
    },
  });
  await expect(host.attempt(input)).rejects.toMatchObject({
    code: 'COMMENT_DISPATCH_JOURNAL_MISMATCH',
  });
  expect(sends).toBe(0);
  expect(db.effectState(pendingId)).toBe('ATTEMPT_UNCERTAIN');
  expect(db.getJob(f.jobId).job.state).toBe('COMMENT_PENDING');
});

for (const kind of ['text', 'hash', 'ordinal', 'effectKey'] as const) {
  it('blocks a forged private comment receipt '+kind+' before adapter callback', async () => {
    const { f, input, item } = confirmedCommentHostFixture(1);
    let sends = 0, pendingId = '';
    const adapter: ClaimedEffectAdapter = {
      sendOnce: async () => { sends++; return 'ACK'; },
    };
    const host = hostEffect(adapter, {
      clock: () => at + 150,
      internal: async <T>(request: InternalRequest): Promise<T> => {
        const reply = dispatchInternal(db, request);
        if (request.command === 'comment.resolveClaimed') {
          pendingId = String((reply as { effectId: string }).effectId);
          if (kind === 'text') return { ...reply as object, value: 'FORGED_PRIVATE_TEXT' } as T;
          if (kind === 'hash') return { ...reply as object, utf8Hash: 'd'.repeat(64) } as T;
          if (kind === 'ordinal') return { ...reply as object, ordinal: 0 } as T;
          return { ...reply as object, effectKey: contentHash('wrong-key') } as T;
        }
        return reply as T;
      },
    });
    await expect(host.attempt(input)).rejects.toMatchObject({
      code: 'COMMENT_ADAPTER_PAYLOAD_INVALID',
    });
    expect(sends).toBe(0);
    expect(db.effectState(pendingId)).toBe('ATTEMPT_UNCERTAIN');
    expect(db.getJob(f.jobId).job.state).toBe('COMMENT_PENDING');
    expect(JSON.stringify({ status: 'blocked' })).not.toContain(item.value);
  });
}

it('re-fences a released lease between effect check and comment hydration, never calls adapter', async () => {
  const { f, input } = confirmedCommentHostFixture(0);
  let sends = 0, pendingId = '';
  const adapter: ClaimedEffectAdapter = {
    sendOnce: async () => { sends++; return 'ACK'; },
  };
  const host = hostEffect(adapter, {
    clock: () => at + 150,
    internal: async <T>(request: InternalRequest): Promise<T> => {
      const reply = dispatchInternal(db, request) as T;
      if (request.command === 'effect.assertClaim') {
        const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
        try {
          pendingId = String(sql.prepare(
            "SELECT id FROM effects WHERE job_id=? AND kind='COMMENT'",
          ).get(f.jobId)!.id);
        } finally { sql.close(); }
        db.releaseLease(f.lease);
      }
      return reply;
    },
  });
  await expect(host.attempt(input)).rejects.toThrow();
  expect(sends).toBe(0);
  expect(db.effectState(pendingId)).toBe('ATTEMPT_UNCERTAIN');
  db.close(); db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.recoverExpiredClaims(f.lease.deviceId, at + 3000))
    .toEqual({ requeued: [], review: [f.jobId] });
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
});

it('keeps a comment uncertain if cancellation arrives after exact payload resolution', async () => {
  const { f, input } = confirmedCommentHostFixture(0);
  const controller = new AbortController();
  let sends = 0, pendingId = '';
  const adapter: ClaimedEffectAdapter = {
    sendOnce: async () => { sends++; return 'ACK'; },
  };
  const host = hostEffect(adapter, {
    clock: () => at + 150,
    internal: async <T>(request: InternalRequest): Promise<T> => {
      const reply = dispatchInternal(db, request) as T;
      if (request.command === 'comment.resolveClaimed') {
        pendingId = String((reply as { effectId: string }).effectId);
        controller.abort();
      }
      return reply;
    },
  });
  const result = await host.attempt(input, controller.signal);
  expect(result).toMatchObject({
    state: 'ATTEMPT_UNCERTAIN', observation: 'NOT_DISPATCHED',
    canConfirm: false, canRetry: false, canDispatchAgain: false,
  });
  expect(sends).toBe(0);
  expect(db.effectState(pendingId)).toBe('ATTEMPT_UNCERTAIN');
  expect(db.getJob(f.jobId).job.state).toBe('COMMENT_PENDING');
});


it('cancels a fully unclaimed scheduled job atomically, with a single audit and no effect', async () => {
  const f = fixture('device_cancel_safe', 'cancel_safe');
  // Move the synthetic fixture back to the pre-claim boundary, with no
  // external effect, stage, job claim or live lease.
  db.releaseLease(f.lease);
  const setup = new DatabaseSync(join(dir, 'studio.sqlite'));
  setup.prepare('DELETE FROM job_claims WHERE job_id=?').run(f.jobId);
  setup.prepare("UPDATE jobs SET state='SCHEDULED',revision=revision+1 WHERE id=?")
    .run(f.jobId);
  setup.close();
  const scheduled = db.getJob(f.jobId).job;
  const req = {
    command: 'job.requestCancellation' as const, jobId: f.jobId,
    expectedRevision: scheduled.revision, actorId: 'operator_cancel_safe',
    at: at + 200,
  };
  const first = dispatchInternal(db, req) as
    ReturnType<StudioDatabase['requestJobCancellation']>;
  expect(first).toMatchObject({
    state: 'CANCELLED', disposition: 'CANCELLED_BEFORE_EFFECT',
    jobRevision: scheduled.revision + 1,
    canConfirm: false, canRetry: false, canDispatch: false,
  });
  expect(db.getJob(f.jobId).job.state).toBe('CANCELLED');
  expect(dispatchInternal(db, {
    ...req, expectedRevision: first.jobRevision,
  })).toMatchObject({
    state: 'CANCELLED', disposition: 'ALREADY_CANCELLED',
    jobRevision: first.jobRevision,
  });
  const count = new DatabaseSync(join(dir, 'studio.sqlite'));
  expect(count.prepare("SELECT COUNT(*) AS n FROM effects WHERE job_id=?")
    .get(f.jobId)?.n).toBe(0);
  expect(count.prepare(
    "SELECT COUNT(*) AS n FROM queue_events WHERE job_id=? AND kind='JOB_CANCELLATION_REQUESTED'",
  ).get(f.jobId)?.n).toBe(1);
  count.close();
  expect(db.claimDueJob(f.lease.deviceId, 'after_cancel', at + 3010).status).toBe('EMPTY');
  db.close(); db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.getJob(f.jobId).job.state).toBe('CANCELLED');
});

it('turns active RUNNING cancellation into durable NEEDS_REVIEW and holds the device', async () => {
  const f = fixture('device_cancel_running', 'cancel_running');
  const receipt = db.requestJobCancellation({
    jobId: f.jobId, expectedRevision: f.running.revision,
    actorId: 'operator_cancel_running', at: at + 200,
  });
  expect(receipt).toMatchObject({
    state: 'NEEDS_REVIEW', disposition: 'REVIEW_REQUIRED',
    jobRevision: f.running.revision + 1,
    canRetry: false, canDispatch: false, canConfirm: false,
  });
  expect(db.requestJobCancellation({
    jobId: f.jobId, expectedRevision: receipt.jobRevision,
    actorId: 'operator_cancel_running', at: at + 210,
  })).toMatchObject({
    disposition: 'ALREADY_NEEDS_REVIEW', jobRevision: receipt.jobRevision,
  });
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  expect(sql.prepare('SELECT owner_id FROM job_claims WHERE job_id=?')
    .get(f.jobId)?.owner_id).toBe(f.lease.ownerId);
  expect(sql.prepare(
    "SELECT COUNT(*) AS n FROM queue_events WHERE job_id=? AND kind='JOB_CANCELLATION_REQUESTED'",
  ).get(f.jobId)?.n).toBe(1);
  sql.close();
  expect(() => prepare(f, at + 250)).toThrow();
  expect(db.claimDueJob(f.lease.deviceId, 'next_job', at + 250).status).toBe('NEEDS_REVIEW');
  db.close(); db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
});

it('cannot terminal-cancel an unverified PUBLISH INTENT or restart its attempt', () => {
  const f = fixture('device_cancel_intent', 'cancel_intent');
  const intent = prepare(f);
  const before = db.getJob(f.jobId).job;
  const result = db.requestJobCancellation({
    jobId: f.jobId, expectedRevision: before.revision,
    actorId: 'operator_cancel_intent', at: at + 100,
  });
  expect(result).toMatchObject({ state: 'NEEDS_REVIEW', disposition: 'REVIEW_REQUIRED' });
  expect(db.effectState(intent.effectId)).toBe('INTENT');
  expect(() => db.transitionJob(f.jobId, 'CANCELLED', result.jobRevision))
    .toThrow('Resolve uncertain external effect');
  expect(() => db.beginClaimedEffectAttempt({
    effectId: intent.effectId, expectedJobRevision: intent.jobRevision,
    lease: f.lease, at: at + 110,
  })).toThrow();
  expect(db.effectState(intent.effectId)).toBe('INTENT');
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  expect(sql.prepare('SELECT state FROM effects WHERE id=?').get(intent.effectId)?.state)
    .toBe('INTENT');
  sql.close();
});

it('rejects an in-flight host callback when cancellation advances the persisted claim fence', async () => {
  const f = fixture('device_cancel_race', 'cancel_race');
  let sends = 0, pendingId = '';
  const adapter: ClaimedEffectAdapter = {
    sendOnce: async () => { sends++; return 'ACK'; },
  };
  const host = hostEffect(adapter, {
    internal: async <T>(request: InternalRequest): Promise<T> => {
      const response = dispatchInternal(db, request) as T;
      if (request.command === 'effect.beginClaimedAttempt') {
        pendingId = request.effectId;
        const job = db.getJob(f.jobId).job;
        expect(db.requestJobCancellation({
          jobId: f.jobId, expectedRevision: job.revision,
          actorId: 'operator_cancel_race', at: at + 100,
        })).toMatchObject({
          state: 'NEEDS_REVIEW', disposition: 'REVIEW_REQUIRED',
        });
      }
      return response;
    },
  });
  await expect(host.attempt(claimedInput(f))).rejects.toMatchObject({
    code: 'EFFECT_DISPATCH_CLAIM_STALE',
  });
  expect(sends).toBe(0);
  expect(db.effectState(pendingId)).toBe('ATTEMPT_UNCERTAIN');
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(db.claimDueJob(f.lease.deviceId, 'no_replay', at + 150).status)
    .toBe('NEEDS_REVIEW');
});

it('holds already POSTED synthetic parent for review, without pretending it can retract it', () => {
  const { f, publish } = confirmedCommentHostFixture(0);
  const job = db.getJob(f.jobId).job;
  expect(job.state).toBe('POSTED');
  const result = db.requestJobCancellation({
    jobId: f.jobId, expectedRevision: job.revision,
    actorId: 'operator_posted_cancel', at: at + 200,
  });
  expect(result).toMatchObject({
    state: 'NEEDS_REVIEW', disposition: 'REVIEW_REQUIRED',
    canRetry: false, canDispatch: false,
  });
  expect(db.effectState(publish.effectId)).toBe('CONFIRMED');
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  const events = sql.prepare(
    "SELECT detail FROM queue_events WHERE job_id=? AND kind='JOB_CANCELLATION_REQUESTED'",
  ).all(f.jobId);
  expect(events).toHaveLength(1);
  expect(JSON.stringify(events)).not.toContain('Bình luận');
  sql.close();
});

it('preserves the exact COMMENT INTENT and its confirmed parent on cancellation', () => {
  const { f, publish, input } = confirmedCommentHostFixture(1);
  const intent = db.prepareClaimedEffect({ ...input, at: at + 125 });
  const job = db.getJob(f.jobId).job;
  expect(job.state).toBe('COMMENT_PENDING');
  const result = db.requestJobCancellation({
    jobId: f.jobId, expectedRevision: job.revision,
    actorId: 'operator_comment_cancel', at: at + 150,
  });
  expect(result).toMatchObject({
    state: 'NEEDS_REVIEW', disposition: 'REVIEW_REQUIRED',
  });
  expect(db.effectState(publish.effectId)).toBe('CONFIRMED');
  expect(db.effectState(intent.effectId)).toBe('INTENT');
  expect(() => db.beginClaimedEffectAttempt({
    effectId: intent.effectId, expectedJobRevision: intent.jobRevision,
    lease: f.lease, at: at + 180,
  })).toThrow();
  expect(() => db.transitionJob(f.jobId, 'CANCELLED', result.jobRevision))
    .toThrow('Resolve uncertain external effect');
});

it('rejects stale/invalid cancellation requests and forged public command without mutation', async () => {
  const f = fixture('device_cancel_invalid', 'cancel_invalid');
  const req = {
    jobId: f.jobId, expectedRevision: f.running.revision,
    actorId: 'operator_cancel_invalid', at: at + 100,
  };
  const counts = () => {
    const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
    try {
      return [
        sql.prepare('SELECT COUNT(*) AS n FROM effects WHERE job_id=?').get(f.jobId)?.n,
        sql.prepare('SELECT COUNT(*) AS n FROM queue_events WHERE job_id=?').get(f.jobId)?.n,
      ];
    } finally { sql.close(); }
  };
  const before = counts();
  for (const invalid of [
    { ...req, expectedRevision: -1 },
    { ...req, expectedRevision: req.expectedRevision + 1 },
    { ...req, actorId: '' },
    { ...req, at: Number.NaN },
  ]) {
    expect(() => db.requestJobCancellation(invalid)).toThrow();
    expect(db.getJob(f.jobId).job).toEqual(f.running);
    expect(counts()).toEqual(before);
  }
  await expect(dispatch(db, {
    operationId: 'op_forged_cancellation',
    command: 'job.requestCancellation' as never,
    input: req,
  })).rejects.toThrow();
  expect(counts()).toEqual(before);
});


it('persists an immutable actor/evidence review note for an uncertain effect without granting actions', async () => {
  const f = fixture('device_review_actor', 'review_actor');
  const intent = prepare(f);
  const cancel = db.requestJobCancellation({
    jobId: f.jobId, expectedRevision: intent.jobRevision,
    actorId: 'operator_cancel_audit', at: at + 100,
  });
  expect(cancel.state).toBe('NEEDS_REVIEW');
  const req = {
    command: 'effect.reviewRecord' as const,
    requestId: 'manual_review_001',
    jobId: f.jobId,
    effectId: intent.effectId,
    expectedJobRevision: cancel.jobRevision,
    expectedEffectState: 'INTENT' as const,
    actorId: 'operator_review_one',
    reasonCode: 'UNKNOWN_EFFECT' as const,
    disposition: 'AWAITING_EVIDENCE' as const,
    evidenceRefs: ['evidence_receipt_one', 'evidence_probe_two'],
    at: at + 120,
  };
  const rowCounts = () => {
    const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
    try {
      return [
        Number(sql.prepare('SELECT COUNT(*) AS n FROM effects WHERE job_id=?').get(f.jobId)?.n),
        Number(sql.prepare('SELECT COUNT(*) AS n FROM queue_events WHERE job_id=?').get(f.jobId)?.n),
        Number(sql.prepare('SELECT COUNT(*) AS n FROM effect_manual_reviews WHERE job_id=?')
          .get(f.jobId)?.n),
      ];
    } finally { sql.close(); }
  };
  const before = rowCounts();
  const result = dispatchInternal(db, req) as
    ReturnType<StudioDatabase['recordEffectManualReview']>;
  expect(result).toMatchObject({
    requestId: req.requestId, jobId: f.jobId, effectId: intent.effectId,
    jobRevision: cancel.jobRevision, evidenceCount: 2, alreadyRecorded: false,
    canConfirm: false, canRetry: false, canDispatch: false,
  });
  expect(JSON.stringify(result)).not.toContain('evidence_receipt_one');
  const after = rowCounts();
  expect(after).toEqual([before[0], before[1], before[2]! + 1]);
  const history = dispatchInternal(db, {
    command: 'effect.reviewHistory',
    jobId: f.jobId, effectId: intent.effectId, limit: 10,
  }) as ReturnType<StudioDatabase['effectManualReviewHistory']>;
  expect(history).toMatchObject({
    scope: 'PRIVATE_EFFECT_MANUAL_REVIEW_NOT_CERTIFIED',
    items: [{
      requestId: req.requestId, actorId: req.actorId,
      reasonCode: req.reasonCode, disposition: req.disposition,
      evidenceCount: 2,
    }],
    canConfirm: false, canRetry: false, canDispatch: false,
  });
  expect(JSON.stringify(history)).not.toContain('evidence_probe_two');
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(db.effectState(intent.effectId)).toBe('INTENT');
  expect(db.claimDueJob(f.lease.deviceId, 'not_allowed_to_repost', at + 200).status)
    .toBe('NEEDS_REVIEW');

  db.close(); db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.effectManualReviewHistory({
    jobId: f.jobId, effectId: intent.effectId, limit: 10,
  })).toEqual(history);
  expect(dispatchInternal(db, req)).toMatchObject({
    requestId: req.requestId, alreadyRecorded: true, canRetry: false,
  });
  expect(rowCounts()).toEqual(after);

  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  expect(() => sql.prepare(
    "UPDATE effect_manual_reviews SET disposition='ESCALATED' WHERE request_id=?",
  ).run(req.requestId)).toThrow('immutable');
  expect(() => sql.prepare(
    'DELETE FROM effect_manual_reviews WHERE request_id=?',
  ).run(req.requestId)).toThrow('immutable');
  expect(Number(sql.prepare('SELECT COUNT(*) AS n FROM effect_manual_reviews').get()?.n))
    .toBe(1);
  sql.close();
});

it('rejects forged or stale operator review inputs, conflict IDs and public worker commands', async () => {
  const f = fixture('device_review_invalid', 'review_invalid');
  const intent = prepare(f);
  const req = {
    requestId: 'manual_review_invalid',
    jobId: f.jobId, effectId: intent.effectId,
    expectedJobRevision: intent.jobRevision,
    expectedEffectState: 'INTENT' as const,
    actorId: 'operator_review_invalid',
    reasonCode: 'UNKNOWN_EFFECT' as const,
    disposition: 'AWAITING_EVIDENCE' as const,
    evidenceRefs: ['evidence_initial'],
    at: at + 90,
  };
  const sqlCount = () => {
    const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
    try {
      return Number(sql.prepare('SELECT COUNT(*) AS n FROM effect_manual_reviews').get()?.n);
    } finally { sql.close(); }
  };
  expect(() => db.recordEffectManualReview(req)).toThrow('NEEDS_REVIEW');
  expect(sqlCount()).toBe(0);
  const cancel = db.requestJobCancellation({
    jobId: f.jobId, expectedRevision: intent.jobRevision,
    actorId: req.actorId, at: at + 100,
  });
  const eligible = { ...req, expectedJobRevision: cancel.jobRevision };
  const invalids: Array<Parameters<StudioDatabase['recordEffectManualReview']>[0]> = [
    { ...eligible, expectedJobRevision: intent.jobRevision },
    { ...eligible, expectedEffectState: 'ATTEMPT_UNCERTAIN' },
    { ...eligible, effectId: 'effect_wrong_job' },
    { ...eligible, actorId: '' },
    { ...eligible, reasonCode: 'CONFIRMED_PROVIDER' as never },
    { ...eligible, disposition: 'CONFIRMED_AND_RETRY' as never },
    { ...eligible, evidenceRefs: [] },
    { ...eligible, evidenceRefs: ['same_reference', 'same_reference'] },
    { ...eligible, evidenceRefs: Array.from({ length: 9 }, (_, i) => 'evidence_' + i) },
    { ...eligible, at: Number.NaN },
  ];
  for (const bad of invalids) {
    expect(() => db.recordEffectManualReview(bad)).toThrow();
    expect(sqlCount()).toBe(0);
    expect(db.effectState(intent.effectId)).toBe('INTENT');
  }
  const first = db.recordEffectManualReview(eligible);
  expect(first.alreadyRecorded).toBe(false);
  expect(() => db.recordEffectManualReview({
    ...eligible, evidenceRefs: ['evidence_changed'],
  })).toThrow('already bound');
  expect(sqlCount()).toBe(1);
  expect(() => db.effectManualReviewHistory({
    jobId: f.jobId, effectId: intent.effectId, limit: 33,
  })).toThrow('1–32');
  expect(() => db.effectManualReviewHistory({
    jobId: f.jobId, effectId: 'effect_wrong_job', limit: 10,
  })).toThrow('Effect does not belong');
  await expect(dispatch(db, {
    operationId: 'op_forged_manual_review',
    command: 'effect.reviewRecord' as never,
    input: eligible,
  })).rejects.toThrow();
  expect(sqlCount()).toBe(1);
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
});

it('stores a pending COMMENT-only manual review without changing the synthetic parent post', () => {
  const { f, publish, input } = confirmedCommentHostFixture(0);
  const intent = db.prepareClaimedEffect({ ...input, at: at + 125 });
  db.beginClaimedEffectAttempt({
    effectId: intent.effectId, expectedJobRevision: intent.jobRevision,
    lease: f.lease, at: at + 140,
  });
  const current = db.getJob(f.jobId).job;
  const held = db.requestJobCancellation({
    jobId: f.jobId, expectedRevision: current.revision,
    actorId: 'operator_comment_review', at: at + 160,
  });
  const note = db.recordEffectManualReview({
    requestId: 'manual_comment_review',
    jobId: f.jobId, effectId: intent.effectId,
    expectedJobRevision: held.jobRevision,
    expectedEffectState: 'ATTEMPT_UNCERTAIN',
    actorId: 'operator_comment_review',
    reasonCode: 'COMMENT_UNCERTAIN',
    disposition: 'ESCALATED',
    evidenceRefs: ['evidence_comment_readback'],
    at: at + 170,
  });
  expect(note).toMatchObject({
    disposition: 'ESCALATED', evidenceCount: 1,
    canConfirm: false, canRetry: false, canDispatch: false,
  });
  expect(db.effectState(publish.effectId)).toBe('CONFIRMED');
  expect(db.effectState(intent.effectId)).toBe('ATTEMPT_UNCERTAIN');
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
});


it('reviews DB-only post plus partial comment rejection across restart without ever marking success', async () => {
  const { f, publish, input } = confirmedCommentHostFixture(0);
  const req = {
    command: 'comment.reviewPartialOutcome' as const,
    jobId: f.jobId,
    expectedSnapshotHash: f.snapshotHash,
    postEffectId: publish.effectId,
    fieldKey: 'comments',
    scope: 'row' as const,
  };
  const review = () => dispatchInternal(db, req) as
    ReturnType<StudioDatabase['reviewPersistedCommentPartialOutcome']>;
  const counts = () => {
    const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
    try {
      return [
        Number(sql.prepare('SELECT COUNT(*) AS n FROM effects WHERE job_id=?')
          .get(f.jobId)?.n),
        Number(sql.prepare('SELECT COUNT(*) AS n FROM queue_events WHERE job_id=?')
          .get(f.jobId)?.n),
      ];
    } finally { sql.close(); }
  };
  let before = counts();
  expect(review()).toMatchObject({
    scope: 'PRIVATE_COMMENT_PARTIAL_OUTCOME_NOT_PROVIDER_CERTIFIED',
    status: 'COMMENT_UNCERTAIN_REVIEW',
    totalOrdinals: 2, dbConfirmed: 0, dbRejected: 0, unresolvedOrUnsent: 2,
    canMarkSuccessWithWarnings: false, canRetry: false, canCleanup: false,
  });
  expect(counts()).toEqual(before);

  const intent = db.prepareClaimedEffect({ ...input, at: at + 125 });
  db.beginClaimedEffectAttempt({
    effectId: intent.effectId, expectedJobRevision: intent.jobRevision,
    lease: f.lease, at: at + 140,
  });
  const pending = db.getJob(f.jobId).job;
  db.requestJobCancellation({
    jobId: f.jobId, expectedRevision: pending.revision,
    actorId: 'operator_partial_review', at: at + 170,
  });
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(review()).toMatchObject({
    status: 'COMMENT_UNCERTAIN_REVIEW',
    totalOrdinals: 2, dbConfirmed: 0, dbRejected: 0,
    unresolvedOrUnsent: 2, canMarkSuccessWithWarnings: false,
  });

  // Only synthetic SQL fixture rows: never actual provider positive or negative proof.
  const frozen = db.frozenCommentListPlan({
    jobId: f.jobId, expectedSnapshotHash: f.snapshotHash,
    postEffectId: publish.effectId, fieldKey: 'comments', scope: 'row',
  });
  const second = frozen.items[1]!;
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  try {
    sql.prepare("UPDATE effects SET state='DEFINITIVELY_REJECTED' WHERE id=?")
      .run(intent.effectId);
    sql.prepare(
      'INSERT INTO effects(id,job_id,node_id,kind,effect_key,payload_hash,state,evidence_ref,created_at) ' +
      'VALUES(?,?,?,?,?,?,?,?,?)',
    ).run(
      'effect_synthetic_second_comment', f.jobId, 'comment', 'COMMENT',
      second.effectKey, second.payloadHash, 'CONFIRMED', null,
      new Date(at + 200).toISOString(),
    );
  } finally { sql.close(); }
  before = counts();
  const partial = review();
  expect(partial).toMatchObject({
    status: 'PARTIAL_DB_ONLY_REVIEW',
    totalOrdinals: 2, dbConfirmed: 1, dbRejected: 1, unresolvedOrUnsent: 0,
    providerCertification: 'NOT_AVAILABLE',
    canMarkSuccessWithWarnings: false, canConfirm: false,
    canRetry: false, canDispatch: false, canCleanup: false,
  });
  expect(JSON.stringify(partial)).not.toContain(second.effectKey);
  expect(counts()).toEqual(before);
  expect(db.effectState(publish.effectId)).toBe('CONFIRMED');
  expect(db.effectState(intent.effectId)).toBe('DEFINITIVELY_REJECTED');
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');

  await expect(dispatch(db, {
    operationId: 'op_forged_partial_result',
    command: 'comment.reviewPartialOutcome' as never,
    input: req,
  })).rejects.toThrow();
  expect(() => db.reviewPersistedCommentPartialOutcome({
    ...req, expectedSnapshotHash: contentHash('stale_snapshot'),
  })).toThrow('exact persisted snapshot');
  expect(() => db.reviewPersistedCommentPartialOutcome({
    ...req, postEffectId: 'effect_unrelated_parent',
  })).toThrow();
  expect(counts()).toEqual(before);

  db.close(); db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(review()).toEqual(partial);
  expect(counts()).toEqual(before);
  expect(db.claimDueJob(f.lease.deviceId, 'no_replay_for_partial', at + 3200).status)
    .toBe('NEEDS_REVIEW');

  // Another device can independently claim and run. This one is not posted/retried.
  const another = fixture('device_independent_partial', 'independent_partial');
  expect(another.running.state).toBe('RUNNING');
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(review()).toEqual(partial);
});

it('blocks forged extra PUBLISH and foreign COMMENT journal rows in partial-result readback', () => {
  const { f, publish, input } = confirmedCommentHostFixture(0);
  const req = {
    jobId: f.jobId, expectedSnapshotHash: f.snapshotHash,
    postEffectId: publish.effectId,
    fieldKey: 'comments', scope: 'row' as const,
  };
  const intent = db.prepareClaimedEffect({ ...input, at: at + 125 });
  db.beginClaimedEffectAttempt({
    effectId: intent.effectId, expectedJobRevision: intent.jobRevision,
    lease: f.lease, at: at + 140,
  });
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  try {
    sql.prepare(
      'INSERT INTO effects(id,job_id,node_id,kind,effect_key,payload_hash,state,evidence_ref,created_at) ' +
      'VALUES(?,?,?,?,?,?,?,?,?)',
    ).run(
      'effect_foreign_comment', f.jobId, 'comment', 'COMMENT',
      contentHash('not_in_frozen_snapshot'), contentHash('foreign_comment'),
      'INTENT', null, new Date(at + 180).toISOString(),
    );
  } finally { sql.close(); }
  const blocked = db.reviewPersistedCommentPartialOutcome(req);
  expect(blocked).toMatchObject({
    status: 'BLOCKED', blockers: ['COMMENT_JOURNAL_INVALID'],
    totalOrdinals: 0, canMarkSuccessWithWarnings: false, canRetry: false,
  });
  const second = new DatabaseSync(join(dir, 'studio.sqlite'));
  try {
    second.prepare('DELETE FROM effects WHERE id=?').run('effect_foreign_comment');
    second.prepare(
      'INSERT INTO effects(id,job_id,node_id,kind,effect_key,payload_hash,state,evidence_ref,created_at) ' +
      'VALUES(?,?,?,?,?,?,?,?,?)',
    ).run(
      'effect_second_publish', f.jobId, 'publish', 'PUBLISH',
      contentHash('duplicate_publish_effect_key'), contentHash('duplicate_publish_payload'),
      'CONFIRMED', null, new Date(at + 190).toISOString(),
    );
  } finally { second.close(); }
  expect(db.reviewPersistedCommentPartialOutcome(req)).toMatchObject({
    status: 'BLOCKED', blockers: ['PUBLISH_JOURNAL_INVALID'],
    canMarkSuccessWithWarnings: false, canDispatch: false,
  });
  expect(db.getJob(f.jobId).job.state).toBe('COMMENT_PENDING');
});


it('refuses to mark synthetic DB-CONFIRMED PUBLISH as a successful provider post', () => {
  const { f, publish } = confirmedCommentHostFixture(0);
  const job = db.getJob(f.jobId).job;
  expect(job.state).toBe('POSTED');
  expect(db.effectState(publish.effectId)).toBe('CONFIRMED');
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  const countBefore = [
    Number(sql.prepare('SELECT COUNT(*) AS n FROM effects WHERE job_id=?').get(f.jobId)?.n),
    Number(sql.prepare('SELECT COUNT(*) AS n FROM queue_events WHERE job_id=?').get(f.jobId)?.n),
  ];
  expect(() => db.transitionJob(f.jobId, 'SUCCESS', job.revision))
    .toThrow('independently verified');
  expect(db.getJob(f.jobId).job).toEqual(job);
  expect(db.effectState(publish.effectId)).toBe('CONFIRMED');
  expect([
    Number(sql.prepare('SELECT COUNT(*) AS n FROM effects WHERE job_id=?').get(f.jobId)?.n),
    Number(sql.prepare('SELECT COUNT(*) AS n FROM queue_events WHERE job_id=?').get(f.jobId)?.n),
  ]).toEqual(countBefore);
  sql.close();
});

it('refuses DB-only rejected comment warning/failed/cancelled terminals without provider proof', () => {
  const { f, publish, input } = confirmedCommentHostFixture(0);
  const intent = db.prepareClaimedEffect({ ...input, at: at + 125 });
  db.beginClaimedEffectAttempt({
    effectId: intent.effectId,
    expectedJobRevision: intent.jobRevision,
    lease: f.lease, at: at + 140,
  });
  // SQL fixture state deliberately has NO independent negative provider proof.
  const sqlite = new DatabaseSync(join(dir, 'studio.sqlite'));
  sqlite.prepare("UPDATE effects SET state='DEFINITIVELY_REJECTED' WHERE id=?")
    .run(intent.effectId);
  sqlite.close();
  const job = db.getJob(f.jobId).job;
  expect(job.state).toBe('COMMENT_PENDING');
  expect(() => db.transitionJob(f.jobId, 'SUCCESS_WITH_WARNINGS', job.revision))
    .toThrow('independently verified');
  expect(db.getJob(f.jobId).job).toEqual(job);

  const cancelled = db.requestJobCancellation({
    jobId: f.jobId, expectedRevision: job.revision,
    actorId: 'operator_final_result_guard', at: at + 180,
  });
  expect(cancelled.state).toBe('NEEDS_REVIEW');
  const review = db.getJob(f.jobId).job;
  const conn = new DatabaseSync(join(dir, 'studio.sqlite'));
  const beforeEvents = conn.prepare(
    'SELECT COUNT(*) AS n FROM queue_events WHERE job_id=?',
  ).get(f.jobId)?.n;
  const beforeEffects = conn.prepare(
    'SELECT COUNT(*) AS n FROM effects WHERE job_id=?',
  ).get(f.jobId)?.n;
  for (const terminal of ['FAILED', 'CANCELLED'] as const) {
    expect(() => db.transitionJob(f.jobId, terminal, review.revision))
      .toThrow('independently verified');
    expect(db.getJob(f.jobId).job).toEqual(review);
  }
  expect(conn.prepare('SELECT COUNT(*) AS n FROM queue_events WHERE job_id=?')
    .get(f.jobId)?.n).toBe(beforeEvents);
  expect(conn.prepare('SELECT COUNT(*) AS n FROM effects WHERE job_id=?')
    .get(f.jobId)?.n).toBe(beforeEffects);
  expect(db.effectState(publish.effectId)).toBe('CONFIRMED');
  expect(db.effectState(intent.effectId)).toBe('DEFINITIVELY_REJECTED');
  expect(db.claimDueJob(f.lease.deviceId, 'no_replay_after_guard', at + 200).status)
    .toBe('NEEDS_REVIEW');
  conn.close();
  db.close(); db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.getJob(f.jobId).job).toEqual(review);
});

it('still permits the ordinary failed terminal for a job with no external effect', () => {
  const f = fixture('device_unattempted_terminal', 'unattempted_terminal');
  const completed = db.transitionJob(f.jobId, 'FAILED', f.running.revision);
  expect(completed).toMatchObject({
    state: 'FAILED', revision: f.running.revision + 1,
  });
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  expect(sql.prepare('SELECT COUNT(*) AS n FROM effects WHERE job_id=?')
    .get(f.jobId)?.n).toBe(0);
  sql.close();
  expect(db.getJob(f.jobId).job.state).toBe('FAILED');
});


it('records provider-evidence-missing with zero refs, projects a redacted latest note, and preserves uncertainty', async () => {
  const f = fixture('device_missing_provider_evidence', 'missing_provider_evidence');
  const intent = prepare(f);
  const cancel = db.requestJobCancellation({
    jobId: f.jobId, expectedRevision: intent.jobRevision,
    actorId: 'operator_cancel_missing_provider', at: at + 100,
  });
  expect(cancel.state).toBe('NEEDS_REVIEW');
  const target = db.effectManualReviewTarget(f.jobId, 0);
  expect(target).toMatchObject({
    jobId: f.jobId, ordinal: 0, effectId: intent.effectId,
    jobRevision: cancel.jobRevision, kind: 'PUBLISH', state: 'INTENT',
    canConfirm: false, canRetry: false, canDispatch: false,
  });
  const beforeJob = db.getJob(f.jobId).job;
  const beforeEvents = (() => {
    const conn = new DatabaseSync(join(dir, 'studio.sqlite'));
    try { return Number(conn.prepare('SELECT COUNT(*) AS n FROM queue_events WHERE job_id=?')
      .get(f.jobId)?.n); } finally { conn.close(); }
  })();
  const receipt = db.recordEffectManualReview({
    requestId: 'manual_review_provider_missing_empty',
    jobId: f.jobId, effectId: target.effectId,
    expectedJobRevision: target.jobRevision,
    expectedEffectState: target.state,
    actorId: 'operator_self_reported_missing',
    reasonCode: 'PROVIDER_EVIDENCE_MISSING',
    disposition: 'AWAITING_EVIDENCE',
    evidenceRefs: [], at: at + 150,
  });
  expect(receipt).toMatchObject({
    evidenceCount: 0, reasonCode: 'PROVIDER_EVIDENCE_MISSING',
    disposition: 'AWAITING_EVIDENCE',
    canConfirm: false, canRetry: false, canDispatch: false,
  });
  const history = db.effectManualReviewHistory({
    jobId: f.jobId, effectId: intent.effectId, limit: 1,
  });
  expect(history.items[0]).toMatchObject({
    actorId: 'operator_self_reported_missing',
    reasonCode: 'PROVIDER_EVIDENCE_MISSING',
    disposition: 'AWAITING_EVIDENCE', evidenceCount: 0,
  });
  const page = db.jobStageReview(f.jobId);
  expect(page.effectReview.entries[0]).toMatchObject({
    ordinal: 0, kind: 'PUBLISH', state: 'INTENT',
    manualReviewCount: 1,
    latestManualReview: {
      actorId: 'operator_self_reported_missing',
      reasonCode: 'PROVIDER_EVIDENCE_MISSING',
      disposition: 'AWAITING_EVIDENCE', evidenceCount: 0,
    },
  });
  expect(JSON.stringify(page.effectReview.entries)).not.toContain(intent.effectId);
  expect(db.getJob(f.jobId).job).toEqual(beforeJob);
  expect(db.effectState(intent.effectId)).toBe('INTENT');
  const afterEvents = (() => {
    const conn = new DatabaseSync(join(dir, 'studio.sqlite'));
    try { return Number(conn.prepare('SELECT COUNT(*) AS n FROM queue_events WHERE job_id=?')
      .get(f.jobId)?.n); } finally { conn.close(); }
  })();
  expect(afterEvents).toBe(beforeEvents);
  db.close(); db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.jobStageReview(f.jobId).effectReview.entries[0])
    .toMatchObject({ manualReviewCount: 1, latestManualReview: { evidenceCount: 0 } });
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(db.effectState(intent.effectId)).toBe('INTENT');
});

it('enforces a 32-note cap per unresolved effect without allowing a 33rd target', () => {
  const f = fixture('device_effect_review_note_cap', 'effect_review_note_cap');
  const intent = prepare(f);
  const cancel = db.requestJobCancellation({
    jobId: f.jobId, expectedRevision: intent.jobRevision,
    actorId: 'operator_cancel_note_cap', at: at + 100,
  });
  for (let n = 0; n < 32; n++) {
    const receipt = db.recordEffectManualReview({
      requestId: 'manual_review_cap_' + n,
      jobId: f.jobId, effectId: intent.effectId,
      expectedJobRevision: cancel.jobRevision, expectedEffectState: 'INTENT',
      actorId: 'operator_self_reported_cap',
      reasonCode: 'PROVIDER_EVIDENCE_MISSING', disposition: 'AWAITING_EVIDENCE',
      evidenceRefs: [], at: at + 200 + n,
    });
    expect(receipt.evidenceCount).toBe(0);
  }
  expect(db.jobStageReview(f.jobId).effectReview.entries[0]?.manualReviewCount).toBe(32);
  expect(() => db.effectManualReviewTarget(f.jobId, 0)).toThrow('32-note audit limit');
  expect(() => db.recordEffectManualReview({
    requestId: 'manual_review_cap_33',
    jobId: f.jobId, effectId: intent.effectId,
    expectedJobRevision: cancel.jobRevision, expectedEffectState: 'INTENT',
    actorId: 'operator_self_reported_cap',
    reasonCode: 'PROVIDER_EVIDENCE_MISSING', disposition: 'AWAITING_EVIDENCE',
    evidenceRefs: [], at: at + 300,
  })).toThrow('32 immutable manual review notes');
  expect(db.getJob(f.jobId).job.state).toBe('NEEDS_REVIEW');
  expect(db.effectState(intent.effectId)).toBe('INTENT');
});
