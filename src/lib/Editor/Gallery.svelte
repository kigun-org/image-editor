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
    <div class="ie-flex ie-flex-wrap ie-justify-between ie-gap-2 ie-shadow-lg ie-rounded-box ie-p-2 ie-mb-6">
        <div class="ie-flex ie-gap-2 ie-items-center">
            <button class="ie-btn ie-btn-square ie-btn-ghost"
                    aria-label="Close" onclick={cancel}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                     stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12l14 0"/>
                    <path d="M5 12l6 6"/>
                    <path d="M5 12l6 -6"/>
                </svg>
            </button>
            <div class="ie-text-xl">Select an image</div>
        </div>
        <div class="ie-flex ie-gap-2">
            <button class="ie-btn ie-btn-primary" disabled={!selectedImage} onclick={selectImage}>
                Edit before upload
            </button>
            {#if passthroughOriginal}
                <button class="ie-btn" disabled={!selectedImage} onclick={passthroughImage}>
                    Copy original
                </button>
            {/if}
        </div>
    </div>

    {#await caseImages}
        <div class="ie-flex ie-flex-col ie-items-center ie-gap-6 ie-mt-12">
            <span class="ie-text-xl">Loading images</span>
            <span class="ie-loading ie-loading-spinner ie-loading-lg"></span>
        </div>
    {:then result}
        <div class="ie-p-2">
            {#each result.visits as section}
                <div>
                    <div class="ie-text-lg ie-mb-2">{section.title}</div>
                    <div class="ie-flex ie-gap-1.5 ie-overflow-x-scroll lg:ie-flex-wrap lg:ie-overflow-x-auto ie-shadow ie-bg-base-200 ie-p-2 ie-my-2">
                        {#each section.images as image}
                            <label class="ie-relative ie-shrink-0">
                                <img class="thumbnail" src={image.thumbnail} alt={image.id}>
                                <span class="ie-absolute ie-top-3 ie-left-3">
                                    <input type="radio" class="ie-radio ie-radio-primary"
                                           class:ie-bg-base-100={selectedImage !== image}
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
        <div class="ie-flex ie-justify-center">
            <div class="ie-flex-shrink-1">
                <div class="ie-alert ie-alert-error ie-mt-6 ie-mx-auto">
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