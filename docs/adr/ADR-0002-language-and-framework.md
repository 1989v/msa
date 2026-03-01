# ADR-0002: 언어 및 프레임워크 선택

## Status
Accepted

## Context
JVM 기반 MSA 서비스 개발. 생산성, 타입 안정성, Spring 생태계 통합 필요.

## Decision
- Java 25 LTS (JVM 런타임, 공식 LTS)
- Kotlin 2.2.21 (주 개발 언어)
- Spring Boot 4.0.3 (Spring Framework 7.x 기반)
- Spring Cloud 2025.1.0
- WebFlux 전면 도입 금지 (Gateway 제외 — Spring Cloud Gateway는 WebFlux 허용)
- 코루틴은 외부 IO(WebClient 기반 외부 API 호출)에만 사용
- JPA + QueryDSL (내부 DB 접근, Blocking 유지)

## Alternatives Considered
- Java only: Kotlin 대비 보일러플레이트 증가, null 안정성 부족
- Spring Boot 3.x: Java 25 LTS 최적 지원 미흡, Spring Framework 7.x 기반 신기능 미지원
- Quarkus/Micronaut: Spring 생태계 비호환, 팀 학습 비용

## Consequences
- Kotlin all-open 플러그인 필수 (Kotlin final class Spring 프록시 문제)
- JPA Entity는 kotlin-jpa 플러그인 필수 (no-arg constructor 생성)
- Spring Boot 4.0 = Jakarta EE 11 기반, javax.* 패키지 사용 불가
