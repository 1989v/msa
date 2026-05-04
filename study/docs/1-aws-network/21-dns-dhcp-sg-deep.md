---
parent: 1-aws-network
seq: 21
title: DNS / DHCP options / Route 53 Resolver / SG references / VPC Lattice — service identity deep dive
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 01-vpc.md
  - 05-security-group.md
  - 06-nacl.md
  - 13-eks-networking.md
  - 15-route53.md
  - 17-msa-mapping.md
  - 20-ipv6-ipam-byoip.md
sources:
  - https://docs.aws.amazon.com/vpc/latest/userguide/vpc-dns.html
  - https://docs.aws.amazon.com/vpc/latest/userguide/VPC_DHCP_Options.html
  - https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver.html
  - https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zone-private.html
  - https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html
  - https://docs.aws.amazon.com/vpc-lattice/latest/ug/what-is-vpc-lattice.html
catalog-row: "§A (DHCP/DNS) — DHCP options set (★) / DNS resolution (🟡) · §B (보안) — SG references (🟡) · §D (VPC Lattice ★)"
---

# 21. DNS / DHCP options / Route 53 Resolver / SG references / VPC Lattice — service identity deep dive

> 카탈로그 매핑: §99 §A — `DHCP options set` (★ → ✅), `DNS resolution / hostnames` (🟡 → ✅) · §B — `SG references (sg ↔ sg)` (🟡 → ✅) · §D — `VPC Lattice` (★ → 🟡 — 개념 소개 수준).
> 학습 시간 예상: ~2.5h · 자가평가 입구 레벨: B

> "어떤 트래픽을 누구에게 허용할 것인가" 의 정체성 (identity) 을 IP 가 아닌 **이름** (DNS) 또는 **그룹** (SG / sg id) 으로 표현하는 것이 마이크로서비스 시대의 표준이다. 본 deep file 은 VPC 의 DHCP (Dynamic Host Configuration Protocol) options set, `enableDnsSupport` / `enableDnsHostnames` 의 미묘한 차이와 함정 (특히 EKS endpoint 를 죽이는 case), Route 53 (Domain Name System) Resolver 로 온프레 ↔ AWS hybrid DNS 구성, Private Hosted Zone (PHZ) 의 cross-account 연결, Security Group 의 **SG-to-SG 참조** 라는 동적 IP 회피 패턴 (msa 마이크로서비스 간 호출의 핵심), SG 한계 (rule 수 / per-ENI / VPC 단위), 그리고 2023+ 등장한 **VPC Lattice** 가 service mesh 대안으로 어떻게 자리잡는지를 다룬다.

---

## 1. 한 줄 핵심

> **"이름과 그룹으로 트래픽을 표현하라" — IP 는 변동, 이름과 SG 는 영속.**
> VPC 의 DNS 동작은 `enableDnsSupport` (기본 켜짐, 끄면 모든 도메인 해석 ❌) + `enableDnsHostnames` (기본 꺼짐, 끄면 EC2 / EKS 가 public DNS name 못 받음) 두 스위치로 결정되고, 둘 다 켜져있어야 EKS public endpoint / S3 dualstack endpoint / VPC Endpoint private DNS 가 정상 동작한다. SG 의 **SG-to-SG 참조** 는 IP 대신 sg id 로 source 를 지정해서 IP 변동에 영향받지 않는 마이크로서비스 표준 패턴 — msa 의 NetworkPolicy podSelector 가 K8s 등가물이다. 다만 SG 는 rule 수 한도 (default 60 inbound + 60 outbound × 5 sg/ENI) 와 VPC 경계 제약이 있어서 1000+ 서비스 메쉬 규모에선 **VPC Lattice** 가 service-to-service 통신을 IAM (Identity and Access Management) auth + L7 routing 으로 통합 관리하는 대안으로 등장했다.

---

## 2. 등장 배경 — 왜 IP 대신 이름 / 그룹인가

### 2-1. 마이크로서비스 / Auto Scaling 의 IP 변동성

```
[전통 모노리스]
ALB SG inbound : from 10.0.10.42/32  ← App 서버 1대 IP

[MSA + Auto Scaling]
App 서버가 5 → 10 → 3 → 7 ... 자동 변동
IP도 계속 변동 → CIDR 기반 SG 룰로는 추적 불가
```

→ "App 서버 라는 *그룹*" 을 표현해야 함. 이게 **SG-to-SG 참조** 의 등장 배경.

### 2-2. 같은 함정 — 서비스 디스커버리

```
[전통]
HOSTS 파일 : product=10.0.1.5

[MSA]
product 의 IP 는 ALB / NLB 뒤에 숨고 변동
→ DNS 이름 product.commerce.svc.cluster.local 로 해석
```

→ "이름으로 부른다" — DNS 가 정체성 레이어가 됨. VPC 의 DNS 설정이 안 되어있으면 **마이크로서비스가 서로를 못 찾음**.

### 2-3. Hybrid (온프레 + AWS) 의 DNS 분리

```
[온프레] : 자체 AD (Active Directory) DNS — ldap.corp.local
[AWS]    : VPC default Route 53 Resolver — *.compute.internal
```

- 온프레 서버가 AWS 의 RDS endpoint 를 해석 ❌ (default 분리)
- AWS pod 이 사내 LDAP 을 해석 ❌

→ **Route 53 Resolver outbound / inbound endpoint** 가 두 영역의 DNS 를 잇는 다리.

### 2-4. SG 의 한계 → VPC Lattice 등장

서비스 100+ 가 되면:

- SG rule 60개 한도 — 호출 관계가 60+ 면 SG 분리 / 청크화 필요.
- VPC 경계 — 다른 VPC 의 SG 는 **참조 불가** (peering 가도 sg id 참조 ❌, peering된 VPC 끼리만 가능, 그조차 region 제약).
- IAM auth (요청자 검증) 이 native 로 없음 — mTLS / Istio sidecar 같은 추가 layer.

→ AWS 가 2023년 발표한 **VPC Lattice** 는 이 셋을 한 번에 해결: cross-VPC + IAM auth + L7 routing 을 관리형으로.

---

## 3. 동작 원리

### 3-1. VPC 의 DNS 두 스위치 — `enableDnsSupport` / `enableDnsHostnames`

#### 의미

| 스위치 | default | 의미 |
|---|---|---|
| **`enableDnsSupport`** | true | VPC 안에서 **DNS 해석 자체** 가능 여부. AWS DNS resolver (`.2` 주소) 동작. 끄면 어떤 도메인도 해석 ❌. |
| **`enableDnsHostnames`** | (VPC default) false / (default VPC) true | EC2 / ENI 가 **public DNS hostname** 을 받는지. 끄면 `ec2-..-..-..compute-1.amazonaws.com` 같은 이름 없음. PHZ private DNS 도 영향. |

#### 진리표

| `DnsSupport` | `DnsHostnames` | VPC 동작 |
|---|---|---|
| false | false | DNS 죽음. 어떤 호출도 ❌. |
| false | true | 의미 없음 (resolver 가 죽었으니 hostname 도 무용지물) |
| true | false | resolver 동작. 단 EC2 public DNS 없음, PHZ 사설 hostname 일부 ❌, **VPC Endpoint private DNS ❌**, **EKS public endpoint cluster autoresolution ❌**. |
| true | true | **권장 default** — 모든 기능 정상 |

#### 함정 — `enableDnsHostnames=false` 의 sidekick effect

```
사례 1: EKS public endpoint
  EKS cluster API server : <id>.gr7.<region>.eks.amazonaws.com
  → kubectl 가 이름 해석 시도 → DnsHostnames=false 면 일부 사설 변형 무동작

사례 2: VPC Interface Endpoint private DNS
  S3 Interface Endpoint : s3.<region>.amazonaws.com 을 사설 IP 로 매핑
  → DnsHostnames=false 면 매핑 invalid → public Internet 으로 우회 (또는 fail)

사례 3: PHZ
  PHZ : *.internal.commerce 를 사설 ENI IP 로 매핑
  → DnsHostnames=false 면 일부 query type 실패
```

→ 운영 룰: **두 스위치 모두 항상 true**. false 로 끄는 비용 절감 효과는 0, 손해만 큼.

### 3-2. DHCP options set — VPC 안 EC2 의 hostname / DNS 서버

#### 무엇인가

EC2 가 부팅할 때 받는 DHCP option 의 묶음. **VPC 단위**로 attach.

#### default DHCP options

```
domain-name           : <region>.compute.internal   (us-east-1 은 ec2.internal)
domain-name-servers   : AmazonProvidedDNS  (= VPC base + .2)
```

→ EC2 의 `/etc/resolv.conf` :
```
search ap-northeast-2.compute.internal
nameserver 10.0.0.2
```

#### 커스텀 DHCP options 의 use case

| 시나리오 | 설정 |
|---|---|
| 사내 AD 통합 | `domain-name = corp.local` + `domain-name-servers = 10.99.0.10, 10.99.0.11` (온프레 AD) |
| Route 53 Resolver outbound endpoint 사용 | resolver endpoint IP 를 nameserver 로 |
| NTP 서버 지정 | `ntp-servers = 169.254.169.123` |
| NetBIOS | 거의 deprecated |

#### 함정

- DHCP options set 변경 후 EC2 가 **DHCP renew 받기 전까지 적용 안 됨** (보통 2시간 lease). 즉시 적용하려면 EC2 재부팅 또는 `dhclient -r && dhclient`.
- VPC 1개에 attach 가능한 set 1개. 변경 시 **새 set 생성 후 VPC associate 변경** 만 가능 (in-place 수정 ❌).
- `domain-name-servers` 을 잘못 설정하면 **AmazonProvidedDNS 가 빠지면서** AWS 서비스 해석 ❌. **사내 AD + AmazonProvidedDNS 혼합** 이 안전 (resolver chain).

### 3-3. Route 53 Resolver — Hybrid DNS

#### 구성 요소

```
┌─────────── On-premises ───────────┐    ┌──────────── AWS VPC ─────────────┐
│                                   │    │                                  │
│  AD DNS (ldap.corp.local)         │    │  Route 53 Resolver (default)     │
│         ▲                         │    │     - VPC base + .2              │
│         │                         │    │     - PHZ 해석                   │
│   ┌─────┴──────┐ ENIs in subnet   │    │     - public 해석 (외부 위임)    │
│   │ Inbound EP │◀────── DNS ──────┼────┼──◀── 온프레 → AWS PHZ 해석 가능  │
│   └────────────┘                  │    │                                  │
│                                   │    │   ┌─────────────┐                │
│         (forward query)           │    │   │ Outbound EP │ ENIs in subnet │
│                ◀──── *.corp.local ┼────┼───└──────┬──────┘                │
│                                   │    │          │                       │
└───────────────────────────────────┘    │          ▼                       │
                                         │  Forwarding rules:               │
                                         │   *.corp.local → 온프레 DNS      │
                                         └──────────────────────────────────┘
```

| 컴포넌트 | 역할 |
|---|---|
| **Inbound endpoint** | 온프레 서버가 AWS PHZ / EC2 hostname 을 해석할 때 진입점. AWS 가 ENI 2+ 개 (HA) 생성 |
| **Outbound endpoint** | AWS 의 EC2/pod 이 온프레 도메인 해석할 때 forwarding rule 적용. ENI 2+ 개 |
| **Forwarding rule** | `*.corp.local → 10.99.0.10:53` 같은 매핑. shared via RAM 가능 |
| **Resolver query log** | DNS query log → S3 / CloudWatch Logs / Kinesis Firehose |
| **DNS Firewall** | 도메인 단위 allow/block + threat intel |

#### 동작 흐름 (AWS pod → 사내 LDAP)

```
pod : ldap.corp.local 해석 요청
  ↓
VPC default resolver (10.0.0.2)
  ↓
forwarding rule 매칭 (*.corp.local)
  ↓
outbound endpoint (ENI in private subnet)
  ↓
온프레 DNS (10.99.0.10) 응답
  ↓
pod 이 ldap IP 받음
```

#### 함정

- forwarding rule 의 target IP 가 **온프레 DNS 와 직접 통신 가능** 해야 함. DX (Direct Connect) / VPN tunnel + SG / route 점검.
- outbound endpoint 의 **ENI subnet 가 private** 이어야 함. public 이면 노출 위험.
- DNS query log 를 켜야 "어떤 pod 이 어떤 도메인 호출" 추적 가능 — 보안 audit 의 시작점.

### 3-4. Private Hosted Zone (PHZ) + cross-account

#### PHZ

```
PHZ : commerce.internal
├── product.commerce.internal    A 10.0.10.5
├── order.commerce.internal      A 10.0.11.7
└── *.api.commerce.internal      ALIAS dualstack.alb-xxx.elb.amazonaws.com
```

- **공개 인터넷 미노출** — VPC 안에서만 해석.
- 1개 PHZ 가 **여러 VPC** 에 associate 가능.
- VPC ↔ PHZ associate 는 같은 account 면 단순. cross-account 면 절차 필요.

#### Cross-account 연결 절차

```
1. account-A : PHZ 생성
2. account-A : create-vpc-association-authorization for VPC-B (account-B)
3. account-B : associate-vpc-with-hosted-zone (PHZ 가 자기 VPC 에 보이게)
4. account-A : delete-vpc-association-authorization (정리)
```

→ 두 account 모두 권한이 있어야 함. RAM 으로 공유는 ❌ (PHZ 는 RAM 미지원, 위 association 절차만).

#### 흔한 use case

| 시나리오 | PHZ 활용 |
|---|---|
| 마이크로서비스 service discovery | `*.svc.commerce.internal` 로 ALB / NLB ALIAS |
| RDS endpoint alias | `db.commerce.internal` → `prod-db.xxx.rds.amazonaws.com` (DB 이전 시 alias 만 변경) |
| 멀티 VPC 통합 | 1 PHZ → multi-VPC association → 모든 VPC 가 같은 이름 공간 공유 |
| public 와 분리 | 같은 도메인을 public 과 private 양쪽에 — split-horizon DNS |

### 3-5. SG references — sg-to-sg

#### 핵심 동작

```
ALB-SG (sg-aaa) :
  inbound 80, 443 from 0.0.0.0/0

App-SG (sg-bbb) :
  inbound 8080 from sg-aaa     ← SG-to-SG: ALB 의 어떤 IP 든 허용

DB-SG (sg-ccc) :
  inbound 3306 from sg-bbb     ← App SG 가 붙은 어떤 ENI 든 허용
```

→ "ALB-SG 가 붙어있는 ENI 의 source IP" 를 동적으로 모두 허용. 새 ALB 노드가 떠도 자동 매칭.

#### 정확한 의미 (자주 오해)

- "sg-aaa 자체" 가 source 인 게 아니라 **sg-aaa 가 attach 된 ENI 의 IP 들** 이 source 로 매칭.
- ENI 가 추가되면 즉시 허용 대상에 포함 (eventual consistency, 보통 < 30s).
- `0.0.0.0/0` 같은 wildcard 와 OR 결합 — 둘 중 하나라도 매칭이면 허용.

#### 한도

| 항목 | default | 증설 가능? |
|---|---|---|
| ENI 1개당 SG 수 | 5 | 최대 16 (요청 시) |
| SG 1개당 inbound rule 수 | 60 | 최대 1000 (요청 시) |
| SG 1개당 outbound rule 수 | 60 | 최대 1000 |
| **(rules per ENI) = SG수 × rules/SG** | 300 | 최대 16,000 |
| account 1개당 SG 수 | 2,500 | 증설 가능 |
| SG 룰에 참조한 SG 수 | rule 1개당 1개의 sg | — |
| **prefix list (managed/customer)** | rule 1개에서 1 prefix list = 그 안의 entry 수만큼 차지 | |

→ "1 ENI 의 effective rule 한도 = ΣSG(rule 수)" 이 진짜 한도. SG 1개 60 rule 라도 5 SG attach 면 300 rule effective.

#### Cross-VPC 의 제약

```
VPC-A : sg-aaa (App)
VPC-B : sg-bbb (DB)
peering-A↔B 활성

[질문] sg-bbb inbound 에 from sg-aaa 가능?
[답] peering 이 같은 region 이면 ✅ (가능), inter-region 이면 ❌
```

- **inter-region peering 에선 SG 참조 ❌** — IP CIDR 만 가능.
- TGW (Transit Gateway) 를 통해서도 SG 참조 ❌.
- 멀티 region / 멀티 VPC 환경에선 **prefix list** 또는 **VPC Lattice** 가 대안.

#### 동작하지 않는 경우 (silent fail 주의)

- **NACL 차단** — SG 가 허용해도 NACL 이 막으면 ❌. 양쪽 다 점검.
- **route table 미설정** — 라우팅이 없으면 SG 와 무관하게 ❌.
- **ephemeral port** — outbound 응답이 1024-65535 range. NACL 사용 시 명시 필요 (SG 는 stateful 이라 자동).

### 3-6. SG 의 다른 한계

| 한계 | 설명 |
|---|---|
| **Allow only** | Deny rule ❌. 특정 IP 차단은 NACL 또는 WAF (Web Application Firewall) |
| **VPC 단위** | VPC 경계 못 넘음 (cross-VPC 참조 제약) |
| **stateful 추적 비용** | 연결 수 많은 NLB target 에선 connection tracking 폭증 시 packet drop. unidirectional flow exemption 으로 일부 우회 |
| **rule 수정 즉시 반영** | 좋은 것 같지만 **이미 established 연결은 영향 ❌** (stateful 추적). 차단하려면 연결 재설정 필요 |
| **로깅** | SG 단독 로그 ❌. VPC Flow Logs 로 packet metadata 확인 |

### 3-7. VPC Lattice — service mesh 대안 (2023+)

#### 무엇인가

AWS 관리형 **service-to-service** 통신 layer. cross-VPC + cross-account + IAM auth + L7 routing 통합.

#### 구성 모델

```
Service Network (논리적 mesh 경계)
├── Service "product"
│   ├── target group : product NLB / Lambda / IP
│   ├── listener : HTTPS:443
│   ├── auth policy : "order 만 호출 가능" (IAM)
│   └── routing rule : path /v1/products/* → target group
├── Service "order"
└── ...
VPC associations : 어떤 VPC 가 이 service network 에 access 할 수 있나
```

#### 핵심 차별점 (vs SG / vs Istio)

| 측면 | SG | Istio (sidecar) | VPC Lattice |
|---|---|---|---|
| **scope** | VPC 내 | cluster 내 (or multi-cluster mesh) | cross-VPC + cross-account |
| **layer** | L3/L4 | L7 (sidecar) | L7 (managed) |
| **auth** | IP / sg id | mTLS + RBAC | IAM (SigV4) |
| **routing** | port | path / header / weight | path / header / weight |
| **운영 부담** | 낮음 | 높음 (sidecar / control plane) | 낮음 (관리형) |
| **비용** | 거의 0 | 운영 + EC2 sidecar | per-service-network + data |
| **적합 규모** | 10s services | 100s services | 100s services + cross-VPC |

#### 사용 시점

- 100+ 마이크로서비스 + cross-VPC 호출 빈번 + IAM 기반 auth 가 표준일 때.
- msa 같은 10s 서비스 single-VPC 에선 **NetworkPolicy + ALB** 면 충분 — Lattice 는 overkill.

#### 함정

- 비교적 신생 서비스 — region availability / 기능 매트릭스 변동.
- IAM auth 가 기본 — 호출자 SDK 가 SigV4 서명 필요. 일반 HTTP client 로 못 부름.
- cost 모델: per-service + per-request — 트래픽 폭증 시 예상보다 비쌈.

---

## 4. 사용 예제

### 4-1. VPC DNS 두 스위치 켜기 (Terraform)

```hcl
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true   # default true
  enable_dns_hostnames = true   # 명시적 켜기 (default false 인 non-default VPC)
}
```

→ 둘 다 true 가 권장 default. lifecycle ignore 로 절대 false 로 안 가게 묶는 것도 패턴.

### 4-2. 커스텀 DHCP options (사내 AD + AmazonProvidedDNS 혼합)

```hcl
resource "aws_vpc_dhcp_options" "main" {
  domain_name         = "corp.local"
  domain_name_servers = [
    "10.99.0.10",          # 사내 AD primary
    "10.99.0.11",          # 사내 AD secondary
    "AmazonProvidedDNS"    # AWS resolver 도 fallback (chain)
  ]
  ntp_servers = ["169.254.169.123"]
}

resource "aws_vpc_dhcp_options_association" "main" {
  vpc_id          = aws_vpc.main.id
  dhcp_options_id = aws_vpc_dhcp_options.main.id
}
```

→ EC2 의 resolv.conf:
```
search corp.local
nameserver 10.99.0.10
nameserver 10.99.0.11
nameserver 10.0.0.2
```

### 4-3. Route 53 Resolver outbound — AWS → 온프레

```hcl
resource "aws_security_group" "resolver" {
  name   = "route53-resolver-out"
  vpc_id = aws_vpc.main.id

  egress {
    from_port = 53
    to_port   = 53
    protocol  = "udp"
    cidr_blocks = ["10.99.0.0/16"]   # 온프레 DNS 대역
  }
  egress {
    from_port = 53
    to_port   = 53
    protocol  = "tcp"
    cidr_blocks = ["10.99.0.0/16"]
  }
}

resource "aws_route53_resolver_endpoint" "outbound" {
  name      = "outbound"
  direction = "OUTBOUND"
  security_group_ids = [aws_security_group.resolver.id]

  ip_address { subnet_id = aws_subnet.private_a.id }
  ip_address { subnet_id = aws_subnet.private_c.id }
}

resource "aws_route53_resolver_rule" "corp" {
  domain_name          = "corp.local"
  rule_type            = "FORWARD"
  resolver_endpoint_id = aws_route53_resolver_endpoint.outbound.id

  target_ip { ip = "10.99.0.10" }
  target_ip { ip = "10.99.0.11" }
}

resource "aws_route53_resolver_rule_association" "corp" {
  resolver_rule_id = aws_route53_resolver_rule.corp.id
  vpc_id           = aws_vpc.main.id
}
```

### 4-4. SG-to-SG 패턴 — 3-tier

```hcl
resource "aws_security_group" "alb" {
  name   = "alb-sg"
  vpc_id = aws_vpc.main.id

  ingress { from_port = 443 ; to_port = 443 ; protocol = "tcp" ; cidr_blocks = ["0.0.0.0/0"] }
}

resource "aws_security_group" "app" {
  name   = "app-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]   # ★ SG-to-SG
  }
}

resource "aws_security_group" "db" {
  name   = "db-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]   # ★ SG-to-SG
  }
}
```

→ ALB scale-out / app instance 추가 시 룰 변경 ❌. 자동 적용.

### 4-5. PHZ + cross-account association

```bash
# account-A (PHZ owner)
aws route53 create-vpc-association-authorization \
  --hosted-zone-id Z123 \
  --vpc VPCRegion=ap-northeast-2,VPCId=vpc-bbb-in-account-B

# account-B
aws route53 associate-vpc-with-hosted-zone \
  --hosted-zone-id Z123 \
  --vpc VPCRegion=ap-northeast-2,VPCId=vpc-bbb-in-account-B

# account-A (clean up)
aws route53 delete-vpc-association-authorization \
  --hosted-zone-id Z123 \
  --vpc VPCRegion=ap-northeast-2,VPCId=vpc-bbb-in-account-B
```

### 4-6. msa NetworkPolicy = SG-to-SG 의 K8s 등가

`k8s/base/network-policy/04-allow-backend-to-backend.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-order-to-product
  namespace: commerce
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: product
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: order   # ← "order pod 의 어떤 IP 든 허용"
      ports:
        - { port: http, protocol: TCP }
```

→ **podSelector** 가 SG-to-SG 의 정확한 K8s 등가물. IP 가 아닌 "label 그룹" 으로 source 표현.

---

## 5. 트레이드오프 / 안티패턴

### 5-1. `enableDnsHostnames=false` 로 두기

- VPC Endpoint private DNS 가 silent fail. EKS endpoint resolution 일부 깨짐.
- 비용 절감 효과 0, 손해만. **항상 true**.

### 5-2. DHCP options 의 `domain-name-servers` 에 AmazonProvidedDNS 누락

```
domain-name-servers = ["10.99.0.10", "10.99.0.11"]   ← AWS resolver 빠짐
```

- 사내 AD 가 AWS 서비스 도메인 (`*.amazonaws.com`) 해석 못 함.
- AWS PHZ / VPC Endpoint private DNS 도 안 됨.
- 권장: 사내 AD + **AmazonProvidedDNS 함께** 나열.

### 5-3. PHZ 와 public DNS 의 혼용 (split-horizon 함정)

```
PHZ "commerce.com" : api.commerce.com → 사설 ALB
public DNS "commerce.com" : api.commerce.com → 다른 public ALB
```

- VPC 안에선 사설, 밖에선 public 으로 해석되는 split-horizon.
- **PHZ 가 public 보다 우선** — 의도된 split 이면 OK, 아니면 디버깅 함정.

### 5-4. SG-to-SG 참조 대신 CIDR 박기

```
App-SG inbound 8080 from 10.0.10.0/24   ← ALB subnet CIDR
```

- ALB 가 다른 subnet 으로 옮기면 룰 깨짐.
- ALB 가 subnet 추가하면 누락 발견 어려움.
- **거의 모든 경우 SG-to-SG 가 우월**. CIDR 은 외부 partner / public 만.

### 5-5. SG rule 수 한도 무시

```
App-SG : inbound rule 60개 꽉 참
새 호출자 추가 시도 → CreateSecurityGroupRule 실패
```

- 60+ rule 이 필요하면 **prefix list** 로 묶거나 SG 분리.
- 또는 **VPC Lattice** 로 service-level routing 위임.

### 5-6. SG 룰 변경했는데 기존 연결이 그대로 (의도 vs 실제)

- SG rule 삭제 → 새 connection 차단됨, 하지만 **이미 established TCP 연결은 유지됨** (stateful tracking).
- 즉시 끊으려면 client 측에서 connection 재설정.
- 보안 incident 대응 시 NACL 로 차단 (stateless 는 모든 packet 검사) 하거나 ENI 재시작.

### 5-7. cross-region peering 에서 SG 참조 시도

- inter-region peering 에선 SG 참조 ❌ → IP CIDR 또는 prefix list.
- 멀티 region 환경이라면 **prefix list (RAM 공유)** 또는 VPC Lattice.

### 5-8. Route 53 Resolver outbound 가 public subnet 에

- outbound endpoint ENI 가 public subnet 에 있으면 resolver 가 외부에 노출.
- 권장: **private subnet 만**.

### 5-9. VPC Lattice 를 single-VPC 10 서비스에 도입

- 비용 + 학습 곡선 > 가치.
- 100+ 서비스 + cross-VPC 가 등장한 뒤 도입. 그전까진 SG + NetworkPolicy 충분.

### 5-10. NACL 로 SG 흉내내기

- NACL 은 stateless + 서브넷 단위 — IP allowlist 같은 단순 케이스에만.
- 마이크로서비스 간 동적 IP 환경에선 SG-to-SG 가 표준. NACL 은 보조.

---

## 6. msa 적용

### 6-1. 현재 (k3d 로컬)

- VPC / SG / Route 53 Resolver 와 무관 — 로컬 k3d.
- **NetworkPolicy** 는 이미 도입 (`k8s/base/network-policy/`).
  - `00-default-deny.yaml` — 기본 거부
  - `01-allow-dns-egress.yaml` — DNS egress 허용
  - `04-allow-backend-to-backend.yaml` — order → product (유일한 직접 호출)
  - `05-allow-app-to-mysql.yaml` 외 — DB / Redis / Kafka egress

→ "podSelector 로 SG-to-SG 흉내" 의 K8s 표준 패턴이 이미 자리잡음. EKS 이전 시 **NetworkPolicy → AWS SG 변환** 이 자연스러움.

### 6-2. EKS 이전 시 매핑

| msa NetworkPolicy | AWS SG 등가 |
|---|---|
| podSelector: gateway → backends | gateway-SG inbound 8080 from gateway-LB-SG ; backend-SG inbound from gateway-SG |
| podSelector: order → product | product-SG inbound from order-SG (SG-to-SG) |
| egress: app → MySQL (port 3306) | app-SG outbound 3306 to db-SG ; db-SG inbound 3306 from app-SG |
| default-deny | SG default deny inbound (모든 SG 의 default 가 inbound deny) |

#### EKS 의 SG 모델 — VPC CNI Branch ENI

- 일반: **노드 ENI 에 attach 된 SG 가 모든 pod 에 적용** — pod 별 격리 ❌.
- 향상: VPC CNI 의 `SecurityGroupPolicy` CRD (Custom Resource Definition) — **pod 별 SG** 가능. Branch ENI 별도 할당.
- msa 는 NetworkPolicy 로 충분 → SecurityGroupPolicy 까진 불필요. 단 "외부 RDS 접근을 특정 service 만" 같은 케이스가 등장하면 도입 후보.

### 6-3. PHZ 활용안

```
PHZ: internal.commerce
├── product.internal.commerce      ALIAS internal-ALB
├── order.internal.commerce        ALIAS internal-ALB
├── db.internal.commerce           CNAME prod-db.xxx.rds.amazonaws.com
└── es.internal.commerce           ALIAS opensearch-vpc-endpoint
```

→ 서비스가 db endpoint 를 직접 사용하지 않고 `db.internal.commerce` 로 호출 → DB 이전 / scale 시 alias 만 변경.

### 6-4. DHCP options — 단일 account 라면 default 유지

- msa 는 사내 AD 통합 없음 — default DHCP options 그대로.
- 멀티 account / 사내 통합 시 **AmazonProvidedDNS 포함한 chain** 으로 명시 변경.

### 6-5. Route 53 Resolver — 도입 시점

- 온프레 ↔ AWS hybrid 시점에 도입 (msa 단독 AWS 면 불필요).
- DNS query log 는 보안 audit 진입점이라 EKS production 시 **enable 권장**.

### 6-6. VPC Lattice — 보류

- msa 10여개 서비스 + single-VPC → NetworkPolicy + ALB 로 충분.
- 향후 msa 가 multi-VPC (분리된 도메인) + 100+ 서비스 시 재검토.

---

## 7. ADR 후보

> **ADR-XXXX-N: msa EKS 이전 시 NetworkPolicy → AWS SG (SG-to-SG) 매핑 + PHZ 도입**
>
> **Context**: 현재 msa K8s 환경은 NetworkPolicy 로 podSelector 기반 트래픽 통제 (`k8s/base/network-policy/`). EKS 이전 시 NetworkPolicy 는 그대로 동작하지만, 클러스터 외부 (RDS / OpenSearch / 사내 IP) 와의 격리는 AWS SG 가 1차 방어. SG-to-SG 참조 (sg id 로 source) 가 IP 변동에 영향받지 않는 마이크로서비스 표준 패턴이고, NetworkPolicy podSelector 와 1:1 매핑이 자연스러움. 또한 RDS / 사설 ALB endpoint 를 alias 로 추상화하면 인프라 이전 / scale 시 코드 변경 없이 endpoint 갱신 가능.
>
> **Decision**:
> - VPC `enableDnsSupport=true` + `enableDnsHostnames=true` 강제 (Terraform lifecycle ignore 로 보호).
> - SG 모델: ALB-SG → gateway-SG → backend-SG → db-SG 의 SG-to-SG chain (NetworkPolicy 와 1:1).
> - pod 별 SG 격리는 **불필요** (NetworkPolicy 로 충분). SecurityGroupPolicy CRD 는 외부 자원 격리 케이스 등장 시 도입.
> - PHZ `internal.commerce` 도입 — RDS / OpenSearch / internal ALB 를 alias 로 추상화.
> - DHCP options 는 default 유지 (사내 AD 통합 없음).
> - Route 53 Resolver / VPC Lattice 는 hybrid / multi-VPC 시점에 재검토 (현 시점 보류).
>
> **Consequences**:
> - (+) IP 변동에 영향받지 않는 SG 모델 — ALB scale-out / pod 추가 시 룰 변경 0.
> - (+) PHZ alias 로 인프라 이전 시 코드 변경 0.
> - (+) NetworkPolicy 와 일관성 — 동일 모델을 K8s + AWS 양쪽에 표현.
> - (-) SG rule 수 한도 (60 inbound × 5 SG/ENI = 300 effective) — 호출 관계 60+ 시 prefix list / 분리 필요.
> - (-) cross-region peering 시 SG 참조 ❌ — 향후 multi-region 이면 prefix list 도입.
>
> **Alternatives 검토**:
> - CIDR 기반 SG — 동적 환경에서 룰 깨짐. 채택 ❌.
> - SecurityGroupPolicy (pod 별 SG) 전면 도입 — overkill. 보류.
> - VPC Lattice — single-VPC 10 서비스에 overkill. 보류.

---

## 8. 면접 한 줄 답변

### Q. VPC 의 `enableDnsSupport` 와 `enableDnsHostnames` 의 차이는?

> "`enableDnsSupport` 는 VPC 안에서 DNS 해석 자체가 동작하는지 (AWS DNS resolver, .2 주소) 의 스위치이고 default true 입니다. `enableDnsHostnames` 는 EC2 / ENI 가 public DNS hostname 을 받는지의 스위치이고 non-default VPC 에선 default false 입니다. 둘 다 true 가 권장 default 인데, `enableDnsHostnames=false` 면 VPC Interface Endpoint private DNS 가 silent fail 하거나 EKS endpoint resolution 일부가 깨지는 함정이 있어서 절대 끄지 않습니다."

### Q. SG-to-SG 참조의 정확한 의미는?

> "Source 로 sg id 를 지정하면 'sg 가 attach 된 ENI 의 IP 들' 이 동적으로 매칭됩니다. ALB scale-out / Auto Scaling 으로 IP 가 추가되어도 룰 변경 없이 자동 적용 — 마이크로서비스 환경의 표준 패턴입니다. 한도는 ENI 당 5 SG × SG 당 60 inbound rule = 300 effective rule, 그리고 cross-region peering 에선 SG 참조 안 되고 IP CIDR 또는 prefix list 만 가능하다는 두 가지 제약이 있습니다."

### Q. SG 룰을 변경했는데 차단이 안 되는 이유는?

> "SG 는 stateful 이라 connection tracking 테이블에 이미 등록된 연결은 룰 변경 영향을 안 받습니다. 새 연결은 차단되지만 established TCP 는 유지됩니다. 즉시 끊으려면 client 가 reconnection 하거나, 보안 incident 대응 시 NACL (stateless 라 모든 packet 검사) 로 차단하거나 ENI 자체를 재시작합니다."

### Q. msa 의 NetworkPolicy 가 AWS SG 와 어떻게 매핑되나요?

> "NetworkPolicy 의 `podSelector` 가 AWS SG-to-SG 의 정확한 K8s 등가물입니다. msa 의 `04-allow-backend-to-backend.yaml` 이 'order pod label 을 가진 모든 IP 에서 product 의 8080 허용' 인데 EKS 이전 시 product-SG inbound 8080 from order-SG 로 1:1 매핑됩니다. pod 별 SG 격리 (SecurityGroupPolicy CRD) 까진 불필요하고 NetworkPolicy 로 충분 — 외부 RDS 같은 자원 격리 케이스 등장 시 도입을 검토합니다."

### Q. Route 53 Resolver 의 inbound / outbound endpoint 는 무엇인가요?

> "Hybrid DNS — 온프레 ↔ AWS DNS 를 잇는 다리입니다. **inbound endpoint** 는 온프레 서버가 AWS PHZ / EC2 hostname 을 해석할 때의 진입점, **outbound endpoint** 는 AWS pod / EC2 가 사내 도메인 (corp.local) 을 해석할 때 forwarding rule 로 온프레 DNS 에 위임하는 출구입니다. 둘 다 ENI 2+ 개 (HA) 로 private subnet 에 두고, forwarding rule 의 target IP 는 DX/VPN 경로로 도달 가능해야 합니다. DNS query log 를 enable 하면 어떤 pod 이 어떤 도메인 호출했는지 audit 가능 — 보안 진입점이기도 합니다."

### Q. PHZ 의 cross-account 연결은 어떻게 하나요?

> "RAM (Resource Access Manager) 으로는 공유 안 되고 별도 association 절차를 씁니다. PHZ owner account 에서 `create-vpc-association-authorization` 으로 다른 account 의 VPC 를 인증하고, 다른 account 가 `associate-vpc-with-hosted-zone` 으로 자기 VPC 에 PHZ 가 보이게 한 뒤, owner 가 authorization 을 정리합니다. 권한이 양쪽 다 필요한 게 RAM 과 다른 점이고, 공통 alias 도메인을 멀티 account 환경에 통일하는 표준 절차입니다."

### Q. VPC Lattice 는 언제 쓰나요?

> "100+ 마이크로서비스 + cross-VPC 호출 빈번 + IAM 기반 auth 가 표준일 때입니다. SG 가 VPC 경계를 못 넘고 cross-region peering 에서 SG 참조 안 되는 한계, Istio 같은 sidecar mesh 의 운영 부담 — 이 둘 사이의 관리형 대안입니다. msa 같은 single-VPC 10 서비스 규모는 NetworkPolicy + ALB 로 충분해서 overkill, 멀티 VPC + 100+ 서비스가 등장한 뒤 검토하는 게 맞습니다. 핵심 차별점은 **IAM SigV4 auth** 와 **L7 routing 관리형** 두 가지입니다."

### Q. DHCP options set 변경의 함정은?

> "VPC 1개에 attach 가능한 set 은 1개고 in-place 수정이 안 됩니다 — 새 set 생성 후 association 변경만 가능합니다. 변경 후 EC2 가 적용받는 시점은 **DHCP renew** (보통 2시간 lease) 라 즉시 적용하려면 재부팅 또는 dhclient 갱신이 필요합니다. 가장 흔한 함정은 `domain-name-servers` 에 사내 AD 만 적고 `AmazonProvidedDNS` 를 빼는 것 — AWS 서비스 도메인 / VPC Endpoint private DNS 가 모두 깨지므로 항상 사내 + AmazonProvidedDNS 혼합으로 chain 구성합니다."

---

## 9. 흔한 오해 정정

> **"SG 의 source 로 sg id 를 적으면 그 SG 가 source 다"**

- ❌ "sg 가 attach 된 ENI 의 IP들" 이 source 로 매칭. SG 자체는 라벨일 뿐.

> **"SG 룰 변경하면 즉시 모든 트래픽 차단된다"**

- ❌ stateful 이라 이미 established 연결은 유지. 새 연결만 차단. 즉시 끊으려면 NACL / ENI 재시작.

> **"`enableDnsSupport=true` 면 EC2 가 public DNS hostname 을 받는다"**

- ❌ public hostname 은 `enableDnsHostnames=true` 가 별도. 두 스위치는 직교.

> **"PHZ 는 RAM 으로 공유한다"**

- ❌ PHZ 는 RAM 미지원. cross-account association 은 별도 절차 (`create-vpc-association-authorization`).

> **"DHCP options 의 nameserver 에 사내 DNS 만 적으면 된다"**

- ❌ AmazonProvidedDNS 빠지면 AWS 서비스 도메인 / VPC Endpoint private DNS 해석 ❌. 항상 chain.

> **"Cross-region peering 에서도 SG 참조 가능"**

- ❌ inter-region peering 에선 SG 참조 ❌. IP CIDR 또는 prefix list 만.

> **"VPC Lattice 는 Istio 의 직접 대체"**

- ⚠ 부분 대체. L7 routing + auth 는 비슷하지만 sidecar 모델 / 세밀한 control plane 제어는 다름. cross-VPC + IAM auth 가 dominant 이유면 Lattice, 그 외엔 Istio 가 유연.

> **"Route 53 Resolver 는 public DNS 까지 위임한다"**

- ⚠ default Resolver 가 PHZ + 외부 위임 둘 다. **outbound endpoint** 는 사내 같은 특정 forwarding rule 만 위임. 모든 query 가 outbound 로 가는 게 아님.

> **"NetworkPolicy 가 있으면 SG 는 필요 없다"**

- ❌ NetworkPolicy 는 cluster 안만. 외부 (RDS / 사내 IP / VPC peering) 와의 격리는 SG / NACL 이 1차 방어. 둘은 보완.

> **"DHCP options 의 domain-name 만 바꾸면 즉시 적용"**

- ❌ EC2 가 DHCP renew 받기 전까지 적용 ❌. 보통 2시간. 즉시 적용은 재부팅 / dhclient.

---

## 10. 회독 체크리스트

> §21 회독 체크리스트:
> - [ ] `enableDnsSupport` (resolver 동작) vs `enableDnsHostnames` (public hostname) 직교 의미 + 둘 다 true 강제 이유
> - [ ] `enableDnsHostnames=false` 의 silent fail 3 케이스 (EKS endpoint / VPC Endpoint private DNS / PHZ 일부)
> - [ ] DHCP options set 함정 3가지 (in-place 수정 ❌ / renew 지연 / AmazonProvidedDNS chain 누락)
> - [ ] Route 53 Resolver inbound/outbound endpoint 의 역할 + private subnet 위치 강제
> - [ ] forwarding rule 의 target IP 가 DX/VPN 도달 가능해야 함
> - [ ] PHZ cross-account: RAM 미지원, `create-vpc-association-authorization` 절차
> - [ ] split-horizon DNS (PHZ vs public) — PHZ 우선
> - [ ] SG-to-SG 의 정확한 의미: "sg attach 된 ENI 의 IP 들"
> - [ ] SG 한도: ENI 당 5 SG × 60 rule = 300 effective + 증설 한도 16 SG × 1000 rule
> - [ ] cross-region peering 에서 SG 참조 ❌ — prefix list 또는 Lattice
> - [ ] SG stateful 함정: 룰 변경 후 established 유지 — NACL / ENI restart
> - [ ] SG 한계 5: Allow only / VPC 단위 / connection tracking 비용 / established 추적 / 로그 부재
> - [ ] VPC Lattice 의 차별점 3 (cross-VPC / IAM SigV4 auth / managed L7 routing)
> - [ ] VPC Lattice 도입 시점: 100+ 서비스 + cross-VPC + IAM auth 표준
> - [ ] msa NetworkPolicy podSelector = SG-to-SG 의 K8s 등가
> - [ ] EKS 의 pod 별 SG: SecurityGroupPolicy CRD + Branch ENI (NetworkPolicy 충분 시 불필요)

---

## 11. 연결 학습

- §01 VPC — VPC 안 DNS resolver `.2` 주소의 위치 (이 파일은 두 스위치)
- §05 Security Group — SG 기본 (이 파일은 SG-to-SG 참조 + 한도 + cross-region 제약)
- §06 NACL — stateless 보조 (이 파일은 SG stateful 함정 시 NACL fallback)
- §13 EKS networking — VPC CNI + pod 모델 (이 파일은 SecurityGroupPolicy CRD 보조 자원)
- §15 Route 53 — public hosted zone (이 파일은 PHZ + Resolver)
- §17 msa mapping — 마이크로서비스 매핑 (이 파일이 NetworkPolicy ↔ SG 매핑 입력)
- §20 IPv6 / IPAM — `enableDnsHostnames` 가 IPv6 AAAA 의 전제 (cross-link)
