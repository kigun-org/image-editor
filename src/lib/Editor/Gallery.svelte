<script lang="ts">
    let {
        url,
        passthroughOriginal = true,
        imageSelected,
        cancel
    } = $props();

    let selectedImage = $state()

    let caseImages = fetch(url).then(async (response) => {
        return response.json()
    })

    function selectImage() {
        imageSelected(selectedImage.url, false)
    }

    function passthroughImage() {
        imageSelected(selectedImage.url, true)
    }
</script>

{#if caseImages}
    <div class="k-flex k-flex-wrap k-justify-between k-gap-2 k-shadow-lg k-rounded-box k-p-2 k-mb-6">
        <div class="k-flex k-gap-2 k-items-center">
            <button class="k-btn k-btn-square k-btn-ghost"
                    aria-label="Close" onclick={cancel}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                     stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12l14 0"/>
                    <path d="M5 12l6 6"/>
                    <path d="M5 12l6 -6"/>
                </svg>
            </button>
            <div class="k-text-xl">Select an image</div>
        </div>
        <div class="k-flex k-gap-2">
            <button class="k-btn k-btn-primary" disabled={!selectedImage} onclick={selectImage}>
                Edit before upload
            </button>
            {#if passthroughOriginal}
                <button class="k-btn" disabled={!selectedImage} onclick={passthroughImage}>
                    Copy original
                </button>
            {/if}
        </div>
    </div>

    {#await caseImages}
        <div class="k-flex k-flex-col k-items-center k-gap-6 k-mt-12">
            <span class="k-text-xl">Loading images</span>
            <span class="k-loading k-loading-spinner k-loading-lg"></span>
        </div>
    {:then result}
        <div class="k-overflow-y-scroll">
            {#each result.visits as section}
                <div>
                    <div class="k-text-lg k-mb-2">{section.title}</div>
                    <div class="k-flex k-flex-wrap k-gap-1.5 k-shadow k-bg-base-200 k-p-2 k-m-2">
                        {#each section.images as image, index}
                            <label class="k-relative k-shrink-0">
                                <img class="thumbnail" src={image.thumbnail} alt={image.id}>
                                <span class="k-absolute k-top-3 k-left-3">
                                    <input type="radio" class="k-radio k-radio-primary"
                                           class:k-bg-base-100={selectedImage !== image}
                                           name="selected" value={image} bind:group={selectedImage} />
                                </span>
                            </label>
                        {/each}
                    </div>
                </div>
            {:else}
                <div>No images</div>
            {/each}
        </div>
    {:catch ex}
        <div class="k-flex k-justify-center">
            <div class="k-flex-shrink-1">
                <div class="k-alert k-alert-error k-mt-6 k-mx-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                         stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 9v4"/>
                        <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"/>
                        <path d="M12 16h.01"/>
                    </svg>
                    <span>Error loading images</span>
                </div>
            </div>
        </div>
    {/await}
{/if}

<style>
    img.thumbnail {
        height: 150px;
    }
</style>