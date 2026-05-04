---
parent: 17-spring-web
seq: 16
title: BREACH / CRIME 공격 + 대응
type: deep
created: 2026-05-01
---

# 16. BREACH / CRIME 공격

> 면접 보안 단골: **"BREACH 공격이 뭔가요? 대응책은?"**
>
> 압축 + TLS (Transport Layer Security, 전송 계층 보안) 의 사이드 채널을 통해 secret 을 유출하는 공격. 대처를 몰라 응답 모두에 gzip 켜면 사고 가능.

## 1. CRIME (2012) — TLS 압축 공격

### 핵심 아이디어

- TLS 자체에 압축 옵션 (`Compressed`) 이 있던 시절
- HTTPS 응답이 TLS 레이어에서 압축됨
- gzip 은 **반복되는 문자열을 짧게 표현** 함 → 같은 문자열이 많을수록 압축 후 크기 ↓
- 공격자가 사이드 채널 (응답 크기) 을 관찰

### 공격 시나리오

1. 공격자가 타깃 사이트에 cross-origin 요청을 강제 (예: 악성 광고로 fetch)
2. 요청 헤더에 쿠키 자동 동봉 (브라우저 동작)
3. 공격자가 임의 path 에 `?guess=abc` 같은 파라미터를 넣어 보냄
4. 응답 크기 관찰
   - `?guess=session=` (실제 쿠키 prefix 와 일치) → 압축률 ↑ → 응답 작아짐
   - `?guess=session=Z` (틀림) → 압축률 변화 없음
5. 한 글자씩 매칭 추측 → 결국 쿠키 전체 복원

### 대응

- **TLS 압축 deprecated** — 모든 모던 라이브러리/브라우저 비활성화
- TLS 1.3 은 압축 옵션 자체 제거

→ CRIME 자체는 TLS 압축이 사실상 사라져 더 이상 위협 안 됨.

## 2. BREACH (2013) — HTTP 압축 공격

### 핵심 아이디어

- TLS 압축은 막혔지만 **HTTP body 의 gzip 압축** 은 여전히 일반적
- 같은 사이드 채널 (응답 크기) 이 살아있음
- HTTP 응답 body 안에 (1) 사용자 입력이 echo 되고, (2) secret 이 함께 있고, (3) 압축이 켜져 있으면 공격 가능

### 필수 3 조건

| 조건 | 설명 |
|---|---|
| **1. 사용자 입력 echo** | `?search=abc` 의 `abc` 가 응답 body 에 포함 |
| **2. secret 이 같은 응답에 포함** | CSRF 토큰, 인증 토큰, 세션 ID 등 |
| **3. HTTP 압축 활성화** | gzip / brotli 등 |

→ 셋 중 하나만 빠져도 BREACH 안 통함.

### 공격 시나리오

```html
<!-- 페이지 응답 (가상 예시) -->
<html>
  <input type="hidden" name="csrf_token" value="ABC123XYZ">
  <p>Search results for: <i>foo</i></p>
</html>
```

1. 공격자가 `?search=ABC` 로 요청 강제
   - 응답 body 에 `Search results for: ABC` + `csrf_token="ABC123XYZ"` 같이 포함
   - gzip 이 `ABC` 의 반복을 짧게 인코딩 → 응답 크기 ↓
2. `?search=ABD` (틀린 추측) → 반복 없음 → 응답 크기 그대로
3. 차이 관찰 → CSRF (Cross-Site Request Forgery, 사이트 간 요청 위조) 토큰 한 글자씩 복원

### TLS 위에서도 가능?

- TLS 는 평문을 못 보지만 **암호화된 길이는 그대로 노출** (TLS 1.3 도 마찬가지)
- 따라서 압축 후 길이가 사이드 채널이 됨

### 실제 위험도

- **이론적**: 가능. 발표 당시 PoC 시연됨
- **실전**: 다음 조건이 다 모여야 함
  - 사용자 입력이 응답 body 에 raw 로 들어감 (HTML/JSON 모두)
  - 같은 응답에 secret 존재
  - 공격자가 클라이언트의 네트워크 트래픽 (또는 응답 크기) 을 관찰 가능 (MITM)
  - 빠른 반복 호출 가능 (rate limit 없거나 우회)

## 3. 대응 패턴

### 3.1. 응답 분리 (정공)

같은 응답에 secret 과 user input 이 섞이지 않게:

```
❌ 안 좋음:
GET /api/me?search=foo
→ {"user":"tom", "csrfToken":"ABC", "results":["foo..."]}

✅ 좋음:
GET /api/me              → {"user":"tom", "csrfToken":"ABC"}
GET /api/search?q=foo    → {"results":["foo..."]}
```

→ **REST API 설계 차원의 해결**. 한 응답에 인증 토큰 + 사용자 echo 가 같이 있으면 위험 신호.

### 3.2. CSRF 토큰 형식 변경

```kotlin
// Synchronizer Token Pattern (BREACH 취약)
csrfToken = "ABC123XYZ"   // 매 응답에 같은 값

// Double Submit Cookie + masking
csrfTokenInResponse = mask(csrfToken, randomKey)  // 매번 다른 마스킹
csrfTokenInRequest  = unmask(csrfTokenInResponse)
```

→ 토큰이 응답마다 다르게 보이면 압축 차이 측정 무의미.

### 3.3. body 길이 무작위화

```
응답 끝에 길이 0~1024 의 random padding 추가
```

→ 통계적 공격 어렵게 만듦. 실용성 ↓ (네트워크 낭비).

### 3.4. 압축 비활성

```
민감 응답 path 만 압축 끄기
```

→ msa 라면 ingress annotation 으로:

```yaml
# 사용자 정보 / 인증 응답 ingress 별도 분리
metadata:
  annotations:
    nginx.ingress.kubernetes.io/configuration-snippet: |
      gzip off;
```

또는 응답 헤더로:

```kotlin
@RestController
@RequestMapping("/api/auth")
class AuthController {

    @GetMapping("/me")
    fun me(...): ResponseEntity<UserDto> = ResponseEntity.ok()
        .header("Cache-Control", "no-store, private")
        .header("X-Content-Type-Options", "nosniff")
        .body(...)
    // 추가로 ingress 단에서 이 path 만 gzip off
}
```

### 3.5. Rate limiting

BREACH 는 **수천~수만 번 추측** 이 필요. ingress/gateway 의 rate limiter 가 충분히 낮으면 실전 공격 어려움. msa 의 `RedisRateLimiter` (gateway) 가 이 역할.

### 3.6. Referer 검증 (제한적)

```kotlin
@GetMapping("/api/me")
fun me(@RequestHeader("Referer") referer: String?, ...) {
    if (referer != null && !referer.startsWith("https://example.com")) {
        // cross-origin 요청 거부 — BREACH 의 cross-origin 트리거 차단
    }
}
```

→ Referer 는 위조 가능 + 누락 가능 → 보조 수단.

## 4. 권장 정책 (msa)

| 응답 종류 | gzip | 추가 헤더 |
|---|---|---|
| 공개 카탈로그 (`/api/products`) | ◯ | `Cache-Control: public, max-age=60` |
| 검색 결과 (`/api/search`) — 사용자 입력 echo + 인증 | △ | 토큰 echo 없으면 ◯, 있으면 ✗ |
| 인증 정보 (`/api/auth/login`) | **✗** | `Cache-Control: no-store, private` |
| 사용자 본인 정보 (`/api/members/me`) | △ | XSRF 토큰 echo 없으면 ◯ |
| Order/Payment | △ | XSRF/CSRF 토큰 echo 없으면 ◯ |
| SSE | ✗ | (압축 자체 무의미) |

### ingress 분리 패턴

```yaml
# ingress-public.yaml — gzip on
metadata:
  name: gateway-public
  annotations:
    nginx.ingress.kubernetes.io/server-snippet: |
      gzip on;
spec:
  rules:
    - http:
        paths:
          - path: /api/products
          - path: /api/search

# ingress-private.yaml — gzip off
metadata:
  name: gateway-private
  annotations:
    nginx.ingress.kubernetes.io/configuration-snippet: |
      gzip off;
spec:
  rules:
    - http:
        paths:
          - path: /api/auth
          - path: /api/members
          - path: /api/orders
```

→ 운영 복잡도 ↑. **현 msa 규모에선** 사용자 입력 echo 가 거의 없으므로 **ingress 전체 gzip on + 필요시 path 별 disable** 도 충분.

## 5. 자주 헷갈리는 점

### 5.1. "그럼 모든 응답 압축 끌까?"

❌ 과도한 보수. BREACH 는 3 조건 모두 충족 시에만 가능. 응답 분리만 잘 되어 있으면 압축 켜도 안전.

### 5.2. "API JSON 응답에는 사용자 입력 echo 가 없으니 BREACH 안 통하나?"

대부분 그렇지만:

- `/api/search?q=foo` 의 응답에 `{"query":"foo","results":...}` 처럼 echo 흔함
- 같은 응답에 인증 정보가 함께 있으면 위험

→ **검색 결과 응답에 인증 토큰을 내려보내지 않는다** 가 BREACH 대응 1순위.

### 5.3. "TLS 1.3 이면 안전?"

❌ TLS 1.3 도 응답 크기는 노출. BREACH 는 TLS 버전 무관.

### 5.4. "HTTP/2 의 HPACK 도 압축인데 위험?"

이론적으론 같은 부류 공격(HEIST 등) 가능. 실전 사례 적고, HPACK 은 **헤더만** 압축 — body 는 별개. 충격 적음.

## 6. 면접 답변

### Q. BREACH 공격이 뭔가요?

> "HTTP 응답 body 에 (1) 공격자가 제어하는 입력이 echo 되고, (2) 같은 응답에 secret (CSRF 토큰 등) 이 함께 있고, (3) gzip 압축이 켜져 있을 때 가능한 사이드 채널 공격입니다. 추측한 입력이 secret 의 일부와 일치하면 압축 후 크기가 줄어드는 차이를 관찰해 secret 을 한 글자씩 복원하죠. TLS 가 평문을 가려도 암호화된 길이는 그대로 노출되니 TLS 1.3 에서도 유효합니다."

### Q. 대응책은?

> "정공은 응답 분리 — 인증 토큰을 사용자 입력이 echo 되는 응답에 함께 내려보내지 않는 겁니다. CSRF 토큰은 요청마다 다르게 마스킹하는 패턴(masked double-submit)으로 대체하고, 민감 path 만 ingress 단에서 압축 비활성합니다. msa 라면 ingress-nginx 의 location 별 `gzip off` 또는 path 분리 ingress 로 처리합니다. 추가로 rate limit 가 충분히 낮으면 BREACH 의 수천 번 추측이 실전에서 어려워지죠."

### Q. 응답 압축 자체를 다 끄는 건 어떤가요?

> "과한 보수입니다. BREACH 는 사용자 입력 echo + secret + 압축 셋 다 충족이라 응답 설계만 잘하면 압축 켜도 안전하고, JSON API 의 압축 효과 (보통 70-80% 절감) 를 포기하긴 아쉽죠. 위험 path 만 차단하고 나머지는 압축 유지하는 게 균형입니다."

## 다음 학습

- [17-msa-gateway-filter.md](17-msa-gateway-filter.md) — msa gateway 의 실제 Filter chain
- [18-msa-common-patterns.md](18-msa-common-patterns.md) — gzip 위치 결정 표준안
