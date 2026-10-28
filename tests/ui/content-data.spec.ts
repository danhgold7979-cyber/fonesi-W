import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type {
  ContentItem,
  ContentPage,
  ContentPreviewDto,
  ProcessDefinition,
  WorkflowDraft,
} from '@autoreels/contracts';
import { parseContentFile } from '../../packages/import-export/dist/index.js';

async function request<T>(page: Page, command: string, input: unknown = {}): Promise<T> {
  const token = await page.locator('meta[name="studio-token"]').getAttribute('content');
  const response = await page.request.post('/api', {
    headers: { Origin: 'http://127.0.0.1:4175', 'X-Studio-Token': token! },
    data: { operationId: 'op_content_e2e', command, input },
  });
  const result = (await response.json()) as { ok: boolean; value: T; error?: unknown };
  expect(result.ok, JSON.stringify(result.error)).toBe(true);
  return result.value;
}
async function setup(page: Page, id: string, processFields = false) {
  await page.goto('/');
  const draft = await request<WorkflowDraft>(page, 'createWorkflow', { appId: 'fb', name: id });
  draft.bundle.inputs = [
    { key: 'caption', type: 'text', scope: 'row', required: true },
    { key: 'count', type: 'number', scope: 'row', required: false },
    { key: 'comments', type: 'list', itemType: 'text', scope: 'row', required: false },
    ...(processFields
      ? [
          { key: 'batchLimit', type: 'number' as const, scope: 'process' as const, required: true },
          {
            key: 'autoComment',
            type: 'boolean' as const,
            scope: 'process' as const,
            required: true,
          },
        ]
      : []),
  ];
  await request(page, 'saveWorkflow', { bundle: draft.bundle, expectedRevision: 0 });
  const process = await request<ProcessDefinition>(page, 'saveProcess', {
    expectedRevision: null,
    process: {
      id,
      name: id,
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
  });
  return { process, draft };
}
async function openProcess(page: Page, id: string) {
  await page.reload();
  await page.locator('[data-route="processes"]').click();
  await page.getByRole('combobox', { name: 'Chọn tiến trình' }).selectOption(id);
}
async function importFile(page: Page, document: unknown): Promise<ContentPreviewDto> {
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      r.request().url().endsWith('/api') &&
      r.request().postDataJSON().command === 'previewContentImport',
  );
  await page.getByLabel('File dữ liệu nội dung', { exact: true }).setInputFiles({
    name: 'data.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(document)),
  });
  const payload = (await (await response).json()) as {
    ok: boolean;
    value: ContentPreviewDto;
    error?: unknown;
  };
  expect(payload.ok, JSON.stringify(payload.error)).toBe(true);
  await expect(page.getByRole('dialog')).toHaveText(/Xem trước thay đổi dữ liệu/);
  return payload.value;
}
test('Process fields and content preview/apply/bulk/export preserve types and exact scope', async ({
  page,
}) => {
  const id = 'process_content_e2e',
    { draft } = await setup(page, id, true);
  for (const index of [1, 2])
    await request(page, 'saveContent', {
      expectedRevision: null,
      item: {
        id: 'content_data_e2e_' + index,
        processId: id,
        revision: 0,
        fields: { caption: 'row_' + index, count: 1, comments: ['original\nmultiline'] },
        assetIds: [],
        ignored: false,
      },
    });
  await openProcess(page, id);
  const processInputs = page.locator('.process-inputs');
  await processInputs
    .getByRole('checkbox', { name: 'Dùng trường batchLimit', exact: true })
    .check();
  await processInputs
    .getByRole('checkbox', { name: 'Dùng trường autoComment', exact: true })
    .check();
  await page.getByRole('button', { name: '▣ Lưu tiến trình', exact: true }).click();
  await expect(page.getByRole('button', { name: '▣ Lưu tiến trình', exact: true })).toBeDisabled();
  await openProcess(page, id);
  await expect(
    processInputs.getByRole('spinbutton', { name: 'batchLimit', exact: true }),
  ).toHaveValue('0');
  await expect(
    processInputs.getByRole('checkbox', { name: 'autoComment', exact: true }),
  ).not.toBeChecked();
  // An acknowledged Process save must not discard a JSON draft typed while it was pending.
  let delay = true;
  await page.route('**/api', async (route) => {
    const body = route.request().postDataJSON() as { command: string };
    if (body.command === 'saveProcess' && delay) {
      delay = false;
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({ response });
      return;
    }
    await route.continue();
  });
  const saveAcknowledged = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.request().url().endsWith('/api') &&
      response.request().postDataJSON().command === 'bootstrap',
  );
  await page
    .getByRole('textbox', { name: 'Tên tiến trình', exact: true })
    .fill('Saved while JSON draft changes');
  await page.getByRole('button', { name: '▣ Lưu tiến trình', exact: true }).click();
  await processInputs.locator('.content-json summary').click();
  const processJson = processInputs.getByRole('textbox', {
    name: 'Dữ liệu nội dung JSON',
    exact: true,
  });
  await processJson.fill('{');
  await expect(page.getByText('Dữ liệu chưa hợp lệ', { exact: true })).toBeVisible();
  await saveAcknowledged;
  await expect(processJson).toHaveValue('{');
  await processJson.fill('{"batchLimit":0,"autoComment":false}');
  await page.unroute('**/api');
  const p = await importFile(page, {
    format: 'autoreels-content',
    version: 1,
    processId: id,
    rows: [
      { contentId: 'content_data_e2e_1', fields: { caption: 'FIRST\ntiếng Việt', count: 0 } },
      { contentId: 'content_data_e2e_2', fields: { caption: 'SECOND' } },
    ],
  });
  expect(
    (await request<ContentItem[]>(page, 'content', { processId: id }))[0]!.fields.caption,
  ).toBe('row_1');
  await page.getByRole('button', { name: 'Áp dụng thay đổi', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await request(page, 'applyContentPreview', { token: p.token })).toMatchObject({
    alreadyApplied: true,
    updated: 2,
  });
  await page.getByRole('checkbox', { name: 'Chọn content_data_e2e_1', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Chọn content_data_e2e_2', exact: true }).check();
  await page.getByRole('textbox', { name: 'Tìm nội dung' }).fill('FIRST');
  await page.getByLabel('Menu dữ liệu', { exact: true }).click();
  await page.getByRole('button', { name: 'Sửa hàng loạt (2)…', exact: true }).click();
  await page.getByRole('combobox', { name: 'Thao tác hàng loạt' }).selectOption('APPEND');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: 'Dùng trường caption', exact: true }).check();
  await dialog.getByRole('textbox', { name: 'caption', exact: true }).fill('\nBULK');
  await page.getByRole('button', { name: 'Xem trước thay đổi', exact: true }).click();
  await expect(page.getByRole('dialog').locator('tbody tr')).toHaveCount(2);
  await expect(page.getByRole('dialog').locator('.content-delta summary')).toHaveCount(2);
  await expect(page.getByRole('dialog').locator('.content-delta').first()).toContainText('BULK');
  await page.screenshot({ path: 'docs/evidence/implementation/ui/content-preview-1600.png' });
  await page.getByRole('button', { name: 'Áp dụng thay đổi', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const rows = await request<ContentItem[]>(page, 'content', { processId: id });
  expect(rows.every((row) => String(row.fields.caption).endsWith('\nBULK'))).toBe(true);
  expect(rows[0]!.fields.count).toBe(0);
  expect(rows[0]!.fields.comments).toEqual(['original\nmultiline']);
  await page.getByRole('textbox', { name: 'Tìm nội dung' }).clear();
  for (const format of ['JSON', 'CSV', 'XLSX'] as const) {
    await page.getByLabel('Menu dữ liệu', { exact: true }).click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Xuất ' + format + ' (2)', exact: true }).click();
    const download = await downloading,
      bytes = await readFile((await download.path())!);
    const parsed = await parseContentFile(
      format,
      format === 'XLSX' ? bytes.toString('base64') : bytes.toString('utf8'),
      draft.bundle.inputs,
    );
    expect(parsed.records.map((row) => row.fields)).toEqual(rows.map((row) => row.fields));
  }
});
test('import errors and stale proposals leave existing content intact', async ({ page }) => {
  const id = 'process_content_errors';
  await setup(page, id);
  const item: ContentItem = {
    id: 'content_data_errors',
    processId: id,
    revision: 0,
    fields: { caption: 'original' },
    assetIds: [],
    ignored: false,
  };
  await request(page, 'saveContent', { item, expectedRevision: null });
  await openProcess(page, id);
  const wrong = await importFile(page, {
    format: 'autoreels-content',
    version: 1,
    rows: [{ contentId: 'missing', filename: 'existing.mp4', fields: { caption: 'wrong' } }],
  });
  expect(wrong.canApply).toBe(false);
  await expect(page.getByRole('button', { name: 'Áp dụng thay đổi', exact: true })).toBeDisabled();
  await page.getByRole('dialog').getByRole('button', { name: 'Hủy', exact: true }).click();
  await importFile(page, {
    format: 'autoreels-content',
    version: 1,
    rows: [{ contentId: item.id, fields: { caption: 'import' } }],
  });
  await request(page, 'saveContent', {
    item: { ...item, fields: { caption: 'concurrent edit' } },
    expectedRevision: 0,
  });
  await page.getByRole('button', { name: 'Áp dụng thay đổi', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('đã đổi');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    (await request<ContentItem[]>(page, 'content', { processId: id }))[0]!.fields.caption,
  ).toBe('concurrent edit');
});
test('virtual content table keeps DOM bounded and stable ID selection beyond a thousand records', async ({
  page,
}) => {
  const id = 'process_content_scale';
  await setup(page, id);
  for (const [start, count] of [
    [0, 1000],
    [1000, 200],
  ]) {
    const doc = {
      format: 'autoreels-content',
      version: 1,
      rows: Array.from({ length: count! }, (_, index) => ({
        fields: { caption: 'entry_' + String(start! + index).padStart(4, '0') },
      })),
    };
    const p = await request<ContentPreviewDto>(page, 'previewContentImport', {
      processId: id,
      expectedRevision: 0,
      format: 'JSON',
      data: JSON.stringify(doc),
    });
    expect(p.canApply).toBe(true);
    await request(page, 'applyContentPreview', { token: p.token });
  }
  await openProcess(page, id);
  const rendered = page.locator('.content-table-scroll tbody tr:not([aria-hidden="true"])');
  await expect(rendered.first()).toBeVisible();
  expect(await rendered.count()).toBeLessThan(50);
  await page.getByRole('textbox', { name: 'Tìm nội dung' }).fill('entry_1199');
  await expect(rendered).toHaveCount(1);
  const rows = await request<ContentItem[]>(page, 'content', { processId: id }),
    target = rows.find((row) => row.fields.caption === 'entry_1199')!;
  await page.getByRole('checkbox', { name: 'Chọn ' + target.id, exact: true }).check();
  await page.getByRole('button', { name: 'Sửa ' + target.id, exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: 'caption', exact: true })
    .fill('edited entry_1199');
  await page.getByRole('button', { name: 'Lưu nội dung', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('textbox', { name: 'Tìm nội dung' }).clear();
  await expect(page.getByText('1 chọn · 1200 đang lọc', { exact: true })).toBeVisible();
  await page
    .locator('.content-table-scroll')
    .evaluate((element) => element.scrollTo({ top: 60000 }));
  expect(await rendered.count()).toBeLessThan(50);
  expect(
    (await request<ContentItem[]>(page, 'content', { processId: id })).find(
      (row) => row.id === target.id,
    )?.fields.caption,
  ).toBe('edited entry_1199');
});


test('named contentPage API returns DB-scoped stable pages and blocks stale cross-process cursors', async ({
  page,
}) => {
  const id = 'process_content_server_page';
  await setup(page, id);
  for (let i = 0; i < 4; i++)
    await request<ContentItem>(page, 'saveContent', {
      expectedRevision: null,
      item: {
        id: 'content_server_page_' + i,
        processId: id,
        revision: 0,
        fields: { caption: i < 3 ? 'batch alpha ' + i : 'beta', count: i },
        assetIds: [],
        ignored: false,
      },
    });
  const first = await request<ContentPage>(page, 'contentPage', {
    query: { processId: id, limit: 2 },
  });
  expect(first).toMatchObject({ total: 4, hasMore: true });
  expect(first.items.map((x) => x.id)).toEqual([
    'content_server_page_0', 'content_server_page_1',
  ]);
  expect(first.nextCursor).toBeTruthy();
  const second = await request<ContentPage>(page, 'contentPage', {
    query: { processId: id, limit: 2, cursor: first.nextCursor },
  });
  expect(second).toMatchObject({ total: 4, hasMore: false, nextCursor: null });
  expect(second.items.map((x) => x.id)).toEqual([
    'content_server_page_2', 'content_server_page_3',
  ]);
  const filtered = await request<ContentPage>(page, 'contentPage', {
    query: { processId: id, search: 'alpha', limit: 2 },
  });
  expect(filtered.total).toBe(3);
  expect(filtered.items).toHaveLength(2);
  // The legacy Process view remains a full-scope authoring interface for now.
  await request<ContentItem>(page, 'saveContent', {
    item: {
      ...first.items[0]!,
      fields: { caption: 'changed after cursor', count: 0 },
    },
    expectedRevision: first.items[0]!.revision,
  });
  const token = await page.locator('meta[name="studio-token"]').getAttribute('content');
  const staleResponse = await page.request.post('/api', {
    headers: { Origin: 'http://127.0.0.1:4175', 'X-Studio-Token': token! },
    data: {
      operationId: 'op_content_stale_cursor',
      command: 'contentPage',
      input: { query: { processId: id, cursor: first.nextCursor, limit: 2 } },
    },
  });
  const stale = (await staleResponse.json()) as { ok: boolean; error?: { code: string } };
  expect(stale.ok).toBe(false);
  expect(stale.error?.code).toBe('CONTENT_QUERY_STALE');
  const changed = await request<ContentPage>(page, 'contentPage', {
    query: { processId: id, limit: 2 },
  });
  expect(changed.total).toBe(4);
  expect(changed.items[0]!.fields.caption).toBe('changed after cursor');
});
