import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { StudioDatabase } from '../../packages/database/dist/index.js';
import { DatabaseSync } from 'node:sqlite';
import { contentHash } from '../../packages/domain/dist/index.js';
import type { JobChangePreview, ScheduledJobSummary } from '@autoreels/contracts';

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

test('timeline loads beyond the first 500 jobs while keeping DOM rows bounded and filters scoped', async ({
  page,
}) => {
  const db = new StudioDatabase(join(directory, 'studio.sqlite'));
  try {
    const source = db.getProcess('process_schedule_ui');
    const process = {
      ...source,
      id: 'process_page_ui',
      name: 'Paged timeline fixture',
      revision: 0,
    };
    db.saveProcess(process, null);
    db.saveContent(
      {
        id: 'content_page_ui',
        processId: process.id,
        revision: 0,
        fields: { caption: 'Pagination fixture' },
        assetIds: [],
        ignored: false,
      },
      null,
    );
    const version = db.getVersion(process.workflowVersionId!);
    for (let index = 0; index < 501; index++)
      db.createJob(
        {
          id: 'job_page_ui_' + String(index).padStart(3, '0'),
          occurrenceKey: contentHash({ uiPage: index }),
          processId: process.id,
          deviceId: process.deviceId!,
          contentId: 'content_page_ui',
          scheduledUtc: '2035-01-01T00:00:00.000Z',
          state: 'SCHEDULED',
          revision: 0,
          priority: 0,
        },
        {
          workflowVersionId: version.id,
          workflowHash: version.hash,
          bundle: version.bundle,
          contentId: 'content_page_ui',
          fields: { caption: 'Pagination fixture' },
          assetIds: [],
          targetId: null,
          networkProfileId: null,
        },
      );
  } finally {
    db.close();
  }
  await page.goto('http://127.0.0.1:4176/');
  await page.locator('[data-route="schedule"]').click();
  await page
    .getByRole('combobox', { name: 'Lọc lịch theo tiến trình' })
    .selectOption('process_page_ui');
  await expect(page.locator('.schedule-page')).toContainText('Đã tải 500 công việc');
  expect(await page.locator('.schedule-page tbody tr[data-index]').count()).toBeLessThan(40);
  await page.getByRole('button', { name: 'Tải thêm công việc', exact: true }).click();
  await expect(page.locator('.schedule-page')).toContainText('Đã tải 501 công việc');
  await expect(page.getByRole('button', { name: 'Tải thêm công việc', exact: true })).toHaveCount(
    0,
  );
  await page.locator('.schedule-scroll').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(
    page.getByRole('button', { name: 'Sửa lịch job_page_ui_500', exact: true }),
  ).toBeVisible();
  expect(await page.locator('.schedule-page tbody tr[data-index]').count()).toBeLessThan(40);
  await page.getByRole('combobox', { name: 'Lọc trạng thái lịch' }).selectOption('CANCELLED');
  await expect(
    page.getByRole('heading', { name: 'Chưa có công việc trong phạm vi này' }),
  ).toBeVisible();
});

test('selected schedule spread previews crossing-day changes and cancellation preserves jobs outside scope', async ({
  page,
}) => {
  const db = new StudioDatabase(join(directory, 'studio.sqlite'));
  try {
    const source = db.getProcess('process_schedule_ui'),
      process = { ...source, id: 'process_batch_ui', name: 'Batch schedule UI', revision: 0 };
    db.saveProcess(process, null);
    db.saveContent(
      {
        id: 'content_batch_ui',
        processId: process.id,
        revision: 0,
        fields: { caption: 'Batch UI' },
        assetIds: [],
        ignored: false,
      },
      null,
    );
    const version = db.getVersion(process.workflowVersionId!);
    for (const id of ['a', 'b', 'outside'])
      db.createJob(
        {
          id: 'job_batch_ui_' + id,
          occurrenceKey: contentHash({ batchUi: id }),
          processId: process.id,
          deviceId: process.deviceId!,
          contentId: 'content_batch_ui',
          scheduledUtc: id === 'outside' ? '2040-01-05T00:00:00.000Z' : '2040-01-01T16:30:00.000Z',
          state: 'SCHEDULED',
          revision: 0,
          priority: 0,
        },
        {
          workflowVersionId: version.id,
          workflowHash: version.hash,
          bundle: version.bundle,
          contentId: 'content_batch_ui',
          fields: { caption: 'Batch UI' },
          assetIds: [],
          targetId: null,
          networkProfileId: null,
        },
      );
  } finally {
    db.close();
  }
  await page.goto('http://127.0.0.1:4176/');
  await page.locator('[data-route="schedule"]').click();
  await page
    .getByRole('combobox', { name: 'Lọc lịch theo tiến trình' })
    .selectOption('process_batch_ui');
  await expect(page.locator('.schedule-page tbody tr[data-index]')).toHaveCount(3);
  const before = await request<{ jobs: ScheduledJobSummary[] }>(page, 'jobs', {
    query: { processId: 'process_batch_ui' },
  });
  for (const id of ['a', 'b'])
    await page.getByRole('checkbox', { name: 'Chọn lịch job_batch_ui_' + id, exact: true }).check();
  await page.getByRole('button', { name: 'Giãn lịch đã chọn', exact: true }).click();
  await page.getByLabel('Khoảng giãn tối thiểu', { exact: true }).fill('90');
  await page.getByLabel('Khoảng giãn tối đa', { exact: true }).fill('90');
  await page.getByRole('button', { name: 'Xem trước thay đổi lịch', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Sang ngày khác');
  expect(
    (
      await request<{ jobs: ScheduledJobSummary[] }>(page, 'jobs', {
        query: { processId: 'process_batch_ui' },
      })
    ).jobs,
  ).toEqual(before.jobs);
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
  await page.getByRole('button', { name: 'Giãn lịch đã chọn', exact: true }).click();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api') &&
      response.request().postDataJSON()?.command === 'previewJobChanges',
  );
  await page.getByRole('button', { name: 'Xem trước thay đổi lịch', exact: true }).click();
  const proposed = ((await (await responsePromise).json()) as { value: JobChangePreview }).value;
  await page.getByRole('button', { name: 'Áp dụng thay đổi lịch', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.schedule-page')).toContainText('Đã chọn 0 công việc');
  const after = await request<{ jobs: ScheduledJobSummary[] }>(page, 'jobs', {
    query: { processId: 'process_batch_ui' },
  });
  for (const slot of proposed.slots) {
    const saved = after.jobs.find((job) => job.id === slot.jobId)!;
    expect(Date.parse(saved.scheduledUtc)).toBe(Date.parse(slot.proposedUtc));
    expect(saved.snapshotHash).toBe(before.jobs.find((job) => job.id === slot.jobId)!.snapshotHash);
  }
  expect(after.jobs.find((job) => job.id === 'job_batch_ui_outside')).toEqual(
    before.jobs.find((job) => job.id === 'job_batch_ui_outside'),
  );
  await page.getByRole('checkbox', { name: 'Chọn lịch job_batch_ui_b', exact: true }).check();
  await page.getByRole('button', { name: 'Hủy lịch đã chọn', exact: true }).click();
  await page.getByRole('button', { name: 'Xem trước thay đổi lịch', exact: true }).click();
  await page.getByRole('button', { name: 'Áp dụng thay đổi lịch', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const final = await request<{ jobs: ScheduledJobSummary[] }>(page, 'jobs', {
    query: { processId: 'process_batch_ui' },
  });
  expect(final.jobs.find((job) => job.id === 'job_batch_ui_b')?.state).toBe('CANCELLED');
  expect(final.jobs.find((job) => job.id === 'job_batch_ui_outside')).toEqual(
    before.jobs.find((job) => job.id === 'job_batch_ui_outside'),
  );
  await expect(
    page.getByRole('checkbox', { name: 'Chọn lịch job_batch_ui_b', exact: true }),
  ).toBeDisabled();
});

test('calendar queries local days across UTC midnight, caps month cards, opens full day and scopes multiple apps', async ({
  page,
}) => {
  const db = new StudioDatabase(join(directory, 'studio.sqlite'));
  try {
    const source = db.getProcess('process_schedule_ui');
    for (const appId of ['fb', 'tt']) {
      const draft = db.createWorkflow(appId, 'Calendar ' + appId),
        version = db.createVersion(draft.workflowId, 0);
      const process = {
        ...source,
        id: 'process_calendar_' + appId,
        name: 'Calendar ' + appId,
        appId,
        workflowId: draft.workflowId,
        workflowVersionId: version.id,
        revision: 0,
        schedule: { ...source.schedule, timezone: 'America/New_York' },
      };
      db.saveProcess(process, null);
      const contentId = 'content_calendar_' + appId;
      db.saveContent(
        {
          id: contentId,
          processId: process.id,
          fields: {},
          assetIds: [],
          revision: 0,
          ignored: false,
        },
        null,
      );
      const ids =
        appId === 'fb' ? ['a', 'b', ...Array.from({ length: 24 }, (_, i) => String(i))] : ['b'];
      for (const id of ids)
        db.createJob(
          {
            id: 'job_calendar_' + appId + '_' + id,
            occurrenceKey: contentHash({ calendarUi: appId, id }),
            processId: process.id,
            deviceId: process.deviceId!,
            contentId,
            scheduledUtc:
              id === 'a'
                ? '2042-01-01T16:59:00.000Z'
                : id === 'b'
                  ? '2042-01-01T17:01:00.000Z'
                  : '2042-01-01T17:03:00.000Z',
            state: 'SCHEDULED',
            revision: 0,
            priority: 0,
          },
          {
            workflowVersionId: version.id,
            workflowHash: version.hash,
            bundle: version.bundle,
            contentId,
            fields: {},
            assetIds: [],
            targetId: null,
            networkProfileId: null,
            scheduleProfile: process.schedule,
          },
        );
    }
  } finally {
    db.close();
  }
  await page.goto('http://127.0.0.1:4176/');
  await page.locator('[data-route="schedule"]').click();
  await page.getByRole('combobox', { name: 'Chế độ xem lịch' }).selectOption('MONTH');
  await page.getByLabel('Ngày mốc lịch', { exact: true }).fill('2042-01-02');
  await page.getByRole('combobox', { name: 'Lọc lịch theo ứng dụng' }).selectOption('fb');
  const day = page.getByRole('region', { name: 'Lịch ngày 2042-01-02', exact: true });
  await expect(day).toContainText('25 đã tải');
  await expect(day.locator('.calendar-job')).toHaveCount(3);
  await page.screenshot({ path: '.cache/increment-023-calendar-month.png' });
  await expect(
    page.getByRole('region', { name: 'Lịch ngày 2042-01-01', exact: true }),
  ).toContainText('1 đã tải');
  await day.getByRole('button', { name: 'Xem ngày 2042-01-02', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Chế độ xem lịch' })).toHaveValue('DAY');
  await expect(page.locator('.schedule-page')).toContainText('Đã tải 25 công việc');
  await expect(
    page.getByRole('button', { name: 'Sửa lịch job_calendar_fb_a', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Sửa lịch job_calendar_fb_b', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('America/New_York');
  await expect(page.getByLabel('Ngày chạy mới', { exact: true })).toHaveValue('2042-01-01');
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
  await page.getByRole('combobox', { name: 'Lọc lịch theo ứng dụng' }).selectOption('tt');
  await expect(page.locator('.schedule-page')).toContainText('Đã tải 1 công việc');
  await expect(
    page.getByRole('button', { name: 'Sửa lịch job_calendar_tt_b', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Múi giờ hiển thị lịch', { exact: true }).fill('UTC');
  await expect(
    page.getByRole('heading', { name: 'Chưa có công việc trong phạm vi này' }),
  ).toBeVisible();
  await page.getByLabel('Ngày mốc lịch', { exact: true }).fill('2042-01-01');
  await expect(
    page.getByRole('button', { name: 'Sửa lịch job_calendar_tt_b', exact: true }),
  ).toBeVisible();
  await page.getByRole('combobox', { name: 'Chế độ xem lịch' }).selectOption('WEEK');
  await expect(page.locator('.calendar-cell')).toHaveCount(7);
  await expect(
    page.getByRole('button', { name: 'Sửa lịch job_calendar_tt_b', exact: true }),
  ).toBeVisible();
});


test('read-only job preflight shows persisted blockers without claiming a phone or mutating the scheduled job', async ({
  page,
}) => {
  const db = new StudioDatabase(join(directory, 'studio.sqlite'));
  try {
    const source = db.getProcess('process_schedule_ui');
    const process = {
      ...source, id: 'process_preflight_ui', name: 'Preflight read-only fixture', revision: 0,
    };
    db.saveProcess(process, null);
    db.saveContent({
      id: 'content_preflight_ui', processId: process.id, revision: 0,
      fields: { caption: 'Secret preview caption' }, assetIds: [], ignored: false,
    }, null);
    const version = db.getVersion(process.workflowVersionId!);
    db.createJob({
      id: 'job_preflight_ui', occurrenceKey: contentHash('preflight_ui'),
      processId: process.id, deviceId: process.deviceId!,
      contentId: 'content_preflight_ui',
      scheduledUtc: '2035-01-01T00:00:00.000Z',
      state: 'SCHEDULED', revision: 0, priority: 0,
    }, {
      workflowVersionId: version.id, workflowHash: version.hash, bundle: version.bundle,
      contentId: 'content_preflight_ui',
      fields: { caption: 'Secret preview caption' },
      assetIds: [], targetId: null, networkProfileId: null,
    });
  } finally { db.close(); }
  await page.goto('http://127.0.0.1:4176/');
  await page.locator('[data-route="schedule"]').click();
  await page.getByRole('combobox', { name: 'Lọc lịch theo tiến trình' })
    .selectOption('process_preflight_ui');
  const before = await request<{ jobs: ScheduledJobSummary[] }>(page, 'jobs', {
    query: { processId: 'process_preflight_ui' },
  });
  expect(before.jobs).toHaveLength(1);
  await page.getByRole('button', { name: 'Kiểm tra điều kiện job_preflight_ui' }).click();
  const dialog = page.getByRole('dialog', { name: 'Điều kiện thực thi (chỉ đọc)' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('LIVE_PROFILE_NOT_CERTIFIED');
  await expect(dialog).toContainText('DEVICE_IDENTITY_UNVERIFIED');
  await expect(dialog).toContainText('Chưa được phép thực thi');
  await expect(dialog).not.toContainText('Secret preview caption');
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
  const after = await request<{ jobs: ScheduledJobSummary[] }>(page, 'jobs', {
    query: { processId: 'process_preflight_ui' },
  });
  expect(after.jobs).toEqual(before.jobs);
  const dbCheck = new StudioDatabase(join(directory, 'studio.sqlite'));
  try {
    expect(dbCheck.getJob('job_preflight_ui').job).toMatchObject({
      revision: 0, state: 'SCHEDULED',
    });
  } finally { dbCheck.close(); }

  // Simulate ONLY the Electron-native bridge after proving the public browser
  // has no such capability. The fake is a safe status receipt, never real ADB.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'studioStageReview', {
      configurable: true,
      value: {
        reobserve: async () => { throw new Error('Not an Android fixture'); },
        requestCleanupReview: async () => { throw new Error('No cleanup permission'); },
        reviewCleanupAbsence: async () => ({
          scope: 'PRIVATE_OWNED_STAGE_ABSENCE_NOT_DELETE_CERTIFIED',
          status: 'ABSENCE_CANDIDATE_UNCERTIFIED',
          remote: 'ABSENT', mediaStore: 'NOT_INDEXED',
          blockers: ['PROVIDER_AND_CLEANUP_UNCERTIFIED'],
          canDelete: false, canMarkClean: false, canRetry: false, canDispatch: false,
        }),
      },
    });
  });
  await page.goto('http://127.0.0.1:4176/');
  await page.locator('[data-route="schedule"]').click();
  await page.getByRole('combobox', { name: 'Lọc lịch theo tiến trình' })
    .selectOption(processId);
  await page.getByRole('button', { name: 'Hồ sơ đối soát ' + jobId }).click();
  const nativeDialog = page.getByRole('dialog', { name: 'Hồ sơ đối soát staging' });
  const readOnlyButton = nativeDialog.getByRole('button', {
    name: 'Kiểm tra file staging còn hay mất media 1',
  });
  await expect(readOnlyButton).toBeVisible();
  await readOnlyButton.click();
  await expect(nativeDialog.getByTestId('stage-cleanup-absence-result'))
    .toContainText('Không thấy file ở đường dẫn staging sở hữu');
  await expect(nativeDialog.getByTestId('stage-cleanup-absence-result'))
    .toContainText('Không xác nhận đã xóa');
  const body = await nativeDialog.innerText();
  for (const secret of [
    remotePath, stageId, nonce, mediaHash, 'host_stage_secret',
    'effect_private_review_ui', 'cleanup_ui_private_request',
  ]) expect(body).not.toContain(secret);
  await expect(nativeDialog.getByRole('button', {
    name: /Xóa file|Thực hiện cleanup|Đăng lại|Retry bài/,
  })).toHaveCount(0);
});


test('NEEDS_REVIEW operator sees real persisted staging history without secrets or actions', async ({ page }) => {
  const jobId = 'job_stage_review_ui';
  const processId = 'process_stage_review_ui';
  const stageId = 'stage_review_ui_fixture';
  const assetId = 'asset_stage_review_ui';
  const remotePath = '/sdcard/Download/AutoReelsStudio/job-' + jobId + '/secret-video.mp4';
  const nonce = 'f'.repeat(32);
  const mediaHash = 'd'.repeat(64);
  const secretCaption = 'PRIVATE REVIEW CAPTION DO NOT RENDER';
  const db = new StudioDatabase(join(directory, 'studio.sqlite'));
  let snapshotHash = '';
  try {
    const original = db.getProcess('process_schedule_ui');
    db.saveProcess({
      ...original, id: processId, name: 'Review evidence fixture', revision: 0,
    }, null);
    db.saveContent({
      id: 'content_stage_review_ui', processId, revision: 0,
      fields: { caption: secretCaption }, assetIds: [], ignored: false,
    }, null);
    const version = db.getVersion(original.workflowVersionId!);
    db.createJob({
      id: jobId, occurrenceKey: contentHash('stage_review_ui_occurrence'),
      processId, deviceId: original.deviceId!, contentId: 'content_stage_review_ui',
      scheduledUtc: '2037-01-01T00:00:00.000Z', state: 'SCHEDULED',
      revision: 0, priority: 0,
    }, {
      workflowVersionId: version.id, workflowHash: version.hash, bundle: version.bundle,
      contentId: 'content_stage_review_ui', fields: { caption: secretCaption },
      assetIds: [], targetId: null, networkProfileId: null,
    });
    snapshotHash = db.getJob(jobId).snapshotHash;
  } finally { db.close(); }

  const connection = new DatabaseSync(join(directory, 'studio.sqlite'));
  try {
    connection.exec('PRAGMA foreign_keys=ON');
    connection.prepare(
      'INSERT INTO assets(id,source_ref,relative_path,hash,kind,bytes,mtime_ms) VALUES(?,?,?,?,?,?,?)',
    ).run(assetId, 'test-only', 'review.mp4', mediaHash, 'video', 72, 1);
    connection.prepare("UPDATE jobs SET state='NEEDS_REVIEW',revision=1 WHERE id=?")
      .run(jobId);
    connection.prepare(
      'INSERT INTO device_stage_transfers(' +
      'id,job_id,device_id,host_id,asset_id,ordinal,snapshot_hash,expected_hash,' +
      'expected_bytes,claim_generation,remote_path,nonce,state,created_at,updated_at' +
      ') VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    ).run(
      stageId, jobId, 'device_ui_fixture', 'host_stage_secret', assetId, 0,
      snapshotHash, mediaHash, 72, 1, remotePath, nonce, 'SYNC_ACK_UNVERIFIED',
      '2026-10-28T00:00:00.000Z', '2026-10-28T00:00:00.000Z',
    );
    connection.prepare(
      'UPDATE device_stage_transfers SET remote_readback_hash=?,remote_readback_bytes=?,' +
      'remote_readback_at=?,mediastore_row_id=?,mediastore_at=? WHERE id=?',
    ).run(mediaHash, 72, '2026-10-28T00:00:01.000Z', '42',
      '2026-10-28T00:00:02.000Z', stageId);
    const insert = connection.prepare(
      'INSERT INTO device_stage_reconciliations(' +
      'id,request_id,stage_id,job_id,device_id,host_id,claim_generation,' +
      'lease_owner_kind,lease_generation,classification,observed_hash,observed_bytes,' +
      'mediastore_status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    );
    for (let i = 0; i < 24; i++)
      insert.run(
        'audit_review_ui_' + i, 'request_review_ui_' + i, stageId, jobId,
        'device_ui_fixture', 'host_stage_secret', 1, i % 2 === 0 ? 'JOB' : 'MANUAL',
        i % 2 === 0 ? 1 : 2, 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED',
        mediaHash, 72, 'INDEXED_EXACT',
        new Date(Date.parse('2026-10-28T00:01:00.000Z') + i * 1000).toISOString(),
      );
    connection.prepare(
      'INSERT INTO device_stage_cleanup_reviews(' +
      'request_id,stage_id,job_id,device_id,host_id,snapshot_hash,job_revision,' +
      'claim_generation,lease_generation,reconciliation_id,state,created_at) ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    ).run(
      'cleanup_ui_private_request', stageId, jobId, 'device_ui_fixture',
      'host_stage_secret', snapshotHash, 1, 1, 2, 'audit_review_ui_23',
      'REVIEW_REQUESTED_HARDWARE_PENDING', '2026-10-28T00:03:00.000Z',
    );
    connection.prepare(
      'INSERT INTO effects(id,job_id,node_id,kind,effect_key,payload_hash,' +
      'state,evidence_ref,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
    ).run(
      'effect_private_review_ui', jobId, 'publish_ui_private', 'PUBLISH',
      '9'.repeat(64), '8'.repeat(64), 'ATTEMPT_UNCERTAIN',
      'external_private_evidence', '2026-10-28T00:03:01.000Z',
    );
  } finally { connection.close(); }

  await page.goto('http://127.0.0.1:4176/');
  await page.locator('[data-route="schedule"]').click();
  await page.getByRole('combobox', { name: 'Lọc lịch theo tiến trình' })
    .selectOption(processId);
  await expect(page.getByRole('button', { name: 'Hồ sơ đối soát ' + jobId })).toBeVisible();
  const before = await request<{ jobs: ScheduledJobSummary[] }>(page, 'jobs', {
    query: { processId },
  });
  expect(before.jobs).toHaveLength(1);
  await page.getByRole('button', { name: 'Hồ sơ đối soát ' + jobId }).click();
  const dialog = page.getByRole('dialog', { name: 'Hồ sơ đối soát staging' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('không kiểm tra điện thoại trực tiếp');
  await expect(dialog).toContainText('Có bản ghi byte khớp');
  await expect(dialog).toContainText('chưa xác minh picker');
  await expect(dialog.getByTestId('stage-review-summary')).toHaveCount(1);
  await expect(dialog).toContainText('Thứ tự media đóng băng (chưa xác minh picker)');
  await expect(dialog.getByTestId('media-order-status')).toContainText('Đối chiếu media bị chặn');
  await expect(dialog).toContainText('Nội dung Unicode đã ghim (chưa nhập Android)');
  await expect(dialog.getByTestId('frozen-unicode-status')).toBeVisible();
  await expect(dialog).toContainText('Đích đăng và nội dung đã ghim (chưa kiểm chứng Android)');
  await expect(dialog.getByTestId('frozen-compose-status'))
    .toContainText('Compose bị chặn');
  await expect(dialog).toContainText('Nhật ký effect đã lưu (chưa xác minh bài đăng)');
  await expect(dialog.getByTestId('effect-journal-status'))
    .toContainText('Có effect chưa được đối soát');
  await expect(dialog.getByTestId('effect-journal-entry')).toHaveCount(1);
  await expect(dialog).toContainText('Đã ghi cửa sổ thao tác không chắc chắn');
  await expect(dialog.getByRole('button', { name: /Xác minh|Đăng bài|Publish/ }))
    .toHaveCount(0);
  await expect(dialog).toContainText('Chưa ghim tài khoản cho job');
  await expect(dialog.getByRole('button', { name: /Xác minh đích đăng|Publish|Bắt đầu đăng/ }))
    .toHaveCount(0);
  await expect(dialog).toContainText('không tự trim, đổi Unicode');
  await expect(dialog.getByRole('button', { name: /Nhập Unicode|Gõ caption|Dán văn bản/ }))
    .toHaveCount(0);
  await expect(dialog).toContainText('Stage thừa, trùng hoặc nằm ngoài thứ tự asset');
  await expect(dialog).toContainText('không chọn theo tên tệp hoặc thumbnail');
  await expect(dialog.getByRole('button', { name: /Kiểm tra lại Android/ })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /Kiểm tra file staging còn hay mất/ }))
    .toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /Ghi yêu cầu rà soát cleanup/ })).toHaveCount(0);
  expect(await page.evaluate(() => typeof (window as Window & {
    studioStageReview?: unknown;
  }).studioStageReview)).toBe('undefined');
  const origin = new URL(page.url()).origin;
  const token = await page.locator('meta[name="studio-token"]').getAttribute('content');
  const forbidden = await page.request.post(origin + '/api', {
    headers: { Origin: origin, 'X-Studio-Token': token! },
    data: {
      operationId: 'op_untrusted_live_stage',
      command: 'stage.reobserve',
      input: { jobId, ordinal: 0 },
    },
  });
  expect(((await forbidden.json()) as { ok: boolean }).ok).toBe(false);
  const forged = await page.request.post(origin + '/api', {
    headers: { Origin: origin, 'X-Studio-Token': token! },
    data: {
      operationId: 'op_untrusted_cleanup_review',
      command: 'stage.cleanupReviewRecord',
      input: { jobId, ordinal: 0, confirmed: true },
    },
  });
  expect(((await forged.json()) as { ok: boolean }).ok).toBe(false);
  const forgedAbsence = await page.request.post(origin + '/api', {
    headers: { Origin: origin, 'X-Studio-Token': token! },
    data: {
      operationId: 'op_untrusted_owned_absence',
      command: 'stage.reviewCleanupAbsence',
      input: { jobId, ordinal: 0 },
    },
  });
  expect(((await forgedAbsence.json()) as { ok: boolean }).ok).toBe(false);
  await expect(dialog.getByTestId('stage-cleanup-review-request')).toHaveCount(1);
  await expect(dialog).toContainText('Đã ghi yêu cầu rà soát, đang chờ kiểm tra phần cứng');
  await expect(dialog).toContainText('không có file nào');
  await expect(dialog.getByTestId('stage-review-observation')).toHaveCount(20);
  await dialog.getByRole('button', { name: 'Tải thêm lịch sử' }).click();
  await expect(dialog.getByTestId('stage-review-observation')).toHaveCount(24);
  await expect(dialog).not.toContainText(secretCaption);
  await expect(dialog).not.toContainText(remotePath);
  await expect(dialog).not.toContainText(mediaHash);
  await expect(dialog).not.toContainText(nonce);
  await expect(dialog).not.toContainText('host_stage_secret');
  await expect(dialog).not.toContainText('cleanup_ui_private_request');
  for (const secret of ['effect_private_review_ui', 'publish_ui_private',
    'external_private_evidence', '9'.repeat(64), '8'.repeat(64)])
    await expect(dialog).not.toContainText(secret);
  await expect(dialog.getByRole('button', { name: /Đăng|Xóa|Chạy lại|Chọn media/ })).toHaveCount(0);
  const report = await request<unknown>(page, 'jobStageReview', { id: jobId });
  const response = JSON.stringify(report);
  for (const secret of [remotePath, nonce, mediaHash, secretCaption, stageId,
    'host_stage_secret', 'cleanup_ui_private_request',
    'effect_private_review_ui', 'publish_ui_private',
    'external_private_evidence', '9'.repeat(64), '8'.repeat(64)])
    expect(response).not.toContain(secret);
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
  const after = await request<{ jobs: ScheduledJobSummary[] }>(page, 'jobs', {
    query: { processId },
  });
  expect(after.jobs).toEqual(before.jobs);
  const dbCheck = new StudioDatabase(join(directory, 'studio.sqlite'));
  try {
    expect(dbCheck.getJob(jobId).job).toMatchObject({ state: 'NEEDS_REVIEW', revision: 1 });
    expect(dbCheck.listDeviceStageTransfers(jobId)[0]).toMatchObject({
      id: stageId, state: 'SYNC_ACK_UNVERIFIED',
    });
  } finally { dbCheck.close(); }
});

