<script lang="ts">
    import {Canvas, Circle, Group, Image as FabricImage, IText, Line, Path, Rect} from 'fabric'
    import {onMount} from "svelte";
    import Background from "./Background.svelte";
    import Toolbar from "./Toolbar.svelte";

    let {
        originalImageBlob,
        validators,
        saveCallback
    } = $props()

    let warnings = $state([])

    let saving = $state(false)
    let saveError = $state(false)

    let background = $state()

    let canvasElement = $state()

    let canvas
    let imagePlaceholder
    let maxDimension

    let crop = $state({
        rect: undefined,
        background: undefined,
        grid: undefined,
        warning: false
    })

    let flipH = $state(false)
    let flipV = $state(false)
    let rotation = $state(0)

    let brightness = $state(1)
    let contrast = $state(0)

    let markers = $state([])
    let activeMarker = $state()
    let hiddenTextarea = $state()

    function validate(originalImageBlob, validators) {
        const imageDataURL = (window.URL || window.webkitURL).createObjectURL(originalImageBlob)
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

    function handleRotationStart() {
        crop.grid.visible = true
        canvas.renderAll()
    }

    function handleRotationEnd() {
        crop.grid.visible = false
        canvas.renderAll()
    }

    $effect(() => {
        if (canvas !== undefined) {
            if (rotation > 180) {
                rotation = -180 + rotation % 180
            } else if (rotation < -180) {
                rotation = 180 + rotation % 180
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
    })

    let keepAspectRatio = $state(true)
    $effect(() => {
        if (crop.rect !== undefined) {
            crop.rect.setControlsVisibility({
                mt: !keepAspectRatio,
                mr: !keepAspectRatio,
                mb: !keepAspectRatio,
                ml: !keepAspectRatio
            })
            canvas.renderAll()
        }
    })

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
            cornerSize: maxDimension * 0.03,
            touchCornerSize: maxDimension * 0.06,
            borderScaleFactor: maxDimension * 0.006,
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
        crop.background = createCropBackground(canvas)
        crop.rect = createCropRect(imagePlaceholder)
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
            cornerSize: maxDimension * 0.03,
            touchCornerSize: maxDimension * 0.06,
            borderScaleFactor: maxDimension * 0.006,
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
            cornerSize: maxDimension * 0.03,
            touchCornerSize: maxDimension * 0.06,
            borderScaleFactor: maxDimension * 0.006,
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

    class ITextFixed extends IText {
        _calcTextareaPosition() {
            return {
                ...super._calcTextareaPosition(),
                left: "0",
                top: "0"
            }
        }
    }

    function drawText() {
        const text = new ITextFixed('Enter text', {
            left: maxDimension / 2 - maxDimension * 0.055,
            top: maxDimension / 2 - maxDimension * 0.055,
            fontFamily: 'Arial',
            fontSize: maxDimension * 0.07,
            fontWeight: 'bold',
            fill: 'yellow',
            cornerSize: maxDimension * 0.03,
            touchCornerSize: maxDimension * 0.06,
            borderScaleFactor: maxDimension * 0.006,
            transparentCorners: false,
            lockScalingFlip: true,
            hiddenTextareaContainer: hiddenTextarea,
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
            cornerSize: maxDimension * 0.03,
            touchCornerSize: maxDimension * 0.06,
            borderScaleFactor: maxDimension * 0.006,
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

        resetCrop()
        keepAspectRatio = true

        brightness = 1
        contrast = 0

        for (const marker of markers) {
            canvas.remove(marker)
        }

        canvas.setActiveObject(crop.rect)
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

        canvas.toCanvasElement(1, {
            left: x_min,
            top: y_min,
            width: x_max - x_min,
            height: y_max - y_min
        }).toBlob((blob) => {
            saveCallback(blob).then(() => {
                saving = false
                canvas.backgroundImage = undefined
                canvas.backgroundColor = undefined
                canvas.setActiveObject(crop.rect)
                canvas.renderAll()
            }).catch((e) => {
                saving = false
                canvas.backgroundImage = undefined
                canvas.backgroundColor = undefined
                canvas.setActiveObject(crop.rect)
                canvas.renderAll()

                console.log(e)
                saveError = true
            })
        }, "image/jpeg", 1.0)
    }

    onMount(async () => {
        canvas = new Canvas(canvasElement, {
            backgroundColor: "rgba(0,0,0,0)",
            preserveObjectStacking: true,
            selection: false,
            enableRetinaScaling: false
        })

        validate(originalImageBlob, validators)

        const imageBitmap = await createImageBitmap(originalImageBlob)
        maxDimension = Math.max(imageBitmap.width, imageBitmap.height)

        imagePlaceholder = new Rect({
            width: imageBitmap.width, height: imageBitmap.height,
            fill: 'transparent'
        })

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

                // bottom-right corner
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
</script>

<div class="k-flex k-gap-3 k-flex-col md:k-flex-row">
    <div class="k-flex-auto k-aspect-square k-relative">
        <div class="k-relative k-aspect-square k-flex k-items-center k-justify-center k-mx-auto">
            <div class="k-absolute k-w-full k-h-full">
                <Background bind:this={background} {brightness}
                            {contrast} {flipH} {flipV} imageBlob={originalImageBlob} {rotation}/>
            </div>
            <canvas bind:this={canvasElement} class="k-w-full k-h-full"></canvas>
            <div bind:this={hiddenTextarea} style="position: absolute; top: 0; left: 0"></div>
        </div>

        {#if warnings.length > 0}
            <div class="k-absolute k-top-4 k-left-4 k-right-4 k-flex k-flex-col k-gap-2">
                {#each warnings as warning}
                    <div class="k-alert k-alert-warning" role="alert">
                        <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                             stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                             xmlns="http://www.w3.org/2000/svg">
                            <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                            <path d="M12 9v4"/>
                            <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"/>
                            <path d="M12 16h.01"/>
                        </svg>
                        <span>{warning}</span>
                        <!--                    <button class="btn-close m-0" onclick={hideWarning}></button>-->
                    </div>
                {/each}
            </div>
        {/if}
    </div>
    <div class="k-flex-initial md:k-w-52 k-flex k-flex-col k-justify-between k-gap-5">
        <Toolbar bind:activeMarker bind:brightness bind:contrast bind:flipH
                 bind:flipV bind:keepAspectRatio bind:markers
                 bind:rotation cropWarning={crop.warning}
                 drawArrow={drawArrow} drawCircle={drawCircle} drawRect={drawRect} drawText={drawText}
                 deleteMarker={deleteSelectedMarker}
                 rotationEnd={handleRotationEnd} rotationStart={handleRotationStart}/>

        <div class="k-flex k-flex-col k-gap-2">
            <button class="k-btn k-w-full" onclick={reset}>
                Reset changes
            </button>

            <button class="k-btn k-w-full" class:k-btn-danger={saveError}
                    class:k-btn-primary={!saveError} disabled={saveError || saving}
                    onclick={saveImage}>
                {#if saveError}
                    <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                         stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                         xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                        <path d="M12 9v4"/>
                        <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"/>
                        <path d="M12 16h.01"/>
                    </svg>
                    Error
                {:else if saving}
                    <span class="k-loading k-loading-spinner"></span>
                    Saving
                {:else}
                    <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                         stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                         xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                        <path d="M5 12l5 5l10 -10"/>
                    </svg>
                    Save
                {/if}
            </button>
        </div>
    </div>
</div>