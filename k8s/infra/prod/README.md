# Production Infrastructure — Operator-Based Stack

Operator-managed backing services for the `prod-k8s` overlay
(see `k8s/overlays/prod-k8s/`). Everything here is intentionally
**scaffolding** — the CRs and Helm values are starting points that
must be tuned against real production metrics before you actually run
workloads on them. Each subdirectory has its own README with install
commands and the values you'll typically change.

See [ADR-0019](../../../docs/adr/ADR-0019-k8s-migration.md) for the
high-level rationale and operator selection trade-offs.

## Install order

Operators have dependencies — install CRDs first, then the CRs that
the Operators reconcile. The order below avoids transient "CRD not
found" errors during the initial rollout.

1. **Namespaces + RBAC**
   - `kubectl apply -k k8s/infra/local/namespace.yaml` (reuses the
     `commerce` namespace from the local tree)
2. **Certificate management**
   - `cert-manager/` — cert-manager Operator + Let's Encrypt issuer
3. **Secret management**
   - `sealed-secrets/` — Bitnami Sealed Secrets controller
4. **Monitoring** (install early so everything else registers)
   - `monitoring/` — kube-prometheus-stack + Grafana + ServiceMonitor
     CRDs
5. **Data plane operators**
   - `strimzi/` — Kafka + KafkaTopic CRs
   - `percona-mysql/` — Percona Server for MySQL Operator + clusters
   - `redis/` — Bitnami Redis Cluster Helm chart (6 nodes)
   - `eck/` — Elastic Cloud on Kubernetes + Elasticsearch cluster
   - `opensearch/` — OpenSearch Operator + OpenSearchCluster
   - `clickhouse/` — Altinity ClickHouse Operator + installation CR

Every data plane Operator reconciles its own CR into StatefulSets,
PVCs, and Services that match the DNS names already hardcoded in
`application-kubernetes.yml` (e.g. `mysql-product-master`,
`redis-1..6`, `kafka:29092`, `elasticsearch:9200`, `opensearch:9200`,
`clickhouse:8123`). The app side of the platform needs no further
change once all CRs are Ready.

## Components

| Directory          | Operator / chart               | Purpose                                      |
|--------------------|--------------------------------|----------------------------------------------|
| `cert-manager/`    | cert-manager                   | TLS cert issuance for ingress                |
| `sealed-secrets/`  | Bitnami Sealed Secrets         | Git-safe encrypted Secret storage            |
| `strimzi/`         | Strimzi Kafka Operator         | Kafka cluster + topic declaration            |
| `percona-mysql/`   | Percona Operator for MySQL     | HA MySQL with XtraBackup-compatible backups |
| `redis/`           | Bitnami Redis Cluster (Helm)   | 6-node Redis cluster (replaces local-path redis standalone) |
| `eck/`             | Elastic Cloud on Kubernetes    | Elasticsearch cluster used by search service |
| `opensearch/`      | OpenSearch Operator            | OpenSearch cluster used by code-dictionary   |
| `clickhouse/`      | Altinity ClickHouse Operator   | ClickHouse installation used by analytics    |
| `monitoring/`      | kube-prometheus-stack          | Prometheus + Alertmanager + Grafana          |

## Resource footprint (rough baseline)

With 3-broker Kafka, 1 master + 1 replica MySQL per service,
6-node Redis cluster, 3 master + 2 data Elasticsearch, 1-node OpenSearch
and ClickHouse single-node:

| Component    | Pods | Memory total |
|--------------|-----:|-------------:|
| Kafka        |    3 |          6Gi |
| MySQL        |   24 |         24Gi |
| Redis        |    6 |          6Gi |
| Elasticsearch|    5 |         10Gi |
| OpenSearch   |    1 |          2Gi |
| ClickHouse   |    1 |          2Gi |
| Monitoring   |   ~8 |          4Gi |
| **Total**    |  ~48 |        ~54Gi |

A 3-node managed cluster with 4 CPU / 16 GiB per node is the minimum
to handle this comfortably; 6 nodes is recommended for headroom.

## Status

These manifests are scaffolding as of ADR-0019 Phase 4. Follow-ups
tracked separately:
- Dashboard migration from `docker/monitoring/grafana/` to ConfigMap
  sidecars (Phase 6 — docker-compose teardown).
- Backup CronJob wiring against Percona Operator's BackupSchedule CR
  (Phase 5 first lands the current XtraBackup scripts wrapped as a
  K8s CronJob; BackupSchedule CR migration is a Phase 4 follow-up).
- Secret sealing for every database/service credential. The current
  scaffolding uses placeholder plaintext Secrets.
