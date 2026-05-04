---
parent: 1-aws-network
seq: 99
title: AWS 네트워크 개념 카탈로그 — Full-Coverage Index + 심화 템플릿
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - https://docs.aws.amazon.com/vpc/latest/userguide/
  - https://docs.aws.amazon.com/elasticloadbalancing/
  - https://docs.aws.amazon.com/AmazonVPC/latest/PrivateLink/
  - https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/
  - https://docs.aws.amazon.com/network-firewall/latest/developerguide/
  - https://docs.aws.amazon.com/global-accelerator/latest/dg/
---

# 99. AWS 네트워크 개념 카탈로그

> **목적** — 1-aws-network 의 deep file 들이 다룬 개념을 AWS 공식 문서 기준으로 매핑하고, 빠진 영역(IPv6, PrivateLink, Transit Gateway, Network Firewall, Global Accelerator, IPAM, Resource Access Manager 등)을 발굴하여 심화 후보로 정리한다.
>
> **소스 기준** — AWS 공식 docs (`docs.aws.amazon.com`) 의 VPC / ELB / Route 53 / Network Firewall / Direct Connect / Global Accelerator chapter 트리.

---

## 0. 사용법

`19-search-engine/99-concept-catalog.md` §0 와 동일. 새 개념 발견 → §2 표 행 추가 → 심화 노트 작성 시 §4 템플릿 사용 → 본 catalog 행 상태 갱신 (★ 신규 → ✅ 커버).

상태 표기: ✅ 커버 / 🟡 부분 / ★ 신규 / skip(사유)

---

## 1. 기존 커버 매트릭스

| 카테고리 | 핵심 개념 | 다룬 deep files (요약) |
|---|---|---|
| VPC 기초 | VPC / 서브넷 / 라우팅 테이블 / IGW / NAT GW | 01~04 (가설) |
| 보안 | Security Group / NACL / IAM (Identity and Access Management) 일반 | 05~07 |
| 로드 밸런싱 | ALB / NLB / target group / health check | 08~10 |
| 고가용성 | Multi-AZ (Availability Zone) / failover | 11~12 |
| 운영 | VPC Flow Logs / CloudWatch | 13~14 |
| msa 연결 | EKS (Elastic Kubernetes Service) 환경에서 본 주제들 적용 | 15~17 (가설) |
| 면접 카드 | 시나리오 + 트러블슈팅 | 18~20 |
| IPv6 / IPAM / BYOIP | dual-stack, IPv6-only subnet, Egress-only IGW, IPAM 풀, BYOIP, primary/secondary CIDR | ✅ ([20](20-ipv6-ipam-byoip.md)) |
| DNS / DHCP / SG references / VPC Lattice | DHCP options, enableDnsSupport/Hostnames, SG sg-id 참조, VPC Lattice mesh | ✅ ([21](21-dns-dhcp-sg-deep.md)) |

> 정확한 매핑은 각 deep file 의 frontmatter 와 헤딩으로 확인 — 본 표는 카테고리 단위 요약.

### 1-A. 갭 진단

AWS 공식 docs 카테고리 기준으로 다음 영역이 19 내 deep file 에 충분히 등장하지 않을 가능성:

1. **IPv6** — VPC dual-stack, IPv6-only subnet, egress-only IGW
2. **VPC Endpoints / PrivateLink** — Interface Endpoint vs Gateway Endpoint, 서비스 간 사설 통신
3. **Transit Gateway (TGW)** — multi-VPC / multi-account / on-prem hub
4. **Cloud WAN** — global mesh 관리형
5. **Direct Connect / Site-to-Site VPN** — 온프렘 ↔ AWS
6. **Route 53** — public/private hosted zone, latency/weighted/geo routing, health check
7. **Network Firewall** — stateful firewall (Suricata), TLS inspection
8. **Global Accelerator** — anycast IP, edge optimization
9. **AWS WAF / Shield** — L7 보호, DDoS
10. **CloudFront** — CDN + Origin Shield + behaviors
11. **API Gateway** — REST/HTTP/WebSocket
12. **VPC Lattice** — service-to-service mesh
13. **PrivateLink for SaaS** — Endpoint Service 제공자 측
14. **IPAM** — IP 주소 할당 자동 관리
15. **Resource Access Manager (RAM)** — cross-account 자원 공유
16. **Reachability Analyzer / Network Access Analyzer** — 경로 진단
17. **VPC Peering** vs TGW 선택
18. **Security Group references / prefix lists** — 동적 규칙
19. **NLB TLS termination + ALPN / target type IP / cross-zone**
20. **Connection draining / deregistration delay**
21. **EIP / BYOIP** — IP 풀 관리
22. **AWS Outposts / Local Zones / Wavelength** — edge 인프라

---

## 2. 카테고리별 개념 트리

### A. VPC 기초

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| **VPC** | 가상 사설 네트워크 — CIDR 블록 단위 | [VPC](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html) | ✅ 커버 |
| **Subnet (public/private)** | AZ 별 IP 분할 — public = IGW 라우팅 | docs/vpc/subnets | ✅ 커버 |
| **Route Table / Main vs Custom** | 서브넷 → 다음 hop 결정 | docs/vpc/route-tables | ✅ 커버 |
| **IGW (Internet Gateway)** | 양방향 인터넷 게이트웨이 | docs/vpc/internet-gateway | ✅ 커버 |
| **NAT Gateway / Instance** | private → 인터넷 outbound (단방향) | docs/vpc/vpc-nat-gateway | ✅ 커버 |
| **Egress-only IGW** | IPv6 전용 outbound | docs/vpc/egress-only-internet-gateway | ✅ 커버 ([20](20-ipv6-ipam-byoip.md)) |
| **CIDR 블록 (primary/secondary)** | IPv4 1차 + 4 secondary, IPv6 추가 | docs/vpc/vpc-ip-addressing | ✅ 커버 ([20](20-ipv6-ipam-byoip.md)) |
| **IPv6 (dual-stack / IPv6-only)** | dual-stack vs single-stack 결정 | docs/vpc/ipv6-on-aws | ✅ 커버 ([20](20-ipv6-ipam-byoip.md)) |
| **DHCP options set** | 도메인/DNS 서버 설정 | docs/vpc/VPC_DHCP_Options | ✅ 커버 ([21](21-dns-dhcp-sg-deep.md)) |
| **DNS resolution / hostnames** | enableDnsSupport / enableDnsHostnames | docs/vpc/vpc-dns | ✅ 커버 ([21](21-dns-dhcp-sg-deep.md)) |
| **IPAM (IP Address Manager)** | IP 풀 자동 할당, account 간 공유 | docs/vpc/what-is-it-ipam | ✅ 커버 ([20](20-ipv6-ipam-byoip.md)) |
| **Bring Your Own IP (BYOIP)** | 자체 보유 IP 풀 import | docs/vpc/vpc-byoip | ✅ 커버 ([20](20-ipv6-ipam-byoip.md)) |

### B. 보안 (네트워크 layer)

| 개념 | 1-줄 정의 | 링크 | 상태 |
|---|---|---|---|
| **Security Group** | stateful, 인스턴스 단위, allow only | docs/vpc/VPC_SecurityGroups | ✅ 커버 |
| **NACL (Network ACL)** | stateless, 서브넷 단위, allow + deny | docs/vpc/vpc-network-acls | ✅ 커버 |
| **SG references (sg ↔ sg)** | 동적 IP 회피 — sg id 로 source 지정 | docs | ✅ 커버 ([21](21-dns-dhcp-sg-deep.md)) |
| **Prefix lists (managed/customer)** | 재사용 가능한 CIDR 묶음 | docs/vpc/managed-prefix-lists | ★ 신규 |
| **Network Firewall** | Suricata 기반 stateful firewall, TLS inspection | docs/network-firewall | ★ 신규 |
| **AWS WAF (Web Application Firewall)** | L7 — SQLi/XSS/rate-based rule | docs/waf/latest/developerguide | ★ 신규 |
| **AWS Shield (Standard / Advanced)** | DDoS — Standard 무료, Advanced SLA + Cost protection | docs/shield | ★ 신규 |
| **Macie / GuardDuty** | 데이터 보안 / 위협 탐지 (간접 관련) | docs | skip (별 도메인) |

### C. 로드 밸런싱 / Traffic 라우팅

| 개념 | 1-줄 정의 | 링크 | 상태 |
|---|---|---|---|
| **ALB (Application LB)** | L7, HTTP/HTTPS/HTTP2/gRPC, path/host routing, TLS termination | docs/elasticloadbalancing/latest/application | ✅ 커버 |
| **NLB (Network LB)** | L4, TCP/UDP/TLS, static IP, ultra-low latency | docs/elasticloadbalancing/latest/network | ✅ 커버 |
| **GWLB (Gateway LB)** | L3 — 보안 어플라이언스 (Firewall/IDS) bump-in-wire | docs/elasticloadbalancing/latest/gateway | ★ 신규 |
| **Target Group / health check** | LB → target 분리 | docs/elasticloadbalancing/latest/network/target-groups | ✅ 커버 |
| **Cross-zone LB** | NLB 의 default off, ALB default on — 비용/분배 trade | docs | ★ 신규 |
| **Connection draining / Deregistration delay** | target 제거 시 in-flight 처리 | docs | ★ 신규 |
| **ALPN (NLB)** | TLS L4 에서 protocol negotiation | docs | ★ 신규 |
| **Sticky session / IP hash** | 세션 고정 | docs | 🟡 부분 |
| **WebSocket / gRPC over ALB** | HTTP/2 + bidirectional | docs | ★ 신규 |
| **Global Accelerator** | anycast IP — 엣지 → 가장 가까운 region 접근, failover ms 단위 | docs/global-accelerator | ★ 신규 |
| **CloudFront** | CDN, behavior, origin, TLS, signed URL/cookie, origin shield | docs/AmazonCloudFront | ★ 신규 |
| **API Gateway (REST/HTTP/WebSocket)** | API endpoint + auth + throttle + cache | docs/apigateway | ★ 신규 |
| **Route 53 — public/private hosted zone** | DNS authoritative + private DNS | docs/Route53/latest/DeveloperGuide | ★ 신규 |
| **Route 53 routing policies** | simple / weighted / latency / failover / geolocation / geoproximity / multivalue | docs/Route53/latest/DeveloperGuide/routing-policy | ★ 신규 |
| **Route 53 Health checks** | endpoint/calculated/CloudWatch metric | docs/Route53/latest/DeveloperGuide/health-checks | ★ 신규 |

### D. 멀티 VPC / 연결성

| 개념 | 1-줄 정의 | 링크 | 상태 |
|---|---|---|---|
| **VPC Peering** | VPC ↔ VPC 양방향, transitive 불가 | docs/vpc/vpc-peering | 🟡 부분 |
| **Transit Gateway (TGW)** | hub-and-spoke, 100s VPC + on-prem 통합 | docs/vpc/tgw | ★ 신규 |
| **Cloud WAN** | global mesh 관리형 (TGW 의 진화) | docs/vpc/cloud-wan | ★ 신규 |
| **VPN (Site-to-Site / Client)** | IPsec 터널 | docs/vpn | ★ 신규 |
| **Direct Connect (DX)** | 전용선 dedicated/hosted | docs/directconnect | ★ 신규 |
| **PrivateLink / VPC Endpoints** | Interface (ENI) vs Gateway (S3/DynamoDB) endpoint | docs/vpc/privatelink | ★ 신규 |
| **PrivateLink Endpoint Service** | SaaS 제공자 측 — 사설 endpoint 제공 | docs/vpc/privatelink/concepts/endpoint-service | ★ 신규 |
| **VPC Lattice** | service-to-service mesh — Auth + Routing 통합 관리형 | docs/vpc-lattice | ✅ 커버 ([21](21-dns-dhcp-sg-deep.md)) |
| **Resource Access Manager (RAM)** | cross-account 자원 공유 (TGW/PrivateLink/Subnet) | docs/ram | ★ 신규 |

### E. EKS / Kubernetes 네트워킹 연결

| 개념 | 1-줄 정의 | 링크 | 상태 |
|---|---|---|---|
| **VPC CNI** | EKS pod 가 VPC ENI/IP 직접 사용 | docs/eks/pod-networking | 🟡 부분 |
| **AWS Load Balancer Controller** | ALB Ingress / NLB Service of type LoadBalancer | docs/eks/aws-load-balancer-controller | ✅ 커버 |
| **Cluster endpoint access (public/private)** | API server 접근 패턴 | docs/eks/cluster-endpoint | 🟡 부분 |
| **PrivateLink for EKS** | endpoint 사설 노출 | docs/eks | ★ 신규 |
| **CNI 대체 (Calico/Cilium)** | network policy / eBPF | docs | ★ 신규 |
| **Service Mesh (App Mesh / Istio)** | sidecar 기반 | docs/app-mesh | skip (별 학습) |

### F. 진단 / 운영

| 개념 | 1-줄 정의 | 링크 | 상태 |
|---|---|---|---|
| **VPC Flow Logs** | 인터페이스/서브넷/VPC 단위 packet metadata | docs/vpc/flow-logs | ✅ 커버 |
| **Reachability Analyzer** | source → destination 경로 가능성 검사 | docs/vpc/reachability-analyzer | ★ 신규 |
| **Network Access Analyzer** | 도달 가능성 audit (compliance) | docs/vpc/network-access-analyzer | ★ 신규 |
| **CloudWatch Network metrics** | LB/NAT/TGW/VPC metric | docs/cloudwatch | 🟡 부분 |
| **Traffic Mirroring** | ENI 트래픽 복제 → 분석 | docs/vpc/traffic-mirroring | ★ 신규 |
| **CloudTrail (network)** | API 콜 audit (network change) | docs/cloudtrail | 🟡 부분 |

### G. Edge / 특수

| 개념 | 1-줄 정의 | 상태 |
|---|---|---|
| **Outposts** | 온프렘 AWS 하드웨어 | ★ 신규 |
| **Local Zones / Wavelength** | metro latency / 5G | ★ 신규 |
| **Snowball/Snowmobile** | 대용량 오프라인 이전 | skip (별 도메인) |

---

## 3. 우선 심화 후보 Top-10

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **PrivateLink + Endpoint Service** | msa → 외부 SaaS 사설 통신 표준 |
| 2 | **Transit Gateway** | 멀티 계정/VPC 환경 진입 시 즉시 |
| 3 | **Route 53 routing policies + Health checks** | DR / multi-region 시 결정적 |
| 4 | **Network Firewall + WAF + Shield** | 보안 layer 의 AWS native 도구 |
| 5 | **Global Accelerator + CloudFront** | 글로벌 latency 전략 |
| 6 | **VPC Lattice** | service mesh 관리형 신규 트렌드 |
| 7 | **IPAM + Prefix lists + RAM** | IP 거버넌스 (멀티 계정) |
| 8 | **IPv6 dual-stack / IPv6-only subnet** | 미래 표준 |
| 9 | **Reachability Analyzer / Network Access Analyzer** | 진단 자동화 |
| 10 | **EKS PrivateLink / 사설 cluster endpoint** | msa 보안 강화 직결 |

---

## 4. 표준 심화 스터디 템플릿

`19-search-engine/99-concept-catalog.md` §4 의 12-section 템플릿을 그대로 사용. AWS 특화 보강:
- §3 동작 원리 → "관련 IAM permission" 한 줄 추가
- §6 → ES vs OpenSearch 대신 "AWS vs GCP/Azure 등가 서비스" 맵
- §7 운영 → CloudWatch metric / VPC Flow Logs 분석 패턴
- §8 msa grounding → EKS / k8s manifest / IaC (Terraform/CDK) 적용 위치

### 작성 워크플로우

- [ ] 본 §99 카탈로그에서 행 선택
- [ ] AWS 공식 docs 1차 정독
- [ ] (선택) context7 `/websites/docs_aws_amazon_com_*` 으로 보강
- [ ] §1~12 채움
- [ ] 본 §99 의 상태/심화 파일 컬럼 갱신
- [ ] 00-INDEX.md / temp.md 카운트 동기화

---

## 5. 참고 자료

- VPC: https://docs.aws.amazon.com/vpc/
- ELB: https://docs.aws.amazon.com/elasticloadbalancing/
- Route 53: https://docs.aws.amazon.com/Route53/
- Network Firewall: https://docs.aws.amazon.com/network-firewall/
- Global Accelerator: https://docs.aws.amazon.com/global-accelerator/
- WAF / Shield: https://docs.aws.amazon.com/waf/
- CloudFront: https://docs.aws.amazon.com/AmazonCloudFront/
- API Gateway: https://docs.aws.amazon.com/apigateway/
- VPC Lattice: https://docs.aws.amazon.com/vpc-lattice/
- IPAM: https://docs.aws.amazon.com/vpc/latest/ipam/
- EKS networking: https://docs.aws.amazon.com/eks/latest/userguide/eks-networking.html
- "AWS Networking Best Practices" (Whitepaper)

> 본 카탈로그는 1-aws-network 의 master index 와 cross-link 된다. 변경 시 동기화 필수.
