import {defineConfig} from 'vite'
import {resolve} from 'path'
import {svelte} from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/static/image-editor/',
    publicDir: false,
    plugins: [svelte()],
    build: {
        cssCodeSplit: false,
        rolldownOptions: {
            output: {
                codeSplitting: false,
            }
        },
        lib: {
            entry: resolve(__dirname, 'src/lib/ImageEditor.svelte'),
            formats: ['es'],
            fileName: (_, entryAlias) => `image-editor.js`,
            cssFileName: "image-editor"
        }
    }
})
