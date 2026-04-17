---
parent: 1-aws-network
subtopic: interview-qa
index: 19
created: 2026-04-16
level: deep
---

# 면접 Q&A 트리 + 시스템 설계 시나리오 — Deep Study

## 1. 재확인

한국 대기업/중견 기술 면접 대비. **10개 기본 질문 × 꼬리 3-4단계 트리 + 함정 포인트 + 시스템 설계 시나리오 2개 + 실무 스토리**.

각 소주제 심화 파일 (01-18) 에 꼬리 질문이 있고, 이 파일은 **종합 복기 + 실전 시뮬레이션** 용.

## 2. 답변 구조 템플릿 (모든 답변 공통)

- **핵심 답변** (1-2문장) — 면접관이 원하는 직접적 답변
- **설명** (2-3문장) — 왜 그런지, 어떻게 동작하는지
- **실무 연결** (1-2문장) — msa 프로젝트 기반 스토리
- **+α** — 추가 언급하면 좋은 포인트 (선택)

---

## 3. 기본 질문 × 꼬리 트리 10선

### Q1. "VPC 가 뭐고 왜 필요한가요?"

**핵심**: AWS 클라우드 내에 격리된 가상 네트워크 공간. CIDR 로 IP 범위 지정, 기본 외부 격리.

**꼬리**:
- Q1-1: CIDR 설계는? → `/16` 권장, 사내 IP 충돌 주의
- Q1-1-1: 변경 가능? → 기본 CIDR 불가, Secondary Block 가능
- Q1-2: 여러 VPC 연결은? → Peering(소규모) / TGW(대규모) / PrivateLink(서비스 단위)
- Q1-2-1: Peering non-transitive 문제? → A-B-C 삼각 통신 불가, TGW 필요

**실무**: msa 를 EKS 로 이전한다면 `10.0.0.0/16` VPC 에 퍼블릭/프라이빗 서브넷 3 AZ 구성으로 기술 검증 완료.

### Q2. "퍼블릭 서브넷과 프라이빗 서브넷 차이는?"

**핵심**: **라우트 테이블에 `0.0.0.0/0 → IGW` 경로 유무**. 서브넷 자체 속성 아님.

**꼬리**:
- Q2-1: 왜 App 을 Private 에? → 공격 표면 축소
- Q2-1-1: Private App 이 외부 호출은? → NAT Gateway (또는 VPC Endpoint)
- Q2-1-1-1: NAT 비용 큰 경우? → Gateway Endpoint (S3/DDB 무료), Fck-NAT

**실무**: msa EKS 이전 설계에서 ALB + NAT 만 퍼블릭, App Pod + RDS 는 프라이빗.

### Q3. "Security Group 과 NACL 차이는?"

**핵심**: SG = 리소스 레벨 Stateful Allow-only, NACL = 서브넷 레벨 Stateless Allow+Deny.

**꼬리**:
- Q3-1: Stateful/Stateless 실제 차이? → 응답 자동 허용 여부 (NACL 은 ephemeral port 별도 필요)
- Q3-1-1: NACL 은 언제 쓰나? → 특정 IP 차단 (SG 는 Deny 불가)
- Q3-2: SG-to-SG 참조는? → IP 대신 다른 SG ID 로 동적 연결
- Q3-2-1: EKS Pod 별 SG? → `SecurityGroupPolicy` CRD + VPC CNI Branch ENI

**실무**: msa NetworkPolicy 미적용 → AWS SG "ALB-SG 로부터만" 패턴을 NetworkPolicy 로 이식 예정 (Phase 4).

### Q4. "ALB 와 NLB 중 뭘 언제 쓰나요?"

**핵심**: HTTP 경로/호스트 라우팅 = ALB. TCP/UDP + 고정 IP + 저지연 = NLB.

**꼬리**:
- Q4-1: ALB + NLB 조합 패턴? → Outer NLB (고정 IP) + Inner ALB (L7 라우팅)
- Q4-1-1: 비용 트레이드오프? → 2배 LB 비용 vs 고정 IP 확보
- Q4-2: WebSocket 은? → 장시간은 NLB 유리 (idle timeout)

**실무**: msa ingress-nginx → EKS 이전 시 ALB 자동 매핑 (AWS LB Controller). 파트너 연동 시 NLB 추가 여지 Phase 4 에 기록.

### Q5. "NAT Gateway 비용 문제와 대안은?"

**핵심**: 시간당 + 데이터 둘 다 유료. 대안 — VPC Endpoint (S3/DDB 무료), Interface Endpoint, Fck-NAT.

**꼬리**:
- Q5-1: 아예 안 쓰기 가능? → Endpoint 로 모든 트래픽 커버 시 이론상 가능
- Q5-1-1: Fck-NAT 단점? → 관리 부담, SPoF, 낮은 처리량
- Q5-2: AZ 별 vs 공유? → 트래픽 볼륨 기준 (TB 단위면 AZ 별)

**실무**: EKS 이전 Terraform 에 S3 Gateway + ECR/STS Interface Endpoint 기본 포함 설계.

### Q6. "EKS Pod 네트워크 동작은?"

**핵심**: VPC CNI → Pod 이 VPC 서브넷 IP 직접 할당. 노드 ENI 에 Secondary IP.

**꼬리**:
- Q6-1: 노드당 Pod 수 계산? → `(ENI × IP/ENI) - 1`
- Q6-1-1: 늘리는 방법? → Prefix Delegation (/28 prefix 할당)
- Q6-2: K8s Service 가 AWS LB 로? → Ingress → ALB (LB Controller), Service + annotation → NLB

**실무**: msa EKS 이전 시 `t3.medium` 17 Pod 제한 → Prefix Delegation 으로 확장 설계 (Terraform 모듈에 반영).

### Q7. "Terraform vs CDK 선택 근거?"

**핵심**: 멀티 클라우드/인프라 팀 = Terraform. AWS 전용 + TS/Python = CDK. 업계 표준은 Terraform.

**꼬리**:
- Q7-1: State 관리 방식? → Terraform state file vs CDK CloudFormation
- Q7-1-1: S3 + DynamoDB Lock 이유? → 팀 개발 동시 실행 방지
- Q7-2: Terragrunt 는? → Terraform 의 DRY 한계 보완

**실무**: Kotlin/Spring 팀 → Terraform 선택. `modules/vpc`, `modules/eks`, `modules/endpoints` 로 분리.

### Q8. "Cross-AZ 트래픽 비용을 들어봤나요?"

**핵심**: 양방향 $0.01/GB. Kafka, LB, RDS 복제가 주요 원인.

**꼬리**:
- Q8-1: Kafka 에서 왜 문제? → Consumer 가 Leader(다른 AZ)에서 읽으면 매번 Cross-AZ
- Q8-1-1: fetch-from-follower? → 같은 AZ Replica 에서 읽기 (KIP-392)
- Q8-2: K8s Topology Aware Routing? → `trafficDistribution: PreferClose` (K8s 1.30+)

**실무**: msa Kafka rack awareness 적용 예정 (Phase 4-4).

### Q9. "WAF 와 Shield 차이?"

**핵심**: WAF = L7 (SQLi/XSS/bot), Shield = L3/L4 DDoS. 조합 사용.

**꼬리**:
- Q9-1: NLB 에 WAF 붙이기? → 불가. CloudFront 경유
- Q9-1-1: CloudFront 의 추가 이점? → Edge 캐싱 + Shield 자동 범위 확대

**실무**: msa EKS 이전 시 `CloudFront + WAF → ALB → ingress-nginx` 구조 제안 (Phase 4-3).

### Q10. "프라이빗 EKS + RDS 시스템 설계해보세요"

**설계 요점**:
```
[Internet]
    ↓
[CloudFront + WAF + Shield Standard]
    ↓
[Public Subnet (AZ × 3)]
  ├─ ALB (ACM)
  └─ NAT Gateway × 3
    ↓
[Private Subnet App (AZ × 3, /22)]
  ├─ EKS Worker Nodes (VPC CNI + Prefix Delegation)
  │   ├─ Pod (VPC IP)
  │   └─ Pod SG (SecurityGroupPolicy)
  └─ VPC Endpoints (S3 Gateway + ECR/STS/Logs Interface)
    ↓
[Private Subnet DB (AZ × 3)]
  └─ RDS Multi-AZ

네트워크 제어:
  - SG: ALB-SG, App-SG, DB-SG (체인 참조)
  - NetworkPolicy: 기본 deny + 서비스 간 allow
  - EKS API endpoint: private only (Bastion 또는 VPN)

모니터링:
  - VPC Flow Logs → S3 → Athena
  - CloudWatch + Prometheus
```

**핵심 결정**:
1. AZ 3개 (Kafka/etcd 홀수 Quorum)
2. NAT 비용 VPC Endpoint 로 우회
3. API Server 프라이빗
4. Pod 별 SG + NetworkPolicy 이중 방어
5. 모니터링 기본 세트

**트레이드오프**:
- 프라이빗 endpoint → kubectl 접근 불편 vs 보안 강화
- AZ 별 NAT → 비용 증가 vs Cross-AZ 회피
- CloudFront + WAF → 추가 비용 vs 보안 계층 강화

---

## 4. 함정 질문 / 오해 포인트 TOP 10

| # | 오해 | 실제 | 단골 함정 질문 |
|---|---|---|---|
| 1 | SG 는 Stateless | **Stateful** | "SG 규칙 하나만 열면 응답도 나가나요?" |
| 2 | NACL 은 리소스 단위 | **서브넷 단위** | "EC2 에 NACL 직접 붙일 수 있나요?" |
| 3 | 퍼블릭 서브넷 = 인터넷 연결 | RT 의 IGW 경로 유무 | "서브넷 자체가 퍼블릭이라는 건 어떻게 설정?" |
| 4 | NAT Gateway 는 양방향 | **아웃바운드 전용** | "외부에서 프라이빗 서브넷 EC2 접근?" |
| 5 | ALB 고정 IP 지원 | **불가**, NLB 만 | "ALB 에 EIP 붙이려면?" |
| 6 | VPC 에 IGW 여러 개 | **1개만** | "인터넷 출구 이중화?" |
| 7 | VPC Peering transitive | **non-transitive** | "A-B-C 피어링 시 A-C 통신?" |
| 8 | Gateway Endpoint 유료 | **S3/DDB 무료** | "VPC Endpoint 비용 구조?" |
| 9 | Pod 가 노드 IP 공유 | Pod 별 VPC IP (VPC CNI) | "EKS 에서 Pod 가 몇 개 IP 를 쓰나요?" |
| 10 | Cross-AZ 무료 | **$0.01/GB 양방향** | "AZ 간 통신 비용은?" |

---

## 5. 시스템 설계 시나리오 2개

### 시나리오 1: 멀티 AZ 고가용 웹 서비스 VPC 설계

**요구사항**:
- 웹 + API + DB, 24/7 가용성
- 초당 1만 rps
- 한국 사용자 대상
- 보안 규제 준수

**설계**:

```
리전: ap-northeast-2 (서울)
AZ: 3개 사용

VPC 10.0.0.0/16
├── Public Subnet (ALB, NAT)
│   ├── /24 × 3 AZ
│   └── ALB + 3 NAT Gateway
├── Private App Subnet
│   ├── /22 × 3 AZ  ← EKS 용 대형
│   └── EKS Worker Nodes
├── Private DB Subnet
│   ├── /24 × 3 AZ
│   └── RDS Multi-AZ + Read Replica × 2
└── VPC Endpoints
    ├── S3 (Gateway)
    ├── ECR/STS/Logs (Interface × 3 AZ)

Frontend:
  CloudFront (Shield Standard)
   ↓
  WAF (Managed Rules)
   ↓
  ALB (ACM HTTPS)
   ↓
  EKS Pod (VPC CNI)
   ↓
  RDS Multi-AZ
```

**왜 이렇게?**:
- 3 AZ: Kafka/etcd 홀수 Quorum + 고가용성
- Private App `/22`: EKS Pod IP 여유
- RDS Multi-AZ: 쓰기 failover
- CloudFront: 한국 외 접근 지연 감소 + Shield 범위 확대
- VPC Endpoint: NAT 비용 절감

**스케일 확장**:
- 10x 트래픽 → ALB 자동 스케일, Pod HPA, RDS Read Replica 추가
- 리전 확장 → Route 53 Latency-based Routing + 리전 간 Transit Gateway

### 시나리오 2: 파트너 IP 화이트리스트 기반 연동

**요구사항**:
- 파트너사가 우리 API 호출 시 고정 IP 로 접근해야 함
- 파트너의 allow-list 등록용
- 내부 L7 라우팅 필요

**설계**:

```
[파트너 서버]
    ↓ (고정 IP allow-list)
[NLB + EIP × 2 AZ]     ← 고정 IP 제공
    ↓
[내부 ALB (internal-facing)]     ← L7 라우팅
    ↓
[EKS Pod Gateway]
    ↓
[EKS Pod 각 서비스]
```

**왜 NLB + ALB?**:
- ALB 단독: DNS 기반 → 파트너 allow-list 유지 불가
- NLB 단독: L7 라우팅 불가 (경로 기반 분기)
- **Outer NLB + Inner ALB**: 고정 IP + L7 라우팅 동시 확보

**보안 이중 방어**:
- NLB SG: 파트너 IP CIDR 만 허용
- 파트너는 allow-list 로 한 번 더 필터

**비용**: 단일 ALB 대비 약 2배 LB 비용. 파트너 연동 중요도에 따라 판단.

---

## 6. 답변 시 크레딧 키워드

**의도적으로 언급하면 점수 ↑**:
- "Stateful vs Stateless" (SG vs NACL 질문)
- "VPC CNI" (EKS 질문)
- "Gateway Endpoint 무료" (비용 감각)
- "Cross-AZ $0.01/GB 양방향" (실무 디테일)
- "Prefix Delegation" (EKS 심화)
- "PrivateLink" (보안 + SaaS 연동)
- "Transit Gateway 는 transitive" (Peering 한계 설명)
- "Topology Aware Routing" / "rack-awareness" (비용 최적화)
- "SG-to-SG 참조" (마이크로서비스 실전 감각)
- "endpoint_public_access=false" (프라이빗 EKS 인지)

**피해야 할 답변 패턴**:
- "AWS 가 알아서 해줍니다" → 블랙박스 이해
- 비용 언급 없음 → 실무 감각 결여
- 단순 "써봤는데 잘 모르겠습니다" → 깊이 없어 보임
- 정답만 + 트레이드오프 미언급 → "왜" 에 약함

**꼬리 질문 3단계 방어 패턴**:
1. 1단계 (What): 핵심 답 → 설명 → 실무 연결
2. 2단계 (Why): 원리 설명 + 대안 언급
3. 3단계 (When): 상황별 선택 + 트레이드오프
4. 4단계 (What if): edge case / 장애 시나리오

---

## 7. 한 줄 요약 암기표

- **VPC**: 격리된 가상 네트워크, CIDR 지정, 확장 불가(Secondary 만)
- **Subnet**: AZ 귀속, 퍼블릭/프라이빗은 RT 차이
- **IGW**: VPC 당 1개, 양방향, 무료
- **RT**: LPM, local 자동, AZ 별 분리로 Cross-AZ 회피
- **SG**: 리소스 Stateful Allow-only, SG-to-SG 참조
- **NACL**: 서브넷 Stateless Allow+Deny, 번호 순서
- **NAT GW**: 퍼블릭 배치, 아웃바운드 전용, 비용 큼 → Endpoint 로 절감
- **EIP**: 고정 IPv4, 2024년~ 유료
- **ALB**: L7, DNS 기반, WAF 직접, Ingress Controller
- **NLB**: L4, EIP 고정 IP, 클라이언트 IP 보존
- **VPC Endpoint**: S3/DDB Gateway 무료, 나머지 Interface 유료
- **Peering/TGW/PrivateLink**: 1:1/허브/단방향 특정 서비스
- **EKS VPC CNI**: Pod 별 VPC IP, Prefix Delegation 으로 확장
- **Cross-AZ**: $0.01/GB 양방향, Topology Aware 로 최적화
- **Route 53**: Alias 루트 도메인 + 무료 query, 7가지 라우팅 정책
- **Terraform**: 선언형 HCL, 멀티 클라우드, S3+DynamoDB State

---

## 8. 자가 점검 체크리스트 (최종)

다음 20개 질문에 **꼬리 질문 2단계까지 즉답 가능**하면 합격 수준:

1. [ ] VPC CIDR `/16` vs `/24` 근거 비교
2. [ ] 퍼블릭/프라이빗 서브넷의 실체 (RT)
3. [ ] SG vs NACL 5가지 차이 (레벨/상태/규칙/평가/기본값)
4. [ ] ALB vs NLB 선택 기준 + 조합 패턴
5. [ ] NAT Gateway 비용 최적화 3가지
6. [ ] EKS Pod 네트워크 + Prefix Delegation
7. [ ] VPC Peering vs TGW vs PrivateLink
8. [ ] Cross-AZ 비용 + Kafka rack awareness
9. [ ] Terraform vs CDK 트레이드오프 + State 관리
10. [ ] 멀티 AZ 고가용 VPC 설계 + 트레이드오프
11. [ ] 파트너 연동 고정 IP 시스템 설계
12. [ ] WAF + Shield 차이 + 조합 패턴
13. [ ] Route 53 Alias vs CNAME + 라우팅 정책
14. [ ] VPC Endpoint 필수 5개 + 비용 절감 근거
15. [ ] NetworkPolicy 기본 deny 설계
16. [ ] EKS 프라이빗 endpoint + CI/CD 대응
17. [ ] SG-to-SG 참조 패턴 + Pod 별 SG
18. [ ] Route 53 Failover Health Check
19. [ ] VPC Flow Logs + Athena 활용
20. [ ] msa 프로젝트 EKS 이전 Day-1 체크리스트

---

## 9. 참고 자료

- 소주제별 심화 파일 (`01-vpc.md` ~ `18-improvements.md`)
- "System Design Interview" Vol 1, 2 - Alex Xu (시스템 설계 공통)
- AWS Well-Architected Framework
- "한국 IT 기업 기술 면접" 관련 블로그/영상
- msa 프로젝트 ADR (특히 ADR-0019)
