// Isolated host/real DB-worker integration. The picker is a test adapter, never a public path API.
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { DbClient } from '../apps/desktop/dist/host/host/db-client.js';
import { HostMediaService, loadHostId } from '../apps/desktop/dist/host/host/media-service.js';

const directory = await mkdtemp(join(tmpdir(), 'autoreels-worker-media-'));
const db = new DbClient(join(directory, 'studio.sqlite'));
const filename = join(directory, 'ảnh tiếng Việt.png');
await writeFile(
  filename,
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZK0AAAAASUVORK5CYII=',
    'base64',
  ),
);
const media = new HostMediaService(db, await loadHostId(directory), async () => [filename]);
try {
  const process = await db.request('saveProcess', {
    expectedRevision: null,
    process: {
      id: 'process_smoke',
      name: 'Worker media fixture',
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
        slots: ['08:00'],
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        overduePolicy: 'NEXT_FUTURE_SLOT',
        jitterMinutes: 0,
      },
    },
  });
  const selected = await media.request('chooseSource', {
    processId: process.id,
    expectedRevision: process.revision,
    kind: 'FILE',
    recursive: false,
    watch: false,
  });
  const source = selected.sources[0];
  await media.coordinator.idle(source.id);
  assert.equal(media.coordinator.progress(source.id).status, 'COMPLETED');
  const rows = await media.request('content', { processId: process.id });
  assert.equal(rows.length, 1);
  const assets = await media.request('contentAssets', { processId: process.id });
  assert.equal(assets[0].relativePath, 'ảnh tiếng Việt.png');
  await media.request('ignoreContent', { id: rows[0].id, expectedRevision: rows[0].revision });
  await media.request('scanSource', { id: source.id });
  await media.coordinator.idle(source.id);
  assert.equal(media.coordinator.progress(source.id).ignored, 1);
  assert.equal((await media.request('content', { processId: process.id })).length, 0);
  assert.ok((await readFile(filename)).length);
  await assert.rejects(db.request('source.register', { rootPath: directory }));
  console.log(
    JSON.stringify({
      scope: 'HOST_MEDIA_WORKER_SMOKE',
      nativePicker: 'TEST_ADAPTER',
      actualFilesystem: true,
      privateWorkerGrant: true,
      scanIgnoreRescan: true,
      publicGrantRejected: true,
      hardware: 'NOT_RUN',
    }),
  );
} finally {
  await media.close();
  await db.close();
  await rm(directory, { recursive: true, force: true });
}
