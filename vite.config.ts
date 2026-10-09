import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte({ emitCss: false })],
  css: { lightningcss: { targets: { chrome: 111 << 16, safari: (16 << 16) | (4 << 8), firefox: 128 << 16 } } },
})
