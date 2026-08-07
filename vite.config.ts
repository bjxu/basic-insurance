import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // GitHub Pages project site: served at https://bjxu.github.io/basic-insurance/, not
  // the domain root. Set unconditionally (not just for `build`) so dev matches prod —
  // see src/lib/health-premiums.ts, which depends on this via import.meta.env.BASE_URL.
  base: '/basic-insurance/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
