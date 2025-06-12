<script lang="ts">
    interface Props {
        flipH: boolean;
        flipV: boolean;
        rotation: number;
        rotationStart: () => void;
        rotationEnd: () => void;
        rotateCW90: () => void;
        rotateCCW90: () => void;
        cropWarning: boolean;
        keepAspectRatio: boolean;
        brightness: number;
        contrast: number;
        markers: any;
        activeMarker: any;
        color: string;
        drawArrow: () => void;
        drawCircle: () => void;
        drawRect: () => void;
        drawText: () => void;
        drawingMode: boolean;
        deleteMarker: () => void;
    }

    let {
        flipH = $bindable(),
        flipV = $bindable(),
        rotation = $bindable(),
        rotationStart,
        rotationEnd,
        rotateCW90,
        rotateCCW90,
        cropWarning,
        keepAspectRatio = $bindable(),
        brightness = $bindable(),
        contrast = $bindable(),
        markers = $bindable(),
        activeMarker = $bindable(),
        color = $bindable(),
        drawArrow,
        drawCircle,
        drawRect,
        drawText,
        drawingMode = $bindable(),
        deleteMarker
    }: Props = $props();
</script>

<div class="k-flex k-flex-col k-gap-5">
    <div>
        <h3 class="k-text-lg k-font-bold k-mb-2">Orient</h3>

        <div class="k-flex k-justify-between k-gap-1 k-mb-2">
            <button aria-label="Flip horizontal" class="k-btn k-btn-square k-btn-outline"
                    class:k-btn-active={flipH} onclick={() => flipH = !flipH}>
                <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                     stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                     xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                    <path d="M12 3l0 18"/>
                    <path d="M16 7l0 10l5 0l-5 -10"/>
                    <path d="M8 7l0 10l-5 0l5 -10"/>
                </svg>
            </button>

            <button aria-label="Flip vertical" class="k-btn k-btn-square k-btn-outline"
                    class:k-btn-active={flipV} onclick={() => flipV = !flipV}>
                <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                     stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                     xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                    <path d="M3 12l18 0"/>
                    <path d="M7 16l10 0l-10 5l0 -5"/>
                    <path d="M7 8l10 0l-10 -5l0 5"/>
                </svg>
            </button>

            <button aria-label="Rotate 90&deg; CW" class="k-btn k-btn-square k-btn-outline"
                    onclick={rotateCW90}>
                <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                     stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                     xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                    <path d="M4.05 11a8 8 0 1 1 .5 4m-.5 5v-5h5"/>
                </svg>
            </button>

            <button aria-label="Rotate 90&deg; CCW" class="k-btn k-btn-square k-btn-outline"
                    onclick={rotateCCW90}>
                <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                     stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                     xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                    <path d="M19.95 11a8 8 0 1 0 -.5 4m.5 5v-5h-5"/>
                </svg>
            </button>
        </div>

        <div class="k-flex k-gap-2 k-justify-center">
            <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                 stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                 xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                <path d="M19.95 11a8 8 0 1 0 -.5 4m.5 5v-5h-5"/>
            </svg>
            <span>Rotation ({rotation}&deg;)</span>
        </div>

        <input bind:value={rotation} class="k-range" max="180" min="-180" onpointerdown={() => rotationStart()}
               onpointerup={() => rotationEnd()}
               step="1" type="range"/>
    </div>

    <div>
        <div class="k-flex k-gap-3">
            <h3 class="k-text-lg k-font-bold mb-1">Crop</h3>
            <button aria-label="Warning" class="k-btn k-btn-warning k-btn-sm k-btn-square"
                    class:k-invisible={!cropWarning}
                    title="Crop area extends beyond image">
                <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                     stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                     xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                    <path d="M12 9v4"/>
                    <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"/>
                    <path d="M12 16h.01"/>
                </svg>
            </button>
        </div>

        <div class="k-form-control">
            <label class="k-label k-cursor-pointer">
                <span class="k-label-text">Keep aspect ratio</span>
                <input bind:checked={keepAspectRatio} class="k-checkbox" type="checkbox"/>
            </label>
        </div>
    </div>

    <div>
        <h3 class="k-text-lg k-font-bold k-mb-2">Adjust</h3>

        <div class="k-flex k-gap-2 k-justify-center">
            <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                 stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                 xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                <path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/>
                <path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"/>
            </svg>
            <span>
                Brightness
                <small>({Math.round((brightness - 1) * 100)}%)</small>
            </span>
        </div>

        <input bind:value={brightness} class="k-range" max="1.25" min="0.75" step="0.01"
               type="range"/>

        <div class="k-flex k-gap-2 k-justify-center">
            <svg fill="currentColor" height="24" viewBox="0 0 24 24"
                 width="24" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                <path d="M17 3.34a10 10 0 1 1 -15 8.66l.005 -.324a10 10 0 0 1 14.995 -8.336m-9 1.732a8 8 0 0 0 4.001 14.928l-.001 -16a8 8 0 0 0 -4 1.072"/>
            </svg>
            Contrast
            <small>({Math.round(contrast * 100)}%)</small>
        </div>

        <input bind:value={contrast} class="k-range" max="0.25" min="-0.25" step="0.01"
               type="range"/>
    </div>

    <div>
        <h3 class="k-text-lg k-font-bold k-mb-2">Markers</h3>

        <div class="k-flex k-justify-between k-gap-1 k-mb-1">
            <button aria-label="Arrow marker" class="k-btn k-btn-square k-btn-outline"
                    onclick={drawArrow}>
                <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                     stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                     xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                    <path d="M5 12l14 0"/>
                    <path d="M15 16l4 -4"/>
                    <path d="M15 8l4 4"/>
                </svg>
            </button>

            <button aria-label="Circle marker" class="k-btn k-btn-square k-btn-outline"
                    onclick={drawCircle}>
                <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                     stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                     xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                    <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/>
                </svg>
            </button>

            <button aria-label="Text" class="k-btn k-btn-square k-btn-outline"
                    onclick={drawText}>
                <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                     stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                     xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                    <path d="M17.5 15.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0"/>
                    <path d="M3 19v-10.5a3.5 3.5 0 0 1 7 0v10.5"/>
                    <path d="M3 13h7"/>
                    <path d="M21 12v7"/>
                </svg>
            </button>

            <button aria-label="Rectangle marker" class="k-btn k-btn-square k-btn-outline"
                    onclick={drawRect}>
                <svg fill="currentColor" height="24" viewBox="0 0 24 24"
                     width="24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                    <path d="M19 4h-14a3 3 0 0 0 -3 3v10a3 3 0 0 0 3 3h14a3 3 0 0 0 3 -3v-10a3 3 0 0 0 -3 -3z"/>
                </svg>
            </button>
        </div>

        <div class="k-flex k-justify-between k-gap-1 k-mb-1">
            <button aria-label="Draw" class="k-btn k-btn-square k-btn-outline"
                    onclick={() => drawingMode = !drawingMode} class:k-btn-active={drawingMode}>
                <svg class="icon icon-tabler icons-tabler-outline icon-tabler-scribble" fill="none" height="24"
                     stroke="currentColor" stroke-linecap="round"
                     stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                     xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                    <path d="M3 15c2 3 4 4 7 4s7 -3 7 -7s-3 -7 -6 -7s-5 1.5 -5 4s2 5 6 5s8.408 -2.453 10 -5"/>
                </svg>
            </button>

            <div class="k-btn k-btn-square">
                <input class="w-75 h-75" type="color" bind:value={color} />
            </div>

            <button aria-label="Delete" class="k-btn k-btn-error k-flex-grow"
                    disabled={!markers.includes(activeMarker)} onclick={deleteMarker}>
                <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round"
                     stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                     xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                    <path d="M4 7l16 0"/>
                    <path d="M10 11l0 6"/>
                    <path d="M14 11l0 6"/>
                    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/>
                    <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>
                </svg>
            </button>
        </div>

        {#if drawingMode}
            <div class="k-mt-2">
                Click the
                <span class="k-inline-block">
                    <svg class="icon icon-tabler icons-tabler-outline icon-tabler-scribble" fill="none" height="24"
                         stroke="currentColor" stroke-linecap="round"
                         stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"
                         xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 0h24v24H0z" fill="none" stroke="none"/>
                        <path d="M3 15c2 3 4 4 7 4s7 -3 7 -7s-3 -7 -6 -7s-5 1.5 -5 4s2 5 6 5s8.408 -2.453 10 -5"/>
                    </svg>
                </span>
                button again to stop drawing.
            </div>
        {/if}
    </div>
</div>