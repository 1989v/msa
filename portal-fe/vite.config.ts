import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// portal-fe = 공개 포털 셸. 어드민은 ADR-0063 에서 분리돼 admin.* 단일 호스트로 갔다
// (그때 @admin alias 도 함께 사라졌다). Tailwind v4 는 남은 흡수 컴포넌트용.
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
