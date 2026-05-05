import { CATEGORY_COLORS } from '../../types';
import type { Category } from '../../types';

/**
 * tileColor — 카테고리 → 단일 hex.
 *
 * 디자인 결정: 기존 TreemapPanel 의 단일 축(카테고리=색) 인코딩을 채택.
 * 같은 카테고리 = 동일 색상으로 그룹 응집감을 시각적으로 강화한다.
 * level 은 색상이 아닌 텍스트/툴팁/aria-label 에서만 표현.
 *
 * (이전 OKLCH 카테고리×레벨 다축 인코딩은 시각 노이즈가 커서 폐기 — 사용자 피드백)
 */

const FALLBACK = '#94a3b8';

export function tileColor(categoryKey: string | undefined): string {
  if (!categoryKey) return FALLBACK;
  return (CATEGORY_COLORS as Record<string, string>)[categoryKey] ?? FALLBACK;
}

/** 범례/chip dot 등에 사용 — 카테고리 hex 그대로. */
export function categorySwatch(categoryKey: string): string {
  return tileColor(categoryKey);
}

export const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS) as Category[];
