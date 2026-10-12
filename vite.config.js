import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the production build works from any static folder.
  base: './',
  server: { host: true },
  build: {
    target: 'es2019',
    chunkSizeWarningLimit: 1600,
  },
});
