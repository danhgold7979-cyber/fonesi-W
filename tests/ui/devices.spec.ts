import { expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startAdbFixture } from '../fixtures/adb-server.js';
let directory: string, child: ChildProcess, adb: Awaited<ReturnType<typeof startAdbFixture>>;
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'autoreels-device-ui-'));
  adb = await startAdbFixture();
  child = spawn(process.execPath, ['apps/desktop/dist/host/host/server.js'], {
    env: {
      ...process.env,
      AUTOREELS_DATA_DIR: directory,
      PORT: '4177',
      AUTOREELS_ADB_SERVER_PORT: String(adb.port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Device fixture host startup timeout')), 10000);
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
      reject(new Error('Device fixture host exit ' + code));
    });
  });
});
test.afterAll(async () => {
  if (child && child.exitCode === null) {
    const stopped = once(child, 'exit');
    child.kill('SIGTERM');
    await stopped;
  }
  if (adb) await adb.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});
test('device UI uses real TCP provider/SQLite registry and scopes manual actions, enabled state and Process context', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:4177/');
  const card = page.locator('.device-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Fixture Phone');
  await expect(page.getByText('Android đã kết nối', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chọn SDK', exact: true })).toBeDisabled();
  adb.state.list += '192.168.1.2:5555\tdevice product:fixture model:Fixture_Phone transport_id:2\n';
  await page.getByRole('button', { name: 'Quét thiết bị', exact: true }).click();
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('TCP · Đã kết nối');
  await card.getByRole('button', { name: 'Chi tiết / điều khiển', exact: true }).click();
  await page.getByRole('button', { name: 'Chụp màn hình', exact: true }).click();
  const image = page.getByRole('img', { name: 'Ảnh chụp Fixture Phone', exact: true });
  await expect(image).toBeVisible();
  await page.getByRole('checkbox', { name: 'Cho phép thao tác trên ảnh', exact: true }).check();
  await image.click({ position: { x: 20, y: 30 } });
  await expect
    .poll(() => adb.state.shells.filter((s) => s.startsWith("'input' 'tap'")).length)
    .toBe(1);
  await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect.poll(() => adb.state.shells.includes("'input' 'keyevent' '3'")).toBe(true);
  await expect(page.getByRole('button', { name: 'Ứng dụng', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Ứng dụng', exact: true }).click();
  await page.getByRole('button', { name: 'Đọc ứng dụng', exact: true }).click();
  const facebook = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'com.facebook.katana', exact: true }) });
  await expect(facebook).toBeVisible();
  await expect(
    page
      .getByRole('row')
      .filter({ has: page.getByRole('cell', { name: 'com.android.settings', exact: true }) })
      .getByRole('button', { name: 'Force-stop', exact: true }),
  ).toBeDisabled();
  await facebook.getByRole('button', { name: 'Force-stop', exact: true }).click();
  await expect
    .poll(() => adb.state.shells.includes("'am' 'force-stop' '--user' '0' 'com.facebook.katana'"))
    .toBe(true);
  await page.getByRole('button', { name: 'Kết nối', exact: true }).click();
  const name = page.getByRole('textbox', { name: 'Tên thiết bị', exact: true });
  await name.fill('My fixture phone');
  await page.getByRole('button', { name: 'Lưu tên', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('My fixture phone');
  await page.getByRole('button', { name: 'Chụp màn hình', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'Ảnh chụp My fixture phone', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'docs/evidence/implementation/ui/device-controls-1600.png' });
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
  const toggle = card.getByRole('checkbox', { name: /Bật thiết bị/ });
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
  await expect(toggle).toBeEnabled();
  await page.reload();
  await expect(card).toContainText('My fixture phone');
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(toggle).toBeChecked();
  await expect(toggle).toBeEnabled();
  await page.getByRole('button', { name: '＋ Kết nối LAN', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Nhớ và tự kết nối lại' })).toBeChecked();
  await page
    .getByRole('textbox', { name: 'Endpoint kết nối', exact: true })
    .fill('192.168.1.2:5555');
  await page.getByRole('button', { name: 'Kết nối endpoint', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tắt tự kết nối', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Tắt tự kết nối', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bật tự kết nối', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
  await page.reload();
  await page.getByRole('button', { name: '＋ Kết nối LAN', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bật tự kết nối', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
  const deviceId = await card.getAttribute('data-device-id');
  const inputsBefore = adb.state.shells.filter((s) => s.startsWith("'input'")).length;
  await card.getByRole('button', { name: 'Inspector', exact: true }).click();
  await page.getByRole('button', { name: 'Chụp cây và ảnh', exact: true }).click();
  const inspectorImage = page.getByRole('img', { name: 'Inspector My fixture phone', exact: true });
  await expect(inspectorImage).toBeVisible();
  await inspectorImage.click({ position: { x: 40, y: 40 } });
  await expect(page.getByRole('textbox', { name: 'Selector JSON', exact: true })).toHaveValue(
    /com.facebook.katana:id\/submit/,
  );
  await expect(page.getByRole('status').filter({ hasText: '1 phần tử khớp' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Tìm phần tử UI', exact: true }).fill('submit');
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await page
    .getByRole('textbox', { name: 'Selector JSON', exact: true })
    .fill(JSON.stringify({ version: 1, all: [{ field: 'text', op: 'EQ', value: 'not present' }] }));
  await expect(page.getByRole('status').filter({ hasText: '0 phần tử khớp' })).toBeVisible();
  expect(adb.state.shells.filter((s) => s.startsWith("'input'")).length).toBe(inputsBefore);
  await page.screenshot({ path: 'docs/evidence/implementation/ui/xml-inspector-1600.png' });
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
  await card.getByRole('button', { name: 'Tiến trình', exact: true }).click();
  await expect(page.locator('.process-selector')).toContainText('My fixture phone');
  await page.getByRole('button', { name: '＋ Tiến trình mới', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Điện thoại tiến trình' })).toHaveValue(
    deviceId!,
  );
});

test('editor test device opens the shared read-only Inspector and requires manual key consent', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:4177/');
  const card = page.locator('.device-card');
  await expect(card).toHaveCount(1);
  const id = await card.getAttribute('data-device-id');
  await page.locator('[data-route="library"]').click();
  await page.getByRole('button', { name: '＋ Workflow mới', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Tên workflow', exact: true })
    .fill('Inspector device scope');
  await page.getByRole('dialog').getByRole('button', { name: 'Tạo workflow', exact: true }).click();
  const chooser = page.getByRole('combobox', { name: 'Điện thoại kiểm thử', exact: true });
  await expect(chooser.locator('option')).toHaveCount(2);
  await expect(chooser).toHaveValue('');
  await chooser.selectOption(id!);
  const home = page.getByRole('button', { name: 'Điện thoại HOME', exact: true });
  await expect(home).toBeDisabled();
  await page.getByRole('button', { name: 'Chọn phần tử / Inspector', exact: true }).click();
  await page.getByRole('button', { name: 'Chụp cây và ảnh', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'Inspector My fixture phone', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
  await expect(chooser).toHaveValue(id!);
  await page.getByRole('checkbox', { name: 'Cho phép phím thủ công' }).check();
  await expect(home).toBeEnabled();
  const before = adb.state.shells.filter((s) => s === "'input' 'keyevent' '3'").length;
  await home.click();
  await expect
    .poll(() => adb.state.shells.filter((s) => s === "'input' 'keyevent' '3'").length)
    .toBe(before + 1);
});
