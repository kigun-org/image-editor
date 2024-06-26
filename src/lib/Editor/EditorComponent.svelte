<script>
    import {Canvas, Circle, Group, Image as FabricImage, IText, Line, Path, Rect} from 'fabric'
    import {onMount} from "svelte";
    import BackgroundComponent from "./BackgroundComponent.svelte";

    export let originalImageBlob
    const imageDataURL = (window.URL || window.webkitURL).createObjectURL(originalImageBlob)

    export let validators
    let warnings = []

    export let saveCallback
    let saving = false
    let saveError = false

    let background

    let canvasElement

    let canvas
    let imagePlaceholder
    let maxDimension

    let crop = {
        rect: undefined,
        background: undefined,
        grid: undefined,
        warning: false
    }

    let flipH = false
    let flipV = false
    let rotation = 0

    let brightness = 1
    let contrast = 0

    let markers = []
    let activeMarker

    function handleRotationStart() {
        crop.grid.visible = true
        canvas.renderAll()
    }

    function handleRotationEnd() {
        crop.grid.visible = false
        canvas.renderAll()
    }

    $: adjustRotation(rotation)

    function adjustRotation(newValue) {
        if (canvas !== undefined) {
            if (newValue > 180) {
                rotation = -180 + newValue % 180
            } else if (rotation < -180) {
                rotation = 180 + newValue % 180
            }
            imagePlaceholder.rotate(rotation)
            imagePlaceholder.setCoords()

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

    let keepAspectRatio = true
    $: updateKeepAspectRatio(keepAspectRatio)

    function updateKeepAspectRatio(newValue) {
        if (crop.rect !== undefined) {
            crop.rect.setControlsVisibility({mt: !newValue, mr: !newValue, mb: !newValue, ml: !newValue})
            canvas.renderAll()
        }
    }

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
            cornerSize: maxDimension * 0.015,
            borderScaleFactor: maxDimension * 0.002,
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
            strokeWidth: maxDimension * 0.001,
            strokeDashArray: [maxDimension * 0.01, maxDimension * 0.01]
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
        crop.rect = createCropRect(imagePlaceholder)
        crop.background = createCropBackground(canvas)
        crop.grid = createGrid(imagePlaceholder)

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
        const imageBoundingRect = imagePlaceholder.getBoundingRect()
        crop.warning = !(crop.rect.isContainedWithinObject(imagePlaceholder)
            || ((imagePlaceholder.angle % 90 === 0)
                && ((rectBoundingRect.top >= imageBoundingRect.top)
                    && (rectBoundingRect.left >= imageBoundingRect.left)
                    && (rectBoundingRect.left + rectBoundingRect.width <= imageBoundingRect.left + imageBoundingRect.width)
                    && (rectBoundingRect.top + rectBoundingRect.height <= imageBoundingRect.top + imageBoundingRect.height))))

        canvas.renderAll()
    }

    function drawArrow() {
        const unit = maxDimension * 0.025
        const path = `M 0 0 l -${2 * unit} -${1.5 * unit} v ${unit} h -${2 * unit} v ${unit} h ${2 * unit} v ${unit} l ${2 * unit} -${1.5 * unit} Z`
        const arrow = new Path(path, {
            top: maxDimension / 2 - 1.5 * unit,
            left: maxDimension / 2 - 4 * unit,
            inverted: true,
            fill: 'yellow',
            cornerSize: maxDimension * 0.01,
            borderScaleFactor: maxDimension * 0.002,
            transparentCorners: false,
            lockScalingFlip: true,
            minScaleLimit: 0.5,
        })
        arrow.controls.mtr.offsetY = -0.0375 * maxDimension
        arrow.setControlsVisibility({
            tl: false, tr: false, br: false,
            mt: false, mr: false, mb: false, ml: false,
        })

        markers.push(arrow)

        canvas.add(arrow)
        canvas.setActiveObject(arrow)
        canvas.renderAll()
    }

    function drawCircle() {
        const circle = new Circle({
            left: maxDimension / 2 - maxDimension * 0.055,
            top: maxDimension / 2 - maxDimension * 0.055,
            radius: maxDimension * 0.05,
            strokeWidth: maxDimension * 0.01,
            stroke: 'yellow',
            fill: 'transparent',
            cornerSize: maxDimension * 0.01,
            borderScaleFactor: maxDimension * 0.002,
            transparentCorners: false,
            lockScalingFlip: true,
            minScaleLimit: 0.5
        })
        circle.setControlsVisibility({
            mt: false, mr: false, mb: false, ml: false, mtr: false
        })

        markers.push(circle)

        canvas.add(circle)
        canvas.setActiveObject(circle)
        canvas.renderAll()
    }

    function drawText() {
        console.log(canvas.lowerCanvasEl)
        const text = new IText('Enter text', {
            left: maxDimension / 2 - maxDimension * 0.055,
            top: maxDimension / 2 - maxDimension * 0.055,
            fontFamily: 'Arial',
            fontSize: maxDimension * 0.07,
            fontWeight: 'bold',
            fill: 'yellow',
            cornerSize: maxDimension * 0.01,
            borderScaleFactor: maxDimension * 0.002,
            transparentCorners: false,
            lockScalingFlip: true,
            hiddenTextareaContainer: canvas.lowerCanvasEl
        })
        text.controls.mtr.offsetY = -0.0375 * maxDimension

        markers.push(text)

        canvas.add(text)
        canvas.setActiveObject(text)
        canvas.renderAll()
    }

    function drawRect() {
        const rect = new Rect({
            left: maxDimension / 2 - maxDimension * 0.08,
            top: maxDimension / 2 - maxDimension * 0.04,
            width: maxDimension * 0.16,
            height: maxDimension * 0.08,
            fill: 'dimgray',
            cornerSize: maxDimension * 0.01,
            borderScaleFactor: maxDimension * 0.002,
            transparentCorners: false,
            lockScalingFlip: true,
            minScaleLimit: 0.5
        })
        rect.controls.mtr.offsetY = -0.0375 * maxDimension

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
            left: imagePlaceholder.left,
            top: imagePlaceholder.top,
            width: imagePlaceholder.width,
            height: imagePlaceholder.height,
            angle: 0,
            scaleX: 1,
            scaleY: 1
        })
        crop.rect.lastGoodTop = imagePlaceholder.top
        crop.rect.lastGoodLeft = imagePlaceholder.left
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

        brightness = 1
        contrast = 0

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

        canvas.backgroundImage = new FabricImage(background.exportCanvas())
        canvas.centerObject(canvas.backgroundImage)
        canvas.backgroundColor = 'dimgray'

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
            saveCallback(blob).then(() => {
                saving = false
            }).catch(() => {
                saving = false
                saveError = true
            })
            canvas.backgroundImage = undefined
            canvas.backgroundColor = undefined
        })
    }

    onMount(() => {
        canvas = new Canvas(canvasElement, {
            backgroundColor: "rgba(0,0,0,0)",
            preserveObjectStacking: true,
            selection: false
        })

        validate(imageDataURL, validators)

        FabricImage.fromURL(imageDataURL).then((img) => {
            imagePlaceholder = new Rect({
                left: img.left, top: img.top, width: img.width, height: img.height,
                fill: 'transparent'
            })

            maxDimension = Math.max(imagePlaceholder.width, imagePlaceholder.height)

            canvas.setDimensions({width: maxDimension, height: maxDimension}, {backstoreOnly: true})
            canvas.setDimensions({width: "100%", height: "100%"}, {cssOnly: true})

            imagePlaceholder.selectable = false

            canvas.add(imagePlaceholder)
            canvas.centerObject(imagePlaceholder)

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
</script>

<div id="editor_component">
    <div id="main">
        <div id="canvasContainer" style="position: relative">
            <div id="backgroundContainer" style="position: absolute">
                <BackgroundComponent bind:this={background} {brightness}
                                     {contrast} dataURL={imageDataURL} {flipH} {flipV} {rotation}/>
            </div>
            <canvas bind:this={canvasElement}></canvas>
            <div id="hiddenTextareaContainer" style="position: absolute; top: -4200px; opacity: 0"></div>
        </div>

        {#if warnings.length > 0}
            <div id="warnings">
                {#each warnings as warning}
                    <div class="alert alert-warning d-flex justify-content-between align-items-center">
                        {warning}
                        <button class="btn-close m-0" on:click={hideWarning}></button>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <div id="toolbar">
        <div id="controls">
            <div>
                <h2>
                    Orientation
                </h2>
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

                    <div class="m-2">
                        Rotation ({rotation}&deg;)
                        <br>
                        <input bind:value={rotation} max="180" min="-180"
                               on:pointerdown={handleRotationStart} on:pointerup={handleRotationEnd} step="1"
                               type="range">
                    </div>
                </div>
            </div>

            <div>
                <h2 class:bg-warning={crop.warning} class:text-warning-emphasis={crop.warning}>
                    Crop
                    {#if crop.warning}
                        <i class="bi bi-exclamation-triangle mx-1"
                           title="Crop area extends beyond image"></i>
                    {/if}
                </h2>
                <div>
                    <label>
                        <input bind:checked={keepAspectRatio} type="checkbox">
                        Keep aspect ratio
                    </label>
                </div>
            </div>

            <div>
                <h2>
                    Adjust image
                </h2>
                <div class="mx-2">
                    <i class="bi bi-brightness-high"></i>
                    Brightness
                    <small>({Math.round((brightness - 1) * 100)}%)</small>
                    <br>
                    <input bind:value={brightness} max="1.25" min="0.75" step="0.01" type="range">
                </div>
                <div class="mx-2">
                    <i class="bi bi-circle-half"></i>
                    Contrast
                    <small>({Math.round(contrast * 100)}%)</small>
                    <br>
                    <input bind:value={contrast} max="0.25" min="-0.25" step="0.01" type="range">
                </div>
            </div>

            <div>
                <h2>
                    Markers
                </h2>
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

                    <button class="btn btn-outline-secondary" on:click={drawText}>
                        <i class="bi bi-type"></i>
                    </button>

                    <button class="btn btn-outline-danger" disabled={!markers.includes(activeMarker)}
                            on:click={deleteSelectedMarker}>
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        </div>

        <div id="buttons_bottom">
            <button class="btn btn-outline-secondary" on:click={() => reset()}>
                Reset changes
            </button>

            <div style="position: relative; width: 100%">
                <button class="btn btn-lg btn-primary w-100" class:btn-danger={saveError}
                        class:btn-primary={!saveError} disabled={saveError}
                        on:click={saveImage}>
                    {#if saveError}
                        <i class="bi bi-exclamation-triangle me-1"></i>
                        Error
                    {:else}
                        <i class="bi bi-save me-1"></i>
                        Save
                    {/if}
                </button>
                <div class="loading" class:invisible={!saving}>
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    #editor_component {
        display: flex;
        gap: 1rem
    }

    #main {
        position: relative;
        flex-grow: 1
    }

    #canvasContainer {
        aspect-ratio: 1 / 1;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
    }

    #canvasContainer > #backgroundContainer,
    #canvasContainer > canvas {
        width: 100%;
        height: 100%;
    }

    #warnings {
        position: absolute;
        top: 0;
        width: 100%;
        padding: 1rem;
        display: flex;
        flex-direction: column;
    }

    #warnings .alert:last-child {
        margin-bottom: 0;
    }

    #toolbar {
        display: flex;
        flex-direction: column;
        gap: 2rem
    }

    #toolbar > #controls {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        gap: 1rem
    }

    #toolbar > #buttons_bottom {
        display: flex;
        flex-direction: column;
        gap: 0.75rem
    }

    h2 {
        font-size: larger;
        margin-top: 0.5rem;
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