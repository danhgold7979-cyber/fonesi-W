import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import type { WorkflowDraft, ProcessDefinition, WorkflowBundle } from '@autoreels/contracts';

async function request<T>(page: Page, command: string, input: unknown = {}): Promise<T> {
  const token = await page.locator('meta[name="studio-token"]').getAttribute('content');
  const response = await page.request.post('/api', {
    headers: { Origin: 'http://127.0.0.1:4175', 'X-Studio-Token': token! },
    data: { operationId: 'op_' + crypto.randomUUID().replaceAll('-', ''), command, input },
  });
  const result = (await response.json()) as { ok: boolean; value: T; error?: unknown };
  expect(result.ok, JSON.stringify(result.error)).toBe(true);
  return result.value;
}
test('actual authoring: create, insert, type-safe inputs, save/reload, subgraphs/version/export/import', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('[data-route]')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'Chưa có điện thoại kết nối' })).toBeVisible();
  await page.getByRole('button', { name: '＋ Tạo workflow trước' }).click();
  await page.getByRole('textbox', { name: 'Tên workflow', exact: true }).fill('UI workflow');
  await page.getByRole('dialog').getByRole('button', { name: 'Tạo workflow', exact: true }).click();
  await expect(page.getByTestId('canvas')).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(page.locator('.workflow-header .actions > button')).toHaveCount(4);
  await page.locator('.react-flow__edge-interaction').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Chèn node trên dây' }).click();
  await page.getByRole('textbox', { name: 'Tìm lệnh hoặc node' }).fill('wait');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: / wait$/ })
    .click();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  const node = page
    .locator('.react-flow__node')
    .filter({ has: page.locator('small').filter({ hasText: /^wait ·/ }) });
  await node.click();
  const name = page.getByRole('textbox', { name: 'Tên node', exact: true });
  await name.fill('Chờ đã lưu');
  await name.press('Tab');
  await page.keyboard.press('Control+s');
  await expect(page.locator('.editor-status')).toContainText('Đã lưu cục bộ');
  await page.getByRole('button', { name: 'Menu workflow', exact: true }).click();
  await page.getByRole('button', { name: 'Khai báo Inputs', exact: true }).click();
  for (const [index, key, type] of [
    [1, 'count', 'number'],
    [2, 'enabled', 'boolean'],
    [3, 'caption', 'text'],
  ] as const) {
    await page.getByRole('button', { name: '＋ Thêm trường' }).click();
    await page.getByRole('textbox', { name: 'Key field ' + index }).fill(key);
    await page.getByRole('combobox', { name: 'Kiểu field ' + index }).selectOption(type);
  }
  await page.getByRole('button', { name: 'Lưu schema', exact: true }).click();
  await page.getByRole('button', { name: 'Menu workflow', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo quy trình con', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Child custom');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Tạo quy trình con', exact: true })
    .click();
  await expect(page.locator('.breadcrumbs')).toContainText('Child custom');
  await page.locator('.breadcrumbs button').first().click();
  await page.keyboard.press('Control+s');
  await expect(page.locator('.editor-status')).toContainText('Đã lưu cục bộ');
  await page.getByRole('button', { name: 'Menu workflow', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo phiên bản', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('v1');
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
  await page.getByRole('button', { name: 'Menu workflow', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất workflow JSON', exact: true }).click();
  const downloaded = await downloading;
  const bundle: WorkflowBundle = JSON.parse(await readFile((await downloaded.path())!, 'utf8'));
  expect(bundle.graphs).toHaveLength(2);
  expect(bundle.inputs.map((f) => f.type)).toEqual(['number', 'boolean', 'text']);
  await page.reload();
  await page.locator('[data-route="library"]').click();
  await page.getByRole('button', { name: /^UI workflow/ }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.locator('.canvas-wrap')).toContainText('Chờ đã lưu');
  await node.click();
  await name.press('Control+a');
  await name.press('Delete');
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await name.fill('Chờ đã lưu');
  await name.press('Tab');
  await page.locator('[data-route="library"]').click();
  await page.getByRole('combobox', { name: 'Lọc ứng dụng thư viện' }).selectOption('tt');
  await page.locator('[data-route="inspector"]').click();
  await expect(page.locator('.workflow-title')).toContainText('Facebook');
  await page.getByRole('button', { name: '✓ Kiểm tra' }).click();
  await expect(page.locator('.toast')).toContainText('Graph hợp lệ');
  await page.getByRole('button', { name: '▷ Chạy thử TRACE' }).click();
  await expect(page.locator('.bottom-panel')).toContainText('COMPLETED');
  await page.locator('[data-route="library"]').click();
  bundle.workflow.name = 'Imported round-trip';
  await page.locator('input[type="file"]').setInputFiles({
    name: 'workflow.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bundle)),
  });
  await expect(page.locator('.workflow-title')).toContainText('Imported round-trip');
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await mkdir('docs/evidence/implementation/ui', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/implementation/ui/inspector-1600.png' });
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect(errors).toEqual([]);
});

test('Process isolation and save acknowledgements preserve edits made while a request is pending', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-route]')).toHaveCount(6);
  const draft = await request<WorkflowDraft>(page, 'createWorkflow', {
    appId: 'fb',
    name: 'Process fixture workflow',
  });
  draft.bundle.inputs = [{ key: 'caption', type: 'text', scope: 'row', required: false }];
  await request(page, 'saveWorkflow', { bundle: draft.bundle, expectedRevision: 0 });
  const process = (id: string, slot: string): ProcessDefinition => ({
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
      slots: [slot],
      weekdays: [1, 3, 5],
      overduePolicy: 'NEXT_FUTURE_SLOT',
      jitterMinutes: 0,
    },
  });
  for (const [id, slot, text] of [
    ['process_A', '08:00', 'ONLY_A'],
    ['process_B', '09:30', 'ONLY_B'],
  ]) {
    await request(page, 'saveProcess', { process: process(id!, slot!), expectedRevision: null });
    await request(page, 'saveContent', {
      item: {
        id: 'content_' + id,
        processId: id,
        revision: 0,
        fields: { caption: text },
        assetIds: [],
        ignored: false,
      },
      expectedRevision: null,
    });
  }
  await page.reload();
  await page.locator('[data-route="processes"]').click();
  let delayContent = true,
    delaySave = true;
  await page.route('**/api', async (route) => {
    const request = route.request().postDataJSON() as {
      command: string;
      input: { processId?: string; process?: { id: string } };
    };
    if (request.command === 'content' && request.input.processId === 'process_A' && delayContent) {
      delayContent = false;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    if (
      request.command === 'saveProcess' &&
      request.input.process?.id === 'process_B' &&
      delaySave
    ) {
      delaySave = false;
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({ response });
      return;
    }
    await route.continue();
  });
  const selection = page.getByRole('combobox', { name: 'Chọn tiến trình' });
  await selection.selectOption('process_A');
  await selection.selectOption('process_B');
  await expect(page.locator('.table-wrap')).toContainText('ONLY_B');
  await expect(page.locator('.table-wrap')).not.toContainText('ONLY_A');
  const name = page.getByRole('textbox', { name: 'Tên tiến trình' });
  await name.fill('Before pending save');
  await page.getByRole('button', { name: '▣ Lưu tiến trình', exact: true }).click();
  await name.fill('Edited during save');
  await expect(page.getByRole('button', { name: '▣ Lưu tiến trình', exact: true })).toBeDisabled();
  await page.reload();
  await page.locator('[data-route="processes"]').click();
  await selection.selectOption('process_B');
  await expect(name).toHaveValue('Edited during save');
  await expect(page.getByRole('button', { name: 'Chọn thư mục', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Chọn tệp', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Nguồn media' })).toContainText('cần bản desktop');
  expect(await request(page, 'mediaCapabilities')).toEqual({ nativeChooser: false });
  await selection.selectOption('process_A');
  await expect(page.locator('.table-wrap')).toContainText('ONLY_A');
  await expect(page.locator('.table-wrap')).not.toContainText('ONLY_B');
  await page.getByRole('button', { name: 'Sửa content_process_A', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'caption', exact: true })).toHaveValue('ONLY_A');
  await expect(
    page.getByRole('textbox', { name: 'Dữ liệu nội dung JSON', exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole('textbox', { name: 'caption', exact: true })
    .fill('ONLY_A\nGiữ nguyên dòng thứ hai');
  await page.getByRole('button', { name: 'Lưu nội dung', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.table-wrap')).toContainText('Giữ nguyên dòng thứ hai');
  await page.getByRole('button', { name: 'Xem trước lịch (1)', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Chưa gán điện thoại');
  await expect(page.getByRole('dialog').locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Áp dụng lịch' })).toBeDisabled();
});

test('loopback host rejects forged origins/tokens and privileged commands', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-route]')).toHaveCount(6);
  const response = await page.request.post('/api', {
    headers: { Origin: 'https://evil.invalid', 'X-Studio-Token': 'wrong' },
    data: {
      operationId: 'op_bad',
      command: 'createWorkflow',
      input: { appId: 'fb', name: 'forged' },
    },
  });
  expect(response.status()).toBe(403);
  const token = await page.locator('meta[name="studio-token"]').getAttribute('content');
  const unknown = await page.request.post('/api', {
    headers: { Origin: 'http://127.0.0.1:4175', 'X-Studio-Token': token! },
    data: { operationId: 'op_bad', command: 'shell', input: { command: 'whoami' } },
  });
  expect(unknown.status()).toBe(400);
  for (const [command, input] of [
    ['source.register', { processId: 'process_A', rootPath: '/tmp' }],
    [
      'chooseSource',
      {
        processId: 'process_A',
        expectedRevision: 0,
        kind: 'FOLDER',
        recursive: false,
        watch: false,
        rootPath: '/tmp',
      },
    ],
    [
      'chooseSource',
      {
        processId: 'process_A',
        expectedRevision: 0,
        kind: 'FOLDER',
        recursive: false,
        watch: false,
      },
    ],
  ]) {
    const blocked = await page.request.post('/api', {
      headers: { Origin: 'http://127.0.0.1:4175', 'X-Studio-Token': token! },
      data: { operationId: 'op_media_boundary', command, input },
    });
    expect(blocked.status()).toBe(400);
  }
});

test('typed content form preserves zero, false, missing fields and ordered multiline list items', async ({
  page,
}) => {
  await page.goto('/');
  const draft = await request<WorkflowDraft>(page, 'createWorkflow', {
    appId: 'fb',
    name: 'Typed content fixture',
  });
  draft.bundle.inputs = [
    { key: 'count', type: 'number', scope: 'row', required: true },
    { key: 'enabled', type: 'boolean', scope: 'row', required: true },
    { key: 'caption', type: 'text', scope: 'row', required: false },
    { key: 'tags', type: 'list', itemType: 'text', scope: 'row', required: false },
    { key: 'link', type: 'url', scope: 'row', required: false },
  ];
  await request(page, 'saveWorkflow', { bundle: draft.bundle, expectedRevision: 0 });
  await request(page, 'saveProcess', {
    expectedRevision: null,
    process: {
      id: 'process_typed_form',
      name: 'Typed content fixture',
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
  await page.reload();
  await page.locator('[data-route="processes"]').click();
  await page.getByRole('combobox', { name: 'Chọn tiến trình' }).selectOption('process_typed_form');
  await page.getByRole('button', { name: '＋ Thêm nội dung', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'count', exact: true })).toHaveValue('0');
  await expect(page.getByRole('checkbox', { name: 'enabled', exact: true })).not.toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: 'Dùng trường link', exact: true }),
  ).not.toBeChecked();
  await page.getByRole('textbox', { name: 'caption', exact: true }).fill('Văn bản\nnhiều dòng');
  await page.getByRole('button', { name: '＋ Thêm mục tags', exact: true }).click();
  await page.getByRole('button', { name: '＋ Thêm mục tags', exact: true }).click();
  await page.getByRole('textbox', { name: 'tags mục 1', exact: true }).fill('Một\nitem nhiều dòng');
  await page.getByRole('textbox', { name: 'tags mục 2', exact: true }).fill('Hai');
  await page.getByRole('button', { name: 'Đưa lên tags mục 2', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'tags mục 1', exact: true })).toHaveValue('Hai');
  await page.screenshot({ path: 'docs/evidence/implementation/ui/content-form-1600.png' });
  await page.getByRole('button', { name: 'Lưu nội dung', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const rows = await request<{ fields: Record<string, unknown> }[]>(page, 'content', {
    processId: 'process_typed_form',
  });
  expect(rows[0]?.fields).toEqual({
    count: 0,
    enabled: false,
    caption: 'Văn bản\nnhiều dòng',
    tags: ['Hai', 'Một\nitem nhiều dòng'],
  });
  await page.getByRole('button', { name: /^Bỏ qua content_/ }).click();
  await expect(page.locator('.table-empty')).toBeVisible();
  expect(await request(page, 'content', { processId: 'process_typed_form' })).toEqual([]);
});

test('canvas clipboard preserves wires/groups through paste, cut, undo and persisted reload', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-route="library"]').click();
  await page.getByRole('button', { name: '＋ Workflow mới', exact: true }).click();
  await page.getByRole('textbox', { name: 'Tên workflow', exact: true }).fill('Clipboard groups');
  await page.getByRole('dialog').getByRole('button', { name: 'Tạo workflow', exact: true }).click();
  const canvas = page.getByTestId('canvas');
  await canvas.focus();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+g');
  await expect(page.locator('.canvas-visual-group')).toHaveCount(1);
  const groupName = page.getByRole('textbox', { name: /Tên nhóm group_/ });
  await groupName.fill('My selected group');
  await groupName.press('Tab');
  await canvas.focus();
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await expect(page.locator('.react-flow__node-studio')).toHaveCount(4);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await expect(page.locator('.canvas-visual-group')).toHaveCount(2);
  await page.keyboard.press('Control+x');
  await expect(page.locator('.react-flow__node-studio')).toHaveCount(2);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.react-flow__node-studio')).toHaveCount(4);
  await page.keyboard.press('Control+s');
  await expect(page.locator('.editor-status')).toContainText('Đã lưu cục bộ');
  await page.reload();
  await page.locator('[data-route="library"]').click();
  await page.getByRole('button', { name: /^Clipboard groups/ }).click();
  await expect(page.locator('.react-flow__node-studio')).toHaveCount(4);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await expect(page.locator('.canvas-visual-group')).toHaveCount(2);
  await page.getByRole('button', { name: 'Bỏ nhóm', exact: true }).first().click();
  await expect(page.locator('.canvas-visual-group')).toHaveCount(1);
  await expect(page.locator('.react-flow__node-studio')).toHaveCount(4);
  await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
  await expect(page.locator('.canvas-visual-group')).toHaveCount(2);
});
