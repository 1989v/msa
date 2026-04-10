# Strimzi Kafka

Kafka broker cluster + KafkaTopic declarations for the production
overlay (ADR-0019 Phase 4). Strimzi reconciles the CRs below into
StatefulSets, Services, and listeners that match the `kafka:29092`
hostname used by every `application-kubernetes.yml`.

## Install the operator

```bash
kubectl create namespace kafka || true
kubectl create -f \
  'https://strimzi.io/install/latest?namespace=kafka' -n kafka
```

Or via Helm:

```bash
helm repo add strimzi https://strimzi.io/charts
helm upgrade --install strimzi strimzi/strimzi-kafka-operator \
    --namespace kafka --create-namespace \
    --set watchAnyNamespace=true
```

## Apply the cluster + topics

```bash
kubectl apply -f kafka-cluster.yaml
kubectl apply -f kafka-topics.yaml
```

Wait for the cluster to reach `Ready`:

```bash
kubectl -n commerce get kafka commerce -o jsonpath='{.status.conditions}'
```

Strimzi exposes the broker as a Service called `commerce-kafka-bootstrap`
by default. We rename it to `kafka` via the CR's `listeners[].name`
and a manual headless alias so existing app config resolves
`kafka:29092` without changes.

## Configuration highlights

- **KRaft mode**: 3 controller+broker nodes, no ZooKeeper.
- **Replication factor 3** for partitions, `min.insync.replicas=2`.
- **Internal listener on 29092** (plaintext) — matches the port in
  `application-kubernetes.yml` and docker-compose history.
- **External listener** commented out — add if you need clients
  outside the cluster.
- **PVCs**: 20 GiB per broker, uses the cluster default StorageClass.
  Override via `storageClassName` for gp3/pd-ssd.

## Topics

`kafka-topics.yaml` declares every topic the platform publishes or
consumes (see `docs/architecture/kafka-convention.md`). Strimzi keeps
them in sync — manual `kafka-topics.sh --create` is not needed.
