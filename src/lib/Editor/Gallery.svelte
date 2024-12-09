<script lang="ts">
    let {url, imageSelected} = $props();

    let caseImages = $state(fetch(url).then(async (response) => {
        return response.json()
    }))
</script>

{#if caseImages}
    {#await caseImages}
        <div class="k-flex k-flex-col k-items-center k-gap-6 k-mt-12">
            <span class="k-text-xl">Loading images</span>
            <span class="k-loading k-loading-spinner k-loading-lg"></span>
        </div>
    {:then result}
        <div class="k-overflow-y-scroll k-flex k-flex-col k-gap-4 k-p-2">
            {#each result.visits as section}
                <div>
                    <div class="k-text-lg k-mb-2">{section.title}</div>
                    <div class="k-flex k-flex-wrap k-gap-2">
                        {#each section.images as image}
                            <button class="k-border-2"
                                    onclick={() => imageSelected(image.url)}>
                                <img class="thumbnail" src={image.thumbnail} alt={image.id}>
                            </button>
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
        height: 100px;
    }
</style>