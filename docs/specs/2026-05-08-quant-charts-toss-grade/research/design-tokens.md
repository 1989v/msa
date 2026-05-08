# 토스증권 디자인 토큰 (실측)

추출 출처: `tossinvest.com/stocks/A005930/order` 의 computed style — chrome-devtools `evaluate_script`.
캡쳐 일자: 2026-05-08.

---

## Surface (다크 4단계)

| Token | RGB | Hex | 용도 (관찰) |
|---|---|---|---|
| `surface-0` | `rgb(16, 16, 19)` | `#101013` | body / 최상위 배경 |
| `surface-1` | `rgb(23, 23, 28)` | `#17171C` | 카드/패널 배경 |
| `surface-2` | `rgb(28, 28, 34)` | `#1C1C22` | 안쪽 카드, hover |
| `surface-3` | `rgb(32, 32, 39)` | `#202027` | overlay, dropdown |
| `surface-4` | `rgb(44, 44, 53)` | `#2C2C35` | 더 강한 강조 |
| `surface-divider` | `rgb(77, 77, 89)` | `#4D4D59` | 구분 디바이더 |

## Border

| Token | Value |
|---|---|
| `border-subtle` | `rgba(217, 217, 255, 0.11)` |
| `border-strong` | `rgb(44, 44, 53)` |

## Text (alpha 기반 위계)

| Token | Value | 용도 |
|---|---|---|
| `text-primary` | `rgb(255, 255, 255)` (white) | 큰 가격, 핵심 |
| `text-high` | `rgba(253, 253, 254, 0.89)` | 헤드라인 |
| `text-body` | `rgb(195, 195, 198)` | 본문 |
| `text-muted` | `rgba(248, 248, 255, 0.6)` | 보조 |
| `text-dim` | `rgba(242, 242, 255, 0.47)` | 라벨, 캡션 |
| `text-disabled` | `rgb(158, 158, 164)` | 비활성 |

## Quote 색상 (한국 관습)

| Token | Value | 의미 |
|---|---|---|
| `quote-rise` (상승) | `rgb(250, 97, 109)` `#FA616D` | 빨강, 양봉 |
| `quote-rise-strong` | `rgb(240, 66, 81)` `#F04251` | 강한 양봉 |
| `quote-fall` (하락) | `rgb(52, 133, 250)` `#3485FA` | 파랑, 음봉 |
| `quote-fall-link` | `rgb(68, 155, 255)` `#449BFF` | 파랑 링크 hover |

## P/L 색상 (글로벌·미국식 — 일부 컴포넌트)

| Token | Value | 의미 |
|---|---|---|
| `status-profit` | `rgb(38, 207, 136)` `#26CF88` | 초록, 수익 |
| `status-loss` | `rgb(250, 97, 109)` `#FA616D` | 빨강, 손실 |

## 폰트

```css
font-family:
  "Toss Product Sans",  /* 자체 폰트 — 우리는 보유 X */
  Tossface,             /* 이모지 — 우리는 보유 X */
  -apple-system, "system-ui", "Bazier Square",
  "Noto Sans KR", "Segoe UI", "Apple SD Gothic Neo", Roboto,
  "Helvetica Neue", Arial, sans-serif,
  "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
```

**우리 적용**: `Pretendard` 우선 → `system-ui` → `Apple SD Gothic Neo` → `Noto Sans KR` fallback.
숫자에는 `font-variant-numeric: tabular-nums` 강제 (가격 정렬).

## 타이포 (관찰값)

| 요소 | size / weight / lh |
|---|---|
| 큰 가격 헤더 | 20px / 700 / 26px (sticky 시 축소 가능) |
| 종목명 | 14px / 700 |
| 종목코드 | 14px / 400 |
| 라벨 | 14px / 400 |
| 캡션 / 보조 | 11~12px / 500 |
| 변동률 | 14~16px / 500 |

## 우리 토큰 매핑 정책

이 사이클에서 **현재 `--ko-*` 토큰 시스템에 다음을 추가**:

```css
/* 한국 시세 관습 (캔들/가격 변동) */
--ko-quote-rise: oklch(0.66 0.20 25);     /* #FA616D 근사 */
--ko-quote-rise-strong: oklch(0.62 0.23 25);
--ko-quote-fall: oklch(0.66 0.20 250);    /* #3485FA 근사 */
--ko-quote-fall-link: oklch(0.72 0.18 250);

/* 기존 유지 (P/L 의미) */
--ko-status-profit: oklch(0.72 0.19 145);
--ko-status-loss: oklch(0.65 0.22 25);

/* surface 다크 4단계 (이미 존재 — 값 보정 가능) */
--ko-surface-0  /* 본문 배경 */
--ko-surface-1  /* 카드 */
--ko-surface-2  /* hover/inner */
--ko-surface-3  /* overlay */
```

**원칙**: 캔들/가격 변동에는 `--ko-quote-*`, P&L·수익률·전략 성과에는 `--ko-status-*`. 혼용 금지.

`DESIGN.md` 표준에 위 신규 토큰 등록 필요 (CLAUDE.md 의 DESIGN.md 표준 항목).
