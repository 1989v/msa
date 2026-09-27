# 회귀 주입 기록 — 광고 형태 (그룹 1~3, 백엔드)

2026-09-27. 작업 파일에 회귀를 넣고 해당 테스트만 돌려 빨간불을 본 뒤, 원본으로 되돌렸다(되돌린 뒤 주입 문자열이 파일에 없는 것을 grep 으로 확인).
표의 「주입」은 실제로 바꾼 코드 한 줄이다. 「빨간불」은 Gradle 출력의 실패 테스트 이름 그대로다.

| # | 대상 (test-quality 표) | 주입 | 명령 | 빨간불 |
|---|---|---|---|---|
| 1 | 형태 최저가 — 대표(카드) 최저가 사용 | `Campaign.requirePaidTargeting`: `spec.floorMicros` → `placement.representative().floorMicros` | `:ads:domain:test --tests '*CampaignTest*'` | 28 중 3 실패 — 「띠배너 캠페인이 띠배너 최저가와 같은 CPM 0.05 로 입찰하면 → 저장된다」, 「유료 캠페인 내용을 고치면 → 형태는 그대로다」, 「캠페인 형태의 최저가가 입찰가보다 높아졌으면 → 재개를 거절하고, 다른 형태의 최저가 변경은 영향이 없다」 (U2·U3) |
| 2 | 형태 최저가 — 대표(카드) 최저가 사용 (인덱스) | `CandidateIndexService`: `candidate.ecpmMicros >= spec.floorMicros` → `>= placement.representative().floorMicros` | `:ads:feature:test --tests '*CandidateIndexIntegrationSpec*'` | 8 중 1 실패 — 「eCPM 0.07 띠배너는 남고 같은 eCPM 의 카드는 빠진다 — 띠배너 행은 (광고주 종류, 캠페인 형태)로 읽힌다」 (I4) |
| 3 | 형태 최저가 — 두 형태 최저가 중 최솟값 | `Campaign.requirePaidTargeting`: 비교값을 `placement.formats.minOf { it.floorMicros }` | `:ads:domain:test --tests '*CampaignTest*'` | 28 중 1 실패 — 「카드 캠페인이 같은 지면에 0.05 로 입찰하면 → 거절 — 카드 최저가 0.10 을 따른다」 (U2) |
| 4 | 형태 최저가 — 최솟값 (경매) | `Auction.admits`: `spec.floorMicros` → `formats.minOf { it.floorMicros }` | `:ads:domain:test --tests '*AuctionTest*'` | 18 중 1 실패 — 「eCPM 0.07 인 띠배너와 카드가 있으면 → 띠배너는 … 남고, 카드는 카드 최저가(0.10)에 걸려 빠진다」 (U7) |
| 5 | 비율 — 형태 규격 대신 지면 규격 합집합 | `CreativeImageRules.inspect` PAID: `fitsImage(format, w, h)` → `fitsAnyFormat(w, h)` | `:ads:domain:test --tests '*CreativeImageRulesTest*'` | 6 중 2 실패 — 「띠배너 캠페인이 1.91:1(1200×628)을 올리면 → 거절한다」, 「카드 캠페인이 6.4:1 을 올리면 → 거절한다」 (U6) |
| 6 | HOUSE 면제 — 시작·재개에 형태 검사 | `Campaign.verifyTargeting`: HOUSE 에도 `spec(creativeFormat) == null` 이면 거절 | `:ads:domain:test --tests '*CampaignTest*'` | 28 중 1 실패 — 「형태 기본값(카드)의 HOUSE 캠페인이 띠배너 전용 지면을 타기팅하면 → 저장·시작·재개가 된다」 (U4) |
| 7 | HOUSE 면제 — 이미지에 형태 검사 | `CreativeImageRules.inspect` HOUSE: `fitsAnyFormat` → `fitsImage(campaign.creativeFormat, …)` | `:ads:domain:test --tests '*CreativeImageRulesTest*'` | 6 중 1 실패 — 「HOUSE 캠페인 / 지면의 어느 규격에든 맞는 이미지면 → 형태와 무관하게 통과한다」 (U6 HOUSE — test-quality 의 U5 HOUSE 짝) |
| 8 | HOUSE 면제 — 인덱스에 형태 검사 | `CandidateIndexService` HOUSE 분기에 `&& placement.spec(campaign.creativeFormat) != null` | `:ads:feature:test --tests '*DecisionIntegrationSpec*' --tests '*AdminApiIntegrationSpec*'` | 29 중 3 실패 — `DecisionIntegrationSpec` 「등록된 지면에 승인된 유료 소재가 있으면 → … HOUSE 전용 지면은 HOUSE 목록을 …」(:88 의 HOUSE 3종 단언, I5), 「ads Redis 가 응답하지 않으면 → … HOUSE 는 그대로 준다」, `AdminApiIntegrationSpec` 「HOUSE 캠페인·소재 → … 그 지면의 HOUSE 목록에 나온다」(:190-220 구간) |
| 9 | 행 변환 — 광고주 종류만으로 내용 종류 결정 | `CreativeJpaEntity.toDomain`: `BANNER -> BannerCreativeContent(...)` → `BANNER -> PaidCreativeContent(title, body, …)` | `:ads:feature:test --tests '*CandidateIndexIntegrationSpec*' --tests '*AdvertiserApiIntegrationSpec*'` | 36 중 2 실패 — `AdvertiserApiIntegrationSpec` 「띠배너 캠페인: 6.4:1 소재만 받고 …」(AssertionFailedError :434, I3·I9), `CandidateIndexIntegrationSpec` 「eCPM 0.07 띠배너는 남고 …」(NullPointerException :109 — 띠배너 행이 인덱스에서 빠져 광고 없음, I4) |
| 10 | 시드 — V4 가 `game-list-banner` 유료를 켬 | `V4__ads_creative_format.sql`: 옛 컬럼 UPDATE 에 `, paid_allowed = TRUE` | `--continue :ads:feature:test --tests '*AdsSchemaMigrationIntegrationSpec*' :engagement:app:test --tests '*AdsSchemaIntegrationSpec*'` | `AdsSchemaMigrationIntegrationSpec` 8 중 1 「게임 목록 위는 띠배너 6.4:1 0.05 하나이고 옛 컬럼도 같은 값 — 유료는 꺼진 채다」(I1), `AdsSchemaIntegrationSpec` 7 중 1 「지면 시드는 넷이고 deal-hub-end 는 없으며 game-list-banner 만 유료 불가다」(I2 핀) |
| 11 | 되돌리기 SQL (문서가 원본인지) | `ads/CLAUDE.md` 의 SQL 블록에서 `, c.body = c.title` 삭제 | `:ads:feature:test --tests '*AdsSchemaMigrationIntegrationSpec*'` | 8 중 1 실패 — 「띠배너 캠페인의 소재는 보관되고 설명이 제목으로 채워진다 — 옛 코드가 읽을 수 있는 행이 된다」 — 검사가 문서의 SQL 을 읽는다는 증거 (I1) |

FE 행(업로드 전송 차단·`parseAd`·헤더 대신 디코딩)은 그룹 5 의 몫이라 여기 없다.

## 되돌린 뒤

- 주입 문자열 부재: `representative().floorMicros`·`minOf`·`spec(campaign.creativeFormat) != null`·`paid_allowed = TRUE` 가 해당 파일에 0건, `c.body = c.title` 은 `ads/CLAUDE.md` 에 1건
- 전체 초록은 주입 전에 확인했다: `:ads:domain:test` 120/120, `:ads:feature:test` 135/135, `:engagement:app:test` (`AdsSchemaIntegrationSpec` 7 · `EngagementContextLoadSpec` 8)
