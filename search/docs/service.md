# Search Service

## Overview

검색 전용 Read 모델 서비스.
Elasticsearch 기반 상품 검색 API를 제공하며, Kafka 이벤트 기반 증분 색인과 Spring Batch 기반 전체 색인을 수행한다.

## Module Structure

| Gradle path | Filesystem | Role | Port |
|---|---|---|---|
| `:search:domain` | `search/domain/` | 순수 도메인 | - |
| `:search:app` | `search/app/` | 검색 REST API (읽기 전용) | 8083 |
| `:search:consumer` | `search/consumer/` | Kafka 이벤트 수신 -> BulkIngester 비동기 증분 색인 | 8084 |
| `:search:batch` | `search/batch/` | Spring Batch 전체 색인 (alias swap) | 8085 |

## Base Package

`com.kgd.search`

## Architecture

```
                    ┌──── search:app (REST API) ────┐
                    │  SearchController              │
                    │  SearchProductUseCase           │
Client ──GET───►    │  ProductSearchAdapter (ES)     │
                    └────────────────────────────────┘

                    ┌──── search:consumer ───────────┐
Kafka ──event──►    │  ProductIndexingConsumer        │
                    │  EsBulkDocumentProcessor (ES)  │
                    └────────────────────────────────┘

                    ┌──── search:batch ──────────────┐
Scheduler ──►       │  ProductDbReindexJobConfig      │
                    │  ProductApiReindexJobConfig      │
                    │  IndexAliasManager (alias swap) │
                    └────────────────────────────────┘
```

## Kafka Events Consumed

| Topic | Consumer Group | Handler |
|-------|---------------|---------|
| `product.item.created` | `search-indexer` | `ProductIndexingConsumer` |
| `product.item.updated` | `search-indexer` | `ProductIndexingConsumer` |

## Data Ownership

- Elasticsearch 인덱스 소유
- RDBMS 미사용 (batch 모듈은 product_db replica 직접 접근 허용 -- ADR-0009)

## Batch Indexing Strategy

1. **API 기반 전체 색인**: Product API를 호출하여 색인 (서비스 경계 준수)
2. **DB 직접 전체 색인**: product_db replica 직접 읽기 (ADR-0009, 성능 우선)
3. **Alias Swap**: 새 인덱스 생성 후 alias 교체로 무중단 전체 색인

## Build

```bash
./gradlew :search:app:build
./gradlew :search:consumer:build
./gradlew :search:batch:build
./gradlew :search:domain:test
```
