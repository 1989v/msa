---
parent: 1-aws-network
subtopic: route53
index: 15
created: 2026-04-16
level: deep
---

# Route 53 DNS — Deep Study

## 1. 재확인

Route 53 은 AWS 의 **관리형 DNS 서비스**. 레코드 관리 + 라우팅 정책 + Health Check 통합. Private Hosted Zone 으로 VPC 내부 DNS 도 제공.

## 2. 내부 메커니즘

### 2.1 주요 레코드 타입

| 타입 | 용도 |
|---|---|
| A | 도메인 → IPv4 |
| AAAA | 도메인 → IPv6 |
| CNAME | 도메인 → 다른 도메인 |
| **Alias** (Route 53 전용) | ALB/NLB/CloudFront/S3 등 AWS 리소스 지정 |
| MX | 메일 서버 |
| TXT | 검증/SPF/DKIM |
| NS | 네임서버 위임 |
| SOA | Zone 정보 |

### 2.2 Alias vs CNAME

| 질문 | Alias | CNAME |
|---|---|---|
| 루트 도메인 (`example.com`) 지정 가능 | **O** | X |
| Query 비용 | **무료** (Route 53 내부 resolve) | DNS 쿼리 비용 |
| AWS 리소스만 가능 | O | N/A |
| Health Check 연동 | O | O |

**원칙**: AWS 리소스 지정 시 Alias 우선.

### 2.3 Public vs Private Hosted Zone

**Public Hosted Zone**:
- 인터넷 공개 도메인 (`example.com`)
- 도메인 등록자에게 NS 레코드 위임

**Private Hosted Zone**:
- VPC 내부 전용
- 여러 VPC 공유 가능 (Peering/TGW 불필요)
- 내부 서비스 discovery 에 활용 (`internal-api.example.com`)

### 2.4 라우팅 정책

| 정책 | 동작 |
|---|---|
| **Simple** | 기본. 1 레코드 = 1 타겟 |
| **Weighted** | 가중치 분배 (70:30 등) — 카나리 배포 |
| **Latency-based** | 클라이언트에서 가장 빠른 리전 |
| **Failover** | Primary Health Check 실패 → Backup |
| **Geolocation** | 국가/대륙 기반 (지역별 서비스) |
| **Geoproximity** | 지리적 거리 + Bias (Traffic Flow) |
| **Multi-value Answer** | 여러 healthy IP 반환 (Round Robin DNS) |

### 2.5 Health Check

- HTTP/HTTPS/TCP 주기적 체크
- 실패 시 DNS 응답에서 해당 레코드 제외 (Failover 정책과 조합)
- CloudWatch 알람 트리거 가능

### 2.6 Resolver / Private DNS

- VPC 의 기본 DNS 서버: **VPC CIDR +2** (예: `10.0.0.2`)
- EC2/Pod 내부에서 이 DNS 사용
- `enable_dns_hostnames = true` 로 VPC 활성화 필요

## 3. 설계 결정과 트레이드오프

### 3.1 카나리 배포 with Weighted Routing

```
example.com → 
  Record A: ALB-old (weight: 95)
  Record B: ALB-new (weight: 5)
```

점진적으로 weight 조정 (95→80→50→20→0). 문제 시 즉시 롤백.

### 3.2 Failover 패턴

```
api.example.com →
  Primary: ALB-primary (Health Check)
  Secondary: ALB-backup
```

Primary 실패 → DNS 응답이 자동으로 Backup IP. TTL 을 짧게 (60초) 두면 빠른 failover.

### 3.3 TTL 설정 가이드

| 시나리오 | TTL |
|---|---|
| 일반 정적 레코드 | 300-3600 초 |
| Failover 필요 | 60 초 |
| 카나리 배포 (빠른 전환) | 60 초 |
| 거의 안 바뀌는 NS | 86400 초 |

**낮은 TTL = 빠른 전환 + DNS 쿼리 비용 증가**.

### 3.4 Private Hosted Zone 활용

**내부 서비스 이름**:
```
order.internal.commerce.com   → order ALB (internal-facing)
product.internal.commerce.com → product ALB
db.internal.commerce.com      → RDS endpoint
```

EKS 환경에서는 K8s 자체 DNS (`.svc.cluster.local`) 가 있지만, **클러스터 외부**(Lambda, 다른 VPC)에서 접근 시 Route 53 Private Zone 필요.

## 4. 실제 코드/msa 연결

### 4.1 ALB Alias 레코드

```hcl
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.public.zone_id
  name    = "api.commerce.example.com"
  type    = "A"
  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}
```

### 4.2 Private Hosted Zone + 내부 레코드

```hcl
resource "aws_route53_zone" "private" {
  name = "internal.commerce.com"
  vpc {
    vpc_id = aws_vpc.this.id
  }
}

resource "aws_route53_record" "internal_order" {
  zone_id = aws_route53_zone.private.zone_id
  name    = "order.internal.commerce.com"
  type    = "A"
  alias {
    name                   = aws_lb.order_internal.dns_name
    zone_id                = aws_lb.order_internal.zone_id
    evaluate_target_health = true
  }
}
```

### 4.3 ACM 인증서 DNS 검증 자동화

```hcl
resource "aws_acm_certificate" "this" {
  domain_name       = "*.commerce.example.com"
  validation_method = "DNS"
}

resource "aws_route53_record" "validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }
  zone_id = aws_route53_zone.public.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}
```

### 4.4 msa 프로젝트 관점

- EKS 이전 시 `api.commerce.example.com` → Public Alias → ALB
- 내부 서비스 간 통신은 K8s DNS 로 충분 (`gateway:8080`)
- 외부 시스템(Lambda 등)이 EKS 내부 Service 호출 필요하면 Private Hosted Zone 추가

## 5. 장애 시나리오 3개

### 시나리오 1: "도메인 바꾸고 전환했는데 일부 사용자만 새 서버로 안 감"

**증상**: Weighted Routing 으로 새 서버 100% 전환. 그런데 일부 사용자는 여전히 구 서버 호출.

**진단**:
1. **DNS TTL 캐시** — 클라이언트/중간 resolver 가 이전 값 캐시
2. TTL 이 3600초 (1시간) 이면 최대 1시간 지연
3. 일부 ISP resolver 는 TTL 무시하기도 함

**해결**:
- 낮은 TTL (60초) 로 사전 설정
- 완전 전환까지 대기 시간 (TTL × 2-3배) 확보
- 애플리케이션 레벨 rollback 준비

### 시나리오 2: "Route 53 Health Check 가 Failover 안 됨"

**증상**: Primary ALB 다운인데 DNS 는 여전히 Primary IP 반환.

**진단**:
1. Health Check 자체가 Primary 를 healthy 로 판정 (TCP 열려있고 실제로 5xx)
2. Health Check 가 HTTP 응답 코드를 200 만 healthy 로 판단 중
3. Health Check 주기(30초) × threshold(3번) = 90초 지연

**해결**:
- Health Check path 를 `/actuator/health` 로 애플리케이션 헬스 확인
- 응답 코드 `200-399` 범위 허용
- `Failover` 정책 + `evaluate_target_health = true`

### 시나리오 3: "ACM 인증서 DNS 검증이 실패"

**증상**: ACM 인증서 발급 요청 후 며칠째 `PENDING_VALIDATION`.

**진단**:
- 필수 CNAME 레코드가 Route 53 에 없음
- 네임서버가 외부 (Cloudflare 등) 인데 Route 53 에 추가한 CNAME 이 적용 안 됨

**해결**:
- 실제 도메인의 네임서버 확인 (`dig NS example.com`)
- 해당 네임서버에 CNAME 레코드 추가
- Route 53 이 primary NS 가 아닌 경우 주의

## 6. 면접 꼬리 질문 트리

```
Q15: Route 53 의 Alias 레코드가 CNAME 과 뭐가 다른가요?
├── Q15-1: 루트 도메인에 CNAME 을 못 쓰는 이유는?
│   └── Q15-1-1: 그럼 RFC 상 Alias 는 표준이 맞나요?
├── Q15-2: Weighted Routing 으로 카나리 배포를 어떻게 하나요?
│   └── Q15-2-1: DNS TTL 이 길면 어떤 문제?
└── Q15-3: Private Hosted Zone 은 언제 쓰나요?
    └── Q15-3-1: K8s DNS 와 중복되지 않나요?
```

**Q15 답변**: Alias 는 Route 53 전용으로 AWS 리소스 (ALB/NLB/CloudFront/S3) 를 지정할 때 사용. 루트 도메인에도 쓸 수 있고 쿼리 비용이 무료.

**Q15-1-1 답변**: RFC 1034 는 루트에 CNAME 금지. Alias 는 AWS 확장 — DNS 응답 시 내부적으로 A 레코드처럼 동작. 다른 DNS 제공자(Cloudflare)의 "ANAME", "CNAME flattening" 과 유사.

**Q15-2-1 답변**: TTL 이 길면 클라이언트 DNS 캐시 유지 시간이 길어서 **전환이 즉시 반영 안 됨**. 또는 롤백 시에도 지연. 카나리 배포 시 TTL 60초 권장.

**Q15-3-1 답변**: 중복 아님. K8s DNS (`svc.cluster.local`) 는 **클러스터 내부** 전용. Lambda, 다른 VPC, EC2 등 **클러스터 외부**에서 EKS Service 에 접근할 때 Route 53 Private Zone 필요.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "루트 도메인에 CNAME 가능" | 불가. Alias 사용 |
| "Route 53 만으로 DNS 캐시 문제 해결" | 클라이언트/ISP resolver 캐시는 제어 불가 |
| "Health Check 는 즉시 반영" | 주기 × threshold 만큼 지연 |
| "Private Zone 은 모든 VPC 자동 공유" | 명시적 associate 필요 |
| "Alias 는 AWS 외부 도메인도 가능" | AWS 리소스만 |

## 8. 자가 점검 체크리스트

- [ ] Alias vs CNAME 차이 즉답
- [ ] 7가지 라우팅 정책 나열 가능
- [ ] Public vs Private Hosted Zone 차이
- [ ] DNS TTL 이 배포에 미치는 영향 설명 가능
- [ ] Health Check + Failover 조합 동작 이해
- [ ] ACM DNS 검증 자동화 플로우 이해
- [ ] VPC DNS Resolver (CIDR +2) 주소 인지
- [ ] Weighted Routing 카나리 활용 설명 가능
- [ ] Geoproximity (Traffic Flow) 존재 인지
- [ ] Multi-value Answer vs Simple Round Robin DNS 차이

## 9. 참고 자료

- AWS Route 53 공식 문서
- AWS ACM DNS Validation 공식 가이드
- RFC 1034/1035 (DNS 표준)
- "Route 53 Traffic Flow" 공식 블로그
