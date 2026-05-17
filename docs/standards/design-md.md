<!-- source: docs/conventions/frontend-design.md -->
<!-- source: DESIGN.md -->
# DESIGN.md 표준 (Standard)

AI 에이전트(Claude Code / Cursor / Stitch / Windsurf 등) 가 일관된 UI 를 생성하도록 하는 **단일 디자인 명세 파일** 의 작성 규칙.

> **배경**: AI 가 한 번에 만든 화면은 두 번째 페이지부터 톤이 무너진다. Google Stitch 의 design.md 포맷은 이 문제를 *프롬프트* 가 아닌 *체크인된 명세 파일* 로 푼다.
> 본 표준은 [Google Stitch design.md](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/) + [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) 의 패턴을 우리 모노레포(`packages/design-system` + `frontend-design.md`)에 맞춰 정리한 것.

---

## 1. 어디에 둔다

| 위치 | 용도 | 예시 |
|---|---|---|
| `DESIGN.md` (repo root) | 모노레포 전역 표준 인스턴스 — 모든 FE 가 디폴트로 따른다 | 우리 `DESIGN.md` |
| `<fe>/DESIGN.md` | 특정 FE 가 root 표준을 override / 확장 | `quant/frontend/DESIGN.md` (필요 시) |
| `<fe>/skills/<name>.md` | 베이스 위에 얹는 톤 modifier (neon / editorial / skeuomorphic) | `quant/frontend/skills/dark-trading.md` |

루트 `DESIGN.md` 는 항상 최신 채택 톤 1종만 둔다. 분기/실험은 skill 파일 또는 브랜치로.

## 2. 파일 구조 — YAML front-matter + Markdown 본문

```markdown
---
version: 1.0.0
archetype: dark-trading
last_updated: 2026-05-08
owners: [frontend-platform]
tokens:
  colors:
    primary: { hex: "#0ea5e9", oklch: "0.68 0.16 245", role: "actions, focus" }
    surface_0: { hex: "#0c1424", oklch: "0.17 0.025 252" }
    profit:    { hex: "#22c55e", role: "positive deltas only" }
    loss:      { hex: "#ef4444", role: "negative deltas only" }
  typography:
    family: "Pretendard, system-ui, sans-serif"
    scale: { xs: 11, sm: 13, md: 15, lg: 18, xl: 24, "2xl": 32 }
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 }
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32 }
  radius:  { sm: 6, md: 8, lg: 12, xl: 16, full: 9999 }
  motion:  { fast: "120ms", base: "200ms", easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
---

# 본문 (다음 절의 8 섹션 순서로)
```

YAML 은 단일 source-of-truth, 본문은 *이유 / 사용 규칙 / 안티패턴* 을 담는다. 토큰 값을 본문에 다시 적지 않는다 (drift 원인).

## 3. 본문 8 섹션 — 고정 순서 (필수)

1. **Overview** — 1~3문장 디자인 의도. archetype 한 단어 + 무드 키워드 3개 이내.
2. **Colors** — primary / secondary / surface / text / border / status / quote. 의미 역할 명시 ("primary 는 화면당 1개의 가장 중요한 액션에만"). **시세(캔들/가격 변동) 와 P/L(전략 성과) 의 색상은 의도적으로 분리한다** — 시세는 `quote_rise/fall` (한국 관습 — 상승 빨강 / 하락 파랑), P/L 은 `profit/loss` (글로벌 — 수익 녹색 / 손실 빨강). 두 의미를 같은 토큰으로 통합하면 "수익이 빨강" 처럼 의미가 충돌한다.
3. **Typography** — family + size scale + weight + line-height. "큰 글자" 같은 모호어 금지.
4. **Layout & Spacing** — 4px 베이스 grid, 컨테이너 max-width, 반응형 breakpoint, 터치 타겟 최소 44px.
5. **Elevation & Depth** — flat 인지 / shadow scale / border 로 대체 정책.
6. **Shapes** — radius scale 적용 정책 (카드 lg, 버튼 md, 입력 md, pill full).
7. **Components × States** — 버튼·입력·카드·내비 최소 4종 × `default / hover / active / focus / disabled` 매트릭스.
8. **Do's and Don'ts** — 부정형 가드레일 최소 5개. 영상 분석에서 가장 강조된 자유 제약 장치.

## 4. 토큰 참조 문법

YAML 토큰은 본문 / 컴포넌트 토큰에서 `{colors.primary}`, `{spacing.md}` 형태로 참조한다 (DTCG-호환). 컴포넌트 토큰이 색상 토큰을 inline hex 로 적으면 lint 에러.

## 5. 에이전트 진입 규약 (필수)

루트 표준이 자동 로드되도록 **다음 파일에 명시 참조** 를 둔다:

| 도구 | 파일 | 라인 |
|---|---|---|
| Claude Code | `CLAUDE.md` Skill Routing 절 | "FE 코드 작성 시 `DESIGN.md` 의 토큰을 우선 참조" |
| Cursor | `.cursorrules` | 동일 |
| Codex / Stitch | `AGENTS.md` 또는 프로젝트 README | 동일 |

이 1줄이 빠지면 표준이 무력화된다 (영상 분석 핵심 결론).

## 6. 운영 — Iteration vs Remix

- **Iteration** (90%): 같은 archetype 내에서 토큰 미세 조정. PR 1건당 토큰 변화 ≤ 5개 권장.
- **Remix** (10%): archetype 자체 교체. 새 `DESIGN.md` 를 별도 브랜치에서 작성 후 main 으로 교체.
- 모든 변경은 YAML `version` 을 [SemVer](https://semver.org) 로 bump:
  - **major**: archetype / 핵심 hue 교체
  - **minor**: 토큰 추가 / 컴포넌트 신규
  - **patch**: 값 미세 조정, 오탈자

## 7. 자동 검증 (Lint)

`scripts/lint-design-md.sh` (구현 예정) 가 다음을 강제:

- [ ] YAML front-matter 파싱 가능
- [ ] 8 섹션이 정확한 순서로 존재
- [ ] 색상 hex 가 본문에 직접 적힌 곳 없음 (모든 색상은 토큰 참조)
- [ ] WCAG AA: text 와 surface 조합이 4.5:1 (large text 3:1) 이상
- [ ] 모든 컴포넌트 토큰이 정의된 색상/스페이싱 토큰을 참조
- [ ] `version` 이 SemVer 형식
- [ ] Do's and Don'ts 항목 ≥ 5

CI 에 묶기 전까지는 PR 리뷰 시 사람이 동일 체크리스트로 검토.

## 8. 우리 모노레포에서의 매핑

| 표준 항목 | 우리 코드 위치 | 비고 |
|---|---|---|
| YAML 토큰 | `packages/design-system/src/tokens.css` | OKLCH 정의, hex 는 주석으로 병기 |
| 컴포넌트 매트릭스 | `packages/design-system/src/components/` | KpiCard, StatCard, ListRow, SegmentControl, PrimaryButton, AreaChartCard, Checkbox, TrancheCard |
| Tailwind export | 각 FE 의 `tailwind.config.ts` | tokens.css 의 CSS var 를 Tailwind theme 으로 wrap |
| 룩북 | `quant/frontend/src/pages/PortfolioDemoPage.tsx`, `TrancheDemoPage.tsx` | 샘플 1/2 정확 매칭 |
| 컨벤션 본문 | `docs/conventions/frontend-design.md` | AI slop 방지 등 본 표준의 *Why* 보완 |

## 9. Skill 레이어 (선택)

베이스 `DESIGN.md` 위에 "분위기 modifier" 를 별도 .md 로 stack 가능:

```markdown
# skills/neon-trading.md
---
extends: ../../DESIGN.md
overrides:
  tokens:
    colors:
      primary: { hex: "#39ff14", role: "neon CTA" }
  motion:
    base: "320ms"  # 더 느린 페이드
---
```

에이전트에게 "이 화면은 `skills/neon-trading.md` 적용" 이라고 지시하면 베이스 위에 override 합성.

## 10. 표준 프롬프트 예시 (Agent Prompt Guide)

DESIGN.md 가 있는 상태에서 권장 프롬프트:

```
"`DESIGN.md` 의 토큰만 사용해서 [화면명]을 만들어. hex 직접 입력 금지.
컴포넌트는 `packages/design-system` 의 것을 우선 import.
각 상태(hover / focus / disabled)를 §7 매트릭스대로 구현."
```

## 11. 채택 우선순위

영상 2개 분석에서 도출한 항목 중:

- **핵심 (Must)**: 1~10 장 — YAML+본문 / 8 섹션 / 토큰 참조 / 에이전트 진입 규약 / WCAG AA / version 필드
- **권장 (Should)**: §4 토큰 ref 문법, §7 lint, §8 Tailwind export, §9 skill 레이어
- **참고 (Could)**: §6 iteration/remix 비율, archetype 메타 필드, motion 토큰

## Refs

- [Google Stitch design.md format](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/)
- [awesome-design-md (VoltAgent)](https://github.com/VoltAgent/awesome-design-md)
- [designmd.app — what is design.md](https://designmd.app/en/what-is-design-md)
- 우리 자산: [docs/conventions/frontend-design.md](../conventions/frontend-design.md), [docs/conventions/design-system.md](../conventions/design-system.md)
