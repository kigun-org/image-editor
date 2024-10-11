import canvasSize from "canvas-size";

async function resizeImageBlob(blob, newWidth, newHeight) {
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

            // if blob is too big, set the next step to a power of two
            // (mostly for Safari iOS, which only supports 4096x4096 pixels).
            const pow2Dimension = Math.pow(2, Math.floor( Math.log2(maxDimension) ))
            return canvasSize.maxArea({max: maxDimension, step: maxDimension - pow2Dimension})
        }) // @ts-ignore
        .then(async ({ success, width, height }) => {
            if (!success) {
                console.error("Error determining canvas size.")
                return
            }

            if (Math.max(width, height) === Math.max(originalWidth, originalHeight)) {
                // no resize necessary
                return blob
            } else {
                // resize to maximum dimension
                let newWidth = originalWidth
                let newHeight = originalHeight
                if (originalWidth > originalHeight) {
                    if (originalWidth > width) {
                        newWidth = width
                        newHeight = originalHeight * (newWidth / originalWidth)
                    }
                } else {
                    if (originalHeight > height) {
                        newHeight = height
                        newWidth = originalWidth * (newHeight / originalHeight)
                    }
                }

                return await resizeImageBlob(blob, newWidth, newHeight)
            }
        })
}