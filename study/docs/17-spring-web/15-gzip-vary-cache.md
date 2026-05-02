---
parent: 17-spring-web
seq: 15
title: Accept-Encoding ↔ Vary ↔ 캐시 정합성
type: deep
created: 2026-05-01
---

# 15. Accept-Encoding ↔ Vary ↔ 캐시 정합성

> 압축을 켜면 같은 URL 이 두 가지 응답(압축 vs 비압축)을 만든다. CDN/proxy 캐시가 둘을 구분하지 못하면 **응답 오염** 이 발생.

## 1. 협상 메커니즘

### 요청 측 — `Accept-Encoding`

```http
GET /api/products HTTP/1.1
Host: api.example.com
Accept-Encoding: gzip, deflate, br;q=0.9, identity;q=0.5
```

- `gzip, deflate, br` — 받을 수 있는 인코딩 목록
- `q=` — quality value, 선호도 (0.0 ~ 1.0, 기본 1.0)
- `identity` — 압축 안 함. `q=0` 이면 비압축 거부
- `*` — 모든 인코딩 가능 (와일드카드)

### 응답 측 — `Content-Encoding` + `Vary`

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Encoding: gzip
Vary: Accept-Encoding
Content-Length: 1234

[gzipped bytes]
```

- `Content-Encoding` — 어떻게 압축됐는지
- `Vary: Accept-Encoding` — **이 응답은 Accept-Encoding 값에 따라 달라진다** 라고 캐시에 알림

## 2. `Vary` 가 누락되면? — 캐시 오염

### 시나리오

```
1. 사용자 A: Accept-Encoding: gzip
   → 백엔드 응답 gzip 압축
   → CDN 캐시: { url: /api/products, body: <gzip bytes> }
   → 사용자 A 정상

2. 사용자 B: Accept-Encoding: identity (압축 거부, 옛 클라이언트)
   → CDN: 캐시 hit → 같은 gzip body 그대로 반환
   → 사용자 B: Content-Encoding 헤더 없는데 본문은 gzip → 깨진 JSON
```

### `Vary: Accept-Encoding` 추가 후

```
1. 사용자 A: Accept-Encoding: gzip
   → CDN 캐시 키: { url: /api/products, vary[Accept-Encoding]: "gzip" }
2. 사용자 B: Accept-Encoding: identity
   → CDN 캐시 키: { url: /api/products, vary[Accept-Encoding]: "identity" }
   → 캐시 miss → origin 으로 → 비압축 응답 받음 → 사용자 B 정상
```

### 정확히는 정규화가 필요

CDN 마다 `Vary` 처리 방식이 다름:

| 입력 | CDN A | CDN B |
|---|---|---|
| `Accept-Encoding: gzip, deflate` | "gzip,deflate" 키 | "gzip" 키 (정규화) |
| `Accept-Encoding: deflate, gzip` | "deflate,gzip" 키 (다른 키) | "gzip" 키 (정규화) |

→ CloudFront 는 자동 정규화, Nginx 는 직접 처리. **Nginx 의 `gzip_vary on` 은 Vary 헤더 추가만 — 정규화는 별도**.

## 3. CDN 의 캐시 키 동작

### CloudFront

```
Behaviors → Cache Key and Origin Requests
  Cache key settings:
    Headers: Include "Accept-Encoding" → CloudFront 가 4가지 변형으로 정규화
              (gzip, brotli, gzip+brotli, none)
```

### Nginx (origin server)

```nginx
gzip on;
gzip_vary on;            # Vary: Accept-Encoding 추가
gzip_types application/json;
```

### Cloudflare

```
Speed → Optimization → Auto Minify (자동)
또는 Page Rule 로 강제
```

## 4. `Vary` 의 다른 용례

같은 URL 이 헤더 따라 응답이 다른 모든 케이스에 사용:

| 시나리오 | Vary 값 |
|---|---|
| 모바일/데스크톱 다른 응답 | `Vary: User-Agent` (조심 — 캐시 효율 떨어짐) |
| 언어별 응답 | `Vary: Accept-Language` |
| 인증 사용자별 응답 | `Vary: Authorization` (사실상 캐시 안 됨) |
| API 버전 헤더 | `Vary: X-Api-Version` |

→ `Vary` 가 늘수록 캐시 키 다양성 ↑ → 캐시 hit rate ↓. **꼭 필요한 것만**.

## 5. msa 의 결정 — gateway 응답이 캐시되는가?

| 요청 | 캐시 가능? | 근거 |
|---|---|---|
| `/api/products` (공개) | ◯ | Authorization 없음 → CDN 캐시 가능 |
| `/api/products` (Bearer 토큰 있음) | ✗ | `Authorization` 헤더 있음 → 사용자별 |
| `/api/orders/me` | ✗ | 명백히 사용자별 |
| `/api/products/123/reviews` (공개) | ◯ | 동일 |

→ msa 의 **공개 카탈로그 API** 만 CDN 후보. 인증 필요 응답은 CDN 캐시 안 함 → `Cache-Control: private, no-store` 권장.

## 6. `Cache-Control` 과의 관계

| 헤더 | 효과 |
|---|---|
| `Cache-Control: public, max-age=300` | 어디서나 5분 캐시 |
| `Cache-Control: private, max-age=60` | 브라우저만 1분 (CDN/proxy 안 함) |
| `Cache-Control: no-store` | 어디도 캐시 금지 (민감 응답) |
| `Cache-Control: no-cache` | 캐시는 가능하되 매번 검증 (`If-None-Match`) |

`Vary` + `Cache-Control` 조합:

```
Cache-Control: public, max-age=300
Vary: Accept-Encoding
```

→ 5분간 인코딩별로 별도 캐시 보유. 가장 흔한 정적 자산 패턴.

## 7. ETag / If-None-Match 와의 상호작용

```
1차:
GET /api/products
Accept-Encoding: gzip
→ 200 OK, ETag: "abc", Content-Encoding: gzip

2차:
GET /api/products
Accept-Encoding: gzip
If-None-Match: "abc"
→ 304 Not Modified (body 없음)
```

⚠️ `ETag` 가 압축 전 본문 기준인지 압축 후 기준인지 합의 필요. RFC 7232 는 "동일 표현이면 동일 ETag". Nginx 는 압축 시 weak ETag (`W/"abc"`) 자동 변환.

## 8. 흔한 함정 5

### 8.1. Vary 누락

```
Content-Encoding: gzip
[Vary 없음]
```

→ 캐시 오염. 모든 압축 응답에 `Vary: Accept-Encoding` 필수.

### 8.2. `Accept-Encoding: *` 의 함정

일부 클라이언트가 모든 인코딩을 받을 수 있다고 거짓말 (실제론 못 함). 일반적으로 무시해도 되지만, 옛 IE 6 에선 `gzip` 응답 받고 못 풀어 깨짐.

### 8.3. SSE / WebSocket 압축

```
Content-Type: text/event-stream
Content-Encoding: gzip   # ❌
```

→ SSE 는 한 줄씩 push 인데 gzip 은 buffer 단위 압축이라 latency ↑. ingress 의 `gzip_types` 에서 `text/event-stream` 빼야 함.

### 8.4. Nginx + Spring 둘 다 켜기

```
Nginx: gzip on
Spring: server.compression.enabled=true
```

→ 결과: Spring 이 먼저 gzip → Nginx 가 `Content-Encoding: gzip` 인 응답을 그대로 통과 (Nginx 가 이중 압축 안 함). 동작은 OK 지만 **CPU 두 번** 으로 의미 없음. 이런 실수 방지를 위해 **한 곳만**.

### 8.5. 인증 응답에 압축 + CDN 캐시

```
Authorization: Bearer abc
Accept-Encoding: gzip
→ 압축된 사용자별 응답
→ Vary: Accept-Encoding 만 있으면 사용자 무관하게 캐시 → 다른 사용자에게 노출
```

→ 사용자별 응답엔 `Cache-Control: private, no-store` 또는 `Vary: Authorization` 명시. CDN 설정도 같이.

## 9. msa 적용 안

ingress-nginx 의 ConfigMap (Helm values 권장):

```yaml
controller:
  config:
    use-gzip: "true"
    gzip-level: "6"
    gzip-min-length: "1024"
    gzip-types: "application/json text/plain application/xml application/javascript text/css"
    # gzip-vary 는 nginx 가 자동 추가
```

추가로:

- 인증 필요 API (`/api/orders/**`, `/api/members/me/**`) → `Cache-Control: private, no-store` 를 응답에 추가 (Spring `@RestController` 단위)
- 공개 카탈로그 (`/api/products`) → `Cache-Control: public, max-age=60` + `Vary: Accept-Encoding`
- SSE 라우트 (`/api/v1/strategies/*/paper/sse`) → ingress annotation 으로 압축 disable

```yaml
# 특정 ingress 만 압축 끄기
nginx.ingress.kubernetes.io/configuration-snippet: |
  gzip off;
```

## 10. 면접 답변

### Q. Vary 헤더는 왜 필요한가요?

> "같은 URL 이 요청 헤더에 따라 다른 응답을 만들면 캐시가 어느 응답을 보관해야 할지 알아야 합니다. `Vary: Accept-Encoding` 은 '이 응답은 Accept-Encoding 값에 따라 달라진다' 를 캐시에 알리는 헤더로, gzip 응답이 비압축을 기대한 클라이언트에게 잘못 전달되는 캐시 오염을 막아줍니다. CDN/proxy 모두 Vary 를 캐시 키에 포함시키죠. 누락하면 옛 클라이언트가 깨진 응답을 받습니다."

### Q. Vary 를 너무 많이 두면?

> "캐시 키 다양성이 커져 hit rate 가 떨어집니다. 같은 URL 이 User-Agent, Accept-Language, Accept-Encoding 다 다르면 사용자마다 별도 캐시 라인이 만들어져 캐시 의미가 사라지죠. `Vary: Accept-Encoding` 처럼 정규화 가능한 값만 두고, 사용자별 응답은 아예 `Cache-Control: private, no-store` 로 캐시 자체를 막는 게 정공입니다."

### Q. SSE 응답에도 압축이 적용되나요?

> "ingress-nginx 의 `gzip_types` 에 `text/event-stream` 이 없으면 자동 제외됩니다. 만약 들어가있으면 압축 buffer 가 차야 flush 되니 SSE 의 push latency 가 망가집니다. msa 의 quant paper SSE 처럼 long-lived 라우트는 ingress annotation 으로 명시적 disable 하는 게 안전합니다."

## 다음 학습

- [16-gzip-breach.md](16-gzip-breach.md) — 압축의 진짜 위험: BREACH 공격
- [18-msa-common-patterns.md](18-msa-common-patterns.md) — msa 의 ingress 압축 결정안
