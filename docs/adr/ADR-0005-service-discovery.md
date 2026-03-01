# ADR-0005: 서비스 디스커버리

## Status
Accepted

## Context
서비스 인스턴스 동적 등록/해제, 로드 밸런싱, 수평 확장 지원 필요.

## Decision
- Spring Cloud Netflix Eureka (별도 discovery 모듈로 운영)
- 모든 서비스는 Eureka에 자동 등록
- Spring Cloud LoadBalancer로 클라이언트 사이드 로드 밸런싱
- Gateway에서 `lb://service-name` URI로 라우팅
- Kubernetes 전환 시: Eureka 제거, K8s DNS 기반으로 전환 (ADR 갱신 필요)

## Alternatives Considered
- Docker DNS (컨테이너명 직접 사용): 로드 밸런싱 불가, 단순 환경에만 적합
- Consul: 기능 강력하나 운영 복잡도 증가
- K8s DNS only: 로컬 Docker 환경에서 K8s 없이 사용 불가

## Consequences
- Eureka Self-Preservation Mode 비활성화 (로컬 환경)
- 서비스 등록 지연으로 인한 초기 라우팅 실패 가능 → health check + retry 필요
- K8s 전환 시 Eureka 의존성 제거 작업 필요. 전환 결정 시 ADR-XXXX(K8s 마이그레이션)를 별도 작성하여 승인 받아야 함
