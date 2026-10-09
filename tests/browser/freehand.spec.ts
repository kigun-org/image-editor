import { test, expect, openLibrary, imageBlob } from '../helpers';

test('drawing instructions keep the editor size unchanged', async ({ page }) => {
  await openLibrary(page);
  await imageBlob(page);
  const editor = page.locator('.ie-edit');
  const before = await editor.boundingBox();
  await page.getByRole('button', { name: 'Draw freehand', exact: true }).click();
  await expect(page.getByText('Draw on the image. Press Escape or select Draw freehand again to stop.', { exact: true })).toBeVisible();
  const after = await editor.boundingBox();
  expect(after?.width).toBe(before?.width);
  expect(after?.height).toBe(before?.height);
});

test('starting freehand drawing clears the selected annotation', async ({ page }) => {
  await openLibrary(page);
  await imageBlob(page);
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Annotation text' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete annotation', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Draw freehand', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Annotation text' })).toBeHidden();
  for (const name of ['Send backward', 'Bring forward', 'Delete annotation']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeHidden();
  }
});

test('freehand strokes retain their position when the pointer is released', async ({ page }) => {
  await openLibrary(page);
  await imageBlob(page);
  await page.getByLabel('Annotation color').fill('#ff0000');
  await page.getByRole('button', { name: 'Draw freehand', exact: true }).click();
  const upper = page.locator('.upper-canvas');
  const bounds = await upper.boundingBox();
  if (!bounds) throw new Error('Missing editing canvas.');
  await page.mouse.move(bounds.x + bounds.width * .25, bounds.y + bounds.height * .4);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .4, bounds.y + bounds.height * .5, { steps: 12 });
  const redBounds = (canvas: Element) => {
    const element = canvas as HTMLCanvasElement;
    const pixels = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data;
    let left = element.width, top = element.height, right = -1, bottom = -1;
    for (let y = 0; y < element.height; y++) for (let x = 0; x < element.width; x++) {
      const index = (y * element.width + x) * 4;
      if (pixels[index] > 180 && pixels[index + 1] < 80 && pixels[index + 2] < 80 && pixels[index + 3] > 200) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    return { left, top, right, bottom };
  };
  const before = await upper.evaluate(redBounds);
  expect(before.right).toBeGreaterThan(before.left);
  expect(before.bottom).toBeGreaterThan(before.top);
  await page.mouse.up();
  const lower = page.locator('.lower-canvas');
  await expect.poll(async () => {
    const after = await lower.evaluate(redBounds);
    return Math.max(...(['left', 'top', 'right', 'bottom'] as const).map(key => Math.abs(after[key] - before[key])));
  }).toBeLessThanOrEqual(2);
  await page.getByRole('button', { name: 'Draw freehand', exact: true }).click();
  // Selection handles cover the stroke endpoints. Deselect before sampling.
  await upper.click({ position: { x: 20, y: 20 } });
  await expect.poll(async () => {
    const after = await lower.evaluate(redBounds);
    return Math.max(...(['left', 'top', 'right', 'bottom'] as const).map(key => Math.abs(after[key] - before[key])));
  }).toBeLessThanOrEqual(2);
});
