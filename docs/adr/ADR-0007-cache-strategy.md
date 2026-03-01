# ADR-0007: 캐시 전략 (Redis)

## Status
Accepted

## Context
상품 조회 성능 향상, 분산 락, JWT 세션/블랙리스트 관리를 위한 인메모리 저장소 필요.

## Decision
- Redis Cluster 모드 (3 masters + 3 replicas)
- 용도별 Key Prefix 분리:
  - 캐시: `cache:{service}:{entity}:{id}` (TTL: 5분)
  - 세션/토큰: `session:refresh:{userId}` (TTL: 7일)
  - 블랙리스트: `blacklist:{token}` (TTL: Access Token 만료까지)
  - 분산 락: `lock:{resource}:{id}` (TTL: 30초)
- Lettuce 클라이언트 사용 (Jedis 대비 비동기 지원)
- 로컬 Docker 환경: 6노드 클러스터 구성 (포트 6379-6384)

## Alternatives Considered
- Redis Sentinel: Cluster 대비 수평 확장 불가, 읽기 분산 제한
- Redis Standalone: 단일 장애점, 운영 환경 부적합
- Memcached: 복잡한 데이터 구조 및 TTL 미지원

## Consequences
- Cluster 모드에서 multi-key 명령 제한 (같은 슬롯에 있어야 함)
- 로컬 환경에서 6개 컨테이너 실행으로 리소스 사용량 증가
- Hash Tag로 관련 키 동일 슬롯 배치 가능
