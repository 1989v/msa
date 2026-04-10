# Backup Runner (Phase 5)

Wraps the existing `docker/backup/scripts/` shell tree into a Kubernetes
CronJob stack without rewriting any script logic. ADR-0019 Phase 5 calls
for "wrap the current XtraBackup + binlog scripts as a CronJob first,
then migrate to Operator-native BackupSchedule CRs later" — this
directory is step 1.

## Why a Dockerfile lives here

ADR-0019's Jib convention (Phase 2) only covers JVM services. The
backup runner shells out to `xtrabackup`, `mysql`, `pg_dump`, `aws`,
and `gsutil`, which are OS-level dependencies — Jib cannot build that
image. Keeping a dedicated Dockerfile in `k8s/infra/prod/backup/`
makes the exception explicit: it is the one place the migration
intentionally uses Dockerfile + docker build instead of Jib.

## Build the image

```bash
# From repo root so the COPY paths resolve:
docker build -f k8s/infra/prod/backup/Dockerfile \
    -t commerce/backup-runner:latest .
```

For a real registry push:

```bash
docker tag commerce/backup-runner:latest \
    ghcr.io/1989v/backup-runner:$(date +%Y%m%d)
docker push ghcr.io/1989v/backup-runner:$(date +%Y%m%d)
# Then update the image reference in cronjob-*.yaml
```

## Apply

```bash
# One-shot seal the real credentials (do not commit the plaintext).
# See k8s/infra/prod/sealed-secrets/README.md for the workflow.

kubectl apply -k k8s/infra/prod/backup
```

## Verify

```bash
# CronJobs should be listed and Ready
kubectl -n commerce get cronjob

# Trigger the full backup manually for a smoke test
kubectl -n commerce create job backup-full-smoke \
    --from=cronjob/backup-full

kubectl -n commerce logs job/backup-full-smoke -f
```

Expected: `backup-full.sh` runs XtraBackup against every per-service
MySQL alias Service, dumps the PostgreSQL charting database, archives
the configured file directories, uploads to the chosen storage
provider, and then invokes `cleanup.sh` to trim per
`FULL_BACKUP_RETENTION_DAYS` (default 7).

## Migration path after stabilisation

Once the wrapped CronJob runs cleanly against a real Percona
Operator-managed MySQL, replace the `backup-full` CronJob with a
`PerconaServerMySQLBackupSchedule` CR so the backups become
Operator-native. The `backup-binlog` CronJob can stay independent,
or graduate to an SLM policy if your MySQL flavour supports it.

The `docker/backup/scripts/` tree continues to be the source of
truth — modify scripts there, rebuild the image, and push. Phase 6
(the compose teardown) keeps these scripts in the repo because this
image build needs them.
