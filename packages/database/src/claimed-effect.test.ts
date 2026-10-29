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
function fixture(deviceId = 'device_1', index = '1', withComment = false) {
  db.registerObservedDevice(deviceId, deviceId);
  // A verified profile fixture is required even before the provider preflight.
  const setup = new DatabaseSync(join(dir, 'studio.sqlite'));
  setup.prepare(
    "INSERT INTO device_profiles(device_id,fingerprint,metadata,identity,revision) VALUES(?,?,NULL,'VERIFIED_PROPERTIES',0)",
  ).run(deviceId, contentHash({ deviceId, verifiedFixture: true }));
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
    id: contentId, processId: process.id, revision: 0,
    fields: withComment
      ? { comments: ['Bình luận thứ nhất 👨‍👩‍👧\r\nCâu tiếp', 'Bình luận thứ nhất 👨‍👩‍👧\r\nCâu tiếp'] }
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
  const commentInput = (revision: number) => ({
    jobId: f.jobId,
    expectedJobRevision: revision,
    expectedSnapshotHash: f.snapshotHash,
    nodeId: 'comment',
    kind: 'COMMENT' as const,
    effectKey: contentHash('comment_ordinal_0'),
    payloadHash: contentHash('comment-payload'),
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
  expect(() => dispatchInternal(db, req)).toThrow('not confirmed');
  const sql = new DatabaseSync(join(dir, 'studio.sqlite'));
  sql.prepare("UPDATE effects SET state='CONFIRMED' WHERE id=?").run(post.effectId);
  sql.prepare("UPDATE jobs SET state='POSTED',revision=revision+1 WHERE id=?")
    .run(f.jobId);
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
  expect(() => dispatch(db, {
    operationId: 'op_forge_frozen_comment_plan',
    command: 'comment.planFrozen' as never,
    input: req,
  })).toThrow();
  sql.close();

  const beforeJob = db.getJob(f.jobId);
  db.close(); db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.getJob(f.jobId)).toEqual(beforeJob);
  expect(dispatchInternal(db, req)).toEqual(plan);
  expect(db.effectState(post.effectId)).toBe('CONFIRMED');
  expect(attempted.state).toBe('ATTEMPT_UNCERTAIN');
});
