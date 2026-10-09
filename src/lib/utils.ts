import type { ImageLimits, PreparedImage, Validator } from './types';
export const DEFAULT_IMAGE_LIMITS: Readonly<ImageLimits> = Object.freeze({ maxInputBytes: 50 * 1024 * 1024, maxInputPixels: 80000000, maxEditorDimension: 8192 });
export function resolveLimits(value: Partial<ImageLimits> = {}): ImageLimits {
    const limits = { ...DEFAULT_IMAGE_LIMITS, ...value };
    for (const n of Object.values(limits))
        if (!Number.isSafeInteger(n) || n <= 0)
            throw new Error('Image limits must be positive whole numbers.');
    return limits;
}
export interface ImageHeader {
    mime?: string;
    width?: number;
    height?: number;
    raster: boolean;
}
export function inspectHeader(bytes: Uint8Array): ImageHeader {
    const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
    const need = (n: number) => {
        if (bytes.length < n)
            throw new Error('The image header is incomplete.');
    };
    if (bytes[0] === 137 && ascii(1, 4) === 'PNG') {
        need(24);
        if (ascii(12, 16) !== 'IHDR')
            throw new Error('Invalid PNG header.');
        return { mime: 'image/png', width: d.getUint32(16), height: d.getUint32(20), raster: true };
    }
    if (ascii(0, 3) === 'GIF') {
        need(10);
        return { mime: 'image/gif', width: d.getUint16(6, true), height: d.getUint16(8, true), raster: true };
    }
    if (ascii(0, 2) === 'BM') {
        need(26);
        const dib = d.getUint32(14, true);
        return { mime: 'image/bmp', width: dib === 12 ? d.getUint16(18, true) : d.getInt32(18, true), height: dib === 12 ? d.getUint16(20, true) : Math.abs(d.getInt32(22, true)), raster: true };
    }
    if (bytes[0] === 255 && bytes[1] === 216) {
        let i = 2;
        while (i < bytes.length) {
            if (bytes[i++] !== 255)
                throw new Error('Invalid JPEG header.');
            while (bytes[i] === 255)
                i++;
            const marker = bytes[i++];
            if (marker === 217 || marker === 218)
                break;
            if (marker === 1 || (marker >= 208 && marker <= 215))
                continue;
            need(i + 2);
            const size = d.getUint16(i);
            if (size < 2)
                throw new Error('Invalid JPEG segment.');
            need(i + size);
            if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
                if (size < 7)
                    throw new Error('Invalid JPEG dimensions.');
                return { mime: 'image/jpeg', width: d.getUint16(i + 5), height: d.getUint16(i + 3), raster: true };
            }
            i += size;
        }
        throw new Error('Missing JPEG dimensions.');
    }
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
        need(20);
        const kind = ascii(12, 16);
        if (kind === 'VP8X') {
            need(30);
            return { mime: 'image/webp', width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16), raster: true };
        }
        if (kind === 'VP8L') {
            need(25);
            const bits = d.getUint32(21, true);
            return { mime: 'image/webp', width: (bits & 16383) + 1, height: ((bits >>> 14) & 16383) + 1, raster: true };
        }
        if (kind === 'VP8 ') {
            need(30);
            return { mime: 'image/webp', width: d.getUint16(26, true) & 16383, height: d.getUint16(28, true) & 16383, raster: true };
        }
        return { mime: 'image/webp', raster: true };
    }
    if (ascii(4, 8) === 'ftyp') {
        const brands = ascii(8, Math.min(bytes.length, 64));
        if (/avif|avis/.test(brands))
            return { mime: 'image/avif', raster: true };
        if (/heic|heix|hevc|hevx|mif1|msf1/.test(brands))
            return { mime: 'image/heic', raster: true };
    }
    const head = new TextDecoder().decode(bytes.subarray(0, 4096)).trimStart();
    if (/^(?:<\?xml[^>]*>\s*)?(?:<!--[^]*?-->\s*)*<svg[\s>]/i.test(head))
        return { mime: 'image/svg+xml', raster: false };
    if (/<!doctype\s+html|<html[\s>]|<body[\s>]/i.test(head))
        throw new Error('The response contains HTML, not an image.');
    return { raster: false };
}
export function checkDimensions(width: number, height: number, limits: ImageLimits): void {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0)
        throw new Error('Invalid image dimensions.');
    if (width > limits.maxInputPixels / height)
        throw new Error(`The image exceeds the ${limits.maxInputPixels.toLocaleString()} pixel limit.`);
}
export function fitDimensions(width: number, height: number, edge: number): {
    width: number;
    height: number;
} {
    const scale = Math.min(1, edge / Math.max(width, height));
    return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}
export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
export function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted)
        throw new DOMException('Image operation canceled.', 'AbortError');
}
export function canvasBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        try {
            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The browser could not encode this image.')), type, quality);
        }
        catch (e) {
            reject(e);
        }
    });
}
export async function fetchImage(url: string, limits: ImageLimits, signal: AbortSignal): Promise<Blob> {
    const parsed = new URL(url, location.href);
    if (!['http:', 'https:', 'blob:'].includes(parsed.protocol))
        throw new Error('Unsupported image URL.');
    return readImageResponse(await fetch(parsed, { signal }), limits.maxInputBytes);
}
export async function readImageResponse(response: Response, maxInputBytes: number): Promise<Blob> {
    if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Image request failed (${response.status}).`);
    }
    if (Number(response.headers.get('content-length')) > maxInputBytes) {
        await response.body?.cancel();
        throw new Error('The image exceeds the file size limit.');
    }
    const reader = response.body?.getReader();
    if (!reader) {
        const blob = await response.blob();
        if (blob.size > maxInputBytes)
            throw new Error('The image exceeds the file size limit.');
        return blob;
    }
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            size += value.byteLength;
            if (size > maxInputBytes) {
                await reader.cancel();
                throw new Error('The image exceeds the file size limit.');
            }
            chunks.push(new Uint8Array(value));
        }
    }
    finally {
        reader.releaseLock();
    }
    return new Blob(chunks, { type: response.headers.get('content-type') ?? '' });
}
const canvasLimits = new Map<number, number>();
export function probeCanvasEdge(requested: number, createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')): number {
    let candidate = requested;
    while (candidate >= 1) {
        const canvas = createCanvas();
        try {
            canvas.width = candidate;
            canvas.height = candidate;
            const context = canvas.getContext('2d');
            if (context) {
                context.fillStyle = '#fff';
                context.fillRect(candidate - 1, candidate - 1, 1, 1);
                if (context.getImageData(candidate - 1, candidate - 1, 1, 1).data[3] === 255)
                    return candidate;
            }
        }
        catch { /* Reduce the probe after an allocation or read failure. */
        }
        finally {
            canvas.width = 0;
            canvas.height = 0;
        }
        candidate = Math.floor(candidate / 2);
    }
    throw new Error('This browser cannot create an image canvas.');
}
function supportedEdge(requested: number): number {
    let edge = canvasLimits.get(requested);
    if (edge === undefined) {
        edge = probeCanvasEdge(requested);
        canvasLimits.set(requested, edge);
    }
    return edge;
}
export async function prepareImage(blob: Blob, limits: ImageLimits, validators: Validator[] = [], signal?: AbortSignal): Promise<PreparedImage> {
    throwIfAborted(signal);
    if (!blob.size)
        throw new Error('The image file is empty.');
    if (blob.size > limits.maxInputBytes)
        throw new Error(`The image exceeds the ${Math.round(limits.maxInputBytes / 1024 / 1024)} MiB file size limit.`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    throwIfAborted(signal);
    const header = inspectHeader(bytes);
    if (header.width !== undefined && header.height !== undefined)
        checkDimensions(header.width, header.height, limits);
    const typedBlob = new Blob([blob], { type: header.mime || blob.type || 'application/octet-stream' });
    const url = URL.createObjectURL(typedBlob);
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    let canvas: HTMLCanvasElement | undefined;
    let disposed = false;
    let imageReleased = false;
    const releaseImage = () => {
        if (imageReleased)
            return;
        imageReleased = true;
        image.src = '';
        URL.revokeObjectURL(url);
    };
    const dispose = () => {
        if (disposed)
            return;
        disposed = true;
        signal?.removeEventListener('abort', dispose);
        releaseImage();
        if (canvas) {
            canvas.width = 0;
            canvas.height = 0;
        }
    };
    signal?.addEventListener('abort', dispose, { once: true });
    try {
        await image.decode();
        throwIfAborted(signal);
        const originalWidth = image.naturalWidth, originalHeight = image.naturalHeight;
        checkDimensions(originalWidth, originalHeight, limits);
        const warnings = validators.filter(v => v.test(image)).map(v => v.message);
        const edge = supportedEdge(Math.min(limits.maxEditorDimension, Math.max(originalWidth, originalHeight)));
        throwIfAborted(signal);
        const { width, height } = fitDimensions(originalWidth, originalHeight, edge);
        const resized = width !== originalWidth || height !== originalHeight;
        let source: HTMLImageElement | HTMLCanvasElement = image;
        let normalized: Blob | undefined;
        if (resized || !header.raster) {
            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx)
                throw new Error('This browser cannot draw an image.');
            ctx.drawImage(image, 0, 0, width, height);
            source = canvas;
            normalized = await canvasBlob(canvas);
            throwIfAborted(signal);
            releaseImage();
        }
        // The component owns the source after preparation. Keep it alive until
        // the old renderer has unmounted when a new load aborts this request.
        signal?.removeEventListener('abort', dispose);
        return { blob: normalized ?? typedBlob, source, width, height, originalWidth, originalHeight, warnings, resized, originalBlob: blob, copyBlob: header.raster ? typedBlob : normalized!, copyLabel: header.raster ? 'Copy original' : 'Save as PNG', dispose };
    }
    catch (error) {
        dispose();
        throw error instanceof DOMException && error.name === 'AbortError' ? error : new Error(`Cannot load image. ${errorMessage(error)}`);
    }
}
