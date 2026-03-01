# ADR-0001: 멀티모듈 Gradle 프로젝트 구조

## Status
Accepted

## Context
6개 독립 서비스(common, discovery, gateway, product, order, search)를 단일 레포지토리에서 관리해야 한다. 서비스 간 공통 라이브러리(common) 공유 필요. 독립 빌드/배포 지원 필요.

## Decision
- Gradle 멀티모듈 + Version Catalog (gradle/libs.versions.toml) 적용
- root build.gradle.kts는 공통 플러그인/의존성만 선언
- 각 서비스 모듈은 독립적으로 bootJar 생성
- common 모듈은 jar만 생성 (bootJar 비활성화)
- 모듈: common, discovery, gateway, product, order, search

## Alternatives Considered
- 폴리레포: 서비스 간 공통 라이브러리 관리 복잡, 버전 관리 어려움
- Maven 멀티모듈: Gradle 대비 빌드 성능 저하, 병렬 빌드 제한

## Consequences
- 단일 Gradle 빌드 캐시 공유로 빌드 속도 향상
- common 모듈 변경 시 모든 서비스 재빌드 필요
- libs.versions.toml로 의존성 버전 중앙 관리
