# Percona MySQL Operator

Production MySQL managed by Percona Operator for MySQL (ADR-0019
Phase 4). The operator reconciles `PerconaServerMySQL` CRs into
StatefulSets with GroupReplication, XtraBackup-compatible backups,
and a ProxySQL front-end.

## Install

```bash
kubectl create namespace percona-mysql-operator || true
kubectl apply -f \
  https://raw.githubusercontent.com/percona/percona-server-mysql-operator/main/deploy/bundle.yaml \
  -n percona-mysql-operator
```

Or via Helm:

```bash
helm repo add percona https://percona.github.io/percona-helm-charts
helm upgrade --install ps-operator percona/ps-operator \
    --namespace percona-mysql-operator --create-namespace
```

## Cluster scoping decision

ADR-0019 documents two viable strategies:

1. **Per-service clusters** — one `PerconaServerMySQL` CR per service
   (12 services ⇒ 12 clusters, 24 pods including replicas). Best
   isolation, best for fault domains, heavy on node count.
2. **Single shared cluster with per-service schemas** — one
   `PerconaServerMySQL` CR hosting all 12 databases, aliased via
   multiple Services (like Phase 3a's local setup). Lightweight but
   a single blast radius.

The starter CR in `mysql-clusters.yaml` uses **strategy 2** as the
baseline because it matches the existing docker-compose mental model
and the hostnames already baked into `application-kubernetes.yml`.
Split into multiple CRs as you harden production.

## Apply

```bash
kubectl apply -f mysql-clusters.yaml
# Wait for Ready
kubectl -n commerce get perconaservermysql
```

## Database and user initialization

The Percona Operator does not natively create application-level
databases and users. `init-databases-job.yaml` is a one-shot Job that
connects with the root Secret (issued by the operator) and

1. creates the 13 per-service databases (mirrors
   `k8s/infra/local/mysql/configmap-init.yaml`), then
2. creates each application user + grant, taking **passwords from the
   sealed `commerce-app-db-secrets` Secret** — local's plaintext
   defaults never reach production.

사용자명은 각 서비스 `application.yml` 의 기본값(`product_user`,
`code_dictionary_user`, `game_user` …)과 동일하므로, 배포 측(`prod-k8s`
overlay)은 **비밀번호만** `patches/db-password-*.yaml` 로 주입한다.
비밀번호 키가 비어 있으면 Job 은 조용히 넘어가지 않고 실패한다.

Job 은 `CREATE USER IF NOT EXISTS` + `ALTER USER` 조합이라 **재실행이
곧 비밀번호 로테이션**이다 — 재봉인 후 Job 을 다시 apply 하고 파드를
재시작하면 된다.

```bash
kubectl -n commerce delete job mysql-init-databases   # 재실행 시
kubectl apply -k k8s/infra/prod
kubectl -n commerce logs job/mysql-init-databases
```

### 애플리케이션 계정 Secret (apply 전 필수)

```bash
kubectl -n commerce create secret generic commerce-app-db-secrets \
    --from-literal=PRODUCT_PASSWORD='...' \
    --from-literal=ORDER_PASSWORD='...' \
    --from-literal=AUTH_PASSWORD='...' \
    --from-literal=CHATBOT_PASSWORD='...' \
    --from-literal=MEMBER_PASSWORD='...' \
    --from-literal=WISHLIST_PASSWORD='...' \
    --from-literal=GIFTICON_PASSWORD='...' \
    --from-literal=INVENTORY_PASSWORD='...' \
    --from-literal=FULFILLMENT_PASSWORD='...' \
    --from-literal=WAREHOUSE_PASSWORD='...' \
    --from-literal=CODE_DICTIONARY_PASSWORD='...' \
    --from-literal=GAME_PASSWORD='...' \
    --from-literal=EXPERIMENT_PASSWORD='...' \
    --dry-run=client -o yaml \
  | kubeseal --format=yaml \
  > k8s/infra/prod/sealed-secrets/commerce-app-db-secrets-sealed.yaml
```

| 키 | DB | 사용자 | 사용하는 Deployment |
|---|---|---|---|
| `PRODUCT_PASSWORD` | `product_db` | `product_user` | product |
| `INVENTORY_PASSWORD` | `inventory_db` | `inventory_user` | commerce |
| `ORDER_PASSWORD` | `order_db` | `order_user` | commerce |
| `FULFILLMENT_PASSWORD` | `fulfillment_db` | `fulfillment_user` | commerce |
| `WAREHOUSE_PASSWORD` | `warehouse_db` | `warehouse_user` | commerce |
| `MEMBER_PASSWORD` | `member_db` | `member_user` | commerce |
| `WISHLIST_PASSWORD` | `wishlist_db` | `wishlist_user` | commerce |
| `AUTH_PASSWORD` | `auth_db` | `auth_user` | auth |
| `CHATBOT_PASSWORD` | `chatbot_db` | `commerce_user` | chatbot |
| `GIFTICON_PASSWORD` | `gifticon_db` | `gifticon_user` | gifticon |
| `CODE_DICTIONARY_PASSWORD` | `code_dictionary_db` | `code_dictionary_user` | code-dictionary |
| `GAME_PASSWORD` | `game_db` | `game_user` | code-dictionary (ADR-0059 폴드) |
| `EXPERIMENT_PASSWORD` | `experiment_db` | `commerce` | experiment |

새 서비스를 추가할 때는 ① `init.sql` 의 DB ② `users.txt` 의
`db:user:ENV` ③ 이 Secret 키 ④ overlay 의 `db-password-*.yaml` 4곳을
함께 갱신한다.

## Backup migration

Once Phase 5's CronJob wrapper for `docker/backup/scripts/` is stable,
migrate to the Operator's native `PerconaServerMySQLBackup` and
`PerconaServerMySQLBackupSchedule` CRs for push-button backup and
PITR. XtraBackup semantics are identical, so the scheduling can flip
without changing the backup target.

## Secrets (required before apply)

`commerce-mysql-secrets` 는 manifest 에 평문으로 두지 않는다. apply 전에
SealedSecret 으로 생성한다 (`k8s/infra/prod/sealed-secrets/README.md`):

```bash
kubectl -n commerce create secret generic commerce-mysql-secrets \
    --from-literal=root='...' \
    --from-literal=xtrabackup='...' \
    --from-literal=monitor='...' \
    --from-literal=clusteradmin='...' \
    --from-literal=operator='...' \
    --from-literal=orchestrator='...' \
    --from-literal=replication='...' \
    --dry-run=client -o yaml \
  | kubeseal --format=yaml \
  > k8s/infra/prod/sealed-secrets/commerce-mysql-secrets-sealed.yaml
```

Secret 이 없으면 operator 는 secret 대기 상태로 명시적으로 멈춘다 —
약한 placeholder 값으로 조용히 기동되는 것보다 안전하다.
