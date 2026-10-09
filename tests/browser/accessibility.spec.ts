import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, openLibrary, imageBlob, nextTab } from '../helpers';

async function scan(page: Page, testInfo: TestInfo, state: string) {
  const results = await new AxeBuilder({ page }).include('[data-editor-target]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  await testInfo.attach(`axe-${state}`, {body: JSON.stringify(results, null, 2), contentType: 'application/json'});
  expect(results.violations, `Automatically detectable WCAG violations in ${state}`).toEqual([]);
  expect(results.incomplete, `Accessibility checks requiring review in ${state}`).toEqual([]);
}

test('accessible names, roles, values, and axe scans cover upload, editing, annotations, failure, retry, and saving', async ({ page }, testInfo) => {
  await openLibrary(page);
  await scan(page, testInfo, 'upload');
  await imageBlob(page);
  const editor = page.locator('.image-editor');
  for (const name of ['Rotation:', 'Brightness:', 'Contrast:']) await expect(editor.getByRole('slider', {name})).toBeVisible();
  await expect(editor.getByLabel('Annotation color')).toBeVisible();
  await scan(page, testInfo, 'editor');
  await expect(editor.getByRole('spinbutton', { name: /^Crop / })).toHaveCount(0);
  await expect(editor.getByRole('button', { name: /^Crop / })).toHaveCount(0);
  await editor.getByRole('slider', { name: 'Rotation:' }).fill('20');
  await expect(editor.locator('.alert-warning svg.lucide-triangle-alert')).toHaveAttribute('aria-hidden', 'true');
  await scan(page, testInfo, 'crop-warning');
  await testInfo.attach('crop-warning', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await editor.getByRole('slider', { name: 'Rotation:' }).fill('0');
  for (const name of ['arrow', 'circle', 'rectangle', 'text']) {
    await editor.getByRole('button', {name: `Add ${name}`, exact: true}).click();
    await scan(page, testInfo, name);
  }
  await page.evaluate(() => window.editorHarness.setSaveMode('first', 'reject'));
  await editor.getByRole('button', {name: 'Save image', exact: true}).click();
  await expect(editor.getByRole('alert')).toContainText('Could not save');
  await scan(page, testInfo, 'save-error');
  await page.evaluate(() => window.editorHarness.setSaveMode('first', 'pending'));
  await editor.getByRole('button', {name: 'Retry save'}).click();
  await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(2);
  await scan(page, testInfo, 'saving');
  await page.evaluate(() => window.editorHarness.settleSave('first'));
  await expect(editor.locator('.ie-edit > [role="status"]')).toContainText('Image saved');
  await scan(page, testInfo, 'saved');
  expect(await editor.locator('button').evaluateAll(buttons => buttons.every(button => button.getAttribute('type') === 'button'))).toBe(true);
});

for (const width of [320, 768, 1100]) {
  test(`editor reflows at ${width}px and retains target size`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    await openLibrary(page); await imageBlob(page);
    const editor = page.locator('.image-editor');
    await editor.getByRole('button', {name: 'Add text'}).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    for (const button of await editor.getByRole('button').all()) {
      const bounds = await button.boundingBox();
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }
    await expect(editor.getByRole('textbox', {name: 'Annotation text'})).toHaveCount(0);
  });
}

test('reduced motion and forced colors retain usable controls and visible keyboard focus', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce', forcedColors: 'active'});
  await openLibrary(page); await imageBlob(page);
  const flip = page.getByRole('button', {name: 'Flip horizontal'});
  for (let i = 0; i < 20; i++) {
    if (await flip.evaluate(element => element === (element.getRootNode() as ShadowRoot).activeElement)) break;
    await nextTab(page);
  }
  await expect(flip).toBeFocused();
  expect(await flip.evaluate(element => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
  })).toBe(true);
  await page.keyboard.press('Space');
  await expect(flip).toHaveAttribute('aria-pressed', 'true');
});

test('CSS stays inside the editor with common host selectors and both stylesheet orders', async ({page}) => {
  await openLibrary(page);
  const host = page.getByRole('textbox', {name: 'Host text first'});
  const before = await host.evaluate(element => {
    const s = getComputedStyle(element);
    return {color: s.color, background: s.backgroundColor, border: s.border, font: s.font, boxSizing: s.boxSizing};
  });
  await imageBlob(page);
  const during = await host.evaluate(element => {
    const s = getComputedStyle(element);
    return {color: s.color, background: s.backgroundColor, border: s.border, font: s.font, boxSizing: s.boxSizing};
  });
  expect(during).toEqual(before);
  await page.addStyleTag({content: '.btn {font-family: serif;} input {letter-spacing: .1px;} :root {--color-primary: red; --color-base-content: yellow;}'});
  const editor = page.locator('.image-editor');
  await expect(editor.getByRole('button', {name: 'Save image', exact: true})).toBeEnabled();
  const primary = await editor.getByRole('button', {name: 'Save image', exact: true}).evaluate(element => getComputedStyle(element).backgroundColor);
  expect(primary).not.toBe('rgb(255, 0, 0)');
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '.btn { font-size: 15px; } :root { --color-primary: red; }';
    document.head.prepend(style);
  });
  await editor.getByRole('button', {name: 'Flip horizontal'}).click();
  await expect(editor.getByRole('button', {name: 'Flip horizontal'})).toHaveAttribute('aria-pressed', 'true');
});

test('gallery loading, empty, error, retry and populated states expose accessible controls', async ({page}, testInfo) => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let attempt = 0;
  await page.route('**/a11y-gallery.json', async route => {
    attempt++;
    if (attempt === 1) { await gate; await route.fulfill({json: {visits: []}}); }
    else if (attempt === 2) await route.fulfill({json: {invalid: true}});
    else await route.fulfill({json: {visits: [{title: 'Sample images', images: [{id: 'one', url: '/tests/fixtures/tiny.png', thumbnail: '/tests/fixtures/tiny.png'}]}]}});
  });
  await openLibrary(page, {galleryURL: '/a11y-gallery.json'});
  const editor = page.locator('.image-editor');
  await editor.getByRole('button', {name: 'Select an existing image'}).click();
  await expect(editor.getByText('Loading images…')).toBeVisible();
  await scan(page, testInfo, 'gallery-loading');
  release?.();
  await expect(editor.getByText('No images are available.')).toBeVisible();
  await scan(page, testInfo, 'gallery-empty');
  await editor.getByRole('button', {name: 'Back to upload'}).click();
  await expect(editor.getByRole('button', {name: 'Select an existing image'})).toBeFocused();
  await editor.getByRole('button', {name: 'Select an existing image'}).click();
  await expect(editor.getByRole('alert')).toContainText('invalid');
  await scan(page, testInfo, 'gallery-error');
  await editor.getByRole('button', {name: 'Retry gallery'}).click();
  await expect(editor.getByRole('radio', {name: 'Image one'})).toBeVisible();
  await scan(page, testInfo, 'gallery-ready');
  await editor.getByRole('radio', {name: 'Image one'}).check();
  await expect(editor.getByRole('button', {name: 'Edit before upload'})).toBeEnabled();
  expect(await page.evaluate(() => window.editorHarness.submits('first'))).toBe(0);
});

test('input borders retain non-text contrast and desktop/mobile layout evidence', async ({page}, testInfo) => {
  await openLibrary(page); await imageBlob(page);
  const editor = page.locator('.image-editor');
  await editor.getByRole('button', {name: 'Add text'}).click();
  for (const name of ['Annotation color']) {
    const color = await editor.getByLabel(name, {exact: true}).evaluate(element => getComputedStyle(element).borderTopColor);
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    expect(channels).toHaveLength(3);
    const linear = channels!.map(channel => {
      const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    const luminance = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
    expect(1.05 / (luminance + .05), `${name} border contrast against white`).toBeGreaterThanOrEqual(3);
  }
  await editor.getByRole('button', {name: 'Add text'}).click();
  for (const width of [1100, 320]) {
    await page.setViewportSize({width, height: 900});
    await page.evaluate(() => window.scrollTo(0, 0));
    await testInfo.attach(`editor-${width}px`, {body: await page.screenshot({fullPage: true}), contentType: 'image/png'});
  }
});
