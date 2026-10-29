import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudioDatabase } from './index.js';
import type { ProcessDefinition } from '@autoreels/contracts';

let dir: string, db: StudioDatabase;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'autoreels-process-input-'));
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
});
afterEach(() => {
  db.close();
  rmSync(dir, { force: true, recursive: true });
});
function fixture(): ProcessDefinition {
  const draft = db.createWorkflow('fb', 'Process typed inputs');
  draft.bundle.inputs = [
    { key: 'caption', type: 'text', scope: 'row', required: true },
    { key: 'limit', type: 'number', scope: 'process', required: true },
    { key: 'enabled', type: 'boolean', scope: 'process', required: true },
    { key: 'comments', type: 'list', itemType: 'text', scope: 'process', required: false },
  ];
  db.saveDraft(draft.bundle, 0);
  const version = db.createVersion(draft.workflowId, 1);
  db.registerObservedDevice('device_fixture', 'Device fixture');
  const p = db.saveProcess(
    {
      id: 'process_inputs',
      name: 'Inputs',
      appId: 'fb',
      workflowId: draft.workflowId,
      workflowVersionId: version.id,
      deviceId: 'device_fixture',
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
  db.saveContentValidated(
    {
      id: 'content_1',
      processId: p.id,
      revision: 0,
      fields: { caption: 'caption' },
      assetIds: [],
      ignored: false,
    },
    null,
  );
  return p;
}
it('preserves legacy records without inputs, allows draft missing values and blocks runnable scheduling until complete', () => {
  const p = fixture();
  expect(Object.hasOwn(p, 'fields')).toBe(false);
  const preview = db.previewSchedule(p.id, ['content_1'], null, '2026-10-26T00:00:00Z', 1);
  expect(preview.canApply).toBe(false);
  expect(preview.blockers.join(' ')).toContain('limit');
  db.close();
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(Object.hasOwn(db.getProcess(p.id), 'fields')).toBe(false);
});
it('rejects invalid types/unknown scope/unsafe JSON and freezes 0/false/ordered multiline values into job snapshots', () => {
  const p = fixture();
  for (const fields of [{ limit: '0' }, { caption: 'wrong scope' }, { unknown: true }])
    expect(() => db.saveProcess({ ...p, fields }, 0)).toThrow();
  const unsafe = JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, never>;
  expect(() => db.saveProcess({ ...p, fields: unsafe }, 0)).toThrow();
  const fields = { limit: 0, enabled: false, comments: ['one\nmultiline', 'two'] };
  const saved = db.saveProcess({ ...p, fields }, 0);
  const at = '2026-10-26T00:00:00Z',
    preview = db.previewSchedule(p.id, ['content_1'], null, at, 1);
  expect(preview.canApply).toBe(true);
  const applied = db.applySchedule(preview.token, null, at),
    snapshot = db.getJob(applied.jobIds[0]!);
  expect(snapshot.snapshot.processFields).toEqual(fields);
  db.saveProcess({ ...saved, fields: { limit: 5, enabled: true } }, saved.revision);
  expect(db.getJob(applied.jobIds[0]!).snapshotHash).toBe(snapshot.snapshotHash);
  db.close();
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  expect(db.getJob(applied.jobIds[0]!).snapshot.processFields).toEqual(fields);
});
it('rejects forged Process media and identity references without changing the saved values', () => {
  const p = fixture(),
    draft = db.getDraft(p.workflowId!);
  draft.bundle.inputs.push(
    { key: 'media', type: 'file', scope: 'process', required: false },
    { key: 'identity', type: 'identity', scope: 'process', required: false },
  );
  db.saveDraft(draft.bundle, draft.revision);
  const version = db.createVersion(draft.workflowId, draft.revision + 1);
  const updated = db.saveProcess({ ...p, workflowVersionId: version.id }, 0);
  expect(() =>
    db.saveProcess({ ...updated, fields: { media: { assetId: 'asset_foreign' } } }, 1),
  ).toThrow('tiến trình');
  expect(() =>
    db.saveProcess({ ...updated, fields: { identity: { identityId: 'identity_foreign' } } }, 1),
  ).toThrow('Tài khoản');
  expect(db.getProcess(p.id).revision).toBe(1);
});
