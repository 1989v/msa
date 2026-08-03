# Sealed Secrets

Git-safe encrypted Secret storage (ADR-0019 Phase 4). Developers seal
plaintext Secret manifests on their laptops against the cluster's
public key; only the in-cluster controller can decrypt them, so the
sealed YAML is safe to commit.

## Install the controller

```bash
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm repo update
helm upgrade --install sealed-secrets sealed-secrets/sealed-secrets \
    --namespace kube-system \
    --set-string fullnameOverride=sealed-secrets-controller
```

## Install the `kubeseal` CLI

```bash
# macOS
brew install kubeseal
# or direct download
curl -L https://github.com/bitnami-labs/sealed-secrets/releases/latest/download/kubeseal-linux-amd64 \
    -o kubeseal && chmod +x kubeseal && sudo mv kubeseal /usr/local/bin/
```

## Seal a Secret

```bash
kubectl -n commerce create secret generic product-db \
    --from-literal=username=product_user \
    --from-literal=password='actual-production-password' \
    --dry-run=client -o yaml \
  | kubeseal --format=yaml \
  > k8s/infra/prod/sealed-secrets/product-db-sealed.yaml

git add k8s/infra/prod/sealed-secrets/product-db-sealed.yaml
git commit -m "chore(secrets): seal product_db credentials"
```

The resulting `SealedSecret` is safe to commit. The in-cluster
controller unseals it into a regular `Secret` that matches the
`metadata.name` field.

## Rotate the cluster key

```bash
kubectl -n kube-system delete secret -l sealedsecrets.bitnami.com/sealed-secrets-key
# the controller regenerates a new key and begins accepting new seals;
# existing sealed secrets remain decryptable for 30 days of overlap.
```

## Required before `kubectl apply -k k8s/infra/prod`

| SealedSecret | 내용 | 없으면 |
|---|---|---|
| `commerce-mysql-secrets` | Percona operator 계정(root/xtrabackup/monitor/…) | operator 가 대기 상태로 정지 |
| `commerce-app-db-secrets` | 서비스별 DB 비밀번호 13종 (`percona-mysql/README.md`) | init Job pod 가 `CreateContainerConfigError` 로 실패 |
| `backup-secret` | 백업 스토리지 자격증명 | 백업 CronJob 이 실패 |

셋 다 평문 placeholder 를 두지 않는다 — 없으면 조용히 약한 값으로 뜨는
대신 **명시적으로 실패**하는 쪽을 택했다.

## Migration note

Every placeholder Secret referenced by Phase 3c's `prod-k8s` overlay
(Redis password, ClickHouse credentials, JWT keys, OAuth client
secrets) must be re-sealed here before running in production. Until
that migration is done, leave the overlay's plaintext defaults in
place. MySQL 자격증명은 위 표대로 이미 Secret 전용으로 전환됐다.
