import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // 게임 JS 검사는 src 밖에 산다 — 게임 자체가 public/games 의 정적 파일이라,
    // 여기를 안 넓히면 「검사는 대상의 산출물을 본다」가 배선 없이 문장으로만 남는다.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
  },
});
