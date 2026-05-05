import type { TreemapLevel } from '../../api/treemap';

/**
 * tileColor — 카테고리×레벨 → OKLCH 문자열.
 *
 * 인코딩 (네이버 증권 트리맵 스타일):
 *  - 카테고리 = hue (13 개 균등 분포, 360°/13 ≈ 27.7° 간격)
 *  - level    = lightness (BEGINNER 밝음 → ADVANCED 어둠) — 같은 카테고리 내 농도 변화
 *  - chroma   = 0.16 (기존 CATEGORY_COLORS hex 의 평균 채도와 정합 — 데이터 viz 의미 색상)
 *
 * 같은 카테고리의 concept 들은 hue 가 같아 자연스러운 그룹으로 식별되고,
 * level 차이는 같은 hue 내 lightness 단계로 구분된다.
 */

const CATEGORY_HUE: Record<string, number> = {
  BASICS: 15,              // warm red-orange
  DATA_STRUCTURE: 45,      // amber
  ALGORITHM: 75,           // yellow-green
  DESIGN_PATTERN: 105,     // green
  CONCURRENCY: 135,        // teal-green
  DISTRIBUTED_SYSTEM: 165, // teal
  ARCHITECTURE: 195,       // cyan
  INFRASTRUCTURE: 225,     // blue
  DATA: 255,               // indigo
  SECURITY: 285,           // violet
  NETWORK: 315,            // magenta
  TESTING: 345,            // pink-red
  LANGUAGE_FEATURE: 0,     // pure red (wraps around)
};

const LEVEL_LIGHTNESS: Record<TreemapLevel, number> = {
  BEGINNER: 0.80,
  INTERMEDIATE: 0.62,
  ADVANCED: 0.46,
};

// chroma 0.16 — 기존 CATEGORY_COLORS hex (#4ecdc4, #ff6b6b 등) 평균 채도와 정합.
// frontend-design.md 60-30-10 의 base UI chroma 0.005-0.015 범위는 의미 인코딩이
// 필요한 데이터 viz 에서 절충. WCAG AA 는 tileTextColor 가 동적으로 보장.
const CHROMA = 0.16;

export function tileColor(categoryKey: string | undefined, level: TreemapLevel | undefined): string {
  const hue = (categoryKey && CATEGORY_HUE[categoryKey]) ?? 220;
  const lightness = (level && LEVEL_LIGHTNESS[level]) ?? 0.62;
  return `oklch(${lightness} ${CHROMA} ${hue})`;
}

/**
 * 타일 위 텍스트 색상 — level lightness 에 따라 dark/light 자동 선택.
 * BEGINNER (0.80) / INTERMEDIATE (0.62) → 밝은 배경 → 어두운 텍스트
 * ADVANCED (0.46) → 어두운 배경 → 밝은 텍스트 (가독성 보장)
 */
export function tileTextColor(level: TreemapLevel | undefined): string {
  const lightness = (level && LEVEL_LIGHTNESS[level]) ?? 0.62;
  return lightness >= 0.55 ? '#0a0a14' : '#f1f5f9';
}

/** 카테고리 베이스 색상 (level=INTERMEDIATE 고정) — 범례/chip dot 등에 사용. */
export function categorySwatch(categoryKey: string): string {
  return tileColor(categoryKey, 'INTERMEDIATE');
}

/** 카테고리 hue 만 사용한 매우 옅은 배경 — depth=1 컨테이너용. */
export function categoryBackground(categoryKey: string): string {
  const hue = CATEGORY_HUE[categoryKey] ?? 220;
  return `oklch(0.18 0.04 ${hue})`;
}

export const ALL_CATEGORIES = Object.keys(CATEGORY_HUE);
