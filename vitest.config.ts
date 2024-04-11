import {defineConfig} from 'vitest/config'
import {svelte} from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
    plugins: [svelte({hot: !process.env.VITEST})],
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['src/lib/**/*.{test,spec}.?(c|m)[jt]s?(x)']
    },
})