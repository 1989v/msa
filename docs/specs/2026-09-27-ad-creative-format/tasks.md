# Task Breakdown: 광고 형태(카드·띠배너)와 드래그 업로드

## Overview
Total Task Groups: 7 · 스펙 `spec.md` 개정 3 · 테스트 `planning/test-quality.md` 개정 3
표준: `docs/standards/test-rules.md`(Kotest BehaviorSpec + MockK, `*Test`/`*IntegrationSpec`), `docs/conventions/package-structure.md`(ADR-0083), `ads/CLAUDE.md`, DESIGN.md 토큰(hex 금지).
**전체 테스트 스위트를 돌리지 않는다** — 그룹마다 명시한 태스크만.

### Task Group 1: 도메인 — 형태 규격·캠페인 형태·소재 내용·경매
**Dependencies:** None · **Phase:** ① · **Required Skills:** kotlin, ddd
- [x] 1.0 Complete 도메인
  - [x] 1.1 테스트 U1~U7 (`AdPlacementTest`·`CampaignTest`·`CreativeTest`·`CreativeImageRulesTest`·`AuctionTest` 확장, 픽스처 `AdsDomainFixtures.placement(...)` 를 형태 규격 목록 인자로 — 기본 CARD 1.91:1 0.10)
  - [x] 1.2 `FormatSpec` VO, `AdPlacement.formats`(형태당 하나·최소 하나·최저가 ≥1,000), `spec(format)`·`fitsImage(format, w, h)`·`accepts(format, ratio)`·규격 추가/최저가 변경/제거, `representative()`(CARD 있으면 CARD). `PlacementFormat` KDoc 「광고 형태」
  - [x] 1.3 `Campaign.creativeFormat`(생성 시 고정, 수정 불가), `requirePaidTargeting`·`verifyTargeting` 을 (지면, 형태) 규격으로, HOUSE 면제
  - [x] 1.4 `PaidContent` 봉인 하위 계층(`PaidCreativeContent` | `BannerCreativeContent(altText, landingUrl, imageHash)`), `Creative.submit(campaign, PaidContent)` 에서 형태↔종류 대조, HOUSE 는 `HouseCreativeContent` 그대로
  - [x] 1.5 `CreativeImageRules.inspect` 비율을 형태 규격으로(유료) / 지면 어느 규격이든(HOUSE)
  - [x] 1.6 `Auction`·`AuctionCandidate` 에 형태, 최저가는 후보 형태 규격
  - [x] 1.7 Verify: `./gradlew :ads:domain:test`
**Acceptance:** U1~U7 초록, 회귀 주입 표의 도메인 행(형태 최저가 2종·비율 합집합·HOUSE 면제) 빨간불 확인

### Task Group 2: 영속·마이그레이션 V4
**Dependencies:** 1 · **Phase:** ① · **Required Skills:** jpa, flyway
- [x] 2.0 Complete 영속
  - [x] 2.1 테스트 I1·I2(유지)·I9 — `AdsSchemaIntegrationSpec` 확장(Flyway target=3 → 비시드 지면 → V4)
  - [x] 2.2 `V4__ads_creative_format.sql`: `ad_placement_format` 백필, `ad_campaign.creative_format` DEFAULT 'CARD', 시드(SR-1), `game-list-banner` 옛 컬럼 6.4:1/50000·`paid_allowed` 그대로 FALSE
  - [x] 2.3 `PlacementFormatJpaEntity` + **한 로더**(어드민·인덱스 어댑터 공용), 저장 시 옛 컬럼에 대표 규격
  - [x] 2.4 `CampaignJpaEntity.creativeFormat`, 소재 행 변환 `toDomain(kind, campaignFormat)` 을 두 어댑터가 공유(BANNER 는 `body=''`)
  - [x] 2.5 Verify: `./gradlew :ads:feature:test --tests '*AdsSchema*' --tests '*CreativeUpload*'` + `:engagement:app:test --tests '*AdsSchemaIntegrationSpec*'`
**Acceptance:** I1·I2·I9 초록

### Task Group 3: 결정·API
**Dependencies:** 2 · **Phase:** ① · **Required Skills:** spring
- [x] 3.0 Complete 결정·API
  - [x] 3.1 테스트 I3~I8 (`AdvertiserApiIntegrationSpec`·`CandidateIndexIntegrationSpec`·`DecisionIntegrationSpec`(I5 는 :88 유지)·`AdminApiIntegrationSpec`(:190-220 단언 유지)·정산 경로), 회원 id 12xxx
  - [x] 3.2 `CandidateIndexService` (지면, 캠페인 형태) 사전 필터, `PaidCandidate.content: PaidContent`
  - [x] 3.3 결정 응답 `format`, BANNER `title`=대체 텍스트·`body`=''
  - [x] 3.4 카탈로그: 형태 규격 목록 + 업로드 규칙(형식·바이트·픽셀·허용 오차) + 옛 필드(대표 규격)
  - [x] 3.5 캠페인 생성 `creativeFormat`(없으면 CARD), 수정은 형태 무시. 소재 multipart: BANNER 는 `title`=대체 텍스트, body 무시
  - [x] 3.6 어드민 지면 API: 규격 추가·최저가 변경·제거 + 응답 옛 필드 + 옛 모양 PATCH → 대표 규격, 감사 요약 형태별
  - [x] 3.7 Verify: `./gradlew :ads:feature:test` (ads 모듈 한정) + `:engagement:app:test --tests '*EngagementContextLoadSpec*'`
**Acceptance:** I3~I8 초록, 회귀 주입(행 변환·인덱스 최저가) 빨간불 확인

### Task Group 4: 문서 (①)
**Dependencies:** 3
- [x] 4.1 `ads/glossary.md`(SR-9), ADR-0098 개정, `ads/CLAUDE.md` 릴리스·되돌리기 절(되돌리기 SQL 은 이 파일의 SQL 블록이 원본 — I1 이 읽는다)
- [ ] 4.2 **릴리스 ①**: 커밋·푸시(백엔드만) → 운영 V4·결정 `format`·카탈로그 확인

### Task Group 5: portal-fe (②)
**Dependencies:** 3 의 API 계약(코드는 병행 가능, 푸시는 ① 확인 뒤)
- [x] 5.0 Complete portal-fe
  - [x] 5.1 테스트 C1~C5 (`adsApi`·`AdSlot`·`HouseBanner`·`AdsConsolePage`·업로드)
  - [x] 5.2 `parseAd` format(없으면 CARD), `BannerAd` 컴포넌트(이미지 밖 「광고 · 광고주」, rel sponsored, useImpression, aspect-ratio 6.4)
  - [x] 5.3 `AdSlot` 형태 분기, `HouseBanner` 유료 BANNER 우선·aria 「광고」/「홍보」·fill PAID
  - [x] 5.4 콘솔: 형태 선택(새 캠페인만), 규격 있는 지면만·바꾸면 빠진 지면 알림·사라진 규격 해제, 형태별 문구·도식(`campaignGuide` 에 game-list-banner)·최저가
  - [x] 5.5 소재 패널: 드롭 영역 + 헤더 파서(`imageHeader.ts` — 앞 바이트 형식·PNG IHDR·JPEG SOF), 검사 순서·전송 차단·실제/허용 값·권장 크기·모바일 56px 안내, 여러 파일·창 기본 동작·고치기 취소·종료 캠페인 숨김, 업로드 규칙은 카탈로그에서
  - [x] 5.6 Verify: `npx tsc --noEmit -p tsconfig.app.json` + `npx vitest run src/components/ads src/pages/ads src/pages/games`
**Acceptance:** C1~C5 초록, 회귀 주입(parseAd·검사 실패 전송·디코딩 판정) 빨간불

### Task Group 6: admin-fe (②)
**Dependencies:** 3 의 API 계약
- [x] 6.1 테스트 C6
- [x] 6.2 지면 화면 형태 규격 표 편집·추가·제거, 심사 화면 BANNER 미리보기 + 대체 텍스트
- [x] 6.3 Verify: `admin/frontend` 의 `npx tsc --noEmit` + `npx vitest run src/pages/ads`

### Task Group 7: 릴리스 ② · ②' · 운영 검증
**Dependencies:** 4.2 운영 확인, 5, 6
- [ ] 7.1 CDP V1(360·390·1280 × 라이트·다크, 띠배너 높이 예약·「광고」 대비) — 목데이터 렌더 + 운영 스타일시트
- [ ] 7.2 **릴리스 ②**: FE·어드민만 커밋·푸시 → 번들에 새 심볼 확인
- [ ] 7.3 **②'**: 어드민 API 로 `game-list-banner` `paid_allowed` 켬 → 결정 응답·카탈로그 확인
- [ ] 7.4 E1(사용자 로그인 필요)은 요청만

## Execution Order
1 → 2 → 3 → 4(릴리스 ①) ‖ 5·6 병행 개발 → 7(릴리스 ② → ②')
