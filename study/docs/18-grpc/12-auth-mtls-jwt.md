---
parent: 18-grpc
seq: 12
title: 인증 — mTLS · JWT via metadata · 서비스 메시 위임
type: deep
created: 2026-05-01
---

# 12. gRPC 인증

> 인증 = "누구냐", 인가 = "그 사람이 그걸 해도 되냐". gRPC 는 두 축 (mTLS (mutual TLS, 양방향 TLS), JWT (JSON Web Token)) 을 모두 metadata + interceptor 로 자연스럽게 표현한다.

## 1. 인증 옵션 3가지

| 방법 | 인증 주체 | 적합한 경우 |
|---|---|---|
| **mTLS** | 서비스 자체 (인증서) | 내부 서비스 간 (서비스 메시) |
| **JWT via metadata** | 사용자 (토큰) | 사용자 위임 호출 |
| **둘 다 (mTLS + JWT)** | 서비스 + 사용자 | 사용자 컨텍스트 + 서비스 신원 모두 필요 |

#13 SSO (Single Sign-On, 단일 로그인) 에서 다룬 내용과 결합되는 지점이 많음.

## 2. mTLS — 서비스 신원 검증

### 2-1. 기본

- 서버뿐 아니라 클라이언트도 인증서 제시
- 양쪽 모두 신원 검증 (TLS handshake 단계)
- 인증서의 **CN / SAN** 이 서비스 ID

```kotlin
// 클라이언트 측 — 인증서 + key 제시
val sslContext = GrpcSslContexts.forClient()
    .keyManager(File("client.crt"), File("client.key"))
    .trustManager(File("ca.crt"))
    .build()

val channel = NettyChannelBuilder
    .forTarget("product.default.svc.cluster.local:9090")
    .sslContext(sslContext)
    .build()
```

```kotlin
// 서버 측 — 클라 인증서 요구
val sslContext = GrpcSslContexts.forServer(
    File("server.crt"), File("server.key")
).trustManager(File("ca.crt"))
.clientAuth(ClientAuth.REQUIRE)         // ← 클라 인증서 필수
.build()

val server = NettyServerBuilder.forPort(9090)
    .sslContext(sslContext)
    .addService(ProductService())
    .build()
```

### 2-2. 인증서에서 신원 추출

```kotlin
class MtlsServerInterceptor : ServerInterceptor {
    override fun <ReqT, RespT> interceptCall(
        call: ServerCall<ReqT, RespT>, headers: Metadata, next: ServerCallHandler<ReqT, RespT>
    ): ServerCall.Listener<ReqT> {
        val sslSession = call.attributes.get(Grpc.TRANSPORT_ATTR_SSL_SESSION)
            ?: return reject(call, Status.UNAUTHENTICATED.withDescription("no TLS"))

        val peer = sslSession.peerCertificates.firstOrNull() as? X509Certificate
            ?: return reject(call, Status.UNAUTHENTICATED.withDescription("no client cert"))

        val cn = peer.subjectX500Principal.name   // CN=order-service,O=msa
        val ctx = Context.current().withValue(SERVICE_ID_KEY, cn)
        return Contexts.interceptCall(ctx, call, headers, next)
    }
}
```

### 2-3. 서비스 메시 위임

Istio / Linkerd / Consul 도입 시:
- sidecar (Envoy) 가 자동 mTLS — app 코드 변경 없음
- 인증서는 control plane (Citadel / Istio CA) 이 자동 발급 / 회전 (보통 24h)
- AuthorizationPolicy 로 "어느 서비스가 어느 RPC 를 호출 가능한가" 선언

```yaml
# Istio AuthorizationPolicy
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: product-allow-order
  namespace: default
spec:
  selector:
    matchLabels:
      app: product
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/default/sa/order-sa"]
    to:
    - operation:
        methods: ["POST"]
        paths: ["/commerce.product.v1.ProductService/*"]
```

→ "order 서비스만 product gRPC 호출 가능" 을 정책으로 선언. app 코드 인증 로직 불필요.

#13 / 17-mtls 와 매끄럽게 연결.

## 3. JWT via metadata — 사용자 위임

### 3-1. 클라 측 토큰 주입

```kotlin
class BearerTokenInterceptor(private val tokenSupplier: () -> String) : ClientInterceptor {
    override fun <ReqT, RespT> interceptCall(
        method: MethodDescriptor<ReqT, RespT>, options: CallOptions, next: Channel
    ): ClientCall<ReqT, RespT> {
        return object : ForwardingClientCall.SimpleForwardingClientCall<ReqT, RespT>(
            next.newCall(method, options)
        ) {
            override fun start(responseListener: Listener<RespT>, headers: Metadata) {
                headers.put(
                    Metadata.Key.of("authorization", Metadata.ASCII_STRING_MARSHALLER),
                    "Bearer ${tokenSupplier()}"
                )
                super.start(responseListener, headers)
            }
        }
    }
}
```

또는 gRPC 의 `CallCredentials` API:

```kotlin
class JwtCallCredentials(private val tokenSupplier: () -> String) : CallCredentials() {
    override fun applyRequestMetadata(
        info: RequestInfo, executor: Executor, applier: MetadataApplier
    ) {
        executor.execute {
            val md = Metadata().apply {
                put(Metadata.Key.of("authorization", Metadata.ASCII_STRING_MARSHALLER),
                    "Bearer ${tokenSupplier()}")
            }
            applier.apply(md)
        }
    }
    override fun thisUsesUnstableApi() {}
}

// 사용
stub.withCallCredentials(JwtCallCredentials(jwtProvider::get))
    .getProduct(req)
```

→ `CallCredentials` 가 더 표준 (gRPC 표준 hook).

### 3-2. 서버 측 검증

```kotlin
class JwtServerInterceptor(private val jwtUtil: JwtUtil) : ServerInterceptor {
    private val PUBLIC_METHODS = setOf("/grpc.health.v1.Health/Check")

    override fun <ReqT, RespT> interceptCall(
        call: ServerCall<ReqT, RespT>, headers: Metadata, next: ServerCallHandler<ReqT, RespT>
    ): ServerCall.Listener<ReqT> {
        if (call.methodDescriptor.fullMethodName in PUBLIC_METHODS) {
            return next.startCall(call, headers)
        }

        val auth = headers.get(Metadata.Key.of("authorization", Metadata.ASCII_STRING_MARSHALLER))
            ?: return reject(call, Status.UNAUTHENTICATED.withDescription("missing auth header"))
        val token = auth.removePrefix("Bearer ").trim()

        val claims = try { jwtUtil.parse(token) }
        catch (e: Exception) { return reject(call, Status.UNAUTHENTICATED.withDescription("invalid token")) }

        if (claims.expiration?.before(Date()) == true) {
            return reject(call, Status.UNAUTHENTICATED.withDescription("expired token"))
        }

        val ctx = Context.current()
            .withValue(USER_ID_KEY, claims.subject)
            .withValue(ROLES_KEY, claims["roles"] as? List<String> ?: emptyList())
        return Contexts.interceptCall(ctx, call, headers, next)
    }

    private fun <ReqT, RespT> reject(call: ServerCall<ReqT, RespT>, status: Status): ServerCall.Listener<ReqT> {
        call.close(status, Metadata())
        return object : ServerCall.Listener<ReqT>() {}
    }
}
```

### 3-3. 인가 (RBAC) 결합

msa 의 ROLE_USER / SELLER / ADMIN 패턴을 그대로 활용 (RBAC = Role-Based Access Control, 역할 기반 접근 제어):

```kotlin
class RoleAuthInterceptor : ServerInterceptor {
    override fun <ReqT, RespT> interceptCall(...) {
        val method = call.methodDescriptor.fullMethodName
        val roles = ROLES_KEY.get(Context.current()) ?: emptyList()

        val required = REQUIRED_ROLES[method] ?: return next.startCall(call, headers)
        if (roles.none { it in required }) {
            return reject(call, Status.PERMISSION_DENIED.withDescription("requires $required"))
        }
        return next.startCall(call, headers)
    }
}

private val REQUIRED_ROLES = mapOf(
    "/commerce.product.v1.ProductService/CreateProduct" to setOf("ADMIN", "SELLER"),
    "/commerce.product.v1.ProductService/DeleteProduct" to setOf("ADMIN"),
)
```

또는 method options 로 .proto 에 선언:

```protobuf
service ProductService {
  rpc CreateProduct(CreateProductRequest) returns (Product) {
    option (commerce.auth.v1.required_roles) = "ADMIN";
    option (commerce.auth.v1.required_roles) = "SELLER";
  }
}
```

(proto extension 사용 — interceptor 가 method descriptor 에서 읽기)

## 4. mTLS + JWT 결합 (강력한 패턴)

```
사용자 → gateway (TLS, JWT 검증)
   gateway → product (mTLS + propagated JWT in metadata)
   product → inventory (mTLS + propagated JWT)
```

- mTLS 가 "어느 서비스에서 왔나" 보증
- JWT 가 "원래 사용자는 누구" 전달
- 서비스 메시가 mTLS 를 자동, app 이 JWT 를 metadata 로

이 결합은 **zero-trust 아키텍처** 의 표준 패턴.

## 5. msa 통합 시나리오

### 5-1. 현재 구조 (REST)

```
gateway (Spring Cloud Gateway, JWT 검증, RBAC, RateLimit)
   ↓ WebClient (HTTP, JWT propagation 가능)
auth / member / product / order / ...
```

- gateway 의 인증 필터 — **검증 결과 (2026-05-01)**: 실제 클래스명은 `AuthenticationGatewayFilter` (`gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt`). `JwtAuthenticationFilter` 이름은 msa 어디에도 없음 (grep zero hit). 인증 로직은 `JwtTokenValidator` + Redis blacklist 조합으로 분리 적용
- 각 서비스는 SecurityContext 에서 user 식별
- 내부 호출 시 JWT 헤더 propagation (구현 여부에 따라)

### 5-2. gRPC 도입 시 (가상)

```
gateway (REST, JWT 검증, mtls 종단)
   ↓ gRPC (mTLS + Authorization metadata)
auth / member / product / order / ...
```

- gateway 가 외부 REST 받고 내부는 gRPC 로 변환 (grpc-gateway 의 역방향)
- 또는 별도 BFF (Backend For Frontend) 서비스가 변환
- 내부 mTLS 는 mesh (Istio) 위임

### 5-3. 단계적 도입

1. Phase 0: gRPC h2c (no TLS) + JWT metadata. NetworkPolicy 로 격리
2. Phase 1: mesh 도입 후 자동 mTLS, JWT 는 그대로
3. Phase 2: AuthorizationPolicy 로 service-to-service 정책 선언

## 6. 외부 서비스의 인증 패턴

| 서비스 | 표준 |
|---|---|
| Google APIs (gRPC) | OAuth2 access token (Bearer) via metadata |
| AWS gRPC services | SigV4 signature (custom) |
| 내부 서비스 | mTLS (mesh) + JWT |
| 모바일 앱 → 백엔드 | JWT via metadata (gRPC-Web 또는 native) |

## 7. 성능 영향

| 인증 | 추가 비용 |
|---|---|
| mTLS (handshake) | 첫 connection 만 ~10-50ms (이후 재사용으로 무시할만한 수준) |
| mTLS 검증 (per-RPC) | 인증서 파싱 마이크로초 |
| JWT 검증 | RS256 서명 검증 ~0.1ms (RS256), HS256 ~0.01ms |
| JWT JWKS fetch (RS256) | 캐시 hit 시 0, miss 시 외부 호출 비용 |

⇒ **인증 자체는 핫패스 영향 작음**. 단, JWKS / blacklist DB 호출이 있으면 별도 캐싱 필요.

## 8. 흔한 보안 함정

| 함정 | 결과 |
|---|---|
| h2c 로 외부 노출 | 토큰 평문 노출 |
| `clientAuth(OPTIONAL)` 그대로 | mTLS 검증 우회 가능 |
| JwtInterceptor 가 health check 도 검증 | K8s readiness probe 실패 |
| Status.UNAUTHENTICATED 에 디테일한 이유 노출 | 공격자가 사용자 존재 여부 추론 |
| Refresh / blacklist 미고려 | 탈취된 토큰 즉시 무효화 불가 |
| metadata 에 raw 비밀번호 | 평문 로그 / debug 노출 위험 |

## 9. 면접 핵심

> Q: gRPC 에서 인증은 어떻게?

A: 두 축. (1) mTLS — 서비스 메시 (Istio) 가 자동으로 양방향 인증서 발급 / 회전 / 검증. 인증서 CN/SAN = 서비스 ID. (2) JWT via metadata — 사용자 위임 호출. ClientInterceptor 또는 CallCredentials 가 `authorization: Bearer <token>` 메타데이터 주입. 서버 측 ServerInterceptor 가 검증 후 Context 에 user / roles 저장.

> Q: mTLS 를 application 에 직접 구현하지 않으려면?

A: 서비스 메시 (Istio, Linkerd) 도입. Sidecar (Envoy) 가 모든 outbound / inbound 를 가로채 자동 mTLS. AuthorizationPolicy 로 service-to-service 정책 선언. App 은 평문 (h2c) 그대로 작성하면 됨.

> Q: REST 의 SecurityContext 같은 걸 gRPC 에서?

A: gRPC `Context` 가 thread-local 의 비동기 안전 버전. ServerInterceptor 가 JWT 파싱 후 Context.Key 로 user / roles 저장. 서비스 핸들러는 `USER_ID_KEY.get(Context.current())` 로 읽기. coroutine 환경에서도 자동 전파.

## 다음 학습

- [13-interop-gateway-web.md](13-interop-gateway-web.md) — 외부 노출 (gRPC-Web, grpc-gateway)
- [09-advanced-features.md](09-advanced-features.md) — Interceptor 패턴 일반
