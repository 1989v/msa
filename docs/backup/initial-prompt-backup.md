실제 운영 가능한 수준의 MSA로 구조화된 커머스 플랫폼을 아래 내용을 토대로 구축해줘. 
먼저 플래닝하여 정리 진행. 정리된 내용을 docs 하위 적절한 디렉토리에 기록.

목표:
- 실서비스 배포 가능 수준
- 수평 확장 고려
- 이중화/분산 고려
- Docker 기반 로컬 개발 환경
- 추후 Kubernetes(EKS) 배포 가능 구조

구성 서비스:
- search (Elasticsearch 기반)
- order
- product
- gateway
- common (공통 라이브러리 모듈)

기술 스택:

- Java 25 LTS
- Kotlin 최신 안정 버전
- Spring Boot 최신 안정 버전 (현재 공식 안정 버전 확인 후 적용)
- Clean Architecture 기반
- MySQL (서비스별 DB 완전 분리)
- JPA + QueryDSL (Blocking 유지)
- WebClient 기반 외부 API 호출
- Circuit Breaker 공통 패턴 적용 (Resilience4j 기반)
- 코루틴은 외부 API IO 부분에만 사용
- Kafka 기반 이벤트 비동기 통신
- Redis (Cluster 모드 고려)
- Elasticsearch 기반 검색
- BDD 기반 단위 테스트

아키텍처 조건:

1. 서비스 간 DB 공유 금지
2. MySQL read/write 분리 구조
3. Redis는 캐시/락/세션 분리 설계
4. Search는:
    - BulkProcessor 기반 전체 색인
    - 증분 색인
    - Kafka 기반 색인 이벤트 수신
5. Gateway는:
    - 인증/인가
    - 서비스 라우팅
    - 서비스 디스커버리 기반 요청 전환
6. Common 모듈:
    - 글로벌 예외 처리
    - 공통 응답 포맷
    - 인증/보안 모듈
    - AES 기반 Encrypt/Decrypt 유틸
    - WebClient + CircuitBreaker 공통 설정
    - Timeout 정책
7. 내부 DB는 Blocking 유지
8. WebFlux 전면 도입 금지
9. 실제 서비스 배포를 고려한 포트/컨테이너 설계

인프라 요구사항:

docker 디렉토리 생성 후 아래 컨테이너 구성:
- mysql (master / replica)
- redis (cluster 고려)
- elasticsearch
- kafka + zookeeper
- gateway
- 각 msa 서비스

포트 및 네트워크 설계까지 포함
docker-compose 기반 로컬 실행 가능 환경 구축

진행 순서:

1. ADR 작성
2. CLAUDE.md 작성 (프로젝트 전반 규칙)
3. 멀티모듈 Gradle 구조 설계
4. Docker 설계
5. Common 모듈 설계
6. Gateway 설계
7. Search 설계
8. Order / Product 설계

모호한 부분은 질문 후 진행.