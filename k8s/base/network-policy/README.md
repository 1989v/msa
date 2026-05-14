# NetworkPolicy (ADR-0031) — Phase 0 검토용

## 현재 상태 (Phase 0)

본 디렉토리의 NetworkPolicy 매니페스트는 **검토 단계**이며 어떤 overlay 에도
포함되어 있지 않다. 즉 클러스터에 적용되지 않은 상태이다.

```bash
# 확인: 어떤 overlay 도 이 디렉토리를 resources 로 포함하지 않음
grep -rn "network-policy" /Users/gideok-kwon/IdeaProjects/msa/k8s/overlays/
# (0 matches)
```

Phase 0 의 목적:
1. ADR-0031 §Decision 의 12개 정책을 실 manifest 로 분리
2. selector 가 실 deployment 라벨과 일치하는지 검증
3. 팀 리뷰 (PR 리뷰어가 정책 사각지대 / 과허용 검토)
4. Cilium Hubble 또는 동등한 관측 도구로 6시간 트래픽 캡처 후 매트릭스 작성
   (`study/docs/11-k8s-deep-dive/network-flow-baseline.md`)

## 디렉토리 구조

| 파일 | 역할 |
|---|---|
## OQ-015 (Phase 3 Gateway 우회 차단) closure 매핑

ADR-0037 OQ-015 default 결정 (J1, 2026-05-05) 의 "NetworkPolicy 로 quant Pod ingress 를
gateway namespace 만 허용 / 외부 LB 직접 노출 절대 불가" 는 본 디렉토리의 다음 정책들로
이미 충족된다:

- `03-allow-gateway-to-backends.yaml` — quant Pod 의 ingress 는 gateway 만 (직접 cross-pod 호출 차단)
- `02-allow-ingress-to-gateway.yaml` — 외부 (ingress-nginx) → gateway 만 가능 (LB → quant 직접 차단)
- `11-allow-egress-https-public.yaml` — quant 의 외부 :443 화이트리스트 (auth/quant/gifticon)

mTLS 강제는 ADR-0037 OQ-015 default 에서 Phase 4 로 결정 (Phase 3 GA 까지는 NetworkPolicy 만으로 충분).

| 파일 | 역할 |
|---|---|
| `00-default-deny.yaml` | commerce ns 전체 ingress + egress 기본 차단 |
| `01-allow-dns-egress.yaml` | kube-system kube-dns:53 허용 (필수) |
| `02-allow-ingress-to-gateway.yaml` | ingress-nginx ns → gateway:8080 |
| `03-allow-gateway-to-backends.yaml` | gateway → 모든 backend named port http |
| `04-allow-backend-to-backend.yaml` | order → product (유일한 직접 호출 페어) |
| `05-allow-app-to-mysql.yaml` | 백엔드 → mysql:3306 |
| `06-allow-app-to-redis.yaml` | 백엔드 → redis:6379 |
| `07-allow-app-to-kafka.yaml` | 백엔드 → kafka:9092 (CLIENT) |
| `08-allow-app-to-search.yaml` | 백엔드 → elasticsearch :9200 |
| `09-allow-app-to-clickhouse.yaml` | analytics → clickhouse:8123 |
| `10-allow-monitoring-scrape.yaml` | monitoring ns Prometheus → 백엔드 named port http |
| `11-allow-egress-https-public.yaml` | auth/quant/gifticon → 외부 :443 |
| `kustomization.yaml` | 위 12개 묶음 |

## Selector 매칭 검증 결과

### 백엔드 서비스 (16개 + FE)

`k8s/base/{service}/deployment.yaml` 의 metadata.labels 점검 결과 모두 동일 패턴:

```yaml
labels:
  app.kubernetes.io/name: <service-name>
  app.kubernetes.io/part-of: commerce-platform
```

검증한 deployment (sample):
- `gateway` (8080), `product` (8081), `order` (8082), `search` (8083)
- `auth` (8087), `gifticon` (8086), `quant` (8094)
- `analytics` (8090) — ClickHouse 호출자

→ §03 (gateway-to-backends), §10 (monitoring-scrape) 의 part-of 라벨 selector 와
일치. §11 (external-https-egress) 의 In list 도 실제 deployment name 과 일치.
(charting 은 ADR-0036 P2-T20 에서 Hard remove 완료, 2026-05-02.)

### 인프라 (k3s-lite local)

| 정책 | selector | 실제 라벨 (검증) |
|---|---|---|
| §05 mysql | `app.kubernetes.io/name=mysql` | `k8s/infra/local/mysql/statefulset.yaml:7` |
| §06 redis | `app.kubernetes.io/name=redis` | `k8s/infra/local/redis/statefulset.yaml:7` |
| §07 kafka | `app.kubernetes.io/name=kafka` | `k8s/infra/local/kafka/statefulset.yaml:7` |
| §08 search | `app.kubernetes.io/name=elasticsearch` | `k8s/infra/local/elasticsearch/service.yaml:8` |
| §09 clickhouse | `app.kubernetes.io/name=clickhouse` | `k8s/infra/local/clickhouse/service.yaml:8` |

### Namespace 라벨

K8s 1.22+ 부터 모든 namespace 에 `kubernetes.io/metadata.name=<ns-name>` 라벨이
자동 부여된다. `k8s/infra/local/namespace.yaml` 의 `commerce` ns 도 자동 부여.

cross-ns selector 가 의존하는 ns:
- `kube-system` (DNS) — K8s 기본, 자동 라벨
- `ingress-nginx` (gateway 진입점) — chart 기본 ns 명, 자동 라벨
- `monitoring` (prometheus scrape) — Phase 2 prod 배포 시 ns 명 합의 필요

### 알려진 prod 차이 (Phase 2 보강 필요)

| 항목 | 로컬 | prod-k8s |
|---|---|---|
| MySQL | plain StatefulSet (`name=mysql`) | Percona Operator (`app.kubernetes.io/instance=...` 등 추가) |
| Redis | plain StatefulSet (`name=redis`) | Bitnami chart (호환 OK) |
| Kafka | plain StatefulSet (`name=kafka`) | Strimzi (`strimzi.io/cluster=commerce` 라벨) |

→ Phase 2 에서 prod overlay 에 selector 보강 patch 추가 (ADR-0031 §Consequences).

## Phase 1 활성화 절차

1. **CNI 확인** — k3d 클러스터가 NetworkPolicy 지원 CNI 인지 확인.
   Flannel-only 면 `--k3s-arg "--flannel-backend=none"` 으로 재생성 후 Calico/Cilium 설치.
   ```bash
   kubectl get pods -n kube-system | grep -E "calico|cilium"
   ```
2. **Smoke test (정책 적용 전)** — 현재 트래픽이 정상인지 baseline 확보.
   ```bash
   kubectl exec -n commerce deploy/gateway -- curl -sf http://product:8081/actuator/health
   ```
3. **k3s-lite overlay 에 추가**:
   ```yaml
   # k8s/overlays/k3s-lite/kustomization.yaml
   resources:
     - ../../infra/local
     - ../../base
     - ../../base/network-policy        # ← 추가
   ```
4. **적용 + 검증**:
   ```bash
   kubectl apply -k k8s/overlays/k3s-lite
   kubectl get networkpolicy -n commerce       # 12개 노출 확인
   ```
5. **Smoke test (정책 적용 후)** — ADR-0031 §7 스크립트:
   - gateway → product /actuator/health → **200 (allowed)**
   - 임시 dbg pod (`kubectl run --rm dbg ...`) → product → **timeout (denied)**
   - product → mysql:3306 → **connected (allowed)**
   - product → google.com:443 → **timeout (denied)**
   - auth → google.com:443 → **connected (allowed)**

6. **롤백** (drop 발생 시):
   ```bash
   kubectl delete -k k8s/base/network-policy
   ```

## Phase 2 활성화 절차 (prod-k8s)

1. Hubble 배포 + 6시간 dry-run 캡처
2. prod overlay 에 보강 patch 작성:
   - Strimzi Kafka selector 추가 (`strimzi.io/cluster=commerce`)
   - Bitnami Redis chart 의 자체 NetworkPolicy 와 일원화 결정
3. quant namespace 부분 적용 → 매트릭스 dry-run → commerce 전체 적용
4. Hubble drop count 0 + Sentry/Slack alert 0 확인 후 종료

## Open Questions / Blockers

ADR-0031 §Blockers 의 6개 항목 참조. 본 디렉토리만으로는 해결되지 않으며,
Phase 1 진입 전 별도 의사결정 필요.

## 관련 문서

- ADR-0031: `docs/adr/ADR-0031-network-policy.md`
- ADR-0019: `docs/adr/ADR-0019-k8s-migration.md` (라벨 표준 / 배포 모드)
- ADR-0004: 인증/인가 (gateway 헤더 신뢰 모델 보강)
- ADR-0027: KMS / OCI Vault (외부 egress 입력)
- 학습 노트:
  - `study/docs/11-k8s-deep-dive/06-ingress-gateway-api.md` §4
  - `study/docs/11-k8s-deep-dive/14-k8s-security.md` §8
  - `study/docs/11-k8s-deep-dive/15-msa-k8s-grep.md` §2
