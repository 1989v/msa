import { type ComponentType } from 'react';
import type { GraphNode } from '../../types/graph';

export interface InternalGameProps {
  nodes: GraphNode[];
}

/**
 * INTERNAL_ROUTE 게임 슬러그 → 내장 컴포넌트 매핑 (ADR-0059).
 * 서버 시드의 entry_url 값과 키가 일치해야 한다.
 *
 * 지금은 비어 있다 — 개념 퀴즈 4종(V2 시드)이 학습 축과 함께 제거됐고(V76),
 * 남은 게임은 전부 IFRAME 이다. 등록되지 않은 슬러그는 GameDetailPage 가 안내 문구로 받는다.
 */
export const INTERNAL_GAMES: Record<string, ComponentType<InternalGameProps>> = {};
