import type { Locator, Page } from '@playwright/test';
import { test, expect, openLibrary, imageBlob, nextTab } from '../helpers';

async function tabTo(page: Page, target: Locator) {
  for (let index = 0; index < 90; index++) {
    if (await target.evaluate(element => element === (element.getRootNode() as ShadowRoot).activeElement)) return;
    await nextTab(page);
  }
  await expect(target).toBeFocused();
}

test('keyboard workflow edits, annotates, deletes, saves, and leaves the host form unsubmitted', async ({ page }) => {
  await openLibrary(page);
  await imageBlob(page);
  const editor = page.locator('.image-editor');
  const flip = editor.getByRole('button', { name: 'Flip horizontal', exact: true });
  await tabTo(page, flip);
  await page.keyboard.press('Space');
  await expect(flip).toHaveAttribute('aria-pressed', 'true');
  await tabTo(page, editor.getByRole('button', { name: 'Rotate right 90°' }));
  await page.keyboard.press('Enter');
  await expect(editor.getByRole('slider', { name: 'Rotation:' })).toHaveValue('90');
  await tabTo(page, editor.getByRole('checkbox', { name: 'Keep aspect ratio' }));
  await page.keyboard.press('Space');
  await expect(editor.getByRole('checkbox', { name: 'Keep aspect ratio' })).not.toBeChecked();
  await tabTo(page, editor.getByRole('button', { name: 'Add rectangle' }));
  await page.keyboard.press('Enter');
  await expect(editor.getByRole('button', { name: 'Delete annotation' })).toBeVisible();
  await tabTo(page, editor.getByRole('button', { name: 'Delete annotation' }));
  await page.keyboard.press('Enter');
  await expect(editor.getByRole('button', { name: 'Delete annotation' })).toBeHidden();
  await tabTo(page, editor.getByRole('button', { name: 'Save image', exact: true }));
  await page.keyboard.press('Enter');
  await expect(editor.locator('.ie-edit > [role="status"]')).toContainText('Image saved.');
  expect(await page.evaluate(() => window.editorHarness.submits('first'))).toBe(0);
  expect(await page.evaluate(() => window.editorHarness.saved('first')[0]?.type)).toBe('image/jpeg');
  await page.keyboard.press('Tab');
  await expect(editor.getByRole('button', { name: 'Save image', exact: true })).not.toBeFocused();
});

test('annotation tools select new shapes and reset clears selection', async ({ page }) => {
  await openLibrary(page); await imageBlob(page);
  const editor = page.locator('.image-editor');
  for (const type of ['arrow', 'circle', 'rectangle', 'text']) {
    await editor.getByRole('button', { name: `Add ${type}`, exact: true }).click();
    await expect(editor.getByRole('button', { name: 'Delete annotation' })).toBeVisible();
    await editor.getByLabel('Annotation color').fill('#ff0000');
    await expect(editor.getByLabel('Annotation color')).toHaveValue('#ff0000');
  }
  await editor.getByRole('button', { name: 'Send backward' }).click();
  await editor.getByRole('button', { name: 'Bring forward' }).click();
  await expect(editor.getByRole('textbox', { name: 'Annotation text' })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Reset' }).click();
  await expect(editor.getByRole('button', { name: 'Delete annotation' })).toBeHidden();
  await expect(editor.getByRole('slider', { name: 'Rotation:' })).toHaveValue('0');
  expect(await page.evaluate(() => window.editorHarness.submits('first'))).toBe(0);
});

test('save failure retains edits and retry succeeds; pending save disables edits', async ({ page }) => {
  await openLibrary(page); await imageBlob(page);
  const editor = page.locator('.image-editor');
  const beforeHeight = await editor.evaluate(element => element.clientHeight);
  await editor.getByRole('button', { name: 'Flip vertical' }).click();
  await page.evaluate(() => window.editorHarness.setSaveMode('first', 'reject'));
  await editor.getByRole('button', { name: 'Save image', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Your changes are kept');
  expect(await editor.evaluate(element => element.clientHeight)).toBe(beforeHeight);
  const bannerBounds = await editor.getByRole('alert').boundingBox();
  const editorBounds = await editor.boundingBox();
  expect(bannerBounds!.y - editorBounds!.y).toBeGreaterThanOrEqual(34);
  expect(bannerBounds!.y - editorBounds!.y).toBeLessThanOrEqual(38);
  await expect(editor.getByRole('button', { name: 'Flip vertical', includeHidden: true })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.editorHarness.setSaveMode('first', 'pending'));
  await editor.getByRole('button', { name: 'Retry save' }).click();
  await expect(editor.getByRole('button', { name: 'Flip vertical' })).toBeDisabled();
  await expect(editor.getByRole('slider', { name: 'Rotation:' })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(2);
  await page.evaluate(() => window.editorHarness.settleSave('first'));
  await expect(editor.locator('.ie-edit > [role="status"]')).toContainText('Image saved.');
  await expect(editor.getByRole('button', { name: 'Flip vertical' })).toBeEnabled();
  expect(await page.evaluate(async () => {
    const [first, second] = window.editorHarness.saved('first');
    const a = new Uint8Array(await first.arrayBuffer()); const b = new Uint8Array(await second.arrayBuffer());
    return a.length === b.length && a.every((value, index) => value === b[index]);
  })).toBe(true);
});

test('editor instances keep controls, names, editing state, and callbacks separate', async ({ page }) => {
  await openLibrary(page);
  await page.evaluate(() => window.editorHarness.mount('second'));
  await imageBlob(page, 400, 300, 'first'); await imageBlob(page, 400, 300, 'second');
  const first = page.locator('[data-editor-host="first"]');
  const second = page.locator('[data-editor-host="second"]');
  await first.getByRole('button', { name: 'Flip horizontal' }).click();
  await expect(second.getByRole('button', { name: 'Flip horizontal' })).toHaveAttribute('aria-pressed', 'false');
  await first.getByRole('button', { name: 'Add circle' }).click();
  await expect(second.getByRole('button', { name: 'Delete annotation' })).toBeHidden();
  expect(await page.locator('.image-editor [id]').evaluateAll(elements => new Set(elements.map(element => element.id)).size === elements.length)).toBe(true);
  await second.getByRole('button', { name: 'Save image', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls('second'))).toBe(1);
  expect(await page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(0);
  await page.evaluate(() => window.editorHarness.unmount('first'));
  await second.getByRole('button', { name: 'Flip horizontal' }).click();
  await expect(second.getByRole('button', { name: 'Flip horizontal' })).toHaveAttribute('aria-pressed', 'true');
});

test('freehand mode resumes after save and existing strokes can be deleted without dragging', async ({page}) => {
  await openLibrary(page); await imageBlob(page);
  const editor = page.locator('.image-editor');
  await editor.getByRole('button', {name: 'Draw freehand'}).click();
  await editor.getByRole('button', {name: 'Save image', exact: true}).click();
  await expect(editor.locator('.ie-edit > [role="status"]')).toContainText('Image saved');
  await expect(editor.getByRole('button', {name: 'Draw freehand'})).toHaveAttribute('aria-pressed', 'true');
  const canvas = editor.getByRole('img', {name: 'Image editing canvas.'});
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Missing editing canvas');
  await page.mouse.move(bounds.x + bounds.width * .3, bounds.y + bounds.height * .4);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + bounds.height * .5, {steps: 6});
  await page.mouse.up();
  await editor.getByRole('button', {name: 'Draw freehand'}).click();
  await expect(editor.getByRole('button', {name: 'Delete annotation'})).toBeVisible();
  await tabTo(page, editor.getByRole('button', {name: 'Delete annotation'}));
  await page.keyboard.press('Enter');
  await expect(editor.getByRole('button', {name: 'Delete annotation'})).toBeHidden();
});

test('dismiss save error restores Save focus and keeps the current edits', async ({page}) => {
  await openLibrary(page); await imageBlob(page);
  const editor = page.locator('.image-editor');
  await editor.getByRole('button', {name: 'Flip horizontal'}).click();
  await page.evaluate(() => window.editorHarness.setSaveMode('first', 'throw'));
  await editor.getByRole('button', {name: 'Save image', exact: true}).click();
  await expect(editor.getByRole('alert')).toContainText('Your changes are kept');
  await tabTo(page, editor.getByRole('button', {name: 'Dismiss save error'}));
  await page.keyboard.press('Enter');
  await expect(editor.getByRole('alert')).toHaveCount(0);
  await expect(editor.getByRole('button', {name: 'Save image', exact: true})).toBeFocused();
  await expect(editor.getByRole('button', {name: 'Flip horizontal'})).toHaveAttribute('aria-pressed', 'true');
});

