# Elastic Cloud on Kubernetes (ECK)

Production Elasticsearch cluster via Elastic's official Kubernetes
operator (ADR-0019 Phase 4). Used by the `search` service.

## Install the operator

```bash
kubectl create -f \
  https://download.elastic.co/downloads/eck/2.15.0/crds.yaml
kubectl apply -f \
  https://download.elastic.co/downloads/eck/2.15.0/operator.yaml
```

Or via Helm:

```bash
helm repo add elastic https://helm.elastic.co
helm upgrade --install elastic-operator elastic/eck-operator \
    --namespace elastic-system --create-namespace
```

## Apply the cluster

```bash
kubectl apply -f elasticsearch.yaml
```

Wait for Ready:

```bash
kubectl -n commerce get elasticsearch commerce-es
```

## Configuration notes

- **3 master + 2 data node layout**: masters are dedicated, data
  nodes handle indexing and search. Scale data nodes horizontally
  for search throughput.
- **xpack.security.enabled is true** by default in ECK — the
  `search` service needs to know the `elastic` user password.
  Operator creates `commerce-es-es-elastic-user` Secret; mount it
  as env vars or migrate to SealedSecret.
- **Service alias**: ECK creates `commerce-es-es-http` Service. The
  CR manifest includes an alias Service named `elasticsearch` so
  `application-kubernetes.yml`'s `http://elasticsearch:9200`
  resolves unchanged.
- **Snapshot lifecycle**: configure after initial rollout via an
  `SLMPolicy` resource — tracked as a post-Phase-4 follow-up.
