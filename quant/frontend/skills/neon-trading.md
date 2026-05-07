<!-- source: DESIGN.md, docs/standards/design-md.md §9 -->
---
extends: ../../../DESIGN.md
name: neon-trading
mood: [neon, high-energy, night-active]
description: "베이스 dark-trading 위에 네온 강조를 얹은 modifier — 야간 공격적 매매 화면용."
intended_for: [quant/frontend/src/pages/ChartsPage.tsx, LiveTradingPage]
not_for: [PortfolioDemoPage, learn/* — 학습 톤은 차분 유지]
version: 0.1.0

overrides:
  tokens:
    colors:
      # primary 를 시안 → 네온 그린으로 — CTA 만 더 튀게
      primary:        { hex: "#39ff14", oklch: "0.85 0.30 145", role: "neon CTA only" }
      primary_hover:  { oklch: "0.90 0.30 145" }
      primary_active: { oklch: "0.78 0.30 145" }

      # accent secondary — 마젠타 (보조 액션 / 활성 segment)
      secondary:       { oklch: "0.72 0.28 330", role: "secondary toggle" }
      secondary_hover: { oklch: "0.78 0.28 330" }

      # surface 는 베이스 유지 — 본문 톤은 그대로 둬야 차트 가독성 보존

    motion:
      duration:
        # 네온의 잔상감 — 약간 느린 페이드
        normal: "240ms"
        slow:   "360ms"

  shadow:
    # 카드에 네온 그라데이션 글로우 (modal 만, 일반 카드엔 적용 금지)
    neon_primary: "0 0 24px rgba(57, 255, 20, 0.35), 0 0 48px rgba(57, 255, 20, 0.12)"
---

# Skill: neon-trading

베이스 [`DESIGN.md`](../../../DESIGN.md) 의 모든 토큰을 그대로 사용하되, **primary / secondary / motion** 만 네온 톤으로 swap. surface / typography / spacing / radius 는 베이스 유지.

## 적용 규칙

- 차트 분석 / 실매매 페이지에서 "공격적 톤" 이 필요할 때 layer 로 적용.
- 학습 / 포트폴리오 / 어드민 페이지엔 적용 금지 (베이스 톤 유지).
- 적용 시점은 페이지별 (root 토글 금지) — 페이지 컴포넌트 안에서 `data-skill="neon-trading"` 속성 + 해당 토큰 override CSS 적용.

## 사용 예 (에이전트 프롬프트)

```
"`DESIGN.md` 의 토큰을 사용하되, ChartsPage 의 매수/매도 CTA 와 segment 활성 색만
`quant/frontend/skills/neon-trading.md` 의 override 토큰을 적용해 주세요.
다른 surface/typography/spacing 은 베이스 유지."
```

## Don't

- ❌ 일반 텍스트 (body) 에 네온 색 사용.
- ❌ 카드 모두에 `neon_primary` shadow 추가 (modal / 단일 강조 요소만).
- ❌ profit / loss 색을 네온 그린으로 교체 — 의미론적 색은 베이스 유지.
- ❌ 페이지 진입 / nav transition 에 360ms 적용 (사용자 멀미 유발).

## Versioning

- 베이스 `DESIGN.md` major bump 시 본 skill 도 호환성 재확인.
- skill 자체의 version 은 별도 트랙 (`0.x.x` 실험 단계).
