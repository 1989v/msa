# Common 모듈 선택적 기능 로드 가이드

## 개요

`common` 모듈은 전체 서비스가 공유하는 유틸리티를 제공한다.
기능은 **항상 로드**되는 것과 **선택적 로드**되는 것으로 나뉜다.

| 구분 | 기능 | 로드 방식 |
|------|------|----------|
| 항상 로드 | `BusinessException`, `ErrorCode`, `ApiResponse`, `GlobalExceptionHandler` | `scanBasePackages`에 포함 |
| 선택적 | Security (JWT, AES) | `@EnableCommonFeatures(CommonFeature.SECURITY)` |
| 선택적 | Redis 클러스터 | `@EnableCommonFeatures(CommonFeature.REDIS)` |
| 선택적 | WebClient | `@EnableCommonFeatures(CommonFeature.WEB_CLIENT)` |

## 사용법

### 필요한 기능만 명시

```kotlin
@SpringBootApplication(scanBasePackages = ["com.kgd.myservice", "com.kgd.common.exception", "com.kgd.common.response"])
@EnableCommonFeatures(CommonFeature.SECURITY, CommonFeature.WEB_CLIENT)
class MyApplication
```

### 선택적 기능이 불필요한 경우

```kotlin
// @EnableCommonFeatures 없이 — exception/response만 로드
@SpringBootApplication(scanBasePackages = ["com.kgd.myservice", "com.kgd.common.exception", "com.kgd.common.response"])
class LightweightApplication
```

### 전체 기능 사용

```kotlin
@SpringBootApplication
@EnableCommonFeatures(CommonFeature.SECURITY, CommonFeature.REDIS, CommonFeature.WEB_CLIENT)
class FullFeaturedApplication
```

## 각 Feature 상세

### `CommonFeature.SECURITY`

| 빈 | 설명 |
|----|------|
| `JwtUtil` | JWT access/refresh 토큰 생성, 파싱, 검증 |
| `AesUtil` | AES-256-GCM 대칭 암복호화 |
| `JwtProperties` | `jwt.secret`, `jwt.access-expiry`, `jwt.refresh-expiry` 설정 바인딩 |

**필요 설정 (application.yml)**:
```yaml
jwt:
  secret: your-jwt-secret-key-must-be-at-least-32-characters
  access-expiry: 1800      # 30분 (초)
  refresh-expiry: 604800   # 7일 (초)

encryption:
  aes-key: default-aes-key-exactly-32bytes!
```

### `CommonFeature.REDIS`

| 빈 | 설명 |
|----|------|
| `LettuceConnectionFactory` | Redis 클러스터 연결 (topology refresh 포함) |
| `RedisTemplate<String, Any>` | JSON 직렬화 기반 Redis 템플릿 |

**필요 설정**:
```yaml
spring:
  data:
    redis:
      cluster:
        nodes:
          - redis-1:6379
          - redis-2:6380
```

### `CommonFeature.WEB_CLIENT`

| 빈 | 설명 |
|----|------|
| `WebClient.Builder` | 2MB 버퍼 제한 WebClient 빌더 |
| `WebClient` | 기본 WebClient 인스턴스 |
| `WebClientBuilderFactory` | baseUrl별 WebClient 생성 팩토리 |

별도 설정 불필요.

## 현재 서비스별 적용 현황

| 서비스 | @EnableCommonFeatures | 이유 |
|--------|----------------------|------|
| auth | `SECURITY, WEB_CLIENT` | JWT 인증 + OAuth HTTP 호출 |
| gifticon | `SECURITY, WEB_CLIENT` | JWT 인증 + OCR HTTP 호출 |
| gateway | `SECURITY` | JWT 토큰 검증 |
| code-dictionary | (미사용) | exception/response만 필요 |
| product | (미사용) | exception/response만 필요 |
| order | (미사용) | exception/response만 필요 |
| search | (미사용) | exception/response만 필요 |
| discovery | (미사용) | Eureka 서버만 |

## 새 기능 추가 시

1. `CommonFeature` enum에 새 상수 추가 (KDoc 주석 필수)
2. 해당 Configuration 클래스 생성 (기존 `SecurityConfiguration` 참고)
3. `CommonFeatureSelector`의 `when` 분기에 매핑 추가
4. 이 문서의 Feature 상세 + 적용 현황 테이블 업데이트
