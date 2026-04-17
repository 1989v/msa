---
parent: 1-aws-network
subtopic: nacl
index: 06
created: 2026-04-16
level: deep
---

# NACL (Network ACL) — Deep Study

## 1. 재확인

NACL 은 **서브넷 레벨** 의 **Stateless** 방화벽. **Allow + Deny** 모두 가능. 규칙은 **번호 순서대로 평가**되고 첫 매칭에서 종료.

## 2. 내부 메커니즘

### 2.1 Stateless 의 실체

- 각 트래픽 방향(인바운드/아웃바운드)을 **독립적으로** 검사
- 연결 추적 없음 → 응답 트래픽도 **별도로 허용 규칙** 필요
- 예: 클라이언트 → 서버 80 허용했으면, 서버 → 클라이언트 ephemeral port (1024-65535) 도 허용 필수

### 2.2 규칙 평가 순서

```
NACL: nacl-private
Rule# 100: ALLOW Inbound TCP 22 from 10.0.0.0/16
Rule# 200: ALLOW Inbound TCP 80 from 0.0.0.0/0
Rule# 300: DENY  Inbound TCP All from 192.168.1.100/32
Rule# *:   DENY  All (암묵)
```

- 낮은 번호 → 높은 번호 순으로 **위에서 아래로** 평가
- **첫 매칭에서 종료** (SG 처럼 전체 OR 아님)
- 맨 끝 `*` 규칙은 "나머지 전부 Deny" (고정, 수정 불가)

### 2.3 기본 NACL vs 커스텀 NACL

| 구분 | 기본 NACL | 커스텀 NACL |
|---|---|---|
| 생성 시점 | VPC 생성 시 자동 | 사용자 생성 |
| Inbound 기본 | 모두 허용 | 모두 거부 |
| Outbound 기본 | 모두 허용 | 모두 거부 |
| 사용처 | 대부분 그대로 유지 | 특정 Deny 필요 시 |

**실무 원칙**: 기본 NACL(모두 허용) 유지하고 세밀 제어는 SG 로.

### 2.4 Ephemeral Port Range

- Linux 기본: 32768-60999
- Windows 기본: 49152-65535
- AWS NAT Gateway: 1024-65535
- **안전하게**: NACL 에서 `1024-65535` 를 허용 (모든 OS 커버)

### 2.5 서브넷-NACL 연결

- 서브넷:NACL = N:1 (각 서브넷은 정확히 하나의 NACL)
- NACL 하나는 여러 서브넷에 연결 가능
- 명시적 연결 없으면 기본 NACL 에 묵시적

## 3. 설계 결정과 트레이드오프

### 3.1 실무에서 NACL 언제 쓰나?

1. **특정 IP 차단** — 공격 IP, 규제 대상 국가 CIDR
2. **규제 준수** — 명시적 deny 규칙 필요 (PCI DSS 등)
3. **서브넷 단위 일괄 제어** — 수십~수백 리소스에 같은 규칙 적용

### 3.2 NACL vs SG 선택 가이드

| 요구사항 | SG | NACL |
|---|---|---|
| 리소스 단위 세밀 제어 | ✅ | ❌ |
| Deny 규칙 필요 | ❌ | ✅ |
| 서브넷 전체 정책 | ❌ | ✅ |
| 응답 자동 허용 | ✅ | ❌ (ephemeral 열어야 함) |
| 규칙 관리 편이성 | ✅ | ❌ (번호 관리 부담) |

**결론**: SG 를 주 제어, NACL 은 특수 상황용.

### 3.3 규칙 번호 할당 전략

```
100  - 기본 허용 규칙
200  - 특별 허용
500  - 예외 차단
1000 - 점진적 개방
```

**번호를 10단위가 아닌 100단위** 로 띄워 중간 삽입 여지 확보.

## 4. 실제 코드/msa 연결

### 4.1 기본 NACL 유지 전략 (Terraform 에서 명시 안 함)

```hcl
# 명시 안 하면 AWS 기본 NACL 자동 연결 (모두 허용)
resource "aws_subnet" "private" {
  # ... NACL 관련 필드 없음
}
```

### 4.2 커스텀 NACL (특정 IP 차단)

```hcl
resource "aws_network_acl" "private" {
  vpc_id     = aws_vpc.this.id
  subnet_ids = aws_subnet.private[*].id

  # Inbound rules
  ingress {
    rule_no    = 100
    action     = "allow"
    protocol   = "tcp"
    from_port  = 0
    to_port    = 65535
    cidr_block = "10.0.0.0/16"
  }
  ingress {
    rule_no    = 200
    action     = "deny"
    protocol   = "-1"
    from_port  = 0
    to_port    = 0
    cidr_block = "192.168.99.0/24"  # 차단 IP
  }
  # Outbound (ephemeral ports for replies)
  egress {
    rule_no    = 100
    action     = "allow"
    protocol   = "tcp"
    from_port  = 1024
    to_port    = 65535
    cidr_block = "0.0.0.0/0"
  }
}
```

### 4.3 msa 프로젝트 관점

- K8s NetworkPolicy 가 NACL 과 **다른 레이어** — NetworkPolicy 는 Pod 레벨, NACL 은 서브넷 레벨
- EKS 이전 시 기본 NACL 유지하고 NetworkPolicy + SG 로 제어하는 게 표준

## 5. 장애 시나리오 3개

### 시나리오 1: "NACL 80 허용했는데 응답이 안 돌아옴"

**증상**: NACL Inbound 80 ALLOW 추가. 외부에서 curl 했더니 **timeout** (응답 없음). SG 는 정상.

**진단**: NACL 은 Stateless → **Outbound** 에도 ephemeral port (1024-65535) ALLOW 필요.

**해결**:
```
Inbound  Rule 100: ALLOW TCP 80 from 0.0.0.0/0
Outbound Rule 100: ALLOW TCP 1024-65535 to 0.0.0.0/0
```

### 시나리오 2: "Deny 규칙을 추가했는데 허용 IP 도 차단됨"

**증상**: Rule 100 에 특정 IP Deny, Rule 200 에 전체 Allow 추가. 그런데 Rule 200 의 IP 가 정상이어야 하는데 차단됨.

**진단**: 규칙 번호 순서 혼동. **낮은 번호가 먼저 평가** → Rule 100 Deny 가 매칭되면 거기서 종료.

**해결**: 번호 재정렬. Deny 는 Allow 보다 **높은 번호** (나중에 평가) 또는 더 구체적인 CIDR 로 먼저 매칭되게.

### 시나리오 3: "NAT Gateway 뒤 트래픽이 간헐적 실패"

**증상**: 프라이빗 EC2 가 외부 호출 시 간헐 timeout.

**진단**: NAT Gateway 의 ephemeral port 범위는 **1024-65535**. NACL 에서 이 범위가 제한적으로만 허용되어 있으면 일부 연결이 차단됨.

**해결**: NACL Outbound 에 `TCP 1024-65535 to 0.0.0.0/0` 전체 허용.

## 6. 면접 꼬리 질문 트리

```
Q6: NACL 이 뭐고 SG 와 어떻게 다른가요?
├── Q6-1: Stateless 이므로 응답 포트를 열어야 한다는데, 구체적으로?
│   └── Q6-1-1: ephemeral port 가 뭔가요?
│       └── Q6-1-1-1: Linux/Windows 별 기본 범위 차이는?
├── Q6-2: 왜 실무에서는 NACL 을 기본 설정으로만 두고 안 건드리나요?
│   └── Q6-2-1: 그럼 NACL 은 언제 쓰나요?
└── Q6-3: NACL 규칙 번호 순서가 중요한 이유는?
    └── Q6-3-1: 번호 부여 전략은?
```

**Q6 핵심 답변**: 서브넷 레벨 Stateless 방화벽. Allow+Deny 가능, 번호 순서 첫 매칭. SG 는 리소스 레벨 Stateful Allow-only.

**Q6-1-1-1 답변**: Linux 커널 기본 32768-60999, Windows 49152-65535. 실무에서는 1024-65535 전체를 허용해서 OS 무관 동작하도록.

**Q6-2-1 답변**: (1) 특정 IP 차단 필요 시 (SG 는 Deny 불가), (2) 서브넷 단위 일괄 정책 (규제 준수), (3) 특정 국가 IP CIDR 차단.

**Q6-3-1 답변**: 100 단위로 띄워서 중간 삽입 여지 확보. 예: Allow 100-400, Deny 예외 500-600. 번호 작을수록 우선.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "NACL 이 리소스에 붙는다" | **서브넷 레벨** |
| "NACL 은 Stateful" | **Stateless** — 응답 별도 허용 필요 |
| "규칙은 전체 OR 평가" | 번호 순서, 첫 매칭에서 종료 |
| "기본 NACL 은 아무 것도 허용 안 함" | **기본 NACL 은 모두 허용**. 커스텀 NACL 이 모두 거부 |
| "NACL 만으로 세밀 제어 가능" | Stateless + 번호 관리 부담 → SG 필수 |

## 8. 자가 점검 체크리스트

- [ ] Stateless 의 의미와 ephemeral port 요구 이해
- [ ] 기본 NACL vs 커스텀 NACL 기본값 차이
- [ ] 규칙 번호 순서 평가 + 첫 매칭 종료 설명 가능
- [ ] NACL 과 SG 의 레이어 차이 (서브넷/리소스) 즉답
- [ ] Deny 가 가능한 유일한 네이티브 AWS 방화벽
- [ ] 실무에서 NACL 을 거의 안 건드리는 이유 이해
- [ ] NACL 을 써야 하는 3가지 시나리오 답변 가능
- [ ] ephemeral port 1024-65535 범위 암기
- [ ] 규칙 번호 부여 전략 (100 단위 띄움) 이해
- [ ] 서브넷:NACL = N:1 제약 인지

## 9. 참고 자료

- AWS Network ACLs 공식 문서
- AWS Security Best Practices (NACL 편)
- RFC 6056 (Recommendations for Transport-Protocol Port Randomization)
