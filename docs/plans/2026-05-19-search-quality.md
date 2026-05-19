# Plan — Search Quality Improvements (2026-05-19)

## 목적

`search` 서비스의 랭킹 품질을 신호 다양성 / MAB 확장 / 평가 인프라 3축으로 단계 도입한다. 사용자 (2026-05-19) 의 검색 품질 개선 플랜과 현재 코드/ADR 의 갭을 메우는 것이 본 plan 의 목표.

## 산출물

| 문서 | 위치 |
|---|---|
| ADR | `docs/adr/ADR-0050-search-quality-roadmap.md` |
| Spec | `docs/specs/2026-05-19-search-quality-improvements/spec.md` |
| Requirements | 동 폴더 `requirements.md` |
| Tasks | 동 폴더 `tasks.md` |
| Test strategy | 동 폴더 `test-quality.md` |
| Open questions | 동 폴더 `open-questions.yml` |
| Review | 동 폴더 `spec-review.md` |
| Plan (본 문서) | `docs/plans/2026-05-19-search-quality.md` |

## Phase 요약

| Phase | 범위 | 사이즈 | 비고 |
|---|---|---|---|
| **P1 — Quick Wins** | tiebreaker, CVR 가중치, freshness gauss, baseline 기록 | ~3md | 코드 < 100 LoC, 즉시 가능 |
| **P2 — Signal Expansion** | GMV (7d/30d), 베이지안 스무딩, raw 디버그 필드, 모니터링 | ~5md | analytics 측 변경 동반, ES alias swap 1회 |
| **P3 — MAB Expansion** | BanditKey 일반화, multi-scope blend, seller diversity, Redis TTL | ~10md | product `brand` 필드 합의 선행 (P3-T0) |
| **P4 — Evaluation Infra** | NDCG/MRR 잡, judgment set, debug API, side-by-side UI, query builder UI | ~12md+ | admin-fe 신규 페이지 2개 + 운영 가이드 |

## 일정 / 마이그레이션 (가이드라인)

| D+ | 액션 |
|---|---|
| D+0 | P1 머지 (no-op 활성화) |
| D+7 | CVR/freshness weight ramp |
| D+14 | P2 머지 (alias swap) |
| D+21 | P4 평가 잡 가동 (P2 효과 측정) |
| D+30 | P3 brand 합의 완료 후 ramp |
| D+60 | P4 admin UI 완료 |

## 핵심 결정사항 (open-questions.yml 참조)

| 질문 | 결정/추천 |
|---|---|
| Q1 스무딩 위치 | analytics 측 (SoT, script_score CPU 회피) |
| Q2 judgment 출처 | 약지도 부트스트랩 + 정기 수동 spot-check |
| Q3 scope 종류 | 1차: category + brand (price-tier 등은 후속) |
| Q4 GMV 윈도우 | 7d + 30d 듀얼 (운영 중 A/B 가능) |
| Q5 UI host | admin-fe (권한/추가비용) |
| Q6 implement 범위 | PHASE 5 user approval 에서 확정 (1차 추천: P1+P2) |
| Q7 OTA 도메인 | 본 spec 범위 제외, 별도 spec |

## 리스크 / 완화

| 리스크 | 완화 |
|---|---|
| 신규 가중치로 latency 회귀 | 모든 weight default 0, top-N 한정 in-memory 처리, ADR-0025 모니터링 |
| ES 매핑 변경 실패 | alias swap + 즉시 롤백 |
| 약지도 self-fulfilling | 분기별 50개 query 수동 보정 (P4-T9 운영 가이드) |
| Redis MAB state 메모리 ↑ | TTL/LRU 정책 P3-T4 선행 |
| product 도메인 협의 지연 | P3 별도 트랙 — P1/P2/P4 평가 인프라부터 진행 가능 |

## OTA 도메인 (사용자 컨텍스트) 분리 항목

| 항목 | 매핑 |
|---|---|
| 지역별 MAB | `scope=region:{id}` (Phase 3 일반화 기반) — region 도메인 모델 신설 시 즉시 활용 |
| 여행사 다양성 | seller diversity (Phase 3) 직접 적용 |
| 명소 검색 / 패키지 프리텍스트 / 동의어 (깜란↔나트랑) | OTA 도메인 신규 spec — 본 plan 범위 외 |

## 출처 (코드 증거)

- `search/app/src/main/kotlin/com/kgd/search/elasticsearch/ProductSearchAdapter.kt:34-77`
- `search/app/src/main/kotlin/com/kgd/search/elasticsearch/RankingProperties.kt:5-9`
- `search/app/src/main/kotlin/com/kgd/search/elasticsearch/ProductEsDocument.kt:11-39`
- `search/app/src/main/kotlin/com/kgd/search/bandit/{BetaSampler,ThompsonReranker,BanditProperties}.kt`
- `search/app/src/main/kotlin/com/kgd/search/product/service/SearchProductService.kt:11-43`
- `search/consumer/src/main/kotlin/com/kgd/search/infrastructure/messaging/ProductScoreUpdateConsumer.kt`
- `search/domain/src/main/kotlin/com/kgd/search/domain/bandit/model/BanditKey.kt`
- ADR-0008 / ADR-0017 / ADR-0025 / ADR-0043
