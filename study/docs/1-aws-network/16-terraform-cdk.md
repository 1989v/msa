---
parent: 1-aws-network
subtopic: terraform-cdk
index: 16
created: 2026-04-16
level: deep
---

# Terraform vs CDK — Deep Study

## 1. 재확인

AWS 인프라를 코드로 관리하는 두 가지 주요 방식:
- **Terraform (HashiCorp)**: 선언형 DSL (HCL), 멀티 클라우드, State 관리, 업계 표준
- **AWS CDK**: 프로그래밍 언어 (TS/Python/Java), AWS 전용, 내부적으로 CloudFormation 생성

## 2. 내부 메커니즘

### 2.1 Terraform 동작 흐름

```
1. HCL 코드 작성 (*.tf)
2. terraform init      → Provider 다운로드, backend 초기화
3. terraform plan      → 현재 state vs 목표 state 비교 → 변경 계획
4. terraform apply     → 계획 실행 → 실제 AWS 리소스 생성/변경
5. terraform state 저장 (S3 backend + DynamoDB lock)
```

### 2.2 CDK 동작 흐름

```
1. TS/Python 코드 (Construct 계층)
2. cdk synth        → CloudFormation 템플릿 JSON/YAML 생성
3. cdk diff         → 현재 Stack vs 목표 Stack 비교
4. cdk deploy       → CloudFormation 에 Stack 등록/업데이트
5. CloudFormation 이 실제 리소스 배포
```

### 2.3 State 관리 차이

**Terraform**:
- `terraform.tfstate` 파일로 현재 상태 추적
- 기본은 로컬 파일 (위험) → **S3 backend + DynamoDB Lock** 권장
- State 조작 명령: `state rm`, `state mv`, `import`

**CDK**:
- **State 파일 없음**. CloudFormation 이 관리
- CloudFormation 이 각 Stack 의 현재 상태 보유
- 조작: 직접 AWS Console / CLI

### 2.4 Construct 계층 (CDK)

- **L1 (CFN)**: CloudFormation 리소스 1:1 매핑 (`CfnBucket`, `CfnInstance`)
- **L2 (고수준)**: 합리적 기본값 + 헬퍼 메서드 (`Bucket`, `Vpc`)
- **L3 (패턴)**: 여러 리소스 조합 (`ApplicationLoadBalancedFargateService`)

대부분 L2 를 사용, 필요시 L3 로 승격.

### 2.5 Terraform Module

- 재사용 가능한 HCL 코드 묶음
- Public Registry: `terraform-aws-modules/vpc/aws` 등 수천 개
- 자체 Module 도 작성 가능

## 3. 설계 결정과 트레이드오프

### 3.1 비교표

| 기준 | Terraform | CDK |
|---|---|---|
| 언어 | HCL (DSL) | TS / Python / Java / C# / Go |
| 멀티 클라우드 | ✅ (AWS + GCP + Azure + K8s) | ❌ AWS only |
| 백엔드 | 자체 state | CloudFormation |
| 업계 채택 | 매우 넓음 | 증가 중 |
| 커뮤니티 Module | 수만 개 | 수천 |
| 디버깅 | plan 읽기 쉬움 | CloudFormation 에러는 난해 |
| 조건/반복 | `count`, `for_each`, dynamic | 프로그래밍 언어 자유도 |
| 러닝커브 | HCL (단순) | 언어 + CDK 개념 |
| CI/CD | Atlantis, Spacelift, Terraform Cloud | cdk deploy + GitHub Actions |
| State 조작 | 명령어로 유연 | CloudFormation 의존 |
| 면접 빈도 | **높음** | 증가 중 |

### 3.2 언제 Terraform?

- **멀티 클라우드 / 하이브리드** 인프라
- 인프라 팀 = 앱 개발자 분리
- 대규모 조직, 거버넌스 필요
- **면접 우위**: 거의 모든 채용 공고에 Terraform 명시

### 3.3 언제 CDK?

- **AWS 전용 + TS/Python 팀**
- 복잡한 조건/반복 로직 (프로그래밍 언어 자유도)
- AWS 최신 기능 즉시 반영 (Terraform 은 약간 지연)
- 앱 개발자가 직접 인프라 관리

### 3.4 msa 프로젝트 관점

현재 Kustomize (K8s manifest) 로 애플리케이션 배포. AWS 리소스 (VPC/EKS/RDS) 관리에는:
- **Terraform 권장**:
  - Kotlin/Spring 팀이라 TS/Python 추가 학습 부담
  - 업계 표준이라 이직 시 유리
  - Module 생태계 풍부
- CDK 가 어울리는 경우: 향후 프론트엔드 (TS) 팀이 AWS 인프라도 같이 관리할 때

## 4. 실제 코드/msa 연결

### 4.1 Terraform Module 구조 (권장)

```
terraform/
├── modules/
│   ├── vpc/              # VPC + Subnet + IGW + NAT
│   ├── eks/              # EKS cluster + node group
│   ├── alb/              # ALB + Target Group + Listener
│   ├── endpoints/        # VPC Endpoints
│   └── security/         # SG 정의
├── environments/
│   ├── dev/
│   │   ├── main.tf        # modules 조합
│   │   ├── variables.tf
│   │   └── backend.tf
│   ├── stg/
│   └── prod/
└── README.md
```

### 4.2 Terraform Backend (S3 + DynamoDB Lock)

```hcl
terraform {
  backend "s3" {
    bucket         = "terraform-state-commerce"
    key            = "prod/terraform.tfstate"
    region         = "ap-northeast-2"
    dynamodb_table = "terraform-lock"
    encrypt        = true
  }
}
```

**DynamoDB Table**:
```hcl
resource "aws_dynamodb_table" "terraform_lock" {
  name         = "terraform-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
}
```

### 4.3 CDK 예시 (비교용, TypeScript)

```typescript
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as eks from 'aws-cdk-lib/aws-eks';

export class CommerceStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      cidr: '10.0.0.0/16',
      maxAzs: 3,
      natGateways: 3,
    });

    const cluster = new eks.Cluster(this, 'Cluster', {
      version: eks.KubernetesVersion.V1_30,
      vpc,
      defaultCapacity: 2,
    });
  }
}
```

### 4.4 Terragrunt (Terraform 래퍼)

```hcl
# terragrunt.hcl
remote_state {
  backend = "s3"
  config = {
    bucket         = "terraform-state-commerce"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = "ap-northeast-2"
    dynamodb_table = "terraform-lock"
    encrypt        = true
  }
}
```

환경별 backend 자동 분리, DRY 패턴.

## 5. 장애 시나리오 3개

### 시나리오 1: "Terraform state 파일이 여러 사람 동시 수정으로 깨짐"

**증상**: `terraform apply` 실행 중 동료도 apply 시도. State 파일 충돌 → 일부 리소스가 state 에서 사라짐.

**진단**: S3 backend 는 있지만 DynamoDB Lock 미설정.

**해결**:
- DynamoDB Lock 즉시 설정
- State 복구: S3 버전관리에서 이전 버전 다운로드 → 대체
- `terraform state list` 로 현재 추적 리소스 확인, `import` 로 누락된 것 추가

### 시나리오 2: "CDK 배포 실패로 CloudFormation Stack 이 ROLLBACK_FAILED"

**증상**: 배포 중 에러 → Stack 상태 `ROLLBACK_FAILED`. 이후 배포 시 `is in ROLLBACK_FAILED state and can not be updated` 에러.

**진단**: CloudFormation 이 롤백 도중 일부 리소스 삭제 실패 → Stack 영구 손상.

**해결**:
- `continue-update-rollback` 로 강제 롤백 진행
- 그래도 안 되면 리소스 수동 삭제 → Stack 삭제 → 재생성
- 교훈: CDK 는 Stack 손상 시 복구가 Terraform 보다 어려움

### 시나리오 3: "Terraform module 버전 업데이트 후 예기치 않은 리소스 대체"

**증상**: `terraform plan` 에서 원치 않는 VPC 재생성 계획 (`destroy / create`).

**진단**: Module v3 → v4 업그레이드 시 리소스 이름 변경 → Terraform 이 "삭제 후 생성" 으로 판단.

**해결**:
- 업그레이드 전에 CHANGELOG 확인
- `terraform state mv` 로 리소스 이름 매핑 조정
- 프로덕션 업그레이드는 stg 에서 먼저

## 6. 면접 꼬리 질문 트리

```
Q16: Terraform 과 CDK 중 뭐가 더 나은가요?
├── Q16-1: Terraform State 는 어떻게 관리하나요?
│   └── Q16-1-1: 왜 S3 + DynamoDB 조합인가요?
│       └── Q16-1-1-1: Terragrunt 는 왜 쓰나요?
├── Q16-2: CDK 의 Construct 계층이 뭔가요?
│   └── Q16-2-1: L1/L2/L3 를 언제 쓰나요?
└── Q16-3: Terraform Module 을 어떻게 조직하나요?
    └── Q16-3-1: Module vs Terragrunt 차이는?
```

**Q16 답변**: 멀티 클라우드 + 인프라 팀 분리 = **Terraform**. AWS 전용 + 기존 TS/Python 팀 = **CDK**. 업계 표준은 Terraform.

**Q16-1-1-1 답변**: Terraform 의 한계 보완. 환경별 backend 설정 DRY, module 버전 고정, 종속성 정의, before/after hook. 엔터프라이즈에서 자주 채택.

**Q16-2-1 답변**: **L2 를 기본**으로 사용 (합리적 기본값 + 메서드). CloudFormation 리소스 세밀 제어 필요 시 L1. 표준 패턴(Fargate + ALB) 반복 시 L3.

**Q16-3-1 답변**: Module 은 재사용 가능한 HCL 묶음. Terragrunt 는 Module 을 **환경별 조합**하는 상위 툴. State/backend 관리 + 종속성.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "CDK 는 CloudFormation 대체" | **내부적으로 CloudFormation 사용** |
| "Terraform 은 AWS 전용" | 모든 Provider 지원 (멀티 클라우드) |
| "State 파일은 그냥 로컬에" | 팀 개발 시 원격 backend 필수 |
| "Terraform 과 CDK 동시 사용 불가" | 가능 — 별도 리소스에 사용하면 됨 |
| "CDK 가 무조건 쉽다" | 언어 + Construct 러닝커브 |

## 8. 자가 점검 체크리스트

- [ ] Terraform vs CDK 핵심 차이 5가지 즉답
- [ ] State 관리 방식 차이 (state file vs CloudFormation)
- [ ] S3 + DynamoDB Lock 조합의 필요성
- [ ] Construct L1/L2/L3 개념
- [ ] Terragrunt 의 역할
- [ ] `terraform plan` 이 제공하는 안정감
- [ ] CDK synth → CloudFormation 변환 흐름
- [ ] 멀티 클라우드 요구 시 선택 (Terraform)
- [ ] Kotlin/Spring 팀의 선택 근거
- [ ] CloudFormation Stack 의 복구 어려움

## 9. 참고 자료

- Terraform 공식 문서
- AWS CDK 공식 문서
- Terragrunt 공식 문서
- "Terraform vs CDK" HashiCorp 공식 비교
