import AxeBuilder from '@axe-core/playwright';
import { test, expect, imageBlob } from './helpers';

export function themeTests(url: string) {
  test('system theme changes preserve annotations, exported pixels, and outside styles', async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(url);
    await page.waitForFunction(() => !!window.editorHarness);
    await page.evaluate(() => window.editorHarness.mount());
    const root = page.locator('.image-editor');
    await expect(root).toHaveCSS('color-scheme', 'light');
    const host = page.getByRole('textbox', { name: 'Host text first' });
    const hostStyles = () => host.evaluate(element => {
      const style = getComputedStyle(element);
      return { color: style.color, background: style.backgroundColor, scheme: style.colorScheme };
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    const outside = await hostStyles();
    await expect(root).toHaveCSS('color-scheme', 'dark');
    await expect(root).toHaveCSS('background-color', 'rgb(17, 24, 39)');
    const scan = async (state: string) => {
      await root.evaluate(async element => {
        await Promise.allSettled(element.getAnimations({ subtree: true }).map(animation => animation.finished));
      });
      const results = await new AxeBuilder({ page }).include('[data-editor-target]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      await testInfo.attach(`dark-${state}`, { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
      expect(results.violations, state).toEqual([]);
      expect(results.incomplete, state).toEqual([]);
    };
    await scan('upload');
    await imageBlob(page);
    await root.getByRole('button', { name: 'Add text', exact: true }).click();
    const annotation = root.getByRole('textbox', { name: 'Annotation text' });
    await annotation.fill('Theme test');
    await expect(annotation).toHaveCSS('color-scheme', 'dark');
    await scan('selected-text');
    await root.getByRole('slider', { name: 'Rotation:' }).fill('20');
    await scan('warning');
    await root.getByRole('button', { name: 'Flip horizontal', exact: true }).click();
    await expect(root.getByRole('button', { name: 'Flip horizontal', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.move(0, 0);
    await page.evaluate(() => ((document.querySelector('[data-image-editor-host]')!.shadowRoot!.activeElement) as HTMLElement | null)?.blur());
    await testInfo.attach('dark-editor', { body: await root.screenshot({ path: testInfo.outputPath('dark-editor.png') }), contentType: 'image/png' });
    await root.getByRole('button', { name: 'Save image', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls())).toBe(1);
    await page.evaluate(() => window.editorHarness.setProps('first', { theme: 'light' }));
    await expect(root).toHaveCSS('color-scheme', 'light');
    await expect(annotation).toHaveValue('Theme test');
    expect(await hostStyles()).toEqual(outside);
    await root.getByRole('button', { name: 'Save image', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls())).toBe(2);
    expect(await page.evaluate(async () => {
      const buffers = await Promise.all(window.editorHarness.saved().map(blob => blob.arrayBuffer()));
      return Array.from(new Uint8Array(buffers[0])).every((value, index) => value === new Uint8Array(buffers[1])[index]) && buffers[0].byteLength === buffers[1].byteLength;
    })).toBe(true);
    await page.evaluate(() => window.editorHarness.setProps('first', { theme: 'system' }));
    await expect(root).toHaveCSS('color-scheme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(root).toHaveCSS('color-scheme', 'light');
    await expect(annotation).toHaveValue('Theme test');
    await page.evaluate(() => window.editorHarness.setProps('first', { theme: 'dark' }));
    await expect(root).toHaveCSS('color-scheme', 'dark');
    await page.evaluate(() => window.editorHarness.setSaveMode('first', 'reject'));
    await root.getByRole('button', { name: 'Save image', exact: true }).click();
    await expect(root.getByRole('alert')).toContainText('Could not save');
    await scan('save-error');
  });

  test('explicit themes remain independent across editor instances', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(url);
    await page.waitForFunction(() => !!window.editorHarness);
    await page.evaluate(() => {
      window.editorHarness.mount('first', { theme: 'light' });
      window.editorHarness.mount('second', { theme: 'dark' });
    });
    const first = page.locator('[data-editor-host="first"] .image-editor');
    const second = page.locator('[data-editor-host="second"] .image-editor');
    await expect(first).toHaveCSS('color-scheme', 'light');
    await expect(second).toHaveCSS('color-scheme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(first).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(second).toHaveCSS('background-color', 'rgb(17, 24, 39)');
    await page.evaluate(() => window.editorHarness.setProps('first', { theme: 'dark' }));
    await expect(first).toHaveCSS('color-scheme', 'dark');
    await expect(second).toHaveCSS('color-scheme', 'dark');
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    const button = first.getByRole('button', { name: 'Upload an image', exact: true });
    await button.focus();
    await expect(button).toHaveCSS('outline-style', 'solid');
    if (await page.evaluate(() => matchMedia('(forced-colors: active)').matches)) {
      await expect(first).toHaveCSS('background-color', await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'Canvas'; probe.style.colorScheme = 'dark'; document.body.append(probe);
      const color = getComputedStyle(probe).backgroundColor; probe.remove(); return color;
      }));
    }
  });
}

// The host can switch themes without accessing the shadow tree.
export function hostThemeTests(url: string) {
  test('host theme switches change the background in upload and editing views', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(url);
    await page.waitForFunction(() => !!window.editorHarness);
    await page.evaluate(() => window.editorHarness.mount());
    const root = page.locator('.image-editor');
    await expect(root.getByRole('button', { name: 'Upload an image', exact: true })).toBeVisible();
    await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    await expect(root).toHaveCSS('background-color', 'rgb(17, 24, 39)');
    await expect(root).toHaveCSS('color', 'rgb(229, 231, 235)');
    await page.evaluate(() => document.documentElement.dataset.theme = 'light');
    await expect(root).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await page.evaluate(() => {
      delete document.documentElement.dataset.theme;
      document.documentElement.classList.add('dark');
    });
    await expect(root).toHaveCSS('background-color', 'rgb(17, 24, 39)');
    await imageBlob(page);
    await expect(root).toHaveCSS('background-color', 'rgb(17, 24, 39)');
    await expect(root.getByRole('button', { name: 'Save image', exact: true })).toBeEnabled();
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await expect(root).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    await expect(root).toHaveCSS('background-color', 'rgb(17, 24, 39)');
    await page.evaluate(() => window.editorHarness.setProps('first', { theme: 'light' }));
    await expect(root).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });
}
