---
parent: 1-aws-network
subtopic: vpc-interconnect
index: 12
created: 2026-04-16
level: deep
---

# VPC Peering / Transit Gateway / PrivateLink — Deep Study

## 1. 재확인

멀티 VPC 간 통신을 위한 3가지 방식:
- **VPC Peering**: 1:1 직접 연결, 무료
- **Transit Gateway (TGW)**: 허브-스포크 구조, 확장성 우수, 유료
- **PrivateLink**: 특정 서비스만 공개, 보안 우수

## 2. 내부 메커니즘

### 2.1 VPC Peering

- 두 VPC 간 점대점 가상 링크
- AWS 백본 네트워크에서 라우팅
- **Non-transitive**: A-B, B-C 가 있어도 A-C 는 따로 필요
- 단일 리전 / Cross-Region / Cross-Account 모두 지원
- 양쪽 VPC 에 **RT 수동 추가** 필수

```
VPC A (10.0.0.0/16)  ←─ Peering ─→  VPC B (172.16.0.0/16)

VPC A RT:
  172.16.0.0/16 → pcx-xxx

VPC B RT:
  10.0.0.0/16 → pcx-xxx
```

### 2.2 Transit Gateway (TGW)

- **허브-스포크 네트워크 허브**
- 여러 VPC + 온프레미스 (VPN/Direct Connect) 통합
- **Transitive**: 모든 연결된 네트워크가 서로 통신 가능 (TGW Route Table 제어)
- 리전당 1개 TGW 로 수천 VPC 연결 가능

```
              ┌─── VPC A
              │
Transit ─────┼─── VPC B
Gateway       │
              ├─── VPC C
              │
              └─── VPN → 온프레미스
```

### 2.3 TGW Route Table

- TGW 자체의 라우트 테이블
- 어느 VPC attachment 가 어느 다른 attachment 와 통신 가능한지 제어
- 기본 "모두 연결" 또는 격리된 라우팅 도메인 구성 가능

### 2.4 PrivateLink

- 제공자(Service Provider) 가 **NLB 앞에 Endpoint Service** 를 생성
- 소비자(Consumer) 가 **Interface Endpoint** 를 자신의 VPC 에 생성하여 연결
- **단방향 접근** — 소비자 → 제공자만 가능
- SaaS 연동, 크로스 계정 서비스 공유에 적합

```
[Consumer VPC]
  Interface Endpoint (ENI)
    ↓ PrivateLink
[Provider VPC]
  Endpoint Service
    ↓
  NLB
    ↓
  Target
```

## 3. 설계 결정과 트레이드오프

### 3.1 3가지 방식 비교표

| 기준 | Peering | Transit Gateway | PrivateLink |
|---|---|---|---|
| 구조 | 1:1 | 허브-스포크 | 서비스 공개 |
| Transitive | X | O (RT 제어) | N/A |
| 방향 | 양방향 | 양방향 | 단방향 (소비자→제공자) |
| 규모 | ~5 VPC | 10+ VPC | 서비스 단위 |
| 온프레미스 연결 | X | O | X (단일 서비스만) |
| 비용 | 무료 (데이터 전송만) | 시간당 $0.05 + $0.02/GB | Interface + 데이터 |
| 지연 | 최소 | 약간 추가 (허브 경유) | Peering 수준 |
| 용도 | 소규모 VPC 간 | 대규모 네트워크 통합 | SaaS / 계정 간 서비스 공유 |

### 3.2 선택 가이드

**Peering**:
- VPC 2-3개 + 모두 서로 통신 필요
- 장기간 안정 네트워크
- 비용 민감

**TGW**:
- VPC 10개 이상
- 온프레미스 VPN/Direct Connect 통합
- 중앙 집중식 라우팅 거버넌스 필요
- 보안 서브넷/인스펙션 VPC 패턴

**PrivateLink**:
- 외부 SaaS (Snowflake, Datadog, New Relic) 통합
- 자사 중앙 서비스 (인증, 결제) 를 다른 계정에 노출
- VPC CIDR 충돌 시 (Peering 불가)

### 3.3 CIDR 충돌

- Peering/TGW: CIDR 겹치면 연결 불가
- PrivateLink: **CIDR 충돌 무관** (ENI 기반, 라우팅 없음)

### 3.4 하이브리드 (온프레미스 연결)

```
온프레미스 ← VPN/DX → TGW → {VPC A, B, C}
              ↑
       중앙 Egress VPC → IGW → Internet
```

## 4. 실제 코드/msa 연결

### 4.1 VPC Peering

```hcl
resource "aws_vpc_peering_connection" "dev_to_prod" {
  peer_vpc_id = aws_vpc.prod.id
  vpc_id      = aws_vpc.dev.id
  auto_accept = true
}

resource "aws_route" "dev_to_prod" {
  route_table_id            = aws_route_table.dev_private.id
  destination_cidr_block    = aws_vpc.prod.cidr_block
  vpc_peering_connection_id = aws_vpc_peering_connection.dev_to_prod.id
}

resource "aws_route" "prod_to_dev" {
  route_table_id            = aws_route_table.prod_private.id
  destination_cidr_block    = aws_vpc.dev.cidr_block
  vpc_peering_connection_id = aws_vpc_peering_connection.dev_to_prod.id
}
```

### 4.2 Transit Gateway

```hcl
resource "aws_ec2_transit_gateway" "this" {
  description                     = "central-hub"
  default_route_table_association = "enable"
  default_route_table_propagation = "enable"
}

resource "aws_ec2_transit_gateway_vpc_attachment" "vpc_a" {
  transit_gateway_id = aws_ec2_transit_gateway.this.id
  vpc_id             = aws_vpc.a.id
  subnet_ids         = aws_subnet.a_private[*].id
}

# VPC RT 에 TGW 경로 추가
resource "aws_route" "a_to_tgw" {
  route_table_id         = aws_route_table.a_private.id
  destination_cidr_block = "10.0.0.0/8"  # 다른 VPC + 온프레미스 대역
  transit_gateway_id     = aws_ec2_transit_gateway.this.id
}
```

### 4.3 PrivateLink (소비자 측)

```hcl
resource "aws_vpc_endpoint" "partner_api" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.vpce.ap-northeast-2.vpce-svc-xxxxx"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.endpoint.id]
  private_dns_enabled = false  # 파트너 제공 DNS 사용
}
```

### 4.4 msa 프로젝트 관점

- 현재 msa 는 단일 VPC 상정 → Peering/TGW 불필요
- 미래 시나리오:
  - 개발/스테이징/프로덕션 분리 VPC + TGW
  - 인증 중앙화 (auth 서비스를 별도 계정 + PrivateLink 로 각 서비스 VPC 에 제공)
  - 외부 SaaS 연동 시 PrivateLink 선호 (Datadog 등)

## 5. 장애 시나리오 3개

### 시나리오 1: "Peering Active 인데 통신 실패"

**증상**: Peering Status `active`, 하지만 ping/HTTP 실패.

**진단**:
1. **양쪽 RT** 에 상대 CIDR 경로 추가됐는지 (자주 놓침)
2. 양쪽 VPC 의 SG 가 상대 CIDR 허용하는지
3. NACL 이 막고 있는지
4. CIDR 이 겹치지는 않는지

**해결**: 양방향 RT 추가 + SG 규칙 확인 (SG 는 다른 VPC 의 SG 참조 불가, CIDR 사용 필요).

### 시나리오 2: "TGW Route Table 설정 실수로 모든 VPC 간 통신"

**증상**: 격리해야 할 dev VPC 가 prod VPC 에 접근됨.

**진단**: 기본 TGW Route Table 에 모든 attachment 가 자동 연관됨.

**해결**:
- 별도 RT 분리: `dev-rt`, `prod-rt`
- 각 attachment 를 적절한 RT 에 associate
- 필요한 direction 만 propagate

### 시나리오 3: "PrivateLink 비용이 많이 나옴"

**증상**: Interface Endpoint 비용이 예상보다 10배.

**진단**: `data.source.url` 에서 여러 AZ 에 걸쳐 Endpoint 생성됨 × 여러 서비스 → 누적 시간당 비용.

**해결**:
- 꼭 필요한 서비스만 Endpoint 생성
- 사용량 낮은 서비스는 NAT 경유 유지
- 개발 환경은 단일 AZ 로

## 6. 면접 꼬리 질문 트리

```
Q12: VPC Peering / Transit Gateway / PrivateLink 언제 뭘 쓰나요?
├── Q12-1: Peering 의 non-transitive 가 왜 문제인가요?
│   └── Q12-1-1: 그럼 TGW 로 다 가야 하나요?
├── Q12-2: PrivateLink 의 단방향 접근이 왜 보안에 좋나요?
│   └── Q12-2-1: Peering 과 비교해서?
└── Q12-3: TGW Route Table 의 역할은?
    └── Q12-3-1: VPC Isolation 을 TGW 로 어떻게 구현하나요?
```

**Q12 답변**: (1) 소규모 2-3 VPC 양방향 = **Peering**. (2) 대규모 10+ VPC + 온프레미스 = **TGW**. (3) 특정 서비스만 단방향 공개 = **PrivateLink**.

**Q12-1-1 답변**: 반드시 그렇진 않음. VPC 가 3-4개 정도고 온프레미스 통합 없고 비용 민감하면 Peering 메시도 충분. TGW 는 고정비 (시간당) + 데이터 처리비 둘 다 부과.

**Q12-2-1 답변**: Peering 은 양방향 + 모든 네트워크 세그먼트 접근 → 한쪽이 해킹되면 다른쪽 전체 노출 위험. PrivateLink 는 소비자 → 제공자 특정 서비스만 → 공격 경로 제한적.

**Q12-3-1 답변**: TGW 의 여러 Route Table 을 만들고 각 VPC attachment 를 적절한 RT 에 associate. 예: `dev-rt` 에는 dev VPC 만, `prod-rt` 에는 prod VPC 만 → dev ↔ prod 통신 차단.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "VPC Peering 은 transitive" | **Non-transitive** |
| "TGW 는 무료" | 시간당 + 데이터 처리비 |
| "PrivateLink 는 양방향" | **단방향** (소비자 → 제공자) |
| "Peering/TGW 는 CIDR 겹쳐도 OK" | 겹치면 연결 불가 |
| "SG 참조는 Peering 간에도 가능" | **불가** — CIDR 기반만 |

## 8. 자가 점검 체크리스트

- [ ] 3가지 방식의 핵심 차이 즉답
- [ ] Non-transitive 의미 예시로 설명
- [ ] TGW Route Table 의 역할 이해
- [ ] PrivateLink 단방향성의 보안 이점
- [ ] 양쪽 VPC RT 추가의 필요성 (Peering)
- [ ] CIDR 충돌 시 PrivateLink 만 유효
- [ ] 비용 비교 (Peering 무료 / TGW 유료 / PrivateLink 유료)
- [ ] 온프레미스 통합은 TGW 만 가능
- [ ] TGW 로 VPC Isolation 구현 방법
- [ ] SG 가 Peering 간 참조 불가 제약

## 9. 참고 자료

- AWS VPC Peering 공식 문서
- AWS Transit Gateway 공식 문서
- AWS PrivateLink 공식 문서
- "AWS Transit Gateway for Hybrid Networks" 블로그
