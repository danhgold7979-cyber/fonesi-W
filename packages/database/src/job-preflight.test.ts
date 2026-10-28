import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ProcessDefinition, JobSnapshot } from '@autoreels/contracts';
import { contentHash } from '@autoreels/domain';
import { StudioDatabase } from './index.js';
import { dispatch } from '../../../apps/desktop/src/host/service.js';

const at = Date.parse('2026-10-28T00:00:00Z');
let dir: string, db: StudioDatabase;
const databaseFile = () => join(dir, 'studio.sqlite');
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'autoreels-job-preflight-'));
  db = new StudioDatabase(databaseFile());
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
function fixture(media = false) {
  const deviceId = 'device_preflight', processId = 'process_preflight',
    contentId = 'content_preflight', jobId = 'job_preflight';
  db.registerObservedDevice(deviceId, 'Test device');
  const draft = db.createWorkflow('fb', 'Preflight fixture');
  const version = db.createVersion(draft.workflowId, 0);
  const process: ProcessDefinition = {
    id: processId, name: processId, appId: 'fb',
    workflowId: draft.workflowId, workflowVersionId: version.id,
    deviceId, accountId: null, targetId: null,
    revision: 0, archived: false,
    schedule: {
      timezone: 'Asia/Ho_Chi_Minh', startDate: '2026-10-26',
      slots: ['08:00'], weekdays: [1, 2, 3, 4, 5, 6, 7],
      overduePolicy: 'CATCH_UP', jitterMinutes: 0,
    },
  };
  db.saveProcess(process, null);
  const assetId = 'asset_preflight', hash = 'a'.repeat(64);
  if (media) db.registerAsset({
    id: assetId, sourceRef: 'source_preflight', relativePath: 'video.mp4',
    hash, kind: 'video', bytes: 1, mtimeMs: 1,
  });
  db.saveContent({
    id: contentId, processId, revision: 0,
    fields: { caption: 'private content never returned' },
    assetIds: media ? [assetId] : [], ignored: false,
  }, null);
  const snapshot: JobSnapshot = {
    workflowVersionId: version.id, workflowHash: version.hash,
    bundle: version.bundle, contentId,
    fields: { caption: 'private content never returned' },
    assetIds: media ? [assetId] : [],
    ...(media ? { assets: [{
      id: assetId, contentId, relativePath: 'video.mp4', hash,
      kind: 'video' as const, bytes: 1, state: 'READY' as const, probe: null,
    }] } : {}),
    targetId: null, networkProfileId: null,
  };
  db.createJob({
    id: jobId, occurrenceKey: contentHash({ jobId }), processId, deviceId, contentId,
    scheduledUtc: '2035-01-01T00:00:00.000Z',
    state: 'SCHEDULED', revision: 0, priority: 0,
  }, snapshot);
  return { deviceId, processId, contentId, jobId, assetId, hash, process };
}
function sql(action: (db: DatabaseSync) => void) {
  const connection = new DatabaseSync(databaseFile());
  try { action(connection); } finally { connection.close(); }
}
function codes(id: string): string[] {
  return db.inspectJobPreflight(id, at).blockers.map((b) => b.code);
}
it('only returns a redacted, read-only persisted diagnostic; no fake launch permission', async () => {
  const f = fixture();
  const before = db.getJob(f.jobId);
  const inspected = db.inspectJobPreflight(f.jobId, at);
  expect(inspected).toMatchObject({
    jobId: f.jobId, jobRevision: 0, status: 'BLOCKED',
    scope: 'PERSISTED_ONLY', canDispatch: false,
  });
  expect(codes(f.jobId)).toContain('DEVICE_IDENTITY_UNVERIFIED');
  expect(codes(f.jobId)).toContain('LIVE_PROFILE_NOT_CERTIFIED');
  expect(JSON.stringify(inspected)).not.toContain('private content');
  expect(JSON.stringify(inspected)).not.toContain('video.mp4');
  expect(db.getJob(f.jobId)).toEqual(before);
  const fromPublic = await dispatch(db, {
    operationId: 'op_preflight_readonly', command: 'jobPreflight', input: { id: f.jobId },
  }) as { canDispatch: boolean };
  expect(fromPublic.canDispatch).toBe(false);
  await expect(dispatch(db, {
    operationId: 'op_preflight_bad', command: 'jobPreflight',
    input: { id: '../path', dispatch: true },
  })).rejects.toThrow();
  sql((connection) => {
    expect(connection.prepare('SELECT COUNT(*) AS n FROM effects').get()?.n).toBe(0);
    expect(connection.prepare('SELECT COUNT(*) AS n FROM leases').get()?.n).toBe(0);
    expect(connection.prepare('SELECT revision FROM jobs WHERE id=?').get(f.jobId)?.revision).toBe(0);
  });
});
it('distinguishes disabled, conflicted and busy devices without claiming or changing job', () => {
  const f = fixture();
  sql((connection) => {
    connection.prepare('UPDATE devices SET enabled=0 WHERE id=?').run(f.deviceId);
    connection.prepare(
      "INSERT INTO device_profiles VALUES(?,?,NULL,'CONFLICT',0)",
    ).run(f.deviceId, contentHash({ id: f.deviceId }));
  });
  expect(codes(f.jobId)).toEqual(expect.arrayContaining([
    'DEVICE_DISABLED', 'DEVICE_IDENTITY_CONFLICT',
  ]));
  sql((connection) => {
    connection.prepare('UPDATE devices SET enabled=1 WHERE id=?').run(f.deviceId);
    connection.prepare("UPDATE device_profiles SET identity='VERIFIED_PROPERTIES' WHERE device_id=?")
      .run(f.deviceId);
  });
  db.acquireLease(f.deviceId, 'operator_manual', 'MANUAL', at, 3000);
  expect(codes(f.jobId)).toContain('DEVICE_LEASE_BUSY');
  expect(codes(f.jobId)).not.toContain('DEVICE_IDENTITY_UNVERIFIED');
  expect(codes(f.jobId)).toContain('LIVE_PROFILE_NOT_CERTIFIED');
  expect(db.getJob(f.jobId).job.state).toBe('SCHEDULED');
});
it('reports archived Process, frozen version mismatch and prior external effect as needs-review', () => {
  const f = fixture();
  const archived = { ...f.process, archived: true };
  db.saveProcess(archived, f.process.revision);
  expect(codes(f.jobId)).toContain('PROCESS_ARCHIVED');
  sql((connection) => {
    connection.prepare('UPDATE workflow_versions SET hash=? WHERE id=?').run(
      contentHash('wrong'), db.getJob(f.jobId).snapshot.workflowVersionId,
    );
  });
  expect(codes(f.jobId)).toContain('PINNED_VERSION_MISMATCH');
  db.recordIntent(f.jobId, 'publish_node', 'PUBLISH', contentHash('one'), contentHash('payload'));
  const report = db.inspectJobPreflight(f.jobId, at);
  expect(report.status).toBe('NEEDS_REVIEW');
  expect(report.canDispatch).toBe(false);
  expect(report.blockers.map((b) => b.code)).toContain('EXTERNAL_EFFECT_REVIEW');
  expect(db.getJob(f.jobId).job.state).toBe('SCHEDULED');
});
it('matches media to the frozen reference, rejects changes and preserves uncertainty across restart', () => {
  const f = fixture(true);
  expect(codes(f.jobId)).toContain('MEDIA_SOURCE_UNVERIFIED');
  sql((connection) => {
    connection.prepare('INSERT INTO sources VALUES(?,?,?,?,?,?,?,?,?)').run(
      'source_preflight', f.processId, 'FILE', '/private/absolute/path',
      0, 0, 0, 1, 'host_private',
    );
    connection.prepare('INSERT INTO source_entries VALUES(?,?,?,?,?,?,?,?)').run(
      'source_preflight','video.mp4',f.hash,f.hash,f.assetId,f.contentId,'READY','gen_1',
    );
  });
  const ok = db.inspectJobPreflight(f.jobId, at);
  expect(ok.blockers.map((b) => b.code)).not.toContain('MEDIA_SOURCE_UNVERIFIED');
  expect(ok.canDispatch).toBe(false);
  expect(JSON.stringify(ok)).not.toContain('/private/absolute/path');
  sql((connection) =>
    connection.prepare("UPDATE source_entries SET state='CHANGED',observed_hash=? WHERE asset_id=?")
      .run('b'.repeat(64), f.assetId));
  expect(codes(f.jobId)).toContain('MEDIA_CHANGED_OR_MISSING');
  db.close();
  db = new StudioDatabase(databaseFile());
  expect(codes(f.jobId)).toContain('MEDIA_CHANGED_OR_MISSING');
  expect(db.getJob(f.jobId).snapshot.assetIds).toEqual([f.assetId]);
});
it('fails safely on invalid clock and corrupt snapshot rather than authorizing dispatch', () => {
  const f = fixture();
  expect(() => db.inspectJobPreflight(f.jobId, Number.NaN)).toThrow();
  sql((connection) => connection.prepare('UPDATE jobs SET snapshot_hash=? WHERE id=?')
    .run(contentHash('tampered'), f.jobId));
  expect(() => db.inspectJobPreflight(f.jobId, at)).toThrow('snapshot');
  expect(db.getJob(f.jobId)).toThrow();
});
