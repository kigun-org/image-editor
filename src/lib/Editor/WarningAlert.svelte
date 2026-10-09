<script lang="ts">
    import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
    import X from '@lucide/svelte/icons/x';
    let { message, ondismiss }: { message: string; ondismiss?: () => void } = $props();
</script>

<div class="alert alert-warning ie-warning">
    <TriangleAlert size={20} class="shrink-0" aria-hidden="true" />
    <span role="status">{message}</span>
    {#if ondismiss}<button class="ie-dismiss-warning" type="button" aria-label={`Dismiss warning: ${message}`} onclick={ondismiss}><X size={20} aria-hidden="true" /></button>{/if}
</div>

<style>
    .ie-warning { --ie-ui-focus: #075985; display: flex; align-items: center; gap: .5rem; overflow-wrap: anywhere; }
    .ie-warning > span { flex: 1; min-width: 0; }
    .ie-dismiss-warning { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 44px; width: 44px; height: 44px; padding: 0; border: 1px solid currentColor; border-radius: .25rem; background: transparent; color: inherit; cursor: pointer; }
    .ie-dismiss-warning:focus-visible { outline: 3px solid var(--ie-ui-focus); outline-offset: 3px; }
    @media (forced-colors: active) { .ie-dismiss-warning:focus-visible { outline-color: Highlight; } }
</style>
