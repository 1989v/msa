# Docker Infrastructure Guide

## Compose Files

| File | Purpose |
|------|---------|
| `docker/docker-compose.infra.yml` | 인프라만 기동 (DB, Redis, Kafka, ES) |
| `docker/docker-compose.yml` | 전체 기동 (인프라 + 서비스) |

## Infrastructure Only

```bash
docker compose -f docker/docker-compose.infra.yml up -d
```

로컬 개발 시 인프라만 Docker로 띄우고, 서비스는 IDE에서 직접 실행하는 것이 일반적이다.

## Full Stack

```bash
docker compose -f docker/docker-compose.yml up -d
```

## Dockerfile

`docker/Dockerfile`은 두 가지 빌드 인자를 사용한다:

| Arg | Example | Description |
|-----|---------|-------------|
| `MODULE_GRADLE` | `product:app` | Gradle 프로젝트 경로 (`:` 구분) |
| `MODULE_PATH` | `product/app` | 파일시스템 경로 (`/` 구분) |

## Environment Variables

`docker/.env` (git ignore 대상, `.env.example` 참조):

```bash
SPRING_PROFILES_ACTIVE=docker

# DB
PRODUCT_DB_HOST=mysql-product-master
PRODUCT_DB_PORT=3306
ORDER_DB_HOST=mysql-order-master

# Redis
REDIS_NODES=redis-node-1:6379,...

# Kafka
KAFKA_BOOTSTRAP_SERVERS=kafka:29092

# Elasticsearch
ES_URIS=http://elasticsearch:9200
```

## Infrastructure Components

### MySQL

- product_db: master (3316) + replica (3317)
- order_db: master (3326) + replica (3327)
- Read/Write 분리 적용

### Redis Cluster

- 6 nodes (3 masters + 3 replicas)
- JWT 블랙리스트, 세션, 캐시 저장

### Kafka

- Broker + Zookeeper
- 토픽 자동 생성 또는 초기화 스크립트

### Elasticsearch

- 단일 노드 (로컬 개발용)
- Search 서비스 전용

### PostgreSQL + pgvector

- Port 5433 (MySQL과 포트 구분)
- Charting 서비스 전용
