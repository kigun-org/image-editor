<script lang="ts">
import { onDestroy, tick, untrack } from 'svelte';
import Editor from './Editor/Editor.svelte';
import Gallery from './Editor/Gallery.svelte';
import ErrorBanner from './Editor/ErrorBanner.svelte';
import Upload from '@lucide/svelte/icons/upload';
import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
import Images from '@lucide/svelte/icons/images';
import { prepareImage, fetchImage, resolveLimits, errorMessage, throwIfAborted } from './utils';
import type { ErrorNotice, ImageLimits, PreparedImage, ImageEditorProps } from './types';

let { theme = 'system', imageBlob, galleryURL, passthroughOriginal = true, saveCallback, validators = [], imageLimits = {} }: ImageEditorProps = $props();
let root: HTMLDivElement;
let fileInput = $state<HTMLInputElement>();
let galleryTrigger = $state<HTMLButtonElement>();
let uploadTrigger = $state<HTMLButtonElement>();
let editorBusy = $state(false);
let lastBlob: Blob | undefined;
let prepared = $state<PreparedImage>();
let copyCandidate = $state<PreparedImage>();
let showBrowser = $state(false);
let loading = $state(false);
let copying = $state(false);
let message = $state('');
let error = $state('');
let childError = $state<ErrorNotice>();
let generation = 0;
let clipboardGeneration = 0;
let disposed = false;
let controller: AbortController | undefined;
let queue: Promise<unknown> = Promise.resolve();
let retry: (() => void) | undefined;
function restoreFocus() {
    void tick().then(() => {
        if (disposed) return;
        const heading = root?.querySelector<HTMLElement>('h2[tabindex],h3[tabindex]');
        (heading ?? galleryTrigger ?? uploadTrigger)?.focus();
    });
}
function dismissError() {
    error = '';
    restoreFocus();
}
function release(value: PreparedImage | undefined) {
    if (value)
        void tick().then(() => value.dispose());
}
async function load(input: Blob | string, copy = false, userAction = true) {
    if (disposed || editorBusy || copying)
        return;
    const token = ++generation;
    controller?.abort();
    const current = new AbortController();
    controller = current;
    loading = true;
    error = '';
    retry = () => void load(input, copy, true);
    const oldPrepared = prepared, oldCopy = copyCandidate;
    prepared = undefined;
    copyCandidate = undefined;
    release(oldPrepared);
    release(oldCopy);
    const work = async () => {
        try {
            throwIfAborted(current.signal);
            const limits = resolveLimits(imageLimits);
            const blob = typeof input === 'string' ? await fetchImage(input, limits, current.signal) : input;
            const result = await prepareImage(blob, limits, validators, current.signal);
            if (disposed || token !== generation) {
                result.dispose();
                return;
            }
            if (copy) {
                copyCandidate = result;
                await copyOriginal();
                if (!disposed && token === generation) loading = false;
                return;
            }
            prepared = result;
            showBrowser = false;
            loading = false;
            message = result.resized ? `Image resized to ${result.width} by ${result.height} pixels for this browser.` : '';
            if (userAction) {
                await tick();
                root?.querySelector<HTMLElement>('h2[tabindex],h3[tabindex]')?.focus();
            }
        }
        catch (e) {
            if (disposed || token !== generation)
                return;
            loading = false;
            if (!(e instanceof DOMException && e.name === 'AbortError'))
                error = errorMessage(e);
        }
    };
    queue = queue.then(work, work);
    await queue;
}
function firstImage(files: FileList | File[] | undefined) {
    return files && Array.from(files).find(f => f.type.startsWith('image/') || !f.type);
}
function changed(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file)
        void load(file);
}
function dropped(event: DragEvent) {
    if (error || childError || editorBusy || copying || disposed)
        return;
    const files = event.dataTransfer?.files;
    const file = firstImage(files) ?? files?.[0];
    if (file) {
        event.preventDefault();
        void load(file);
    }
}
function pasted(event: ClipboardEvent) {
    if (error || childError || editorBusy || copying || disposed)
        return;
    const target = event.target;
    if (target instanceof Element && target.closest('input,textarea,[contenteditable="true"]'))
        return;
    const files = event.clipboardData?.files;
    let file = firstImage(files);
    if (!file) {
        const item = Array.from(event.clipboardData?.items ?? []).find(item => item.kind === 'file' && item.type.startsWith('image/'));
        file = item?.getAsFile() ?? undefined;
    }
    if (file) {
        event.preventDefault();
        void load(file);
    }
}
async function pasteButton() {
    if (disposed || editorBusy || copying)
        return;
    const token = generation;
    const clipboardToken = ++clipboardGeneration;
    const isCurrent = () => !disposed && token === generation && clipboardToken === clipboardGeneration;
    error = '';
    retry = () => void pasteButton();
    try {
        if (!navigator.clipboard?.read)
            throw new Error('Use the paste keyboard shortcut while the editor is focused.');
        const items = await navigator.clipboard.read();
        if (!isCurrent()) return;
        const item = items.find(item => item.types.some(type => type.startsWith('image/')));
        const type = item?.types.find(type => type.startsWith('image/'));
        if (!item || !type)
            throw new Error('The clipboard does not contain an image.');
        const blob = await item.getType(type);
        if (isCurrent()) await load(blob);
    }
    catch (e) {
        if (isCurrent())
            error = errorMessage(e);
    }
}
function cancel() {
    generation++;
    controller?.abort();
    loading = false;
    showBrowser = false;
    release(copyCandidate);
    copyCandidate = undefined;
    error = '';
    restoreFocus();
}
async function copyOriginal() {
    if (!copyCandidate || copying)
        return;
    const candidate = copyCandidate;
    const token = generation;
    copying = true;
    error = '';
    try {
        await saveCallback(candidate.copyBlob);
        if (disposed || token !== generation)
            return;
        message = 'Image saved.';
        release(candidate);
        copyCandidate = undefined;
        showBrowser = false;
        restoreFocus();
    }
    catch (e) {
        if (!disposed && token === generation)
            error = errorMessage(e);
    }
    finally {
        if (!disposed && token === generation)
            copying = false;
    }
}
$effect(() => {
    const blob = imageBlob;
    const busy = editorBusy || copying;
    if (blob && blob !== lastBlob && !busy) {
        lastBlob = blob;
        untrack(() => void load(blob, false, false));
    }
});
onDestroy(() => {
    disposed = true;
    generation++;
    controller?.abort();
    prepared?.dispose();
    copyCandidate?.dispose();
});
</script>
<div class="image-editor" data-theme={theme} bind:this={root} onpaste={pasted} aria-busy={loading||copying}>
 <div class="ie-status" class:ie-blocked={!!error || !!childError} inert={!!error || !!childError} role="status">{message}</div>
 {#if error}<ErrorBanner notice={{message:error,retryLabel:copyCandidate?'Retry save':'Retry',onretry:()=>copyCandidate?void copyOriginal():retry?.(),ondismiss:dismissError}} />{:else if childError}<ErrorBanner notice={childError} />{/if}
 <div class="ie-page" class:ie-blocked={!!error || !!childError} inert={!!error || !!childError}>
 {#if loading || copying}<div class="ie-loading-panel"><p role="status">{copying ? 'Uploading image…' : 'Loading image…'}</p><button class="btn btn-outline" type="button" disabled={copying} onclick={cancel}>Cancel loading</button></div>
 {:else if prepared}{#key prepared}<Editor preparedImage={prepared} {saveCallback} onbusy={(value)=>editorBusy=value} onretry={()=>retry?.()} onerror={(notice)=>childError=notice}/>{/key}
 {:else if showBrowser&&galleryURL}<Gallery url={galleryURL} cancel={cancel} {passthroughOriginal} imageSelected={(url,copy)=>load(url,copy)} onerror={(notice)=>childError=notice}/>
 {:else}<section class="ie-upload" aria-label="Load an image" ondragover={(event)=>{if(event.dataTransfer?.types.includes('Files'))event.preventDefault();}} ondrop={dropped}>
 <h2>Image editor</h2><p>Select an image, drop a file here, or paste an image while this editor has focus.</p><input bind:this={fileInput} type="file" accept="image/*" onchange={changed} hidden tabindex="-1" aria-label="Image file"/>
 <div class="ie-source-actions">
  <button bind:this={uploadTrigger} type="button" class="btn btn-soft btn-primary" onclick={()=>fileInput?.click()}><Upload size={48} strokeWidth={1.8} aria-hidden="true" focusable="false" /><span>Upload an image</span></button>
  <button type="button" class="btn btn-outline" onclick={pasteButton}><ClipboardPaste size={48} strokeWidth={1.8} aria-hidden="true" focusable="false" /><span>Paste an image</span></button>
  {#if galleryURL}<button bind:this={galleryTrigger} type="button" class="btn btn-outline" onclick={()=>showBrowser=true}><Images size={48} strokeWidth={1.8} aria-hidden="true" focusable="false" /><span>Select an existing image</span></button>{/if}
 </div>
 </section>{/if}
 </div>
</div>

<style>
.image-editor { position:relative;container-type:inline-size; color:var(--ie-ui-text); background:var(--ie-color-base-100); min-width:0; border-radius:.5rem; font-family:Arial,sans-serif; }
.ie-page { height:calc(100cqi + 51.2rem);min-width:0;overflow:auto; }
.ie-blocked { filter:blur(4px);pointer-events:none;user-select:none; }
.ie-page > :global(section),.ie-page > .ie-loading-panel { min-height:100%; }
@container (min-width:480px) { .ie-page { height:calc(100cqi + 46.6rem); } }
@container (min-width:720px) { .ie-page { height:max(45.6rem,calc(100cqi - 21rem)); } }
.ie-status:empty { display:none; }
.ie-upload,.ie-loading-panel { display:grid;gap:1rem; }
.ie-upload { grid-template-rows:auto auto minmax(0,1fr);border-radius:.5rem; }
.ie-source-actions { display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:.75rem; }
.ie-source-actions button { display:flex;flex-direction:column;justify-content:center;align-items:center;gap:.75rem;width:100%;min-width:0;height:auto;padding:1.5rem .5rem;white-space:normal;overflow-wrap:anywhere;text-align:center; }
@container (max-width:479px) {
 .ie-source-actions { grid-auto-flow:row;grid-template-columns:minmax(0,1fr);align-content:start; }
 .ie-source-actions button { aspect-ratio:16/9; }
}
.ie-source-actions :global(svg) { flex-shrink:0; }
.image-editor button { min-height:44px; }
.image-editor h2 { font-size:1.25rem;font-weight:600; }
.image-editor :focus-visible { outline:3px solid var(--ie-ui-focus);outline-offset:3px; }
</style>
