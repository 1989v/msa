---
parent: 1-aws-network
seq: 20
title: IPv6 / Egress-only IGW / CIDR 관리 / IPAM / BYOIP — 주소 거버넌스 deep dive
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 01-vpc.md
  - 02-subnet.md
  - 03-igw.md
  - 07-nat-gateway.md
  - 13-eks-networking.md
  - 17-msa-mapping.md
sources:
  - https://docs.aws.amazon.com/vpc/latest/userguide/vpc-ip-addressing.html
  - https://docs.aws.amazon.com/vpc/latest/userguide/ipv6-on-aws.html
  - https://docs.aws.amazon.com/vpc/latest/userguide/egress-only-internet-gateway.html
  - https://docs.aws.amazon.com/vpc/latest/ipam/what-is-it-ipam.html
  - https://docs.aws.amazon.com/vpc/latest/userguide/vpc-byoip.html
  - https://aws.amazon.com/blogs/aws/new-aws-public-ipv4-address-charge-public-ip-insights/
catalog-row: "§A (VPC 기초) — Egress-only IGW (★) / CIDR 블록 (🟡) / IPv6 dual-stack (★) / IPAM (★) / BYOIP (★)"
---

# 20. IPv6 / Egress-only IGW / CIDR 관리 / IPAM / BYOIP — 주소 거버넌스 deep dive

> 카탈로그 매핑: §99 §A — `Egress-only IGW` (★ → ✅), `CIDR 블록 (primary/secondary)` (🟡 → ✅), `IPv6 (dual-stack / IPv6-only)` (★ → ✅), `IPAM` (★ → ✅), `BYOIP` (★ → ✅).
> 학습 시간 예상: ~2.5h · 자가평가 입구 레벨: B

> 2024년 2월부터 모든 public IPv4 (Internet Protocol version 4) 주소가 시간당 과금되기 시작하면서 IPv6 (Internet Protocol version 6) 마이그레이션 / IPAM (IP Address Manager) / BYOIP (Bring Your Own IP) 같은 "주소 거버넌스" 주제가 비용 항목으로 승격됐다. 본 deep file 은 VPC 의 CIDR (Classless Inter-Domain Routing) 블록 관리 (primary / secondary / IPv6) 부터 시작해서 IPv6 dual-stack vs IPv6-only 결정 매트릭스, Egress-only IGW (Internet Gateway) 의 비대칭 동작, IPAM 으로 멀티 account IP 풀을 자동 할당하는 운영 패턴, BYOIP 로 자체 보유 IP 풀을 가져오는 절차 (ROA (Route Origin Authorization) 까지), 그리고 msa K8s (Kubernetes) 클러스터의 pod / service CIDR 결정에 어떻게 적용되는지를 다룬다.

---

## 1. 한 줄 핵심

> **IPv4 는 이제 유료 자원, IPv6 는 무료지만 호환성 함정이 많다.**
> VPC 1개당 primary IPv4 CIDR + secondary 4개 + IPv6 /56 1개를 붙일 수 있고, IPv6-only 서브넷은 NAT GW (Gateway) 가 필요 없는 대신 Egress-only IGW 라는 "outbound 전용 비대칭 게이트웨이" 를 쓴다. 멀티 account / 멀티 VPC 환경에서 IP 충돌을 피하려면 IPAM 으로 풀을 중앙 관리하고, 자체 보유 public IP 를 그대로 쓰고 싶으면 BYOIP 로 import 한다 — 단 ROA 검증을 통과해야 한다.

---

## 2. 등장 배경 — 왜 지금 IP 거버넌스인가

### 2-1. IPv4 가 유료가 된 사건 (2024-02-01)

```
2024-02-01 이전: VPC 에 attach 된 IPv4 EIP (Elastic IP) — "사용 중이면 무료, 미사용 시 시간당 과금"
2024-02-01 이후: 모든 in-use public IPv4 주소가 시간당 $0.005 과금 (월 약 $3.6 / IP)
```

영향:

- public 서브넷 EC2 (Elastic Compute Cloud) 1대당 자동 할당된 public IP 도 과금 대상.
- ALB (Application Load Balancer) / NLB (Network Load Balancer) 의 public IP, NAT (Network Address Translation) GW 의 EIP 도 모두 과금.
- 100 EC2 + 3 NAT GW + 5 LB 같은 환경이면 **public IPv4 비용만 월 $400+** 발생.

→ 이 시점부터 "IPv6 마이그레이션" 이 비용 절감 카드가 됐고, 동시에 "필요 없는 public IP 식별 / 회수" 가 IPAM 의 주된 use case 로 부상.

### 2-2. msa 의 현재 시점 시뮬레이션

msa 가 EKS (Elastic Kubernetes Service) 로 이전한다고 가정 (ADR-0019):

| 리소스 | public IPv4 사용 | 월 비용 |
|---|---|---|
| ALB (gateway 노출) | 2~6 IP (multi-AZ (Availability Zone)) | $7~21 |
| NAT GW × 3 AZ | 3 EIP | $11 |
| EKS public endpoint | 2 IP | $7 |
| Bastion (옵션) | 1 IP | $3.6 |
| **소계** | **8~12 IP** | **$28~42** |

소규모지만 dev / stg / prod 3 환경이면 ×3, 멀티 region 이면 ×N. **IPv6 + Egress-only IGW** 로 NAT GW 의 IPv4 outbound 비용 + EIP 비용까지 함께 줄이는 전략이 등장한 배경.

### 2-3. 멀티 account 의 IP 충돌 — IPAM 등장 배경

조직이 커지면:

```
account-prod : VPC 10.0.0.0/16
account-stg  : VPC 10.0.0.0/16  ← 충돌. peering 불가.
account-data : VPC 10.1.0.0/16
account-team-A : VPC 10.0.0.0/16  ← 또 충돌.
```

- VPC peering / TGW (Transit Gateway) 는 **CIDR 겹치면 불가능**.
- Slack 으로 "10.x 누가 썼나요?" 묻는 운영 — 안티패턴.
- IPAM 은 **중앙 풀** 에서 account / 환경 / region 별 sub-pool 을 자동 할당. 충돌이 원천 차단.

### 2-4. BYOIP 등장 배경 — IP 평판 (Reputation)

이메일 / B2B API 외부 노출에선 **IP 평판** 이 중요:

- 사내에서 5년간 깨끗하게 관리한 `203.0.113.0/24` 풀이 있다.
- AWS 로 옮기면 EIP 는 AWS pool 에서 random 할당 → 누가 이전에 spammer 로 쓴 IP 일 수 있음.
- BYOIP 로 자체 풀을 그대로 import 하면 IP 가 바뀌지 않아서 평판 유지 + 고객 방화벽 whitelist 도 그대로.

단 자체 보유 증명 (ROA via RPKI (Resource Public Key Infrastructure)) 이 필요 — 아무 IP 나 import 못 함.

---

## 3. 동작 원리

### 3-1. CIDR 블록 — primary + secondary + IPv6

VPC 1개의 주소 공간 한도:

```
┌────────────────────── VPC ──────────────────────┐
│ Primary IPv4 CIDR    : 1개 (생성 시 고정, 변경 ❌)│
│ Secondary IPv4 CIDR  : 최대 4개 (추가/제거 가능) │
│ IPv6 CIDR (/56)      : 최대 1개 (Amazon 풀)      │
│   또는 BYOIPv6        : import 한 풀에서 할당     │
└──────────────────────────────────────────────────┘
```

#### 제약

| 항목 | 한도 |
|---|---|
| Primary CIDR 크기 | `/16` ~ `/28` |
| Primary CIDR 변경 | 불가 — VPC 재생성만 |
| Secondary CIDR 추가 | 4개까지, RFC 1918 또는 비충돌 사설 |
| Secondary 제약 | primary 와 겹치면 ❌, AWS 예약 대역 (예: `100.64.0.0/16` 일부) ❌ |
| IPv6 CIDR | Amazon-assigned `/56` 또는 BYOIPv6 |
| IPv6 서브넷 | 각 서브넷 `/64` 고정 (변경 ❌) |

#### secondary 의 활용 — IP 소진 대응

```
처음:  10.0.0.0/16 (65,536 IP) — 충분해 보임
1년 후: EKS pod 이 ENI (Elastic Network Interface) 의 secondary IP 를 폭식 → 47K IP 사용

대응:
  Secondary CIDR: 100.64.0.0/16 (CGNAT 대역, AWS 가 EKS 용으로 권장)
  → pod 만 100.64.x 로 격리 → primary 보존
```

→ msa 의 EKS 이전 설계에서 **primary `10.0.0.0/16` + secondary `100.64.0.0/16`** 가 표준 패턴 (pod 전용 secondary).

### 3-2. IPv6 — VPC dual-stack vs IPv6-only

#### 모드 비교

| 모드 | IPv4 | IPv6 | 사용 케이스 |
|---|---|---|---|
| **IPv4-only** (default) | ✅ | ❌ | 레거시 |
| **dual-stack** | ✅ | ✅ | 점진 마이그레이션 — 가장 흔한 선택 |
| **IPv6-only** | ❌ | ✅ | 비용 최적화 신규 워크로드 |

#### IPv6 주소 형식

```
2600:1f18:abcd:1234:5678:90ab:cdef:1234
└─────── /48 (Amazon ASN) ─────┴───── /64 subnet ────┘
                                └────── /128 host ───┘

VPC : /56 (256 서브넷 가능)
Subnet : /64 고정 (각 서브넷 18,446,744,073,709,551,616 IP — 사실상 무한)
```

→ IPv6 는 **서브넷 IP 소진 걱정이 사라진다**. `/64` 한 서브넷이 IPv4 인터넷 전체보다 크다.

#### 서비스별 IPv6 지원 매트릭스 (2026-05 기준)

| 서비스 | dual-stack | IPv6-only | 비고 |
|---|---|---|---|
| **VPC / Subnet** | ✅ | ✅ | |
| **EC2** | ✅ | ✅ | Nitro 인스턴스 권장 |
| **ALB** | ✅ | ✅ | "dualstack" / "dualstack-without-public-ipv4" / "ipv6" scheme |
| **NLB** | ✅ | ✅ | TCP/UDP/TLS 모두 |
| **CLB (Classic LB)** | ❌ | ❌ | deprecated |
| **RDS** | ✅ (대부분) | 일부 | 엔진별 상이 |
| **ElastiCache** | ✅ | 일부 | Redis 6.2+ |
| **S3 (Simple Storage Service)** | ✅ | dual-stack endpoint | `s3.dualstack.<region>.amazonaws.com` |
| **CloudFront** | ✅ | ✅ | 자동 |
| **Lambda VPC** | 🟡 | 🟡 | 점진 |
| **EKS** | ✅ | ✅ (cluster 단위) | VPC CNI (Container Network Interface) plugin 6.0+ |
| **NAT GW** | IPv4 만 | — | IPv6 는 NAT 불필요 (Egress-only IGW) |
| **VPC Endpoint (Interface)** | ✅ | 🟡 | 서비스별 상이 |
| **Route 53 (Domain Name System)** | ✅ | ✅ | AAAA record |

#### dual-stack 의 함정

- ALB scheme `dualstack-without-public-ipv4` (2023+) — public IPv4 없이 IPv6 + 내부 IPv4. **public IPv4 비용 절감의 핵심 옵션**.
- 외부에서 IPv6 만으로 접근하는 클라이언트 비율은 한국에서 **30%+ (모바일)**, 글로벌 평균 **45%+** (2026 기준). 즉 IPv6 만 enable 해도 절반은 그쪽으로 빠진다 → IPv4 비용 절감.
- 단 `enableDnsHostnames` 가 켜져있어야 AAAA record 자동 생성 (§21 참조).

#### IPv6-only 의 함정

- IPv6 미지원 외부 서비스 호출 시 막힘. 대표적으로 **GitHub Container Registry / 일부 npm registry** 가 IPv6 늦게 지원.
- 해결: **DNS64 + NAT64** — IPv6-only client 가 IPv4-only 외부 서비스 호출. AWS 에선 VPC 의 `enableDns64` 옵션 + NAT GW 의 NAT64 기능으로 처리.
- DNS64/NAT64 도입하면 IPv4-only 외부 호출도 가능해지지만 NAT GW 비용은 다시 발생.

### 3-3. Egress-only IGW — IPv6 의 NAT GW 등가물

#### 왜 별도 게이트웨이?

- IPv4 NAT GW: private subnet → 인터넷 outbound + return 트래픽만. 외부에서 시작된 inbound ❌. 핵심은 **주소 변환 + stateful 연결 추적**.
- IPv6 는 모든 주소가 globally routable. NAT 가 **개념적으로 불필요**. 하지만 "outbound 만 허용, inbound 거부" 같은 보안 모델은 여전히 필요.
- **Egress-only IGW (EIGW)** = IPv6 전용 outbound-only 비대칭 게이트웨이. NAT 없이 stateful filtering 만.

#### 대비 표

| 항목 | NAT GW (IPv4) | Egress-only IGW (IPv6) |
|---|---|---|
| 방향 | Outbound + return | Outbound + return |
| 주소 변환 | 1:多 NAT (PAT) | 변환 ❌ (IPv6 그대로) |
| stateful | ✅ | ✅ |
| inbound 시작 차단 | ✅ | ✅ |
| 비용 | 시간당 + 데이터당 | **무료** |
| IP 할당 필요 | EIP 1개 | 없음 |

→ **IPv6 outbound 는 비용이 0** 이라는 점이 IPv6 마이그레이션의 가장 큰 매력.

#### 라우팅 테이블 패턴

```
Private Subnet Route Table (dual-stack):
  10.0.0.0/16     → local
  ::/0            → eigw-xxxxx     ← IPv6 outbound (무료)
  0.0.0.0/0       → nat-yyyyy      ← IPv4 outbound (유료)
```

→ 같은 서브넷에서 IPv6 트래픽은 EIGW, IPv4 는 NAT GW 로 분기.

### 3-4. IPAM — IP Address Manager

#### 무엇인가

AWS Organizations 단위로 IP 풀을 **계층적** 으로 정의하고, account / region / VPC 에 자동 할당 + 사용량 추적 + 충돌 차단.

#### 풀 계층

```
Top-level pool: 10.0.0.0/8                  ← 조직 전체 사설 풀
├── Region pool (ap-northeast-2): 10.0.0.0/12
│   ├── Env pool (prod): 10.0.0.0/14
│   │   ├── account-prod-A : auto-allocated /16
│   │   └── account-prod-B : auto-allocated /16
│   └── Env pool (stg):  10.4.0.0/14
└── Region pool (us-east-1): 10.16.0.0/12
```

#### 핵심 기능

| 기능 | 설명 |
|---|---|
| **자동 할당** | VPC 생성 시 `--ipv4-ipam-pool-id` 만 지정, CIDR 은 IPAM 이 골라줌 |
| **충돌 차단** | 풀 내에서 이미 할당된 CIDR 재사용 ❌ |
| **사용량 추적** | dashboard 에 free/in-use ratio. 80% 넘으면 alert |
| **public IP insights** | "in-use public IPv4 N개" 가시화 — 비용 cleanup 의 입구 |
| **BYOIP 통합** | BYOIP 풀을 IPAM 에 등록해 자동 할당 가능 |
| **cross-account** | RAM (Resource Access Manager) 으로 풀 공유 |

#### Tier (2024+ 가격 모델)

| Tier | 기능 | 비용 |
|---|---|---|
| **Free Tier** | 단일 account, public IP insights | 무료 |
| **Advanced Tier** | cross-account, cross-region, BYOIP, compliance 추적 | IP 당 시간당 과금 (~$0.00027/h) |

→ 작은 조직은 Free Tier 로 public IP insights 만 활용해도 비용 절감 효과.

#### IPAM 없이 운영 vs IPAM 도입 후

| 항목 | 없이 (Slack) | IPAM |
|---|---|---|
| 새 VPC CIDR 결정 | 사람이 spreadsheet | API 자동 |
| 충돌 발견 시점 | peering 시도 → 실패 | VPC 생성 차단 |
| 회수된 CIDR 재사용 | 휴먼 메모리 | 자동 |
| 멀티 region | 휴먼 동기화 | top-level pool 1개 |

### 3-5. BYOIP — Bring Your Own IP

#### 절차 (IPv4 기준)

```
1. 자체 보유 IP 풀 확인          : 최소 /24 (256 IP) 단위
2. ROA (Route Origin Authorization) 생성  : RPKI 시스템에 AWS ASN (Amazon's Autonomous System Number) 등록
3. AWS 에 import 신청           : aws ec2 provision-byoip-cidr
4. AWS 검증                     : ROA 매칭, 자체 보유 증명 확인 (signed authorization message)
5. advertise                    : aws ec2 advertise-byoip-cidr (BGP 광고 시작)
6. EIP / public IP 풀로 사용
```

- ROA: 인터넷 라우팅 보안 표준. "이 prefix 를 이 ASN 만 광고할 수 있다" 를 RPKI 로 서명.
- AWS ASN 16509 (또는 region 별 ASN) 을 ROA 에 등록 → AWS 만 광고 가능 → hijacking 방지.
- 검증 통과 후에야 EIP 풀로 활용 가능. **검증에 수일 ~ 수주** 걸릴 수 있음.

#### IPv6 BYOIP

- 최소 단위 `/48` (글로벌 라우팅 가능 최소).
- 자체 보유 `/48` 또는 `/44` 를 import 가능.
- IPv6 는 풀이 충분해서 BYOIP 동기는 "평판" 보다 **번호 정책 / 정부 규제** 인 경우가 많음.

#### 사용 use case

| 시나리오 | BYOIP 동기 |
|---|---|
| **B2B API** 고객사가 IP whitelist | EIP 변경 시 고객 방화벽 갱신 비용 — BYOIP 로 영구 |
| **이메일 발신** | 5년 쌓은 IP 평판 보존 — AWS 신규 EIP 는 reputation 0 부터 |
| **금융 / 정부** | 자체 IP 자산 정책상 외부 풀 사용 ❌ |
| **CDN edge** | 특정 IP 가 광고/통계상 노출 — 변경 시 metadata 깨짐 |

#### 함정

- BYOIP 풀은 **AWS region 1개에만 광고**. 멀티 region 이면 풀을 쪼개거나 region 마다 별도 풀.
- import 후 일정 기간 (90일+) 회수 불가 — 실수로 import 하면 묶임.
- ROA 만료 시 광고 중단 → 외부 도달 불가. **ROA 만료 모니터링 필수**.

---

## 4. 사용 예제

### 4-1. dual-stack VPC 생성 (Terraform)

```hcl
resource "aws_vpc" "main" {
  cidr_block                       = "10.0.0.0/16"
  assign_generated_ipv6_cidr_block = true   # Amazon /56 자동 할당

  enable_dns_support   = true   # §21 deep dive
  enable_dns_hostnames = true

  tags = { Name = "msa-prod" }
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.10.0/24"
  ipv6_cidr_block   = cidrsubnet(aws_vpc.main.ipv6_cidr_block, 8, 0)  # /64
  availability_zone = "ap-northeast-2a"

  assign_ipv6_address_on_creation = true
}

resource "aws_egress_only_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {  # IPv4 outbound
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
  route {  # IPv6 outbound (무료)
    ipv6_cidr_block        = "::/0"
    egress_only_gateway_id = aws_egress_only_internet_gateway.main.id
  }
}
```

### 4-2. ALB scheme `dualstack-without-public-ipv4`

```hcl
resource "aws_lb" "gateway" {
  name               = "msa-gateway"
  load_balancer_type = "application"
  ip_address_type    = "dualstack-without-public-ipv4"  # IPv6 만 public, IPv4 는 internal
  subnets            = aws_subnet.public[*].id          # public 서브넷이지만 IPv4 EIP 안 씀
}
```

→ ALB 의 public IPv4 비용 0. IPv6 만으로 외부 노출. IPv4 client 는 64:ff9b 형태의 NAT64 prefix 로 처리 (CloudFront 앞단 두면 자동).

### 4-3. IPAM 풀 생성 + VPC 자동 할당

```hcl
resource "aws_vpc_ipam" "main" {
  operating_regions {
    region_name = "ap-northeast-2"
  }
}

resource "aws_vpc_ipam_pool" "top" {
  address_family = "ipv4"
  ipam_scope_id  = aws_vpc_ipam.main.private_default_scope_id
  locale         = "ap-northeast-2"
}

resource "aws_vpc_ipam_pool_cidr" "top" {
  ipam_pool_id = aws_vpc_ipam_pool.top.id
  cidr         = "10.0.0.0/8"
}

resource "aws_vpc_ipam_pool" "prod" {
  address_family      = "ipv4"
  ipam_scope_id       = aws_vpc_ipam.main.private_default_scope_id
  source_ipam_pool_id = aws_vpc_ipam_pool.top.id
  locale              = "ap-northeast-2"
  allocation_default_netmask_length = 16
}

# VPC 가 IPAM 에서 자동 할당
resource "aws_vpc" "auto" {
  ipv4_ipam_pool_id   = aws_vpc_ipam_pool.prod.id
  ipv4_netmask_length = 16   # CIDR 은 IPAM 이 골라줌
}
```

### 4-4. BYOIP CLI 흐름

```bash
# 1. ROA 등록 (ARIN/APNIC 등 RIR 콘솔에서)
#    Origin AS: 16509 (AWS), Prefix: 203.0.113.0/24, Validity: 1y

# 2. provisioning
aws ec2 provision-byoip-cidr \
  --cidr 203.0.113.0/24 \
  --cidr-authorization-context Message="...",Signature="..." \
  --description "company-byoip-pool-1"

# 3. 상태 확인 (수 시간 ~ 수일)
aws ec2 describe-byoip-cidrs --max-results 10
# state: pending-provision → provisioned

# 4. advertise (BGP 광고 시작)
aws ec2 advertise-byoip-cidr --cidr 203.0.113.0/24

# 5. EIP 할당 (BYOIP 풀에서)
aws ec2 allocate-address --public-ipv4-pool ipv4pool-ec2-xxxxx
```

### 4-5. msa K8s pod CIDR 결정 (EKS VPC CNI dual-stack)

```yaml
# eks cluster networkConfig
networkConfig:
  ipFamily: IPv6                           # dual-stack 모드
  serviceIpv4Cidr: 172.20.0.0/16           # K8s service CIDR (VPC 와 별개)
  serviceIpv6Cidr: <auto>
```

```yaml
# VPC CNI configmap
data:
  ENABLE_IPv6: "true"
  ENABLE_PREFIX_DELEGATION: "true"   # /28 prefix 단위 ENI 할당 (pod 밀도 ↑)
```

→ pod 은 VPC IPv6 `/64` 서브넷에서 직접 IP 할당. 외부 outbound 는 EIGW 통해 무료.

---

## 5. 트레이드오프 / 안티패턴

### 5-1. dual-stack 켜고 IPv6 라우팅 안 만들기

```
VPC : assign_generated_ipv6_cidr_block = true
Subnet : ipv6_cidr_block = ...
Route Table : (IPv6 라우팅 없음)
```

- IPv6 주소는 할당되는데 outbound 가 안 됨. 클라이언트가 AAAA 받고 IPv6 로 시도 → timeout → IPv4 fallback (Happy Eyeballs).
- 사용자는 "느려졌다" 만 느끼고 원인 모름.

→ **IPv6 enable 시 라우팅도 같이** (EIGW + ::/0).

### 5-2. NAT GW 를 IPv6 트래픽에도 라우팅

```
Route Table : ::/0 → nat-xxxxx  ← ❌ NAT GW 는 IPv4 만
```

- NAT GW 는 IPv6 packet 처리 ❌. 라우팅이 fail.
- IPv6 outbound 는 **반드시 EIGW**.

### 5-3. IPAM 풀 너무 잘게 쪼개기

```
top: /8
├── /12
│   ├── /14
│   │   ├── /16
│   │   │   ├── /18  ← VPC 단위
```

- 5단계 넘어가면 풀 관리 복잡도 폭증.
- 권장: top → region → env(prod/stg/dev) → account/VPC 정도 3~4 단계.

### 5-4. BYOIP 풀을 임시 테스트로 쓰기

- BYOIP 는 import 후 90일+ 회수 불가. "테스트해보고 싶다" 로 import 했다가 묶이는 사례.
- 자체 풀이 비싼 자산임을 인지하고 production 이전 계획이 명확할 때만.

### 5-5. IPv6-only EKS 에서 Helm chart 가 IPv4 image registry 호출

- Helm chart 가 `index.docker.io` 같은 IPv4-only registry 호출 → pod 이 image pull 실패.
- 해결: NAT64 / DNS64 enable, 또는 ECR (Elastic Container Registry) 으로 image mirror.
- msa 의 EKS 이전 시 **dual-stack 권장** (IPv6-only 는 외부 의존성 검증 후 단계적).

### 5-6. secondary CIDR 로 `100.64.0.0/16` 쓰면서 온프레와 peering

- `100.64.0.0/10` 은 CGNAT (Carrier-Grade NAT) 대역. AWS 는 secondary CIDR 로 허용하지만 **온프레 CGNAT 와 충돌** 가능.
- 온프레 ↔ AWS DX (Direct Connect) / VPN 환경이면 secondary 도 사설 RFC 1918 권장.

### 5-7. ROA 만료 모니터링 누락

- ROA TTL 이 끝나면 BYOIP advertise 가 끊겨 IP 가 외부에서 도달 불가.
- BYOIP 도입 시 **ROA 만료 1개월 전 alert** 가 필수 (CloudWatch Event / 캘린더).

### 5-8. "IPv6 켰으니 IPv4 비용 0" 오해

- ALB 에 `dualstack-without-public-ipv4` 안 쓰고 그냥 `dualstack` 이면 public IPv4 비용 그대로.
- NAT GW 도 그대로 살아있으면 IPv4 outbound 트래픽 비용 그대로.
- IPv6 는 **추가** 일 뿐 IPv4 를 자동 끄지 않는다. 끄려면 명시적 `ip_address_type` 변경 + NAT GW 제거.

---

## 6. msa 적용

### 6-1. 현재 (k3d 로컬)

- k3d 클러스터는 IPv4-only. pod CIDR `10.42.0.0/16` (k3d default), service CIDR `10.43.0.0/16`.
- IPv6 / IPAM / BYOIP 와 무관 — 로컬 k3d 의 한계.

### 6-2. EKS 이전 시 결정 트리

```
Q1. dual-stack vs IPv6-only?
  → dual-stack 권장 (IPv6-only 는 외부 의존성 매트릭스 검증 후)

Q2. VPC CIDR 결정?
  → primary 10.x.x.x/16 + secondary 100.64.0.0/16 (pod 전용)
  → IPv6 : Amazon /56 (BYOIP 동기 없음 — msa 외부 노출 IP 평판 미보유)

Q3. EIGW 도입?
  → ✅ — IPv6 outbound 무료, NAT GW 비용 절감 (특히 dev/stg)

Q4. ALB scheme?
  → "dualstack-without-public-ipv4" 권장 (public IPv4 비용 0)
  → 단 IPv6 미지원 client 비율 측정 후 결정 (한국 IPv6 모바일 30%+)

Q5. IPAM 도입?
  → account 1개면 Free Tier 만, 2개+ 이면 Advanced Tier
  → public IP insights 만이라도 켜기 (비용 cleanup)
```

### 6-3. CIDR 할당안 (제안)

| 환경 | Primary IPv4 | Secondary (pod) | IPv6 |
|---|---|---|---|
| **prod** | `10.0.0.0/16` | `100.64.0.0/16` | Amazon `/56` |
| **stg**  | `10.10.0.0/16` | `100.65.0.0/16` | Amazon `/56` |
| **dev**  | `10.20.0.0/16` | `100.66.0.0/16` | Amazon `/56` |

→ env 간 peering 가능 (CIDR 비충돌). 향후 멀티 region 도 `10.0.0.0/8` top-level 풀 안에서 IPAM 자동 할당.

### 6-4. 비용 영향 추정

| 항목 | IPv4-only | dual-stack-no-pub-ipv4 | 절감 |
|---|---|---|---|
| ALB public IP × 6 | $22/월 | $0 | -$22 |
| NAT GW × 3 (data) | $50/월 (가정) | $30 (IPv6 반은 EIGW 로) | -$20 |
| EKS endpoint × 2 | $7/월 | $0 (private endpoint) | -$7 |
| **합** | **$79** | **$30** | **-$49 (62%)** |

→ msa 규모에선 절대값은 작지만 **dev/stg/prod × multi-region** 시 곱연산.

---

## 7. ADR 후보

> **ADR-XXXX-N: msa EKS 이전 시 dual-stack VPC + Egress-only IGW 채택**
>
> **Context**: 2024-02 부터 in-use public IPv4 가 시간당 과금. msa EKS 이전 시 ALB / NAT GW / EKS endpoint 의 public IPv4 가 월 $79+ (단일 region 기준). multi-env / multi-region 시 곱연산. IPv6 마이그레이션은 추가 학습 곡선이 있으나 EIGW 기반 outbound 가 무료라 비용 효과 큼.
>
> **Decision**: dual-stack VPC + EIGW 채택.
> - Primary IPv4 `/16` + Secondary `100.64.0.0/16` (pod 전용) + Amazon IPv6 `/56`.
> - ALB scheme `dualstack-without-public-ipv4` (public IPv4 비용 0).
> - private subnet 라우팅: IPv4 → NAT GW, IPv6 → EIGW.
> - EKS VPC CNI `ENABLE_IPv6=true` + Prefix Delegation.
> - IPv6-only 는 보류 (외부 의존성 매트릭스 검증 후 Phase 2).
> - IPAM 은 account 2개 이상 시점에 Free Tier 부터 도입.
>
> **Consequences**:
> - (+) public IPv4 비용 ~62% 절감 추정.
> - (+) IPv6 outbound 무료 — NAT GW 데이터 처리 비용 일부 우회.
> - (-) dual-stack 운영 복잡도 (라우팅 ::/0 + 0.0.0.0/0 양쪽 관리).
> - (-) ALB `dualstack-without-public-ipv4` scheme 의 IPv4 client compat 검증 필요 (CloudFront 앞단 두면 자동).
> - (-) 운영팀 IPv6 디버깅 학습 곡선.
>
> **Alternatives 검토**:
> - IPv4-only 유지 — 비용 발생 지속. 채택 ❌.
> - IPv6-only — 외부 의존성 (registry / SaaS) 호환성 리스크. Phase 2 검토.
> - BYOIP — msa 는 외부 노출 IP 평판 자산 없음. 채택 ❌.

---

## 8. 면접 한 줄 답변

### Q. 2024년 IPv4 과금 변경의 영향은?

> "2024년 2월부터 모든 in-use public IPv4 가 시간당 $0.005 (월 약 $3.6/IP) 과금됩니다. ALB / NAT GW / EKS public endpoint / EC2 자동 public IP 모두 대상이라 100 IP 환경이면 월 $400+ 추가 비용입니다. 대응책은 ALB scheme 을 `dualstack-without-public-ipv4` 로 바꾸기, IPv6 + Egress-only IGW 도입, NAT GW 통합, IPAM public IP insights 로 미사용 IP 회수 — 4가지가 표준입니다."

### Q. NAT Gateway 와 Egress-only IGW 의 차이는?

> "NAT GW 는 IPv4 의 outbound + return 을 처리하는 stateful 게이트웨이로 시간당 + 데이터당 과금됩니다. Egress-only IGW 는 IPv6 전용 outbound-only 비대칭 게이트웨이로 NAT 변환을 안 하고 (IPv6 는 globally routable) stateful filtering 만 합니다. 결정적 차이는 **EIGW 는 무료** 라는 점이고, IPv6 라우팅은 NAT GW 로 보내면 fail 하므로 라우팅 테이블에 ::/0 → eigw 를 명시해야 합니다."

### Q. dual-stack vs IPv6-only 결정 기준은?

> "외부 의존성 IPv6 호환성 매트릭스가 깨끗하면 IPv6-only, 의존성이 있으면 dual-stack 입니다. 한국 모바일 기준 IPv6 client 비율이 30%+ 라 dual-stack 만으로도 절반 이상 트래픽이 IPv6 로 빠집니다. IPv6-only 의 함정은 IPv4-only image registry / SaaS 호출인데 NAT64 + DNS64 로 우회 가능하지만 NAT GW 비용이 다시 발생합니다. msa 같은 신규 EKS 이전이면 **dual-stack 으로 시작 → Phase 2 에서 IPv6-only 검토** 가 안전한 경로입니다."

### Q. VPC 의 CIDR 블록 한도는?

> "Primary IPv4 1개 (생성 시 고정, 변경 불가, /16~/28 범위) + Secondary IPv4 4개 (추가/제거 가능, primary 와 비충돌) + IPv6 /56 1개 (Amazon 또는 BYOIPv6) 입니다. 서브넷 IP 가 부족하면 Secondary CIDR 로 확장하는 게 일반적인 패턴이고, EKS pod 전용 secondary 로 `100.64.0.0/16` (CGNAT 대역) 을 쓰는 것이 AWS 권장입니다 — primary 를 보호하고 pod 만 격리해서."

### Q. IPAM 의 핵심 가치는?

> "멀티 account / 멀티 region 환경에서 IP 풀을 계층적으로 정의하고 자동 할당해서 CIDR 충돌을 원천 차단하는 게 핵심입니다. 부수 가치는 사용량 추적 (80% 시 alert), public IP insights (in-use IPv4 가시화 → 비용 cleanup), BYOIP 통합, RAM 으로 cross-account 풀 공유. account 1개면 Free Tier 만으로도 public IP insights 효과가 충분합니다."

### Q. BYOIP 는 언제 쓰나요?

> "자체 보유 public IP 의 평판 / whitelist 를 보존해야 할 때입니다. B2B API 고객사가 IP whitelist 로 묶여있거나, 5년간 깨끗하게 관리한 메일 발신 IP 평판을 옮길 때 대표적입니다. 절차는 ROA (Route Origin Authorization) 를 RPKI 시스템에 등록 — Origin AS 를 AWS ASN (16509) 로 — AWS 에 provision 신청, 검증 후 advertise 하면 EIP 풀로 사용 가능합니다. 함정은 import 후 90일+ 회수 불가, ROA 만료 시 광고 끊김, region 1개에만 광고 — 3가지입니다."

### Q. msa EKS 이전 시 IP 설계는?

> "Primary `10.0.0.0/16` + Secondary `100.64.0.0/16` (pod 전용) + Amazon IPv6 /56 의 dual-stack 이 권장입니다. ALB 는 `dualstack-without-public-ipv4` scheme 으로 public IPv4 비용 0, private subnet 라우팅은 IPv4 → NAT GW + IPv6 → EIGW 로 분기, EKS VPC CNI 는 IPv6 + Prefix Delegation 으로 pod 밀도 확보. IPAM 은 account 가 2개 이상이 되는 시점에 Free Tier 부터 도입해서 충돌 차단 + public IP insights 로 비용 cleanup 입구로 씁니다."

---

## 9. 흔한 오해 정정

> **"IPv6 만 켜면 자동으로 비용 절감된다"**

- ❌ IPv6 는 **추가** 일 뿐. ALB scheme 을 `dualstack-without-public-ipv4` 로 명시하거나 NAT GW 를 제거해야 실제 절감. IPv4 인프라가 그대로 살아있으면 비용도 그대로.

> **"NAT GW 가 IPv6 트래픽도 처리한다"**

- ❌ NAT GW 는 IPv4 전용. IPv6 outbound 는 **Egress-only IGW** 별도 라우팅 필요. ::/0 → nat 으로 라우팅하면 silent fail.

> **"VPC CIDR 은 나중에 변경 가능하다"**

- ❌ Primary CIDR 은 생성 시 고정 — VPC 재생성만이 답. Secondary 는 4개까지 추가/제거 가능. **잘못된 primary 는 영구**.

> **"IPv6 서브넷도 prefix 길이 자유"**

- ❌ IPv6 서브넷은 **`/64` 고정**. VPC `/56` 안에서 256개 `/64` 서브넷 생성 가능. 다른 prefix 길이 ❌.

> **"IPAM 은 비싼 enterprise 기능"**

- ⚠ Advanced Tier 는 IP 당 시간당 과금이지만 **Free Tier** 도 있고 single account 면 충분. public IP insights 만 켜도 비용 절감 입구로 가치 있음.

> **"BYOIP import 는 즉시"**

- ❌ ROA 검증에 수일 ~ 수주. import 후 90일+ 회수 불가. 사전 계획 필수.

> **"Egress-only IGW 는 NAT 한다"**

- ❌ EIGW 는 NAT 안 함 (IPv6 는 globally routable). stateful filtering 만. 이름이 "Egress-only" 인 건 outbound 만 허용한다는 뜻.

> **"`100.64.0.0/16` 은 사설 IP 다"**

- ⚠ 정확히는 **CGNAT 대역** (RFC 6598). RFC 1918 사설은 아니지만 AWS 가 secondary 로 허용하고 EKS pod 용으로 권장. 단 온프레와 CGNAT 충돌 가능성 있어 DX/VPN 환경이면 RFC 1918 권장.

> **"IPv6 dual-stack 켜면 client 가 자동으로 IPv6 쓴다"**

- ⚠ DNS 가 AAAA record 를 반환해야 하고, 이는 `enableDnsHostnames=true` + AWS 서비스의 IPv6 지원 + Route 53 AAAA record 가 모두 갖춰져야 함. 하나라도 빠지면 client 는 A record (IPv4) fallback.

---

## 10. 회독 체크리스트

> §20 회독 체크리스트:
> - [ ] 2024-02 IPv4 과금 변경의 4가지 대응 (dualstack-no-pub-ipv4 / EIGW / NAT 통합 / public IP insights)
> - [ ] VPC CIDR 한도: primary 1 + secondary 4 + IPv6 /56 1 — primary 변경 ❌
> - [ ] secondary 로 `100.64.0.0/16` 쓰는 EKS pod 전용 패턴 + 온프레 CGNAT 충돌 주의
> - [ ] dual-stack vs IPv6-only 결정 트리 (외부 의존성 매트릭스 + NAT64/DNS64 비용)
> - [ ] IPv6 서브넷은 /64 고정 (VPC /56 안에서 256 서브넷)
> - [ ] NAT GW vs Egress-only IGW 5가지 차이 (IPv4 vs IPv6 / 변환 / stateful / inbound 차단 / 비용)
> - [ ] private subnet 라우팅 패턴: 0.0.0.0/0 → NAT GW + ::/0 → EIGW (혼동 시 silent fail)
> - [ ] IPAM 풀 계층 (top → region → env) 3~4 단계 권장
> - [ ] IPAM Free vs Advanced Tier — single account 는 Free 충분
> - [ ] BYOIP 절차: ROA → provision → advertise — 검증 수일+, 90일 회수 불가
> - [ ] BYOIP use case 4 (B2B whitelist / 메일 평판 / 금융규제 / CDN edge)
> - [ ] msa EKS 이전 권장: dual-stack + EIGW + IPAM Free Tier (account 1개 → 2개 시 Advanced)
> - [ ] ALB `dualstack-without-public-ipv4` scheme 효과 (public IPv4 비용 0)

---

## 11. 연결 학습

- §01 VPC — CIDR 블록 기본 (이 파일은 secondary / IPv6 확장)
- §02 Subnet — 서브넷 단위 IP 분할 (이 파일은 IPv6 /64 고정 제약)
- §03 IGW — 양방향 IGW (이 파일은 단방향 EIGW 와 대비)
- §07 NAT GW — IPv4 outbound (이 파일은 IPv6 EIGW 무료 alternative)
- §13 EKS networking — VPC CNI + pod IP (이 파일은 secondary CIDR + IPv6 enable)
- §17 msa mapping — EKS 이전 plan (이 파일이 CIDR / IPv6 결정 입력)
- §21 (다음) DNS / DHCP / SG references — `enableDnsHostnames` 가 IPv6 AAAA 의 전제
