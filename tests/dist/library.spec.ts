import { test, expect, imageBlob } from '../helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/library-host/');
  await page.waitForFunction(() => !!window.editorHarness);
});

test('built default constructor accepts an initial Blob and calls the Promise callback once', async ({ page }, testInfo) => {
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 120;
    const context = canvas.getContext('2d')!; context.fillStyle = '#23804e'; context.fillRect(0, 0, 160, 120);
    const imageBlob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
    window.editorHarness.mount('first', { imageBlob });
  });
  const save = page.getByRole('button', { name: 'Save image', exact: true });
  await expect(save).toBeEnabled();
  const flip = page.getByRole('button', { name: 'Flip horizontal', exact: true });
  await expect(flip.locator('svg.lucide')).toHaveAttribute('aria-hidden', 'true');
  await flip.hover();
  const tooltip = page.getByRole('tooltip', { name: 'Flip horizontal', exact: true });
  await expect(tooltip).toBeVisible();
  await testInfo.attach('built-toolbar-tooltip', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
  await save.click();
  await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls())).toBe(1);
  expect(await page.evaluate(async () => {
    const blob = window.editorHarness.saved()[0];
    const image = await createImageBitmap(blob);
    const value = { width: image.width, height: image.height, type: blob.type, size: blob.size };
    image.close(); return value;
  })).toMatchObject({ width: 160, height: 120, type: 'image/jpeg' });
  expect(await page.evaluate(() => window.editorHarness.submits())).toBe(0);
});

test('built export retains annotations, supports a throwing callback, and retries', async ({ page }) => {
  await page.evaluate(() => window.editorHarness.mount());
  await imageBlob(page);
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByRole('textbox', { name: 'Annotation text' }).fill('Saved annotation');
  await page.evaluate(() => window.editorHarness.setSaveMode('first', 'throw'));
  await page.getByRole('button', { name: 'Save image', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Your changes are kept');
  await expect(page.getByRole('textbox', { name: 'Annotation text' })).toHaveValue('Saved annotation');
  await page.evaluate(() => window.editorHarness.setSaveMode('first', 'pending'));
  await page.getByRole('button', { name: 'Retry save' }).click();
  await expect(page.getByRole('button', { name: 'Add text', exact: true })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls())).toBe(2);
  await page.evaluate(() => window.editorHarness.settleSave('first'));
  await expect(page.getByRole('button', { name: 'Save image', exact: true })).toBeEnabled();
  expect(await page.evaluate(async () => {
    const [first, retry] = window.editorHarness.saved();
    return first === retry && first.size > 0;
  })).toBe(true);
});

test('built library uses only the single non-root asset and never requests source modules', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.reload();
  await page.waitForFunction(() => !!window.editorHarness);
  await page.evaluate(() => window.editorHarness.mount());
  await imageBlob(page);
  expect(requests.filter(path => path.startsWith('/vendor/')).sort()).toEqual([
    '/vendor/nested/image-editor.js',
  ]);
  expect(requests.some(path => /\/src\/|\/node_modules\/|@vite|\.svelte/.test(path))).toBe(false);
});

test('twenty built lifecycle cycles release object URLs and leave a second editor usable', async ({ page }) => {
  test.setTimeout(120_000);
  await page.evaluate(() => {
    const active = new Set<string>();
    const create = URL.createObjectURL.bind(URL); const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = value => { const url = create(value); active.add(url); return url; };
    URL.revokeObjectURL = value => { active.delete(value); revoke(value); };
    Object.assign(window, { testActiveObjectURLs: active });
    window.editorHarness.mount('survivor');
  });
  await imageBlob(page, 80, 60, 'survivor');
  for (let cycle = 0; cycle < 20; cycle++) {
    await page.evaluate(() => window.editorHarness.mount('transient'));
    await imageBlob(page, 80, 60, 'transient');
    const editor = page.locator('[data-editor-host="transient"]');
    await editor.getByRole('button', { name: 'Flip horizontal' }).click();
    await editor.getByRole('button', { name: 'Save image', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls('transient'))).toBe(1);
    const graphicsContext = await editor.locator('.ie-background canvas').evaluateHandle(canvas => {
      const element = canvas as HTMLCanvasElement;
      return element.getContext('webgl2') ?? element.getContext('webgl');
    });
    await page.evaluate(() => window.editorHarness.unmount('transient'));
    expect(await graphicsContext.evaluate(context => context?.isContextLost())).toBe(true);
    await graphicsContext.dispose();
    await expect(page.locator('[data-editor-host="transient"]')).toHaveCount(0);
  }
  await expect(page.locator('canvas')).toHaveCount(3);
  const survivor = page.locator('[data-editor-host="survivor"]');
  await expect(survivor.getByRole('button', { name: 'Flip vertical' })).toBeEnabled();
  await survivor.getByRole('button', { name: 'Flip vertical' }).click();
  await expect(survivor.getByRole('button', { name: 'Flip vertical' })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.editorHarness.clear());
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as { testActiveObjectURLs: Set<string> }).testActiveObjectURLs.size)).toBe(0);
});


import { styleIsolationTests } from '../style-isolation';
styleIsolationTests('/vendor/nested/image-editor.js');
