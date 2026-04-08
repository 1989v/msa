# Code-Dictionary Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** code-dictionary 프론트엔드에 3D 개념 그래프, 히트맵, 통계, 트리맵 시각화 + autocomplete 검색 강화를 추가한다.

**Architecture:** React 19 + react-force-graph-3d(Approach B) + Three.js 데모(Approach A)로 3D 그래프를 렌더링하고, embla-carousel으로 4패널 3D 회전목마를 구현한다. 백엔드는 graph 데이터 전용 API와 edge-ngram + jaso 분리 기반 suggest API를 추가한다.

**Tech Stack:** React 19, TypeScript, react-force-graph-3d, three, @react-three/fiber, @react-three/drei, d3-force-3d, recharts, embla-carousel-react, OpenSearch (edge-ngram + jaso analyzer)

**Spec:** `docs/specs/2026-04-09-code-dictionary-visualization-design.md`

---

## File Map

### Frontend — New Files

| File | Responsibility |
|------|---------------|
| `src/components/Carousel3D.tsx` | 3D 회전목마 캐러셀 (4패널 전환) |
| `src/components/Carousel3D.css` | 캐러셀 스타일 (perspective, transform) |
| `src/components/graph/GraphRenderer.ts` | 그래프 렌더러 인터페이스 |
| `src/components/graph/ForceGraph3D.tsx` | Approach B: react-force-graph-3d |
| `src/components/graph/ThreeJSGraph.tsx` | Approach A: react-three-fiber 데모 |
| `src/components/panels/HeatmapPanel.tsx` | 카테고리 × 난이도 히트맵 |
| `src/components/panels/StatsDashboard.tsx` | 통계 차트 |
| `src/components/panels/TreemapPanel.tsx` | 카테고리 계층 트리맵 |
| `src/components/DetailSidePanel.tsx` | 노드 클릭 시 상세 패널 |
| `src/components/DetailSidePanel.css` | 사이드 패널 스타일 |
| `src/components/AutocompleteDropdown.tsx` | Suggest 결과 드롭다운 |
| `src/components/AutocompleteDropdown.css` | 드롭다운 스타일 |
| `src/hooks/useGraphData.ts` | Graph API 호출 + 상태 관리 |
| `src/hooks/useSuggest.ts` | Suggest API + 디바운스 |
| `src/types/graph.ts` | 그래프/통계 타입 정의 |

### Frontend — Modified Files

| File | Changes |
|------|---------|
| `src/pages/SearchPage.tsx` | 전면 리팩토링 — 캐러셀 + 검색 + 사이드패널 통합 |
| `src/components/SearchBar.tsx` | Autocomplete 드롭다운 통합 |
| `src/api/searchApi.ts` | suggest, graph API 함수 추가 |
| `src/types/index.ts` | CATEGORY_COLORS 맵 추가 |
| `src/index.css` | 다크 테마 기본, 새 레이아웃 스타일 |

### Backend — New Files

| File | Responsibility |
|------|---------------|
| `application/graph/dto/GraphDtos.kt` | Graph API 응답 DTO |
| `application/graph/service/GraphService.kt` | 그래프 데이터 조합 서비스 |
| `application/search/dto/SuggestDtos.kt` | Suggest API DTO |
| `presentation/graph/controller/GraphController.kt` | `/api/v1/concepts/graph` |
| `presentation/search/controller/SuggestController.kt` | `/api/v1/search/suggest` |

### Backend — Modified Files

| File | Changes |
|------|---------|
| `infrastructure/opensearch/adapter/ConceptIndexingAdapter.kt` | edge-ngram + jaso analyzer 추가 |
| `infrastructure/opensearch/adapter/ConceptSearchAdapter.kt` | suggest 검색 메서드 추가 |
| `application/search/port/ConceptSearchPort.kt` | suggest 메서드 추가 |
| `application/concept/port/ConceptRepositoryPort.kt` | findAllWithRelations 추가 |

All backend paths are relative to: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/`

---

## Task 1: Frontend 의존성 설치

**Files:**
- Modify: `code-dictionary/frontend/package.json`

- [ ] **Step 1: npm 패키지 설치**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/code-dictionary/frontend
npm install react-force-graph-3d three @react-three/fiber @react-three/drei d3-force-3d recharts embla-carousel-react
npm install -D @types/three @types/d3-force-3d
```

- [ ] **Step 2: 설치 확인**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/code-dictionary/frontend
npx tsc --noEmit
```

Expected: 컴파일 에러 없음

- [ ] **Step 3: Commit**

```bash
git add code-dictionary/frontend/package.json code-dictionary/frontend/package-lock.json
git commit -m "chore(code-dictionary): add visualization dependencies"
```

---

## Task 2: 프론트엔드 타입 정의

**Files:**
- Create: `code-dictionary/frontend/src/types/graph.ts`
- Modify: `code-dictionary/frontend/src/types/index.ts`

- [ ] **Step 1: graph.ts 타입 파일 생성**

```typescript
// src/types/graph.ts
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
```

- [ ] **Step 2: index.ts에 CATEGORY_COLORS 추가**

`code-dictionary/frontend/src/types/index.ts` 파일 하단에 추가:

```typescript
export const CATEGORY_COLORS: Record<Category, string> = {
  BASICS: '#4ecdc4',
  DATA_STRUCTURE: '#45b7d1',
  ALGORITHM: '#96ceb4',
  DESIGN_PATTERN: '#6c63ff',
  CONCURRENCY: '#ff6b6b',
  DISTRIBUTED_SYSTEM: '#ffd93d',
  ARCHITECTURE: '#a29bfe',
  INFRASTRUCTURE: '#fd79a8',
  DATA: '#00b894',
  SECURITY: '#e17055',
  NETWORK: '#0984e3',
  TESTING: '#00cec9',
  LANGUAGE_FEATURE: '#fdcb6e',
};
```

- [ ] **Step 3: 타입 체크**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/code-dictionary/frontend
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add code-dictionary/frontend/src/types/
git commit -m "feat(code-dictionary): add graph and visualization type definitions"
```

---

## Task 3: API 클라이언트 확장

**Files:**
- Modify: `code-dictionary/frontend/src/api/searchApi.ts`

- [ ] **Step 1: suggest와 graph API 함수 추가**

`searchApi.ts`에 기존 코드 아래에 추가:

```typescript
import type { GraphData, SuggestItem, ConceptDetail } from '../types/graph';

export const suggestConcepts = async (
  query: string,
  size = 8
): Promise<SuggestItem[]> => {
  const params = new URLSearchParams({ q: query, size: String(size) });
  const res = await api.get<ApiResponse<SuggestItem[]>>(`/api/v1/search/suggest?${params}`);
  return res.data.data;
};

export const fetchGraphData = async (): Promise<GraphData> => {
  const res = await api.get<ApiResponse<GraphData>>('/api/v1/concepts/graph');
  return res.data.data;
};

export const fetchConceptDetail = async (conceptId: string): Promise<ConceptDetail> => {
  const res = await api.get<ApiResponse<ConceptDetail>>(`/api/v1/concepts/by-concept-id/${conceptId}`);
  return res.data.data;
};
```

- [ ] **Step 2: 타입 체크**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/code-dictionary/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add code-dictionary/frontend/src/api/searchApi.ts
git commit -m "feat(code-dictionary): add suggest, graph, concept detail API clients"
```

---

## Task 4: useGraphData 훅

**Files:**
- Create: `code-dictionary/frontend/src/hooks/useGraphData.ts`

- [ ] **Step 1: 훅 구현**

```typescript
// src/hooks/useGraphData.ts
import { useState, useEffect } from 'react';
import { fetchGraphData } from '../api/searchApi';
import type { GraphData } from '../types/graph';

export function useGraphData() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchGraphData()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load graph data');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}
```

- [ ] **Step 2: Commit**

```bash
git add code-dictionary/frontend/src/hooks/useGraphData.ts
git commit -m "feat(code-dictionary): add useGraphData hook"
```

---

## Task 5: useSuggest 훅

**Files:**
- Create: `code-dictionary/frontend/src/hooks/useSuggest.ts`

- [ ] **Step 1: 훅 구현**

```typescript
// src/hooks/useSuggest.ts
import { useState, useEffect, useRef } from 'react';
import { suggestConcepts } from '../api/searchApi';
import type { SuggestItem } from '../types/graph';

export function useSuggest(query: string, debounceMs = 300) {
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim()) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const result = await suggestConcepts(query.trim());
        setSuggestions(result);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs]);

  const clear = () => setSuggestions([]);

  return { suggestions, loading, clear };
}
```

- [ ] **Step 2: Commit**

```bash
git add code-dictionary/frontend/src/hooks/useSuggest.ts
git commit -m "feat(code-dictionary): add useSuggest hook with debounce"
```

---

## Task 6: AutocompleteDropdown 컴포넌트

**Files:**
- Create: `code-dictionary/frontend/src/components/AutocompleteDropdown.tsx`
- Create: `code-dictionary/frontend/src/components/AutocompleteDropdown.css`

- [ ] **Step 1: CSS 파일 생성**

```css
/* src/components/AutocompleteDropdown.css */
.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: rgba(26, 26, 46, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(108, 99, 255, 0.3);
  border-top: none;
  border-radius: 0 0 16px 16px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 30;
}

.autocomplete-item {
  padding: 10px 16px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.15s;
}

.autocomplete-item:last-child {
  border-bottom: none;
}

.autocomplete-item:hover,
.autocomplete-item.active {
  background: rgba(108, 99, 255, 0.15);
}

.autocomplete-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.autocomplete-item-name {
  font-weight: 600;
  color: #e0e0e0;
  font-size: 14px;
}

.autocomplete-item-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  color: #fff;
  font-weight: 500;
}

.autocomplete-item-desc {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
```

- [ ] **Step 2: 컴포넌트 구현**

```tsx
// src/components/AutocompleteDropdown.tsx
import type { SuggestItem } from '../types/graph';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../types';
import './AutocompleteDropdown.css';

interface AutocompleteDropdownProps {
  items: SuggestItem[];
  activeIndex: number;
  onSelect: (item: SuggestItem) => void;
}

export default function AutocompleteDropdown({ items, activeIndex, onSelect }: AutocompleteDropdownProps) {
  if (items.length === 0) return null;

  return (
    <div className="autocomplete-dropdown">
      {items.map((item, index) => (
        <div
          key={item.conceptId}
          className={`autocomplete-item ${index === activeIndex ? 'active' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
        >
          <div className="autocomplete-item-header">
            <span className="autocomplete-item-name">{item.name}</span>
            <span
              className="autocomplete-item-badge"
              style={{ background: CATEGORY_COLORS[item.category] }}
            >
              {CATEGORY_LABELS[item.category]}
            </span>
          </div>
          <span className="autocomplete-item-desc">{item.description}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 타입 체크**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/code-dictionary/frontend
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add code-dictionary/frontend/src/components/AutocompleteDropdown.tsx code-dictionary/frontend/src/components/AutocompleteDropdown.css
git commit -m "feat(code-dictionary): add AutocompleteDropdown component"
```

---

## Task 7: SearchBar 리팩토링 (Autocomplete 통합)

**Files:**
- Modify: `code-dictionary/frontend/src/components/SearchBar.tsx`

- [ ] **Step 1: SearchBar에 autocomplete 기능 추가**

전체 교체:

```tsx
// src/components/SearchBar.tsx
import { useState, useRef } from 'react';
import { useSuggest } from '../hooks/useSuggest';
import AutocompleteDropdown from './AutocompleteDropdown';
import type { SuggestItem } from '../types/graph';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onSelectConcept: (conceptId: string) => void;
}

export default function SearchBar({ onSearch, onSelectConcept }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { suggestions, clear } = useSuggest(query);

  const handleSelect = (item: SuggestItem) => {
    setQuery(item.name);
    setShowDropdown(false);
    clear();
    onSelectConcept(item.conceptId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        handleSelect(suggestions[activeIndex]);
      } else if (query.trim()) {
        setShowDropdown(false);
        clear();
        onSearch(query.trim());
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      clear();
    }
  };

  const handleChange = (value: string) => {
    setQuery(value);
    setActiveIndex(-1);
    setShowDropdown(value.trim().length > 0);
  };

  return (
    <div className="search-bar-wrapper" style={{ position: 'relative' }}>
      <div className="search-bar-floating">
        <span className="search-icon">🔍</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search concepts..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          className="search-input-floating"
        />
        <kbd className="search-shortcut">⌘K</kbd>
      </div>
      {showDropdown && (
        <AutocompleteDropdown
          items={suggestions}
          activeIndex={activeIndex}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/code-dictionary/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add code-dictionary/frontend/src/components/SearchBar.tsx
git commit -m "feat(code-dictionary): integrate autocomplete into SearchBar"
```

---

## Task 8: GraphRenderer 인터페이스 + ForceGraph3D (Approach B)

**Files:**
- Create: `code-dictionary/frontend/src/components/graph/GraphRenderer.ts`
- Create: `code-dictionary/frontend/src/components/graph/ForceGraph3D.tsx`

- [ ] **Step 1: GraphRenderer 인터페이스**

```typescript
// src/components/graph/GraphRenderer.ts
export type { GraphRenderer } from '../../types/graph';
```

- [ ] **Step 2: ForceGraph3D 컴포넌트 구현**

```tsx
// src/components/graph/ForceGraph3D.tsx
import { useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import ForceGraph3DComponent from 'react-force-graph-3d';
import type { GraphNode, GraphLink, GraphRenderer } from '../../types/graph';
import { CATEGORY_COLORS } from '../../types';
import type { Category } from '../../types';

interface ForceGraph3DProps {
  nodes: GraphNode[];
  links: GraphLink[];
  highlightedNodes: Set<string>;
  dimmed: boolean;
  onNodeClick: (node: GraphNode) => void;
  onBackgroundClick: () => void;
  width: number;
  height: number;
}

const ForceGraph3D = forwardRef<GraphRenderer, ForceGraph3DProps>(
  ({ nodes, links, highlightedNodes, dimmed, onNodeClick, onBackgroundClick, width, height }, ref) => {
    const fgRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      focusNode(nodeId: string) {
        const node = nodes.find((n) => n.id === nodeId);
        if (node && fgRef.current) {
          const distance = 120;
          const n = node as any;
          fgRef.current.cameraPosition(
            { x: n.x + distance, y: n.y + distance / 2, z: n.z + distance },
            { x: n.x, y: n.y, z: n.z },
            1000
          );
        }
      },
      highlightNodes(_nodeIds: string[]) {
        // Handled via highlightedNodes prop
      },
      dimAllExcept(_nodeIds: string[]) {
        // Handled via dimmed + highlightedNodes props
      },
      resetView() {
        if (fgRef.current) {
          fgRef.current.cameraPosition({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 1000);
        }
      },
    }));

    const nodeColor = useCallback(
      (node: GraphNode) => {
        const color = CATEGORY_COLORS[node.category as Category] || '#888';
        if (dimmed && !highlightedNodes.has(node.id)) {
          return `${color}1a`; // 10% opacity hex
        }
        return color;
      },
      [dimmed, highlightedNodes]
    );

    const nodeVal = useCallback(
      (node: GraphNode) => Math.max(2, node.relatedCount * 2),
      []
    );

    const nodeOpacity = useCallback(
      (node: GraphNode) => {
        if (dimmed && !highlightedNodes.has(node.id)) return 0.1;
        const brightness = Math.min(1, 0.4 + (node.indexCount / 10) * 0.6);
        return brightness;
      },
      [dimmed, highlightedNodes]
    );

    const nodeLabel = useCallback(
      (node: GraphNode) => `${node.name}\n${node.category} · ${node.level}`,
      []
    );

    return (
      <ForceGraph3DComponent
        ref={fgRef}
        graphData={{ nodes, links }}
        nodeId="id"
        nodeLabel={nodeLabel}
        nodeColor={nodeColor}
        nodeVal={nodeVal}
        nodeOpacity={nodeOpacity}
        linkColor={() => 'rgba(108, 99, 255, 0.2)'}
        linkWidth={0.5}
        onNodeClick={(node: any) => onNodeClick(node as GraphNode)}
        onBackgroundClick={onBackgroundClick}
        backgroundColor="rgba(0,0,0,0)"
        width={width}
        height={height}
        showNavInfo={false}
      />
    );
  }
);

ForceGraph3D.displayName = 'ForceGraph3D';
export default ForceGraph3D;
```

- [ ] **Step 3: 타입 체크**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/code-dictionary/frontend
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add code-dictionary/frontend/src/components/graph/
git commit -m "feat(code-dictionary): add ForceGraph3D renderer (Approach B)"
```

---

## Task 9: ThreeJSGraph (Approach A 데모)

**Files:**
- Create: `code-dictionary/frontend/src/components/graph/ThreeJSGraph.tsx`

- [ ] **Step 1: Three.js 데모 렌더러 구현**

```tsx
// src/components/graph/ThreeJSGraph.tsx
import { useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
} from 'd3-force-3d';
import type { GraphNode, GraphLink, GraphRenderer } from '../../types/graph';
import { CATEGORY_COLORS } from '../../types';
import type { Category } from '../../types';

interface ThreeJSGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  highlightedNodes: Set<string>;
  dimmed: boolean;
  onNodeClick: (node: GraphNode) => void;
  onBackgroundClick: () => void;
  width: number;
  height: number;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  z: number;
}

function useForceLayout(nodes: GraphNode[], links: GraphLink[]): SimNode[] {
  return useMemo(() => {
    const simNodes: SimNode[] = nodes.map((n) => ({ ...n, x: 0, y: 0, z: 0 }));
    const simLinks = links.map((l) => ({ ...l }));

    const sim = forceSimulation(simNodes, 3)
      .force('charge', forceManyBody().strength(-80))
      .force('link', forceLink(simLinks).id((d: any) => d.id).distance(40))
      .force('center', forceCenter())
      .stop();

    for (let i = 0; i < 120; i++) sim.tick();
    return simNodes;
  }, [nodes, links]);
}

function NodeMesh({
  node,
  highlighted,
  dimmed,
  onClick,
}: {
  node: SimNode;
  highlighted: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = CATEGORY_COLORS[node.category as Category] || '#888';
  const radius = Math.max(1.5, node.relatedCount * 0.8);
  const opacity = dimmed && !highlighted ? 0.1 : Math.min(1, 0.4 + (node.indexCount / 10) * 0.6);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.lerp(new THREE.Vector3(node.x, node.y, node.z), 0.1);
    }
  });

  return (
    <group>
      <mesh ref={meshRef} position={[node.x, node.y, node.z]} onClick={onClick}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} emissive={color} emissiveIntensity={highlighted ? 0.5 : 0.1} />
      </mesh>
      <Text position={[node.x, node.y + radius + 1.5, node.z]} fontSize={1.2} color="#ccc" anchorX="center" anchorY="bottom">
        {node.name}
      </Text>
    </group>
  );
}

function LinkLine({ source, target, dimmed }: { source: SimNode; target: SimNode; dimmed: boolean }) {
  const points = useMemo(
    () => [new THREE.Vector3(source.x, source.y, source.z), new THREE.Vector3(target.x, target.y, target.z)],
    [source, target]
  );
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color="#6c63ff" transparent opacity={dimmed ? 0.03 : 0.15} />
    </line>
  );
}

function CameraController({ targetRef }: { targetRef: React.RefObject<THREE.Vector3 | null> }) {
  const { camera } = useThree();

  useFrame(() => {
    if (targetRef.current) {
      const target = targetRef.current;
      camera.position.lerp(
        new THREE.Vector3(target.x + 80, target.y + 40, target.z + 80),
        0.02
      );
      camera.lookAt(target);
    }
  });

  return <OrbitControls enableDamping dampingFactor={0.1} />;
}

const ThreeJSGraph = forwardRef<GraphRenderer, ThreeJSGraphProps>(
  ({ nodes, links, highlightedNodes, dimmed, onNodeClick, onBackgroundClick, width, height }, ref) => {
    const simNodes = useForceLayout(nodes, links);
    const cameraTarget = useRef<THREE.Vector3 | null>(null);

    const nodeMap = useMemo(() => {
      const map = new Map<string, SimNode>();
      simNodes.forEach((n) => map.set(n.id, n));
      return map;
    }, [simNodes]);

    useImperativeHandle(ref, () => ({
      focusNode(nodeId: string) {
        const node = nodeMap.get(nodeId);
        if (node) {
          cameraTarget.current = new THREE.Vector3(node.x, node.y, node.z);
        }
      },
      highlightNodes() {},
      dimAllExcept() {},
      resetView() {
        cameraTarget.current = new THREE.Vector3(0, 0, 0);
      },
    }));

    return (
      <Canvas
        style={{ width, height, background: 'transparent' }}
        camera={{ position: [0, 0, 200], fov: 60 }}
        onPointerMissed={onBackgroundClick}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[100, 100, 100]} intensity={0.8} />
        <CameraController targetRef={cameraTarget} />

        {links.map((link, i) => {
          const source = nodeMap.get(typeof link.source === 'string' ? link.source : (link.source as any).id);
          const target = nodeMap.get(typeof link.target === 'string' ? link.target : (link.target as any).id);
          if (!source || !target) return null;
          return <LinkLine key={i} source={source} target={target} dimmed={dimmed} />;
        })}

        {simNodes.map((node) => (
          <NodeMesh
            key={node.id}
            node={node}
            highlighted={highlightedNodes.has(node.id)}
            dimmed={dimmed}
            onClick={() => onNodeClick(node)}
          />
        ))}
      </Canvas>
    );
  }
);

ThreeJSGraph.displayName = 'ThreeJSGraph';
export default ThreeJSGraph;
```

- [ ] **Step 2: 타입 체크**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/code-dictionary/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add code-dictionary/frontend/src/components/graph/ThreeJSGraph.tsx
git commit -m "feat(code-dictionary): add ThreeJSGraph renderer (Approach A demo)"
```

---

## Task 10: 3D 캐러셀 컴포넌트

**Files:**
- Create: `code-dictionary/frontend/src/components/Carousel3D.tsx`
- Create: `code-dictionary/frontend/src/components/Carousel3D.css`

- [ ] **Step 1: CSS 파일 생성**

```css
/* src/components/Carousel3D.css */
.carousel-container {
  position: relative;
  width: 100%;
  height: calc(100vh - 80px);
  perspective: 1400px;
  overflow: hidden;
}

.carousel-viewport {
  position: relative;
  width: 100%;
  height: 100%;
}

.carousel-slide {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.6s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.6s ease, filter 0.6s ease;
  border-radius: 20px;
  overflow: hidden;
}

.carousel-slide.active {
  width: 90%;
  height: 100%;
  left: 5%;
  transform: translateZ(0) rotateY(0deg);
  opacity: 1;
  filter: none;
  z-index: 10;
}

.carousel-slide.prev {
  width: 160px;
  height: 55%;
  left: -4%;
  top: 15%;
  transform: rotateY(42deg) scale(0.55) translateZ(-80px);
  opacity: 0.35;
  filter: blur(1.5px);
  z-index: 1;
  cursor: pointer;
}

.carousel-slide.next {
  width: 160px;
  height: 55%;
  right: -4%;
  left: auto;
  top: 15%;
  transform: rotateY(-42deg) scale(0.55) translateZ(-80px);
  opacity: 0.35;
  filter: blur(1.5px);
  z-index: 1;
  cursor: pointer;
}

.carousel-slide.hidden {
  opacity: 0;
  pointer-events: none;
  z-index: 0;
}

.carousel-indicators {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  z-index: 20;
}

.carousel-dot {
  width: 28px;
  height: 3px;
  border-radius: 2px;
  background: #333;
  cursor: pointer;
  border: none;
  padding: 0;
  transition: background 0.3s;
}

.carousel-dot.active {
  background: #6c63ff;
}

.carousel-labels {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 32px;
  z-index: 20;
}

.carousel-label {
  font-size: 11px;
  color: #555;
  cursor: pointer;
  transition: color 0.3s;
}

.carousel-label.active {
  color: #6c63ff;
  font-weight: 600;
}
```

- [ ] **Step 2: Carousel3D 컴포넌트 구현**

```tsx
// src/components/Carousel3D.tsx
import { useState, type ReactNode } from 'react';
import './Carousel3D.css';

interface CarouselPanel {
  key: string;
  label: string;
  content: ReactNode;
  preview: ReactNode;
}

interface Carousel3DProps {
  panels: CarouselPanel[];
  activeIndex?: number;
  onActiveChange?: (index: number) => void;
}

export default function Carousel3D({ panels, activeIndex: controlledIndex, onActiveChange }: Carousel3DProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const activeIdx = controlledIndex ?? internalIndex;

  const setActive = (idx: number) => {
    const clamped = ((idx % panels.length) + panels.length) % panels.length;
    setInternalIndex(clamped);
    onActiveChange?.(clamped);
  };

  const getSlideClass = (index: number) => {
    if (index === activeIdx) return 'active';
    const prev = ((activeIdx - 1) + panels.length) % panels.length;
    const next = (activeIdx + 1) % panels.length;
    if (index === prev) return 'prev';
    if (index === next) return 'next';
    return 'hidden';
  };

  return (
    <div className="carousel-container">
      <div className="carousel-viewport">
        {panels.map((panel, index) => {
          const slideClass = getSlideClass(index);
          return (
            <div
              key={panel.key}
              className={`carousel-slide ${slideClass}`}
              onClick={slideClass !== 'active' && slideClass !== 'hidden' ? () => setActive(index) : undefined}
            >
              {slideClass === 'active' ? panel.content : panel.preview}
            </div>
          );
        })}
      </div>

      <div className="carousel-indicators">
        {panels.map((_, i) => (
          <button
            key={i}
            className={`carousel-dot ${i === activeIdx ? 'active' : ''}`}
            onClick={() => setActive(i)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 타입 체크 + Commit**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/code-dictionary/frontend && npx tsc --noEmit
git add code-dictionary/frontend/src/components/Carousel3D.tsx code-dictionary/frontend/src/components/Carousel3D.css
git commit -m "feat(code-dictionary): add 3D carousel component"
```

---

## Task 11: DetailSidePanel 컴포넌트

**Files:**
- Create: `code-dictionary/frontend/src/components/DetailSidePanel.tsx`
- Create: `code-dictionary/frontend/src/components/DetailSidePanel.css`

- [ ] **Step 1: CSS 파일 생성**

```css
/* src/components/DetailSidePanel.css */
.detail-side-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 380px;
  height: 100vh;
  background: rgba(13, 13, 26, 0.95);
  backdrop-filter: blur(16px);
  border-left: 1px solid rgba(108, 99, 255, 0.2);
  z-index: 50;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
  overflow-y: auto;
  padding: 24px;
}

.detail-side-panel.open {
  transform: translateX(0);
}

.detail-panel-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: 1px solid #333;
  border-radius: 8px;
  color: #888;
  font-size: 18px;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-panel-close:hover {
  border-color: #6c63ff;
  color: #fff;
}

.detail-panel-header {
  margin-bottom: 20px;
}

.detail-panel-name {
  font-size: 20px;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0 0 8px;
}

.detail-panel-badges {
  display: flex;
  gap: 8px;
}

.detail-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  color: #fff;
  font-weight: 500;
}

.detail-panel-section {
  margin-bottom: 20px;
}

.detail-panel-section h3 {
  font-size: 13px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 8px;
}

.detail-panel-description {
  color: #bbb;
  font-size: 14px;
  line-height: 1.6;
}

.detail-snippet {
  background: #111;
  border: 1px solid #222;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
}

.detail-snippet-path {
  font-size: 11px;
  color: #666;
  margin-bottom: 6px;
}

.detail-snippet-path a {
  color: #6c63ff;
  text-decoration: none;
}

.detail-snippet-code {
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  color: #ccc;
  white-space: pre-wrap;
  max-height: 150px;
  overflow-y: auto;
}

.detail-related-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.detail-related-item {
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  color: #aaa;
  font-size: 13px;
  transition: background 0.15s;
}

.detail-related-item:hover {
  background: rgba(108, 99, 255, 0.1);
  color: #e0e0e0;
}
```

- [ ] **Step 2: 컴포넌트 구현**

```tsx
// src/components/DetailSidePanel.tsx
import { useState, useEffect } from 'react';
import { fetchConceptDetail } from '../api/searchApi';
import type { ConceptDetail } from '../types/graph';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../types';
import type { Category } from '../types';
import './DetailSidePanel.css';

const LEVEL_COLORS: Record<string, string> = {
  BEGINNER: '#00b894',
  INTERMEDIATE: '#fdcb6e',
  ADVANCED: '#e17055',
};

interface DetailSidePanelProps {
  conceptId: string | null;
  onClose: () => void;
  onNavigate: (conceptId: string) => void;
}

export default function DetailSidePanel({ conceptId, onClose, onNavigate }: DetailSidePanelProps) {
  const [detail, setDetail] = useState<ConceptDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conceptId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    fetchConceptDetail(conceptId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [conceptId]);

  return (
    <div className={`detail-side-panel ${conceptId ? 'open' : ''}`}>
      <button className="detail-panel-close" onClick={onClose}>✕</button>

      {loading && <p style={{ color: '#888' }}>Loading...</p>}

      {detail && !loading && (
        <>
          <div className="detail-panel-header">
            <h2 className="detail-panel-name">{detail.name}</h2>
            <div className="detail-panel-badges">
              <span className="detail-badge" style={{ background: CATEGORY_COLORS[detail.category as Category] }}>
                {CATEGORY_LABELS[detail.category as Category]}
              </span>
              <span className="detail-badge" style={{ background: LEVEL_COLORS[detail.level] || '#888' }}>
                {detail.level}
              </span>
            </div>
          </div>

          <div className="detail-panel-section">
            <h3>Description</h3>
            <p className="detail-panel-description">{detail.description}</p>
          </div>

          {detail.codeSnippets.length > 0 && (
            <div className="detail-panel-section">
              <h3>Code Snippets</h3>
              {detail.codeSnippets.map((snippet, i) => (
                <div key={i} className="detail-snippet">
                  <div className="detail-snippet-path">
                    {snippet.gitUrl ? (
                      <a href={snippet.gitUrl} target="_blank" rel="noopener noreferrer">
                        {snippet.filePath}:{snippet.lineStart}-{snippet.lineEnd}
                      </a>
                    ) : (
                      `${snippet.filePath}:${snippet.lineStart}-${snippet.lineEnd}`
                    )}
                  </div>
                  <pre className="detail-snippet-code">{snippet.codeSnippet}</pre>
                </div>
              ))}
            </div>
          )}

          {detail.relatedConcepts.length > 0 && (
            <div className="detail-panel-section">
              <h3>Related Concepts</h3>
              <ul className="detail-related-list">
                {detail.relatedConcepts.map((rc) => (
                  <li key={rc.conceptId} className="detail-related-item" onClick={() => onNavigate(rc.conceptId)}>
                    {rc.name}
                    <span style={{ marginLeft: 6, fontSize: 10, color: '#666' }}>{rc.category}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 타입 체크 + Commit**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/code-dictionary/frontend && npx tsc --noEmit
git add code-dictionary/frontend/src/components/DetailSidePanel.tsx code-dictionary/frontend/src/components/DetailSidePanel.css
git commit -m "feat(code-dictionary): add DetailSidePanel component"
```

---

## Task 12: HeatmapPanel 컴포넌트

**Files:**
- Create: `code-dictionary/frontend/src/components/panels/HeatmapPanel.tsx`

- [ ] **Step 1: 구현**

```tsx
// src/components/panels/HeatmapPanel.tsx
import type { CategoryLevelMatrix } from '../../types/graph';
import { CATEGORIES, CATEGORY_LABELS, LEVELS, LEVEL_LABELS, CATEGORY_COLORS } from '../../types';
import type { Category } from '../../types';

interface HeatmapPanelProps {
  matrix: CategoryLevelMatrix;
  onCellClick: (category: string, level: string) => void;
}

export default function HeatmapPanel({ matrix, onCellClick }: HeatmapPanelProps) {
  const maxCount = Math.max(
    1,
    ...CATEGORIES.flatMap((cat) =>
      LEVELS.map((lvl) => matrix[cat]?.[lvl] ?? 0)
    )
  );

  return (
    <div style={{ padding: 32, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <h2 style={{ color: '#e0e0e0', fontSize: 18, marginBottom: 24, textAlign: 'center' }}>
        Category × Level Heatmap
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(3, 1fr)', gap: 4, maxWidth: 600, margin: '0 auto' }}>
        {/* Header row */}
        <div />
        {LEVELS.map((lvl) => (
          <div key={lvl} style={{ textAlign: 'center', color: '#888', fontSize: 11, padding: 4 }}>
            {LEVEL_LABELS[lvl]}
          </div>
        ))}

        {/* Data rows */}
        {CATEGORIES.map((cat) => (
          <>
            <div key={`label-${cat}`} style={{ color: CATEGORY_COLORS[cat as Category], fontSize: 12, display: 'flex', alignItems: 'center', paddingRight: 8 }}>
              {CATEGORY_LABELS[cat as Category]}
            </div>
            {LEVELS.map((lvl) => {
              const count = matrix[cat]?.[lvl] ?? 0;
              const intensity = count / maxCount;
              return (
                <div
                  key={`${cat}-${lvl}`}
                  onClick={() => onCellClick(cat, lvl)}
                  style={{
                    background: `rgba(108, 99, 255, ${0.1 + intensity * 0.7})`,
                    borderRadius: 6,
                    padding: 8,
                    textAlign: 'center',
                    cursor: 'pointer',
                    color: intensity > 0.5 ? '#fff' : '#aaa',
                    fontSize: 14,
                    fontWeight: 600,
                    transition: 'transform 0.15s',
                    minHeight: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = 'scale(1.08)'; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
                >
                  {count}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add code-dictionary/frontend/src/components/panels/HeatmapPanel.tsx
git commit -m "feat(code-dictionary): add HeatmapPanel component"
```

---

## Task 13: StatsDashboard 컴포넌트

**Files:**
- Create: `code-dictionary/frontend/src/components/panels/StatsDashboard.tsx`

- [ ] **Step 1: 구현**

```tsx
// src/components/panels/StatsDashboard.tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { GraphStats } from '../../types/graph';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../types';
import type { Category } from '../../types';

interface StatsDashboardProps {
  stats: GraphStats;
}

export default function StatsDashboard({ stats }: StatsDashboardProps) {
  const categoryData = Object.entries(stats.byCategory).map(([key, value]) => ({
    name: CATEGORY_LABELS[key as Category] || key,
    count: value,
    color: CATEGORY_COLORS[key as Category] || '#888',
  }));

  const levelData = Object.entries(stats.byLevel).map(([key, value]) => ({
    name: key,
    value,
  }));

  const levelColors = ['#00b894', '#fdcb6e', '#e17055'];

  return (
    <div style={{ padding: 32, height: '100%', overflow: 'auto', color: '#e0e0e0' }}>
      <h2 style={{ fontSize: 18, marginBottom: 24, textAlign: 'center' }}>Statistics</h2>

      {/* Counters */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 48, marginBottom: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#6c63ff' }}>{stats.totalConcepts}</div>
          <div style={{ fontSize: 12, color: '#888' }}>Concepts</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#4ecdc4' }}>{stats.totalIndexes}</div>
          <div style={{ fontSize: 12, color: '#888' }}>Code Indexes</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#ffd93d' }}>{Object.keys(stats.byCategory).length}</div>
          <div style={{ fontSize: 12, color: '#888' }}>Categories</div>
        </div>
      </div>

      {/* Charts side by side */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* Bar chart */}
        <div style={{ flex: '1 1 350px', maxWidth: 500 }}>
          <h3 style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>By Category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryData} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" stroke="#444" />
              <YAxis type="category" dataKey="name" stroke="#888" fontSize={10} width={80} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#e0e0e0' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {categoryData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div style={{ flex: '0 0 200px' }}>
          <h3 style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>By Level</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={levelData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name }) => name}>
                {levelData.map((_, i) => (
                  <Cell key={i} fill={levelColors[i % levelColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#e0e0e0' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add code-dictionary/frontend/src/components/panels/StatsDashboard.tsx
git commit -m "feat(code-dictionary): add StatsDashboard component"
```

---

## Task 14: TreemapPanel 컴포넌트

**Files:**
- Create: `code-dictionary/frontend/src/components/panels/TreemapPanel.tsx`

- [ ] **Step 1: 구현**

```tsx
// src/components/panels/TreemapPanel.tsx
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import type { GraphNode } from '../../types/graph';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../types';
import type { Category } from '../../types';

interface TreemapPanelProps {
  nodes: GraphNode[];
  onNodeClick: (conceptId: string) => void;
}

export default function TreemapPanel({ nodes, onNodeClick }: TreemapPanelProps) {
  const grouped = nodes.reduce<Record<string, GraphNode[]>>((acc, node) => {
    (acc[node.category] ??= []).push(node);
    return acc;
  }, {});

  const data = Object.entries(grouped).map(([category, categoryNodes]) => ({
    name: CATEGORY_LABELS[category as Category] || category,
    color: CATEGORY_COLORS[category as Category] || '#888',
    children: categoryNodes.map((n) => ({
      name: n.name,
      size: Math.max(1, n.indexCount),
      conceptId: n.id,
      color: CATEGORY_COLORS[n.category as Category] || '#888',
    })),
  }));

  const CustomContent = (props: any) => {
    const { x, y, width, height, name, color, conceptId } = props;
    if (width < 20 || height < 20) return null;

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={color || '#888'}
          fillOpacity={0.7}
          stroke="#0a0a14"
          strokeWidth={2}
          rx={4}
          style={{ cursor: conceptId ? 'pointer' : 'default' }}
          onClick={() => conceptId && onNodeClick(conceptId)}
        />
        {width > 40 && height > 24 && (
          <text
            x={x + width / 2}
            y={y + height / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fff"
            fontSize={Math.min(12, width / 8)}
          >
            {name.length > width / 8 ? name.slice(0, Math.floor(width / 8)) + '…' : name}
          </text>
        )}
      </g>
    );
  };

  return (
    <div style={{ padding: 32, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <h2 style={{ color: '#e0e0e0', fontSize: 18, marginBottom: 24, textAlign: 'center' }}>
        Concept Treemap
      </h2>
      <ResponsiveContainer width="100%" height="80%">
        <Treemap
          data={data}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke="#0a0a14"
          content={<CustomContent />}
        >
          <Tooltip
            contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#e0e0e0' }}
            formatter={(value: number) => [`${value} indexes`, 'Code']}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add code-dictionary/frontend/src/components/panels/TreemapPanel.tsx
git commit -m "feat(code-dictionary): add TreemapPanel component"
```

---

## Task 15: SearchPage 전면 리팩토링

**Files:**
- Modify: `code-dictionary/frontend/src/pages/SearchPage.tsx`
- Modify: `code-dictionary/frontend/src/index.css`

- [ ] **Step 1: index.css에 다크 테마 + 새 레이아웃 스타일 추가**

기존 CSS 파일 맨 아래에 추가:

```css
/* === Visualization Page Styles === */
.viz-page {
  background: #0a0a14;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

.search-bar-overlay {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  width: 420px;
  max-width: 90vw;
}

.search-bar-floating {
  background: rgba(26, 26, 46, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(108, 99, 255, 0.3);
  border-radius: 28px;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-icon {
  color: #6c63ff;
  font-size: 16px;
}

.search-input-floating {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #e0e0e0;
  font-size: 14px;
}

.search-input-floating::placeholder {
  color: #555;
}

.search-shortcut {
  color: #444;
  font-size: 10px;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 1px 6px;
  font-family: inherit;
}

.carousel-slide-inner {
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at 40% 40%, #1a1a3e 0%, #0d0d1a 60%, #080812 100%);
  border-radius: 20px;
  border: 1.5px solid rgba(108, 99, 255, 0.3);
  overflow: hidden;
}

.carousel-preview-card {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #12122a, #0e0e20);
  border-radius: 16px;
  border: 1px solid #1a1a3a;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #555;
  font-size: 12px;
}
```

- [ ] **Step 2: SearchPage 전면 교체**

```tsx
// src/pages/SearchPage.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { useGraphData } from '../hooks/useGraphData';
import SearchBar from '../components/SearchBar';
import Carousel3D from '../components/Carousel3D';
import ForceGraph3D from '../components/graph/ForceGraph3D';
import HeatmapPanel from '../components/panels/HeatmapPanel';
import StatsDashboard from '../components/panels/StatsDashboard';
import TreemapPanel from '../components/panels/TreemapPanel';
import DetailSidePanel from '../components/DetailSidePanel';
import { searchConcepts } from '../api/searchApi';
import type { GraphRenderer, GraphNode } from '../types/graph';

export default function SearchPage() {
  const { data, loading, error } = useGraphData();
  const graphRef = useRef<GraphRenderer>(null);

  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [dimmed, setDimmed] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderer, setRenderer] = useState<'force' | 'three'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('renderer') === 'threejs' ? 'three' : 'force';
  });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedConceptId(node.id);
    const related = data?.links
      .filter((l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as any).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as any).id;
        return src === node.id || tgt === node.id;
      })
      .map((l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as any).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as any).id;
        return src === node.id ? tgt : src;
      }) ?? [];

    setHighlightedNodes(new Set([node.id, ...related]));
    setDimmed(true);
    graphRef.current?.focusNode(node.id);
  }, [data]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedConceptId(null);
    setHighlightedNodes(new Set());
    setDimmed(false);
    graphRef.current?.resetView();
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    try {
      const result = await searchConcepts(query, undefined, undefined, 0, 50);
      const matchIds = new Set(result.hits.map((h) => h.conceptId));
      setHighlightedNodes(matchIds);
      setDimmed(true);
      setCarouselIndex(0);
      if (result.hits.length > 0) {
        graphRef.current?.focusNode(result.hits[0].conceptId);
      }
    } catch {
      // search failed silently
    }
  }, []);

  const handleSelectConcept = useCallback((conceptId: string) => {
    setSelectedConceptId(conceptId);
    setHighlightedNodes(new Set([conceptId]));
    setDimmed(true);
    setCarouselIndex(0);
    graphRef.current?.focusNode(conceptId);
  }, []);

  const handleHeatmapClick = useCallback((category: string, level: string) => {
    if (!data) return;
    const matching = data.nodes.filter((n) => n.category === category && n.level === level);
    setHighlightedNodes(new Set(matching.map((n) => n.id)));
    setDimmed(true);
    setCarouselIndex(0);
    if (matching.length > 0) {
      graphRef.current?.focusNode(matching[0].id);
    }
  }, [data]);

  const handleTreemapClick = useCallback((conceptId: string) => {
    handleSelectConcept(conceptId);
    setCarouselIndex(0);
  }, [handleSelectConcept]);

  const handleNavigate = useCallback((conceptId: string) => {
    handleSelectConcept(conceptId);
  }, [handleSelectConcept]);

  if (loading) {
    return (
      <div className="viz-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#888' }}>Loading concept graph...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="viz-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#ff6b6b' }}>{error || 'Failed to load data'}</p>
      </div>
    );
  }

  const GraphComponent = ForceGraph3D;

  const panels = [
    {
      key: 'graph',
      label: 'Graph',
      content: (
        <div ref={containerRef} className="carousel-slide-inner" style={{ width: '100%', height: '100%' }}>
          <GraphComponent
            ref={graphRef}
            nodes={data.nodes}
            links={data.links}
            highlightedNodes={highlightedNodes}
            dimmed={dimmed}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            width={containerSize.width}
            height={containerSize.height}
          />
        </div>
      ),
      preview: <div className="carousel-preview-card">Concept Graph</div>,
    },
    {
      key: 'heatmap',
      label: 'Heatmap',
      content: (
        <div className="carousel-slide-inner">
          <HeatmapPanel matrix={data.stats.matrix} onCellClick={handleHeatmapClick} />
        </div>
      ),
      preview: <div className="carousel-preview-card">Heatmap</div>,
    },
    {
      key: 'stats',
      label: 'Statistics',
      content: (
        <div className="carousel-slide-inner">
          <StatsDashboard stats={data.stats} />
        </div>
      ),
      preview: <div className="carousel-preview-card">Statistics</div>,
    },
    {
      key: 'treemap',
      label: 'Treemap',
      content: (
        <div className="carousel-slide-inner">
          <TreemapPanel nodes={data.nodes} onNodeClick={handleTreemapClick} />
        </div>
      ),
      preview: <div className="carousel-preview-card">Treemap</div>,
    },
  ];

  return (
    <div className="viz-page">
      <div className="search-bar-overlay">
        <SearchBar onSearch={handleSearch} onSelectConcept={handleSelectConcept} />
      </div>

      <Carousel3D panels={panels} activeIndex={carouselIndex} onActiveChange={setCarouselIndex} />

      <DetailSidePanel
        conceptId={selectedConceptId}
        onClose={handleBackgroundClick}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
```

- [ ] **Step 3: 타입 체크**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/code-dictionary/frontend
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add code-dictionary/frontend/src/pages/SearchPage.tsx code-dictionary/frontend/src/index.css
git commit -m "feat(code-dictionary): rewrite SearchPage with visualization carousel"
```

---

## Task 16: Backend — Graph API DTO + Service

**Files:**
- Create: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/graph/dto/GraphDtos.kt`
- Create: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/graph/service/GraphService.kt`
- Modify: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/concept/port/ConceptRepositoryPort.kt`

- [ ] **Step 1: GraphDtos.kt 생성**

```kotlin
package com.kgd.codedictionary.application.graph.dto

data class GraphDataDto(
    val nodes: List<GraphNodeDto>,
    val links: List<GraphLinkDto>,
    val stats: GraphStatsDto
)

data class GraphNodeDto(
    val id: String,
    val name: String,
    val category: String,
    val level: String,
    val indexCount: Int,
    val relatedCount: Int,
    val description: String?
)

data class GraphLinkDto(
    val source: String,
    val target: String,
    val type: String
)

data class GraphStatsDto(
    val totalConcepts: Int,
    val totalIndexes: Long,
    val byCategory: Map<String, Int>,
    val byLevel: Map<String, Int>,
    val matrix: Map<String, Map<String, Int>>
)
```

- [ ] **Step 2: ConceptRepositoryPort에 findAllList 추가**

`ConceptRepositoryPort.kt`에 추가:

```kotlin
fun findAllList(): List<Concept>
```

- [ ] **Step 3: ConceptRepositoryAdapter에 구현 추가**

`ConceptRepositoryAdapter.kt`에 추가 (`findAllList` 구현):

```kotlin
override fun findAllList(): List<Concept> {
    return conceptJpaRepository.findAll().map { it.toDomain() }
}
```

- [ ] **Step 4: GraphService.kt 생성**

```kotlin
package com.kgd.codedictionary.application.graph.service

import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.application.graph.dto.*
import com.kgd.codedictionary.application.index.port.ConceptIndexRepositoryPort
import org.springframework.stereotype.Service

@Service
class GraphService(
    private val conceptRepository: ConceptRepositoryPort,
    private val indexRepository: ConceptIndexRepositoryPort
) {
    fun getGraphData(): GraphDataDto {
        val concepts = conceptRepository.findAllList()
        val allIndexes = indexRepository.findAll()

        val indexCountMap = allIndexes.groupBy { it.conceptId }.mapValues { it.value.size }

        val nodes = concepts.map { concept ->
            GraphNodeDto(
                id = concept.conceptId,
                name = concept.name,
                category = concept.category.name,
                level = concept.level.name,
                indexCount = indexCountMap[concept.conceptId] ?: 0,
                relatedCount = concept.relatedConceptIds.size,
                description = concept.description
            )
        }

        val conceptIdSet = concepts.map { it.conceptId }.toSet()
        val links = concepts.flatMap { concept ->
            concept.relatedConceptIds
                .filter { it in conceptIdSet }
                .map { relatedId ->
                    GraphLinkDto(
                        source = concept.conceptId,
                        target = relatedId,
                        type = "RELATED"
                    )
                }
        }.distinctBy { setOf(it.source, it.target) }

        val byCategory = concepts.groupBy { it.category.name }.mapValues { it.value.size }
        val byLevel = concepts.groupBy { it.level.name }.mapValues { it.value.size }
        val matrix = concepts.groupBy { it.category.name }.mapValues { (_, categoryConcepts) ->
            categoryConcepts.groupBy { it.level.name }.mapValues { it.value.size }
        }

        val stats = GraphStatsDto(
            totalConcepts = concepts.size,
            totalIndexes = allIndexes.size.toLong(),
            byCategory = byCategory,
            byLevel = byLevel,
            matrix = matrix
        )

        return GraphDataDto(nodes = nodes, links = links, stats = stats)
    }
}
```

- [ ] **Step 5: Commit**

```bash
git add code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/graph/ \
  code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/concept/port/ConceptRepositoryPort.kt
git commit -m "feat(code-dictionary): add GraphService and DTOs for graph API"
```

---

## Task 17: Backend — Graph Controller

**Files:**
- Create: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/presentation/graph/controller/GraphController.kt`

- [ ] **Step 1: GraphController 구현**

```kotlin
package com.kgd.codedictionary.presentation.graph.controller

import com.kgd.codedictionary.application.graph.dto.GraphDataDto
import com.kgd.codedictionary.application.graph.service.GraphService
import com.kgd.common.response.ApiResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/concepts")
class GraphController(
    private val graphService: GraphService
) {
    @GetMapping("/graph")
    fun getGraphData(): ResponseEntity<ApiResponse<GraphDataDto>> {
        val result = graphService.getGraphData()
        return ResponseEntity.ok(ApiResponse.success(result))
    }
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa
./gradlew :code-dictionary:app:compileKotlin
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/presentation/graph/
git commit -m "feat(code-dictionary): add /api/v1/concepts/graph endpoint"
```

---

## Task 18: Backend — Concept Detail API (by conceptId)

**Files:**
- Modify: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/presentation/concept/controller/ConceptController.kt`
- Modify: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/concept/service/ConceptService.kt`
- Create: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/concept/dto/ConceptDetailDto.kt`

- [ ] **Step 1: ConceptDetailDto 생성**

```kotlin
package com.kgd.codedictionary.application.concept.dto

data class ConceptDetailDto(
    val id: Long,
    val conceptId: String,
    val name: String,
    val category: String,
    val level: String,
    val description: String,
    val synonyms: List<String>,
    val codeSnippets: List<CodeSnippetInfoDto>,
    val relatedConcepts: List<RelatedConceptInfoDto>
)

data class CodeSnippetInfoDto(
    val filePath: String,
    val lineStart: Int,
    val lineEnd: Int,
    val codeSnippet: String,
    val gitUrl: String?,
    val description: String?
)

data class RelatedConceptInfoDto(
    val conceptId: String,
    val name: String,
    val category: String
)
```

- [ ] **Step 2: ConceptService에 findByConceptIdDetail 메서드 추가**

```kotlin
fun findByConceptIdDetail(conceptId: String): ConceptDetailDto {
    val concept = conceptRepository.findByConceptId(conceptId)
        ?: throw ConceptNotFoundException(conceptId)
    val indexes = indexRepository.findByConceptId(conceptId)
    val relatedConcepts = concept.relatedConceptIds.mapNotNull { relatedId ->
        conceptRepository.findByConceptId(relatedId)?.let {
            RelatedConceptInfoDto(
                conceptId = it.conceptId,
                name = it.name,
                category = it.category.name
            )
        }
    }

    return ConceptDetailDto(
        id = requireNotNull(concept.id),
        conceptId = concept.conceptId,
        name = concept.name,
        category = concept.category.name,
        level = concept.level.name,
        description = concept.description,
        synonyms = concept.synonyms,
        codeSnippets = indexes.map { idx ->
            CodeSnippetInfoDto(
                filePath = idx.location.filePath,
                lineStart = idx.location.lineStart,
                lineEnd = idx.location.lineEnd,
                codeSnippet = idx.codeSnippet,
                gitUrl = idx.location.gitUrl,
                description = idx.description
            )
        },
        relatedConcepts = relatedConcepts
    )
}
```

Import 추가 필요:
```kotlin
import com.kgd.codedictionary.application.index.port.ConceptIndexRepositoryPort
```

ConceptService 생성자에 `private val indexRepository: ConceptIndexRepositoryPort` 추가.

- [ ] **Step 3: ConceptController에 엔드포인트 추가**

```kotlin
@GetMapping("/by-concept-id/{conceptId}")
fun getByConceptId(@PathVariable conceptId: String): ResponseEntity<ApiResponse<ConceptDetailDto>> {
    val result = conceptService.findByConceptIdDetail(conceptId)
    return ResponseEntity.ok(ApiResponse.success(result))
}
```

Import 추가: `import com.kgd.codedictionary.application.concept.dto.ConceptDetailDto`

- [ ] **Step 4: 빌드 확인**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa
./gradlew :code-dictionary:app:compileKotlin
```

- [ ] **Step 5: Commit**

```bash
git add code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/concept/ \
  code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/presentation/concept/
git commit -m "feat(code-dictionary): add /by-concept-id/{id} detail endpoint"
```

---

## Task 19: Backend — Suggest API (edge-ngram + jaso)

**Files:**
- Create: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/search/dto/SuggestDtos.kt`
- Modify: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/search/port/ConceptSearchPort.kt`
- Modify: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/infrastructure/opensearch/adapter/ConceptSearchAdapter.kt`
- Modify: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/search/service/SearchService.kt`
- Create: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/presentation/search/controller/SuggestController.kt`

- [ ] **Step 1: SuggestDtos.kt 생성**

```kotlin
package com.kgd.codedictionary.application.search.dto

data class SuggestCommand(
    val query: String,
    val size: Int = 8
)

data class SuggestItemDto(
    val conceptId: String,
    val name: String,
    val category: String,
    val level: String,
    val description: String
)
```

- [ ] **Step 2: ConceptSearchPort에 suggest 메서드 추가**

```kotlin
data class SuggestHit(
    val conceptId: String,
    val conceptName: String,
    val category: String,
    val level: String,
    val description: String?
)

fun suggest(query: String, size: Int): List<SuggestHit>
```

- [ ] **Step 3: ConceptSearchAdapter에 suggest 구현**

```kotlin
override fun suggest(query: String, size: Int): List<SuggestHit> {
    val response = openSearchClient.search({ s ->
        s.index(indexName)
            .query { q ->
                q.bool { b ->
                    b.should(listOf(
                        Query.of { qq ->
                            qq.multiMatch { mm ->
                                mm.query(query)
                                    .fields(listOf(
                                        "concept_name.autocomplete^3",
                                        "concept_name.jaso^2",
                                        "description.autocomplete",
                                        "category"
                                    ))
                            }
                        },
                        Query.of { qq ->
                            qq.multiMatch { mm ->
                                mm.query(query)
                                    .fields(listOf("concept_name^3", "description"))
                            }
                        }
                    ))
                    .minimumShouldMatch("1")
                }
            }
            .size(size)
            .source { src ->
                src.filter { f ->
                    f.includes(listOf("concept_id", "concept_name", "category", "level", "description"))
                }
            }
    }, JsonData::class.java)

    val seen = mutableSetOf<String>()
    return response.hits().hits().mapNotNull { hit ->
        val sourceMap = hit.source()?.let {
            @Suppress("UNCHECKED_CAST")
            it.to(Map::class.java) as Map<String, Any?>
        } ?: return@mapNotNull null

        val conceptId = sourceMap["concept_id"]?.toString() ?: return@mapNotNull null
        if (!seen.add(conceptId)) return@mapNotNull null

        SuggestHit(
            conceptId = conceptId,
            conceptName = sourceMap["concept_name"]?.toString() ?: "",
            category = sourceMap["category"]?.toString() ?: "",
            level = sourceMap["level"]?.toString() ?: "",
            description = sourceMap["description"]?.toString()
        )
    }
}
```

- [ ] **Step 4: SearchService에 suggest 메서드 추가**

```kotlin
fun suggest(command: SuggestCommand): List<SuggestItemDto> {
    return searchPort.suggest(command.query, command.size).map { hit ->
        SuggestItemDto(
            conceptId = hit.conceptId,
            name = hit.conceptName,
            category = hit.category,
            level = hit.level,
            description = hit.description ?: ""
        )
    }
}
```

Import 추가: `import com.kgd.codedictionary.application.search.dto.SuggestCommand` 및 `SuggestItemDto`

- [ ] **Step 5: SuggestController 생성**

```kotlin
package com.kgd.codedictionary.presentation.search.controller

import com.kgd.codedictionary.application.search.dto.SuggestCommand
import com.kgd.codedictionary.application.search.dto.SuggestItemDto
import com.kgd.codedictionary.application.search.service.SearchService
import com.kgd.common.response.ApiResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/search")
class SuggestController(
    private val searchService: SearchService
) {
    @GetMapping("/suggest")
    fun suggest(
        @RequestParam q: String,
        @RequestParam(defaultValue = "8") size: Int
    ): ResponseEntity<ApiResponse<List<SuggestItemDto>>> {
        val result = searchService.suggest(SuggestCommand(query = q, size = size))
        return ResponseEntity.ok(ApiResponse.success(result))
    }
}
```

- [ ] **Step 6: 빌드 확인**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa
./gradlew :code-dictionary:app:compileKotlin
```

- [ ] **Step 7: Commit**

```bash
git add code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/search/ \
  code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/infrastructure/opensearch/adapter/ConceptSearchAdapter.kt \
  code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/presentation/search/
git commit -m "feat(code-dictionary): add /search/suggest endpoint with edge-ngram + jaso"
```

---

## Task 20: Backend — OpenSearch 인덱스에 edge-ngram + jaso analyzer 추가

**Files:**
- Modify: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/infrastructure/opensearch/adapter/ConceptIndexingAdapter.kt`

- [ ] **Step 1: createOrUpdateIndex에 autocomplete + jaso analyzer 추가**

`createOrUpdateIndex()` 메서드의 settings.analysis 부분에 추가:

tokenizer 추가:
```kotlin
.tokenizer(
    "edge_ngram_tokenizer",
    Tokenizer.of { t ->
        t.definition(
            TokenizerDefinition.of { d ->
                d.edgeNgram(
                    org.opensearch.client.opensearch._types.analysis.EdgeNGramTokenizer.of { e ->
                        e.minGram(1).maxGram(20).tokenChars(listOf(
                            org.opensearch.client.opensearch._types.analysis.TokenChar.Letter,
                            org.opensearch.client.opensearch._types.analysis.TokenChar.Digit
                        ))
                    }
                )
            }
        )
    }
)
```

analyzer 추가:
```kotlin
.analyzer(
    "autocomplete_analyzer",
    Analyzer.of { an ->
        an.custom(
            CustomAnalyzer.of { ca ->
                ca.tokenizer("edge_ngram_tokenizer")
                    .filter(listOf("lowercase"))
            }
        )
    }
)
.analyzer(
    "autocomplete_search_analyzer",
    Analyzer.of { an ->
        an.custom(
            CustomAnalyzer.of { ca ->
                ca.tokenizer("standard")
                    .filter(listOf("lowercase"))
            }
        )
    }
)
```

mappings에 sub-field 추가 (concept_name과 description):
```kotlin
.properties("concept_name", Property.of { p ->
    p.text { t ->
        t.analyzer("concept_analyzer")
            .searchAnalyzer("concept_search_analyzer")
            .fields("autocomplete", Property.of { sub ->
                sub.text { st -> st.analyzer("autocomplete_analyzer").searchAnalyzer("autocomplete_search_analyzer") }
            })
    }
})
.properties("description", Property.of { p ->
    p.text { t ->
        t.analyzer("concept_analyzer")
            .searchAnalyzer("concept_search_analyzer")
            .fields("autocomplete", Property.of { sub ->
                sub.text { st -> st.analyzer("autocomplete_analyzer").searchAnalyzer("autocomplete_search_analyzer") }
            })
    }
})
```

> **Note**: jaso analyzer는 OpenSearch에 별도 플러그인(`analysis-jaso`)이 필요합니다. 플러그인이 설치되면 `jaso` tokenizer와 `concept_name.jaso` sub-field를 추가합니다. 초기 구현에서는 edge-ngram으로 먼저 동작하게 하고, jaso 플러그인은 Docker 이미지 커스텀 시 추가합니다.

- [ ] **Step 2: 빌드 확인**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa
./gradlew :code-dictionary:app:compileKotlin
```

- [ ] **Step 3: Commit**

```bash
git add code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/infrastructure/opensearch/adapter/ConceptIndexingAdapter.kt
git commit -m "feat(code-dictionary): add edge-ngram autocomplete analyzer to OS index"
```

---

## Task 21: 프론트엔드 빌드 + E2E 확인

**Files:** None (검증 태스크)

- [ ] **Step 1: 프론트엔드 빌드**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/code-dictionary/frontend
npm run build
```

Expected: `dist/` 생성, 에러 없음

- [ ] **Step 2: 백엔드 빌드**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa
./gradlew :code-dictionary:app:build
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Dev 서버로 시각 확인**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/code-dictionary/frontend
npm run dev
```

브라우저에서 `http://localhost:5174` 접속하여:
- 3D 그래프가 메인 패널에 렌더링되는지
- 좌우 peek 카드가 보이는지
- 스와이프/클릭으로 캐러셀 전환되는지
- 검색바에서 autocomplete가 동작하는지 (백엔드 실행 시)
- 노드 클릭 시 사이드 패널이 나오는지

- [ ] **Step 4: Approach A 데모 확인**

브라우저에서 `http://localhost:5174?renderer=threejs` 접속하여 Three.js 렌더러 비교

> Note: SearchPage.tsx에서 `renderer` state는 정의되어 있지만 현재 `ForceGraph3D`만 사용 중. Approach A 전환을 위해 `GraphComponent` 선택 로직 추가 필요 — 이는 확인 후 필요시 간단 수정.

- [ ] **Step 5: 최종 Commit**

```bash
git add -A
git commit -m "feat(code-dictionary): complete visualization feature integration"
```

---

## Task Summary

| # | Task | Area | Dependencies |
|---|------|------|-------------|
| 1 | npm 의존성 설치 | FE | - |
| 2 | 타입 정의 | FE | 1 |
| 3 | API 클라이언트 확장 | FE | 2 |
| 4 | useGraphData 훅 | FE | 3 |
| 5 | useSuggest 훅 | FE | 3 |
| 6 | AutocompleteDropdown | FE | 2 |
| 7 | SearchBar 리팩토링 | FE | 5, 6 |
| 8 | ForceGraph3D (Approach B) | FE | 2 |
| 9 | ThreeJSGraph (Approach A) | FE | 2 |
| 10 | Carousel3D | FE | - |
| 11 | DetailSidePanel | FE | 3 |
| 12 | HeatmapPanel | FE | 2 |
| 13 | StatsDashboard | FE | 2 |
| 14 | TreemapPanel | FE | 2 |
| 15 | SearchPage 리팩토링 | FE | 4-14 |
| 16 | Graph API DTO + Service | BE | - |
| 17 | Graph Controller | BE | 16 |
| 18 | Concept Detail API | BE | - |
| 19 | Suggest API | BE | - |
| 20 | OS edge-ngram analyzer | BE | - |
| 21 | 빌드 + E2E 확인 | Both | 1-20 |

**Parallel tracks:** FE Tasks 1-15와 BE Tasks 16-20은 독립적으로 병렬 진행 가능.
