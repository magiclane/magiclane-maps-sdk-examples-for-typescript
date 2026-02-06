import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Remove "root: 'public'" -> Let Vite use the main project folder as root
  base: './',
  server: {
    port: 8080,
  },
  build: {
    outDir: 'dist', // Standard output folder
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'), // Looks for index.html in the root
      },
    },
  },
});
