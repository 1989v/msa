---
parent: 1-aws-network
subtopic: igw
index: 03
created: 2026-04-16
level: deep
---

# Internet Gateway (IGW) — Deep Study

## 1. 재확인

IGW 는 VPC 의 **유일한 인터넷 진입/탈출점**. VPC 당 1개만 연결 가능하며, 관리형 리소스라 사용자가 관리할 것은 없다. IGW 자체는 고가용/수평확장이 자동.

## 2. 내부 메커니즘

### 2.1 물리적 실체

- IGW 는 **논리 컴포넌트** — 실제 특정 장비 지정 불가
- AWS 백본에서 VPC 의 퍼블릭 IP 를 공인 IP 로 **NAT 변환**하여 인터넷에 전달
- 양방향 (인바운드 + 아웃바운드) 지원

### 2.2 NAT 동작 (IGW 의 숨은 역할)

- EC2 의 프라이빗 IP `10.0.1.5` ↔ 할당된 퍼블릭 IP `54.xxx.xxx.xxx` 간 1:1 NAT
- 응답 트래픽은 자동으로 NAT 테이블을 통해 원래 프라이빗 IP 로 되돌림
- 이것이 EC2 가 "프라이빗 IP 만 갖고도 인터넷 가능" 한 이유

### 2.3 인터넷 연결의 4가지 전제

```
외부 인터넷 통신 가능 조건:
  1. IGW 가 VPC 에 attached      ← IGW 자체
  2. RT 에 0.0.0.0/0 → IGW 경로  ← Route Table
  3. 리소스에 퍼블릭 IP 또는 EIP  ← 주소
  4. SG + NACL 이 허용            ← 방화벽
```

**하나라도 빠지면 인터넷 불가**. 면접 단골 함정 질문.

### 2.4 Egress-Only IGW (IPv6)

- IPv4 의 NAT Gateway 같은 역할을 IPv6 에서 수행하는 별도 리소스
- IPv6 는 NAT 없음 (주소 공간이 풍부해서), 대신 "아웃바운드만 허용" 이 필요하면 Egress-Only IGW 사용

## 3. 설계 결정과 트레이드오프

### 3.1 VPC 당 IGW 1개 제약의 의미

- 여러 인터넷 경로가 필요한 경우? → **별도 VPC 생성 + Peering/TGW**
- 조직 단위로 인터넷 출구를 중앙화하려면 **AWS Network Firewall + Central Egress VPC** 패턴

### 3.2 "IGW 없는 VPC" 시나리오

- **Air-gapped 환경**: 완전 프라이빗 VPC, 모든 외부 통신 차단
- 금융/규제 환경에서 사용
- AWS 서비스 접근은 VPC Endpoint 로만

### 3.3 IGW vs NAT Gateway vs VPN

| | IGW | NAT Gateway | VPN |
|---|---|---|---|
| 방향 | 양방향 | Private → 외부 only | 양방향 (특정 대상) |
| 대상 | 인터넷 | 인터넷 | 온프레미스 |
| 관리 | AWS | AWS | AWS + 사용자 장비 |
| 비용 | 무료 | 유료 ($0.045/h + GB) | 유료 |

## 4. 실제 코드/msa 연결

### 4.1 Terraform IGW

```hcl
resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "commerce-igw" }
}

# Public Route Table 에 연결
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
}
```

### 4.2 msa 프로젝트 → AWS

현재 msa 의 로컬 K8s (k3d) 는 IGW 가 없음 (Docker host 네트워크 활용). EKS 이전 시:
- 기본 1개 IGW 로 퍼블릭 서브넷 (ALB, NAT GW) 외부 접근
- ADR-0019 는 IGW 관련 결정은 없음 → EKS 이전 ADR 에 명시 필요

### 4.3 Central Egress 패턴 (엔터프라이즈)

```
[Dev VPC] ─┐
[Stg VPC] ─┼── Transit Gateway ── [Egress VPC] ── IGW ── Internet
[Prod VPC]─┘                                       │
                                              Network Firewall
```

모든 아웃바운드를 Egress VPC 경유 → 중앙 로깅, 필터링, 규정 준수.

## 5. 장애 시나리오 3개

### 시나리오 1: VPC 에 IGW 붙였는데 EC2 가 인터넷 안 됨

**증상**: IGW attach 상태, RT 에 `0.0.0.0/0 → IGW` 있음, EC2 퍼블릭 IP 있음. 그런데 `curl google.com` 타임아웃.

**진단**:
1. EC2 가 실제로 **퍼블릭 서브넷**에 있나? (서브넷 → RT 연결 확인)
2. SG 아웃바운드 80/443 허용?
3. NACL 아웃바운드 + ephemeral 인바운드 허용?
4. EC2 내부 방화벽 (`iptables`/`firewalld`) 없나?

**해결**: 4가지 전제 체크리스트 순회. 가장 흔한 원인은 서브넷이 기본 RT (IGW 경로 없음) 에 묵시적 연결되어 있던 경우.

### 시나리오 2: IGW detach 불가

**증상**: VPC 정리하려고 IGW detach 하려는데 `has dependencies that must be deleted first`.

**진단**: VPC 내 리소스 중 IGW 경로를 쓰는 것(퍼블릭 EC2, NAT GW 등)이 있음. 또는 EIP 가 연결된 상태.

**해결**: 의존성 역순 삭제 (EC2 → NAT GW → EIP release → IGW detach → VPC delete).

### 시나리오 3: 멀티 VPC 환경에서 "어느 VPC 로 나갔는지" 추적 안 됨

**증상**: 여러 VPC 의 아웃바운드 로그가 섞여서 감사/컴플라이언스 문제 발생.

**진단**: 각 VPC 마다 IGW 로 직접 나가면 중앙 집중 로깅 불가.

**해결**: Central Egress VPC 패턴. Transit Gateway → Egress VPC → Network Firewall + VPC Flow Logs → S3.

## 6. 면접 꼬리 질문 트리

```
Q3: IGW 가 뭐고 왜 필요한가요?
├── Q3-1: VPC 당 IGW 1개 제한이 왜 있나요?
│   └── Q3-1-1: 인터넷 출구를 2개 쓰려면 어떻게 하나요?
├── Q3-2: IGW 만 붙이면 인터넷 되나요?
│   └── Q3-2-1: 안 되면 뭐가 더 필요한가요?
└── Q3-3: IGW 와 NAT Gateway 의 차이는?
    └── Q3-3-1: NAT Gateway 는 IGW 없이 못 쓰나요?
```

**Q3 답변**: VPC 의 유일한 인터넷 관문. VPC 내부의 퍼블릭 IP 를 공인 IP 로 NAT 변환해서 외부와 양방향 통신을 가능하게 함. VPC 당 1개만 연결 가능.

**Q3-1-1 답변**: 별도 VPC 를 만들어 각각 IGW 부여 + TGW 로 연결. 또는 Central Egress VPC 패턴으로 하나의 VPC 에 IGW 를 몰고 다른 VPC 들은 TGW 경유.

**Q3-2-1 답변**: 4가지 전제 — (1) IGW attach, (2) RT 기본 경로, (3) 퍼블릭 IP/EIP, (4) SG/NACL 허용.

**Q3-3-1 답변**: NAT Gateway 는 내부적으로 IGW 를 경유해서 인터넷에 나감. 즉 NAT GW 자체가 퍼블릭 서브넷에 배치되어야 하고, 그 서브넷의 RT 에 IGW 경로가 있어야 함.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "IGW 는 방화벽 역할도 한다" | **아니다**. 방화벽은 SG/NACL. IGW 는 순수 라우팅/NAT |
| "IGW 없으면 VPC 는 쓸모없다" | 아니다. Air-gapped 환경 + VPC Endpoint 로 AWS 서비스 접근 |
| "VPC 당 IGW 여러 개 가능" | **1개만 가능** |
| "IGW 가 고장나면 우리가 복구해야" | 아니다. AWS 관리. 고장 자체가 거의 없음 |
| "IGW 시간당 요금이 있다" | **무료**. 데이터 전송 비용은 있지만 (Internet egress) |

## 8. 자가 점검 체크리스트

- [ ] IGW 가 NAT 역할도 한다는 것 인지
- [ ] 인터넷 연결 4가지 전제 즉답
- [ ] VPC 당 IGW 1개 제약과 우회 방법
- [ ] IGW vs NAT Gateway vs VPN 구분
- [ ] Air-gapped VPC 구성 가능성 이해
- [ ] Central Egress 패턴 개념 이해
- [ ] IGW 무료, 데이터 egress 는 유료 구분
- [ ] Egress-Only IGW (IPv6 전용) 존재 인지
- [ ] IGW detach 전 의존성 순서 이해
- [ ] Flow Logs 로 IGW 트래픽 감사 가능

## 9. 참고 자료

- AWS Internet Gateways 공식 문서
- AWS Central Egress 패턴 — AWS Well-Architected
- VPC Flow Logs 설정
