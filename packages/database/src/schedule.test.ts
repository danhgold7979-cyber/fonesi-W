import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ProcessDefinition } from '@autoreels/contracts';
import { contentHash } from '@autoreels/domain';
import { StudioDatabase } from './index.js';

let db: StudioDatabase, dir: string;
const at = '2026-10-26T00:00:00.000Z';
const processInput: ProcessDefinition = {
  id: 'process_schedule',
  name: 'Schedule fixture',
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
    jitterMinutes: 12,
  },
};
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'autoreels-schedule-'));
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  db.registerObservedDevice('device_fixture', 'Fixture device');
  const draft = db.createWorkflow('fb', 'Schedule fixture');
  draft.bundle.inputs = [{ key: 'caption', type: 'text', scope: 'row', required: true }];
  db.saveDraft(draft.bundle, 0);
  const version = db.createVersion(draft.workflowId, 1);
  db.saveProcess(
    {
      ...processInput,
      deviceId: 'device_fixture',
      workflowId: draft.workflowId,
      workflowVersionId: version.id,
    },
    null,
  );
  for (const id of ['content_1', 'content_2'])
    db.saveContent(
      {
        id,
        processId: processInput.id,
        revision: 0,
        fields: { caption: id },
        assetIds: [],
        ignored: false,
      },
      null,
    );
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const preview = (ids = ['content_1', 'content_2']) =>
  db.previewSchedule(processInput.id, ids, null, at, 12345);
function raw(): DatabaseSync {
  return new DatabaseSync(join(dir, 'studio.sqlite'));
}

describe('scoped batch schedule preview/apply', () => {
  function fixture() {
    const applied = db.applySchedule(preview().token, null, at);
    const connection = raw();
    connection.exec("UPDATE jobs SET scheduled_utc='2030-01-01T16:30:00.000Z'");
    connection.close();
    const source = db.getJob(applied.jobIds[0]!);
    db.createJob(
      {
        ...source.job,
        id: 'job_outside',
        occurrenceKey: contentHash('outside'),
        scheduledUtc: '2030-01-05T00:00:00.000Z',
      },
      source.snapshot,
    );
    return {
      jobs: applied.jobIds.map((id) => ({ id, revision: 0 })),
      outside: db.getJob('job_outside'),
    };
  }
  it('persists exact seeded proposal, immutable snapshots, selection scope and idempotency across restart', () => {
    const { jobs, outside } = fixture(),
      originals = jobs.map((j) => db.getJob(j.id));
    const proposal = db.previewJobChanges(
      { operation: 'SPREAD', jobs, minGapMinutes: 90, maxGapMinutes: 90 },
      'host_a',
      at,
      123,
    );
    expect(proposal).toMatchObject({ canApply: true, seed: 123 });
    expect(proposal.slots[1]!.crossesLocalDay).toBe(true);
    expect(jobs.map((j) => db.getJob(j.id))).toEqual(originals);
    db.close();
    db = new StudioDatabase(join(dir, 'studio.sqlite'));
    expect(db.applyJobChanges(proposal.token, 'host_a', at)).toEqual({
      jobIds: jobs.map((j) => j.id),
      alreadyApplied: false,
    });
    for (const slot of proposal.slots) {
      const saved = db.getJob(slot.jobId),
        old = originals.find((o) => o.job.id === slot.jobId)!;
      expect(saved.job).toEqual({
        ...old.job,
        revision: 1,
        scheduledUtc: new Date(slot.proposedUtc).toISOString(),
      });
      expect(saved.snapshotHash).toBe(old.snapshotHash);
      expect(saved.snapshot).toEqual(old.snapshot);
    }
    expect(db.getJob(outside.job.id)).toEqual(outside);
    db.close();
    db = new StudioDatabase(join(dir, 'studio.sqlite'));
    expect(
      db.applyJobChanges(proposal.token, 'host_a', '2035-01-01T00:00:00Z').alreadyApplied,
    ).toBe(true);
    expect(jobs.map((j) => db.getJob(j.id).job.revision)).toEqual([1, 1]);
  });
  it('blocks external collisions and unsafe states/revisions/intents without modifying jobs outside scope', () => {
    const { jobs } = fixture();
    const connection = raw();
    connection
      .prepare('UPDATE jobs SET scheduled_utc=? WHERE id=?')
      .run('2030-01-01T18:00:00Z', 'job_outside');
    connection.close();
    const proposal = db.previewJobChanges(
      { operation: 'SPREAD', jobs, minGapMinutes: 90, maxGapMinutes: 90 },
      null,
      at,
      1,
    );
    expect(proposal.blockers.some((b) => b.code === 'TIME_CONFLICT')).toBe(true);
    expect(() => db.applyJobChanges(proposal.token, null, at)).toThrow('lý do chặn');
    db.transitionJob(jobs[0]!.id, 'QUEUED', 0);
    db.recordIntent(
      jobs[1]!.id,
      'node_fixture',
      'PUBLISH',
      contentHash('batch-effect'),
      contentHash('payload'),
    );
    const unsafe = db.previewJobChanges({ operation: 'CANCEL', jobs }, null, at);
    expect(unsafe.blockers.filter((b) => b.code === 'JOB_NOT_EDITABLE')).toHaveLength(2);
    expect(unsafe.blockers.some((b) => b.code === 'REVISION_CONFLICT')).toBe(true);
    expect(() => db.applyJobChanges(unsafe.token, null, at)).toThrow();
    expect(db.getJob(jobs[1]!.id).job.state).toBe('SCHEDULED');
  });
  it('rejects stale epoch, newly durable effects, expired/foreign/tampered proposals and invalid scope', () => {
    const { jobs } = fixture();
    const prepare = () => db.previewJobChanges({ operation: 'CANCEL', jobs }, 'host_a', at);
    const first = prepare();
    db.rescheduleJob('job_outside', 0, '2030-01-06T00:00:00Z', at);
    expect(() => db.applyJobChanges(first.token, 'host_a', at)).toThrow('đã đổi');
    const effects = prepare();
    db.recordIntent(
      jobs[0]!.id,
      'node_fixture',
      'PUBLISH',
      contentHash('new-intent'),
      contentHash('payload'),
    );
    expect(() => db.applyJobChanges(effects.token, 'host_a', at)).toThrow('đã đổi');
    const other = db.previewJobChanges({ operation: 'CANCEL', jobs: [jobs[1]!] }, 'host_a', at);
    expect(() => db.applyJobChanges(other.token, 'host_b', at)).toThrow('host khác');
    expect(() => db.applyJobChanges(other.token, 'host_a', other.expiresAt)).toThrow('hết hạn');
    const connection = raw();
    connection
      .prepare('UPDATE job_change_previews SET payload=? WHERE token=?')
      .run('{}', other.token);
    connection.close();
    expect(() => db.applyJobChanges(other.token, 'host_a', at)).toThrow('Checksum');
    expect(() =>
      db.previewJobChanges({ operation: 'CANCEL', jobs: [jobs[1]!, jobs[1]!] }, null, at),
    ).toThrow('đúng một lần');
    expect(() =>
      db.previewJobChanges(
        { operation: 'SPREAD', jobs, minGapMinutes: 120, maxGapMinutes: 60 },
        null,
        at,
      ),
    ).toThrow();
  });
  it('rolls back a failing multi-job cancellation and safely retries with history intact', () => {
    const { jobs, outside } = fixture(),
      before = jobs.map((j) => db.getJob(j.id));
    const proposal = db.previewJobChanges({ operation: 'CANCEL', jobs }, null, at);
    const connection = raw();
    connection.exec(
      "CREATE TRIGGER fail_batch BEFORE UPDATE ON jobs WHEN OLD.id='" +
        jobs[1]!.id +
        "' BEGIN SELECT RAISE(ABORT,'batch fixture failure'); END;",
    );
    expect(() => db.applyJobChanges(proposal.token, null, at)).toThrow('batch fixture failure');
    expect(jobs.map((j) => db.getJob(j.id))).toEqual(before);
    connection.exec('DROP TRIGGER fail_batch');
    connection.close();
    expect(db.applyJobChanges(proposal.token, null, at).alreadyApplied).toBe(false);
    expect(db.applyJobChanges(proposal.token, null, at).alreadyApplied).toBe(true);
    for (const job of before)
      expect(db.getJob(job.job.id)).toEqual({
        ...job,
        job: { ...job.job, state: 'CANCELLED', revision: 1 },
      });
    expect(db.getJob(outside.job.id)).toEqual(outside);
  });
});

describe('persisted schedule proposals and atomic apply', () => {
  it('applies the exact instants after restart, pins full snapshots, and returns the same IDs on repeated apply', () => {
    const p = preview();
    expect(p.canApply).toBe(true);
    db.close();
    db = new StudioDatabase(join(dir, 'studio.sqlite'));
    const applied = db.applySchedule(p.token, null, at);
    expect(applied).toMatchObject({ alreadyApplied: false });
    const saved = applied.jobIds.map((id) => db.getJob(id));
    expect(saved.map((s) => Date.parse(s.job.scheduledUtc))).toEqual(
      p.slots.map((s) => Date.parse(s.scheduledUtc)),
    );
    expect(saved[0]!.snapshot).toMatchObject({
      targetId: null,
      fields: { caption: 'content_1' },
      scheduleProfile: processInput.schedule,
    });
    const hash = saved[0]!.snapshotHash;
    const row = db.listContent(processInput.id)[0]!;
    db.saveContent({ ...row, fields: { caption: 'edited later' } }, row.revision);
    const process = db.getProcess(processInput.id);
    db.saveProcess({ ...process, name: 'Renamed after apply' }, process.revision);
    db.close();
    db = new StudioDatabase(join(dir, 'studio.sqlite'));
    expect(db.applySchedule(p.token, null, '2026-12-01T00:00:00.000Z')).toEqual({
      ...applied,
      alreadyApplied: true,
    });
    expect(db.getJob(applied.jobIds[0]!).snapshotHash).toBe(hash);
    expect(db.getJob(applied.jobIds[0]!).snapshot.fields.caption).toBe('content_1');
    expect(db.listJobs().jobs).toHaveLength(2);
  });
  it('rolls back the whole batch and token mapping when any insert fails, then can safely apply the same proposal', () => {
    const p = preview(),
      sql = raw();
    sql.exec(
      "CREATE TRIGGER fixture_fail_second BEFORE INSERT ON jobs WHEN NEW.content_id='content_2' BEGIN SELECT RAISE(ABORT,'fixture failure'); END;",
    );
    expect(() => db.applySchedule(p.token, null, at)).toThrow('fixture failure');
    expect(db.listJobs().jobs).toHaveLength(0);
    expect(sql.prepare('SELECT COUNT(*) AS n FROM schedule_preview_jobs').get()?.n).toBe(0);
    expect(
      sql.prepare('SELECT applied_at FROM schedule_previews WHERE token=?').get(p.token)
        ?.applied_at,
    ).toBeNull();
    sql.exec('DROP TRIGGER fixture_fail_second');
    sql.close();
    expect(db.applySchedule(p.token, null, at).jobIds).toHaveLength(2);
  });
  it('rejects expiry, changed Process/content/jobs and duplicate scheduling from another token', () => {
    const expired = preview();
    expect(() => db.applySchedule(expired.token, null, expired.expiresAt)).toThrow('hết hạn');
    const changedProcess = preview(),
      process = db.getProcess(processInput.id);
    db.saveProcess({ ...process, name: 'Changed' }, process.revision);
    expect(() => db.applySchedule(changedProcess.token, null, at)).toThrow('đã đổi');
    const changedContent = preview(),
      row = db.listContent(processInput.id)[0]!;
    db.saveContent({ ...row, fields: { caption: 'changed' } }, row.revision);
    expect(() => db.applySchedule(changedContent.token, null, at)).toThrow('đã đổi');
    const first = preview(),
      second = preview();
    db.applySchedule(first.token, null, at);
    expect(() => db.applySchedule(second.token, null, at)).toThrow('đã đổi');
    const duplicate = preview();
    expect(duplicate.canApply).toBe(false);
    expect(() => db.applySchedule(duplicate.token, null, at)).toThrow('đã có lịch');
    expect(db.listJobs().jobs).toHaveLength(2);
  });
  it('rejects token tampering and invalid scopes without creating any jobs', () => {
    expect(() => preview([])).toThrow('1–1000');
    expect(() => preview(['content_1', 'content_1'])).toThrow('1–1000');
    expect(() => preview(['foreign_content'])).toThrow('1–1000');
    const p = preview(),
      sql = raw();
    sql.prepare('UPDATE schedule_previews SET payload=? WHERE token=?').run('{}', p.token);
    sql.close();
    expect(() => db.applySchedule(p.token, null, at)).toThrow('checksum');
    expect(db.listJobs().jobs).toHaveLength(0);
  });
  it('allows unassigned previews while enforcing registered device, saved version and required typed values at apply', () => {
    const process = db.getProcess(processInput.id);
    db.saveProcess({ ...process, deviceId: null, workflowVersionId: null }, process.revision);
    const unassigned = preview();
    expect(unassigned.blockers.join(' ')).toContain('Chưa gán điện thoại');
    expect(() => db.applySchedule(unassigned.token, null, at)).toThrow('Chưa chọn phiên bản');
    db.saveProcess({ ...process, revision: 1 }, 1);
    const row = db.listContent(processInput.id)[0]!;
    db.saveContent({ ...row, fields: { caption: 123 } }, row.revision);
    expect(preview().canApply).toBe(false);
    db.saveContent({ ...row, fields: { caption: 'fixed' } }, 1);
    const valid = preview(),
      sql = raw();
    sql.prepare('UPDATE devices SET enabled=0 WHERE id=?').run('device_fixture');
    sql.close();
    expect(() => db.applySchedule(valid.token, null, at)).toThrow('không còn được bật');
  });
  it('keeps a pinned workflow version when the authoring draft changes after preview', () => {
    const p = preview(),
      process = db.getProcess(processInput.id),
      draft = db.getDraft(process.workflowId!);
    draft.bundle.workflow.name = 'New draft only';
    db.saveDraft(draft.bundle, draft.revision);
    const applied = db.applySchedule(p.token, null, at),
      snapshot = db.getJob(applied.jobIds[0]!).snapshot;
    expect(snapshot.bundle.workflow.name).toBe('Schedule fixture');
  });
  it('blocks stale and foreign-host media and stores immutable fingerprints for ready sources', () => {
    const source = db.registerNativeSource({
      processId: processInput.id,
      kind: 'FOLDER',
      rootPath: dir,
      recursive: false,
      watch: false,
      hostId: 'host_fixture',
    });
    const asset = {
      relativePath: 'a.mp4',
      hash: 'a'.repeat(64),
      bytes: 10,
      mtimeMs: 1,
      kind: 'video' as const,
      probe: { status: 'READY' as const, durationSeconds: 5, width: 100, height: 100 },
    };
    db.applyScannedAsset(source.id, 'host_fixture', 0, 'scan_1', asset);
    const scanned = db.listContent(processInput.id).at(-1)!;
    db.saveContent({ ...scanned, fields: { caption: 'media' } }, scanned.revision);
    const foreign = db.previewSchedule(processInput.id, [scanned.id], 'foreign_host', at, 1);
    expect(foreign.canApply).toBe(false);
    const p = db.previewSchedule(processInput.id, [scanned.id], 'host_fixture', at, 1);
    expect(p.canApply).toBe(true);
    db.applyScannedAsset(source.id, 'host_fixture', 0, 'scan_2', {
      ...asset,
      hash: 'b'.repeat(64),
    });
    expect(() => db.applySchedule(p.token, 'host_fixture', at)).toThrow('đã đổi');
    db.applyScannedAsset(source.id, 'host_fixture', 0, 'scan_3', asset);
    const current = db.previewSchedule(processInput.id, [scanned.id], 'host_fixture', at, 1),
      applied = db.applySchedule(current.token, 'host_fixture', at);
    expect(db.getJob(applied.jobIds[0]!).snapshot.assets?.[0]?.hash).toBe(asset.hash);
    expect(() =>
      db.applySchedule(
        db.previewSchedule(processInput.id, ['content_1'], null, at, 1).token,
        null,
        '2026-10-26T00:06:00.000Z',
      ),
    ).toThrow('hết hạn');
  });
});
describe('saved job queries and safe schedule edits', () => {
  it('pages more than a thousand tied instants by stable keys without duplicates or omissions', () => {
    const applied = db.applySchedule(preview().token, null, at);
    const fixture = db.getJob(applied.jobIds[0]!);
    for (let index = 0; index < 1201; index++)
      db.createJob(
        {
          ...fixture.job,
          id: 'job_page_' + String(index).padStart(4, '0'),
          occurrenceKey: contentHash({ paging: index }),
          priority: index % 3,
        },
        fixture.snapshot,
      );
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = db.listJobs({
        processId: processInput.id,
        limit: 73,
        ...(cursor ? { cursor } : {}),
      });
      expect(page.jobs.length).toBeLessThanOrEqual(73);
      ids.push(...page.jobs.map((job) => job.id));
      cursor = page.nextCursor ?? undefined;
      expect(page.hasMore).toBe(!!cursor);
    } while (cursor);
    expect(ids).toHaveLength(1203);
    expect(new Set(ids).size).toBe(1203);
    const first = db.getJob(ids[0]!).job;
    expect(first.priority).toBe(2);
  });
  it('preserves a cursor across restart but rejects mutations from another connection, changed filters and malformed tokens', () => {
    db.applySchedule(preview().token, null, at);
    const first = db.listJobs({ limit: 1 });
    expect(first.nextCursor).toBeTruthy();
    db.close();
    db = new StudioDatabase(join(dir, 'studio.sqlite'));
    const next = db.listJobs({ limit: 1, cursor: first.nextCursor! });
    expect(next.jobs[0]!.id).not.toBe(first.jobs[0]!.id);
    expect(next.nextCursor).toBeNull();
    expect(() => db.listJobs({ cursor: first.nextCursor!, deviceId: 'other_device' })).toThrow(
      'Bộ lọc',
    );
    expect(() => db.listJobs({ cursor: '!!!!' })).toThrow('không hợp lệ');
    const other = raw();
    other
      .prepare('UPDATE jobs SET priority=priority+1,revision=revision+1 WHERE id=?')
      .run(first.jobs[0]!.id);
    other.close();
    expect(() => db.listJobs({ cursor: first.nextCursor! })).toThrow('đã thay đổi');
    expect(db.getJob(first.jobs[0]!.id).snapshotHash).toBe(first.jobs[0]!.snapshotHash);
  });
  it('filters jobs with a visible limit and uses instants for timestamp range comparisons', () => {
    db.applySchedule(preview().token, null, at);
    const result = db.listJobs({
      processId: processInput.id,
      deviceId: 'device_fixture',
      state: 'SCHEDULED',
      limit: 1,
    });
    expect(result.hasMore).toBe(true);
    expect(result.jobs).toHaveLength(1);
    const first = result.jobs[0]!;
    expect(
      db.listJobs({
        fromUtc: new Date(Date.parse(first.scheduledUtc) + 1).toISOString(),
        toUtc: new Date(Date.parse(first.scheduledUtc) + 2).toISOString(),
      }).jobs,
    ).toHaveLength(0);
    expect(
      db.listJobs({
        fromUtc: first.scheduledUtc,
        toUtc: new Date(Date.parse(first.scheduledUtc) + 1).toISOString(),
      }).jobs,
    ).toHaveLength(1);
    expect(db.listJobs({ deviceId: 'another_device' }).jobs).toHaveLength(0);
    expect(() => db.listJobs({ limit: 0 })).toThrow('Limit');
  });
  it('reschedules/cancels only scheduled jobs at the expected revision, preserving snapshot and job IDs', () => {
    const applied = db.applySchedule(preview().token, null, at),
      id = applied.jobIds[0]!,
      original = db.getJob(id);
    db.rescheduleJob(id, 0, '2026-10-28T01:00:00Z', at);
    expect(db.getJob(id)).toMatchObject({
      snapshotHash: original.snapshotHash,
      job: { id, revision: 1, scheduledUtc: '2026-10-28T01:00:00.000Z' },
    });
    expect(() => db.cancelScheduledJob(id, 0)).toThrow('thay đổi');
    db.cancelScheduledJob(id, 1);
    expect(db.getJob(id).job.state).toBe('CANCELLED');
    expect(() => db.rescheduleJob(id, 2, '2026-10-29T01:00:00Z', at)).toThrow('Chỉ sửa lịch');
    const other = applied.jobIds[1]!;
    db.transitionJob(other, 'QUEUED', 0);
    expect(() => db.cancelScheduledJob(other, 1)).toThrow('Chỉ sửa lịch');
  });
  it('rejects schedule edits after durable external intent and rejects past times', () => {
    const applied = db.applySchedule(preview().token, null, at),
      id = applied.jobIds[0]!;
    db.recordIntent(id, 'node_fixture', 'PUBLISH', contentHash('effect'), contentHash('payload'));
    expect(() => db.cancelScheduledJob(id, 0)).toThrow('external intent');
    expect(() => db.rescheduleJob(id, 0, '2026-10-28T01:00:00Z', at)).toThrow('external intent');
    expect(() => db.rescheduleJob(applied.jobIds[1]!, 0, at, at)).toThrow('tương lai');
  });
});
