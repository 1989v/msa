<!-- source: portal-fe/src/styles/kh-motion.css, portal-fe/src/styles/kh-shell.css, portal-fe/src/components/brand/InkWash.tsx, portal-fe/src/shell/appShell.tsx -->
# K-Heritage 모션 문법 + 먹 캔버스 + 모바일 앱 셸

- **Status**: approved (설계 대화 2026-08-21)
- **Scope**: portal-fe 전체 (admin/quant/gifticon/agent-viewer 제외)
- **Docs**: DESIGN.md §12 (v2.2.0), `docs/design/k-heritage.html` 견본 동기화

## 1. 배경 / 결정

요청은 "애플 리퀴드 스타일의 캔버스 인터랙션 + 전 서비스 통일 템플릿"이었다.
검토 결과:

- **법적 리스크는 낮다** — 스타일 자체는 저작권 대상이 아니고, 웹은 App Store 심사
  대상도 아니다. 문제는 상표("Liquid Glass" 명칭·애플 연관 암시)뿐이다.
- **그러나 브랜드 충돌이 크다** — glassmorphism 은 `frontend-design.md` §1 의 AI slop
  자동 FAIL 패턴이고, k-heritage 의 "그림자 금지 / 면의 단차로 깊이" 원칙과 정반대다.

**결정: 리퀴드 감각을 k-heritage 어휘로 번역한다 — 유리가 아니라 먹(墨).**
액체의 부드러움은 유지하되 재료는 우리 것을 쓴다.

| 축 | 결정 |
|---|---|
| 통일 축 | 브랜드 면 = 먹 캔버스, 전 화면 = 공유 모션 문법 |
| 캔버스 컨셉 | 먹의 유동 — 포인터를 따라 한지에 번지는 먹 |
| 캔버스 적용 면 | `/` 는 페이지 전체(fullPage — 2026-08-21 확대), `/portfolio` 는 히어로 (콘텐츠 면은 깨끗하게) |
| 문법 적용 범위 | portal-fe 전체 |
| 모바일 | **Tier 2 앱 셸** — 올리브영 모바일웹 수준의 앱라이크 UX |
| 구현 | 2D Canvas 스탬핑 (의존성 0) + CSS 문법. WebGL 유체/three.js 탈락 |

## 2. 모션 어휘 — 다섯 동사

색이 재료(한지·기와·먹)에서 왔듯 모션은 행위에서 온다. 전 화면이 이 동사만 쓴다.

| 동사 | 클래스 | 값 | 쓰는 곳 |
|---|---|---|---|
| 스밈 | `.kh-seep` | opacity 0→1 + translateY(8px→0), 560ms | 히어로 카피, 섹션 콘텐츠, 카드 |
| 긋기 | `.kh-rule-draw` | 괘선 scaleX(0→1) origin-left, 480ms | `.kh-section-head`, 탭 활성 표시 |
| 어긋남 | `.kh-settle` | 어긋난 판이 제자리에서 미끄러져 어긋나며 등장 | `.kh-slab-offset`, 판 reveal |
| 찍힘 | `.kh-stamp` | scale(1.06→1) + opacity, 200ms | `.kh-seal`, 배지, 상태칩 |
| 눌림 | `.kh-press` / `:active` | translateY(1px), 120ms | 모든 인터랙티브 |

규칙 (frontend-design.md §5 와 정합):

- `transform` + `opacity` 만. blur/filter 애니메이션 금지.
- 퇴장은 fade 만, 입장의 75% 속도 — 먹은 화려하게 사라지지 않는다, 마를 뿐이다.
- 스태거는 자식 50ms 간격 **6번째까지만** (이후 동시 등장).
- `prefers-reduced-motion: reduce` 면 reveal 자체를 걸지 않는다 (JS 가 속성을 안 붙임).

토큰 (`portal-fe/src/styles/kh-motion.css`):

```css
--kh-dur-feedback: 120ms;  --kh-dur-state: 240ms;  --kh-dur-enter: 560ms;
--kh-ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
--kh-ease-exit:  cubic-bezier(0.7, 0, 0.84, 0);
```

**발화 계약**: `useReveal()` 훅(ref 콜백)이 뷰포트 진입 시 대상에
`data-reveal="pending" → "in"` 을 붙인다. CSS 는 `[data-reveal]` 존재를 전제로만
숨긴다 — 프리렌더/무 JS 환경에서는 속성이 없으므로 **콘텐츠가 그대로 보인다**
(SEO·no-JS 안전).

## 3. 먹 캔버스 — `<InkWash>`

`portal-fe/src/components/brand/InkWash.tsx`. 의존성 0, 단일 컴포넌트.

- **필드**: 표시 크기의 1/3 저해상도 오프스크린 캔버스 (최대 ~420px, DPR 1 고정).
  업스케일 자체가 번짐이 된다.
- **붓**: 초기화 시 노이즈 구멍을 뚫은 방사형 먹방울 스프라이트 3종을 생성해 두고,
  포인터 속도에 비례한 크기·지터로 찍는다.
- **번짐/마름**: 매 프레임 필드를 중심 기준 1.004배 자기 블릿(확산 근사) +
  `destination-out` 저알파 페이드(마름).
- **에너지 게이트**: 남은 먹 양을 추적해 0 에 수렴하면 **rAF 를 완전히 멈춘다.**
  포인터 이벤트가 다시 깨운다. 유휴 시 CPU/배터리 0.
- **정경 연동**: 먹 색은 k-heritage 정경 토큰 `--kh-ink-wash` (라이트: 기와 먹빛,
  다크: 흰 안개)에서 읽는다. 테마 전환은 `data-theme` MutationObserver 로 추적.
- **가드**: IntersectionObserver (히어로 이탈 시 정지) + `visibilitychange` (탭 숨김
  정지) + `prefers-reduced-motion` (정적 먹 자국 1장만 그리고 종료).
- **fullPage 모드** (`/` 전용, 2026-08-21): 필드는 페이지 좌표로 기록하고 표시
  캔버스는 뷰포트 고정 — 매 프레임 스크롤 위치의 슬라이스만 그린다. 먹이 유리가
  아니라 지면에 남는다. 레이어는 `z-index: -1` + 호스트 `isolation: isolate` 로
  배경 위·콘텐츠 아래. 콘텐츠 지연 로드로 페이지 키가 자라면 필드를 새 판에
  옮겨 심어 기존 먹을 보존한다.
- **접근성**: `aria-hidden`, `pointer-events: none`, 카피 뒤 z-0. 텍스트 대비에
  영향을 주지 않도록 먹 최대 알파를 낮게 잡는다.

## 4. 모바일 앱 셸 (Tier 2)

**활성 조건**: 뷰포트 `< 768px`. 데스크탑은 현행 GNB 그대로 — 한 코드베이스, 두 표정.

| 요소 | 구현 |
|---|---|
| 하단 탭바 `KhTabBar` | 호스트별 탭을 `src/shell/appShell.tsx` 에 선언. fixed + `env(safe-area-inset-bottom)`. 활성 탭은 **긋기**(상단 괘선). 기와 먹빛 바(라이트) / 송연 바(다크) |
| 스택 전환 | RR7 `viewTransition` + View Transitions API. 목록→상세 push(우→좌 24px + fade), 뒤로 pop(역방향). 방향은 `useNavigationType()` → `<html data-nav>`. 미지원 브라우저는 즉시 교체 (점진적 향상, 폴백 코드 없음) |
| 접히는 헤더 | `useScrollDirection()` — 아래로 스크롤 시 GNB translateY 숨김, 위로 한 틱이면 복귀. 모바일에서만 |
| 바텀시트 `KhSheet` | 먹빛 veil + 아래서 올라오는 판. 드래그 핸들 + 스와이프 닫기. 첫 소비처: 게임 호스트 장르 탭 |
| 스켈레톤 `.kh-skeleton` | shimmer 그래디언트 금지 — 정경 톤 면의 opacity pulse. Shop 스켈레톤을 이 프리미티브로 승격 |
| 터치 기반기 | `touch-action: manipulation`, `-webkit-tap-highlight-color` 제거, `overscroll-behavior-y: contain`, `viewport-fit=cover` |

탭 구성:

| 호스트 | 탭 |
|---|---|
| apex | 홈 `/` · 기술 `/tech` · 포트폴리오 `/portfolio` · 샵 `/shop` |
| game | 로비 `/` · 장르 (KhSheet) · 1989v (apex) — **게임 플레이 화면에선 탭바 숨김** (rAF 경합 + 몰입) |
| place | **보류** — 지역 드릴다운(2026-08-20 spec)이 in-flight. 착지 후 별도 적용 |
| resume / deal | 없음 — 문서/단일 목록 성격에 셸은 소음 |

## 5. 비대상 / 후속

- `packages/design-system` 은 건드리지 않는다 (DESIGN.md §12 규칙). 버전 동기
  bump 도 토큰 변경이 없으므로 하지 않는다.
- 모달 퇴장 애니메이션(마름 fade)은 규칙만 정의, 구현은 후속.
- PWA (Tier 3: manifest·standalone) 는 Tier 2 안정화 후 별도 건.
- place 탭바 — 드릴다운 착지 후.

## 6. 검증

- `pnpm tsc && pnpm build` (portal-fe)
- CDP (fe-visual-verification 표준): 모바일 뷰포트에서 탭바 렌더·safe-area,
  라이트/다크 × 기기 설정 조합에서 먹 캔버스 톤, reduced-motion 에뮬레이션 시
  reveal 미발화 확인.
