import { themeTests, hostThemeTests } from '../theme';
themeTests('/tests/harness/index.html');

import AxeBuilder from '@axe-core/playwright';
import { test, expect, openLibrary } from '../helpers';
test('dark gallery retains readable image controls', async ({ page }) => {
  await page.route('**/dark-gallery.json', route => route.fulfill({ json: {
    visits: [{ title: 'Sample images', images: [{ id: 'one', url: '/tests/fixtures/tiny.png', thumbnail: '/tests/fixtures/tiny.png' }] }],
  } }));
  await openLibrary(page, { theme: 'dark', galleryURL: '/dark-gallery.json' });
  await page.getByRole('button', { name: 'Select an existing image' }).click();
  await page.getByRole('radio', { name: 'Image one' }).check();
  const results = await new AxeBuilder({ page }).include('[data-editor-target]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
  expect(results.incomplete).toEqual([]);
});

hostThemeTests('/tests/harness/index.html');
