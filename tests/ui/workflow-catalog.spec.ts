import { expect, test } from '@playwright/test';

const templates = [
  {
    id: 'facebook-page-video-comments',
    target: 'Fanpage',
    media: '01 video',
  },
  {
    id: 'facebook-page-photo-comments',
    target: 'Fanpage',
    media: 'Ảnh hoặc album',
  },
  {
    id: 'facebook-page-reels-comments',
    target: 'Fanpage',
    media: 'video dọc/Reels',
  },
  {
    id: 'facebook-group-post-comments',
    target: 'Nhóm Facebook',
    media: 'Bài viết nhóm',
  },
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-route="library"]').click();
});

test('shows the four fixed Facebook workflows separately from custom workflows', async ({
  page,
}) => {
  await expect(page.getByRole('heading', { name: 'Quy trình Facebook' })).toBeVisible();
  await expect(page.getByTestId('workflow-template-card')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Workflow tùy chỉnh' })).toBeVisible();
  await expect(page.getByRole('button', { name: '＋ Workflow mới' })).toBeVisible();

  for (const template of templates) {
    const card = page.locator('[data-template-id="' + template.id + '"]');
    await expect(card).toBeVisible();
    await expect(card).toContainText(template.target);
    await expect(card).toContainText(template.media);
    await expect(card).toContainText('Caption');
    await expect(card).toContainText('Hashtag');
    await expect(card).toContainText('1–32 bình luận');
    await expect(card).toContainText('Chưa sẵn sàng chạy');
  }
});

test('each Facebook template explains identity, ordered comments and safe stop conditions', async ({
  page,
}) => {
  for (const template of templates) {
    const card = page.locator('[data-template-id="' + template.id + '"]');
    await card.getByRole('button', { name: 'Xem quy trình' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Nick đang đăng nhập');
    await expect(dialog).toContainText(template.target);
    await expect(dialog).toContainText('Danh sách bình luận');
    await expect(dialog).toContainText('1–32 bình luận');
    await expect(dialog).toContainText('Chỉ sau khi bài đăng được xác minh');
    await expect(dialog).toContainText('không tự đăng lại');
    await expect(dialog).toContainText('PLANNED');
    await expect(dialog.getByRole('button', { name: /chạy/i })).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    await expect(dialog).not.toBeVisible();
  }
});

test('custom workflow creation remains available beside the fixed catalog', async ({ page }) => {
  await page.getByRole('button', { name: '＋ Workflow mới' }).click();
  await expect(page.getByRole('dialog')).toContainText('Tạo workflow mới');
  await expect(page.getByRole('combobox', { name: 'Ứng dụng workflow', exact: true })).toHaveValue('fb');
  await page.getByRole('button', { name: 'Hủy' }).click();
});
