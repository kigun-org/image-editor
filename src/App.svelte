<script lang="ts">
    import 'bootstrap-icons/font/bootstrap-icons.css'
    import 'bootstrap/dist/css/bootstrap.css'
    
    import ImageEditor from "./lib/ImageEditor.svelte";
    
    let imageSources = $state([])
    
    function downloadCallback(blob) {
        return new Promise(async (resolve) => {
            await new Promise(r => setTimeout(r, 500))
            imageSources = [...imageSources, URL.createObjectURL(blob)]
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
        <ImageEditor galleryURL="/gallery.json" saveCallback={downloadCallback} {validators}/>
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
