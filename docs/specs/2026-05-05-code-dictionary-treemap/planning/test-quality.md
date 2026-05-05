# Test & Quality Strategy — Code Dictionary Treemap

## Test Naming Convention

- 모든 테스트 파일 suffix 는 `Test.kt` 로 통일 (Kotest BehaviorSpec 도 동일).
  - `*Spec.kt` / `*IT.kt` 사용 금지 (`docs/standards/test-rules.md`).
- FE 테스트는 `*.test.tsx` 유지.

## Backend

### Unit Tests — `GraphService.getCategoryStats()`

- **Framework**: Kotest BehaviorSpec + MockK (`docs/standards/test-rules.md`)
- **위치**: `code-dictionary/app/src/test/kotlin/com/kgd/codedictionary/application/graph/service/GraphServiceCategoryStatsTest.kt`
- **시나리오**:
  - given concept 0 개 → empty matrix, totals 0
  - given concept N 개 + index M 개 → 카테고리별 group + concept 별 indexCount 정확
  - given 동일 concept 에 index 0 개 → `includeZeroIndex=false` 시 응답 제외 (Q4)
  - given level 별 distribution → totals.byLevel 합산 정확
  - given relatedConceptIds 있는 concept → stats 응답에는 미포함 (graph 와 분리)
- **Mock**: `ConceptRepositoryPort`, `ConceptIndexRepositoryPort`
- **Fixture**: `ConceptFixture.create(...)` 빌더 사용 (§Fixture Convention)

### Unit Tests — Cache Eviction

- **위치**: `code-dictionary/app/src/test/kotlin/com/kgd/codedictionary/application/concept/service/ConceptServiceCacheEvictTest.kt`
- **시나리오**:
  - given concept 생성 → `conceptCategoryStats` 캐시 invalidate 호출 검증
  - given concept 수정 → 동일하게 invalidate 검증
  - given concept 삭제 → 동일하게 invalidate 검증
- **검증 방법**: `CacheManager` mock 으로 `getCache("conceptCategoryStats")?.clear()` /
  `@CacheEvict` proxy 호출 확인 (Spring `@SpringBootTest` 슬라이스 또는 직접 spy).

### Integration Test — `ConceptController` stats endpoint

- **Framework**: `@SpringBootTest` + `MockMvc`
- **위치**: `code-dictionary/app/src/test/kotlin/com/kgd/codedictionary/presentation/concept/controller/ConceptStatsControllerTest.kt`
- **시나리오**:
  - `GET /api/v1/concepts/stats/treemap` 200 OK + `ApiResponse<T>` 래퍼 검증
  - 응답 JSON shape: `{ data: { categories: [...], totals: {...} } }`
  - 페이로드 크기 < 100KB (NFR2) — `ConceptFixture.large(count = 500)` 합성 데이터 기준
  - `categories` 쿼리 필터 동작 (단일 / 다중 / unknown → 400)
  - `includeZeroIndex=true` 시 indexCount=0 concept 포함
- **Stub**: 컨트롤러 계층 격리 시 `MockBean(GraphService)` 사용 가능. 스택 통합 검증
  케이스는 실제 빈 + 인메모리 fixture.

### Performance — Microbench (JMH)

- **Tool**: Gradle JMH plugin
- **위치**: `code-dictionary/app/src/jmh/kotlin/com/kgd/codedictionary/application/graph/service/GetCategoryStatsBench.kt`
- **설정**: warm-up 5 iteration, measurement 20 iteration, fork 1
- **대상**: `getCategoryStats()` 단독 (캐시 hit / miss 두 경로 비교)
- **시드**: `ConceptFixture.large(count = 500)` × 평균 5 indexCount (= 2500 index)

### Performance — Endpoint P99 (k6)

- **Tool**: k6
- **위치**: `code-dictionary/app/src/test/k6/treemap-stats.js`
- **시나리오**: 1000 RPS × 60 s, P99 < 200 ms 단언 (`thresholds: { http_req_duration: ['p(99)<200'] }`)
- **타깃**: 로컬 k3d (`http://localhost:8080/api/v1/concepts/stats/treemap`)
- **시드**: 사전 `ConceptFixture.large(500)` 적재 후 측정
- 결과는 ADR-0025 §3 P99 alerting 룰의 baseline 으로 활용.

## Frontend (code-dictionary user + admin 양쪽 동일 패턴)

### FE Test Infra Bootstrap (implement 첫 task)

양쪽 frontend (`code-dictionary/frontend`, `admin/frontend`) 의 `package.json` 에
다음 devDependency 추가:

- `vitest`
- `@testing-library/react`
- `@testing-library/user-event`
- `@testing-library/jest-dom`
- `jsdom`

scripts 추가:

| script | 명령 |
|---|---|
| `test` | `vitest run` |
| `test:watch` | `vitest` |
| `test:coverage` | `vitest run --coverage` |

각 frontend 루트에 `vitest.config.ts` 생성 (jsdom env, `@testing-library/jest-dom` setup).
이 작업은 implement 단계의 **첫 task** 로 분리하여 후속 컴포넌트 테스트 추가 가능 상태를 보장.

### Component Tests — `TreemapView.tsx`

- **Framework**: vitest + @testing-library/react
- **위치**:
  - 사용자: `code-dictionary/frontend/src/components/graph/__tests__/TreemapView.test.tsx`
  - admin: `admin/frontend/src/.../__tests__/CodeDictionaryTreemap.test.tsx`
- **시나리오**:
  - mock stats 데이터로 렌더 → tile N 개 확인
  - 카테고리 chip 클릭 → 해당 카테고리만 표시
  - tile 클릭 → onSelect 콜백 호출 (concept 상세 라우팅 / admin edit dialog)
  - 빈 데이터 → "데이터 없음" placeholder
  - 키보드 Tab/Enter → 첫 번째 tile 포커스 + activate (NFR4)
  - `prefers-reduced-motion: reduce` 모킹 시 transition 비활성 검증

### Visual Regression

- **현재 상태**: 레포에 visual regression 인프라 없음
- **결정**: Phase 1 에서는 defer. 수동 QA 체크리스트로 보강

## Test Data Fixture Convention

- **위치**: `code-dictionary/app/src/test/kotlin/com/kgd/codedictionary/fixture/ConceptFixture.kt`
- **빌더 패턴**:

  ```
  ConceptFixture.create(
      name = "Clean Architecture",
      category = ARCHITECTURE,
      level = INTERMEDIATE,
      indexCount = 5,
  )
  ```

  - 모든 인자는 default 값 보유 (테스트는 관심 필드만 명시).
- **대량 생성**: `ConceptFixture.large(count = 500)` — perf / payload size 검증용.
  카테고리 균등 분포, level 비율 약 30/55/15 (Goal G2 시뮬레이션).
- 다른 fixture (Index, Category) 가 필요하면 동일 패턴으로 `IndexFixture.kt` 등 추가.

## Manual QA Checklist

- [ ] 모바일 viewport (375 × 667, 414 × 896) 에서 chip overflow 정상 (chip strip 한정 가로 스크롤)
- [ ] 카테고리 chip 키보드 Tab 순서 자연스러움 + chip strip 외부 가로 스크롤 없음
- [ ] tile 색상 대비 WCAG AA (Chrome DevTools Lighthouse / axe DevTools)
- [ ] 색상에 의존하지 않고 라벨만으로 level 구분 가능 (OKLCH lightness sequential 의도 확인)
- [ ] tile 라벨이 작은 면적에서 잘림 처리 정상 (이름 + indexCount 우선순위)
- [ ] click → 상세 페이지/모달 라우팅 정상 (사용자 FE)
- [ ] click → edit 다이얼로그 정상 (admin FE)
- [ ] Gateway 경유 호출 (`/api/v1/concepts/stats/treemap`) prod overlay 에서 200 OK
- [ ] 캐시 hit/miss 메트릭이 `management.metrics` 에서 노출되는지
- [ ] axe DevTools 0 critical issue (treeitem role / aria-label 포함)
- [ ] `prefers-reduced-motion: reduce` OS 설정 시 transition 비활성
- [ ] AI Slop 패턴 자가 점검: side-stripe border, gradient text, glow shadow, purple gradient,
      bounce/elastic motion 없음

## Quality Gates — CI vs Manual

| 분류 | 항목 | 도구 / 명령 |
|---|---|---|
| **CI** | Backend test | `./gradlew :code-dictionary:app:test` |
| **CI** | Domain test | `./gradlew :code-dictionary:domain:test` (no-op 가능) |
| **CI** | Backend build | `./gradlew :code-dictionary:app:build` |
| **CI** | Backend lint (ktlint/detekt) | Gradle task |
| **CI** | FE unit test (양쪽) | `npm run test` (vitest) |
| **CI** | FE lint (양쪽) | `npm run lint` |
| **CI** | FE build (양쪽, TypeScript strict) | `npm run build` |
| **CI** | Doc index 추적 | `python ai/plugins/hns/scripts/doc_map.py --check` |
| **Manual** | Performance — endpoint P99 | k6 `treemap-stats.js` (1000 RPS × 60 s, P99 < 200 ms) |
| **Manual** | Performance — micro bench | `./gradlew :code-dictionary:app:jmh` |
| **Manual** | A11y | axe DevTools 0 critical |
| **Manual** | 모바일 viewport QA | Chrome DevTools 375 × 667 / 414 × 896 |
| **Manual** | AI Slop 자가 점검 | `docs/conventions/frontend-design.md` 체크리스트 |
| **Manual** | 응답 페이로드 size 측정 | curl + `wc -c` (< 100 KB) |

- CI 게이트 통과 후, 수동 항목은 PR 리뷰어가 체크리스트로 확인.
- `doc_map.py` 결과 `docs/doc-index.lock.json` diff 는 동일 PR 에 커밋
  (`docs/standards/doc-index-tracking.md`).
