# ADR-0009: Search Batch DB 직접 접근 예외 허용

## Status
Accepted

## Context
`search-batch`의 전체 색인 배치는 Product API를 통해 데이터를 소싱한다.
API 방식은 offset 기반 페이지네이션을 사용하므로, 배치 실행 중 product 데이터가 변경되면
페이지 드리프트(skip/duplicate)와 시점 불일치가 발생할 수 있다.
대용량 초기 색인 또는 DR 복구 시나리오에서는 스냅샷 일관성이 더 중요하다.

## Decision
`search-batch` 모듈에 한해 `mysql-product-replica` 에 대한 JDBC 읽기 전용 접근을 예외적으로 허용한다.

- 접근 범위: **읽기 전용 (SELECT only)**
- 대상 DB: `mysql-product-replica` (마스터 아님)
- 자격증명: 배치 전용 read-only 계정 권장 (`PRODUCT_DB_USER`, `PRODUCT_DB_PASSWORD`)
- 활성화 조건: `reindex.source=db` 환경변수 설정 시에만 동작
- 기본값: `reindex.source=api` (기존 API 방식 유지)

두 방식은 서로 다른 Spring Batch Job으로 분리된다:
- `productApiReindexJob` (기존): `reindex.source=api` 또는 미설정 시 활성
- `productDbReindexJob` (신규): `reindex.source=db` 설정 시 활성

## Rationale
- **서비스 경계 원칙 최소 위반**: search-batch는 상시 서비스가 아닌 배치성 프로세스이며,
  읽기 전용으로만 접근한다.
- **운영 필요성 우선**: DR 복구, 초기 1억건 이상 색인 등 실무 시나리오에서
  API 방식의 페이지 드리프트는 허용 불가한 데이터 품질 문제를 유발한다.
- **아키텍처 보호**: 일반 서비스(search:app, search:consumer)는 여전히
  DB 직접 접근이 금지된다. 이 예외는 search-batch에만 적용된다.

## Consequences
- search-batch가 product DB 스키마에 결합됨 (테이블명, 컬럼명)
  → `products` 테이블 스키마 변경 시 search-batch 함께 수정 필요
- 별도 DB 자격증명 관리 필요 (`PRODUCT_DB_USER`, `PRODUCT_DB_PASSWORD`)
- docker-compose에 search-batch → mysql-product-replica 의존성 추가

## Supersedes
ADR-0008의 "Search 서비스는 MySQL 사용 안 함" 원칙을 search-batch에 한해 부분 예외 처리함.

## Future Extension
CDC 파이프라인(Debezium + Kafka Connect)을 도입하면 이 DB 직접 접근 없이도
스냅샷 일관성을 확보할 수 있다. 참조: `docs/architecture/cdc-pipeline.md`
