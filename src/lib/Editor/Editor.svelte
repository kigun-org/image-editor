<script lang="ts">
    import { onMount, onDestroy, tick } from 'svelte';
    import Background from './Background.svelte';
    import Foreground from './Foreground.svelte';
    import Toolbar from './Toolbar.svelte';
    import WarningAlert from './WarningAlert.svelte';
    import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import Check from '@lucide/svelte/icons/check';
    import LoaderCircle from '@lucide/svelte/icons/loader-circle';
    import type { ErrorNotice, PreparedImage, EditorSnapshot, AnnotationSnapshot, SaveCallback } from '../types';

    interface Props { preparedImage: PreparedImage; saveCallback: SaveCallback; onready?: () => void; onbusy?: (busy: boolean) => void; onretry?: () => void; onerror?: (notice: ErrorNotice | undefined) => void; }
    let { preparedImage, saveCallback, onready, onbusy, onretry, onerror }: Props = $props();
    interface BackgroundAPI { exportCanvas: () => HTMLCanvasElement; flush: () => void; }
    interface ForegroundAPI {
        init: (size: {width: number; height: number}) => void | Promise<void>;
        saveImage: (background: HTMLCanvasElement) => Promise<Blob>;
        reset: () => void;
        setRotation: (angle: number) => void;
        setKeepAspectRatio: (value: boolean) => void;
        setInteractive: (value: boolean) => void;
        rotateCW90: () => void; rotateCCW90: () => void;
        drawArrow: (color: string) => void; drawCircle: (color: string) => void;
        drawRect: (color: string) => void; drawText: (color: string) => void;
        startDrawing: (color: string) => void; endDrawing: () => void;
        updateAnnotation: (id: string, change: Partial<AnnotationSnapshot>) => void;
        deleteMarker: (id: string) => void;
        moveAnnotation: (id: string, direction: 'forward' | 'backward') => void;
    }
    let editorRoot: HTMLElement;
    let saveButton: HTMLButtonElement;
    let preview: HTMLDivElement;
    let dismissedWarnings = $state<number[]>([]);
    let cropWarningDismissed = $state(false);
    $effect(() => { if (!snapshot.crop.warning) cropWarningDismissed = false; });
    function dismissWarning(index?: number) {
        if (index === undefined) cropWarningDismissed = true;
        else dismissedWarnings = [...dismissedWarnings, index];
        void tick().then(() => { if (!disposed) preview?.focus(); });
    }
    let background: BackgroundAPI | undefined = $state();
    let foreground: ForegroundAPI | undefined = $state();
    let snapshot: EditorSnapshot = $state({crop: {x: 0, y: 0, width: 1, height: 1, warning: false}, annotations: [], selectedId: undefined});
    let rotation = $state(0);
    let brightness = $state(1);
    let contrast = $state(0);
    let flipH = $state(false);
    let flipV = $state(false);
    let keepAspectRatio = $state(true);
    let color = $state('#ffff00');
    let drawingMode = $state(false);
    let saving = $state(false);
    let saveError = $state(false);
    let initializationError = $state(false);
    let foregroundReady = $state(false);
    let backgroundReady = $state(false);
    let saved = $state(false);
    const ready = $derived(foregroundReady && backgroundReady && !initializationError);
    const disabled = $derived(!ready || saving);
    let retryBlob: Blob | undefined;
    let disposed = false;
    let announcedReady = false;
    const uid = $props.id();

    function changed() { retryBlob = undefined; saved = false; saveError = false; }
    function updateSnapshot(value: EditorSnapshot) {
        if (disposed) return;
        snapshot = value;
        const selected = value.annotations.find(item => item.id === value.selectedId);
        if (selected) color = selected.color;
        if (!saving) changed();
    }
    function initializationFailed() {
        if (!disposed) { initializationError = true; foreground?.setInteractive(false); }
    }
    $effect(() => {
        if (ready && !announcedReady && !disposed) { announcedReady = true; onready?.(); }
    });
    onMount(() => {
        let cancelled = false;
        editorRoot.addEventListener('keydown', escape);
        void tick().then(async () => {
            if (cancelled || disposed) return;
            try {
                await foreground?.init({width: preparedImage.width, height: preparedImage.height});
                if (!cancelled && !disposed) foregroundReady = true;
            } catch { initializationFailed(); }
        });
        return () => { cancelled = true; editorRoot.removeEventListener('keydown', escape); };
    });
    onDestroy(() => { disposed = true; retryBlob = undefined; onerror?.(undefined); });
    $effect(() => {
        onerror?.(initializationError ? {
            message:'Could not prepare the image editor. Try loading the image again.',
            retryLabel:'Retry editor initialization', onretry,
        } : saveError ? {
            message:'Could not save the image. Your changes are kept. Try saving again.',
            id:`${uid}-save-error`, retryLabel:'Retry save', dismissLabel:'Dismiss save error', disabled,
            onretry:()=>void saveImage(true),
            ondismiss:()=>{ saveError=false;void tick().then(()=>{if(!disposed)saveButton?.focus();}); },
        } : undefined);
    });

    function orientation(action: 'flipH' | 'flipV' | 'cw' | 'ccw') {
        if (disabled || !foreground) return;
        changed();
        if (action === 'flipH') flipH = !flipH;
        else if (action === 'flipV') flipV = !flipV;
        else {
            if (action === 'cw') { rotation += 90; foreground.rotateCW90(); }
            else { rotation -= 90; foreground.rotateCCW90(); }
            rotation = ((rotation + 180) % 360 + 360) % 360 - 180;
            foreground.setRotation(rotation);
        }
    }
    function adjust(name: 'rotation' | 'brightness' | 'contrast', value: number) {
        if (disabled || !Number.isFinite(value)) return;
        changed();
        if (name === 'rotation') { rotation = value; foreground?.setRotation(value); }
        else if (name === 'brightness') brightness = value;
        else contrast = value;
    }
    function aspect(value: boolean) {
        if (disabled) return;
        changed(); keepAspectRatio = value; foreground?.setKeepAspectRatio(value);
    }
    function setColor(value: string) {
        if (disabled) return;
        color = value;
        if (snapshot.selectedId) annotation(snapshot.selectedId, { color: value });
        if (drawingMode) foreground?.startDrawing(value);
    }
    function draw(type: 'arrow' | 'circle' | 'rectangle' | 'text' | 'freehand') {
        if (disabled || !foreground) return;
        changed();
        if (type === 'freehand') {
            drawingMode = !drawingMode;
            if (drawingMode) foreground.startDrawing(color); else foreground.endDrawing();
            return;
        }
        drawingMode = false; foreground.endDrawing();
        if (type === 'arrow') foreground.drawArrow(color);
        else if (type === 'circle') foreground.drawCircle(color);
        else if (type === 'rectangle') foreground.drawRect(color);
        else foreground.drawText(color);
    }
    function escape(event: KeyboardEvent) {
        if (event.isComposing) return;
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
            event.preventDefault();
        }
        if (event.key === 'Escape' && drawingMode && !disabled) {
            drawingMode = false; foreground?.endDrawing(); event.preventDefault();
        }
    }
    function reset() {
        if (disabled) return;
        changed(); rotation = 0; brightness = 1; contrast = 0; flipH = false; flipV = false;
        keepAspectRatio = true; color = '#ffff00'; drawingMode = false;
        foreground?.endDrawing(); foreground?.setRotation(0); foreground?.setKeepAspectRatio(true); foreground?.reset();
    }
    async function saveImage(retry = false) {
        if (disabled || !foreground || !background || disposed) return;
        const invalidInput = editorRoot.querySelector<HTMLInputElement>('input:invalid');
        if (invalidInput) { invalidInput.reportValidity(); return; }
        saving = true; saved = false; saveError = false; onbusy?.(true);
        foreground.setInteractive(false);
        const editorShadow = editorRoot.getRootNode() as ShadowRoot;
        const restoreSaveFocus = editorShadow.querySelector('.ie-error')?.contains(editorShadow.activeElement) ?? false;
        let exportCanvas: HTMLCanvasElement | undefined;
        try {
            await tick();
            if (disposed) return;
            let blob = retry ? retryBlob : undefined;
            if (!blob) {
                background.flush();
                exportCanvas = background.exportCanvas();
                blob = await foreground.saveImage(exportCanvas);
                if (!(blob instanceof Blob) || blob.size === 0) throw new Error('Image encoding failed');
                if (disposed) return;
                retryBlob = blob;
            }
            await saveCallback(blob);
            if (!disposed) { saved = true; retryBlob = undefined; }
        } catch {
            if (!disposed) saveError = true;
        } finally {
            if (exportCanvas) { exportCanvas.width = 0; exportCanvas.height = 0; }
            if (!disposed) { saving = false; foreground?.setInteractive(ready); if (ready && drawingMode) foreground?.startDrawing(color); onbusy?.(false); if (restoreSaveFocus) void tick().then(() => { if (!disposed) saveButton?.focus(); }); }
        }
    }
    function annotation(id: string, change: Partial<AnnotationSnapshot>) { if (!disabled) { changed(); foreground?.updateAnnotation(id, change); } }
    function remove(id: string) { if (!disabled) { changed(); foreground?.deleteMarker(id); } }
    function order(id: string, direction: 'forward' | 'backward') { if (!disabled) { changed(); foreground?.moveAnnotation(id, direction); } }
</script>

<section bind:this={editorRoot} class="ie-edit" aria-label="Image editor" aria-busy={(!ready && !initializationError) || saving}>
    <p class="ie-status" role="status" aria-live="polite" aria-atomic="true">
        {#if initializationError}Image editor unavailable.{:else if !ready}Preparing image…{:else if saving}Saving image…{:else if saved}Image saved.{/if}
    </p>
    <div class="ie-workspace">
        <div bind:this={preview} class="ie-preview" tabindex="-1" role="group" aria-label="Image preview. Drag the crop handles to crop. Use the annotation controls to edit annotations.">
            <div class="ie-background"><Background bind:this={background} source={preparedImage.source} width={preparedImage.width} height={preparedImage.height}
                {brightness} {contrast} {flipH} {flipV} {rotation} onready={() => { if (!disposed) backgroundReady = true; }} onerror={initializationFailed} /></div>
            <Foreground bind:this={foreground} onchange={updateSnapshot} onerror={initializationFailed} />
            <div class="ie-warnings">
                {#each preparedImage.warnings as warning, index}
                    {#if !dismissedWarnings.includes(index)}<WarningAlert message={warning} ondismiss={() => dismissWarning(index)} />{/if}
                {/each}
                {#if snapshot.crop.warning && !cropWarningDismissed}<WarningAlert message="The crop extends outside the image. Empty areas will be gray." ondismiss={() => dismissWarning()} />{/if}
            </div>
        </div>
        <div class="ie-panel">
            <Toolbar {disabled} {snapshot} {rotation} {brightness} {contrast} {flipH} {flipV} {keepAspectRatio} {color} {drawingMode}
                onorientation={orientation} onadjust={adjust} onaspect={aspect} oncolor={setColor} ondraw={draw}
                ondelete={remove} onorder={order} />
            <div class="ie-bottom-actions">
                <div class="ie-actions">
                    <button type="button" class="btn btn-outline" {disabled} onclick={reset}><RotateCcw size={20} aria-hidden="true" focusable="false" /><span>Reset</span></button>
                    <button bind:this={saveButton} type="button" class="btn btn-primary" {disabled} aria-busy={saving} aria-describedby={saveError ? `${uid}-save-error` : undefined} onclick={() => saveImage()}>
                        {#if saving}<LoaderCircle class="ie-save-spinner" size={20} aria-hidden="true" focusable="false" />{:else}<Check size={20} aria-hidden="true" focusable="false" />{/if}
                        <span>{saving ? 'Saving...' : 'Save image'}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</section>

<style>
    .ie-edit { container-type: inline-size; min-width: 0; color: var(--ie-ui-text); }
    .ie-status { position: absolute; width: 1px; height: 1px; padding: 0; margin: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .ie-workspace { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
    .ie-preview { position: relative; width: 100%; aspect-ratio: 1; min-width: 0; align-self: start; background-color: var(--ie-checker-dark); background-image: conic-gradient(var(--ie-checker-light) 25%, var(--ie-checker-dark) 0 50%, var(--ie-checker-light) 0 75%, var(--ie-checker-dark) 0); background-size: 24px 24px; }
    .ie-background { position: absolute; inset: 0; }
    .ie-warnings { position: absolute; top: .75rem; left: .75rem; right: .75rem; z-index: 2; display: grid; gap: .5rem; max-height: calc(100% - 1.5rem); overflow-y: auto; padding: 3px; pointer-events: none; }
    .ie-warnings :global(.ie-warning) { pointer-events: auto; }
    .ie-preview:focus-visible { outline: 3px solid var(--ie-ui-focus); outline-offset: 3px; }
    .ie-panel { min-width: 0; display: flex; flex-direction: column; justify-content: space-between; gap: 1.5rem; }
    .ie-bottom-actions { display: grid; gap: .5rem; }
    .ie-actions { display: flex; flex-wrap: wrap; align-items: flex-start; gap: .5rem; }
    .ie-actions button { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; min-width: 44px; min-height: 44px; height: auto; padding: .5rem .75rem; white-space: nowrap; flex: 1 1 8rem; }
    .ie-actions :global(svg) { flex-shrink: 0; }
    .ie-actions :global(.ie-save-spinner) { animation: ie-save-spin 1s linear infinite; }
    @keyframes ie-save-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .ie-actions :global(.ie-save-spinner) { animation: none; } }
    button:focus-visible { outline: 3px solid var(--ie-ui-focus); outline-offset: 3px; }
    @container (min-width: 720px) { .ie-workspace { grid-template-columns: minmax(0, 1fr) minmax(17rem, 20rem); } .ie-preview { position: sticky; top: 1rem; } }
    @media (forced-colors: active) { button:focus-visible { outline-color: Highlight; } .ie-preview { background-image: none; background-color: Canvas; } }
</style>
