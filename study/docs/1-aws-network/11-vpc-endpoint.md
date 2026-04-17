---
parent: 1-aws-network
subtopic: vpc-endpoint
index: 11
created: 2026-04-16
level: deep
---

# VPC Endpoint — Deep Study

## 1. 재확인

VPC Endpoint 는 AWS 서비스(S3, DynamoDB, ECR 등)를 **VPC 내부 프라이빗 경로로 접근**하게 해주는 기능. NAT Gateway 를 거치지 않아 비용 절감 + 보안 강화.

두 가지 타입: **Gateway Endpoint** (S3/DDB, 무료) / **Interface Endpoint** (나머지 대부분, 유료).

## 2. 내부 메커니즘

### 2.1 Gateway Endpoint

- **S3 와 DynamoDB 전용**
- 라우트 테이블에 `<S3 prefix list> → vpce-xxx` 경로가 **자동 추가**
- 네트워크 레이어 동작 → 별도 ENI 없음
- **완전 무료** (데이터 전송도 무료)

### 2.2 Interface Endpoint (PrivateLink)

- **대부분의 AWS 서비스** (STS, ECR, Logs, Secrets Manager, SQS, Kinesis 등)
- 서브넷에 **ENI (Elastic Network Interface)** 배치 → 프라이빗 IP 할당
- DNS resolve 로 서비스 호출이 ENI 로 라우팅됨 (RT 수정 불필요)
- **유료**: 시간당 $0.01 + 데이터 $0.01/GB

### 2.3 DNS 동작 (Interface Endpoint)

- Endpoint 생성 시 `private_dns_enabled = true` (권장) 로 하면:
  - 기본 서비스 DNS (예: `ecr.ap-northeast-2.amazonaws.com`) 가 VPC 내부에서 **ENI 프라이빗 IP 로 resolve**
  - 애플리케이션 코드 수정 불필요
- false 면 별도 endpoint-specific DNS 이름 사용

### 2.4 비용 비교 (100TB 월 전송 기준)

| 경로 | 월 비용 |
|---|---|
| NAT Gateway 경유 (`$0.045/GB`) | ~$4,608 |
| Interface Endpoint (`$0.01/GB` + hourly) | ~$1,024 + hourly |
| Gateway Endpoint (S3/DDB) | **$0** |

## 3. 설계 결정과 트레이드오프

### 3.1 필수 Endpoint 목록 (EKS 프라이빗 환경)

```
Gateway (무료):
  - S3
  - DynamoDB

Interface (유료, 하지만 NAT 보다 싸므로 필수):
  - com.amazonaws.{region}.ecr.api         (ECR API)
  - com.amazonaws.{region}.ecr.dkr         (이미지 pull)
  - com.amazonaws.{region}.sts             (IRSA 쓸 때)
  - com.amazonaws.{region}.logs            (CloudWatch Logs)
  - com.amazonaws.{region}.secretsmanager  (Secrets 조회 시)
```

### 3.2 Endpoint 추가 vs NAT 확대

| 비교 | VPC Endpoint | NAT Gateway 확대 |
|---|---|---|
| 비용 | Gateway 무료, Interface 저렴 | 시간당 + GB 당 |
| 보안 | 프라이빗 경로, 외부 노출 X | IGW 경유 |
| 설정 | Endpoint 마다 별도 | NAT GW 만 |
| 대상 | AWS 서비스만 | 모든 인터넷 |

### 3.3 Endpoint Policy

- Interface/Gateway 둘 다 **IAM-like policy** 지정 가능
- 예: 특정 S3 버킷에만 접근 허용
```json
{
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": ["s3:GetObject"],
    "Resource": ["arn:aws:s3:::my-bucket/*"]
  }]
}
```
- 규제/컴플라이언스 환경에서 데이터 유출 방지

### 3.4 AZ 별 ENI (Interface)

- Interface Endpoint 는 **서브넷 지정** 필요 (보통 AZ 별 1개씩)
- 특정 AZ 장애 시 해당 ENI 불가 → 다른 AZ ENI 로 자동 failover

## 4. 실제 코드/msa 연결

### 4.1 Gateway Endpoint (S3)

```hcl
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.ap-northeast-2.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.private[*].id

  policy = jsonencode({
    Statement = [{
      Effect    = "Allow"
      Principal = "*"
      Action    = "*"
      Resource  = "*"
    }]
  })
}
```

### 4.2 Interface Endpoint (ECR)

```hcl
locals {
  interface_services = [
    "ecr.api", "ecr.dkr",
    "sts", "logs", "secretsmanager",
  ]
}

resource "aws_vpc_endpoint" "interface" {
  for_each            = toset(local.interface_services)
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.ap-northeast-2.${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.endpoint.id]
  private_dns_enabled = true
}
```

### 4.3 Endpoint 용 SG

```hcl
resource "aws_security_group" "endpoint" {
  vpc_id = aws_vpc.this.id
  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]  # App SG 에서만 접근
  }
}
```

### 4.4 msa 프로젝트 관점

Phase 4 의 개선 포인트 #2 — EKS 이전 Terraform 에 Endpoint 기본 포함. 월 수백 달러 비용 절감 + 보안 강화.

## 5. 장애 시나리오 3개

### 시나리오 1: "S3 업로드가 여전히 NAT 를 거침"

**증상**: Gateway Endpoint 생성했는데 VPC Flow Logs 에서 여전히 NAT 경유 트래픽 확인.

**진단**:
1. Endpoint 의 `route_table_ids` 에 해당 서브넷의 RT 포함 여부 확인
2. 퍼블릭 서브넷 RT 는 포함 안 됨 → 퍼블릭 인스턴스는 여전히 IGW 경유 (OK)
3. 프라이빗 RT 에 연결이 누락됐을 가능성

**해결**: RT 연결 재확인. Terraform 의 `route_table_ids = aws_route_table.private[*].id` 정확히 설정.

### 시나리오 2: "ECR pull 이 실패"

**증상**: EKS Pod 생성 시 `ImagePullBackOff`, Pod 이벤트에 `failed to pull image`.

**진단**:
1. `ecr.api` + `ecr.dkr` 둘 다 있는지 확인 (두 개 모두 필요)
2. `sts` Endpoint 도 있어야 IRSA 로 ECR 권한 획득 가능
3. Endpoint SG 가 Pod 에서 443 허용하는지
4. `private_dns_enabled = true` 인지

**해결**: 필수 5개 (ecr.api, ecr.dkr, sts, logs, s3) 모두 세팅.

### 시나리오 3: "Interface Endpoint 비용이 예상보다 큼"

**증상**: 월 Interface Endpoint 비용이 수백 달러.

**진단**:
1. 시간당 비용: 각 Endpoint × $0.01/h × AZ 수 × 24 × 30 = 약 $7/월/AZ/Endpoint
2. 서비스 10개 × AZ 3개 = 월 $210 (idle)
3. 데이터 비용 별도

**해결**: 실제 필요한 Endpoint 만 선별. 꼭 필요하지 않은 건 NAT 경유 유지.

## 6. 면접 꼬리 질문 트리

```
Q11: VPC Endpoint 가 왜 필요한가요?
├── Q11-1: Gateway Endpoint 와 Interface Endpoint 차이는?
│   └── Q11-1-1: S3 는 왜 Gateway 고 ECR 은 왜 Interface?
├── Q11-2: Endpoint Policy 로 뭘 제어할 수 있나요?
│   └── Q11-2-1: 데이터 유출 방지에 어떻게 활용하나요?
└── Q11-3: Interface Endpoint 의 DNS 동작은?
    └── Q11-3-1: private_dns_enabled 가 뭘 바꾸나요?
```

**Q11 답변**: 프라이빗 서브넷에서 AWS 서비스 (S3, ECR 등) 를 **NAT 없이 직접 호출**. 비용 절감 + 외부 노출 없이 안전.

**Q11-1-1 답변**: S3/DynamoDB 는 AWS 가 일찍 PrivateLink 를 출시하기 전부터 라우팅 기반 Gateway Endpoint 를 지원. 나머지는 PrivateLink 출시 후 Interface Endpoint (ENI 기반) 로 통일.

**Q11-2-1 답변**: 특정 S3 버킷/액션만 허용, 특정 IAM Role 만 접근, 특정 리전 제한 등. 예: "이 VPC 에서는 기업 데이터 버킷만 접근 가능, 외부 공개 버킷은 차단".

**Q11-3-1 답변**: true 면 기본 서비스 DNS 이름 (예: `ecr.ap-northeast-2.amazonaws.com`) 이 VPC 내에서 Endpoint ENI IP 로 resolve. 애플리케이션 코드 수정 없이 자동 우회. false 면 endpoint-specific DNS 사용 필요.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "Interface Endpoint 가 항상 저렴" | 소규모 트래픽에서는 NAT 가 오히려 저렴할 수도 |
| "Gateway Endpoint 는 ENI 를 사용" | **RT 기반** — ENI 없음 |
| "Endpoint 하나면 VPC 전체" | **서브넷 지정** (Interface) — AZ 별 배치 필요 |
| "ECR 은 Endpoint 하나" | **ecr.api + ecr.dkr 2개** 모두 필요 |
| "IRSA 쓰면 STS Endpoint 불필요" | **STS 필수** — IRSA 토큰 교환에 사용 |

## 8. 자가 점검 체크리스트

- [ ] Gateway vs Interface Endpoint 구분 즉답
- [ ] Gateway 는 무료, Interface 는 유료
- [ ] S3/DynamoDB 가 Gateway 전용
- [ ] EKS 필수 Endpoint 5개 (ecr.api/ecr.dkr/sts/logs/s3) 나열
- [ ] private_dns_enabled 의 효과
- [ ] Endpoint Policy 의 용도와 예시
- [ ] RT 수동 연결 필요 (Gateway)
- [ ] ENI 기반 동작 (Interface)
- [ ] AZ 별 ENI failover
- [ ] 비용 비교 계산 (NAT vs Endpoint)

## 9. 참고 자료

- AWS VPC Endpoints 공식 문서
- AWS PrivateLink 공식 문서
- EKS Best Practices — PrivateLink 활용
- "Reducing NAT Gateway Costs" AWS 블로그
