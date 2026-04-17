---
parent: 1-aws-network
subtopic: nat-gateway
index: 07
created: 2026-04-16
level: deep
---

# NAT Gateway — Deep Study

## 1. 재확인

NAT Gateway 는 **프라이빗 서브넷의 리소스가 외부 인터넷으로 아웃바운드 통신** 하게 해주는 관리형 서비스. 퍼블릭 서브넷에 배치하며, AWS 에서 가장 비용이 문제되는 서비스 중 하나.

## 2. 내부 메커니즘

### 2.1 동작 흐름

```
[Private EC2 10.0.11.5]
  │ (목적지: 8.8.8.8)
  ▼ Route Table: 0.0.0.0/0 → nat-xxx
[NAT Gateway]  (퍼블릭 서브넷, EIP 54.xxx.xxx.xxx 연결)
  │ Source NAT: 10.0.11.5 → 54.xxx.xxx.xxx
  ▼ Route Table (퍼블릭): 0.0.0.0/0 → IGW
[IGW]
  ▼
[Internet → 8.8.8.8]
  ▲ 응답
  │
[IGW] → [NAT Gateway: 연결 테이블에서 원 소스 복원] → [Private EC2]
```

### 2.2 Source NAT (SNAT)

- NAT GW 는 **소스 주소만** 변환 (SNAT)
- 목적지는 그대로
- 연결 추적 테이블로 응답 매핑

### 2.3 Port 번호 관리

- NAT GW 하나는 약 **55,000 개 동시 연결** 지원 (ephemeral port 범위)
- 같은 목적지 IP+Port 에 대한 연결이 많으면 포트 소진 가능
- 해결: 목적지 분산, NAT GW 추가

### 2.4 AZ 귀속

- NAT Gateway 는 **특정 AZ 의 서브넷** 에 배치
- 해당 AZ 장애 시 NAT 도 다운 → 다른 AZ 프라이빗 서브넷이 영향
- HA 는 **AZ 당 NAT 하나씩 + AZ 별 RT** 로 구성

### 2.5 처리량

- 초기 5 Gbps → 자동 45 Gbps 까지 스케일업
- 수평 확장 아님 (단일 NAT GW 기준)
- 매우 큰 처리량 필요 시 여러 NAT GW 로 서브넷 분산

## 3. 설계 결정과 트레이드오프

### 3.1 비용 구조

- **시간당 요금**: ~$0.045/h (월 약 $32)
- **데이터 처리 요금**: $0.045/GB (인바운드 + 아웃바운드 둘 다 카운트)
- **Cross-AZ 트래픽**: NAT 거치면 $0.01/GB 추가 발생 가능

**월 비용 예시** (단일 NAT, 월 1TB 처리):
```
Idle 비용: $32
데이터 비용: 1024 GB × $0.045 = $46
총: $78/월
```

3개 AZ NAT HA 구성 시 idle 만 $96/월.

### 3.2 비용 최적화 4가지

1. **VPC Endpoint 로 AWS 서비스 우회**
   - S3 / DynamoDB: **Gateway Endpoint** (무료!)
   - ECR / STS / Logs: **Interface Endpoint** (유료지만 NAT 보다 저렴)

2. **NAT Instance** (직접 EC2 NAT)
   - `t3.nano` ~ $5/월, 처리량 ~1 Gbps
   - 단점: 관리 부담, SPoF, 낮은 처리량

3. **Fck-NAT** (오픈소스 현대화 NAT Instance)
   - Terraform 모듈로 배포
   - NAT GW 대비 **90% 비용 절감**
   - 처리량 ~5 Gbps
   - 소규모 프로덕션 / 스테이징 환경에 적합

4. **AZ 별 NAT vs 공유**
   - AZ 별 NAT (권장 HA): 고정비 3배, Cross-AZ 비용 없음
   - 단일 공유 NAT: 고정비 1배, Cross-AZ 비용 발생
   - **경험칙**: 월 데이터 수 TB 이상이면 AZ 별, 이하는 단일 공유

### 3.3 NAT 우회 전략 (VPC Endpoint 조합)

```
필수 Endpoints (대부분의 EKS 환경):
- S3         (Gateway, 무료)
- ECR API + ECR DKR (Interface)  
- STS        (Interface - IRSA 사용 시)
- Logs       (Interface - CloudWatch Logs)
- Secrets Manager (Interface - IRSA 로 Secrets 접근 시)
```

이것만 세팅하면 NAT 데이터 요금의 70-80% 절감 가능.

## 4. 실제 코드/msa 연결

### 4.1 AZ 별 NAT Gateway (HA)

```hcl
resource "aws_eip" "nat" {
  count  = 3
  domain = "vpc"
}

resource "aws_nat_gateway" "this" {
  count         = 3
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id  # 각 AZ 퍼블릭 서브넷
  tags          = { Name = "nat-${count.index}" }
}

# AZ 별 프라이빗 RT (같은 AZ NAT 를 바라봄)
resource "aws_route_table" "private" {
  count  = 3
  vpc_id = aws_vpc.this.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[count.index].id
  }
}
```

### 4.2 단일 NAT (소규모)

```hcl
resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
}

# 단일 RT 공유
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this.id
  }
}
```

### 4.3 msa 프로젝트 관점

- 현재 msa 는 로컬 K8s (NAT 개념 없음)
- EKS 이전 시: **Phase 4 의 개선 포인트 #2** 적용 — VPC Endpoint 우선 세팅
- `18-improvements.md` 에서 상세

## 5. 장애 시나리오 3개

### 시나리오 1: "외부 API 호출 간헐적 실패 — NAT 포트 고갈"

**증상**: 프라이빗 Pod 가 외부 결제 API 호출 시 간헐적으로 `connection reset` 또는 timeout.

**진단**:
1. CloudWatch NAT Gateway 메트릭 확인 — `ErrorPortAllocation` 0 초과
2. 단일 NAT 가 같은 목적지(IP+Port) 에 수만 개 동시 연결 → 포트 소진

**해결**:
- HTTP Connection Pooling 으로 연결 재사용
- NAT GW 추가 (서브넷별 분산)
- 결제사 IP 가 여러 개면 자동 분산됨

### 시나리오 2: "AZ 장애로 프라이빗 서브넷 전체 인터넷 단절"

**증상**: AZ-a 장애 → AZ-b 의 프라이빗 EC2 도 외부 호출 안 됨.

**진단**: 단일 NAT 구성. 모든 AZ 의 프라이빗 RT 가 AZ-a 의 NAT 를 바라봄.

**해결**:
- 단기: AZ-b NAT 수동 생성 + RT 수정
- 장기: AZ 별 NAT + AZ 별 RT 재구성

### 시나리오 3: "월 비용이 갑자기 $500 증가"

**증상**: AWS 청구서에 NAT Gateway 데이터 처리 비용 폭증.

**진단**:
1. VPC Flow Logs 분석 → 어느 Pod 가 무엇으로 나가는지 확인
2. 주범 발견: 로그 수집기가 S3 로 매일 수TB 업로드 중
3. 경로: Pod → NAT → IGW → S3

**해결**: **S3 Gateway Endpoint** 추가. 경로가 Pod → S3 (VPC 내부) 로 변경 → NAT 경유 안 함. 비용 즉시 0.

## 6. 면접 꼬리 질문 트리

```
Q7: NAT Gateway 가 뭐고 왜 필요한가요?
├── Q7-1: NAT Gateway 비용 문제는 어떻게 해결하나요?
│   └── Q7-1-1: VPC Endpoint 중 무료인 건?
│       └── Q7-1-1-1: Interface Endpoint 는 유료인데 그래도 쓸만한가요?
├── Q7-2: NAT Gateway 는 왜 퍼블릭 서브넷에 두나요?
│   └── Q7-2-1: 프라이빗 서브넷에 두면 왜 안 되나요?
└── Q7-3: HA 를 위해 어떻게 구성하나요?
    └── Q7-3-1: AZ 별 NAT vs 공유 NAT 선택 기준은?
```

**Q7 답변**: 프라이빗 서브넷 리소스의 아웃바운드 인터넷 통신 관리형 서비스. SNAT 로 소스 IP 를 변환하고 연결 추적으로 응답을 원 리소스로 되돌림. 양방향이 아닌 **아웃바운드 전용**.

**Q7-1-1 답변**: **S3 / DynamoDB Gateway Endpoint 는 완전 무료**. RT 에 경로만 추가하면 VPC 내부에서 직접 접근. 대용량 데이터 전송 환경이면 월 수백 달러 절감.

**Q7-1-1-1 답변**: Interface Endpoint ($0.01/h + $0.01/GB) 는 NAT ($0.045/h + $0.045/GB) 대비 4.5배 저렴. 대용량 ECR pull, Secrets Manager 조회 등에서 이득.

**Q7-2-1 답변**: NAT GW 는 내부적으로 IGW 를 경유해서 인터넷에 나가야 함. 프라이빗 서브넷은 IGW 경로가 없으므로 NAT 자체가 동작 불가.

**Q7-3-1 답변**: 트래픽 볼륨 기준. 월 TB 이상이면 AZ 별 NAT (Cross-AZ 비용 회피), 소규모면 단일 공유 NAT (고정비 절감). 고가용성 요구가 높으면 무조건 AZ 별.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "NAT 는 양방향 통신 지원" | **아웃바운드 전용** — 외부→프라이빗 불가 |
| "NAT GW 가 있으면 인바운드 보안" | 인바운드 자체 불가능이지 "보호" 가 아님. 보호는 SG |
| "NAT GW 는 무료" | 시간당 + 데이터 둘 다 유료 |
| "NAT 하나면 모든 AZ 커버" | 트래픽은 되지만 Cross-AZ 비용 + AZ 장애 위험 |
| "S3 접근하려면 NAT 필수" | Gateway Endpoint 로 우회 (무료) |
| "EIP 가 자동 생성됨" | 별도 생성 + 연결 필요 |

## 8. 자가 점검 체크리스트

- [ ] NAT 가 SNAT (Source NAT) 라는 것 이해
- [ ] 아웃바운드 전용 + 응답 자동 복원 구조
- [ ] 퍼블릭 서브넷에 배치해야 하는 이유
- [ ] 시간당 + 데이터 처리비 이중 과금 구조 숙지
- [ ] S3/DDB Gateway Endpoint 로 비용 절감 방법
- [ ] AZ 별 NAT 고가용성 패턴 설계 가능
- [ ] NAT Instance / Fck-NAT 대안 인지
- [ ] NAT GW 포트 고갈 시나리오 이해
- [ ] CloudWatch NAT 메트릭 (`ErrorPortAllocation`, `BytesOutToDestination`) 인지
- [ ] VPC Flow Logs 로 주 트래픽 원인 추적 가능

## 9. 참고 자료

- AWS NAT Gateways 공식 문서
- "NAT Gateway Cost Optimization" AWS 블로그
- Fck-NAT 오픈소스 프로젝트 (github.com/AndrewGuenther/fck-nat)
- AWS VPC Endpoint 공식 문서
