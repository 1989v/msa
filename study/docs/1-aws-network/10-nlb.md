---
parent: 1-aws-network
subtopic: nlb
index: 10
created: 2026-04-16
level: deep
---

# Network Load Balancer (NLB) — Deep Study

## 1. 재확인

NLB 는 TCP/UDP/TLS 트래픽을 **L4 (전송 계층)** 에서 라우팅. 내용을 보지 않고 IP+Port 만 본다. 초저지연 (μs) + 초고처리량 (수백만 rps) + **고정 IP** + **클라이언트 IP 보존**이 핵심 차별점.

## 2. 내부 메커니즘

### 2.1 L4 동작의 의미

- HTTP 헤더/경로/쿼리 무시 → 내용 파싱 비용 없음
- TCP/UDP 연결 단위 라우팅
- 지연이 ALB 대비 10-100배 낮음 (수십~수백 μs)

### 2.2 고정 IP 제공

- **AZ 별 1개 IP** 할당 (ALB 와 다른 핵심 특징)
- EIP 연결 가능 → 외부 화이트리스트 등록 용이
- 2 AZ → 2개 IP, 3 AZ → 3개 IP

### 2.3 클라이언트 IP 보존

- 기본 동작: **Source IP 가 그대로 타겟에 전달**
- 타겟 서버가 `request.getRemoteAddr()` 에서 실제 클라이언트 IP 확인 가능
- ALB 는 `X-Forwarded-For` 헤더로만 전달

### 2.4 Preserve Client IP 모드

- Target Type 에 따라 동작 다름:
  - `instance`: 항상 보존
  - `ip`: preserve_client_ip 옵션 (EKS 에서 주의 필요)
- Docker/K8s 환경에서는 SG/iptables 가 클라이언트 IP 를 이해해야 함

### 2.5 처리량

- 초당 수백만 rps, 수십 Gbps
- 수평 확장 자동 (AZ 별 확장)

### 2.6 Health Check

- TCP (단순 포트 연결), HTTP (ALB 와 같은 방식), HTTPS
- TCP Health Check 는 "포트 열려있음" 만 검증 → 애플리케이션 상태는 확인 못 함
- 실무에서는 HTTP Health Check 권장

## 3. 설계 결정과 트레이드오프

### 3.1 언제 NLB?

| 요구사항 | 이유 |
|---|---|
| 고정 IP 필수 (파트너 allow-list) | ALB 는 DNS 기반 |
| TCP/UDP (HTTP 아님) | ALB 는 HTTP 전용 |
| 초저지연 (게임/금융) | 수십 μs |
| 클라이언트 IP 보존 | 헤더가 아닌 실제 IP |
| 매우 높은 처리량 | 수백만 rps |
| TLS Passthrough | 백엔드에서 TLS 처리 필요 시 |

### 3.2 NLB + ALB 조합 패턴

```
[Internet] → [NLB (고정 IP × N AZ)] → [ALB] → [Target]
                      ↑ 파트너 allow-list
                                          ↑ L7 라우팅
```

**비용**: NLB + ALB 둘 다 과금 (~2배)
**이점**: 고정 IP + L7 라우팅 동시 확보

### 3.3 WAF 와의 관계

- WAF 는 L7 → NLB 에 직접 attach 불가
- 해결: **CloudFront + WAF → NLB → Target**

### 3.4 WebSocket / gRPC

- NLB: TCP 기반이라 자동 지원, 긴 연결에 유리 (idle timeout 관대)
- ALB: 지원하지만 idle timeout 60초 기본 (조정 필요)

## 4. 실제 코드/msa 연결

### 4.1 Terraform NLB

```hcl
resource "aws_eip" "nlb" {
  count  = 2  # 2 AZ
  domain = "vpc"
}

resource "aws_lb" "nlb" {
  name               = "commerce-nlb"
  internal           = false
  load_balancer_type = "network"

  dynamic "subnet_mapping" {
    for_each = aws_subnet.public
    content {
      subnet_id     = subnet_mapping.value.id
      allocation_id = aws_eip.nlb[subnet_mapping.key].id
    }
  }

  enable_cross_zone_load_balancing = false  # NLB 는 기본 비활성
}

resource "aws_lb_target_group" "tcp" {
  name        = "tcp-tg"
  port        = 8080
  protocol    = "TCP"
  vpc_id      = aws_vpc.this.id
  target_type = "ip"

  health_check {
    protocol            = "HTTP"   # HTTP 로 health 체크
    path                = "/actuator/health"
    port                = "8080"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
  }
}

resource "aws_lb_listener" "tcp" {
  load_balancer_arn = aws_lb.nlb.arn
  port              = 443
  protocol          = "TLS"
  certificate_arn   = aws_acm_certificate.this.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tcp.arn
  }
}
```

### 4.2 EKS Service Type LoadBalancer + NLB

```yaml
apiVersion: v1
kind: Service
metadata:
  name: payment-nlb
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: nlb
    service.beta.kubernetes.io/aws-load-balancer-eip-allocations: eipalloc-xxx,eipalloc-yyy
    service.beta.kubernetes.io/aws-load-balancer-scheme: internet-facing
spec:
  type: LoadBalancer
  ports:
  - port: 443
    targetPort: 8080
  selector:
    app: payment
```

### 4.3 msa 프로젝트 관점

- 현재 msa 는 모든 트래픽이 ingress-nginx (ALB 대응) 경유
- 파트너 연동 발생 시 NLB 추가 경로 구성
- 예: 외부 결제사 webhook, 파트너 API 연동 → NLB + EIP 로 분리

## 5. 장애 시나리오 3개

### 시나리오 1: "클라이언트 IP 가 `0.0.0.0` 으로 찍힘"

**증상**: 로그에서 클라이언트 IP 가 `0.0.0.0` 또는 NLB IP 로 찍힘.

**진단**:
1. Target Type 이 `ip` + `preserve_client_ip=false` (기본)
2. 또는 SG 가 `0.0.0.0/0` 만 허용하고 실제 클라이언트 IP 를 인식 못 함

**해결**:
- Target Group `preserve_client_ip = true` 활성화
- SG 에서 클라이언트 IP 대역 허용 (NLB 가 이미 필터링하지 않으므로)

### 시나리오 2: "NLB 는 빠르다는데 실제로는 ALB 보다 느림"

**증상**: NLB 로 전환했는데 응답 시간이 오히려 느림.

**진단**:
1. 타겟이 실제 병목 (NLB 자체는 빠름)
2. TLS Passthrough 모드에서 백엔드가 TLS 처리 부하
3. Health Check 가 TCP 만 해서 비정상 타겟으로 트래픽 감

**해결**:
- 타겟 자체 성능 측정
- Health Check 를 HTTP 로 전환하여 실제 애플리케이션 상태 확인
- 백엔드 TLS 부하 분산

### 시나리오 3: "파트너사 IP 화이트리스트 변경 시 다운타임"

**증상**: 파트너가 IP 변경 통보 → 우리 쪽에서 SG 업데이트 시 잠시 연결 실패.

**진단**: SG 업데이트 즉시 반영이지만, 기존 Long-lived TCP 연결에 영향.

**해결**:
- SG 변경 전 이전 IP + 새 IP 둘 다 허용
- 파트너 전환 완료 후 이전 IP 제거
- 가능하면 CIDR 범위로 허용하여 변경 최소화

## 6. 면접 꼬리 질문 트리

```
Q10: NLB 를 언제 쓰나요?
├── Q10-1: 고정 IP 가 왜 필요한 경우가 있나요?
│   └── Q10-1-1: ALB 로는 정말 불가능한가요?
│       └── Q10-1-1-1: Global Accelerator 로는 가능한가요?
├── Q10-2: 클라이언트 IP 보존이 왜 중요한가요?
│   └── Q10-2-1: X-Forwarded-For 로는 부족한가요?
└── Q10-3: NLB + ALB 조합 패턴을 언제 쓰나요?
    └── Q10-3-1: 비용은 얼마나 늘어나나요?
```

**Q10 답변**: (1) 고정 IP 필요 (파트너 allow-list), (2) TCP/UDP (HTTP 아님), (3) 초저지연 (게임/금융), (4) 클라이언트 IP 보존, (5) 매우 높은 처리량, (6) TLS Passthrough.

**Q10-1-1 답변**: ALB 는 DNS 기반만 가능. DNS 는 TTL 이 있어 IP 가 순환/변경. 파트너가 allow-list 를 유지하기 불가. NLB 만 EIP 연결로 고정 IP 제공.

**Q10-1-1-1 답변**: Global Accelerator 는 2개의 고정 Anycast IP 제공. 전 세계 edge 에서 트래픽을 자사 리전으로 끌어오는 서비스. 글로벌 클라이언트 지연 감소 + 고정 IP 둘 다 확보. 비용 추가.

**Q10-2-1 답변**: X-Forwarded-For 는 HTTP 헤더. TCP/UDP 연결이나 HTTP 레이어 접근 불가한 경우(GeoIP 모듈이 OS 레벨 접근) 무용지물. 로깅/보안/과금에 실제 IP 필요한 시스템은 NLB 가 깔끔.

**Q10-3-1 답변**: NLB $0.0225/h × 2 (2 AZ) + ALB $0.0225/h = 월 $49 (idle 만). 데이터 비용 별도. 단일 ALB 대비 약 2-3배.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "NLB 는 HTTP 라우팅 가능" | **L4 전용** — 내용 기반 라우팅 불가 |
| "NLB Cross-Zone 기본 활성" | **기본 비활성** (ALB 는 기본 활성) |
| "NLB 에 WAF 직접 붙임" | 불가. CloudFront 경유 |
| "클라이언트 IP 보존이 기본" | Target Type `ip` 는 옵션, `instance` 는 기본 보존 |
| "TLS Passthrough 가 성능 우위" | 백엔드 TLS 부하 증가 고려 필요 |

## 8. 자가 점검 체크리스트

- [ ] L4 vs L7 차이 즉답
- [ ] NLB 가 제공하는 고정 IP 개수 (AZ 당 1개)
- [ ] 클라이언트 IP 보존의 의미와 중요성
- [ ] NLB + ALB 조합 패턴의 장단점
- [ ] WAF 를 NLB 에 붙일 수 없는 이유와 우회 방법
- [ ] Cross-Zone LB 기본값 차이 (ALB O / NLB X)
- [ ] TLS Passthrough vs TLS 종료 선택
- [ ] NLB 가 유리한 6가지 상황 나열 가능
- [ ] Global Accelerator 의 역할 이해
- [ ] Health Check TCP vs HTTP 트레이드오프

## 9. 참고 자료

- AWS NLB 공식 문서
- AWS Global Accelerator 공식 문서
- AWS Load Balancer Controller NLB annotations
- "Preserve Client IP on NLB" 공식 가이드
