---
parent: 1-aws-network
subtopic: vpc
index: 01
created: 2026-04-16
level: deep
---

# VPC (Virtual Private Cloud) — Deep Study

> 상위: [00-plan.md](00-plan.md) · 프리뷰: [00-preview.md](00-preview.md)

## 1. 재확인 (프리뷰 요약)

VPC 는 AWS 리전 내에 생성하는 **논리적으로 격리된 가상 네트워크 공간**이다. CIDR 블록으로 내부 IP 범위를 지정하고, IGW 를 붙이기 전까지는 외부와 완전히 단절된다. 모든 EC2/RDS/EKS 리소스는 어딘가의 VPC 에 속한다.

## 2. 내부 메커니즘

### 2.1 VPC 의 물리적 실체

- VPC 는 **실제 네트워크 장비가 아니라** AWS 의 **SDN (Software-Defined Networking)** 가상 오버레이
- 물리적으로는 AWS 전체 데이터센터 네트워크 위에서 동작하며, VPC ID 기반 패킷 태깅 + 라우팅으로 논리 격리
- VPC 간/외부 간 통신은 **모두 명시적 허용** 필요 (IGW, Peering, Endpoint, Transit Gateway 등)

### 2.2 CIDR 블록 내부

- CIDR = Classless Inter-Domain Routing
- `10.0.0.0/16` 의 의미: 앞 16비트(= `10.0`) 는 네트워크 주소 고정, 뒤 16비트(= `x.x`)는 호스트 자유
  ```
  10.0.0.0 ~ 10.0.255.255 → 65,536 IP
  ```
- AWS VPC CIDR 허용 범위: `/16` ~ `/28` (최대 65,536 ~ 최소 16)
- **RFC 1918 사설 대역**을 권장:
  - `10.0.0.0/8` (Class A)
  - `172.16.0.0/12` (Class B)
  - `192.168.0.0/16` (Class C)

### 2.3 Secondary CIDR Block

- VPC 생성 후 기본 CIDR 은 변경 불가, 하지만 **추가 CIDR 블록을 최대 4개까지 연결 가능** (IPv4)
- 용도: IP 소진 시 확장, 서로 다른 네트워크 세그먼트 분리

### 2.4 VPC 구성 요소 관계

```
VPC (논리 네트워크)
 ├── CIDR Block(s)
 ├── Subnet(s) — AZ 단위로 IP 묶음 분할
 ├── Route Table(s) — 서브넷별 트래픽 목적지
 ├── IGW (0 or 1)
 ├── NAT Gateway(s)
 ├── VPC Endpoint(s)
 ├── Peering Connection(s)
 └── Security Group(s), NACL(s)
```

## 3. 설계 결정과 트레이드오프

### 3.1 CIDR 크기 결정

| CIDR | IP 개수 | 추천 용도 |
|---|---|---|
| `/16` | 65,536 | **기본값** — 여유로운 대형 VPC |
| `/20` | 4,096 | 중간 규모 서비스 |
| `/24` | 256 | 소규모/개발환경 |
| `/28` | 16 | 특수 목적 (예: Transit Gateway attach) |

**권장**: VPC 는 **크게, 서브넷은 용도별로**. 확장 가능성이 거의 없을 때만 작게 설계.

### 3.2 다른 VPC / 온프레미스와의 CIDR 충돌

- 같은 CIDR 을 쓰는 두 VPC 는 **Peering 불가**
- 사내 네트워크 + AWS VPC 가 같은 IP 를 쓰면 VPN/Direct Connect 연결 시 라우팅 충돌
- 대규모 조직은 **IP Address Management (IPAM)** 도구로 중앙 관리

### 3.3 VPC 개수 전략

- **Single VPC, Multi Subnet**: 소규모 — 단순, 관리 용이
- **Per-Env VPC (dev/stg/prod)**: 일반 — 환경 격리, 다만 Peering/TGW 필요
- **Per-Team or Per-Service VPC**: 대기업 — 극한 격리, TGW 필수

## 4. 실제 코드/msa 연결

### 4.1 msa 프로젝트 관점

현재 msa 는 K8s 기반 (EKS 미이전) 으로, VPC 개념이 로컬에는 없고 프로덕션 EKS 이전 시 필요.

`docs/adr/ADR-0019-k8s-migration.md` 는 K8s 전환을 명시하지만 AWS VPC 설계는 미정.

### 4.2 Terraform VPC 정의

```hcl
resource "aws_vpc" "this" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true    # 내부 DNS resolve
  enable_dns_hostnames = true    # 퍼블릭 EC2 에 DNS 이름 할당
  tags = { Name = "commerce-prod" }
}
```

- `enable_dns_*` 2개는 **true 권장** — Route 53 Private Zone 과 EKS Pod DNS 에 영향
- `ipv6_cidr_block` 지정 시 IPv6 도 함께 활성화 가능

### 4.3 Secondary CIDR 예시

```hcl
resource "aws_vpc_ipv4_cidr_block_association" "secondary" {
  vpc_id     = aws_vpc.this.id
  cidr_block = "10.1.0.0/16"
}
```

## 5. 장애 시나리오 3개

### 시나리오 1: VPC 생성 후 EC2 띄웠는데 SSH 가 안 됨

**증상**: 퍼블릭 서브넷에 EC2 생성, 퍼블릭 IP 할당, 그런데 SSH 접속 timeout.

**진단 순서**:
1. IGW 가 VPC 에 attach 되어 있는가? (`aws ec2 describe-internet-gateways`)
2. 서브넷의 Route Table 에 `0.0.0.0/0 → IGW` 경로가 있는가?
3. EC2 의 Security Group 에 22 포트 인바운드 허용이 있는가?
4. 서브넷의 NACL 이 기본값인가? (커스텀 NACL 은 기본 deny)
5. `auto-assign public IP` 가 서브넷에서 true 인가?

**해결**: 대부분 2번 (RT) 또는 3번 (SG) 누락. 체크리스트화 필요.

### 시나리오 2: VPC Peering 이 연결됐는데 통신 안 됨

**증상**: VPC A ↔ VPC B Peering 생성, Status Active, 그런데 A 의 EC2 가 B 의 EC2 에 ping 실패.

**진단**:
1. 양쪽 **Route Table 에 상대 CIDR 경로** 추가했는가? (Peering 생성만으론 자동 안 됨)
2. SG 가 상대 CIDR 을 허용하는가?
3. NACL 이 막고 있는가?
4. CIDR 이 겹치지는 않는가? (겹치면 애초에 연결 실패하지만 재확인)

**해결**: Peering 은 **라우팅 + SG 둘 다** 수동 설정 필요.

### 시나리오 3: "VPC 가 가득찼다"

**증상**: 신규 서브넷 생성 시 `CIDR block is outside of the VPC's CIDR block` 또는 `insufficient IP`.

**진단**:
1. `aws ec2 describe-vpcs` 로 현재 CIDR 확인
2. 서브넷들이 이미 CIDR 을 모두 나눠 가졌는가?

**해결**:
- Secondary CIDR Block 연결 (최대 4개)
- 안 쓰는 서브넷 재사용
- 근본: **초기 CIDR 을 충분히 크게** 설계 (`/16` 권장)

## 6. 면접 꼬리 질문 트리

```
Q1: VPC 가 뭔가요?
├── Q1-1: CIDR 블록은 뭐고 어떻게 정하나요?
│   └── Q1-1-1: 나중에 CIDR 을 변경할 수 있나요?
│       └── Q1-1-1-1: 그럼 처음부터 크게 잡는 게 낫나요, 실제 필요한 만큼만 잡는 게 낫나요?
├── Q1-2: 여러 VPC 를 왜 쓰나요? 한 개면 안 되나요?
│   └── Q1-2-1: 멀티 VPC 연결은 어떻게 하나요?
│       └── Q1-2-1-1: VPC Peering 과 Transit Gateway 차이는?
└── Q1-3: VPC 와 온프레미스 네트워크를 어떻게 연결하나요?
    └── Q1-3-1: VPN 과 Direct Connect 차이는?
        └── Q1-3-1-1: BGP 라우팅이 왜 필요한가요?
```

**Q1 핵심 답변**: AWS 내에 사용자 전용으로 격리된 가상 네트워크 공간. CIDR 로 내부 IP 범위를 지정하고, 서브넷/라우트 테이블/SG 등 모든 네트워크 구성의 기반이 됨.

**Q1-1-1 답변**: 기본 CIDR 은 **변경 불가**. 단 Secondary CIDR Block 을 최대 4개까지 추가 가능하므로 확장은 가능. 삭제하고 재생성은 해당 VPC 의 모든 리소스 삭제가 필요해서 실질적 옵션 아님.

**Q1-1-1-1 답변**: **크게 잡는 게 낫다**. IP 는 공짜고, 실무에서 예상 외 확장이 빈번함. `/16` 이 관례. 단, 사내 다른 VPC / 온프레미스 CIDR 과 겹치지 않도록 사전 IPAM 필요.

**Q1-2-1-1 답변**: Peering 은 **1:1, non-transitive** — 10개 VPC 면 45개 Peering 필요, A-B-C 삼각 통신 불가. TGW 는 **허브 구조, transitive** — 1개 TGW 에 모든 VPC 를 붙이면 O(N) 확장. 비용: Peering 은 연결비 무료, TGW 는 시간당 + 데이터 처리비.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "VPC 는 리전 독립적" | VPC 는 **단일 리전** 귀속. 리전 간 통신은 Peering/TGW/PrivateLink |
| "VPC 를 만들면 자동으로 인터넷 된다" | IGW + 퍼블릭 IP + RT + SG 모두 있어야 됨 |
| "Peering 이 transitive 하다" | **Non-transitive**. A-B, B-C 가 있어도 A-C 는 불가 |
| "CIDR 은 나중에 바꿀 수 있다" | 기본 CIDR 불가, Secondary Block 만 추가 가능 |
| "VPC 는 무료라서 개수 무제한" | 계정당 **5개 리전당 기본 한도** (증설 신청 가능) |
| "VPC 안에 들어간 트래픽은 모두 안전하다" | VPC 내부도 SG/NACL 로 명시 제어 필요 (Zero Trust) |

## 8. 자가 점검 체크리스트

- [ ] CIDR 블록 `10.0.0.0/16` 을 IP 개수로 즉답 가능 (65,536)
- [ ] `/24` 서브넷의 실사용 IP 즉답 가능 (251)
- [ ] 퍼블릭 vs 프라이빗 서브넷의 실체 (RT 의 IGW 경로) 설명 가능
- [ ] VPC 간 CIDR 충돌이 왜 문제인지 설명 가능
- [ ] VPC Peering 의 non-transitive 를 예시로 설명 가능
- [ ] Secondary CIDR 추가 이유와 한계 (최대 4개) 답변 가능
- [ ] VPC 개수 전략 3가지 (Single / Per-Env / Per-Service) 트레이드오프 설명 가능
- [ ] enable_dns_hostnames 의 효과 설명 가능
- [ ] VPC 가 "SDN 가상 오버레이" 라는 본질 이해
- [ ] IPAM 의 필요성 설명 가능 (대기업 환경)

## 9. 참고 자료

- AWS VPC 공식 문서 — [Amazon VPC User Guide](https://docs.aws.amazon.com/vpc/latest/userguide/)
- RFC 1918 (Address Allocation for Private Internets)
- Terraform AWS VPC module — `terraform-aws-modules/vpc/aws`
- "AWS Certified Advanced Networking" 학습 자료
