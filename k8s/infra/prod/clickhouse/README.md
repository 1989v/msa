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
- **User `analytics` password** 는 CHI 의 `k8s_secret_password` 로
  `commerce/commerce-clickhouse-secrets/analytics-password` 를 참조한다.
  apply 전에 SealedSecret 으로 생성:

  ```bash
  kubectl -n commerce create secret generic commerce-clickhouse-secrets \
      --from-literal=analytics-password='...' \
      --dry-run=client -o yaml \
    | kubeseal --format=yaml \
    > k8s/infra/prod/sealed-secrets/commerce-clickhouse-secrets-sealed.yaml
  ```

  analytics Deployment 쪽도 같은 Secret 을 env 로 mount 한다.
- **Service alias**: the CR creates a Service named
  `chi-commerce-clickhouse-commerce-0-0` by default. The alias
  `clickhouse` keeps `application-kubernetes.yml` unchanged.
