---
parent: 11-k8s-deep-dive
seq: 15
title: msa 코드베이스 K8s 매니페스트 점검 (Phase 3)
type: deep
created: 2026-05-01
---

# 15. msa 코드베이스 K8s 점검 — 실제 매니페스트 grep

## 1. 디렉토리 구조 (현재 시점)

```
k8s/
├── base/                          # 25개 서비스 base (19개 ServiceAccount)
│   ├── gateway/{deployment,service,ingress,kustomization,serviceaccount}.yaml
│   ├── product/{deployment,service,kustomization,serviceaccount}.yaml
│   ├── order/...
│   ├── search/, search-batch/, search-consumer/
│   ├── auth/, member/, wishlist/, gifticon/
│   ├── inventory/, fulfillment/, warehouse/
│   ├── analytics/, experiment/, chatbot/
│   ├── code-dictionary/, agent-viewer-api/
│   ├── quant/
│   ├── (FE) admin-fe/, charting-fe/, gifticon-fe/, code-dictionary-fe/, agent-viewer-fe/
│   ├── charting/                  # FastAPI (non-JVM)
│   ├── frontend-ingress.yaml
│   └── kustomization.yaml         # 모두 aggregate
│
├── overlays/
│   ├── k3s-lite/
│   │   ├── kustomization.yaml     # ../infra/local + ../base + 11개 patches
│   │   └── patches/
│   │       ├── resources-reduce.yaml          # 일괄 50% 축소
│   │       ├── ddl-auto-update.yaml
│   │       ├── startup-probe.yaml
│   │       ├── redis-standalone-{gateway,product,gifticon,analytics,experiment}.yaml
│   │       ├── charting-probe.yaml
│   │       ├── code-dictionary-resources.yaml
│   │       └── quant-phase2.yaml
│   └── prod-k8s/
│       ├── kustomization.yaml     # ../base + hpa + pdb + 3개 patches
│       ├── hpa.yaml               # 16개 HPA
│       ├── pdb.yaml               # 16개 PDB
│       └── patches/
│           ├── replicas.yaml      # part-of=commerce-platform 일괄 replicas=2
│           ├── resources.yaml     # 일괄 cpu/memory 강화
│           └── ingress-tls.yaml   # gateway TLS
│
└── infra/
    ├── local/                     # plain StatefulSet (k3s-lite 용)
    │   ├── ingress-nginx/         # README 만 (Helm install)
    │   ├── mysql/, redis/, kafka/
    │   ├── elasticsearch/, opensearch/, clickhouse/
    │   ├── namespace.yaml         # commerce
    │   └── kustomization.yaml
    └── prod/                      # Operator 기반 (managed K8s)
        ├── cert-manager/cluster-issuer.yaml         (CRD)
        ├── strimzi/kafka-cluster.yaml               (CRD: Kafka, KafkaNodePool)
        ├── percona-mysql/mysql-clusters.yaml        (CRD: PerconaServerMySQL)
        ├── eck/elasticsearch.yaml                   (CRD: Elasticsearch)
        ├── opensearch/opensearch-cluster.yaml       (CRD: OpenSearchCluster)
        ├── clickhouse/clickhouse-installation.yaml  (CRD: ClickHouseInstallation)
        ├── monitoring/{servicemonitor-apps.yaml, values.yaml, dashboards/}
        ├── sealed-secrets/README.md
        ├── redis/values.yaml
        └── backup/{Dockerfile, cronjob-{full,binlog}.yaml, pvc.yaml, secret.yaml, configmap-env.yaml}
```

## 2. 점검표 (실제 grep 결과 기준)

| 항목 | 적용 여부 | 위치 / 비고 |
|---|---|---|
| Deployment 표준 (probe + lifecycle preStop) | ✓ | `k8s/base/*/deployment.yaml`, gateway 가 표준 |
| ServiceAccount per-service | △ | 19개 (FE 일부 제외) |
| Service ClusterIP | ✓ | 25개 service.yaml |
| Ingress | △ | 2개 (gateway + frontend) |
| ConfigMap | △ | mysql init configmap 만, 앱 ConfigMap 없음 (env 위주) |
| Secret | △ | mysql secret placeholder 만, ESO/Sealed Secrets 미적용 |
| HPA | ✓ (prod-k8s) | 16개. CPU 70%, minReplicas 2, maxReplicas 4-8 |
| PDB | ✓ (prod-k8s) | 16개. minAvailable 1 |
| `replicas: 2` | ✓ (prod-k8s) | patches/replicas.yaml + labelSelector |
| `resources.requests/limits` | ✓ | base 100m/512Mi-1Gi, prod 200m/1Gi-2Gi |
| `strategy: RollingUpdate` | △ | Default 그대로. quant 만 Recreate |
| `maxSurge / maxUnavailable` | X | 명시 없음 (Default 25%/25%) |
| StatefulSet | ✓ (infra/local) | 6개 (mysql/redis/kafka/es/opensearch/clickhouse) |
| Headless Service | ✓ | infra/local 의 모든 인프라 |
| StorageClass 명시 | X | 미명시 (cluster default 의존) |
| Reclaim Policy | X | 미명시 |
| **NetworkPolicy** | **X (0건)** | **즉시 보안 gap** |
| **PSS label** | **X** | namespace 에 enforce label 없음 |
| **SecurityContext (앱)** | △ | base 에 없음. Jib 의 `user=1000:1000` 만 |
| nodeAffinity / topologySpread | X | 미사용. AZ 분산 보장 X |
| Tolerations / Taints | X | 미사용 |
| PriorityClass | X | 미사용 |
| TLS (Ingress) | ✓ (prod-k8s) | cert-manager + Let's Encrypt |
| ServiceMonitor | ✓ | `infra/prod/monitoring/servicemonitor-apps.yaml` 1개로 일괄 scrape |
| HPA Custom Metric | X | CPU 70% 만 |
| Argo CD / Flux | X | 미도입 (kubectl apply -k) |
| Argo Rollouts / Flagger | X | 미도입 |
| Service Mesh | X | 미도입 |
| Operator 사용 | ✓ | cert-manager / strimzi / percona / eck / clickhouse / kube-prometheus-stack / sealed-secrets |
| Self-built Operator | X | 없음 (잠재 후보 [04-crd-operator §11](04-crd-operator.md)) |

## 3. k3s-lite vs prod-k8s overlay 차이

`kustomization.yaml` 기준 직접 비교:

| 항목 | k3s-lite | prod-k8s |
|---|---|---|
| Base | `../../infra/local + ../../base` | `../../base` (infra 는 별도) |
| Replicas | base default (1) | `replicas: 2` |
| Resources | 50% 축소 (`resources-reduce.yaml`) | 강화 (`resources.yaml` cpu 200m/2, mem 1Gi/2Gi) |
| Probe | startup probe 추가 (`startup-probe.yaml`) | base default |
| HPA / PDB | 없음 (Operator 비효율) | 16개씩 |
| Redis | standalone 강제 (5개 patch) | Operator (Cluster) |
| TLS | 없음 | cert-manager + ClusterIssuer |
| quant | Recreate + replicas=1 + KMS local | Recreate + KMS Vault |
| DDL | `ddl-auto: update` (Hibernate 자동) | flyway 가정 |

ADR-0019 §5 의 매트릭스가 이 코드와 정확히 일치.

## 4. 주요 매니페스트 직접 읽기

### 4.1 Deployment 표준 — gateway

```yaml
# k8s/base/gateway/deployment.yaml
spec:
  replicas: 1
  selector: { matchLabels: { app.kubernetes.io/name: gateway } }
  template:
    metadata:
      labels:
        app.kubernetes.io/name: gateway
        app.kubernetes.io/part-of: commerce-platform   # ★ 일괄 selector 의 핵심
    spec:
      serviceAccountName: gateway
      terminationGracePeriodSeconds: 45
      containers:
        - name: app
          image: commerce/gateway:latest
          imagePullPolicy: IfNotPresent
          ports: [{ name: http, containerPort: 8080 }]
          env:
            - { name: SPRING_PROFILES_ACTIVE, value: "kubernetes" }
          readinessProbe:
            httpGet: { path: /actuator/health/readiness, port: http }
            initialDelaySeconds: 15
            periodSeconds: 5
            failureThreshold: 3
          livenessProbe:
            httpGet: { path: /actuator/health/liveness, port: http }
            initialDelaySeconds: 30
            periodSeconds: 10
            failureThreshold: 3
          lifecycle:
            preStop:
              exec: { command: ["sh", "-c", "sleep 5"] }
          resources:
            requests: { cpu: 100m, memory: 512Mi }
            limits: { memory: 1Gi }
```

평가:
- (+) liveness/readiness 분리 endpoint
- (+) preStop sleep 5s — Service 갱신 propagation 시간 확보
- (+) terminationGracePeriodSeconds 45 — preStop + Spring shutdown 까지 충분
- (-) `imagePullPolicy: IfNotPresent` 는 `:latest` tag 와 결합 시 새 이미지 안 가져올 위험. CI 가 SHA tag 사용 시 OK.
- (-) `securityContext` 명시 없음. PSS restricted 만족 안 함.

### 4.2 Service — 단순

```yaml
spec:
  selector: { app.kubernetes.io/name: gateway }
  ports: [{ name: http, port: 8080, targetPort: http }]
```

문제 없음. ClusterIP 기본 + named port 패턴.

### 4.3 prod-k8s HPA — gateway

```yaml
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: gateway }
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }
```

평가:
- (+) 모든 user-facing 서비스 minReplicas=2 → rolling update 가용성
- (+) maxReplicas 4-8 합리적 범위
- (-) CPU 70% 단일 → 트래픽 패턴 반영 부족
- (-) `behavior` 미명시 → flapping 가능

개선: gateway 는 RPS 기반 custom metric (Prometheus Adapter), search-consumer 는 Kafka lag (KEDA) 가 진짜 시그널.

### 4.4 PDB — 모두 minAvailable: 1

```yaml
spec:
  minAvailable: 1
  selector: { matchLabels: { app.kubernetes.io/name: gateway } }
```

평가:
- (+) drain / 노드 업그레이드 시 최소 1 Pod 보장
- (+) HPA min=2 와 결합 → 1 disruption 흡수
- 큰 문제 없음

### 4.5 Strimzi Kafka — Operator CR

```yaml
# k8s/infra/prod/strimzi/kafka-cluster.yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata: { name: commerce, namespace: commerce }
spec:
  kafka:
    version: 3.8.0
    listeners: [{ name: internal, port: 29092, type: internal, tls: false }]
    config:
      default.replication.factor: 3
      min.insync.replicas: 2
      offsets.topic.replication.factor: 3
      transaction.state.log.replication.factor: 3
      transaction.state.log.min.isr: 2
    authorization: { type: simple }
  entityOperator:
    topicOperator: {}
    userOperator: {}
```

`Kafka` + `KafkaNodePool` (3 controller + 3 broker) + Service alias `kafka` 의 3-tier. 평가:
- (+) replication.factor=3, min.isr=2 (P / 2 acceptable failures)
- (+) entityOperator 로 KafkaTopic / KafkaUser CRD 사용 가능
- (-) 내부 listener `tls: false` — namespace NetworkPolicy + mTLS 없으면 평문. 가치 매기기.

### 4.6 ServiceMonitor — 일괄 scrape

```yaml
# k8s/infra/prod/monitoring/servicemonitor-apps.yaml
spec:
  namespaceSelector: { matchNames: [commerce] }
  selector:
    matchLabels: { app.kubernetes.io/part-of: commerce-platform }
  endpoints:
    - port: http
      path: /actuator/prometheus
      interval: 30s
      scrapeTimeout: 10s
```

이 한 개로 모든 commerce-platform 라벨 서비스 scrape. 깔끔.

### 4.7 cert-manager ClusterIssuer

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata: { name: letsencrypt-prod }
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: platform@example.com           # CHANGE BEFORE PROD
    privateKeySecretRef: { name: letsencrypt-prod-account-key }
    solvers:
      - http01: { ingress: { ingressClassName: nginx } }
```

평가:
- (+) HTTP-01 challenge → ingress-nginx 와 자연 통합
- (-) email placeholder — 실제 운영 전 교체 필요
- (-) DNS-01 미설정 — wildcard cert 필요 시 추가 필요 (Route53 / Cloud DNS 통합)

### 4.8 backup CronJob 패턴

```yaml
# k8s/infra/prod/backup/cronjob-full.yaml (요약)
apiVersion: batch/v1
kind: CronJob
spec:
  schedule: "0 3 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: commerce/mysql-backup:latest
              envFrom: [{ configMapRef: { name: backup-env } }, { secretRef: { name: backup-secret } }]
              volumeMounts: [{ name: backup, mountPath: /backup }]
          volumes: [{ name: backup, persistentVolumeClaim: { claimName: backup-pvc } }]
```

평가:
- (+) Dockerfile 로 기존 셸 자산 (XtraBackup + binlog) 패키징, ADR-0019 §7 충실
- (+) ConfigMap + Secret 분리
- (-) `schedule: "0 3 * * *"` 같은 스케줄이 timezone 없으면 UTC. 한국 시간 기준이면 `CRON_TZ=Asia/Seoul` prefix 또는 spec.timeZone 사용 권장 (1.27+)

## 5. Pod 1개당 자원 매트릭스 (prod-k8s 적용 후)

| 항목 | base | + resources patch | HPA min×2 | total |
|---|---|---|---|---|
| CPU request | 100m | 200m (×2) | × 2 replicas | **400m / service** |
| Memory request | 512Mi | 1Gi (×2) | × 2 | **2Gi / service** |
| CPU limit | (없음) | 2 | n/a | n/a |
| Memory limit | 1Gi | 2Gi | n/a | 2Gi/Pod |

서비스 17개 + replicas 2 → 최소 노드 자원: **6.8 vCPU + 34Gi memory** (앱만). 실 운영은 m5.xlarge × 3 노드 정도로 시작.

## 6. 보안 / 운영 gap 식별

다음 항목이 [16-improvements.md](16-improvements.md) 의 ADR 후보:

### 즉시 (low effort, high value)
1. **NetworkPolicy deny-default + allowlist** — 0건이라 가장 큰 보안 gap
2. **`imagePullPolicy: Always`** + SHA tag — 또는 latest 태그 폐기
3. **CronJob.spec.timeZone** — 명시
4. **`ClusterIssuer.email`** — placeholder 교체

### 단기 (medium effort)
5. **HPA Custom Metric** — gateway RPS, search-consumer Kafka lag (Prometheus Adapter 또는 KEDA)
6. **topologySpreadConstraints** — AZ 분산 보장
7. **PSS warn → audit → enforce 단계적 도입**
8. **Argo CD 도입** — `kubectl apply -k` → GitOps
9. **strategy.maxSurge/maxUnavailable 명시** — Tier 1 서비스는 maxSurge=1, maxUnavailable=0 권장

### 중기
10. **Argo Rollouts (Canary) — gateway / order**
11. **trivy in CI** — 이미지 CVE 스캔
12. **External Secrets Operator** — Sealed Secrets placeholder → 진짜 secret
13. **Kyverno admission policies** — resources/PDB/HPA 강제
14. **분산 추적 (OpenTelemetry)**

### 장기
15. **자체 도메인 Operator** (BackupPolicy / KekRotation 등)
16. **Service Mesh (Linkerd)** — mTLS + observability

## 7. base manifest 의 잘 된 점 정리

ADR-0019 충실 + Clean K8s 관점에서 잘 된 부분:

- **`app.kubernetes.io/{name,part-of}` 라벨 일관성** — patches, ServiceMonitor, PDB 가 모두 한 selector 로 lookup 가능
- **분리된 readiness / liveness endpoint** — `/actuator/health/{readiness,liveness}` 정확한 사용
- **preStop sleep 5s + grace 45s** — Service propagation + Spring shutdown 흡수
- **base 와 overlay 의 명확한 분리** — Kustomize 의 강점 충분 활용
- **Operator 기반 prod 인프라** — 자체 운영 부담 최소화 (Strimzi/Percona/ECK/cert-manager)
- **Headless Service 로 StatefulSet 노출** — 표준 패턴
- **JVM Jib 의 `user=1000:1000` + `MaxRAMPercentage=75`** — runAsNonRoot 일부 만족 + 컨테이너 메모리 회계

## 8. 차이가 의외로 큰 부분 — k3s-lite 의 Redis cluster→standalone

`patches/redis-standalone-*.yaml` 5개:
- gateway / product / gifticon / analytics / experiment

이유: prod 의 Redis 는 cluster 모드 (3 master + 3 replica) 가정 → Lettuce 가 `cluster.nodes` 로 토폴로지 디스커버리. k3s-lite 의 단일 Redis Pod 은 cluster 모드 비활성 → Lettuce 가 `CLUSTER NODES` 호출 시 에러.

해결: `SPRING_APPLICATION_JSON` env 가 yml 보다 precedence 가 높은 점을 활용해서 `cluster: null, host: redis, port: 6379` 강제. `#16 Async Lettuce 학습` 의 client-side topology 동작과 직결되는 치명적 차이를 깔끔히 패치한 좋은 예.

## 9. quant 의 Recreate 전략

`patches/quant-phase2.yaml`:
```yaml
spec:
  strategy: { type: Recreate }
```

이유 (주석에 명시):
> "replicas=1 가정 보호 (rolling update 시 일시적 replicas=2 차단)"

배경: quant 은 KEK 기반 암호화 + outbox 의 idempotent relay. replicas=2 가 동시 동작하면 (a) outbox relay 의 중복 발행 (b) 포지션 동시 진입 가능성. ADR-0024 / ADR-0027 의 전제와 일치. **단일 인스턴스 강제** 가 도메인 요구.

이 패턴이 가치 큰 이유: K8s 의 모든 동작이 "분산/고가용" 가정 → 도메인이 "단일 인스턴스" 를 요구할 때 명시적으로 Recreate + replicas=1 로 표현해야 안전.

## 10. 결론 — 학습 → 개선 매트릭스

| 본 학습의 주제 | msa 적용 가치 | 우선순위 |
|---|---|---|
| Control Plane / etcd | EKS 의존 (자동) | n/a |
| RBAC | 점검 필요 | 단기 |
| Operator 패턴 (사용) | ✓ 다수 사용 중 | n/a |
| **Operator 자체 작성** | △ PoC 가치 | 장기 |
| **NetworkPolicy** | **즉시 적용 필요** | **즉시** |
| Headless / EndpointSlice | 이미 적절 사용 | n/a |
| Ingress / Gateway API | Ingress 충분, Gateway API 후속 | 중기 |
| StatefulSet / PVC | 적절 사용 | n/a |
| Affinity / Topology Spread | **AZ 분산 도입 권장** | 단기 |
| HPA Custom Metric | **가치 큼** | 단기 |
| KEDA (Kafka lag) | **search-consumer / analytics** | 단기 |
| 배포 전략 (Canary) | gateway / order | 중기 |
| Helm vs Kustomize | 이미 결정 (Kustomize) | n/a |
| **Argo CD** | **단기 도입 권장** | 단기 |
| External Secrets | 중기 도입 권장 | 중기 |
| Service Mesh | 현시점 비용>이득 | 장기 |
| PSS / Kyverno | 단계적 enforce | 단기-중기 |
| etcd 암호화 | EKS 자동 / 명시 가치 | 중기 |

다음: [16-improvements.md](16-improvements.md) — 위 식별 항목을 ADR 후보로 정리.
