# Game Arcade (#23)

웹 게임 아케이드 — 결정적(deterministic) KMP 코어 기반 랭킹 무결성이 차별점.
같은 시뮬 코드가 브라우저(플레이)와 commerce:app JVM(Tier B 리플레이 검증)에서 동일 실행된다.

## Modules

| Gradle path | 역할 |
|---|---|
| `:game:sim` | KMP(jvm+js) 결정적 엔진 — 정수 PRNG(mulberry32)·고정 timestep·`SimRunner` + Snake |
| `:game:domain` | 순수 백엔드 도메인 + 포트 + Tier A(`ScorePlausibility`)·Tier B(`ReplayVerifier`) |
| `:game:feature` | commerce:app 폴드 라이브러리(비-bootable) — Redis 전용 인프라(리더보드 ZSET·세션·리플레이·HMAC 토큰) + REST |
| `:game:web` | Kotlin/JS canvas 클라이언트 — `:game:sim` js 타깃 소비, 번들은 commerce:app `static/game/` 에 패키징 |

배포 단위 없음 — `commerce:app` 에 폴드(ADR-0058 패턴, 추가 상시 프로세스 0). 영속은 Redis 전용(전용 DB/EMF 없음).

## Commands

```bash
./gradlew :game:sim:jvmTest        # 결정성 테스트 (같은 seed+입력 → 같은 결과)
./gradlew :game:domain:test        # Tier A/B 검증 규칙
./gradlew :game:feature:test       # 제출 오케스트레이션 + 라이브 E2E(testcontainers Redis)
./gradlew :game:web:jsBrowserDistribution   # 브라우저 번들(game.js) 생성
./gradlew :commerce:app:bootJar    # 게임 포함 배포 jar (정적 클라 자동 번들)
```

## Access (subdomain 방식)

트래픽은 전부 gateway 를 경유한다(netpol 02/03 재사용, commerce 직행 없음):

| 환경 | URL | 경로 |
|---|---|---|
| oci-arm | `https://game.<DOMAIN>` | ingress(game host `/` → gateway) → gateway `game-client` Host 라우트 → commerce `/game/**` |
| 로컬 k3d | `http://game.127.0.0.1.nip.io` | k3s-lite `game-host-local` ingress (oci-arm 상속 시 delete) |
| 로컬 jar 직행 | `http://localhost:8085/game/` | commerce:app 정적 서빙 (welcome forward → index.html) |

- API 는 `/api/v1/game/**` (public, 게스트 플레이) — game host 에서도 `/api/**` 는 gateway 표준 path 라우트를 타므로 **다른 도메인 API 인증 우회 불가**.
- gateway `game-client` 라우트는 정적 엔트리 allowlist(`/`, `/index.html`, `/*.js`, `/*.js.map`, `/assets/**`)만 `prefixPath(/game)` 로 commerce 에 프록시.
- oci-arm 신규 host 체크리스트: ① Cloudflare DNS A `game` → OCI IP (proxied) ② cf-origin-ca-tls cert 가 `*.<DOMAIN>` wildcard 인지 확인 ③ Argo CD sync.

## Key Rules

- **결정성 불변식**: sim 코어는 정수 연산만 — `Math.random()`/`Date.now()`/부동소수점 시간 금지. 위반 시 Tier B 리플레이 재현이 깨진다.
- 게임 추가 시: `GameModule` 구현(commonMain) + `InMemoryGameRegistry` 등록 + 클라 렌더. 절차적 맵/드랍은 반드시 seed 파생 PRNG 스트림 사용.
- 점수 제출 흐름: Tier A(경량: 토큰/시간정합/상한/인간성) 전수 → 잠정 등재 → 상위 N/의심만 Tier B(서버 리플레이 재계산) — `SubmitScoreService` 참조.
- 운영 배포 시 `game.security.hmac-secret` env 필수 주입 (기본값은 dev 전용).

## Docs

- PRD: `ideabank/docs/23-web-game-arcade.md` (구현 결과 포함)
