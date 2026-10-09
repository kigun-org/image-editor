<script lang="ts">
    import { onMount } from 'svelte';
    import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
    import RotateCw from '@lucide/svelte/icons/rotate-cw';
    import X from '@lucide/svelte/icons/x';
    import type { ErrorNotice } from '../types';
    let { notice }: { notice: ErrorNotice } = $props();
    let banner: HTMLDivElement;
    onMount(() => { banner.scrollIntoView({ block:'nearest' }); });
</script>

<div bind:this={banner} class="alert alert-error ie-error-banner ie-error" role="alert">
    <TriangleAlert size={24} aria-hidden="true" focusable="false" />
    <p id={notice.id}>{notice.message}</p>
    <div class="ie-error-actions">
        {#if notice.onretry}<button type="button" class="btn btn-primary" disabled={notice.disabled} onclick={notice.onretry}><RotateCw size={20} aria-hidden="true" focusable="false" /><span>{notice.retryLabel ?? 'Retry'}</span></button>{/if}
        {#if notice.ondismiss}<button type="button" class="btn btn-outline" onclick={notice.ondismiss}><X size={20} aria-hidden="true" focusable="false" /><span>{notice.dismissLabel ?? 'Dismiss'}</span></button>{/if}
    </div>
</div>

<style>
    .ie-error-banner { position:absolute;inset:0 0 auto;width:100%;min-width:0;z-index:20;display:flex;flex-wrap:wrap;align-items:center;gap:.75rem;max-height:100%;overflow:auto;box-shadow:0 4px 16px #0003; }
    .ie-error-banner :global(svg) { flex-shrink:0; }
    p { flex:1 1 14rem;min-width:0;margin:0;overflow-wrap:anywhere; }
    .ie-error-actions { display:flex;flex-wrap:wrap;gap:.5rem;min-width:0;max-width:100%; }
    button { display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:44px;max-width:100%;height:auto;white-space:normal; }
</style>
