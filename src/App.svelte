<script>
    import 'bootstrap-icons/font/bootstrap-icons.css'
    import 'bootstrap/dist/css/bootstrap.css'

    import ImageUpload from "./lib/ImageUpload.svelte";

    let imageUploadDialog
    let imageUploadComponent
    let imageUploaded = false

    function handleUploadComplete() {
        imageUploadDialog.close()
        imageUploadComponent.$destroy() // free some memory
        imageUploaded = true
    }
</script>

<main>
    <div class="row mb-5">
        <h1 class="mb-4">Image Editor demo</h1>

        <div class="d-flex align-items-center justify-content-center gap-2">
            {#if imageUploaded}
                <div class="bg-success-subtle d-flex align-items-center px-3">
                    <i class="bi bi-check-lg text-success fs-3 me-2"></i>
                    <span>Uploaded</span>
                </div>
            {:else}
                <button on:click={() => imageUploadDialog.showModal()}>click me</button>
            {/if}
        </div>
    </div>
</main>

<dialog bind:this={imageUploadDialog}>
    <div style="min-width: 60rem">
        <ImageUpload bind:this={imageUploadComponent}
                     galleryURL="/1/images"
                     upload={ {url:"/1/images", params: {a:"b"}} }
                     on:uploadComplete={handleUploadComplete}/>
    </div>
</dialog>