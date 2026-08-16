<!-- source: packages/design-system/src/tokens.css, docs/conventions/frontend-design.md, docs/conventions/design-system.md -->
<!-- standard: docs/standards/design-md.md -->
---
version: 2.0.0
archetype: dark-trading
# 브랜드/포트폴리오 화면(portal-fe `/`, `/portfolio`, resume 호스트)만 두 번째 아키타입을
# 쓴다 — §12 참조. 공유 토큰은 그대로 dark-trading 이다.
archetype_secondary: k-heritage
mood: [data-dense, calm-night, korean-fintech]
last_updated: 2026-08-16
owners: [frontend-platform]
default_theme: dark
themes: [dark, light]
agent_entry: "AI 에이전트는 FE 코드 작성 전 반드시 본 파일의 토큰을 우선 참조한다."

tokens:
  colors:
    # Surface — dark navy hierarchy (샘플 1/2 정확 매칭)
    surface_0: { hex: "#0c1424", oklch: "0.17 0.025 252", role: "page background" }
    surface_1: { hex: "#1a2238", oklch: "0.24 0.025 254", role: "card background" }
    surface_2: { hex: "#222b44", oklch: "0.29 0.025 254", role: "hover / active card" }
    surface_3: { hex: "#2c3550", oklch: "0.34 0.025 254", role: "nested element" }

    # Text
    text_primary:   { oklch: "0.96 0.005 250", role: "headings, body" }
    text_secondary: { oklch: "0.78 0.01 250",  role: "secondary text" }
    text_muted:     { oklch: "0.62 0.015 250", role: "labels, captions" }
    text_disabled:  { oklch: "0.45 0.01 250" }

    # Border
    border_subtle:  { oklch: "0.32 0.015 250" }
    border_default: { oklch: "0.42 0.015 250" }
    border_strong:  { oklch: "0.55 0.02 250" }

    # Accent — primary action (focus, CTA)
    primary:        { hex: "#0ea5e9", oklch: "0.68 0.16 245", role: "primary CTA, focus, links" }
    primary_hover:  { oklch: "0.74 0.16 245" }
    primary_active: { oklch: "0.62 0.16 245" }
    primary_bg:     { oklch: "0.30 0.10 245", role: "soft primary surface" }

    # Accent — secondary (segment active)
    secondary:       { oklch: "0.78 0.14 180", role: "secondary toggle/segment" }
    secondary_hover: { oklch: "0.83 0.14 180" }

    # Status — P/L semantic (백테스트 PnL, 페이퍼/실매매 성과, 전략 평가 전용)
    profit:          { hex: "#22c55e", oklch: "0.72 0.19 145", role: "P/L positive — backtest, paper, live trading" }
    profit_bg:       { oklch: "0.30 0.09 145" }
    loss:            { hex: "#ef4444", oklch: "0.65 0.22 25",  role: "P/L negative — backtest, paper, live trading" }
    loss_bg:         { oklch: "0.30 0.12 25" }
    warning:         { oklch: "0.80 0.15 75",  role: "caution / pending" }
    info:            { oklch: "0.75 0.10 240", role: "informational" }
    danger:          { hex: "#dc2626", oklch: "0.55 0.22 25", role: "destructive action (full-width stop)" }

    # Quote — 한국 시세 관습 (캔들/가격 변동/시세 칩 전용)
    # P/L 의미와 의도적 분리: 시세는 한국 관습(상승=빨강), P/L 은 글로벌(수익=녹색).
    quote_rise:        { hex: "#FA616D", oklch: "0.69 0.20 18",  role: "candle up / price rise — KR convention" }
    quote_rise_strong: { hex: "#F04251", oklch: "0.61 0.23 22",  role: "strong rise emphasis" }
    quote_rise_bg:     { oklch: "0.30 0.10 18" }
    quote_fall:        { hex: "#3485FA", oklch: "0.63 0.18 254", role: "candle down / price fall — KR convention" }
    quote_fall_link:   { hex: "#449BFF", oklch: "0.71 0.17 250", role: "link / hover variant" }
    quote_fall_bg:     { oklch: "0.30 0.10 254" }

  typography:
    family:        "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    family_mono:   "'SF Mono', 'JetBrains Mono', Monaco, Consolas, monospace"
    scale:         { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36 }
    weight:        { regular: 400, medium: 500, semibold: 600, bold: 700 }
    line_height:   { tight: 1.2, normal: 1.5, relaxed: 1.7 }
    numeric:       "tabular-nums"  # 숫자 정렬 (KPI / 가격 / 변동률)

  spacing:
    base: 4  # 4px grid
    scale: { "0": 0, "1": 4, "2": 8, "3": 12, "4": 16, "5": 20, "6": 24, "8": 32, "10": 40, "12": 48, "16": 64 }

  radius:
    sm:   4
    md:   8    # 버튼, 입력
    lg:   12   # 카드 (샘플 1/2 메인)
    xl:   16
    full: 9999

  shadow:
    sm: "0 1px 2px 0 rgba(0,0,0,0.18)"
    md: "0 2px 6px -1px rgba(0,0,0,0.22), 0 2px 4px -2px rgba(0,0,0,0.18)"
    lg: "0 8px 16px -4px rgba(0,0,0,0.28), 0 4px 8px -4px rgba(0,0,0,0.22)"
    xl: "0 16px 32px -8px rgba(0,0,0,0.32)"

  motion:
    duration: { fast: "100ms", normal: "150ms", slow: "250ms" }
    easing:   { out: "cubic-bezier(0,0,0.2,1)", in_out: "cubic-bezier(0.4,0,0.2,1)" }
    reduced_motion: "respect prefers-reduced-motion: reduce → 0ms"

  layout:
    max_width: { content: 1280, mobile_app: 480 }
    breakpoint: { sm: 640, md: 768, lg: 1024, xl: 1280 }
    touch_target_min_px: 44
---

# DESIGN.md — Commerce Platform

본 파일은 [표준 `docs/standards/design-md.md`](docs/standards/design-md.md) 의 인스턴스. 모든 frontend (`admin-fe`, `portal-fe`, `quant-fe`, `gifticon-fe`, `agent-viewer-fe`) 가 따른다.

토큰 값은 위 YAML front-matter 가 단일 출처. 실제 CSS 정의는 [`packages/design-system/src/tokens.css`](packages/design-system/src/tokens.css) 에 OKLCH 로 박혀있다 (이 파일과 sync).

---

## 1. Overview

데이터 밀도가 높은 한국 핀테크 — **자동매매 / 차트 / 포트폴리오** 톤. 다크 네이비 surface 위에 큰 KPI 숫자 (tabular-nums) + 강한 profit/loss 색 + 12px 카드 모서리. 평소엔 차분하고 (chroma 0.005~0.04) 액션·delta 에서만 채도가 튄다.

샘플 출처: 네이버 증권 / 빗썸 모바일 차트 / 자체 포트폴리오 사진 — `docs/assets/design-system/sample-1-tranche-detail.png`, `sample-2-portfolio.png`.

## 2. Colors

| 역할 | 사용 규칙 |
|---|---|
| **Primary** `{colors.primary}` | 화면당 가장 중요한 1개의 액션 / 활성 탭 underline / focus ring. 둘 이상 쓰면 위계 무너짐. |
| **Secondary** `{colors.secondary}` | segment control 활성 / 토글. primary 와 같은 화면 공존 가능. |
| **Surface 0/1/2/3** | 페이지 → 카드 → hover → nested 의 4단 계층. 카드 안에 카드 중첩 시 한 단계만 더 밝게. |
| **Profit/Loss** `{colors.profit}` `{colors.loss}` | **P/L 의미 전용** — 백테스트 PnL, 페이퍼/실매매 성과, 전략 평가. 글로벌(수익=녹색) 관습. 항상 ▲/▼ 같은 형태 신호와 병기. |
| **Quote Rise/Fall** `{colors.quote_rise}` `{colors.quote_fall}` | **시세 표시 전용** — 캔들 색, 가격 변동률, 시세 microcontext 칩. 한국 관습(상승=빨강 / 하락=파랑). P/L 색상과 절대 혼용 금지. |
| **Danger** | 비가역 파괴 액션 전용 (계정 삭제 / 전략 정지). 일반 취소 버튼엔 사용 금지. |

WCAG: text 색은 항상 surface 와 4.5:1 (large 18pt+ 는 3:1) 이상 — light/dark 양 테마 모두 보장 (light token 은 `tokens.css` 하단 참조).

## 3. Typography

- **family**: Pretendard 우선 (한글 가독성). monospace 는 코드/티커/지표 식별자.
- **scale 적용**:
  - `xs(12)` 캡션 / 작은 라벨
  - `sm(14)` secondary 텍스트
  - `base(16)` 본문
  - `lg(18)` 섹션 제목
  - `2xl(24)` 페이지 제목
  - `3xl(30)` KPI 숫자
  - `4xl(36)` hero 숫자 (포트폴리오 평가액 등)
- **숫자**: `font-variant-numeric: tabular-nums` 항상. 가격·수익률·수량 정렬 안정성.
- 모호어 금지: "큰 글자" / "조금 더 두껍게" 대신 토큰 값 명시.

## 4. Layout & Spacing

- **4px base grid**. 모든 padding / margin 은 `{spacing.N}` 토큰으로.
- **Container**:
  - 데스크탑 콘텐츠 max-width `1280` (`max-w-7xl`)
  - 모바일 앱 화면 (quant-fe / portal-fe 의 메인 SPA) max-width `480` (`max-w-app`) — 데스크탑에서도 가운데 정렬로 모바일 톤 유지.
- **Breakpoint**: `sm 640 / md 768 / lg 1024 / xl 1280`.
- **Touch target**: 모바일 인터랙션 요소 최소 44×44px.
- **반응형 우선순위**: 모바일 우선. 데스크탑은 max-w 안에서 같은 레이아웃 그대로.

## 5. Elevation & Depth

다크 테마라 shadow 가 약하다. 계층 표현은:

1. **surface 단계 차이** (primary)
2. **border subtle** (보조)
3. **shadow** (3순위, lg/xl 만 사용 — modal, popover)

flat 디자인 지향. 카드 사이에 그림자 남발 금지.

## 6. Shapes

| 요소 | radius |
|---|---|
| 카드 (KpiCard / StatCard / TrancheCard / AreaChartCard) | `lg(12)` |
| 버튼 / 입력 | `md(8)` |
| 배지 / 칩 / pill | `full` |
| Avatar / 아이콘 컨테이너 | `full` 또는 `md` |

크기가 다른 요소가 같은 모서리 곡률을 가지면 안 된다 (시각 위계).

## 7. Components × States

`packages/design-system/src/components/` 의 컴포넌트가 표준. 새 화면은 우선 import. 직접 만들기 전에 기존 컴포넌트 확장 검토.

| 컴포넌트 | default | hover | active | focus | disabled |
|---|---|---|---|---|---|
| **PrimaryButton** | bg=`{colors.primary}` text=white | bg=`{colors.primary_hover}` | bg=`{colors.primary_active}` | + 2px outline `{colors.primary}` offset 2 | opacity 0.4, cursor not-allowed |
| **SegmentControl** | text=muted | text=primary bg=`{colors.surface_2}` | bg=`{colors.secondary}` text=on-secondary | outline | - |
| **KpiCard** | surface_1, value=text-3xl tabular | surface_2 (clickable variant) | - | - | - |
| **ListRow** | surface_1, border-bottom subtle | surface_2 | surface_3 | outline | - |
| **Checkbox** | border default | border primary | bg=primary check=white | + ring | opacity 0.4 |
| **AreaChartCard** | profit / loss / neutral 3 톤. gradient stop=color@0.4 → transparent | - | - | - | - |
| **TrancheCard** | header + 3-col grid | - | - | - | - |

## 8. Do's and Don'ts

### Do
- 토큰만 사용한다. hex 직접 입력 금지 (lint 대상).
- 변동률은 `{colors.profit}` / `{colors.loss}` + ▲/▼ 같은 비-색상 신호 병기.
- `tabular-nums` 를 가격·수량·시간에 항상 적용.
- 모바일 우선으로 작성하고 데스크탑 max-w 안에서 같은 레이아웃 유지.
- `prefers-reduced-motion` 을 존중 (animation 0ms).

### Don't
- ❌ AI slop 패턴: gradient pastel + 모서리 16px+ + emoji-heavy. 우리 톤 아님.
- ❌ `Primary` 색을 화면당 2개 이상 큰 액션에 사용.
- ❌ 일반 텍스트 강조에 profit/loss 색 사용 (예: 일반 강조 "중요!" 를 빨강).
- ❌ **시세(캔들/가격 변동률)에 `{colors.profit}` / `{colors.loss}` 사용**. 시세는 `{colors.quote_rise}` / `{colors.quote_fall}` 로 분리. P/L(전략 성과, 백테스트) 만 profit/loss 사용.
- ❌ 카드 그림자 남발 — shadow 는 modal/popover 만.
- ❌ 모호 사이즈 "조금 크게 / 살짝 어둡게" — 항상 토큰 값 명시.
- ❌ 토큰 외 색상 추가 시 review 없이 1회용으로 inline. 추가는 `tokens.css` PR 로.

## 9. Agent Prompt Guide

권장 프롬프트:

```
"DESIGN.md 의 토큰만 사용해 [화면명] 을 만들어.
- packages/design-system 컴포넌트 우선 import (KpiCard / StatCard / ListRow / SegmentControl / PrimaryButton / AreaChartCard / TrancheCard / Checkbox).
- 모바일 우선 + max-w-app 정렬.
- 변동률은 profit/loss 색 + ▲/▼ 병기.
- §7 매트릭스대로 hover/focus/disabled 상태 모두 구현.
- §8 의 Don't 위반 시 자체 거절."
```

## 10. 변경 / Versioning

- **patch**: 토큰 값 미세 조정, 오탈자 (이번 1.0.0 → 1.0.1)
- **minor**: 토큰 / 컴포넌트 신규 (1.0.x → 1.1.0)
- **major**: archetype 교체 (`dark-trading` → 다른 톤) — 별도 브랜치에서 작업 후 main 교체

변경 시 본 파일 YAML 의 `version` + `last_updated` 갱신, `packages/design-system/package.json` 도 동기 bump.

## 12. Archetype 2 — `k-heritage` (브랜드/제품 화면 전용)

`1989v.com` 의 브랜드 면은 **고대비 기술 미니멀리즘과 한국 전통 공간 감각의 합**이다.
데이터 밀도가 아니라 **읽히는 것**이 목적인 화면이라 `dark-trading` 의 전제가 맞지 않는다.
정서적 목표는 *따뜻한 정밀함(Warm Precision)* — 기술적으로 단단하되 장인의 손이 닿은 느낌.

**적용 범위**

| 화면 | 아키타입 |
|---|---|
| `/`, `/portfolio`, `resume.1989v.com` | `k-heritage` |
| `/shop/**` (로그인·주문·상세 포함), `place.1989v.com` | `k-heritage` |
| `/games/**`, `/tech` | `dark-trading` 유지 — 아케이드·데이터 시각화 |
| admin-fe, quant-fe, gifticon-fe | `dark-trading` 유지 |

**구현 규칙**

- 토큰 정의는 `portal-fe/src/styles/k-heritage.css` 한 곳. **`packages/design-system` 은
  건드리지 않는다** — 공유 토큰을 바꾸면 트레이딩·백오피스 화면까지 따라 바뀐다.
- 켜는 방법은 `useHeritageSurface()`. `:root` 에 `data-surface="heritage"` 를 걸고
  언마운트 시 되돌린다. 참조 카운트를 쓴다 — 라우트 전환에서 해제가 나중에 돌면 깜빡인다.
- **라이트와 다크가 둘 다 일급이다.** 한쪽이 파생이 아니다. 사용자 선택을 저장하고
  없으면 시스템 설정을 따른다 (`useHeritageTheme`).

**브랜드 상수** — 팔레트에서 근사하면 그냥 다른 색이 된다. hex 로 고정한다.

| 토큰 | 값 | 이름 | 역할 |
|---|---|---|---|
| `--kh-hanji` | `#F9F8F2` | 한지 | 라이트 바탕 |
| `--kh-giwa` | `#1D1D1F` | 기와 | 먹빛 구조·타이포·머리띠 |
| `--kh-ink` | `#0A0A0A` | 송연 | 다크 바탕, 가장 깊은 검정 |
| `--kh-pine` | `#1A472A` | 소나무 | 라이트 모드 상호작용 |
| `--kh-aged-pine` | `#3E4C3F` | 삭은 소나무 | 다크 모드 상호작용 |
| `--kh-yeonji` | `#A2231D` | 연지 | 인장·강조 낱말·중대 액션 |
| `--kh-ocher` | `#B38B6D` | 황토 | 테두리·라벨·야간 강조 |

**구조 토큰**

| 토큰 | 값 | 근거 |
|---|---|---|
| `--kh-void` | `clamp(5rem, 11vw, 8rem)` | 여백의 법칙 — 섹션 사이 죽은 공간 |
| `--kh-radius` | `4px` | 기본 |
| `--kh-radius-asym` | `0 12px 0 12px` | 좌상/우하 각짐, 우상/좌하 둥긂 |
| `--kh-display` | `clamp(2rem, 5vw, 3rem)` | 디스플레이 |
| `--kh-font-mono` | JetBrains Mono → 시스템 모노 | 기술 메타데이터 전용 |

**프리미티브** (`.kh-*`)

| 클래스 | 무엇 |
|---|---|
| `.kh-slab` | 라이트 모드에서도 어두운 카드 — "화면 속의 화면". 안쪽 텍스트 토큰까지 뒤집는다 |
| `.kh-slab-offset` | 흐린 그림자 대신 단단히 어긋난 판 하나 |
| `.kh-seal` / `.kh-seal-ink` | 인장(도장) — 연지색 낙관. 기본형은 먹빛 |
| `.kh-section-label` | 황토색 모노 섹션 라벨 |
| `.kh-display` / `.kh-display-accent` | 디스플레이 + **낱말 하나만** 연지색 |
| `.kh-button` / `.kh-button-ghost` | 먹빛 채움 / 테두리만 |
| `.kh-mono` | 기술 메타데이터 표기 |

**주의**

- **한글에 `text-transform: uppercase` / 넓은 자간을 걸지 않는다.** 대문자 변환은 효과가
  없고 자간만 벌어진다. 모노 라벨은 라틴 표기에만 쓴다.
- **강조는 문장이 아니라 낱말에 찍는다.** 연지색은 한 화면에 손에 꼽을 만큼만.
- 그림자를 쓰지 않는다. 깊이는 **면의 색 단차**와 **어긋난 판**으로 만든다.
- 큰 글자는 그릇의 60%를 넘지 않는다 — 침묵의 여백이 이 시스템의 뼈대다.

## 11. Related

- 표준 (이 파일의 작성 규칙): [`docs/standards/design-md.md`](docs/standards/design-md.md)
- 컨벤션 (Why / 안티패턴 상세): [`docs/conventions/frontend-design.md`](docs/conventions/frontend-design.md), [`docs/conventions/design-system.md`](docs/conventions/design-system.md)
- 토큰 코드 (Source of truth — CSS): [`packages/design-system/src/tokens.css`](packages/design-system/src/tokens.css)
- 컴포넌트 코드: [`packages/design-system/src/components/`](packages/design-system/src/components/)
- 룩북: `quant/frontend/src/pages/PortfolioDemoPage.tsx`, `TrancheDemoPage.tsx`
