import {defineConfig} from 'vite'
import {resolve} from 'path'
import {svelte} from '@sveltejs/vite-plugin-svelte'

export default defineConfig(({ mode }) => ({
    base: '/static/js/image-editor/',
    publicDir: false,
    plugins: [svelte()],
    define: {
        'process.env.NODE_ENV': JSON.stringify(
            mode === 'production' ? 'production' : 'development',
        ),
    },
    build: {
        cssCodeSplit: false,
        rolldownOptions: {
            output: {
                codeSplitting: false,
            }
        },
        lib: {
            entry: resolve(import.meta.dirname, 'src/lib/ImageEditor.svelte'),
            formats: ['es'],
            fileName: () => `image-editor.js`,
            cssFileName: "image-editor"
        }
    }
}))
