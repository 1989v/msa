#!/usr/bin/env bash
# sync-design-system.sh — packages/design-system 빌드 후 3 FE 에 vendored tarball 배포.
#
# Why: Dockerfile context 가 각 FE 디렉토리만 복사하므로 file:../../packages/...
# 형식의 npm dependency 가 컨테이너 빌드 시 해석 실패. tarball 을 각 FE 안에
# vendor/ 디렉토리로 복사해 file:./vendor/<tarball> 의존성으로 사용.
#
# Usage:
#   scripts/sync-design-system.sh
#   (옵션 없음 — 항상 빌드 + pack + 3 FE 동기화)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PKG_DIR="$ROOT/packages/design-system"
PKG_NAME="kgd-design-system"
PKG_VERSION="$(node -p "require('$PKG_DIR/package.json').version")"
TARBALL="${PKG_NAME}-${PKG_VERSION}.tgz"

echo "▶ Building design-system @ $PKG_VERSION"
( cd "$PKG_DIR" && npm run build >/dev/null && npm pack >/dev/null )

for fe in admin/frontend quant/frontend portal-fe; do
  fe_dir="$ROOT/$fe"
  vendor_dir="$fe_dir/vendor"
  mkdir -p "$vendor_dir"
  rm -f "$vendor_dir"/${PKG_NAME}-*.tgz
  cp "$PKG_DIR/$TARBALL" "$vendor_dir/$TARBALL"
  echo "  ✓ $fe → vendor/$TARBALL"

  # package.json 의존성 경로 갱신
  ( cd "$fe_dir" && python3 -c "
import json
with open('package.json') as f: pkg = json.load(f)
pkg.setdefault('dependencies', {})
pkg['dependencies']['@kgd/design-system'] = 'file:./vendor/$TARBALL'
with open('package.json','w') as f: json.dump(pkg, f, indent=2, ensure_ascii=False)
" )

  # npm install (lock 갱신)
  ( cd "$fe_dir" && npm install --silent >/dev/null )
done

# package 디렉토리의 tarball 정리
rm -f "$PKG_DIR/$TARBALL"
echo "▶ Done."
