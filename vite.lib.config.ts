import {defineConfig} from 'vite'
import {resolve} from 'path'
import {svelte} from '@sveltejs/vite-plugin-svelte'

export default defineConfig(({ mode }) => ({
    base: '/static/js/image-editor/',
    publicDir: false,
    plugins: [svelte({ emitCss: false })],
    define: {
        'process.env.NODE_ENV': JSON.stringify(
            mode === 'production' ? 'production' : 'development',
        ),
    },
    build: {
        target: ['chrome111', 'safari16.4', 'firefox128'],
        cssTarget: ['chrome111', 'safari16.4', 'firefox128'],
        rolldownOptions: {
            output: {
                codeSplitting: false,
            }
        },
        lib: {
            entry: resolve(import.meta.dirname, 'src/lib/ImageEditor.svelte'),
            formats: ['es'],
            fileName: () => `image-editor.js`,
        }
    }
}))
