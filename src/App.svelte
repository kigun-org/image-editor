<script lang="ts">
    import 'fslightbox'

    import ImageEditor from "./lib/ImageEditor.svelte";

    let imageSources = $state([])
    
    function saveCallback(blob) {
        return new Promise((resolve) => {
            imageSources.push(URL.createObjectURL(blob))
            setTimeout(() => refreshFsLightbox(), 200)
            resolve()
        })
    }

    const validators = [
        {
            message: "Low resolution image. Upload the original high resolution image.",
            test: (image) => Math.min(image.width, image.height) < 500
        },
        {
            message: "Image contains text. Use the draw tool to remove any patient personal details.",
            test: () => false
        }
    ]
</script>

<div class="d-flex justify-center">
    <div class="mx-auto flex-grow-1" style="max-width: 1100px">
        <ImageEditor galleryURL="/gallery.json" {saveCallback} {validators}/>
    </div>
</div>

{#if imageSources.length > 0}
    <div class="my-3">Images</div>
    <div class="screenshots d-flex flex-wrap gap-2">
        {#each imageSources as src}
            <a href={src} data-fslightbox>
                <img src={src} alt="Screenshot" />
            </a>
        {/each}
    </div>
{/if}

<style>
    .screenshots img {
        height: 100px;
    }
</style>
