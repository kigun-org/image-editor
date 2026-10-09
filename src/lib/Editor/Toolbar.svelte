<script lang="ts">
    import type { EditorSnapshot } from '../types';
    import IconButton from './IconButton.svelte';
    import FlipHorizontal from '@lucide/svelte/icons/flip-horizontal';
    import FlipVertical from '@lucide/svelte/icons/flip-vertical';
    import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import RotateCw from '@lucide/svelte/icons/rotate-cw';
    import MoveUpRight from '@lucide/svelte/icons/move-up-right';
    import Circle from '@lucide/svelte/icons/circle';
    import RectangleHorizontal from '@lucide/svelte/icons/rectangle-horizontal';
    import Type from '@lucide/svelte/icons/type';
    import Pencil from '@lucide/svelte/icons/pencil';
    import SendToBack from '@lucide/svelte/icons/send-to-back';
    import BringToFront from '@lucide/svelte/icons/bring-to-front';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

    interface Props {
        disabled: boolean;
        snapshot: EditorSnapshot;
        rotation: number;
        brightness: number;
        contrast: number;
        flipH: boolean;
        flipV: boolean;
        keepAspectRatio: boolean;
        color: string;
        drawingMode: boolean;
        onorientation: (action: 'flipH' | 'flipV' | 'cw' | 'ccw') => void;
        onadjust: (name: 'rotation' | 'brightness' | 'contrast', value: number) => void;
        onaspect: (value: boolean) => void;
        oncolor: (value: string) => void;
        ondraw: (type: 'arrow' | 'circle' | 'rectangle' | 'text' | 'freehand') => void;
        ondelete: (id: string) => void;
        onorder: (id: string, direction: 'forward' | 'backward') => void;
    }
    let { disabled, snapshot, rotation, brightness, contrast, flipH, flipV,
        keepAspectRatio, color, drawingMode, onorientation, onadjust, onaspect,
        oncolor, ondraw, ondelete, onorder }: Props = $props();
    const uid = $props.id();
    const selected = $derived(snapshot.annotations.find((item) => item.id === snapshot.selectedId));

</script>

<fieldset class="ie-controls" {disabled} aria-label="Image editing controls">
    <fieldset>
        <legend>Orient</legend>
        <div class="ie-button-row">
            <IconButton {disabled} icon={FlipHorizontal} label="Flip horizontal" pressed={flipH} onclick={() => onorientation('flipH')} />
            <IconButton {disabled} icon={FlipVertical} label="Flip vertical" pressed={flipV} onclick={() => onorientation('flipV')} />
            <IconButton {disabled} icon={RotateCcw} label="Rotate left 90°" onclick={() => onorientation('ccw')} />
            <IconButton {disabled} icon={RotateCw} label="Rotate right 90°" onclick={() => onorientation('cw')} />
        </div>
        <label for={`${uid}-rotation`}>Rotation: {rotation}°</label>
        <input id={`${uid}-rotation`} class="range" type="range" min="-180" max="180" step="1" value={rotation}
            aria-valuetext={`${rotation} degrees`} oninput={(event) => onadjust('rotation', event.currentTarget.valueAsNumber)} />
    </fieldset>
    <fieldset>
        <legend class="ie-crop-title">Crop{#if snapshot.crop.warning}<TriangleAlert size={20} class="ie-crop-warning" role="img" aria-label="Crop extends outside the image" />{/if}</legend>
        <label class="ie-check"><input class="checkbox" type="checkbox" checked={keepAspectRatio} onchange={(event) => onaspect(event.currentTarget.checked)} /> Keep aspect ratio</label>
    </fieldset>
    <fieldset>
        <legend>Adjust</legend>
        <label for={`${uid}-brightness`}>Brightness: {Math.round((brightness - 1) * 100)}%</label>
        <input id={`${uid}-brightness`} class="range" type="range" min="0.75" max="1.25" step="0.01" value={brightness}
            aria-valuetext={`${Math.round((brightness - 1) * 100)} percent`} oninput={(event) => onadjust('brightness', event.currentTarget.valueAsNumber)} />
        <label for={`${uid}-contrast`}>Contrast: {Math.round(contrast * 100)}%</label>
        <input id={`${uid}-contrast`} class="range" type="range" min="-0.25" max="0.25" step="0.01" value={contrast}
            aria-valuetext={`${Math.round(contrast * 100)} percent`} oninput={(event) => onadjust('contrast', event.currentTarget.valueAsNumber)} />
    </fieldset>
    <fieldset>
        <legend>Annotate</legend>
        <div class="ie-button-row">
            <IconButton {disabled} icon={MoveUpRight} label="Add arrow" onclick={() => ondraw('arrow')} />
            <IconButton {disabled} icon={Circle} label="Add circle" onclick={() => ondraw('circle')} />
            <IconButton {disabled} icon={RectangleHorizontal} filled label="Add rectangle" onclick={() => ondraw('rectangle')} />
            <IconButton {disabled} icon={Type} label="Add text" onclick={() => ondraw('text')} />
            <IconButton {disabled} icon={Pencil} label="Draw freehand" pressed={drawingMode} onclick={() => ondraw('freehand')} />
            <label class="ie-new-color"><span class="ie-sr-only">Annotation color</span><input class="input" type="color" title="Annotation color" value={color} oninput={(event) => oncolor(event.currentTarget.value)} /></label>
        </div>
        <div class="ie-annotation-details">
            <p class:ie-hidden={!drawingMode} aria-hidden={!drawingMode}>Draw on the image. Press Escape or select Draw freehand again to stop.</p>
            <div class="ie-button-row ie-selected-actions" class:ie-hidden={!selected} inert={!selected}>
                <IconButton disabled={disabled || !selected} icon={SendToBack} label="Send backward" onclick={() => selected && onorder(selected.id, 'backward')} />
                <IconButton disabled={disabled || !selected} icon={BringToFront} label="Bring forward" onclick={() => selected && onorder(selected.id, 'forward')} />
                <div class="ie-delete-action"><IconButton disabled={disabled || !selected} icon={Trash2} label="Delete annotation" danger onclick={() => selected && ondelete(selected.id)} /></div>
            </div>
        </div>
    </fieldset>
</fieldset>

<style>
    .ie-controls { display: grid; gap: 1.25rem; min-width: 0; margin: 0; padding: 0; border: 0; }
    fieldset { min-width: 0; border: 0; padding: 0; margin: 0; }
    legend { font-size: 1.125rem; font-weight: 700; margin-bottom: .5rem; }
    .ie-crop-title { display: flex; align-items: center; gap: .5rem; }
    .ie-crop-title :global(.ie-crop-warning) { color: #17202a; fill: var(--ie-color-warning, #f59e0b); }
    label { display: grid; gap: .25rem; margin-top: .5rem; font-size: .9375rem; }
    p { font-size: .875rem; line-height: 1.5; margin: .5rem 0; }
    .ie-button-row { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .5rem; }
    .ie-annotation-details { display: grid; margin-top: 1rem; }
    .ie-annotation-details > :is(p, .ie-selected-actions) { grid-area: 1 / 1; margin: 0; }
    .ie-delete-action { display: flex; margin-left: auto; }
    .ie-hidden { visibility: hidden; }
    input { min-width: 0; width: 100%; }
    input:not([type='range']):not([type='checkbox']) { min-height: 44px; }
    .ie-check { display: flex; align-items: center; min-height: 44px; gap: .5rem; }
    .ie-check input { width: 1.5rem; flex-shrink: 0; }
    .ie-new-color { display: flex; align-items: center; flex: 0 0 44px; margin: 0 0 0 auto; }
    .ie-new-color input { width: 44px; height: 44px; padding: .25rem; cursor: pointer; }
    .ie-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    input[type='range'] { min-height: 44px; }
    .ie-controls :is(.input, .checkbox) { border: 1px solid var(--ie-ui-border); }
    input:focus-visible { outline: 3px solid var(--ie-ui-focus); outline-offset: 3px; }
    @media (hover: none), (pointer: coarse) { .ie-delete-action { flex: 0 0 5.5rem; } }
    @container (max-width:479px) {
        .ie-button-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .ie-button-row :global(.ie-icon-action) { min-width: 0; width: 100%; }
        .ie-button-row :global(.ie-icon-button) { width: 100%; }
        .ie-delete-action { margin-left: 0; }
        .ie-new-color { margin-left: 0; }
    }
    @media (forced-colors: active) { input:focus-visible { outline-color: Highlight; } .ie-controls :is(.input, .checkbox) { border-color: ButtonText; } .ie-controls .range::-webkit-slider-runnable-track { background: ButtonText; } .ie-controls .range::-moz-range-track { background: ButtonText; } }
</style>
