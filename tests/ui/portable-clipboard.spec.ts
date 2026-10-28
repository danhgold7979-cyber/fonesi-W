import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { WorkflowDraft } from '@autoreels/contracts';

async function request<T>(page: Page, command: string, input: unknown = {}): Promise<T> {
  const token = await page.locator('meta[name="studio-token"]').getAttribute('content');
  const response = await page.request.post('/api', {
    headers: { Origin: 'http://127.0.0.1:4175', 'X-Studio-Token': token! },
    data: { operationId: 'op_' + crypto.randomUUID().replaceAll('-', ''), command, input },
  });
  const body = (await response.json()) as { ok: boolean; value: T; error?: unknown };
  expect(body.ok, JSON.stringify(body.error)).toBe(true);
  return body.value;
}

test('clipboard crosses same-app workflow editors, remaps nodes and ignores ordinary external text', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:4175',
  });
  await page.goto('/');
  const source = await request<WorkflowDraft>(page, 'createWorkflow', {
    appId: 'fb', name: 'Portable source',
  });
  const g = source.bundle.graphs[0]!;
  g.nodes = [
    { id: 'start', type: 'start', name: 'Start', x: 0, y: 100, config: {} },
    { id: 'wait_a', type: 'wait', name: 'Wait', x: 260, y: 100, config: { minMs: 500, maxMs: 1000 } },
    { id: 'log_a', type: 'log', name: 'Log', x: 520, y: 100, config: { level: 'info', messageTemplate: 'ok', redactionPolicy: 'default' } },
    { id: 'end', type: 'end', name: 'End', x: 780, y: 100, config: {} },
  ];
  g.edges = [
    { id: 'e1', source: 'start', target: 'wait_a', port: 'next' },
    { id: 'e2', source: 'wait_a', target: 'log_a', port: 'next' },
    { id: 'e3', source: 'log_a', target: 'end', port: 'next' },
  ];
  await request(page, 'saveWorkflow', { bundle: source.bundle, expectedRevision: source.revision });
  const destination = await request<WorkflowDraft>(page, 'createWorkflow', {
    appId: 'fb', name: 'Portable destination',
  });
  await page.reload();
  await page.locator('[data-route="library"]').click();
  await page.getByRole('button', { name: /Portable source/ }).click();
  await expect(page.locator('.react-flow__node-studio')).toHaveCount(4);
  await page.locator('.react-flow__node[data-id="wait_a"]').click();
  await page.locator('.react-flow__node[data-id="log_a"]').click({ modifiers: ['Shift'] });
  await page.keyboard.press('Control+c');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain(
    'AUTOREELS_STUDIO_NODES_V1',
  );
  await page.locator('[data-route="library"]').click();
  await page.getByRole('button', { name: /Portable destination/ }).click();
  await expect(page.locator('.react-flow__node-studio')).toHaveCount(2);
  await page.locator('[data-testid="canvas"]').focus();
  await page.keyboard.press('Control+v');
  await expect(page.locator('.react-flow__node-studio')).toHaveCount(4);
  await page.getByRole('button', { name: '▣ Lưu', exact: true }).click();
  await expect(page.locator('.editor-status')).toContainText('Đã lưu cục bộ');
  const saved = await request<WorkflowDraft>(page, 'loadWorkflow', { id: destination.workflowId });
  expect(saved.bundle.graphs[0]!.nodes).toHaveLength(4);
  expect(saved.bundle.graphs[0]!.nodes.map((n) => n.id)).not.toContain('wait_a');
  expect(saved.bundle.graphs[0]!.nodes.map((n) => n.name)).toEqual(
    expect.arrayContaining(['Wait', 'Log']),
  );
  await page.evaluate(() => navigator.clipboard.writeText('ordinary user note'));
  await page.locator('[data-testid="canvas"]').focus();
  await page.keyboard.press('Control+v');
  await expect(page.locator('.react-flow__node-studio')).toHaveCount(4);
});
