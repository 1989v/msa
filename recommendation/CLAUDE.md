# Recommendation Service

추천 — 단계적 도입 (ADR-0044): 룰 기반 Category Best → Item-Item CF → Two-Tower/ANN → Wide&Deep 랭킹 → 밴딧/실시간.
데이터는 analytics 의 ClickHouse 를 **읽기만** 하고 결과는 Redis 에 서빙한다.

## Modules

| Gradle path | 역할 |
|---|---|
| `:recommendation:domain` | Pure Kotlin 도메인 — `Recommendation`, `RecommendationContext`, `ActionWeightedScore` |
| `:recommendation:app` | Spring Boot 앱 (port 8092) — ClickHouse JDBC + Redis + Kafka + Thompson 밴딧 |
| `k8s/base/recommendation-ann` | FAISS Python 사이드카 + 일일 학습 Argo 워크플로 (ADR-0046) |

## Commands

```bash
./gradlew :recommendation:domain:test
./gradlew :recommendation:app:build
```

## 구조 상태 (ADR-0083)

**변종 B** — 정리 대상 (플랜 P4):
- Port 6개가 `com.kgd.recommendation.port` (domain 모듈, `domain.` 접두도 없음) → `app` 의 `application/{entity}/port` 로
- 도메인 모델이 `recommendation/` · `service/` 패키지 — `domain/{entity}/model` 아래로
- UseCase 3개가 `@Service` 클래스 (`GetCategoryBest`/`GetSimilarItems`/`GetPersonalized`) → 인터페이스 추출
- application → infrastructure import 3건

## Key Rules

- **ClickHouse 는 analytics 소유** — 여기서는 SELECT 만. 쓰기(`ClickHouseEventWriter`)는 추천 자체 이벤트 테이블에 한정
- 점수 가중치 `reservation×100 + click×20 + addwish×10 + pageview×1` + Wilson LCB — 도메인(`ActionWeightedScore`)이 소유
- 밴딧(`RedisThompsonSampler`)은 실험 서비스와 함께 쓴다 — 변형 배정은 experiment, 보상 갱신은 여기
- `/internal/**` 는 클러스터 내부 동기화(배치가 호출) — 게이트웨이가 라우팅하지 않는다
- 외부 API 호출 없음. ANN 사이드카는 클러스터 내부 HTTP

## API

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/v1/recommendations/category-best` | 도시×카테고리 Top-N (Phase 1) |
| GET | `/api/v1/recommendations/similar-items` | 유사 상품 (Phase 2) |
| POST | `/internal/sync/cb-score` · `/item-similarity` | 배치 → Redis 동기화 |
| GET/POST | `/internal/bandit/stats` · `/click` · `/reset` | 밴딧 모니터 |

## Docs

- ADR: `docs/adr/ADR-0044` ~ `ADR-0049` (단계·파이프라인·ANN·랭킹·A/B·밴딧)
- Plan: `docs/plans/2026-05-12-recommendation-phase{1,2,3}.md`
