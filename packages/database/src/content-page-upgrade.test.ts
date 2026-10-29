import { beforeEach, afterEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SEED_APPS, type ProcessDefinition } from '@autoreels/contracts';
import { contentHash } from '@autoreels/domain';
import { StudioDatabase } from './index.js';
import { migrations, SCHEMA_VERSION } from './schema.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'autoreels-v13-to-v20-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

it('upgrades P08 schema13 through content epoch and cleanup-review schema20 without historical data loss', () => {
  const path = join(dir, 'studio.sqlite');
  const legacy = new DatabaseSync(path);
  legacy.exec('PRAGMA foreign_keys=ON;');
  for (const item of migrations.filter((m) => m.version <= 13)) {
    legacy.exec('BEGIN IMMEDIATE');
    legacy.exec(item.sql);
    legacy.prepare('INSERT INTO schema_migrations VALUES(?,?)')
      .run(item.version, contentHash(item.sql));
    if (item.version === 1)
      for (const app of SEED_APPS)
        legacy.prepare('INSERT INTO apps VALUES(?,?)')
          .run(app.id, JSON.stringify(app));
    legacy.exec('PRAGMA user_version=' + item.version);
    legacy.exec('COMMIT');
  }
  legacy.prepare('INSERT INTO devices(id,name,enabled) VALUES(?,?,?)')
    .run('device_historical', 'Historically registered', 0);
  legacy.prepare(
    'INSERT INTO device_profiles(device_id,fingerprint,metadata,identity,revision) VALUES(?,?,?,?,?)',
  ).run('device_historical', 'a'.repeat(64), null, 'CONFLICT', 2);
  legacy.prepare(
    'INSERT INTO device_resolution_audit(id,device_id,host_id,previous_revision,new_revision,proof_hash,created_at) VALUES(?,?,?,?,?,?,?)',
  ).run(
    'deviceResolutionAudit_legacy', 'device_historical', 'host_secret', 1, 2,
    'b'.repeat(64), '2026-10-28T00:00:00.000Z',
  );
  const baselineChecksums = legacy.prepare(
    'SELECT version,checksum FROM schema_migrations WHERE version<=13 ORDER BY version',
  ).all();
  expect(legacy.prepare('PRAGMA user_version').get()?.user_version).toBe(13);
  legacy.close();

  const db = new StudioDatabase(path);
  try {
    expect(SCHEMA_VERSION).toBe(20);
    const history = db.deviceResolutionHistory('device_historical');
    expect(history.entries).toHaveLength(1);
    expect(history.entries[0]).toMatchObject({
      id: 'deviceResolutionAudit_legacy', previousRevision: 1, newRevision: 2,
    });
    expect(db.listDeviceRecords('host_secret')[0]).toMatchObject({
      id: 'device_historical', identity: 'CONFLICT', enabled: false,
    });
    const workflow = db.createWorkflow('fb', 'After safe migration');
    const p: ProcessDefinition = {
      id: 'process_after_migration',
      name: 'Content after recovery schema',
      appId: 'fb',
      workflowId: workflow.workflowId,
      workflowVersionId: null,
      deviceId: null,
      accountId: null,
      targetId: null,
      revision: 0,
      archived: false,
      schedule: {
        timezone: 'Asia/Ho_Chi_Minh',
        startDate: '2026-10-28',
        slots: ['08:00'],
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        overduePolicy: 'NEXT_FUTURE_SLOT',
        jitterMinutes: 0,
      },
    };
    db.saveProcess(p, null);
    db.saveContent({
      id: 'content_after_migration',
      processId: p.id,
      revision: 0,
      fields: { caption: 'safe paging' },
      assetIds: [],
      ignored: false,
    }, null);
    const page = db.listContentPage({ processId: p.id, limit: 10 });
    expect(page).toMatchObject({ total: 1, hasMore: false, nextCursor: null });
    expect(page.items[0]).toMatchObject({
      id: 'content_after_migration', fields: { caption: 'safe paging' },
    });
  } finally {
    db.close();
  }
  const check = new DatabaseSync(path, { readOnly: true });
  expect(check.prepare('PRAGMA user_version').get()?.user_version).toBe(20);
  expect(
    check.prepare('SELECT version,checksum FROM schema_migrations WHERE version<=13 ORDER BY version')
      .all(),
  ).toEqual(baselineChecksums);
  expect(check.prepare("SELECT revision FROM query_epochs WHERE name='content'").get()?.revision)
    .toBeGreaterThan(0);
  expect(check.prepare('SELECT COUNT(*) AS n FROM device_resolution_audit').get()?.n).toBe(1);
  expect(check.prepare('SELECT COUNT(*) AS n FROM device_stage_transfers').get()?.n).toBe(0);
  check.close();

  const again = new StudioDatabase(path);
  try {
    expect(again.deviceResolutionHistory('device_historical').entries).toHaveLength(1);
    expect(again.listContentPage({ processId: 'process_after_migration' }).total).toBe(1);
  } finally {
    again.close();
  }
  // This verifies migration fidelity, not a throughput SLA. A shared Windows
  // CI runner may take >10s to apply/check 20 SQLite schema versions.
}, 30000);
