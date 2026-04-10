# Percona MySQL Operator

Production MySQL managed by Percona Operator for MySQL (ADR-0019
Phase 4). The operator reconciles `PerconaServerMySQL` CRs into
StatefulSets with GroupReplication, XtraBackup-compatible backups,
and a ProxySQL front-end.

## Install

```bash
kubectl create namespace percona-mysql-operator || true
kubectl apply -f \
  https://raw.githubusercontent.com/percona/percona-server-mysql-operator/main/deploy/bundle.yaml \
  -n percona-mysql-operator
```

Or via Helm:

```bash
helm repo add percona https://percona.github.io/percona-helm-charts
helm upgrade --install ps-operator percona/ps-operator \
    --namespace percona-mysql-operator --create-namespace
```

## Cluster scoping decision

ADR-0019 documents two viable strategies:

1. **Per-service clusters** — one `PerconaServerMySQL` CR per service
   (12 services ⇒ 12 clusters, 24 pods including replicas). Best
   isolation, best for fault domains, heavy on node count.
2. **Single shared cluster with per-service schemas** — one
   `PerconaServerMySQL` CR hosting all 12 databases, aliased via
   multiple Services (like Phase 3a's local setup). Lightweight but
   a single blast radius.

The starter CR in `mysql-clusters.yaml` uses **strategy 2** as the
baseline because it matches the existing docker-compose mental model
and the hostnames already baked into `application-kubernetes.yml`.
Split into multiple CRs as you harden production.

## Apply

```bash
kubectl apply -f mysql-clusters.yaml
# Wait for Ready
kubectl -n commerce get perconaservermysql
```

## Database and user initialization

The Percona Operator does not natively create application-level
databases and users. Use a one-shot Job that connects with the root
Secret (issued by the operator) and runs the init SQL mirrored from
`k8s/infra/local/mysql/configmap-init.yaml`. The reference Job is
`init-databases-job.yaml`.

## Backup migration

Once Phase 5's CronJob wrapper for `docker/backup/scripts/` is stable,
migrate to the Operator's native `PerconaServerMySQLBackup` and
`PerconaServerMySQLBackupSchedule` CRs for push-button backup and
PITR. XtraBackup semantics are identical, so the scheduling can flip
without changing the backup target.
