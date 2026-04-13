# ADR-0021: 로깅 규칙

- **상태**: Accepted
- **유형**: Convention
- **날짜**: 2026-04-13
- **출처**: mrt-package ADR-0018 기반, MSA 환경에 맞게 보완

## 라이브러리

`io.github.oshai:kotlin-logging-jvm` (kotlin-logging 7.x) 사용.
SLF4J 직접 사용 및 `LoggerFactory.getLogger()` 선언 금지.

## 선언 위치

- **Spring Bean (Service, Controller 등)**: 클래스 내부 인스턴스 프로퍼티로 선언
- **companion object만 존재하는 유틸리티 클래스**: companion object 내부에 선언
- **파일 최상위 선언 금지**: logger 이름이 `클래스명Kt`로 생성되어 클래스명과 불일치

```kotlin
// ✅ 올바른 선언 (Spring Bean)
@Service
class ProductService(...) {
    private val log = KotlinLogging.logger {}
}

// ✅ 올바른 선언 (유틸리티 클래스)
class DateUtils {
    companion object {
        private val log = KotlinLogging.logger {}
    }
}

// ❌ 금지: 파일 최상위
private val log = KotlinLogging.logger {}
class ProductService(...)
```

## 로그 작성 규칙

- 모든 로그는 **람다 형식** 사용 (문자열 직접 전달 금지)
- 객체 직렬화가 필요한 경우 `objectMapper.writeValueAsString()` 사용

```kotlin
// ✅ 람다 형식
log.info { "Product created: productId=$productId" }
log.debug { "Stock reserved: productId=$productId, qty=$qty" }
log.error(e) { "Payment failed: orderId=$orderId" }

// ❌ 금지: SLF4J 스타일 문자열 + 플레이스홀더
log.info("Product created: productId={}", productId)
log.debug("Stock reserved: productId={}, qty={}", productId, qty)
log.error("Payment failed: orderId={}", orderId, e)
```

## 레벨 가이드

| 레벨 | 용도 |
|------|------|
| `error` | 예외 발생, 복구 불가한 오류 — 반드시 예외 객체 포함 |
| `warn` | 예외 없이 처리됐으나 주의 필요한 상황 (재시도 성공, fallback 사용 등) |
| `info` | 외부 API 요청/응답, Kafka 이벤트 발행/소비, 배치 실행 결과 등 운영 추적 필요 정보 |
| `debug` | 개발/디버깅용 상세 정보 (운영 환경에서는 비활성) |

## error 로그 규칙

- `log.error` 호출 시 예외 객체를 **첫 번째 인자**로 전달
- 예외 없이 오류 상황을 기록할 때는 `warn` 사용 검토

```kotlin
// ✅ 예외 객체 포함
log.error(e) { "Bulk indexing failed: ${failedOps.size} items" }

// ❌ 금지: 예외 없이 error 레벨 사용
log.error { "${failedOps.size} items failed" }
```

## AI 작업 규칙

- 새 클래스 작성 시 로거 선언 누락 금지
- 외부 IO 메서드에는 `error` 레벨 로그 필수 포함
- `log.error` 호출 시 예외 객체를 첫 번째 인자로 전달
- `log.info("...")` 문자열 직접 전달 방식으로 생성 금지 — 반드시 람다 형식 사용
- 로그 메시지에 민감 정보(비밀번호, 토큰, 개인정보 등) 포함 금지

## 마이그레이션 가이드

기존 `LoggerFactory.getLogger()` 사용 코드를 점진적으로 전환한다:

```kotlin
// Before
import org.slf4j.LoggerFactory

class ProductService {
    private val log = LoggerFactory.getLogger(javaClass)
    
    fun process() {
        log.info("Processing product: {}", productId)
    }
}

// After
import io.github.oshai.kotlinlogging.KotlinLogging

class ProductService {
    private val log = KotlinLogging.logger {}
    
    fun process() {
        log.info { "Processing product: productId=$productId" }
    }
}
```

## References

- mrt-package ADR-0018: 로깅 규칙
