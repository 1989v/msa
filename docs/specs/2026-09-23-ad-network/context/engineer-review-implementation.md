# Engineer Review — implementation

- 대상: `spec.md` · `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml` · ADR-0098
- 차원: implementation (체크리스트 `hns/0.16.1/skills/spec-review/reviewers/implementation/checklist.md`, skillsets 없음)
- 일자: 2026-09-23

## Seed Discovery

1. 스펙 폴더: `tasks*`·`status*` 는 아직 없다. `context/` 는 concepts.md · open-questions.yml 뿐
2. 이 차원 관련 문서: `docs/standards/new-domain-checklist.md` · `docs/conventions/transactional-usage.md` · `docs/conventions/idempotent-consumer.md` · `docs/conventions/jpa-persistence.md` · `k8s/CLAUDE.md` · `game/CLAUDE.md` · `gateway/CLAUDE.md`
3. 코드 근거: 아래 finding 마다 `{file}:{line}` 로 적었다
4. KB(`HNS_KB_PATH` = 1989v 볼트): 이 세션에 Bash 가 없어 `kb-search.sh` 를 직접 돌리지 못했다. 대신 볼트 `wiki/` 를 Grep 으로 찾았다(복식부기·페이싱·eCPM·광고 네트워크·멱등 키). 광고 도메인 개념 페이지는 없고 설계 원칙 페이지만 있다. [[premature-optimization]](updated 2026-07-14)은 "병목이 측정으로 확인되기 전에 최적화하지 않는다"고 적는다. 이 스펙의 메모리 후보 인덱스와 Redis 실시간 지출은 성능 최적화가 아니다. 결정 경로에 DB를 두지 않고 예산을 지키려면 필요한 장치라 이 원칙에 걸리지 않는다

## 체크리스트 판정

| # | 항목 | 판정 | finding |
|---|---|---|---|
| 1 | 참조한 클래스·모듈이 있는가 | 대부분 있음. 견본 하나가 틀렸다 | F2 · F10 |
| 2 | 기존 코드와 충돌하지 않는가 | 충돌 4건 | F2 · F5 · F6 · F9 |
| 3 | 복잡도 위험을 짚었는가 | 부분적 | 아래 「복잡도」 |
| 4 | NFR 안티패턴(N+1·타임아웃 누락·무한 자원)이 없는가 | 2건 | F3 · F4 |
| 5 | 마이그레이션·롤백 전략이 있는가 | 부분적 | F1 · F7 |
| 6 | 동시성 안전을 고려했는가 | 원칙만 있고 방법이 없다 | F8 |

확인된 참조: `EngagementApplication.kt:13-20` · `ExperimentDataSourceConfig.kt:35-95` · `ScopedFlywayMigrator.kt:23-40` · `GatewayRouteConfig.kt:370-377` · `V6__ads_house.sql` · `V8__seed_rewarded_placement.sql` · `AdSlot.tsx` · `copy.mjs:1060-1111` · `HouseBanner.tsx` · `gameApi.ts:539-541` · `CrawlerUserAgents.kt:15` · `DealRedirectService.kt:85` · `DealRedirectController.kt:25` · `BlogProfile.kt:40` · `ImageStoragePort.kt:3` · `kustomization.yaml:168-173`. `ads/` 모듈은 아직 없다(신규).

---

## Findings

### F1 — `ads_db` 를 만드는 단계가 없다. 빠지면 engagement 전체가 못 뜬다 (체크 2·5)

- 스펙 결정: SR-1 「전용 스키마 `ads_db` … 그 밖의 인프라 추가는 없다」 (`spec.md:23,25`)
- 코드:
  - 운영 MySQL 의 DB·계정은 `mysql-init` ConfigMap 이 만든다. 이 ConfigMap 은 **빈 볼륨 첫 기동 때 한 번만** 돈다 (`k8s/infra/local/mysql/configmap-init.yaml:10-11`). 거기에 `ads_db` 를 더해도 운영 볼륨에는 반영되지 않는다
  - `ScopedFlywayMigrator` 는 스키마를 만들지 않고 `migrate()` 만 돈다 (`common/.../ScopedFlywayMigrator.kt:30-38`). JDBC URL 이 없는 DB 를 가리키면 연결 단계에서 실패한다
  - engagement 의 datasource 호스트는 `mysql-experiment-master` 별칭이다 (`engagement/app/src/main/resources/application-kubernetes.yml:3`, `k8s/infra/local/mysql/services.yaml:162`). ads 가 쓸 접속 키·호스트가 스펙에 없다
- 영향: DB 가 없으면 ads 빈 생성이 실패하고, 같은 파드의 recommendation·experiment 도 함께 멈춘다. OQ-003 의 시크릿 사고와 영향 범위가 같다
- 수정안: SR-1 의 「인프라 추가 없음」을 「파드 추가 없음」으로 고치고 아래 다섯 가지를 넣는다
  1. `configmap-init.yaml` 과 `k8s/infra/prod/percona-mysql/init-databases-job.yaml` 에 `ads_db` 생성과 GRANT 를 추가한다
  2. 운영에는 이미지를 올리기 전에 `oci-mysql` 로 `CREATE DATABASE ads_db` 와 GRANT 를 실행한다. 새 계정이면 `IDENTIFIED WITH mysql_native_password` 로 만든다 (`k8s/CLAUDE.md` MySQL 유저 항목)
  3. 접속 키는 `spring.datasource.ads.*` 로 하고, 호스트는 기존 별칭을 재사용할지 `mysql-ads` Service 를 추가할지 정한다
  4. OQ-003 을 「시크릿과 **스키마**를 이미지보다 먼저」로 넓힌다
  5. `EngagementContextLoadSpec` 에서 컨테이너에 `ads_db` 를 만든다. 지금은 `experiment_db` 만 만든다 (`EngagementContextLoadSpec.kt:93-111`). 선례는 `ContentContextLoadSpec.kt:173-174`

### F2 — DataSource 견본을 잘못 골랐다. 트랜잭션 한정자와 ddl-auto 가 빠졌다 (체크 1·2)

- 스펙 결정: SR-1 「`ExperimentDataSourceConfig` 와 같은 모양. experiment 의 `@Primary` 는 그대로 둔다」 (`spec.md:23`)
- 코드:
  - `ExperimentDataSourceConfig` 는 **primary 형**이다. `@Primary` 를 달고 `spring.datasource` 접두사를 그대로 읽는다 (`ExperimentDataSourceConfig.kt:50-59,78-94`). 그대로 옮기면 primary 가 둘이 되거나, ads 가 experiment_db 에 붙는다
  - 비-primary 전용 datasource 의 견본은 `WishlistDataSourceConfig.kt:27-89` 다. 자기 접두사, `@Primary` 없음, `@DependsOn` Flyway 구조를 갖는다
  - 비-primary 도메인의 `@Transactional` 에는 TM 한정자가 필수다. `verifyTransactionQualifiers` 가 이를 검사한다 (`build.gradle.kts:835-902`, `new-domain-checklist.md:60-64`). 스펙에는 언급이 없다
  - engagement 는 전역 설정이 `ddl-auto: update` 다 (`engagement/app/src/main/resources/application.yml:21-23`). `EntityManagerFactoryBuilder` 가 이 JPA 속성을 ads EMF 에도 싣는다. 운영은 `ddl-auto-none.yaml:28-29` 가 막지만, 로컬 k3s-lite 는 `update` 를 주입한다 (`k8s/overlays/k3s-lite/patches/ddl-auto-update.yaml:16`). 그러면 마이그레이션 누락이 로컬에서 가려진다. 같은 사례가 `jpa-persistence.md:91` 에 경고로 적혀 있다
  - ads 에 `@Modifying` 이 생기면 `verifyPodTopology` 규칙이 걸린다. 호스트의 ContextLoadSpec 이 `com.kgd.ads.application.` 진입점을 불러야 한다 (`build.gradle.kts:700-730`). 테스트 C1 은 빈이 존재하는지만 본다 (`test-quality.md:40`)
- 수정안:
  - SR-1 의 견본을 `WishlistDataSourceConfig`(비-primary 전용형)로 바꾼다
  - `@Transactional("adsTransactionManager")` 를 쓴다고 명시한다
  - ads EMF 에 `hibernate.hbm2ddl.auto=validate` 를 명시한다
  - C1 에 「ads UseCase 를 불러 원장 잔액이 실제로 바뀐다」를 추가한다
  - `./gradlew generateTopology` 재생성을 작업 목록에 넣는다 (`build.gradle.kts:946-980`, `gradle/topology.properties:17`)

### F3 — Redis 타임아웃이 없어 AC-7 과 P99 30ms 를 지킬 수 없다 (체크 4)

- 스펙 결정: SR-5 「P99 ≤ 30ms · 사유 `redis_unavailable`」 (`spec.md:54-55`), AC-7, I4 「Redis 중단 상태에서 예외 없이 200」 (`test-quality.md:28`)
- 코드:
  - engagement 는 standalone Redis 를 쓰고 타임아웃 설정이 없다 (`engagement/app/src/main/resources/application.yml:30-34`)
  - common 의 `commandTimeout(2s)` 는 클러스터 모드일 때만 켜진다 (`common/.../CommonRedisAutoConfiguration.kt:21,40`)
  - 따라서 Lettuce 기본값이 적용된다. 명령 타임아웃 60초이고, 재연결 중에는 명령을 큐에 쌓는다
- 영향: Redis 가 멈추면 결정 API 가 빈 응답으로 떨어지지 않고 수십 초 동안 대기한다. Tomcat 스레드가 차면 같은 JVM 의 experiment·recommendation API 도 멈춘다
- 수정안: SR-5 에 아래를 명시한다
  - ads 전용 Redis 연결은 명령 타임아웃 수십 ms, `disconnectedBehavior=REJECT_COMMANDS` 로 둔다
  - 결정 한 번의 Redis 조회는 **파이프라인/MGET 한 번**으로 한다. 후보 × 지면마다 따로 조회하는 N+1 을 금지한다
  - I4 에 「응답 시간 ≤ 타임아웃 + α」 단언을 추가한다

### F4 — 공유 Redis 에 광고 키가 쌓이는 상한이 없다 (체크 4)

- 스펙 결정: 빈도 제한·일회성 표식·클릭 속도 제한을 모두 Redis 에 둔다 (`spec.md:49,68,76`)
- 코드:
  - 운영 Redis 는 한 인스턴스를 모든 서비스가 같이 쓴다. `limits.memory: 128Mi` 이고 `maxmemory` 설정이 없다 (`k8s/infra/local/redis/statefulset.yaml:28-49`). 한도를 넘으면 컨테이너가 OOM 으로 죽고, 게이트웨이 블랙리스트·rate limit·아케이드 리더보드가 함께 멈춘다
  - 크롤러는 JS 를 렌더해 관찰 코드를 전부 켠다. 사흘 동안 노출 64,165건이 쌓인 기록이 있다 (`analytics/.../CrawlerUserAgents.kt:6-9`). 결정 API 도 같은 규모로 호출된다
- 수정안: SR-5·SR-7 에 아래를 명시한다
  - 모든 ads 키에 TTL 을 단다
  - 결정 단계에서는 Redis 에 쓰지 않는다. 빈도 증가는 받아들인 노출에서만 한다
  - 결정 요청에도 크롤러 UA 판정을 적용한다
  - 키 수 예산을 적는다(하루 키 수 × 크기)
  - 공개 POST 두 개(`decisions`·`events`)에 게이트웨이 Rate Limiter 를 건다. 선례는 `game-save` (`game/CLAUDE.md` 게이트웨이 라우팅 절)

### F5 — 광고주 본인 과금 제외는 지금 구조로 판정할 수 없다 (체크 2)

- 스펙 결정: SR-8 「광고주 본인의 노출·클릭은 과금하지 않는다」 (`spec.md:75`). SR-13 은 결정·이벤트·클릭·에셋을 **공개** 라우트로 둔다 (`spec.md:104`)
- 코드:
  - 게이트웨이는 신원을 `Authorization` 헤더에서만 읽는다 (`gateway/.../AuthenticationGatewayFilter.kt:35-36`)
  - `sendBeacon` 은 헤더를 붙일 수 없다 (`portal-fe/src/analytics/tracker.ts:63-70`). 클릭은 브라우저 네비게이션(GET → 302)이라 역시 헤더가 없다
  - 필터 없는 공개 라우트는 클라이언트가 붙인 `X-User-Id` 를 그대로 넘긴다. 벗기는 쪽은 optional 필터뿐이다 (`AuthenticationGatewayFilter.kt:86-90`). 같은 함정이 `game/CLAUDE.md` 의 친구 그룹 사례에 적혀 있다
  - `vid` 쿠키에는 Domain 이 없어 호스트별로 따로 발급된다 (`gateway/.../VisitorIdFilter.kt:34-39`). 그래서 「방문자당 하루 빈도 제한」이 blog·place·deal·game 에서 서로 따로 센다
- 수정안:
  - 결정 요청(axios 라 헤더가 있다)에 optional 인증 필터를 건다. 요청자가 캠페인 소유자면 그 캠페인을 후보에서 빼거나, 토큰에 `self` 플래그를 서명해 넣는다
  - 이벤트·클릭 라우트도 optional 필터로 위조 헤더를 벗긴다
  - 빈도 제한이 호스트별로 갈리는 것은 수용한다고 적거나, `vid` 에 `.1989v.com` 도메인을 준다

### F6 — game HOUSE 소재가 새 Creative 규칙에 맞지 않고, 기존 순환이 깨진다 (체크 2)

- 스펙 결정: Creative 는 「이미지 1장 · 랜딩 URL `https` 만」 (`spec.md:36-37`). 결정 응답은 「HOUSE 대체 소재(있으면)」로 하나만 준다 (`spec.md:54`). 캠페인 빈도 제한 기본값은 하루 3회 (`spec.md:35`). E3 은 「흡수 전과 같은 크리에이티브 순환」을 요구한다 (`test-quality.md:49`)
- 코드:
  - 지금의 HOUSE 소재는 이모지 + 제목 + 문구 + **앱 내부 상대 경로**(`/`, `/shop`, `/portfolio`)이고 이미지가 없다 (`V6__ads_house.sql:44-52`)
  - FE 는 여러 소재를 6초마다 바꿔 보여 주고, SPA `Link` 로 이동한다 (`HouseBanner.tsx:19-39`)
  - 기존 빈도 정책은 BANNER 60초 간격·세션당 20회다 (`V6__ads_house.sql:37-41`)
- 영향: 이관 시드가 도메인 검증에 실패하거나 검증을 우회해야 한다. 하루 3회 제한이 걸리면 게임 목록 배너가 하루에 세 번 보인 뒤 사라진다
- 수정안: SR-3·SR-5·SR-13 에 아래를 명시한다
  - HOUSE 소재 형식: 이미지는 선택(이모지 허용), 랜딩은 상대 경로 허용, 클릭은 리다이렉트 없이 SPA 로 이동
  - HOUSE 응답은 소재 목록으로 준다
  - HOUSE 에는 빈도 제한을 적용하지 않거나 기존 60초 간격을 그대로 쓴다
  - `game-detail-banner` 는 FE 호출처가 없으므로 이관하지 않는다(Grep 결과 `GamesPage.tsx:249` 만 사용)

### F7 — 전환 순서에 FE 전환 시점과 롤백 경로가 없다 (체크 5)

- 스펙 결정: 「ads 기동 → 게이트웨이 → game 제거」 (`spec.md:108`)
- 코드:
  - 지금 FE 는 `GET /api/v1/ads/placements/{key}` 를 부른다 (`portal-fe/src/api/gameApi.ts:541`)
  - 게이트웨이를 먼저 넘기면 캐시된 옛 번들이 engagement 에서 404 를 받는다. FE 를 먼저 넘기면 content 에 `/decisions` 가 없어 404 가 난다
  - 어느 경우든 `catch → null` 로 끝나 배너가 조용히 사라진다 (`HouseBanner.tsx:14-16`)
  - 게이트웨이를 되돌리는 롤백도 FE 전환 뒤에는 같은 문제를 겪는다
  - game 마이그레이션은 현재 V72·V91 이 비어 있다(다른 세션이 번호를 잡고 있을 수 있다). 번호 경합과 적용 순서 함정이 `game/CLAUDE.md` Key Rules 에 적혀 있다
- 수정안: SR-13 에 아래를 추가한다
  - 한 릴리스 동안 engagement 가 옛 경로 `GET /api/v1/ads/placements/{key}` 에 호환 응답을 준다. 이렇게 하면 게이트웨이 롤백과 FE 롤백이 서로 독립된다
  - 또는 「ads → 게이트웨이 → FE → game 제거」 순서와 그 사이 배너 공백을 허용한다고 명시한다
  - game 표 DROP 은 코드 제거 이미지가 운영에 뜬 것을 태그와 `flyway_schema_history` 로 확인한 뒤 **별도 커밋**으로 올린다. 번호는 커밋 직전에 다시 확인한다

### F8 — 멱등과 갱신 유실 방지의 방법이 스펙에 없다 (체크 6)

- 스펙 결정: 「이미 더한 몫은 다시 더하지 않는다」 (`spec.md:71`). 「지갑 잔액 갱신은 … 갱신 유실이 없다」 (`spec.md:83`). 「청구액 = min(…, 지갑 잔액)」 (`spec.md:88`)
- 코드: 증분 반영 방식으로 구현하면, MySQL 커밋 뒤 Redis 에서 빼기 전에 프로세스가 죽을 때 같은 몫이 두 번 들어간다. 자연 멱등을 우선하는 원칙은 `idempotent-consumer.md` §2.1 에 있다
- 수정안: SR-7·SR-9·SR-10 에 방법을 고정한다
  - Redis 카운터 키를 시간 버킷 단위(캠페인×소재×지면×시각)로 두고, 플러시는 증분이 아니라 **절대값 UPSERT**(`ON DUPLICATE KEY UPDATE impressions = VALUES(impressions)`)로 한다. 재실행해도 값이 같다
  - 닫힌 시각의 키 TTL 은 정산이 늦어질 수 있는 최대 시간보다 길게 둔다
  - 지갑은 `SELECT … FOR UPDATE` 와 조건부 원자 UPDATE 중 하나로 정한다. `min()` 계산과 분개를 같은 트랜잭션, 같은 락 안에서 한다
  - 「하루」 경계(KST)를 SR-2 충전 한도뿐 아니라 Redis 일 지출 키와 정산에도 적용한다고 명시한다
  - 결정 경로의 지갑 여유는 「인덱스 스냅샷 잔액 − 그 광고주 캠페인들의 미정산 Redis 지출 합」으로 계산한다고 적는다. 충전은 인덱스 갱신까지 최대 1분 뒤에 반영된다

### F9 — `EntityType.AD` 가 없고, 이미 도는 소비자가 둘 있다 (체크 2, 비차단 — SR-14 는 OQ-001 로 보류)

- 스펙 결정: `entity_type=AD` 로 `analytics.event.collected` 에 발행한다 (`spec.md:111`)
- 코드:
  - `EntityType` 에 `AD` 값이 없다 (`common/.../analytics/EntityType.kt:10-19`)
  - 이 토픽은 analytics 와 recommendation 이 소비한다 (`ADR-0095-impression-click-pipeline.md:19`, `RecommendationEventConsumer.kt:31-36`)
  - 옛 common 으로 빌드된 소비자는 모르는 enum 값을 역직렬화하지 못한다. 그러면 메시지가 재시도를 거쳐 DLQ 로 간다
- 수정안: SR-14 에 순서를 적는다 — 「`EntityType.AD` 추가 → analytics·engagement 소비자 배포 확인 → 발행 토글 on」

### F10 — 참조와 수치 표기 보정 (체크 1, 경미)

- 가시 노출 기준값의 정의는 `tracker.ts` 가 아니라 `portal-fe/src/analytics/useImpression.ts:13-15` 에 있다(`VISIBLE_RATIO`·`DWELL_MS`). 광고 카드는 이 상수를 import 해서 쓴다고 적어야, 감지 규칙이 한 곳에서만 정의된다 (`spec.md:67,138`)
- 메모리 등급 변경의 실제 작업은 `kustomization.yaml:168-173` 의 S 패치를 **지우는 것**이다. 지우면 전역 `resources-reduce.yaml:23-24` 의 768Mi 가 적용된다. 이 한 줄을 SR-1 에 적는다

---

## 복잡도 (체크 3)

- 16개 SR 이 여섯 축에 걸친다: 폴드 배선 · 원장 · 결정 · 계측 · 콘솔 FE · 흡수 이관
- 조용히 깨지는 지점은 넷이다: 폴드 배선(F1·F2), Redis(F3·F4), 멱등(F8), 전환 순서(F7). 각각 별도 task group 으로 나누고 group 마다 게이트를 둔다
- 권장 순서: 폴드 골격·원장 → 결정 + HOUSE → 계측·정산 → 흡수 전환 → 콘솔·어드민 → analytics 합류(OQ-001)
- test-quality 의 회귀 주입 네 건은 적절하다. 여기에 두 건을 더한다
  - F2 한정자 누락 주입 — 쓰기가 사라지는지 확인
  - F3 Redis 정지 시 응답 시간 확인

## 요약

차단 사유는 없다. 스펙 결정이 코드와 정면으로 충돌하는 곳은 없고, 빠진 배선과 방법을 채우면 된다.

- 운영 사고로 이어질 수 있는 것: F1(스키마 부재 → 파드 전체 기동 실패), F3(Redis 타임아웃 부재 → 같은 JVM 동반 정지)
- 기능이 약속대로 동작하지 않는 것: F5(본인 과금 제외 불가), F6(HOUSE 순환 깨짐)

VERDICT: REVISE

---
---

# Round 2 — 개정 2 재검토 (2026-09-23)

- 대상: 개정 2 `spec.md` · `planning/test-quality.md`(개정 2) · `context/open-questions.yml` · ADR-0098
- 방법: round-1 F1~F10 해소 여부를 새 스펙 줄로 확인한 뒤, 개정이 새로 들인 결정(Redis 스크립트 1회 · `CF-Connecting-IP` 리미터 키 · 옛 `/placements` 호환 · AdSense `data-ad-status` 대체 · 미정산 지출 카운터 · 스케줄러)을 실제 코드와 대조했다

## Round-1 해소 확인

| # | 판정 | 근거(개정 2) | 남은 것 |
|---|---|---|---|
| F1 | 해소 | `spec.md:30-31`(ads_db·ads_user·configmap-init + 운영 1회 수동 SQL + 시크릿 선반영), OQ-003 확장(`open-questions.yml:23`) | 테스트 컨테이너의 `ads_db` 생성은 R2-8 로 |
| F2 | 해소 | `spec.md:23-24`(Wishlist 견본·TM 한정자·ads EMF `validate`·generateTopology), C1 값 확인 + 한정자 제거 회귀 주입(`test-quality.md:61,120`) | 설정 접두사 표기는 R2-8 로 |
| F3 | 해소 | `spec.md:32`(명령 250ms·연결 500ms), `:69`(요청당 Redis 1회), I4 「250ms 안에 반환」(`test-quality.md:41`) | 타임아웃 적용 범위는 R2-6 로 |
| F4 | 해소 | TTL 전부(`spec.md:101`) · 크롤러 결정 차단(`:63`) · 게이트웨이 리미터(`:92`) · 키 수 메트릭(`:149`) | 리미터 키 신뢰성은 R2-3 로 |
| F5 | 해소 | 결정 시점 본인 판정 + 토큰 `과금 여부` 서명(`spec.md:80-84`), 게스트 필터(`:83`), C3·C4(`test-quality.md:63-64`) | `vid` 호스트별 빈도 분리의 수용 여부 미기재 → R2-8 |
| F6 | 해소 | HOUSE 형식 분리·목록 응답·빈도 면제·detail 미이관(`spec.md:120-123`) | — |
| F7 | 해소 | 4단계 전환 + 호환 경로 + 별도 커밋 DROP(`spec.md:124-130`), I18(`test-quality.md:55`) | 3단계 이후 되돌리기 문장은 R2-8 로 |
| F8 | 해소 | 절대값 UPSERT·closed 행(`spec.md:98-99`), id 순 `FOR UPDATE`(`:107`), 멱등 키·min 식(`:108`), KST(`:41`) | 미정산 지출 카운터의 누적 오차는 R2-4 로 |
| F9 | 해소 | common 선배포 슬라이스 + recommendation 무시(`spec.md:142-143`) | — |
| F10 | 해소 | `spec.md:29`(S 패치 제거), `:87`(`useImpression.ts:13-15` import) | — |

게이트웨이 배포 순서도 다시 확인했다. engagement 는 sync-wave 9, gateway 는 20 이다(`k8s/overlays/oci-arm/kustomization.yaml:283-290,342-349`). 같은 커밋이어도 engagement 가 Healthy 가 된 뒤에야 라우트가 바뀌므로 `spec.md:126` 의 「ads 배포 + 게이트웨이」 동시 릴리스는 안전하다.

## 새 이슈

### R2-1 — 「Redis 요청당 한 번」에 채움 카운터 증가가 들어가 있어 그대로는 구현할 수 없다 (체크 4)

- 스펙 결정: `spec.md:69` — 스크립트 1회로 「빈도·일/시간 지출·미정산 지출 **조회** + 지면별 요청·**채움** 카운터 증가」
- 문제:
  - 채움 여부는 경매 결과다. 경매는 스크립트가 돌려준 값과 페이싱 난수(`spec.md:68`)로 Kotlin 에서 정한다. 조회와 같은 호출에서 채움을 올리려면 경매 전체(eCPM·pCTR·페이싱·같은 캠페인 두 지면 금지, `spec.md:64-68`)를 Lua 로 옮겨야 한다
  - 그렇게 하면 U4·U7(`test-quality.md:23,26`)이 재는 도메인 코드는 운영 경로가 아니게 된다. 테스트가 자기 사본을 재게 된다
  - 스크립트 키 수는 후보 캠페인 수에 비례한다(캠페인마다 빈도·일·시간 지출, 광고주마다 미정산). 후보 상한이 없다. 캠페인이 늘면 30ms 예산(`spec.md:71`)이 Redis 한 번 안에서 무너진다
- 수정안:
  - `spec.md:69` 를 「**읽기 1회**(스크립트 또는 MGET) + 결정 뒤 **쓰기 1회**(요청·채움 INCR 파이프라인, 응답을 기다리지 않음)」로 고친다. 쓰기가 실패해도 결정은 그대로 나간다(리포트 과소 집계만)
  - 경매는 Kotlin 도메인에 둔다고 명시한다
  - Redis 에 묻는 후보 수에 상한을 둔다. 예를 들면 지면마다 인덱스의 정적 자격(상태·기간·비율·최저가·카테고리)을 통과한 것 중 eCPM 상위 K개만 묻는다. 모두 탈락하면 `no_candidates` 로 끝낸다

### R2-2 — 「HOUSE 대체」 수는 서버가 알 수 없다 (체크 1)

- 스펙 결정: 지면 시간별 집계에 「요청·채움·대체(HOUSE) 수」(`spec.md:100`), 퍼블리셔 리포트 「HOUSE 대체율」(`spec.md:116`)
- 문제:
  - 유료 광고가 없을 때 AdSense 로 갈지 HOUSE 로 갈지는 FE 가 정한다(`spec.md:134-135`). 서버가 아는 것은 「유료 없음 + HOUSE 목록을 줬다」까지다
  - AdSense 가 채운 경우와 HOUSE 가 보인 경우를 서버 카운터로 가를 수 없다. `game-list-banner` 는 HOUSE 전용이라 이 값이 항상 100% 가 된다
- 수정안: 둘 중 하나를 고른다
  - FE 가 최종 채움 출처(`paid|adsense|house|hidden`)를 이벤트 묶음에 비과금 항목으로 실어 보낸다. 토큰이 없으니 과금 경로와 분리된 카운터로 센다
  - 또는 지표 이름을 「유료 미채움률」로 바꾸고 HOUSE 대체율은 1단계 범위에서 뺀다

### R2-3 — `CF-Connecting-IP` 리미터 키는 `rt.1989v.com` 으로 위조된다 (체크 4)

- 스펙 결정: `spec.md:92` — ads 공개 라우트 리미터 키를 `remoteAddress` 대신 `CF-Connecting-IP` 로 한다
- 코드:
  - `commerce-rt` Ingress 는 `rt.1989v.com` 의 `/` 전체를 gateway 로 보낸다. Cloudflare 프록시를 끈 host 다(`k8s/overlays/oci-arm/ingresses/commerce-platform.yaml:264-283`)
  - AOP(mTLS)는 `commerce-proxied` 에만 걸리고 rt 는 의도적으로 빠져 있다(`k8s/overlays/oci-arm/origin-lockdown/aop-patch.yaml:11-12`, `kustomization.yaml:63-64`)
  - 그러면 `https://rt.1989v.com/api/v1/ads/events` 에 요청마다 다른 `CF-Connecting-IP` 를 붙여 매번 새 버킷을 받을 수 있다. Cloudflare WAF·Bot Fight 도 함께 우회된다
  - 지금 리졸버는 헤더를 읽지 않는다(`gateway/.../RateLimiterConfig.kt:14-30`). 새 리졸버를 쓰는 것이니 폴백 규칙도 새로 정해야 한다. k3s-lite 는 Cloudflare 가 없어 헤더가 비고, 폴백이 ingress 파드 IP 하나면 전원이 한 버킷을 쓴다
- 수정안: SR-9 에 아래를 명시한다
  - `CF-Connecting-IP` 는 proxied host 로 들어온 요청일 때만 믿는다. rt host 에서는 헤더를 벗기거나(ingress `configuration-snippet`) rt Ingress 경로를 `/ws`·`/sse` 로 좁힌다. 후자는 ads 밖 변경이라 선택지로만 적고 결정은 사용자에게 묻는다
  - 헤더가 없을 때의 폴백은 `X-Forwarded-For` 첫 값으로 한다. 로컬 전용이라고 적는다
  - C3(`test-quality.md:63`)에 「rt host + 위조 헤더」 사례를 더한다

### R2-4 — 광고주 미정산 지출 카운터는 오차가 쌓이고 스스로 복구되지 않는다 (체크 6)

- 스펙 결정: 지갑 여유 = 스냅샷 잔액 − Redis 광고주 미정산 지출(`spec.md:65`). 정산 커밋 뒤 그 값을 줄이고, 그 사이에 죽으면 「게재가 일찍 멈출 뿐」(`spec.md:110`). 지출·카운터 TTL 48시간(`spec.md:101`)
- 문제:
  - 이 키는 광고주마다 하나인 누적 카운터다. 노출이 들어올 때마다 쓰이니 TTL 을 쓰기마다 갱신하면 활동 중인 광고주의 키는 만료되지 않는다. 갱신하지 않으면 48시간째에 진행 중인 지출이 통째로 사라진다. 어느 쪽이든 틀린다
  - 커밋 뒤 감소 전에 파드가 죽으면 그 몫은 영구히 남는다. 롤링 배포(`rolling-surge-first`)와 OOM 재시작은 드물지 않다. 오차는 사고마다 쌓이고 광고주의 게재 가능 잔액이 계속 줄어든다
  - 감소 연산은 재실행하면 두 번 빠진다. SR-10 의 절대값 원칙(`spec.md:98`)과 반대 모양이다
- 수정안: 미정산 지출을 별도 카운터로 두지 않고 **이미 있는 시각 키에서 계산**한다
  - 「미정산 지출 = 정산되지 않은 시각들의 캠페인×시각 지출 키 합」으로 정의한다
  - 정산된 시각 목록은 인덱스 갱신(1분)이 DB 에서 함께 읽는다
  - 그러면 감소 연산이 없어지고, 크래시와 재실행이 값을 바꾸지 않는다. 키 수는 광고주 캠페인 수 × 최대 2~3시각이라 R2-1 의 읽기 한 번 안에 들어간다

### R2-5 — AdSense 가 상태를 끝내 안 적으면 HOUSE 로 내려가지 않는다 (체크 4)

- 스펙 결정: 「AdSense 가 `data-ad-status="unfilled"` 이면 HOUSE 로 내려간다」(`spec.md:135`), F1 테스트(`test-quality.md:70`)
- 코드:
  - 지금 `AdSlot` 은 `push({})` 만 하고 결과를 보지 않는다(`portal-fe/src/components/ads/AdSlot.tsx:45-53`). 상태 감지는 새로 짜야 한다
  - `data-ad-status` 는 AdSense 스크립트가 받아져 실행된 뒤에만 적힌다. 광고 차단기·스크립트 로드 실패·심사 전 계정에서는 속성이 끝내 생기지 않는다
  - 그러면 「광고」 라벨이 붙은 빈 상자가 `minHeight` 만큼 남는다(`AdSlot.tsx:61-67`). 개발자 독자가 많은 blog 지면에서 차단기 비율이 높을 가능성이 크다
- 수정안: SR-14 에 아래를 명시한다
  - `MutationObserver` 로 `data-ad-status` 를 기다리고, 제한 시간(예: 3초) 안에 `filled` 가 아니면 unfilled 로 본다
  - F1 에 「상태 속성이 끝내 안 생김(스크립트 차단)」 사례를 더한다

### R2-6 — Redis 250ms 타임아웃이 engagement 전체에 걸린다 (체크 4, 경미)

- 스펙 결정: 「engagement Redis 명령 타임아웃 250ms」(`spec.md:32`)
- 코드:
  - engagement 는 `spring.data.redis` 연결 하나를 recommendation 과 같이 쓴다(`engagement/app/src/main/resources/application.yml:30-34`)
  - recommendation 동기화는 큰 ZSet 을 `delete` 하고 `rename` 으로 바꾼다(`ItemSimilaritySync.kt:69,88`, `CbScoreSync.kt:55,60`). `RENAME` 은 덮이는 옛 키를 동기로 지우므로 원소 수에 비례해 오래 걸린다. 250ms 를 넘으면 동기화가 실패한다
- 수정안: ads 전용 `LettuceConnectionFactory`·`StringRedisTemplate`(한정자)을 두고 짧은 타임아웃은 그 연결에만 건다. 공유 연결은 common 클러스터 모드와 같은 2초로 둔다

### R2-7 — 스케줄러 스레드가 하나라 인덱스 갱신 1분 약속이 밀린다 (체크 6, 경미)

- 스펙 결정: ads 가 `@EnableScheduling` 을 켠다(`spec.md:26`). 인덱스 1분 이하(`:71`), 정지 광고주 1분 안에 제외(`:37`), 5분 집계(`:98`), 매시 정산(`:108`), 매일 원장 검사(`:112`)
- 코드: Spring 기본 스케줄러는 스레드 1개다. common 의 `IdempotentEventCleanupScheduler`·`OutboxPollingPublisher`(`common/.../IdempotentEventCleanupScheduler.kt:22`, `OutboxPollingPublisher.kt:31`)가 켜져 있으면 그 스레드도 같이 쓴다. 정산이나 원장 합 검사가 길어지면 그동안 인덱스 갱신이 멈춘다
- 수정안: `spring.task.scheduling.pool.size` 를 2 이상으로 두거나, 인덱스 갱신을 전용 스케줄러로 뺀다고 적는다

### R2-8 — 표기·잔여 보정 (체크 1·5, 경미)

- 설정 접두사: `spec.md:24`·`test-quality.md:14` 는 `ads.datasource` 다. 견본을 포함한 폴드 도메인 전부가 `spring.datasource.{domain}` 을 쓴다(`WishlistDataSourceConfig.kt:36,40`, `GameDataSourceConfig.kt:38`, `BlogDataSourceConfig.kt:40`). `spring.datasource.ads` 로 맞춘다
- 테스트 스키마: `EngagementContextLoadSpec` 컨테이너는 `experiment_db` 만 만든다(`EngagementContextLoadSpec.kt:95,107-110`). ads Flyway 가 experiment_db 에 섞이지 않도록 C1 에 「컨테이너에 `ads_db` 생성」을 적는다(round-1 F1-5 잔여)
- 되돌리기 범위: `spec.md:129` 「4 전까지 되돌리기는 게이트웨이 하나」는 2~3 사이에만 맞다. 3(FE 전환) 뒤에 게이트웨이만 되돌리면 새 FE 의 `/decisions` 가 content 에서 404 가 난다. HOUSE 목록도 그 응답에 실려 오므로 HOUSE 전용인 `game-list-banner` 가 사라진다. 「3 이후는 FE 도 함께 되돌린다」를 한 줄 더한다
- 빈도의 호스트 분리: `vid` 쿠키는 Domain 없이 호스트별로 발급된다(`gateway/.../VisitorIdFilter.kt:34-39`). 「방문자당 하루 N회」(`spec.md:44`)는 실제로는 「호스트당」이다. 수용한다는 한 줄을 SR-6 에 적는다(round-1 F5 잔여)

## 체크리스트 판정 (Round 2)

| # | 항목 | 판정 | 이슈 |
|---|---|---|---|
| 1 | 참조한 클래스·모듈이 있는가 | 통과. 지표 하나는 원천이 없다 | R2-2 · R2-8 |
| 2 | 기존 코드와 충돌하지 않는가 | 통과 | — |
| 3 | 복잡도 위험을 짚었는가 | 통과. task group 분할은 tasks 단계 몫 | — |
| 4 | NFR 안티패턴이 없는가 | 4건 | R2-1 · R2-3 · R2-5 · R2-6 |
| 5 | 마이그레이션·롤백 전략이 있는가 | 통과. 문장 보정 1 | R2-8 |
| 6 | 동시성 안전을 고려했는가 | 1건 + 경미 1 | R2-4 · R2-7 |

## 요약 (Round 2)

round-1 의 F1~F10 은 모두 해소됐다. 개정이 새로 들인 결정 네 곳에서 새 이슈가 나왔다. 스펙 결정이 코드와 정면으로 부딪치는 곳은 없어 BLOCK 은 아니다.

- 구현하면 바로 막히는 것: R2-1(스크립트 1회에 채움 증가는 경매를 Lua 로 옮기지 않고는 불가)
- 약속한 방어·지표가 조용히 무력해지는 것: R2-3(rt host 로 리미터 우회), R2-5(차단기 환경에서 빈 광고 상자), R2-2(HOUSE 대체율 원천 없음)
- 시간이 지나며 틀어지는 것: R2-4(미정산 카운터 누적 오차)
- 나머지(R2-6·R2-7·R2-8)는 한 줄씩 보정하면 된다

VERDICT: REVISE

---
---

# Round 3 — 개정 3 최종 재검토 (2026-09-23)

- 대상: 개정 3 `spec.md` · `planning/test-quality.md`(개정 3) · `context/open-questions.yml` · ADR-0098
- 방법: R2-1~R2-8 해소를 개정 3 의 줄로 확인한 뒤, 개정 3 이 새로 들인 결정 넷(게이트웨이 Host 조건 · ads 전용 Redis 연결 · 스케줄러 풀 4 · 수락 스크립트의 예산 확인)이 실제 코드에서 성립하는지 대조했다. 마지막 라운드라 **구현 중 고칠 수 있는 것은 이월 항목**으로만 적는다

## Round-2 해소 확인

| # | 판정 | 근거(개정 3) |
|---|---|---|
| R2-1 | 해소 | `spec.md:72` 읽기 1회(eCPM 상위 20개만) + 결정 뒤 쓰기 파이프라인 1회, 쓰기 실패는 경고만. 경매는 도메인 테스트 U5·U8(`test-quality.md:25,28`)이 잰다 |
| R2-2 | 해소 | FE 가 최종 채움 출처를 보고(`spec.md:96`), 참고 열로 적재(`:108`), 리포트는 「유료 채움률」 + 참고치 표기(`:124`) |
| R2-3 | 해소 | ads 공개 라우트에 Host 조건, rt 제외(`spec.md:92`), C4·E6(`test-quality.md:74,101`). 성립 확인은 아래 「새 결정 검증」 |
| R2-4 | 해소 | (광고주, KST 시각) 키 + 스냅샷 「정산 완료 시각」 이후 합, 차감 연산 없음(`spec.md:68,103,118`), U17(`test-quality.md:37`) |
| R2-5 | 해소 | 3초 무응답이면 HOUSE(`spec.md:142`), F1 에 무응답 사례(`test-quality.md:84`) |
| R2-6 | 해소(의도) | ads 전용 연결만 250ms, 공용은 그대로(`spec.md:33`). 빈 등록 방식은 이월 N3-1 |
| R2-7 | 해소 | 스케줄러 풀 4, `ads.scheduling.enabled` 토글(`spec.md:26`) |
| R2-8 | 해소 | 접두사 `spring.datasource.ads`(`spec.md:24`, `test-quality.md:15`) · 테스트 `ads_db` 별도 생성(`test-quality.md:13`) · 3 이후 FE 동반 되돌리기(`spec.md:137`) · 빈도 호스트 단위 수용(`spec.md:65`) |

## 새 결정 검증

- **Host 조건**: 성립한다
  - 게이트웨이는 `RouteLocatorBuilder` DSL 이다(`gateway/.../GatewayRouteConfig.kt:7,74`). 라우트마다 `host(...)` 조건을 걸 수 있다. 지금 쓰는 곳은 없다
  - FE 는 상대 경로로 호출한다(`portal-fe/src/shell/apiClient.ts:13`, `portal-fe/Dockerfile:29` `VITE_API_URL=""`). 그래서 게이트웨이가 받는 Host 는 페이지 호스트다
  - ingress 에 `upstream-vhost` 같은 Host 재작성이 없다(k8s 전체 Grep 0건). 원래 Host 가 그대로 도착한다
  - 원 IP 에 SNI 는 rt 로, Host 는 blog 로 보내는 우회는 proxied host 쪽 AOP(mTLS) 검증에서 막힌다
- **스케줄러 풀 4**: 성립한다. 레포에 사용자 정의 `TaskScheduler`·`SchedulingConfigurer` 가 없다(common·recommendation·experiment·engagement Grep). 그래서 Boot 자동 구성 스케줄러에 `spring.task.scheduling.pool.size` 가 먹는다. 가상 스레드 설정도 없다
- **수락 스크립트의 예산 확인**: 일예산·시간당 상한은 Redis 의 캠페인 일·시각 지출 키만으로 판정할 수 있다. 총예산은 입력 하나가 더 필요하다 → 이월 N3-3
- **ads 전용 Redis 연결**: 빈으로 등록하면 공용 연결이 사라진다 → 이월 N3-1

## 이월 항목 (tasks 작성 때 반영)

### N3-1 — ads 전용 Redis 연결을 스프링 빈으로 두면 recommendation 이 그 연결을 받는다 (체크 2·4, tasks 필수)

- 스펙 결정: 「ads 만 250ms … 공용 연결은 건드리지 않는다」(`spec.md:33`)
- 코드:
  - engagement 는 standalone 이다(`engagement/app/src/main/resources/application.yml:30-34`). common 자동 구성은 클러스터 전용이라 여기서는 꺼져 있다(`common/.../CommonRedisAutoConfiguration.kt:21`). 그래서 공용 연결과 템플릿은 Boot 자동 구성이 만든다
  - Boot 의 연결 팩토리는 `RedisConnectionFactory` 빈이 **하나도 없을 때만** 생긴다. `stringRedisTemplate` 도 `StringRedisTemplate` 빈이 없고 팩토리가 단일 후보일 때만 생긴다
  - recommendation 은 `StringRedisTemplate` 을 한정자 없이 타입으로 받는다. 6곳이다(`ItemSimilaritySync.kt:26` · `CbScoreSync.kt:25` · `RedisRecommendationAdapter.kt:23` · `RedisItemSimilarityAdapter.kt:18` · `BanditPolicy.kt:30` · `RedisThompsonSampler.kt:23`)
- 영향: ads 가 `@Bean LettuceConnectionFactory`·`@Bean StringRedisTemplate` 을 한정자만 달아 등록하면 Boot 의 공용 빈이 조용히 물러난다. 그러면 recommendation 이 250ms 연결을 받아 R2-6 이 그대로 재현된다. 팩토리가 둘이 되면 템플릿이 아예 안 생겨 recommendation 이 기동하지 못한다
- 이월 수정: 둘 중 하나로 고정한다
  - ads 연결은 빈으로 노출하지 않는다. ads Redis 어댑터가 내부에서 만들고 닫는다
  - 또는 engagement 에 공용 팩토리·템플릿을 명시 선언하고 `@Primary` 를 단다
- 검증: C1 에 「recommendation 이 받은 `StringRedisTemplate` 의 연결이 ads 연결과 다른 인스턴스이고 명령 타임아웃이 250ms 가 아님」을 값으로 확인하는 항목을 더한다

### N3-2 — Host 조건의 호스트 목록을 환경별 설정으로 둔다 (체크 5)

- 운영 호스트는 `k8s/overlays/oci-arm/ingresses/commerce-platform.yaml:69-278` 에 있다. `rt` 가 `*.1989v.com` 에 들어가므로 와일드카드로 쓸 수 없고 목록으로 적어야 한다(blog·place·deal·game 과 지면이 있는 호스트)
- k3s-lite 는 이 호스트들이 없다. 목록을 코드에 박으면 로컬에서 ads 공개 라우트가 전부 404 가 난다
- 이월 수정: 목록을 게이트웨이 프로퍼티로 빼고 overlay 별로 값을 준다. C4 는 목록에 rt 가 없고 지면 호스트가 전부 있는지 확인한다

### N3-3 — 수락 스크립트의 총예산 확인에 필요한 입력을 적는다 (체크 6)

- 스펙 결정: 수락 스크립트가 「캠페인 일예산·시간당 상한·총예산」을 확인한다(`spec.md:97`)
- 문제: 총예산 판정은 「청구 누계 + 미정산 지출」이다(`spec.md:47`). 청구 누계는 MySQL 에만 있어서 Lua 는 알 수 없다
- 이월 수정: 이벤트 처리 쪽이 인덱스 스냅샷에서 「총예산 − 청구 누계」와 캠페인 정산 완료 시각 이후의 시각 키 목록을 스크립트 인자로 넘긴다고 적는다. 스냅샷이 최대 1분 늦어서 생기는 초과분은 정산의 `min()`(`spec.md:116`)이 잘라낸다. 이 점도 한 줄로 적는다

### N3-4 — 스케줄링이 outbox 토글에 걸려 있다 (체크 6, 경미)

- `@EnableScheduling` 은 `outbox.polling.enabled`(기본 true)가 조건인 자동 구성에서만 켜진다(`common/.../KgdMessagingOutboxAutoConfiguration.kt:39-45`). 누가 이 토글을 끄면 ads 인덱스 갱신·정산이 오류 없이 멈춘다
- 이월 수정: ads 설정 클래스에도 `@EnableScheduling` 을 선언한다(중복 선언해도 후처리기는 하나라 무해하다). 또는 「인덱스 갱신 시각」 메트릭(`spec.md:157`)에 지연 경보를 건다

## 체크리스트 판정 (Round 3)

| # | 항목 | 판정 | 이슈 |
|---|---|---|---|
| 1 | 참조한 클래스·모듈이 있는가 | 통과 | — |
| 2 | 기존 코드와 충돌하지 않는가 | 통과. 빈 등록 방식은 이월 | N3-1 |
| 3 | 복잡도 위험을 짚었는가 | 통과 | — |
| 4 | NFR 안티패턴이 없는가 | 통과 | — |
| 5 | 마이그레이션·롤백 전략이 있는가 | 통과. 환경별 설정 이월 | N3-2 |
| 6 | 동시성 안전을 고려했는가 | 통과. 입력 명시 이월 | N3-3 · N3-4 |

## 요약 (Round 3)

R2-1~R2-8 은 모두 해소됐다. 개정 3 의 새 결정 넷도 실제 코드에서 성립한다. 남은 것은 구현 방식을 한 줄씩 고정하면 되는 이월 4건이다.

- tasks 에 반드시 넣을 것: N3-1. 놓치면 recommendation 이 조용히 250ms 연결을 받거나 기동에 실패한다. C1 에 값 확인 항목을 함께 넣는다
- 나머지: N3-2(Host 목록 환경별) · N3-3(총예산 인자) · N3-4(스케줄링 선언)

VERDICT: SHIP
