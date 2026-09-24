import type { ConceptKind, HierarchyEdgeKind } from '../../types/graph';

/**
 * 노드 유형 — 이름·글리프(모양)·색 토큰. 색만으로 구분하지 않도록 모양을 같이 쓴다.
 * /tech 는 dark-trading 팔레트 고정이라 `--ko-*` 토큰만 쓴다(`--kh-*` 는 이 면에 없다).
 */
export const KIND_META: Record<ConceptKind, { label: string; glyph: string; color: string }> = {
  DOMAIN: { label: '진입', glyph: '◆', color: 'var(--ko-text-secondary)' },
  STAGE: { label: '단계', glyph: '●', color: 'var(--ko-accent-primary)' },
  MECHANISM: { label: '장치', glyph: '■', color: 'var(--ko-accent-secondary)' },
  TERM: { label: '용어', glyph: '○', color: 'var(--ko-text-muted)' },
  TECHNOLOGY: { label: '구현체', glyph: '▲', color: 'var(--ko-status-warning)' },
  PROBLEM: { label: '문제', glyph: '▼', color: 'var(--ko-status-loss)' },
  METRIC: { label: '지표', glyph: '◎', color: 'var(--ko-status-profit)' },
};

export const KIND_ORDER: ConceptKind[] = ['DOMAIN', 'STAGE', 'MECHANISM', 'TERM', 'TECHNOLOGY', 'PROBLEM', 'METRIC'];

/** 관계를 읽는 말 — 나가는 쪽 · 들어오는 쪽(역방향). 순서는 「탐색 순서」이지 선수 지식이 아니다 */
export const RELATION_LABELS: Record<string, string> = {
  CONTAINS: '포함',
  PART_OF: '속한 곳',
  FLOWS_TO: '다음 단계',
  FOLLOWS: '앞 단계',
  USES: '쓰는 것',
  USED_BY: '쓰이는 곳',
  IMPLEMENTS: '구현하는 것',
  IMPLEMENTED_BY: '구현체',
  AFFECTS: '영향 주는 지표',
  AFFECTED_BY: '영향 주는 것',
  CAUSES: '부르는 문제',
  CAUSED_BY: '원인',
  MITIGATES: '막는 문제',
  MITIGATED_BY: '막는 장치',
  MEASURED_BY: '재는 지표',
  MEASURES: '재는 대상',
  ALTERNATIVE_TO: '대안',
};

export type { HierarchyEdgeKind };
