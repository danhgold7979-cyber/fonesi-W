import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { WorkflowBundle, WorkflowDraft } from '@autoreels/contracts';

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
async function openChain(page: Page, name: string) {
  await page.goto('/');
  const draft = await request<WorkflowDraft>(page, 'createWorkflow', { appId: 'fb', name });
  const g = draft.bundle.graphs[0]!;
  g.nodes = [
    { id: 'start', type: 'start', name: 'Start', x: 0, y: 100, config: {} },
    { id: 'wait_one', type: 'wait', name: 'First step', x: 270, y: 100, config: {} },
    {
      id: 'wait_two',
      type: 'log',
      name: 'Second step',
      x: 540,
      y: 100,
      config: { messageTemplate: 'Trace chain' },
    },
    { id: 'end', type: 'end', name: 'End', x: 810, y: 100, config: {} },
  ];
  g.edges = [
    { id: 'enter', source: 'start', target: 'wait_one', port: 'next' },
    { id: 'inside', source: 'wait_one', target: 'wait_two', port: 'next' },
    { id: 'leave', source: 'wait_two', target: 'end', port: 'next' },
  ];
  await request(page, 'saveWorkflow', { bundle: draft.bundle, expectedRevision: draft.revision });
  await page.reload();
  await page.locator('[data-route="library"]').click();
  await page.getByRole('button', { name: new RegExp('^' + name) }).click();
  await expect(page.locator('.react-flow__node-studio')).toHaveCount(4);
  return draft;
}
async function selectMiddle(page: Page) {
  await page.locator('.react-flow__node[data-id="wait_one"]').click();
  await page.locator('.react-flow__node[data-id="wait_two"]').click({ modifiers: ['Shift'] });
}
async function savedBundle(page: Page, id: string): Promise<WorkflowBundle> {
  await page.getByRole('button', { name: '▣ Lưu', exact: true }).click();
  await expect(page.locator('.editor-status')).toContainText('Đã lưu cục bộ');
  return (await request<WorkflowDraft>(page, 'loadWorkflow', { id })).bundle;
}

test('group collapse preserves crossing wires and group drag persists every member without execution changes', async ({
  page,
}) => {
  const draft = await openChain(page, 'Group completion');
  await selectMiddle(page);
  await page.getByRole('button', { name: 'Gom nhóm vùng chọn', exact: true }).click();
  await page.getByRole('button', { name: 'Thu nhóm', exact: true }).click();
  await expect(page.locator('.canvas-visual-group.collapsed')).toHaveCount(1);
  await expect(page.locator('.react-flow__node-studio')).toHaveCount(2);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  const header = await page.locator('.group-drag-handle strong').boundingBox();
  expect(header).not.toBeNull();
  await page.mouse.move(header!.x + 10, header!.y + 5);
  await page.mouse.down();
  await page.mouse.move(header!.x + 65, header!.y + 35, { steps: 8 });
  await page.mouse.up();
  const b = await savedBundle(page, draft.workflowId),
    g = b.graphs[0]!;
  expect(g.groups![0]!.collapsed).toBe(true);
  expect(g.nodes.find((n) => n.id === 'wait_one')!.x).toBeGreaterThan(270);
  expect(
    g.nodes.find((n) => n.id === 'wait_two')!.x - g.nodes.find((n) => n.id === 'wait_one')!.x,
  ).toBe(270);
  expect(g.edges).toEqual(draft.bundle.graphs[0]!.edges);
  await page.getByRole('button', { name: 'Mở nhóm', exact: true }).click();
  await expect(page.locator('.react-flow__node-studio')).toHaveCount(4);
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);
  await page.getByRole('button', { name: '▷ Chạy thử TRACE' }).click();
  await expect(page.locator('.bottom-panel')).toContainText('COMPLETED');
});

test('selection conversion and wire waypoints survive save/reload with the complete subflow bundle', async ({
  page,
}) => {
  const draft = await openChain(page, 'Subflow completion');
  const edge = page.locator('.react-flow__edge[data-id="enter"] .react-flow__edge-interaction');
  await edge.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Đặt điểm bẻ dây tại đây', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Kéo điểm bẻ dây', exact: true })).toBeVisible();
  const routed = await savedBundle(page, draft.workflowId);
  expect(routed.graphs[0]!.edges.find((e) => e.id === 'enter')!.reroute).toBeDefined();
  await selectMiddle(page);
  await page.locator('.react-flow__node[data-id="wait_two"]').click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: 'Chuyển vùng chọn thành quy trình con', exact: true })
    .click();
  await page.getByRole('dialog').getByRole('textbox').fill('Extracted steps');
  await page.getByRole('button', { name: 'Chuyển vùng chọn', exact: true }).click();
  await expect(page.locator('.react-flow__node-studio')).toHaveCount(3);
  const extracted = await savedBundle(page, draft.workflowId);
  expect(extracted.graphs).toHaveLength(2);
  expect(extracted.graphs[1]!.nodes.map((n) => n.id)).toEqual(
    expect.arrayContaining(['wait_one', 'wait_two']),
  );
  await page.getByRole('button', { name: '▷ Chạy thử TRACE' }).click();
  await expect(page.locator('.bottom-panel')).toContainText('COMPLETED');
  await page.reload();
  await page.locator('[data-route="library"]').click();
  await page.getByRole('button', { name: /^Subflow completion/ }).click();
  await page.locator('.react-flow__node-studio').filter({ hasText: 'Extracted steps' }).dblclick();
  await expect(page.locator('.breadcrumbs')).toContainText('Extracted steps');
  await expect(page.locator('.react-flow__node-studio')).toHaveCount(4);
});

test('debug controls operate a frozen TRACE session and resume past a breakpoint once', async ({
  page,
}) => {
  const draft = await openChain(page, 'Debugger completion');
  await page.locator('.react-flow__node[data-id="wait_one"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Bật/tắt breakpoint', exact: true }).click();
  await savedBundle(page, draft.workflowId);
  await page.getByRole('button', { name: 'Menu workflow', exact: true }).click();
  await page
    .locator('.workflow-more')
    .getByRole('button', { name: 'Debug TRACE', exact: true })
    .click();
  const debug = page.getByRole('region', { name: 'Debug TRACE' });
  await debug.getByRole('button', { name: 'Bắt đầu Debug TRACE', exact: true }).click();
  await expect(debug).toContainText('PAUSED');
  await expect(debug).toContainText('Điểm dừng: entry');
  await debug.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(debug).toContainText('Điểm dừng: breakpoint');
  await expect(debug).toContainText('wait_one');
  await debug.getByRole('button', { name: 'Bước qua', exact: true }).click();
  await expect(debug).toContainText('Điểm dừng: step');
  await expect(debug.locator('.debug-state')).toContainText('wait_two');
  await debug.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(debug).toContainText('Kết quả debug: COMPLETED');
  await expect(debug.getByRole('button', { name: 'Dừng debug', exact: true })).toBeDisabled();
});
