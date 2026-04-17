---
parent: 1-aws-network
subtopic: msa-mapping
index: 17
created: 2026-04-16
level: deep
---

# msa K8s → AWS 매핑 + Terraform 모듈 — Deep Study

## 1. 재확인

현재 msa 프로젝트 (K8s 기반, `prod-k8s`/`k3s-lite` 오버레이) 를 AWS EKS 로 이전할 때의 **매핑 + Terraform 모듈 구성**을 정리한다. Phase 3 의 실전 적용 영역.

## 2. 현재 msa 네트워크 구조 (AWS 매핑)

### 2.1 K8s ↔ AWS 매핑 표

| msa (K8s) | AWS 대응 | 구체적 파일/위치 |
|---|---|---|
| `Ingress` + ingress-nginx | **ALB** | `k8s/base/gateway/ingress.yaml` |
| cert-manager + Let's Encrypt | **ACM** | `k8s/overlays/prod-k8s/patches/ingress-tls.yaml` |
| `Service` (ClusterIP × 43개) | Target Group + Pod IP | 모든 서비스 |
| K8s DNS (`service:8080`) | VPC 내부 DNS + Private Hosted Zone | ADR-0019 |
| HPA (2-8 replicas) | HPA + Cluster Autoscaler | `k8s/overlays/prod-k8s/` |
| PDB (minAvailable: 1) | (K8s 자체, AWS 대응 없음) | `k8s/overlays/prod-k8s/` |
| NetworkPolicy (**미적용**) | Security Group / Pod SG | Phase 4 의 개선 포인트 #1 |
| gateway 13개 라우트 | Internal ALB or Service Mesh | `gateway/.../GatewayRouteConfig.kt` |

### 2.2 상세: Ingress 흐름

**현재 (로컬 K8s, k3d)**:
```
Client → k3d Host Port → ingress-nginx → gateway:8080 → {product, order, ...}
```

**현재 (prod-k8s, managed K8s)**:
```
Client → LoadBalancer (managed K8s 제공) → ingress-nginx → gateway → services
```

**EKS 이전 후**:
```
Client → Route 53 → ALB (AWS LB Controller 생성) → Target Group (gateway Pod IP)
       → gateway (인증 / Rate Limiting) → K8s Service DNS → {product, order, ...}
```

### 2.3 서비스 발견

- **Eureka 제거** (ADR-0019 Phase 1b, 2026-04-10)
- 모든 서비스 호출이 K8s Service DNS 사용: `http://{service}:{port}`
- EKS 이전 시 동일 구조 유지 가능

### 2.4 prod-k8s 오버레이 차이

- HPA: 17개 서비스 (CPU 70% target, 2-8 replicas)
- PDB: 14개 서비스 (minAvailable: 1)
- TLS: cert-manager + Let's Encrypt
- Traefik 명시적 비활성화 (ingress-nginx 선택)

## 3. Terraform 모듈 5종 설계

### 3.1 modules/vpc

**역할**: VPC + 서브넷 + IGW + NAT + Route Table 기본 네트워크.

```hcl
# modules/vpc/main.tf
variable "name"           { type = string }
variable "cidr"           { type = string, default = "10.0.0.0/16" }
variable "azs"             { type = list(string) }
variable "public_subnets"  { type = list(string) }
variable "private_subnets_app" { type = list(string) }
variable "private_subnets_db"  { type = list(string) }

resource "aws_vpc" "this" {
  cidr_block           = var.cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = { Name = var.name }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
}

# Public subnets (ALB, NAT)
resource "aws_subnet" "public" {
  count                   = length(var.azs)
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnets[count.index]
  availability_zone       = var.azs[count.index]
  map_public_ip_on_launch = true
  tags = {
    Name                     = "${var.name}-public-${count.index}"
    "kubernetes.io/role/elb" = "1"
  }
}

# Private subnets for EKS (Pod IP)
resource "aws_subnet" "private_app" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_subnets_app[count.index]
  availability_zone = var.azs[count.index]
  tags = {
    Name                              = "${var.name}-private-app-${count.index}"
    "kubernetes.io/role/internal-elb" = "1"
  }
}

# Private subnets for DB
resource "aws_subnet" "private_db" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_subnets_db[count.index]
  availability_zone = var.azs[count.index]
}

# NAT × AZ 수
resource "aws_eip" "nat" {
  count  = length(var.azs)
  domain = "vpc"
}

resource "aws_nat_gateway" "this" {
  count         = length(var.azs)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
}

# Public RT
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# AZ 별 Private RT
resource "aws_route_table" "private_app" {
  count  = length(var.azs)
  vpc_id = aws_vpc.this.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[count.index].id
  }
}

resource "aws_route_table_association" "private_app" {
  count          = length(aws_subnet.private_app)
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private_app[count.index].id
}

output "vpc_id"         { value = aws_vpc.this.id }
output "public_subnet_ids"  { value = aws_subnet.public[*].id }
output "private_app_subnet_ids" { value = aws_subnet.private_app[*].id }
output "private_db_subnet_ids"  { value = aws_subnet.private_db[*].id }
```

### 3.2 modules/security

**역할**: ALB/App/DB SG 정의 + SG-to-SG 체인.

```hcl
resource "aws_security_group" "alb" {
  name_prefix = "alb-"
  vpc_id      = var.vpc_id
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress { /* all */ }
}

resource "aws_security_group" "app" {
  name_prefix = "app-"
  vpc_id      = var.vpc_id
  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
}

resource "aws_security_group" "db" {
  name_prefix = "db-"
  vpc_id      = var.vpc_id
  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
}
```

### 3.3 modules/endpoints

**역할**: 필수 VPC Endpoint (비용 절감).

```hcl
# S3 Gateway Endpoint (무료)
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = var.vpc_id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = var.private_route_table_ids
}

# Interface Endpoints
locals {
  services = ["ecr.api", "ecr.dkr", "sts", "logs", "secretsmanager"]
}

resource "aws_vpc_endpoint" "interface" {
  for_each            = toset(local.services)
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.region}.${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [var.endpoint_sg_id]
  private_dns_enabled = true
}
```

### 3.4 modules/eks

**역할**: EKS 클러스터 + 노드 그룹 + VPC CNI 설정.

```hcl
resource "aws_eks_cluster" "this" {
  name     = var.cluster_name
  role_arn = aws_iam_role.eks_cluster.arn
  version  = "1.30"
  vpc_config {
    subnet_ids              = concat(var.public_subnet_ids, var.private_subnet_ids)
    endpoint_public_access  = false  # 프라이빗 endpoint
    endpoint_private_access = true
  }
  enabled_cluster_log_types = ["api", "audit", "authenticator"]
}

resource "aws_eks_node_group" "default" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "default"
  node_role_arn   = aws_iam_role.eks_node.arn
  subnet_ids      = var.private_subnet_ids
  instance_types  = ["m5.large"]
  scaling_config {
    desired_size = 2
    min_size     = 2
    max_size     = 10
  }
}

resource "aws_eks_addon" "vpc_cni" {
  cluster_name = aws_eks_cluster.this.name
  addon_name   = "vpc-cni"
  configuration_values = jsonencode({
    env = {
      ENABLE_PREFIX_DELEGATION = "true"
    }
    enableNetworkPolicy = "true"
  })
}
```

### 3.5 modules/alb (필요 시)

**역할**: EKS 외부 서비스 (예: Bastion, 레거시 EC2) 용 ALB.

EKS 기반 서비스는 **AWS LB Controller** 가 Ingress 리소스로 자동 프로비저닝하므로 Terraform 불필요.

### 3.6 environments/prod/main.tf

```hcl
module "vpc" {
  source              = "../../modules/vpc"
  name                = "commerce-prod"
  cidr                = "10.0.0.0/16"
  azs                 = ["ap-northeast-2a", "ap-northeast-2c"]
  public_subnets      = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets_app = ["10.0.16.0/20", "10.0.32.0/20"]
  private_subnets_db  = ["10.0.64.0/24", "10.0.65.0/24"]
}

module "security" {
  source = "../../modules/security"
  vpc_id = module.vpc.vpc_id
}

module "endpoints" {
  source                  = "../../modules/endpoints"
  vpc_id                  = module.vpc.vpc_id
  region                  = "ap-northeast-2"
  private_route_table_ids = module.vpc.private_route_table_ids
  private_subnet_ids      = module.vpc.private_app_subnet_ids
  endpoint_sg_id          = module.security.endpoint_sg_id
}

module "eks" {
  source             = "../../modules/eks"
  cluster_name       = "commerce"
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_app_subnet_ids
}
```

## 4. 실제 코드/msa 연결

### 4.1 EKS 이전 시 Kustomize overlay 추가

```
k8s/overlays/
├── prod-k8s/        # 기존 (managed K8s 일반)
├── k3s-lite/        # 로컬
└── prod-eks/        # NEW — AWS EKS 전용
    ├── kustomization.yaml
    ├── patches/
    │   └── ingress-alb.yaml   # AWS LB Controller annotations
    └── ...
```

### 4.2 AWS LB Controller annotation 패치 예시

```yaml
# k8s/overlays/prod-eks/patches/ingress-alb.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gateway-ingress
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:...
    alb.ingress.kubernetes.io/wafv2-acl-arn: arn:aws:wafv2:...
    alb.ingress.kubernetes.io/healthcheck-path: /actuator/health
```

### 4.3 ADR-0019 후속 결정

- 네트워크 관련 결정 추가 필요:
  - VPC CIDR 할당 (`10.0.0.0/16` 권장)
  - NAT 전략 (AZ 별 vs 공유)
  - VPC Endpoint 기본 세트
  - 프라이빗 endpoint 여부
  - Prefix Delegation 활성화
  - NetworkPolicy 도입

## 5. 장애 시나리오 3개

### 시나리오 1: "EKS 이전 후 서비스 호출이 Cross-AZ 로 폭증"

**증상**: K8s Service 간 호출이 다른 AZ 로 많이 감.

**진단**: Pod 가 AZ 별로 균등 분산, Service 기본이 모든 엔드포인트 균등 선택.

**해결**:
- `spec.trafficDistribution: PreferClose` (K8s 1.30+)
- Pod `topologySpreadConstraints` 로 AZ 별 균등 배치 유지
- VPC Flow Logs 로 사전 모니터링

### 시나리오 2: "AWS LB Controller 가 ALB 를 생성 안 함"

**증상**: Ingress 생성했는데 ALB 안 뜸, `kubectl describe ingress` 에 에러.

**진단**:
1. AWS LB Controller 설치 여부 확인
2. IRSA (IAM Role for Service Account) 설정 확인
3. 서브넷 태그 (`kubernetes.io/role/elb`) 확인
4. VPC 의 Endpoint 또는 NAT 가 있어야 Controller 가 AWS API 호출 가능

**해결**:
- Helm 으로 Controller 설치
- 서비스 계정에 IAM Role 매핑
- 서브넷 태그 점검

### 시나리오 3: "Terraform 으로 EKS 만든 후 kubectl 접속 불가"

**증상**: `kubectl get nodes` 실패, "Unable to connect to the server".

**진단**:
1. EKS 의 `endpoint_public_access = false` (프라이빗 endpoint)
2. 로컬 PC 는 VPC 외부 → 직접 접근 불가

**해결**:
- 임시: `endpoint_public_access = true` 로 변경 (보안 감소)
- 장기: VPN (Client VPN) 또는 Bastion + SSM Session Manager 로 경유
- 또는 `endpoint_public_access_cidrs` 로 특정 IP 만 허용

## 6. 면접 꼬리 질문 트리

```
Q17: msa 가 K8s 기반인데 AWS EKS 로 이전한다면?
├── Q17-1: 기존 Ingress (nginx) 를 어떻게 할 건가요?
│   └── Q17-1-1: AWS LB Controller 는 뭘 하나요?
├── Q17-2: VPC CIDR 은 어떻게 설계하나요?
│   └── Q17-2-1: EKS 서브넷은 왜 크게 잡나요?
└── Q17-3: Terraform 모듈을 어떻게 나누나요?
    └── Q17-3-1: 환경(dev/prod) 간 재사용은?
```

**Q17 답변**: K8s Service (ClusterIP) 는 그대로 유지, Ingress 만 `nginx` → `alb` IngressClass 로 전환. cert-manager + Let's Encrypt 는 ACM 으로 대체. 전반적으로 Kustomize overlay 추가 수준의 변경으로 이전 가능.

**Q17-1-1 답변**: Ingress 리소스를 감지해 ALB + Target Group 자동 프로비저닝. annotation 으로 scheme, target-type, ACM 인증서, WAF 지정. EKS 네이티브 방식.

**Q17-2-1 답변**: VPC CNI 가 Pod 마다 서브넷 IP 를 할당 → IP 소진 빠름. `/22` 이상 권장. Prefix Delegation 까지 쓰면 `/20` 고려.

**Q17-3-1 답변**: `modules/` 에 공통 로직, `environments/dev|stg|prod` 가 module 호출 + 변수 주입. Terragrunt 로 backend 설정 DRY.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "ingress-nginx 그대로 EKS 에서 쓰면 됨" | 가능. 단 AWS LB Controller 조합이 EKS 네이티브 |
| "Terraform 으로 만든 EKS 는 바로 kubectl" | 프라이빗 endpoint 시 VPN/Bastion 필요 |
| "Kustomize 와 Terraform 을 동시에 쓰면 혼란" | 전혀 아니다 — 영역 분리 (앱/인프라) 로 자연스러움 |
| "모든 AWS 리소스를 Terraform 으로 관리" | EKS 내부 리소스 (Ingress, Service) 는 K8s 로 |

## 8. 자가 점검 체크리스트

- [ ] K8s 개념 → AWS 매핑 표 즉답
- [ ] Eureka 제거 후 Service DNS 사용 이해
- [ ] Terraform 모듈 5개 분리 설계 가능
- [ ] VPC CIDR 할당 전략 답변 가능
- [ ] AWS LB Controller 의 역할과 설치 방법
- [ ] 프라이빗 endpoint 의 접근 방법 (VPN/Bastion)
- [ ] S3 Gateway + Interface Endpoint 세팅 필요성
- [ ] 서브넷 태그의 AWS LB Controller 자동 선택 이해
- [ ] HPA + Cluster Autoscaler 조합 필요성
- [ ] ADR-0019 후속 결정 항목 나열 가능

## 9. 참고 자료

- AWS EKS Best Practices
- AWS Load Balancer Controller 공식 문서
- Terraform AWS Provider 문서
- msa 프로젝트 ADR-0019
