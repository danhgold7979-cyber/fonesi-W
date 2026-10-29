import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { ProcessDefinition, WorkflowDraft, ContentItem } from '@autoreels/contracts';

async function request<T>(page: Page, command: string, input: unknown): Promise<T> {
  const token = await page.locator('meta[name="studio-token"]').getAttribute('content');
  const response = await page.request.post('/api', {
    headers: { Origin: 'http://127.0.0.1:4175', 'X-Studio-Token': token! },
    data: { operationId: 'op_clone_ui', command, input },
  });
  const result = (await response.json()) as { ok: boolean; value: T; error?: unknown };
  expect(result.ok, JSON.stringify(result.error)).toBe(true);
  return result.value;
}
test('Process clone preview is read-only until apply and creates an independent typed dataset', async ({
  page,
}) => {
  await page.goto('/');
  const workflow = await request<WorkflowDraft>(page, 'createWorkflow', {
    appId: 'fb',
    name: 'Clone UI workflow',
  });
  workflow.bundle.inputs = [
    { key: 'caption', type: 'text', scope: 'row', required: true },
    { key: 'count', type: 'number', scope: 'row', required: false },
    { key: 'flag', type: 'boolean', scope: 'row', required: false },
    { key: 'tags', type: 'list', itemType: 'text', scope: 'row', required: false },
    { key: 'enabled', type: 'boolean', scope: 'process', required: false },
    { key: 'apiToken', type: 'text', scope: 'process', required: false },
  ];
  await request(page, 'saveWorkflow', { bundle: workflow.bundle, expectedRevision: 0 });
  const process: ProcessDefinition = {
    id: 'process_clone_ui',
    name: 'Clone UI original',
    appId: 'fb',
    workflowId: workflow.workflowId,
    workflowVersionId: null,
    deviceId: null,
    accountId: null,
    targetId: null,
    revision: 0,
    archived: false,
    fields: { enabled: false, apiToken: 'fixture-only-value' },
    schedule: {
      timezone: 'Asia/Ho_Chi_Minh',
      startDate: '2035-01-01',
      slots: ['08:00'],
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      overduePolicy: 'NEXT_FUTURE_SLOT',
      jitterMinutes: 0,
    },
  };
  await request(page, 'saveProcess', { process, expectedRevision: null });
  await request(page, 'saveContent', {
    item: {
      id: 'content_clone_ui',
      processId: process.id,
      revision: 0,
      fields: {
        caption: 'Clone keeps values',
        count: 0,
        flag: false,
        tags: ['first\nline', 'second'],
      },
      assetIds: [],
      ignored: false,
    },
    expectedRevision: null,
  });
  await page.reload();
  await page.locator('[data-route="processes"]').click();
  await page.getByRole('combobox', { name: 'Chọn tiến trình' }).selectOption(process.id);
  const before = await request<ProcessDefinition[]>(page, 'listProcesses', {});
  await page.getByRole('button', { name: 'Nhân bản tiến trình', exact: true }).click();
  await page.getByRole('textbox', { name: 'Tên tiến trình bản sao' }).fill('Clone UI copy');
  await page.getByRole('button', { name: 'Xem trước bản sao', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('1 nội dung');
  await expect(page.getByRole('dialog')).toContainText('apiToken');
  await expect(page.getByRole('dialog')).not.toContainText('fixture-only-value');
  expect(await request<ProcessDefinition[]>(page, 'listProcesses', {})).toHaveLength(before.length);
  await page.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click();
  expect(await request<ProcessDefinition[]>(page, 'listProcesses', {})).toHaveLength(before.length);
  await page.getByRole('button', { name: 'Nhân bản tiến trình', exact: true }).click();
  await page.getByRole('textbox', { name: 'Tên tiến trình bản sao' }).fill('Clone UI copy');
  await page.getByRole('button', { name: 'Xem trước bản sao', exact: true }).click();
  await page.getByRole('button', { name: 'Áp dụng nhân bản', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const selected = page.getByRole('combobox', { name: 'Chọn tiến trình' });
  await expect(selected).not.toHaveValue(process.id);
  const copyId = await selected.inputValue();
  const content = await request<ContentItem[]>(page, 'content', { processId: copyId });
  expect(content).toHaveLength(1);
  expect(content[0]!.id).not.toBe('content_clone_ui');
  expect(content[0]!.fields).toEqual({
    caption: 'Clone keeps values',
    count: 0,
    flag: false,
    tags: ['first\nline', 'second'],
  });
  const copy = (await request<ProcessDefinition[]>(page, 'listProcesses', {})).find(
    (p) => p.id === copyId,
  )!;
  expect(copy.fields).toEqual({ enabled: false });
  expect(copy).toMatchObject({ deviceId: null, accountId: null, targetId: null });
  await request(page, 'saveContent', {
    item: { ...content[0]!, fields: { ...content[0]!.fields, caption: 'Copy changed' } },
    expectedRevision: content[0]!.revision,
  });
  expect(
    (await request<ContentItem[]>(page, 'content', { processId: process.id }))[0]!.fields.caption,
  ).toBe('Clone keeps values');
});
