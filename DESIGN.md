<!-- source: packages/design-system/src/tokens.css, docs/conventions/frontend-design.md, docs/conventions/design-system.md -->
<!-- standard: docs/standards/design-md.md -->
---
version: 1.0.0
archetype: dark-trading
mood: [data-dense, calm-night, korean-fintech]
last_updated: 2026-05-08
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

    # Status (semantic — 직접 텍스트로 메시지 의미 표현 금지, 색만 사용 X)
    profit:          { hex: "#22c55e", oklch: "0.72 0.19 145", role: "positive deltas only" }
    profit_bg:       { oklch: "0.30 0.09 145" }
    loss:            { hex: "#ef4444", oklch: "0.65 0.22 25",  role: "negative deltas only" }
    loss_bg:         { oklch: "0.30 0.12 25" }
    warning:         { oklch: "0.80 0.15 75",  role: "caution / pending" }
    info:            { oklch: "0.75 0.10 240", role: "informational" }
    danger:          { hex: "#dc2626", oklch: "0.55 0.22 25", role: "destructive action (full-width stop)" }

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
| **Profit/Loss** | **delta(변동값) 표현에만 사용**. 일반 텍스트 강조에 녹/적 색 금지 (색맹 접근성 + 의미 오인). 항상 ▲/▼ 같은 형태 신호와 병기. |
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

## 11. Related

- 표준 (이 파일의 작성 규칙): [`docs/standards/design-md.md`](docs/standards/design-md.md)
- 컨벤션 (Why / 안티패턴 상세): [`docs/conventions/frontend-design.md`](docs/conventions/frontend-design.md), [`docs/conventions/design-system.md`](docs/conventions/design-system.md)
- 토큰 코드 (Source of truth — CSS): [`packages/design-system/src/tokens.css`](packages/design-system/src/tokens.css)
- 컴포넌트 코드: [`packages/design-system/src/components/`](packages/design-system/src/components/)
- 룩북: `quant/frontend/src/pages/PortfolioDemoPage.tsx`, `TrancheDemoPage.tsx`
