---
parent: 1-aws-network
type: preview
created: 2026-04-16
---

# AWS 네트워크 인프라 — Preview

> 학습자 수준: 기초(A) · 전체 예상 시간: 35h · 목표: 한국 대기업/중견 기술 면접 대비 + Terraform 실습
> 계획서: [plan.md](plan.md) · 브레인스토밍 결과: plan.md 섹션 2.1-2.7

## 멘탈 모델: "AWS 네트워크 = 회사 전용 건물 단지"

- **VPC** = 회사가 임차한 건물 전체 (외부 격리된 내부 주소 체계)
- **서브넷** = 건물 내 층/구역 (공개 리셉션층 vs 직원 전용층)
- **IGW** = 건물 정문 (외부 인터넷과 연결되는 유일한 통로)
- **Route Table** = 우편 배달 규칙
- **SG** = 리소스 단위 출입 카드 (stateful, Allow-only)
- **NACL** = 층 단위 출입 규칙판 (stateless, Allow+Deny)
- **NAT Gateway** = 익명 택배 접수처 (내부 → 외부 아웃바운드)
- **EIP** = 건물 고정 번지수
- **ALB** = L7 리셉셔니스트 (내용 기반 분기)
- **NLB** = L4 우체국 직원 (봉투만 보고 빠르게 전달)

---

## 소주제 지도

### Phase 1 기반 개념 (10개)

| # | 소주제 | 심화 파일 | 한 줄 정의 |
|---|---|---|---|
| 01 | VPC | [01-vpc.md](01-vpc.md) | AWS 내 격리된 가상 네트워크 공간, CIDR 블록 지정 |
| 02 | Subnet | [02-subnet.md](02-subnet.md) | VPC 를 AZ 단위로 쪼갠 IP 묶음, 퍼블릭/프라이빗은 라우트 테이블 차이 |
| 03 | IGW | [03-igw.md](03-igw.md) | VPC 당 1개의 인터넷 진입점 |
| 04 | Route Table | [04-route-table.md](04-route-table.md) | 서브넷의 트래픽 목적지 규칙표 |
| 05 | Security Group | [05-security-group.md](05-security-group.md) | 리소스 레벨 stateful 방화벽, Allow only |
| 06 | NACL | [06-nacl.md](06-nacl.md) | 서브넷 레벨 stateless 방화벽, Allow + Deny |
| 07 | NAT Gateway | [07-nat-gateway.md](07-nat-gateway.md) | Private 서브넷 아웃바운드 통신용 관리형 서비스 |
| 08 | EIP | [08-eip.md](08-eip.md) | 고정 퍼블릭 IP, 리소스 간 이전 가능 |
| 09 | ALB | [09-alb.md](09-alb.md) | L7 로드밸런서, 경로/호스트 기반 라우팅 |
| 10 | NLB | [10-nlb.md](10-nlb.md) | L4 로드밸런서, 고정 IP + 초저지연 |

### Phase 2 심화 (6개 파일로 통합)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 11 | VPC Endpoint | [11-vpc-endpoint.md](11-vpc-endpoint.md) | Gateway (S3/DDB 무료) vs Interface (PrivateLink) |
| 12 | VPC Peering / TGW / PrivateLink | [12-vpc-interconnect.md](12-vpc-interconnect.md) | 멀티 VPC 연결 3가지 방식 |
| 13 | EKS 네트워킹 | [13-eks-networking.md](13-eks-networking.md) | VPC CNI, Pod IP, Prefix Delegation, Service→LB |
| 14 | Cross-AZ 비용 | [14-cross-az-cost.md](14-cross-az-cost.md) | $0.01/GB 양방향, Topology Aware Routing |
| 15 | Route 53 DNS | [15-route53.md](15-route53.md) | Alias, Private Zone, 라우팅 정책 |
| 16 | Terraform vs CDK | [16-terraform-cdk.md](16-terraform-cdk.md) | IaC 비교 + State 관리 |

### Phase 3+4 실전 & 개선 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 17 | msa K8s→AWS 매핑 + Terraform 모듈 | [17-msa-mapping.md](17-msa-mapping.md) | K8s Ingress/Service → ALB/TG 매핑 + Terraform 모듈 5종 |
| 18 | EKS 이전 개선 포인트 | [18-improvements.md](18-improvements.md) | 8개 개선 제안 (NetworkPolicy, VPC Endpoint, WAF 등) |

### Phase 5 면접 대비 (1개 종합)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 19 | 면접 Q&A 트리 + 시스템 설계 | [19-interview-qa.md](19-interview-qa.md) | 10개 질문 × 꼬리 3-4단계 + 시나리오 2개 |

---

## 개념 관계도

```
[인터넷]
   │
   ▼
 ┌───────┐
 │  IGW  │ ← VPC 의 유일한 인터넷 관문
 └───┬───┘
     │
 ┌───┴──────────────────────────────────────────┐
 │  VPC (CIDR: 10.0.0.0/16)                      │
 │                                               │
 │   ┌─────────────────────┐   ┌──────────────┐ │
 │   │ Public Subnet       │   │ Private      │ │
 │   │ 10.0.1.0/24 (AZ-a)  │   │ Subnet       │ │
 │   │                     │   │ 10.0.2.0/24  │ │
 │   │  ┌──────┐  ┌──────┐ │   │ (AZ-a)       │ │
 │   │  │ ALB  │  │ NAT  │ │   │              │ │
 │   │  │(L7)  │  │ GW   │◀┼───┤ App EC2      │ │
 │   │  └──┬───┘  └──────┘ │   │ (SG 적용)    │ │
 │   │     │               │   │              │ │
 │   │     │ RT: 0.0.0.0/0 │   │ RT: 0.0.0.0/ │ │
 │   │     │      → IGW    │   │ 0 → NAT GW   │ │
 │   └─────┼───────────────┘   └──────────────┘ │
 │         │                                     │
 │         │ NACL (서브넷 레벨, stateless)        │
 │         │ SG  (리소스 레벨, stateful)          │
 └─────────┼─────────────────────────────────────┘
           ▼
       Target Group → App EC2 Health Check
```

**트래픽 흐름 요약**:
1. **외부 → 웹**: Client → IGW → Public Subnet ALB → Target Group → Private Subnet App
2. **App → 외부 API**: App → Route Table → NAT GW → IGW → Internet
3. **VPC 내부**: `10.0.x.x local route` → 같은 VPC 내 리소스

---

## Phase 1 치트시트

### 빠른 판단 트리

**"퍼블릭 vs 프라이빗 서브넷?"**
→ 라우트 테이블에 `0.0.0.0/0 → IGW` 있으면 퍼블릭, 없으면 프라이빗

**"SG vs NACL?"**
→ 리소스 단위 + Stateful + Allow-only = SG
→ 서브넷 단위 + Stateless + Deny 필요 = NACL

**"ALB vs NLB?"**
→ HTTP 내용 기반 라우팅 = ALB
→ TCP/UDP + 저지연 + 고정 IP = NLB

**"NAT Gateway 필요?"**
→ 프라이빗에서 외부 호출 + VPC Endpoint 로 안 커버됨 = 필요

### 핵심 3쌍 비교 (한 줄)

- **SG vs NACL**: 리소스/서브넷, Stateful/Stateless, Allow-only/Allow+Deny
- **Public vs Private**: `0.0.0.0/0 → IGW` 유/무
- **ALB vs NLB**: L7 내용 기반 / L4 고정 IP+저지연

### CIDR 빠른 계산

| CIDR | 총 IP | 실사용 (AWS `-5`) |
|---|---|---|
| `/16` | 65,536 | 65,531 |
| `/24` | 256 | 251 |
| `/28` | 16 | 11 (최소) |

### 흔한 실수 TOP 5

1. 프라이빗 서브넷 인터넷 안 됨 → NAT GW/RT 누락
2. NACL 80 허용했는데 응답 안 옴 → ephemeral port 미허용
3. EIP 연결 안 했는데 과금 → 미연결 EIP 유료
4. EC2 SSH 안 됨 → IGW/퍼블릭 IP/RT/SG 중 1개 빠짐
5. 개발환경 NAT Gateway 월 $32 누수 → VPC Endpoint 로 대체

---

## 다음 단계 — `/study:start` 추천 순서

10년차 한국 대기업 면접 관점 우선순위:

1. **`/study:start 1 security-group`** — SG vs NACL 은 단골 질문. 꼬리 4단계까지
2. **`/study:start 1 alb`** — L7 LB 는 msa 에도 직접 연결 (ingress-nginx)
3. **`/study:start 1 vpc`** — 기본이자 전제. CIDR 설계/확장성
4. **`/study:start 1 subnet`** — 퍼블릭/프라이빗의 실체 이해
5. **`/study:start 1 eks-networking`** — msa 이전 시 핵심
6. **`/study:start 1 nat-gateway`** — 비용 이슈 면접 단골
7. **`/study:start 1 cross-az-cost`** — 10년차의 비용 감각
8. **`/study:start 1 interview-qa`** — 최종 종합

나머지는 필요 시 선택.

---

## 이해도 체크 (Phase 1)

다음 5개 질문에 바로 답 가능하면 Phase 1 완료:

1. VPC `10.0.0.0/16` 과 `172.16.0.0/16` 이 Peering 가능한가? → **Yes** (CIDR 안 겹침)
2. 퍼블릭 서브넷 EC2 가 외부와 통신하려면 필요한 5가지? → IGW, 퍼블릭 IP/EIP, RT 경로, SG 규칙, NACL 규칙
3. NAT Gateway 를 프라이빗 서브넷에 두면? → 안 됨 (IGW 접근 불가)
4. 가장 저렴한 고정 IP 구성? → NLB + EIP (ALB 는 불가)
5. `/24` 서브넷에 배치 가능한 EC2 최대 개수? → 251개 (256 − 5 예약)

---

**각 소주제 파일은 다음 템플릿 따름**:
재확인 → 내부 메커니즘 → 트레이드오프 → 실제 코드/msa 연결 → 장애 시나리오 3개 → 꼬리 질문 3-4단계 → 함정 포인트 → 자가 점검 → 참고 자료
