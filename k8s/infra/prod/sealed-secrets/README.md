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

## Migration note

Every placeholder Secret referenced by Phase 3c's `prod-k8s` overlay
(MySQL credentials, Redis password, ClickHouse credentials, JWT keys,
OAuth client secrets) must be re-sealed here before running in
production. Until that migration is done, leave the overlay's
plaintext defaults in place.
