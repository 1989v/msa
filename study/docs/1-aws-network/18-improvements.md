---
parent: 1-aws-network
subtopic: improvements
index: 18
created: 2026-04-16
level: deep
---

# EKS 이전 개선 포인트 — Deep Study

## 1. 재확인

msa 프로젝트 EKS 이전 시의 **8가지 개선 제안**. 우선순위 + ADR 필요 여부 + 영향 범위 명시. Phase 4 의 중심.

## 2. 개선 제안 종합

| # | 제안 | 우선순위 | ADR 필요 | 비용 영향 |
|---|---|---|---|---|
| 1 | NetworkPolicy 도입 (기본 deny) | **높음** | Y | 없음 |
| 2 | VPC Endpoint 기본 세트 | **높음** | N | 감소 ↓ |
| 3 | EKS 프라이빗 endpoint | **높음** | Y | 없음 (운영 복잡도 ↑) |
| 4 | AWS WAF + CloudFront | 중간 | Y | 증가 ↑ |
| 5 | Cross-AZ 모니터링 + Topology Aware | 중간 | N | 감소 ↓ |
| 6 | NLB 경로 도입 (파트너 대비) | 낮음 | Y | 증가 ↑ |
| 7 | Prefix Delegation | 중간 | N | 없음 |
| 8 | PrivateLink (외부 SaaS 대비) | 낮음 | 시 | 증가 ↑ |

## 3. 제안 상세

### 3.1 [높음] NetworkPolicy 기본 deny

**현재**: msa 의 K8s 에 NetworkPolicy 미적용 → 모든 Pod 간 자유 통신.

**리스크**: 한 Pod 침해 시 횡단 공격 (lateral movement) 가능. 제로 트러스트 위배.

**제안**:
- 기본 정책: **모든 Pod 간 통신 거부**
- 서비스 별 명시적 allow 규칙
- EKS VPC CNI v1.14+ `enableNetworkPolicy=true` 활성화 (또는 Calico 추가)

**예시**:
```yaml
# 기본 deny (namespace 단위)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: commerce
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress

# 서비스별 allow
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: product-from-gateway
  namespace: commerce
spec:
  podSelector:
    matchLabels: { app: product }
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector: { matchLabels: { app: gateway } }
    ports:
    - port: 8080
```

**ADR**: 서비스 간 통신 매트릭스 명문화 필요 → ADR 필수.

### 3.2 [높음] VPC Endpoint 기본 세트

**현재**: 미적용 (EKS 이전 전).

**리스크**: EKS 이전 시 NAT Gateway 데이터 비용 폭증 + 외부 경유 보안 약화.

**제안**: Terraform 기본 module 에 아래 Endpoint 포함:
- **Gateway (무료)**: S3, DynamoDB
- **Interface**: ecr.api, ecr.dkr, sts, logs, secretsmanager

**예상 절감**: EKS Pod 이 월 5TB ECR pull → NAT 경로 $225 → Endpoint 경로 $50+$7 ≈ $57. **월 $168 절감**.

**ADR**: 운영 세부사항 → ADR 불필요, Terraform module 문서화 충분.

### 3.3 [높음] EKS 프라이빗 endpoint

**현재**: 미이전 상태.

**리스크**: 기본값 `endpoint_public_access=true` → API 서버 인터넷 노출.

**제안**: `endpoint_public_access=false, endpoint_private_access=true` 강제. kubectl 접근은 **VPN 또는 Bastion+SSM Session Manager** 로.

**트레이드오프**:
- 보안 강화 ↑
- 운영 복잡도 ↑ (VPN 필요)
- 외부 CI/CD 의 kubectl 실행 제한

**ADR**: 접근 방식 변경 → ADR 필요. 복구 경로 명시.

### 3.4 [중간] AWS WAF + CloudFront

**현재**: ingress-nginx 기본 설정만.

**리스크**: SQL Injection, XSS, bot, Credential stuffing 방어 취약.

**제안**:
```
Internet → CloudFront (Shield Standard + 캐싱)
        → WAF (Managed Rules: Common + KnownBadInputs + BotControl)
        → ALB → ingress-nginx → gateway
```

**비용**: 월 $50-200 추가 (트래픽 의존).

**효과**:
- L7 공격 차단 (SQLi, XSS, bot)
- Edge 캐싱으로 오리진 부하 감소
- Shield Standard 자동 적용

**ADR**: 보안 아키텍처 변경 → ADR 필요.

### 3.5 [중간] Cross-AZ 모니터링 + Topology Aware Routing

**현재**: 로컬 환경, AWS 비용 미발생.

**EKS 이전 시 리스크**: Kafka, LB, Pod 간 통신이 Cross-AZ 로 많이 흐름 → 월 수백 달러 비용.

**제안**:
1. VPC Flow Logs → S3 → Athena 로 트래픽 분석
2. K8s Service 에 `trafficDistribution: PreferClose` 적용
3. Kafka Broker `broker.rack` + Consumer `client.rack` 설정
4. ALB `enable_cross_zone_load_balancing` 운영 데이터 기반 판단

**ADR**: 운영 튜닝 → ADR 불필요, 운영 가이드 문서.

### 3.6 [낮음] NLB 경로 도입

**현재**: 모든 외부 인입 = ALB.

**미래 요건**: 파트너사 IP 화이트리스트 등록 필요한 연동 발생 시.

**제안**:
- NLB + EIP 로 고정 IP 제공
- NLB → 내부 ALB 또는 EKS Ingress 로 포워딩
- 파트너 Endpoint 분리

**ADR**: 아키텍처 변경 → ADR 필요.

### 3.7 [중간] VPC CNI Prefix Delegation

**현재**: 미이전 상태. 기본 활성화 시 Pod 수 제한.

**제안**: EKS 이전 시점부터 `ENABLE_PREFIX_DELEGATION=true` 활성화.

**효과**: `t3.medium` 노드 17 → 110 Pod. `m5.large` 29 → 수백.

**전제**: 서브넷이 `/22` 이상 커야 함.

**ADR**: 구성 디테일 → ADR 불필요.

### 3.8 [낮음] PrivateLink 준비

**현재**: 외부 SaaS 연동 없음.

**미래 요건**: Datadog, Snowflake, Confluent Cloud 등 도입 시.

**제안**: PrivateLink 지원 제공자 우선 선택. 네트워크 레벨 보안 확보.

**ADR**: 도입 시 ADR.

## 4. 구현 로드맵 (EKS 이전 기준)

### Day-1 (이전 시작 당일)
- ☑ VPC 설계 (CIDR `/16` + 서브넷 3 AZ × 2종류 `/22` EKS + `/24` DB)
- ☑ NAT Gateway × 3 AZ
- ☑ VPC Endpoint 필수 5개 세팅 (#2)
- ☑ EKS 클러스터 (프라이빗 endpoint, #3)
- ☑ VPC CNI Prefix Delegation (#7)
- ☑ SG 체인 (ALB → App → DB)

### Week-1
- ☑ AWS LB Controller 설치
- ☑ cert-manager → ACM 전환
- ☑ Kustomize `prod-eks` overlay 작성
- ☑ NetworkPolicy 기본 deny + 서비스별 allow (#1)

### Week-2~4
- ☑ CloudFront + WAF 도입 (#4)
- ☑ VPC Flow Logs + Athena 설정
- ☑ Cross-AZ 트래픽 분석 + Topology Aware (#5)
- ☑ Kafka rack awareness

### 이후 요건 발생 시
- ☑ NLB 경로 (#6)
- ☑ PrivateLink (#8)

## 5. 장애 시나리오 3개

### 시나리오 1: "NetworkPolicy 적용 후 일부 서비스 통신 실패"

**증상**: `default-deny-all` 적용 후 일부 Pod 간 호출 실패.

**진단**: allow 규칙 누락.

**해결**:
- 서비스 호출 그래프 사전 수집 (Kiali 또는 service mesh 관측 도구)
- 점진적 적용 (namespace 단위)
- 테스트 환경에서 검증 후 프로덕션

### 시나리오 2: "EKS 프라이빗 endpoint 후 CI/CD 가 kubectl 실행 못함"

**증상**: GitHub Actions 에서 `kubectl apply` 실패.

**진단**: CI runner 가 VPC 외부 → API 서버 접근 불가.

**해결**:
- **Self-hosted runner** 를 VPC 내 EC2 에 배치
- 또는 **AWS CodeBuild** (VPC 내부 실행)
- 또는 GitOps (ArgoCD) 로 전환 — push 대신 pull 방식

### 시나리오 3: "WAF 가 정상 트래픽을 차단"

**증상**: WAF 배포 후 사용자 일부가 403.

**진단**: Managed Rules 중 `AWSManagedRulesCommonRuleSet` 의 Body size limit 이 큰 업로드 API 차단.

**해결**:
- CloudWatch WAF metrics 로 차단 rule 식별
- 해당 rule 을 Count 모드로 전환 (차단 대신 로깅만)
- 또는 해당 rule 비활성, 해당 API path 예외 처리

## 6. 면접 꼬리 질문 트리

```
Q18: 현재 프로젝트를 AWS EKS 로 이전한다면 뭐부터 개선하시겠어요?
├── Q18-1: NetworkPolicy 를 왜 가장 먼저 꼽나요?
│   └── Q18-1-1: 기본 deny 로 두면 기존 트래픽은 어떻게?
├── Q18-2: VPC Endpoint 는 왜 필요한가요?
│   └── Q18-2-1: 구체적으로 어떤 endpoint 를 세팅하나요?
└── Q18-3: 보안 + 비용 중 뭘 우선하시겠어요?
    └── Q18-3-1: 현실적으로 어떻게 밸런스?
```

**Q18 답변**: (1) 보안 기반 — NetworkPolicy + 프라이빗 endpoint + WAF. (2) 비용 기반 — VPC Endpoint, Cross-AZ Topology Aware, Prefix Delegation. 우선순위는 보안 기반 먼저, 비용 최적화 병행.

**Q18-1-1 답변**: 서비스 호출 그래프 사전 수집 → 점진적 allow 규칙 작성 → 테스트 환경 검증 → 네임스페이스 단위 롤아웃. 단계적 적용.

**Q18-2-1 답변**: 필수 5개 — S3 (Gateway, 무료) + ECR api/dkr + STS + Logs. 사용 따라 Secrets Manager, SQS, Kinesis 추가.

**Q18-3-1 답변**: 보안은 **놓치면 복구가 치명적** — 기본값으로 강제. 비용은 점진 최적화 가능. Day-1 보안 체크리스트 통과 후 비용 튜닝.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "NetworkPolicy 만 적용하면 완전 보안" | Pod 별 SG + WAF + IAM 조합 필요 |
| "프라이빗 endpoint = 절대 안전" | SSM/VPN 경로 자체의 보안도 확인 |
| "WAF 는 만능" | L7 공격만 차단, DDoS 는 Shield |
| "비용 절감 > 고가용성" | 장애 복구 비용이 훨씬 큼 |
| "개선은 한꺼번에" | 점진적 롤아웃이 안전 |

## 8. 자가 점검 체크리스트

- [ ] 8가지 개선 포인트 각각의 우선순위 + 근거 설명 가능
- [ ] NetworkPolicy 기본 deny + allow 체인 설계 가능
- [ ] VPC Endpoint 필수 5개 나열
- [ ] 프라이빗 endpoint 도입 시 CI/CD 대응
- [ ] WAF Managed Rules 와 운영 실수 대응
- [ ] Cross-AZ 비용 최적화 3가지 방법
- [ ] Prefix Delegation 과 서브넷 크기 관계
- [ ] EKS 이전 Day-1 체크리스트 10개 이상
- [ ] 보안 vs 비용 트레이드오프 논리적 설명
- [ ] 장애 시나리오 3개와 복구 방법

## 9. 참고 자료

- EKS Best Practices — Security
- AWS Well-Architected Framework
- "Zero Trust in AWS" 백서
- NetworkPolicy + Calico 공식 가이드
