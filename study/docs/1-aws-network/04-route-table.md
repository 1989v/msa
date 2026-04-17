---
parent: 1-aws-network
subtopic: route-table
index: 04
created: 2026-04-16
level: deep
---

# Route Table — Deep Study

## 1. 재확인

라우트 테이블은 서브넷의 트래픽이 **"어디로 가는지"** 를 정의하는 규칙 묶음. 각 서브넷은 **정확히 하나의 RT 에 연결** 되며, 하나의 RT 는 여러 서브넷에 공유 가능 (1:N).

RT 잘못 설정은 **인터넷 단절의 1순위 원인** — SG 보다 먼저 의심할 영역.

## 2. 내부 메커니즘

### 2.1 RT 의 기본 구조

```
Route Table: rtb-public
 ├── 10.0.0.0/16 → local         (자동 생성, 삭제 불가 — VPC 내부 통신)
 ├── 0.0.0.0/0   → igw-xxx       (기본 경로 — 인터넷)
 └── 192.168.0.0/16 → pcx-yyy    (Peering 경로 예시)
```

### 2.2 Longest Prefix Match (LPM)

- 여러 경로가 매칭될 때 **가장 구체적인 (비트가 긴) 경로 우선**
- 예:
  ```
  0.0.0.0/0     → nat-gw     (기본)
  10.0.5.0/24   → pcx-xxx    (특정 Peering)
  
  트래픽 10.0.5.10 → pcx-xxx (더 구체적)
  트래픽 8.8.8.8   → nat-gw  (0.0.0.0/0 매칭)
  ```

### 2.3 `local` 경로의 특별함

- VPC 생성 시 RT 에 자동으로 `<VPC CIDR> → local` 추가
- **삭제 불가, 수정 불가** → VPC 내부는 항상 통신 가능
- 이 때문에 같은 VPC 내 리소스는 기본적으로 네트워크 레벨에서 reachable (SG/NACL 로만 차단)

### 2.4 Main Route Table (기본 RT)

- VPC 생성 시 자동 생성. 명시적 연결 없는 서브넷은 **묵시적으로** Main RT 사용
- 의도치 않은 인터넷 노출/차단 위험 → **명시적 연결(`Explicit association`) 권장**

### 2.5 라우트 타겟 종류

| Target | 용도 |
|---|---|
| `local` | VPC 내부 |
| `igw-xxx` | IGW — 인터넷 |
| `nat-xxx` | NAT Gateway |
| `eni-xxx` | ENI (Network Interface) — 특정 인스턴스 |
| `pcx-xxx` | VPC Peering |
| `tgw-xxx` | Transit Gateway |
| `vgw-xxx` | Virtual Private Gateway (VPN/DX) |
| `vpce-xxx` | VPC Endpoint (Gateway 타입만 RT 에 직접 추가) |

## 3. 설계 결정과 트레이드오프

### 3.1 퍼블릭 vs 프라이빗 RT

**퍼블릭 서브넷용 RT**:
```
10.0.0.0/16 → local
0.0.0.0/0   → igw-xxx
```

**프라이빗 서브넷용 RT (AZ-a)**:
```
10.0.0.0/16 → local
0.0.0.0/0   → nat-xxx-az-a   (같은 AZ 의 NAT)
```

### 3.2 AZ 별 별도 RT vs 공유

**AZ 별 별도 RT (권장)**:
- 각 AZ 의 프라이빗 서브넷이 **같은 AZ 의 NAT** 를 바라봄
- Cross-AZ 트래픽 비용 회피
- RT 개수만 AZ 수만큼

**단일 공유 RT**:
- NAT 하나 공유 → 다른 AZ 로 갈 수 있음 → Cross-AZ 비용 발생
- 관리 단순
- 소규모 환경용

### 3.3 Propagated Route (VPN/VGW)

- BGP 로부터 자동 학습된 경로
- 정적 경로와 구분 (RT 에 "propagated" 표기)

## 4. 실제 코드/msa 연결

### 4.1 Terraform — 퍼블릭 RT

```hcl
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = { Name = "public-rt" }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}
```

### 4.2 Terraform — AZ 별 프라이빗 RT

```hcl
resource "aws_route_table" "private" {
  count  = 3  # AZ 수
  vpc_id = aws_vpc.this.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[count.index].id  # 같은 AZ NAT
  }
  tags = { Name = "private-rt-${count.index}" }
}
```

### 4.3 msa 프로젝트 연결

현재 msa 는 K8s Ingress 가 ALB 역할인데, EKS 이전 시 RT 는:
- Public RT: ALB, NAT GW 배치용 서브넷
- Private RT × 3 AZ: EKS 워커 노드 + RDS 서브넷용

### 4.4 VPC Endpoint 경로 (Gateway 타입)

```hcl
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.ap-northeast-2.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.private[*].id  # 프라이빗 RT 에 자동 경로 추가
}
```

Gateway Endpoint 는 `<S3 prefix list> → vpce-xxx` 경로가 RT 에 자동 추가됨. Interface Endpoint 는 RT 수정 없이 DNS resolve 로 동작.

## 5. 장애 시나리오 3개

### 시나리오 1: 새 서브넷이 인터넷 안 됨

**증상**: 방금 만든 서브넷의 EC2 가 외부 통신 안 됨.

**진단**:
1. 서브넷에 연결된 RT 확인
2. 아마 **Main RT** 에 묵시적 연결됨 — Main RT 가 IGW 없는 기본값이면 인터넷 안 됨

**해결**: `aws_route_table_association` 명시적으로 퍼블릭 RT 에 연결.

### 시나리오 2: VPC Peering 연결됐지만 통신 안 됨

**증상**: Peering Active, SG 도 허용. 그러나 핑 실패.

**진단**: **RT 누락**. Peering 생성 시 RT 자동 추가되지 않음.

**해결**:
```hcl
resource "aws_route" "peer_to_b" {
  route_table_id            = aws_route_table.private[0].id
  destination_cidr_block    = "172.16.0.0/16"  # 상대 VPC CIDR
  vpc_peering_connection_id = aws_vpc_peering_connection.this.id
}
```

양쪽 VPC 모두 추가 필수.

### 시나리오 3: NAT GW 페일오버 안 됨 (AZ-a 장애)

**증상**: AZ-a 장애. 해당 AZ 의 NAT GW 도 다운. 그런데 AZ-b/c 의 프라이빗 서브넷도 인터넷 안 됨.

**진단**: 단일 공유 RT 패턴 — 모든 AZ 의 프라이빗 서브넷이 AZ-a NAT 를 바라보고 있었음.

**해결**: **AZ 별 별도 RT + AZ 별 NAT** 조합으로 재설계. 비용 증가 vs 장애 격리 트레이드오프.

## 6. 면접 꼬리 질문 트리

```
Q4: 라우트 테이블이 뭔가요?
├── Q4-1: Longest Prefix Match 가 뭔가요?
│   └── Q4-1-1: 충돌하는 경로가 있으면 어떻게 선택되나요?
├── Q4-2: local 경로는 뭔가요?
│   └── Q4-2-1: local 경로를 삭제할 수 있나요?
└── Q4-3: 퍼블릭 RT 와 프라이빗 RT 차이는?
    └── Q4-3-1: AZ 별 RT 를 분리하는 이유는?
```

**Q4 답변**: 서브넷별로 "이 대상 CIDR 로 가는 트래픽은 이 타겟으로 보내라" 라는 규칙 묶음. VPC 내부는 `local` 로 자동 처리되고, 외부/Peering/NAT 등은 명시적으로 추가.

**Q4-1-1 답변**: LPM — 가장 구체적인 (비트 길이가 긴) 경로가 우선. 같은 prefix 면 특정 rule types 우선순위 (static > propagated 등).

**Q4-2-1 답변**: 불가능. `local` 은 AWS 가 자동 관리하며 VPC 내부 통신을 보장하기 위한 필수 항목.

**Q4-3-1 답변**: Cross-AZ 트래픽 비용 회피. 같은 AZ 의 NAT 를 바라보면 무료, 다른 AZ NAT 경유하면 GB 당 $0.01 양방향. 트래픽이 많으면 큰 차이.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "RT 는 서브넷 속성이 아니다" | 서브넷:RT = N:1, 각 서브넷은 정확히 하나의 RT |
| "Peering 생성하면 자동으로 통신됨" | **RT 양쪽 수동 추가** 필수 |
| "`local` 경로는 수정 가능" | 불가 |
| "RT 에 IGW + NAT 둘 다 기본 경로" | 한 RT 에 `0.0.0.0/0` 은 **하나만** 가능 |
| "Main RT 는 항상 기본값" | 명시적 연결 안 된 서브넷만 Main RT 사용 |

## 8. 자가 점검 체크리스트

- [ ] `local` 경로의 자동 생성/삭제 불가 이해
- [ ] LPM (Longest Prefix Match) 예시로 설명 가능
- [ ] 퍼블릭 RT vs 프라이빗 RT 차이 즉답
- [ ] AZ 별 RT 분리 이유 (Cross-AZ 비용) 설명 가능
- [ ] VPC Peering 에 RT 추가가 필요한 이유 이해
- [ ] Gateway Endpoint 의 RT 자동 추가 vs Interface Endpoint 의 DNS 방식 구분
- [ ] Main RT 묵시적 연결의 위험성 이해
- [ ] `aws_route_table_association` 명시적 연결의 중요성
- [ ] Target 타입 7가지 (local/igw/nat/eni/pcx/tgw/vgw/vpce) 나열 가능
- [ ] BGP propagated route 의 개념 인지 (VPN/VGW)

## 9. 참고 자료

- AWS Route Tables 공식 문서
- AWS Well-Architected — Networking
- Terraform `aws_route_table` 리소스 문서
