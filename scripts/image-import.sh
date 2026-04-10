#!/usr/bin/env bash
# image-import.sh — load Jib-produced image tarballs into a local Kubernetes cluster.
#
# Detects the current kubectl context and dispatches to the matching loader:
#   - k3d-*   → k3d image import <tar> -c <cluster>
#   - kind-*  → kind load image-archive <tar> --name <cluster>
#   - other   → prints manual k3s instructions and exits non-zero
#
# Usage:
#   scripts/image-import.sh <path-to-tar>...
#   scripts/image-import.sh --service product          # auto-locate <service>/app/build/jib-image.tar
#   scripts/image-import.sh --all                      # import every jib-image.tar under build/
#
# Build a tar first with:
#   ./gradlew :product:app:jibBuildTar
#   ./gradlew jibBuildTar                              # all Spring Boot app modules
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
    sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
    exit "${1:-0}"
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

find_all_tars() {
    find "$REPO_ROOT" -type f -name 'jib-image.tar' -not -path '*/node_modules/*' 2>/dev/null
}

main() {
    [[ $# -eq 0 ]] && usage 1

    local loader
    loader=$(detect_loader) || exit 1
    echo "Detected local cluster: $loader"

    local tars=()
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
            *)
                tars+=("$1")
                shift
                ;;
        esac
    done

    if [[ ${#tars[@]} -eq 0 ]]; then
        echo "ERROR: no tarballs to import" >&2
        exit 1
    fi

    local rc=0
    for t in "${tars[@]}"; do
        import_one "$t" "$loader" || rc=$?
    done
    exit $rc
}

main "$@"
