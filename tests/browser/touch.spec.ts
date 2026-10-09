import { test, expect, openLibrary, imageBlob } from '../helpers';

test('touch-sized controls support aspect ratio, annotation, and saving', async ({ page }) => {
  await openLibrary(page); await imageBlob(page);
  await page.getByRole('checkbox', { name: 'Keep aspect ratio' }).uncheck();
  await expect(page.getByRole('checkbox', { name: 'Keep aspect ratio' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Add circle' }).click();
  await page.getByRole('button', { name: 'Save image', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls())).toBe(1);
  const size = await page.getByRole('button', { name: 'Save image', exact: true }).boundingBox();
  expect(size!.width).toBeGreaterThanOrEqual(44); expect(size!.height).toBeGreaterThanOrEqual(44);
});

test('touch toolbar shows text labels without hover', async ({ page, isMobile }, testInfo) => {
  await openLibrary(page); await imageBlob(page);
  const touch = await page.evaluate(() => matchMedia('(hover: none), (pointer: coarse)').matches);
  // This file also runs in desktop projects; both presentations keep the name.
  const button = page.getByRole('button', { name: 'Flip horizontal', exact: true });
  await expect(button).toHaveAccessibleName('Flip horizontal');
  if (touch || isMobile) {
    await expect(button.locator('.ie-touch-label')).toBeVisible();
    const heights: number[] = [];
    for (const name of ['Flip horizontal', 'Flip vertical', 'Rotate left 90°', 'Rotate right 90°']) {
      const action = page.getByRole('button', { name, exact: true });
      const lines = await action.locator('.ie-touch-label > span').evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        return { y: rect.y, height: rect.height };
      }));
      expect(lines).toHaveLength(2);
      expect(lines[1].y).toBeGreaterThanOrEqual(lines[0].y + lines[0].height - 1);
      heights.push((await action.boundingBox())!.height);
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    await button.tap();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(button.locator('.ie-touch-label')).toBeVisible();
    await testInfo.attach('touch-toolbar', { body: await page.screenshot(), contentType: 'image/png' });
  } else await expect(button.locator('.ie-touch-label')).toBeHidden();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});
