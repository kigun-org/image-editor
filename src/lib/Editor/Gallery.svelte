<script lang="ts">
    import {createEventDispatcher} from "svelte";

    const dispatch = createEventDispatcher()

    let { url } = $props();

    let caseImages = $state()

    function selectImage(image) {
        dispatch("select", image)
    }

    fetch(url).then((response) => {
        caseImages = response.json()
    })
</script>

{#if caseImages}
    {#await caseImages}
        <div class="d-flex flex-column align-items-center justify-content-center gap-4 h-100 text-secondary">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div>
                Loading images
            </div>
        </div>
    {:then result}
        <div class="overflow-y-scroll d-flex flex-column gap-2">
            {#each result.visits as section}
                <div>
                    <div class="fs-5">{section.title}</div>
                    <div class="d-flex flex-wrap gap-1">
                        {#each section.images as image}
                            <div class="thumb_image" onclick={() => selectImage(image)}>
                                <img src={image.thumbnail} alt={image.id}>
                            </div>
                        {/each}
                    </div>
                </div>
            {:else}
                <div>No images</div>
            {/each}
        </div>
    {:catch ex}
        <div class="d-flex flex-column align-items-center justify-content-center gap-4 h-100 bg-danger-subtle text-danger">
            <i class="bi bi-exclamation-triangle fs-1"></i>
            <div class="text-center">
                Error loading images<br>
            </div>
        </div>
    {/await}
{/if}

<style>
    .thumb_image img {
        height: 100px;
    }
</style>