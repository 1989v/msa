---
parent: 1-aws-network
subtopic: eip
index: 08
created: 2026-04-16
level: deep
---

# Elastic IP (EIP) — Deep Study

## 1. 재확인

EIP 는 AWS 가 제공하는 **고정 퍼블릭 IPv4 주소**. 리소스에 연결하면 그 리소스의 퍼블릭 IP 로 사용되며, 다른 리소스로 이전 가능. 2024년부터 IPv4 자체가 유료화되면서 비용 감각이 중요해짐.

## 2. 내부 메커니즘

### 2.1 EIP 의 본질

- AWS 가 관리하는 퍼블릭 IPv4 풀에서 할당
- **계정 단위** 로 귀속 (리전별 기본 5개 한도)
- 연결 대상: EC2 ENI, NAT Gateway, ALB/NLB (간접), Direct Connect Gateway

### 2.2 EIP 의 내부 동작

```
[EIP 54.xxx.xxx.xxx] ←→ [AWS EIP NAT Layer] ←→ [ENI 10.0.1.5]

외부 → EIP 로 도착 → AWS 가 ENI 의 프라이빗 IP 로 NAT → EC2 도달
```

- EIP 는 **1:1 NAT** 로 동작 (IGW 에서 수행되는 NAT 와 같음)
- EIP 를 다른 리소스로 이동하면 NAT 매핑만 갱신

### 2.3 자동 할당 퍼블릭 IP vs EIP

| 구분 | 자동 퍼블릭 IP | EIP |
|---|---|---|
| 할당 | 인스턴스 생성 시 자동 | 명시적 allocate |
| 고정 | 인스턴스 재시작 시 변경 | **고정** |
| 이전 | 불가 | 다른 리소스로 이전 가능 |
| 비용 | 시간당 (2024년~) | 연결 시 시간당 / 미연결 시 시간당 |

### 2.4 2024년 IPv4 유료화

- 과거: EIP 연결됐으면 무료
- 현재: **모든 퍼블릭 IPv4 는 시간당 $0.005 (월 ~$3.6)**
- 예:
  - ALB 에 연결된 IP 5개 × 10개 ALB = 월 $180
  - EIP 100개 = 월 $360

## 3. 설계 결정과 트레이드오프

### 3.1 EIP 가 필요한 경우

1. **외부 파트너 IP 화이트리스트** — 고정 IP 필수
2. **DNS A 레코드 직접 매핑** — CNAME 대신 IP 고정
3. **NAT Gateway** 가 내부적으로 EIP 사용 (자동)
4. **Bastion Host** — 특정 관리자 IP 로 SSH 접속
5. **Active/Standby failover** — 장애 시 EIP 이전

### 3.2 EIP 불필요한 경우

- Auto Scaling 그룹의 일반 인스턴스 (IP 자주 바뀜, DNS 로 추상화)
- ALB 뒤의 Target (ALB 가 대신 fronting)
- 개발/임시 환경

### 3.3 IPv6 전환

- IPv6 는 주소 공간이 풍부해서 **NAT 개념 자체가 없음**
- 각 리소스가 퍼블릭 IPv6 직접 할당
- 비용 없음 (2026년 현재)
- **장기 전략**: IPv6 duo-stack 도입

### 3.4 BYOIP (Bring Your Own IP)

- 사용자 소유의 IP 블록을 AWS 로 가져오기
- 대기업 엔터프라이즈: 레거시 IP 를 클라우드에서 계속 사용
- 라우팅/CIDR 관리 복잡, AS (Autonomous System) 번호 필요

## 4. 실제 코드/msa 연결

### 4.1 EIP 할당 + 연결

```hcl
resource "aws_eip" "nat" {
  domain = "vpc"    # "vpc" 또는 "standard" (classic, deprecated)
  tags   = { Name = "nat-eip" }
}

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
}
```

### 4.2 EIP 를 EC2 에 연결

```hcl
resource "aws_eip" "bastion" {
  domain = "vpc"
}

resource "aws_eip_association" "bastion" {
  instance_id   = aws_instance.bastion.id
  allocation_id = aws_eip.bastion.id
}
```

### 4.3 msa 프로젝트 관점

- 현재 msa 는 EIP 미사용 (로컬 K8s)
- EKS 이전 시:
  - NAT GW: EIP 필수 (AZ 별 3개)
  - ALB: EIP 연결 불가 (NLB 만 가능)
  - **파트너 연동** 발생 시 NLB + EIP 조합 추가

### 4.4 NLB + EIP (고정 IP 파트너 연동)

```hcl
resource "aws_eip" "nlb" {
  count  = 2  # 2 AZ
  domain = "vpc"
}

resource "aws_lb" "nlb" {
  name               = "partner-nlb"
  internal           = false
  load_balancer_type = "network"
  subnet_mapping {
    subnet_id     = aws_subnet.public[0].id
    allocation_id = aws_eip.nlb[0].id
  }
  subnet_mapping {
    subnet_id     = aws_subnet.public[1].id
    allocation_id = aws_eip.nlb[1].id
  }
}
```

## 5. 장애 시나리오 3개

### 시나리오 1: "연결 안 한 EIP 로 청구서 늘어남"

**증상**: 월 청구서에 EIP 비용 $100+ 예기치 않게 증가.

**진단**:
```bash
aws ec2 describe-addresses --query 'Addresses[?AssociationId==null]'
```
연결 안 된 EIP 가 다수 존재.

**해결**: `aws ec2 release-address --allocation-id xxx` 로 불필요한 EIP 즉시 해제.

### 시나리오 2: "EIP 이전했는데 여전히 이전 인스턴스로 트래픽"

**증상**: Active EC2 장애 → EIP 를 Standby 로 이전했는데 DNS 캐시 때문에 일부 클라이언트가 여전히 이전 IP 로 접근.

**진단**: 실제로는 EIP 이전 순간 AWS 측 매핑은 즉시 갱신됨. 하지만 클라이언트 측 TCP 세션은 유지되다가 시간 경과로 정리.

**해결**:
- 단기: 이전 인스턴스의 app 프로세스 종료로 TCP reset 유도
- 장기: Route 53 Health Check + DNS failover 로 체계화

### 시나리오 3: "EIP 한도 초과 에러"

**증상**: `AddressLimitExceeded` 에러 발생.

**진단**: 리전별 기본 EIP 한도 5개 초과.

**해결**:
- 단기: 미사용 EIP release
- 장기: AWS Support 통해 한도 증설 요청

## 6. 면접 꼬리 질문 트리

```
Q8: EIP 를 언제 쓰나요?
├── Q8-1: 자동 퍼블릭 IP 로 충분하지 않나요?
│   └── Q8-1-1: 파트너사에 IP 를 줘야 하면?
├── Q8-2: EIP 가 유료라는데 왜 유료가 됐나요?
│   └── Q8-2-1: 연결만 하면 무료였나요?
└── Q8-3: IPv6 로 바꾸면 EIP 개념이 없나요?
    └── Q8-3-1: IPv6 전환 시 주의점은?
```

**Q8 답변**: 고정 퍼블릭 IPv4 가 필요한 경우 — 파트너 allow-list, DNS A 레코드 고정, failover 용, NAT Gateway 내부 사용. 이전 가능 + 재시작에도 유지.

**Q8-1-1 답변**: EIP 필수. 자동 IP 는 인스턴스 재시작 시 변경되므로 파트너가 allow-list 유지 불가. NLB 에 EIP 연결하면 LB 단에서 고정 IP 제공.

**Q8-2-1 답변**: 과거에는 무료, 2024년부터 퍼블릭 IPv4 자체가 **시간당 $0.005 (월 ~$3.6)**. IPv4 주소 고갈 문제 해결 + IPv6 전환 유도 목적.

**Q8-3-1 답변**: Duo-stack 부터 시작 (IPv4 + IPv6 병행), 클라이언트 지원 확인, Route 53 AAAA 레코드 추가, SG/NACL 규칙 IPv6 버전 추가. 완전 IPv6 전환은 드묾.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "EIP 는 항상 무료" | 2024년~ 모든 퍼블릭 IPv4 유료 |
| "연결 안 해도 EIP 는 무료" | **연결 안 하면 유료** (낭비 방지 목적) |
| "EIP 는 인스턴스 재시작 시 바뀜" | **유지됨** (자동 IP 와 다름) |
| "ALB 에 EIP 연결 가능" | 불가. NLB 만 가능 |
| "EIP 개수 무제한" | 리전별 기본 5개 (증설 가능) |

## 8. 자가 점검 체크리스트

- [ ] EIP vs 자동 퍼블릭 IP 차이 설명 가능
- [ ] 2024년 IPv4 유료화 인지
- [ ] EIP 연결 안 한 상태가 유료인 이유 이해
- [ ] NLB 에 EIP 연결 가능, ALB 는 불가 구분
- [ ] NAT Gateway 의 EIP 내부 사용 이해
- [ ] IPv6 의 NAT 부재 개념
- [ ] BYOIP 의 존재 인지
- [ ] 리전별 EIP 기본 한도 (5개)
- [ ] EIP 이전 시 DNS 캐시 고려 필요
- [ ] Failover 패턴에서 EIP 역할

## 9. 참고 자료

- AWS Elastic IP Addresses 공식 문서
- "Changes to AWS Public IPv4 Pricing" AWS 공지 (2024)
- AWS IPv6 Migration Guide
- BYOIP (Bring Your Own IP) 공식 문서
