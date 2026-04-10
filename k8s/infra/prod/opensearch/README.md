# OpenSearch Operator

Production OpenSearch cluster for the `code-dictionary` service
(ADR-0019 Phase 4). Code-dictionary uses the ApacheHttpClient5
transport from `opensearch-java` 2.19, which is incompatible with
Elastic's proprietary clients — hence the separate Operator.

## Install the operator

```bash
helm repo add opensearch-operator https://opensearch-project.github.io/opensearch-k8s-operator/
helm upgrade --install opensearch-operator \
    opensearch-operator/opensearch-operator \
    --namespace opensearch-operator-system --create-namespace
```

## Apply the cluster

```bash
kubectl apply -f opensearch-cluster.yaml
```

## Configuration notes

- **Single-node scaffold**: the starter CR runs a single node for
  parity with the Phase 3a local stack. Scale to a 3-node cluster
  (1 master + 2 data) once the code-dictionary index volume justifies
  it.
- **Security plugin off**: matches Phase 3a for simpler local/dev
  mirroring. Flip it on for prod and wire cert-manager certificates
  into the transport and HTTP layers.
- **Service alias**: the CR manifest adds an `opensearch` Service so
  `application-kubernetes.yml`'s `opensearch:9200` resolves.
