# k3s-lite Overlay

Single-node k3d / k3s-lite deployment mode. Combines the local minimal
infrastructure (Phase 3a) with the service base manifests (Phase 3b)
and applies trim-downs to fit a laptop-class cluster (~8 GiB RAM).

## What it contains

- **Base layers**
  - `../../infra/local` — MySQL (single pod + 17 aliased Services),
    Redis (standalone + 6 aliased Services), Kafka (KRaft single-node),
    Elasticsearch, OpenSearch, ClickHouse
  - `../../base` — 18 Spring Boot app Deployments + Services + Ingress
- **Overlay patches**
  - `patches/resources-reduce.yaml` — strategic merge applied to every
    Deployment via target selector. Cuts requests to 50m CPU + 256Mi
    memory and limits to 512Mi memory per container.
  - `patches/redis-standalone-*.yaml` — five patches, one per service
    that declares `spring.data.redis.cluster.nodes` in its
    `application-kubernetes.yml`: gateway, product, gifticon,
    analytics, experiment. Each injects a
    `SPRING_APPLICATION_JSON` env var that nulls out the cluster
    node list and points at the standalone `redis` Service from
    Phase 3a. SPRING_APPLICATION_JSON has higher precedence than
    classpath yml files in Spring Boot's property resolution order,
    so the override wins.

## Apply

```bash
# 0. (one time) create the local cluster if you don't have one
k3d cluster create commerce \
    --k3s-arg "--disable=traefik@server:*" \
    -p "80:80@loadbalancer" \
    -p "443:443@loadbalancer"

# 1. (one time) install ingress-nginx
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx --create-namespace \
    --set controller.ingressClassResource.default=true \
    --set controller.admissionWebhooks.enabled=false

# 2. build and import the JVM images produced by Jib (Phase 2)
./gradlew jibBuildTar
scripts/image-import.sh --all

# 3. apply the full overlay
kubectl apply -k k8s/overlays/k3s-lite

# 4. wait for everything to reach Ready
kubectl -n commerce get pods -w
```

## Known limitations

- **Replicas**: every Deployment stays at 1 replica — this overlay is
  for local dev only. See `prod-k8s` for multi-replica sizing.
- **Redis**: the cluster-to-standalone override assumes the Spring
  Data Redis cluster client accepts a null `cluster` property.
  Spring Boot 3.x treats `null` as "unset" in relaxed binding, but
  some versions of Lettuce reject empty cluster config with a
  `NullPointerException`. If you see that, fall back to running a real
  Redis cluster (replace `infra/local/redis` with a 6-node StatefulSet
  or the Bitnami Helm chart) and delete the five `redis-standalone-*`
  patches from this kustomization.
- **No HPA, no PDB**: omitted on purpose. Single-node clusters cannot
  honor disruption budgets and autoscaling would just oscillate.
- **No TLS**: gateway Ingress uses plain HTTP. cert-manager comes in
  Phase 4's prod overlay.
- **Secrets**: passwords are plaintext. Sealed Secrets / External
  Secrets integration is a Phase 4 concern.

## Tear-down

```bash
kubectl delete -k k8s/overlays/k3s-lite
# PVCs survive delete by default — wipe them too for a clean slate:
kubectl -n commerce delete pvc --all
```
