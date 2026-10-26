import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { StudioDatabase } from '../../packages/database/dist/index.js';

async function request<T>(page: Page, command: string, input: unknown): Promise<T> {
  const origin = new URL(page.url()).origin;
  const token = await page.locator('meta[name="studio-token"]').getAttribute('content');
  const response = await page.request.post(origin + '/api', {
    headers: { Origin: origin, 'X-Studio-Token': token! },
    data: { operationId: 'op_schedule_e2e', command, input },
  });
  const result = (await response.json()) as { ok: boolean; value: T; error?: unknown };
  expect(result.ok, JSON.stringify(result.error)).toBe(true);
  return result.value;
}
let directory: string, child: ChildProcess;
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'autoreels-schedule-ui-'));
  const db = new StudioDatabase(join(directory, 'studio.sqlite'));
  // A test-only observed-device record enables authoring acceptance. No Android adapter is emulated.
  db.registerObservedDevice('device_ui_fixture', 'UI fixture · chưa kết nối Android');
  const draft = db.createWorkflow('fb', 'Schedule E2E workflow');
  draft.bundle.inputs = [{ key: 'caption', type: 'text', scope: 'row', required: true }];
  db.saveDraft(draft.bundle, 0);
  const version = db.createVersion(draft.workflowId, 1);
  db.saveProcess(
    {
      id: 'process_schedule_ui',
      name: 'Schedule E2E fixture',
      appId: 'fb',
      workflowId: draft.workflowId,
      workflowVersionId: version.id,
      deviceId: 'device_ui_fixture',
      accountId: null,
      targetId: null,
      revision: 0,
      archived: false,
      schedule: {
        timezone: 'Asia/Ho_Chi_Minh',
        startDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
        slots: ['08:00', '12:00', '19:00'],
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        overduePolicy: 'NEXT_FUTURE_SLOT',
        jitterMinutes: 5,
      },
    },
    null,
  );
  for (const id of ['content_schedule_ui_1', 'content_schedule_ui_2'])
    db.saveContent(
      {
        id,
        processId: 'process_schedule_ui',
        revision: 0,
        fields: { caption: id },
        assetIds: [],
        ignored: false,
      },
      null,
    );
  db.close();
  child = spawn(process.execPath, ['apps/desktop/dist/host/host/server.js'], {
    env: { ...process.env, PORT: '4176', AUTOREELS_DATA_DIR: directory },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(
      () => reject(new Error('Isolated schedule host startup timeout')),
      10000,
    );
    child.stdout!.on('data', (chunk) => {
      if (String(chunk).includes('ready on port 4176')) {
        clearTimeout(deadline);
        resolve();
      }
    });
    child.once('error', (error) => {
      clearTimeout(deadline);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(deadline);
      reject(new Error('Schedule host exited ' + code));
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
test('saved proposal → apply → timeline → reschedule/cancel uses real SQLite snapshots', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:4176/');
  await page.locator('[data-route="schedule"]').click();
  await expect(
    page.getByRole('heading', { name: 'Chưa có công việc trong phạm vi này' }),
  ).toBeVisible();
  await page.locator('[data-route="processes"]').click();
  await page.getByRole('combobox', { name: 'Chọn tiến trình' }).selectOption('process_schedule_ui');
  await expect(page.getByRole('combobox', { name: 'Điện thoại tiến trình' })).toHaveValue(
    'device_ui_fixture',
  );
  await page.getByRole('button', { name: 'Xem trước lịch (2)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Áp dụng lịch', exact: true })).toBeEnabled();
  const proposed = await page
    .getByRole('dialog')
    .locator('tbody tr td:last-child')
    .allTextContents();
  await page.getByRole('button', { name: 'Áp dụng lịch', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.locator('[data-route="schedule"]').click();
  await expect(page.locator('.schedule-page tbody tr')).toHaveCount(2);
  let result = await request<{
    jobs: { id: string; scheduledUtc: string; snapshotHash: string }[];
  }>(page, 'jobs', { query: {} });
  expect(result.jobs.map((job) => Date.parse(job.scheduledUtc))).toEqual(
    proposed.map((value) => Date.parse(value)),
  );
  const original = result.jobs[0]!;
  await page.getByRole('button', { name: 'Sửa lịch ' + original.id, exact: true }).click();
  await page.getByLabel('Ngày chạy mới', { exact: true }).fill('2030-01-02');
  await page.getByLabel('Giờ chạy mới', { exact: true }).fill('10:30');
  await page.getByRole('button', { name: 'Lưu giờ mới', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  result = await request(page, 'jobs', { query: {} });
  expect(result.jobs.find((job) => job.id === original.id)).toMatchObject({
    snapshotHash: original.snapshotHash,
    scheduledUtc: '2030-01-02T03:30:00.000Z',
  });
  await page.getByRole('button', { name: 'Sửa lịch ' + original.id, exact: true }).click();
  await page.getByRole('button', { name: 'Hủy công việc', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('combobox', { name: 'Lọc trạng thái lịch' }).selectOption('CANCELLED');
  await expect(page.locator('.schedule-page tbody tr')).toHaveCount(1);
  await expect(page.locator('.schedule-page tbody')).toContainText('Đã hủy');
  await page.screenshot({ path: 'docs/evidence/implementation/ui/schedule-1600.png' });
  await page.reload();
  await page.locator('[data-route="schedule"]').click();
  await expect(page.locator('.schedule-page tbody tr')).toHaveCount(2);
});
