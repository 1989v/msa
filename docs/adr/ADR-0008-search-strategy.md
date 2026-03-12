# ADR-0008: 검색 전략 (Elasticsearch)

## Status
Accepted

## Context
상품 전문 검색, 필터링, 정렬 기능 필요. RDBMS 검색 성능 한계.

## Decision
- Elasticsearch 8.17.0 사용
- Search 서비스가 Elasticsearch 인덱스 단독 소유
- 색인 전략:
  1. **전체 색인**: BulkProcessor 기반 (초기 데이터 적재, 배치 스케줄)
  2. **증분 색인**: Kafka Consumer로 product.item.created/updated 이벤트 수신
- 한국어 검색: nori 형태소 분석기 적용
- 인덱스 매핑: 상품명(Text/nori), 가격(Double), 상태(Keyword), 생성일(Date)
- Search 서비스는 MySQL 사용 안 함

## Alternatives Considered
- MySQL FULLTEXT: 한국어 지원 미흡, 복잡한 검색 쿼리 성능 저하
- OpenSearch: Elasticsearch와 API 호환, AWS 환경 선호이나 현 단계 불필요
- Solr: Elasticsearch 대비 Spring 생태계 통합 부족

## Consequences
- 색인 지연(Eventual Consistency): Kafka 이벤트 처리 지연 시 검색 결과 불일치 가능
- Elasticsearch 클러스터 운영 필요
- Search 서비스는 Read-only 모델 (데이터 원천은 Product/Order 서비스)
