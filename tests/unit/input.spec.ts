import { test, expect } from '@playwright/test';
import { DEFAULT_IMAGE_LIMITS, checkDimensions, fitDimensions, inspectHeader, resolveLimits, readImageResponse, probeCanvasEdge } from '../../src/lib/utils';
test('accepted high-resolution defaults and valid overrides', () => {
    expect(resolveLimits()).toEqual({ maxInputBytes: 50 * 1024 * 1024, maxInputPixels: 80000000, maxEditorDimension: 8192 });
    expect(resolveLimits({ maxInputPixels: 100 }).maxInputPixels).toBe(100);
    for (const value of [0, -1, NaN, Infinity, 1.5])
        expect(() => resolveLimits({ maxInputBytes: value })).toThrow();
});
test('pixel budget accepts equality and rejects invalid or overflowing dimensions', () => {
    checkDimensions(10000, 8000, DEFAULT_IMAGE_LIMITS);
    for (const [width, height] of [[10001, 8000], [0, 1], [-1, 1], [Infinity, 1], [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]])
        expect(() => checkDimensions(width, height, DEFAULT_IMAGE_LIMITS)).toThrow();
});
test('dimension fitting preserves aspect and respects device limits', () => {
    expect(fitDimensions(12000, 6000, 8192)).toEqual({ width: 8192, height: 4096 });
    expect(fitDimensions(6000, 12000, 4096)).toEqual({ width: 2048, height: 4096 });
    expect(fitDimensions(5, 3, 10)).toEqual({ width: 5, height: 3 });
    expect(fitDimensions(100000, 1, 8192)).toEqual({ width: 8192, height: 1 });
});
test('PNG dimensions come from bytes instead of claimed MIME', () => {
    const bytes = new Uint8Array(24);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    bytes.set(new TextEncoder().encode('IHDR'), 12);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 9000);
    view.setUint32(20, 9000);
    expect(inspectHeader(bytes)).toEqual({ mime: 'image/png', width: 9000, height: 9000, raster: true });
    expect(() => checkDimensions(9000, 9000, DEFAULT_IMAGE_LIMITS)).toThrow();
    expect(() => inspectHeader(bytes.slice(0, 20))).toThrow();
});
test('recognizes GIF, short WebP lossless, SVG, and rejects HTML', () => {
    const gif = new Uint8Array([71, 73, 70, 56, 57, 97, 10, 0, 20, 0]);
    expect(inspectHeader(gif)).toMatchObject({ mime: 'image/gif', width: 10, height: 20 });
    const webp = new Uint8Array(25);
    webp.set(new TextEncoder().encode('RIFF'), 0);
    webp.set(new TextEncoder().encode('WEBPVP8L'), 8);
    webp[20] = 47;
    new DataView(webp.buffer).setUint32(21, 9 | (19 << 14), true);
    expect(inspectHeader(webp)).toMatchObject({ mime: 'image/webp', width: 10, height: 20 });
    expect(inspectHeader(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toEqual({ mime: 'image/svg+xml', raster: false });
    expect(() => inspectHeader(new TextEncoder().encode('<!DOCTYPE html><html>error</html>'))).toThrow(/HTML/);
});
test('streamed response enforces bytes even without Content-Length', async () => {
    let canceled = false;
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
            controller.enqueue(new Uint8Array(4));
            controller.enqueue(new Uint8Array(5));
        }, cancel() {
            canceled = true;
        } });
    await expect(readImageResponse(new Response(stream), 8)).rejects.toThrow('file size limit');
    expect(canceled).toBe(true);
    const exact = await readImageResponse(new Response(new Uint8Array(8)), 8);
    expect(exact.size).toBe(8);
    await expect(readImageResponse(new Response('not an image', { status: 404 }), 100)).rejects.toThrow('404');
    await expect(readImageResponse(new Response('x', { headers: { 'Content-Length': '1000' } }), 8)).rejects.toThrow('file size limit');
});
test('canvas capability fallback releases every probe including failed candidates', () => {
    const probes: Array<{
        width: number;
        height: number;
    }> = [];
    const edge = probeCanvasEdge(16, () => {
        const canvas = { width: 0, height: 0, getContext() {
                if (this.width > 4)
                    return null;
                return { fillStyle: '', fillRect() {
                    }, getImageData() {
                        return { data: new Uint8Array([255, 255, 255, 255]) };
                    } };
            } };
        probes.push(canvas);
        return canvas as unknown as HTMLCanvasElement;
    });
    expect(edge).toBe(4);
    expect(probes).toHaveLength(3);
    for (const probe of probes)
        expect(probe).toMatchObject({ width: 0, height: 0 });
});
