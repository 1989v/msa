import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: { '/ws': { target: 'ws://127.0.0.1:8787', ws: true } },
  },
  build: { target: 'es2022', sourcemap: false },
});
