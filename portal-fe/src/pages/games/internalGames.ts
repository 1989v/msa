import { lazy, type ComponentType } from 'react';
import type { GraphNode } from '../../types/graph';

export interface InternalGameProps {
  nodes: GraphNode[];
}

/**
 * INTERNAL_ROUTE 게임 슬러그 → 내장 컴포넌트 매핑 (ADR-0059).
 * 서버 시드(V2__seed_internal_games.sql)의 entry_url 값과 키가 일치해야 한다.
 */
export const INTERNAL_GAMES: Record<string, ComponentType<InternalGameProps>> = {
  'concept-memory': lazy(() => import('../../components/quiz/MemoryGame')),
  'fill-blank-quiz': lazy(() => import('../../components/quiz/FillBlankQuiz')),
  'code-magnifier': lazy(() => import('../../components/quiz/CodeMagnifier')),
  'concept-cascade': lazy(() => import('../../components/quiz/ConceptCascade')),
};
