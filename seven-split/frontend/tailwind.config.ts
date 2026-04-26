import type { Config } from 'tailwindcss'

// frontend-design.md 가드레일을 적용한 토큰.
// - 단일 폰트(Pretendard) + 다중 웨이트
// - OKLCH 기반 회색 + 단일 액센트
// - 4pt 그리드 (Tailwind 기본 spacing 유지)
// - 5단계 타입 스케일
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        // 5단계 타입 스케일 (frontend-design.md §2)
        xs: ['0.75rem', { lineHeight: '1.5' }], // 12px — 캡션
        sm: ['0.875rem', { lineHeight: '1.5' }], // 14px — 보조 UI
        base: ['1rem', { lineHeight: '1.6' }], // 16px — 본문
        lg: ['1.25rem', { lineHeight: '1.4' }], // 20px — 소제목
        xl: ['1.5rem', { lineHeight: '1.2' }], // 24px — 섹션 헤딩
        '2xl': ['2rem', { lineHeight: '1.15' }], // 32px — 페이지 헤딩
        '3xl': ['2.5rem', { lineHeight: '1.1' }], // 40px — 히어로
      },
      colors: {
        // OKLCH 기반 뉴트럴 (frontend-design.md §3)
        // 미세 chroma(0.005~0.015)로 순수 회색 회피
        ink: {
          50: 'oklch(98% 0.005 250)',
          100: 'oklch(96% 0.006 250)',
          200: 'oklch(92% 0.008 250)',
          300: 'oklch(85% 0.010 250)',
          400: 'oklch(70% 0.012 250)',
          500: 'oklch(55% 0.012 250)',
          600: 'oklch(42% 0.012 250)',
          700: 'oklch(30% 0.010 250)',
          800: 'oklch(20% 0.008 250)',
          900: 'oklch(14% 0.006 250)',
          950: 'oklch(10% 0.005 250)',
        },
        // 액센트 — 한 가지만 (60-30-10 규칙)
        brand: {
          50: 'oklch(96% 0.04 220)',
          100: 'oklch(92% 0.07 220)',
          400: 'oklch(70% 0.14 220)',
          500: 'oklch(60% 0.16 220)',
          600: 'oklch(52% 0.17 220)',
          700: 'oklch(44% 0.16 220)',
        },
        // PnL — 한국 관습 (양수=빨강, 음수=파랑)
        pnl: {
          up: 'oklch(58% 0.18 25)', // 빨강 (상승/이익)
          down: 'oklch(58% 0.16 245)', // 파랑 (하락/손실)
          neutral: 'oklch(55% 0.012 250)',
        },
        status: {
          draft: 'oklch(70% 0.012 250)',
          active: 'oklch(62% 0.14 150)',
          paused: 'oklch(70% 0.13 80)',
          liquidated: 'oklch(55% 0.012 250)',
          archived: 'oklch(45% 0.012 250)',
        },
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-expo': 'cubic-bezier(0.7, 0, 0.84, 0)',
      },
      maxWidth: {
        prose: '65ch',
        app: '480px', // 모바일 우선, 데스크탑에서도 본문은 좁게
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },
    },
  },
  plugins: [],
}

export default config
