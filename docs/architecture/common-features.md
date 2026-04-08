# Common 모듈 선택적 기능 로드 가이드

## 개요

`common` 모듈은 전체 서비스가 공유하는 유틸리티를 제공한다.
기능은 **항상 로드**되는 것과 **선택적 로드**되는 것으로 나뉜다.

| 구분 | 기능 | 활성화 방식 |
|------|------|----------|
| 항상 로드 | `BusinessException`, `ErrorCode`, `ApiResponse`, `GlobalExceptionHandler` | `scanBasePackages`에 포함 |
| 선택적 | Security (JWT, AES) | `kgd.common.security.enabled: true` |
| 선택적 | Redis 클러스터 | `kgd.common.redis.enabled: true` |
| 선택적 | WebClient | `kgd.common.web-client.enabled: true` |

## 사용법

Spring Boot Auto-Configuration 방식으로 동작한다. 서비스별 `application.yml`에서 필요한 기능만 활성화한다.

### 필요한 기능만 활성화

```yaml
# application.yml
kgd:
  common:
    security:
      enabled: true
    web-client:
      enabled: true
```

```kotlin
// Application 클래스에는 어노테이션 추가 불필요
@SpringBootApplication(scanBasePackages = ["com.kgd.myservice", "com.kgd.common.exception", "com.kgd.common.response"])
class MyApplication
```

### 선택적 기능이 불필요한 경우

`kgd.common.*` 프로퍼티를 설정하지 않으면 해당 기능이 로드되지 않는다.

### AES 없이 JWT만 사용 (gateway)

```yaml
kgd:
  common:
    security:
      enabled: true
      aes-enabled: false
```

## 각 Feature 상세

### Security (`kgd.common.security.enabled`)

| 빈 | 조건 | 설명 |
|----|------|------|
| `JwtUtil` | `@ConditionalOnMissingBean` | JWT access/refresh 토큰 생성, 파싱, 검증 |
| `AesUtil` | `aes-enabled: true` (기본값) | AES-256-GCM 대칭 암복호화 |
| `JwtProperties` | 자동 바인딩 | `jwt.secret`, `jwt.access-expiry`, `jwt.refresh-expiry` |

**필요 설정 (application.yml)**:
```yaml
jwt:
  secret: your-jwt-secret-key-must-be-at-least-32-characters
  access-expiry: 1800      # 30분 (초)
  refresh-expiry: 604800   # 7일 (초)

encryption:
  aes-key: default-aes-key-exactly-32bytes!  # aes-enabled: false이면 불필요
```

### Redis (`kgd.common.redis.enabled`)

| 빈 | 조건 | 설명 |
|----|------|------|
| `LettuceConnectionFactory` | `@ConditionalOnMissingBean`, `RedisClusterConfiguration` 존재 시 | Redis 클러스터 연결 (topology refresh 포함) |
| `RedisTemplate<String, Any>` | `@ConditionalOnMissingBean` | JSON 직렬화 기반 Redis 템플릿 |

Boot의 `RedisAutoConfiguration` 이후에 동작한다 (`@AutoConfiguration(after = [RedisAutoConfiguration::class])`).

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

### WebClient (`kgd.common.web-client.enabled`)

| 빈 | 조건 | 설명 |
|----|------|------|
| `WebClientCustomizer` | 항상 등록 | Boot의 `WebClient.Builder`에 2MB 메모리 제한 커스터마이즈 |
| `WebClient` | `@ConditionalOnMissingBean` | 기본 WebClient 인스턴스 |
| `WebClientBuilderFactory` | `@ConditionalOnMissingBean` | 공통 builder를 clone하여 서비스별 client 생성 (`create()` / `builder()`) |

Boot의 `WebClientAutoConfiguration` 이후에 동작한다. `WebClient.Builder`를 직접 생성하지 않고, Boot가 제공하는 builder에 `WebClientCustomizer`로 codec 제한을 적용한다.

## 현재 서비스별 적용 현황

| 서비스 | security | aes | redis | web-client | 이유 |
|--------|----------|-----|-------|------------|------|
| auth | `true` | `true` | - | `true` | JWT 인증 + AES 암호화 + OAuth HTTP 호출 |
| gifticon | `true` | `true` | - | `true` | JWT 인증 + OCR HTTP 호출 |
| gateway | `true` | `false` | - | - | JWT 검증만 (reactive, AES 불필요) |
| code-dictionary | - | - | - | - | exception/response만 필요 |
| product | - | - | - | - | exception/response만 필요 |
| order | - | - | - | - | exception/response만 필요 |
| search | - | - | - | - | exception/response만 필요 |
| inventory | - | - | - | - | exception/response만 필요 |
| fulfillment | - | - | - | - | exception/response만 필요 |
| discovery | - | - | - | - | Eureka 서버만 |

## 신규 공통 Feature 개발 가이드

### 원칙

- common은 **Boot starter처럼 동작하는 라이브러리**다. `@Enable...` 같은 앱 진입점을 만들지 않는다.
- 기능 활성화는 **설정 기반**(`kgd.common.*.enabled`)으로 통일한다.
- 각 feature는 자기 조건과 빈 정의를 **자기 파일 안에서 닫는다**.
- 서비스가 같은 타입의 빈을 직접 등록하면 common 것은 **자동으로 양보**한다 (`@ConditionalOnMissingBean`).

### Step 1: Auto-Configuration 클래스 생성

`common/src/main/kotlin/com/kgd/common/{feature}/Common{Feature}AutoConfiguration.kt` 에 생성한다.

```kotlin
package com.kgd.common.monitoring

@AutoConfiguration(afterName = ["..."]) // Boot auto-config과 순서 충돌 방지 (필요 시)
@ConditionalOnClass(MeterRegistry::class) // classpath에 관련 클래스가 있을 때만
@ConditionalOnProperty(
    prefix = "kgd.common.monitoring",
    name = ["enabled"],
    havingValue = "true",
    matchIfMissing = false
)
class CommonMonitoringAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    fun commonMeterFilter(): MeterFilter = MeterFilter.commonTags(
        Tags.of("app", "commerce-platform")
    )
}
```

**필수 어노테이션 체크리스트:**

| 어노테이션 | 용도 | 필수 여부 |
|-----------|------|----------|
| `@AutoConfiguration` | Boot auto-config 등록 | 필수 |
| `@ConditionalOnProperty` | yml 프로퍼티로 활성화 제어 | 필수 |
| `@ConditionalOnClass` | classpath에 관련 라이브러리 있을 때만 | 선택 (외부 라이브러리 의존 시 필수) |
| `@ConditionalOnMissingBean` | 서비스 측 오버라이드 허용 | 빈마다 필수 |
| `afterName = [...]` | Boot 기본 auto-config 이후 동작 보장 | common에 해당 Boot 의존성이 없으면 `afterName` 문자열 사용 |

### Step 2: 프로퍼티 설계

- 네임스페이스: `kgd.common.{feature-name}`
- `enabled` 프로퍼티는 `matchIfMissing = false` (기본 비활성)
- 세부 옵션이 있으면 `@ConfigurationProperties`로 외부화

```yaml
kgd:
  common:
    monitoring:
      enabled: true
      # 세부 옵션 (있을 경우)
      include-jvm-metrics: true
```

### Step 3: AutoConfiguration.imports 등록

`common/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`에 FQCN 한 줄 추가:

```
com.kgd.common.monitoring.CommonMonitoringAutoConfiguration
```

### Step 4: 서비스별 활성화

각 서비스의 `application.yml`에 프로퍼티만 추가하면 끝이다. 코드 변경 불필요.

```yaml
kgd:
  common:
    monitoring:
      enabled: true
```

### Step 5: 문서 업데이트

이 문서의 다음 항목을 갱신한다:
- **각 Feature 상세** 섹션에 빈/조건/설정 테이블 추가
- **현재 서비스별 적용 현황** 테이블에 새 열 추가
- `common/docs/service.md` Provided Components 테이블에 추가

### 주의 사항

- **Servlet/WebFlux 혼용 주의**: Servlet 전용 빈이면 `@ConditionalOnWebApplication(type = SERVLET)`, reactive 전용이면 `@ConditionalOnWebApplication(type = REACTIVE)` 사용
- **공유 상태 방지**: factory나 builder를 제공할 때는 `clone()` 패턴으로 호출 간 상태 오염 방지
- **Boot auto-config 참조**: common 모듈에 Boot starter가 없을 수 있으므로 `after` 대신 `afterName` (문자열) 사용
- **기본값 정책**: `matchIfMissing = false`로 통일 — 명시적으로 켜야 활성화
