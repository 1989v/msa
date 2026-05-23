# host-access — Local Infra External Access

로컬 머신의 GUI/CLI 도구(DBeaver, RedisInsight, Kibana, Kafka UI 등)에서 k3d 클러스터 안의 인프라에 직접 붙기 위한 LoadBalancer Services.

> ⚠️ **LOCAL ONLY.** prod-k8s overlay 에는 절대 포함하지 않는다. 이유는 [§ Prod 환경](#prod-환경-에서는) 참조.

## 동작 원리

```
DBeaver  ──>  127.0.0.1:13306
                  │
                  ▼ (k3d --port "13306:13306@loadbalancer")
            k3d server 컨테이너 :13306
                  │
                  ▼ (klipper-lb)
            Service/mysql-host (LoadBalancer, port 13306)
                  │
                  ▼ (kube-proxy)
            Pod/mysql-0 :3306
```

`scripts/k3d-up.sh` 의 `--port "<HOST>:<HOST>@loadbalancer"` 매핑과 이 디렉토리의 LoadBalancer Service 포트가 짝을 이룬다. 둘 중 하나만 수정하면 동작 안 함.

추가로 `network-policy.yaml` 의 `allow-loadbalancer-to-infra` 가 같이 필요하다. 기본 `default-deny-all` + `allow-app-to-{mysql,redis,...}` 가 commerce-platform pod 만 ingress 허용하기 때문에, LoadBalancer external traffic (kube-proxy 가 노드 IP 로 SNAT) 은 별도로 풀어줘야 한다.

## 포트 / 자격증명 일람

| 인프라 | Host endpoint | Credentials | 비고 |
|--------|---------------|-------------|------|
| MySQL | `127.0.0.1:13306` | `root` / `localroot` | per-service 계정도 사용 가능 (예: `product_user` / `product_password`) |
| Postgres (quant) | `127.0.0.1:15432` | `quant` / `quant`, db `quant` | |
| Redis | `127.0.0.1:16379` | (no auth) | standalone, 클러스터 모드 아님 |
| Elasticsearch | `http://127.0.0.1:19200` | (xpack security disabled) | Kibana 로 붙으려면 별도 컨테이너 띄워서 ES_HOSTS 만 지정 |
| ClickHouse (HTTP) | `http://127.0.0.1:18123` | `analytics` / `analytics`, db `analytics` | DBeaver/Tabix |
| ClickHouse (Native) | `127.0.0.1:19000` | `analytics` / `analytics` | `clickhouse-client` |
| Kafka | `127.0.0.1:19092` | (no auth, PLAINTEXT) | EXTERNAL listener, `kcat`/Kafka UI |

> macOS 에서는 `localhost` 가 IPv6 우선이라 종종 매핑이 어긋난다. **`127.0.0.1`** 로 명시 권장.

## 사용 예시

```bash
# MySQL CLI
mysql -h 127.0.0.1 -P 13306 -u root -plocalroot

# Postgres
PGPASSWORD=quant psql -h 127.0.0.1 -p 15432 -U quant -d quant

# Redis
redis-cli -h 127.0.0.1 -p 16379 ping

# Elasticsearch
curl http://127.0.0.1:19200/_cluster/health

# ClickHouse HTTP
curl 'http://analytics:analytics@127.0.0.1:18123/?query=SELECT+version()'

# Kafka 토픽 리스트 (kcat)
kcat -b 127.0.0.1:19092 -L
```

### Kibana 를 띄우고 싶을 때

레포 안에 Kibana 매니페스트는 없다. 로컬 docker 로 가볍게:

```bash
docker run -d --name kibana \
  -e ELASTICSEARCH_HOSTS=http://host.docker.internal:19200 \
  -p 5601:5601 \
  docker.elastic.co/kibana/kibana:8.13.0
# → http://localhost:5601
```

## Prod 환경 에서는

`type: LoadBalancer` 를 managed K8s (EKS/GKE/AKS) 에 그대로 적용하면 **공인 IP 가 부여된다**. 즉:

- MySQL root 패스워드를 인터넷에 노출
- Redis 무인증 인스턴스를 외부에서 접근 가능
- 위치 정보 / 결제 데이터 등 모든 도메인 데이터에 대한 직접 접근

⇒ 사고 직결. 그래서 **prod-k8s overlay 에는 host-access 를 포함하지 않는다.**

### Prod 에서 DB 에 붙어야 할 때 권장 패턴

**1) `kubectl port-forward` (가장 단순, ad-hoc)**

```bash
kubectl -n commerce port-forward svc/mysql-product-master 13306:3306
```

K8s RBAC 인증이 자동으로 적용되므로 가장 안전. 단점: 프로세스가 살아있어야 함, 감사 로그가 K8s API audit 에만 남음.

**2) Bastion host + SSH tunnel**

VPC 내부에 jump-box (EC2/GCE) 하나 두고:

```bash
ssh -L 13306:mysql-product-master.commerce.svc.cluster.local:3306 bastion.internal
```

- 회사 SSO/MFA 와 연동하기 좋음
- 감사 로그가 bastion sshd 에 남음

**3) 클라우드 native IAP (GCP IAP TCP forwarding, AWS Session Manager port forwarding)**

- VPN 없이 IAM 기반 접근 제어
- 추천 (회사 표준이 있다면)

**4) (정 외부 LB 노출이 필요한 경우) `loadBalancerSourceRanges`**

```yaml
spec:
  type: LoadBalancer
  loadBalancerSourceRanges:
    - 203.0.113.0/24    # 회사 사무실 outbound CIDR
    - 198.51.100.5/32   # VPN gateway
```

이 옵션 없이 prod 에 LoadBalancer 띄우는 건 명백한 보안 사고. 그래도 native IAP/bastion 이 우선.

## Overlay 통합 구조

이 디렉토리는 **base/infra 에 포함되지 않는다** (`k8s/infra/local/kustomization.yaml` 에서 의도적으로 제외). 이유는 `oci-arm` overlay 가 `k8s/overlays/k3s-lite` 를 상속받기 때문 — base 에 두면 OCI 인터넷 노출 환경에도 따라가서 보안 사고 직결.

대신:

- **k3d 로컬**: `scripts/k3d-up.sh` 가 마지막 단계에서 별도로 `kubectl apply -k k8s/infra/local/host-access` 실행
- **oci-arm / prod-k8s**: 의도적으로 미적용. 외부 접근이 필요하면 Cloudflare Tunnel / bastion / `kubectl port-forward` 사용

수동으로 비활성화하려면 `kubectl delete -k k8s/infra/local/host-access` 한 줄.

## 정리/삭제

완전 제거 시:

1. `k8s/overlays/k3s-lite/kustomization.yaml` 의 host-access NOTE 블록 삭제
2. `scripts/k3d-up.sh` 의 `kubectl apply -k k8s/infra/local/host-access` + `--port "1XXXX:..."` 라인들 제거
3. 이 디렉토리(`k8s/infra/local/host-access/`) 삭제
4. 클러스터 재생성 (`k3d cluster delete commerce && scripts/k3d-up.sh`)
