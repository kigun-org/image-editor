import { test, expect, openLibrary, imageBlob } from '../helpers';

declare global {
  interface Window {
    encodingStarted?: boolean;
    releaseEncoding?: () => Promise<void>;
    lateSaveCalls?: number;
    restoreContexts?: () => void;
  }
}

test('destruction during JPEG encoding never calls the host save callback', async ({ page }) => {
  await openLibrary(page); await imageBlob(page);
  await page.evaluate(() => {
    window.lateSaveCalls = 0;
    window.editorHarness.setProps('first', { saveCallback: async () => { window.lateSaveCalls!++; } });
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (type !== 'image/jpeg') return original.call(this, callback, type, quality);
      window.encodingStarted = true;
      window.releaseEncoding = () => new Promise(resolve => original.call(this, blob => {
        callback(blob);
        // Let encoding continuations settle before inspecting the host calls.
        queueMicrotask(() => queueMicrotask(resolve));
      }, type, quality));
    };
  });
  await page.getByRole('button', { name: 'Save image', exact: true }).click();
  await page.waitForFunction(() => window.encodingStarted);
  await page.evaluate(async () => {
    window.editorHarness.unmount('first');
    await window.releaseEncoding!();
  });
  expect(await page.evaluate(() => window.lateSaveCalls)).toBe(0);
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('graphics context loss disables editing and permits image reload', async ({ page, browserName, libraryErrors }) => {
  await openLibrary(page); await imageBlob(page);
  await page.locator('.ie-background canvas').evaluate(canvas => {
    const element = canvas as HTMLCanvasElement;
    const context = element.getContext('webgl2') ?? element.getContext('webgl');
    const extension = context?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('The test browser does not expose context-loss simulation.');
    extension.loseContext();
  });
  await expect(page.getByRole('alert')).toContainText('Could not prepare the image editor');
  await expect(page.getByRole('button', { name: 'Save image', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry editor initialization' }).click();
  await expect(page.getByRole('button', { name: 'Save image', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Save image', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(1);
  // Pixi 8.22 requests context loss again during destruction. WebKit reports
  // this exact diagnostic for the context that this test deliberately lost.
  if (browserName === 'webkit') {
    const index = libraryErrors.indexOf('WebGL: INVALID_OPERATION: loseContext: context already lost');
    if (index >= 0) libraryErrors.splice(index, 1);
  }
});

test('renderer initialization failure is recoverable', async ({ page }) => {
  await openLibrary(page); await imageBlob(page);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
    window.restoreContexts = () => { HTMLCanvasElement.prototype.getContext = original; };
  });
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 30;
    const imageBlob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
    window.editorHarness.setProps('first', { imageBlob });
  });
  await expect(page.getByRole('alert')).toContainText('Could not prepare the image editor');
  await expect(page.getByRole('button', { name: 'Save image', exact: true })).toBeDisabled();
  await page.evaluate(() => window.restoreContexts!());
  await page.getByRole('button', { name: 'Retry editor initialization' }).click();
  await expect(page.getByRole('button', { name: 'Save image', exact: true })).toBeEnabled();
});
