# GitHub Actions Workflows

OCI Ampere A1 (arm64) single-node 배포용 CI/CD. msa repo 가 public 이라
ubuntu-24.04-arm runner 가 무료 무제한.

## ci.yml — PR / main push 검증

PR 머지 전 + main push 시 빠른 게이트.

| Job | 역할 | runner | 소요 |
|---|---|---|---|
| `compile-gate` | `./gradlew compileKotlin compileJava` — 컴파일만 (test 없음) | arm64 | ~5분 |
| `kustomize-validate` | 모든 overlay 의 `kubectl kustomize` 렌더 검증 | x86 | ~30초 |

test 와 jib 빌드는 images.yml 이 main push 시 수행 (중복 방지).

## images.yml — main push / version tag

변경된 서비스만 빌드 → OCIR push → manifest commit-back.

### 흐름

```
[git push to main]
   ↓
1. GitHub App token 발급 (msa + msa-auth + msa-gifticon scope)
2. checkout (submodule auth, gifticon 만 init)
3. 변경 감지: git diff HEAD~1..HEAD → 경로 → 서비스 매핑
   • 공유 의존성(common/buildSrc/gradle) 변경 시 전체 JVM rebuild
   • submodule pointer (auth, gifticon bare name) 도 감지
   • k8s/, docs/ 만 변경 시 조기 종료
4. JVM 변경 서비스: ./gradlew :svc:app:jib --max-workers=1 (직렬, OCIR 충돌 회피)
5. Docker 변경 서비스: docker buildx --platform linux/arm64 --push
6. k8s/overlays/oci-arm/kustomization.yaml 의 변경 service entry 만 newTag 갱신
7. main branch 일 때만 commit-back [skip ci]
   • tag push 는 detached HEAD 라 commit 불가 — 이미지 push 만 수행
```

### Tag 전략

- `latest` 태그: 사용 안 함 (OCIR manifest 동시쓰기 충돌 회피)
- `<short-sha>`: main push 시 자동 (`${GITHUB_SHA::7}`)
- `v1.2.3`: refs/tags/v* push 시 사용 (이미지 publish 만, manifest commit-back 없음)

### 필요 secrets

| Secret | 용도 |
|---|---|
| `APP_ID` | GitHub App ID (commit-back + submodule fetch) |
| `APP_PRIVATE_KEY` | GitHub App 개인키 |
| `OCIR_REGION` | OCI region key (예: `ap-chuncheon-1`) |
| `OCIR_NAMESPACE` | Tenancy Object Storage namespace |
| `OCIR_USERNAME` | `<namespace>/<oci-user>` (federated 면 `<namespace>/oracleidentitycloudservice/<oci-user>`) |
| `OCIR_TOKEN` | OCI Auth Token |

### App 설치 요구사항

`create-github-app-token@v3` 의 `repositories:` 옵션이 동작하려면 App 이
다음 3개 repo 에 명시적으로 설치돼있어야 함:

- `msa` (commit-back 권한)
- `msa-auth` (private submodule fetch)
- `msa-gifticon` (private submodule fetch)

설치 안된 repo 가 있으면 token 발급 단계에서 404 → 워크플로 실패.

### 강제 전체 빌드

`workflow_dispatch` → `Run workflow` → `rebuild_all = true` 입력.

## submodule-bump.yml — 수동 트리거

`msa-auth`, `msa-gifticon` 의 main HEAD 까지 msa 포인터 갱신 + commit-back.
외부 IDE 로 submodule 만 push 한 뒤 msa bump 깜빡했을 때 안전망.

평소엔 msa 안에서 통합 작업하면 수동 bump 불필요. cron 미설정 (CI 분 절약).

## Jib local reproducibility

```bash
./gradlew jib -PjibRegistry=<region>.ocir.io/<namespace>          # 전체
./gradlew :product:app:jib -PjibRegistry=...                       # 단일 서비스
./gradlew :product:app:jib -PjibRegistry=... -PjibTag=abc1234      # 커스텀 태그
./gradlew jib -PjibPlatforms="linux/amd64,linux/arm64" ...         # multi-arch
```

기본 platforms 는 `linux/arm64` 만 (commerce.jib-convention.gradle.kts).
multi-arch 필요 시 `-PjibPlatforms` 로 override.

## Submodules

`.gitmodules` 의 6개 submodule 중 빌드 참여는 2개:

| Submodule | 빌드 참여 | 처리 |
|---|---|---|
| `auth` | ✅ | git submodule update --init auth |
| `gifticon` | ✅ | 동일 |
| `ai` | ❌ (Claude 플러그인) | fetch 안함 |
| `private` | ❌ | fetch 안함 |
| `career` | ❌ (별도 레포, 부재 가능) | fetch 안함 |
| `ideabank` | ❌ | fetch 안함 |

`actions/checkout` 의 `submodules:` 옵션을 `false` 로 설정하고 명시적으로
필요한 submodule 만 init — 부재/private 인 submodule 로 인한 checkout 실패 회피.
