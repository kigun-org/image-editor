import tailwind from '@tailwindcss/postcss';
import isolateEditor from './scripts/isolate-editor-css.mjs';

export default { plugins: [tailwind(), isolateEditor()] };
