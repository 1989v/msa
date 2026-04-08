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
  focusNode: (nodeId: string) => void;
  highlightNodes: (nodeIds: string[]) => void;
  dimAllExcept: (nodeIds: string[]) => void;
  resetView: () => void;
}
