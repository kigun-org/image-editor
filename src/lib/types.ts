export interface ImageLimits {
    maxInputBytes: number;
    maxInputPixels: number;
    maxEditorDimension: number;
}
export interface Validator {
    test: (image: HTMLImageElement) => boolean;
    message: string;
}
export interface PreparedImage {
    blob: Blob;
    source: HTMLImageElement | HTMLCanvasElement;
    width: number;
    height: number;
    originalWidth: number;
    originalHeight: number;
    warnings: string[];
    resized: boolean;
    originalBlob: Blob;
    copyBlob: Blob;
    copyLabel: string;
    dispose: () => void;
}
export interface CropSnapshot {
    x: number;
    y: number;
    width: number;
    height: number;
    warning: boolean;
}
export interface AnnotationSnapshot {
    id: string;
    label: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    angle: number;
    color: string;
    text?: string;
}
export interface EditorSnapshot {
    crop: CropSnapshot;
    annotations: AnnotationSnapshot[];
    selectedId?: string;
}
export type SaveCallback = (blob: Blob) => Promise<unknown> | unknown;
export interface ErrorNotice {
    message: string;
    id?: string;
    retryLabel?: string;
    dismissLabel?: string;
    disabled?: boolean;
    onretry?: () => void;
    ondismiss?: () => void;
}

export interface ImageEditorProps {
    theme?: 'system' | 'light' | 'dark';
    imageBlob?: Blob;
    galleryURL?: string;
    passthroughOriginal?: boolean;
    saveCallback: SaveCallback;
    validators?: Validator[];
    imageLimits?: Partial<ImageLimits>;
}
