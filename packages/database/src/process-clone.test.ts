import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { contentHash } from '@autoreels/domain';
import type { ProcessCloneOptions, ProcessDefinition, ScannedAsset } from '@autoreels/contracts';
import { StudioDatabase } from './index.js';

let dir: string, db: StudioDatabase;
const host = 'host_clone_fixture',
  at = '2026-10-27T00:00:00.000Z';
const options: ProcessCloneOptions = {
  name: 'Cloned Process',
  includeContent: true,
  includeSources: true,
  keepDevice: false,
};
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'autoreels-clone-'));
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
function raw() {
  return new DatabaseSync(join(dir, 'studio.sqlite'));
}
function scanned(relativePath = 'clip.mp4'): ScannedAsset {
  return {
    relativePath,
    hash: contentHash(relativePath),
    bytes: 10,
    mtimeMs: 123,
    kind: 'video',
    probe: { status: 'READY', durationSeconds: 1, width: 100, height: 200 },
  };
}
function fixture() {
  db.registerObservedDevice('phone_clone', 'Clone fixture phone');
  const sql = raw();
  sql
    .prepare('INSERT INTO identities VALUES(?,?,?,?,?)')
    .run('identity_clone', 'fb', 'phone_clone', 'account', 'fixture_identity');
  sql.close();
  const draft = db.createWorkflow('fb', 'Clone fixture workflow');
  draft.bundle.inputs = [
    { key: 'caption', type: 'text', scope: 'row', required: true },
    { key: 'zero', type: 'number', scope: 'row', required: false },
    { key: 'flag', type: 'boolean', scope: 'row', required: false },
    { key: 'tags', type: 'list', itemType: 'text', scope: 'row', required: false },
    { key: 'owner', type: 'identity', scope: 'row', required: false },
    { key: 'limit', type: 'number', scope: 'process', required: false },
    { key: 'library', type: 'file[]', scope: 'process', required: false },
    { key: 'apiToken', type: 'text', scope: 'process', required: false },
  ];
  db.saveDraft(draft.bundle, 0);
  const version = db.createVersion(draft.workflowId, 1);
  const process: ProcessDefinition = {
    id: 'process_clone_source',
    name: 'Clone original',
    appId: 'fb',
    workflowId: draft.workflowId,
    workflowVersionId: version.id,
    deviceId: 'phone_clone',
    accountId: 'identity_clone',
    targetId: null,
    revision: 0,
    archived: false,
    schedule: {
      timezone: 'Asia/Ho_Chi_Minh',
      startDate: '2035-01-01',
      slots: ['08:00'],
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      overduePolicy: 'NEXT_FUTURE_SLOT',
      jitterMinutes: 0,
    },
  };
  db.saveProcess(process, null);
  const source = db.registerNativeSource({
    processId: process.id,
    kind: 'FOLDER',
    rootPath: dir,
    hostId: host,
    recursive: false,
    watch: false,
  });
  db.applyScannedAsset(source.id, host, source.revision, 'first', scanned());
  const row = db.listContent(process.id)[0]!;
  db.saveContentValidated(
    {
      ...row,
      fields: {
        caption: 'Typed caption',
        zero: 0,
        flag: false,
        tags: ['first\nmultiline', 'second'],
        owner: { identityId: 'identity_clone' },
      },
    },
    row.revision,
  );
  const saved = db.saveProcess(
    {
      ...process,
      fields: {
        limit: 0,
        library: [{ assetId: row.assetIds[0]! }],
        apiToken: 'fixture-private-value',
      },
    },
    process.revision,
  );
  db.createJob(
    {
      id: 'job_clone_original',
      processId: process.id,
      deviceId: 'phone_clone',
      contentId: row.id,
      occurrenceKey: contentHash('clone original job'),
      scheduledUtc: '2035-01-01T01:00:00.000Z',
      state: 'SCHEDULED',
      revision: 0,
      priority: 0,
    },
    {
      workflowVersionId: version.id,
      workflowHash: version.hash,
      bundle: version.bundle,
      contentId: row.id,
      fields: db.listContent(process.id)[0]!.fields,
      assetIds: row.assetIds,
      targetId: null,
      networkProfileId: null,
    },
  );
  return { process: saved, source, row: db.listContent(process.id)[0]!, draft };
}
describe('Process clone preview and immutable media references', () => {
  it('keeps ordered multi-asset refs and independent source/ignore ledgers through reconciliation', () => {
    const original = fixture();
    db.applyScannedAsset(
      original.source.id,
      host,
      original.source.revision,
      'more',
      scanned('second.mp4'),
    );
    db.applyScannedAsset(
      original.source.id,
      host,
      original.source.revision,
      'more',
      scanned('ignored.mp4'),
    );
    const rows = db.listContent(original.process.id),
      second = rows.find((r) => r.id !== original.row.id && r.fields.caption === 'second')!;
    const ignored = rows.find((r) => r.fields.caption === 'ignored')!;
    db.ignoreContent(ignored.id, ignored.revision);
    const order = [second.assetIds[0]!, original.row.assetIds[0]!];
    db.saveContentValidated({ ...original.row, assetIds: order }, original.row.revision);
    const preview = db.previewProcessClone(
      original.process.id,
      original.process.revision,
      options,
      host,
      at,
    );
    const clone = db.applyProcessClone(preview.token, host, at),
      copied = db.listContent(clone.process.id);
    expect(copied).toHaveLength(2);
    expect(copied[0]!.assetIds).toEqual(order);
    const source = db.listSources(clone.process.id, host)[0]!;
    expect(db.applyScannedAsset(source.id, host, source.revision, 'rescan', scanned())).toBe(
      'unchanged',
    );
    expect(
      db.applyScannedAsset(source.id, host, source.revision, 'rescan', scanned('second.mp4')),
    ).toBe('unchanged');
    expect(
      db.applyScannedAsset(source.id, host, source.revision, 'rescan', scanned('ignored.mp4')),
    ).toBe('ignored');
    expect(db.listContent(clone.process.id).map((r) => r.id)).toEqual(copied.map((r) => r.id));
    const schema = db.inputSchema(clone.process)!.inputs.filter((f) => f.scope === 'row');
    const imported = db.previewContentImport(
      clone.process.id,
      clone.process.revision,
      {
        records: [
          {
            sourceId: source.id,
            relativePath: 'second.mp4',
            fields: { caption: 'Matched clone source' },
          },
        ],
        conversions: [],
      },
      contentHash(schema),
      at,
    );
    // The same asset is deliberately attached to two rows, so relative-path matching must stay ambiguous.
    expect(imported.canApply).toBe(false);
    const exact = db.previewContentImport(
      clone.process.id,
      clone.process.revision,
      {
        records: [
          {
            contentId: copied[1]!.id,
            sourceId: source.id,
            relativePath: 'second.mp4',
            fields: { caption: 'Exact clone ID' },
          },
        ],
        conversions: [],
      },
      contentHash(schema),
      at,
    );
    expect(exact.canApply).toBe(true);
  });
  it('invalidates preview after Process or draft-schema changes while pinned schema remains immutable', () => {
    const original = fixture();
    const preview = db.previewProcessClone(
      original.process.id,
      original.process.revision,
      options,
      host,
      at,
    );
    const process = db.saveProcess(
      { ...original.process, workflowVersionId: null },
      original.process.revision,
    );
    expect(() => db.applyProcessClone(preview.token, host, at)).toThrow('đã đổi');
    const draftPreview = db.previewProcessClone(process.id, process.revision, options, host, at);
    const draft = db.getDraft(original.draft.workflowId);
    draft.bundle.inputs.push({ key: 'newField', type: 'text', scope: 'row', required: false });
    db.saveDraft(draft.bundle, draft.revision);
    expect(() => db.applyProcessClone(draftPreview.token, host, at)).toThrow('đã đổi');
  });
  it('creates distinct IDs, preserves typed values/media order, removes identities/secrets and never copies jobs', () => {
    const original = fixture();
    const preview = db.previewProcessClone(
      original.process.id,
      original.process.revision,
      options,
      host,
      at,
    );
    expect(preview).toMatchObject({
      contentCount: 1,
      assetCount: 1,
      sourceCount: 1,
      keepDevice: false,
    });
    expect(preview.removedFields.map((field) => field.key)).toEqual(
      expect.arrayContaining(['owner', 'apiToken']),
    );
    const sql = raw();
    expect(
      String(
        sql.prepare('SELECT payload FROM process_clone_previews WHERE token=?').get(preview.token)!
          .payload,
      ),
    ).not.toContain('fixture-private-value');
    sql.close();
    const result = db.applyProcessClone(preview.token, host, at),
      cloned = db.listContent(result.process.id)[0]!;
    expect(result.process).toMatchObject({
      deviceId: null,
      accountId: null,
      targetId: null,
      archived: false,
      fields: { limit: 0, library: [{ assetId: original.row.assetIds[0] }] },
    });
    expect(result.process.fields).not.toHaveProperty('apiToken');
    expect(cloned.id).not.toBe(original.row.id);
    expect(cloned.fields).toEqual({
      caption: 'Typed caption',
      zero: 0,
      flag: false,
      tags: ['first\nmultiline', 'second'],
    });
    expect(cloned.assetIds).toEqual(original.row.assetIds);
    expect(db.listJobs({ processId: result.process.id }).jobs).toEqual([]);
    expect(db.getJob('job_clone_original').snapshot.contentId).toBe(original.row.id);
    const cloneSource = db.listSources(result.process.id, host)[0]!;
    expect(cloneSource.id).not.toBe(original.source.id);
    expect(db.getSourceGrant(cloneSource.id, host).processId).toBe(result.process.id);
    expect(db.listContentAssets(result.process.id)[0]!.state).toBe('READY');
    db.saveProcess({ ...original.process, archived: true }, original.process.revision);
    const assigned = db.saveProcess(
      { ...result.process, deviceId: 'phone_clone' },
      result.process.revision,
    );
    expect(db.previewSchedule(assigned.id, [cloned.id], host, at, 1).canApply).toBe(true);
  });
  it('persists idempotency across restart and ignores harmless scan generation changes', () => {
    const { process, source } = fixture();
    const preview = db.previewProcessClone(process.id, process.revision, options, host, at);
    db.applyScannedAsset(source.id, host, source.revision, 'heartbeat_only', scanned());
    const first = db.applyProcessClone(preview.token, host, at);
    db.close();
    db = new StudioDatabase(join(dir, 'studio.sqlite'));
    const again = db.applyProcessClone(preview.token, host, '2040-01-01T00:00:00.000Z');
    expect(again).toEqual({ ...first, alreadyApplied: true });
    expect(db.listProcesses()).toHaveLength(2);
    expect(() => db.applyProcessClone(preview.token, 'host_other', at)).toThrow('host');
  });
  it('rejects expired/stale content, observed media changes and tampered preview data without partial clones', () => {
    const { process, source, row } = fixture();
    const expired = db.previewProcessClone(process.id, process.revision, options, host, at);
    expect(() => db.applyProcessClone(expired.token, host, expired.expiresAt)).toThrow('hết hạn');
    const stale = db.previewProcessClone(process.id, process.revision, options, host, at);
    db.saveContentValidated(
      { ...row, fields: { ...row.fields, caption: 'Changed' } },
      row.revision,
    );
    expect(() => db.applyProcessClone(stale.token, host, at)).toThrow('đã đổi');
    const media = db.previewProcessClone(process.id, process.revision, options, host, at);
    db.applyScannedAsset(source.id, host, source.revision, 'new_bytes', {
      ...scanned(),
      hash: contentHash('different bytes'),
    });
    expect(() => db.applyProcessClone(media.token, host, at)).toThrow('đã đổi');
    const tampered = db.previewProcessClone(process.id, process.revision, options, host, at);
    const sql = raw();
    sql
      .prepare('UPDATE process_clone_previews SET payload=? WHERE token=?')
      .run('{}', tampered.token);
    sql.close();
    expect(() => db.applyProcessClone(tampered.token, host, at)).toThrow('Checksum');
    expect(db.listProcesses()).toHaveLength(1);
  });
  it('rolls back process/content/source creation on failure and can safely apply the same token after correction', () => {
    const { process } = fixture();
    const preview = db.previewProcessClone(process.id, process.revision, options, host, at);
    const sql = raw();
    sql.exec(
      "CREATE TRIGGER clone_failure BEFORE INSERT ON content_items WHEN NEW.process_id<>'process_clone_source' BEGIN SELECT RAISE(ABORT,'clone fixture failure'); END;",
    );
    expect(() => db.applyProcessClone(preview.token, host, at)).toThrow('clone fixture failure');
    expect(db.listProcesses()).toHaveLength(1);
    expect(
      sql.prepare('SELECT result FROM process_clone_previews WHERE token=?').get(preview.token)!
        .result,
    ).toBeNull();
    sql.exec('DROP TRIGGER clone_failure');
    sql.close();
    expect(db.applyProcessClone(preview.token, host, at).contentIds).toHaveLength(1);
  });
  it('does not turn media metadata or foreign-host sources into permission to schedule files', () => {
    const { process } = fixture();
    const without = db.previewProcessClone(
      process.id,
      process.revision,
      { ...options, includeSources: false, keepDevice: true },
      host,
      at,
    );
    const result = db.applyProcessClone(without.token, host, at);
    expect(db.listContentAssets(result.process.id)[0]!.state).toBe('UNTRACKED');
    expect(db.previewSchedule(result.process.id, result.contentIds, host, at, 1).canApply).toBe(
      false,
    );
    const foreign = db.previewProcessClone(
      process.id,
      process.revision,
      { ...options, keepDevice: true },
      'host_foreign',
      at,
    );
    const cloned = db.applyProcessClone(foreign.token, 'host_foreign', at);
    expect(db.listSources(cloned.process.id, 'host_foreign')[0]!.requiresRebind).toBe(true);
    expect(
      db.previewSchedule(cloned.process.id, cloned.contentIds, 'host_foreign', at, 1).canApply,
    ).toBe(false);
  });
  it('supports configuration-only copies without retaining unusable file references', () => {
    const { process } = fixture();
    const preview = db.previewProcessClone(
      process.id,
      process.revision,
      { ...options, includeContent: false, includeSources: false },
      host,
      at,
    );
    const cloned = db.applyProcessClone(preview.token, host, at);
    expect(cloned.contentIds).toEqual([]);
    expect(cloned.process.fields).toEqual({ limit: 0 });
    expect(() =>
      db.previewProcessClone(
        process.id,
        process.revision,
        { ...options, includeContent: false },
        host,
        at,
      ),
    ).toThrow();
  });
});
