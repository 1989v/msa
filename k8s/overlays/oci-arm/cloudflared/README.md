# cloudflared — Cloudflare Zero Trust Tunnel

OCI 인스턴스에 inbound 포트를 열지 않고 외부 접근 경로를 만들기 위한 connector. 매니페스트(이 디렉토리)는 connector 만 정의하고, **Public Hostname / TCP route / Access policy 는 Cloudflare dashboard 에서 관리**한다.

## 적용 절차 (최초 1회)

### 1. Tunnel 생성 + 토큰 발급 (Cloudflare dashboard)

1. https://one.dash.cloudflare.com/ → **Networks** → **Tunnels** → **Create a tunnel**
2. Connector type: **Cloudflared**
3. Tunnel name: 예) `msa-oci`
4. 토큰 발급 화면에서 `eyJhIjoi...` 문자열 복사 (한 번만 표시)

### 2. K8s Secret 등록 (OCI 클러스터에)

```bash
kubectl -n commerce create secret generic cloudflared-tunnel-token \
  --from-literal=token='eyJhIjoi...여기에 붙여넣기...'
```

> ⚠️ 토큰은 절대 git 에 넣지 말 것. ArgoCD manifest sync 와 별개로 수동 등록.

### 3. cloudflared 배포

ArgoCD 가 oci-arm overlay sync 시 자동 배포. 수동 적용은:

```bash
kubectl apply -k k8s/overlays/oci-arm/cloudflared
```

connector pod 가 뜨면 Cloudflare dashboard 의 Tunnel 상태가 **HEALTHY** 로 변함 (보통 30초 이내).

### 4. Public Hostnames 매핑 (Cloudflare dashboard)

Tunnel 클릭 → **Public Hostnames** 탭에서 hostname 마다 1개씩 등록.

| Subdomain | Domain | Type | URL (cluster-internal) | 용도 |
|-----------|--------|------|------------------------|------|
| `mysql` | `<DOMAIN>` | TCP | `mysql-product-master.commerce.svc.cluster.local:3306` | DBeaver/DataGrip |
| `postgres` | `<DOMAIN>` | TCP | `quant-postgres.commerce.svc.cluster.local:5432` | Postgres GUI |
| `redis` | `<DOMAIN>` | TCP | `redis.commerce.svc.cluster.local:6379` | RedisInsight |
| `kafka` | `<DOMAIN>` | TCP | `kafka.commerce.svc.cluster.local:19092` | Kafka UI / kcat |
| `ch` | `<DOMAIN>` | HTTP | `http://clickhouse.commerce.svc.cluster.local:8123` | ClickHouse HTTP |
| `ch-tcp` | `<DOMAIN>` | TCP | `clickhouse.commerce.svc.cluster.local:9000` | ClickHouse Native |
| `es` | `<DOMAIN>` | HTTP | `http://elasticsearch.commerce.svc.cluster.local:9200` | Elasticsearch / Kibana |

> **MySQL hostname 주의**: read 만 할 거면 `mysql-product-replica` 등 service 이름으로 분리해서 매핑 가능. 단순화 위해 master 1개만 매핑해도 OK.

### 5. Access policy 작성 (Zero Trust > Access > Applications)

각 hostname 마다 한 application 등록. 핵심 설정:

- **Application type**: Self-hosted
- **Application domain**: 예) `mysql.<DOMAIN>` (4번에서 등록한 hostname)
- **Identity providers**: Google / GitHub / 이메일 OTP 중 택
- **Policies**:
  - Action: Allow
  - Rule: `Emails` = 본인 이메일 1개

7개 hostname 모두 동일 정책이면 **Application Group** 으로 묶어서 한 번에 적용 가능.

### 6. WARP 설치 + Zero Trust 연동 (클라이언트 측)

1. https://1.1.1.1/ 에서 macOS WARP 다운로드
2. 메뉴바 WARP 클릭 → Preferences → Account → **Login with Cloudflare Zero Trust**
3. Team name 입력 (가입 시 정한 값)
4. 브라우저 IdP 인증 → 통과
5. WARP 활성화 (메뉴바 토글 ON)

이제 `mysql.<DOMAIN>:3306` 등에 DBeaver/RedisInsight 등으로 바로 접속 가능. WARP 가 자동으로 Cloudflare 엣지로 라우팅 + Access 인증 세션 사용.

## TCP 인프라 (Kafka) 추가 주의

Kafka 는 클라이언트가 metadata 받은 뒤 advertised listener 로 reconnect 한다. 현재 `KAFKA_CFG_ADVERTISED_LISTENERS` 는 `EXTERNAL://localhost:19092` 로 설정돼 있어서 WARP 라우팅이 `localhost` 로 가버려 실패한다.

OCI 에서 Kafka 외부 접근까지 필요하면 oci-arm overlay 에 patch 추가:

```yaml
- target: { kind: StatefulSet, name: kafka }
  patch: |-
    - op: replace
      path: /spec/template/spec/containers/0/env/<KAFKA_CFG_ADVERTISED_LISTENERS index>/value
      value: "CLIENT://kafka:9092,INTERNAL://kafka:29092,EXTERNAL://kafka.<DOMAIN>:19092"
```

(MySQL/Postgres/Redis/ES/ClickHouse 는 advertised 개념 없음 → patch 불필요.)

## 동작 확인

```bash
# pod 상태
kubectl -n commerce get pods -l app.kubernetes.io/name=cloudflared

# connector 로그 — "Registered tunnel connection" 라인 확인
kubectl -n commerce logs -l app.kubernetes.io/name=cloudflared --tail=20
```

Cloudflare dashboard → Tunnels → 해당 tunnel → **HEALTHY** (Connectors 2개 표시).

## 정리/삭제

```bash
# K8s 측
kubectl -n commerce delete secret cloudflared-tunnel-token
kubectl delete -k k8s/overlays/oci-arm/cloudflared

# Cloudflare 측 (dashboard)
# Tunnels → 해당 tunnel → Delete
# Access > Applications → 7개 application 삭제
```
