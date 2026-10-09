<script lang="ts">
import { onDestroy, tick } from 'svelte';
import ArrowLeft from '@lucide/svelte/icons/arrow-left';
import Upload from '@lucide/svelte/icons/upload';
import Pencil from '@lucide/svelte/icons/pencil';
import { errorMessage, fetchImage, resolveLimits } from '../utils';
import type { ErrorNotice } from '../types';
interface GalleryImage {
    url: string;
    thumbnail: string;
    id: string;
}
interface GallerySection {
    title: string;
    images: GalleryImage[];
}
interface Props {
    url: string;
    passthroughOriginal?: boolean;
    imageSelected: (url: string, copy: boolean) => Promise<void>;
    cancel: () => void;
    onerror?: (notice: ErrorNotice | undefined) => void;
}
let { url, passthroughOriginal = true, imageSelected, cancel, onerror }: Props = $props();
const id = $props.id();
let sections = $state<GallerySection[]>([]);
let selected = $state<GalleryImage>();
let busy = $state(false);
let error = $state('');
let controller: AbortController | undefined;
let heading: HTMLHeadingElement;
let generation = 0;
function safeURL(value: unknown): string {
    if (typeof value !== 'string')
        throw new Error('An image URL is missing.');
    const result = new URL(value, location.href);
    if (!['http:', 'https:'].includes(result.protocol))
        throw new Error('Unsupported gallery URL.');
    return result.href;
}
async function load() {
    const token = ++generation;
    controller?.abort();
    controller = new AbortController();
    busy = true;
    error = '';
    selected = undefined;
    try {
        const response = await fetchImage(safeURL(url), resolveLimits({ maxInputBytes: 2 * 1024 * 1024 }), controller.signal);
        const text = await response.text();
        const body: unknown = JSON.parse(text);
        if (!body || typeof body !== 'object' || !('visits' in body) || !Array.isArray(body.visits))
            throw new Error('The gallery response is invalid.');
        const result = body.visits.map((entry: unknown) => {
            if (!entry || typeof entry !== 'object' || !('images' in entry) || !Array.isArray(entry.images))
                throw new Error('A gallery section is invalid.');
            return { title: 'title' in entry ? String(entry.title) : 'Images', images: entry.images.map((image: unknown) => {
                    if (!image || typeof image !== 'object' || !('url' in image) || !('thumbnail' in image))
                        throw new Error('An image entry is incomplete.');
                    return { url: safeURL(image.url), thumbnail: safeURL(image.thumbnail), id: 'id' in image ? String(image.id) : 'Image' };
                }) };
        });
        if (token === generation)
            sections = result;
    }
    catch (e) {
        if (token === generation && !(e instanceof DOMException && e.name === 'AbortError'))
            error = errorMessage(e);
    }
    finally {
        if (token === generation)
            busy = false;
    }
}
$effect(() => {
    void url;
    void load();
});
$effect(() => {
    void tick().then(() => heading?.focus());
});
$effect(() => {
    onerror?.(error ? { message:error, retryLabel:'Retry gallery', onretry:()=>void load(), ondismiss:()=>{error='';void tick().then(()=>heading?.focus());} } : undefined);
});
onDestroy(() => {
    generation++;
    controller?.abort();
    onerror?.(undefined);
});
</script>
<section aria-busy={busy} class="ie-gallery"><h2 bind:this={heading} tabindex="-1">Select an image</h2>
 <!-- Keyboard users can focus this region to scroll the visit list. -->
 <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
 <div class="ie-gallery-visits" tabindex="0" role="region" aria-label="Image visits">
 {#if busy}<p role="status">Loading images…</p>{:else if !error}
 {#each sections as section}<fieldset><legend>{section.title}</legend><div class="ie-thumbnails">{#each section.images as image,i}<label class="ie-thumbnail" class:ie-thumbnail-selected={selected === image}><input type="radio" class="ie-thumbnail-radio" name={`image-${id}`} value={image} bind:group={selected}/><img src={image.thumbnail} alt={`Image ${image.id||i+1}`} loading="lazy" width="150" height="120"/></label>{/each}</div></fieldset>{:else}<p>No images are available.</p>{/each}
 {/if}
 </div>
 <div class="ie-actions">
  <button type="button" class="btn btn-outline" onclick={cancel}><ArrowLeft size={20} aria-hidden="true" focusable="false" /><span>Back to upload</span></button>
  <div class="ie-upload-actions">
   {#if passthroughOriginal}<button type="button" class="btn btn-outline" disabled={busy || !!error || !selected} onclick={()=>selected&&imageSelected(selected.url,true)}><Upload size={20} aria-hidden="true" focusable="false" /><span>Upload original</span></button>{/if}
   <button type="button" class="btn btn-primary" disabled={busy || !!error || !selected} onclick={()=>selected&&imageSelected(selected.url,false)}><Pencil size={20} aria-hidden="true" focusable="false" /><span>Edit before upload</span></button>
  </div>
 </div>
</section>

<style>
.ie-gallery { display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:1rem;min-width:0;height:100%;overflow:hidden;border-radius:.5rem; }
.ie-gallery-visits { display:grid;align-content:start;gap:1rem;min-height:0;height:100%;overflow-y:auto;overscroll-behavior:contain;padding:.25rem;scrollbar-gutter:stable; }
.ie-gallery h2 { font-size:1.25rem;font-weight:600; }
.ie-gallery fieldset { min-width:0;padding:.75rem;border:1px solid var(--ie-ui-border);border-radius:.375rem; }
.ie-gallery legend { font-weight:600;padding:0 .25rem; }
.ie-thumbnails { display:flex;flex-wrap:wrap;gap:1rem; }
.ie-thumbnail { position:relative;display:flex;align-items:center;padding:.5rem;cursor:pointer;border-radius:.375rem; }
.ie-thumbnail-selected { outline:3px solid var(--ie-ui-focus);outline-offset:0; }
.ie-thumbnail:focus-within { outline:3px solid var(--ie-ui-focus);outline-offset:3px; }
.ie-thumbnail-radio { position:absolute;opacity:0;inset:0;width:100%;height:100%;margin:0;cursor:pointer; }
.ie-thumbnail-radio:focus-visible { outline:none; }
.ie-thumbnail img { max-width:100%;object-fit:contain; }
.ie-actions { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem; }
.ie-upload-actions { display:contents; }
.ie-actions button { display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-width:0;height:auto;white-space:normal; }
@container (max-width:479px) { .ie-actions button { flex-direction:column;padding:.5rem; } }
.ie-actions :global(svg) { flex-shrink:0; }
.ie-gallery button { min-height:44px; }
.ie-gallery :focus-visible { outline:3px solid var(--ie-ui-focus);outline-offset:3px; }
</style>
