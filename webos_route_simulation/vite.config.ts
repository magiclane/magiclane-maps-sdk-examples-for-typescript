import { defineConfig } from 'vite';

export default defineConfig({
  // This forces Vite to use relative paths (e.g., "./assets")
  // which is required for webOS file:// execution.
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
