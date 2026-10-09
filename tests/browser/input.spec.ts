import { test, expect, openLibrary, imageBlob, savedDimensions } from '../helpers';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const fixture = fileURLToPath(new URL('../fixtures/tiny.png', import.meta.url));
test('file chooser accepts image and ignores empty cancellation', async ({ page }) => {
    await openLibrary(page);
    await page.locator('input[type=file]').setInputFiles([]);
    await expect(page.getByRole('button', { name: 'Upload an image' })).toBeEnabled();
    await page.locator('input[type=file]').setInputFiles(fixture);
    await expect(page.getByRole('button', { name: 'Save image', exact: true })).toBeEnabled();
});
test('malformed content gives recoverable error without a save', async ({ page }) => {
    await openLibrary(page);
    const beforeHeight = await page.locator('.image-editor').evaluate(element => element.clientHeight);
    await page.locator('input[type=file]').setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('<html>failure</html>') });
    await expect(page.getByRole('alert')).toContainText('HTML');
    expect(await page.locator('.image-editor').evaluate(element => element.clientHeight)).toBe(beforeHeight);
    await expect(page.getByRole('alert')).toHaveCSS('position', 'absolute');
    await expect(page.locator('.ie-page')).toHaveAttribute('inert', '');
    await expect(page.locator('.ie-page')).toHaveCSS('filter', 'blur(4px)');
    expect(await page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(0);
    await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
    await expect(page.locator('.ie-page')).not.toHaveAttribute('inert', '');
    await expect(page.locator('.ie-page')).toHaveCSS('filter', 'none');
    await expect(page.getByRole('button', { name: 'Upload an image' })).toBeFocused();
    await page.locator('input[type=file]').setInputFiles(fixture);
    await expect(page.getByRole('button', { name: 'Save image', exact: true })).toBeEnabled();
});
test('byte and pixel budgets reject before rendering', async ({ page }) => {
    await openLibrary(page, { imageLimits: { maxInputBytes: 1 } });
    await page.locator('input[type=file]').setInputFiles(fixture);
    await expect(page.getByRole('alert')).toContainText('file size limit');
    await page.evaluate(() => window.editorHarness.setProps('first', { imageLimits: { maxInputPixels: 10 } }));
    await page.locator('input[type=file]').setInputFiles(fixture);
    await expect(page.getByRole('alert')).toContainText('pixel limit');
});
test('working size override emits notice and correct crop dimensions', async ({ page }) => {
    await openLibrary(page, { imageLimits: { maxEditorDimension: 100 } });
    await imageBlob(page, 400, 200);
    await expect(page.getByText('Image resized to 100 by 50 pixels for this browser.')).toBeVisible();
    await page.getByRole('button', { name: 'Save image', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(1);
    expect(await savedDimensions(page)).toEqual({ width: 100, height: 50 });
});
test('paste is scoped and file fallback loads an image', async ({ page }) => {
    await openLibrary(page);
    const outside = await page.evaluate(() => {
        const data = new DataTransfer();
        data.setData('text/plain', 'unchanged');
        const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data });
        document.querySelector<HTMLInputElement>('[data-editor-host] input:not([type=file])')!.dispatchEvent(event);
        return event.defaultPrevented;
    });
    expect(outside).toBe(false);
    await page.evaluate(async () => {
        const c = document.createElement('canvas');
        c.width = 80;
        c.height = 60;
        const blob = await new Promise<Blob>(resolve => c.toBlob(value => resolve(value!)));
        const transfer = new DataTransfer();
        transfer.items.add(new File([blob], 'paste.png', { type: 'image/png' }));
        document.querySelector('[data-image-editor-host]')!.shadowRoot!.querySelector('.image-editor')!.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }));
    });
    await expect(page.getByRole('button', { name: 'Save image', exact: true })).toBeEnabled();
});
test('gallery fetch error never invokes callback', async ({ page, libraryErrors }) => {
    await page.route('**/gallery-test.json', route => route.fulfill({ json: { visits: [{ title: 'Visit', images: [{ id: 'one', url: '/bad-image.png', thumbnail: '/tests/fixtures/tiny.png' }] }] } }));
    await page.route('**/bad-image.png', route => route.fulfill({ status: 404, contentType: 'text/html', body: 'not an image' }));
    await openLibrary(page, { galleryURL: '/gallery-test.json' });
    await page.getByRole('button', { name: 'Select an existing image' }).click();
    await page.getByRole('radio').check();
    await page.getByRole('button', { name: 'Upload original' }).click();
    await expect(page.getByRole('alert')).toContainText('404');
    expect(await page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(0);
    // The deliberately routed HTTP 404 can emit one browser network diagnostic.
    const expected = libraryErrors.findIndex(message => /Failed to load resource.*404/.test(message));
    if (expected >= 0)
        libraryErrors.splice(expected, 1);
});
test('SVG original uploads as PNG without a review screen', async ({ page }) => {
    await page.route('**/gallery-test.json', route => route.fulfill({ json: { visits: [{ title: 'Visit', images: [{ id: 'one', url: '/input.svg', thumbnail: '/tests/fixtures/tiny.png' }] }] } }));
    await page.route('**/input.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="red"/></svg>' }));
    await openLibrary(page, { galleryURL: '/gallery-test.json' });
    await page.evaluate(() => window.editorHarness.setProps('first', { validators: [{ test: (image: HTMLImageElement) => image.width === 40, message: 'Review small image.' }] }));
    await page.getByRole('button', { name: 'Select an existing image' }).click();
    await page.getByRole('radio').check();
    await page.getByRole('button', { name: 'Upload original' }).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saved('first').length)).toBe(1);
    expect(await page.evaluate(() => window.editorHarness.saved('first')[0].type)).toBe('image/png');
});
declare global {
    interface Window {
        releaseDecode?: () => void;
        decodeStarted?: boolean;
        nextImage?: Blob;
        releaseClipboard?: () => void;
    }
}
test('load B supersedes A while A decode is still pending', async ({ page }) => {
    await openLibrary(page);
    await page.evaluate(async () => {
        const original = HTMLImageElement.prototype.decode;
        let first = true;
        HTMLImageElement.prototype.decode = async function () {
            await original.call(this);
            if (first) {
                first = false;
                window.decodeStarted = true;
                await new Promise<void>(resolve => window.releaseDecode = resolve);
            }
        };
        const create = async (width: number, height: number) => {
            const c = document.createElement('canvas');
            c.width = width;
            c.height = height;
            return new Promise<Blob>(resolve => c.toBlob(value => resolve(value!)));
        };
        window.nextImage = await create(160, 120);
        window.editorHarness.setProps('first', { imageBlob: await create(80, 60) });
    });
    await page.waitForFunction(() => window.decodeStarted);
    await page.evaluate(() => window.editorHarness.setProps('first', { imageBlob: window.nextImage }));
    await expect(page.getByRole('status').filter({ hasText: 'Loading image' })).toBeVisible();
    await page.evaluate(() => window.releaseDecode?.());
    await page.getByRole('button', { name: 'Save image', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(1);
    expect(await savedDimensions(page)).toEqual({ width: 160, height: 120 });
    await expect(page.getByRole('button', { name: 'Save image', exact: true })).toBeEnabled();
});

test('a delayed clipboard read cannot replace a newer image', async ({ page }) => {
    await openLibrary(page);
    await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            read: () => new Promise(resolve => {
                window.releaseClipboard = () => resolve([{ types: ['image/png'], getType: async () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 30; canvas.height = 20;
                    return new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
                } }]);
            }),
        } });
    });
    await page.getByRole('button', { name: 'Paste an image' }).click();
    await page.waitForFunction(() => !!window.releaseClipboard);
    await imageBlob(page, 160, 120);
    await page.evaluate(() => window.releaseClipboard!());
    await page.getByRole('button', { name: 'Save image', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(1);
    expect(await savedDimensions(page)).toEqual({ width: 160, height: 120 });
});

test('clipboard read failure retries the clipboard operation', async ({ page }) => {
    await openLibrary(page);
    await page.evaluate(() => {
        let attempts = 0;
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            read: async () => {
                if (++attempts === 1) throw new Error('Clipboard permission denied.');
                return [{ types: ['image/png'], getType: async () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 30; canvas.height = 20;
                    return new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
                } }];
            },
        } });
    });
    await page.getByRole('button', { name: 'Paste an image' }).click();
    await expect(page.getByRole('alert')).toContainText('Clipboard permission denied.');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save image', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Save image', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(1);
    expect(await savedDimensions(page)).toEqual({ width: 30, height: 20 });
});

test('cancel during decode restores upload focus and ignores the late result', async ({ page }) => {
    await openLibrary(page);
    await page.evaluate(() => {
        const original = HTMLImageElement.prototype.decode;
        HTMLImageElement.prototype.decode = async function () {
            await original.call(this);
            window.decodeStarted = true;
            await new Promise<void>(resolve => window.releaseDecode = resolve);
        };
    });
    await page.locator('input[type=file]').setInputFiles(fixture);
    await page.waitForFunction(() => window.decodeStarted);
    await page.getByRole('button', { name: 'Cancel loading' }).click();
    await expect(page.getByRole('button', { name: 'Upload an image' })).toBeFocused();
    await page.evaluate(() => window.releaseDecode!());
    await expect(page.getByRole('button', { name: 'Upload an image' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Save image', exact: true })).toHaveCount(0);
});
test('exact byte limit accepts and one byte below rejects the same reselected file', async ({ page }) => {
    const bytes = readFileSync(fixture);
    await openLibrary(page, { imageLimits: { maxInputBytes: bytes.length - 1 } });
    await page.locator('input[type=file]').setInputFiles(fixture);
    await expect(page.getByRole('alert')).toContainText('file size limit');
    await page.evaluate(length => window.editorHarness.setProps('first', { imageLimits: { maxInputBytes: length } }), bytes.length);
    await page.locator('input[type=file]').setInputFiles(fixture);
    await expect(page.getByRole('button', { name: 'Save image', exact: true })).toBeEnabled();
});
test('drop files with incorrect MIME use content verification', async ({ page }) => {
    await openLibrary(page);
    const bytes = [...readFileSync(fixture)];
    await page.evaluate(bytes => {
        const data = new DataTransfer();
        data.items.add(new File([new Uint8Array(bytes)], 'photo.bin', { type: 'text/plain' }));
        document.querySelector('[data-image-editor-host]')!.shadowRoot!.querySelector('.ie-upload')!.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
    }, bytes);
    await expect(page.getByRole('button', { name: 'Save image', exact: true })).toBeEnabled();
});
test('original upload retries a failed save without opening a review screen', async ({ page }) => {
    let fetches = 0;
    await page.route('**/gallery-test.json', route => route.fulfill({ json: { visits: [{ title: 'Visit', images: [{ id: 'one', url: '/retry-original.png', thumbnail: '/tests/fixtures/tiny.png' }] }] } }));
    await page.route('**/retry-original.png', route => {
        fetches++;
        return route.fulfill({ contentType: 'image/png', body: readFileSync(fixture) });
    });
    await openLibrary(page, { galleryURL: '/gallery-test.json' });
    await page.evaluate(() => window.editorHarness.setSaveMode('first', 'reject'));
    await page.getByRole('button', { name: 'Select an existing image' }).click();
    await page.getByRole('radio').check();
    await page.getByRole('button', { name: 'Upload original' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Review image' })).toHaveCount(0);
    await page.evaluate(() => window.editorHarness.setSaveMode('first', 'resolve'));
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(2);
    expect(await page.evaluate(() => {
        const attempts = window.editorHarness.saved('first');
        return attempts[0] === attempts[1];
    })).toBe(true);
    expect(fetches).toBe(1);
    await expect(page.getByRole('button', { name: 'Upload an image' })).toBeVisible();
});

test('gallery copies verified raster bytes and corrects misleading MIME', async ({ page }) => {
    const bytes = readFileSync(fixture);
    await page.route('**/gallery-test.json', route => route.fulfill({ json: { visits: [{ title: 'Visit', images: [{ id: 'one', url: '/original.bin', thumbnail: '/tests/fixtures/tiny.png' }] }] } }));
    await page.route('**/original.bin', route => route.fulfill({ contentType: 'text/plain', body: bytes }));
    await openLibrary(page, { galleryURL: '/gallery-test.json' });
    await page.getByRole('button', { name: 'Select an existing image' }).click();
    await page.getByRole('radio').check();
    await page.getByRole('button', { name: 'Upload original' }).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls('first'))).toBe(1);
    const saved = await page.evaluate(async () => {
        const blob = window.editorHarness.saved('first')[0];
        return { type: blob.type, bytes: [...new Uint8Array(await blob.arrayBuffer())] };
    });
    expect(saved).toEqual({ type: 'image/png', bytes: [...bytes] });
});
test('destroy during decode releases resources and ignores late completion', async ({ page }) => {
    await openLibrary(page);
    await page.evaluate(async () => {
        const original = HTMLImageElement.prototype.decode;
        HTMLImageElement.prototype.decode = async function () {
            await original.call(this);
            window.decodeStarted = true;
            await new Promise<void>(resolve => window.releaseDecode = resolve);
        };
        const canvas = document.createElement('canvas');
        canvas.width = 30;
        canvas.height = 20;
        const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!)));
        window.editorHarness.setProps('first', { imageBlob: blob });
    });
    await page.waitForFunction(() => window.decodeStarted);
    await page.evaluate(() => {
        window.editorHarness.unmount('first');
        window.releaseDecode?.();
    });
    await expect(page.locator('[data-editor-host="first"]')).toHaveCount(0);
});
