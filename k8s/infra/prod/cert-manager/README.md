# cert-manager

Issues TLS certificates for the gateway Ingress (ADR-0019 Phase 4).
The `prod-k8s` overlay's gateway Ingress patch references a
`ClusterIssuer` named `letsencrypt-prod`, which this directory
provisions.

## Install

```bash
kubectl apply -f \
  https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
```

Or via Helm for easier upgrades:

```bash
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm upgrade --install cert-manager jetstack/cert-manager \
    --namespace cert-manager --create-namespace \
    --set crds.enabled=true
```

## Apply ClusterIssuer

```bash
kubectl apply -f cluster-issuer.yaml
```

Edit `cluster-issuer.yaml` first to set the email address — Let's
Encrypt uses it for expiry notifications.

## Verify

```bash
kubectl get clusterissuer letsencrypt-prod
kubectl -n commerce describe ingress gateway
```

Wait for the gateway Ingress to show a `Certificate` event. The
Certificate resource lands in the same namespace as the Ingress
(`commerce`) and reconciles a Secret named `gateway-tls`.
