# Common Module

## Overview

모든 서비스가 공유하는 라이브러리 모듈.
`bootJar` 없이 `jar`만 생성한다 (실행 가능 JAR 아님).

## Module

단일 모듈: `:common` (`common/`)

## Base Package

`com.kgd.common`

## Provided Components

| Package | Component | Role |
|---------|-----------|------|
| `response` | `ApiResponse<T>` | 표준 API 응답 래퍼 |
| `exception` | `BusinessException` | 비즈니스 예외 기본 클래스 |
| `exception` | `ErrorCode` | 에러 코드 enum |
| `exception` | `GlobalExceptionHandler` | 전역 예외 핸들러 |
| `security` | `JwtUtil` | JWT 토큰 생성/검증 유틸 |
| `security` | `JwtProperties` | JWT 설정 프로퍼티 |
| `security` | `AesUtil` | AES 암호화 유틸 |
| `redis` | `RedisConfig` | Redis 공통 설정 |
| `webclient` | `WebClientConfig` | WebClient 공통 설정 |
| `webclient` | `WebClientBuilderFactory` | WebClient.Builder 팩토리 |

## Usage

각 서비스 모듈의 `build.gradle.kts`에서:

```kotlin
implementation(project(":common"))
```

domain 모듈도 `BusinessException`/`ErrorCode` 사용을 위해 common에 의존한다.

## Build

```bash
./gradlew :common:build
./gradlew :common:test
```
