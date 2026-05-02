# ADR-0031: K8s NetworkPolicy 도입 (Default-Deny + 서비스간 명시 허용)

## Status

Proposed (2026-05-02)

> 본 ADR 은 ADR-0019 (K8s 전환) 의 보안 기둥 중 하나를 채운다. Service Mesh / mTLS 는
> 별도 ADR (P3, 미할당) 에서 다루며, 본 ADR 은 L3/L4 NetworkPolicy 만 다룬다.

## Context

### 1. 현 상태 — NetworkPolicy 0건

`study/docs/11-k8s-deep-dive/15-msa-k8s-grep.md` audit 결과:

```
$ grep -rn "NetworkPolicy" k8s/
(0 matches)
```

| 항목 | 현재 | 비고 |
|---|---|---|
| HPA | 16개 (`prod-k8s/hpa.yaml`) | minReplicas 2, maxReplicas 4-8 |
| PDB | 16개 (`prod-k8s/pdb.yaml`) | minAvailable 1 |
| **NetworkPolicy** | **0개** | **즉시 보안 gap** |
| topologySpread / nodeAffinity | 0개 | AZ 분산 미보장 (별도 ADR) |
| PSS label (namespace) | 미설정 | 별도 ADR (PSS) |
| Service Mesh | 미도입 | mTLS 부재 |

스케일링 / 가용성 측면(HPA·PDB)은 prod 오버레이에 갖춰졌지만, **네트워크 격리 측면에서
는 사실상 클러스터-내 평문 plain 네트워크**다. 같은 `commerce` namespace 안의 모든 Pod
가 임의의 다른 Pod 의 임의의 포트로 자유롭게 호출할 수 있다.

### 2. 위협 모델 (Threat Model)

본 ADR 이 방어 대상으로 삼는 시나리오:

| # | 시나리오 | 현재 노출도 | 영향 |
|---|---|---|---|
| T1 | 임의 Pod 가 gateway 우회 → `product:8081` 직접 호출 (X-User-Id 헤더 위조) | 100% 노출 | 인증 / 인가 우회. ADR-0004 헤더 신뢰 모델 무력화 |
| T2 | 침해된 사이드카 / 디버그 Pod (`kubectl run --rm` 또는 `ephemeral container`) → MySQL 3306 직접 접근 | 100% 노출 | DB 자격 증명 만 알면 데이터 유출. credential leak 시 즉시 lateral movement |
| T3 | 침해된 워커 Pod → kube-system 내부 (kubelet, etcd metrics, kube-proxy) 정찰 | 100% 노출 | 클러스터 인텔리전스 수집 |
| T4 | 침해된 Pod → 외부 인터넷 임의 호스트 호출 (cryptominer, C2, exfiltration) | 100% 노출 | 데이터 유출 / 자원 도용 |
| T5 | 다른 namespace (예: monitoring, ingress-nginx) 의 Pod 가 commerce 백엔드에 직접 호출 | 100% 노출 | 회계상 의도된 트래픽이 아닌 cross-ns 호출 |
| T6 | Kafka cluster 의 외부 노출 listener (`9092`) 가 commerce 외 ns 에서 접근 가능 | 100% 노출 | Producer/Consumer 위장 가능 |

T1 은 특히 중요하다. 본 플랫폼은 ADR-0004 에 따라 gateway 가 JWT 를 검증하고 다운스트림
서비스에는 `X-User-Id`, `X-User-Role` 등의 헤더를 신뢰값으로 전달한다. 이 모델의 전제는
"백엔드는 gateway 를 거친 트래픽만 받는다"이지만, NetworkPolicy 가 0건이면 그 전제가
보장되지 않는다. 침해된 Pod 가 임의 헤더를 직접 주입한 채 백엔드를 호출할 수 있다.

### 3. msa 의 Service Mesh 미도입 — mTLS 부재

`study/docs/11-k8s-deep-dive/15-msa-k8s-grep.md:101` — Service Mesh 미도입.

mTLS 도입은 별도 ADR (Service Mesh 도입, P3) 로 분리되어 있다. 본 ADR 은 mTLS 까지 가지
않는다. 즉 **트래픽 내용의 도청은 막지 못한다**(같은 노드의 root 권한 또는 클러스터 관리자
권한이 있다면 tcpdump 가능). 그러나 L3/L4 NetworkPolicy 만으로도 다음을 해결한다:

- **Lateral movement 차단** (T1, T2, T3) — 침해된 Pod 가 임의 백엔드 / 인프라 / 외부에
  자유롭게 도달하는 것을 막는다.
- **Compliance baseline** — K-ISMS / PCI-DSS 의 네트워크 격리 요구는 NetworkPolicy 로 일부
  충족된다.
- **Defense in depth** — 추후 mTLS 가 도입되더라도 L3/L4 격리는 별도 layer 로 가치 유지.

### 4. 결합 포인트 (다른 ADR 과의 관계)

- **ADR-0019 (K8s migration)**: 본 ADR 의 모든 결정은 ADR-0019 의 namespace (`commerce`),
  라벨 표준 (`app.kubernetes.io/name`, `app.kubernetes.io/part-of=commerce-platform`),
  배포 모드 이원화 (k3s-lite / prod-k8s) 위에서 작동한다.
- **ADR-0004 (인증/인가)**: gateway 의 헤더 신뢰 모델을 네트워크 레벨에서 보강한다.
- **ADR-0027 (KMS)**: Pod → 외부 KMS API (OCI Vault) egress 가 명시적으로 허용되어야
  한다. 본 ADR 의 `allow-egress-https-public` 정책에서 다룬다.

## Decision

### 1. 정책 골격 — Default-deny + Allowlist

`commerce` namespace 에 다음 정책 set 을 도입한다.

| 정책 이름 | policyTypes | 대상 (podSelector) | 허용 방향 |
|---|---|---|---|
| `default-deny-all` | Ingress, Egress | `{}` (ns 전체) | 없음 (모두 차단) |
| `allow-dns-egress` | Egress | `{}` (ns 전체) | → kube-system kube-dns:53 |
| `allow-ingress-to-gateway` | Ingress | gateway | ingress-nginx ns → :8080 |
| `allow-gateway-to-backends` | Ingress | part-of=commerce-platform, name!=gateway | gateway → 각 서비스 named port |
| `allow-backend-to-backend` | Ingress | part-of=commerce-platform | 명시 페어만 (order → product 등) |
| `allow-app-to-mysql` | Ingress | name=mysql | 같은 ns 백엔드 → :3306 |
| `allow-app-to-redis` | Ingress | name=redis | 같은 ns 백엔드 → :6379 |
| `allow-app-to-kafka` | Ingress | name=kafka | 같은 ns 백엔드 → :9092 |
| `allow-app-to-search` | Ingress | name in [elasticsearch, opensearch] | 같은 ns 백엔드 → :9200 |
| `allow-app-to-clickhouse` | Ingress | name=clickhouse | analytics → :8123 |
| `allow-monitoring-scrape` | Ingress | part-of=commerce-platform | monitoring ns prometheus → actuator named port |
| `allow-egress-https-public` | Egress | 명시 서비스 (auth, quant, gifticon, charting) | 외부 :443 (TCP) |

**원칙**: 모든 통신은 *기본 차단*이다. 새 통신을 열려면 PR 로 NetworkPolicy 를 추가한다.

### 2. CNI 선택 — Cilium (운영) / k3d 의 Calico (로컬)

| 운영 환경 | CNI | 근거 |
|---|---|---|
| **prod-k8s (managed)** | **Cilium** 권장 | eBPF 데이터플레인, 표준 NetworkPolicy 완전 지원, Hubble 로 NetworkPolicy 디버깅(드롭 흐름 시각화), 추후 L7/CiliumNetworkPolicy 로 확장 가능 |
| EKS 사용 시 | VPC CNI + Calico add-on or **Cilium chaining** | EKS 의 VPC CNI 는 NetworkPolicy 를 v1.14+ 부터 옵션 지원. Cilium chaining 또는 VPC CNI `enableNetworkPolicy=true` |
| GKE 사용 시 | Dataplane V2 (Cilium 기반) | 기본 지원. 별도 설치 불필요 |
| AKS 사용 시 | Azure CNI Powered by Cilium | Microsoft 와 Isovalent 협업 옵션 |
| **k3s-lite (k3d, 로컬)** | k3s 기본 Flannel + Calico add-on, 또는 k3d cluster create 시 `--k3s-arg "--flannel-backend=none"` + Cilium | 로컬에서도 정책 동작을 검증하려면 NetworkPolicy 지원 CNI 필수 |

**가정**: 본 ADR 은 운영을 **Cilium** 으로, 로컬은 NetworkPolicy 를 지원하는 CNI(Calico
또는 Cilium) 로 한정한다. Flannel 단독 운영은 본 ADR 발효 후 금지(NetworkPolicy 가 silent
no-op 가 되어 *false sense of security* 를 만든다).

> 참고: `study/docs/11-k8s-deep-dive/06-ingress-gateway-api.md:202` — "flannel 만 깔린 클
> 러스터에서는 정책이 무시되며 false sense of security."

### 3. 라벨 표준 (이미 충족)

본 ADR 은 신규 라벨을 강제하지 않는다. 모든 Deployment 가 이미 다음을 갖고 있다:

```yaml
labels:
  app.kubernetes.io/name: <service-name>          # gateway, product, order, ...
  app.kubernetes.io/part-of: commerce-platform     # 공통
```

— `k8s/base/gateway/deployment.yaml:6-8`, `k8s/base/product/deployment.yaml:6-8` 등 16개
서비스 deployment 모두 동일 패턴. 본 ADR 의 모든 selector 가 이 두 라벨을 사용한다.

또한 `commerce` namespace 자체에 `kubernetes.io/metadata.name=commerce` 라벨이 K8s 1.22+
에서 자동 부여되므로, cross-namespace selector 가 가능하다.

### 4. 디렉토리 구조

```
k8s/
  base/
    network-policy/                  # 신설 (본 ADR)
      kustomization.yaml
      00-default-deny.yaml
      01-allow-dns-egress.yaml
      02-allow-ingress-to-gateway.yaml
      03-allow-gateway-to-backends.yaml
      04-allow-backend-to-backend.yaml
      05-allow-app-to-mysql.yaml
      06-allow-app-to-redis.yaml
      07-allow-app-to-kafka.yaml
      08-allow-app-to-search.yaml
      09-allow-app-to-clickhouse.yaml
      10-allow-monitoring-scrape.yaml
      11-allow-egress-https-public.yaml
  overlays/
    k3s-lite/
      kustomization.yaml             # patches 로 prometheus-scrape 정책 비활성 (monitoring ns 미배포)
    prod-k8s/
      kustomization.yaml             # 그대로 활성
```

base 에 두는 이유: k3s-lite / prod-k8s 양쪽에서 공통 정책을 공유하고, 환경별 차이는
overlay patch 로 처리. (ADR-0019 의 base/overlay 패턴을 그대로 따른다.)

### 5. 정책 YAML 예시

#### 5.1 Default-deny

```yaml
# k8s/base/network-policy/00-default-deny.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: commerce
spec:
  podSelector: {}                  # ns 전체
  policyTypes: [Ingress, Egress]
  # ingress / egress 필드 없음 → 모두 차단
```

#### 5.2 DNS egress 허용 (필수 — 안 풀면 모든 서비스가 즉사)

```yaml
# k8s/base/network-policy/01-allow-dns-egress.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns-egress
  namespace: commerce
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - { port: 53, protocol: UDP }
        - { port: 53, protocol: TCP }
```

#### 5.3 ingress-nginx → gateway 만

```yaml
# k8s/base/network-policy/02-allow-ingress-to-gateway.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-to-gateway
  namespace: commerce
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: gateway
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
      ports:
        - { port: 8080, protocol: TCP }
```

#### 5.4 gateway → 모든 백엔드 named port

본 플랫폼은 서비스마다 포트가 다르다 (`grep -rn "containerPort" k8s/base`):

| 서비스 | port | 서비스 | port |
|---|---|---|---|
| gateway | 8080 | inventory | 8085 |
| product | 8081 | gifticon / chatbot | 8086 |
| order | 8082 | auth | 8087 |
| search | 8083 | fulfillment | 8088 |
| search-consumer | 8084 | code-dictionary | 8089 |
| analytics / warehouse / agent-viewer-api | 8090 | experiment | 8091 |
| search-batch | 8092 | member | 8093 |
| quant | 8094 | wishlist | 8095 |
| charting (FastAPI) | 8010 | FE Pods (admin/charting/quant/...) | 80 |

named port `http` 를 selector 로 쓰면 포트 번호 다양성은 추상화된다.

```yaml
# k8s/base/network-policy/03-allow-gateway-to-backends.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-gateway-to-backends
  namespace: commerce
spec:
  podSelector:
    matchExpressions:
      - { key: app.kubernetes.io/part-of, operator: In, values: [commerce-platform] }
      - { key: app.kubernetes.io/name, operator: NotIn, values: [gateway] }
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: gateway
      ports:
        - { port: http, protocol: TCP }     # named port
```

#### 5.5 백엔드 ↔ 백엔드 (제한적 — order → product 만)

`order/.../WebClientConfig.kt:14-18` 가 유일한 직접 백엔드-백엔드 호출
(ADR-0019 §사전조사). 명시적으로만 허용:

```yaml
# k8s/base/network-policy/04-allow-backend-to-backend.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-order-to-product
  namespace: commerce
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: product
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: order
      ports:
        - { port: http, protocol: TCP }
```

새 백엔드-백엔드 호출이 추가되면 PR 에 별도 Document 추가. 이는 의도된 마찰
(architectural friction) — Saga / 이벤트 기반 통신을 권장하기 위함.

#### 5.6 백엔드 → MySQL (3306)

```yaml
# k8s/base/network-policy/05-allow-app-to-mysql.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-app-to-mysql
  namespace: commerce
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: mysql
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchExpressions:
              - { key: app.kubernetes.io/part-of, operator: In, values: [commerce-platform] }
              - { key: app.kubernetes.io/name, operator: NotIn, values: [mysql, redis, kafka, elasticsearch, opensearch, clickhouse] }
      ports:
        - { port: 3306, protocol: TCP }
```

#### 5.7 백엔드 → Redis (6379)

```yaml
# k8s/base/network-policy/06-allow-app-to-redis.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-app-to-redis
  namespace: commerce
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: redis
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchExpressions:
              - { key: app.kubernetes.io/part-of, operator: In, values: [commerce-platform] }
              - { key: app.kubernetes.io/name, operator: NotIn, values: [mysql, redis, kafka, elasticsearch, opensearch, clickhouse] }
      ports:
        - { port: 6379, protocol: TCP }
```

prod-k8s 의 Bitnami Redis Cluster 는 별도 라벨 (`app.kubernetes.io/name=redis`)을 그대로
사용하므로 selector 호환. `k8s/infra/prod/redis/values.yaml:33` 의 `networkPolicy.enabled:
false` 는 본 ADR 도입 후 `true` 로 전환 검토 (Bitnami chart 의 자체 NetworkPolicy 사용
or 본 ADR 정책으로 일원화).

#### 5.8 백엔드 → Kafka (9092)

```yaml
# k8s/base/network-policy/07-allow-app-to-kafka.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-app-to-kafka
  namespace: commerce
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: kafka
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchExpressions:
              - { key: app.kubernetes.io/part-of, operator: In, values: [commerce-platform] }
              - { key: app.kubernetes.io/name, operator: NotIn, values: [mysql, redis, kafka, elasticsearch, opensearch, clickhouse] }
      ports:
        - { port: 9092, protocol: TCP }       # CLIENT listener (k8s/infra/local/kafka/service.yaml:13)
        # NOTE: 29092 (INTERNAL) 와 9093 (CONTROLLER) 는 broker 자기 자신만 사용 → 외부 허용 X
```

prod 의 Strimzi Kafka 는 별도 라벨 (`strimzi.io/cluster=commerce`) 을 사용하므로 prod
overlay 에서 selector 보강 필요 (ADR Phase 2 작업).

#### 5.9 모니터링 scrape — monitoring ns → 모든 백엔드 actuator

```yaml
# k8s/base/network-policy/10-allow-monitoring-scrape.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-monitoring-scrape
  namespace: commerce
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/part-of: commerce-platform
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: monitoring
      ports:
        - { port: http, protocol: TCP }       # /actuator/prometheus on named "http" port
```

— `k8s/infra/prod/monitoring/servicemonitor-apps.yaml:8` 가 monitoring ns 에서 scrape.

#### 5.10 외부 HTTPS egress — 제한된 서비스만

`auth` (OAuth 토큰 검증), `quant` (거래소 API + Telegram), `gifticon` (외부 OCR),
`charting` (외부 시세 API) 만 외부 :443 가 필요하다. 다른 서비스는 외부 인터넷 차단.

```yaml
# k8s/base/network-policy/11-allow-egress-https-public.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-egress-https-public
  namespace: commerce
spec:
  podSelector:
    matchExpressions:
      - { key: app.kubernetes.io/name, operator: In, values: [auth, quant, gifticon, charting] }
  policyTypes: [Egress]
  egress:
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8        # 클러스터 내부
              - 172.16.0.0/12
              - 192.168.0.0/16
      ports:
        - { port: 443, protocol: TCP }
```

이 정책이 KMS (OCI Vault) egress 도 커버한다 — `quant` 이 ADR-0027 의 KMS 호출
서비스이기 때문이다. 다른 서비스가 추후 KMS 가 필요하면 list 에 추가한다.

### 6. 단계적 Rollout

| Phase | 범위 | enforce | 기간 | 종료 기준 |
|---|---|---|---|---|
| Phase 0 | 관측만 — Cilium Hubble 로 현재 네트워크 흐름 6시간 캡처 + 매트릭스 작성 | none | 1주 | "정상 트래픽" 매트릭스 합의 |
| Phase 1 | k3s-lite 에 default-deny 만 배포 (allow 정책은 모두 함께) | full | 1주 | smoke test 통과 + 개발자 reproducibility 확인 |
| Phase 2 | prod-k8s 에 default-deny 배포. 단 `default-deny-all` 은 namespace 부분 적용 (예: quant 만 먼저, 그 후 commerce 전체) | partial → full | 2주 | Hubble 드롭 카운트 0 (정상 트래픽), Sentry/Slack 알림 zero |
| Phase 3 | 신규 서비스 PR 시 NetworkPolicy 의무 (Kyverno `require-network-policy` 또는 `validate` 정책으로 enforce) | enforce | continuous | PR template 에 체크박스 |

각 phase 종료 시 `/hns:wrapup` 으로 회고 → 롤백 게이트 체크.

**롤백 절차**: `kubectl delete -k k8s/base/network-policy` 한 줄. base 에 모듈로 분리된
구조이므로 부분 롤백이 쉽다.

### 7. 검증 (Verification)

- **Hubble 흐름 시각화**: `hubble observe --namespace commerce --type drop` — Phase 1/2 중
  드롭이 발생하는 source/destination 을 실시간 추적.
- **conformance test**: `cyclonus` 또는 `np-viewer` 로 정책 매트릭스 → 테스트 케이스 자동
  생성 (예정, ops 작업).
- **smoke test (수동)**:
  1. `kubectl exec -it <gateway-pod> -- curl http://product:8081/actuator/health` → 200
  2. `kubectl run --rm -it dbg --image=busybox -- wget -qO- product:8081/actuator/health`
     → timeout (NetworkPolicy 가 작동)
  3. `kubectl exec -it <product-pod> -- nc -vz mysql-product-master 3306` → connected
  4. `kubectl exec -it <product-pod> -- nc -vz google.com 443` → timeout (외부 차단)

## Alternatives Considered

### A. mTLS 만 (Service Mesh Istio/Linkerd)

- 장점: L7 인증 + 트래픽 암호화. 가장 강력.
- 단점: Mesh 도입 비용 (sidecar 또는 ambient mode 의 운영 학습 곡선, latency overhead 5-10%).
  Phase 1 시점에는 과한 투자.
- 결정: defer. Service Mesh 도입 별도 ADR (P3, 미할당) 에서 판단. 그동안에도 NetworkPolicy
  는 mesh 도입 후에도 defense in depth 로 가치 유지하므로 본 ADR 을 먼저 한다.

### B. NetworkPolicy 부분 도입 (백엔드만, 인프라 제외)

- 장점: 변경 범위 작음.
- 단점: T2 (인프라 직접 접근) 시나리오를 막지 못함. 가장 큰 leak 통로 (DB credential leak →
  cross-pod data exfil) 가 그대로 유지.
- 결정: reject. 인프라 격리가 본 ADR 의 핵심 이득이다.

### C. Calico GlobalNetworkPolicy 만 사용

- 장점: cluster-wide 정책 한 군데서 관리.
- 단점: CNI 종속 (Cilium 으로 옮기면 변환 필요), kustomize base/overlay 구조와 미스매치.
- 결정: reject. 표준 `networking.k8s.io/v1` NetworkPolicy 만 사용하고, CNI 는 데이터플레인
  구현체로만 본다. 추후 L7 정책이 필요하면 그때 CiliumNetworkPolicy 를 추가 도입.

### D. AdminNetworkPolicy (K8s 1.29+ alpha → 1.30 beta)

- 장점: 클러스터 전역 정책, namespace 우선순위 차원이 있어 baseline policy 작성에 적합.
- 단점: 2026-05 시점에 stable 미진입 (cluster admin 만 접근), 운영 환경 의존성 추가.
- 결정: defer. 표준 NetworkPolicy 로 시작하고 stable 진입 후 baseline 부분만 이관 검토.

### E. eBPF 로 직접 정책 (Cilium L7 / Calico eBPF)

- 장점: HTTP method/path 단위 제어 가능 (`study/docs/11-k8s-deep-dive/06-ingress-gateway-api.md:208`).
- 단점: CNI 종속 + 학습 곡선. 본 ADR 의 1차 목표 (lateral movement 차단) 에는 과함.
- 결정: defer. mesh 도입 ADR 또는 별도 L7-policy ADR 에서 다룸.

## Consequences

### Positive

- **Lateral movement 즉시 차단** — T1 (gateway 우회) / T2 (인프라 직접) / T3 (cross-ns) /
  T4 (외부 임의) 4개 시나리오를 모두 막는다.
- **ADR-0004 의 헤더 신뢰 모델 보강** — gateway 만이 백엔드 호출 가능 → `X-User-Id` 위조
  불가.
- **Compliance baseline** — K-ISMS / PCI-DSS 의 네트워크 격리 항목 일부 충족.
- **Defense in depth** — 추후 mesh / mTLS 도입 시에도 별도 layer 로 가치 유지.
- **Observability bonus** — Cilium Hubble 도입 시 네트워크 흐름 매트릭스 가시화 → 의도하지
  않은 통신 발견 (refactoring 기회).

### Negative

- **디버깅 난이도 ↑** — `connection refused` 가 코드 버그인지 NetworkPolicy 차단인지 식별
  어려움. 운영 도구 (Hubble UI 또는 `kubectl get netpol` + `cyclonus`) 학습 필요.
- **신규 서비스 / 신규 통신 추가 시 PR 마찰** — 새 NetworkPolicy 작성 의무 (Phase 3
  Kyverno enforce 시점부터). 의도된 architectural friction 이지만 신규 서비스 출시 일정에
  +0.5d 영향.
- **CNI 종속성 추가** — 운영 클러스터가 NetworkPolicy 지원 CNI (Cilium / Calico /
  Dataplane V2) 여야 함. flannel-only EKS 클러스터 사용 불가.
- **mTLS 까지는 제공 안 함** — 트래픽 도청 가능 (같은 노드의 root). 본 ADR 범위 외.
- **k3s-lite 학습 곡선** — k3s 기본 Flannel 사용자는 Calico 또는 Cilium 으로 교체 필요.

### Neutral

- prod-k8s overlay 의 `networkPolicy.enabled: false` (Bitnami Redis Helm) 와 본 ADR 의
  중복 정책 정리 필요 — Phase 2 말미에 일원화.
- Strimzi Kafka 는 자체 라벨 (`strimzi.io/cluster=commerce`) 을 쓰므로 prod overlay 에서
  Kafka selector 한 줄 추가 필요.

## Rollout Plan

| Phase | 작업 | 결과물 |
|---|---|---|
| Phase 0 (1주) | Hubble 설치 + 6시간 트래픽 캡처 + 매트릭스 도큐 작성 | `study/docs/11-k8s-deep-dive/network-flow-baseline.md` |
| Phase 1 (1주) | `k8s/base/network-policy/` 디렉토리 신설 + k3s-lite 적용 + smoke test | `k8s/base/network-policy/*.yaml` (12개), `docs/conventions/network-policy.md` |
| Phase 2 (2주) | prod-k8s 적용 (quant namespace 부분 → 전체 commerce) + Bitnami / Strimzi 라벨 정합 | prod overlay patches |
| Phase 3 (continuous) | Kyverno `require-network-policy` 정책 + PR template 체크박스 | `k8s/policies/kyverno/require-network-policy.yaml` |

총 **Phase 4단계** (Phase 0 ~ Phase 3).

## Blockers / Open Questions

- [ ] **CNI 결정 확정** — prod-k8s 가 EKS / GKE / AKS / 자체 운영 중 어디인가? CNI 가
      Calico vs Cilium vs Dataplane V2 인지 확정해야 Phase 0 진입 가능.
- [ ] **Cilium 라이선스/지원** — Hubble UI 는 OSS, 일부 엔터프라이즈 기능은 Isovalent
      유료. msa 는 OSS 만으로 충분한지 확인.
- [ ] **k3s-lite 사용자 환경 영향** — k3d 기본 cluster create 명령에 `--k3s-arg` 추가
      필요 → `k8s/infra/local/ingress-nginx/README.md` 갱신 (Phase 1 작업).
- [ ] **Strimzi / Bitnami chart 의 자체 NetworkPolicy 와 중복** — Phase 2 시점 결정
      (본 ADR 정책으로 일원화 vs chart 옵션 활용).
- [ ] **Kyverno 도입 ADR** — Phase 3 의 enforce 메커니즘. 본 ADR 과 별도 ADR 필요할 수도
      (Kyverno 자체가 PSS / 라벨 강제 등 다른 정책에도 사용됨).
- [ ] **monitoring namespace 의 라벨 보장** — `kubernetes.io/metadata.name=monitoring`
      라벨이 자동 부여되는지 (K8s 1.22+ 자동) 확인.

## References

- 학습 노트 (배경):
  - `study/docs/11-k8s-deep-dive/06-ingress-gateway-api.md` §4 (NetworkPolicy + 함정 5가지)
  - `study/docs/11-k8s-deep-dive/14-k8s-security.md` §8 (NetworkPolicy 보안 다시)
  - `study/docs/11-k8s-deep-dive/15-msa-k8s-grep.md` §2 (audit, NetworkPolicy 0건)
  - `study/docs/11-k8s-deep-dive/16-improvements.md` #1 (default-deny 제안)
  - `study/docs/00-ADR-CANDIDATES.md` ADR-0034 (study 노트의 원본 후보, 본 ADR 의 모태)
- 실코드:
  - `k8s/overlays/k3s-lite/kustomization.yaml`, `k8s/overlays/prod-k8s/kustomization.yaml`
  - `k8s/infra/local/{namespace,mysql,redis,kafka,elasticsearch,opensearch,clickhouse}/`
  - `k8s/infra/prod/{strimzi,redis,percona-mysql,monitoring}/`
  - `k8s/base/{gateway,product,order,search,...}/deployment.yaml`
- 관련 ADR:
  - ADR-0019 (K8s migration) — namespace / 라벨 표준 / 배포 모드 이원화의 기반
  - ADR-0004 (인증/인가) — 헤더 신뢰 모델 보강
  - ADR-0027 (KMS / OCI Vault) — 외부 egress 정책의 입력
  - ADR-0015 (Resilience) — circuit breaker 와 NetworkPolicy 차단의 시맨틱 구분
- 외부 문서:
  - Kubernetes NetworkPolicy reference: https://kubernetes.io/docs/concepts/services-networking/network-policies/
  - Cilium Network Policy: https://docs.cilium.io/en/stable/security/policy/
  - "Securing Kubernetes Cluster Networking" (NSA/CISA hardening guide)

## Notes

- 본 ADR 발효 후 신규 ADR 또는 conventions 문서가 필요하면:
  - `docs/conventions/network-policy.md` — 신규 서비스 / 신규 통신 추가 시 NetworkPolicy
    작성 가이드 (Phase 1 동시 작성).
  - 별도 ADR (Service Mesh + mTLS, P3, 미할당) — 본 ADR 의 한계 (트래픽 암호화 부재) 보완.
  - 별도 ADR (Kyverno 도입) — Phase 3 의 enforce 메커니즘.
