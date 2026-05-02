---
parent: 17-spring-web
seq: 14
title: HTTP 압축 layer 선택 + 알고리즘 비교
type: deep
created: 2026-05-01
---

# 14. HTTP 압축 layer 선택 + 알고리즘 비교

> 면접 단골: **"HTTP gzip 을 어디서 켜는 게 맞나요? 늘 켜야 하나요?"**

## 1. 압축 가능 위치 — 전체 옵션

```
[Client] ←─ Internet ─→ [① CDN] ─→ [② Reverse Proxy / Ingress] ─→ [③ Servlet Container] ─→ [④ Spring App]
```

| 위치 | 가능 도구 | 활성 방법 |
|---|---|---|
| ① CDN | CloudFront / Cloudflare / Fastly | 콘솔 설정 — 자동 |
| ② Reverse Proxy / Ingress | Nginx / Envoy / HAProxy / ingress-nginx | `gzip on` 또는 annotation |
| ③ Servlet Container | Tomcat / Reactor Netty | `server.compression.enabled` |
| ④ Spring App | `Filter` 직접 구현 / `OncePerRequestFilter` | 커스텀 |

→ **여러 곳에서 켜면 안 되고 한 곳만** 선택하는 게 정공.

## 2. 결정 기준

| 기준 | ① CDN | ② Reverse Proxy | ③ Tomcat | ④ App |
|---|---|---|---|---|
| 클라이언트와 가까움 | 최고 | 매우 가까움 | 가까움 | 거리 동일 |
| CPU 비용 (앱 부담) | 0 | 0 | 앱 노드 부담 | 앱 노드 부담 |
| TLS terminate 위치와 일치 | 자주 다름 | 보통 일치 | 다름 | 다름 |
| 운영 단순함 | 콘솔 한 줄 | 한 곳 설정 | 서비스마다 켬 | 서비스마다 코드 |
| BREACH 위험 (TLS+압축) | 클라이언트 가까울수록 노출 | 동일 | 동일 | 동일 |
| 동적 vs 정적 컨텐츠 분리 | CDN 가 정적 | Proxy 가 둘 다 | App 만 | App 만 |
| msa 적용 적합성 | (CDN 도입 시) | **◯ 1순위** | △ | ✗ |

### 표준 결정: **② Reverse Proxy (Ingress) 에서 한다**

이유:

- 앱 노드 CPU 절감 — 같은 응답을 여러 백엔드 인스턴스가 압축할 필요 없음
- Ingress 가 TLS 종단이라 `Vary: Accept-Encoding` 같은 캐시 정책도 한 곳에서 관리
- Spring Boot 코드 변경 없음 — 인프라 결정으로 가능

## 3. msa 의 현재 상태

```bash
# grep 결과
- spring.jackson / server.compression: 없음
- ingress-nginx 의 압축 annotation: 없음
- Spring Cloud Gateway 의 GzipMessageBodyResolver: 없음
```

→ **현재 msa 응답에는 압축이 적용되지 않음**. JSON 응답이 작으면 (수 KB) 영향 미미하지만, 카탈로그 검색/리스트 응답이 수십 KB 규모면 네트워크 체감 차이 발생.

## 4. 알고리즘 비교

| 알고리즘 | RFC | 인코딩 명 | 압축률 | CPU | 브라우저 지원 |
|---|---|---|---|---|---|
| **gzip** (DEFLATE + 헤더) | RFC 1952 | `gzip` | 70-80% (JSON 기준) | 낮음 | 100% |
| **deflate** (raw DEFLATE) | RFC 1951 | `deflate` | 동일 | 동일 | 99% (구현 차이 가끔 문제) |
| **brotli** | RFC 7932 | `br` | 80-85% | 중간 | 모던 브라우저 100% (TLS 위에서만) |
| **zstd** | RFC 8478 | `zstd` | 75-85% | 매우 낮음 | 점차 확산 (Chrome 123+) |

### 압축률 vs CPU trade-off (JSON ~10KB 기준 대략)

```
gzip level 1:    압축률 ~65%, CPU ~20μs/KB
gzip level 6:    압축률 ~75%, CPU ~80μs/KB     (default)
gzip level 9:    압축률 ~76%, CPU ~200μs/KB    (압축률 미세 ↑, CPU ×2.5)
brotli level 4:  압축률 ~75%, CPU ~70μs/KB
brotli level 11: 압축률 ~85%, CPU ~수ms/KB     (CDN 정적 자산용)
zstd level 3:    압축률 ~70%, CPU ~15μs/KB     (압축률 vs CPU 균형 우수)
```

### 권장 선택

| 시나리오 | 알고리즘 |
|---|---|
| 동적 API 응답 | **gzip level 6** (compatibility 최고) 또는 zstd (지원 환경에서) |
| CDN 정적 자산 | brotli level 11 (한 번 압축 → 영구 캐시) |
| HTTP/2 + 모던 브라우저만 | brotli level 4 (gzip 보다 압축률 ↑) |
| 내부 service-to-service | **압축 안 함** (CPU 비용 > 네트워크 비용) |

## 5. 압축 안 해야 할 응답

| 컨텐츠 | 이유 |
|---|---|
| 이미지 (`image/jpeg`, `image/png`, `image/webp`) | 이미 압축됨 — 재압축 효과 음수 (오버헤드) |
| 비디오/오디오 (`video/mp4`, `audio/mpeg`) | 이미 압축됨 |
| 미리 gzip 된 응답 (`application/x-gzip`, gzipped CSV) | 이중 처리 |
| 작은 응답 (< 1KB) | 헤더 오버헤드 + CPU > 절감량 |
| Server-Sent Events / WebSocket | 스트리밍 + 점진적 전송 — 압축 buffering 이 latency ↑ |
| 민감 정보 + 사용자 입력 echo | **BREACH 공격 위험** ([16](16-gzip-breach.md)) |

## 6. 활성화 코드 — 4가지 위치별

### 6.1. Tomcat (Spring Boot)

```yaml
# application.yml
server:
  compression:
    enabled: true
    mime-types: application/json,application/xml,text/plain,text/html,text/css,application/javascript
    min-response-size: 1024              # 1KB 이상만
```

→ 서비스마다 yml 한 줄. 유지보수 약점: 서비스마다 다르게 설정될 위험.

### 6.2. ingress-nginx (annotation)

```yaml
# k8s/base/gateway/ingress.yaml 에 추가
metadata:
  annotations:
    nginx.ingress.kubernetes.io/server-snippet: |
      gzip on;
      gzip_types application/json text/plain application/xml application/javascript;
      gzip_min_length 1024;
      gzip_comp_level 6;
      gzip_vary on;
```

또는 controller 전체 ConfigMap 에서 일괄 (권장):

```yaml
# k8s/infra/local/ingress-nginx/values.yaml (Helm)
controller:
  config:
    use-gzip: "true"
    gzip-level: "6"
    gzip-min-length: "1024"
    gzip-types: "application/json text/plain application/xml application/javascript"
```

→ **msa 표준**. ingress-nginx 가 모든 응답을 거치니 한 곳 설정으로 끝.

### 6.3. Spring Cloud Gateway (gateway 만)

gateway 는 WebFlux 라 `server.compression.enabled` 가 동작 안 함. Reactor Netty 의 `compression(true)` 옵션이 별도:

```yaml
spring:
  cloud:
    gateway:
      httpserver:
        wiretap: false
      httpclient:
        compression: true   # downstream 으로 보내는 요청 압축
  # 응답 압축은 Reactor Netty 빈 커스터마이저로
```

→ 보통 이건 안 켬. ingress-nginx 가 응답 압축을 책임지면 gateway 는 raw 그대로 통과.

### 6.4. CDN (CloudFront 예시)

```
Behaviors → Compress objects automatically: Yes
```

→ HTTP/2 환경에선 brotli + gzip 자동 협상.

## 7. 압축 협상 — `Accept-Encoding` 흐름

```
Request:
GET /api/products HTTP/1.1
Accept-Encoding: gzip, deflate, br;q=0.9

Response:
HTTP/1.1 200 OK
Content-Type: application/json
Content-Encoding: gzip               ← 어떤 알고리즘으로 압축했는지
Vary: Accept-Encoding                ← 캐시 정합성 헤더
Content-Length: 1234                 ← 압축된 크기

[gzipped body]
```

상세는 [15](15-gzip-vary-cache.md).

## 8. 측정

### 압축 효과

```bash
# 압축 안 됨
curl -s https://api.example.com/api/products | wc -c
# 50000

# 압축 적용
curl -s -H "Accept-Encoding: gzip" https://api.example.com/api/products | wc -c
# 8000   (84% 절감)

# 응답 검증
curl -s -I -H "Accept-Encoding: gzip" https://api.example.com/api/products
# Content-Encoding: gzip
# Vary: Accept-Encoding
```

### CPU 영향

```bash
# nginx 사이트별 CPU 사용 — Prometheus
nginx_ingress_controller_request_duration_seconds  # latency 변화
container_cpu_usage_seconds_total{pod=~"ingress-nginx-controller.*"}  # CPU

# Spring 사이드 — micrometer
http.server.requests.duration  # 압축 전후 비교
```

## 9. 면접 답변

### Q1. HTTP gzip 을 어디서 켜는 게 맞나요?

> "표준은 reverse proxy/ingress 한 곳입니다. msa 라면 ingress-nginx 의 `use-gzip: true` 한 줄로 모든 백엔드 응답에 일괄 적용되니, Spring Boot 의 `server.compression.enabled` 를 서비스마다 따로 켤 필요가 없습니다. 앱 노드 CPU 부담을 인프라로 외주 보내는 효과도 있고요. CDN 까지 있으면 거기서 한 번 더 처리하지만 일반적으로 origin 응답 압축과 CDN 압축이 충돌하지 않게 한쪽만 켭니다."

### Q2. 늘 켜야 하나요?

> "아닙니다. 이미 압축된 컨텐츠 (이미지/비디오), 작은 응답(<1KB), SSE/WebSocket 같은 스트리밍, 그리고 가장 중요한 BREACH 공격 위험이 있는 응답(인증 토큰을 body 에 echo 하는 등) 은 압축에서 제외해야 합니다. ingress-nginx 의 `gzip_types` 로 application/json, text/* 만 한정하고, 민감 응답 path 는 별도 annotation 으로 비활성하는 게 표준입니다."

### Q3. gzip vs brotli vs zstd?

> "동적 응답은 gzip level 6 이 호환성과 비용의 균형이 가장 좋고, 정적 자산을 CDN 에 올릴 땐 brotli level 11 로 한 번 압축해 영구 캐시합니다. zstd 는 압축률과 CPU 모두 우수하지만 브라우저 지원이 아직 확산 중이라 fallback 필요. 결정은 운영 환경의 클라이언트 분포로 합니다."

## 다음 학습

- [15-gzip-vary-cache.md](15-gzip-vary-cache.md) — Accept-Encoding ↔ Vary ↔ 캐시
- [16-gzip-breach.md](16-gzip-breach.md) — 압축 + TLS 의 사이드 채널 공격
