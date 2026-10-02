# Specification: 광고 형태(카드·띠배너)와 드래그 업로드

> 개정 3 (2026-09-27). 1차 41건 → 개정 2, 2차 14건(보안·도메인 SHIP) → 개정 3. 판정 `context/review-verdict.md`.

## Goal

광고주가 캠페인마다 **카드**(1.91:1 이미지 + 제목 + 설명) 또는 **띠배너**(6.4:1 이미지 한 장)를 고르고, 지면은 형태별 최저가로 경쟁시킨다. 띠배너는 최저가가 낮아 싸게 집행될 수 있다 — 띠배너만 받는 자리(게임 목록 위)에서는 띠배너끼리, 두 형태를 받는 자리에서는 카드와 같은 값(1,000번 보일 때의 값)으로 겨룬다. 콘솔 소재 업로드는 드래그로도 받고, 제한을 서버에 보내기 전에 알린다.

근거: `planning/requirements.md` · 상위 스펙 `docs/specs/2026-09-23-ad-network/spec.md` · ADR-0098(개정). 용어는 이 변경이 `ads/glossary.md` 에 **추가**한다(SR-9): **광고 형태**(`PlacementFormat`: `CARD` 카드 · `BANNER` 띠배너) · **형태 규격**(`FormatSpec`: 지면이 한 형태에 대해 갖는 허용 비율 목록 + 최저가) · **대체 텍스트**(띠배너 이미지의 `alt`). 「형식」은 이미지 파일 형식(PNG·JPEG)에만 쓴다.

## User Stories

- 광고주로서, 설명이 필요 없는 알림은 띠배너로 싸게 내고 싶다.
- 광고주로서, 이미지를 끌어다 놓아 올리고, 올리기 전에 형식·용량·비율이 맞는지 알고 싶다.
- 운영자로서, 지면마다 형태별 최저가를 따로 정하고 싶다.
- 방문자로서, 띠배너도 광고라고 표시되기를 원한다.

## Specific Requirements

### SR-1 지면 — 형태 규격
- `AdPlacement` 는 형식 하나 대신 **형태 규격 목록**(`FormatSpec(format, aspectRatios, floorMicros)`, 값 객체)을 갖는다. 형태당 하나, 최소 하나, 최저가 ≥ 1,000 — `AdPlacement` 의 생성·변경 메서드가 강제한다. `paidAllowed` 는 지면 단위 그대로
- 비율 판정(`fitsImage`·`accepts`)과 최저가는 형태를 받아 그 규격으로만 판단한다
- 지면과 규격은 **한 로더**가 조립한다 — 어드민 경로(`PlacementRepositoryAdapter`)와 결정 인덱스 경로(`CandidateSourceAdapter`)가 같은 로더를 쓴다. 저장은 한 트랜잭션에서 부모 `updated_at` 과 함께
- 어드민 지면 API: 규격 추가·최저가 변경·제거. 마지막 규격 제거는 거절. 감사 요약은 형태별 최저가를 모두 적는다
- 규격을 제거하면 그 형태의 유료 캠페인은 그 지면 결정에서 빠지고, 시작·재개 검사에서 거절된다(지면 최저가 인상과 같은 효과). 타기팅 행은 지우지 않는다. 영향받는 캠페인 수를 어드민에 보여 주는 것은 범위 밖
- 초기값(V4 시드): `blog-post-end`·`attraction-end` = CARD 1.91:1 0.10 + BANNER 6.4:1 0.05, `game-hub-end` = CARD 만(그대로), `game-list-banner` = BANNER 6.4:1 0.05 — **`paid_allowed` 는 V4 에서 끈 채로 두고**, FE 배포(SR-8 ②) 확인 뒤 어드민에서 켠다

### SR-2 캠페인 — 형태는 만들 때 하나
- 캠페인은 광고 형태를 하나 갖는다. **만들 때 정하고 바꿀 수 없다** — 수정 요청에 형태 필드가 없다. 기존 행은 CARD
- 유료 캠페인 저장·시작 검사(`requirePaidTargeting`·`verifyTargeting`): 고른 지면마다 (지면, 캠페인 형태) 규격이 있어야 하고, CPM 입찰가는 그 규격 최저가 이상(경계 포함). 거절 문구에 지면 키와 형태
- **HOUSE 는 형태 규격 검사에서 면제**한다 — 존재·최저가·비율 모두. HOUSE 는 지금처럼 지면 키만 확인하고, 이미지는 그 지면의 **어느 규격에든** 맞으면 통과한다. HOUSE 소재는 캠페인 형태와 무관하게 `HouseCreativeContent` 다(상위 스펙 SR-14 면제 목록에 추가)
- 카탈로그는 지면마다 형태 규격 목록(형태·비율·최저가)과 평균 요청 수, 그리고 **업로드 규칙**(허용 파일 형식, 최대 바이트, 최대 픽셀, 비율 허용 오차)을 서버 상수로 싣는다
- 생성 요청에 형태가 없으면 CARD 로 받는다(옛 콘솔 호환)

### SR-3 소재 — 형태별 내용
- 유료 내용은 봉인 하위 계층 `PaidContent` = `PaidCreativeContent`(카드: 제목 1~40·설명 1~90) | `BannerCreativeContent`(altText 1~40자, landingUrl, imageHash). `Creative.submit` 과 결정 후보(`PaidCandidate.content`)는 `PaidContent` 를 받는다. 저장은 `title` 칸에 대체 텍스트, `body` 는 `''`(NOT NULL 유지)
- 형태와 내용 종류의 대조는 **`Creative.submit` 한 곳**에서 한다(서비스 계층에 사본 없음). 형태는 바뀌지 않으므로 수정(이미지 없는 문구 수정 포함)은 기존 「종류가 같아야 수정」 검사로 충분하다
- 소재 행을 도메인으로 바꿀 때 내용 종류는 **(광고주 종류, 캠페인 `creative_format`)** 으로 가른다 — `body == ''` 로 추정하지 않는다. `CreativeRepositoryAdapter`·`CandidateSourceAdapter` 가 같은 변환을 쓴다
- 이미지 검사 순서는 그대로(매직 바이트 → 헤더 픽셀 → 300KB → 비율)이고, 유료의 비율은 캠페인 형태 규격으로 타기팅한 모든 지면에 맞아야 한다. HOUSE 는 SR-2
- 요청의 형태 필드는 없다 — 형태는 캠페인에서 온다
- 대체 텍스트는 화면에 보이지 않고 이미지 `alt` 와 심사 화면에 쓴다

### SR-4 결정 — 형태를 가로지르는 한 우승자
- 후보 인덱스는 유료 후보를 (지면, 캠페인 형태) 규격으로 사전 필터한다: 규격이 있어야 하고, eCPM ≥ 그 규격 최저가, 이미지가 그 규격 비율에 맞음. HOUSE 는 형태 필터를 받지 않는다
- 한 지면에서는 형태와 관계없이 eCPM 이 가장 큰 후보 하나가 이긴다(동률·같은 캠페인 한 지면 규칙 그대로). 경매(`Auction`)의 최저가 필터도 우승자 형태 규격의 최저가
- 응답 광고에 `format` 을 싣는다. BANNER 는 `title`=대체 텍스트, `body`=`''`
- 청구·토큰·가시 노출·원장은 형태와 무관하게 그대로

### SR-5 FE 지면
- `adsApi.parseAd`: `format` 이 **없으면 CARD**, `BANNER` 면 `body` 가 비어도 받는다, 그 밖의 값이면 광고를 버린다
- `AdSlot`: BANNER 우승자 → 띠배너 컴포넌트, CARD → 기존 `AdCard`. 채움 순서(유료 → AdSense → HOUSE → 숨김) 그대로
- 띠배너 컴포넌트: 6.4:1 이미지(`alt`=대체 텍스트) + 이미지 **밖**의 「광고 · 광고주 이름」 한 줄. 링크는 `AdCard` 와 같다(`clickHref` 리다이렉터, `rel="sponsored nofollow noopener"`, 새 탭). 가시 노출 계측은 같은 `useImpression`. 이미지 영역은 `aspect-ratio` 로 높이를 예약한다
- 게임 목록 위(`HouseBanner`, `game-list-banner`): 유료 BANNER 우승자가 있으면 띠배너를, 없으면 HOUSE 회전. 감싸는 요소의 `aria-label` 은 유료면 「광고」, HOUSE 면 「홍보」. 채움 보고에 `PAID`
- 밀림 없음은 **이미지 로딩**에 한한다. 결정을 기다리는 동안 게임 목록 위는 지금처럼 아무것도 그리지 않는다(범위 밖)

### SR-6 콘솔
- 새 캠페인 맨 위에 형태 선택(시안 ⓪). 기존 캠페인은 형태를 읽기 전용으로 보여 주고 「형태를 바꾸려면 새 캠페인을 만드세요」
- 형태 선택 영역에 「두 형태를 받는 자리에서는 카드와 같은 값으로 겨룹니다 — 띠배너만 받는 자리: 게임 목록 위」
- 지면 카드는 그 형태 규격이 있는 지면만 고를 수 있다. 형태를 바꾸면 규격 없는 지면을 선택에서 빼고 뺀 지면 이름을 알린다. 기존 캠페인에서 규격이 사라진 선택 지면은 「이 형태를 더 받지 않음」으로 표시하고 해제할 수 있다
- 최저가·비율·예상 계산·안내 문구·미리보기 목업·지면 도식은 고른 형태를 따른다. `campaignGuide` 에 `game-list-banner` 도식 추가. 소재 목록은 띠배너를 「대체 텍스트」 라벨로 그린다
- 소재 패널: 드래그앤드롭 영역 + 파일 고르기. 검사 순서 — ① 파일 앞 바이트로 형식(MIME 무시, 빈 MIME 도 판정) ② 용량 ③ **헤더에서 읽은** 가로·세로(PNG IHDR · JPEG SOF, 픽셀을 풀지 않음) ④ 비율(카탈로그 허용 오차). **미리보기 디코딩은 모두 통과한 뒤에만.** 실패면 전송하지 않고 항목별로 실제 값·허용 값·권장 크기(카드 1200×628 · 띠배너 1280×200)를 보인다. 최종 판정은 서버
- 드롭 예외: 여러 파일은 첫 파일만 쓰고 알린다, 영역 밖에 놓으면 창의 기본 동작(파일 열기)을 막는다, 고치기 모드에서 놓은 파일은 취소할 수 있다. 종료된 캠페인에서는 드롭 영역을 숨긴다
- 띠배너 권장 크기 옆에 「모바일에서는 높이 약 56px — 글자를 크게」
- 허용 값은 카탈로그의 업로드 규칙에서 읽는다 — 화면에 사본을 두지 않는다

### SR-7 어드민
- 지면 화면: 형태 규격 표(형태·비율·최저가) 편집, 추가·제거(마지막 제거 불가 안내). 제거·인상의 효과 문구(SR-1)
- 심사 화면: BANNER 는 6.4:1 미리보기 + 「대체 텍스트」 라벨

### SR-8 스키마와 릴리스
- **V4** (V1~V3 불변): 새 표 `ad_placement_format(placement_key, format, aspect_ratios, floor_micros CHECK ≥ 1000, PK(placement_key, format))` 을 기존 `ad_placement` 의 세 컬럼으로 백필. `ad_campaign.creative_format VARCHAR(16) NOT NULL DEFAULT 'CARD'`. `ad_creative.body` 는 **그대로 NOT NULL**. 시드 변경(SR-1)과 함께 `game-list-banner` 의 옛 컬럼도 `BANNER`·`6.4:1`·`50000` 으로 맞춘다
- 옛 컬럼 `ad_placement.format`·`aspect_ratios`·`floor_micros` 는 V5(다음 릴리스)까지 남긴다. 그때까지 새 코드는 **대표 규격**(CARD 가 있으면 CARD, 없으면 첫 규격)을 옛 컬럼에 계속 쓰고, 읽지는 않는다
- **릴리스 순서**: ① engagement(V4 + `format` 응답 + 카탈로그) 푸시·운영 확인 → ② portal-fe·admin-fe 를 **별도 푸시**·운영 확인 → ②' 어드민에서 `game-list-banner` 유료 켬 → ③ 다음 릴리스 V5. ①이 롤아웃되는 동안 어드민 지면 생성은 하지 않는다
- **①~② 호환**(선례 `ads/CLAUDE.md:89`): V5 까지 카탈로그·어드민 지면 응답은 옛 필드 `format`·`aspectRatios`·`floorMicros` 를 대표 규격 값으로 함께 싣고, 옛 모양의 최저가 PATCH 는 대표 규격에 적용한다. 이 창에 API 로 BANNER 캠페인이 생기면 옛 번들의 `parseAd` 는 빈 설명도 받아(`adsApi.ts:137` 은 문자열인지만 본다) `blog-post-end`·`attraction-end` 에서 띠배너를 카드 틀로 그리고 노출이 과금된다 — ②를 ① 확인 직후 내 창을 짧게 두고 받아들인다(`game-list-banner` 는 ②' 전까지 유료가 꺼져 해당 없음)
- **되돌리기**: ②만 되돌리는 것은 안전하다. ①을 되돌려야 하면 BANNER 캠페인의 소재를 ARCHIVED 로 돌리면서 **같은 SQL 에서 `body = title`** 로 채운다(옛 코드의 소재 목록은 상태로 거르지 않고 빈 설명을 거절한다). 롤백 뒤 V4 이후 바꾼 최저가는 옛 컬럼의 대표 값으로 보인다

### SR-9 문서
- ADR-0098 개정(형태 규격·형태별 최저가·HOUSE 면제). `ads/CLAUDE.md` 릴리스·되돌리기 절
- `ads/glossary.md`: 광고 형태(「HOUSE 에는 의미가 없다」 포함)·형태 규격·대체 텍스트·카드·띠배너 행 추가, 지면·최저가·소재 행 개정(소재 행 「배너」 Avoid 문구 정정), 「형식」은 파일 형식만. `PlacementFormat` KDoc 을 「광고 형태」로

## Visual Design

시안 `https://claude.ai/artifact/8LAoG8QTQ1dnh89PaAs8Bk` — `Main.dc.html`(구현됨) · `Format.dc.html`. 토큰은 DESIGN.md, hex 금지.

## Existing Code to Leverage

`AspectRatio.fits`(허용 오차) · `CreativeImageRules`(서버 헤더 파서 — FE 헤더 파서는 같은 규칙) · `Auction.run` · `CandidateIndexService` · `CreativeContent` 봉인 계층 · `Creative.revise` 종류 검사 · `CampaignEditor`·`campaignGuide.ts`·`CreativesPanel` · `AdSlot`·`AdCard`·`useImpression`·`HouseBanner`.

## Out of Scope

동영상·GIF·HTML5, 기기별 두 장, 형태별 할인 배율, 새 지면 위치, 형태별 리포트, 캠페인 형태 변경, 규격 제거 영향 캠페인 수 표시, 결정 대기 중 게임 목록 위 높이 예약, 옛 지면 컬럼 삭제(V5).

## Open Questions

없음.
