# 7. Frontend & Visualization

> React 19 + Three.js 3D Force Graph + OpenSearch 자동완성 + 인터랙티브 대시보드

---

## Code Dictionary — 3D 시각화 & 검색

IT 개념 사전 서비스. 161개 개념을 3D 그래프, 히트맵, 트리맵으로 시각화하고
OpenSearch 기반 하이브리드 검색 제공.

### 기술 스택

| Layer | Tech |
|-------|------|
| Framework | React 19 + TypeScript + Vite |
| 3D Engine | Three.js + React Three Fiber |
| Force Graph | D3 Force-3D (3D force-directed layout) |
| Charts | Recharts |
| Carousel | Embla Carousel (4-panel swipe) |
| Search | OpenSearch (BM25 + Nori + Synonym + edge-ngram) |

### 4-Panel 시각화 캐러셀

```
┌──────────┐  swipe  ┌──────────┐  swipe  ┌──────────┐  swipe  ┌──────────┐
│  3D Force │ ←────→ │  Heatmap  │ ←────→ │ Treemap  │ ←────→ │  Stats   │
│   Graph   │        │ (cat×lv)  │        │ (카테고리)│        │(분포차트)│
└──────────┘        └──────────┘        └──────────┘        └──────────┘
```

- **3D Force Graph**: 개념 간 관계를 3D 공간에 배치, orbit 인터랙션
- **Heatmap**: 카테고리 × 난이도 레벨 매트릭스
- **Treemap**: 카테고리별 면적 비례 계층 시각화
- **Statistics**: 분포 차트 (Recharts)

### 검색 기능

```
사용자 입력 → edge-ngram 자동완성 → 한국어 형태소 분석 (Nori)
                                   → BM25 스코어링
                                   → 동의어 확장 (Synonym filter)
                                   → 카테고리/레벨 필터링
```

**13개 카테고리**: BASICS, DATA_STRUCTURE, ALGORITHM, DESIGN_PATTERN, CONCURRENCY, DISTRIBUTED_SYSTEM, ARCHITECTURE, INFRASTRUCTURE, DATA, SECURITY, NETWORK, TESTING, LANGUAGE_FEATURE

### 코드 위치

| 기능 | 파일 |
|------|------|
| 3D Graph | `code-dictionary/frontend/src/components/ConceptGraph3D.tsx` |
| Heatmap | `code-dictionary/frontend/src/components/ConceptHeatmap.tsx` |
| Treemap | `code-dictionary/frontend/src/components/ConceptTreemap.tsx` |
| Stats | `code-dictionary/frontend/src/components/ConceptStats.tsx` |
| Search | `code-dictionary/frontend/src/components/SearchBar.tsx` |
| API Client | `code-dictionary/frontend/src/api/` |
| Backend Search | `code-dictionary/app/src/.../infrastructure/search/` |
| OpenSearch Config | `code-dictionary/app/src/.../infrastructure/config/OpenSearchConfig.kt` |

---

## Admin Backoffice

React 19 + Vite 기반 백오피스 대시보드.

| 기능 | 설명 |
|------|------|
| CRUD UI | 상품, 회원, 주문 관리 |
| 데이터 대시보드 | 실시간 통계, 차트 |
| 역할 기반 접근 | ROLE_ADMIN 전용 |

**코드 위치**: `admin/frontend/`

**Spec**: `docs/specs/2026-04-09-admin-backoffice-framework-design.md`

---

## Charting — 주가 패턴 시각화

Python/FastAPI 백엔드 + React 프론트엔드.

| 기능 | 기술 |
|------|------|
| 차트 렌더링 | React + D3/Chart.js |
| 패턴 유사도 | pgvector HNSW (32-dim cosine) |
| 데이터 소스 | yfinance (미국), FinanceDataReader (한국) |

**코드 위치**: `charting/frontend/` · `charting/src/`

---

## Agent Viewer

Claude Agent 팀 협업 시각화.

| 기능 | 설명 |
|------|------|
| 태스크 흐름 | 에이전트 간 메시지/태스크 할당 시각화 |
| 팀 구조 | 에이전트 역할 및 관계 표시 |

**코드 위치**: `agent-viewer/front/`

---

## FE 디자인 가드레일

AI 생성 코드의 "AI slop" 방지를 위한 프론트엔드 디자인 컨벤션.

| 규칙 | 내용 |
|------|------|
| 타이포그래피 | 시스템 폰트 스택, rem 단위 |
| 색상 | CSS 변수, 대비율 4.5:1 이상 |
| 레이아웃 | 8px 그리드, 반응형 |
| 모션 | prefers-reduced-motion 존중 |
| 접근성 | ARIA, 키보드 네비게이션 |

**근거**: `docs/conventions/frontend-design.md`

---

*Code references: `code-dictionary/frontend/` · `admin/frontend/` · `charting/frontend/` · `agent-viewer/front/` · `docs/conventions/frontend-design.md`*
