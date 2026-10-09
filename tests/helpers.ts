import { expect, test as base, type Page } from '@playwright/test';
import type { EditorProps } from './harness/controller';

export const test = base.extend<{ libraryErrors: string[] }>({
  libraryErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use(errors);
    expect(errors, 'The library must not emit uncaught errors.').toEqual([]);
  }, { auto: true }],
});
export { expect };

export async function nextTab(page: Page) {
  // macOS WebKit uses Option-Tab to include buttons with default OS settings.
  // https://support.apple.com/guide/safari/cpsh003/mac
  const macWebKit = process.platform === 'darwin' && page.context().browser()?.browserType().name() === 'webkit';
  await page.keyboard.press(macWebKit ? 'Alt+Tab' : 'Tab');
}

export async function openLibrary(page: Page, props: EditorProps = {}, id = 'first') {
  await page.goto('/tests/harness/index.html');
  await page.waitForFunction(() => !!window.editorHarness);
  await page.evaluate(({ id, props }) => window.editorHarness.mount(id, props), { id, props });
}

export async function imageBlob(page: Page, width = 400, height = 300, id = 'first') {
  await page.evaluate(async ({ width, height, id }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#164c84'; context.fillRect(0, 0, width, height);
    context.fillStyle = '#e7ad34'; context.fillRect(0, 0, Math.floor(width / 3), Math.floor(height / 2));
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Fixture encoding failed.')), 'image/png'));
    window.editorHarness.setProps(id, { imageBlob: blob });
  }, { width, height, id });
  await expect(page.locator(`[data-editor-host="${id}"]`).getByRole('button', { name: 'Save image', exact: true })).toBeEnabled();
}

export async function savedDimensions(page: Page, index = 0, id = 'first') {
  return page.evaluate(async ({ index, id }) => {
    const bitmap = await createImageBitmap(window.editorHarness.saved(id)[index]);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  }, { index, id });
}

// Coordinates are fractions of the visible canvas. Use the public pointer surface.
export async function dragCanvas(page: Page, from: [number, number], to: [number, number]) {
  const canvas = page.locator('.upper-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Missing editing canvas.');
  await page.mouse.move(box.x + Math.min(box.width - 2, Math.max(2, box.width * from[0])), box.y + Math.min(box.height - 2, Math.max(2, box.height * from[1])));
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 8 });
  await page.mouse.up();
}
