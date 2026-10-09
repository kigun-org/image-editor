import { test, expect, openLibrary, imageBlob, dragCanvas, savedDimensions } from '../helpers';
import type { Page } from '@playwright/test';
async function save(page: Page, count: number) {
    await page.getByRole('button', { name: 'Save image', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saved('first').length)).toBe(count);
}
async function sample(page: Page, index: number, points: number[][]) {
    return page.evaluate(async ({ index, points }) => {
        const bitmap = await createImageBitmap(window.editorHarness.saved('first')[index]);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext('2d')!;
        context.drawImage(bitmap, 0, 0);
        const result = { width: bitmap.width, height: bitmap.height,
            colors: points.map(([x, y]) => [...context.getImageData(x, y, 1, 1).data].slice(0, 3)) };
        bitmap.close(); canvas.width = 0; canvas.height = 0;
        return result;
    }, { index, points });
}
function expectColor(actual: number[], expected: number[]) {
    expected.forEach((value, index) => expect(Math.abs(actual[index] - value)).toBeLessThanOrEqual(4));
}

for (const direction of ['right', 'left'] as const) {
    test(`rotate ${direction} preserves crop orientation and saved colors`, async ({ page }) => {
        await openLibrary(page); await imageBlob(page);
        await page.getByRole('button', { name: `Rotate ${direction} 90°` }).click();
        await save(page, 1);
        const points = direction === 'right' ? [[250, 50], [50, 350]] : [[50, 350], [250, 50]];
        const output = await sample(page, 0, points);
        expect(output).toMatchObject({ width: 300, height: 400 });
        expectColor(output.colors[0], [231, 173, 52]);
        expectColor(output.colors[1], [22, 76, 132]);
    });
}

test('brightness and contrast affect saved pixels and reset restores the source', async ({ page }) => {
    await openLibrary(page); await imageBlob(page);
    await save(page, 1);
    await page.getByRole('slider', { name: 'Brightness:' }).fill('1.25');
    await save(page, 2);
    const bright = await sample(page, 1, [[300, 200]]);
    expectColor(bright.colors[0], [28, 95, 165]);
    await page.getByRole('slider', { name: 'Brightness:' }).fill('1');
    await page.getByRole('slider', { name: 'Contrast:' }).fill('0.25');
    await save(page, 3);
    const contrasted = await sample(page, 2, [[300, 200]]);
    expect(contrasted.colors[0][0]).toBeLessThan(22);
    expect(contrasted.colors[0][2]).toBeGreaterThan(132);
    await page.getByRole('button', { name: 'Reset' }).click();
    await save(page, 4);
    expect(await compare(page, 0, 3)).toBe(0);
});

test('annotation order changes saved pixels while selection controls are excluded', async ({ page }) => {
    await openLibrary(page); await imageBlob(page);
    await page.getByLabel('Annotation color').fill('#ff0000');
    await page.getByRole('button', { name: 'Add rectangle' }).click();
    await page.locator('.upper-canvas').click({ position: { x: 20, y: 20 } });
    await page.getByLabel('Annotation color').fill('#00ff00');
    await page.getByRole('button', { name: 'Add rectangle' }).click();
    await save(page, 1);
    expectColor((await sample(page, 0, [[200, 150]])).colors[0], [0, 255, 0]);
    await page.locator('.upper-canvas').click({ position: { x: 20, y: 20 } });
    await save(page, 2);
    expect(await compare(page, 0, 1)).toBe(0);
    const bounds = await page.locator('.upper-canvas').boundingBox();
    if (!bounds) throw new Error('Missing editing canvas.');
    await page.locator('.upper-canvas').click({ position: { x: bounds.width * .5, y: bounds.height * .5 } });
    await page.getByRole('button', { name: 'Send backward' }).click();
    await save(page, 3);
    expectColor((await sample(page, 2, [[200, 150]])).colors[0], [255, 0, 0]);
});
async function compare(page: Page, a: number, b: number) {
    return page.evaluate(async ({ a, b }) => {
        const blobs = window.editorHarness.saved('first');
        const pixels: Uint8ClampedArray[] = [];
        const sizes: string[] = [];
        for (const i of [a, b]) {
            const image = await createImageBitmap(blobs[i]);
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d')!;
            context.drawImage(image, 0, 0);
            sizes.push(`${image.width}x${image.height}`);
            pixels.push(context.getImageData(0, 0, canvas.width, canvas.height).data);
            image.close();
        }
        if (sizes[0] !== sizes[1] || pixels[0].length !== pixels[1].length)
            throw new Error('Export dimensions differ.');
        let changed = 0;
        for (let i = 0; i < pixels[0].length; i++)
            if (Math.abs(pixels[0][i] - pixels[1][i]) > 2)
                changed++;
        return changed;
    }, { a, b });
}
test('rotation grid and selected crop never enter saved pixels', async ({ page }) => {
    await openLibrary(page);
    await imageBlob(page);
    await save(page, 1);
    await page.getByRole('slider', { name: 'Rotation' }).fill('1');
    await page.getByRole('slider', { name: 'Rotation' }).fill('0');
    await save(page, 2);
    expect(await compare(page, 0, 1)).toBe(0);
});
test('flip changes pixels and second flip restores baseline', async ({ page }) => {
    await openLibrary(page);
    await imageBlob(page);
    await save(page, 1);
    await page.getByRole('button', { name: 'Flip horizontal' }).click();
    await save(page, 2);
    expect(await compare(page, 0, 1)).toBeGreaterThan(1000);
    await page.getByRole('button', { name: 'Flip horizontal' }).click();
    await save(page, 3);
    expect(await compare(page, 0, 2)).toBe(0);
});
test('crop dimensions and JPEG format follow canvas handles', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 1200 });
    await openLibrary(page);
    await imageBlob(page);
    await page.getByRole('checkbox', { name: 'Keep aspect ratio' }).uncheck();
    await dragCanvas(page, [1, .875], [.3, .325]);
    await save(page, 1);
    const result = await page.evaluate(async () => {
        const blob = window.editorHarness.saved('first')[0];
        const image = await createImageBitmap(blob);
        const output = { width: image.width, height: image.height, type: blob.type };
        image.close();
        return output;
    });
    expect(result.type).toBe('image/jpeg');
    expect(Math.abs(result.width - 120)).toBeLessThanOrEqual(2);
    expect(Math.abs(result.height - 80)).toBeLessThanOrEqual(2);
});
test('failed save retains edits and can retry without duplicate callback', async ({ page }) => {
    await openLibrary(page);
    await imageBlob(page);
    await page.getByRole('button', { name: 'Flip vertical' }).click();
    await page.evaluate(() => window.editorHarness.setSaveMode('first', 'reject'));
    await page.getByRole('button', { name: 'Save image', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('changes are kept');
    await expect(page.getByRole('button', { name: 'Flip vertical' })).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => window.editorHarness.setSaveMode('first', 'resolve'));
    await page.getByRole('button', { name: 'Retry save' }).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(2);
    await expect(page.getByRole('button', { name: 'Save image', exact: true })).toBeEnabled();
});
test('save pending disables controls and defers image prop replacement', async ({ page }) => {
    await openLibrary(page);
    await imageBlob(page);
    await page.evaluate(() => window.editorHarness.setSaveMode('first', 'pending'));
    await page.getByRole('button', { name: 'Save image', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Flip horizontal' })).toBeDisabled();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(1);
    await page.evaluate(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 80;
        canvas.height = 60;
        const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!)));
        window.editorHarness.setProps('first', { imageBlob: blob });
    });
    await expect(page.locator('.upper-canvas')).toHaveAttribute('width', '400');
    await page.evaluate(() => window.editorHarness.settleSave('first', true));
    await expect(page.locator('.upper-canvas')).toHaveAttribute('width', '80');
    await expect(page.getByRole('button', { name: 'Save image', exact: true })).toBeEnabled();
});
for (const mode of ['null', 'throw'] as const)
    test(`encoding ${mode} failure preserves editing and supports retry`, async ({ page }) => {
        await openLibrary(page);
        await imageBlob(page);
        await page.evaluate(mode => {
            const original = HTMLCanvasElement.prototype.toBlob;
            let fail = true;
            HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
                if (type === 'image/jpeg' && fail) {
                    fail = false;
                    if (mode === 'throw')
                        throw new Error('Controlled encoding failure.');
                    callback(null);
                    return;
                }
                original.call(this, callback, type, quality);
            };
        }, mode);
        await page.getByRole('button', { name: 'Save image', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('changes are kept');
        expect(await page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(0);
        await page.getByRole('button', { name: 'Retry save' }).click();
        await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(1);
        await expect(page.getByRole('button', { name: 'Save image', exact: true })).toBeEnabled();
    });
test('destroying a pending save leaves a second editor usable', async ({ page }) => {
    await openLibrary(page);
    await imageBlob(page);
    await page.evaluate(() => window.editorHarness.mount('second'));
    await imageBlob(page, 80, 60, 'second');
    await page.evaluate(() => window.editorHarness.setSaveMode('first', 'pending'));
    await page.locator('[data-editor-host="first"]').getByRole('button', { name: 'Save image', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(1);
    await page.evaluate(() => window.editorHarness.unmount('first'));
    await page.locator('[data-editor-host="second"]').getByRole('button', { name: 'Save image', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls('second'))).toBe(1);
});
test('pointer crop resize stays within all canvas bounds and retains aspect lock', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 1200 });
    await openLibrary(page);
    await imageBlob(page);
    await dragCanvas(page, [1, .875], [.5, .5]);
    await save(page, 1);
    const before = await savedDimensions(page);
    expect(before.width).toBeLessThan(400);
    expect(before.width / before.height).toBeCloseTo(4 / 3, 1);
    // Expand the top-left handle beyond the canvas. The crop must stay bounded.
    await dragCanvas(page, [0, .125], [-.1, -.1]);
    await save(page, 2);
    const after = await savedDimensions(page, 1);
    expect(after.width).toBeGreaterThan(before.width);
    expect(after.width).toBeLessThanOrEqual(400);
    expect(after.height).toBeLessThanOrEqual(400);
    expect(after.width / after.height).toBeCloseTo(4 / 3, 1);
});
