<script lang="ts">
    import { untrack } from 'svelte';
    import type { LucideIcon } from '@lucide/svelte';

    interface Props {
        label: string;
        icon: LucideIcon;
        disabled?: boolean;
        pressed?: boolean;
        danger?: boolean;
        filled?: boolean;
        onclick: () => void;
    }
    let { label, icon: Icon, disabled = false, pressed, danger = false, filled = false, onclick }: Props = $props();
    const id = $props.id();
    const labelWords = $derived([label.split(' ')[0], label.slice(label.indexOf(' ') + 1)]);
    let wrapper: HTMLSpanElement;
    let tooltip: HTMLSpanElement;
    let hovered = $state(false);
    let focused = $state(false);
    let dismissed = $state(false);
    let left = $state(0);
    let above = $state(false);
    const visible = $derived((hovered || focused) && !dismissed);

    function track(node: HTMLSpanElement) {
        const enter = (event: PointerEvent) => {
            if (event.pointerType === 'touch') return;
            hovered = true;
            dismissed = false;
        };
        const leave = () => { hovered = false; };
        const focus = () => { focused = true; dismissed = false; };
        // Removing a focused annotation button can dispatch blur during a Svelte update.
        const blur = () => { untrack(() => { focused = false; }); };
        node.addEventListener('pointerenter', enter);
        node.addEventListener('pointerleave', leave);
        node.addEventListener('focusin', focus);
        node.addEventListener('focusout', blur);
        return { destroy() {
            node.removeEventListener('pointerenter', enter);
            node.removeEventListener('pointerleave', leave);
            node.removeEventListener('focusin', focus);
            node.removeEventListener('focusout', blur);
        } };
    }

    $effect(() => {
        if (!visible) return;
        const update = () => {
            const bounds = wrapper.getBoundingClientRect();
            const width = tooltip.getBoundingClientRect().width;
            left = Math.max(8 - bounds.left, Math.min((bounds.width - width) / 2, window.innerWidth - 8 - bounds.left - width));
            above = bounds.bottom + tooltip.offsetHeight > window.innerHeight - 8;
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            dismissed = true;
            event.preventDefault();
            // Dismissing help must not also leave the active drawing mode.
            event.stopPropagation();
        };
        update();
        // Hover help must also close when keyboard focus is outside the shadow root.
        document.addEventListener('keydown', escape, true);
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            document.removeEventListener('keydown', escape, true);
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    });
</script>

<span class="ie-icon-action" class:ie-tooltip-open={visible} bind:this={wrapper} use:track>
    <button type="button" class="btn ie-icon-button" class:btn-outline={!danger} class:btn-error={danger}
        {disabled} aria-label={label} aria-pressed={pressed} aria-describedby={visible ? id : undefined}
        onclick={() => { dismissed = true; onclick(); }}>
        <Icon size={22} strokeWidth={1.8} fill={filled ? 'currentColor' : 'none'} aria-hidden="true" focusable="false" />
        <span class="ie-touch-label" aria-hidden="true"><span>{labelWords[0]}</span><span>{labelWords[1]}</span></span>
    </button>
    <span bind:this={tooltip} id={id} class="ie-tooltip" class:ie-tooltip-above={above}
        role="tooltip" style:left={`${left}px`} style:display={visible ? undefined : 'none'}>
        <span>{label}</span>
    </span>
</span>

<style>
    .ie-icon-action { position: relative; display: inline-flex; flex: 0 0 auto; min-width: 44px; }
    .ie-tooltip-open { z-index: 10; }
    .ie-icon-button { display: inline-flex; align-items: center; justify-content: center; width: 44px; min-width: 44px; height: 44px; min-height: 44px; padding: .625rem; }
    .ie-icon-button[aria-pressed='true'] { color: var(--ie-color-primary-content); background: var(--ie-color-primary); border-color: var(--ie-color-primary); box-shadow: inset 0 0 0 2px var(--ie-color-primary-content); }
    .ie-icon-button :global(svg) { flex-shrink: 0; }
    .ie-icon-button:focus-visible { outline: 3px solid var(--ie-ui-focus); outline-offset: 3px; }
    .ie-touch-label { display: none; }
    .ie-touch-label > span { display: block; white-space: nowrap; }
    .ie-tooltip { position: absolute; top: 100%; padding-top: 6px; width: max-content; max-width: min(16rem, calc(100vw - 2rem)); white-space: normal; font: 400 .875rem/1.4 Arial, sans-serif; text-align: center; }
    .ie-tooltip > span { display: block; padding: .375rem .625rem; border: 1px solid var(--ie-tooltip-background); border-radius: .375rem; color: var(--ie-tooltip-text); background: var(--ie-tooltip-background); overflow-wrap: anywhere; box-shadow: 0 2px 6px #0003; }
    .ie-tooltip-above { top: auto; bottom: 100%; padding-top: 0; padding-bottom: 6px; }
    @media (hover: none), (pointer: coarse) {
        .ie-icon-action { flex: 1 1 5.5rem; }
        .ie-icon-button { width: 100%; height: auto; flex-direction: column; gap: .25rem; white-space: normal; }
        .ie-touch-label { display: block; font-size: .75rem; line-height: 1.3; }
    }
    @media (forced-colors: active) {
        .ie-icon-button[aria-pressed='true'] { color: HighlightText; background: Highlight; border: 3px solid Highlight; }
        .ie-icon-button:focus-visible { outline-color: Highlight; }
        .ie-tooltip > span { color: CanvasText; background: Canvas; border-color: CanvasText; }
    }
</style>
