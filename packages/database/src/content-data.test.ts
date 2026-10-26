import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { contentHash } from '@autoreels/domain';
import type {
  ContentImportDocument,
  ContentImportRecord,
  ProcessDefinition,
} from '@autoreels/contracts';
import { StudioDatabase } from './index.js';

let db: StudioDatabase, dir: string, process: ProcessDefinition;
const at = '2026-10-26T00:00:00.000Z';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'autoreels-content-data-'));
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  const draft = db.createWorkflow('fb', 'Data fixture');
  draft.bundle.inputs = [
    { key: 'caption', type: 'text', scope: 'row', required: true },
    { key: 'count', type: 'number', scope: 'row', required: false },
    { key: 'enabled', type: 'boolean', scope: 'row', required: false },
    { key: 'comments', type: 'list', itemType: 'text', scope: 'row', required: false },
  ];
  db.saveDraft(draft.bundle, 0);
  process = db.saveProcess(
    {
      id: 'process_data',
      name: 'Data fixture',
      appId: 'fb',
      workflowId: draft.workflowId,
      workflowVersionId: null,
      deviceId: null,
      accountId: null,
      targetId: null,
      revision: 0,
      archived: false,
      schedule: {
        timezone: 'Asia/Ho_Chi_Minh',
        startDate: '2026-10-26',
        slots: ['08:00'],
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        overduePolicy: 'NEXT_FUTURE_SLOT',
        jitterMinutes: 0,
      },
    },
    null,
  );
  for (const id of ['content_1', 'content_2'])
    db.saveContentValidated(
      {
        id,
        processId: process.id,
        revision: 0,
        fields: { caption: id, count: 1, comments: ['one\nmultiline'] },
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
function preview(records: ContentImportRecord[], extra: Partial<ContentImportDocument> = {}) {
  return db.previewContentImport(
    process.id,
    db.getProcess(process.id).revision,
    { records, conversions: [], ...extra },
    contentHash(db.inputSchema(db.getProcess(process.id))!.inputs.filter((f) => f.scope === 'row')),
    at,
  );
}
const row = (id = 'content_1') => db.listContent(process.id).find((r) => r.id === id)!;
function raw() {
  return new DatabaseSync(join(dir, 'studio.sqlite'));
}

describe('content proposals', () => {
  it('previews without writes, patches only present fields, creates text content and reapplies idempotently across restart', () => {
    const p = preview([
      {
        contentId: 'content_1',
        fields: { count: 0, enabled: false, caption: '', comments: ['a\nb', 'c'] },
      },
      { fields: { caption: 'new text' } },
    ]);
    expect(p.canApply).toBe(true);
    expect(p.changes[0]!.deltas).toContainEqual({
      key: 'count',
      beforePresent: true,
      afterPresent: true,
      before: 1,
      after: 0,
    });
    expect(row().fields.caption).toBe('content_1');
    expect(db.listContent(process.id)).toHaveLength(2);
    const createdId = p.changes[1]!.contentId!;
    const result = db.applyContentPreview(p.token, at);
    expect(result).toMatchObject({ created: 1, updated: 1, alreadyApplied: false });
    expect(row().fields).toEqual({
      count: 0,
      enabled: false,
      caption: '',
      comments: ['a\nb', 'c'],
    });
    expect(row(createdId).fields).toEqual({ caption: 'new text' });
    db.close();
    db = new StudioDatabase(join(dir, 'studio.sqlite'));
    expect(db.applyContentPreview(p.token, '2027-01-01T00:00:00Z')).toEqual({
      ...result,
      alreadyApplied: true,
    });
    expect(row().revision).toBe(1);
    expect(db.listContent(process.id)).toHaveLength(3);
  });
  it('treats explicit wrong ID as an error even when another selector matches, and rejects duplicate targets/scope', () => {
    const wrong = preview([
      { contentId: 'missing_content', filename: 'a.mp4', fields: { caption: 'wrong' } },
    ]);
    expect(wrong.canApply).toBe(false);
    expect(wrong.changes[0]!.errors.join('')).toContain('không fallback');
    expect(() => db.applyContentPreview(wrong.token, at)).toThrow('Sửa các lỗi');
    const duplicate = preview([
      { contentId: 'content_1', fields: { caption: 'first' } },
      { contentId: 'content_1', fields: { caption: 'second' } },
    ]);
    expect(duplicate.canApply).toBe(false);
    expect(() => db.applyContentPreview(duplicate.token, at)).toThrow();
    expect(row().fields.caption).toBe('content_1');
    expect(() => preview([{ fields: { caption: 'x' } }], { processId: 'other_process' })).toThrow(
      'khác',
    );
    const unsafe = JSON.parse('{"__proto__":true}') as Record<string, never>;
    expect(() => preview([{ fields: unsafe }])).toThrow();
  });
  it('uses registered relative paths and reports ambiguous basenames before mutation', () => {
    const source = db.registerNativeSource({
      processId: process.id,
      kind: 'FOLDER',
      rootPath: dir,
      recursive: true,
      watch: false,
      hostId: 'host_fixture',
    });
    for (const path of ['one/a.mp4', 'two/a.mp4'])
      db.applyScannedAsset(source.id, 'host_fixture', 0, 'scan_fixture', {
        relativePath: path,
        hash: contentHash(path),
        bytes: 1,
        mtimeMs: 1,
        kind: 'video',
        probe: { status: 'UNAVAILABLE', reason: 'fixture' },
      });
    const ambiguous = preview([{ filename: 'a.mp4', fields: { caption: 'ambiguous' } }]);
    expect(ambiguous.canApply).toBe(false);
    const matched = preview([
      { sourceId: source.id, relativePath: 'one/a.mp4', fields: { caption: 'matched' } },
    ]);
    expect(matched.canApply).toBe(true);
    db.applyContentPreview(matched.token, at);
    expect(db.listContent(process.id).filter((r) => r.fields.caption === 'matched')).toHaveLength(
      1,
    );
  });
  it('rejects stale rows, schema, expired and tampered proposals without partial writes', () => {
    const stale = preview([{ contentId: 'content_1', fields: { caption: 'import' } }]);
    db.saveContentValidated({ ...row(), fields: { ...row().fields, caption: 'edited' } }, 0);
    expect(() => db.applyContentPreview(stale.token, at)).toThrow('đã đổi');
    const schemaChanged = preview([{ contentId: 'content_1', fields: { caption: 'import' } }]),
      draft = db.getDraft(process.workflowId!);
    draft.bundle.inputs.push({ key: 'new_field', type: 'text', scope: 'row', required: false });
    db.saveDraft(draft.bundle, draft.revision);
    expect(() => db.applyContentPreview(schemaChanged.token, at)).toThrow('đã đổi');
    const expired = preview([{ contentId: 'content_1', fields: { caption: 'import' } }]);
    expect(() => db.applyContentPreview(expired.token, expired.expiresAt)).toThrow('hết hạn');
    const tampered = preview([{ contentId: 'content_1', fields: { caption: 'import' } }]),
      sql = raw();
    sql
      .prepare('UPDATE content_change_previews SET payload=? WHERE token=?')
      .run('{}', tampered.token);
    sql.close();
    expect(() => db.applyContentPreview(tampered.token, at)).toThrow('Checksum');
    expect(row().fields.caption).toBe('edited');
  });
  it('rolls back every row and persisted result when the second insert fails, then applies the original proposal safely', () => {
    const p = preview([
        { contentId: 'content_1', fields: { caption: 'first' } },
        { contentId: 'content_2', fields: { caption: 'second' } },
      ]),
      sql = raw();
    sql.exec(
      "CREATE TRIGGER fixture_fail BEFORE UPDATE ON content_items WHEN NEW.id='content_2' BEGIN SELECT RAISE(ABORT,'fixture failure'); END;",
    );
    expect(() => db.applyContentPreview(p.token, at)).toThrow('fixture failure');
    expect(row().fields.caption).toBe('content_1');
    expect(row().revision).toBe(0);
    expect(
      sql.prepare('SELECT result FROM content_change_previews WHERE token=?').get(p.token)?.result,
    ).toBeNull();
    sql.exec('DROP TRIGGER fixture_fail');
    sql.close();
    expect(db.applyContentPreview(p.token, at).updated).toBe(2);
  });
  it('keeps sparse omitted values and applies nothing when one row has a type/ref error', () => {
    const invalid = preview([
      { contentId: 'content_1', fields: { count: 0 } },
      { contentId: 'content_2', fields: { count: 'not a number' } },
    ]);
    expect(invalid.canApply).toBe(false);
    expect(() => db.applyContentPreview(invalid.token, at)).toThrow();
    expect(row().fields.count).toBe(1);
    const valid = preview([{ contentId: 'content_1', fields: { count: 0 } }]);
    db.applyContentPreview(valid.token, at);
    expect(row().fields.caption).toBe('content_1');
    expect(row().fields.count).toBe(0);
  });
});
describe('bulk typed content', () => {
  it('appends/prepends list values without splitting multiline items and removes optional values explicitly', () => {
    let r = row();
    let p = db.previewBulkContent(
      process.id,
      0,
      {
        selection: [{ id: r.id, revision: r.revision }],
        fieldKey: 'comments',
        operation: 'APPEND',
        value: ['two'],
      },
      at,
    );
    db.applyContentPreview(p.token, at);
    expect(row().fields.comments).toEqual(['one\nmultiline', 'two']);
    r = row();
    p = db.previewBulkContent(
      process.id,
      0,
      {
        selection: [{ id: r.id, revision: r.revision }],
        fieldKey: 'comments',
        operation: 'PREPEND',
        value: ['zero'],
      },
      at,
    );
    db.applyContentPreview(p.token, at);
    expect(row().fields.comments).toEqual(['zero', 'one\nmultiline', 'two']);
    r = row();
    p = db.previewBulkContent(
      process.id,
      0,
      { selection: [{ id: r.id, revision: r.revision }], fieldKey: 'count', operation: 'REMOVE' },
      at,
    );
    db.applyContentPreview(p.token, at);
    expect(Object.hasOwn(row().fields, 'count')).toBe(false);
    expect(
      db.previewBulkContent(
        process.id,
        0,
        {
          selection: [{ id: r.id, revision: row().revision }],
          fieldKey: 'caption',
          operation: 'REMOVE',
        },
        at,
      ).canApply,
    ).toBe(false);
    expect(() =>
      db.previewBulkContent(
        process.id,
        0,
        {
          selection: [{ id: r.id, revision: 0 }],
          fieldKey: 'caption',
          operation: 'SET',
          value: 'new',
        },
        at,
      ),
    ).toThrow('đã đổi');
  });
  it('exports only explicit IDs and refuses foreign IDs/duplicate scope without truncation', () => {
    expect(db.exportContent(process.id, ['content_2']).rows.map((r) => r.contentId)).toEqual([
      'content_2',
    ]);
    expect(() => db.exportContent(process.id, ['content_1', 'foreign'])).toThrow('đúng tiến trình');
    expect(() => db.exportContent(process.id, ['content_1', 'content_1'])).toThrow();
  });
  it('reports affected jobs while leaving their immutable snapshots intact after an edit', () => {
    db.registerObservedDevice('device_fixture', 'Fixture');
    const draft = db.getDraft(process.workflowId!),
      version = db.createVersion(draft.workflowId, draft.revision);
    process = db.saveProcess(
      { ...process, deviceId: 'device_fixture', workflowVersionId: version.id },
      0,
    );
    const scheduled = db.applySchedule(
        db.previewSchedule(process.id, ['content_1'], null, at, 1).token,
        null,
        at,
      ),
      job = db.getJob(scheduled.jobIds[0]!);
    const p = preview([
      { contentId: 'content_1', fields: { caption: 'changed after scheduling' } },
    ]);
    expect(p.impactedJobIds).toEqual(scheduled.jobIds);
    db.applyContentPreview(p.token, at);
    expect(db.getJob(job.job.id).snapshotHash).toBe(job.snapshotHash);
    expect(db.getJob(job.job.id).snapshot.fields.caption).toBe('content_1');
  });
});
