import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { WorkflowDraft, WorkspaceBackupResult, WorkspaceStatus } from '@autoreels/contracts';

async function request(page: Page, command: string, input: unknown) {
  const token = await page.locator('meta[name="studio-token"]').getAttribute('content');
  const response = await page.request.post('/api', {
    headers: { Origin: 'http://127.0.0.1:4175', 'X-Studio-Token': token! },
    data: { operationId: 'op_workspace_ui', command, input },
  });
  const result = await response.json();
  expect(result.ok, JSON.stringify(result.error)).toBe(true);
  return result.value;
}
test('workspace panel saves pending Process changes, creates a verified backup and downloads only allowlisted diagnostics', async ({
  page,
}) => {
  await page.goto('/');
  const workflow = await request(page, 'createWorkflow', { appId: 'fb', name: 'Backup private schema' }) as WorkflowDraft;
  workflow.bundle.inputs = [{ key: 'tokenFixture', type: 'text', scope: 'process', required: false }];
  await request(page, 'saveWorkflow', { bundle: workflow.bundle, expectedRevision: 0 });
  await request(page, 'saveProcess', {
    process: {
      id: 'process_backup_ui',
      name: 'Private backup fixture name',
      appId: 'fb',
      workflowId: workflow.workflowId,
      workflowVersionId: null,
      deviceId: null,
      accountId: null,
      targetId: null,
      revision: 0,
      archived: false,
      fields: { tokenFixture: 'private-field-value-do-not-export' },
      schedule: {
        timezone: 'Asia/Ho_Chi_Minh',
        startDate: '2035-01-01',
        slots: ['08:00'],
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        overduePolicy: 'NEXT_FUTURE_SLOT',
        jitterMinutes: 0,
      },
    },
    expectedRevision: null,
  });
  await page.reload();
  await page.locator('[data-route="processes"]').click();
  await page.getByRole('combobox', { name: 'Chọn tiến trình' }).selectOption('process_backup_ui');
  await page.getByLabel('Tên tiến trình', { exact: true }).fill('Saved by backup action');
  await page.getByRole('button', { name: 'Chẩn đoán và sao lưu workspace' }).click();
  await expect(page.getByRole('table', { name: 'Tình trạng workspace' })).toContainText(
    'quick check: ok',
  );
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api') &&
      response.request().postDataJSON()?.command === 'createWorkspaceBackup',
  );
  await page.getByRole('button', { name: 'Tạo bản sao lưu đã kiểm tra', exact: true }).click();
  const response = await responsePromise,
    result = (await response.json()) as { ok: boolean; value: WorkspaceBackupResult };
  expect(result.ok).toBe(true);
  expect(result.value.receipt.integrity).toBe('ok');
  await expect(page.getByLabel('Receipt sao lưu', { exact: true })).toContainText(
    result.value.receipt.sha256,
  );
  const bootstrap = await request(page, 'bootstrap', {});
  expect(bootstrap.processes.find((p: { id: string }) => p.id === 'process_backup_ui').name).toBe(
    'Saved by backup action',
  );
  const retry = await request(page, 'createWorkspaceBackup', { backupId: result.value.receipt.id });
  expect(retry).toEqual({ ...result.value, alreadyCreated: true });
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải báo cáo chẩn đoán JSON', exact: true }).click();
  const download = await downloaded,
    stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const json = Buffer.concat(chunks).toString('utf8'),
    diagnostic = JSON.parse(json) as WorkspaceStatus;
  expect(download.suggestedFilename()).toMatch(/^autoreels-diagnostics-.*\.json$/);
  expect(diagnostic).toMatchObject({
    format: 'autoreels-diagnostics-v1',
    database: { integrity: 'ok' },
  });
  for (const privateValue of [
    'process_backup_ui',
    'Private backup fixture name',
    'Saved by backup action',
    'private-field-value-do-not-export',
    'rootPath',
    'hostId',
    'serial',
    'preferences',
  ])
    expect(json).not.toContain(privateValue);
});
