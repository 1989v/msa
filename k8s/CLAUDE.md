<!-- source: k8s/overlays/oci-arm/kustomization.yaml -->

# 배포 (K8s · GitOps)

1989v.com 은 **OCI Ampere A1 단일 노드 k3s** 위에서 돈다 (무료 티어). 배포는 Argo CD 가
`k8s/overlays/oci-arm` 을 watch 하는 GitOps 이고, 이미지 태그는 CI 가 커밋백한다.

이 문서는 **여기서 실제로 터진 것**만 모은다. 구조 결정은 ADR 에 있다 —
ADR-0019(K8s 전환) · ADR-0061(엣지 하드닝) · ADR-0073(배포 파이프라인 가드레일).

## 지형

| 항목 | 값 |
|---|---|
| 접근 | `ssh msa-oci` → `sudo k3s kubectl`. **로컬 kubeconfig 에 OCI 컨텍스트가 없다** (회사 EKS·k3d 뿐) |
| 운영 DB | `~/.local/bin/oci-mysql <db> "SELECT ..."` (로컬 전용 CLI, 레포에 없음) |
| GitOps | Argo CD — `argocd.1989v.com`. watch 대상은 `k8s/overlays/oci-arm` |
| 이미지 | OCIR `ap-chuncheon-1.ocir.io/axyooxbyk5yv` |
| 배포 모드 | `k3s-lite`(로컬 k3d) · `oci-arm`(운영) · `prod-k8s`(매니지드, 미사용) |

## Commands

```bash
kubectl apply -k k8s/overlays/k3s-lite                  # 로컬 전체
kubectl apply -k k8s/overlays/prod-k8s                  # 매니지드 (참고)
kubectl kustomize k8s/overlays/oci-arm | head           # 렌더 확인 (CI 가 하는 것과 같은 검사)
k8s/argocd/install.sh                                   # Argo + 워치독 (Argo 가 배포하지 않는 것들)
```

## Key Rules — 실제로 터진 것

- **최상위 제약은 무료 티어다.** 용량이 부족하면 증설이 아니라 **동시성 축소**로 푼다.
  4 OCPU 단일 노드에 수십 서비스가 있고, 이 제약이 아래 함정 절반의 원인이다

- **`rebuild_all` 을 쓰지 마라 — 단일 노드에서 동시 롤아웃은 폭주한다.**
  2026-08-09 전면 장애, 2026-08-21 재발 실측: `bump 15 service image tag(s)` 한 방에 19
  Deployment 가 동시 재기동 → `k3s-server` 192% + Argo controller 92% 로 3/4 코어 점유, idle 0%.
  **이때 터지는 건 롤아웃이 아니라 무관한 배치다** — CoreDNS 가 CPU 를 못 받아 개요 CronJob·
  attraction-reindex 가 `UnknownHostException` 으로 죽는다. **CoreDNS 파드는 Ready 라 헬스로 안 잡힌다.**
  배치가 DNS 로 죽으면 CoreDNS 가 아니라 `kubectl top node` 와 Argo sync 상태를 먼저 본다.
  누락 서비스는 지정 재빌드: `gh workflow run images.yml --ref main -f services="gateway portal-fe"`

- **테스트 게이트 한 번 실패 = 그 커밋의 모든 이미지 미생성.** `images.yml` 은 변경된 JVM
  서비스의 `./gradlew test` 를 이미지 빌드보다 **먼저 한 잡 안에서** 돌린다. 한 서비스가 깨지면
  잡이 exit 1 로 끝나 다른 서비스 이미지도 하나도 안 구워진다. 조용한 함정은 그 다음이다 —
  나중 커밋이 그 경로를 안 건드리면 **그 서비스는 영원히 옛 태그로 남는다.** 매니페스트는 Argo 가
  즉시 반영하므로 ingress·CronJob 은 새것인데 앱만 옛 코드이고, 겉으로는 200 이 떠서 배포된 것처럼 보인다
  (ADR-0069 deal 출시에서 겪음). **실패한 런의 재실행은 소용없다** — 그 시점 코드에 버그가 그대로다.
  배포 확인은 커밋이 아니라 **태그**로:
  `git show origin/main:k8s/overlays/oci-arm/kustomization.yaml | grep -A2 'name: commerce/<svc>$'`

- **폴드된 모듈은 CI 경로 매핑에 명시해야 리빌드된다.** `images.yml` 은 변경 경로 → 이미지
  매핑인데 ADR-0059 폴드(game → code-dictionary)처럼 소스 경로와 이미지 이름이 다르면 규칙을
  추가해야 한다. 유사 폴드를 신설할 때마다 확인할 것

- **Argo Application 의 인라인 패치는 인그레스 `rules` 인덱스에 결합돼 있다.** 인그레스에서
  host 를 빼면 클러스터의 Application(수동 apply, GitOps 밖)이 없는 인덱스를 치환하려다
  kustomize build 실패 → `ComparisonError` 로 **전체 sync 가 무기한 정지**한다. 증상은
  "파드가 수십 일 전 이미지로 동결, 매니페스트 핀만 전진". 고칠 때는
  `k8s/argocd/application.yaml`(SSOT)과 **클러스터 양쪽**을 함께 고친다

- **sync 가 "실패"가 아니라 "안 끝남"으로 막힌다.** `progressDeadlineSeconds` 도
  `syncPolicy.retry` 도 실패만 다루고 이 상태는 못 잡는다 — 실측 **6시간 30분** 정지,
  그동안 롤백조차 클러스터에 닿지 못했다.
  - 확인: `kubectl -n argocd get app commerce -o jsonpath='{.status.operationState.phase}{" "}{.status.operationState.startedAt}'`
  - 수동 해제: `kubectl -n argocd patch app commerce --type json -p '[{"op":"remove","path":"/operation"}]'`
  - 자동 해제: 워치독 CronJob 이 20분 초과 시 끊는다 (ADR-0073)
  - **워치독은 Argo 가 배포하지 않는다** — 막힌 것을 푸는 물건을 막힌 것이 배포하면 같이 막힌다.
    `k8s/argocd/install.sh` 가 직접 apply 하므로 **워치독을 고치면 install.sh 를 다시 돌려야 반영된다**

- **CI 커밋백은 최신 main 위에 태그를 다시 적는다 — 병합하지 않는다.** 각 런은 자기 commit sha 를
  체크아웃하므로, 빌드가 도는 몇 분 사이 앞선 런의 커밋백이 얹히면 push 가 밀린다. 이때 rebase 로
  합치려 하면 `images:` 블록을 양쪽이 통째로 다시 써서 **반드시 충돌한다** (2026-08-25 실패).
  그래서 `Commit manifest update` 는 시도마다 `fetch → reset --hard origin/main → 태그 재적용` 한다.
  5회 모두 실패하면 이미지는 OCIR 에 있으니 수동 bump `[skip ci]` 로 복구한다.
  **push 이벤트 CI 런은 수 분~수십 분 지연 생성될 수 있다** (2026-08-11 실측 — "런 없음"으로
  판정해 dispatch 했더니 원래 런이 뒤늦게 생성돼 이중 빌드). 최소 10분 뒤에 판단한다

- **서브모듈은 본체보다 먼저 push 한다** — 원격에 없는 커밋을 포인터가 가리키면 CI 가
  `upload-pack: not our ref` 로 죽는다. 이미지가 **아예 생성되지 않으므로** 그 커밋의 변경분은
  다음 커밋이 같은 경로를 건드릴 때까지 운영에 반영되지 않는다 (2026-08-22·23 games 3회).
  로컬 `pre-push` 훅이 7개 서브모듈 포인터를 원격 대조해 막지만, **훅은 레포에 없다** —
  새 클론에서는 이 방어가 없다

- **NetworkPolicy 는 default-deny 라 새 트래픽 경로마다 명시 허용이 필요하다.** 앱→Kafka 는
  9092 만 열려 있었는데 kubernetes 프로파일은 `kafka:29092`(INTERNAL)로 bootstrap 해서
  **K8s 프로파일 publish/consume 가 전면 차단됐다 — 무증상으로.** CronJob/Job 파드는
  `part-of=commerce-platform` 라벨이 있어야 egress 허용 대상이 된다

- **MySQL 유저를 수동 생성할 때 인증 플러그인을 명시한다** —
  `IDENTIFIED WITH mysql_native_password BY ...`. 기본(caching_sha2)으로 만들면 앱이 Access denied.
  init 스크립트 유저는 서버 플래그 덕에 native 로 생성되지만 수동 세션은 아니다

- **arm64 러너 장애 시 로컬 Jib 폴백**:
  `./gradlew -PjibRegistry=ap-chuncheon-1.ocir.io/axyooxbyk5yv -PjibTag=<sha> :svc:app:jib`
  (OCIR 크레덴셜은 클러스터 `ocir-pull-secret` 의 dockerconfigjson 재사용).
  여러 태스크 일괄 실행 시 push 누락 사례가 있어 `docker manifest inspect` 로 태그 존재를 검증한다

- **`workflow_dispatch` 는 개인 계정 토큰으로 한다** —
  `GH_TOKEN=$(gh auth token -u 1989v) gh workflow run ...`.
  전역 `gh auth switch` 는 하지 않는다(회사 세션 오염)

## 장애가 났을 때 보는 순서

1. **바디 길이** — 게이트웨이는 업스트림이 죽어도 200 + `content-length: 0` 을 내린다.
   상태코드만 보면 정상으로 오진한다 (`gateway/CLAUDE.md`)
2. **파드 상태** — `kubectl get pods`. 빈 응답은 이미지 문제가 아니라 CrashLoop 증상일 수 있다.
   실제로 **깨진 이미지 → 깨진 이미지 횡롤백**이 일어난 적이 있다
3. **`git log origin/main`** — 다른 세션의 fix 커밋이 origin 에 있는지. 픽스가 로컬에만 있는 채
   배포가 반복돼 장애가 6시간으로 늘어난 적이 있다
4. **Flyway 체크섬** — 이미지 태그 롤백이 안 듣는 장애는 대개 이것이다.
   **적용된 마이그레이션은 절대 편집하지 않는다**(→ 새 번호로). 이미지가 아니라 파일과 DB 의
   불일치라 옛 이미지도 같은 오류로 죽는다
5. **응급 복구** — overlay 의 desired 태그와 **같은 이미지**를 `kubectl set image` 로 직접 박는 것은
   드리프트가 아니다. GitOps 수렴을 앞당기는 안전한 조치다

## Related

- ADR: `docs/adr/ADR-0019-k8s-migration.md` · `ADR-0061`(엣지) · `ADR-0073`(파이프라인 가드레일)
- 백업/복구: `docker/backup/README.md`(스크립트) · `k8s/infra/prod/backup/README.md`(CronJob)
- 로컬 클러스터: `k8s/infra/local/ingress-nginx/README.md`
- 서브도메인 추가 체크리스트: 루트 `CLAUDE.md` (ingress host · App.tsx · 프리렌더 · `serviceHref.ts`)
