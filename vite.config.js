import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      // example redirects
      '/1/images': 'http://localhost:8000',
      '^/data/.*': 'http://localhost:8000/',
    }
  },
  plugins: [svelte()],
})
