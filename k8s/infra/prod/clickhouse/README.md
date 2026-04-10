# Altinity ClickHouse Operator

Production ClickHouse installation for the `analytics` service
(ADR-0019 Phase 4). Altinity's Operator is the most mature choice
for ClickHouse on Kubernetes and handles sharding, replication, and
schema migrations.

## Install the operator

```bash
kubectl apply -f \
  https://raw.githubusercontent.com/Altinity/clickhouse-operator/master/deploy/operator/clickhouse-operator-install-bundle.yaml
```

## Apply the installation

```bash
kubectl apply -f clickhouse-installation.yaml
```

Wait for Ready:

```bash
kubectl -n commerce get chi commerce-clickhouse
```

## Configuration notes

- **Single-shard, single-replica scaffold**: starts as a single
  instance matching the Phase 3a local stack. Scale by adding shards
  and replicas once analytics volume justifies it — the Operator
  handles the rebalancing.
- **Default database `analytics`** matches the `analytics` service's
  `application-kubernetes.yml` default.
- **User `analytics` with password `analytics`** is a placeholder —
  replace with a SealedSecret and mount as env vars into the
  analytics Deployment.
- **Service alias**: the CR creates a Service named
  `chi-commerce-clickhouse-commerce-0-0` by default. The alias
  `clickhouse` keeps `application-kubernetes.yml` unchanged.
