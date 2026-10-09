import AxeBuilder from '@axe-core/playwright';
import { test, expect, openLibrary, imageBlob, nextTab } from '../helpers';

test('Lucide toolbar buttons retain names and hoverable, dismissible tooltips', async ({ page }) => {
  await openLibrary(page); await imageBlob(page);
  const button = page.getByRole('button', { name: 'Flip horizontal', exact: true });
  await expect(button.locator('svg.lucide')).toHaveAttribute('aria-hidden', 'true');
  await expect(button).toHaveAttribute('type', 'button');
  await button.hover();
  const tooltip = page.getByRole('tooltip', { name: 'Flip horizontal', exact: true });
  await expect(tooltip).toBeVisible();
  await expect(button).toHaveAttribute('aria-describedby', await tooltip.getAttribute('id') ?? '');
  await tooltip.hover();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
  await page.mouse.move(0, 0);
  await button.hover();
  await expect(tooltip).toBeVisible();
  const scan = await new AxeBuilder({ page }).include('[data-editor-target]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(scan.violations).toEqual([]);
  // The open tooltip covers the rotation label. Check that exact overlap, then
  // scan the label again after dismissal. All tooltip text must be conclusive.
  expect(scan.incomplete.map(rule => ({ id: rule.id, nodes: rule.nodes.map(node => ({
    target: node.target,
    reasons: node.any.map(check => check.data?.messageKey),
  })) }))).toEqual([{
    id: 'color-contrast', nodes: [{
      target: [['div[data-image-editor-host=""]', await page.getByText('Rotation: 0°', { exact: true }).evaluate(element => `label[for="${element.getAttribute('for')}"]`)]],
      reasons: ['bgOverlap'],
    }],
  }]);
  await page.mouse.move(0, 0);
  await expect(tooltip).toBeHidden();
  const dismissedScan = await new AxeBuilder({ page }).include('[data-editor-target]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(dismissedScan.violations).toEqual([]);
  expect(dismissedScan.incomplete).toEqual([]);
});

test('keyboard focus shows tooltips and Escape retains focus and toggle state', async ({ page }) => {
  await openLibrary(page); await imageBlob(page);
  const button = page.getByRole('button', { name: 'Flip horizontal', exact: true });
  for (let index = 0; index < 20; index++) {
    if (await button.evaluate(element => element === (element.getRootNode() as ShadowRoot).activeElement)) break;
    await nextTab(page);
  }
  await expect(button).toBeFocused();
  const tooltip = page.getByRole('tooltip', { name: 'Flip horizontal', exact: true });
  await expect(tooltip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Space');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.editorHarness.submits())).toBe(0);
});

test('tooltip remains within a narrow viewport and teardown removes keyboard handling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await openLibrary(page); await imageBlob(page);
  const button = page.getByRole('button', { name: 'Draw freehand', exact: true });
  await button.hover();
  const tooltip = page.getByRole('tooltip', { name: 'Draw freehand', exact: true });
  await expect(tooltip).toBeVisible();
  const bounds = await tooltip.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await page.evaluate(() => window.editorHarness.unmount());
  const prevented = await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});
