# Task Breakdown: 광고 네트워크 (ads)

## Overview
Total Task Groups: 13

스펙 `spec.md`(개정 3.1) · 테스트 계획 `planning/test-quality.md` · ADR-0098.
3차 리뷰 이월 항목은 해당 그룹에 `[이월 출처]` 로 붙였다 — 원문 `context/engineer-review-*.md` Round 3.

표준: `docs/standards/new-domain-checklist.md` · `docs/conventions/package-structure.md`(ADR-0083) · `docs/standards/test-rules.md` · `docs/conventions/transactional-usage.md` · `docs/conventions/jpa-persistence.md` · `docs/conventions/logging.md` · `docs/conventions/kotlin-style.md` §1(최소 수정) · `docs/standards/fe-visual-verification.md` · `DESIGN.md`.

릴리스 경계(SR-14): **R1** = 그룹 1 (common) · **R2** = 그룹 0·2~8·12 (ads + 게이트웨이 + 호환 경로) · **R3** = 그룹 9~11 (FE 전환) · **R4** = 그룹 13 (game ads 제거). 각 릴리스는 앞 릴리스가 운영에서 확인된 뒤에 올린다.

검증 명령은 **바꾼 테스트만** 지정한다(전체 스위트는 verifier 몫, usage 게이트).

테스트 수는 약 55개로 hns 권장(16–34)을 넘는다. 돈·일회성·차단 경로(★)가 이 기능의 대부분이고, 3라운드 리뷰가 그 경로마다 조용히 틀리는 자리를 짚었기 때문이다 — 줄이면 회귀 주입 대상이 사라진다.

---

### Task Group 0: 운영 사전 조건 (수동)
**Dependencies:** None
**Phase:** R2-pre
**Required Skills:** k8s, mysql, sealed-secrets
- [x] 0.0 Complete 운영 사전 조건
  - [x] 0.1 노드 여유 확인: `kubectl top node` · engagement 현재 사용량 — 768Mi 가 들어가는지 (OQ-002). 부족하면 증설이 아니라 동시성 축소안으로
  - [x] 0.2 운영 MySQL 에 1회 수동 SQL — `ads_db`·`ads_user`·GRANT (place_db 선례 `a599d857` 절차). 실행 전 대상 인스턴스·SQL 을 사용자에게 보여 주고 승인
  - [x] 0.3 SealedSecret `ADS_TOKEN_SECRET`(32바이트 이상 난수) 생성·커밋 준비
  - [x] 0.4 Cloudflare DNS `ads.1989v.com` proxied 레코드 (사용자 수행) — 2026-09-24 등록, `curl -sI https://ads.1989v.com/` 200 · `x-robots-tag: noindex, nofollow` · 미로그인 시 apex 로그인(`next=`)으로 이동
  - [x] 0.5 Verify: `oci-mysql -e "SHOW DATABASES LIKE 'ads_db'; SHOW GRANTS FOR 'ads_user'@'%';"` · `kubectl get secret -n commerce ads-token -o jsonpath='{.data}' | jq 'keys'` · `dig +short ads.1989v.com`
> 수행 기록(2026-09-24): `ssh msa-oci` 로 운영 MySQL SQL·`ads-token` 생성·노드 여유 확인(57%) — DNS(0.4)는 콘솔 공개 전 사용자 몫으로 남음
**Acceptance Criteria:**
- 스키마·계정·시크릿 셋이 클러스터에 있다 (OQ-003) — 그룹 2 이미지 배포의 선행 조건

### Task Group 1: common 슬라이스 (R1)
**Dependencies:** None
**Phase:** R1
**Required Skills:** kotlin, kafka

> 착수 시 확인(2026-09-23): `origin/main` 에 ADR-0095 가 이미 착지해 있었다(`5302b893`) — `CrawlerUserAgents` 는 `common/web` 에 있고 analytics·game 이 쓰며, recommendation 소비자는 `PRODUCT` 외 대상을 이미 건너뛴다(`RecommendationEventConsumer.kt:48`). 공유 워킹트리의 로컬 main 이 211 커밋 뒤처져 미커밋처럼 보였을 뿐이다. 남은 일은 `EntityType.AD` 하나. OQ-001 해소.

- [x] 1.0 Complete common 슬라이스
  - [x] 1.1 테스트: recommendation 소비자가 `entity_type=AD` 클릭(상품 payload 포함)을 추천 신호로 쓰지 않는다
  - [x] 1.2 ~~`CrawlerUserAgents` 이동~~ — 이미 `common/web` 에 있음
  - [x] 1.3 `EntityType.AD` 추가 (ClickHouse `entity_type` 은 `LowCardinality(String)` 이라 스키마 변경 불필요, 전 값을 다루는 `when` 없음)
  - [x] 1.4 ~~recommendation 소비자에서 AD 무시~~ — 이미 `PRODUCT` 외 무시
  - [x] 1.5 Verify: `./gradlew :common:test --tests '*AnalyticsEventTest*' :recommendation:feature:test --tests '*RecommendationEventConsumerTest*'` → 8/0 · 4/0
**Acceptance Criteria:**
- 전 JVM 이미지가 이 슬라이스로 재빌드되고 운영에서 analytics·recommendation 이 정상 (배포 후 확인)

### Task Group 2: ads 모듈 골격과 폴드 배선
**Dependencies:** Task Group 1
**Phase:** R2
**Required Skills:** gradle, spring-boot, jpa, flyway, redis
- [x] 2.0 Complete 모듈·폴드
  - [x] 2.1 테스트 4개:
    - `EngagementContextLoadSpec` 확장 — ads 컨트롤러 빈 등록 + **충전 진입점 호출 뒤 잔액 재조회 = 충전액** (C1, 값 판정)
    - 같은 스펙 — recommendation 이 주입받은 Redis 연결의 명령 타임아웃이 250ms 가 **아니다** [arch C-2 · impl N3-1]
    - 같은 스펙 — ads 스케줄 작업 빈이 등록돼 있다(`outbox.polling.enabled` 와 무관) [arch C-3 · impl N3-4 · test C-3]
    - `AdsSchemaIntegrationSpec` — Flyway 스키마 = 엔티티(`validate`) (C2) · 시크릿 없음/31바이트 → 기동 실패 (C3)
  - [x] 2.2 `settings.gradle.kts` 에 `:ads:domain`·`:ads:feature`, `engagement/app/build.gradle.kts` 의존, `EngagementApplication.scanBasePackages` 에 `com.kgd.ads`
  - [x] 2.3 `AdsDataSourceConfig` — `WishlistDataSourceConfig` 모양, prefix `spring.datasource.ads`, `adsTransactionManager`, `ScopedFlywayMigrator(classpath:adsdb/migration)`, EMF `ddl-auto=validate`
  - [x] 2.4 ads 전용 Redis 연결 — **스프링 빈으로 노출하지 않는다**(ads 내부 컴포넌트가 직접 생성·보유). 공용 `StringRedisTemplate` 자동 구성이 물러나지 않게 [arch C-2 · impl N3-1]
  - [x] 2.5 ads 설정에 `@EnableScheduling` 을 직접 선언(outbox 토글 의존 제거) + `ads.scheduling.enabled` 조건 + engagement `spring.task.scheduling.pool.size: 4` [arch C-3]
  - [x] 2.6 `adsdb/migration/V1__ads.sql` — 광고주(종류)·캠페인·소재·지면(**`paid_allowed` 속성**)·문맥 카테고리·매핑·시간별 집계 두 표·원장 계정·거래·분개·정산 기록. 시드: 지면 4개(`deal-hub-end` 없음), SYSTEM 광고주, HOUSE 캠페인·소재 3종(`V6__ads_house.sql:45` 의 game-list-banner 내용) [domain C1 · usecase C1]
  - [x] 2.7 `EngagementContextLoadSpec` 컨테이너 init 에 `ads_db` 별도 생성, 테스트 properties 에 `ADS_TOKEN_SECRET`·`spring.datasource.ads.*`·Redis 컨테이너(`GenericContainer("redis:7")`)
  - [x] 2.8 Verify: `./gradlew :engagement:app:test --tests '*EngagementContextLoadSpec*' --tests '*AdsSchemaIntegrationSpec*' :engagement:app:check`
> 구현 기록(2026-09-23): 컨트롤러는 그룹 7 몫이라 C1 은 유스케이스 빈 3종으로 검사 · `LedgerPort.post` 는 `MANDATORY` 전파라 한정자 결함이 예외로 드러난다 · 스키마에 `ad_host_category`(호스트 기본 카테고리)·`ad_unregistered_placement`(미등록 지면 누적) 추가 · 지면 시드 값(비율 1.91:1, 최저가 100,000 마이크로)은 임시 — 어드민에서 조정 · 회귀 주입 6종 빨간불 확인
**Acceptance Criteria:**
- 폴드 게이트(`build.gradle.kts:701-731`, `:835`)·`verifyPodTopology` 통과, recommendation·experiment 컨텍스트 테스트 불변

### Task Group 3: 도메인 모델 (`:ads:domain`)
**Dependencies:** Task Group 2
**Phase:** R2
**Required Skills:** kotlin, ddd
- [x] 3.0 Complete 도메인
  - [x] 3.1 테스트 8개(★ 위주): `LedgerTransactionTest`(U1) · `SettlementCalculatorTest`(U2) · `RevenueSplitTest`(U3) · `ChargeAmountTest`(U4 + **CPM 최저가 < 1000 마이크로 저장 거부** [test C-2]) · `AuctionTest`(U5·U6·U7) · `CampaignTest`(U9·U10 + HOUSE 는 SYSTEM 전용 팩토리로만, 입찰·예산 필드 없음 [domain C3]) · `ServeTokenTest`(U14) · `WalletHeadroomTest`(U17)
  - [x] 3.2 Advertiser(`MEMBER`·`SYSTEM`)·Campaign(파생 우선순위, 파생 게재 자격)·Creative(`revise()`)·AdPlacement(`paidAllowed`)·ContextCategory
  - [x] 3.3 원장: `LedgerTransaction` 팩토리(합 0 강제, 생성자 비공개)·`REVERSAL` 은 SETTLEMENT 전액만
  - [x] 3.4 경매·pCTR·페이싱(난수·Clock 주입)·1회 과금액·청구액 계산·수익 배분
  - [x] 3.5 토큰 서명/검증(HMAC-SHA256, `MessageDigest.isEqual`, 키 id, 32바이트 최소)
  - [x] 3.6 HOUSE 링크 검증 `^/(?![/\\])` + **제어 문자·공백 거부** [sec CO-3] · 랜딩 URL 검증
  - [x] 3.7 Verify: `./gradlew :ads:domain:test`
> 구현 기록(2026-09-23): 9개 스펙 75건. 테스트 클래스는 ChargeAmountTest→`Bid`, ServeTokenTest→`ServeTokenSigner` 를 검사. 토큰 형식 `base64url(내용).base64url(서명)`, 키 id = 키 SHA-256 앞 4바이트 hex. 회귀 주입 U1·U3 빨간불 확인. 열린 질문 셋은 key-decisions 로 정리 — 반영은 그룹 4 에서
**Acceptance Criteria:**
- 도메인 모듈에 Spring/JPA 의존 0, 회귀 주입 U1·U3 빨간불 확인(그룹 12)

### Task Group 4: 후보 인덱스·결정·토큰 발급
**Dependencies:** Task Group 3
**Phase:** R2
**Required Skills:** spring, redis-lua
- [x] 4.0 Complete 결정
  - [x] 4.1 테스트 5개: ★I4(Redis 정지 → `redis_unavailable`, 1초 안) · ★I8(차단 경로 넷 + **빈도 N−1/N 경계** [test C-1]) · I9(인덱스 갱신 직접 호출 — 승인·정지·반려 반영) · I10(크롤러 → ads Redis 명령 0) · I11(미등록 키 누적) · C6(소유자 `X-User-Id` → 토큰 과금 여부 false)
  - [x] 4.2 인덱스 스냅샷: 활성 후보·지면·매핑·광고주별 잔액·「정산 완료 시각」·캠페인별 **청구 누계** — 1분 주기
  - [x] 4.3 `POST /api/v1/ads/decisions` — 자격 필터 → eCPM 상위 20 → Redis 읽기 1회(빈도·일/시간 지출·(광고주, 시각) 지출 합) → 경매·페이싱 → 토큰 → Redis 쓰기 1회(지면 요청·유료 채움) → HOUSE 목록. `paid_allowed=false` 지면은 유료 후보 없음 [domain C1]
  - [x] 4.4 미정산 6시간 초과 광고주 제외
  - [x] 4.5 메트릭(결정 지연·결과·인덱스 갱신 시각), 방문자 id 해시 로깅
  - [x] 4.6 Verify: `./gradlew :ads:feature:test --tests '*DecisionIntegrationSpec*' --tests '*CandidateIndexIntegrationSpec*'`
> 구현 기록(2026-09-23): 쓰기는 파이프라인 대신 Lua 1회(파이프라인이 결정마다 새 연결을 열었다) · 소재 비율은 이미지 가로·세로로 `AspectRatio.fits` 판정 — 그룹 7 업로드도 같은 함수 · 통합 스펙은 `:ads:feature` 전용 컨텍스트 · Redis 명령 수는 서버 `INFO commandstats`, DB 무접근은 MySQL `Com_*` 증감으로 판정(대조군 포함) · 회귀 주입 8건 빨간불
**Acceptance Criteria:**
- AC-5·AC-7·AC-9b(서비스 단)·AC-15, 결정 경로에 DB 호출 0 (테스트에서 JPA 호출 수 0 확인)

### Task Group 5: 이벤트 수락·클릭·에셋
**Dependencies:** Task Group 4
**Phase:** R2
**Required Skills:** spring, redis-lua
- [x] 5.0 Complete 계측
  - [x] 5.1 테스트 6개: ★I1(중복) · ★I7(토큰 몰아 제출 → `over_budget`) · I12(클릭 5경우 + 헤더) · I14(부분 수락) · I15(`PTTL` ≥ 남은 수명) · I23(에셋 헤더)
  - [x] 5.2 수락 Lua 스크립트 1회: 일회성 표식·방문자 해시·일예산·시간당 상한·**총예산(인자로 넘긴 스냅샷의 「총예산 − 청구 누계」와 미정산 시각 키 목록)** [domain C2 · impl N3-3] → 카운터 증가(수락 시각 KST 키)
  - [x] 5.2b 미등록 지면 키 해시(`ads:unreg:{시각}`)에 시각당 필드 200개 상한 (결정 경로 스크립트)
  - [x] 5.3 `POST /api/v1/ads/events` — 토큰 묶음 + analytics 신원 + 최종 채움 출처. **채움 출처는 허용 값 4종·지면 키는 등록부에 있는 것만 카운트, 요청당 개수 상한** [sec CO-1]
  - [x] 5.4 `GET /api/v1/ads/click/{token}` — 목적지 DB 조회, 서명 불량·미승인 → `/`
  - [x] 5.5 `GET /api/v1/ads/assets/{hash}` — Content-Type·`nosniff`·불변 캐시
  - [x] 5.6 클릭 속도 제한, Redis 장애 시 수락 0
  - [x] 5.7 Verify: `./gradlew :ads:feature:test --tests '*EventAcceptanceIntegrationSpec*' --tests '*ClickRedirectIntegrationSpec*' --tests '*AssetIntegrationSpec*'`
> 구현 기록(2026-09-24): 서명·수명·방문자 해시·과금 여부는 도메인 `ServeTokenSigner.verify`, Lua 1회는 일회성·클릭 속도·상한 3종·카운터·채움 출처 · `over_budget` 도 일회성 표식을 남긴다(다음 시각 재제출 과금 방지) · 소재×지면 카운터는 시각 해시 `ads:cr:{시각}` · 회귀 주입 4건 빨간불 · **메인 재검증에서 스펙 간 회원 id 충돌(후보 인덱스·이벤트 모두 6001~)을 발견해 이벤트 스펙을 9xxx 대역으로 옮기고 대역 규칙을 `AdsFixtures` 에 적었다**
**Acceptance Criteria:**
- AC-9·AC-10, 모든 ads Redis 키에 TTL(테스트가 `TTL` > 0 확인)

### Task Group 6: 집계·정산·원장·충전
**Dependencies:** Task Group 5
**Phase:** R2
**Required Skills:** spring, jpa, transactions
- [x] 6.0 Complete 정산
  - [x] 6.1 테스트 5개: ★I2(정산 재실행) · ★I3(동시 정산 + 동시 충전 한도 경계) · ★I5(UPSERT 재실행) · ★I6(3시각 닫힘 → 1회에 모두 · **3시각 동안 작업 0회 뒤 1회로 모두 반영·정산** [arch C-1] · **UPSERT 실패한 실행에서 closed 안 됨** [test C-9]) · I21(원장 불균형 검사기)
  - [x] 6.2 5분 작업: ① **닫히지 않은 시각 중 TTL(48시간) 안 전부**를 절대값 UPSERT [arch C-1] ② 시각 끝+10분 이후 UPSERT 성공한 시각 close ③ 닫혔고 정산 안 된 시각 전부 정산 → 광고주별 정산 완료 시각 갱신
  - [x] 6.3 원장 서비스 — 원장 계정 행 id 순 `FOR UPDATE`, 지갑 음수 불가, 모든 `@Transactional("adsTransactionManager")`
  - [x] 6.4 셀프 충전 — 1회 상한·KST 하루 한도를 지갑 행 잠금 안에서 확인, 행위자 기록
  - [x] 6.4b 정산 작업 첫 실행 때 지출 0 인 광고주도 정산 완료 시각을 기록(결정의 미정산 6시간 창이 오래된 지출을 놓치지 않게)
  - [x] 6.5 일일 원장 합 검사(ERROR·메트릭), 정산 지연 메트릭
  - [x] 6.6 Verify: `./gradlew :ads:feature:test --tests '*SettlementIntegrationSpec*' --tests '*LedgerIntegrationSpec*' --tests '*AggregationIntegrationSpec*'`
> 구현 기록(2026-09-24): `V2__ads_aggregation_hour.sql`(시각 닫힘 기록) 추가 · 충전·정산 트랜잭션 READ COMMITTED(REPEATABLE READ 면 잠금 뒤 합계가 앞 커밋을 못 봄 — 주입으로 확인) · 48시간 창 밖 미닫힘 행도 닫아 청구 · 멱등 키 중복은 기존 거래 반환 · 충전 한도 임시값 1회 100·하루 500 크레딧(`ads.top-up.*`) · 회귀 주입 5건 빨간불
**Acceptance Criteria:**
- AC-2·AC-11·AC-12·AC-20, 회귀 주입 I2·I5 빨간불(그룹 12)

### Task Group 7: 광고주·어드민 API · 리포트 · 호환 경로
**Dependencies:** Task Group 6
**Phase:** R2
**Required Skills:** spring, multipart, image-io
- [x] 7.0 Complete API
  - [x] 7.1 테스트 6개: I17(남의 리소스 404, HOUSE·심사 필드 없음) · I18(광고주 등록 → 행 1개 + **ads 에 auth·member 쓰기 포트가 없다**는 구조 검사 [test C-5]) · I19(반려 사유 조회) · I20(리포트 = 집계·원장) · I22(옛 `/placements/{key}` 응답 모양) · U12 통합판(거대 PNG 는 디코더 호출 0)
  - [x] 7.2 광고주 API `/api/v1/ads/advertiser/**` — 등록·대시보드·충전·캠페인·소재 업로드(헤더 먼저 → 크기 → 디코딩 → 재인코딩 → 해시)·카탈로그·리포트
  - [x] 7.2b 충전 멱등 키는 컨트롤러가 회원 id 로 이름공간을 붙인다(다른 회원이 같은 키로 남의 거래를 돌려받지 않게)
  - [x] 7.3 어드민 API `/api/v1/admin/ads/**` — 심사·광고주 정지·지면(`paid_allowed` 포함)·문맥 매핑·HOUSE·퍼블리셔 리포트·원장 검사 결과. 변경마다 행위자·시각
  - [x] 7.3b 공개 에셋 경로는 **승인된 소재 이미지만** — 심사 전·반려 이미지 미리보기는 광고주·어드민 인증 API 로(그룹 5 `CreativeAssetService` 에 승인 확인 추가)
  - [x] 7.4 호환 `GET /api/v1/ads/placements/{key}` — game 의 옛 응답 모양(`AdPlacementDto`)
  - [x] 7.5 Verify: `./gradlew :ads:feature:test --tests '*AdvertiserApiIntegrationSpec*' --tests '*AdminApiIntegrationSpec*' --tests '*ReportIntegrationSpec*' --tests '*LegacyPlacementIntegrationSpec*'`
  - [x] 7.6 (후속, 그룹 9 와 함께 구현) 퍼블리셔 리포트에 원장 총액 행 — 지면별 내림 배분 합이 원장 PUBLISHER_PAYABLE 합보다 작을 수 있다
> 구현 기록(2026-09-24): `V3__ads_admin_action.sql`(운영자 변경 기록) · 이미지 규칙은 도메인 `CreativeImageRules`(매직 바이트 → PNG IHDR/JPEG SOF 헤더 크기 → 300KB → 비율, 디코딩 없음) · 폭탄 케이스 판정은 운영 디코더를 감싼 계측기의 호출 수(정상 업로드 +1 대조군) · 청구액은 캠페인×일 단위 · 호환 경로는 HOUSE 목록을 옛 모양으로 · 충전 키 `TOPUP:{memberId}:{clientKey}` · 회귀 주입 3건 빨간불
**Acceptance Criteria:**
- AC-1·AC-3·AC-4·AC-13·AC-14·AC-18

### Task Group 8: 게이트웨이 라우트
**Dependencies:** Task Group 7
**Phase:** R2
**Required Skills:** spring-cloud-gateway
- [x] 8.0 Complete 게이트웨이
  - [x] 8.1 테스트 3개: C4 라우트 전수 검사 — **`Host: rt.1989v.com` 요청이 404 인 동작으로 판정** [test C-4] · C5 필터(클라이언트 `X-User-Id` 제거, Bearer 주입, advertiser 무토큰 401) · 리미터 키(`CF-Connecting-IP` 있음/없음)
  - [x] 8.2 ads 라우트(좁은 경로 먼저) → `ENGAGEMENT_URI`, 옛 `game-ads` 캐치올 제거
  - [x] 8.3 Host 허용 목록을 **게이트웨이 프로퍼티**로, overlay 별 값(oci-arm: apex·blog·game·place·ads / k3s-lite: 로컬 호스트). 와일드카드 금지 [impl N3-2 · usecase C2 · sec CO-2]
  - [x] 8.4 ads 공개 라우트 리미터 키 `CF-Connecting-IP` → 없으면 `remoteAddress`
  - [x] 8.5 Verify: `./gradlew :gateway:test --tests '*GatewayRoute*' --tests '*AdsRoute*'`
> 구현 기록(2026-09-24): 라우트 `ads-admin`·`ads-advertiser`·`ads-public`(Host 허용 목록 `kgd.gateway.ads.allowed-hosts`, 정확 일치·빈 값이면 닫힘) · oci-arm 5호스트, k3s-lite localhost · prod-k8s 는 값 없음(호스트 미정 — 쓰면 한 줄 추가) · `deal.1989v.com` 제외 · 회귀 주입 2건 빨간불 · **ads 에 공개 경로를 새로 만들면 `ads-public` path 목록에도 넣는다**
**Acceptance Criteria:**
- AC-9b(게이트웨이 단)·AC-18, 기존 게이트웨이 라우트 테스트 불변

### Task Group 9: analytics 원장 사본 발행
**Dependencies:** Task Group 5 (OQ-001 해소 — ADR-0095 착지 확인)
**Phase:** R2
**Required Skills:** kafka
- [x] 9.0 Complete 사본 발행
  - [x] 9.1 테스트 2개: I13 페이로드 필드(entity_type·action·view_id·visitorId·sessionId·section_id) · Kafka 실패 시 정산 정상
  - [x] 9.2 수락 이벤트만 `analytics.event.collected` 발행(Outbox 없음, 실패 경고)
  - [x] 9.3 Verify: `./gradlew :ads:feature:test --tests '*AnalyticsCopyIntegrationSpec*'`
> 구현 기록(2026-09-24): 수락된 것만 발행, 실패는 삼키고 warn · Kafka 생산자는 어댑터 안에 두고 `max.block.ms=500`(기본 60초면 브로커 장애가 이벤트·클릭을 멈춘다) · screenType 은 호스트별 표(blog→BLOG_POST, game→GAME_HUB, place→ATTRACTION_DETAIL) · 클릭 사본 visitorId 는 토큰 방문자 해시, sessionId 빈 값 · 7.6 원장 총액 행 함께 · 회귀 주입 3건 빨간불
**Acceptance Criteria:**
- AC-17

### Task Group 10: FE — 지면·카드·HOUSE (R3)
**Dependencies:** Task Group 8 (운영 배포 확인 후)
**Phase:** R3
**Required Skills:** react, typescript, design-tokens
- [x] 10.0 Complete FE 지면
  - [x] 10.1 **목표 이미지 먼저** — 광고 카드(크기군별)·HOUSE 배너 시안을 사용자에게 확인 (image-sample-before-code)
  - [x] 10.2 테스트 6개: F1(채움 순서 + 3초 무응답 + 대기 중 높이) · F2(`apiClient` 사용) · F3(HouseBanner 순환·SPA 링크) · F4(광고주 문자열 텍스트) · F5(`useImpression` 동작) · `selfAds={false}` 는 결정 호출 0
  - [x] 10.3 `AdSlot` — 지면 키, 페이지 단위 결정 묶음(800ms), 채움 순서, `selfAds` prop, AdSense `data-ad-status` MutationObserver + 3초
  - [x] 10.4 `ADSENSE_SLOTS` 키 kebab 로 통일, DealPage `selfAds={false}` [usecase C1]
  - [x] 10.5 광고 카드 — DESIGN.md 토큰, 「광고」 라벨, 텍스트 노드만, 클릭 리다이렉터 링크, `useImpression`
  - [x] 10.5b 클릭 URL 에 analytics 신원(방문자·세션)을 붙여 클릭 사본의 visitorId 를 노출 사본과 맞춘다 — 지금은 클릭만 토큰 방문자 해시라 방문자 단위 집계가 갈린다
  - [x] 10.6 이벤트 비콘 — 토큰 + `identity.ts` 신원 + 채움 출처
  - [x] 10.7 HouseBanner → 결정 API HOUSE 목록
  - [x] 10.8 숨김 시 자리 접힘은 받아들이되 `attraction-end` 처럼 기존에 없던 자리는 결정 응답 전까지 높이를 예약하지 않는다(새 밀림 방지) [usecase C3]
  - [x] 10.9 Verify: `cd portal-fe && npx vitest run src/components/ads src/pages/games/HouseBanner && npx tsc --noEmit -p tsconfig.app.json` + CDP 4조합 캡처(fe-visual-verification, 측정 후 즉시 브라우저 종료)
> 구현 기록(2026-09-24): 시안 승인(아티팩트 Cy4gVXYtFVRMZmaLM3VsC9) 뒤 구현 · `tsc -p .` 는 tsconfig.json 이 `files: []` 라 0개 파일을 검사한다 — `-p tsconfig.app.json`(239개) · 광고주명·CTA 는 k-heritage 규칙대로 본문 서체(모노는 한글 자간이 벌어짐), 광고주명 색 muted→secondary(4.09→8.53:1) · 카드 링크 `rel="sponsored nofollow noopener"` · 블로그 문맥 키는 카테고리 경로 마지막 조각 · 결정은 마운트 때 한 번(AdSense 와 같음) · 클릭 URL 에 `vid`/`sid`(128자 제한), 클릭 사본만 사용 · CDP 4조합 대비 라이트 5.31+ / 다크 4.5+ · 회귀 주입 9건 + 백엔드 1건 빨간불
**Acceptance Criteria:**
- AC-6·AC-16·AC-19, 결정 실패 시 AdSense 수익 경로 불변

### Task Group 11: FE — 광고주 콘솔 · 어드민 · 방침 (R3)
**Dependencies:** Task Group 10
**Phase:** R3
**Required Skills:** react, typescript, admin-fe
- [x] 11.0 Complete 콘솔·어드민
  - [x] 11.1 목표 이미지 — 콘솔 대시보드·캠페인 편집 시안 확인
  - [x] 11.2 테스트 3개: F6(`privacyRetention` 이 ads 상수 파일 `ads/feature/src/main/kotlin/com/kgd/ads/infrastructure/config/AdsRetention.kt` 의 `VISITOR_FREQUENCY_TTL_HOURS` 를 읽고 `RETENTION_RUNNERS` 에 추가 — 헬퍼가 시간 단위도 읽게) [test C-6] · F7(콘솔 `noindex`·첫 화면 3종) · 어드민 심사 큐 렌더(광고주 문자열 텍스트)
  - [x] 11.3 `ads.1989v.com` — ingress host+TLS hosts(`commerce-proxied` 안) · `App.tsx` 분기 · 프리렌더 `_hosts/$host` · `serviceHref.ts` · `noindex` · `ADSENSE_HOSTS` 제외
  - [x] 11.4 콘솔 화면 6종 + 「가상 크레딧 — 실제 결제 없음」
  - [x] 11.5 admin-fe 메뉴 7종(`Sidebar.tsx`·`App.tsx`·`api/ads.ts`)
  - [x] 11.6 `/privacy` §6 문구
  - [x] 11.7 Verify: `cd portal-fe && npx vitest run src/pages/ads src/pages/__tests__/privacyRetention.test.ts && npx tsc --noEmit -p tsconfig.app.json` · `cd admin/frontend && npx vitest run src/pages/ads && npx tsc --noEmit -p tsconfig.app.json`
  - [x] 11.8 (후속) 저장 거절 사유를 콘솔에 — ads 전용 `@RestControllerAdvice` 가 도메인 문구를 내려준다(common 의 GlobalExceptionHandler 는 문구를 버린다) · 충전 멱등 키는 성공·확정 거절까지 유지 · 대시보드에 오늘 충전 누계와 한도
> 구현 기록(2026-09-24): 콘솔 경로 `/`·`/top-up`·`/campaigns/new`·`/campaigns/:id`·`/reports`, apex `/ads` 는 ads 호스트로 · noindex 는 메타 + nginx `X-Robots-Tag` + `robots.txt Disallow` + 프리렌더 메타 · ads 호스트는 탭바 숨김 · F6 상수는 `AdsRedisKeys.kt`(헬퍼가 `_HOURS`/`_DAYS` 로 단위를 붙인다) · CDP 4조합 대비 최저 4.82, 한글 모노 0 · 회귀 주입 4건 빨간불
**Acceptance Criteria:**
- 콘솔로 E1 흐름을 끝까지 수행 가능, 방침 숫자 = 상수

### Task Group 12: 인프라 매니페스트 · CI · 문서
**Dependencies:** Task Group 2 (문서는 그룹 11 뒤 마무리)
**Phase:** R2
**Required Skills:** k8s, github-actions, docs
- [x] 12.0 Complete 인프라·CI·문서
  - [x] 12.1 `configmap-init.yaml`(ads_db·ads_user) · `services.yaml`(`mysql-ads-master`) · engagement 환경변수(`ADS_MYSQL_PASSWORD`·`ADS_TOKEN_SECRET`) · `kustomization.yaml:168-173` Tier S 패치 제거 · SealedSecret · **prod-k8s `init-databases-job.yaml` 줄과 비밀번호 패치** [arch C-4]
  - [x] 12.2 `ci.yml` — `ads/*) :ads:domain:test :ads:feature:test :engagement:app:test` · **`engagement/*` 매핑** [test C-7] · `generateTopology` 재실행
  - [x] 12.3 문서 — `ads/CLAUDE.md` · `ads/glossary.md`(`/hns:glossary`, requirements Ontology 입력) · `docs/context-map.md` · 루트 CLAUDE.md 서비스 표 · ADR-0093·`new-domain-checklist.md` engagement 행 · `kafka-convention.md` 발행자 · `latency-budget.md` Tier 1 · ADR-0059 §3·ADR-0076 개정 줄 · ADR-0098 상태 채택 · `data-sources.md` 해당 없음 확인 · `doc_map.py --check`
  - [x] 12.4 회귀 주입(임시 워크트리): U1·U3·U12·I1·I2·I5·I7·C1·C6·F5 각각 빨간불 확인 + **「미정산 지출 차감 제거」 주입** [test C-1] — 결과 표를 `verifications/regression-injection.md` 에
  - [x] 12.5 Verify: `./gradlew :engagement:app:check verifyPodTopology` · `python3 scripts/doc_map.py --check` · `kubectl kustomize k8s/overlays/oci-arm | grep -c 'ads'` · 첫 PR CI 로그에서 ads 세 태스크 실행 확인
> 구현 기록(2026-09-24): oci-arm 시크릿은 SealedSecret 이 아니라 수동 `kubectl create secret ads-token`(game-hmac 과 같은 방식) · `ADS_MYSQL_PASSWORD` 는 blog 처럼 yml 기본값, prod-k8s 만 패치 주입 · ci.yml 은 기본 분기가 없어 ads 변경 시 테스트가 0 이었다(스펙 전제 정정) · 12.4 는 부분 — 빨간불 로그가 남은 것은 U1 재주입뿐, 나머지는 재주입 필요 · 보고만: ci.yml test-gate 가 product·code-dictionary·place·quant·chatbot·gifticon 에서도 없는 `:{svc}:app:test` 를 부른다, prod-k8s `db-password-experiment.yaml` 이 폴드로 사라진 Deployment 를 가리킨다
**Acceptance Criteria:**
- 게이트가 물린다는 증거(빨간불 로그)가 남아 있다

### Task Group 13: game ads 제거 (R4 — 다음 릴리스)
**Dependencies:** Task Group 10 운영 확인(HouseBanner 가 새 API 로 동작) 
**Phase:** R4
**Required Skills:** kotlin, flyway
- [x] 13.0 Complete 제거
  - [x] 13.1 테스트 2개: `ContentContextLoadSpec` 통과 · `GameSchemaIntegrationSpec` 통과(삭제 마이그레이션 적용 후) [test C-8]
  - [x] 13.2 game ads 코드·테스트 삭제(`domain/ads`·`application/ads`·`presentation/ads`·`persistence/ads`·`RewardGrantTest`), `gameApi.ts` 의 `fetchAdPlacement` 삭제
  - [x] 13.3 game 새 마이그레이션 — `ad_placement`·`ad_policy`·`reward_grant` DROP (별도 커밋, 적용된 V6·V8 불변)
  - [x] 13.4 ads 호환 경로 `/placements/**` 와 라우트 제거
  - [x] 13.5 Verify: `./gradlew :game:domain:test :game:feature:test --tests '*GameSchemaIntegrationSpec*' :content:app:test --tests '*ContentContextLoadSpec*' :ads:feature:test --tests '*LegacyPlacement*'`(삭제 확인 — 테스트 0건)
**Acceptance Criteria:**
- AC-16b

**구현 메모:**
- 삭제 마이그레이션은 `V94__drop_ad_tables.sql`(`DROP TABLE IF EXISTS` 셋, 표 사이 외래 키 없음). 머지 전에 main 에 V94 가 먼저 생기면 번호를 올린다
- `GameSchemaIntegrationSpec` 에 「광고 표 셋이 없다」 단언을 더했다 — 마이그레이션 없이 돌려 셋이 남은 빨간불을 본 뒤 V94 를 넣었다
- 게이트웨이 `ads-public` 에서 `/api/v1/ads/placements/**` 를 뺐고, `AdsRouteSpec` 이 그 경로가 어떤 라우트에도 안 맞는 것을 본다
- `Game.isMonetizable()` 은 보상형 광고 발급만 쓰던 게이트라 호출처가 없어져 삭제했다 — 게임별 광고 지면이 없다(게임 쪽 지면은 목록 페이지 둘뿐)

---

## 운영 검증 (배포 후, verifier 와 별도)

| 시점 | 항목 | 방법 |
|---|---|---|
| R1 뒤 | analytics·recommendation 정상 | 파드 Ready + 원장 소비 에러 0 |
| R2 뒤 | engagement 기동·메모리·결정 P99 | `kubectl top pod` · `http_server_requests_seconds` (E4) · `rt.1989v.com/api/v1/ads/decisions` 404 (E6) · 옛 배너 정상(I22 운영판) |
| R3 뒤 | E1 전 흐름 · E2 대체 순서 · E3 HOUSE · E5 본인 청구 0 | 사람 UA + 저장된 행 수, CDP 4조합 |
| R4 뒤 | game 스키마 표 3종 없음 · 게임 목록 배너 정상 | `oci-mysql` · 화면 |

## Execution Order
1. Task Group 1 (R1 배포 → 운영 확인)
2. Task Group 0 (수동 사전 조건 — 사용자 승인 포함)
3. Task Group 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9, 병행으로 12(인프라·CI)
4. R2 배포 → 운영 확인
5. Task Group 10 → 11 (R3 배포 → 운영 확인)
6. Task Group 13 (R4)
