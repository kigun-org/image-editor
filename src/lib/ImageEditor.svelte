<script lang="ts">
    import "./tailwind.css";

    import Editor from "./Editor/Editor.svelte";
    import Gallery from "./Editor/Gallery.svelte";
    import {onMount} from "svelte";
    import {resizeBlob} from "./utils";

    const MAX_IMAGE_DIMENSION = 8192

    let {
        imageBlob = undefined,
        galleryURL = undefined,
        passthroughOriginal = true,
        saveCallback,
        validators = []
    } = $props();

    let editorBlob = $state(undefined)
    let showBrowser = $state(false)

    let fileInputElement = $state()
    let fileInputLabelElement = $state()

    function handleDragOver(event) {
        event.preventDefault()
    }

    function handleDrop(ev) {
        ev.preventDefault()

        if (ev.dataTransfer.items) {
            // Use DataTransferItemList interface to access the file(s)
            [...ev.dataTransfer.items].forEach((item) => {
                // If dropped items aren't files, reject them
                if (item.kind === "file") {
                    loadImageBlob(item.getAsFile())
                }
            })
        } else {
            // Use DataTransfer interface to access the file(s)
            [...ev.dataTransfer.files].forEach((file) => {
                loadImageBlob(file)
            })
        }
    }

    function handleInputChange(ev) {
        loadImageBlob(ev.target.files[0])
    }

    function imageSelected(imageURL, passthrough) {
        fetch(imageURL).then((response) => {
            return response.blob()
        }).then((blob) => {
            if (passthrough) {
                saveCallback(blob).then(() => {
                    showBrowser = false
                })
            } else {
                loadImageBlob(blob).then(() => {
                    showBrowser = false
                })
            }
        })
    }

    async function loadImageBlob(blob) {
        editorBlob = await resizeBlob(blob, MAX_IMAGE_DIMENSION)
    }

    onMount(() => {
        if (imageBlob !== undefined) {
            // if an imageBlob is provided, load that
            loadImageBlob(imageBlob)
        } else {
            // otherwise, add a paste event listener
            document.addEventListener('paste', async (e) => {
                e.preventDefault()
                const clipboardItems = typeof navigator?.clipboard?.read === 'function' ?
                    await navigator.clipboard.read() : e.clipboardData.files;

                for (const clipboardItem of clipboardItems) {
                    const type = clipboardItem.types.find(t => t.startsWith('image/'))
                    if (type !== undefined) {
                        loadImageBlob(await clipboardItem.getType(type))
                    }
                }
            })
        }

        // prevent scrolling when using spacebar to trigger file upload dialog
        window.addEventListener("keydown", (e) => {
            if (e.key === " " && e.target === fileInputLabelElement) e.preventDefault()
        })
    })
</script>

<div class="image-editor">
    {#if editorBlob !== undefined}
        <div style="aspect-ratio: 5 / 4">
            <Editor originalImageBlob={editorBlob} {validators} {saveCallback}/>
        </div>
    {:else if showBrowser}
        <Gallery url={galleryURL} cancel={() => showBrowser = false}
                 {imageSelected} {passthroughOriginal} />
    {:else}
        <div class="k-flex k-flex-col k-justify-between k-text-base-content
                    k-bg-base-200 k-transition-colors"
             ondragover={handleDragOver} ondrop={handleDrop} role="form">

            <label class="k-flex-1 k-flex k-items-center k-justify-center k-gap-6
                          hover:k-bg-base-300 k-transition-colors k-cursor-pointer k-px-4 k-py-16">
                <input bind:this={fileInputElement} type="file" accept="image/*" class="k-hidden"
                       onchange={handleInputChange}>
                <svg class="k-flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/>
                    <path d="M7 9l5 -5l5 5"/>
                    <path d="M12 4l0 12"/>
                </svg>
                <span role="button" tabindex="0" class="k-text-lg" bind:this={fileInputLabelElement}
                      onkeyup={(e) => { if (e.key === "Enter" || e.key === " ") fileInputElement.click() }}>
                        Upload an image by clicking here, or by dragging and dropping
                    </span>
            </label>

            <div class="k-flex-1 k-flex k-items-center k-justify-center k-gap-6
                        hover:k-bg-base-300 k-transition-colors k-px-4 k-py-16">
                <svg class="k-flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"/>
                    <path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"/>
                </svg>
                <span class="k-text-lg">Paste an image (ctrl/⌘ + v)</span>
            </div>

            {#if galleryURL !== undefined}
                <button class="k-flex-1 k-flex k-items-center k-justify-center k-gap-6
                            hover:k-bg-base-300 k-transition-colors k-px-4 k-py-16"
                        aria-label="Select an existing image" onclick={() => showBrowser = true}>
                    <svg class="k-flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6.657 18c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878"/>
                    </svg>
                    <span class="k-text-lg">Select an existing image</span>
                </button>
            {/if}

        </div>
    {/if}
</div>

<style>
    .image-editor {
    }
</style>