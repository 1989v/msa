import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 구슬 레이스의 물리 전수 검사 — 코스·시드·주사율을 모두 돌려 합쳐 12분이 넘는다. 기본 실행(CI 포함)에 두면
// portal-fe 작업이 10분 한도에 걸려 취소되므로 빼고, 물리 코드를 바꿨을 때 `npm run test:marble-sweep` 로 돌린다.
const MARBLE_SWEEP = ['tests/games/marbleCourseMatrix.test.ts', 'tests/games/marbleSchedules.test.ts'];

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
    exclude: [...configDefaults.exclude, ...(process.env.MARBLE_SWEEP ? [] : MARBLE_SWEEP)],
  },
});
