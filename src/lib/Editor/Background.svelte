<script lang="ts">
import { Application, ColorMatrixFilter, Sprite, Texture } from 'pixi.js';
import { onMount } from 'svelte';
interface Props {
    source: HTMLImageElement | HTMLCanvasElement;
    width: number;
    height: number;
    rotation?: number;
    flipH?: boolean;
    flipV?: boolean;
    brightness?: number;
    contrast?: number;
    onready?: () => void;
    onerror?: (error: unknown) => void;
}
let { source, width, height, rotation = 0, flipH = false, flipV = false, brightness = 1, contrast = 0, onready, onerror }: Props = $props();
let container: HTMLDivElement;
let app: Application | undefined;
let sprite: Sprite | undefined;
let filter: ColorMatrixFilter | undefined;
let texture: Texture | undefined;
let frame: number | undefined;
let destroyed = false;
let initialized = false;
let released = false;
export function flush() {
    if (frame !== undefined) {
        cancelAnimationFrame(frame);
        frame = undefined;
    }
    if (!app || !sprite || !filter || destroyed)
        return;
    sprite.angle = rotation;
    sprite.scale.set(flipH ? -1 : 1, flipV ? -1 : 1);
    filter.reset();
    filter.brightness(brightness, true);
    filter.contrast(contrast, true);
    app.render();
}
function schedule() {
    if (initialized && !destroyed && frame === undefined)
        frame = requestAnimationFrame(() => {
            frame = undefined;
            flush();
        });
}
$effect(() => {
    void rotation;
    void flipH;
    void flipV;
    void brightness;
    void contrast;
    schedule();
});
export function exportCanvas(): HTMLCanvasElement {
    if (!app || !initialized || destroyed)
        throw new Error('The image renderer is not ready.');
    flush();
    return app.renderer.extract.canvas({ target: app.stage }) as HTMLCanvasElement;
}
function release(instance: Application) {
    if (released)
        return;
    released = true;
    if (instance.renderer) {
        instance.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
    } else
        instance.stage.destroy({ children: true });
    filter?.destroy();
    texture?.destroy(true);
    texture = undefined;
}
onMount(() => {
    const instance = new Application();
    app = instance;
    void (async () => {
        try {
            const edge = Math.max(width, height);
            // Canvas2D does not implement ColorMatrixFilter. Report failure
            // instead of accepting a fallback that discards image adjustments.
            await instance.init({ width: edge, height: edge, backgroundAlpha: 0, autoStart: false, sharedTicker: false, preference: ['webgl'], eventMode: 'none', resolution: 1 });
            if (destroyed) {
                release(instance);
                return;
            }
            texture = Texture.from(source, true);
            sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            sprite.position.set(edge / 2, edge / 2);
            filter = new ColorMatrixFilter();
            sprite.filters = [filter];
            instance.stage.addChild(sprite);
            container.appendChild(instance.canvas);
            initialized = true;
            instance.canvas.addEventListener('webglcontextlost', contextLost);
            flush();
            onready?.();
        }
        catch (e) {
            release(instance);
            if (!destroyed)
                onerror?.(e);
        }
    })();
    function contextLost(event: Event) {
        event.preventDefault();
        if (destroyed)
            return;
        onerror?.(new Error('The image renderer lost its graphics context. Reload this image to continue.'));
    }
    return () => {
        destroyed = true;
        if (frame !== undefined)
            cancelAnimationFrame(frame);
        if (initialized) {
            instance.canvas.removeEventListener('webglcontextlost', contextLost);
            release(instance);
        }
        filter = undefined;
        sprite = undefined;
        app = undefined;
    };
});
</script>
<div class="ie-background" bind:this={container} aria-hidden="true"></div>
<style>.ie-background{width:100%;height:100%;pointer-events:none}.ie-background :global(canvas){display:block;width:100%;height:100%}</style>
