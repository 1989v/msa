# GitHub Actions Workflows

CI/CD pipelines for the K8s migration delivered in ADR-0019 Phase 7.
Two workflows, deliberately scoped tight: build/test/verify on every PR
and main push, image publish on main push and version tags.

## ci.yml — pull request and main push

Runs on every PR targeting `main` and on every push to `main`. Three
parallel jobs:

| Job | Purpose |
|-----|---------|
| `build` | `./gradlew build` — compiles all 19 JVM modules and runs the test suite. Uploads test reports as an artifact on failure. |
| `jib-build` | `./gradlew jibBuildTar` — runs the Phase 2 Jib convention against every Spring Boot app module to confirm images can still be produced. Verifies that exactly 18 jib-image.tar files land in the workspace. Does NOT push. |
| `kustomize-validate` | Renders every kustomization under `k8s/base`, `k8s/infra/local/*`, `k8s/infra/prod/backup`, `k8s/infra/prod/monitoring/dashboards`, `k8s/overlays/k3s-lite`, `k8s/overlays/prod-k8s`. Fails if any of them error out — catches drift before merge. |

## images.yml — main push and version tags

Runs on push to `main` and on `v*` tags. Builds 28 images (20 JVM via
Jib + 8 Docker via buildx) for **linux/arm64** only and pushes them to
**Oracle Container Registry (OCIR)** in the `<region>.ocir.io/<namespace>`
registry. After push, updates `k8s/overlays/oci-arm/kustomization.yaml`
with the new image tags and commits-back to main (Argo CD picks it up).

Tag strategy:
- `latest` — always.
- Short commit SHA (`${GITHUB_SHA:0:7}`) for `main` pushes.
- Tag name (e.g. `v1.2.3`) for `refs/tags/v*` pushes.

Required repository secrets:

| Secret | Example | Purpose |
|---|---|---|
| `APP_ID` | `123456` | GitHub App ID (commit-back + submodule fetch) |
| `APP_PRIVATE_KEY` | (.pem 내용) | GitHub App private key |
| `OCIR_REGION` | `ap-seoul-1` | OCI region key |
| `OCIR_NAMESPACE` | `kgdcommerce` | Tenancy Object Storage namespace |
| `OCIR_USERNAME` | `kgdcommerce/me@ex.com` | `<namespace>/<oci-username>` |
| `OCIR_TOKEN` | (auth token) | OCI User Settings → Auth Tokens |

Multi-arch (amd64+arm64) 가 필요하면 buildSrc 의 jib-convention 기본값
또는 workflow_dispatch 의 `-PjibPlatforms` 인자로 override.

## Jib local reproducibility

Both workflows ultimately call the same Gradle commands you would run on
a developer laptop:

```bash
./gradlew jibBuildTar                                  # produce tarballs (arm64)
./gradlew jib -PjibRegistry=ap-seoul-1.ocir.io/kgdcommerce   # build + push to OCIR
./gradlew jib -PjibRegistry=... -PjibTag=abc1234       # custom tag
./gradlew jib -PjibPlatforms="linux/amd64,linux/arm64" # multi-arch
```

The `-PjibTag` property was added to the convention plugin in this
phase so CI can stamp the commit SHA without touching the project
version.

## Submodules

Both workflows check out submodules with `submodules: recursive`. The
auth, gifticon, charting, ai, ideabank, and private submodules each have
their own remote, and the build needs them present to compile.

## Not in scope (deliberately deferred)

- Container vulnerability scanning (Trivy, Snyk) — would slow down PR
  cycle, add later when ready.
- E2E smoke against an ephemeral k3d cluster — possible via
  `helm/kind-action` and `nolar/setup-k3d-k3s`, but the smoke test from
  the migration session showed it consumes >8 GiB and runs for several
  minutes. Add when there is a budget for it.
- Frontend (`code-dictionary/frontend`, `gifticon/frontend`,
  `agent-viewer/front`) and Python (`charting`) build/push — outside
  the JVM Jib pipeline, requires per-app workflows that the migration
  scope intentionally left out.
- Helm chart packaging for the prod-k8s overlay — Kustomize is the
  current default per ADR-0019.
