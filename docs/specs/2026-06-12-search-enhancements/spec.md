# Spec — 검색 고도화: 오토컴플릿 + 온라인 A/B variant 할당

> Status: Implemented (2026-06-12)
> Origin: 플랫폼 전반 갭 감사 (Track C). ADR-0043/0050 기반 검색 스택의 마무리 갭.

## 1. 상품명 오토컴플릿

- **API**: `GET /api/search/products/suggest?q={prefix}&size=8` → `[{id, name}]`
- **구현**: `match_bool_prefix` (마지막 term 만 prefix, 앞 term 은 일반 매칭) + `popularityScore`
  log1p 부스트. nori 분석 기반이라 **매핑 변경/리인덱스 불필요** — 즉시 동작.
- **FE**: portal-fe `/shop` 검색창에 200ms 디바운스 드롭다운 (`suggestProducts`), 실패 시 조용히 무시.
- 향후 정밀도 개선 옵션: edge_ngram sub-field (IndexAliasManager 매핑 추가 + 리인덱스 필요) — 미적용.

## 2. 온라인 A/B (검색 랭킹 variant 할당)

기존: `SearchDebugController` 의 수동 variant 비교만 가능 (실사용자 트래픽 분기 없음).

- **`SearchExperimentClient`**: experiment 서비스 `GET /api/v1/experiments/{id}/assignment?userId=`
  호출 (recommendation 의 검증된 패턴 이식). connect 300ms / read 1000ms, 실패 시 null
  (graceful degradation — 검색 P99 보호).
- **흐름**: `SearchController(/products?userId=)` → `SearchProductService.resolveVariant`
  → variant 키를 `ProductSearchPort.searchScored(keyword, pageable, rankingVariant)` 로 전달
  → `ProductSearchAdapter` 가 `RankingVariantsProperties.variants[key]` 매핑 (미정의 키 = 기본 ranking).
- **도메인 순수성**: port 는 variant 키(String)만 통과 — ranking 설정 타입은 infrastructure 에 격리.
- **분석 태깅**: `Result.variant` 로 응답에 동봉 — impression/click 이벤트와 결합해 variant 차원 분석.
- **설정**: `search.experiment.{enabled, id, url}` (기본 disabled). variant 키는
  `search.ranking-variants.variants` 와 일치해야 하며 control 은 기본 ranking.

## 3. Goldset 평가 — 구현 완료 상태 확인 (코드 변경 없음)

감사에서 "goldset 데이터 없음" 으로 보고되었으나 실사는:

- DDL: `analytics/.../clickhouse/analytics/V003__search_judgments_and_eval.sql` (judgments + eval_results)
- 수동 라벨링: admin FE 판정 관리 UI → `analytics JudgmentController` (`/api/v1/search/judgments`)
- 약지도 부트스트랩: `analytics WeakJudgmentGenerator`
- 평가 배치: `SearchEvaluationJobConfig` (NDCG@10/MRR/MAP@10) + `k8s/base/search-batch/cronjob-eval.yaml` (daily 02:00 UTC)

→ **파이프라인은 완비, 갭은 운영 데이터 입력뿐** (admin UI 라벨링 또는 weak generator 실행).

## Changed Files

- `search/domain/.../port/ProductSearchPort.kt` — `searchScored(+rankingVariant)`, `suggest` 추가
- `search/app/.../client/SearchExperimentClient.kt` (신규, + `SearchExperimentProperties`)
- `search/app/.../usecase/SuggestProductUseCase.kt` (신규), `SearchProductUseCase.kt` (+userId/variant)
- `search/app/.../service/SearchProductService.kt`, `elasticsearch/ProductSearchAdapter.kt`
- `search/app/.../controller/SearchController.kt` (+suggest endpoint, +userId param)
- `search/app/src/main/resources/application.yml` (+search.experiment)
- `portal-fe`: `shopApi.ts` (+suggestProducts), `ShopPage.tsx` (+디바운스 드롭다운), `Shop.css`

## Verification

- `./gradlew :search:domain:build :search:app:test :search:batch:build :search:consumer:build` → BUILD SUCCESSFUL
- `SearchProductServiceTest`: variant 할당/비로그인/장애 degrade/suggest 매핑 시나리오 추가 (2026-06-12)
- portal-fe: `vite build` ✓, `vitest` 11/11 ✓
