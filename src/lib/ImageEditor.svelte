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
        saveCallback,
        validators = []
    } = $props();

    let editorBlob = $state(undefined)
    let showBrowser = $state(false)

    let fileInputElement = $state()
    let fileInputLabelElement = $state()

    function showBrowsePanel() {
        showBrowser = true
    }

    function imageSelected(imageURL) {
        console.log(imageURL)
        showBrowser = false

        fetch(imageURL).then((response) => {
            return response.blob()
        }).then((blob) => {
            loadImageBlob(blob)
        })
    }

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
    })

    onMount(() => {
        // prevent scrolling when using spacebar to trigger file upload dialog
        window.addEventListener("keydown", (e) => {
            if (e.key === " " && e.target === fileInputLabelElement) e.preventDefault()
        })
    })
</script>

<div class="image-editor">
    {#if editorBlob !== undefined}
        <Editor originalImageBlob={editorBlob} {validators} {saveCallback}/>
    {:else if showBrowser}
        <div class="k-flex h-100 k-flex-col k-p-4">
            <div class="k-navbar k-shadow-lg k-rounded-box k-mb-6">
                <button class="k-btn k-btn-square k-btn-ghost k-me-3"
                        aria-label="Close" onclick={() => showBrowser = false}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                         stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12l14 0"/>
                        <path d="M5 12l6 6"/>
                        <path d="M5 12l6 -6"/>
                    </svg>
                </button>
                <div class="k-flex-1 k-text-xl">Select an image</div>
            </div>

            <Gallery url={galleryURL} {imageSelected}/>
        </div>
    {:else}
        <div class="h-100 k-flex k-flex-col k-justify-between k-text-base-content k-p-4
                    k-bg-base-200 k-transition-colors"
             ondragover={handleDragOver} ondrop={handleDrop} role="form">

            <label class="k-flex-1 k-flex k-items-center k-justify-center k-gap-8
                          hover:k-bg-base-300 k-transition-colors k-cursor-pointer">
                <input bind:this={fileInputElement} type="file" accept="image/*" class="k-hidden"
                       onchange={handleInputChange}>
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/>
                    <path d="M7 9l5 -5l5 5"/>
                    <path d="M12 4l0 12"/>
                </svg>
                <span role="button" tabindex="0" bind:this={fileInputLabelElement}
                      onkeyup={(e) => { if (e.key === "Enter" || e.key === " ") fileInputElement.click() }}>
                        Upload an image by clicking here,<br>
                        or by dragging and dropping
                    </span>
            </label>

            <div class="k-flex-1 k-flex k-items-center k-justify-center k-gap-8
                        hover:k-bg-base-300 k-transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"/>
                    <path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"/>
                </svg>
                <span>Paste an image (ctrl/⌘ + v)</span>
            </div>

            {#if galleryURL !== undefined}
                <button class="k-flex-1 k-flex k-items-center k-justify-center k-gap-8
                            hover:k-bg-base-300 k-transition-colors"
                        aria-label="Select an existing image" onclick={showBrowsePanel}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6.657 18c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878"/>
                    </svg>
                    <span>Select an existing image</span>
                </button>
            {/if}

        </div>
    {/if}
</div>

<style>
    .image-editor {
        aspect-ratio: 5 / 4;
    }
</style>