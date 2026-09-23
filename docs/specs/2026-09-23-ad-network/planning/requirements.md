# Requirements: 광고 네트워크 (ads)

> Shape 단계 산출물. 개념 목록은 `../context/concepts.md`(107개), 요청 원문은 `initialization.md`.
> 아키텍처 결정은 ADR-0098 로 넘어간다.

## Shape Metadata
- Type: brownfield (game ads 모듈 흡수 · AdSlot 재사용 · engagement 폴드)
- Rounds: 1 (+ 범위 질의 1회 — initialization.md)
- Final Ambiguity: 16%
- Threshold: 0.2 (source: default)
- Status: PASSED
- Generated: 2026-09-23

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal | 0.90 | 0.35 | 0.315 |
| Constraints | 0.85 | 0.25 | 0.213 |
| Success Criteria | 0.75 | 0.25 | 0.188 |
| Context | 0.85 | 0.15 | 0.128 |
| **Ambiguity** | | | **0.16** |

## Topology
| Component | Status | Description | Coverage / Deferral note |
|-----------|--------|-------------|--------------------------|
| ① 광고주 콘솔 | active | 광고주 등록 · 크레딧 셀프 충전 · 캠페인 · 소재 업로드 · 리포트 | AC-1~4, AC-12 |
| ② 광고 결정·서빙 | active | 후보 추림 · 타기팅 · 빈도 제한 · 1차가 경매 · 페이싱 · AdSlot/HouseBanner 연결 · 대체 순서 | AC-5~8 |
| ③ 계측·무효 트래픽 | active | 서명 토큰 · 가시 노출 · 클릭 리다이렉트 · 중복/봇/자기 클릭 제외 | AC-9~10 |
| ④ 크레딧 원장·정산·리포트 | active | 복식부기 원장 · 시간별 정산 · 광고주/퍼블리셔 리포트 | AC-11~13 |
| ⑤ 어드민 심사·운영 | active | 소재 심사 · 광고주 정지 · 지면·최저가 관리 · 미등록 지면 탐지 | AC-14~15 |
| 외부 퍼블리셔 가입·심사 | deferred | C1~C3 · 별도 서빙 도메인(D14) | 2단계. 확정 범위 「우리 서브도메인 먼저」 (2026-09-23) |
| 네이티브 광고 | deferred | B14 · D19 · F11 | 2단계. 「디스플레이 먼저」 (2026-09-23) |

## Goal
1989v 서브도메인의 광고 지면에, 로그인 회원이 가상 크레딧으로 셀프 집행한 디스플레이 광고를 문맥 기준 1차가 경매로 내보내고, 가시 노출·클릭을 검증해 복식부기 원장으로 정산한다 — **새 파드 없이 `engagement` 에 폴드**한다.

## Constraints
- **새 파드·새 `:app` 없음.** `:ads:domain` + `:ads:feature` 를 `engagement:app` 에 폴드 (ADR-0093). 불가피한 인프라 변경은 넷 — engagement 메모리 512Mi → 768Mi · 공유 MySQL 에 `ads_db`·계정(기존 볼륨은 1회 수동 SQL) · SealedSecret `ADS_TOKEN_SECRET` · ads 전용 Redis 연결 타임아웃 (spec SR-2)
- **새 등록 도메인·Cloudflare 존 없음.** 1단계 소재는 구조화 필드(이미지·제목·문구·랜딩 URL)만 받고 우리 코드가 렌더 — 광고주 HTML/JS 를 받지 않으므로 쿠키 격리 iframe 이 필요 없다. 외부 퍼블리셔(2단계)에서 별도 도메인이 불가피해진다
- **결정 경로에 외부 호출 없음.** 후보 인덱스는 파드 메모리, 빈도·예산은 Redis
- **과금 집계는 ads 가 소유한다.** analytics ClickHouse 를 읽지 않는다(서비스 간 DB 공유 금지). 원본 이벤트 사본만 analytics 원장으로 보낸다(ADR-0095)
- **실결제 없음.** 크레딧은 가상. 화면에 「가상 크레딧 — 실제 결제 없음」 상시 표기
- **행태 타기팅 없음** (ADR-0078). 타기팅은 지면 + 페이지 문맥 카테고리
- **광고 금지 면 유지**: 메인 `/` · `/portfolio` · resume · 게임 iframe 안 · 광고주 콘솔 자체 (ADR-0076·0064)
- **규제 업권 광고주 차단**: 의료·금융 카테고리 소재는 심사에서 반려 (ADR-0069 기준)
- **표시 의무**: 모든 자체 광고에 「광고」 라벨 (표시광고법)
- **보존기간**: ads MySQL 에는 방문자·회원 단위 이벤트 행이 없다. 방문자 id 는 Redis 빈도 키에 최대 25시간, 이벤트 원장 사본은 analytics 90일 (ADR-0077·0095). `/privacy` §6 에 반영
- OCI 무료 티어 안 (메모리·CPU 는 동시성 축소로 해결, 증설 금지 — free-tier-constraint)

## 확정 결정 (질의 응답 · 기본값)
| 결정 | 값 | 출처 |
|---|---|---|
| 퍼블리셔 | 1989v 서브도메인만 (퍼블리셔 계정 1개) | 사용자 |
| 돈 | 가상 크레딧 복식부기 원장 | 사용자 |
| 광고주 | 로그인 회원 셀프서브 콘솔, 광고주 권한은 `ad_advertiser` 프로필 행 (blog_profile 패턴) | 사용자 + ADR-0072 선례 |
| 크레딧 유입 | 셀프 충전 + 하루 한도 | 사용자 |
| 1단계 형식 | 디스플레이 — AdSlot 4곳 + 게임 목록 HOUSE 자리 | 사용자 |
| game ads 모듈 | 새 도메인이 흡수. HOUSE 는 최하위 우선순위 캠페인으로, REWARDED 는 호출처 0 이라 이관 없이 삭제 | 사용자 |
| 호스트 파드 | `engagement` (경매·pCTR·실험과 같은 성격, content 는 이미 22k줄) | 코드 근거 |
| 콘솔 위치 | portal-fe 호스트 분기 `ads.1989v.com` (새 FE 파드 없음, noindex) | 서브도메인 체크리스트 |
| 경매 | 1차가. eCPM = CPM 입찰 또는 CPC 입찰 × pCTR × 1000, 지면별 최저가 | 기본값 (AdSense 현행) |
| 과금 단위 | CPM 은 **가시 노출**(50%·1초, ADR-0095 노출 정의와 동일) 천 회, CPC 는 유효 클릭 | 기본값 |
| 채움 순서 | 유료 자체 광고 → AdSense(지면 ID 있을 때) → HOUSE | 사용자 + ADR-0076 |
| 소진 통제 | Redis 실시간 차단 + 시간별 정산. 예산 초과분은 광고주에게 청구하지 않는다 | 기본값 |
| 타기팅 | 지면 + 문맥 카테고리(페이지가 보내는 host·카테고리 키). 키워드 매칭은 2단계 | 기본값 |
| 소재 이미지 | MySQL 에 300KB 이하 저장, 내용 해시 URL + 불변 캐시로 Cloudflare 가 서빙 | 기본값 (새 저장소 없음) |

## Non-Goals
- 외부 퍼블리셔 가입·사이트 심사·sellers.json · 별도 서빙 도메인
- RTB·OpenRTB·헤더 비딩·외부 DSP/SSP 연동
- 네이티브(인피드) 광고 · 위치 편향 보정 · 키워드 매칭
- 행태·리타기팅 · 전환 추적(CPA) · 어트리뷰션
- 실결제·환불·퍼블리셔 지급·세무
- CPT 보장형 판매·인벤토리 예측(avails)
- 동영상(VAST) · 보상형 광고(REWARDED — 호출처 0 으로 삭제)
- SIVT(정교한 봇) 탐지 · 사후 대량 회수(clawback) 운영 도구 — 원장은 역분개 거래 유형만 갖는다

## Acceptance Criteria
- [ ] AC-1 로그인 회원이 광고주로 등록하면 `ad_advertiser` 행이 생기고, 전역 Role 은 바뀌지 않는다
- [ ] AC-2 셀프 충전은 하루 한도까지만 성공하고, 초과 요청은 원장에 아무 행도 남기지 않는다
- [ ] AC-3 캠페인은 일예산·총예산·기간·입찰 방식(CPM|CPC)·입찰가·빈도 제한·타기팅 지면/카테고리를 갖고, 잔액보다 큰 일예산도 저장은 되지만 잔액이 비면 게재가 멈춘다
- [ ] AC-4 소재 업로드는 매직 바이트로 판정한 PNG/JPEG · 300KB 이하 · 2000px 이하 · 허용 비율만 받고, 저장 직후 상태는 `PENDING` 이다
- [ ] AC-5 `APPROVED` 소재 + 기간 안 + 예산·잔액 남음 + 빈도 미달 + 지면·카테고리 일치인 후보만 경매에 오르고, 최고 eCPM 이 이기며 최저가 미만은 떨어진다
- [ ] AC-6 유료 후보가 없거나 결정 호출이 실패(빈 200 포함)하면 FE 는 AdSense 지면 ID 가 있으면 AdSense, AdSense 가 unfilled 거나 ID 가 없으면 HOUSE 목록, 그것도 없으면 자리를 숨긴다
- [ ] AC-7 Redis 가 죽으면 결정 API 는 유료 광고를 내지 않고(사유 `redis_unavailable`) 대체 순서로 넘어간다 — 예산·빈도를 모른 채 과금하지 않는다
- [ ] AC-8 광고 결정 서버 처리 P99 ≤ 30ms (파드 안 측정, 후보 인덱스 적중 기준)
- [ ] AC-9 노출·클릭 이벤트는 서명 토큰이 유효하고 처음 쓰이고 방문자 해시가 맞을 때만 과금된다 — 위조·만료·재사용·방문자 불일치·크롤러·속도 초과·Redis 장애는 사유별 거절 카운트만 남긴다
- [ ] AC-9b 로그인한 광고주 본인이 결정 호출에서 자기 광고를 받으면 광고는 보이되 토큰이 과금 안 함으로 서명돼, 비콘·클릭 경로에서 과금되지 않는다(게이트웨이 필터를 거친 신원으로 검증)
- [ ] AC-10 클릭은 서명이 유효하면 DB 의 승인된 소재 랜딩 URL 로 302 하고(만료·재사용은 이동하되 과금 없음), 서명이 틀리거나 소재가 승인 상태가 아니면 `/` 로 보낸다
- [ ] AC-11 원장은 모든 거래의 분개 합이 0 이고, 같은 멱등 키의 거래는 두 번 기록되지 않는다
- [ ] AC-12 시간별 정산은 (캠페인, 시각) 단위로 한 번만 반영되고 재실행해도 잔액이 변하지 않으며, 청구액은 그 날 일예산·총예산을 넘지 않는다
- [ ] AC-13 광고주 리포트(캠페인·소재·일별 노출·클릭·CTR·지출)와 퍼블리셔 리포트(지면·일별 요청·채움률·노출·RPM·수익)가 정산 표와 같은 수치를 낸다
- [ ] AC-14 어드민이 소재를 승인하면 1분 안에 후보 인덱스에 반영되고, 반려는 사유가 광고주에게 보인다. 광고주 정지 시 그 광고주의 모든 캠페인이 1분 안에 게재에서 빠진다
- [ ] AC-15 FE 가 등록부에 없는 지면 키로 요청하면 광고 없음으로 응답하고, 어드민의 「미등록 지면」 목록에 요청 수와 함께 나타난다
- [ ] AC-16 게임 목록 HOUSE 배너가 새 결정 API 의 HOUSE 목록으로 전과 같은 소재 3종을 6초 순환하고 앱 안 링크로 이동하며, 빈도 제한 없이 매 방문 보인다. 전환 릴리스 동안 옛 `/api/v1/ads/placements/{key}` 가 호환 응답을 준다
- [ ] AC-16b 다음 릴리스에서 game 의 ads 코드와 표 3종이 새 마이그레이션으로 제거된다
- [ ] AC-18 광고주 API 는 남의 캠페인·소재 id 로 404 를 내고, 광고주 요청으로는 HOUSE 캠페인·심사 상태를 만들 수 없다
- [ ] AC-19 광고주 문자열은 카드·콘솔·어드민 어디서도 HTML 로 해석되지 않는다
- [ ] AC-20 원장 정산에서 퍼블리셔 몫 + 수수료 = 청구액이 마이크로 단위까지 정확하다
- [ ] AC-17 검증된 광고 이벤트가 ADR-0095 원장(`entity_type=AD`)에 합류한다 — 원장 파이프라인이 없거나 Kafka 가 죽어도 과금·정산은 영향받지 않는다

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| 광고 서빙에는 별도 도메인이 필요하다 | 소재가 우리 코드로 렌더되는 구조화 필드뿐이면 격리할 광고주 코드가 없다 | 1단계 불필요, 2단계(외부 퍼블리셔·HTML 소재)에서 필요 |
| 과금 수치는 analytics 원장에서 읽는다 | 서비스 간 DB 공유 금지 + ADR-0095 가 아직 제안 상태 | ads 가 자기 카운터·시간별 집계로 과금, analytics 는 사본 |
| 새 서비스가 필요하다 | engagement 가 Redis·Kafka·스케줄링을 이미 갖고 있다(스케줄러 풀만 1 → 4) | 폴드. 인프라는 메모리 등급·스키마·시크릿·Redis 타임아웃 |
| 광고 이미지는 오브젝트 스토리지가 필요하다 | 소재 수가 작고 크기 상한을 둘 수 있다 | MySQL + 해시 URL 불변 캐시 |
| 노출 = 렌더 | 스쳐 간 것을 과금하면 광고주 불리, ADR-0095 는 50%·1초를 노출로 정의 | 과금 노출 = 가시 노출 |

## Existing Code to Reference
- 폴드 호스트: `engagement/app/src/main/kotlin/com/kgd/engagement/EngagementApplication.kt:13` (scanBasePackages), `wishlist/feature/.../WishlistDataSourceConfig.kt` (비-primary 도메인 EMF/TM + `ScopedFlywayMigrator` — experiment 쪽은 `@Primary` 라 견본이 아니다)
- 파드 게이트: 루트 `build.gradle.kts:610-622` `verifyPodTopology` (새 `:app` 이 아니므로 통과 대상)
- 레이어 견본: `inventory/feature` (ADR-0083)
- 광고주 권한 행: `blog/feature/src/main/resources/blogdb/migration/V1__blog.sql:14` · `BlogProfile.canWrite()`
- 흡수 대상: `game/domain/.../ads/model/*` · `game/feature/.../ads/*` · `gamedb/migration/V6__ads_house.sql` · `V8__seed_rewarded_placement.sql` · 게이트웨이 `game-ads` 라우트 `GatewayRouteConfig.kt:370`
- FE 지면: `portal-fe/src/components/ads/AdSlot.tsx` · `adsenseLoader.ts` · `seo/copy.mjs:1060-1113` · `pages/games/HouseBanner.tsx`(`GamesPage.tsx:249`)
- 크롤러 판정: `analytics/.../presentation/event/CrawlerUserAgents.kt` (deal `BOT_PATTERN` 과 합쳐 세 번째 사용 — common 으로 올린다)
- 클릭 리다이렉트 선례: `deal/feature/.../DealRedirectController.kt:30` (302 · no-store · noindex, 기록 실패가 이동을 막지 않음)
- 노출 감지·원장: ADR-0095 · `portal-fe/src/analytics/tracker.ts` · `common/.../analytics/AnalyticsEvent.kt`
- 어드민 심사 큐 견본: `admin/frontend/src/pages/blog/BlogAuthorsPage.tsx`
- 이미지 업로드 선례: `gifticon/.../GifticonController.kt:25` (`MultipartFile`) · `ImageStoragePort`

## Visual Assets
`planning/visuals/` 비어 있음. 콘솔·광고 카드 시안은 구현 전 목표 이미지로 확인받는다 (image-sample-before-code).

## Ontology (candidate glossary terms)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Advertiser | core | kind(MEMBER/SYSTEM), memberId?, status(ACTIVE/SUSPENDED), displayName | 1:N Campaign, MEMBER 는 지갑 원장 계정 1개 |
| Campaign | core | name, status(DRAFT/ACTIVE/PAUSED/ENDED), bidType(CPM/CPC), bidMicros, dailyBudget, totalBudget?, startAt, endAt, freqCapPerDay | N:1 Advertiser, 1:N Creative, N:M AdPlacement, N:M ContextCategory. 우선순위는 광고주 종류에서 파생 |
| Creative | core | (PAID) title, body, landingUrl, assetHash / (HOUSE) title, body, emoji, link, assetHash? · reviewStatus(PENDING/APPROVED/REJECTED/ARCHIVED), rejectReason | N:1 Campaign |
| AdPlacement | core | key(kebab), host, format, floorMicros, active, description | 지면. common `Placement`(노출 위치)와 다른 개념 |
| ContextCategory | supporting | code, 매핑(contextKey → code) | ads 소유 고정 목록 |
| ImpressionToken / ClickToken | supporting | kind, decisionId, campaignId, creativeId, advertiserId, placementKey, chargeMicros, billable, visitorHash, issuedAt, keyId | 서명·종류별 1회 |
| CreativeHourly / AdPlacementHourly | supporting | 시각별 노출·클릭·지출 / 요청·유료 채움·최종 채움 출처 | 정산·리포트 원천 |
| LedgerAccount / LedgerTransaction / LedgerEntry | core | type, idempotencyKey, amountMicros, actor | 복식부기. 퍼블리셔는 원장 계정으로만 존재 |

> `hns:glossary` 로 `ads/glossary.md` 에 등록한다 — 여기서 사전을 따로 유지하지 않는다.

## Ontology Convergence
| Round | Entities | New | Changed | Stable | Stability |
|-------|----------|-----|---------|--------|-----------|
| 1 | 8 | 8 | - | - | - |
| 2 (리뷰 반영) | 8 | 1 (ContextCategory) | 3 (Placement→AdPlacement, ServeToken→Impression/ClickToken, DeliveryHourly→CreativeHourly/AdPlacementHourly) | 4 | 0.88 |

## Interview Transcript
<details><summary>Full Q&A (1 round + 범위 질의)</summary>

### 범위 질의
**Q:** 퍼블리셔 범위 / 돈 / 광고주 유입
**A:** 우리 서브도메인 먼저 · 가상 크레딧 원장 · 셀프서브 콘솔

### Round 1 (Round 0 토폴로지 확인 + 결정 3건 묶음 — 사용자 하네스 「한 번에 묶어 묻는다」)
**Q:** 구성 요소 다섯 / game ads 처리 / 1단계 형식 / 크레딧 유입
**A:** 다섯 그대로 · 새 도메인이 흡수 · 디스플레이 먼저 · 셀프 충전 + 일 한도
**Ambiguity:** 16%

</details>
