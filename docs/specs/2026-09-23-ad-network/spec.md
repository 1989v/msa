# Specification: 광고 네트워크 (ads)

> 개정 3.1 (2026-09-23). 1차 리뷰 56건(BLOCK 2 포함) → 개정 2, 2차 45건 → 개정 3, 3차 6관점 SHIP(이월 항목은 tasks.md 로). 판정 기록 `context/engineer-review-*.md`.

## Goal

1989v 서브도메인의 광고 지면에 로그인 회원이 가상 크레딧으로 집행한 디스플레이 광고를 내보낸다. 문맥 기준 1차가 경매로 고르고, 가시 노출·클릭을 검증해 복식부기 원장으로 정산한다. **새 파드 없이** `:ads:domain` + `:ads:feature` 를 `engagement:app` 에 폴드하고, 기존 game ads 모듈을 흡수한다.

근거: `planning/requirements.md` · 개념 번호 `context/concepts.md` · ADR-0098. 용어는 `ads/glossary.md`(SR-17) — **지면**(`AdPlacement`, common `Placement` 와 구분) · **소재**(Creative) · **원장 계정**(LedgerAccount) · **지출**(카운터가 센 게재 금액) vs **청구액**(원장에 반영한 금액).

## User Stories

- 광고주로서, 로그인한 채 크레딧을 충전하고 캠페인과 소재를 올려, 심사가 끝나면 고른 지면에 광고가 나가게 하고 싶다.
- 광고주로서, 캠페인·소재별 일별 노출·클릭·지출·청구액과 잔액을 보고, 예산을 넘어 청구되지 않는다는 것을 확인하고 싶다.
- 방문자로서, 광고가 광고라고 표시되고 읽던 흐름을 끊지 않기를 원한다.
- 운영자로서, 소재를 심사하고, 광고주를 정지하고, 지면·문맥·HOUSE 를 관리하고, 지면별 채움과 등록 안 된 지면을 보고 싶다.
- 운영자로서, 자체 광고가 없거나 광고 서버가 죽어도 지면이 AdSense 나 자체 홍보로 채워지기를 원한다.

## Specific Requirements

### SR-1 모듈과 폴드
- `:ads:domain`(프레임워크 의존 없음, `:common` 만) · `:ads:feature`(bootJar 없음), 패키지 `com.kgd.ads`. 레이어 ADR-0083, 견본 `inventory/feature`
- `engagement:app` 이 `:ads:feature` 에 의존하고 `scanBasePackages` 에 `com.kgd.ads` 추가. 새 `:app`·Deployment 없음. `generateTopology` 재실행
- DataSource 는 비-primary 견본 `WishlistDataSourceConfig` — prefix `spring.datasource.ads`, `adsEntityManagerFactory`·`adsTransactionManager`, `ScopedFlywayMigrator(classpath:adsdb/migration)`, ads EMF 만 `ddl-auto=validate`. ads 의 모든 `@Transactional` 은 `adsTransactionManager` 한정자
- recommendation·experiment 빈을 주입하지 않는다 (ADR-0058)
- 스케줄링은 engagement 에서 outbox 자동 구성이 켜지만(`KgdMessagingOutboxAutoConfiguration.kt:45`) 그 토글에 기대지 않도록 ads 설정이 `@EnableScheduling` 을 직접 선언한다. engagement 스케줄러 풀은 4(기본 1 — 정산이 인덱스 갱신을 막지 않게). ads 스케줄 작업 빈은 각자 `ads.scheduling.enabled`(기본 true) 조건을 단다 — 테스트는 끄고 작업을 직접 호출한다. replicas 1 전제, 모든 작업은 멱등

### SR-2 인프라 변경 — 이것이 전부다
- engagement 메모리: `kustomization.yaml:168-173` 의 Tier S 패치를 빼 Tier M(768Mi)
- **`ads_db`·`ads_user`**: 공유 MySQL 에 둔다. `configmap-init.yaml` 추가 + 운영 볼륨 1회 수동 SQL(place_db 선례 `a599d857`) + `services.yaml` 별칭 Service `mysql-ads-master`. 비밀번호는 content 의 blog 와 같은 방식(`${ADS_MYSQL_PASSWORD:기본값}`)
- **`ADS_TOKEN_SECRET`**(필수) · `ADS_TOKEN_SECRET_PREVIOUS`(교체 중에만): 시크릿 `ads-token`. oci-arm·k3s-lite 는 sealed-secrets 컨트롤러가 없어 기존 game-hmac 처럼 `kubectl create secret` 으로 수동 생성, prod-k8s 는 SealedSecret. 32바이트 미만이면 기동 거부(선례 `HmacPartySeatTokenService` 의 최소 길이). 다른 서비스의 HMAC 키와 공유하지 않는다
- 스키마·계정·시크릿이 클러스터에 있는 것을 확인한 뒤에만 이미지를 올린다 — 하나라도 없으면 recommendation·experiment 까지 함께 못 뜬다 (OQ-003)
- **ads 전용 Redis 연결**: 같은 Redis 인스턴스, ads 만 명령 타임아웃 250ms·연결 타임아웃 500ms. engagement 공용 연결(recommendation 동기화의 `RENAME`·`delete`)은 건드리지 않는다
- 새 파드·등록 도메인·Cloudflare 존·오브젝트 스토리지 없음. 콘솔 `ads.1989v.com` 은 와일드카드 인증서 안(ingress TLS hosts 추가·proxied DNS 는 수동 사전 조건)

### SR-3 광고주와 크레딧
- **Advertiser** 종류 `MEMBER`·`SYSTEM`. `MEMBER` 는 회원 1명당 1행, `SYSTEM` 은 「1989v 하우스」 하나(회원·지갑 없음, 시드). 상태 `ACTIVE` ⇄ `SUSPENDED`(어드민만, 사유·행위자 기록). 등록 즉시 `ACTIVE`, 전역 Role 은 바꾸지 않는다 (blog_profile 패턴)
- 정지된 광고주는 조회(잔액·리포트)만 되고 쓰기는 거절되며, 캠페인은 1분 안에 후보에서 빠진다
- 광고주 API 는 모든 리소스를 (id, 요청자 광고주 id)로 조회한다 — 남의 것은 404. 우선순위·심사 상태·원장 계정은 광고주 요청 모델에 필드가 없다
- 셀프 충전은 1회 상한과 KST 하루 합계 한도를 넘지 않을 때만 원장 거래 `TOPUP`. 한도 확인은 지갑 원장 계정 행 잠금 안에서 한다(동시 충전으로 한도를 넘지 않는다). 초과는 원장 행 0. 행위자(회원 id) 기록
- 금액은 정수 마이크로 크레딧(1 크레딧 = 1,000,000). 콘솔 금액 옆에 「가상 크레딧 — 실제 결제 없음」
- 「하루」는 KST 달력일, 시간은 주입된 `Clock` 으로만 읽는다

### SR-4 캠페인과 소재
- **Campaign**: 이름, 입찰 방식(`CPM`·`CPC`), 입찰가, 일예산, 총예산(선택), 기간, 방문자당 하루 빈도 제한(기본 3), 타기팅 지면(1개 이상), 타기팅 문맥 카테고리(비면 전체). **우선순위는 저장하지 않는다** — 소유 광고주가 `SYSTEM` 이면 HOUSE, 아니면 PAID
- 상태 전이: `DRAFT` →(시작) `ACTIVE` ⇄ `PAUSED` →(광고주 종료) `ENDED`. `ENDED` 는 되돌리지 않는다. 「기간 밖」·「예산 소진」은 상태가 아니라 **게재 자격에서 파생**한다(SR-6) — 콘솔은 파생 표시로 보여 준다
- 예산 소진 판정 기준은 **청구 누계 + 미정산 지출** — 넘친 지출이 청구되지 않아도 게재는 그 합으로 멈춘다
- **Creative**(PAID): 제목(40자)·문구(90자)·랜딩 URL·이미지 1장. `PENDING` → `APPROVED` | `REJECTED`(사유 코드 필수, 행위자·시각) ; `revise()` 가 내용 교체와 `PENDING` 복귀를 함께 한다(수정 중 게재 없음) ; 삭제는 `ARCHIVED`
- 랜딩 URL: `https` 만, userinfo 금지, 2048자 이하
- 이미지: 매직 바이트로 PNG·JPEG 판정 → **헤더에서 가로세로를 먼저 읽어 2000px 초과면 디코딩하지 않고 거절** → 300KB 이하 → 지면 형식 비율 → 다시 인코딩(메타데이터 제거) → 내용 해시 저장
- 저장 불변식: **CPM** 입찰가 ≥ 타기팅한 모든 지면의 최저가(CPC 는 단위가 달라 저장 때 비교하지 않고 결정 때 eCPM 으로 비교) · 일예산 ≥ 1회 과금액 · 유료 캠페인은 `paid_allowed=false` 지면을 타기팅할 수 없다. 저장 뒤 최저가가 오른 지면은 결정에서 제외(SR-6)
- 1회 과금액: CPM 은 가시 노출 1회당 `floor(CPM 입찰 / 1000)` 마이크로, CPC 는 클릭 1회당 입찰가. 지면 최저가 하한이 1회 과금액 ≥ 1 마이크로를 보장한다
- 반려 사유 코드 고정 목록 — 규제 업권(의료·금융, ADR-0069) · 성인 · 도박 · 허위·과장 · 랜딩 불일치 · 이미지 품질

### SR-5 지면 등록부와 문맥
- **AdPlacement**: 키(kebab-case), 호스트, 형식(크기군·허용 비율), 최저가, 활성, 설명. 지면의 단일 원본
- 1단계 지면: `blog-post-end` · `game-hub-end` · `attraction-end` · `game-list-banner`(HOUSE 전용). `deal-hub-end` 는 **등록하지 않는다** — 제휴 고지 곁에서 광고와 제휴가 흐려지는 이유(ADR-0076)는 자체 광고에도 같다. 노출하지 않을 지면을 노출용 표에 비활성 행으로 두지 않고, DealPage 의 `AdSlot` 을 자체 광고 없는 AdSense 전용(`selfAds={false}`)으로 둬 결정 호출 자체를 하지 않는다
- FE `ADSENSE_SLOTS` 키도 같은 kebab 키로 맞춘다
- 광고 금지 면(메인 `/`·`/portfolio`·resume·게임 iframe 안·광고주 콘솔)에는 지면이 없다
- 등록부에 없는 키는 광고 없음(`unregistered_placement`) + 키별 요청 수를 미등록 목록에 누적 (K7)
- **문맥 카테고리**는 ads 소유 고정 목록. FE 가 보내는 문맥 키 형식: `blog:{카테고리 slug}` · `game:{장르 slug}` · `place:{광역 코드}` · 키가 없는 화면은 빈 값. ads 의 매핑 표(어드민 관리)가 카테고리로 바꾸고, 없으면 호스트 기본 카테고리. 다른 BC id 를 외래키로 두지 않는다
- 광고주 카탈로그 API: 지면(설명·형식·최저가·최근 7일 일평균 요청) · 카테고리

### SR-6 광고 결정
- `POST /api/v1/ads/decisions` — 한 페이지의 지면 여러 개. 입력: 지면 키 목록, 호스트, 문맥 키. 방문자는 게이트웨이 `vid` 쿠키가 정하는 `X-Visitor-Id`(호스트별 쿠키라 **빈도 제한은 호스트 단위** — 받아들인다), 로그인 회원은 게스트 허용 필터가 넣는 `X-User-Id`
- 크롤러 UA 는 광고 없음(토큰 없음, Redis 접근 없음)
- 후보 자격: 광고주 `ACTIVE` · 캠페인 `ACTIVE` · 기간 안 · 소재 `APPROVED` · 소재 비율과 지면 형식 일치 · eCPM ≥ 그 지면 최저가 · 카테고리 일치 · 일예산·총예산 여유(청구 누계 + 미정산 지출 기준) · 캠페인 시간당 지출 상한(max(floor(일예산 × 25%), 1회 과금액)) 미달 · 지갑 여유 · 방문자 빈도 미달
- **지갑 여유 = 인덱스 스냅샷의 잔액 − 스냅샷의 「정산 완료 시각」 이후 시각들의 광고주 지출 합**. 광고주 지출은 (광고주, KST 시각) 키라 차감하지 않고, 정산이 늦어 6시간 넘게 미정산이면 그 광고주는 후보에서 빠진다
- 순위 eCPM — CPM 은 입찰가, CPC 는 입찰가 × pCTR × 1000. 동점은 캠페인 id 오름차순. 한 응답 안에서 같은 캠페인이 두 지면을 이기지 않는다
- pCTR = (클릭 + 1) / (가시 노출 + 100), 소재×지면 시간별 집계에서
- 페이싱: 하루 경과 비율보다 소진 비율이 앞서면 그 차만큼 통과 확률을 낮춘다. 난수는 주입
- Redis 는 **읽기 1회 + 쓰기 1회**: (1) 메모리 자격을 통과한 후보 중 eCPM 상위 20개의 빈도·일/시간 지출·광고주 지출을 한 번에 읽고 (2) 결정 뒤 지면별 요청·유료 채움 카운터를 파이프라인으로 올린다. 읽기가 실패·타임아웃이면 유료 광고 없음(`redis_unavailable`), 쓰기 실패는 경고만
- 응답: 지면마다 `광고 | 없음(사유)` + (광고면) 노출·클릭 토큰 + HOUSE 소재 목록. 사유 `no_candidates`·`unregistered_placement`·`redis_unavailable`
- 후보 인덱스는 파드 메모리, 1분 이하 주기 갱신. 결정 경로에 DB·외부 호출 없음. 서버 처리 P99 ≤ 30ms — Tier 1 에 「광고 결정」 행

### SR-7 토큰
- 광고마다 **노출 토큰**·**클릭 토큰**. 서명 대상(순서 고정): 종류(IMP|CLK) · 결정 id · 캠페인 · 소재 · 광고주 · 지면 · 입찰 방식 · 1회 과금액 · 과금 여부 · 방문자 해시 · 발급 시각 · 키 id
- HMAC-SHA256, 상수 시간 비교(`MessageDigest.isEqual`). 키 id 로 현재·이전 키 검증
- 수명 2시간, 종류별 1회만 수락 — Redis 일회성 표식 TTL 3시간
- 서명만 하고 암호화하지 않는다 — 1회 과금액이 브라우저에 보이는 것은 받아들인다
- 이벤트의 방문자 해시가 토큰과 다르면 과금하지 않는다(`visitor_mismatch`). 첫 방문 병렬 요청에서 `vid` 가 둘 생기면 이 사유로 과소 청구될 수 있다 — 받아들이고 비율을 메트릭으로 본다

### SR-8 광고주 본인 판정 — 결정 시점
- 비콘·클릭 302 에는 로그인 헤더가 실리지 않는다(`tracker.ts:63`, `AuthenticationGatewayFilter.kt:35-36`). 본인 판정은 Bearer 가 실리는 **결정 호출**에서 한다
- 결정 요청의 `X-User-Id` 가 낙찰 캠페인 소유 회원이면 광고는 보이되 토큰 과금 여부 = false. 이벤트 단계는 신원을 보지 않고 토큰만 믿는다
- FE 결정 호출은 Bearer 를 붙이는 `apiClient` 로 한다(생 `fetch` 금지 — 쓰면 본인 판정이 조용히 꺼진다)

### SR-9 게이트웨이 라우트
- 좁은 경로를 먼저 선언하고 옛 `game-ads` 캐치올을 지운다
- 공개 + 게스트 허용 필터(`optionalUserConfig`, 클라이언트 `X-User-Id` 제거): `decisions` · `events` · `click/**` · `assets/**` · `placements/**`(전환 호환)
- 로그인: `/api/v1/ads/advertiser/**`(토큰 없으면 401) · 어드민: `/api/v1/admin/ads/**`(ROLE_ADMIN)
- ads 공개 라우트는 **Host 허용 목록**(게이트웨이 프로퍼티, overlay 마다 값 — oci-arm 은 AOP 가 걸린 proxied 호스트, k3s-lite 는 로컬 호스트)만 받는다 — `rt.1989v.com` 은 Cloudflare 를 거치지 않아 `CF-Connecting-IP` 를 위조할 수 있으므로 목록에 없다(404). 와일드카드 `*.1989v.com` 은 rt 를 포함하므로 쓰지 않는다. 이 방어는 AOP 가 켜져 있다는 전제다. 리미터 키는 `CF-Connecting-IP`, 헤더가 없으면 `remoteAddress`

### SR-10 계측과 무효 트래픽
- 과금 노출은 **가시 노출**(면적 50%·연속 1초). 광고 카드는 `useImpression` 훅을 그대로 쓴다 — 기준을 사본으로 두지 않는다
- `POST /api/v1/ads/events`: 노출 토큰 묶음(`sendBeacon` 허용) + analytics 신원(`identity.ts` 의 방문자·세션 id, 사본 발행용이지 과금 근거 아님) + 지면별 최종 채움 출처(`PAID`·`ADSENSE`·`HOUSE`·`EMPTY`, 참고 통계용). 토큰마다 독립 판정
- **수락 스크립트**(Redis 1회)가 일회성 표식·방문자 해시·**캠페인 일예산·시간당 상한·총예산**을 함께 확인한다 — 결정 뒤 토큰을 모아 한꺼번에 내도 상한을 넘은 몫은 `over_budget` 으로 과금하지 않는다
- 클릭 `GET /api/v1/ads/click/{clickToken}`: 서명 유효 → 목적지는 DB 의 승인된 소재 랜딩 URL(승인 아니면 `/`) ; 서명 불량 → `/` ; 만료·재사용·속도 초과·상한 초과 → 랜딩으로 가되 과금 없음. `Cache-Control: no-store`·`X-Robots-Tag: noindex, nofollow`
- 거절 사유: `invalid_signature`·`expired`·`duplicate`·`visitor_mismatch`·`crawler`·`not_billable`·`rate_limited`·`over_budget`·`redis_unavailable`
- 크롤러 판정: `CrawlerUserAgents` 를 `:common` 으로 올린다(analytics·deal·ads, SR-16 슬라이스)
- 클릭 속도: 같은 방문자 10분 N회 초과분 과금 없음
- Redis 장애 시 이벤트는 받지 않는다(`redis_unavailable`)
- 수락한 이벤트만 카운터를 올린다(키는 **수락 시각 KST**): 소재×지면×시각 노출·클릭·지출 · 캠페인 일·시각 지출 · (광고주, 시각) 지출 · 방문자×캠페인 일 빈도(가시 노출 수락 때)
- 잔여 위험: SIVT 는 막지 않는다. 손실 상한은 캠페인 시간당 상한(수락 단계에서 강제)이다. `REVERSAL` 운영 도구는 2단계

### SR-11 카운터 → 집계 → 정산 (한 작업, 5분 주기)
- 한 작업이 순서대로 한다: ① 현재·직전 시각 카운터를 시간별 집계에 **절대값 UPSERT** ② 시각 끝 + 10분이 지났고 그 뒤 UPSERT 가 한 번 성공한 시각을 `closed` ③ **닫혔고 정산 안 된 시각 전부**를 정산 — 파드가 없던 동안 놓친 시각도 다음 실행이 따라잡는다
- 지면 요청·유료 채움 수도 지면 시간별 집계(`AdPlacementHourly`)로, FE 가 보고한 최종 채움 출처는 같은 표의 참고 열로
- Redis 키 TTL: 빈도 25시간 · 일회성 표식 3시간 · 지출·카운터 48시간(정산 6시간 제한보다 길다). 반영 전 유실은 과소 청구로만 끝난다

### SR-12 크레딧 원장
- 원장 계정: 광고주 지갑(`MEMBER` 광고주마다) · 네트워크 수수료 · 퍼블리셔 미지급(1989v 단일 — 퍼블리셔는 원장 계정으로만 존재) · 충전 원천(가상 발행, 음수 허용)
- 거래 `TOPUP`(충전 원천 → 지갑) · `SETTLEMENT`(지갑 → 퍼블리셔 미지급 + 수수료) · `REVERSAL`(**`SETTLEMENT` 만** 전액 역분개 — 원 거래 id 참조, 지갑이 늘기만 하므로 음수 불가와 부딪히지 않는다. 부분 역분개·충전 역분개는 2단계)
- 멱등 키 유일, 분개 합 ≠ 0 이면 **만들 수 없다**(팩토리만 공개)
- 잔액은 원장 계정 행이 갖고, 분개와 같은 트랜잭션에서 원장 계정 행을 id 순으로 `FOR UPDATE`. 지갑은 음수 불가
- 정산 멱등 키 `SETTLE:{캠페인}:{시각}`. 청구액 = min(그 시각 지출, 그 KST 날 일예산 − 그 날 청구 누계, 총예산 − 청구 누계, 지갑 잔액)
- 퍼블리셔 몫 = floor(청구액 × 배분율), 수수료 = 청구액 − 퍼블리셔 몫. 배분율 기본 68%
- 광고주별 「정산 완료 시각」을 기록한다 — 결정의 지갑 여유 계산이 이것을 쓴다(SR-6)
- HOUSE(`SYSTEM`)는 원장·정산 대상이 아니다
- 매일 전체 분개 합 0 검사, 어긋나면 ERROR 로그·메트릭

### SR-13 리포트
- 광고주: 캠페인·소재별 일별 가시 노출·클릭·CTR·지출·청구액(미정산 시각은 청구액 비움), 두 값이 다른 날은 「예산 초과분 미청구」 표시
- 퍼블리셔: 지면별 일별 요청·**유료 채움률**(서버가 아는 값)·최종 채움 출처 분포(FE 보고, 참고치로 표기)·노출·클릭·RPM·수익(퍼블리셔 몫). 지면별 몫은 정산 분개를 지출 비율로 내림 배분한 참고치이고, **원장 총액 행**(PUBLISHER_PAYABLE 합)을 따로 둔다
- 원천은 시간별 집계 두 표와 원장뿐

### SR-14 HOUSE 와 game ads 흡수
- HOUSE 캠페인은 `SYSTEM` 광고주 소유, 어드민 API 로만. 면제: 예산·지갑·최저가·빈도·원장
- HOUSE 소재 형식: 제목·문구·이모지·링크, 이미지 선택. 링크는 서버가 검증한다 — 앱 안 경로 `^/(?![/\\])` 또는 `https` URL(userinfo 금지). 시드 상태 `APPROVED`
- 결정 응답의 HOUSE 는 지면의 승인된 HOUSE 소재 **목록** — `HouseBanner` 가 6초 순환, 앱 안 경로는 SPA 링크
- game `game-list-banner` 소재 3종을 ads 시드 마이그레이션으로 옮긴다. `game-detail-banner`·보상형은 호출처 0 이라 옮기지 않는다
- 전환 순서:
  1. common 슬라이스 배포(SR-16)
  2. ads 배포 + 게이트웨이 전환 — 한 릴리스(Argo sync-wave 가 engagement 9 → gateway 20 순서를 보장). 이 릴리스 동안 ads 가 옛 `GET /api/v1/ads/placements/{key}` 를 옛 응답 모양으로 제공
  3. FE 가 결정 API 로 전환(AdSlot·HouseBanner)
  4. 다음 릴리스: 호환 경로 제거 + game ads 코드 제거 + game 표 삭제 **새 마이그레이션**(별도 커밋)
- 되돌리기: 2 뒤·3 전은 게이트웨이 라우트만 content 로. **3 뒤는 FE 이미지와 게이트웨이를 함께** 되돌린다 — 그 사이 발급된 클릭 토큰은 404 가 되고, 그 손실은 받아들인다

### SR-15 FE 지면 연결과 채움
- `AdSlot` 은 지면 키를 받고, 한 페이지의 지면을 결정 호출 한 번(`apiClient`, 800ms 제한)으로 묶는다. 대기 중에는 지면 최소 높이를 비워 둔다(레이아웃 밀림 없음)
- 채움 순서: 유료 → AdSense(그 지면 ID 가 있을 때) → HOUSE 목록 → 자리 숨김
- 결정 호출 실패(오류·타임아웃·빈 200·형식 불일치)는 「유료 없음」 → AdSense. AdSense 가 `data-ad-status="unfilled"` 이거나 3초 안에 상태가 안 적히면(차단기·로드 실패) HOUSE
- 광고 카드: DESIGN.md 토큰, 「광고」 라벨 상시. 광고주 문자열은 **텍스트 노드로만**(`dangerouslySetInnerHTML` 금지 — 콘솔·admin-fe 동일). 카드 링크는 클릭 리다이렉터 URL
- 에셋 응답: 저장 형식 Content-Type · `X-Content-Type-Options: nosniff` · 불변 캐시. 공개 경로는 **승인된 소재가 쓰는 이미지**(내용 해시 단위)만 — 바이트가 같은 이미지는 내용이 같아 새는 정보가 없다. 심사 전 미리보기는 광고주·어드민 인증 경로
- 광고주 콘솔 `ads.1989v.com`: 서브도메인 체크리스트 네 곳 + ingress TLS hosts + proxied DNS. `noindex`, `ADSENSE_HOSTS` 제외. 첫 화면 — 비로그인 → apex 로그인(돌아올 주소 유지) · 광고주 아님 → 등록 · 정지 → 읽기 전용 안내
- 콘솔 화면: 등록 · 대시보드(잔액·오늘 지출) · 충전 · 캠페인 목록/편집(카탈로그에서 지면·카테고리) · 소재 업로드·심사 상태·반려 사유 · 리포트

### SR-16 common 변경과 analytics 합류
- common 변경은 **별도 슬라이스로 먼저** 배포(전 JVM 이미지 재빌드): `CrawlerUserAgents` 이동 · `EntityType.AD`
- recommendation 원장 소비자는 `entity_type=AD` 를 무시한다
- 수락한 노출·클릭만 `analytics.event.collected` 로 발행: `entity_type=AD` · `entity_id`=소재 id · `action` · `view_id`=결정 id · `visitorId`·`sessionId`=이벤트 요청의 analytics 신원 · `screen_type`=호스트별 화면 종류 · `section_id`=`AD:{지면 키}` · `item_index`=0. 새 토픽 없음
- 권위 원천이 아니라서 Outbox 를 쓰지 않는다(new-domain-checklist §5 이탈, ADR-0098). 발행 실패는 경고만. ADR-0095 착지 전이면 발행만 보류 (OQ-001)

### SR-17 어드민·관측·개인정보·문서·CI
- **admin-fe 화면**(API `/api/v1/admin/ads/**`): 심사 큐(PENDING, 승인·반려+사유) · 광고주(목록·정지·해제) · 지면(등록·최저가·활성, 미등록 목록) · 문맥 매핑(키 → 카테고리) · HOUSE(캠페인·소재) · 퍼블리셔 리포트 · 원장 검사 결과. 모든 변경에 행위자·시각
- 승인·정지·매핑 변경은 1분 안에 인덱스에 반영
- 메트릭: 결정 지연 · 지면별 결정 결과 · 이벤트 수락·사유별 거절(`visitor_mismatch` 비율 포함) · 마지막 집계·정산 시각 · 원장 불균형 · 인덱스 갱신 시각 · ads Redis 키 수
- 로그는 결정 id 로 결정→토큰→이벤트→정산을 잇고, 방문자 id 는 해시로만
- 개인정보: ads MySQL 에 방문자·회원 단위 이벤트 행 없음. 방문자 id 는 Redis 빈도 키에 최대 25시간 — 이 값은 ads 설정 상수 한 곳에서 오고 `/privacy` §6 문구와 같아야 한다(ADR-0077). 사본 원장 90일(ADR-0095), 「행태 타기팅 없음」
- 문서: ADR-0098 · `ads/CLAUDE.md` · `ads/glossary.md`(Avoid: 슬롯·구좌→지면, 크리에이티브→소재, 단독 「계정」→원장 계정, 크레딧을 `Money` 로) · `docs/context-map.md` · 루트 CLAUDE.md 서비스 표 · ADR-0093·`new-domain-checklist.md` engagement 행 · `kafka-convention.md` 발행자 · 지연 예산 Tier 1 · ADR-0059 §3·ADR-0076 개정 줄
- CI: `ci.yml` 경로 매핑에 `ads/*|engagement/*` → engagement 태스크 묶음(`topology.sh` 와 같은 목록)을 **명시**한다. 매핑이 없으면 기본 분기가 없어 ads 변경에서 테스트가 하나도 돌지 않는다. 첫 PR 의 CI 로그에서 태스크가 돈 것을 확인

## Visual Design

목업 없음. 구현 전에 광고 카드(크기군별)·HOUSE 배너·콘솔 대시보드 목표 이미지를 만들어 확인받는다.

## Existing Code to Leverage

| 무엇 | 어디 |
|---|---|
| 폴드 호스트·스캔 | `engagement/app/.../EngagementApplication.kt:13` |
| 비-primary DataSource | `wishlist/feature/.../WishlistDataSourceConfig.kt:36` |
| 스케줄링 | `common/.../outbox/KgdMessagingOutboxAutoConfiguration.kt:45` |
| 폴드 게이트 | 루트 `build.gradle.kts:701-731` · `:835` · `verifyPodTopology` |
| DB 추가 | `k8s/infra/local/mysql/configmap-init.yaml` · `services.yaml` · 커밋 `a599d857` · blog 비밀번호 방식 `content/app/.../application.yml:57` |
| 광고주 권한 행 | `blog/feature/.../blogdb/migration/V1__blog.sql:14` · `BlogProfile.canWrite()` |
| 흡수 대상 | `game/domain/.../ads/model/*` · `game/feature/.../ads/*` · `gamedb/migration/V6__ads_house.sql` · `V8__seed_rewarded_placement.sql` · `GatewayRouteConfig.kt:370` |
| FE 지면·로더 | `portal-fe/src/components/ads/AdSlot.tsx` · `adsenseLoader.ts` · `seo/copy.mjs:1060-1113` · `pages/games/HouseBanner.tsx` · `api/gameApi.ts:541` · `DealPage.tsx:226` |
| 가시 노출·이벤트 | ADR-0095 · `useImpression.ts:13-15` · `tracker.ts` · `identity.ts` · `AnalyticsEvent.kt` · `EntityType.kt` |
| 신원·리미터 | `VisitorIdFilter.kt:24-39` · `AuthenticationGatewayFilter.kt` · `RateLimiterConfig.kt` · `commerce-platform.yaml:264-283`(rt) · 볼트 [[anonymous-identity-headers]] |
| 토큰 서명 | `HmacPartySeatTokenService.kt:36` |
| 크롤러 판정 | `analytics/.../CrawlerUserAgents.kt` · deal `DealRedirectService.kt:85` |
| 클릭 리다이렉트 | `DealRedirectController.kt:30` · `DealRedirectService.kt:44-49` |
| 어드민 | `admin/frontend/src/pages/blog/BlogAuthorsPage.tsx` · `Sidebar.tsx:41-70` · `App.tsx:26-57` |
| 보존 검사 | `portal-fe/.../privacyRetention.test.ts` |
| 메모리 등급 | `k8s/overlays/oci-arm/kustomization.yaml:168-173` |

## Out of Scope

외부 퍼블리셔·사이트 심사·sellers.json·별도 서빙 도메인 · RTB/OpenRTB/헤더 비딩 · 네이티브·위치 편향 보정·키워드 매칭 · 행태·리타기팅·전환·어트리뷰션 · 실결제·환불·지급·세무 · CPT 보장형·avails · 동영상·보상형 · SIVT 탐지·역분개 운영 도구·부분 역분개 · WebP 소재. 근거 `planning/requirements.md` Non-Goals.

## Open Questions

`context/open-questions.yml` — `pre-impl` 미결 0건. 구현 중 확인 4건: OQ-001 ADR-0095 착지 · OQ-002 768Mi 노드 여유 · OQ-003 스키마·계정·시크릿 선반영 · OQ-004 `ci.yml` engagement 폴드 불일치(보고만).
