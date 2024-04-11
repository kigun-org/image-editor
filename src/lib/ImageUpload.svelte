<svelte:options customElement={{tag: "image-upload", shadow: 'none'}}/>
<script>
    import ImageEditor from "./ImageEditor.svelte";
    import SelectImage from "./SelectImage.svelte";
    import {createEventDispatcher, onMount} from "svelte";

    const dispatch = createEventDispatcher()

    export let imageBlob = undefined
    export let galleryURL
    export let upload

    let showBrowser = false

    let validators = [
        {
            message: "Low resolution image. Upload the original high resolution image.",
            test: (image) => Math.min(image.width, image.height) < 500
        },
        {
            message: "Image contains text. Use the draw tool to remove any patient personal details.",
            test: () => false
        }
    ]

    function showBrowsePanel() {
        showBrowser = true
    }

    function imageSelected(event) {
        showBrowser = false

        fetch(event.detail.url).then((response) => {
            return response.blob()
        }).then((blob) => {
            imageBlob = blob
        })
    }

    function handleDragOver(event) {
        event.preventDefault()
    }

    function handleDrop(ev) {
        ev.preventDefault()

        if (ev.dataTransfer.items) {
            // Use DataTransferItemList interface to access the file(s)
            [...ev.dataTransfer.items].forEach((item, i) => {
                // If dropped items aren't files, reject them
                if (item.kind === "file") {
                    imageBlob = item.getAsFile()
                }
            })
        } else {
            // Use DataTransfer interface to access the file(s)
            [...ev.dataTransfer.files].forEach((file, i) => {
                imageBlob = file
            })
        }
    }

    function handleInputChange(ev) {
        imageBlob = ev.target.files[0]
    }

    function saveCallback(blob) {
        return new Promise((resolve, reject) => {
            const formData = new FormData()

            if (upload.params !== undefined) {
                for (const param in upload.params) {
                    formData.append(param, upload.params[param])
                }
            }

            const today = new Date().toISOString().slice(0, 10).replaceAll('-', '')
            formData.append('uploaded_file', blob, `${today}.png`)

            const req = new XMLHttpRequest()
            req.open("POST", upload.url)

            req.onreadystatechange = () => {
                if (req.readyState === XMLHttpRequest.DONE) {
                    if (req.status === 200) {
                        resolve("success")
                        dispatch('uploadComplete', null)
                    } else {
                        // uploadError = true
                        // uploadMessage = `Error: ${req.status} ${req.statusText}`
                        reject("error")
                        dispatch('uploadError', null)
                    }
                }
            }

            // req.onabort = (event) => {
            //     console.log("Upload aborted.", event)
            //     uploading = false
            //     uploadMessage = "Upload aborted."
            // }

            req.onerror = (event) => {
                // uploadError = true
                // if (event.target.statusText === '') {
                //     uploadMessage = `Error uploading file.`
                // } else {
                //     uploadMessage = `Error: ${req.status} ${event.target.statusText}`
                // }
                dispatch('uploadError', null)
            }

            req.send(formData)
        })
    }

    onMount(() => {
        document.addEventListener('paste', async (e) => {
            e.preventDefault()
            const clipboardItems = typeof navigator?.clipboard?.read === 'function' ?
                await navigator.clipboard.read() : e.clipboardData.files;

            for (const clipboardItem of clipboardItems) {
                if (clipboardItem.type.startsWith('image/')) {
                    imageBlob = clipboardItem
                }
            }
        })
    })
</script>

<div class="upload-container" on:dragover={handleDragOver} on:drop={handleDrop} role="form">
    {#if imageBlob !== undefined}
        <ImageEditor originalImageBlob={imageBlob} {validators} saveCallback={saveCallback} />
    {:else if showBrowser}
        <div class="browse text-start p-2 d-flex flex-column">
            <div class="d-flex align-items-center justify-content-between my-2">
                <div>
                    Select an image
                </div>
                <button class="btn btn-close" on:click={() => showBrowser = false}></button>
            </div>

            <SelectImage url={galleryURL} on:select={imageSelected}/>
        </div>
    {:else}
        <div class="instructions">
            <form enctype="multipart/form-data" class="upload">
                <label>
                    <input type="file" accept="image/*"
                           on:change={handleInputChange}>
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
                <div on:click={showBrowsePanel}>
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