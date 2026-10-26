<script lang="ts">
import { onDestroy } from 'svelte';
import { Canvas, Circle, Group, IText, Path, PencilBrush, Point, Polyline, Rect, type FabricObject } from 'fabric/es';
import { canvasBlob } from '../utils';
import { cropExtendsOutsideImage } from '../cropGeometry';
import type { AnnotationSnapshot, CropSnapshot, EditorSnapshot } from '../types';
interface Props {
    onchange?: (snapshot: EditorSnapshot) => void;
    onerror?: (error: unknown) => void;
}
let { onchange, onerror }: Props = $props();
let canvasElement: HTMLCanvasElement;
let foregroundElement: HTMLDivElement;
let resizeObserver: ResizeObserver | undefined;
let controlScale = 1;
let textarea: HTMLDivElement;
let canvas: Canvas | undefined;
let crop: Rect | undefined;
let mask: Rect | undefined;
let placeholder: Rect | undefined;
let grid: Group | undefined;
let edge = 0;
let sourceWidth = 0;
let sourceHeight = 0;
let keepAspect = true;
let enabled = true;
let destroyed = false;
let sequence = 0;
let gridTimer: ReturnType<typeof setTimeout> | undefined;
let cropRatio = 1;
const annotations = new Map<FabricObject, {
    id: string;
    type: string;
}>();
const finite = (value: number) => Number.isFinite(value);
function requireCanvas(): Canvas {
    if (!canvas || destroyed)
        throw new Error('The image controls are not ready.');
    return canvas;
}
function objectSnapshot(object: FabricObject): AnnotationSnapshot {
    const data = annotations.get(object)!;
    return { id: data.id, type: data.type, label: `${data.type} ${data.id.split('-').at(-1)}`, x: object.left, y: object.top, width: object.getScaledWidth(), height: object.getScaledHeight(), angle: object.angle, color: typeof object.stroke === 'string' && object.stroke ? object.stroke : typeof object.fill === 'string' ? object.fill : '#000000', ...(object instanceof IText ? { text: object.text } : {}) };
}
function cropSnapshot(): CropSnapshot {
    if (!crop)
        return { x: 0, y: 0, width: 0, height: 0, warning: false };
    const bounds = { x: crop.left, y: crop.top, width: crop.getScaledWidth(), height: crop.getScaledHeight() };
    return { ...bounds, warning: !!placeholder && cropExtendsOutsideImage(bounds, { centerX: edge / 2, centerY: edge / 2, width: sourceWidth, height: sourceHeight, angle: placeholder.angle }) };
}
export function getSnapshot(): EditorSnapshot {
    const c = canvas;
    const active = c?.getActiveObject();
    return { crop: cropSnapshot(), annotations: c ? c.getObjects().filter(o => annotations.has(o)).map(objectSnapshot) : [], selectedId: active ? annotations.get(active)?.id : undefined };
}
function notify() {
    if (!destroyed)
        onchange?.(getSnapshot());
}
function refresh() {
    if (!canvas || !crop || !mask)
        return;
    crop.setCoords();
    const b = crop.getBoundingRect();
    mask.clipPath = new Path(`M ${b.left} ${b.top} h ${b.width} v ${b.height} h -${b.width} Z`, { absolutePositioned: true, inverted: true });
    canvas.requestRenderAll();
    notify();
}
function clearGrid() {
    if (gridTimer !== undefined) {
        clearTimeout(gridTimer);
        gridTimer = undefined;
    }
    if (grid && canvas)
        canvas.remove(grid);
    grid = undefined;
}
export function setRotation(angle: number) {
    if (!placeholder || !finite(angle))
        return;
    placeholder.rotate(angle);
    placeholder.setCoords();
    clearGrid();
    if (crop && canvas) {
        const b = crop.getBoundingRect();
        const lines: Polyline[] = [];
        for (let n = 1; n < 4; n++) {
            lines.push(new Polyline([{ x: b.left + b.width * n / 4, y: b.top }, { x: b.left + b.width * n / 4, y: b.top + b.height }], { stroke: 'rgba(255,255,255,.75)', strokeWidth: Math.max(1, edge * .002), strokeDashArray: [edge * .01, edge * .01], selectable: false, evented: false }));
            lines.push(new Polyline([{ x: b.left, y: b.top + b.height * n / 4 }, { x: b.left + b.width, y: b.top + b.height * n / 4 }], { stroke: 'rgba(255,255,255,.75)', strokeWidth: Math.max(1, edge * .002), strokeDashArray: [edge * .01, edge * .01], selectable: false, evented: false }));
        }
        grid = new Group(lines, { selectable: false, evented: false });
        canvas.add(grid);
        gridTimer = setTimeout(() => {
            clearGrid();
            canvas?.requestRenderAll();
        }, 1000);
    }
    refresh();
}
export function setKeepAspectRatio(value: boolean) {
    keepAspect = value;
    if (crop) {
        cropRatio = crop.getScaledWidth() / crop.getScaledHeight();
        crop.setControlsVisibility({ mt: !value, mr: !value, mb: !value, ml: !value, mtr: false });
    }
    if (canvas)
        canvas.uniformScaling = value;
}
export function setInteractive(value: boolean) {
    enabled = value;
    if (canvas) {
        canvas.skipTargetFind = !value;
        canvas.selection = false;
        if (!value) {
            canvas.isDrawingMode = false;
            const active = canvas.getActiveObject();
            if (active instanceof IText)
                active.exitEditing();
        }
        canvas.upperCanvasEl.style.pointerEvents = value ? 'auto' : 'none';
    }
}
export function updateCrop(change: Partial<CropSnapshot>) {
    if (!enabled || !crop)
        return;
    const before = cropSnapshot();
    let width = change.width ?? before.width;
    let height = change.height ?? before.height;
    if (keepAspect) {
        if (change.width !== undefined)
            height = width / cropRatio;
        else if (change.height !== undefined)
            width = height * cropRatio;
    }
    if (![width, height, change.x ?? before.x, change.y ?? before.y].every(finite))
        return;
    const scale = Math.min(1, edge / Math.max(1, width), edge / Math.max(1, height));
    width = Math.max(1, width * scale);
    height = Math.max(1, height * scale);
    crop.set({ left: Math.min(Math.max(0, change.x ?? before.x), edge - width), top: Math.min(Math.max(0, change.y ?? before.y), edge - height), width, height, scaleX: 1, scaleY: 1 });
    refresh();
}
function resetCrop() {
    if (!crop)
        return;
    crop.set({ left: (edge - sourceWidth) / 2, top: (edge - sourceHeight) / 2, width: sourceWidth, height: sourceHeight, scaleX: 1, scaleY: 1, angle: 0 });
    cropRatio = sourceWidth / sourceHeight;
    refresh();
}
export function reset() {
    if (!enabled || !canvas)
        return;
    clearGrid();
    for (const object of annotations.keys())
        canvas.remove(object);
    annotations.clear();
    placeholder?.rotate(0);
    placeholder?.setCoords();
    resetCrop();
    if (crop)
        canvas.setActiveObject(crop);
    notify();
}
export function rotateCW90() {
    quarterTurn(true);
}
export function rotateCCW90() {
    quarterTurn(false);
}
function quarterTurn(clockwise: boolean) {
    if (!enabled || !crop)
        return;
    const b = cropSnapshot();
    crop.set({ left: clockwise ? edge - b.y - b.height : b.y, top: clockwise ? b.x : edge - b.x - b.width, width: b.height, height: b.width, scaleX: 1, scaleY: 1 });
    cropRatio = b.height / b.width;
    refresh();
}
function controlStyle() {
    // Fabric control sizes use canvas units; the preview is scaled with CSS.
    return { cornerSize: 20 * controlScale, touchCornerSize: 64 * controlScale, borderScaleFactor: 2 * controlScale, borderOpacityWhenMoving: 1 };
}
function resizeControls() {
    if (!canvas) return;
    const width = canvas.upperCanvasEl.getBoundingClientRect().width;
    if (width <= 0) return;
    controlScale = edge / width;
    for (const object of [crop, ...annotations.keys()]) {
        if (!object) continue;
        object.set(controlStyle());
        object.setCoords();
    }
    canvas.calcOffset();
    canvas.requestRenderAll();
}
function decorate(object: FabricObject) {
    object.set({ originX: 'left', originY: 'top', ...controlStyle(), transparentCorners: false, lockScalingFlip: true, minScaleLimit: .05 });
}
function constrainCropScale(originX: number | 'left' | 'center' | 'right', originY: number | 'top' | 'center' | 'bottom') {
    if (!crop) return;
    const anchor = crop.getPositionByOrigin(originX, originY);
    const width = crop.getScaledWidth(), height = crop.getScaledHeight();
    if (keepAspect) {
        const factor = Math.min(1, edge / width, edge / height);
        crop.set({ scaleX: crop.scaleX * factor, scaleY: crop.scaleY * factor });
    } else {
        crop.set({ scaleX: Math.min(width, edge) / crop.width, scaleY: Math.min(height, edge) / crop.height });
    }
    crop.setPositionByOrigin(anchor, originX, originY);
    // Preserve the opposite corner unless the crop must shift to stay in bounds.
    crop.set({ left: Math.max(0, Math.min(edge - crop.getScaledWidth(), crop.left)), top: Math.max(0, Math.min(edge - crop.getScaledHeight(), crop.top)) });
    refresh();
}
function add(object: FabricObject, type: string) {
    if (!enabled)
        return;
    const c = requireCanvas();
    decorate(object);
    annotations.set(object, { id: `annotation-${++sequence}`, type });
    c.add(object);
    c.setActiveObject(object);
    c.requestRenderAll();
    notify();
}
export function drawArrow(color: string) {
    const unit = edge * .025;
    add(new Path(`M 0 0 L ${4 * unit} 0 L ${4 * unit} ${-unit} L ${6 * unit} ${unit} L ${4 * unit} ${3 * unit} L ${4 * unit} ${2 * unit} L 0 ${2 * unit} Z`, { left: edge * .4, top: edge * .45, fill: color }), 'Arrow');
}
export function drawCircle(color: string) {
    add(new Circle({ left: edge * .45, top: edge * .45, radius: edge * .05, strokeWidth: edge * .01, stroke: color, fill: 'transparent' }), 'Circle');
}
export function drawRect(color = 'dimgray') {
    add(new Rect({ left: edge * .42, top: edge * .46, width: edge * .16, height: edge * .08, fill: color }), 'Rectangle');
}
export function drawText(color: string) {
    const object = new IText('Enter text', { left: edge * .35, top: edge * .4, fontFamily: 'Arial', fontSize: edge * .07, fontWeight: 'bold', fill: color, hiddenTextareaContainer: textarea, cursorWidth: Math.max(1, edge * .003) });
    add(object, 'Text');
}
export function startDrawing(color: string) {
    if (canvas && enabled && canvas.freeDrawingBrush) {
        canvas.discardActiveObject();
        canvas.freeDrawingBrush.color = color;
        canvas.isDrawingMode = true;
        canvas.requestRenderAll();
    }
}
export function endDrawing() {
    if (!canvas) return;
    const wasDrawing = canvas.isDrawingMode;
    canvas.isDrawingMode = false;
    if (wasDrawing) {
        const latest = Array.from(annotations).reverse().find(([, data]) => data.type === 'Drawing')?.[0];
        if (latest) { canvas.setActiveObject(latest); canvas.requestRenderAll(); notify(); }
    }
}
export function updateAnnotation(id: string, change: Partial<AnnotationSnapshot>) {
    if (!enabled || !canvas)
        return;
    const object = Array.from(annotations).find(([, data]) => data.id === id)?.[0];
    if (!object)
        return;
    if (change.x !== undefined && finite(change.x))
        object.left = change.x;
    if (change.y !== undefined && finite(change.y))
        object.top = change.y;
    if (change.angle !== undefined && finite(change.angle))
        object.angle = change.angle;
    if (change.width !== undefined && finite(change.width) && change.width > 0)
        object.scaleX = change.width / (object.width + object.strokeWidth);
    if (change.height !== undefined && finite(change.height) && change.height > 0)
        object.scaleY = change.height / (object.height + object.strokeWidth);
    if (change.color) {
        if (object instanceof Circle || annotations.get(object)?.type === 'Drawing')
            object.set('stroke', change.color);
        else
            object.set('fill', change.color);
    }
    if (change.text !== undefined && object instanceof IText)
        object.set('text', change.text);
    object.setCoords();
    canvas.requestRenderAll();
    notify();
}
export function deleteMarker(id: string) {
    if (!enabled || !canvas)
        return;
    const object = Array.from(annotations).find(([, data]) => data.id === id)?.[0];
    if (object) {
        canvas.remove(object);
        annotations.delete(object);
        if (crop)
            canvas.setActiveObject(crop);
        canvas.requestRenderAll();
        notify();
    }
}
export function moveAnnotation(id: string, direction: 'forward' | 'backward') {
    if (!enabled || !canvas)
        return;
    const ordered = canvas.getObjects().filter(object => annotations.has(object));
    const index = ordered.findIndex(object => annotations.get(object)?.id === id);
    const next = index + (direction === 'forward' ? 1 : -1);
    if (index < 0 || next < 0 || next >= ordered.length)
        return;
    const object = ordered[index], other = ordered[next];
    const destination = canvas.getObjects().indexOf(other);
    canvas.moveObjectTo(object, destination);
    canvas.requestRenderAll();
    notify();
}
export async function saveImage(backgroundCanvas: HTMLCanvasElement): Promise<Blob> {
    const c = requireCanvas();
    if (!crop)
        throw new Error('Choose a crop before saving.');
    const rect = cropSnapshot();
    const width = Math.max(1, Math.round(rect.width)), height = Math.max(1, Math.round(rect.height));
    if (![width, height, rect.x, rect.y].every(finite))
        throw new Error('Invalid crop dimensions.');
    const allowed = new Set(annotations.keys());
    const overlay = allowed.size ? c.toCanvasElement(1, { left: rect.x, top: rect.y, width, height, filter: object => Array.from(allowed).some(annotation => annotation === object) }) : undefined;
    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    try {
        const ctx = output.getContext('2d');
        if (!ctx)
            throw new Error('The browser could not create the saved image.');
        ctx.fillStyle = 'dimgray';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(backgroundCanvas, (edge - backgroundCanvas.width) / 2 - rect.x, (edge - backgroundCanvas.height) / 2 - rect.y);
        if (overlay)
            ctx.drawImage(overlay, 0, 0);
        return await canvasBlob(output, 'image/jpeg', 1);
    }
    finally {
        if (overlay) {
            overlay.width = 0;
            overlay.height = 0;
        }
        output.width = 0;
        output.height = 0;
        backgroundCanvas.width = 0;
        backgroundCanvas.height = 0;
    }
}
export function init(dimensions: {
    width: number;
    height: number;
}) {
    if (canvas || destroyed)
        return;
    try {
        sourceWidth = dimensions.width;
        sourceHeight = dimensions.height;
        edge = Math.max(sourceWidth, sourceHeight);
        canvas = new Canvas(canvasElement, { backgroundColor: 'transparent', preserveObjectStacking: true, selection: false, enableRetinaScaling: false, uniScaleKey: null });
        canvas.setDimensions({ width: edge, height: edge }, { backstoreOnly: true });
        canvas.setDimensions({ width: '100%', height: '100%' }, { cssOnly: true });
        canvas.lowerCanvasEl.setAttribute('aria-hidden', 'true');
        canvas.upperCanvasEl.setAttribute('aria-label', 'Image editing canvas. Drag the crop handles to crop. Use the annotation controls for keyboard editing.');
        canvas.upperCanvasEl.setAttribute('role', 'img');
        placeholder = new Rect({ left: (edge - sourceWidth) / 2, top: (edge - sourceHeight) / 2, width: sourceWidth, height: sourceHeight, fill: 'transparent', strokeWidth: 0, selectable: false, evented: false, originX: 'center', originY: 'center' });
        placeholder.setPositionByOrigin(new Point(edge / 2, edge / 2), 'center', 'center');
        mask = new Rect({ originX: 'left', originY: 'top', left: 0, top: 0, width: edge, height: edge, fill: 'rgba(0,0,0,.6)', selectable: false, evented: false, strokeWidth: 0 });
        crop = new Rect({ fill: 'transparent', strokeWidth: 0, lockScalingFlip: true, minScaleLimit: .01 });
        decorate(crop);
        crop.set({ strokeWidth: 0 });
        canvas.add(placeholder, mask, crop);
        resetCrop();
        setKeepAspectRatio(true);
        canvas.freeDrawingBrush = new PencilBrush(canvas);
        canvas.freeDrawingBrush.width = edge * .005;
        canvas.setActiveObject(crop);
        resizeControls();
        resizeObserver = new ResizeObserver(resizeControls);
        resizeObserver.observe(foregroundElement);
        canvas.on('object:moving', event => {
            if (event.target === crop) {
                const b = cropSnapshot();
                crop!.set({ left: Math.max(0, Math.min(edge - b.width, b.x)), top: Math.max(0, Math.min(edge - b.height, b.y)) });
                refresh();
            }
            else
                notify();
        });
        canvas.on('object:scaling', event => {
            if (event.target === crop) {
                // Keep base dimensions stable until Fabric completes this transform.
                constrainCropScale(event.transform.originX, event.transform.originY);
            }
            else
                notify();
        });
        canvas.on('object:modified', event => {
            if (event.target === crop) {
                const b = cropSnapshot();
                updateCrop({ x: b.x, y: b.y, width: b.width, height: b.height });
            } else refresh();
        });
        canvas.on('selection:created', notify);
        canvas.on('selection:updated', notify);
        canvas.on('selection:cleared', notify);
        canvas.on('text:changed', notify);
        canvas.on('path:created', event => {
            const center = event.path.getCenterPoint();
            decorate(event.path);
            event.path.setPositionByOrigin(center, 'center', 'center');
            event.path.setCoords();
            annotations.set(event.path, { id: `annotation-${++sequence}`, type: 'Drawing' });
            notify();
        });
        canvas.requestRenderAll();
        notify();
    }
    catch (error) {
        onerror?.(error);
        throw error;
    }
}
onDestroy(() => {
    destroyed = true;
    resizeObserver?.disconnect();
    clearGrid();
    annotations.clear();
    if (canvas) {
        const old = canvas;
        canvas = undefined;
        void old.dispose().catch(() => {
        });
    }
});
</script>
<div bind:this={foregroundElement} class="ie-foreground"><canvas bind:this={canvasElement}></canvas><div bind:this={textarea} class="ie-textarea-host"></div></div>
<style>.ie-foreground{position:absolute;inset:0;z-index:1}.ie-foreground :global(.canvas-container){width:100%!important;height:100%!important}.ie-textarea-host{position:absolute;left:0;top:0}</style>
