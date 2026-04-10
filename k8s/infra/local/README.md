# Local Infra — Minimal Stack for k3d / k3s-lite

This tree provisions the **minimal** set of backing services needed to run
the commerce-platform apps on a local single-node Kubernetes cluster (k3d
or k3s-lite). It intentionally trades redundancy and operator tooling for
simplicity and startup speed. Production-grade infrastructure lives under
`k8s/infra/prod/` and comes online in Phase 4.

See [ADR-0019](../../../docs/adr/ADR-0019-k8s-migration.md) for the
rationale behind splitting local and prod infra.

## Contents

| Directory        | Purpose                                                                 |
|------------------|-------------------------------------------------------------------------|
| `namespace.yaml` | `commerce` namespace (all infra + app workloads land here)              |
| `mysql/`         | Single MySQL 8.0 pod hosting every service's database. Aliased Services (`mysql-product-master`, `mysql-order-replica`, ...) point to the same backing pod so `application-kubernetes.yml` needs no changes. |
| `redis/`         | Standalone Redis 7 with `redis`, `redis-1..6` Services (see caveat)     |
| `kafka/`         | Kafka 3.8 KRaft single-node (no ZooKeeper). Exposes `kafka:29092`       |
| `elasticsearch/` | Elasticsearch 8.15 single-node (search service)                         |
| `opensearch/`    | OpenSearch 2.19 single-node (code-dictionary service)                   |
| `clickhouse/`    | ClickHouse 24.8 single-node (analytics service)                         |
| `ingress-nginx/` | README with Helm install instructions                                   |

## Prerequisites

1. A running local Kubernetes cluster. Tested on k3d 5.x and k3s 1.30+.
2. `kubectl` and `kustomize` (built into `kubectl` since 1.14).
3. `helm` 3.x (only for ingress-nginx).
4. About 4 GiB of free RAM for the full stack.

## Install

Apply in three steps so ingress-nginx can come up independently:

```bash
# 1. Namespace and data plane
kubectl apply -k k8s/infra/local/

# 2. Ingress controller (follow ingress-nginx/README.md)
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx --create-namespace \
    --set controller.ingressClassResource.default=true \
    --set controller.admissionWebhooks.enabled=false

# 3. Watch the stack come up
kubectl -n commerce get pods -w
```

First start typically takes 60–90 seconds while MySQL runs the init SQL
and Kafka formats its KRaft metadata.

## Verify

```bash
# All pods should be Running + Ready
kubectl -n commerce get pods

# MySQL — confirm every schema was created
kubectl -n commerce exec -it mysql-0 -- \
    mysql -u root -plocalroot -e "SHOW DATABASES;"

# Kafka — produce / consume a throwaway topic
kubectl -n commerce exec -it kafka-0 -- \
    kafka-topics.sh --bootstrap-server kafka:29092 --list

# Elasticsearch / OpenSearch / ClickHouse
kubectl -n commerce exec -it elasticsearch-0 -- \
    curl -s http://localhost:9200/_cluster/health
kubectl -n commerce exec -it opensearch-0 -- \
    curl -s http://localhost:9200/_cluster/health
kubectl -n commerce exec -it clickhouse-0 -- \
    clickhouse-client --query "SELECT 1"
```

## Known caveats

### Redis cluster mode vs standalone

Most services (`gateway`, `product`, `gifticon`, `analytics`, `experiment`)
have `application-kubernetes.yml` configured for Redis **cluster mode** with
`spring.data.redis.cluster.nodes: redis-1:6379,...redis-6:6384`. The local
Redis pod runs in **standalone mode**, so CLUSTER commands will fail with
`CLUSTERDOWN Hash slot not served`.

Two ways to cope on k3s-lite:

1. **Preferred (Phase 3c)**: the `overlays/k3s-lite` overlay patches each
   affected service's Deployment to inject
   `SPRING_DATA_REDIS_HOST=redis` and null out `SPRING_DATA_REDIS_CLUSTER_NODES`.
   Applications fall back to standalone mode.
2. **Workaround**: replace `redis/` in this directory with a real 6-node
   cluster (Bitnami Helm chart works). This doubles local RAM usage.

The `redis-1..6` Services defined in `redis/services.yaml` exist so DNS
still resolves for any connection code that skips the Spring Data Redis
cluster client.

### MySQL single instance

Every `mysql-*-master` and `mysql-*-replica` Service in this tree points
at the **same pod**. Replication cannot be exercised locally. Use
`k8s/infra/prod/` (Phase 4, Percona Operator) for realistic master/replica
topology.

### Resource footprint

| Component     | Memory request | Memory limit |
|---------------|----------------|--------------|
| MySQL         | 512 Mi         | 1 Gi         |
| Redis         | 128 Mi         | 256 Mi       |
| Kafka         | 768 Mi         | 1.5 Gi       |
| Elasticsearch | 1 Gi           | 1.5 Gi       |
| OpenSearch    | 1 Gi           | 1.5 Gi       |
| ClickHouse    | 512 Mi         | 1 Gi         |
| **Total**     | **~4 Gi**      | **~6.75 Gi** |

If your local cluster has less than 6 GiB free, skip `opensearch/` or
`clickhouse/` from `kustomization.yaml` and disable the corresponding
services in the app overlay.

### Storage

All StatefulSets use `PersistentVolumeClaim` with the default StorageClass.
On k3d this is `local-path` (Rancher) which is single-node only — fine for
this stack. On multi-node k3s clusters install Longhorn or NFS first and
override `storageClassName` via the `k3s-lite` overlay.

## Uninstall

```bash
kubectl delete -k k8s/infra/local/
# PVCs are not removed by default — clean data too:
kubectl -n commerce delete pvc --all
```
