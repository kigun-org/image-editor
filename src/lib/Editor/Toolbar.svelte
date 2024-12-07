<script lang="ts">
    import {createEventDispatcher} from "svelte";




    interface Props {
        flipH: boolean;
        flipV: boolean;
        rotation: number;
        cropWarning: boolean;
        keepAspectRatio: boolean;
        brightness: number;
        contrast: number;
        markers: any;
        activeMarker: any;
    }

    let {
        flipH = $bindable(),
        flipV = $bindable(),
        rotation = $bindable(),
        cropWarning,
        keepAspectRatio = $bindable(),
        brightness = $bindable(),
        contrast = $bindable(),
        markers = $bindable(),
        activeMarker = $bindable()
    }: Props = $props();

    const dispatch = createEventDispatcher()
</script>

<div class="controls">
    <div>
        <h2>
            Orientation
        </h2>
        <div>
            <div class="d-flex justify-content-center gap-1">
                <button class="btn btn-outline-secondary" class:active={flipH} onclick={() => flipH = !flipH}
                        type="button">
                    <i class="bi bi-symmetry-vertical"></i>
                </button>
                <button class="btn btn-outline-secondary" class:active={flipV} onclick={() => flipV = !flipV}
                        type="button">
                    <i class="bi bi-symmetry-horizontal"></i>
                </button>

                <button class="btn btn-outline-secondary" onclick={() => rotation = rotation + 90}>
                    <i class="bi bi-arrow-clockwise"></i>
                </button>

                <button class="btn btn-outline-secondary" onclick={() => rotation = rotation - 90}>
                    <i class="bi bi-arrow-counterclockwise"></i>
                </button>
            </div>

            <div class="m-2">
                Rotation ({rotation}&deg;)
                <br>
                <input bind:value={rotation} type="range" max="180" min="-180" step="1"
                       onpointerdown={() => dispatch('rotationStart')}
                       onpointerup={() => dispatch('rotationEnd')}>
            </div>
        </div>
    </div>

    <div>
        <h2 class:bg-warning={cropWarning} class:text-warning-emphasis={cropWarning}>
            Crop
            {#if cropWarning}
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
        <div class="d-flex flex-wrap justify-content-center gap-1">
            <button class="btn btn-outline-secondary" onclick={() => dispatch('drawArrow')}>
                <i class="bi bi-arrow-right"></i>
            </button>

            <button class="btn btn-outline-secondary" onclick={() => dispatch('drawCircle')}>
                <i class="bi bi-circle"></i>
            </button>

            <button class="btn btn-outline-secondary" onclick={() => dispatch('drawRect')}>
                <i class="bi bi-square-fill"></i>
            </button>

            <button class="btn btn-outline-secondary" onclick={() => dispatch('drawText')}>
                <i class="bi bi-type"></i>
            </button>

            <button class="btn btn-danger" disabled={!markers.includes(activeMarker)}
                    onclick={() => dispatch('deleteMarker')}>
                <i class="bi bi-trash"></i>
            </button>
        </div>
    </div>
</div>

<style>
    .controls {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        gap: 2rem
    }

    h2 {
        font-size: 120%;
        margin-bottom: 0.5rem;
    }
</style>