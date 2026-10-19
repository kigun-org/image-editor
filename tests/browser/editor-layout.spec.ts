import { test, expect, openLibrary, imageBlob } from '../helpers';

for (const width of [320, 768, 1100]) {
  test(`error banner stays inside the dashed border at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/error-gallery.json', route => route.fulfill({ json:{ invalid:true } }));
    await openLibrary(page, { galleryURL:'/error-gallery.json' });
    await page.getByRole('button', { name:'Select an existing image' }).click();
    const banner = page.getByRole('alert');
    await expect(banner).toBeVisible();
    const bannerBounds = await banner.boundingBox();
    const galleryBounds = await page.locator('.ie-gallery').boundingBox();
    expect(bannerBounds!.x - galleryBounds!.x).toBeGreaterThanOrEqual(16);
    expect(galleryBounds!.x + galleryBounds!.width - bannerBounds!.x - bannerBounds!.width).toBeGreaterThanOrEqual(16);
    await expect(page.locator('.ie-page')).toHaveCSS('filter','blur(4px)');
    await expect(page.locator('.ie-page')).toHaveAttribute('inert','');
    await page.getByRole('button', { name:'Dismiss', exact:true }).click();
    await expect(page.locator('.ie-page')).toHaveCSS('filter','none');
  });
}

for (const width of [320, 768, 1100]) {
  test(`source, gallery, and editor keep the same frame at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/layout-gallery.json', route => route.fulfill({ json: {
      visits: Array.from({ length: 20 }, (_, index) => ({ title: `Visit ${index + 1}`, images: [
        { id: String(index + 1), url: '/tests/fixtures/tiny.png', thumbnail: '/tests/fixtures/tiny.png' },
      ] })),
    } }));
    await openLibrary(page, { galleryURL: '/layout-gallery.json' });
    const editor = page.locator('.image-editor');
    const size = () => editor.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }));
    const before = await size();
    await editor.getByRole('button', { name: 'Select an existing image' }).click();
    await expect(editor.getByRole('radio', { name: 'Image 1', exact: true })).toBeVisible();
    expect(await size()).toEqual(before);
    const visits = editor.getByRole('region', { name: 'Image visits' });
    expect(await visits.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    await visits.evaluate(element => { element.scrollTop = element.scrollHeight; });
    const listBounds = await visits.boundingBox();
    const lastBounds = await editor.getByRole('radio', { name: 'Image 20', exact: true }).boundingBox();
    expect(lastBounds!.y).toBeGreaterThanOrEqual(listBounds!.y);
    expect(lastBounds!.y + lastBounds!.height).toBeLessThanOrEqual(listBounds!.y + listBounds!.height);
    expect(await size()).toEqual(before);
    await editor.getByRole('button', { name: 'Back to upload' }).click();
    expect(await size()).toEqual(before);
    await imageBlob(page);
    const extraHeight = await editor.evaluate(element => {
      const page = element.querySelector('.ie-page')!;
      const workspace = element.querySelector('.ie-workspace')!;
      return page.getBoundingClientRect().height - workspace.getBoundingClientRect().height;
    });
    expect(extraHeight).toBeGreaterThanOrEqual(0);
    expect(extraHeight).toBeLessThanOrEqual(2);
    expect(await size()).toEqual(before);
    expect(await editor.locator('.ie-page').evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  });
}

test('annotation color shares the tool row and new shapes use that color', async ({ page }) => {
  await openLibrary(page);
  await imageBlob(page);
  const color = page.getByLabel('Annotation color');
  const arrow = page.getByRole('button', { name: 'Add arrow', exact: true });
  const [colorBounds, arrowBounds] = await Promise.all([color.boundingBox(), arrow.boundingBox()]);
  expect(colorBounds).not.toBeNull();
  expect(arrowBounds).not.toBeNull();
  expect(Math.abs(colorBounds!.y - arrowBounds!.y)).toBeLessThanOrEqual(1);
  await expect(page.getByRole('combobox', { name: 'Selected annotation' })).toHaveCount(0);
  await color.fill('#ff0000');
  await arrow.click();
  await expect(page.getByLabel('Annotation color', { exact: true })).toHaveValue('#ff0000');
  await page.getByRole('button', { name: 'Delete annotation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete annotation', exact: true })).toBeHidden();
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
});

test('selection actions keep their space and the active color changes the selected shape', async ({ page }, testInfo) => {
  await openLibrary(page);
  await imageBlob(page);
  const editor = page.locator('.image-editor');
  const actions = editor.locator('.ie-selected-actions');
  const bottom = editor.locator('.ie-bottom-actions');
  const position = () => actions.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
  });
  const before = await position();
  const bottomPosition = () => bottom.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
  });
  const saveBefore = await bottomPosition();
  await expect(editor.getByRole('button', { name: 'Delete annotation' })).toBeHidden();
  await editor.getByRole('button', { name: 'Add rectangle' }).click();
  await expect(editor.getByRole('button', { name: 'Delete annotation' })).toBeVisible();
  await expect(editor.getByRole('spinbutton')).toHaveCount(0);
  const deleteBounds = await editor.getByRole('button', { name: 'Delete annotation' }).boundingBox();
  const actionsBounds = await actions.boundingBox();
  expect(Math.abs(deleteBounds!.x + deleteBounds!.width - actionsBounds!.x - actionsBounds!.width)).toBeLessThanOrEqual(1);
  const toolsBounds = await editor.locator('.ie-new-color').locator('..').boundingBox();
  expect(actionsBounds!.y - toolsBounds!.y - toolsBounds!.height).toBeGreaterThanOrEqual(16);
  expect(await position()).toEqual(before);
  expect(await bottomPosition()).toEqual(saveBefore);
  await editor.getByLabel('Annotation color').fill('#00ff00');
  await editor.getByRole('button', { name: 'Save image', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls())).toBe(1);
  const pixel = await page.evaluate(async () => {
    const image = await createImageBitmap(window.editorHarness.saved()[0]);
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
    const value = [...context.getImageData(200, 150, 1, 1).data].slice(0, 3);
    image.close(); return value;
  });
  [0, 255, 0].forEach((value, index) => expect(Math.abs(pixel[index] - value)).toBeLessThanOrEqual(4));
  await editor.getByRole('button', { name: 'Delete annotation' }).click();
  await expect(editor.getByRole('button', { name: 'Delete annotation' })).toBeHidden();
  expect(await position()).toEqual(before);
  expect(await bottomPosition()).toEqual(saveBefore);
  const saveBounds = await editor.getByRole('button', { name: 'Save image', exact: true }).boundingBox();
  const controlsBounds = await editor.locator('.ie-controls').boundingBox();
  expect(saveBounds!.height).toBeLessThanOrEqual(48);
  expect(saveBounds!.y - (controlsBounds!.y + controlsBounds!.height)).toBeGreaterThanOrEqual(24);
  await testInfo.attach('editor-controls-spacing', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
});

test('warnings overlay the preview, dismiss independently, and do not change export', async ({ page }, testInfo) => {
  await openLibrary(page);
  await page.evaluate(() => window.editorHarness.setProps('first', {
    validators: [{ test: () => true, message: 'Review this image.' }],
  }));
  await imageBlob(page);
  const editor = page.locator('.image-editor');
  const preview = editor.locator('.ie-preview');
  const advisory = preview.getByRole('status').filter({ hasText: 'Review this image.' });
  await expect(advisory).toBeVisible();
  expect(await preview.evaluate(element => getComputedStyle(element).backgroundImage)).toContain('conic-gradient');
  const centered = await advisory.evaluate(element => {
    const card = element.parentElement!.getBoundingClientRect();
    const text = element.getBoundingClientRect();
    return Math.abs(text.y + text.height / 2 - card.y - card.height / 2);
  });
  expect(centered).toBeLessThanOrEqual(1);
  const cropIndicator = editor.getByRole('img', { name: 'Crop extends outside the image', exact: true });
  await expect(cropIndicator).toHaveCount(0);
  const previewBounds = await preview.boundingBox();
  const warningBounds = await advisory.boundingBox();
  expect(warningBounds!.y).toBeGreaterThan(previewBounds!.y);
  expect(warningBounds!.y + warningBounds!.height).toBeLessThan(previewBounds!.y + previewBounds!.height);
  await editor.getByRole('button', { name: 'Save image', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls())).toBe(1);
  await editor.getByRole('slider', { name: 'Rotation:' }).fill('20');
  const cropWarning = preview.getByRole('status').filter({ hasText: 'The crop extends outside' });
  await expect(cropWarning).toBeVisible();
  await expect(cropIndicator).toBeVisible();
  await testInfo.attach('floating-warnings', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await preview.getByRole('button', { name: 'Dismiss warning: Review this image.' }).click();
  await expect(advisory).toHaveCount(0);
  await expect(cropWarning).toBeVisible();
  await expect(preview).toBeFocused();
  await preview.getByRole('button', { name: /^Dismiss warning: The crop extends outside/ }).click();
  await expect(cropWarning).toHaveCount(0);
  await expect(cropIndicator).toBeVisible();
  await editor.getByRole('slider', { name: 'Rotation:' }).fill('21');
  await expect(cropWarning).toHaveCount(0);
  await editor.getByRole('slider', { name: 'Rotation:' }).fill('0');
  await expect(cropIndicator).toHaveCount(0);
  await editor.getByRole('slider', { name: 'Rotation:' }).fill('20');
  await expect(cropWarning).toBeVisible();
  await editor.getByRole('slider', { name: 'Rotation:' }).fill('0');
  await editor.getByRole('button', { name: 'Save image', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls())).toBe(2);
  const output = await page.evaluate(async () => {
    const image = await createImageBitmap(window.editorHarness.saved()[1]);
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
    const color = [...context.getImageData(300, 200, 1, 1).data].slice(0, 3);
    image.close();
    return { width: canvas.width, height: canvas.height, color };
  });
  expect(output).toMatchObject({ width: 400, height: 300 });
  [22, 76, 132].forEach((value, index) => expect(Math.abs(output.color[index] - value)).toBeLessThanOrEqual(4));
  expect(await page.evaluate(async () => {
    const [before, after] = await Promise.all(window.editorHarness.saved().map(blob => blob.arrayBuffer()));
    const a = new Uint8Array(before), b = new Uint8Array(after);
    return a.length === b.length && a.every((value, index) => value === b[index]);
  })).toBe(true);
});
for (const width of [320, 1100]) {
  test(`save button keeps its size while saving at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openLibrary(page);
    await imageBlob(page);
    await page.evaluate(() => window.editorHarness.setSaveMode('first', 'pending'));
    const editor = page.locator('.image-editor');
    const save = editor.getByRole('button', { name: 'Save image', exact: true });
    await expect(save.locator('svg.lucide-check')).toBeVisible();
    const before = await save.boundingBox();
    await save.click();
    const saving = editor.getByRole('button', { name: 'Saving...', exact: true });
    await expect(saving).toBeDisabled();
    await expect(saving.locator('svg.ie-save-spinner')).toBeVisible();
    const during = await saving.boundingBox();
    expect(during!.width).toBe(before!.width);
    expect(during!.height).toBe(before!.height);
    await page.evaluate(() => window.editorHarness.settleSave('first'));
    await expect(save).toBeEnabled();
    await expect(save.locator('svg.lucide-check')).toBeVisible();
  });
}
