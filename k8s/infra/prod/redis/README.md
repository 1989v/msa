# Redis Cluster (Bitnami Helm)

Production Redis cluster (6 nodes: 3 master + 3 replica) via the
Bitnami Helm chart (ADR-0019 Phase 4). Replaces the local tree's
standalone Redis so Spring Data Redis cluster clients work natively
without the `SPRING_APPLICATION_JSON` override used by `k3s-lite`.

The ADR's operator selection note left the door open for KubeBlocks
as an alternative — Bitnami Helm chart is the chosen default for its
stable upgrade story and the widest community coverage. Switch to
KubeBlocks if your org standardises on that operator.

## Install

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm upgrade --install redis bitnami/redis-cluster \
    --namespace commerce \
    --values values.yaml
```

## values.yaml highlights

The chart creates 6 nodes with stable Service names
`redis-cluster-0` ... `redis-cluster-5` by default. We add aliases
via `extraServices` so the `redis-1` .. `redis-6` hostnames baked
into `application-kubernetes.yml` still resolve. If you want to
rename the chart release to `redis` so the primary Service becomes
`redis-headless`, replace `redis` with `--name-template redis` in
the helm install command.

## Verify

```bash
kubectl -n commerce get pods -l app.kubernetes.io/name=redis-cluster
kubectl -n commerce exec -it redis-cluster-0 -- redis-cli cluster info
```

Expected: `cluster_state:ok`, `cluster_slots_assigned:16384`,
`cluster_slots_ok:16384`.

## Password

The chart auto-generates a password and stores it in the `redis`
Secret. Mount it as an env var (`REDIS_PASSWORD`) in every
Deployment that reads Redis, or migrate to a SealedSecret for
deterministic credentials. The placeholder default in
`application-kubernetes.yml` (`${REDIS_PASSWORD:}`) picks up the
env var automatically.
