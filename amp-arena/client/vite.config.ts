import { defineConfig } from 'vite';

// 배포는 게임 플랫폼 정적 경로(/games/arena/)에 얹힌다 — ARENA_BASE 로 base 를 준다.
// 온라인 대전은 플랫폼 릴레이 /ws/games/arena 를 쓴다. 개발 중에는 tools/dev-relay.mjs(8790)로 프록시.
export default defineConfig({
  base: process.env.ARENA_BASE ?? '/',
  server: {
    proxy: { '/ws/games': { target: 'ws://127.0.0.1:8790', ws: true } },
  },
  // `vite preview` 로 빌드 산출물을 base 경로 그대로 검증한다 (E2E 가 운영 경로 /games/arena/ 를 재도록)
  preview: {
    port: 5181,
    proxy: { '/ws/games': { target: 'ws://127.0.0.1:8790', ws: true } },
  },
  build: { target: 'es2022', sourcemap: false, outDir: process.env.ARENA_OUT ?? 'dist', emptyOutDir: true },
  worker: { format: 'es' },
});
