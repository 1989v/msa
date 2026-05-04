---
parent: 11-k8s-deep-dive
seq: 02
title: 핵심 리소스 + kubectl 흐름 + kubeconfig
type: deep
created: 2026-05-01
---

# 02. 핵심 리소스 + kubectl 흐름 + kubeconfig

## 1. 리소스 분류 한 장 정리

| Kind | 그룹/버전 | 한 줄 정의 | msa 사용처 |
|---|---|---|---|
| **Pod** | core/v1 | 1개 이상의 컨테이너 + 공유 network/IPC 네임스페이스 | 직접 생성 X (Deployment 가 만듦) |
| **ReplicaSet** | apps/v1 | Pod N개 보장 | 직접 생성 X (Deployment 가 만듦) |
| **Deployment** | apps/v1 | ReplicaSet 의 롤링/롤백 매니저 | 모든 stateless 서비스 (gateway/product/order/...) |
| **StatefulSet** | apps/v1 | 정렬된 ID + 고유 PVC + Headless Service | `infra/local/{mysql,redis,kafka,es,opensearch,clickhouse}` |
| **DaemonSet** | apps/v1 | 모든 노드(또는 selector) 에 1개씩 | log shipper, CNI, kube-proxy 가 보통 사용 |
| **Job / CronJob** | batch/v1 | 1회/스케줄 배치 | `k8s/infra/prod/backup/` (XtraBackup CronJob) |
| **Service** | core/v1 | 가상 IP + DNS + LB | 모든 서비스 |
| **Ingress** | networking.k8s.io/v1 | L7 라우팅 | gateway / frontend-ingress |
| **ConfigMap / Secret** | core/v1 | KV 설정 / 비밀 | per-service 설정 + DB 인증정보 |
| **PV / PVC** | core/v1 | 영속 볼륨 + 청구 | StatefulSet 뒷단 |
| **Namespace** | core/v1 | 네임스페이스 격리 | `commerce`, `monitoring`, `ingress-nginx` |
| **HPA / PDB** | autoscaling/v2, policy/v1 | 수평 오토스케일 / 디스럽션 예산 | `prod-k8s` overlay 에만 |
| **NetworkPolicy** | networking.k8s.io/v1 | L3/L4 방화벽 | **현재 0건 (gap)** |
| **CRD** | apiextensions.k8s.io/v1 | 사용자 정의 리소스 정의 | Strimzi `Kafka`, Percona `PerconaServerMySQL`, Prometheus `ServiceMonitor` |

## 2. Pod — 가장 작은 배포 단위

### 핵심 속성

```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: app
      image: commerce/gateway:latest
      ports: [{ name: http, containerPort: 8080 }]
      resources:
        requests: { cpu: 100m, memory: 512Mi }
        limits: { memory: 1Gi }
      readinessProbe: { httpGet: { path: /actuator/health/readiness, port: http } }
      livenessProbe:  { httpGet: { path: /actuator/health/liveness,  port: http } }
      lifecycle:
        preStop: { exec: { command: ["sh", "-c", "sleep 5"] } }
  terminationGracePeriodSeconds: 45
```

### Probe 3종 차이

| Probe | 실패 시 동작 | 시점 |
|---|---|---|
| `startupProbe` | 다른 probe 비활성, 기다림 | 시작 직후 |
| `readinessProbe` | Endpoints 에서 Pod IP 제거 (트래픽 차단) | 평시 |
| `livenessProbe` | Pod kill → 재기동 | 평시 |

함정: **readiness 가 실패하면 Service 에서 빠질 뿐 Pod 는 살아있다.** liveness 와 readiness 를 같은 endpoint 로 두면 부팅 중 OOM (Out Of Memory, 메모리 부족)-killed 루프에 빠지기 쉽다. msa 는 Spring Boot Actuator 의 `/actuator/health/{liveness,readiness}` 분리 endpoint 를 사용한다 (`k8s/base/gateway/deployment.yaml:32-44`).

### QoS 클래스 (resource 설정에 따른 자동 분류)

| 조건 | QoS | OOM 우선순위 |
|---|---|---|
| 모든 컨테이너에 requests==limits 명시 | `Guaranteed` | 가장 늦게 죽음 |
| requests<limits 또는 일부만 | `Burstable` | 중간 |
| 둘 다 없음 | `BestEffort` | 가장 먼저 죽음 |

msa 베이스는 `requests:{cpu:100m,memory:512Mi}, limits:{memory:1Gi}` → **Burstable**. CPU limit 을 의도적으로 안 둠 (CPU throttling 회피). prod overlay 의 `patches/resources.yaml` 은 `limits: { cpu: "2", memory: 2Gi }` 로 강화.

## 3. Deployment — Rolling Update 핵심

```yaml
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%        # 기존 + 새로 추가 허용 %
      maxUnavailable: 25%  # 기존 중 사라져도 되는 %
  template: ...
```

### Rolling Update 가 만드는 ReplicaSet 체인

```
초기:  RS(rev=1, replicas=2) ✓✓
배포:  RS(rev=2) 1개 추가 → ✓✓ + ✓
       RS(rev=1) 1개 종료 → ✓ + ✓
       RS(rev=2) 1개 추가 → ✓ + ✓✓
       RS(rev=1) 0개      → ✓✓ (rev=2 only)
```

`kubectl rollout undo deploy/gateway` → RS rev=1 의 replicas 를 다시 2로, rev=2 를 0 으로. 이전 RS 가 남아있어 **롤백이 빠르다**.

`spec.revisionHistoryLimit` (기본 10) — 보존할 ReplicaSet 수.

### 함정

- **template 변경 == 새 ReplicaSet 생성**. ConfigMap 만 바꾸면 새 RS 가 안 생기고 Pod 도 재시작 안 된다 (envFrom 의 경우). 해법: ConfigMap 의 hash 를 annotation 으로 박는 패턴 (Kustomize `configMapGenerator` 가 자동으로 해줌).

## 4. StatefulSet — 무엇이 다른가

| 항목 | Deployment | StatefulSet |
|---|---|---|
| Pod 이름 | random hash | `<sts>-0`, `<sts>-1` 순차 |
| 시작 순서 | 동시 | 순차 (0 → 1 → 2) |
| 종료 순서 | 동시 | 역순 (N → ... → 0) |
| PVC | 공유 X (있으면 RWO 충돌) | `volumeClaimTemplates` 로 Pod 별 PVC 자동 생성 |
| Network ID | random | 안정 DNS: `<sts>-0.<headless>.<ns>.svc` |
| Service 종류 | ClusterIP/LB OK | Headless 권장 (clusterIP: None) |

msa 사용처: `k8s/infra/local/{mysql,redis,kafka,elasticsearch,opensearch,clickhouse}/statefulset.yaml`. 모두 `serviceName: <x>-headless`.

### Headless Service 의 의미

```yaml
apiVersion: v1
kind: Service
metadata: { name: redis-headless }
spec:
  clusterIP: None
  selector: { app.kubernetes.io/name: redis }
```

DNS 조회:
- 일반 ClusterIP Service: A 레코드 1개 (= ClusterIP)
- Headless: A 레코드 N개 (= 모든 Pod IP) → **클라이언트가 직접 LB 결정**

이 차이가 [#18 gRPC 학습](../18-grpc/) 에서 보았던 "gRPC 가 ClusterIP Service 뒤에 있으면 한 Pod 으로만 트래픽이 몰린다" 문제의 해결책이다 — Headless 로 두면 gRPC client (또는 Lettuce) 가 모든 Pod IP 를 보고 자체 LB.

## 5. Service — ClusterIP / NodePort / LoadBalancer / ExternalName

| 타입 | 외부 노출 | 용도 |
|---|---|---|
| `ClusterIP` (기본) | X | 내부 호출 |
| `NodePort` | 노드 IP:30000-32767 | 데모/CI |
| `LoadBalancer` | 클라우드 LB | 외부 진입 (보통 ingress-nginx 만 LB, 앱은 ClusterIP) |
| `ExternalName` | DNS CNAME | 외부 RDS 등 별칭 |

msa 패턴: 앱은 모두 `ClusterIP`, 진입은 `ingress-nginx` Service (LoadBalancer 또는 NodePort) 단 하나. Gateway → 내부 서비스는 `http://product:8081` 같은 ClusterIP DNS.

### Endpoints / EndpointSlice

Service 는 selector 로 Pod 을 고르지만, 실제 매핑은 별도 객체:
- `Endpoints` (legacy) — 1개 객체에 모든 IP
- `EndpointSlice` (1.21+ 기본) — 100개 단위로 분할 → 대규모 클러스터에서 watch 비용 ↓

자세한 동작은 [05-networking-deep.md](05-networking-deep.md).

## 6. Ingress — L7 진입점

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gateway
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
    - hosts: [api.commerce.example.com]
      secretName: gateway-tls
  rules:
    - host: api.commerce.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service: { name: gateway, port: { name: http } }
```

`ingressClassName: nginx` 가 ingress-nginx controller 와 매칭. controller 는 ingress 규칙을 watch 해서 **자기 nginx config 를 동적으로 갱신**한다.

Ingress 한계 (그래서 Gateway API 가 나옴):
- TCP/UDP 미지원 (HTTP/HTTPS 만)
- 표준 spec 이 좁아 controller 별 annotation 으로 보강 (이식성 ↓)
- 멀티 팀 협업 모델 약함 (route + listener + 정책 분리 안 됨)

## 7. ConfigMap / Secret

```yaml
apiVersion: v1
kind: ConfigMap
metadata: { name: gateway-config }
data:
  application-prod.yml: |
    server.port: 8080
    spring.redis.host: redis
---
apiVersion: v1
kind: Secret
metadata: { name: gateway-secret }
type: Opaque
data:
  jwt-key: <base64>
```

### 컨테이너에 주입 방법 3가지

```yaml
spec:
  containers:
    - env:
        - name: JWT_KEY
          valueFrom: { secretKeyRef: { name: gateway-secret, key: jwt-key } }
      envFrom:
        - configMapRef: { name: gateway-config }     # 모든 키 → env
      volumeMounts:
        - name: cfg
          mountPath: /etc/config                      # 파일로 마운트
  volumes:
    - name: cfg
      configMap: { name: gateway-config }
```

### 주의

- **Secret 은 base64 인코딩일 뿐 암호화 아님** — etcd 에 그대로 저장. EncryptionConfiguration 또는 KMS 연동 필요 ([01-control-plane.md §3](01-control-plane.md)).
- volume mount 는 **자동 갱신** — ConfigMap 변경 시 파일이 갱신됨 (지연 ~1분). env 는 갱신 안 됨, Pod 재시작 필요.
- `immutable: true` 로 두면 변경 불가 + watch 부하 ↓.

## 8. Namespace + Label/Selector

- `commerce` — 앱 전체
- `monitoring` — kube-prometheus-stack
- `ingress-nginx` — ingress controller
- `kube-system` — K8s 자체

label 컨벤션 (msa 가 따르는 권장):
```yaml
labels:
  app.kubernetes.io/name: gateway
  app.kubernetes.io/part-of: commerce-platform
```

`part-of` 라벨로 ServiceMonitor 가 모든 앱을 한 번에 잡는다 (`k8s/infra/prod/monitoring/servicemonitor-apps.yaml:14-17`).

## 9. kubectl apply — 3-way merge 의 진실

```
실제 원본:  서버에 저장된 manifest (server-side)
새 원본:   당신이 apply 하는 manifest (local)
last-applied: annotation `kubectl.kubernetes.io/last-applied-configuration`
```

3-way merge 알고리즘:
1. **추가** — local 에는 있고 last-applied 에 없으면 → 추가
2. **수정** — local 과 last-applied 둘 다에 있으면 → local 값 사용
3. **삭제** — last-applied 에는 있는데 local 에서 사라졌으면 → 삭제 (강력!)
4. **무시** — 서버에만 있는 필드 (e.g. controller 가 채운 status) → 그대로

함정: `kubectl edit` 으로 직접 바꾼 필드는 last-applied 에 없으니 다음 apply 에서 덮어쓰임 또는 보존됨 (필드 종류 따라). **Server-Side Apply (SSA)** 가 도입된 이유 — fieldManager 단위로 owner 추적.

## 10. kubeconfig 구조

```yaml
apiVersion: v1
kind: Config
clusters:
  - name: prod
    cluster:
      server: https://k8s.prod.example.com:6443
      certificate-authority-data: <base64>
users:
  - name: alice
    user:
      exec:
        command: aws
        args: [eks, get-token, --cluster-name, prod]
contexts:
  - name: prod-alice
    context: { cluster: prod, user: alice, namespace: commerce }
current-context: prod-alice
```

3요소: **cluster (서버 + CA) + user (인증) + context (둘의 조합 + 기본 ns)**.

`kubectl config use-context` / `kubens`(별도 도구) / `kubectx` 로 빠르게 전환.

### 인증 방식

- **client cert** — kubeadm 기본 (admin.conf)
- **bearer token** — ServiceAccount 토큰
- **OIDC** — Dex/Keycloak 연동
- **exec plugin** — `aws eks get-token`, `gcloud container clusters get-credentials` 가 동적으로 토큰 생성

## 11. 면접 빈출 5

1. **"Deployment 와 StatefulSet 차이?"** — 위 §4 표.
2. **"ConfigMap 변경했는데 Pod 가 새 값을 못 받아요"** — env 는 재시작 필요. volume mount 는 자동 갱신 (지연 있음). 또는 Kustomize `configMapGenerator` 로 hash suffix → Deployment template 변경 → 새 RS.
3. **"Service 의 selector 와 label 이 매칭 안 되면?"** — Endpoints 가 비어 503. `kubectl get endpoints <svc>` 로 확인.
4. **"kubectl apply 와 kubectl create 차이?"** — apply 는 멱등 + 3-way merge. create 는 이미 있으면 에러.
5. **"Pod 가 Pending 인데 왜?"** — `kubectl describe` 의 Events 봐라. 보통 (a) 스케줄 실패 (resource/affinity), (b) PVC bind 대기, (c) image pull 대기.

## 12. msa 매핑

- `k8s/base/gateway/deployment.yaml` 의 probe + lifecycle preStop 패턴이 모든 서비스의 표준
- `k8s/overlays/k3s-lite/patches/redis-standalone-gateway.yaml` 은 **SPRING_APPLICATION_JSON env 가 yml 보다 우선** 인 점을 활용해서 cluster 모드를 standalone 으로 강제 — Kustomize patch 의 좋은 예
- `k8s/overlays/prod-k8s/patches/replicas.yaml` 은 `replicas: 2` 만 있는 **partial Deployment** — `labelSelector: "app.kubernetes.io/part-of=commerce-platform"` 로 모든 앱에 일괄 적용

다음: [03-controller-pattern.md](03-controller-pattern.md) — 컨트롤러는 어떻게 만들어지나, Reconciliation Loop 의 진짜 코드 구조.
