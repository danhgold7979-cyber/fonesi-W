import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { ContentItem, ProcessDefinition } from '@autoreels/contracts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { StudioDatabase } from '../../packages/database/dist/index.js';
import { fingerprint } from '../../packages/media/dist/index.js';
import { loadHostId } from '../../apps/desktop/dist/host/host/media-service.js';

async function request<T>(page: Page, command: string, input: unknown): Promise<T> {
  const origin = new URL(page.url()).origin;
  const token = await page.locator('meta[name="studio-token"]').getAttribute('content');
  const response = await page.request.post(origin + '/api', {
    headers: { Origin: origin, 'X-Studio-Token': token! },
    data: { operationId: 'op_media_ui', command, input },
  });
  const result = (await response.json()) as { ok: boolean; value: T; error?: unknown };
  expect(result.ok, JSON.stringify(result.error)).toBe(true);
  return result.value;
}
let directory: string, child: ChildProcess, oldAssetId: string, contentId: string;
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'autoreels-adoption-ui-'));
  const hostId = await loadHostId(directory),
    file = join(directory, 'media.mp4');
  const db = new StudioDatabase(join(directory, 'studio.sqlite'));
  try {
    db.saveProcess(
      {
        id: 'process_adopt_ui',
        name: 'Media adoption UI',
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
          startDate: '2035-01-01',
          slots: ['08:00'],
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          overduePolicy: 'NEXT_FUTURE_SLOT',
          jitterMinutes: 0,
        },
      },
      null,
    );
    const source = db.registerNativeSource({
      processId: 'process_adopt_ui',
      kind: 'FILE',
      rootPath: file,
      hostId,
      recursive: false,
      watch: false,
    });
    await writeFile(file, 'old media fixture');
    const probe = {
      status: 'UNAVAILABLE' as const,
      reason: 'UI fixture is an opaque file, no Android playback asserted',
    };
    db.applyScannedAsset(source.id, hostId, 0, 'old', {
      ...(await fingerprint(file)),
      kind: 'video',
      relativePath: 'media.mp4',
      probe,
    });
    const row = db.listContent('process_adopt_ui')[0]!;
    contentId = row.id;
    oldAssetId = row.assetIds[0]!;
    await writeFile(file, 'new media fixture for explicit consent');
    db.applyScannedAsset(source.id, hostId, 0, 'changed', {
      ...(await fingerprint(file)),
      kind: 'video',
      relativePath: 'media.mp4',
      probe,
    });
  } finally {
    db.close();
  }
  child = spawn(process.execPath, ['apps/desktop/dist/host/host/server.js'], {
    env: { ...process.env, PORT: '4177', AUTOREELS_DATA_DIR: directory },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Media host startup timeout')), 10000);
    child.stdout!.on('data', (chunk) => {
      if (String(chunk).includes('ready on port 4177')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error('Media host exited ' + code));
    });
  });
});
test.afterAll(async () => {
  if (child && child.exitCode === null) {
    const stopped = once(child, 'exit');
    child.kill('SIGTERM');
    await stopped;
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});
test('changed media preview can cancel, then adopt actual bytes while preserving content identity and pending Process edits', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:4177/');
  await page.locator('[data-route="processes"]').click();
  await page.getByRole('combobox', { name: 'Chọn tiến trình' }).selectOption('process_adopt_ui');
  const prepare = page.getByRole('button', { name: 'Xem thay đổi media.mp4', exact: true });
  await expect(prepare).toBeVisible();
  await prepare.click();
  await expect(page.getByRole('dialog')).toContainText('1 nội dung');
  const before = await request<ContentItem[]>(page, 'content', { processId: 'process_adopt_ui' });
  expect(before[0]!.assetIds).toEqual([oldAssetId]);
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await prepare.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // Edits made while a preview is open remain local until the user saves them.
  await page
    .getByLabel('Tên tiến trình', { exact: true })
    .fill('Local name kept during adoption', { force: true });
  await page.getByRole('button', { name: 'Tiếp nhận phiên bản mới', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(prepare).toHaveCount(0);
  await expect(page.getByLabel('Tên tiến trình', { exact: true })).toHaveValue(
    'Local name kept during adoption',
  );
  await page.getByRole('button', { name: /Lưu tiến trình/ }).click();
  const rows = await request<ContentItem[]>(page, 'content', { processId: 'process_adopt_ui' });
  expect(rows[0]!.id).toBe(contentId);
  expect(rows[0]!.assetIds[0]).not.toBe(oldAssetId);
  const bootstrap = await request<{ processes: ProcessDefinition[] }>(page, 'bootstrap', {});
  expect(bootstrap.processes.find((p) => p.id === 'process_adopt_ui')?.name).toBe(
    'Local name kept during adoption',
  );
});
