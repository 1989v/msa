# Engineer Review — Implementation

대상: `docs/specs/2026-09-27-ad-creative-format/spec.md`
차원: 구현 가능성 (체크리스트 `hns/0.16.1/skills/spec-review/reviewers/implementation/checklist.md`)
근거 범위: ads domain·feature 코드, `adsdb/migration` V1~V3, portal-fe `components/ads`·`pages/ads`·`pages/games/HouseBanner.tsx`, admin `pages/ads`,
배포 `k8s/base/engagement/deployment.yaml`, KB `1989v/raw/msa-ad-network-record.md`

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | 참조 클래스·모듈 존재 | 통과 — `AdPlacement`·`AspectRatio.fits`·`CreativeImageRules.inspect`·`Auction.run`·`CandidateIndexService`·`DecisionService`·`AdSlot`·`AdCard`·`useImpression`·`HouseBanner`·`CampaignEditor`·`campaignGuide.ts`·`CreativesPanel`·`AdsPlacementsPage`·`AdsReviewPage` 모두 있다. 1.91:1 과 6.4:1 은 허용 오차 1%(`AspectRatio.kt:20`)로 겹치지 않는다 |
| 2 | 기존 코드와 충돌 | **이슈 2건** (I-1, I-2) |
| 3 | 복잡도 위험 | 경미 1건 (I-5) |
| 4 | NFR 안티패턴 | 통과 — 결정 경로는 계속 메모리 인덱스만 읽는다. 규격 표는 `CandidateSourceAdapter.load` 한 트랜잭션에 한 번 더 읽는 것이라 N+1 이 아니다(`CandidateSourceAdapter.kt:56-103`) |
| 5 | 마이그레이션·롤백 전략 | **이슈 2건** (I-3, I-4) |
| 6 | 동시성 | 경미 1건 (I-6) |

단일 우승자 모양(SR-4)은 지금 코드에 그대로 얹힌다. `Auction.run` 이 지면마다 `minWithOrNull(RANKING)` 하나를 고르고(`Auction.kt:21-30`),
응답도 지면당 `ad` 하나다(`DecisionDtos.kt:35-39`). 필터 두 곳만 형태를 알면 된다.
- `Auction.kt:24` — `placement.floorMicros`·`placement.accepts` → (지면, 후보 형태) 규격
- `CandidateIndexService.kt:76,84` — `placement.aspectRatios`·`placement.floorMicros` → 같은 규격

`AuctionCandidate` 에 형태 필드를 더해야 한다(`AuctionCandidate.kt:7-14`). 스펙에는 이 필드가 빠져 있지만 구현하면서 자연히 드러나는 부분이라 이슈로 올리지 않는다.

## 이슈

### I-1 (충돌) HOUSE 캠페인에 형태 규격 검사가 걸리면 게임 목록 배너가 꺼진다
- 근거
  - V1 시드 HOUSE 캠페인은 `game-list-banner` 만 타기팅한다(`V1__ads.sql:295-300`). V4 에서는 `creative_format` 기본값을 받아 **CARD** 가 된다(SR-8)
  - V4 뒤 `game-list-banner` 에는 BANNER 규격만 남는다(SR-1)
  - `verifyTargeting` 은 HOUSE 에도 불린다 — `CampaignRules.apply` START/RESUME(`CampaignRules.kt:34-40`)을 `HouseCampaignService.changeStatus` 가 부른다(`HouseCampaignService.kt:58`)
  - SR-2 는 「고른 지면마다 (지면, 캠페인 형태) 규격이 있어야」 한다고 적었고, 우선순위 구분이 없다
- 결과
  - 이 검사를 `verifyTargeting` 에 그대로 넣으면 HOUSE 배너 캠페인을 멈춘 뒤 다시 켤 수 없다
  - 인덱스가 HOUSE 후보에도 규격 필터를 걸면(`CandidateIndexService.kt:70-72`) 게임 목록 배너가 바로 빈다
- 수정안: SR-2·SR-4 에 한 줄 — 「형태 규격(존재·최저가·비율)은 PAID 에만 적용한다. HOUSE 는 형태와 무관하게 지금처럼 지면 키만 확인한다(`verifyTargeting` 의 PAID 분기 안, 인덱스의 `PaidCreativeContent` 분기 안)」

### I-2 (충돌) 옛 컬럼을 「읽지 않는다」만 적혀 있고 쓰기가 정해지지 않았다 — 지면 생성 INSERT 가 깨진다
- 근거
  - `ad_placement.format`·`aspect_ratios`·`floor_micros` 는 `NOT NULL` 이고 기본값이 없다(`V1__ads.sql:109-111`)
  - 어드민 지면 생성은 행 전체를 INSERT 한다(`PlacementService.kt:57-69` → `PlacementRepositoryAdapter.kt:34`)
  - SR-8 은 「코드는 더 읽지 않고」만 적었다
- 결과: 엔티티에서 세 컬럼을 빼면 새 지면을 만들 때 `Field 'format' doesn't have a default value` 로 실패한다
- 수정안: 둘 중 하나를 SR-8 에 명시한다
  - (a) V5 전까지 엔티티가 옛 세 컬럼을 **대표 규격 값으로 계속 쓴다**. 대표는 CARD, 없으면 BANNER 로 한다. 이 방식은 I-4 의 되돌리기에도 도움이 된다
  - (b) V4 에서 세 컬럼에 `DEFAULT` 를 준다

  (a) 가 되돌리기까지 덮어 더 낫다

### I-3 (마이그레이션) 롤링 배포 창에서 옛 파드와 V4 데이터가 섞이는 경우가 스펙에 없다
engagement 는 `replicas: 1` + 기본 RollingUpdate 다(`k8s/base/engagement/deployment.yaml:12`).
새 파드가 기동 때 V4 를 적용하는 동안 옛 파드가 계속 결정·콘솔을 처리하고, 30초마다 인덱스를 다시 읽는다.

- (a) `game-list-banner` 의 `paid_allowed` 가 TRUE 가 된다
  - 옛 파드는 옛 컬럼 `format=BANNER, aspect_ratios=1.91:1, floor=100000` 을 읽는다(`V1__ads.sql:280`)
  - 그래서 창 안에서 옛 콘솔이 **CARD 캠페인이 game-list-banner 를 타기팅하는 것**을 받아 준다(`Campaign.kt:160-168`)
  - 창이 끝나면 이 캠페인은 새 규칙으로 (game-list-banner, CARD) 규격이 없는 상태가 된다
  - 수정안
    - V4 가 `game-list-banner` 의 옛 컬럼도 `6.4:1`·`50000` 으로 함께 바꾼다고 적는다. 그러면 옛 파드도 1.91:1 이미지를 거절한다(`CreativeImageRules.kt:36`)
    - SR-4 에 「규격 없는 (지면, 형태) 조합은 후보에서 뺀다(시작·재개 때는 `verifyTargeting` 이 거절)」를 명시한다
- (b) 창 안에서 새 파드가 만든 규격 없는 지면
  - 옛 파드가 만든 지면은 `ad_placement_format` 행이 없다
  - 새 `AdPlacement` 불변식(규격 1개 이상)에 걸려 인덱스에서는 빠진다(`CandidateSourceAdapter.kt:84` 의 `skipInvalid`)
  - 반면 어드민 목록 `PlacementRepositoryAdapter.findAll`(`:25`)은 skip 이 없어 500 이 난다
  - 운영자 전용이고 창이 짧아 문서화로 충분하다. 「배포 중 지면 생성 금지」 한 줄을 넣는다

### I-4 (마이그레이션) 되돌리기 전략이 없다 — BANNER 소재가 하나라도 생기면 이미지 롤백이 목록 API 를 깬다
- 근거
  - V4 뒤 `ad_creative.body` 가 NULL 인 행(SR-8)을 옛 코드가 읽는다고 해 보자. 옛 코드에서 `CreativeJpaEntity.body` 는 non-null `String`(`CreativeJpaEntity.kt:41-42`)이다
  - `toDomain` 에서 NPE 가 나고, 빈 문자열이어도 `requireText` 가 던진다(`CreativeContent.kt:18`)
  - 인덱스는 `skipInvalid` 로 그 행만 뺀다(`CandidateSourceAdapter.kt:77`)
  - 광고주 소재 목록(`CreativeService.kt:47`)·어드민 심사 목록은 skip 이 없어 **캠페인 단위·큐 단위로 500** 이 된다
- 수정안: SR-8 에 되돌리기 절을 둔다 — 「BANNER 소재가 생긴 뒤에는 이미지 롤백 대신 앞으로 고친다. 롤백이 필요하면 BANNER 소재를 ARCHIVED 로 먼저 돌린다」
- 함께 검토할 단순화: `body` 를 NULL 허용으로 바꾸지 말고 BANNER 는 `''` 로 저장한다
  - 스키마 변경 하나와 Kotlin nullable 전파(`CreativeContent.body: String`, `CreativeContent.kt:8`)가 빠진다
  - 응답도 SR-4 대로 어차피 `""` 다
  - 롤백 위험은 같다. 판단 근거는 Occam

### I-5 (복잡도·순서) FE와 백엔드 배포 순서와 옛 번들 꼬리가 적혀 있지 않다
- 새 백엔드 + 옛 FE(열려 있는 탭, CDN 캐시)
  - 옛 `parseAd` 는 `body: ""` 를 받아(`adsApi.ts:137`) BANNER 를 `AdCard` 로 그린다. 6.4:1 이미지가 카드 틀에 들어간 채 과금된다
  - 옛 `HouseBanner` 는 `ad` 를 보지 않는다(`HouseBanner.tsx:15-18`). 그런데 서버는 `game-list-banner` 우승을 `paid_filled` 로 세고(`DecisionService.kt:252`) 그 캠페인을 같은 페이지 다른 지면에서 뺀다(`Auction.kt:20,29`)
- 새 FE + 옛 백엔드
  - SR-5 대로 「모르는 형태면 버린다」를 그대로 구현하면, `format` 이 없는 옛 응답의 유료 광고를 전부 버린다
- 수정안
  - SR-5 에 「`format` 이 없으면 CARD 로 읽는다」를 추가한다
  - 릴리스 순서 「백엔드(V4) → FE」를 적는다. 옛 콘솔은 형태 필드를 보내지 않아 기본 CARD 가 되므로, 새 FE 전에는 BANNER 캠페인이 생기지 않는다. 그래서 이 순서면 위 문제가 생기지 않는다
  - BANNER 는 옛 번들 꼬리를 받아들인다는 것을 명시한다

### I-6 (동시성, 경미) 「소재가 있으면 형태 변경 불가」는 확인하고 나서 바꾸는 구조다
- 근거
  - 소재 생성은 캠페인을 잠금 없이 읽는다(`CreativeService.kt:56`)
  - 형태 변경 경로도 소재 수를 따로 센다. 두 요청이 겹치면 CARD 소재가 BANNER 캠페인에 남을 수 있다
  - 인덱스가 비율 불일치로 그 소재를 조용히 빼므로 돈 문제는 아니다
- 수정안(택일)
  - 형태 변경과 소재 생성이 같은 캠페인 행을 `FOR UPDATE` 로 잡는다
  - 혹은 이 한계를 스펙에 적는다

## 판정 근거
- BLOCK 사유는 없다. 스펙 결정이 코드·문서 규칙을 어기지 않는다. V1~V3 은 고치지 않고, 옛 컬럼을 남겨 롤링 배포를 배려한 방향도 맞다
- I-1·I-2 는 구현자가 스펙을 글자대로 따르면 운영 결함(게임 배너 소실, 지면 생성 실패)이 나는 공백이라 REVISE 다
- I-3~I-5 는 배포·되돌리기 절을 보강하면 된다

VERDICT: REVISE

## Round 2

대상: spec 개정 2 (2026-09-27). 1차 여섯 건의 해소 여부를 확인하고, 개정 2 에서 새로 생긴 문제를 찾았다.

### 1차 이슈 해소 여부

| # | 판정 | 근거 |
|---|---|---|
| I-1 HOUSE 면제 | 해소 | SR-2 `spec.md:31`(존재·최저가·비율 모두 면제, 지면 키만 확인), SR-4 `spec.md:42`(인덱스 형태 필터 제외). HOUSE 시드 소재는 이미지가 없다(`V1__ads.sql:306-311`). 그래서 「어느 규격에든 맞으면」 규칙도 지금 데이터와 부딪히지 않는다 |
| I-2 옛 컬럼 쓰기 | 해소 | SR-8 `spec.md:69`: 대표 규격(CARD 우선, 없으면 첫 규격)을 옛 컬럼에 계속 쓴다. 지면 생성 INSERT(`PlacementRepositoryAdapter.kt:34`)가 NOT NULL 컬럼을 채운다 |
| I-3 롤링 창 | 해소 | (a) V4 가 `game-list-banner` 옛 컬럼을 `BANNER`·`6.4:1`·`50000` 으로 맞춘다(`spec.md:68`). (b) 롤아웃 중 지면 생성 금지(`spec.md:70`). 규격 없는 조합은 후보에서 빠진다(`spec.md:42`) |
| I-4 body·되돌리기 | **부분 해소** | `body` 를 NOT NULL 로 두고 `''` 로 쓰는 쪽을 골랐다(`spec.md:35,68`). 되돌리기 절도 생겼다(`spec.md:71`). 다만 거기 적힌 처방이 옛 코드에서 먹히지 않는다 → R2-1 |
| I-5 릴리스 순서 | 해소, 파생 공백 1건 | `format` 없으면 CARD(`spec.md:48`). ①과 ②를 따로 푸시하고, 그 사이 옛 번들의 BANNER 꼬리를 받아들인다(`spec.md:70`). 다만 ①~② 사이 옛 콘솔·어드민 번들이 새 API 모양을 읽는 경우가 빠졌다 → R2-3 |
| I-6 형태 변경 경쟁 | 해소(문제 자체가 사라짐) | 형태는 만들 때 정하고 바꿀 수 없다(`spec.md:29`). 소재 수를 보고 판정하는 과정이 없어져 잠금도 필요 없다 |

### R2-1 (롤백) 「BANNER 소재를 먼저 ARCHIVED 로」로는 옛 코드의 목록 500 을 막지 못한다
- 스펙: `spec.md:71` — 「①을 되돌려야 하면 BANNER 소재를 먼저 ARCHIVED 로 돌린다(옛 코드의 소재 목록이 빈 설명을 거절한다)」
- 코드
  - 옛 코드의 캠페인 소재 목록은 상태로 거르지 않는다. `findAllByCampaign` → `creativeRepository.findAllByCampaignId`(`CreativeRepositoryAdapter.kt:24`, `CreativeJpaRepositories.kt:12`)라서 ARCHIVED 행도 읽는다
  - 옛 `toDomain` 은 MEMBER 광고주의 모든 행을 `PaidCreativeContent(title, body, …)` 로 만든다(`CreativeJpaEntity.kt:75-76`). 생성자가 `requireText` 에서 `body.isBlank()` 를 거절한다(`CreativeContent.kt:18`)
  - 목록 경로에는 `skipInvalid` 가 없어서, 한 행이 던지면 그 캠페인 목록 전체가 500 이 된다(`CreativeService.kt:47`). `findById`(`CreativeRepositoryAdapter.kt:19`)를 쓰는 상세·자산 조회(`CreativeService.kt:50-51,93-94`)도 같이 깨진다
- 결과: 운영자가 절차를 그대로 따라도, 롤백 뒤 BANNER 캠페인 소유자의 소재 화면은 계속 500 이다
- 수정안: SR-8 되돌리기 절을 이렇게 고친다
  - 「①을 되돌리기 전에 BANNER 캠페인의 소재를 ARCHIVED 로 돌리고 **`body` 를 비어 있지 않은 값으로 채운다**」
  - 예: `UPDATE ad_creative c JOIN ad_campaign a ON a.id = c.campaign_id SET c.status = 'ARCHIVED', c.body = c.title WHERE a.creative_format = 'BANNER'`
  - `title` 은 1~40자라서 `body` 한도 90자에 들어간다. ARCHIVED 라서 옛 인덱스도 이 행을 내보내지 않는다

### R2-2 (충돌, 신규) 행을 도메인으로 바꿀 때 내용 종류를 광고주 종류로만 고른다 — 새 코드가 자기가 쓴 BANNER 행을 못 읽는다
- 스펙: SR-3 `spec.md:35` 는 BANNER 를 `title`=대체 텍스트, `body`=`''` 로 저장한다고만 적었다. 읽을 때 어떤 내용 종류로 만드는지는 정하지 않았다
- 코드
  - `CreativeJpaEntity.toDomain(kind: AdvertiserKind)` 는 MEMBER 면 무조건 `PaidCreativeContent` 다(`CreativeJpaEntity.kt:74-77`)
  - 이 함수를 부르는 두 곳은 광고주 종류만 넘긴다: `CreativeRepositoryAdapter.kt:33-36`, `CandidateSourceAdapter.kt:73-77`
  - `ad_creative` 에는 형태 칸이 없다(SR-8 은 `ad_campaign.creative_format` 만 더한다)
- 결과: 구현자가 이 분기를 그대로 두면 BANNER 행이 `PaidCreativeContent(body='')` 로 만들어지다 던진다
  - 목록·심사 큐·상세가 500 이 된다
  - 인덱스는 그 행을 조용히 빼므로 띠배너가 한 번도 나가지 않는다. 테스트가 인덱스 쪽만 보면 초록불이 난다
- 수정안: SR-3 에 한 줄 — 「행 → 내용 변환은 (광고주 종류, **캠페인 형태**)로 고른다. 두 어댑터는 소재와 함께 캠페인 형태를 읽는다」
  - `CandidateSourceAdapter` 는 이미 캠페인을 들고 있다(`:67-73`). `CreativeRepositoryAdapter` 는 광고주 종류를 읽듯이(`:35`) 캠페인 형태를 한 번 더 읽으면 된다
  - `body == ''` 로 종류를 추정하지 않는다. 종류 정보가 빈 문자열 하나에 암묵적으로 걸리게 된다
- 참고(이슈 아님): 인덱스의 유료 분기와 `PaidCandidate.content` 타입은 `PaidCreativeContent` 전용이다(`CandidateIndexService.kt:73-80`). BANNER 분기를 더하거나 타입을 넓혀야 한다

### R2-3 (릴리스, 신규·경미) ①~② 사이 옛 콘솔·어드민 번들이 새 카탈로그·지면 API 모양을 읽는다
- 스펙: ①이 카탈로그와 어드민 지면 API 를 형태 규격 목록으로 바꾸고(`spec.md:24,32,70`), ②는 별도 푸시로 나중에 나간다. 이 사이 옛 FE 가 새 응답을 읽는 경우는 BANNER 광고 표시만 다뤘다
- 코드(옛 번들이 지면 단위 필드를 직접 읽는다)
  - 콘솔
    - `adsConsoleApi.ts:103-104` 타입의 `aspectRatios`·`floorMicros` 를 읽는다
    - `CampaignEditor.tsx:223-227` 는 최저가 비교에 쓴다. 필드가 없으면 `Math.max(…undefined)` = `NaN` 이 되어, 최저가 미달 경고가 조용히 꺼진다
    - `CampaignEditor.tsx:595` 는 이 값을 화면에 그린다
  - 어드민
    - `AdsPlacementsPage.tsx:124` `p.aspectRatios.join` 은 필드가 없으면 TypeError 로 화면이 통째로 빈다. `:129` 는 최저가를 그린다
    - `:88` `updatePlacement(key, { floorMicros })` 는 옛 요청 모양 그대로 보낸다(`admin/frontend/src/api/ads.ts:63-71`)
  - 캠페인 생성: 옛 콘솔은 형태 필드 없이 요청한다. SR-2 는 「기존 행은 CARD」만 적었고, **형태가 없는 생성 요청**을 어떻게 받는지는 정하지 않았다(`spec.md:29`)
- 수정안: SR-8 에 호환 규칙을 적는다
  - ①의 카탈로그·어드민 지면 응답은 V5 까지 옛 필드 `format`·`aspectRatios`·`floorMicros` 를 **대표 규격 값**으로 함께 싣는다. 옛 컬럼과 같은 대표 규칙이다
  - 캠페인 생성 요청에 형태가 없으면 CARD 로 받는다
  - 옛 모양의 지면 PATCH 는 대표 규격에 적용하거나, 「①~② 사이 어드민 지면 화면을 쓰지 않는다」를 운영 절차에 넣는다

### Round 2 체크리스트

| # | 항목 | 판정 |
|---|---|---|
| 1 | 참조 클래스·모듈 존재 | 통과 |
| 2 | 기존 코드와 충돌 | 이슈 1건 (R2-2) |
| 3 | 복잡도 위험 | 통과 — 형태 불변으로 두 애그리거트에 걸친 불변식이 없어졌다 |
| 4 | NFR 안티패턴 | 통과 — 규격 로더 하나(`spec.md:23`). R2-2 수정도 어댑터당 조회 한 번이다 |
| 5 | 마이그레이션·롤백 | 이슈 2건 (R2-1, R2-3) |
| 6 | 동시성 | 통과 (I-6 소멸) |

### 판정 근거
- BLOCK 사유는 없다. 세 건 모두 스펙에 한두 줄을 더하면 닫힌다
- R2-1 은 롤백 절차가 적힌 대로는 효과가 없어서 REVISE 다
- R2-2 는 SR-3 을 글자대로 구현하면 띠배너가 한 번도 나가지 않는 공백이라 REVISE 다
- R2-3 은 옛 번들이 남는 짧은 창의 문제라 경미하다

VERDICT: REVISE

## Round 3

대상: spec 개정 3 (2026-09-27). 2차 세 건의 해소 여부를 확인하고, 개정 3 에서 새로 생긴 문제를 찾았다.

### 2차 이슈 해소 여부

| # | 판정 | 근거 |
|---|---|---|
| R2-1 롤백 SQL | 해소 | `spec.md:75` — ARCHIVED 로 돌리면서 같은 SQL 에서 `body = title` 을 채운다. 옛 목록이 상태로 거르지 않는다는 이유도 함께 적었다. `title` 이 1~40자라서(`spec.md:36`) 옛 `requireText` 와 90자 한도를 통과한다 |
| R2-2 행 → 내용 변환 | 해소 | `spec.md:38` — (광고주 종류, 캠페인 `creative_format`)으로 가르고, `body == ''` 로 추정하지 않는다. 두 어댑터가 같은 변환을 쓴다. `PaidCandidate.content` 를 `PaidContent` 로 넓힌 것도 `spec.md:36` 에 있다 |
| R2-3 ①~② 호환 | 해소 | `spec.md:74` — 옛 필드를 대표 규격 값으로 함께 싣고, 옛 모양 PATCH 는 대표 규격에 적용한다. 형태 없는 생성은 CARD 로 받는다(`spec.md:33`) |

개정 3 에서 더해진 `spec.md:26` 의 「`game-list-banner` 는 V4 에서 `paid_allowed` 를 끈 채로 둔다」도 코드와 맞는다.
V1 시드가 이미 `format='BANNER'`, `paid_allowed=FALSE` 다(`V1__ads.sql:280`). 옛 enum 도 `BANNER` 를 안다(`PlacementFormat.kt:4`).
그래서 롤링 창에서 옛 파드가 V4 데이터를 읽어도 깨지지 않는다.

### R3-1 (릴리스 서술, 신규·경미) 옛 번들의 `parseAd` 는 설명이 빈 광고를 버리지 않는다 — 카드 틀로 그리고 과금된다
- 스펙: `spec.md:74` — 「이 창에 API 로 BANNER 캠페인이 생기면 옛 번들의 `parseAd` 가 설명 빈 광고를 버려 노출·과금 없이 AdSense 로 넘어간다 — 받아들인다」
- 코드
  - 옛 `parseAd` 는 `body` 가 문자열인지만 본다(`portal-fe/src/components/ads/adsApi.ts:137`). `''` 도 통과한다
  - 그래서 BANNER 우승자는 `AdCard` 로 그려진다. 6.4:1 이미지가 1.91:1 카드 틀에 들어가고, 가시 노출 계측이 돌아 과금된다
  - 1차 I-5 에 적은 동작이 맞고, 개정 3 의 서술은 이와 반대다
- 범위: ①이 나가자마자 `blog-post-end`·`attraction-end` 에 BANNER 규격이 생긴다(`spec.md:26`). 따라서 이 창과 ② 이후 옛 탭·CDN 꼬리 동안 이 지면에서 생긴다. `game-list-banner` 는 ②' 전까지 유료가 꺼져 있어 해당하지 않는다
- 영향: 결론인 「받아들인다」는 그대로 둬도 된다. 다만 운영자가 이 서술을 믿으면, 이 창의 과금을 「일어나지 않는 일」로 보고 대사하지 않는다
- 수정안: `spec.md:74` 문장을 이렇게 바꾼다 — 「옛 번들은 BANNER 를 카드 틀로 그리고 노출이 과금된다 — 창이 짧아 받아들인다」
  - 과금까지 막고 싶다면 대안이 있다. ② 확인 전까지는 BANNER 캠페인 생성·시작을 거절하는 것이다. 다만 설정 하나가 늘어 KISS 기준으로는 권하지 않는다

### Round 3 체크리스트

| # | 항목 | 판정 |
|---|---|---|
| 1 | 참조 클래스·모듈 존재 | 통과 |
| 2 | 기존 코드와 충돌 | 통과 |
| 3 | 복잡도 위험 | 통과 |
| 4 | NFR 안티패턴 | 통과 |
| 5 | 마이그레이션·롤백 | 통과, 서술 정정 1건 (R3-1) |
| 6 | 동시성 | 통과 |

### 판정 근거
- 2차 세 건은 모두 닫혔다. 구현자가 스펙을 글자대로 따라도 운영 결함으로 이어지는 공백은 남지 않았다
- R3-1 은 동작 결정이 아니라 호환 창을 설명한 문장의 사실 오류다. 코드도 절차도 바뀌지 않는다
- 체크리스트의 REVISE 상한(2회)을 이미 채웠다. 이번 건은 문장 한 줄 정정이므로 SHIP 으로 두고, 태스크 작성 때 함께 고친다

VERDICT: SHIP
