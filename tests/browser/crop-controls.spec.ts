import { test, expect, openLibrary, imageBlob, savedDimensions } from '../helpers';
import type { Page } from '@playwright/test';

// Check rendered pixels while the pointer is still down, not only export results.
async function expectHandle(page: Page, x: number, y: number) {
  await expect.poll(() => page.locator('.lower-canvas').evaluate((element, point) => {
    const canvas = element as HTMLCanvasElement;
    const box = canvas.getBoundingClientRect();
    const px = Math.round(point.x * canvas.width), py = Math.round(point.y * canvas.height);
    const pixels = canvas.getContext('2d')!.getImageData(px - 2, py - 2, 5, 5).data;
    let visible = false;
    for (let i = 0; i < pixels.length; i += 4) {
      if (Math.abs(pixels[i] - 178) < 8 && Math.abs(pixels[i + 1] - 204) < 8 && pixels[i + 2] > 245 && pixels[i + 3] > 245) visible = true;
    }
    const top = (canvas.getRootNode() as ShadowRoot).elementFromPoint(box.x + point.x * box.width, box.y + point.y * box.height);
    return visible && !!top?.classList.contains('upper-canvas');
  }, { x, y })).toBe(true);
}

for (const locked of [true, false]) {
  test(`crop corners stay visible during continuous resizing, aspect lock ${locked}`, async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 1200 });
    await openLibrary(page); await imageBlob(page);
    for (const [x, y] of [[0, .125], [1, .125], [0, .875], [1, .875]]) {
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
      if (!locked) await page.getByRole('checkbox', { name: 'Keep aspect ratio' }).uncheck();
      const box = (await page.locator('.upper-canvas').boundingBox())!;
      const dx = x === 0 ? 1 : -1, dy = y === .125 ? 1 : -1;
      await page.mouse.move(box.x + (x === 0 ? 2 : box.width - 2), box.y + box.height * y);
      await page.mouse.down();
      // Reverse direction without releasing the corner.
      for (const distance of [.15, .25, .15]) {
        const toX = x + dx * distance, toY = y + dy * distance * .75;
        await page.mouse.move(box.x + box.width * toX, box.y + box.height * toY, { steps: 6 });
        await expectHandle(page, toX, toY);
      }
      await page.mouse.up();
      // Grab the same corner again after the transform has been normalized.
      await page.mouse.down();
      const toX = x + dx * .3, toY = y + dy * .225;
      await page.mouse.move(box.x + box.width * toX, box.y + box.height * toY, { steps: 6 });
      await expectHandle(page, toX, toY);
      await page.mouse.up();
    }
    await page.getByRole('button', { name: 'Save image', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saved('first').length)).toBe(1);
    const size = await savedDimensions(page);
    expect(Math.abs(size.width - 280)).toBeLessThanOrEqual(2);
    expect(Math.abs(size.height - 210)).toBeLessThanOrEqual(2);
  });
}

for (const imageWidth of [400, 1600]) {
  test(`handles stay 20 display pixels after preview resize, image width ${imageWidth}`, async ({ page }) => {
    await openLibrary(page); await imageBlob(page, imageWidth, imageWidth * .75);
    for (const viewport of [{ width: 1100, height: 1200 }, { width: 600, height: 1000 }]) {
      await page.setViewportSize(viewport);
      await page.locator('.upper-canvas').scrollIntoViewIfNeeded();
      await expect.poll(() => page.locator('.lower-canvas').evaluate(element => {
        const canvas = element as HTMLCanvasElement;
        // The top-left handle is half clipped at the canvas edge. Count its
        // vertical extent instead, through a column just inside the canvas.
        const column = canvas.getContext('2d')!.getImageData(1, Math.round(canvas.height * .125) - Math.ceil(canvas.height * .06), 1, Math.ceil(canvas.height * .12)).data;
        let count = 0;
        for (let i = 0; i < column.length; i += 4) {
          if (Math.abs(column[i] - 178) < 8 && Math.abs(column[i + 1] - 204) < 8 && column[i + 2] > 245 && column[i + 3] > 245) count++;
        }
        return count * canvas.getBoundingClientRect().height / canvas.height;
      })).toBeGreaterThanOrEqual(17);
      const box = (await page.locator('.upper-canvas').boundingBox())!;
      // An interior point 14 px below the corner is outside a 20 px handle.
      const outside = await page.locator('.lower-canvas').evaluate((element, offset) => {
        const canvas = element as HTMLCanvasElement;
        const p = canvas.getContext('2d')!.getImageData(1, Math.round(canvas.height * (.125 + offset)), 1, 1).data;
        return p[2] > 245 && p[3] > 245;
      }, 14 / box.height);
      expect(outside).toBe(false);
    }
  });
}

test('left corner resizing does not flash an outside-image warning on aligned edges', async ({ page }) => {
  await page.setViewportSize({ width: 1031, height: 1100 });
  await openLibrary(page); await imageBlob(page, 1600, 1200);
  const warning = page.getByRole('img', { name: 'Crop extends outside the image', exact: true });
  for (const locked of [true, false]) {
    for (const top of [true, false]) {
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
      if (!locked) await page.getByRole('checkbox', { name: 'Keep aspect ratio' }).uncheck();
      const box = (await page.locator('.upper-canvas').boundingBox())!;
      const startY = top ? .125 : .875;
      await page.mouse.move(box.x + 2, box.y + box.height * startY);
      await page.mouse.down();
      // Keep the dragged corner inside: browser event coordinates round to
      // whole pixels and can place a pointer just beyond the source edge.
      for (let step = 1; step < 30; step++) {
        const distance = (step <= 15 ? step : 30 - step) * .0137;
        await page.mouse.move(box.x + box.width * distance, box.y + box.height * (startY + (top ? 1 : -1) * distance * .75));
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
        expect(await warning.count(), `left ${top ? 'top' : 'bottom'}, lock ${locked}, step ${step}`).toBe(0);
      }
      await page.mouse.up();
    }
  }
});
