# Ads Service

광고 네트워크 — 로그인 회원(광고주)이 **가상 크레딧**으로 집행한 디스플레이 광고를 1989v 서브도메인의
지면에 내보낸다. 문맥 기준 1차 경매로 고르고, 가시 노출·클릭을 서명 토큰으로 검증해 복식부기 원장으로 정산한다.
game 의 HOUSE 배너(ADR-0059 §3)를 흡수한다.
ADR: `docs/adr/ADR-0098-ad-network.md` · spec: `docs/specs/2026-09-23-ad-network/` · 용어: `ads/glossary.md`

## Modules

| Gradle path | 역할 |
|---|---|
| `:ads:domain` | Pure Kotlin 도메인 — 캠페인·소재·지면·경매·페이싱·원장·정산·토큰 서명. `:common` 만 의존 |
| `:ads:feature` | Spring 라이브러리 (비-bootable). **`engagement:app` 이 흡수** (ADR-0093 성격 축 「순위를 매기고 실험하는 것」) |

새 파드를 만들지 않는다. 스키마는 전용 `ads_db`(공유 MySQL, 별칭 Service `mysql-ads-master`),
마이그레이션은 `ads/feature/src/main/resources/adsdb/migration` — **커밋한 마이그레이션은 고치지 않는다**, 다음 번호로.

## 구조 상태 (ADR-0083)

표준 준수 (처음부터) — `application/{advertiser,campaign,creative,placement,category,decision,event,ledger,settlement,report,token,audit}/{usecase,port,service,dto}`
+ `infrastructure/{persistence,redis,messaging,image,scheduling,metrics,config}` 어댑터. application 은 infrastructure 를 import 하지 않는다
(`verifyArchitecture`). engagement 의 recommendation·experiment 빈을 주입하지 않는다 (ADR-0058).

## Commands

```bash
./gradlew :ads:domain:test                                   # 도메인 (Spring context 없음)
./gradlew :ads:feature:test --tests '*IntegrationSpec*'      # 통합 스펙 (MySQL·Redis 컨테이너)
./gradlew :engagement:app:test --tests '*EngagementContextLoadSpec*' --tests '*AdsSchemaIntegrationSpec*'
./gradlew verifyArchitecture                                 # 레이어·폴드 게이트
```

PR CI 는 `ads/*` 변경에 `:engagement:app:test :ads:domain:test :ads:feature:test` 를 돌린다
(`.github/workflows/ci.yml`, `scripts/ci/topology.sh` 와 같은 목록).

## 기동 조건 — 셋 중 하나라도 없으면 engagement 가 못 뜬다

recommendation·experiment 도 같은 파드라 **함께 멈춘다.** 이미지보다 먼저 넣는다.

| 무엇 | 어디 |
|---|---|
| `ads_db` + `ads_user` | 새 클러스터는 `k8s/infra/local/mysql/configmap-init.yaml` 이 만든다. **이미 데이터가 있는 볼륨(oci-arm)은 1회 수동 SQL** — `k8s/infra/local/mysql/services.yaml` 의 `mysql-ads-master` 위 주석. prod-k8s 는 `init-databases-job.yaml` + `ADS_PASSWORD` |
| Secret `ads-token` (키 `secret`, 32바이트 이상) | `kubectl -n commerce create secret generic ads-token --from-literal=secret="$(openssl rand -hex 32)"`. prod-k8s 는 kubeseal 로 봉인. 다른 서비스의 HMAC 키와 공유하지 않는다 |
| 메모리 Tier M(768Mi) | `k8s/overlays/oci-arm/kustomization.yaml` — engagement 는 Tier S 패치 대상이 아니다 |

**키 교체**: 새 키를 `secret` 에, 옛 키를 `previous` 에 넣고 재기동 → 토큰 수명(발급 뒤 유효 시간)이 지나면
`previous` 를 지운다. `previous` 없이 바꾸면 그 사이 발급된 노출·클릭 토큰이 전부 서명 불량이 된다.

## 규칙 (깨면 조용히 틀린다)

- **결정 경로(`POST /api/v1/ads/decisions`)는 DB 를 부르지 않는다.** 메모리 후보 인덱스(30초 갱신) + Redis 읽기 1회·쓰기 1회(Lua)만.
  `DecisionIntegrationSpec` 이 MySQL `Com_*` 증감과 Redis `INFO commandstats` 로 판정한다 — JPA 호출을 더하면 빨간불
- **ads Redis 연결은 스프링 빈이 아니다** (`AdsRedisConnection` 이 직접 만들어 쥔다, 명령 250ms·연결 500ms).
  `RedisConnectionFactory` 빈을 하나라도 등록하면 Boot 자동 구성이 물러나 recommendation 의 공용 연결까지 250ms 가 되고,
  동기화의 `RENAME`·대량 `delete` 가 깨진다. `EngagementContextLoadSpec` 이 이것을 본다
- **모든 `@Transactional` 은 `"adsTransactionManager"` 한정자.** 호스트의 primary TM 은 다른 스키마다 —
  한정자가 빠지면 ads 쓰기가 트랜잭션 밖에서 돈다. `LedgerPort.post` 는 `MANDATORY` 라 빠지면 예외로 드러난다.
  충전·정산은 `READ COMMITTED` — 지갑 행 잠금을 기다린 뒤 합계가 앞 커밋을 봐야 한다
- **원장은 합 0 이 아니면 만들어지지 않는다** (`LedgerTransaction` 팩토리, 생성자 비공개). 계정 행은 id 순 `FOR UPDATE`
- **스케줄 작업은 `ads.scheduling.enabled` 조건을 단다** (기본 true, 테스트는 끄고 직접 호출). `@EnableScheduling` 은
  ads 설정이 직접 선언한다 — outbox 토글에 기대지 않는다. replicas 1 전제, 모든 작업은 멱등
- **방문자 id 는 해시로만** 로그·Redis 에 남긴다. 빈도 키 TTL 은 `AdsRedisKeys.VISITOR_FREQUENCY_TTL_HOURS`(25시간) 한 곳이고
  `/privacy` §6 문구와 같아야 한다 (ADR-0077)
- analytics 사본(`analytics.event.collected`, `entity_type=AD`)은 권위 원천이 아니라 **Outbox 없이** 보내고 실패는 경고만 —
  과금·정산은 ads 자기 카운터와 원장이 정한다
- 광고주 API 는 모든 리소스를 (id, 요청자 광고주 id)로 찾는다 — 남의 것은 404. 우선순위·심사 상태·원장 계정은 요청 모델에 없다
- 공개 경로를 새로 만들면 게이트웨이 `ads-public` 라우트의 path 목록에도 넣는다 (Host 허용 목록 `kgd.gateway.ads.allowed-hosts`)

## 테스트

- 통합 스펙은 컨테이너 DB 하나를 같이 쓰고 회원 id 가 유일 키다. **스펙마다 회원 id 대역을 나눠 쓴다** —
  목록은 `ads/feature/src/test/kotlin/com/kgd/ads/support/AdsFixtures.kt` 의 `memberAdvertiser` 주석. 새 스펙은 새 대역을 잡고 거기 한 줄을 더한다
  (대역이 겹치면 따로 돌면 초록, 함께 돌면 빨강이 된다 — 그룹 5 에서 실제로 났다)
- 시간은 주입된 `Clock` 으로만 읽는다. 「하루」는 KST 달력일
- 돈·일회성·차단 경로 검사는 회귀를 주입해 빨간불을 본 것만 켰다고 친다 → `docs/specs/2026-09-23-ad-network/verifications/regression-injection.md`

## API 요약

| Prefix | 인증 | 설명 |
|---|---|---|
| `POST /api/v1/ads/decisions` · `POST /api/v1/ads/events` · `GET /api/v1/ads/click/{token}` · `GET /api/v1/ads/assets/{hash}` | 공개 (Host 허용 목록 + 리미터 `CF-Connecting-IP`) | 결정 · 노출/클릭 수락 · 클릭 리다이렉트 · 승인 소재 이미지 |
| `GET /api/v1/ads/placements/{key}` | 공개 | 옛 game HOUSE 응답 모양 호환 — 다음 릴리스에서 제거 |
| `/api/v1/ads/advertiser/**` | ROLE_USER+ | 등록 · 대시보드 · 충전 · 캠페인 · 소재 업로드 · 카탈로그 · 리포트 |
| `/api/v1/admin/ads/**` | ROLE_ADMIN | 심사 · 광고주 정지 · 지면 · 문맥 매핑 · HOUSE · 퍼블리셔 리포트 · 원장 검사. 변경마다 행위자·시각 |

## 릴리스 순서와 되돌리기 (SR-14)

1. common 슬라이스(`EntityType.AD`) — 완료
2. **ads 배포 + 게이트웨이 전환을 한 릴리스로** (Argo sync-wave 가 engagement 9 → gateway 20 순서를 보장).
   이 릴리스 동안 ads 가 옛 `GET /api/v1/ads/placements/{key}` 를 옛 응답 모양으로 제공한다
3. FE 가 결정 API 로 전환 (`AdSlot`·`HouseBanner`)
4. 다음 릴리스: 호환 경로 제거 + game ads 코드 제거 + game 광고 표 삭제 **새 마이그레이션**(별도 커밋)

되돌리기:
- 2 뒤·3 전 — 게이트웨이 라우트만 content 로 되돌린다
- 3 뒤 — **FE 이미지와 게이트웨이를 함께** 되돌린다. 그 사이 발급된 클릭 토큰은 404 가 되고, 그 손실은 받아들인다
