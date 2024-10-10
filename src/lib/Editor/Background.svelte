<script>
    import {Application, Assets, ColorMatrixFilter, Sprite} from "pixi.js"
    import {onMount} from "svelte"

    export let imageBlob

    let canvasContainer

    const app = new Application()
    let image
    let brightnessFilter
    let contrastFilter

    export let rotation = 0
    $: adjustRotation(rotation)
    function adjustRotation(newValue) {
        if (image !== undefined) {
            image.angle = newValue
            app.render()
            app.ticker.stop()
        }
    }

    export let flipH
    $: adjustFlipHorizontal(flipH)
    function adjustFlipHorizontal(newValue) {
        if (image !== undefined) {
            image.scale.x = newValue ? -1 : 1
            app.render()
            app.ticker.stop()
        }
    }

    export let flipV
    $: adjustFlipVertical(flipV)
    function adjustFlipVertical(newValue) {
        if (image !== undefined) {
            image.scale.y = newValue ? -1 : 1
            app.render()
            app.ticker.stop()
        }
    }

    export let brightness = 1
    $: adjustBrightness(brightness)
    function adjustBrightness(newValue) {
        if (brightnessFilter !== undefined) {
            brightnessFilter.brightness(newValue)
            app.render()
            app.ticker.stop()
        }
    }

    export let contrast = 0
    $: adjustContrast(contrast)
    function adjustContrast(newValue) {
        if (contrastFilter !== undefined) {
            contrastFilter.contrast(newValue)
            app.render()
            app.ticker.stop()
        }
    }

    export function exportCanvas() {
        return app.renderer.extract.canvas({target:app.stage})
    }

    onMount(async () => {
        const texture = await Assets.load({
            src: URL.createObjectURL(imageBlob),
            loadParser: 'loadTextures'}
        )
        const maxDimension = Math.max(texture.width, texture.height)

        await app.init({
            background: 'dimgrey',
            width: maxDimension,
            height: maxDimension,
            autoStart: false,
            sharedTicker: true
        })
        canvasContainer.appendChild(app.canvas)

        image = new Sprite(texture)
        image.anchor = 0.5
        image.x = app.screen.width / 2
        image.y = app.screen.height / 2

        brightnessFilter = new ColorMatrixFilter()
        contrastFilter = new ColorMatrixFilter()
        image.filters = [brightnessFilter, contrastFilter]

        app.stage.addChild(image)

        app.render()
        app.ticker.stop()
    })
</script>

<div id="backgroundSubContainer" bind:this={canvasContainer}></div>

<style>
    #backgroundSubContainer,
    :global(#backgroundSubContainer > canvas) {
        width: 100%;
        height: 100%;
    }
</style>