import canvasSize from "canvas-size";

async function resizeImageBlob(blob, width, height, maxDimension) {
    let newWidth = width
    let newHeight = height
    if (width > height) {
        if (width > maxDimension) {
            newWidth = maxDimension
            newHeight = height * (newWidth / width)
        }
    } else {
        if (height > maxDimension) {
            newHeight = maxDimension
            newWidth = width * (newHeight / height)
        }
    }

    return createImageBitmap(blob, { resizeWidth: newWidth, resizeHeight: newHeight, resizeQuality: "high" })
        .then((imageBitmap) => {
            const offscreen = new OffscreenCanvas(imageBitmap.width, imageBitmap.height)
            const ctx = offscreen.getContext("bitmaprenderer")

            ctx.transferFromImageBitmap(imageBitmap)
            return offscreen.convertToBlob()
        })

}

export function resizeBlob(blob, limit: number = undefined) {
    /*
     * Safari iOS doesn't support canvases larger than 4096x4096,
     * so resize the image if we detect a browser which doesn't support
     * the current image size.
     */
    let originalWidth
    let originalHeight
    let maxDimension

    return createImageBitmap(blob)
        .then((imageBitmap) => {
            originalWidth = imageBitmap.width
            originalHeight = imageBitmap.height
            maxDimension = Math.max(imageBitmap.width, imageBitmap.height)

            if (limit) {
                maxDimension = Math.min(maxDimension, limit)
            }

            return canvasSize.maxArea({max: Math.max(imageBitmap.width, imageBitmap.height)})
        }) // @ts-ignore
        .then(async ({ success, width, height }) => {
            if (!success) {
                console.error("Error determining canvas size.")
                return
            }

            if (Math.max(width, height) === maxDimension) {
                // no resize necessary
                return blob
            } else {
                // resize to maximum dimension
                return await resizeImageBlob(blob, originalWidth, originalHeight, maxDimension)
            }
        })
}