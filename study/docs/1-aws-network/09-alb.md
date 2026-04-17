---
parent: 1-aws-network
subtopic: alb
index: 09
created: 2026-04-16
level: deep
---

# Application Load Balancer (ALB) — Deep Study

## 1. 재확인

ALB 는 HTTP/HTTPS 트래픽을 **L7 (애플리케이션 계층)** 에서 경로/호스트/헤더/쿼리스트링 기반으로 라우팅하는 로드밸런서. msa 프로젝트의 ingress-nginx 와 유사한 역할.

## 2. 내부 메커니즘

### 2.1 구성 요소 관계

```
ALB
 ├── Listener (포트 + 프로토콜, 예: 443 HTTPS)
 │   ├── Rule 1 (condition: path /api/*)  → Target Group A
 │   ├── Rule 2 (condition: host api.*)   → Target Group B
 │   └── Default Rule                     → Target Group C
 └── Target Group
     ├── Targets (EC2, IP, Lambda, ECS)
     └── Health Check
```

### 2.2 요청 흐름 (step-by-step)

1. Client → DNS resolve → ALB DNS 이름 → 여러 AZ 의 ALB 노드 IP
2. ALB 노드가 TLS 종료 (HTTPS listener 면)
3. Listener Rule 매칭 (우선순위 낮은 번호부터)
4. 매칭된 Rule 의 Target Group 선택
5. Target Group 의 Health Check 통과한 Target 중 선택 (LB 알고리즘)
6. Target 으로 HTTP 요청 전달 (내부 네트워크)
7. Target 응답 → ALB → Client

### 2.3 Listener Rule 조건

- Path: `/api/*`, `/images/*`
- Host header: `api.example.com`
- HTTP header: `X-Mobile: true`
- Query string: `?version=v2`
- Source IP: `203.0.113.0/24`
- HTTP method: `POST`

### 2.4 Target Types

| 타입 | 설명 | 용도 |
|---|---|---|
| `instance` | EC2 인스턴스 ID | 클래식 EC2 |
| `ip` | 프라이빗 IP | EKS Pod, Fargate, 온프레미스 (VPN/DX) |
| `lambda` | Lambda 함수 | Serverless |

EKS 에서 AWS Load Balancer Controller 는 기본 `ip` 타입 (Pod IP 직접 타겟).

### 2.5 LB 알고리즘

- **Round Robin** (기본)
- **Least Outstanding Requests** — 진행 중 요청 적은 타겟 우선

### 2.6 Health Check

- 주기적으로 타겟에 HTTP 요청 (기본 30초 간격)
- 경로 / 상태 코드 / 응답 시간으로 healthy 판정
- Unhealthy 타겟은 자동 제외

### 2.7 연결 유지 (Keep-alive)

- ALB ↔ Client: HTTP/2 + keep-alive
- ALB ↔ Target: HTTP/1.1 기본 + keep-alive
- **Idle timeout**: 기본 60초, 최대 4000초

## 3. 설계 결정과 트레이드오프

### 3.1 ALB vs NLB vs CloudFront

| | ALB | NLB | CloudFront |
|---|---|---|---|
| 레이어 | L7 | L4 | L7 (edge) |
| 라우팅 | URL/Host/Header | IP+Port | URL + 캐싱 |
| 지연 | ms | μs | edge cache hit 시 μs |
| 고정 IP | 불가 | 가능 | 불가 |
| WAF | ALB 직접 attach | CloudFront 경유 | 직접 attach |
| TLS 종료 | O | passthrough 가능 | O |
| 비용 | 시간당 + LCU | 시간당 + NLCU | 요청 + 데이터 + 리전별 |

### 3.2 여러 서비스를 하나의 ALB 에 몰기

```
Single ALB:
  /api/product/*  → product-tg
  /api/order/*    → order-tg
  /api/search/*   → search-tg
```

**장점**: 비용 절감 (ALB 시간당 $0.022 → 1개로 여러 서비스)
**단점**: 단일 장애점, 배포/설정 격리 약화

**권장**: 환경별 (prod/stg) 로는 분리, 환경 내 마이크로서비스는 공유.

### 3.3 Idle Timeout 설정

- 장시간 WebSocket: 4000초까지 상향 또는 keep-alive 주기 < 60초
- 짧은 API: 기본 60초 유지
- **모바일 앱** 백그라운드: keep-alive ping 없으면 끊김 → 앱 측 재연결 로직 필요

### 3.4 Cross-Zone Load Balancing

- 기본 **활성화** — 모든 AZ 의 타겟에 균등 분배
- 비활성화 시: 같은 AZ 타겟 우선 → Cross-AZ 비용 절감
- 트레이드오프: 부하 균등성 저하

## 4. 실제 코드/msa 연결

### 4.1 msa 현재 구조

- `k8s/base/gateway/ingress.yaml` — ingress-nginx Ingress
- EKS 이전 시 이 Ingress 가 자동으로 ALB 로 프로비저닝됨 (AWS Load Balancer Controller)

### 4.2 AWS Load Balancer Controller 기반 Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gateway-ingress
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:...
    alb.ingress.kubernetes.io/wafv2-acl-arn: arn:aws:wafv2:...
spec:
  rules:
  - host: api.commerce.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: gateway
            port:
              number: 8080
```

AWS LB Controller 가 이 리소스를 감지 → ALB + Target Group + Listener Rule 자동 생성.

### 4.3 Terraform ALB (EKS 직접 관리 아닐 때)

```hcl
resource "aws_lb" "this" {
  name               = "commerce-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  idle_timeout = 300   # WebSocket 대비 상향
  enable_http2 = true
}

resource "aws_lb_target_group" "gateway" {
  name     = "gateway-tg"
  port     = 8080
  protocol = "HTTP"
  vpc_id   = aws_vpc.this.id
  target_type = "ip"

  health_check {
    path                = "/actuator/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  deregistration_delay = 30  # Pod 제거 시 대기 시간
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = aws_acm_certificate.this.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.gateway.arn
  }
}
```

### 4.4 Path 기반 라우팅 (여러 서비스 공유)

```hcl
resource "aws_lb_listener_rule" "product" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  condition {
    path_pattern {
      values = ["/api/product/*"]
    }
  }
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.product.arn
  }
}
```

## 5. 장애 시나리오 3개

### 시나리오 1: "Health Check 실패로 504"

**증상**: 배포 후 일부 Pod 에서 504 Gateway Timeout 발생.

**진단**:
1. Target Group 에서 해당 Pod `unhealthy` 상태
2. Health Check path `/actuator/health` 가 Spring Boot 애플리케이션 시작 전에 호출됨
3. Readiness Probe 는 통과했지만 실제 로직 초기화 중

**해결**:
- Spring Boot: `management.endpoint.health.probes.enabled=true` + `liveness`/`readiness` 분리
- Target Group `healthy_threshold` 조정 (초기 대기 시간 연장)
- Pod `startupProbe` 명시

### 시나리오 2: "WebSocket 연결이 60초 후 끊김"

**증상**: 채팅 앱 WebSocket 연결이 60초 후 자동 끊김.

**진단**: ALB idle timeout 기본 60초. 클라이언트 측 keep-alive ping 없음.

**해결**:
- ALB `idle_timeout=300` 또는 `4000`
- 클라이언트에서 20-30초마다 ping 전송
- NLB 로 전환 (Connection 기반 더 유연)

### 시나리오 3: "HTTPS Listener 에 ACM 인증서가 반영 안 됨"

**증상**: 새 도메인 추가, ACM 인증서 발급 완료, ALB 에 적용했는데 브라우저가 "Certificate not valid" 경고.

**진단**:
1. ACM 인증서 상태 `ISSUED` 확인
2. SAN (Subject Alternative Name) 에 해당 도메인 포함 확인
3. Listener 의 certificate_arn 이 올바른 ACM 인증서 가리키는지 확인
4. Route 53 A/Alias 레코드가 올바른 ALB 로 가는지 확인

**해결**: SNI (Server Name Indication) 기반으로 여러 인증서 매핑 가능. Listener 에 기본 인증서 외 추가 인증서 가능.

## 6. 면접 꼬리 질문 트리

```
Q9: ALB 가 뭐고 어떻게 동작하나요?
├── Q9-1: ALB 와 NLB 의 차이는 뭔가요?
│   └── Q9-1-1: 각각 어떤 상황에 쓰나요?
│       └── Q9-1-1-1: 두 가지를 조합해서 쓰는 패턴도 있나요?
├── Q9-2: ALB 뒤에 WAF 를 왜 붙이나요?
│   └── Q9-2-1: Managed Rules vs 자체 Rules?
└── Q9-3: ALB Health Check 는 실제로 뭘 검증하나요?
    └── Q9-3-1: Spring Boot 의 /actuator/health 와 ALB Health Check 관계는?
        └── Q9-3-1-1: Liveness 와 Readiness 분리가 왜 중요한가요?
```

**Q9 답변**: L7 로드밸런서. HTTP Listener 와 Rule 로 경로/호스트/헤더 기반 라우팅. Target Group 이 실제 백엔드 (EC2/Pod/Lambda) 를 묶고 Health Check 를 관리. EKS 에서는 AWS LB Controller 가 Ingress 리소스로부터 자동 프로비저닝.

**Q9-1-1-1 답변**: Outer NLB + Inner ALB. NLB 로 고정 IP 제공 (파트너 allow-list) + ALB 로 L7 경로 분기. 비용은 늘지만 두 장점 모두.

**Q9-2-1 답변**: Managed Rules (AWSManagedRulesCommonRuleSet) 는 SQLi/XSS/bot 등 AWS 가 관리하는 규칙 셋, 즉시 적용. 자체 Rules 는 서비스 특성에 맞춘 세밀 제어 (특정 API 경로 rate limit, GeoIP 차단 등).

**Q9-3-1-1 답변**: Liveness 실패 → Pod 재시작, Readiness 실패 → 트래픽만 제외 (Pod 유지). DB 연결 끊김 같은 일시 장애에 Liveness 가 트리거되면 무의미한 재시작 반복. Readiness 로 분리해야 복구 가능.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "ALB 는 고정 IP 를 지원" | 불가. DNS 기반만. 고정 IP 는 NLB |
| "ALB 에 EIP 연결" | 불가 |
| "ALB 는 TCP 도 지원" | **HTTP/HTTPS 만** |
| "Health Check 실패 = Pod 죽음" | Target Group 에서 제외만. Pod 은 살아있음 |
| "Cross-Zone LB 가 기본 비활성" | **기본 활성** (ALB), NLB 는 기본 비활성 |
| "WAF 는 ALB 에만 붙음" | CloudFront, API Gateway, AppSync 에도 가능 |

## 8. 자가 점검 체크리스트

- [ ] Listener / Rule / Target Group 관계 즉답
- [ ] Target Type 3가지 (instance/ip/lambda) 구분
- [ ] EKS 의 AWS LB Controller 동작 이해
- [ ] ALB ↔ NLB ↔ CloudFront 비교 표 답변 가능
- [ ] Idle Timeout 기본값 (60초) 과 조정 필요 상황
- [ ] WAF Managed Rules 활용 이해
- [ ] SNI 기반 다중 인증서 이해
- [ ] Liveness vs Readiness Probe 차이
- [ ] Cross-Zone LB ALB 기본 활성 vs NLB 기본 비활성
- [ ] Path 기반 vs Host 기반 라우팅 구분

## 9. 참고 자료

- AWS ALB 공식 문서
- AWS Load Balancer Controller (EKS) 공식 문서
- Spring Boot Actuator Health Probes
- AWS WAF Managed Rules 목록
