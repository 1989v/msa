# OCI 운영 저널 (oci-arm)

OCI Ampere A1(arm64) free tier 에서 MSA 를 운영하며 나누는 Q&A 와 결정 사항을 기록한다.

**기록 방식 (compaction 형식)**: 질의마다 누적하지 않는다. 하나의 맥락(Q&A 사이클)이
**해결/종료되면** 그 사이클 전체를 1개 항목으로 압축해 남긴다 — 증상→원인→조치→결과만.
진행 중 세부 디버깅 로그는 사이클 종료 시 버린다.

- 대상 overlay: `k8s/overlays/oci-arm/`
- 상속: `k8s/overlays/k3s-lite/` (nip.io + cert-manager 차이)
- 인프라: `k8s/infra/local/` (plain StatefulSet, 단일 인스턴스)
- 배포 모드 표: 루트 `CLAUDE.md` → Deployment Modes

---

## 현재 환경 스냅샷 (2026-05-31 기준)

최근 oci-arm 관련 커밋 흐름 (외부 노출 / 네트워킹 위주):

| 영역 | 상태 | 비고 |
|------|------|------|
| cloudflared (Zero Trust Tunnel) | 운영 중 | 표준 MASQUE 복귀, private hostname routing (cloudflared 2026.5.0) |
| CoreDNS custom | 적용 | WARP private hostname route 용 DNS rewrite (`coredns-custom.yaml`) |
| Kafka 외부 노출 | 적용 | 19092 → `kafka.1989v.com` |
| NetworkPolicy | 적용 | cloudflared → infra ingress 허용 |
| sysctl 튜닝 | 적용 | DaemonSet 방식 (`sysctl-tuning/`) |
| cert-manager | 적용 | `cert-manager/` |
| ingress | 적용 | `ingresses/` |

> 위 표는 질의 진행하며 갱신.

---

## 로그

<!-- 형식 (사이클 1개 = 항목 1개):
### YYYY-MM-DD — <주제>  [상태]
**증상/질문 →** **원인 →** **조치 →** **결과**
근거: 파일·커밋·명령
-->

### 2026-06-01 — admin 접근제어 동작 여부  [진단·부분갭]
- **질문:** admin 접근제어 동작 중인가? → **데이터는 보호됨(gateway), FE 게이트는 우회됨, 일부 갭 존재.**
- **Gateway(진짜 경계) — 동작 ✅:** 실 라우트는 `application.yml` 이 아니라 **`GatewayRouteConfig.kt` 프로그래밍 RouteLocator** 가 정의 — `authFilter.apply(userConfig/sellerConfig/adminConfig)` 적용. JWT validation→401, role 부족→403. live(clean curl): `/api/products` **401**, `/api/orders` **401** (토큰 없음). RBAC 티어: userConfig(USER+), sellerConfig(SELLER+ inventory/fulfillment/warehouse), adminConfig(ADMIN, `/api/auth/roles/**`). `/api/auth/**`·`/api/v1/recommendations/**` 무인증.
- **FE 로그인 게이트 — 우회됨 ❌:** `admin/frontend/src/lib/auth-bypass.ts` `BYPASS_AUTH=true` 하드코딩 → `useAuth` mock `local-admin/ROLE_ADMIN` → AppLayout 가드 무력. Dockerfile 이 prod 번들에 그대로 컴파일. 단 데이터 호출은 토큰 없어 gateway 가 401 → UI 는 빈 껍데기(대시보드 0/0, 콘솔 401). UI 구조는 노출되고 "운영 빌드 금지" 주석 위반.
- **갭 ⚠️:**
  1. admin 대시보드 데이터 라우트가 대부분 `userConfig`(ROLE_USER+) — 실인증 켜져도 일반 USER 도 호출 가능. admin 전용 데이터 경계 없음(admin-ness 는 FE 개념뿐).
  2. `/svc/*/actuator/health` 는 auth 필터 없이(StripPrefix=2 만) **무인증 200** — DB/component 상태 누출.
  3. 라우트 **중복 정의**: `application.yml`(product/order/member/auth, 인증필터 X) + `GatewayRouteConfig.kt`(동일 id, 인증필터 O). 현재는 인증 라우트가 win(live 401) 이나 shadowing 리스크 — YAML 쪽 정리 필요.
- **조치 결과:**
  - ✅ **#2 actuator 보호**: gateway `/svc/*/actuator/**` → `/svc/*/actuator/health` 한정(커밋 `8be7a62`). live 검증: health 200 유지, metrics/env/prometheus/beans **404**(이전 metrics 200 누출 차단). 대시보드 영향 없음.
  - ✅ **#3 중복 라우트 정리**: product/order/auth YAML 무인증 라우트 제거(Kotlin 인증 라우트가 커버, live `/api/products`·`/api/orders` 401 유지). member 는 admin `/api/members(목록)`·`/api/members/stats` 유일 커버라 유지 — ⚠️ `/api/members/stats/count` 무인증 200 확인됨(미해결, 추후 adminConfig 이관).
  - ⏳ **#1 Cloudflare Access(수동)**: admin.1989v.com 을 Zero Trust Access app + Allow 정책 뒤로. `cloudflared/README.md` 패턴. 미적용. (admin 외 quant/gft 등도 `/svc`·`/api` 도달 가능 → 필요시 동일 적용.)
  - ⬜ **미실행**: FE BYPASS_AUTH 운영 제외(OAuth 정상화 필요 → 큰 작업), admin 데이터 라우트 adminConfig 화, health detail(`show-details:always` 17개 서비스) 축소, auth-roles 라우트가 broad `/api/auth/**` 뒤에 와서 adminConfig shadow 되는 잠재 버그.
근거: `gateway/.../config/{GatewayRouteConfig,SecurityConfig}.kt`, `filter/AuthenticationGatewayFilter.kt`, `gateway/.../application.yml`, `admin/frontend/src/{lib/auth-bypass,hooks/useAuth}.ts`, live curl.

### 2026-06-01 — wishlist CrashLoopBackOff = MySQL max_connections 고갈  [진단완료·fix 대기]
- **증상:** `/svc/wishlist/actuator/health` HTTP 200 + 빈 body(9/9). 대시보드 UNKNOWN 1.
- **진단(SSH `msa-oci` 168.107.22.114 → `sudo k3s kubectl`):** wishlist pod **CrashLoopBackOff** 110회 재시작/14d, 0/1 Ready, exit 1. previous log: `SQLNonTransientConnectionException: Too many connections` (Hikari checkFailFast at Hibernate schema migration).
- **근본 원인:** mysql-0 `max_connections=151`, `Threads_connected=151/151` 포화, `Aborted_connects=333,347`. 14개 서비스 Hikari pool(서비스당 master+replica 각 10 = ~20) 합이 151 초과 → wishlist 가 경쟁에서 밀려 풀 확보 실패(`wishlist_user` 커넥션 0). **wishlist 코드 무관, 인프라 용량 문제.**
- **fix 경로(미실행, 프로덕션 변경이라 승인 대기):**
  - 즉시: mysql-0 `SET GLOBAL max_connections=500` (비영구, pod 재시작 시 리셋).
  - 영구: `k8s/infra/local/mysql/` 에 `max_connections` (예: 500) 추가 + 재배포.
  - 지속가능: 서비스 Hikari `maximum-pool-size` 10→5 등 축소(14서비스 재배포, 무거움).
- **격리 확인:** 동일 gateway·라우트로 product/order/member/gifticon 정상 → gateway actuator 좁히기(`8be7a62`) 무관.
근거: SSH k3s kubectl describe/logs, `mysql-0` SHOW STATUS, `*/app/src/main/resources/application.yml`(pool 10), `k8s/infra/local/mysql/`.

### 2026-05-31 — admin-fe 서브도메인 루트 서빙  [해결·검증됨]
- **증상:** `admin.1989v.com/` 빈 흰 화면.
- **원인:** admin-fe 라우트가 전부 `/admin/...` prefix → 루트 `/` 매칭 route 없음(`No routes matched location "/"`). URL·ingress·asset(200) 정상. admin-fe 가 portal `/admin/*` path 모델용인데 oci-arm 은 전용 서브도메인 루트로 서빙 → prefix 중복/불일치.
- **아키텍처 판단:** 서브도메인 랜딩·레이어링 모두 정상 — Host→FE 는 ingress-nginx, gateway 는 Path 기반 API 전용(FE 정적 서빙 안 함이 맞음). 고칠 건 admin-fe 한쪽.
- **조치(최종):** `/admin` prefix 제거로 평탄화 — App.tsx 라우트, Sidebar nav 12개, AppLayout/LoginPage/OAuthCallback redirect, client.ts 401 redirect, auth.ts `OAUTH_REDIRECT_URI` 전부 루트 기준. (중간에 `/`→`/admin` 리다이렉트 임시처치 `2da5f16` 거쳤다가 정석으로 대체.) 대시보드 nav `to:'/'` 가 외부 코드딕셔너리 링크와 React key 충돌 → 외부 항목 key 를 label 기반으로 분리.
- **결과:** ✅ 커밋 `b294ede`→rebase `50051a5` → CI run `26710489028` success → tag `50051a5` → Argo roll(asset `index-D7-buRrz.js`). 브라우저 검증: `admin.1989v.com/` 가 곧바로 대시보드 렌더, 리다이렉트·`No routes matched` 없음. nav 전부 root 기준.
- **배포 경로 메모:** push 는 개인계정 `1989v` 필요(`osxkeychain` 기본=회사 `kwongd`→403). `gh auth switch 1989v` + `git -c credential.helper='!gh auth git-credential' push` 후 active 복원. CI commit-back(tag bump) 때문에 매 push 전 `fetch+rebase` 필요(WIP 있으면 stash).
- **후속 처리:**
  1. ⚠️ **수동·미완**: Kakao/Google OAuth 콘솔 Authorized Redirect URI `.../admin/oauth/callback` → `.../oauth/callback` 추가(신규 먼저 추가 후 구 URI 제거). 현재 OAuthCallbackPage 가 bypass(더미 JWT)라 당장은 무관, bypass 제거 시 필수. 코드(`auth.ts`)는 이미 `.../oauth/callback` 배포됨.
  2. ✅ **오진 판명**: member/wishlist "non-JSON (라우팅 오류 의심)"는 롤아웃 중 일시적 — curl/in-browser 36회 반복 호출 전부 200 JSON, 대시보드 UP 12 정상. gateway actuator 라우트(StripPrefix=2)는 12개 동일하게 정상. 코드 수정 없음. (감지 코드 `system.ts` 는 의도대로 동작.)
  3. ✅ **해결·검증**: Sidebar 외부 링크를 hostname→apex 도출 절대 URL 로(`externalUrl()`). 커밋 `fa2c422`. 검증: 분할매매→quant.1989v.com/, 차트→quant.1989v.com/charts, 기프티콘→gft.1989v.com/, 에이전트→agent.1989v.com/, 코드딕셔너리→1989v.com/ (5개 전부 HTTP 200).
근거: `admin/frontend/src/**`(App/Sidebar/AppLayout/api/pages), `gateway/.../application.yml`(actuator 라우트), `.github/workflows/images.yml`, `k8s/overlays/oci-arm/`.
