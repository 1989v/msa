---
parent: 1-aws-network
subtopic: subnet
index: 02
created: 2026-04-16
level: deep
---

# Subnet — Deep Study

## 1. 재확인

서브넷은 **VPC 내부를 AZ 단위로 쪼갠 IP 묶음**이다. 서브넷 자체는 퍼블릭/프라이빗 속성이 없으며, **라우트 테이블에 IGW 경로가 있느냐 없느냐**로 구분된다. 하나의 서브넷은 정확히 하나의 AZ 에 귀속되므로 HA 는 필수적으로 멀티 서브넷이 된다.

## 2. 내부 메커니즘

### 2.1 서브넷 생성 시 내부 동작

- AWS 가 서브넷의 CIDR 범위에서 **처음 4개 + 마지막 1개 IP 를 예약**:
  ```
  10.0.1.0/24 서브넷의 경우:
  - 10.0.1.0  (네트워크 주소)
  - 10.0.1.1  (VPC 라우터)
  - 10.0.1.2  (Amazon DNS)
  - 10.0.1.3  (미래 예약)
  - 10.0.1.255 (브로드캐스트, 실제 미사용이지만 예약)
  → 실제 사용 가능: 10.0.1.4 ~ 10.0.1.254 = 251개
  ```

### 2.2 AZ 귀속

- 각 서브넷은 **하나의 AZ 에만** 속함
- EC2/RDS/Pod 등이 이 서브넷에 배치되면 해당 AZ 에 물리적으로 생성됨
- AZ 장애 시 해당 서브넷의 모든 리소스가 영향받음

### 2.3 Public IP 자동 할당 (`MapPublicIpOnLaunch`)

- 서브넷 속성. true 면 EC2 생성 시 자동으로 퍼블릭 IP 할당
- **퍼블릭 IP 는 EC2 종료 시 사라짐** (EIP 와 다름)
- 2024년부터 퍼블릭 IPv4 는 시간당 $0.005 (월 ~$3.6) 부과 → 불필요하면 false

### 2.4 서브넷과 IP 의 관계

```
VPC 10.0.0.0/16 (65,536 IP)
 ├── subnet-public-a   10.0.1.0/24 (AZ-a)  → 251 usable
 ├── subnet-public-b   10.0.2.0/24 (AZ-b)  → 251 usable
 ├── subnet-public-c   10.0.3.0/24 (AZ-c)  → 251 usable
 ├── subnet-private-a  10.0.11.0/24 (AZ-a) → 251 usable
 ├── subnet-private-b  10.0.12.0/24 (AZ-b) → 251 usable
 ├── subnet-private-c  10.0.13.0/24 (AZ-c) → 251 usable
 └── (남은 주소 블록 예비)
```

## 3. 설계 결정과 트레이드오프

### 3.1 서브넷 크기 선택

| 시나리오 | 권장 크기 |
|---|---|
| 일반 EC2 / RDS 서브넷 | `/24` (251개) |
| **EKS Pod 용 서브넷** | **`/22` 이상** (VPC CNI 가 Pod 마다 IP 소비) |
| 소규모 특수 목적 (NAT 전용) | `/28` (11개) |
| 대규모 Lambda VPC | `/22` ~ `/20` (Lambda 동시성에 비례 소비) |

### 3.2 퍼블릭 vs 프라이빗 배치

**퍼블릭 서브넷에 두는 것**:
- ALB, NAT Gateway
- Bastion Host (SSH 점프 서버) — 요즘은 SSM Session Manager 로 대체
- 인터넷 페이싱 API 가 필요한 외부 워커

**프라이빗 서브넷에 두는 것**:
- Application Server (EC2, Pod)
- Database (RDS, ElastiCache)
- 내부 서비스 전반

**원칙**: **기본값은 프라이빗**. 퍼블릭이 필요한 이유가 있을 때만 퍼블릭.

### 3.3 AZ 분산 개수

- **최소 2 AZ** — 일반 서비스 HA 의 최소 조건
- **권장 3 AZ** — Kafka/etcd 같은 Quorum 기반 시스템
- **AZ 4개 이상** — 드물게 대형 금융/게임에서 필요

## 4. 실제 코드/msa 연결

### 4.1 msa 프로젝트 → AWS 이전 시 서브넷 구성

```
VPC 10.0.0.0/16
 ├── Public Subnets (ALB, NAT)
 │   ├── 10.0.1.0/24 (AZ-a)
 │   ├── 10.0.2.0/24 (AZ-b)
 │   └── 10.0.3.0/24 (AZ-c)
 ├── Private Subnets for EKS (크게)
 │   ├── 10.0.16.0/20 (AZ-a)   → 4,091 Pod IP
 │   ├── 10.0.32.0/20 (AZ-b)
 │   └── 10.0.48.0/20 (AZ-c)
 └── Private Subnets for DB
     ├── 10.0.64.0/24 (AZ-a)
     ├── 10.0.65.0/24 (AZ-b)
     └── 10.0.66.0/24 (AZ-c)
```

### 4.2 Terraform 예시

```hcl
resource "aws_subnet" "public" {
  count                   = 3
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet("10.0.0.0/16", 8, count.index + 1)  # /24
  availability_zone       = data.aws_availability_zones.this.names[count.index]
  map_public_ip_on_launch = true
  tags = {
    Name                     = "public-${count.index}"
    "kubernetes.io/role/elb" = "1"  # EKS ALB 자동 선택
  }
}

resource "aws_subnet" "private_eks" {
  count             = 3
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet("10.0.0.0/16", 4, count.index + 1)  # /20 for Pod 밀도
  availability_zone = data.aws_availability_zones.this.names[count.index]
  tags = {
    Name                              = "private-eks-${count.index}"
    "kubernetes.io/role/internal-elb" = "1"  # EKS 내부 LB
  }
}
```

### 4.3 EKS 서브넷 태그

AWS Load Balancer Controller 가 서브넷을 자동 선택할 때 쓰는 태그:
- `kubernetes.io/role/elb = 1` — 외부 ALB 배치용 (퍼블릭)
- `kubernetes.io/role/internal-elb = 1` — 내부 ALB 배치용 (프라이빗)
- `kubernetes.io/cluster/{cluster-name} = shared` — 멀티 클러스터 공유

## 5. 장애 시나리오 3개

### 시나리오 1: AZ 장애 시 서비스 중단

**증상**: AZ-a 에 장애. 그 AZ 에만 서브넷을 뒀더니 전체 서비스 다운.

**진단**: 단일 AZ 배치 → 해당 AZ 운명 공동체.

**해결**: 최소 2 AZ, 권장 3 AZ 에 서브넷 분산. HPA/PDB 로 Pod 분산 보장. ALB 는 기본적으로 멀티 AZ.

### 시나리오 2: EKS Pod 가 더 이상 안 뜸 — "Insufficient IP"

**증상**: 노드에 리소스 여유는 있는데 Pod 스케줄링 실패, 이벤트에 `no IP available`.

**진단**:
1. VPC CNI 가 Pod 마다 서브넷 IP 를 소비
2. 서브넷이 `/24` (251개) 였는데 Pod 이 이미 소진
3. `kubectl get nodes` 의 allocatable `pods` vs 실제 running

**해결**:
- 단기: 서브넷 CIDR 확장 불가 → 새 서브넷 추가
- 장기: **Prefix Delegation 활성화** (VPC CNI `ENABLE_PREFIX_DELEGATION=true`) → ENI 당 `/28` prefix 할당, Pod 밀도 10배 증가
- 근본: 초기 EKS 서브넷을 `/22` 이상으로

### 시나리오 3: 새 서브넷 만들었는데 EC2 가 인터넷 안 됨

**증상**: 서브넷에 `map_public_ip_on_launch = true` 줬는데도 EC2 가 외부 통신 안 됨.

**진단**:
1. 서브넷의 **Route Table** 에 `0.0.0.0/0 → IGW` 경로가 있는가?
2. RT 를 서브넷에 연결(associate) 했는가? — 기본 RT 에 의존하면 안 됨
3. EC2 의 SG 가 아웃바운드 허용하는가? (SG 기본은 모두 허용이지만 커스텀 SG 는 다를 수 있음)

**해결**: RT 와 서브넷은 **명시적 연결** 필수. Terraform 의 `aws_route_table_association`.

## 6. 면접 꼬리 질문 트리

```
Q2: 퍼블릭 서브넷과 프라이빗 서브넷 차이는?
├── Q2-1: 왜 App 을 Private 에 두나요?
│   └── Q2-1-1: Private App 이 외부 API 호출은 어떻게?
│       └── Q2-1-1-1: NAT 비용 큰 경우 대안은?
├── Q2-2: 한 AZ 만 써도 되지 않나요?
│   └── Q2-2-1: 왜 3 AZ 를 권장하나요?
└── Q2-3: 서브넷 CIDR 을 어떻게 정하나요?
    └── Q2-3-1: EKS 는 왜 큰 서브넷을 쓰나요?
        └── Q2-3-1-1: Prefix Delegation 이 뭔가요?
```

**Q2 핵심**: 서브넷 자체 속성이 아니라 **라우트 테이블에 IGW 기본 경로가 있느냐 없느냐** 의 차이.

**Q2-1 답변**: 공격 표면 축소. 퍼블릭이면 인터넷 전체에서 포트 스캐닝 당함. ALB 만 퍼블릭에 두고 App 은 프라이빗 → 공격 경로가 ALB 한 곳으로 압축.

**Q2-1-1-1 답변**: VPC Endpoint 로 AWS 서비스 트래픽 우회 (S3/DDB Gateway Endpoint 는 무료), NAT Instance / Fck-NAT (저비용 대안), AZ 당 NAT 공유 전략.

**Q2-2-1 답변**: 2 AZ 도 HA 는 되지만 Kafka/etcd 같은 Quorum 기반 시스템은 홀수가 필요. 3 AZ 면 1개 장애 시에도 2개로 Quorum 유지.

**Q2-3-1-1 답변**: VPC CNI 가 ENI 에 개별 Secondary IP 를 할당하는 대신 `/28` (16 IP) prefix 를 통째로 할당 → 노드당 Pod 수가 극적으로 증가. 단 서브넷 IP 소진도 빨라짐.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "서브넷이 퍼블릭이면 자동 인터넷 연결" | RT + IGW + 퍼블릭 IP 모두 필요 |
| "서브넷은 여러 AZ 에 걸칠 수 있다" | **AZ 당 1개** — 절대 불가 |
| "ALB 는 서브넷 1개만 있어도 됨" | ALB 는 **최소 2 AZ 서브넷** 필요 |
| "`/24` 면 256개 EC2 가능" | 5개 예약 → 251개 |
| "서브넷 만들면 RT 자동 연결" | 기본 RT 에 묵시적 연결. 명시적 associate 권장 |

## 8. 자가 점검 체크리스트

- [ ] 서브넷이 AZ 당 1개라는 제약 이해
- [ ] `/24` 실사용 IP 즉답 (251)
- [ ] 퍼블릭/프라이빗은 RT 속성이라는 것 명확
- [ ] `map_public_ip_on_launch` 효과 설명 가능
- [ ] EKS 서브넷 크기 (`/22` 이상) 근거 설명 가능
- [ ] Prefix Delegation 의 원리와 트레이드오프 설명 가능
- [ ] AWS LB Controller 의 서브넷 태그 용도 설명 가능
- [ ] 3 AZ 배치의 Quorum 근거 설명 가능
- [ ] 퍼블릭 서브넷에 두는 것과 프라이빗에 두는 것 구분 가능
- [ ] "AZ 장애 시 서비스 생존" 설계 방법 설명 가능

## 9. 참고 자료

- AWS Subnets 공식 문서
- EKS Best Practices — Networking (subnet sizing)
- VPC CNI Prefix Delegation 공식 문서
- Kubernetes Service Topology 및 Topology Aware Routing
