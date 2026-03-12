# search:batch

Elasticsearch 전체 색인 배치 서비스.
상품 데이터를 전량 읽어 새 인덱스를 생성하고 alias를 atomic하게 교체한다 (Zero-downtime reindex).

## 포트: 8085

## 색인 소스 선택

`REINDEX_SOURCE` 환경변수로 두 가지 방식 중 선택한다.

| 모드 | 환경변수 | 데이터 소스 | 적합 용도 |
|------|----------|-------------|-----------|
| `api` (기본) | `REINDEX_SOURCE=api` | Product REST API | 운영 중 가벼운 재색인 |
| `db` | `REINDEX_SOURCE=db` | mysql-product-replica 직접 JDBC | 초기 대량 색인, DR 복구 |

DB 모드의 아키텍처 예외 근거: [ADR-0009](../../docs/adr/ADR-0009-search-batch-db-direct-access.md)

## 의존 인프라

| 인프라 | 용도 | 로컬 포트 |
|--------|------|-----------|
| Elasticsearch | 색인 대상 | 9200 |
| Product API | 상품 데이터 소싱 (api 모드) | 8081 |
| MySQL Replica | 상품 데이터 소싱 (db 모드) | 3317 |
| Eureka | 서비스 등록 | 8761 |

## Zero-downtime Reindex 흐름

```
1. 타임스탬프 인덱스 생성: products_20260309120000
2. 전체 상품 데이터 읽기 (페이지 단위)
3. BulkIngester로 새 인덱스에 색인
4. flush() — 미완료 작업 대기
5. alias "products" → 새 인덱스로 atomic swap
6. 오래된 인덱스 정리 (최근 2개 보관)
```

## 로컬 실행

### API 모드 (기본)

```bash
# 인프라 + Product 서비스 기동 필요
docker compose -f docker/docker-compose.infra.yml up -d

./gradlew :search:batch:bootRun
```

배치 Job은 자동 실행되지 않음 (`batch.job.enabled=false`).
Actuator 엔드포인트로 수동 트리거:

```bash
curl -X POST "http://localhost:8085/actuator/batch/jobs/productApiReindexJob" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### DB 모드

```bash
REINDEX_SOURCE=db \
SPRING_PROFILES_ACTIVE=db \
PRODUCT_DB_HOST=localhost \
PRODUCT_DB_PORT=3317 \
MYSQL_USER=your_user \
MYSQL_PASSWORD=your_pass \
./gradlew :search:batch:bootRun
```

```bash
# DB 모드 Job 트리거
curl -X POST "http://localhost:8085/actuator/batch/jobs/productDbReindexJob" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 환경변수

| 변수 | 기본값 | 모드 | 설명 |
|------|--------|------|------|
| `ELASTICSEARCH_URIS` | `http://localhost:9200` | 공통 | ES 주소 |
| `PRODUCT_SERVICE_URL` | `http://localhost:8081` | api | Product API 주소 |
| `REINDEX_SOURCE` | `api` | 공통 | 색인 소스 선택 |
| `PRODUCT_DB_HOST` | `localhost` | db | Product DB 호스트 |
| `PRODUCT_DB_PORT` | `3317` | db | Product DB 포트 |
| `PRODUCT_DB_USER` | `$MYSQL_USER` | db | DB 사용자 |
| `PRODUCT_DB_PASSWORD` | `$MYSQL_PASSWORD` | db | DB 비밀번호 |
| `EUREKA_DEFAULT_ZONE` | `http://localhost:8761/eureka/` | 공통 | Eureka 주소 |

## Spring Profiles

| Profile | 활성화 조건 | 추가 설정 |
|---------|-------------|-----------|
| (기본) | 항상 | H2 메모리 DB (Spring Batch 메타) |
| `db` | `SPRING_PROFILES_ACTIVE=db` | `application-db.yml` 로드 (product datasource) |
| `docker` | Docker 배포 시 | 컨테이너 내부 호스트명 사용 |

## CDC 파이프라인 확장

현재 DB 직접 리드 방식의 한계(스키마 결합)를 극복하려면 Debezium 기반 CDC를 도입할 수 있다.
참조: [docs/architecture/cdc-pipeline.md](../../docs/architecture/cdc-pipeline.md)

## 빌드

```bash
./gradlew :search:batch:build
```
