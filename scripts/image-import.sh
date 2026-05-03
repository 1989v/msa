#!/usr/bin/env bash
# image-import.sh — load container images into a local Kubernetes cluster.
#
# Detects the current kubectl context and dispatches to the matching loader:
#   - k3d-*   → k3d image import <ref> -c <cluster>
#   - kind-*  → kind load image-archive / docker-image <ref> --name <cluster>
#   - other   → prints manual k3s instructions and exits non-zero
#
# Modes:
#   1) Jib-produced JVM image tarballs (default)
#   2) Locally-built Docker images for FE / non-JVM services (--fe, --image, --all-images)
#
# Usage:
#   scripts/image-import.sh <path-to-tar>...
#   scripts/image-import.sh --service product          # auto-locate <service>/app/build/jib-image.tar
#   scripts/image-import.sh --all                      # import every jib-image.tar under build/
#   scripts/image-import.sh --fe                       # docker build + load every FE image
#   scripts/image-import.sh --image commerce/charting:latest
#                                                      # build + load a single named target
#   scripts/image-import.sh --all-images               # jib tars + FE + non-JVM (full platform)
#
# Build a Jib tar first with:
#   ./gradlew :product:app:jibBuildTar
#   ./gradlew jibBuildTar                              # all Spring Boot app modules
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
    sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'
    exit "${1:-0}"
}

# Build targets for FE / non-JVM services.
# Format: <image_ref>|<context_dir relative to repo root>|<dockerfile relative to context>
build_targets() {
    cat <<'TARGETS'
commerce/admin-fe:latest|admin/frontend|Dockerfile
commerce/charting-fe:latest|charting/frontend|Dockerfile
commerce/gifticon-fe:latest|gifticon/frontend|Dockerfile
commerce/agent-viewer-fe:latest|agent-viewer/front|Dockerfile
commerce/code-dictionary-fe:latest|code-dictionary/frontend|Dockerfile
commerce/quant-fe:latest|quant/frontend|Dockerfile
commerce/charting:latest|charting|infra/Dockerfile
commerce/quant-ingest:latest|quant/ingest|Dockerfile
TARGETS
}

fe_targets() {
    build_targets | grep -E '/[a-z0-9-]+-fe:'
}

lookup_target() {
    local name="$1"
    build_targets | awk -F'|' -v n="$name" '$1 == n { print; found=1 } END { exit !found }'
}

detect_loader() {
    local ctx
    ctx=$(kubectl config current-context 2>/dev/null || true)
    if [[ -z "$ctx" ]]; then
        echo "ERROR: no kubectl context is set" >&2
        return 1
    fi
    case "$ctx" in
        k3d-*)
            echo "k3d:${ctx#k3d-}"
            ;;
        kind-*)
            echo "kind:${ctx#kind-}"
            ;;
        *)
            cat >&2 <<EOF
ERROR: unsupported kubectl context '$ctx'.
This script dispatches to k3d or kind. For a plain k3s cluster, copy the
tar into /var/lib/rancher/k3s/agent/images/ on each node — see
https://docs.k3s.io/installation/airgap#manually-deploy-images-method
EOF
            return 1
            ;;
    esac
}

import_one() {
    local tar="$1"
    local loader="$2"
    local kind="${loader%%:*}"
    local cluster="${loader#*:}"
    [[ -f "$tar" ]] || { echo "ERROR: tar not found: $tar" >&2; return 1; }
    case "$kind" in
        k3d)
            echo "→ k3d image import $(basename "$tar") → cluster $cluster"
            k3d image import "$tar" -c "$cluster"
            ;;
        kind)
            echo "→ kind load image-archive $(basename "$tar") → cluster $cluster"
            kind load image-archive "$tar" --name "$cluster"
            ;;
    esac
}

import_image_ref() {
    local ref="$1"
    local loader="$2"
    local kind="${loader%%:*}"
    local cluster="${loader#*:}"
    case "$kind" in
        k3d)
            echo "→ k3d image import $ref → cluster $cluster"
            k3d image import "$ref" -c "$cluster"
            ;;
        kind)
            echo "→ kind load docker-image $ref → cluster $cluster"
            kind load docker-image "$ref" --name "$cluster"
            ;;
    esac
}

build_target_line() {
    local line="$1"
    local ref ctx dockerfile
    IFS='|' read -r ref ctx dockerfile <<<"$line"
    local abs_ctx="$REPO_ROOT/$ctx"
    local abs_dockerfile="$abs_ctx/$dockerfile"
    if [[ ! -f "$abs_dockerfile" ]]; then
        echo "ERROR: Dockerfile not found: $abs_dockerfile" >&2
        return 1
    fi
    echo "→ docker build $ref ← $ctx/$dockerfile"
    docker build -t "$ref" -f "$abs_dockerfile" "$abs_ctx"
}

find_all_tars() {
    find "$REPO_ROOT" -type f -name 'jib-image.tar' -not -path '*/node_modules/*' 2>/dev/null
}

main() {
    [[ $# -eq 0 ]] && usage 1

    # Short-circuit help before requiring a kubectl context.
    for arg in "$@"; do
        case "$arg" in
            -h|--help) usage 0 ;;
        esac
    done

    local loader
    loader=$(detect_loader) || exit 1
    echo "Detected local cluster: $loader"

    local tars=()
    local image_refs=()
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                usage 0
                ;;
            --service)
                shift
                [[ $# -gt 0 ]] || { echo "ERROR: --service requires a name" >&2; exit 1; }
                tars+=("$(resolve_service_tar "$1")")
                shift
                ;;
            --all)
                while IFS= read -r t; do tars+=("$t"); done < <(find_all_tars)
                shift
                ;;
            --fe)
                while IFS= read -r line; do image_refs+=("$line"); done < <(fe_targets)
                shift
                ;;
            --image)
                shift
                [[ $# -gt 0 ]] || { echo "ERROR: --image requires a name" >&2; exit 1; }
                local found
                found=$(lookup_target "$1") || { echo "ERROR: unknown image target '$1'. Known:" >&2; build_targets | cut -d'|' -f1 | sed 's/^/  - /' >&2; exit 1; }
                image_refs+=("$found")
                shift
                ;;
            --all-images)
                while IFS= read -r t; do tars+=("$t"); done < <(find_all_tars)
                while IFS= read -r line; do image_refs+=("$line"); done < <(build_targets)
                shift
                ;;
            *)
                tars+=("$1")
                shift
                ;;
        esac
    done

    if [[ ${#tars[@]} -eq 0 && ${#image_refs[@]} -eq 0 ]]; then
        echo "ERROR: no images to import" >&2
        exit 1
    fi

    local rc=0
    if [[ ${#tars[@]} -gt 0 ]]; then
        for t in "${tars[@]}"; do
            import_one "$t" "$loader" || rc=$?
        done
    fi
    if [[ ${#image_refs[@]} -gt 0 ]]; then
        for line in "${image_refs[@]}"; do
            local ref="${line%%|*}"
            build_target_line "$line" || { rc=$?; continue; }
            import_image_ref "$ref" "$loader" || rc=$?
        done
    fi
    exit $rc
}

resolve_service_tar() {
    local svc="$1"
    # app modules live under <service>/app/build/jib-image.tar
    local candidate="$REPO_ROOT/$svc/app/build/jib-image.tar"
    if [[ -f "$candidate" ]]; then
        echo "$candidate"
        return 0
    fi
    # search:consumer / search:batch / gateway / agent-viewer:api cases
    candidate="$REPO_ROOT/$(echo "$svc" | tr ':' '/')/build/jib-image.tar"
    if [[ -f "$candidate" ]]; then
        echo "$candidate"
        return 0
    fi
    echo "ERROR: no jib-image.tar for service '$svc'. Run ./gradlew :$svc:jibBuildTar first." >&2
    return 1
}

main "$@"
