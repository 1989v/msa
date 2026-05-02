---
parent: 18-grpc
seq: 11
title: 에러 처리 — Status code 16개 · google.rpc.Status · error details
type: deep
created: 2026-05-01
---

# 11. 에러 처리

## 1. gRPC 의 응답 모델

gRPC 응답은 두 부분으로 구성:

1. **메시지 본문** — protobuf 응답 (성공일 때만 의미)
2. **trailers** — `grpc-status` (정수) + `grpc-message` (텍스트) + 선택적 details

```
서버 → 클라:
  HEADERS (response meta)
  DATA (응답 메시지)            ← 성공일 때만
  HEADERS (trailers: grpc-status=0)
```

실패 시:
```
서버 → 클라:
  HEADERS (trailers: grpc-status=5, grpc-message="product 123 not found")
```

→ HTTP 의 `200 OK + 응답 body 안에 "error": {...}` 같은 *의미 혼재* 가 없음.

## 2. Status code 16개

| 코드 | 이름 | 의미 | HTTP 매핑 (관례) |
|---|---|---|---|
| 0 | OK | 정상 | 200 |
| 1 | CANCELLED | 클라이언트가 cancel | 499 (nginx) |
| 2 | UNKNOWN | 분류 불가 | 500 |
| 3 | INVALID_ARGUMENT | 입력 검증 실패 | 400 |
| 4 | DEADLINE_EXCEEDED | 시간 초과 | 504 |
| 5 | NOT_FOUND | 리소스 없음 | 404 |
| 6 | ALREADY_EXISTS | 이미 존재 (unique 충돌) | 409 |
| 7 | PERMISSION_DENIED | 인가 실패 (인증은 OK) | 403 |
| 8 | RESOURCE_EXHAUSTED | quota/rate 초과 | 429 |
| 9 | FAILED_PRECONDITION | 상태 기반 거부 (예: 잔고 부족) | 400/409 |
| 10 | ABORTED | 트랜잭션/낙관락 충돌 | 409 |
| 11 | OUT_OF_RANGE | 범위 벗어남 (FAILED_PRECONDITION 의 특수형) | 400 |
| 12 | UNIMPLEMENTED | 메서드 미구현 | 501 |
| 13 | INTERNAL | 서버 내부 오류 | 500 |
| 14 | UNAVAILABLE | 서버 다운/과부하 (retry 가능) | 503 |
| 15 | DATA_LOSS | 복구 불가 데이터 손실 | 500 |
| 16 | UNAUTHENTICATED | 인증 실패 (자격증명 없음/잘못) | 401 |

### 헷갈리는 페어

| 페어 | 구분 |
|---|---|
| UNAUTHENTICATED (16) vs PERMISSION_DENIED (7) | "누구냐" 모름 vs "그 사람은 안 됨" |
| INVALID_ARGUMENT (3) vs FAILED_PRECONDITION (9) | 입력 자체 부적절 vs 시스템 상태 부적절 |
| FAILED_PRECONDITION (9) vs ABORTED (10) | 상태 기반 거부 (불변) vs 동시성 충돌 (재시도 가능) |
| ABORTED (10) vs UNAVAILABLE (14) | 충돌 → app 레벨 retry vs transport → transparent retry |

## 3. Retry 가능 여부

| Status | Retry? | 이유 |
|---|---|---|
| OK | - | |
| CANCELLED | ❌ | 의도된 취소 |
| INVALID_ARGUMENT | ❌ | 입력 그대로면 영원히 fail |
| NOT_FOUND | ❌ | 자원 없음 |
| ALREADY_EXISTS | ❌ | |
| PERMISSION_DENIED | ❌ | 권한 없음 |
| UNAUTHENTICATED | ❌ | 자격증명 갱신 후만 |
| RESOURCE_EXHAUSTED | △ | 백오프 후 가능 |
| FAILED_PRECONDITION | ❌ | 상태 변경 없이 같은 결과 |
| ABORTED | ✅ | 동시성 충돌, 재시도 가능 |
| OUT_OF_RANGE | ❌ | |
| DEADLINE_EXCEEDED | △ | 시간이 충분하면 |
| UNAVAILABLE | ✅ | transient |
| INTERNAL | ❌ | unsafe to retry |
| UNIMPLEMENTED | ❌ | 영원히 없음 |
| DATA_LOSS | ❌ | |
| UNKNOWN | ❌ | 불확실하므로 보수적 |

⇒ **retry 가능: ABORTED, UNAVAILABLE, (조건부) RESOURCE_EXHAUSTED, DEADLINE_EXCEEDED**.

## 4. 서버 측 에러 throw

### 4-1. 단순 status

```kotlin
override suspend fun getProduct(req: GetProductRequest): GetProductResponse {
    val product = productRepository.findById(req.id)
        ?: throw StatusException(
            Status.NOT_FOUND.withDescription("product ${req.id} not found")
        )
    return getProductResponse { this.product = product.toProto() }
}
```

- `StatusException` (checked) 또는 `StatusRuntimeException` (unchecked)
- 둘 다 클라 측에서 동일하게 catch

### 4-2. msa 의 BusinessException 매핑

현 msa 패턴:
```kotlin
// common/src/.../BusinessException.kt
class BusinessException(val errorCode: ErrorCode, message: String?) : RuntimeException(message)
enum class ErrorCode(val httpStatus: HttpStatus) { NOT_FOUND, INVALID_ARGUMENT, ... }
```

gRPC 도입 시 변환 layer:

```kotlin
class BusinessExceptionInterceptor : ServerInterceptor {
    override fun <ReqT, RespT> interceptCall(
        call: ServerCall<ReqT, RespT>, headers: Metadata, next: ServerCallHandler<ReqT, RespT>
    ): ServerCall.Listener<ReqT> {
        val wrapped = object : ForwardingServerCallListener.SimpleForwardingServerCallListener<ReqT>(
            next.startCall(call, headers)
        ) {
            override fun onHalfClose() {
                try { super.onHalfClose() }
                catch (e: BusinessException) {
                    val status = mapToGrpcStatus(e.errorCode).withDescription(e.message)
                    call.close(status, Metadata())
                }
            }
        }
        return wrapped
    }
}

fun mapToGrpcStatus(code: ErrorCode): Status = when (code) {
    ErrorCode.NOT_FOUND -> Status.NOT_FOUND
    ErrorCode.INVALID_ARGUMENT -> Status.INVALID_ARGUMENT
    ErrorCode.UNAUTHENTICATED -> Status.UNAUTHENTICATED
    ErrorCode.PERMISSION_DENIED -> Status.PERMISSION_DENIED
    ErrorCode.CIRCUIT_BREAKER_OPEN -> Status.UNAVAILABLE
    ErrorCode.EXTERNAL_API_ERROR -> Status.UNAVAILABLE
    else -> Status.INTERNAL
}
```

## 5. google.rpc.Status — 풍부한 에러 details

단순 status code + message 외에 **구조화된 details** 가 필요할 때.

### 5-1. proto 정의

```protobuf
message Status {
  int32 code = 1;
  string message = 2;
  repeated google.protobuf.Any details = 3;
}
```

- `details` 는 `Any` 의 array → 각자 자체 메시지 타입
- 표준 details 메시지: `BadRequest`, `PreconditionFailure`, `RetryInfo`, `QuotaFailure`, `LocalizedMessage`, `ErrorInfo`, `ResourceInfo`, ...

### 5-2. BadRequest 예 (필드별 검증 실패)

```kotlin
import com.google.rpc.BadRequest
import com.google.rpc.Status as RpcStatus

val badRequest = BadRequest.newBuilder()
    .addFieldViolations(BadRequest.FieldViolation.newBuilder()
        .setField("name").setDescription("must not be blank"))
    .addFieldViolations(BadRequest.FieldViolation.newBuilder()
        .setField("price_cents").setDescription("must be > 0"))
    .build()

val status = RpcStatus.newBuilder()
    .setCode(Code.INVALID_ARGUMENT.value)
    .setMessage("validation failed")
    .addDetails(Any.pack(badRequest))
    .build()

throw StatusProto.toStatusException(status)
```

클라 측 디코드:
```kotlin
val statusProto = StatusProto.fromThrowable(e)
val badRequest = statusProto?.detailsList
    ?.firstOrNull { it.`is`(BadRequest::class.java) }
    ?.unpack(BadRequest::class.java)
badRequest?.fieldViolationsList?.forEach { v -> log.warn("field={}, {}", v.field, v.description) }
```

### 5-3. RetryInfo (재시도 가이드)

```kotlin
val retryInfo = RetryInfo.newBuilder()
    .setRetryDelay(Duration.newBuilder().setSeconds(2))
    .build()
```

→ 서버가 클라에 "2초 후 재시도해" 명시. 클라 측이 이를 활용해 backoff.

## 6. 클라이언트 측 catch

### 6-1. coroutine stub

```kotlin
try {
    val resp = stub.getProduct(req)
} catch (e: StatusException) {
    when (e.status.code) {
        Status.Code.NOT_FOUND -> throw BusinessException(ErrorCode.NOT_FOUND, e.message)
        Status.Code.UNAVAILABLE -> {
            log.warn("product service unavailable, retrying...")
            // retry policy
        }
        Status.Code.DEADLINE_EXCEEDED -> throw BusinessException(ErrorCode.TIMEOUT)
        else -> throw BusinessException(ErrorCode.EXTERNAL_API_ERROR, "${e.status.code}: ${e.message}")
    }
}
```

### 6-2. msa 의 ProductAdapter 패턴 (gRPC 버전)

현 msa 의 `order/.../ProductAdapter.kt` 는:
```kotlin
return circuitBreaker.executeSuspendFunction {
    try { webClient.get()... }
    catch (e: WebClientResponseException.NotFound) { throw BusinessException(NOT_FOUND, ...) }
    catch (e: Exception) { throw BusinessException(EXTERNAL_API_ERROR, ...) }
}
```

gRPC 버전:
```kotlin
return circuitBreaker.executeSuspendFunction {
    try {
        productStub.withDeadlineAfter(500, TimeUnit.MILLISECONDS)
            .getProduct(getProductRequest { id = productId })
            .product.toDomain()
    } catch (e: StatusException) {
        when (e.status.code) {
            Status.Code.NOT_FOUND -> throw BusinessException(ErrorCode.NOT_FOUND, "product $productId")
            Status.Code.DEADLINE_EXCEEDED -> throw BusinessException(ErrorCode.TIMEOUT)
            Status.Code.UNAVAILABLE -> throw BusinessException(ErrorCode.EXTERNAL_API_ERROR, "service unavailable")
            else -> throw BusinessException(ErrorCode.EXTERNAL_API_ERROR, "grpc ${e.status.code}: ${e.message}")
        }
    }
}
```

## 7. 에러 details + i18n

`google.rpc.LocalizedMessage` 로 다국어 에러:

```protobuf
message LocalizedMessage {
  string locale = 1;        // "ko-KR"
  string message = 2;
}
```

- 클라 (브라우저) 가 자기 locale 에 맞는 메시지 선택
- 서버는 details 에 다중 locale 포함 가능

## 8. HTTP/REST 와의 매핑

`grpc-gateway` (REST gateway) 가 자동 매핑:

| gRPC status | HTTP status |
|---|---|
| OK | 200 |
| CANCELLED | 499 |
| INVALID_ARGUMENT | 400 |
| DEADLINE_EXCEEDED | 504 |
| NOT_FOUND | 404 |
| ALREADY_EXISTS | 409 |
| PERMISSION_DENIED | 403 |
| UNAUTHENTICATED | 401 |
| RESOURCE_EXHAUSTED | 429 |
| FAILED_PRECONDITION | 400 |
| ABORTED | 409 |
| OUT_OF_RANGE | 400 |
| UNIMPLEMENTED | 501 |
| INTERNAL | 500 |
| UNAVAILABLE | 503 |
| DATA_LOSS | 500 |

→ msa 의 REST API 와 gRPC 가 공존할 때 일관된 에러 매핑 가능.

## 9. 흔한 안티패턴

| 안티패턴 | 문제 |
|---|---|
| 모든 실패에 INTERNAL | retry / 디버깅 / alerting 분류 불가 |
| HTTP status 처럼 200 + body 에러 | gRPC 의 trailers 구조를 무력화 |
| StatusException 대신 일반 RuntimeException | `INTERNAL` 로 일괄 변환되어 의미 손실 |
| details 안 보내고 message 에 JSON 박기 | type 안전성 손실 |
| 클라가 모든 status 를 같은 backoff retry | UNAVAILABLE 만 retry 의미 |

## 10. 면접 핵심

> Q: gRPC 의 status code 와 HTTP status 의 관계?

A: gRPC 는 자체 16개 status code (0=OK, 14=UNAVAILABLE 등) 를 정의. HTTP/2 위에서 응답은 항상 HTTP 200 으로 시작하고 trailers 의 `grpc-status` 헤더에 실제 결과 인코딩. REST 와 매핑은 grpc-gateway 가 표준화.

> Q: ABORTED 와 UNAVAILABLE 의 retry 의미 차이?

A: ABORTED 는 application-level 동시성 충돌 (낙관락, 트랜잭션 충돌) → 멱등하게 retry 가능. UNAVAILABLE 은 transport / 서버 다운 → gRPC 의 transparent retry 로 처리. 둘 다 retry 가능하나 backoff 전략과 idempotency 보증 책임 위치가 다름.

> Q: BusinessException 을 gRPC 로 어떻게 매핑?

A: ServerInterceptor 에서 catch 후 `Status` 변환. ErrorCode → gRPC Status enum 매핑 테이블 유지. 추가 정보는 `google.rpc.Status` 의 details (Any) 로 BadRequest / RetryInfo / ErrorInfo 활용. 클라 측은 StatusException 의 code 로 분기.

## 다음 학습

- [12-auth-mtls-jwt.md](12-auth-mtls-jwt.md) — UNAUTHENTICATED 와 인증 흐름
- [09-advanced-features.md](09-advanced-features.md) — Interceptor 와 결합
