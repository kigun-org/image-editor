import { test, expect } from '@playwright/test';
import { cropExtendsOutsideImage } from '../../src/lib/cropGeometry';

const image = { centerX: 800, centerY: 800, width: 1600, height: 1200, angle: 0 };

test('aligned edges tolerate floating-point noise but still detect subpixel overflow', () => {
    const crop = { x: 200, y: 300, width: 1400, height: 1100 };
    expect(cropExtendsOutsideImage(crop, image)).toBe(false);
    expect(cropExtendsOutsideImage({ ...crop, width: crop.width + 1e-10 }, image)).toBe(false);
    expect(cropExtendsOutsideImage({ ...crop, height: crop.height + 1e-10 }, image)).toBe(false);
    for (const outside of [
        { x: -.01, y: 300, width: 100, height: 100 },
        { x: 200, y: 199.99, width: 100, height: 100 },
        { ...crop, width: crop.width + .01 },
        { ...crop, height: crop.height + .01 },
    ]) expect(cropExtendsOutsideImage(outside, image)).toBe(true);
});

test('containment follows rotated image edges, including quarter turns', () => {
    const square = { centerX: 100, centerY: 100, width: 100, height: 100, angle: 45 };
    const side = 100 / Math.sqrt(2);
    const touching = { x: 100 - side / 2, y: 100 - side / 2, width: side, height: side };
    for (const angle of [45, -45, 135]) {
        expect(cropExtendsOutsideImage(touching, { ...square, angle })).toBe(false);
        expect(cropExtendsOutsideImage({ ...touching, x: touching.x + .01 }, { ...square, angle })).toBe(true);
    }
    for (const angle of [90, -90, 270]) {
        expect(cropExtendsOutsideImage({ x: 200, y: 0, width: 1200, height: 1600 }, { ...image, angle })).toBe(false);
        expect(cropExtendsOutsideImage({ x: 0, y: 200, width: 1600, height: 1200 }, { ...image, angle })).toBe(true);
    }
});
