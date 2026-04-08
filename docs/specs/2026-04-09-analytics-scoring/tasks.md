# Task Breakdown: Analytics & Scoring System

## Overview
Total Task Groups: 12
Estimated Total Effort: L (cross-cutting, 2 new services + infra + integrations)

---

## Task List

### Task Group 1: Common Module - Event Schema & SDK
**Dependencies:** None
**Phase:** foundation
**Required Skills:** Kotlin, Kafka, common module conventions
**Complexity:** S

- [ ] 1.0 Complete analytics event schema and publisher SDK in common module
  - [ ] 1.1 Write 4 tests for AnalyticsEvent creation and EventType validation (domain-level, no mocks)
  - [ ] 1.2 Create `AnalyticsEvent` data class and `EventType` enum in `common/src/main/kotlin/kgd/common/analytics/`
  - [ ] 1.3 Create `AnalyticsEventPublisher` component with fire-and-forget Kafka publishing
  - [ ] 1.4 Create Auto-Configuration class (`AnalyticsAutoConfiguration`) with `kgd.common.analytics.enabled` toggle
  - [ ] 1.5 Register auto-configuration in `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
  - [ ] 1.6 Add `analytics.event.collected` topic to Kafka convention doc
  - [ ] 1.7 Verify: `./gradlew :common:build` passes

**Acceptance Criteria:**
- `AnalyticsEventPublisher` is injectable when `kgd.common.analytics.enabled=true`
- Event schema matches spec section 2.1 exactly
- Kafka topic key is `visitorId` for partition ordering

---

### Task Group 2: Infrastructure - ClickHouse Setup
**Dependencies:** None
**Phase:** infrastructure
**Required Skills:** Docker, ClickHouse SQL, docker-compose
**Complexity:** S

- [ ] 2.0 Complete ClickHouse infrastructure for local development
  - [ ] 2.1 Add ClickHouse service to `docker/docker-compose.infra.yml`
  - [ ] 2.2 Create `docker/clickhouse/init.sql` with `analytics.events` table (spec section 2.4)
  - [ ] 2.3 Add ClickHouse environment variables to `docker/.env.example`
  - [ ] 2.4 Add `analytics.score.updated` and `analytics.event.dlq` topics to Kafka topic init if applicable
  - [ ] 2.5 Verify: `docker compose -f docker/docker-compose.infra.yml up clickhouse -d` starts successfully and table exists

**Acceptance Criteria:**
- ClickHouse accessible on ports 8123 (HTTP) and 9000 (Native)
- `analytics.events` table created with correct schema, partitioning, TTL

---

### Task Group 3: Analytics Service - Domain Module
**Dependencies:** None
**Phase:** domain
**Required Skills:** Kotlin, domain modeling, Clean Architecture
**Complexity:** M

- [ ] 3.0 Complete analytics domain module with score models and computation logic
  - [ ] 3.1 Write 6 tests: ScoreNormalizer edge cases (min=max, percentile clipping, normal range, zero values, boundary values, negative inputs)
  - [ ] 3.2 Write 4 tests: ProductScore computation (CTR=clicks/impressions, CVR=orders/clicks, zero-division safety, popularityScore calculation)
  - [ ] 3.3 Write 3 tests: KeywordScore computation (composite score, zero-division, normalization)
  - [ ] 3.4 Create `ProductScore` data class with factory method and computation logic
  - [ ] 3.5 Create `KeywordScore` data class with factory method and computation logic
  - [ ] 3.6 Create `ScoreNormalizer` object with `normalize()` function (spec section 3.3)
  - [ ] 3.7 Create outbound port interfaces: `ProductScoreRepositoryPort`, `KeywordScoreRepositoryPort`, `ScoreCachePort`
  - [ ] 3.8 Create Gradle module: `analytics/domain/build.gradle.kts` (pure Kotlin, depend on `:common` for BusinessException)
  - [ ] 3.9 Verify: `./gradlew :analytics:domain:test` -- all tests pass, no Spring dependencies

**Acceptance Criteria:**
- Domain module has zero Spring/JPA dependencies
- ScoreNormalizer handles all edge cases (division by zero, identical min/max)
- CTR and CVR computations are safe against zero-division

---

### Task Group 4: Experiment Service - Domain Module
**Dependencies:** None
**Phase:** domain
**Required Skills:** Kotlin, domain modeling, hashing algorithms
**Complexity:** M

- [ ] 4.0 Complete experiment domain module with bucket assignment logic
  - [ ] 4.1 Write 5 tests: BucketAssigner determinism (same input = same output), distribution uniformity, single-variant edge case, weight boundary, different experimentIds yield different assignments
  - [ ] 4.2 Write 4 tests: Experiment status transitions (DRAFT->RUNNING, RUNNING->PAUSED, PAUSED->RUNNING, RUNNING->COMPLETED, invalid transitions rejected)
  - [ ] 4.3 Write 3 tests: Variant weight validation (sum must equal 100, weights > 0, empty variants rejected)
  - [ ] 4.4 Create `Experiment` domain model with status transition methods and validation
  - [ ] 4.5 Create `Variant` data class with weight validation
  - [ ] 4.6 Create `ExperimentStatus` enum
  - [ ] 4.7 Create `BucketAssigner` object with MurmurHash3-based deterministic assignment
  - [ ] 4.8 Create outbound port interfaces: `ExperimentRepositoryPort`
  - [ ] 4.9 Create Gradle module: `experiment/domain/build.gradle.kts`
  - [ ] 4.10 Verify: `./gradlew :experiment:domain:test` -- all tests pass

**Acceptance Criteria:**
- BucketAssigner is stateless and deterministic
- Experiment enforces valid status transitions
- Variant weights must sum to 100
- No Spring/JPA dependencies in domain module

---

### Task Group 5: Analytics Service - App Module Scaffold + Score API
**Dependencies:** Task Group 2, Task Group 3
**Phase:** application
**Required Skills:** Spring Boot, Kotlin, ClickHouse JDBC, Redis, REST API
**Complexity:** L

- [ ] 5.0 Complete analytics app module with score query API and persistence
  - [ ] 5.1 Write 4 tests: ScoreService (Redis cache hit returns cached, cache miss queries ClickHouse and caches, bulk query, missing product returns empty)
  - [ ] 5.2 Write 3 tests: ScoreController endpoint mapping (single product, bulk products, keyword score)
  - [ ] 5.3 Create Gradle module: `analytics/app/build.gradle.kts` with Spring Boot, ClickHouse JDBC driver, Redis, Kafka Streams dependencies
  - [ ] 5.4 Create `AnalyticsApplication.kt` main class at `com.kgd.analytics`
  - [ ] 5.5 Create `application.yml` with ClickHouse, Redis, Kafka Streams configuration
  - [ ] 5.6 Implement `ScoreCacheAdapter` (Redis) for ProductScore and KeywordScore caching (TTL 2h)
  - [ ] 5.7 Implement `ProductScoreRepositoryAdapter` and `KeywordScoreRepositoryAdapter` (ClickHouse JDBC)
  - [ ] 5.8 Implement `GetProductScoreUseCase`, `GetBulkProductScoresUseCase`, `GetKeywordScoreUseCase` with cache-aside pattern
  - [ ] 5.9 Implement `ScoreController` with endpoints: GET /api/v1/scores/products/{id}, /bulk, /keywords/{keyword}
  - [ ] 5.10 Add `analytics:domain` and `analytics:app` to `settings.gradle.kts`
  - [ ] 5.11 Create analytics CLAUDE.md service documentation
  - [ ] 5.12 Verify: `./gradlew :analytics:app:build` passes

**Acceptance Criteria:**
- Score API returns `ApiResponse<T>` standard format
- Redis cache-aside: hit -> return, miss -> ClickHouse query + cache write
- ClickHouse connection pool configured

---

### Task Group 6: Analytics Service - Kafka Streams Event Processing
**Dependencies:** Task Group 1, Task Group 5
**Phase:** application
**Required Skills:** Kafka Streams, ClickHouse, Redis
**Complexity:** L

- [ ] 6.0 Complete Kafka Streams topology for event aggregation and score computation
  - [ ] 6.1 Write 4 tests: ProductMetrics aggregation (view increments impressions, click increments clicks, order increments orders, windowed aggregation resets)
  - [ ] 6.2 Write 3 tests: KeywordMetrics aggregation (search increments count, click with keyword increments clicks, score computation)
  - [ ] 6.3 Write 2 tests: Event branching (PRODUCT_VIEW routes to product branch, SEARCH_KEYWORD routes to keyword branch)
  - [ ] 6.4 Implement `AnalyticsStreamTopology` with event branching, windowed aggregation (1h windows)
  - [ ] 6.5 Implement `ProductMetrics` aggregator: compute CTR, CVR, popularityScore
  - [ ] 6.6 Implement `KeywordMetrics` aggregator: compute keyword composite score
  - [ ] 6.7 Implement triple-sink: Redis cache update, ClickHouse write, Kafka `analytics.score.updated` publish
  - [ ] 6.8 Implement Kafka consumer for raw event -> ClickHouse `analytics.events` table insertion (batch insert)
  - [ ] 6.9 Configure error handling: DLQ topic `analytics.event.dlq`, LogAndContinueExceptionHandler
  - [ ] 6.10 Implement stats aggregation for normalization (min/max/p95 -> Redis `score:product:stats`, `score:keyword:stats`)
  - [ ] 6.11 Verify: `./gradlew :analytics:app:build` passes, topology unit tests green

**Acceptance Criteria:**
- Events from `analytics.event.collected` are processed and aggregated per product/keyword
- Scores are written to Redis (TTL 2h), ClickHouse (permanent), and Kafka topic
- DLQ handles deserialization and processing failures
- Stats for normalization are updated in Redis (TTL 1h)

---

### Task Group 7: Experiment Service - App Module + CRUD API
**Dependencies:** Task Group 4
**Phase:** application
**Required Skills:** Spring Boot, JPA/MySQL, REST API
**Complexity:** M

- [ ] 7.0 Complete experiment app module with CRUD API and MySQL persistence
  - [ ] 7.1 Write 4 tests: ExperimentService CRUD (create experiment, update experiment, status change, list experiments)
  - [ ] 7.2 Write 3 tests: AssignmentService (deterministic assignment via BucketAssigner, inactive experiment returns error, traffic percentage filtering)
  - [ ] 7.3 Create Gradle module: `experiment/app/build.gradle.kts` with Spring Boot, JPA, MySQL
  - [ ] 7.4 Create `ExperimentApplication.kt` main class at `com.kgd.experiment`
  - [ ] 7.5 Create `application.yml` with MySQL datasource, server port 8091
  - [ ] 7.6 Implement `ExperimentJpaEntity`, `VariantJpaEntity` with JPA mappings and domain conversion
  - [ ] 7.7 Implement `ExperimentRepositoryAdapter` (JPA -> Port)
  - [ ] 7.8 Implement UseCases: `CreateExperimentUseCase`, `UpdateExperimentUseCase`, `ChangeExperimentStatusUseCase`, `GetExperimentUseCase`, `ListExperimentsUseCase`, `AssignBucketUseCase`
  - [ ] 7.9 Implement `ExperimentController` with all endpoints from spec section 5.3
  - [ ] 7.10 Add `experiment:domain` and `experiment:app` to `settings.gradle.kts`
  - [ ] 7.11 Create experiment CLAUDE.md service documentation
  - [ ] 7.12 Verify: `./gradlew :experiment:app:build` passes

**Acceptance Criteria:**
- Full CRUD for experiments with status transitions enforced
- Assignment endpoint returns deterministic variant based on userId + experimentId
- `ApiResponse<T>` standard format for all responses
- MySQL schema auto-generated via JPA/Hibernate DDL

---

### Task Group 8: Experiment Results - Analytics Integration
**Dependencies:** Task Group 5, Task Group 7
**Phase:** integration
**Required Skills:** REST API, WebClient, statistics
**Complexity:** M

- [ ] 8.0 Complete experiment results analysis via analytics API integration
  - [ ] 8.1 Write 3 tests: ExperimentMetricsService (query ClickHouse for variant-level metrics, compute CTR/CVR per variant, empty results handling)
  - [ ] 8.2 Write 2 tests: StatisticalSignificance (chi-squared test returns significant/not-significant, insufficient data handling)
  - [ ] 8.3 Implement analytics-side endpoint: `GET /api/v1/analytics/experiments/{id}/metrics?start=&end=` querying ClickHouse (spec section 5.4 SQL)
  - [ ] 8.4 Implement `AnalyticsClient` in experiment service (WebClient -> analytics metrics API)
  - [ ] 8.5 Implement statistical significance calculation in experiment domain (Chi-squared or Z-test)
  - [ ] 8.6 Implement `GetExperimentResultsUseCase` in experiment service combining analytics data + significance
  - [ ] 8.7 Implement `GET /api/v1/experiments/{id}/results` endpoint in experiment controller
  - [ ] 8.8 Verify: `./gradlew :experiment:app:build` and `./gradlew :analytics:app:build` pass

**Acceptance Criteria:**
- experiment service calls analytics API (no direct ClickHouse access from experiment)
- Results include per-variant CTR, CVR, event counts, and statistical significance
- Cross-service communication via WebClient only

---

### Task Group 9: Gateway - Visitor ID & Experiment Filters
**Dependencies:** Task Group 7
**Phase:** integration
**Required Skills:** Spring Cloud Gateway, WebFlux, Redis caching
**Complexity:** M

- [ ] 9.0 Complete gateway filters for visitor identification and experiment assignment
  - [ ] 9.1 Write 3 tests: VisitorIdFilter (cookie exists -> reuse, no cookie -> generate UUID + set cookie, header propagation)
  - [ ] 9.2 Write 4 tests: ExperimentAssignmentFilter (active experiments -> assign headers, no active experiments -> passthrough, inactive experiment skipped, cache refresh)
  - [ ] 9.3 Implement `VisitorIdFilter` (PRE, order=-10): read/create `vid` cookie, set `X-Visitor-Id` header
  - [ ] 9.4 Implement `ExperimentAssignmentFilter` (PRE): fetch active experiments (Redis cached, TTL 1min), assign buckets, set `X-Experiment-{id}` headers
  - [ ] 9.5 Implement `ExperimentClient` (WebClient -> experiment service) for fetching active experiments
  - [ ] 9.6 Add BucketAssigner dependency from common module (or relocate BucketAssigner to common as spec indicates)
  - [ ] 9.7 Add gateway route for analytics service (port 8090) and experiment service (port 8091)
  - [ ] 9.8 Verify: `./gradlew :gateway:build` passes

**Acceptance Criteria:**
- Every request gets `X-Visitor-Id` header (from cookie or newly generated)
- Active experiment variants assigned deterministically via `X-Experiment-{id}` headers
- Active experiments list cached in Redis (TTL 1 min) to minimize experiment service calls

---

### Task Group 10: Search Integration - Score-Based Ranking
**Dependencies:** Task Group 6
**Phase:** integration
**Required Skills:** Elasticsearch, Kafka consumer, Spring Data ES
**Complexity:** M

- [ ] 10.0 Complete search service integration with analytics scores
  - [ ] 10.1 Write 3 tests: ProductScoreUpdateConsumer (score update applies to ES doc, stale update skipped by timestamp, missing product handled gracefully)
  - [ ] 10.2 Write 3 tests: Search ranking query (function_score includes popularityScore and ctr, configurable weights, missing score fields default to 0)
  - [ ] 10.3 Extend `ProductEsDocument` with `popularityScore`, `ctr`, `cvr`, `scoreUpdatedAt` fields
  - [ ] 10.4 Implement `ProductScoreUpdateConsumer` in `search:consumer` consuming `analytics.score.updated` topic (consumer group: `search-score-updater`)
  - [ ] 10.5 Implement ES partial update (doc API) for score fields only -- no full reindex
  - [ ] 10.6 Add idempotent check: compare `scoreUpdatedAt` timestamp, skip older updates
  - [ ] 10.7 Update search query builder to use `function_score` with configurable weights for popularityScore and ctr
  - [ ] 10.8 Implement keyword-based boosting: fetch KeywordScore from analytics API, apply as `script_score` parameter
  - [ ] 10.9 Externalize ranking weights to `application.yml` configuration
  - [ ] 10.10 Verify: `./gradlew :search:consumer:build` and `./gradlew :search:app:build` pass

**Acceptance Criteria:**
- Score updates flow from Kafka to ES partial update without full reindexing
- Search ranking incorporates popularityScore and CTR with configurable weights
- Stale score updates are rejected via timestamp comparison
- Keyword boost applied when KeywordScore available, defaults to 0 otherwise

---

### Task Group 11: Docker Compose & Service Registration
**Dependencies:** Task Group 5, Task Group 7
**Phase:** deployment
**Required Skills:** Docker, docker-compose, Eureka
**Complexity:** S

- [ ] 11.0 Complete Docker and service discovery setup for analytics and experiment services
  - [ ] 11.1 Add analytics and experiment service definitions to `docker/docker-compose.yml` (Dockerfile args: MODULE_GRADLE + MODULE_PATH)
  - [ ] 11.2 Add Eureka client configuration to analytics and experiment `application.yml`
  - [ ] 11.3 Add gateway routes for `/api/v1/scores/**` -> analytics, `/api/v1/experiments/**` -> experiment
  - [ ] 11.4 Add analytics MySQL database (for experiment service) init to docker-compose if needed
  - [ ] 11.5 Verify: `docker compose -f docker/docker-compose.yml config` validates without errors

**Acceptance Criteria:**
- Both services register with Eureka
- Gateway routes traffic correctly to analytics (8090) and experiment (8091)
- Docker build args follow existing MODULE_GRADLE/MODULE_PATH pattern

---

### Task Group 12: End-to-End Validation & Documentation
**Dependencies:** Task Group 9, Task Group 10, Task Group 11
**Phase:** validation
**Required Skills:** Integration testing, documentation
**Complexity:** M

- [ ] 12.0 Complete end-to-end validation of the analytics scoring pipeline
  - [ ] 12.1 Write integration test: publish AnalyticsEvent via SDK -> verify event lands in ClickHouse `analytics.events` table
  - [ ] 12.2 Write integration test: score computation pipeline -> verify ProductScore in Redis cache and ClickHouse
  - [ ] 12.3 Write integration test: score update -> verify ES document updated with new score fields
  - [ ] 12.4 Write integration test: experiment assignment -> verify deterministic bucket via gateway headers
  - [ ] 12.5 Update Kafka convention doc (`docs/architecture/kafka-convention.md`) with new topics
  - [ ] 12.6 Update `docs/architecture/module-structure.md` with analytics and experiment modules
  - [ ] 12.7 Create ADR for analytics scoring system decision
  - [ ] 12.8 Verify: full `./gradlew build` passes with all new modules

**Acceptance Criteria:**
- Full event pipeline works: event publish -> ClickHouse storage -> score computation -> Redis cache -> ES update
- Experiment assignment is deterministic and consistent across gateway and experiment service
- All documentation updated to reflect new services and topics

---

## Execution Order

1. **Task Groups 1, 2, 3, 4** (parallel) -- Foundation layer: no cross-dependencies
   - Group 1: Common SDK (needed by Group 6)
   - Group 2: ClickHouse infra (needed by Group 5)
   - Group 3: Analytics domain (needed by Group 5)
   - Group 4: Experiment domain (needed by Group 7)
2. **Task Groups 5, 7** (parallel) -- App modules with persistence and APIs
   - Group 5: Analytics app (depends on Groups 2, 3)
   - Group 7: Experiment app (depends on Group 4)
3. **Task Groups 6, 8, 9** (parallel with constraints)
   - Group 6: Kafka Streams processing (depends on Groups 1, 5)
   - Group 8: Experiment results integration (depends on Groups 5, 7)
   - Group 9: Gateway filters (depends on Group 7)
4. **Task Groups 10, 11** (parallel)
   - Group 10: Search integration (depends on Group 6)
   - Group 11: Docker/service registration (depends on Groups 5, 7)
5. **Task Group 12** -- End-to-end validation (depends on Groups 9, 10, 11)

## Dependency Graph

```
[1: Common SDK]  [2: ClickHouse]  [3: Analytics Domain]  [4: Experiment Domain]
       |               |                   |                       |
       |               +----->  [5: Analytics App]     [7: Experiment App]
       |                              |         \          /      |
       +----------> [6: Kafka Streams]|    [8: Results Integration]
                          |           |                   |
                    [10: Search]   [11: Docker]    [9: Gateway Filters]
                          \           |              /
                           +---> [12: E2E Validation]
```

## Notes

- **BucketAssigner placement**: Spec states it goes in common module (Gateway + experiment both need it). Task Group 4 creates it in experiment domain; Task Group 9.6 should relocate or alias it to common.
- **ClickHouse driver**: Use `com.clickhouse:clickhouse-jdbc` with `clickhouse-http-client` -- add to `gradle/libs.versions.toml`.
- **Kafka Streams**: Add `org.apache.kafka:kafka-streams` and `spring-kafka` to version catalog.
- **Statistical tests**: Consider using Apache Commons Math for Chi-squared/Z-test in experiment domain, or implement a minimal version to avoid heavy dependencies in the domain module.
