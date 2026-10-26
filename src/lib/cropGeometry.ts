interface CropBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}
interface ImageBounds {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
    angle: number;
}

export function cropExtendsOutsideImage(crop: CropBounds, image: ImageBounds): boolean {
    const radians = image.angle * Math.PI / 180;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    // Ignore arithmetic noise, not visible overflow. Units are working-image pixels.
    const epsilon = Math.max(1, image.width, image.height) * 1e-9;
    for (const x of [crop.x, crop.x + crop.width]) {
        for (const y of [crop.y, crop.y + crop.height]) {
            const dx = x - image.centerX, dy = y - image.centerY;
            // Compare in the image's unrotated coordinate system.
            const localX = dx * cos + dy * sin;
            const localY = -dx * sin + dy * cos;
            if (Math.abs(localX) > image.width / 2 + epsilon || Math.abs(localY) > image.height / 2 + epsilon) return true;
        }
    }
    return false;
}
