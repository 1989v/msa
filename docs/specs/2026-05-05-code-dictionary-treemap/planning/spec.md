<!-- source: code-dictionary -->
<!-- source: portal-fe -->
# Spec: Code Dictionary Treemap Visualization

## 1. Overview

학습자/운영자가 code-dictionary 의 13 개 카테고리에 걸친 concept 분포(면적=`indexCount`,
색상=`level`)를 한눈에 파악할 수 있도록 네이버 증권 모바일 "증시 현황" 트리맵 스타일을
양쪽 frontend 에 도입한다. 백엔드는 기존 `GraphService.getGraphData()` 의 집계 로직을
분해하여 별도 stats endpoint 로 노출하고, FE 는 양쪽 모두 `recharts@3.8.1` Treemap 으로
렌더한다.

- 참고 이미지: `/Users/gideok-kwon/Desktop/image.png` — 카테고리 chip(가로 스크롤) +
  본체 트리맵 + 하단 범례/카운트 3 단 구성
- 영향 받는 서비스: `code-dictionary` (BE + user FE), `admin` (admin FE), `gateway` (route 1 개 추가)

## 2. Goals & Non-Goals

### Goals
- G1: 카테고리별 concept 분포를 한 화면에서 직관적으로 파악
- G2: 학습 난이도(level) 기반 색상으로 학습 진입점 탐색 보조
- G3: 운영자가 빈 카테고리/소외 영역을 즉시 식별
- G4: 사용자/admin 양쪽이 동일 stats endpoint 재사용 (backend 코드 단일 진실 공급원)

### Non-Goals
- ForceGraph3D 대체 X — 공존 (탭/뷰 토글)
- OpenSearch 자동 동기화 변경 X (수동 버튼 유지)
- Concept `weight` 컬럼 신설 X (V2)
- 시계열/히스토리, export, admin K8s ingress proxy 는 별도 스펙

## 3. User Stories

- **US1 (학습자)**: code-dictionary 사용자 FE 에서 트리맵을 보고 카테고리별 비중/난이도
  분포를 파악한 뒤, 흥미 있는 tile 을 클릭해 concept 상세로 진입한다.
- **US2 (운영자)**: admin FE 트리맵에서 indexCount 가 작거나 빈 카테고리를 식별하고,
  tile 클릭 → edit 다이얼로그로 즉시 보강 작업에 진입한다.
- **US3 (운영자)**: 카테고리 chip 필터로 특정 카테고리에 집중하여 level 분포 균형을
  점검한다 (BEGINNER 만 있고 ADVANCED 가 없는 영역 등).
- **US4 (학습자, 모바일)**: 모바일 뷰포트에서 chip 가로 스크롤 + 트리맵 정사각형
  레이아웃으로 학습 흐름을 끊지 않고 탐색한다.

## 4. Architecture

### 4.1 Data Flow

```
[Browser (user FE / admin FE)]
        |
        | GET /api/v1/concepts/stats/treemap
        v
[Gateway :8080]  (신규 라우트: /api/v1/concepts/**)
        |
        v
[code-dictionary :8089]
   ConceptController.stats()
        |
        v
   GraphService.getCategoryStats()  @Cacheable("conceptCategoryStats")
        |
        +-- Caffeine Cache (CacheManager bean / TTL 5 분)
        |       (miss 시)
        v
   ConceptRepositoryPort + ConceptIndexRepositoryPort -> MySQL
```

### 4.2 Component Boundaries

- **Domain**: 변경 없음 (Concept aggregate 그대로)
- **Application**:
  - `GraphService` 에 `getCategoryStats(filter: CategoryStatsFilter): TreemapDataDto`
    추가. 기존 `getGraphData()` 의 `indexCountMap`, `byCategory`, `byLevel` 산출
    부분을 private helper 로 분해하여 재사용
    (`GraphService.kt` 참조 — 분해, 중복 금지)
  - 신규 DTO: `TreemapDataDto`, `TreemapCategoryDto`, `TreemapConceptDto`,
    `TreemapTotalsDto` (`application/graph/dto/` 위치)
- **Infrastructure**:
  - 신규 `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/infrastructure/cache/CacheConfig.kt`
    에 Caffeine `CacheManager` 빈 정의. V1 은 `GraphService.getCategoryStats()`
    에 `@Cacheable("conceptCategoryStats", key = "...")` 직접 부착 (단순화).
  - V2 마커: 다중 인스턴스 분산 캐시/관측 분리 필요 시 `StatsCachePort` 추상화 검토.
- **Presentation**: `ConceptController` 에 `@GetMapping("/stats/treemap")` 추가
  (`ConceptController.kt` 의 `/api/v1/concepts` base path 재사용)
- **FE (code-dictionary)**:
  `code-dictionary/frontend/src/components/graph/TreemapView.tsx` 신규
  + `SearchPage.tsx` 에 view-mode 토글 (graph / treemap)
- **FE (admin)**: `admin/frontend/src/pages/CodeDictionaryPage.tsx` 에 탭 추가
  (CRUD 탭 + Treemap 탭). Treemap 을 default 탭으로 둠
- **Gateway**: `application.yml` 의 `spring.cloud.gateway.server.webflux.routes` 에
  code-dictionary 라우트 신규 추가 (현재 부재 — analytics-service 패턴 복제)

### 4.3 Transaction & Logging Policy

- **`@Transactional`** (`docs/conventions/transactional-usage.md`):
  - `getCategoryStats()` 는 캐시(`@Cacheable`)를 포함하므로 **`@Transactional` 미사용**
    (캐시 hit 시 트랜잭션 오픈 비용 회피, 캐시 진입 순서 명료화).
  - 캐시 miss 후 호출되는 read path 자체는 단일 read 호출이므로 트랜잭션 불요. 향후
    여러 read 를 묶어 일관 스냅샷이 필요해지면 helper private 메서드만
    `@Transactional(readOnly = true)` 부착 검토.
  - `ConceptService.create/update/delete` 는 기존 정책 유지하되 `@CacheEvict` 어노테이션을
    **트랜잭션 커밋 후** 의미상 안전하도록 메서드 종료 시점에 적용 (Spring 기본 동작).
- **Logging** (`docs/conventions/logging.md` — kotlin-logging 람다 형식 필수):
  - stats endpoint 진입: `logger.info { "stats.treemap request filter=$filter" }`
  - 캐시 miss + slow query (>100ms): `logger.warn { "stats.treemap cache_miss elapsedMs=$ms" }`
  - repository 호출 실패: `logger.error(e) { "stats.treemap repo_failure" }`

## 5. API Design

### 5.1 Endpoint: `GET /api/v1/concepts/stats/treemap`

**Query parameters**
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `categories` | comma-separated string | N | 카테고리 필터 (미지정 시 전체) |
| `includeZeroIndex` | boolean | N | indexCount=0 concept 포함 여부 (default `false`) |

**Response (`ApiResponse<TreemapDataDto>`)**

```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "name": "ARCHITECTURE",
        "totalConcepts": 7,
        "totalIndexCount": 42,
        "concepts": [
          {
            "conceptId": "clean-architecture",
            "name": "Clean Architecture",
            "level": "INTERMEDIATE",
            "indexCount": 12
          }
        ]
      }
    ],
    "totals": {
      "byLevel": { "BEGINNER": 30, "INTERMEDIATE": 65, "ADVANCED": 18 },
      "byCategory": { "ARCHITECTURE": 7, "DATABASE": 11 },
      "totalConcepts": 113,
      "totalIndexCount": 487
    }
  }
}
```

**규칙**
- 응답 형식은 `com.kgd.common.response.ApiResponse<T>` 래퍼
  (`docs/architecture/api-response.md`)
- 인증: 현재 ConceptController 의 다른 GET 과 동일하게 public
- CORS: 기존 정책 (localhost:5173/5174 dev port) 재사용
- 캐시 무효화: ConceptService 의 create/update/delete 후 명시적 `@CacheEvict("conceptCategoryStats", allEntries = true)`

### 5.2 Error Codes

- `400 INVALID_CATEGORY` — 알 수 없는 카테고리명 입력
- `500 INTERNAL_ERROR` — 일반 (BusinessException → ApiResponse.error 변환)

### 5.3 Latency Budget (ADR-0025)

- 사용자 FE 가 직접 호출하는 동기 응답 → **Tier 1**.
  - 목표: **P99 < 200 ms** (Gateway 포함 사용자 체감 latency).
  - 측정: Micrometer `http.server.requests` percentile histogram + Prometheus.
  - 알람: ADR-0025 §3 P99 alerting 룰에 `code-dictionary:GET /api/v1/concepts/stats/treemap`
    엔드포인트 등록. 5 분 슬라이딩 P99 ≥ 200ms 시 warn, ≥ 400ms 시 critical.

## 6. Frontend Design

### 6.1 Layout (참고: 네이버 증권 트리맵)

```
+---------------------------------------------------------------+
| 카테고리 분포 ⓘ                              [전체] [그래프]   |
+---------------------------------------------------------------+
| [전체] [ARCHITECTURE] [DATABASE] [NETWORK] ...  >             |  <- chip 가로 스크롤
+---------------------------------------------------------------+
|                                                               |
|   +----------------+  +-------+  +--------+                    |
|   |                |  |       |  |        |                    |
|   |  ARCHITECTURE  |  | DB    |  | NETWK  |                    |
|   |  (큰 타일)     |  +-------+  +--------+                    |
|   |                |  +-------+                                |
|   +----------------+  | TEST  |                                |
|                       +-------+                                |
+---------------------------------------------------------------+
| ● BEGINNER 30  ● INTERMEDIATE 65  ● ADVANCED 18 / Total 113   |
+---------------------------------------------------------------+
```

- 상단: 제목(`카테고리 분포`) + ⓘ 툴팁 + 우측 view-mode 토글
- 중앙: `recharts` `<Treemap>` (`aspectRatio` desktop 16:9, mobile 1:1)
- 하단: level 색상 범례 + 카운트 + 합계

### 6.2 색상 매핑 (Q1 결정 — cool→warm sequential)

`docs/conventions/frontend-design.md` 의 OKLCH 토큰 정책(60-30-10, chroma 0.005-0.015)을
강제 적용. **신호등(녹/노랑/적) 매핑은 폐기** — 한국 금융 UX 의 빨강=상승 컨벤션과 충돌.
대신 cool → warm sequential 로 OKLCH **lightness 만 단조 변동**, chroma 는 0.01 부근으로
고정하여 sequential 인코딩 + WCAG AA 보장.

| Level | OKLCH | 토큰명 | 의미 |
|---|---|---|---|
| BEGINNER | `oklch(0.85 0.01 220)` | `--ko-level-beginner` | cool light teal — 진입 |
| INTERMEDIATE | `oklch(0.70 0.012 90)` | `--ko-level-intermediate` | neutral amber — 중간 |
| ADVANCED | `oklch(0.55 0.015 30)` | `--ko-level-advanced` | warm deep magenta — 깊이 |

- **선언 위치**: 양쪽 frontend 의 globals.css (또는 token 정의 파일) 의 기존 토큰 옆에
  추가. `code-dictionary/frontend/src/styles/globals.css`,
  `admin/frontend/src/styles/globals.css` (정확한 파일은 implement 시 확인).
- `indexCount` 농도: 동일 level 내 lightness ±0.05 미세 조정 가능 (텍스트 라벨 병기로
  색상 단독 의존 금지 — NFR4).

### 6.3 Typography & Numerics

- chip text: `var(--text-sm)`
- tile name: `var(--text-base)`
- tile count: `font-variant-numeric: tabular-nums` (자릿수 정렬)
- 범례 카운트: `tabular-nums` 동일

### 6.4 Interaction

- **hover**: tooltip (이름, level, indexCount, category)
- **click (user FE)**: concept detail 페이지로 navigate
  (`/concepts/{conceptId}` — SearchPage 의 기존 detail 라우트 재사용)
- **click (admin FE)**: edit 다이얼로그 즉시 오픈 (운영자 동선 단축, Q6)
- **chip click**: 해당 카테고리만 트리맵 렌더 (미선택 시 전체)
- **keyboard**: Tab 순서 = chip → tile, Enter 로 활성화

### 6.5 Mobile & Scroll Policy

- **chip strip — scoped exception**: chip strip 영역에 한정하여 가로 스크롤 허용
  (`overflow-x: auto` + `scroll-snap-type: x mandatory`), 우측 화살표 affordance 표시
  (네이버와 동일). **페이지 레벨 가로 스크롤 금지 원칙은 유지** — 가로 스크롤은 chip strip
  컨테이너 내부에 한정.
- treemap aspectRatio: desktop 16:9 → mobile 1:1
- tile 최소 터치 영역: 44 × 44 px

### 6.6 Accessibility (NFR4 보강)

- 각 tile: `role="treeitem"`, `aria-label="{name}, {level}, indexCount {n}"`
- chip strip 컨테이너: `role="tablist"`, 각 chip `role="tab" aria-selected`
- `prefers-reduced-motion: reduce` 미디어 쿼리 → motion / transition 비활성
- focus-visible: 2-3 px solid outline (`var(--focus-ring)` 토큰), tile / chip 양쪽
- 수동 QA: axe DevTools 0 critical issue 통과 (test-quality.md 체크리스트)

### 6.7 Motion Tokens

- tile hover: 100-150 ms `opacity` + `transform: scale(1.02)` only
- bounce / elastic / overshoot 금지 (AI Slop 방지)
- `prefers-reduced-motion: reduce` 시 transition 전체 제거

### 6.8 빈 상태 처리

- 카테고리에 concept 0 개: chip 자체 숨김 (Q3)
- indexCount=0 concept: 응답에서 제외 (Q4), 단 카테고리 전체가 0 이면 최소 1 개
  placeholder concept 보존하여 카테고리 자체는 시각화

### 6.9 Recharts Data Transform & Custom Tile

`recharts` `<Treemap>` 입력 형식:

```
{ name: "root", children: [ { name: "ARCHITECTURE", children: [
   { name: "Clean Architecture", size: 12, level: "INTERMEDIATE", conceptId: "clean-architecture" }
] } ] }
```

- **백엔드 응답** (`categories[].concepts[]`) → **클라이언트가 flatten + transform**.
  transform 함수 시그니처:
  - `function toTreemapData(dto: TreemapDataDto): TreemapNode` — root + 1 depth (category)
    + 2 depth (concept) 트리 생성. concept 의 `indexCount` 를 `size` 로 매핑.
- 색상은 recharts 의 `dataKey` 로 표현 불가 → `<Treemap content={<CustomTile />}>` 의
  **커스텀 렌더러**로 `level` 기반 색상 적용.
- **CustomTile 책임**:
  1. 면적 기반 라벨 우선순위(이름 > indexCount > 생략)
  2. `level` → OKLCH 토큰 매핑 (`--ko-level-*`)
  3. `aria-label` 부착 (NFR4)
  4. focus / hover 상태 시 outline 표시

## 7. Caching Strategy (Q5)

- **1 차**: Caffeine in-memory, TTL 5 분, key = `(categories, includeZeroIndex)`.
  `CacheManager` 빈은 `infrastructure/cache/CacheConfig.kt` 에서 정의 (§4.2 참조).
- **무효화**: ConceptService 의 create/update/delete 메서드에서
  `@CacheEvict("conceptCategoryStats", allEntries = true)` (또는 manual
  `cache.invalidateAll()`) 호출. 트랜잭션 커밋 후 evict (Spring 기본 동작).
- **모니터링**: `cache.gets`, `cache.puts`, `cache.evictions` 카운터를
  `management.metrics` 로 노출 (Micrometer Caffeine 통합).
- **2 차 (V2)**: prod-k8s 다중 인스턴스에서 Redis 분산 캐시 + `StatsCachePort` 추상화
  검토 (별도 스펙).

## 8. Gateway Route

`gateway/src/main/resources/application.yml` 의
`spring.cloud.gateway.server.webflux.routes` (Spring Cloud 2025.1 Oakwood) 하위 배열에
신규 추가. **현재 code-dictionary 라우트 부재** → 신규 추가, analytics-service 패턴 복제.

| 항목 | 값 |
|---|---|
| `id` | `code-dictionary-service` |
| `uri` | `http://code-dictionary:8089` (K8s service DNS) |
| `predicates` | `Path=/api/v1/concepts/**, /api/v1/index/**` |
| `filters` | (비움 — analytics-service 와 일치) |

- analytics-service / experiment-service 라우트와 동일 패턴 (mechanical change)
- ADR 불필요

## 9. Test Plan (요약 — 상세는 `planning/test-quality.md`)

| Layer | 도구 | 위치 | 핵심 시나리오 |
|---|---|---|---|
| BE unit | Kotest BehaviorSpec + MockK | `application/graph/service/GraphServiceCategoryStatsTest.kt` | concept 0/N 개, indexCount=0, level 분포 |
| BE unit (cache) | Kotest + MockK | `application/concept/service/ConceptServiceCacheEvictTest.kt` | create/update/delete 후 stats 캐시 invalidate 검증 |
| BE integration | `@SpringBootTest` + MockMvc | `presentation/.../ConceptStatsControllerTest.kt` | 200 OK + ApiResponse shape + payload < 100KB |
| BE perf (micro) | JMH | `code-dictionary/app/src/jmh/.../GetCategoryStatsBench.kt` | warm-up 5 / measure 20 / fork 1 |
| BE perf (e2e) | k6 | `code-dictionary/app/src/test/k6/treemap-stats.js` | 1000 RPS × 60s, P99 < 200ms |
| FE component | vitest + @testing-library | 양쪽 FE 의 `__tests__/TreemapView.test.tsx` | 렌더, chip 필터, click 콜백, 키보드 |
| Manual QA | 체크리스트 | `planning/test-quality.md` | 모바일 viewport, axe 접근성, AI Slop 자가 점검 |

- **신규 의존성**: 양쪽 FE 에 `vitest`, `@testing-library/react`,
  `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` 추가 필요
  (현재 미설치). implement 단계 첫 task 로 분리.

### 9.1 CI Gates & Doc Tracking

- 문서-소스 추적: `python ai/plugins/hns/scripts/doc_map.py` 실행 + 결과
  `docs/doc-index.lock.json` diff 를 동일 PR 에 커밋 (`docs/standards/doc-index-tracking.md`).
- CI 게이트로 `python ai/plugins/hns/scripts/doc_map.py --check` 추가.
- CI vs 수동 분리표는 `planning/test-quality.md` Quality Gates 참조.

## 10. Open Questions (요약 — 상세는 `planning/open-questions.yml`)

| ID | 주제 | 결정 / 상태 |
|---|---|---|
| Q1 | 색상 매핑 | **closed** — cool→warm sequential (OKLCH lightness 변동, chroma 고정) |
| Q2 | 카테고리 정렬 | implement 시 결정 (deferred) |
| Q3 | 빈 카테고리 처리 | chip 자체 숨김 |
| Q4 | indexCount 0 concept | 응답 제외, 단 카테고리 최소 1 개 보존 |
| Q5 | 캐시 전략 | Caffeine TTL 5 분 + CUD 명시적 evict |
| Q6 | admin 클릭 액션 | edit 다이얼로그 즉시 오픈 |
| Q7 | 모바일 chip overflow | 가로 스크롤 (chip strip 한정) |
| Q8 | ForceGraph3D 공존 | 탭 전환 + Treemap 을 default |

## 11. ADR Check

- 단일 서비스 내 변경 (도메인 변경 없음, 기존 Repository / Controller 패턴 재사용)
- Gateway 라우트 추가는 mechanical (분류: convention)
- 신규/기존 ADR 충돌 없음 → **ADR 불필요**
- 영향 ADR (참조용): ADR-0019 (K8s 배포), ADR-0025 (latency budget — Tier 1 P99 200ms),
  ADR-0026 (docs taxonomy)

## 12. Rollout

- **Phase 1 (이번 스펙 범위)**: BE stats endpoint + Caffeine 캐시 + 양쪽 FE Treemap +
  Gateway route
- **Phase 2 (별도 스펙)**: Concept `weight` 컬럼 + indexCount 외 메트릭 (V2)
- **Phase 3 (별도 스펙)**: OpenSearch 자동 동기화 / Redis 분산 캐시
- 단일 PR 으로 진행 (BE/FE/Gateway 함께) — 양쪽 FE 의존성 변경이 작아 분리 비용 > 이득

## 13. Risks

| ID | 리스크 | 완화 |
|---|---|---|
| R1 | indexCount 0 concept 다수 → 트리맵이 시각적으로 비어 보임 | Q4 결정대로 응답 제외 + 카테고리 최소 1 개 보존 |
| R2 | stats endpoint 캐시 미스 시 모든 concept + index 조회 → N+1 | `findAllList()` + `findAll()` 단일 호출 (현 `GraphService` 와 동일 패턴), join 불요 |
| R3 | 양쪽 FE 코드 중복 (TreemapView 유사) | V2 마커: `code-dictionary/frontend/src/components/TreemapView.tsx` 를 `packages/treemap-shared/` 로 추출 후 admin 이 import. **현재 V1 은 양쪽 복사 허용** (admin 동선이 user 와 다름) |
| R4 | recharts Treemap 의 모바일 라벨 잘림 | CustomTile 면적 기반 라벨 우선순위(이름 > indexCount > 생략) + tooltip 보강 |
| R5 | 색상 단독 의존으로 색약 사용자 정보 손실 | NFR4 — tile 내 텍스트 라벨 병기 + 범례 텍스트 + OKLCH lightness sequential |

## 14. References

- 참고 이미지: `/Users/gideok-kwon/Desktop/image.png`
- `planning/initialization.md`, `planning/requirements.md`, `planning/test-quality.md`,
  `planning/open-questions.yml`
- 코드:
  - `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/graph/service/GraphService.kt`
  - `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/presentation/concept/controller/ConceptController.kt`
  - `code-dictionary/frontend/src/components/graph/ForceGraph3D.tsx`
  - `admin/frontend/src/pages/CodeDictionaryPage.tsx`
  - `gateway/src/main/resources/application.yml` (`spring.cloud.gateway.server.webflux.routes`)
- 컨벤션:
  - `docs/conventions/frontend-design.md` (AI Slop 방지, 60-30-10, OKLCH WCAG AA)
  - `docs/conventions/code-convention.md`
  - `docs/conventions/logging.md`
  - `docs/conventions/transactional-usage.md`
  - `docs/conventions/latency-budget.md`
  - `docs/architecture/api-response.md`
  - `docs/standards/doc-index-tracking.md`
- ADR: ADR-0019 (K8s), ADR-0025 (latency Tier 1 P99 200ms), ADR-0026 (docs taxonomy)
