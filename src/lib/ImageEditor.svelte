<script lang="ts">
import { mount, unmount } from 'svelte';
import ImageEditorContent from './ImageEditorContent.svelte';
import frameworkStyles from './tailwind.css?inline';
import type { ImageEditorProps } from './types';

let props: ImageEditorProps = $props();
let hostTheme = $state<'light' | 'dark' | undefined>();

function attachEditor(host: HTMLDivElement, styles: string) {
    // Read the host's explicit theme without importing its styles.
    function readHostTheme() {
        const ancestor = host.closest('[data-theme="light"], [data-theme="dark"], .light, .dark');
        const declared = ancestor?.getAttribute('data-theme');
        hostTheme = declared === 'light' || declared === 'dark'
            ? declared
            : ancestor?.classList.contains('dark') ? 'dark'
            : ancestor?.classList.contains('light') ? 'light' : undefined;
    }
    readHostTheme();
    const observer = new MutationObserver(readHostTheme);
    observer.observe(host.ownerDocument.documentElement, {
        attributes: true, subtree: true, attributeFilter: ['class', 'data-theme'],
    });
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = styles;
    shadow.append(style);
    const component = mount(ImageEditorContent, {
        target: shadow,
        props: {
            get theme() { return props.theme && props.theme !== 'system' ? props.theme : hostTheme ?? 'system'; },
            get imageBlob() { return props.imageBlob; },
            get galleryURL() { return props.galleryURL; },
            get passthroughOriginal() { return props.passthroughOriginal; },
            get saveCallback() { return props.saveCallback; },
            get validators() { return props.validators; },
            get imageLimits() { return props.imageLimits; },
        },
    });
    return {
        update(styles: string) { style.textContent = styles; },
        destroy() { observer.disconnect(); void unmount(component); },
    };
}
</script>

<div data-image-editor-host use:attachEditor={frameworkStyles}></div>
