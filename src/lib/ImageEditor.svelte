<script lang="ts">
    import "./tailwind.css";

    import Editor from "./Editor/Editor.svelte";
    import Gallery from "./Editor/Gallery.svelte";
    import {onMount} from "svelte";
    import {resizeBlob} from "./utils";

    const MAX_IMAGE_DIMENSION = 8192


    let editorBlob = $state(undefined)

    let showBrowser = $state(false)

    let {
        imageBlob = undefined,
        galleryURL,
        saveCallback,
        validators = []
    } = $props();

    function showBrowsePanel() {
        showBrowser = true
    }

    function imageSelected(event) {
        showBrowser = false

        fetch(event.detail.url).then((response) => {
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
</script>

<div class="upload-container" ondragover={handleDragOver} ondrop={handleDrop} role="form">
    {#if editorBlob !== undefined}
        <Editor originalImageBlob={editorBlob} {validators} {saveCallback}/>
    {:else if showBrowser}
        <div class="browse text-start p-2 d-flex flex-column">
            <div class="d-flex align-items-center justify-content-between my-2">
                <div>
                    Select an image
                </div>
                <button class="btn btn-close" aria-label="Close" onclick={() => showBrowser = false}></button>
            </div>

            <Gallery url={galleryURL} on:select={imageSelected}/>
        </div>
    {:else}
        <div class="instructions">
            <form enctype="multipart/form-data" class="upload">
                <label>
                    <input type="file" accept="image/*"
                           onchange={handleInputChange}>
                    <i class="bi bi-upload fs-1"></i>
                    <span>
                        Upload an image by clicking here,<br>
                        or by dragging and dropping
                    </span>
                </label>
            </form>

            <div>
                <i class="bi bi-clipboard2 fs-1"></i>
                <span>Paste an image (ctrl/⌘ + v)</span>
            </div>

            {#if galleryURL !== undefined}
                <div onclick={showBrowsePanel}>
                    <i class="bi bi-cloud fs-1"></i>
                    <span>Select an existing image</span>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .upload-container {
        position: relative;
        width: 100%;
    }

    .upload-container .instructions, .upload-container .browse {
        aspect-ratio: 3 / 2;
        border: 5px dotted rgba(var(--bs-secondary-rgb), 0.15);
    }

    .upload-container .instructions {
        display: flex;
        flex-direction: column;
        align-items: stretch;

        color: rgba(var(--bs-secondary-rgb), 0.7);
        background-color: rgba(var(--bs-secondary-rgb), 0.1);

        transition: 250ms ease;
    }

    .upload-container .instructions:hover {
        border-color: rgba(var(--bs-primary-rgb), 0.2);
        background-color: rgba(var(--bs-primary-rgb), 0.1);
    }

    .upload-container .instructions div, .upload-container .instructions label, .upload {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2.5rem;

        width: 100%;
        flex-grow: 1;

        transition: 250ms ease;
    }

    .upload {
        display: flex;
        flex-direction: column;
    }

    .upload-container .instructions > div:hover, .upload-container .instructions label:hover {
        color: var(--bs-primary-text-emphasis);
        background-color: rgba(var(--bs-primary-rgb), 0.05);
    }

    .upload-container .browse {
        overflow-y: auto;
    }

    .upload label > input {
        display: none;
    }
</style>