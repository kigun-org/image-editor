<script>
    import 'bootstrap-icons/font/bootstrap-icons.css'
    import 'bootstrap/dist/css/bootstrap.css'

    import ImageEditor from "./lib/ImageEditor.svelte";

    let imageSources = []

    function downloadCallback(blob) {
        return new Promise((resolve) => {
            imageSources = [...imageSources, URL.createObjectURL(blob)]
            resolve()
        })
    }
</script>

<div class="d-flex justify-center">
    <div class="mx-auto flex-grow-1" style="max-width: 1100px">
        <ImageEditor galleryURL="/gallery.json" saveCallback={downloadCallback}/>
    </div>
</div>

{#if imageSources.length > 0}
    <div class="my-3">Images</div>
    <div class="screenshots d-flex flex-wrap gap-2">
        {#each imageSources as src}
            <img src={src} alt="Screenshot"/>
        {/each}
    </div>
{/if}

<style>
    .screenshots img {
        height: 100px;
    }
</style>