# Tasks: Code Dictionary Treemap

## Overview

- **Total Task Groups**: 5 (G1 Backend / G2 FE-user / G3 FE-admin / G4 Gateway / G5 Quality Gates)
- **Total Tasks**: 36
- **Critical Path Length**: 8 (T1.1 → T1.6 → T1.2 → T1.3 → T2.3 → T2.4 → T2.7 → T5.3)
- **Estimated Total LOC**: ~2,400 production + ~1,400 tests

## Task Groups (parallelizable)

| Group | 영역 | 의존 | 병렬 가능 여부 |
|---|---|---|---|
| **G1** | Backend (code-dictionary BE) | None | T1.1 → (T1.2, T1.4, T1.6 병렬) → T1.3 → (tests 병렬) |
| **G2** | Frontend (code-dictionary user FE) | G1 (T1.3 응답 shape 확정) | G3 와 완전 병렬 |
| **G3** | Frontend (admin FE) | G1 (T1.3 응답 shape 확정) | G2 와 완전 병렬 |
| **G4** | Gateway 라우트 | None (mechanical) | 어느 시점에든 병렬 가능 |
| **G5** | Performance + Manual QA + Doc index | G1, G2, G3, G4 모두 완료 | 최후 |

> **병렬 전략**: G1 prerequisite (T1.1) → G1 core 병렬 (T1.2/1.4/1.6) → T1.3 endpoint → 즉시 G2/G3 시작하면서 G1 tests 병렬 → G4 는 어느 시점에든 별도 워커 → 최종 G5.

---

## Group G1: Backend (code-dictionary)

**Phase**: phase-1-backend-stats-endpoint
**Required Skills**: kotlin, spring-boot, jpa, kotest, mockk, caffeine, micrometer
**Dependencies**: None

### T1.1: ConceptFixture 추가 (test 부트스트랩 prerequisite) — [x] tests done

- **파일**: `code-dictionary/app/src/test/kotlin/com/kgd/codedictionary/fixture/ConceptFixture.kt` (신규)
- **작업**:
  - `ConceptFixture.create(name, category, level, indexCount, ...)` 빌더 — 모든 필드 default 값
  - `ConceptFixture.large(count = 500)` 대량 생성 — 13 카테고리 균등 분포, level 비율 30/55/15
  - 필요 시 `IndexFixture.kt` 함께 생성 (Concept 와 Index 가 별도 aggregate 라면)
- **검증**: `./gradlew :code-dictionary:app:compileTestKotlin` 통과
- **참조**: `test-quality.md` §Test Data Fixture Convention (lines 108-124)
- **예상 LOC**: ~80
- **병렬 가능**: T1.4, T1.6 와 동시 시작 (다른 task 의 prerequisite)

### T1.2: GraphService.getCategoryStats() 구현 — [x] implementation done

- **파일**: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/graph/service/GraphService.kt` (수정)
- **작업**:
  - `getCategoryStats(filter: CategoryStatsFilter): TreemapDataDto` 신규 메서드
  - 기존 `getGraphData()` 의 `indexCountMap`, `byCategory`, `byLevel` 산출 로직을 **private helper** 로 분해 후 재사용 (DRY, 중복 금지)
  - `includeZeroIndex=false` 시 indexCount=0 concept 제외, 단 카테고리 전체가 0 이면 placeholder 1 개 보존 (Q4)
  - 빈 카테고리(concept 0 개) 제외 (Q3)
  - 카테고리 정렬: indexCount 합계 desc (Q2 1차안)
  - `@Cacheable("conceptCategoryStats", key = "#filter")` 부착 (`@Transactional` 미사용 — spec.md §4.3)
- **검증**: T1.7 단위 테스트로 검증
- **참조**: `spec.md` §4.2 (lines 65-79), §7 Caching Strategy (lines 280-288)
- **예상 LOC**: ~120 (helper 분해 포함)
- **병렬 가능**: T1.4, T1.6 와 동시 (T1.1 만 prerequisite)
- **구현 노트**: helper `loadAllConceptsWithIndexCounts()` (Triple 반환 — concepts + indexCountMap + totalIndexCount), `aggregateByLevel()`, `aggregateByCategory()` 분해. `getGraphData()` 도 동일 helper 사용하도록 리팩터.

### T1.3: ConceptController 에 stats/treemap endpoint 추가 — [x] implementation done

- **파일**: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/presentation/concept/controller/ConceptController.kt` (수정)
- **작업**:
  - `@GetMapping("/stats/treemap")` 추가, `@RequestMapping("/api/v1/concepts")` base 재사용
  - Query params: `categories` (comma-separated, optional), `includeZeroIndex` (boolean, default false)
  - 알 수 없는 카테고리명 → `BusinessException(INVALID_CATEGORY)` (400)
  - `ApiResponse.success(graphService.getCategoryStats(filter))` 래핑
  - `logger.info { "stats.treemap request filter=$filter" }` (logging 컨벤션)
- **검증**: T1.8 통합 테스트로 검증
- **참조**: `spec.md` §5.1 (lines 106-150), §4.3 logging (lines 99-103)
- **예상 LOC**: ~40
- **의존**: T1.2, T1.6 완료
- **병렬 가능**: T4.1 (gateway) 과 병렬
- **구현 노트**: 공용 `ErrorCode` 에 `INVALID_CATEGORY` 부재 → `INVALID_INPUT` 으로 매핑 + 한글 메시지 부착. 컨트롤러 진입 로그는 GraphService 에서 통일 처리 (메서드 진입 시점). 컨트롤러는 입력 정규화/검증만 담당.

### T1.4: Caffeine CacheManager 빈 (CacheConfig) — [x] implementation done

- **파일**: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/infrastructure/cache/CacheConfig.kt` (신규)
- **작업**:
  - `@Configuration @EnableCaching` 클래스
  - `CaffeineCacheManager` 빈 — TTL 5 분, maxSize 적정값 (예: 100 entries)
  - cache name: `conceptCategoryStats` 등록
  - Micrometer Caffeine 통합 활성화 (`management.metrics` 노출 — `cache.gets`, `cache.puts`, `cache.evictions`)
- **검증**: 앱 부트 후 `/actuator/metrics` 에 `cache.*` 메트릭 노출 확인
- **참조**: `spec.md` §7 Caching Strategy (lines 280-288)
- **예상 LOC**: ~50
- **병렬 가능**: T1.2, T1.6 와 동시 (T1.1 prerequisite 만 필요)
- **구현 노트**: `code-dictionary/app/build.gradle.kts` 에 `spring-boot-starter-cache` + `libs.caffeine` 의존성 추가. `recordStats()` 활성화 (Micrometer 자동 등록 전제). maxSize=256.

### T1.5: ConceptService 에 @CacheEvict 추가 (CUD) — [x] implementation done

- **파일**: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/concept/service/ConceptService.kt` (수정 — 정확한 경로는 implement 시 확인)
- **작업**:
  - `create()`, `update()`, `delete()` 메서드에 `@CacheEvict("conceptCategoryStats", allEntries = true)` 부착
  - 트랜잭션 커밋 후 evict 동작 확인 (Spring 기본 동작)
  - 클래스 레벨 `@Transactional` 정책 변경 없음 (`docs/conventions/transactional-usage.md`)
- **검증**: T1.9 캐시 evict 테스트로 검증
- **참조**: `spec.md` §4.3 (lines 91-98), §7 (lines 282-285)
- **예상 LOC**: ~10 (어노테이션만)
- **의존**: T1.4 (CacheManager 빈) 완료
- **병렬 가능**: T1.6, T1.10 과 병렬

### T1.6: TreemapDataDto / CategoryStatsDto 생성 — [x] implementation done

- **파일**:
  - `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/graph/dto/TreemapDtos.kt` (신규 — 5 개 DTO 통합)
- **작업**:
  - data class — 모든 필드 immutable (val), `level` 은 enum reference
  - `CategoryStatsFilter(categories: Set<Category>?, includeZeroIndex: Boolean)` — null = 전체
  - JSON 직렬화 검증용 default 값 부여
- **검증**: 컴파일 통과 + T1.8 IT 의 JSON shape 검증
- **참조**: `spec.md` §5.1 (lines 116-143), §4.2 (lines 71-74)
- **예상 LOC**: ~80
- **병렬 가능**: T1.2, T1.4 와 동시 (T1.1 prerequisite 만 필요)
- **구현 노트**: `CategoryStatsFilter.categories` 는 `Set<String>` (Category enum 직접 사용 시 컨트롤러 변환 부담 + 캐시 key 직렬화 안정성 고려). 컨트롤러에서 unknown 검증 + `uppercase()` 정규화 후 GraphService 에 위임.

### T1.7: GraphServiceCategoryStatsTest (Kotest BehaviorSpec) — [x] tests done

- **파일**: `code-dictionary/app/src/test/kotlin/com/kgd/codedictionary/application/graph/service/GraphServiceCategoryStatsTest.kt` (신규)
- **작업**: 5 개 시나리오 (test-quality.md §Unit Tests):
  1. given concept 0 개 → empty matrix, totals 0
  2. given concept N 개 + index M 개 → 카테고리별 group + indexCount 정확
  3. given indexCount=0 + `includeZeroIndex=false` → 응답 제외 (Q4)
  4. given level 분포 → totals.byLevel 합산 정확
  5. given relatedConceptIds 있는 concept → stats 응답에 graph 데이터 미포함 (분리 검증)
- **검증**: `./gradlew :code-dictionary:app:test --tests "*GraphServiceCategoryStatsTest"` 5 개 통과
- **참조**: `test-quality.md` lines 11-22
- **예상 LOC**: ~200
- **의존**: T1.2, T1.6, T1.1 완료
- **병렬 가능**: T1.8, T1.9, T1.10 과 동시

### T1.8: ConceptStatsControllerTest (MockMvc IT) — [x] tests done

- **파일**: `code-dictionary/app/src/test/kotlin/com/kgd/codedictionary/presentation/concept/controller/ConceptStatsControllerTest.kt` (신규)
- **작업**: 5 개 시나리오 (test-quality.md §Integration Test):
  1. `GET /api/v1/concepts/stats/treemap` 200 OK + `ApiResponse<T>` shape
  2. JSON 구조 `{ data: { categories: [...], totals: {...} } }`
  3. `ConceptFixture.large(count = 500)` seed → payload size < 100KB (NFR2)
  4. `categories=ARCHITECTURE,DATABASE` filter 동작 / unknown → 400 INVALID_CATEGORY
  5. `includeZeroIndex=true` 시 indexCount=0 concept 포함
- **검증**: `./gradlew :code-dictionary:app:test --tests "*ConceptStatsControllerTest"` 5 개 통과
- **참조**: `test-quality.md` lines 34-45
- **예상 LOC**: ~250
- **의존**: T1.3, T1.1 완료
- **병렬 가능**: T1.7, T1.9, T1.10 과 동시

### T1.9: CacheEvict 테스트 (ConceptServiceCacheEvictTest) — [x] tests done

- **파일**: `code-dictionary/app/src/test/kotlin/com/kgd/codedictionary/application/concept/service/ConceptServiceCacheEvictTest.kt` (신규)
- **작업**: 3 개 시나리오:
  1. given concept 생성 → `conceptCategoryStats` 캐시 invalidate 호출 검증
  2. given concept 수정 → invalidate 검증
  3. given concept 삭제 → invalidate 검증
- **검증 방법**: `CacheManager` mock 또는 Spring `@SpringBootTest` 슬라이스에서 `@CacheEvict` proxy 호출 확인
- **참조**: `test-quality.md` lines 24-32
- **예상 LOC**: ~120
- **의존**: T1.5, T1.1 완료
- **병렬 가능**: T1.7, T1.8, T1.10 과 동시

### T1.10: Logging 정책 적용 + Latency 메트릭 등록 — [x] implementation (logging) done / metrics yml pending

- **파일**:
  - `GraphService.kt` (logger 추가)
  - `ConceptController.kt` (T1.3 에서 부분 적용)
  - `application.yml` 또는 `MetricsConfig` — Micrometer histogram 등록
- **작업**:
  - kotlin-logging 람다 형식 — `logger.info { "..." }` (`docs/conventions/logging.md`)
  - 캐시 miss + slow query (>100ms) → `logger.warn`
  - repository 실패 → `logger.error(e) { "..." }`
  - `management.metrics.distribution.percentiles-histogram.http.server.requests=true` (Tier 1 P99 알람)
- **검증**:
  - 앱 부트 후 stats endpoint 호출 → `/actuator/metrics/http.server.requests?tag=uri:/api/v1/concepts/stats/treemap` 에서 percentile 확인
  - 로그 출력 형식이 람다 인지 수동 확인
- **참조**: `spec.md` §4.3 logging (lines 99-103), §5.3 latency (lines 158-164)
- **예상 LOC**: ~30
- **의존**: T1.3 완료
- **병렬 가능**: T1.7, T1.8, T1.9 와 동시
- **구현 노트**: `io.github.oshai.kotlinlogging.KotlinLogging` (project standard, `mu.KotlinLogging` 아님 — `docs/conventions/logging.md`). GraphService 에 logger 추가 + entry/slow/error 3 종 로그 적용. `application.yml` percentile-histogram 설정은 별도 task (구성 변경 — 본 task 범위 외).

**Acceptance Criteria (G1)**:
- [ ] `GET /api/v1/concepts/stats/treemap` 200 OK + ApiResponse 래퍼
- [ ] 응답 < 100KB (concept 500 개 기준)
- [ ] Caffeine 캐시 hit 시 미들레이어 트랜잭션 미오픈
- [ ] CUD 후 다음 stats 호출이 fresh 데이터 반환
- [ ] 모든 단위 + IT 테스트 통과
- [ ] `cache.*` + `http.server.requests` 메트릭 노출

---

## Group G2: Frontend (code-dictionary user FE)

**Phase**: phase-2-frontend-user
**Required Skills**: react, typescript, vitest, recharts, css-tokens, accessibility
**Dependencies**: G1 (T1.3 응답 shape)

### T2.1: vitest 부트스트랩 (prerequisite) — [x] implementation done (npm install pending — defer to tester)

- **파일**:
  - `code-dictionary/frontend/package.json` (수정 — devDependency + scripts)
  - `code-dictionary/frontend/vitest.config.ts` (신규)
  - `code-dictionary/frontend/src/test/setup.ts` (신규 — `@testing-library/jest-dom` import)
- **작업**:
  - devDependency 추가: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`
  - scripts: `test`, `test:watch`, `test:coverage`
  - `vitest.config.ts` — environment: `jsdom`, setupFiles 등록
- **검증**: `npm install && npm test -- --run` 빈 통과
- **참조**: `test-quality.md` lines 66-86
- **예상 LOC**: ~30 (config + scripts)
- **병렬 가능**: T3.1 과 동시 시작 (admin FE bootstrap)

### T2.2: OKLCH 토큰 추가 — [x] implementation done

- **파일**: `code-dictionary/frontend/src/index.css` (실제 globals 위치 — `src/styles/globals.css` 부재)
- **작업**:
  - `:root` 또는 token 블록에 다음 3 변수 추가:
    - `--ko-level-beginner: oklch(0.85 0.01 220);`
    - `--ko-level-intermediate: oklch(0.70 0.012 90);`
    - `--ko-level-advanced: oklch(0.55 0.015 30);`
  - chip strip 가로 스크롤용 `--ko-chip-strip-fade` (옵션)
  - `--focus-ring` 추가 + `prefers-reduced-motion: reduce` 미디어 쿼리 부착
- **검증**: 브라우저 DevTools → 토큰 inspect, 컴포넌트에서 `var(--ko-level-*)` resolve 확인
- **참조**: `spec.md` §6.2 (lines 196-209), Q1 resolution (open-questions.yml lines 20-27)
- **예상 LOC**: ~10
- **병렬 가능**: T2.1 직후, T2.3/T2.4/T2.6 과 동시

### T2.3: api/treemap.ts client — [x] implementation done

- **파일**: `code-dictionary/frontend/src/api/treemap.ts` (신규 — axios 인스턴스 패턴 재사용)
- **작업**:
  - `fetchTreemapStats(params: { categories?: string[]; includeZeroIndex?: boolean }): Promise<TreemapDataDto>` 함수
  - TypeScript 타입: `TreemapDataDto`, `TreemapCategoryDto`, `TreemapConceptDto`, `TreemapTotalsDto` (BE DTO 와 1:1)
  - 기존 axios 인스턴스 패턴 (`searchApi.ts` 참조) 재사용
  - `ApiResponse<T>` 인라인 타입 (기존 코드도 동일 패턴)
- **검증**: 타입 체크 통과 + T2.8 컴포넌트 테스트에서 mock 동작 확인
- **참조**: `spec.md` §5.1 (lines 116-143)
- **예상 LOC**: ~50
- **의존**: G1 T1.3 완료 (응답 shape 확정)
- **병렬 가능**: T2.4, T2.5, T2.6 와 동시

### T2.4: TreemapView 컴포넌트 — [x] implementation done

- **파일**: `code-dictionary/frontend/src/components/graph/TreemapView.tsx` (신규)
- **작업**:
  - `<Treemap>` from recharts@3.8.1 사용
  - `toTreemapData(dto): TreemapNode` flatten + transform 함수 (root + category + concept 트리)
  - `aspectRatio` desktop 16:9 / mobile 1:1 (`useIsMobile` 훅 + `matchMedia`)
  - props: `data`, `onTileClick(conceptId)` (chip / 범례는 상위 `TreemapSection` 이 소유)
  - 빈 데이터 → "데이터 없음" placeholder
  - `prefers-reduced-motion: reduce` 미디어 쿼리는 globals.css 에서 일괄 처리
- **검증**: T2.8 컴포넌트 테스트 + 수동 mobile viewport 확인
- **참조**: `spec.md` §6.1 layout (lines 167-186), §6.5 mobile (lines 228-235), §6.9 transform (lines 256-276)
- **예상 LOC**: ~200
- **의존**: T2.3 (타입 정의) 완료
- **병렬 가능**: T2.5, T2.6 와 동시 (서로 독립 컴포넌트)

### T2.5: CustomTile 렌더러 (color-by-level + a11y) — [x] implementation done

- **파일**: `code-dictionary/frontend/src/components/graph/CustomTile.tsx` (신규 — TreemapView 와 분리)
- **작업**:
  - `<rect>` + `<text>` SVG 커스텀 렌더링
  - `level` → `var(--ko-level-{level})` 매핑
  - 면적 기반 라벨 우선순위: 이름 + indexCount > 이름 > 생략 (area > 5000 / 1500 / else)
  - `aria-label="{name}, {level}, indexCount {n}"`, `role="treeitem"`
  - hover/focus: `outline` `var(--focus-ring)` 2-3px (focus-visible 시)
  - 키보드 Enter/Space → onTileClick 트리거
- **검증**: T2.8 키보드 / a11y 테스트 + 수동 axe DevTools
- **참조**: `spec.md` §6.6 a11y (lines 237-243), §6.9 (lines 271-276)
- **예상 LOC**: ~150
- **의존**: T2.2 (토큰 정의) 완료
- **병렬 가능**: T2.4, T2.6 와 동시

### T2.6: CategoryChipStrip (가로 scroll-snap) — [x] implementation done

- **파일**: `code-dictionary/frontend/src/components/graph/CategoryChipStrip.tsx` + `.css` (신규)
- **작업**:
  - 컨테이너: `overflow-x: auto`, `scroll-snap-type: x mandatory`
  - 우측 화살표 affordance (데스크탑) — 모바일에서는 숨김
  - 각 chip: `role="tab"`, `aria-selected`, 컨테이너 `role="tablist"`
  - 빈 카테고리 chip 자체 숨김 (Q3) — 호출 측이 `count > 0` 만 전달
  - "전체" chip 좌측 고정 (`onClearAll` 콜백)
  - props: `categories[]`, `selected: Set<string>`, `onToggle`, `onClearAll`
- **검증**: T2.8 chip 클릭 테스트 + 수동 모바일 viewport (375x667, 414x896)
- **참조**: `spec.md` §6.5 mobile (lines 228-232), §6.6 a11y (lines 239-240), Q3/Q7 resolution
- **예상 LOC**: ~120
- **의존**: T2.2 (토큰) 완료
- **병렬 가능**: T2.4, T2.5 와 동시
- **구현 노트**: 기존 `CategoryChips.tsx` 는 ForceGraph 전용 highlight UX 라 별도 컴포넌트 신설. 향후 통합은 V2 마커.

### T2.7: 페이지 통합 (탭 전환: ForceGraph3D ↔ Treemap) — [x] implementation done

- **파일**: `code-dictionary/frontend/src/pages/SearchPage.tsx` (수정), `components/graph/TreemapSection.tsx` + `.css` (신규)
- **작업**:
  - view-mode 토글 추가 (graph / treemap), Treemap 을 default (Q8)
  - `TreemapSection` 신설: chip strip + TreemapView + 범례 (BEGINNER/INTERMEDIATE/ADVANCED 카운트 + Total) 통합
  - 클릭 → 기존 `handleSelectConcept(conceptId)` 재사용 → DetailSidePanel 오픈 (기존 동선)
  - graph 모드 = 기존 Carousel3D (ForceGraph + Heatmap + Stats + 기존 TreemapPanel 4 패널) 보존
- **검증**: 수동 브라우저 확인 + 탭 전환 시 ForceGraph3D unmount/remount 정상
- **참조**: `spec.md` §4.2 (lines 81-83), §6.4 interaction (lines 219-225), Q8 resolution
- **예상 LOC**: ~80 (기존 SearchPage 수정)
- **의존**: T2.4, T2.5, T2.6 모두 완료
- **병렬 가능**: 없음 (이 group 의 마지막 통합 단계)

### T2.8: 컴포넌트 테스트 (vitest + RTL) — [x] tests done

- **파일**: `code-dictionary/frontend/src/components/graph/__tests__/TreemapView.test.tsx` (신규)
- **작업**: 6 개 시나리오 (test-quality.md §Component Tests):
  1. mock stats 데이터로 렌더 → tile N 개 확인
  2. 카테고리 chip 클릭 → 해당 카테고리만 표시
  3. tile 클릭 → onSelect 콜백 호출
  4. 빈 데이터 → "데이터 없음" placeholder
  5. 키보드 Tab/Enter → 첫 번째 tile 포커스 + activate
  6. `prefers-reduced-motion: reduce` 모킹 → transition 비활성 검증
- **검증**: `npm test -- --run TreemapView` 6 개 통과
- **참조**: `test-quality.md` lines 88-100
- **예상 LOC**: ~250
- **의존**: T2.7 완료
- **병렬 가능**: G3 T3.7 과 동시

**Acceptance Criteria (G2)**:
- [ ] `/concepts` (또는 SearchPage) 에서 Treemap 이 default 뷰로 노출
- [ ] 모바일 375 × 667 에서 chip 가로 스크롤 + 트리맵 1:1 비율
- [ ] tile 클릭 → concept detail 라우팅
- [ ] 6 개 컴포넌트 테스트 통과
- [ ] axe DevTools 0 critical (수동 — G5 에서 게이트)

---

## Group G3: Frontend (admin FE)

**Phase**: phase-2-frontend-admin
**Required Skills**: react, typescript, vitest, recharts, css-tokens
**Dependencies**: G1 (T1.3 응답 shape)

### T3.1: vitest 부트스트랩 — [x] implementation done (npm install pending — defer to tester)

- **파일**:
  - `admin/frontend/package.json` (수정)
  - `admin/frontend/vitest.config.ts` (신규)
  - `admin/frontend/src/test/setup.ts` (신규)
- **작업**: T2.1 과 동일 패턴 (admin frontend 에 별도 적용)
- **검증**: `cd admin/frontend && npm install && npm test -- --run` 빈 통과
- **참조**: `test-quality.md` lines 66-86
- **예상 LOC**: ~30
- **병렬 가능**: T2.1 과 동시
- **구현 노트**: `vitest@^2.1.8`, `@testing-library/react@^16.1.0`, `@testing-library/jest-dom@^6.6.3`, `@testing-library/user-event@^14.5.2`, `jsdom@^25.0.1` 추가. `vitest.config.ts` 에 `@` alias + jsdom env + setupFiles. `src/test/setup.ts` 는 `@testing-library/jest-dom` import 만 포함.

### T3.2: OKLCH 토큰 추가 (admin globals) — [x] implementation done

- **파일**: `admin/frontend/src/index.css` (admin 은 `src/styles/globals.css` 부재 — 단일 진입점 `index.css` 사용)
- **작업**: T2.2 와 동일한 3 변수 추가 (양쪽 FE 동일) + `--focus-ring` + `prefers-reduced-motion` 블록
- **검증**: DevTools 확인
- **참조**: `spec.md` §6.2, Q1 resolution
- **예상 LOC**: ~10
- **병렬 가능**: T3.3, T3.4 와 동시

### T3.3: api 확장 (treemap stats fetch) — [x] implementation done

- **파일**: `admin/frontend/src/api/codeDictionary.ts` (수정 — 기존 파일 확장, 신규 파일 X)
- **작업**: T2.3 과 동일한 `fetchTreemapStats` 추가, 동일 타입 정의 (코드 중복 허용 — V2 마커: `packages/treemap-shared/`)
- **검증**: 타입 체크 통과
- **참조**: `spec.md` R3 risk (lines 364-365) — 코드 중복 V1 허용
- **예상 LOC**: ~50
- **의존**: G1 T1.3 완료
- **병렬 가능**: T3.2, T3.4 와 동시
- **구현 노트**: `apiClient` (axios + Bearer token interceptor) 재사용. `fetchConceptByConceptId(conceptId)` 헬퍼 추가 — 트리맵 클릭 시 numeric `id` 가 필요한 edit dialog 를 위해 conceptId → Concept 조회 (V2: BE 가 GET /api/v1/concepts/{conceptId} 노출 시 단순화).

### T3.4: TreemapView 컴포넌트 (admin 버전, V2 마커) — [x] implementation done

- **파일**: `admin/frontend/src/components/codeDictionary/{TreemapView,CustomTile,CategoryChipStrip,TreemapSection}.tsx` (신규 4 개)
- **작업**:
  - T2.4 + T2.5 + T2.6 (TreemapView + CustomTile + ChipStrip) 을 admin 측에도 동일 패턴 복제
  - **V1 코드 중복 허용** (R3) — 각 파일 상단에 `// V2: extract to packages/treemap-shared/` 주석
  - props: `onTileClick(conceptId)` 만 admin 액션으로 다르게 주입
- **검증**: T3.7 컴포넌트 테스트
- **참조**: `spec.md` §4.2 (lines 84-85), R3 risk
- **예상 LOC**: ~400 (3 컴포넌트 통합)
- **의존**: T3.2, T3.3 완료
- **병렬 가능**: G2 의 T2.4/T2.5/T2.6 와 동시
- **구현 노트**: ChipStrip / Section 은 admin 의 tailwind 유틸리티 + cn() 패턴 사용 (별도 .css 파일 미생성). TreemapSection 은 admin 표준인 `useQuery` (`@tanstack/react-query`) 로 fetch 수행.

### T3.5: CodeDictionaryPage 에 탭 추가 (CRUD ↔ Treemap) — [x] implementation done

- **파일**: `admin/frontend/src/pages/CodeDictionaryPage.tsx` (수정)
- **작업**:
  - 탭 컴포넌트 추가: "트리맵" (default) + "CRUD" (기존)
  - **Treemap 을 default 탭** (Q8 admin 측 동선 단축)
  - URL query param 또는 local state 로 탭 보존 → `useState<TabKey>('treemap')` 채택 (단순화)
- **검증**: 수동 브라우저 확인 + 탭 전환 정상
- **참조**: `spec.md` §4.2 (lines 84-85), Q8 resolution
- **예상 LOC**: ~60
- **의존**: T3.4 완료
- **병렬 가능**: T3.6 과 순차 (T3.6 가 T3.5 위에 빌드)
- **구현 노트**: admin 에 별도 Tabs primitive 부재 → `role="tablist"` + `aria-selected` 가 적용된 button 그룹으로 구현. 등록 버튼은 CRUD 탭에서만 노출 (트리맵 탭 컨텍스트 와 무관).

### T3.6: admin click action — edit 다이얼로그 즉시 오픈 — [x] implementation done

- **파일**: `admin/frontend/src/pages/CodeDictionaryPage.tsx` (수정 — T3.5 와 동일 파일)
- **작업**:
  - tile 클릭 시 기존 edit 다이얼로그 컴포넌트 호출 (`onTileClick={(conceptId) => fetchConceptByConceptId(conceptId).then(setEditTarget)}`)
  - 다이얼로그가 fetch 후 prefill 되는지 확인
- **검증**: 수동 — 클릭 → edit dialog 즉시 오픈 + concept 정보 prefill
- **참조**: `spec.md` §6.4 interaction (lines 222-223), Q6 resolution
- **예상 LOC**: ~30
- **의존**: T3.5 완료
- **병렬 가능**: 없음 (T3.5 직후 동일 파일)
- **구현 노트**: `handleTreemapTileClick(conceptId)` async — `fetchConceptByConceptId` 결과로 기존 `editTarget` state 세팅. 실패/미발견 시 alert state (3 초 후 자동 숨김). CUD mutation success 콜백에 `treemap-stats` queryKey invalidate 추가하여 stats 캐시도 동기화.

### T3.7: 컴포넌트 테스트 (admin) — [x] tests done

- **파일**: `admin/frontend/src/components/codeDictionary/__tests__/CodeDictionaryTreemap.test.tsx` (신규)
- **작업**: T2.8 과 동일 6 개 시나리오 + admin 특화:
  - tile 클릭 → onSelect 콜백 → edit dialog open spy 검증
- **검증**: `cd admin/frontend && npm test -- --run CodeDictionaryTreemap` 통과
- **참조**: `test-quality.md` lines 91-100
- **예상 LOC**: ~250
- **의존**: T3.6 완료
- **병렬 가능**: G2 T2.8 과 동시

**Acceptance Criteria (G3)**:
- [ ] `CodeDictionaryPage` 에서 Treemap 이 default 탭으로 노출
- [ ] tile 클릭 → edit 다이얼로그 즉시 오픈 + 데이터 prefill
- [ ] 6 개 컴포넌트 테스트 통과

---

## Group G4: Gateway

**Phase**: phase-3-gateway-route
**Required Skills**: spring-cloud-gateway, yaml
**Dependencies**: None (mechanical)

### T4.1: code-dictionary 라우트 추가

- **파일**: `gateway/src/main/resources/application.yml` (수정 — `spring.cloud.gateway.server.webflux.routes` 배열)
- **작업**:
  - 신규 entry 추가:
    - `id: code-dictionary-service`
    - `uri: http://code-dictionary:8089` (K8s service DNS)
    - `predicates: [Path=/api/v1/concepts/**, /api/v1/index/**]`
    - `filters: []` (analytics-service 패턴 동일)
- **검증**:
  - `./gradlew :gateway:bootRun` 후 `curl http://localhost:8080/api/v1/concepts/stats/treemap` 200
  - K8s overlay 적용 시 ingress → gateway → code-dictionary 정상
- **참조**: `spec.md` §8 Gateway Route (lines 290-304), `requirements.md` line 42
- **예상 LOC**: ~10 (yaml entry)
- **병렬 가능**: G1, G2, G3 와 완전 독립 — 어느 시점에든 가능

### T4.2: route 통합 테스트 (해당 시)

- **파일**: `gateway/src/test/kotlin/.../CodeDictionaryRouteTest.kt` (해당 시)
- **작업**:
  - 기존 gateway 라우트 통합 테스트 패턴이 있다면 entry 1 개 추가
  - 없으면 수동 검증으로 대체 (T4.1 검증과 동일)
- **검증**: `./gradlew :gateway:test` 통과
- **참조**: gateway 모듈 기존 테스트 컨벤션 따름
- **예상 LOC**: ~30 (있다면)
- **의존**: T4.1 완료
- **병렬 가능**: 없음

**Acceptance Criteria (G4)**:
- [ ] `curl -i http://localhost:8080/api/v1/concepts/stats/treemap` 200 OK
- [ ] K8s overlay (`k3s-lite`) 에서 ingress → gateway → code-dictionary 라우팅 정상

---

## Group G5: Performance & Quality Gates

**Phase**: phase-4-quality-gates
**Required Skills**: jmh, k6, axe-devtools, manual-qa, doc-tracking
**Dependencies**: G1, G2, G3, G4 모두 완료

### T5.1: JMH 마이크로 벤치 (getCategoryStats) — [x] scaffold done (manual run deferred)

- **파일**: `code-dictionary/app/src/jmh/kotlin/com/kgd/codedictionary/bench/GetCategoryStatsBench.kt` (신규)
- **작업**:
  - Gradle JMH plugin 적용 확인 (없으면 추가)
  - warm-up 5 iteration / measurement 20 iteration / fork 1
  - 시드: `ConceptFixture.large(count = 500)` × 평균 5 indexCount (= 2500 index)
  - 캐시 hit / miss 두 경로 분리 측정
- **검증**: `./gradlew :code-dictionary:app:jmh` 결과 보고서 생성
- **참조**: `test-quality.md` lines 47-54
- **예상 LOC**: ~120
- **의존**: G1 완료
- **병렬 가능**: T5.2 와 동시
- **구현 노트**: `me.champeau.jmh` plugin 0.7.2 를 `code-dictionary/app/build.gradle.kts` 에 추가. 패키지 위치는 spec 의 권장(`com.kgd.codedictionary.bench`) 채택. `@Cacheable` 캐시 hit 측정은 Spring proxy 가 필요해 JMH 단독 시뮬레이션 불가 → cold(신규 인스턴스)/warm(인스턴스 재사용) 분리 측정으로 대체. 캐시 hit 자체는 k6 (T5.2) 로 위임. 실제 실행은 long runtime 으로 deferred.

### T5.2: k6 endpoint 부하 스크립트 — [x] scaffold done (manual run deferred)

- **파일**: `code-dictionary/app/src/test/k6/treemap-stats.js` (신규)
- **작업**:
  - 1000 RPS × 60 s 시나리오
  - `thresholds: { http_req_duration: ['p(99)<200'] }`
  - 타깃: `http://localhost:8080/api/v1/concepts/stats/treemap`
  - 사전 seed: `ConceptFixture.large(500)` 적재 스크립트 또는 README 가이드
- **검증**: k3d 환경에서 `k6 run treemap-stats.js` → P99 < 200ms 통과
- **참조**: `test-quality.md` lines 56-62, `spec.md` §5.3 latency (lines 158-164)
- **예상 LOC**: ~60
- **의존**: G1, G4 완료
- **병렬 가능**: T5.1 과 동시
- **구현 노트**: 50 VU × 60s 로 작성 (1000 RPS 는 사전 환경 검증 후 ramp). 스크립트 상단 주석에 실행 절차 + 기대 결과 명시. k6 미설치 환경에서는 실행 불가 → 수동 deferred.

### T5.3: 수동 QA 체크리스트 실행 — [x] checklist file generated (manual execution deferred)

- **파일**: `docs/specs/2026-05-05-code-dictionary-treemap/verifications/manual-qa-checklist.md` (신규 — `test-quality.md` lines 126-140 을 체크리스트화)
- **작업**:
  - 모바일 viewport (375 × 667, 414 × 896) chip overflow 확인
  - axe DevTools 0 critical issue
  - tile 색상 대비 WCAG AA (Lighthouse / axe)
  - 색상 단독 의존하지 않음을 라벨로 확인
  - tile 라벨 잘림 처리 (이름 > indexCount > 생략)
  - 사용자 FE click → detail 라우팅
  - admin FE click → edit 다이얼로그
  - Gateway 경유 prod overlay 200 OK
  - `cache.*` 메트릭 노출
  - `prefers-reduced-motion: reduce` 시 transition 비활성
  - AI Slop 자가 점검 (side-stripe, gradient text, glow shadow, purple gradient, bounce/elastic 없음)
- **검증**: 11 항목 모두 체크
- **참조**: `test-quality.md` lines 126-140, `docs/conventions/frontend-design.md`
- **예상 LOC**: 0 (체크 리스트 실행만)
- **의존**: G2, G3, G4 완료
- **병렬 가능**: T5.1, T5.2 결과 후 마지막
- **구현 노트**: 체크리스트는 prod rollout 전 QA 가 수기로 수행. critical 항목 (3, 6, 9, 10) 중 하나라도 실패 시 rollout 차단으로 명시.

### T5.4: doc_map.py 실행 + lock 갱신 — [ ] deferred (Bash 실행 권한 없음, parent agent 위임)

- **파일**: `docs/doc-index.lock.json` (수정 — diff 커밋)
- **작업**:
  - `python ai/plugins/hns/scripts/doc_map.py` 실행
  - 결과 diff 를 동일 PR 에 커밋
  - CI 게이트로 `doc_map.py --check` 성공 확인
- **검증**: `python ai/plugins/hns/scripts/doc_map.py --check` exit 0
- **참조**: `spec.md` §9.1 (lines 322-327), `docs/standards/doc-index-tracking.md`
- **예상 LOC**: ~20 (lock json diff)
- **의존**: 모든 task 완료 (코드 + 문서 변경 후 마지막)
- **병렬 가능**: T5.3 와 동시 가능 (T5.3 가 코드를 수정하지 않으므로)
- **구현 노트**: implementer 역할 제약 (Bash 실행 금지) 으로 본 task 는 parent agent / orchestrator 가 직접 수행해야 함. 명령: `cd /Users/gideok-kwon/IdeaProjects/msa && python3 ai/plugins/hns/scripts/doc_map.py && git diff --stat docs/doc-index*.json`

**Acceptance Criteria (G5)**:
- [ ] JMH 벤치 결과 cache hit < 1ms / miss < 50ms
- [ ] k6 P99 < 200ms (1000 RPS × 60s)
- [ ] axe DevTools 0 critical
- [ ] 11 개 수동 QA 항목 모두 체크
- [ ] `doc_map.py --check` exit 0
- [ ] PR 단일 커밋 또는 페이즈별 커밋으로 통합

---

## Dependency Graph

```
                        ┌──────────────────────────────────────┐
                        │                                      │
   T1.1 (fixture) ──┬─→ T1.2 (getCategoryStats) ──┐            │
                    ├─→ T1.4 (CacheConfig) ───────┤            │
                    ├─→ T1.6 (DTOs) ──────────────┼─→ T1.3 ────┼─→ T1.7/1.8/1.9/1.10 (tests + logging)
                    │                              │   (controller)
                    │                              │
                    └─→ T1.5 (CacheEvict) ←────────┘  (T1.4 후)

   T1.3 완료 →┬─→ T2.3 (api) ──→ T2.4/2.5/2.6 (components, 병렬) ──→ T2.7 ──→ T2.8 (tests)
              │                ↑
              │                T2.2 (tokens, T2.1 후)
              │
              └─→ T3.3 (api) ──→ T3.4 (component) ──→ T3.5 ──→ T3.6 ──→ T3.7 (tests)
                              ↑
                              T3.2 (tokens, T3.1 후)

   T2.1 (vitest) ┬─ G2 prerequisite
   T3.1 (vitest) ┴─ G3 prerequisite (T2.1 과 병렬)

   T4.1 (gateway) ──→ T4.2 (route IT)         [G1/G2/G3 와 완전 독립, 어느 시점에든 가능]

   G1, G2, G3, G4 모두 완료 ──→ T5.1, T5.2 (perf, 병렬) ──→ T5.3 (manual QA) ──┐
                                                                               ├─→ DONE
                                          T5.4 (doc_map) ─────────────────────┘
```

---

## Critical Path

**길이 8 스텝**: T1.1 → T1.6 → T1.2 → T1.3 → T2.3 → T2.4 → T2.7 → T5.3

> 실제로는 T1.6/T1.2/T1.4 가 병렬이므로 wall-clock 기준 critical 은 T1.1 → (T1.2 또는 T1.6 중 더 긴 것) → T1.3 → T2.3 → T2.4 → T2.7 → T5.3 = **7 스텝**.

---

## Implementation Order Recommendation

1. **Sequential prerequisites** (workstation 1 명):
   - T1.1 (BE fixture) — backend test 진입 가능 상태
   - T2.1, T3.1 (FE vitest bootstrap) — 양쪽 FE 병렬로 동시 시작 가능

2. **Backend core in parallel** (T1.1 완료 후):
   - T1.2 (getCategoryStats 구현)
   - T1.4 (CacheConfig 빈)
   - T1.6 (DTOs)
   - → T1.3 (controller, T1.2 + T1.6 의존)
   - → T1.5 (CacheEvict, T1.4 의존, T1.3 와 병렬 가능)

3. **Backend tests + logging** (T1.3 완료 후, 4 개 동시):
   - T1.7 (GraphService 단위)
   - T1.8 (Controller IT)
   - T1.9 (CacheEvict 테스트)
   - T1.10 (logging + metrics)

4. **Frontends in parallel** (T1.3 완료되면 응답 shape 확정 → 즉시 시작):
   - **G2 user FE**: T2.2 (토큰) → T2.3 (api) → T2.4/2.5/2.6 (3 컴포넌트 병렬) → T2.7 (페이지 통합) → T2.8 (테스트)
   - **G3 admin FE**: T3.2 (토큰) → T3.3 (api) → T3.4 (컴포넌트) → T3.5 → T3.6 → T3.7 (테스트)
   - 양쪽 worker 병렬 진행

5. **Gateway** (G4 — 어느 시점에든):
   - T4.1 (yaml entry) → T4.2 (IT, 있다면)
   - 다른 그룹과 완전 병렬

6. **Quality Gates** (G5 — 최종):
   - T5.1 (JMH) + T5.2 (k6) 병렬
   - T5.3 (수동 QA)
   - T5.4 (doc_map lock) — T5.3 와 병렬 가능

---

## Estimated Effort

| Group | Production LOC | Test LOC | 시간 (단일 워커 추정) |
|---|---|---|---|
| G1 Backend | ~330 | ~570 | 1.5 일 |
| G2 FE-user | ~640 | ~250 | 1.5 일 |
| G3 FE-admin | ~580 | ~250 | 1.0 일 (G2 패턴 재사용) |
| G4 Gateway | ~10 | ~30 | 0.25 일 |
| G5 Quality | ~200 | 0 | 0.5 일 |
| **Total** | **~1,760** | **~1,100** | **~4-5 일** (병렬 시 2-3 일) |

---

## CI/CD Gates (final)

- `./gradlew :code-dictionary:app:test` 통과
- `./gradlew :code-dictionary:app:build` 통과
- `cd code-dictionary/frontend && npm test -- --run && npm run lint && npm run build` 통과
- `cd admin/frontend && npm test -- --run && npm run lint && npm run build` 통과
- `python ai/plugins/hns/scripts/doc_map.py --check` exit 0
- (수동) k6 P99 < 200ms, axe 0 critical
