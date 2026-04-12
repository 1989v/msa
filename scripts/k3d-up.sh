#!/usr/bin/env bash
# k3d-up.sh — Commerce Platform 로컬 클러스터를 한 줄로 기동
#
# Usage:
#   scripts/k3d-up.sh                # 전체 (인프라 + 18 API + 5 FE/Python)
#   scripts/k3d-up.sh --core         # 핵심만 (인프라 + gateway/product/order/auth/search)
#   scripts/k3d-up.sh --infra-only   # 인프라만 (MySQL/Redis/Kafka/ES... + ingress)
#   scripts/k3d-up.sh --rebuild      # 이미지 강제 재빌드 포함
#
# Prerequisites: docker, k3d, helm, kubectl, java 25 (gradle toolchain)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

CLUSTER_NAME="commerce"
MODE="full"       # full | core | infra-only
REBUILD=false

for arg in "$@"; do
    case "$arg" in
        --core)       MODE="core" ;;
        --infra-only) MODE="infra-only" ;;
        --rebuild)    REBUILD=true ;;
        -h|--help)
            sed -n '2,9p' "$0" | sed 's/^# //'
            exit 0
            ;;
    esac
done

log() { echo "▸ $*"; }

# ─── 1. Cluster ───────────────────────────────────────────
if k3d cluster list 2>/dev/null | grep -q "^${CLUSTER_NAME}"; then
    log "Cluster '$CLUSTER_NAME' already exists — reusing."
else
    log "Creating k3d cluster '$CLUSTER_NAME'..."
    k3d cluster create "$CLUSTER_NAME" \
        --k3s-arg "--disable=traefik@server:*" \
        --port "80:80@loadbalancer" \
        --port "443:443@loadbalancer" \
        --agents 0 \
        --wait
fi

# ─── 2. ingress-nginx ────────────────────────────────────
if kubectl get ns ingress-nginx &>/dev/null; then
    log "ingress-nginx namespace exists — skipping install."
else
    log "Installing ingress-nginx..."
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx 2>/dev/null || true
    helm repo update >/dev/null 2>&1
    helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
        --namespace ingress-nginx --create-namespace \
        --set controller.ingressClassResource.default=true \
        --set controller.admissionWebhooks.enabled=false \
        --wait --timeout 3m
fi

if [[ "$MODE" == "infra-only" ]]; then
    log "Applying infra only..."
    kubectl apply -k k8s/infra/local
    log "Waiting for MySQL pod..."
    kubectl -n commerce wait --for=condition=Ready pod/mysql-0 --timeout=120s 2>&1 | tail -1 || true
    BACKUP_LATEST="${REPO_ROOT}/private/backups/mysql/latest"
    if [[ -d "$BACKUP_LATEST" ]]; then
        log "Restoring MySQL data from local backup..."
        "$SCRIPT_DIR/k3d-mysql-restore.sh" || log "  (restore had errors)"
    fi
    log "Done. Infra pods:"
    kubectl -n commerce get pods
    exit 0
fi

# ─── 3. JVM images (Jib) ─────────────────────────────────
if [[ "$REBUILD" == true ]] || ! find . -name jib-image.tar -not -path '*/node_modules/*' | grep -q .; then
    log "Building JVM images (./gradlew jibBuildTar)..."
    ./gradlew jibBuildTar --quiet
else
    log "JVM image tars exist — skipping build. Use --rebuild to force."
fi

log "Importing JVM images into k3d..."
"$SCRIPT_DIR/image-import.sh" --all 2>&1 | tail -1

# ─── 4. Frontend + charting images (Docker) ──────────────
build_fe() {
    local name="$1" dockerfile="$2" context="$3"
    if [[ "$REBUILD" == true ]] || ! docker image inspect "commerce/${name}:latest" &>/dev/null; then
        log "Building $name..."
        docker build --quiet -t "commerce/${name}:latest" -f "$dockerfile" "$context"
    fi
    k3d image import "commerce/${name}:latest" -c "$CLUSTER_NAME" 2>&1 | grep -q "Successfully" && \
        log "  → $name imported" || log "  → $name import (may already exist)"
}

build_fe code-dictionary-fe code-dictionary/frontend/Dockerfile code-dictionary/frontend/
build_fe gifticon-fe        gifticon/frontend/Dockerfile        gifticon/frontend/
build_fe agent-viewer-fe    agent-viewer/front/Dockerfile       agent-viewer/front/
build_fe charting-fe        charting/frontend/Dockerfile        charting/frontend/
build_fe charting           charting/infra/Dockerfile           charting/

# ─── 5. Apply overlay ────────────────────────────────────
log "Applying k3s-lite overlay..."
kubectl apply -k k8s/overlays/k3s-lite 2>&1 | grep -c "created\|configured"

# ─── 5.5. Restore MySQL data from last snapshot ─────────
# Wait for MySQL to be ready first
log "Waiting for MySQL pod..."
kubectl -n commerce wait --for=condition=Ready pod/mysql-0 --timeout=120s 2>&1 | tail -1 || true

# Give Flyway a chance to run first (app pods create schema on startup).
# Then restore data from the latest local backup if it exists.
BACKUP_LATEST="${REPO_ROOT}/private/backups/mysql/latest"
if [[ -d "$BACKUP_LATEST" ]]; then
    log "Restoring MySQL data from local backup..."
    "$SCRIPT_DIR/k3d-mysql-restore.sh" || log "  (restore had errors — some DBs may be empty)"
else
    log "No local MySQL backup found — starting with Flyway seed data only."
    log "  (Tip: run scripts/k3d-mysql-dump.sh to create a snapshot anytime)"
fi

# ─── 6. Core-only scale-down ─────────────────────────────
if [[ "$MODE" == "core" ]]; then
    log "Scaling down non-core services..."
    for svc in chatbot analytics experiment code-dictionary \
               search-batch search-consumer agent-viewer-api \
               inventory fulfillment warehouse member wishlist gifticon \
               code-dictionary-fe gifticon-fe agent-viewer-fe charting charting-fe; do
        kubectl -n commerce scale deploy/$svc --replicas=0 2>/dev/null || true
    done
fi

# ─── 7. Wait ─────────────────────────────────────────────
log "Waiting for pods to reach Ready (timeout 10m)..."
kubectl -n commerce wait --for=condition=Ready pods \
    -l app.kubernetes.io/part-of=commerce-platform \
    --timeout=600s 2>&1 | tail -3 || true

# ─── 8. Summary ──────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo " Commerce Platform — k3d '$CLUSTER_NAME'"
echo "═══════════════════════════════════════════"
echo ""
ready=$(kubectl -n commerce get pods --no-headers 2>&1 | awk '{split($2,a,"/"); if(a[1]==a[2]) r++} END{print r+0}')
total=$(kubectl -n commerce get pods --no-headers 2>&1 | wc -l | tr -d ' ')
echo " Pods:  ${ready}/${total} Ready"
echo ""
echo " Endpoints:"
echo "   Gateway (API)    http://localhost/"
echo "   Code Dictionary  http://localhost/code-dictionary/"
echo "   Gifticon         http://localhost/gifticon/"
echo "   Agent Viewer     http://localhost/agent-viewer/"
echo "   Charting         http://localhost/charting/"
echo "   Charting API     http://localhost/charting-api/docs"
echo ""
echo " 정리:  k3d cluster delete $CLUSTER_NAME"
echo " 도움:  scripts/k3d-up.sh --help"
echo "═══════════════════════════════════════════"
