import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Test the documented constructor API without the development HMR wrapper.
// The normal demo keeps its separate Vite configuration and HMR behavior.
export default defineConfig({ plugins: [svelte({ emitCss: false })], server: { hmr: false } });
