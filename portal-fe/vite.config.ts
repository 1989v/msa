import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// FE 통합(ADR-0058 R3): portal-fe = 통합 셸. sub-app(admin 등)은 src/apps/<app> 로 흡수,
// @<app> alias 로 내부 import 격리. Tailwind v4 는 흡수된 admin 컴포넌트용 — @import "tailwindcss"
// 를 포함한 각 앱 index.css 를 그 앱 진입점(App.tsx)에서 import → lazy 청크에 번들.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@admin': path.resolve(__dirname, './src/apps/admin'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8089',
        changeOrigin: true,
      },
    },
  },
});
