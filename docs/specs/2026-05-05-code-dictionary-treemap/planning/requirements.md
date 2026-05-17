<!-- source: code-dictionary -->
<!-- source: portal-fe -->
# Requirements — Code Dictionary Treemap

## Initial Description

네이버 증권 모바일(https://m.stock.naver.com/) "증시 현황" 트리맵 차트 스타일을
code-dictionary 에 추가한다. 면적은 비중(개념별 코드 스니펫 수 = `indexCount`),
색상은 학습 난이도(`level` = BEGINNER/INTERMEDIATE/ADVANCED)로 표현하며,
사용자 frontend 와 admin frontend 양쪽에 동일한 stats endpoint 기반으로 노출한다.

자세한 배경/결정 사항은 `planning/initialization.md` 참조.

## Visual Reference

- 출처: `/Users/gideok-kwon/Desktop/image.png` (네이버 증권 모바일 "증시 현황" 트리맵)
- `planning/visuals/` 디렉토리는 비어 있음 — 외부 데스크톱 이미지를 1차 레퍼런스로 사용
- 핵심 시각 패턴:
  - 좌측 상단: 제목 + ⓘ 아이콘
  - 우측 상단: 분류 토글 (예: "국내/미국") — code-dictionary 에서는 미사용 또는 BEGINNER/INTERMEDIATE/ADVANCED 필터로 변용 검토
  - 카테고리 chip 가로 스크롤(좌측 "전체" 강조 + 나머지 카테고리, 가로 스크롤 화살표)
  - 트리맵 본체: tile 내부에 라벨 2 줄 (이름 + 메트릭값), 면적이 작으면 라벨 줄임
  - 하단: 색상 범례 + 카운트 (상승/보합/하락 → code-dictionary 에서는 BEGINNER/INTERMEDIATE/ADVANCED 카운트로 매핑)

## Q&A

(Spec Shaper Phase 1 에서는 사용자 답변 없이 시드 요구사항만 정리한다.
Open question 은 `planning/open-questions.yml` Q1~Q8 로 추적.)

## Existing Code to Reference

- 백엔드 집계 로직: `/Users/gideok-kwon/IdeaProjects/msa/code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/graph/service/GraphService.kt:13`
  - 이미 `indexCountMap`, `byCategory`, `byLevel`, `matrix(category × level)` 산출 중
  - F1 stats endpoint 는 이 로직을 분해/재활용한다 (concept 별 `indexCount + level` row 추가)
- 컨트롤러 베이스: `/Users/gideok-kwon/IdeaProjects/msa/code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/presentation/concept/controller/ConceptController.kt:17`
  - `@RequestMapping("/api/v1/concepts")` — 신규 stats 엔드포인트 부착 위치
- 사용자 FE 그래프 컴포넌트: `/Users/gideok-kwon/IdeaProjects/msa/code-dictionary/frontend/src/components/graph/`
  - `ForceGraph3D.tsx`, `GraphRenderer.ts`, `ThreeJSGraph.tsx` 와 같은 디렉토리에 `TreemapView.tsx` 신규 추가
- 사용자 FE 페이지: `/Users/gideok-kwon/IdeaProjects/msa/code-dictionary/frontend/src/pages/SearchPage.tsx`
  - 트리맵을 별도 페이지/탭으로 노출할지, SearchPage 내부 뷰 토글로 둘지 결정 필요 (Q8)
- 라이브러리: 양쪽 frontend 모두 `recharts@3.8.1` 설치됨
  - code-dictionary FE: `/Users/gideok-kwon/IdeaProjects/msa/code-dictionary/frontend/package.json`
  - admin FE: `/Users/gideok-kwon/IdeaProjects/msa/admin/frontend/`
- Gateway 라우트: `/Users/gideok-kwon/IdeaProjects/msa/gateway/src/main/resources/application.yml:28`
  - `/api/v1/concepts/**` 라우트 부재 → F4 에서 신규 추가
- 디자인 가드레일: `/Users/gideok-kwon/IdeaProjects/msa/docs/conventions/frontend-design.md`
  - AI Slop 패턴, 60-30-10 색상 규칙, WCAG AA 대비, 타이포 스케일

## Visual Assets

- `planning/visuals/` 결과: **No visual files found** (bash 확인)
- 외부 레퍼런스 이미지: `/Users/gideok-kwon/Desktop/image.png` — 네이버 증권 모바일 트리맵
  - 면적 = 시가총액(비중), 색상 = 등락률 (red=상승, blue=하락, gray=보합)
  - code-dictionary 매핑: 면적 = `indexCount`, 색상 = `level`

## Requirements Summary

### Functional

- **F1 (BE / stats endpoint)**: `code-dictionary/app` 의 `ConceptController` 에
  `GET /api/v1/concepts/stats` 엔드포인트 추가.
  - 응답: `category × concept` 행렬 — `{ categories: [{ category, concepts: [{ conceptId, name, indexCount, level }] }], totals: { byLevel, byCategory } }`
  - `GraphService` 에 `getCategoryStats()` 신규 추가 (기존 `getGraphData()` 로직 분해/재활용)
  - 응답 포맷은 공통 `ApiResponse<T>` 래퍼 (`docs/architecture/api-response.md`)
- **F2 (FE / user)**: `code-dictionary/frontend/src/components/graph/TreemapView.tsx` 신규
  - `recharts` `<Treemap>` 사용, 면적=`indexCount`, 색상=`level`
  - 카테고리 필터 chip (F6) 과 연동
  - 클릭 시 concept 상세로 이동 (F7)
- **F3 (FE / admin)**: `admin/frontend` 에 트리맵 뷰 추가
  - 신규 페이지 또는 기존 code-dictionary 관리 페이지의 탭 (Q6 / Q8 결정 후 확정)
  - 사용자 FE 와 동일한 `/api/v1/concepts/stats` 호출
- **F4 (Gateway)**: `gateway/src/main/resources/application.yml` 에
  `/api/v1/concepts/**` → `code-dictionary` 서비스 라우트 추가
  - K8s DNS (`http://code-dictionary:PORT`) 기반
- **F5 (FE / 색상)**: 트리맵 tile 색상 매핑
  - BEGINNER → green 계열
  - INTERMEDIATE → yellow/amber 계열
  - ADVANCED → red 계열
  - 정확한 hex/oklch 토큰은 `frontend-design.md` 60-30-10 규칙 준수 + WCAG AA 4.5:1 대비 (Q1 확정 후 적용)
- **F6 (FE / 필터)**: 카테고리 chip 필터 — "전체" + 13 개 카테고리 토글
  - 네이버 트리맵의 가로 스크롤 chip UI 참조
  - 선택된 카테고리만 트리맵 렌더링 (또는 강조)
- **F7 (FE / 인터랙션)**: tile 클릭 시 concept 상세로 이동
  - 사용자 FE: concept detail 라우트 또는 모달
  - admin FE: edit 다이얼로그 또는 동일 라우트 (Q6)

### Non-Functional

- **NFR1 (성능)**: stats endpoint P99 < 200ms (Tier 2 — 학습/관리 도구, ADR-0025)
- **NFR2 (페이로드)**: 응답 < 100KB (concept ~500 개 기준, gzip 후)
- **NFR3 (캐싱)**: concept CRUD 가 빈번하지 않으므로 in-memory(Caffeine) 또는 Redis TTL 캐시
  - 무효화 전략은 Q5 에서 확정 (이벤트 기반 invalidate vs TTL only)
- **NFR4 (접근성)**: WCAG AA — 키보드 네비게이션, screen reader 라벨, 색상 대비 4.5:1+
  - tile 의 색상만으로 정보 구분 금지 (텍스트 라벨 병행)
  - `frontend-design.md` 의 AI Slop 패턴 회피
- **NFR5 (모바일)**: 네이버 레퍼런스가 모바일 스크린샷 — 모바일 우선 레이아웃
  - chip overflow 처리 (Q7)
  - tile 최소 터치 영역 44 × 44px

### Scope

#### In Scope

- F1~F7 (백엔드 stats + FE 양쪽 트리맵 + Gateway 라우트)
- NFR1~NFR5 충족
- `recharts` 기반 (이미 양쪽 FE 에 설치됨)
- `indexCount` 기반 면적 (V1)

#### Out of Scope

- **OS1**: OpenSearch 자동 동기화 (현재 수동 버튼만 존재) — 별도 spec
- **OS2**: Admin K8s ingress proxy 설정 (정적 SPA → /api/* 라우팅) — 별도 ADR
- **OS3**: Concept `weight` DB 컬럼 추가 (V2 — indexCount 외 별도 가중치 부여)
- **OS4**: 시계열/히스토리(트리맵 변화 추이) — V2 이후
- **OS5**: 트리맵 export (PNG/CSV) — V2 이후

### Technical

- 언어/스택:
  - 백엔드: Kotlin / Spring Boot (`code-dictionary/app`)
  - FE: React 19 + Vite + recharts 3.8.1 (양쪽 frontend 동일)
- 디렉토리 패턴: Clean Architecture — `application/graph/service`, `presentation/concept/controller`
- 테스트: Kotest BehaviorSpec + MockK (BE), vitest + @testing-library (FE)
- 컨벤션:
  - `docs/conventions/code-convention.md`
  - `docs/conventions/frontend-design.md`
  - `docs/conventions/logging.md` (kotlin-logging 람다 형식)
  - `docs/architecture/api-response.md`
- ADR 영향:
  - ADR-0025 latency budget Tier 2 적용 (NFR1)
  - 기존 ADR 변경 불필요, 신규 ADR 도 불필요 (구조 변경 없음)
