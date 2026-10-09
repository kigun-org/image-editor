import ImageEditor from '../../src/lib/ImageEditor.svelte';
import { installHarness, type EditorConstructor } from './controller';

installHarness(ImageEditor as unknown as EditorConstructor);
