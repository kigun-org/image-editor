import { styleIsolationTests } from '../style-isolation';
import { test, expect } from '../helpers';
styleIsolationTests('/src/lib/ImageEditor.svelte');

test('demo FlyonUI class samples keep their outside styles', async ({ page }, testInfo) => {
  await page.route('**/src/main.js', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.goto('/');
  const samples = page.getByRole('region', { name: 'Outside style isolation samples' });
  const styles = () => samples.locator('button, input, select, .alert').evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element);
    return [style.font, style.color, style.backgroundColor, style.border, style.padding, style.boxSizing];
  }));
  const before = await styles();
  await page.evaluate(async () => {
    const modulePath = '/src/main.js?isolation-demo';
    await import(/* @vite-ignore */ modulePath);
  });
  await expect(page.getByRole('button', { name: 'Upload an image', exact: true })).toBeVisible();
  expect(await styles()).toEqual(before);
  await testInfo.attach('demo-isolation-samples', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
});
