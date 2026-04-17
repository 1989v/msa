---
parent: 1-aws-network
subtopic: security-group
index: 05
created: 2026-04-16
level: deep
---

# Security Group (SG) — Deep Study

## 1. 재확인

SG 는 **리소스 레벨** 의 **Stateful** 방화벽. **Allow 규칙만** 가능하고 Deny 불가. 응답 트래픽은 자동 허용 (stateful 의 핵심).

## 2. 내부 메커니즘

### 2.1 Stateful 의 실체

- AWS 내부에서 각 SG 는 **connection tracking 테이블** 을 유지
- 인바운드 요청 도착 → 테이블에 기록 → 응답은 기록과 매칭해 자동 허용
- 이 덕분에 "80 포트 인바운드 허용" 만 열어도 응답이 자동으로 나갈 수 있음

### 2.2 규칙 구조

```
Security Group: sg-app
├── Inbound rules
│   ├── Protocol: TCP, Port: 8080, Source: sg-alb  (SG 참조)
│   └── Protocol: TCP, Port: 22,   Source: 10.0.0.0/24  (CIDR)
└── Outbound rules
    └── Protocol: All, Port: All,  Destination: 0.0.0.0/0  (기본)
```

- **Source/Destination**: CIDR 또는 **다른 SG 의 ID** (prefix list 도 가능)
- 규칙 평가: **모든 규칙의 OR** — 여러 규칙 중 하나라도 매칭되면 허용

### 2.3 SG 간 참조 (SG-to-SG)

- 규칙에서 Source 로 CIDR 대신 **다른 SG ID** 지정 가능
- 해당 SG 가 붙은 모든 리소스 가 Source 로 매칭됨
- **IP 가 바뀌어도 규칙 유지** — 마이크로서비스 / Auto Scaling 환경의 핵심

예:
```
App-SG:
  Inbound: 8080 ← from ALB-SG   (ALB 가 어떤 IP 든 허용)
```

### 2.4 기본값

| 항목 | 기본 SG | 새로 만든 SG |
|---|---|---|
| Inbound | **자기 SG 에서의 모든 트래픽 허용** | 모두 거부 |
| Outbound | 모두 허용 (`0.0.0.0/0`) | 모두 허용 |

"기본 SG" (VPC 생성 시 자동) 와 "신규 생성 SG" 의 기본값이 다름 — 실수 주의.

### 2.5 리소스당 SG 최대 개수

- EC2: 기본 5개, 증설 신청 시 최대 16개
- ENI: 5개
- 여러 SG 는 OR 결합

## 3. 설계 결정과 트레이드오프

### 3.1 패턴 1: SG-to-SG 참조 (권장)

```
ALB-SG: 인바운드 80/443 from 0.0.0.0/0
App-SG: 인바운드 8080 from ALB-SG
DB-SG:  인바운드 3306 from App-SG
```

**장점**: IP 변경에 자동 대응, 의미가 명확, 체인 확장 용이.

### 3.2 패턴 2: CIDR 기반

```
App-SG: 인바운드 8080 from 10.0.1.0/24 (ALB 서브넷 CIDR)
```

**단점**: 서브넷이 확장/변경되면 깨짐. SG 참조 패턴이 우월.

### 3.3 Outbound 제한 여부

- 기본 Outbound 전체 허용 — 대부분 문제없음
- **PCI DSS 등 규제 환경**: Outbound 도 명시 허용만 → 데이터 유출 방지
- 단점: NAT 대상 목록 관리 부담

### 3.4 SG 개수 관리

- **기능별 SG** (web/app/db) — 재사용 쉬움
- **환경별 SG** (dev/stg/prod) — 경계 분리
- 하이브리드: `web-sg-prod`, `app-sg-prod`

## 4. 실제 코드/msa 연결

### 4.1 3-tier SG 체인

```hcl
resource "aws_security_group" "alb" {
  name_prefix = "alb-"
  vpc_id      = aws_vpc.this.id
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "app" {
  name_prefix = "app-"
  vpc_id      = aws_vpc.this.id
  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]  # SG 참조
  }
}

resource "aws_security_group" "db" {
  name_prefix = "db-"
  vpc_id      = aws_vpc.this.id
  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
}
```

### 4.2 msa 프로젝트의 현재 상태

- K8s 기반이라 AWS SG 미적용 (노드 SG 는 EKS 설치 시 자동)
- **NetworkPolicy 미적용** 상태 — AWS SG 의 K8s 대응물 Gap (ADR 필요)
- Pod SG 기능(SecurityGroupPolicy CRD) 도입 여지

### 4.3 Pod 별 SG (EKS VPC CNI 고급 기능)

```yaml
apiVersion: vpcresources.k8s.aws/v1beta1
kind: SecurityGroupPolicy
metadata:
  name: app-pod-sg-policy
spec:
  podSelector:
    matchLabels: { app: order }
  securityGroups:
    groupIds:
      - sg-xxx  # App-SG
```

- 특정 레이블의 Pod 에만 SG 적용
- 노드 SG 와 분리 관리

## 5. 장애 시나리오 3개

### 시나리오 1: "SG 에 허용 추가했는데 접속 안 됨"

**증상**: App-SG 에 8080 인바운드 추가했는데 ALB Target Group unhealthy.

**진단**:
1. Source 가 ALB-SG 인지, ALB 의 IP 인지 혼동
2. ALB SG 에 **아웃바운드** 8080 제한이 있나?
3. App 프로세스가 0.0.0.0:8080 이 아니라 127.0.0.1:8080 에 바인딩됐나?

**해결**: SG-to-SG 참조가 정확한지, ALB SG 아웃바운드 확인, `ss -tlnp` 로 바인딩 확인.

### 시나리오 2: "EC2 에 SG 여러 개 붙여도 통신 안 됨"

**증상**: SG1 (SSH 허용), SG2 (HTTP 허용) 두 개 붙였는데 SSH 만 되고 HTTP 안 됨.

**진단**: SG2 가 실제로 인스턴스에 붙었는지 확인. 여러 SG 는 **OR** 결합이므로 둘 중 하나라도 매칭되면 허용. SG2 가 실제로는 다른 리소스에 붙었거나, 규칙이 틀렸을 가능성.

**해결**: `aws ec2 describe-instance-attribute --attribute groupSet` 로 확인.

### 시나리오 3: "같은 SG 안의 인스턴스끼리 통신 안 됨"

**증상**: 같은 App-SG 의 EC2 2대가 서로 통신 불가.

**진단**: App-SG 의 Inbound 에 "자기 자신 SG 에서의 허용" 규칙이 없음. SG-to-SG 자기 참조가 필요.

**해결**:
```hcl
ingress {
  from_port       = 0
  to_port         = 65535
  protocol        = "tcp"
  security_groups = [aws_security_group.app.id]  # 자기 자신
}
```

## 6. 면접 꼬리 질문 트리

```
Q5: Security Group 과 NACL 의 차이는?
├── Q5-1: Stateful 과 Stateless 의 실제 차이는?
│   └── Q5-1-1: NACL 에서 응답 트래픽을 허용하려면?
├── Q5-2: SG 에서 Deny 규칙을 만들 수 있나요?
│   └── Q5-2-1: 특정 IP 를 차단하려면 어떻게 하나요?
└── Q5-3: SG 를 다른 SG 로 참조한다는 게 무슨 뜻인가요?
    └── Q5-3-1: EKS 에서도 Pod 별 SG 가능한가요?
        └── Q5-3-1-1: VPC CNI 의 어떤 기능인가요?
```

**Q5 핵심**: 레벨(리소스/서브넷), 상태(Stateful/Stateless), 규칙(Allow-only/Allow+Deny), 평가(OR 전체/순서 첫 매칭).

**Q5-1-1 답변**: NACL 은 Stateless — 인바운드 80 허용했어도 응답용 ephemeral port (1024-65535) 아웃바운드 허용을 따로 넣어야 응답 가능. 실무에서 자주 놓치는 지점.

**Q5-2-1 답변**: SG 로는 불가능 (Allow only). NACL 에서 해당 IP CIDR 의 Deny 규칙을 낮은 번호로 추가. 또는 AWS WAF 의 IP Set 차단.

**Q5-3-1-1 답변**: VPC CNI 의 **Branch ENI** 기능. `SecurityGroupPolicy` CRD 로 Pod 레이블에 매칭해 SG 를 할당. Pod 마다 별도 ENI 를 할당받는 방식이라 노드 타입 제약이 있음.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "SG 는 Stateless" | **Stateful** — 응답 자동 허용 |
| "SG 에 Deny 규칙 추가" | 불가능. Allow-only |
| "SG 여러 개는 AND 결합" | **OR** — 하나라도 매칭되면 허용 |
| "같은 SG 안 인스턴스는 자동 통신" | 기본 SG 만 그럼. 신규 SG 는 자기 참조 규칙 필요 |
| "SG 는 서브넷에 적용" | 아니다. **리소스(ENI)** 에 적용. 서브넷은 NACL |
| "SG 규칙 개수 무제한" | 한 SG 당 최대 60 인바운드 + 60 아웃바운드 |

## 8. 자가 점검 체크리스트

- [ ] Stateful 의 의미와 NACL 과의 차이 즉답
- [ ] SG 여러 개 붙이면 OR 결합 이해
- [ ] SG-to-SG 참조 패턴의 장점 설명 가능
- [ ] 기본 SG vs 신규 SG 기본값 차이 인지
- [ ] 자기 참조 규칙 필요성 이해
- [ ] Pod 별 SG (SecurityGroupPolicy CRD) 개념 이해
- [ ] Deny 불가의 대안 (NACL / WAF) 답변 가능
- [ ] 3-tier SG 체인 (ALB → App → DB) 설계 가능
- [ ] Outbound 제한이 왜 규제 환경에 필요한지 설명 가능
- [ ] Connection Tracking 개념 이해

## 9. 참고 자료

- AWS Security Groups 공식 문서
- EKS Security Groups for Pods (VPC CNI Branch ENI)
- AWS Well-Architected — Security Pillar
