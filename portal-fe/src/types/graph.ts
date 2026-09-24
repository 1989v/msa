import type { Category, Level } from './index';

export interface GraphNode {
  id: string;
  name: string;
  category: Category;
  level: Level;
  indexCount: number;
  relatedCount: number;
  description?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  type: string;
}

export interface CategoryLevelMatrix {
  [category: string]: {
    [level: string]: number;
  };
}

export interface GraphStats {
  totalConcepts: number;
  totalIndexes: number;
  byCategory: Record<string, number>;
  byLevel: Record<string, number>;
  matrix: CategoryLevelMatrix;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  stats: GraphStats;
}

/** `GET /api/v1/concepts/graph/hierarchy` — CONTAINS 로 층을 센 DAG */
export interface HierarchyNode {
  id: string;
  name: string;
  category: Category;
  level: Level;
  /** 진입점이 0. 두 부모를 가지면 짧은 쪽 */
  depth: number;
  description?: string | null;
  /** 역할 축. 온톨로지 파일에 아직 놓이지 않은 개념은 null */
  kind?: ConceptKind | null;
}

/** 노드 유형 7종 — 판정은 개념 자체의 성격으로 (ADR-0100) */
export type ConceptKind = 'DOMAIN' | 'STAGE' | 'MECHANISM' | 'TERM' | 'TECHNOLOGY' | 'PROBLEM' | 'METRIC';

/** 관계 9종 */
export type HierarchyEdgeKind =
  | 'CONTAINS'
  | 'FLOWS_TO'
  | 'USES'
  | 'IMPLEMENTS'
  | 'AFFECTS'
  | 'CAUSES'
  | 'MITIGATES'
  | 'MEASURED_BY'
  | 'ALTERNATIVE_TO';

export interface HierarchyEdge {
  from: string;
  to: string;
  kind: HierarchyEdgeKind;
  ordinal: number;
  /** 관계의 「왜」와 적용 조건 */
  reason?: string | null;
  evidenceRef?: string | null;
}

/** `GET /api/v1/concepts/{conceptId}/relations` — 개념 하나의 이웃 전부(루트·도메인 무관) */
export interface RelationEdge {
  relation: HierarchyEdgeKind;
  /** 읽는 방향의 이름 — 들어오는 간선은 역방향(PART_OF · USED_BY …) */
  label: string;
  conceptId: string;
  name: string;
  conceptKind?: ConceptKind | null;
  reason?: string | null;
  evidenceRef?: string | null;
}

export interface ConceptRelations {
  concept: {
    id: string;
    name: string;
    kind?: ConceptKind | null;
    category: string;
    level: string;
    description?: string | null;
    managedBy?: string | null;
  };
  outgoing: RelationEdge[];
  incoming: RelationEdge[];
  evidence: { kind: string; ref: string; note?: string | null }[];
  questions: string[];
}

export interface ConceptHierarchy {
  roots: string[];
  nodes: HierarchyNode[];
  edges: HierarchyEdge[];
}

export interface SuggestItem {
  conceptId: string;
  name: string;
  category: Category;
  level: Level;
  description: string;
}

export interface ConceptDetail {
  id: number;
  conceptId: string;
  name: string;
  category: string;
  level: string;
  description: string;
  synonyms: string[];
  codeSnippets: CodeSnippetInfo[];
  relatedConcepts: RelatedConceptInfo[];
}

export interface CodeSnippetInfo {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  codeSnippet: string;
  gitUrl: string | null;
  description: string | null;
}

export interface RelatedConceptInfo {
  conceptId: string;
  name: string;
  category: string;
}

export interface GraphRenderer {
  focusNode: (nodeId: string, withSidePanel?: boolean) => void;
  highlightNodes: (nodeIds: string[]) => void;
  dimAllExcept: (nodeIds: string[]) => void;
  resetView: () => void;
}
