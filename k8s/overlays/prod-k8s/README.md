# prod-k8s Overlay

Production deployment mode targeting managed Kubernetes clusters
(EKS / GKE / AKS). Applies prod-grade sizing, autoscaling, disruption
budgets, and TLS on top of the shared service base.

## What it contains

- **Base layer**
  - `../../base` — 18 Spring Boot app Deployments + Services + Ingress
- **Overlay additions**
  - `hpa.yaml` — HorizontalPodAutoscaler per scaling-friendly service.
    search-batch (scheduled job) and agent-viewer-api (internal dev
    tool) are intentionally excluded.
  - `pdb.yaml` — PodDisruptionBudget `minAvailable: 1` per service.
    Combined with HPA `minReplicas: 2` this gives rolling headroom
    during node drains and cluster upgrades.
- **Overlay patches**
  - `patches/replicas.yaml` — every app Deployment scales to 2
    replicas as the HPA minimum.
  - `patches/resources.yaml` — requests 200m CPU / 1 GiB memory,
    limits 2 CPU / 2 GiB memory per container.
  - `patches/ingress-tls.yaml` — gateway Ingress switches to HTTPS
    with a cert-manager `letsencrypt-prod` ClusterIssuer and
    `api.commerce.example.com` host. Change the host to your real
    domain before applying.

## What it does NOT contain

This overlay intentionally does not pull in any infrastructure from
`k8s/infra/local/`. Production backing services (Kafka, MySQL, Redis,
Elasticsearch, OpenSearch, ClickHouse) come from Operator-managed
stacks under `k8s/infra/prod/`, which is Phase 4 of the migration
(ADR-0019) and arrives in a later commit.

Prerequisites installed separately:
- ingress-nginx controller
- cert-manager + `letsencrypt-prod` ClusterIssuer
- Phase 4 `k8s/infra/prod/` (Strimzi Kafka, Percona MySQL, ECK
  Elasticsearch, ClickHouse Operator, SealedSecrets, kube-prometheus-
  stack)

## Apply

```bash
# Dry run — just render and diff against the cluster.
kubectl kustomize k8s/overlays/prod-k8s | kubectl diff -f -

# Real apply.
kubectl apply -k k8s/overlays/prod-k8s
```

## Customization checklist before real use

- [ ] Edit `patches/ingress-tls.yaml` to replace
      `api.commerce.example.com` with your production hostname.
- [ ] Confirm cert-manager ClusterIssuer name matches
      `letsencrypt-prod` or adjust the annotation.
- [ ] Adjust HPA min/max replicas per service based on expected load.
- [ ] Wire Secrets via SealedSecrets or External Secrets (Phase 4)
      instead of the plaintext defaults in application-kubernetes.yml.
- [ ] Set `jibRegistry` to your push target and build images with
      `./gradlew jib -PjibRegistry=ghcr.io/1989v` (or your registry).
      Update the image pull references if your registry is private.
- [ ] Size CPU/memory limits per real metrics once kube-prometheus-
      stack data is available.

## Tear-down

```bash
kubectl delete -k k8s/overlays/prod-k8s
```

Note: HPAs and PDBs are owned by this overlay, but the Deployments
and Services from base are also deleted. Infrastructure from
`k8s/infra/prod/` must be deleted separately.
