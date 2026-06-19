<script lang="ts">
    import {tick} from "svelte";
    import {Canvas, Circle, FabricImage, Group, IText, Path, PencilBrush, Point, Polyline, Rect} from "fabric";

    let {
        crop = $bindable(),
        rotation = $bindable(),
        markers,
        activeMarker = $bindable()
    } = $props();

    let canvasElement: HTMLCanvasElement;
    let hiddenTextarea: HTMLDivElement = $state();

    let maxDimension

    let canvas
    let imagePlaceholder


    export function reset() {
        resetCrop()

        for (const marker of markers) {
            canvas.remove(marker)
        }
        canvas.setActiveObject(crop.rect)
    }

    function resetCrop() {
        tick().then(() => {
            crop.rect.set({
                width: imagePlaceholder.width,
                height: imagePlaceholder.height,
                angle: 0,
                scaleX: 1,
                scaleY: 1
            })
            crop.rect.setPositionByOrigin(new Point(canvas.width / 2, canvas.height / 2), 'center', 'center')
            crop.rect.setCoords()

            crop.rect.lastGoodLeft = crop.rect.left
            crop.rect.lastGoodTop = crop.rect.top
            crop.rect.lastGoodScale = 1
        })

        updateCrop()
    }


    export function rotateCW90() {
        clearGrid()
        rotation += 90

        const top = crop.rect.top
        const left = crop.rect.left
        const width = crop.rect.width
        const height = crop.rect.height

        crop.rect.setPositionByOrigin(new Point(canvas.width - top, left), 'center', 'center')
        crop.rect.width = height
        crop.rect.height = width

        crop.rect.setCoords()
        updateCrop()
    }

    export function rotateCCW90() {
        clearGrid()
        rotation -= 90

        const top = crop.rect.top
        const left = crop.rect.left
        const width = crop.rect.width
        const height = crop.rect.height

        crop.rect.setPositionByOrigin(new Point(top, canvas.height - left), 'center', 'center')
        crop.rect.width = height
        crop.rect.height = width

        crop.rect.setCoords()
        updateCrop()
    }


    function initCrop() {
        crop.background = createCropBackground(canvas)
        crop.rect = createCropRect(imagePlaceholder)

        canvas.add(crop.background)
        canvas.add(crop.rect)

        updateCrop()
    }


    function createCropBackground(image) {
        const rect = new Rect({
            width: image.width,
            height: image.height,
            fill: "rgba(0,0,0,0.6)",
            selectable: false
        })
        rect.setPositionByOrigin(new Point(canvas.width / 2, canvas.height / 2), 'center', 'center')

        return rect
    }

    function createCropRect(image) {
        const rect = new Rect({
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
        rect.setPositionByOrigin(new Point(canvas.width / 2, canvas.height / 2), 'center', 'center')

        rect.setControlsVisibility({
            mt: false,
            mr: false,
            mb: false,
            ml: false,
            mtr: false
        })
        rect.lastGoodLeft = rect.left
        rect.lastGoodTop = rect.top
        rect.lastGoodScale = 1

        return rect
    }

    function updateCrop() {
        tick().then(() => {
            const cropBoundingRect = crop.rect.getBoundingRect()

            const path = `M ${cropBoundingRect.left} ${cropBoundingRect.top} h ${cropBoundingRect.width + 4} v ${cropBoundingRect.height + 4} h -${cropBoundingRect.width + 4} Z`
            crop.background.clipPath = new Path(path, {
                absolutePositioned: true,
                inverted: true
            })

            crop.warning = !crop.rect.isContainedWithinObject(imagePlaceholder)
            canvas.renderAll()
        })
    }

    function createGrid(dimensions) {
        const width = dimensions.width * dimensions.scaleX
        const height = dimensions.height * dimensions.scaleY

        const lineProperties = {
            stroke: "rgba(255, 255, 255, 0.75)",
            strokeWidth: maxDimension * 0.002,
            strokeDashArray: [maxDimension * 0.01, maxDimension * 0.01]
        }

        const gridLines = []
        const gridSize = 3

        for (let x = width / (gridSize + 1); x < width; x += width / (gridSize + 1)) {
            gridLines.push(new Polyline([{x, y: 0}, {x, y: height}], lineProperties))
        }

        for (let y = height / (gridSize + 1); y < height; y += height / (gridSize + 1)) {
            gridLines.push(new Polyline([{x:0, y}, {x:width, y}], lineProperties))
        }

        const group = new Group(gridLines, {selectable: false})
        group.setPositionByOrigin(dimensions.getCenterPoint(), 'center', 'center')

        return group
    }

    let rotationGridTimer

    function clearGrid() {
        if (crop.grid) {
            canvas.remove(crop.grid)
            crop.grid = undefined
        }
    }

    export function rotationChanged() {
        if (crop.grid === undefined) {
            // update coordinates for the crop grid
            crop.grid = createGrid(crop.rect)
            canvas.add(crop.grid)
        }

        // clear timer if it already exists
        if (rotationGridTimer) {
            clearTimeout(rotationGridTimer)
        }

        // start a new timer to hide grid (0.5s after last rotation)
        rotationGridTimer = setTimeout(() => {
            clearGrid()
            canvas.renderAll()
            rotationGridTimer = undefined
        }, 1_000)

        // show the crop window is outside image warning
        updateCrop()

        canvas.renderAll()
    }


    export function drawArrow(color) {
        const unit = maxDimension * 0.025
        const path = `M 0 0 l -${2 * unit} -${1.5 * unit} v ${unit} h -${2 * unit} v ${unit} h ${2 * unit} v ${unit} l ${2 * unit} -${1.5 * unit} Z`
        const arrow = new Path(path, {
            top: maxDimension / 2 - 1.5 * unit,
            left: maxDimension / 2 - 4 * unit,
            inverted: true,
            fill: color,
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

    export function drawCircle(color) {
        const circle = new Circle({
            left: maxDimension / 2 - maxDimension * 0.055,
            top: maxDimension / 2 - maxDimension * 0.055,
            radius: maxDimension * 0.05,
            strokeWidth: maxDimension * 0.01,
            stroke: color,
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

    export function drawText(color) {
        // svelte-ignore perf_avoid_nested_class
        class ITextFixed extends IText {
            _calcTextareaPosition() {
                return {
                    ...super._calcTextareaPosition(),
                    left: "0",
                    top: "0"
                }
            }
        }

        const text = new ITextFixed('Enter text', {
            left: maxDimension / 2 - maxDimension * 0.055,
            top: maxDimension / 2 - maxDimension * 0.055,
            fontFamily: 'Arial',
            fontSize: maxDimension * 0.07,
            fontWeight: 'bold',
            fill: color,
            cornerSize: maxDimension * 0.03,
            touchCornerSize: maxDimension * 0.06,
            borderScaleFactor: maxDimension * 0.006,
            transparentCorners: false,
            lockScalingFlip: true,
            hiddenTextareaContainer: hiddenTextarea,
            cursorWidth: maxDimension * 0.003,
            selectionStart: 0,
            selectionEnd: 10, // length of 'Enter text'
        })
        text.controls.mtr.offsetY = -0.0375 * maxDimension

        markers.push(text)

        canvas.add(text)
        canvas.setActiveObject(text)

        text.enterEditing()

        canvas.renderAll()
    }

    export function drawRect() {
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

    export function startDrawing(brushColor) {
        if (canvas === undefined)
            return;

        canvas.freeDrawingBrush.color = brushColor
        canvas.isDrawingMode = true
    }

    export function endDrawing() {
        if (canvas === undefined)
            return;

        canvas.isDrawingMode = false
    }

    export function deleteMarker(marker) {
        canvas.remove(marker)
    }


    // When rotation changes, clamp it to [-180, 180]
    // and rotate the crop rectangle if rotation passes 45 degrees
    $effect(() => {
        // Need this so that Svelte re-runs the code inside the condition on change
        if (rotation > 180) {
            rotation = -180 + rotation % 180
        } else if (rotation < -180) {
            rotation = 180 + rotation % 180
        }

        let imageRotation = rotation

        if (canvas !== undefined) {
            imagePlaceholder.rotate(imageRotation)
            imagePlaceholder.setCoords()

            canvas.renderAll()
        }
    })

    // Update resize controls when keep aspect ratio changes
    $effect(() => {
        // Need this so that Svelte re-runs the code inside the condition on change
        const showExtraControls = !crop.keepAspectRatio

        if (crop.rect !== undefined) {
            crop.rect.setControlsVisibility({
                mt: showExtraControls,
                mr: showExtraControls,
                mb: showExtraControls,
                ml: showExtraControls
            })
            canvas.renderAll()
        }
    })

    export async function saveImage(backgroundCanvas) {
        return new Promise((resolve) => {
            clearGrid()
            canvas.discardActiveObject()
            canvas.renderAll()

            const coords = crop.rect.getCoords()
            const x_min = Math.min(coords[0].x, coords[1].x, coords[2].x, coords[3].x)
            const x_max = Math.max(coords[0].x, coords[1].x, coords[2].x, coords[3].x)
            const y_min = Math.min(coords[0].y, coords[1].y, coords[2].y, coords[3].y)
            const y_max = Math.max(coords[0].y, coords[1].y, coords[2].y, coords[3].y)

            canvas.backgroundImage = new FabricImage(backgroundCanvas)
            canvas.centerObject(canvas.backgroundImage)
            canvas.backgroundColor = 'dimgray'

            canvas.toCanvasElement(1, {
                left: x_min,
                top: y_min,
                width: x_max - x_min,
                height: y_max - y_min
            }).toBlob((blob) => {
                canvas.backgroundImage = undefined
                canvas.backgroundColor = undefined
                canvas.setActiveObject(crop.rect)
                canvas.renderAll()
                resolve(blob)
            }, "image/jpeg", 1.0)
        })

    }


    export function init(imageBitmap) {
        canvas = new Canvas(canvasElement, {
            backgroundColor: "rgba(0,0,0,0)",
            preserveObjectStacking: true,
            selection: false,
            enableRetinaScaling: false
        })

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

        imagePlaceholder.left += 0.5
        imagePlaceholder.top += 0.5

        initCrop()

        canvas.freeDrawingBrush = new PencilBrush(canvas)
        canvas.freeDrawingBrush.width = maxDimension * 0.005

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

                const boundingRect = obj.getBoundingRect()

                // top-left corner
                if (boundingRect.top < 0) {
                    obj.top = obj.lastGoodTop
                }

                if (boundingRect.left < 0) {
                    obj.left = obj.lastGoodLeft
                }

                // bottom-right corner
                if (boundingRect.top + boundingRect.height > canvas.height) {
                    obj.top = obj.lastGoodTop
                }

                if (boundingRect.left + boundingRect.width > canvas.width) {
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

        // Add created paths to marker list
        canvas.on("path:created", function onPathCreated(ev) {
            ev.path.cornerSize = maxDimension * 0.03
            ev.path.touchCornerSize = maxDimension * 0.06
            ev.path.borderScaleFactor = maxDimension * 0.006
            ev.path.transparentCorners = false
            ev.path.lockScalingFlip = true
            ev.path.minScaleLimit = 0.5

            ev.path.hasControls = false
            ev.path.lockMovementX = true
            ev.path.lockMovementY = true

            markers.push(ev.path)
        })
    }
</script>

<canvas bind:this={canvasElement} class="ie-w-full ie-h-full"></canvas>
<div bind:this={hiddenTextarea} class="ie-absolute ie-top-0 ie-left-0"></div>
