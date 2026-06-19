<script lang="ts">
    import {onMount, tick} from "svelte";
    import Background from "./Background.svelte";
    import Toolbar from "./Toolbar.svelte";
    import Foreground from "./Foreground.svelte";

    let {
        originalImageBlob,
        validators,
        saveCallback
    } = $props()

    let warnings = $state([])

    let saving = $state(false)
    let saveError = $state()

    let background = $state()
    let foreground = $state()

    let crop = $state({
        rect: undefined,
        background: undefined,
        grid: undefined,
        warning: false,
        keepAspectRatio: true
    })

    let flipH = $state(false)
    let flipV = $state(false)
    let rotation = $state(0)

    let brightness = $state(1)
    let contrast = $state(0)

    let color = $state("#ffff00")
    let drawingMode = $state(false)

    let markers = $state([])
    let activeMarker = $state()

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

    function rotationChanged() {
        foreground.rotationChanged()
    }

    function rotateCW90() {
        rotation += 90
        foreground.rotateCW90()
    }

    function rotateCCW90() {
        rotation -= 90
        foreground.rotateCCW90()
    }

    function drawArrow() {
        drawingMode = false
        foreground.drawArrow(color)
    }

    function drawCircle() {
        drawingMode = false
        foreground.drawCircle(color)
    }

    function drawText() {
        drawingMode = false
        foreground.drawText(color)
    }

    function drawRect() {
        drawingMode = false
        foreground.drawRect()
    }

    // Update drawing mode when button is pressed
    $effect(() => {
        // Need this so that Svelte re-runs the code inside the condition on change
        if (foreground === undefined)
            return;

        if (drawingMode) {
            foreground.startDrawing(color)
        } else {
            foreground.endDrawing()
        }
    })

    function deleteSelectedMarker() {
        foreground.deleteMarker(activeMarker)
        activeMarker = undefined
    }

    function reset() {
        flipH = false
        flipV = false
        rotation = 0

        crop.keepAspectRatio = true

        brightness = 1
        contrast = 0

        color = "#ffff00"
        drawingMode = false

        foreground.reset()
    }

    async function saveImage() {
        saving = true

        await tick()

        try {
            const imageBlob = await foreground.saveImage(background.exportCanvas())
            await saveCallback(imageBlob)
        } catch (e) {
            saveError = e
        } finally {
            saving = false
        }
    }

    onMount(async () => {
        validate(originalImageBlob, validators)

        const imageBitmap = await createImageBitmap(originalImageBlob)

        await tick()

        foreground.init(imageBitmap)
    })
</script>

<div class="ie-relative ie-flex ie-gap-3 ie-flex-col md:ie-flex-row">
    <div class="ie-flex-auto ie-aspect-square ie-relative">
        <div class="ie-relative ie-aspect-square ie-flex ie-items-center ie-justify-center ie-mx-auto">
            <div class="ie-absolute ie-w-full ie-h-full">
                <Background bind:this={background} {brightness}
                            {contrast} {flipH} {flipV} imageBlob={originalImageBlob} {rotation}/>
            </div>
            <Foreground bind:this={foreground} bind:crop {rotation} {markers} bind:activeMarker />
        </div>

        {#if warnings.length > 0}
            <div class="ie-absolute ie-top-4 ie-left-4 ie-right-4 ie-flex ie-flex-col ie-gap-2">
                {#each warnings as warning}
                    <div class="ie-alert ie-alert-warning" role="alert">
                        <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                             stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                             xmlns="http://www.w3.org/2000/svg">
                            <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                            <path d="M12 9v4"/>
                            <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"/>
                            <path d="M12 16h.01"/>
                        </svg>
                        <span>{warning}</span>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
    <div class="ie-flex-initial md:ie-w-52 ie-flex ie-flex-col ie-justify-between ie-gap-5">
        <Toolbar bind:brightness bind:contrast bind:flipH bind:flipV bind:keepAspectRatio={crop.keepAspectRatio}
                 bind:rotation rotateCW90={rotateCW90} rotateCCW90={rotateCCW90} onrotationchange={rotationChanged}
                 cropWarning={crop.warning}
                 bind:color bind:activeMarker bind:markers bind:drawingMode
                 drawArrow={drawArrow} drawCircle={drawCircle} drawRect={drawRect} drawText={drawText}
                 deleteMarker={deleteSelectedMarker} />

        <div class="ie-flex ie-flex-col ie-gap-4">
            <button class="ie-btn ie-w-full" onclick={reset}>
                Reset changes
            </button>

            <button class="ie-btn ie-w-full"
                    class:ie-btn-danger={saveError !== undefined}
                    class:ie-btn-primary={saveError === undefined}
                    disabled={(saveError !== undefined) || saving}
                    onclick={saveImage}>
                {#if saving}
                    <span class="ie-loading ie-loading-spinner"></span>
                    Saving
                {:else}
                    <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                         stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                         xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                        <path d="M5 12l5 5l10 -10"/>
                    </svg>
                    Save image
                {/if}
            </button>
        </div>
    </div>

    {#if saveError}
        <div class="ie-absolute ie-bg-base-200/80 ie-w-full ie-h-full ie-z-1 ie-flex ie-flex-col ie-items-center ie-justify-center">
            <div class="ie-card ie-shadow-sm ie-bg-base-100 ie-m-2">
                <div class="ie-card-body">
                    <div class="ie-alert ie-alert-error ie-mb-4">
                        <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                             stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                             xmlns="http://www.w3.org/2000/svg">
                            <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                            <path d="M12 9v4"/>
                            <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"/>
                            <path d="M12 16h.01"/>
                        </svg>
                        Error while uploading image
                    </div>

                    <div>
                        Please provide the original file and the following message when contacting support:
                    </div>

                    <code class="ie-text-sm ie-bg-base-200 ie-p-2">
                        [{new Date().toISOString()}]
                        [{window.location.pathname}]
                        {saveError}
                    </code>

                    <div>You can reload the page and try again in a few minutes.</div>
                </div>
            </div>
        </div>
    {/if}
</div>