---
parent: 1-aws-network
subtopic: eks-networking
index: 13
created: 2026-04-16
level: deep
---

# EKS 네트워킹 — Deep Study

## 1. 재확인

EKS 는 Amazon **VPC CNI** 플러그인을 기본 사용. Pod 이 **VPC 서브넷 IP 를 직접 할당**받아 VPC 내 다른 리소스 (RDS 등) 와 동일 네트워크로 통신한다. 다른 K8s CNI (Calico, Flannel) 와의 결정적 차이.

## 2. 내부 메커니즘

### 2.1 VPC CNI 의 IP 할당

- EC2 워커 노드 = ENI (Elastic Network Interface) 를 가짐
- ENI 는 **Secondary IP 주소**를 여러 개 할당받을 수 있음
- Pod 이 생성되면 Secondary IP 하나를 Pod 에 할당
- Pod 는 VPC 서브넷의 하나의 일반 IP 가 됨

```
EC2 워커 노드 (t3.medium)
 ├── Primary ENI
 │   ├── Primary IP 10.0.11.5  (노드 자체)
 │   └── Secondary IPs (Pod 용)
 │       ├── 10.0.11.10 → Pod A
 │       ├── 10.0.11.11 → Pod B
 │       └── 10.0.11.12 → Pod C
 ├── Secondary ENI (필요 시 자동 추가)
 │   ├── 10.0.11.20 → Pod D
 │   └── ...
 └── ...
```

### 2.2 노드당 Pod 수 계산

```
최대 Pod 수 = (ENI 수 × ENI 당 Secondary IP 수) - 1
           └────── 인스턴스 타입별 제한 ──────┘
             (마지막 -1 은 노드 자체 IP 예약)
```

| 인스턴스 타입 | ENI 수 | Secondary IP/ENI | 최대 Pod |
|---|---|---|---|
| t3.small | 3 | 4 | 11 |
| t3.medium | 3 | 6 | 17 |
| m5.large | 3 | 10 | 29 |
| m5.2xlarge | 4 | 15 | 58 |
| m5.16xlarge | 15 | 50 | 737 |

### 2.3 Prefix Delegation

- VPC CNI v1.9+ 기능
- ENI 에 개별 IP 대신 **`/28` prefix (16 IP)** 를 할당
- 같은 ENI 개수로 훨씬 더 많은 Pod 지원

```
Prefix Delegation OFF:  t3.medium = 17 Pod
Prefix Delegation ON:   t3.medium = 110 Pod (기본 K8s 제한)
```

**활성화**:
```
kubectl set env daemonset aws-node -n kube-system \
  ENABLE_PREFIX_DELEGATION=true
```

**단점**: 서브넷 IP 소진이 더 빨라짐 → 서브넷을 `/22` 이상으로 큼직하게.

### 2.4 Pod 네트워킹 흐름

**같은 노드 내 Pod 간 통신**:
```
Pod A (10.0.11.10) → Pod B (10.0.11.11)
  └─ 노드 내 브리지 네트워크로 바로
```

**다른 노드 Pod 간 통신**:
```
Pod A (Node1: 10.0.11.10) → Pod X (Node2: 10.0.12.20)
  └─ VPC 라우팅 (local 경로) → Node2 의 ENI → Pod X
```

**외부 API 호출** (프라이빗 서브넷):
```
Pod → Route Table → NAT Gateway → IGW → Internet
```

### 2.5 K8s Service 타입 → AWS 매핑

| K8s Service | AWS 매핑 | EKS 에서 |
|---|---|---|
| `ClusterIP` | 없음 | VPC 내부 IP (kube-proxy) |
| `NodePort` | 노드 EC2 포트 오픈 | SG 에 포트 허용 필요 |
| `LoadBalancer` (기본) | 구식 **CLB** | 지양 |
| `LoadBalancer` + `nlb` 어노테이션 | **NLB** 자동 생성 | AWS LB Controller 담당 |
| `Ingress` + AWS LB Controller | **ALB** 자동 프로비저닝 | 표준 패턴 |

### 2.6 kube-proxy 의 역할

- 각 노드에서 ClusterIP 를 Pod IP 로 NAT (iptables 또는 IPVS 모드)
- ClusterIP 는 AWS 가 아는 IP 가 아님 → EKS 바깥에서 접근 불가

### 2.7 AWS Load Balancer Controller

- EKS Helm 설치
- `Ingress` 리소스 감지 → ALB 자동 생성
- `Service type=LoadBalancer` + annotation → NLB 자동 생성
- annotation 예시: `alb.ingress.kubernetes.io/target-type: ip`

### 2.8 Pod Security Group (SecurityGroupPolicy)

```yaml
apiVersion: vpcresources.k8s.aws/v1beta1
kind: SecurityGroupPolicy
metadata:
  name: app-sg-policy
spec:
  podSelector:
    matchLabels: { app: order }
  securityGroups:
    groupIds:
      - sg-xxx
```

- Pod 단위 SG 적용
- Branch ENI 기능 활용 (VPC CNI)
- 인스턴스 타입 제약 (m5/t3 등 특정 타입만)

## 3. 설계 결정과 트레이드오프

### 3.1 VPC CNI 의 장단점

**장점**:
- Pod = VPC IP → SG 적용 가능, VPC 내 리소스와 자연스러운 통신
- 네트워크 성능 우수 (오버레이 없음)
- AWS 서비스와 긴밀 통합

**단점**:
- **서브넷 IP 소진 빠름** → 큰 서브넷 필요
- 인스턴스 타입별 Pod 수 제한
- Cross-cluster Pod 통신에 신경 써야 함 (같은 VPC 면 자연스러움)

### 3.2 대안 CNI

- **Calico**: NetworkPolicy 풍부, 오버레이 네트워크, IP 효율
- **Cilium**: eBPF 기반 고성능, 관측성 우수, Service Mesh 일부 대체

둘 다 EKS 에서 선택 가능하지만 **VPC CNI + Calico NetworkPolicy** 조합이 실무 표준.

### 3.3 Service Mesh (Istio/Linkerd)

- mTLS, 트래픽 분할, 관측성 등 추가
- 복잡도 증가, 성능 오버헤드
- EKS + Istio 는 흔한 조합이지만 필요성 판단 중요

## 4. 실제 코드/msa 연결

### 4.1 EKS 클러스터 + 노드 그룹 (Terraform)

```hcl
resource "aws_eks_cluster" "this" {
  name     = "commerce"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = "1.30"
  vpc_config {
    subnet_ids              = concat(aws_subnet.public[*].id, aws_subnet.private[*].id)
    endpoint_public_access  = false  # 프라이빗 endpoint
    endpoint_private_access = true
  }
  enabled_cluster_log_types = ["api", "audit", "authenticator"]
}

resource "aws_eks_node_group" "this" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "default"
  node_role_arn   = aws_iam_role.eks_node.arn
  subnet_ids      = aws_subnet.private[*].id
  instance_types  = ["m5.large"]
  scaling_config {
    desired_size = 2
    min_size     = 2
    max_size     = 10
  }
}
```

### 4.2 Prefix Delegation 활성화

```hcl
resource "kubernetes_daemon_set_v1" "aws_node_patch" {
  # 또는 별도 Helm values.yaml 로 관리
}

# 또는 Terraform addon
resource "aws_eks_addon" "vpc_cni" {
  cluster_name = aws_eks_cluster.this.name
  addon_name   = "vpc-cni"
  configuration_values = jsonencode({
    env = {
      ENABLE_PREFIX_DELEGATION = "true"
      WARM_PREFIX_TARGET       = "1"
    }
  })
}
```

### 4.3 AWS Load Balancer Controller 설치

```bash
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=commerce \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=arn:aws:iam::xxx
```

### 4.4 msa 프로젝트 연결

현재 msa 가 EKS 이전 시 그대로 적용:
- `k8s/base/gateway/ingress.yaml` (ingress-nginx) → **ALB 로 자동 매핑** (AWS LB Controller + annotation 추가)
- 모든 Service(ClusterIP) → VPC 내부 통신 (변경 없음)
- HPA + PDB → 그대로 동작 (AWS 인프라 차원은 Cluster Autoscaler 필요)

## 5. 장애 시나리오 3개

### 시나리오 1: "Pod 이 Pending 상태로 멈춤 — no IP"

**증상**: 새 Pod 스케줄링 실패, 이벤트 `failed to assign an IP to container`.

**진단**:
1. 노드에 IP slot 남아있나? (Pod 개수 상한 확인)
2. 서브넷에 IP 남아있나? (`/24` 면 251개 한도)
3. VPC CNI `aws-node` DaemonSet 정상?

**해결**:
- 단기: 서브넷 추가 / 노드 타입 업그레이드
- 장기: **Prefix Delegation 활성화** + 서브넷 `/22` 이상

### 시나리오 2: "ECR 이미지 pull 실패"

**증상**: Pod 이벤트에 `ImagePullBackOff`.

**진단**:
1. 노드가 프라이빗 서브넷에 있는데 NAT 없거나 VPC Endpoint 없음
2. ECR 권한 (IRSA or Node Role) 없음
3. 이미지 태그 오타

**해결**:
- VPC Endpoint `ecr.api` + `ecr.dkr` + `sts` + `logs` + `s3` (Gateway) 세팅
- IAM Role 에 `AmazonEC2ContainerRegistryReadOnly` 포함

### 시나리오 3: "NetworkPolicy 적용했는데 동작 안 함"

**증상**: `NetworkPolicy` 작성해서 Pod 간 통신 제한 시도했는데 무시됨.

**진단**: **VPC CNI 기본은 NetworkPolicy 미지원**. 지원 옵션:
- VPC CNI v1.14+ 에서 NetworkPolicy 지원 (활성화 필요)
- 또는 Calico 추가 설치

**해결**:
```hcl
resource "aws_eks_addon" "vpc_cni" {
  configuration_values = jsonencode({
    enableNetworkPolicy = "true"
  })
}
```

## 6. 면접 꼬리 질문 트리

```
Q13: EKS 에서 Pod 네트워크는 어떻게 동작하나요?
├── Q13-1: VPC CNI 가 뭐고 다른 CNI 와 어떻게 다른가요?
│   └── Q13-1-1: Pod 가 VPC IP 를 직접 받으면 어떤 이점이 있나요?
├── Q13-2: 노드당 Pod 수 제한은 어떻게 계산하나요?
│   └── Q13-2-1: 이 제한을 늘리는 방법은?
│       └── Q13-2-1-1: Prefix Delegation 의 트레이드오프는?
└── Q13-3: K8s Service 가 AWS 로드밸런서로 어떻게 매핑되나요?
    └── Q13-3-1: AWS Load Balancer Controller 역할은?
```

**Q13 답변**: VPC CNI 덕분에 Pod 이 VPC 서브넷 IP 를 직접 할당받음. 노드 ENI 에 Secondary IP 를 여러 개 붙이는 방식. Pod 이 VPC 의 네이티브 IP 를 쓰므로 RDS, ALB 와 자연스러운 통신 가능.

**Q13-1-1 답변**: (1) Pod 단위 SG 적용 가능 (`SecurityGroupPolicy`), (2) VPC 내 리소스와 자연스러운 통신, (3) 오버레이 없이 네이티브 성능.

**Q13-2-1-1 답변**: Prefix Delegation 은 ENI 당 `/28` prefix (16 IP) 를 통째 할당. Pod 수가 10배 가량 증가. 단점은 **서브넷 IP 소진 급증** → 서브넷을 `/22` 이상으로 미리 크게 잡아야 함.

**Q13-3-1 답변**: Ingress 리소스 → ALB 자동 프로비저닝, Service type=LoadBalancer + annotation → NLB 자동 생성. ALB 와 Target Group 을 K8s 선언만으로 관리 가능.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "Pod 는 노드 IP 를 공유" | VPC CNI 는 **Pod 별 VPC IP** |
| "VPC CNI 기본으로 NetworkPolicy 지원" | v1.14+ + 명시 활성화 필요 |
| "Service LoadBalancer = ALB" | 기본은 **CLB** (구식). 어노테이션으로 NLB 지정 |
| "AWS LB Controller 없어도 ALB 됨" | 안 됨. Controller 필수 |
| "노드당 Pod 수는 K8s 기본 110" | **인스턴스 타입별 제한** (VPC CNI 기본). Prefix Delegation 으로 완화 |

## 8. 자가 점검 체크리스트

- [ ] VPC CNI 의 IP 할당 방식 (ENI Secondary IP) 이해
- [ ] 노드당 Pod 수 공식 `(ENI × IP/ENI) - 1` 즉답
- [ ] Prefix Delegation 의 원리와 트레이드오프
- [ ] K8s Service 타입 4종류 → AWS 매핑 즉답
- [ ] AWS Load Balancer Controller 필수 여부
- [ ] Pod 별 SG (`SecurityGroupPolicy`) 존재 인지
- [ ] VPC CNI 기본 NetworkPolicy 미지원 + 활성화 방법
- [ ] EKS 이전 시 필수 VPC Endpoint 5개 나열
- [ ] 프라이빗 endpoint vs 퍼블릭 endpoint 의미
- [ ] kube-proxy + ClusterIP 동작 이해

## 9. 참고 자료

- Amazon VPC CNI 공식 문서
- EKS Best Practices — Networking
- AWS Load Balancer Controller 공식 문서
- "EKS Pod Networking Deep Dive" AWS 블로그
- Prefix Delegation 공식 가이드
