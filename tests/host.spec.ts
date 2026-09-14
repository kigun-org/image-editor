import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const TINY_PNG = fileURLToPath(new URL('./fixtures/tiny.png', import.meta.url));

test('loads an image blob and Save calls saveCallback', async ({ page }) => {
  await page.goto('/');

  await page.locator('input[type=file][accept="image/*"]').setInputFiles(TINY_PNG);

  const save = page.getByRole('button', { name: 'Save image' });
  await expect(save).toBeVisible({ timeout: 15_000 });
  await save.click();

  await expect(page.locator('.screenshots img[alt="Screenshot"]')).toBeVisible({
    timeout: 15_000,
  });
});
