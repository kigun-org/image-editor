<script>
    import {Canvas, Circle, filters, Group, Image as FabricImage, Line, Path, Rect, Triangle} from 'fabric';
    import {onMount} from "svelte";

    export let originalImageBlob

    export let validators
    let warnings = []

    export let saveCallback
    let saving = false

    let canvasElement

    let canvas
    let canvasImage

    let crop = {
        rect: undefined,
        background: undefined,
        grid: undefined,
        warning: false
    }

    let flipH = false
    let flipV = false
    let rotation = 0

    let brightness = 0
    let contrast = 0

    let markers = []
    let activeMarker

    function validate(imageDataURL, validators) {
        const testImage = new Image()

        testImage.onload = () => {
            warnings = []
            for (const validator of validators) {
                if (validator.test(testImage)) {
                    warnings = [...warnings, validator.message]
                }
            }
        }

        testImage.src = imageDataURL
    }

    function hideWarning(ev) {
        ev.target.parentElement.classList.add("d-none")
    }

    function createCropRect(image) {
        const rect = new Rect({
            left: image.left,
            top: image.top,
            width: image.width,
            height: image.height,
            fill: 'transparent',
            strokeWidth: 0,
            minScaleLimit: 0.2,
            lockScalingFlip: true,
            cornerSize: image.width * 0.02,
            borderScaleFactor: 3,
            transparentCorners: false,
        })
        rect.setControlsVisibility({
            mt: false,
            mr: false,
            mb: false,
            ml: false,
            mtr: false
        })
        rect.lastGoodTop = image.top
        rect.lastGoodLeft = image.left
        rect.lastGoodScale = 1

        return rect
    }

    function createCropBackground(image) {
        return new Rect({
            top: image.top,
            left: image.left,
            width: image.width,
            height: image.height,
            fill: "rgba(0,0,0,0.6)",
            selectable: false
        })
    }

    function createGrid(image) {
        const width = image.width
        const height = image.height

        const lineProperties = {
            stroke: "rgba(255, 255, 255, 0.75)",
            strokeWidth: 3,
            strokeDashArray: [20, 20]
        }

        const gridLines = []
        const gridSize = 3

        for (let x = width / (gridSize + 1); x < width; x += width / (gridSize + 1)) {
            gridLines.push(new Line([x, 0, x, height], lineProperties))
        }

        for (let y = height / (gridSize + 1); y < height; y += height / (gridSize + 1)) {
            gridLines.push(new Line([0, y, width, y], lineProperties))
        }

        return new Group(gridLines, {left: image.left, top: image.top, selectable: false, visible: false})
    }

    function initCrop() {
        crop.rect = createCropRect(canvasImage)
        crop.background = createCropBackground(canvas)
        crop.grid = createGrid(canvasImage)

        canvas.add(crop.background)
        canvas.add(crop.rect)
        canvas.add(crop.grid)

        updateCrop()
    }

    function updateCrop() {
        const boundingRect = crop.rect.getBoundingRect()
        const path = `M ${boundingRect.left - 2} ${boundingRect.top - 2} h ${boundingRect.width + 4} v ${boundingRect.height + 4} h -${boundingRect.width + 4} Z`
        crop.background.clipPath = new Path(path, {
            absolutePositioned: true,
            inverted: true
        })

        crop.grid.set({
            top: crop.rect.top,
            left: crop.rect.left,
            width: crop.rect.width,
            height: crop.rect.height,
            angle: crop.rect.angle,
            scaleX: crop.rect.scaleX,
            scaleY: crop.rect.scaleY,
        })
        crop.grid.setCoords()

        const rectBoundingRect = crop.rect.getBoundingRect()
        const imageBoundingRect = canvasImage.getBoundingRect()
        crop.warning = !(crop.rect.isContainedWithinObject(canvasImage)
            || ((canvasImage.angle % 90 === 0)
                && ((rectBoundingRect.top >= imageBoundingRect.top)
                    && (rectBoundingRect.left >= imageBoundingRect.left)
                    && (rectBoundingRect.left + rectBoundingRect.width <= imageBoundingRect.left + imageBoundingRect.width)
                    && (rectBoundingRect.top + rectBoundingRect.height <= imageBoundingRect.top + imageBoundingRect.height))))

        canvas.renderAll()
    }

    onMount(() => {
        canvas = new Canvas(canvasElement, {
            backgroundColor: "dimgray",
            preserveObjectStacking: true
        })

        const URLObj = window.URL || window.webkitURL
        const imageDataURL = URLObj.createObjectURL(originalImageBlob)

        validate(imageDataURL, validators)

        FabricImage.fromURL(imageDataURL).then((img) => {
            canvasImage = img

            canvasImage.filters.push(new filters.Contrast({contrast: 0})) // 0
            canvasImage.filters.push(new filters.Brightness({brightness: 0})) // 1

            const maxDimension = Math.max(canvasImage.width, canvasImage.height)

            canvas.setDimensions({width: maxDimension, height: maxDimension}, {backstoreOnly: true})
            canvas.setDimensions({width: "100%", height: "100%"}, {cssOnly: true})

            canvasImage.selectable = false

            canvas.add(canvasImage)
            canvas.centerObject(canvasImage)

            initCrop()

            canvas.setActiveObject(crop.rect)
            canvas.renderAll()

            /*
             * Handle canvas events
             */

            // Limit crop rectangle position to not exceed image boundaries
            canvas.on("object:moving", (e) => {
                const obj = e.target
                if (obj === crop.rect) {
                    obj.setCoords()

                    // top-left corner
                    if (obj.getBoundingRect().top < 0) {
                        obj.top = obj.lastGoodTop
                    }

                    if (obj.getBoundingRect().left < 0) {
                        obj.left = obj.lastGoodLeft
                    }

                    // bot-right corner
                    if (obj.getBoundingRect().top + obj.getBoundingRect().height > canvas.height) {
                        obj.top = obj.lastGoodTop
                    }

                    if (obj.getBoundingRect().left + obj.getBoundingRect().width > canvas.width) {
                        obj.left = obj.lastGoodLeft
                    }

                    obj.lastGoodTop = obj.top
                    obj.lastGoodLeft = obj.left

                    obj.setCoords()
                    updateCrop()
                }
            })

            // Limit crop rectangle scale to not exceed image boundaries
            canvas.on('object:scaling', (e) => {
                const obj = e.target
                if (obj === crop.rect) {
                    obj.setCoords()

                    const cropRect_bb = obj.getBoundingRect()

                    if (cropRect_bb.top < 0
                        || cropRect_bb.top + cropRect_bb.height > canvas.height) {
                        if (obj.scaleY > obj.lastGoodScale) {
                            obj.left = obj.lastGoodLeft
                            obj.top = obj.lastGoodTop
                            obj.scaleX = obj.lastGoodScale
                            obj.scaleY = obj.lastGoodScale
                        }
                    }

                    if (cropRect_bb.left < 0
                        || cropRect_bb.left + cropRect_bb.width > canvas.width) {
                        if (obj.scaleY > obj.lastGoodScale) {
                            obj.left = obj.lastGoodLeft
                            obj.top = obj.lastGoodTop
                            obj.scaleX = obj.lastGoodScale
                            obj.scaleY = obj.lastGoodScale
                        }
                    }

                    obj.lastGoodTop = obj.top
                    obj.lastGoodLeft = obj.left
                    obj.lastGoodScale = obj.scaleX

                    obj.setCoords()
                    updateCrop()
                }
            })

            // Select crop rectangle when clicking on the background
            crop.background.on("mousedown", function handleDarkRectClick(e) {
                if (e.target === crop.background) {
                    canvas.setActiveObject(crop.rect)
                    canvas.renderAll()
                }
            })

            /**
             * On selection change, set `activeMarker`
             * to new selected marker or undefined.
             *
             * @param e
             */
            function onSelectionUpdated(e) {
                if (e.selected === undefined) {
                    activeMarker = undefined
                    return
                }

                const obj = e.selected[0]
                if (markers.includes(obj)) {
                    activeMarker = obj
                } else {
                    activeMarker = undefined
                }
            }

            canvas.on("selection:created", onSelectionUpdated)
            canvas.on("selection:updated", onSelectionUpdated)
            canvas.on("selection:cleared", onSelectionUpdated)
        })
    })

    $: flipHorizontal(flipH)

    function flipHorizontal(flipValue) {
        if (canvasImage !== undefined) {
            canvasImage.flipX = flipValue
            canvas.renderAll()
        }
    }

    $: flipVertical(flipV)

    function flipVertical(flipValue) {
        if (canvasImage !== undefined) {
            canvasImage.flipY = flipValue
            canvas.renderAll()
        }
    }

    $: adjustRotation(rotation)
    function adjustRotation(newValue) {
        if (canvas !== undefined) {
            if (newValue > 180) {
                rotation = -180 + newValue % 180
            } else if (rotation < -180) {
                rotation = 180 + newValue % 180
            }
            canvasImage.rotate(rotation)
            canvasImage.setCoords()

            if ((rotation > 45 && rotation < 135) || (rotation < -45 && rotation > -135)) {
                crop.rect.rotate(90)
            } else {
                crop.rect.rotate(0)
            }
            crop.rect.setCoords()
            updateCrop()

            canvas.renderAll()
        }
    }

    function handleRotationStart() {
        crop.grid.visible = true
        canvas.renderAll()

    }

    function handleRotationEnd() {
        crop.grid.visible = false
        canvas.renderAll()
    }

    let keepAspectRatio = true
    $: updateKeepAspectRatio(keepAspectRatio)

    function updateKeepAspectRatio(value) {
        if (crop.rect !== undefined) {
            crop.rect.setControlsVisibility({mt: !value, mr: !value, mb: !value, ml: !value})
            canvas.renderAll()
        }
    }

    $: adjustContrast(contrast)

    function adjustContrast(contrast) {
        if (canvasImage !== undefined) {
            canvasImage.filters[0] = new filters.Contrast({contrast: contrast * 0.01})
            canvasImage.applyFilters()
            canvas.renderAll()
        }
    }

    $: adjustBrightness(brightness)

    function adjustBrightness(brightness) {
        if (canvasImage !== undefined) {
            canvasImage.filters[1] = new filters.Brightness({brightness: brightness * 0.01})
            canvasImage.applyFilters()
            canvas.renderAll()
        }
    }

    function drawArrow() {
        const triangle = new Triangle({
            left: 500,
            top: 500,
            width: 100,
            height: 150,
            fill: 'yellow',
            angle: 0
        })
        const line = new Line([0, 0, 0, 150], {
            left: 540,
            top: 600,
            stroke: 'yellow',
            strokeWidth: 20
        });

        const arrow = new Group([line, triangle]);
        arrow.rotate(90)

        arrow.cornerSize = 2000 * 0.02
        arrow.borderScaleFactor = 2
        arrow.transparentCorners = false
        arrow.setControlsVisibility({
            tl: false, tr: false, br: false,
            mt: false, mr: false, mb: false, ml: false,
        })
        arrow.lockScalingFlip = true
        arrow.minScaleLimit = 0.5

        markers.push(arrow)

        canvas.add(arrow)
        canvas.setActiveObject(arrow)
        canvas.renderAll()
    }

    function drawCircle() {
        const circle = new Circle({
            left: 500,
            top: 500,
            radius: 100,
            stroke: 'yellow',
            strokeWidth: 15,
            fill: 'transparent'
        })

        circle.cornerSize = 2000 * 0.02
        circle.borderScaleFactor = 2
        circle.transparentCorners = false
        circle.setControlsVisibility({
            mt: false, mr: false, mb: false, ml: false, mtr: false
        })
        circle.lockScalingFlip = true
        circle.minScaleLimit = 0.5

        markers.push(circle)

        canvas.add(circle)
        canvas.setActiveObject(circle)
        canvas.renderAll()
    }

    function drawRect() {
        const rect = new Rect({
            left: 500,
            top: 500,
            width: 300,
            height: 200,
            fill: 'dimgray'
        })

        rect.cornerSize = 2000 * 0.02
        rect.borderScaleFactor = 2
        rect.transparentCorners = false
        rect.setControlsVisibility({mtr: false})

        rect.lockScalingFlip = true
        rect.minScaleLimit = 0.5

        markers.push(rect)

        canvas.add(rect)
        canvas.setActiveObject(rect)
        canvas.renderAll()
    }

    function deleteSelectedMarker() {
        canvas.remove(activeMarker)
        activeMarker = undefined
    }

    function resetCrop() {
        crop.rect.set({
            left: canvasImage.left,
            top: canvasImage.top,
            width: canvasImage.width,
            height: canvasImage.height,
            angle: 0,
            scaleX: 1,
            scaleY: 1
        })
        crop.rect.lastGoodTop = canvasImage.top
        crop.rect.lastGoodLeft = canvasImage.left
        crop.rect.lastGoodScale = 1
        crop.rect.setCoords()

        updateCrop()
    }

    function reset() {
        flipH = false
        flipV = false
        rotation = 0
        adjustRotation(0)

        resetCrop()

        contrast = 0
        brightness = 0

        for (const marker of markers) {
            canvas.remove(marker)
        }
    }

    function saveImage() {
        saving = true

        canvas.discardActiveObject()
        canvas.renderAll()

        const coords = crop.rect.getCoords()
        const x_min = Math.min(coords[0].x, coords[1].x, coords[2].x, coords[3].x)
        const x_max = Math.max(coords[0].x, coords[1].x, coords[2].x, coords[3].x)
        const y_min = Math.min(coords[0].y, coords[1].y, coords[2].y, coords[3].y)
        const y_max = Math.max(coords[0].y, coords[1].y, coords[2].y, coords[3].y)

        /*
         * Output PNG (lossless) to upload to server
         * Could add ("image/webp", 1) arguments, but not supported by Safari
         */
        canvas.toCanvasElement(1, {
            left: x_min,
            top: y_min,
            width: x_max - x_min - 1,
            height: y_max - y_min - 1
        }).toBlob((blob) => {
            saveCallback(blob).then((result) => {
                saving = false
            }).catch((e) => {
                saving = false
            })
        })
    }
</script>

<div style="display: flex; gap: 1rem; max-width: 1200px">
    <div class="main" style="flex-grow: 1">
        <div id="canvasContainer">
            <canvas bind:this={canvasElement}></canvas>
        </div>

        {#if warnings.length > 0}
            <div class="warnings">
                {#each warnings as warning}
                    <div class="alert alert-warning d-flex justify-content-between align-items-center">
                        {warning}
                        <button class="btn-close m-0" on:click={hideWarning}></button>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <div style="display: flex; flex-direction: column; gap: 0.5rem">
        <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 1rem">
            <div class="info">
                Orientation
            </div>
            <div>
                <div>
                    <button class="btn btn-outline-secondary" class:active={flipH} on:click={() => flipH = !flipH}
                            type="button">
                        <i class="bi bi-symmetry-vertical"></i>
                    </button>
                    <button class="btn btn-outline-secondary" class:active={flipV} on:click={() => flipV = !flipV}
                            type="button">
                        <i class="bi bi-symmetry-horizontal"></i>
                    </button>

                    <button class="btn btn-outline-secondary" on:click={() => rotation = rotation + 90}>
                        <i class="bi bi-arrow-clockwise"></i>
                    </button>

                    <button class="btn btn-outline-secondary" on:click={() => rotation = rotation - 90}>
                        <i class="bi bi-arrow-counterclockwise"></i>
                    </button>
                </div>

                <div class="mt-2">
                    Rotation ({rotation}&deg;)
                    <br>
                    <input bind:value={rotation} max="180" min="-180"
                           on:pointerdown={handleRotationStart} on:pointerup={handleRotationEnd} step="1" type="range">
                </div>
            </div>

            <div class="info" class:bg-warning={crop.warning} class:text-warning-emphasis={crop.warning}>
                {#if crop.warning}
                    <i class="bi bi-exclamation-triangle me-1"
                       title="Crop area extends beyond image"></i>
                {/if}
                Crop
            </div>
            <div>
                <label>
                    <input bind:checked={keepAspectRatio} type="checkbox">
                    Keep aspect ratio
                </label>
            </div>

            <div class="info">
                Adjust image
            </div>
            <div class="mx-2">
                <i class="bi bi-brightness-high"></i>
                Brightness
                <small>({brightness}%)</small>
                <br>
                <input bind:value={brightness} max="30" min="-30" step="1" type="range">
            </div>
            <div class="mx-2">
                <i class="bi bi-circle-half"></i>
                Contrast
                <small>({contrast}%)</small>
                <br>
                <input bind:value={contrast} max="30" min="-30" step="1" type="range">
            </div>

            <div class="info">
                Markers
            </div>
            <div>
                <button class="btn btn-outline-secondary" on:click={drawArrow}>
                    <i class="bi bi-arrow-right"></i>
                </button>

                <button class="btn btn-outline-secondary" on:click={drawCircle}>
                    <i class="bi bi-circle"></i>
                </button>

                <button class="btn btn-outline-secondary" on:click={drawRect}>
                    <i class="bi bi-square-fill"></i>
                </button>

                <button class="btn btn-outline-danger" disabled={!markers.includes(activeMarker)}
                        on:click={deleteSelectedMarker}>
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>

        <button class="btn btn-outline-secondary mb-2" on:click={() => reset()}>
            Reset changes
        </button>

        <div style="position: relative; width: 100%">
            <button class="btn btn-lg btn-primary w-100" on:click={saveImage}>
                <i class="bi bi-file-earmark-check me-1"></i>
                Save
            </button>
            <div class="loading" class:invisible={!saving}>
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .main {
        position: relative;
    }

    .warnings {
        position: absolute;
        top: 0;
        width: 100%;
        padding: 1rem;
        display: flex;
        flex-direction: column;
    }

    .warnings .alert:last-child {
        margin-bottom: 0;
    }

    #canvasContainer {
        aspect-ratio: 1 / 1;
        margin: 0 auto;
    }

    canvas {
        width: 100%;
        height: 100%;
    }

    .info {
        font-size: 120%;
        font-weight: bold;
    }

    .loading {
        position: absolute;
        top: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(255, 255, 255, 0.7);
    }
</style>