import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect, openLibrary } from '../helpers';

const formats = [
  {name: 'transparent.png', mime: 'image/png', width: 12, height: 8, optional: false},
  {name: 'orientation6.jpg', mime: 'image/jpeg', width: 8, height: 12, optional: false},
  {name: 'color.webp', mime: 'image/webp', width: 12, height: 8, optional: false},
  {name: 'animated.gif', mime: 'image/gif', width: 2, height: 1, optional: false},
  {name: 'color.bmp', mime: 'image/bmp', width: 12, height: 8, optional: false},
  {name: 'color.avif', mime: 'image/avif', width: 64, height: 64, optional: true},
  {name: 'color.heic', mime: 'image/heic', width: 12, height: 8, optional: true},
];
const fixturePath = (name: string) => fileURLToPath(new URL(`../fixtures/formats/${name}`, import.meta.url));

async function independentlyDecode(page: Page, bytes: Buffer, mime: string) {
  return page.evaluate(async ({bytes, mime}) => {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], {type: mime}));
    try {
      const image = new Image(); image.src = url; await image.decode();
      return {width: image.naturalWidth, height: image.naturalHeight};
    } catch { return undefined; }
    finally { URL.revokeObjectURL(url); }
  }, {bytes: [...bytes], mime});
}

for (const format of formats) {
  test(`${format.name}: library editing follows native decoder dimensions and orientation`, async ({page}, testInfo) => {
    await openLibrary(page);
    const bytes = readFileSync(fixturePath(format.name));
    const native = await independentlyDecode(page, bytes, format.mime);
    if (!format.optional) expect(native, `Required browser decoder: ${format.name}`).toBeDefined();
    testInfo.annotations.push({type: 'native-decoder', description: `${format.name}: ${native ? 'supported' : 'unsupported'}`});
    await page.getByLabel('Image file', {exact: true}).setInputFiles(fixturePath(format.name));
    if (!native) {
      await expect(page.getByRole('alert')).toContainText(/decode|supported|valid|image/i);
      expect(await page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(0);
      await expect(page.getByRole('button', {name: 'Retry', exact: true})).toBeVisible();
      return;
    }
    expect(native).toEqual({width: format.width, height: format.height});
    await expect(page.getByRole('button', {name: 'Save image', exact: true})).toBeEnabled();
    await page.getByRole('button', {name: 'Save image', exact: true}).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saved('first').length)).toBe(1);
    const output = await page.evaluate(async () => {
      const blob = window.editorHarness.saved('first')[0];
      const image = new Image(); const url = URL.createObjectURL(blob);
      try {
        image.src = url; await image.decode();
        return {width: image.naturalWidth, height: image.naturalHeight, mime: blob.type};
      } finally { URL.revokeObjectURL(url); }
    });
    expect(output).toEqual({width: format.width, height: format.height, mime: 'image/jpeg'});
  });

  test(`${format.name}: verified original copy keeps exact bytes and MIME`, async ({page}, testInfo) => {
    const bytes = readFileSync(fixturePath(format.name));
    await page.route('**/format-gallery.json', route => route.fulfill({json: {visits: [{title: 'Format fixture', images: [{id: format.name, url: `/original-${format.name}`, thumbnail: '/tests/fixtures/tiny.png'}]}]}}));
    await page.route(`**/original-${format.name}`, route => route.fulfill({contentType: format.mime, body: bytes}));
    await openLibrary(page, {galleryURL: '/format-gallery.json'});
    const native = await independentlyDecode(page, bytes, format.mime);
    if (!format.optional) expect(native).toBeDefined();
    testInfo.annotations.push({type: 'native-decoder', description: `${format.name}: ${native ? 'supported' : 'unsupported'}`});
    await page.getByRole('button', {name: 'Select an existing image'}).click();
    await page.getByRole('radio').check();
    await page.getByRole('button', {name: 'Upload original'}).click();
    if (!native) {
      await expect(page.getByRole('alert')).toContainText(/decode|supported|valid|image/i);
      expect(await page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(0);
      return;
    }
    await expect.poll(() => page.evaluate(() => window.editorHarness.saved('first').length)).toBe(1);
    const copied = await page.evaluate(async () => {
      const blob = window.editorHarness.saved('first')[0];
      return {mime: blob.type, bytes: [...new Uint8Array(await blob.arrayBuffer())]};
    });
    expect(copied.mime).toBe(format.mime);
    expect(copied.bytes).toEqual([...bytes]);
  });
}

test('transparent source pixels are flattened to the documented gray in edited JPEG', async ({page}) => {
  await openLibrary(page);
  await page.getByLabel('Image file', {exact: true}).setInputFiles(fixturePath('transparent.png'));
  await expect(page.getByRole('button', {name: 'Save image', exact: true})).toBeEnabled();
  await page.getByRole('button', {name: 'Save image', exact: true}).click();
  await expect.poll(() => page.evaluate(() => window.editorHarness.saved('first').length)).toBe(1);
  const pixel = await page.evaluate(async () => {
    const url = URL.createObjectURL(window.editorHarness.saved('first')[0]);
    try {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
      return [...ctx.getImageData(10, 6, 1, 1).data];
    } finally { URL.revokeObjectURL(url); }
  });
  for (const channel of pixel.slice(0, 3)) expect(Math.abs(channel - 105)).toBeLessThanOrEqual(25);
  expect(pixel[3]).toBe(255);
});
