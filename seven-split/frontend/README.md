# Seven-Split Frontend

세븐스플릿 분할매매 대시보드 — **모바일 우선 PWA**.

> 위치: `seven-split/frontend/` · 백엔드: `seven-split:app` (port 8094)
> 폼팩터 결정: spec.md §12 — 본인 1인 운용 시나리오상 휴대폰에서 빠른 확인이 주.

## Tech Stack

| 영역 | 선택 | 비고 |
|---|---|---|
| Build | Vite 6.x + TypeScript 5.x | strict mode |
| UI | React 18 | |
| Style | Tailwind CSS 3.x | mobile-first 유틸리티, OKLCH 토큰 |
| Routing | React Router v6 | |
| Server cache | TanStack Query v5 | REST 캐싱·재시도 |
| Form | react-hook-form + zod | |
| Chart | lightweight-charts 4.x | 매수/매도 마커 오버레이 |
| PWA | vite-plugin-pwa (Workbox) | manifest + service worker |
| Icons | lucide-react | |
| Font | Pretendard | CDN 로드, 단일 패밀리 + 다중 웨이트 |

`docs/conventions/frontend-design.md` AI Slop 금지 패턴(보라 그래디언트, glass card, side-stripe 등) 0건.

## Commands

```bash
cd seven-split/frontend
npm install
npm run dev       # vite dev server, http://localhost:5173
npm run build     # tsc -b && vite build → dist/
npm run preview   # build 결과 정적 서빙
npm run lint      # eslint
```

## 환경 변수

`.env.local` 또는 dev/prod 빌드 시:

```
VITE_API_BASE_URL=http://localhost:8094
```

미설정 시 dev 모드는 vite proxy(`/api → 8094`)를 사용하고, prod 빌드는 `/api/seven-split` 경로(Gateway 라우트 가정)를 baseURL 로 사용한다.

## 사용자 식별 (tenantId)

운영에서는 Gateway 가 JWT 검증 후 `X-User-Id` 헤더를 주입한다. 로컬 개발에서는:

1. `/settings` 페이지에서 tenantId 입력 → localStorage 저장
2. 미설정 시 기본값 `local-dev` 사용

`api/client.ts` 의 인터셉터가 모든 요청에 자동 주입한다.

## PWA 설치

| 플랫폼 | 방법 |
|---|---|
| iOS Safari | 공유 → 홈 화면에 추가 |
| Android Chrome | 메뉴 → 앱 설치 / 주소창의 설치 배너 |
| 데스크탑 Chrome/Edge | 주소창 우측 설치 아이콘 |

placeholder 아이콘이므로 정식 디자인 확정 후 `public/icons/icon-192.png` / `icon-512.png` 교체 필요.

## 라우트

| 경로 | 페이지 | 비고 |
|---|---|---|
| `/` | HomePage | 누적 PnL + 최근 백테스트 5건 + CTA |
| `/strategies` | StrategyListPage | 카드 리스트 |
| `/strategies/new` | StrategyCreatePage | react-hook-form + zod |
| `/strategies/:id` | StrategyDetailPage | 설정 + 백테스트 결과 리스트 |
| `/strategies/:id/backtests/new` | BacktestSubmitPage | 기간 + 시드 |
| `/runs` | BacktestRunsPage | 모든 전략의 결과 종합 |
| `/runs/:runId` | BacktestRunDetailPage | 차트 + 회차별 PnL + 타임라인 |
| `/leaderboard` | LeaderboardPage | 본인 용도 랭킹 |
| `/settings` | SettingsPage | tenantId 변경, PWA 안내 |

하단 탭바: Home / Strategies / Backtests / Leaderboard.
모달성/뎁스 페이지(전략 생성, 백테스트 제출, 결과 상세)는 탭바 숨김.

## 디자인 토큰

`tailwind.config.ts` 참조.

- 폰트: Pretendard 단일 패밀리, 다중 웨이트
- 타입 스케일 5단계: 12 / 14 / 16 / 20 / 24 (+ 32 / 40 헤드라인)
- 색상: OKLCH 회색 11단계 (`ink-50 ~ ink-950`) + 단일 액센트 `brand-*`
- PnL: 한국 관습 — 양수=빨강(`pnl-up`), 음수=파랑(`pnl-down`)
- 간격: Tailwind 기본 4px 그리드
- 모션: 200~300ms `ease-out-expo`, transform/opacity 만, `prefers-reduced-motion` 강제 지원

## 알려진 한계 / TODO

- PWA 아이콘은 placeholder (정식 디자인 미확정)
- E2E (Playwright) 테스트는 본 TG 범위 밖 (Phase 2)
- 백엔드 응답 타입은 수동 미러링 — 변경 시 `src/types/api.ts` 와 백엔드 view 패키지 sync 필요
- `BacktestRunChart` 의 `priceSeries` 미제공 시 fill 가격 보간으로 placeholder 시각화 (실 OHLCV 라인 추가는 백엔드 endpoint 확정 후)
- 다크모드는 system `prefers-color-scheme` 따름 — MVP 는 라이트 only (실제 컬러 토큰 다크 변종 미정의)
- `/strategies/:id/backtests/new` 기간 picker 는 native `<input type="date">` 사용 (모바일에서 OS native picker 호출). 추후 더 풍부한 UX 필요 시 라이브러리 검토.

## 백엔드 의존

- `GET /api/v1/dashboard/overview` → `DashboardOverview`
- `GET /api/v1/dashboard/executions` → `BacktestRunSummaryView[]`
- `GET /api/v1/strategies` / `POST` / `GET /:id` / `PATCH /:id`
- `POST /api/v1/backtests` → `BacktestRunResultView`
- `GET /api/v1/strategies/:id/runs` → `BacktestRunSummaryView[]`
- `GET /api/v1/runs/:runId` → `BacktestRunResultView`
- `GET /api/v1/leaderboard?limit=` → `LeaderboardEntry[]`

전 응답 `ApiResponse<T>` 래퍼. `api/client.ts` 의 `unwrap()` 으로 일괄 언래핑.
