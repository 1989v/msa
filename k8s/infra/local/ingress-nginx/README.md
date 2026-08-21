# ingress-nginx — Local Install

Ingress controller for the local k3d / k3s-lite cluster. Installed via Helm
chart rather than pinned manifests so upstream security patches flow in
without repo churn.

## Prerequisites

- `helm` v3.x
- `kubectl` pointing at the target local cluster
- For k3d: start the cluster with Traefik disabled so the two controllers
  don't fight over port 80/443:
  ```bash
  k3d cluster create commerce \
      --k3s-arg "--disable=traefik@server:*" \
      -p "80:80@loadbalancer" \
      -p "443:443@loadbalancer"
  ```
- For k3s (bare-metal): add `--disable traefik` to the server install flags.

## Install

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx --create-namespace \
    --set controller.service.type=LoadBalancer \
    --set controller.ingressClassResource.default=true \
    --set controller.admissionWebhooks.enabled=false
```

The `admissionWebhooks.enabled=false` override is a local-only simplification
— the webhook needs cert-manager to be valid, which we defer to Phase 4
(production infra). For local dev the webhook is not load-bearing.

## Verify

```bash
kubectl -n ingress-nginx get pods
kubectl -n ingress-nginx get svc ingress-nginx-controller
kubectl get ingressclass
```

Expected: one `ingress-nginx-controller` pod Ready, a LoadBalancer Service
with an EXTERNAL-IP (k3d publishes it via the host port mapping), and an
IngressClass named `nginx` marked as `(default)`.

## Uninstall

```bash
helm uninstall ingress-nginx -n ingress-nginx
kubectl delete ns ingress-nginx
```

## oci-arm 운영 보강 (ADR-0075 개정, 2026-08-22)

ingress-nginx 는 이 레포가 아니라 설치 명령으로 배포된다. oci-arm 단일 노드에서
롤아웃 포화 시 컨트롤러가 굶지 않도록 아래를 설치 후 1회 적용한다
(2026-08-22 적용됨 — 재설치 시 반복):

```bash
kubectl -n ingress-nginx patch deploy ingress-nginx-controller --type=json -p '[
  {"op":"replace","path":"/spec/template/spec/containers/0/resources/requests/cpu","value":"300m"},
  {"op":"add","path":"/spec/template/spec/priorityClassName","value":"edge-critical"}]'
```

`edge-critical` PriorityClass 는 `k8s/overlays/oci-arm/edge-priority.yaml` 이 만든다 —
Argo 동기화가 먼저다.
