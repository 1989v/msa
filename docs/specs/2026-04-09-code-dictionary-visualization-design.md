# Code-Dictionary Frontend Visualization Design

**Date**: 2026-04-09
**Status**: Approved
**Author**: AI-assisted

---

## 1. Overview

code-dictionary 프론트엔드에 시각화 기능을 추가한다. 현재 텍스트 기반 검색 페이지를 3D 개념 그래프 중심의 인터랙티브 시각화 페이지로 확장하고, 검색을 autocomplete(edge-ngram, 자소 분리) 기반으로 강화한다.

### Goals
- **탐색/발견**: 개념들을 시각적으로 둘러보고 새로운 것을 발견
- **학습/이해**: 개념 간 관계를 파악하여 지식 구조 이해
- **대시보드/현황**: 프로젝트 내 개념 사용 현황 한눈에 파악

---

## 2. Page Layout

### 2.1 3D 회전목마 캐러셀

하나의 통합 페이지. 검색바와 시각화가 공존한다.

- **검색바**: 상단 floating overlay (backdrop-blur), `⌘K` 단축키
- **메인 영역**: 3D 캐러셀 — 4개 패널 회전목마 전환
- **사이드 패널**: 노드 클릭 시 오른쪽에서 슬라이드

### 2.2 캐러셀 비율

- 메인(활성) 패널: 화면 폭 **90%**, 거의 풀 높이
- 양쪽 peek 카드: 화면 엣지 밖에서 살짝 노출, scale 55%, rotateY 42도, blur, opacity 35%
- 전환: 드래그/스와이프 또는 양쪽 peek 카드 클릭
- CSS perspective(1400px) + translateZ + rotateY로 회전목마 깊이감 연출
- 하단 인디케이터 도트로 현재 위치 표시

### 2.3 캐러셀 패널 순서

1. **3D Concept Graph** (기본 활성)
2. **Heatmap** (카테고리 × 난이도)
3. **Statistics Dashboard** (차트/분포)
4. **Treemap** (카테고리 계층 면적)

---

## 3. 3D Concept Graph

### 3.1 렌더링

- **기본 (Approach B)**: `react-force-graph-3d` — Three.js + d3-force-3d 내장
- **비교용 (Approach A)**: `react-three-fiber` + `d3-force-3d` 직접 구현 데모
- 렌더러 인터페이스(`GraphRenderer`)를 추상화하여 A/B 교체 가능

```typescript
interface GraphRenderer {
  focusNode(nodeId: string): void;
  highlightNodes(nodeIds: string[]): void;
  dimAllExcept(nodeIds: string[]): void;
  resetView(): void;
  onNodeClick: (node: GraphNode) => void;
  onNodeHover: (node: GraphNode | null) => void;
}
```

### 3.2 노드 시각 인코딩

| 속성 | 매핑 데이터 |
|------|------------|
| 색상 | 카테고리별 (13색, 기존 CATEGORY_COLORS 활용) |
| 크기 | 연결된 관련 개념 수 (relatedConceptIds.length) |
| 밝기/광택 | 코드 인덱스 수 (해당 개념의 코드 등장 횟수) |

### 3.3 인터랙션

- **노드 클릭**: 카메라가 해당 노드로 부드럽게 이동 + 연결 노드 하이라이트 + 사이드 패널 오픈
- **노드 호버**: 툴팁 (개념명, 카테고리, 난이도)
- **드래그**: 3D 공간 orbit 회전
- **줌**: 마우스 휠
- **배경 클릭**: 사이드 패널 닫기, 하이라이트 해제

### 3.4 검색 연동

- 검색 입력 시: 매칭 노드 밝게, 나머지 dim (opacity 0.1)
- 최고 관련도 노드로 카메라 자동 포커스
- autocomplete에서 개념 선택 → 해당 노드 클릭과 동일 동작
- Enter (선택 없이) → 전문 검색 실행, 매칭 노드 전체 하이라이트

---

## 4. Detail Side Panel

노드 클릭 시 오른쪽에서 슬라이드로 등장.

**내용**:
- 개념명 + 카테고리 배지 + 난이도 배지
- 설명 (description)
- 코드 스니펫 목록 (파일 경로, 라인 범위, Git 링크)
- 관련 개념 리스트 (클릭 → 해당 노드로 포커스 이동)

---

## 5. 캐러셀 보조 패널

### 5.1 Heatmap (카테고리 × 난이도)

- Y축: 13개 카테고리, X축: BEGINNER / INTERMEDIATE / ADVANCED
- 셀 색상 강도: 해당 조합의 개념 수
- 셀 클릭 → 그래프 패널 전환 + 해당 조건 노드 하이라이트
- SVG/Canvas 직접 구현 (외부 의존성 최소화)

### 5.2 Statistics Dashboard

- 카테고리별 개념 수 바 차트
- 난이도 분포 도넛 차트
- 총 개념 수 / 총 코드 인덱스 수 카운터
- 최근 인덱싱된 개념 리스트 (5개)
- 라이브러리: Recharts

### 5.3 Treemap

- 최상위: 카테고리, 하위: 개별 개념
- 면적: 코드 인덱스 수, 색상: 카테고리
- 클릭 → 그래프 패널 전환 + 해당 노드 포커스
- Recharts Treemap 또는 d3-hierarchy

### 5.4 패널 간 연동

모든 패널이 동일한 concepts 데이터를 공유. 보조 패널에서 선택/필터 → 그래프 패널 전환 시 해당 상태 유지.

---

## 6. 검색 강화

### 6.1 Backend (Elasticsearch)

**커스텀 analyzer**:
- `edge_ngram` analyzer: min_gram 1, max_gram 20
- `jaso` analyzer: jaso_tokenizer (한글 자소 분리 플러그인) + edge_ngram filter

**매칭 대상 필드**:
- `name.edge_ngram` — 접두어 매칭
- `name.jaso` — 자소 분리 (초성 검색 "ㅅㄱㅌ" → "싱글톤")
- `description.edge_ngram` — 설명 필드 접두어
- `category` — 카테고리 매칭

**신규 API**:
```
GET /api/v1/search/suggest?q={query}&size=8
```
→ multi_match (name.edge_ngram, name.jaso, description.edge_ngram, category)
→ 응답: `[{ conceptId, name, category, level, description }]`

### 6.2 Frontend Autocomplete

- 디바운스 300ms로 suggest API 호출
- 드롭다운 항목: 개념명 (볼드) + 카테고리 배지 + 한줄 설명 (truncate)
- 키보드 네비게이션 (↑↓ Enter)
- 선택 시 → 그래프 노드 포커스 이동
- ES jaso 플러그인 Docker 이미지에 추가 필요

---

## 7. Data Flow & API

### 7.1 API 목록

| 엔드포인트 | 용도 | 상태 |
|---|---|---|
| `GET /api/v1/concepts` | 전체 개념 목록 | 기존 (미사용 중) |
| `GET /api/v1/concepts/{id}` | 사이드 패널 상세 | 기존 |
| `GET /api/v1/search/suggest?q=&size=8` | Autocomplete | **신규** |
| `GET /api/v1/concepts/graph` | 그래프 데이터 (노드+엣지+통계) | **신규** |

### 7.2 Graph API 응답

```json
{
  "nodes": [
    { "id": "singleton-pattern", "name": "싱글톤 패턴", "category": "DESIGN_PATTERN",
      "level": "BEGINNER", "indexCount": 5, "relatedCount": 3 }
  ],
  "links": [
    { "source": "singleton-pattern", "target": "design-pattern", "type": "BELONGS_TO" }
  ],
  "stats": {
    "totalConcepts": 142, "totalIndexes": 380,
    "byCategory": { "DESIGN_PATTERN": 23 },
    "byLevel": { "BEGINNER": 45 },
    "matrix": { "DESIGN_PATTERN": { "BEGINNER": 8, "INTERMEDIATE": 10, "ADVANCED": 5 } }
  }
}
```

### 7.3 프론트 데이터 흐름

```
Page Load → GET /concepts/graph → global state
  ├── ConceptGraph: nodes + links
  ├── HeatmapPanel: stats.matrix
  ├── StatsDashboard: stats.*
  └── TreemapPanel: nodes (grouped by category)

Search Input → GET /search/suggest → autocomplete dropdown
Node Click → GET /concepts/{id} → DetailSidePanel
```

한 번의 graph API 호출로 4개 패널 전부 렌더링. 이후 클라이언트에서 가공.

---

## 8. 기술 스택

### 8.1 프론트엔드 신규 의존성

| 패키지 | 용도 | 비고 |
|---|---|---|
| `react-force-graph-3d` | 3D 그래프 (Approach B) | Three.js peer dependency |
| `three` | WebGL 렌더링 | force-graph 의존성 |
| `@react-three/fiber` + `@react-three/drei` | Approach A 데모용 | |
| `d3-force-3d` | Approach A force layout | |
| `recharts` | 통계 차트, 트리맵 | |
| `embla-carousel-react` | 3D 캐러셀 제스처 | |

### 8.2 백엔드 변경

- ES 인덱스: edge_ngram + jaso analyzer 추가
- ES jaso 플러그인: Docker 이미지에 설치
- 신규 엔드포인트: `/search/suggest`, `/concepts/graph`

### 8.3 파일 구조 (신규/변경)

```
code-dictionary/frontend/src/
├── pages/
│   └── SearchPage.tsx              # 리팩토링
├── components/
│   ├── SearchBar.tsx               # autocomplete 추가
│   ├── Carousel3D.tsx              # 신규
│   ├── graph/
│   │   ├── GraphRenderer.ts        # 렌더러 인터페이스
│   │   ├── ForceGraph3D.tsx        # Approach B
│   │   └── ThreeJSGraph.tsx        # Approach A 데모
│   ├── panels/
│   │   ├── HeatmapPanel.tsx
│   │   ├── StatsDashboard.tsx
│   │   └── TreemapPanel.tsx
│   ├── DetailSidePanel.tsx         # 신규
│   └── AutocompleteDropdown.tsx    # 신규
├── api/
│   └── searchApi.ts                # suggest/graph API 추가
├── hooks/
│   └── useGraphData.ts             # 신규
└── types/
    └── index.ts                    # graph 타입 추가
```

---

## 9. Graph Renderer 추상화 (A/B 비교)

Approach B(`react-force-graph-3d`)를 기본으로 구현하되, Approach A(`react-three-fiber` 직접 구현)도 동일 인터페이스로 데모 구현. `GraphRenderer` 인터페이스를 통해 렌더러를 교체하면 동일한 데이터/인터랙션으로 A/B 시각적 비교 가능.

설정이나 URL 파라미터(`?renderer=threejs`)로 전환 가능하게 구현.
