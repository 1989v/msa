import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// portal-fe = 공개 포털 셸. 어드민은 ADR-0063 에서 분리돼 admin.* 단일 호스트로 갔다
// (그때 @admin alias 도 함께 사라졌다). Tailwind v4 는 남은 흡수 컴포넌트용.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 프리렌더가 늦게 불리는 청크(드릴다운 데이터)를 미리 받게 하려고 청크 이름을 여기서 읽는다.
  // 서빙물에 남기지 않는다 — 이미지 빌드가 프리렌더 뒤에 dist/.vite 를 지운다.
  build: { manifest: true },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: process.env.PORTAL_DEV_API_ORIGIN ?? 'http://localhost:8089',
        changeOrigin: true,
      },
    },
  },
});
