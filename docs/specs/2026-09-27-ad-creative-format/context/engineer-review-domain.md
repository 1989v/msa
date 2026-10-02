# Engineer Review — DOMAIN

- 대상: `docs/specs/2026-09-27-ad-creative-format/spec.md`
- 기준: `ads/glossary.md`, `docs/context-map.md:34`, 상위 스펙 `docs/specs/2026-09-23-ad-network/spec.md`, `ads/domain` 코드
- 참고: `references/language-reference.md` 는 플러그인 캐시에 없어서 읽지 못했다. 체크리스트의 Glossary Conflict 규칙만 적용했다.
- KB(`HNS_KB_PATH` 1989v 볼트): 「광고 형태」·「형태 규격」·「띠배너」로 검색했지만 관련 페이지가 없었다. 인용하지 않는다.

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| C1 | BC 경계 | 통과. 변경은 ads BC 안에 있고 다른 BC를 참조하지 않는다 |
| C2 | Glossary 존재 | 통과. `docs/context-map.md:34` → `ads/glossary.md` |
| C3 | 스펙 어휘가 glossary와 맞는지 | **REVISE** (D1, D2) |
| C4 | `Avoid:` 동의어 사용 | 통과. 「배너」는 glossary에서 「소재」의 동의어로 금지돼 있다(`ads/glossary.md:12`). 스펙은 이 말을 형태 이름(「띠배너」)으로만 쓰고 소재를 가리키는 데 쓰지 않는다. 다만 D2에서 Avoid 줄을 고쳐야 한다 |
| C5 | 스펙과 코드의 언어 일치 | **REVISE** (D2, D7) |
| C6 | 애그리거트 불변식 명시와 강제 가능성 | **REVISE** (D3, D5, D6) |
| C7 | 도메인 이벤트 소유 | 해당 없음. ads 도메인에는 도메인 이벤트가 없고 이번 스펙도 추가하지 않는다 |
| C8 | 애그리거트 간 직접 참조 | 통과 조건부. `Creative.submit(campaign, …)`이 캠페인 값을 인자로 받는 기존 방식(`Creative.kt:79`)을 따른다. 불변식을 어디서 강제하는지는 D3에서 다룬다 |
| C9 | VO / Entity 분류 | **REVISE** (D4, D6) |

## Findings

### D1 — 새 용어가 glossary에 아직 없는데 스펙은 있다고 적었다 (C3)
- 근거: `spec.md:7`에 「용어는 `ads/glossary.md` — **광고 형태** … **형태 규격**」이라고 적혀 있다. 그런데 `ads/glossary.md:5-27`에는 광고 형태, 형태 규격, 대체 텍스트, 카드·띠배너 가운데 어느 것도 없다. SR-9(`spec.md:65`)가 나중에 추가하겠다고만 한다.
- 규칙: glossary 항목 없이 새 도메인 용어를 만들면 REVISE.
- 수정안:
  - `spec.md:7`을 「용어는 이번 변경에서 `ads/glossary.md`에 추가한다」로 고친다.
  - 아래 네 행의 초안을 스펙에 적거나 `/hns:glossary --conflict`로 먼저 넣는다.
    - **광고 형태**(VO, `CARD`·`BANNER`): 피할 말은 「형식」(D2 참고)
    - **형태 규격**(VO, AdPlacement 안에 있음): 형태, 허용 비율, 최저가
    - **대체 텍스트**: BANNER 소재의 `alt` 문구. 화면에는 보이지 않는다. 피할 말은 「제목」
    - **띠배너 / 카드**: 광고 형태의 표시 이름

### D2 — 기존 용어의 뜻이 바뀌는데 SR-9 개정 목록에 빠져 있다 (C3, C5)
- 근거:
  - 지면: `ads/glossary.md:13`은 「키·호스트·**형식**·최저가」로 정의한다. 스펙은 「형식 하나 대신 형태 규격 목록」(`spec.md:19`)으로 바꾼다.
  - 최저가: `ads/glossary.md:14`는 「**지면이** 받는 최소 eCPM」으로 정의한다. 스펙은 (지면, 형태)마다 따로 둔다(`spec.md:19`, `spec.md:37`).
  - 소재: `ads/glossary.md:12`는 「PAID는 제목·문구·랜딩 URL·이미지」로 정의한다. BANNER 소재는 문구가 없고 제목 칸에 대체 텍스트를 넣는다(`spec.md:31`).
  - 용어 겹침: 「형식」은 glossary와 코드에서 지면 크기군을 뜻한다(`PlacementFormat.kt:3` 「지면의 크기군」). 그런데 스펙 SR-6(`spec.md:50`)은 「형식(PNG·JPEG)」을 이미지 파일 형식(`CreativeImageFormat`, `CreativeImageRules.kt:7`)의 뜻으로 쓴다. 이제 한 단어가 두 뜻을 갖는다.
- 판단: 스펙이 뜻을 **의도적으로** 바꾸고 ADR 개정까지 예고하므로(`spec.md:65`) BLOCK이 아니라 REVISE로 본다. 다만 glossary가 따라오지 않으면 체크리스트의 「다른 의미로 사용」 위반이 된다.
- 수정안: SR-9에 다음을 명시한다.
  - 「지면」「최저가」「소재」 행을 개정한다.
  - 「소재」 행의 Avoid 줄 「배너(형식 하나일 뿐)」를 「배너(광고 형태 이름일 뿐)」로 고친다.
  - 「광고 형태」 행에 Avoid 「형식」을 넣고, 「형식」은 이미지 파일 형식(PNG·JPEG)에만 쓴다.

### D3 — 「소재가 있으면 캠페인 형태를 바꿀 수 없다」는 애그리거트 간 불변식인데, 어디서 강제하는지 정하지 않았다 (C6, C8)
- 근거:
  - `spec.md:25`가 이 규칙을 정한다.
  - `Campaign`은 소재를 모른다. 필드는 `Campaign.kt:19-33`이다.
  - 소재 생성 `CreativeService.create`(`CreativeService.kt:54-65`)는 캠페인 행을 잠그지 않는다. `application/` 전체에 `ForUpdate`나 `Lock`이 없다.
  - 그래서 형태 변경과 소재 제출이 동시에 들어오면 CARD 캠페인 아래 BANNER 소재가 생길 수 있고, 그 반대도 가능하다.
- 수정안: SR-2에 다음 세 가지를 적는다.
  1. 강제 위치: 캠페인 수정 애플리케이션 서비스가 「보관되지 않은 소재 수」를 포트로 확인한다.
  2. 셀 대상: `ARCHIVED`를 넣는지 뺀다. 권장은 빼는 것이다. 보관된 소재는 게재되지 않는다.
  3. 동시성: 형태 변경과 소재 제출이 **같은 캠페인 행 잠금**(`FOR UPDATE`) 안에서 돈다.

  반대 방향도 막는다. `Creative.submit`(`Creative.kt:79`)이 이미 캠페인을 받으므로, 여기서 「내용 종류 ↔ `campaign.creativeFormat`」 일치를 검사하게 한다. 그러면 소재 쪽 불변식은 도메인 안에서 막힌다. 아울러 `revisePaid`(`Campaign.kt:83-104`)가 형태 인자를 받는지 명시한다. 스펙은 「만들 때 고르고」라고 쓰면서, 소재가 없으면 바꿀 수 있다는 것(`spec.md:49`)도 함께 암시한다.

### D4 — BANNER 소재를 `PaidCreativeContent`의 제목·문구 칸에 겹쳐 싣는 모델 (C9)
- 근거:
  - `CreativeContent`는 `title`·`body`가 non-null이다.
  - `requireText`는 문구가 비어 있으면 거절한다(`CreativeContent.kt:7-8`, `CreativeContent.kt:18`).
  - 스펙은 BANNER의 제목 칸에 대체 텍스트를 넣고 문구는 비우게 한다(`spec.md:31`). 응답 `body`는 빈 문자열이다(`spec.md:39`).
  - 이렇게 하면 같은 필드 `title`이 형태에 따라 「보이는 제목」과 「보이지 않는 alt」라는 두 뜻을 갖는다.
- 수정안: sealed `CreativeContent`에 `BannerCreativeContent(altText, landingUrl, imageHash)`를 하위 타입으로 추가한다. 제목 칸을 쓰는 것은 영속 매핑의 일로 둔다. 이렇게 하면 다음이 따라온다.
  - `Creative.revise`의 종류 동일성 검사(`Creative.kt:53`)가 CARD ↔ BANNER 전환을 자동으로 막는다. D3의 소재 쪽 불변식이 공짜로 생긴다.
  - 도메인 어휘가 「대체 텍스트」로 코드에 남는다.

  「제목 칸을 쓴다」(`spec.md:31`)를 「저장은 `title` 컬럼, 도메인은 `altText`」로 고친다.

### D5 — HOUSE 캠페인과 광고 형태의 관계가 정의되지 않았다 (C6)
- 근거:
  - 스펙은 캠페인 기본 형태를 CARD로 두고(`spec.md:25`), `game-list-banner`를 BANNER 규격만 갖게 바꾼다(`spec.md:22`).
  - 기존 HOUSE 캠페인은 `game-list-banner`를 타기팅한다(`V1__ads.sql:295-300`). 이 캠페인은 V4에서 CARD가 된다.
  - HOUSE 이미지 업로드도 지면 비율 검사를 거친다(`HouseCreativeService.kt:43` → `CreativeImageRules.inspect`, `CreativeImageRules.kt:36`). SR-3은 이 검사가 「캠페인 형태의 규격」을 쓰게 바꾼다. 그러면 CARD HOUSE 캠페인이 BANNER 전용 지면에 이미지를 올릴 때 규격이 없어 거절된다.
  - 이 검사를 `verifyTargeting`(`Campaign.kt:74-77`)에 공통으로 넣으면 HOUSE 캠페인 재개도 막힌다.
  - 상위 스펙에서 HOUSE는 「예산·지갑·최저가·빈도·원장」에서 면제된다(`2026-09-23-ad-network/spec.md:128`). 형태 규격은 이 면제 목록에 없다.
- 수정안: SR-2와 SR-3에 한 줄씩 넣는다. 「HOUSE는 형태 규격 검사에서 면제된다. 저장 검사는 `requirePaidTargeting`에만 두고, HOUSE 이미지는 비율을 보지 않는다(또는 지면의 어느 규격에든 맞으면 된다). `creative_format` 값은 HOUSE에서 의미가 없다.」 glossary 「우선순위」 행의 면제 목록에도 이것을 더한다.

### D6 — 형태 규격의 애그리거트 소속과 제거 시 효과를 명시해야 한다 (C6, C9)
- 근거:
  - SR-1(`spec.md:19-21`)은 「한 지면에 같은 형태 규격은 하나」와 「마지막 규격은 못 지운다」를 정했다. 그러나 형태 규격이 `AdPlacement` 애그리거트 안의 VO인지, 따로 저장되는 엔티티인지는 적지 않았다. SR-8은 표를 따로 만든다(`spec.md:59`).
  - 지금 `AdPlacement`의 불변식은 생성자 `init`과 `changeFloor`(`AdPlacement.kt:32-48`)에서 강제된다.
  - 규격을 지울 때 그 (지면, 형태)를 타기팅한 **진행 중** 캠페인이 어떻게 되는지도 정하지 않았다. 현재 코드의 최저가 인상 규칙에 대응하는 설명(`Campaign.kt:69-72`: 결정에서 빠지고, 시작·재개 때 다시 확인)이 없다.
- 수정안:
  - 「형태 규격은 `AdPlacement`의 VO 목록이다. 추가·최저가 변경·제거는 `AdPlacement` 메서드로만 하고, 형태당 하나와 최소 하나를 거기서 강제한다. 저장은 한 트랜잭션에서 한다」를 명시한다.
  - 「규격을 제거하면 그 형태의 캠페인은 결정 인덱스에서 빠지고(SR-4 사전 필터), 시작·재개가 거절된다. 캠페인 타기팅 행은 지우지 않는다」를 추가한다.

### D7 — `PlacementFormat`을 캠페인·소재 개념으로 재사용하면 이름이 거짓이 된다 (C5, 경미)
- 근거: 스펙은 「기존 `PlacementFormat`을 그대로 쓴다」고 한다(`spec.md:7`). 이제 이 값을 캠페인이 갖고(`spec.md:25`), 결정 응답의 광고에도 실린다(`spec.md:39`). 그런데 KDoc은 여전히 「지면의 크기군. 허용 비율은 `AdPlacement.aspectRatios`가 따로 갖는다」이다(`PlacementFormat.kt:3`). 스펙이 `aspectRatios` 필드를 없애므로 이 설명은 틀린 말이 된다.
- 수정안: 두 가지 중 하나를 스펙에 적는다.
  - (a) `CreativeFormat`으로 이름을 바꾼다. 도메인 모듈 안에서만 바뀌고, DB 값 `CARD`·`BANNER`는 그대로다.
  - (b) 이름은 두고 KDoc과 glossary 코드 열을 「광고 형태」로 고친다.

## 요약

차단할 문제는 없다. 설계 방향은 도메인상 타당하다. (지면, 형태)별 최저가와 경매, 형태를 가로지르는 한 우승자, 청구·토큰 불변 모두 기존 모델을 해치지 않는다. 다만 다음을 스펙에 적어야 구현 에이전트가 같은 모델을 만든다.
- 새 용어와 뜻이 바뀐 용어의 glossary 반영: D1, D2
- 애그리거트 간 불변식의 강제 위치와 동시성: D3
- BANNER 내용의 타입 모델: D4
- HOUSE 면제: D5. 이것을 빠뜨리면 기존 게임 목록 HOUSE 배너의 이미지 업로드와 재개가 깨질 수 있다
- 형태 규격의 애그리거트 소속과 제거 시 효과: D6

VERDICT: REVISE

## Round 2

대상: `spec.md` 개정 2. 판정 합본은 `context/review-verdict.md` 를 따랐다(⑤ 형태 불변, ⑪ `PlacementFormat` 유지 + `FormatSpec`).
아래 줄 번호는 개정 2 기준이다.

### 1차 지적 해소 여부

| id | 상태 | 근거 |
|---|---|---|
| D1 | 해소 | `spec.md:9` 가 「이 변경이 `ads/glossary.md` 에 **추가**한다(SR-9)」로 바뀌었고 광고 형태·형태 규격·대체 텍스트의 정의를 함께 적었다. `spec.md:75` 가 다섯 행 추가를 명시한다 |
| D2 | 해소 | `spec.md:75` — 지면·최저가·소재 행 개정, 「배너」 Avoid 문구 정정, 「형식」은 파일 형식만. `spec.md:9` 도 같은 규칙을 적었다. 스펙 본문에서 「형식」은 `spec.md:14`·`59` 에서 파일 형식 뜻으로만 쓰인다. `spec.md:21` 「형식 하나 대신」은 옛 모델을 가리키는 말이라 문제 없다 |
| D3 | 해소(방향 변경) | `spec.md:29` 「만들 때 정하고 바꿀 수 없다 — 수정 요청에 형태 필드가 없다」. 형태가 소재 수와 무관해져 두 애그리거트에 걸친 불변식과 잠금이 사라졌다. 소재 쪽은 `spec.md:36` 이 등록·수정 모두 검사하고, 기존 종류 동일성 검사(`Creative.kt:53`)가 전환을 막는다 |
| D4 | 해소 | `spec.md:35` `BannerCreativeContent(altText, landingUrl, imageHash)` 를 봉인 계층에 추가, 저장 매핑은 `title`·`body=''` 로 분리 |
| D5 | 해소(잔여 경미 N2) | `spec.md:31` HOUSE 는 존재·최저가·비율 모두 면제, 이미지는 어느 규격에든 맞으면 통과. `spec.md:42` 결정 필터도 면제. HOUSE 는 결정 응답의 `ad` 가 아니라 `house` 목록으로 나가므로(`DecideAdsUseCase.kt:25-30`) HOUSE 에 `format` 이 없어도 된다 |
| D6 | 해소 | `spec.md:21` `FormatSpec` 값 객체, 형태당 하나·최소 하나·최저가 ≥ 1,000 을 `AdPlacement` 메서드가 강제. `spec.md:23` 한 로더·한 트랜잭션. `spec.md:25` 제거 효과(결정 제외·시작/재개 거절·타기팅 행 유지) |
| D7 | 해소 | `spec.md:75` `PlacementFormat` KDoc 을 「광고 형태」로(선택지 (b)) |

### 새로 본 것 (모두 경미, 차단 아님)

- **N1 — 소재 쪽 형태 검사의 위치가 비어 있다 (C6).** `spec.md:36` 은 「등록·수정이 모두 검사한다」고만 한다. 지금 `Creative.submit(campaign, content: PaidCreativeContent)`(`Creative.kt:79`)는 캠페인을 받지만 인자 타입이 `PaidCreativeContent` 로 좁고, `revise(content)`(`Creative.kt:51`)는 캠페인을 받지 않는다. 형태가 불변이므로 **`submit` 한 곳에서 `campaign` 형태 ↔ 내용 종류를 검사하면** `revise` 는 기존 종류 동일성 검사만으로 충분하다. 권장 문구: 「`Creative.submit` 이 `CreativeContent`(Paid·Banner)를 받고 캠페인 형태와 종류를 대조한다. 서비스 계층 검사는 두지 않는다」. 태스크 단계에서 정해도 된다.
- **N2 — glossary 「우선순위」 행의 면제 목록이 SR-9 에 없다 (C3).** `spec.md:31` 은 상위 스펙 SR-14 면제 목록에 추가한다고 했지만, glossary 쪽 서술(`ads/glossary.md:9` 「우선순위 (PAID / HOUSE)」)은 SR-9(`spec.md:75`) 개정 목록에 없다. 지금 glossary 행에는 면제 목록이 적혀 있지 않아 모순은 아니다. 광고 형태 행에 「HOUSE 에는 의미가 없다」 한 구절을 넣는 것으로 충분하다.

### 체크리스트 재판정

C1·C2·C4·C7·C8 통과(변동 없음). C3 통과(N2 경미). C5 통과. C6 통과(N1 경미). C9 통과 — `FormatSpec` 은 지면 애그리거트 안의 값 객체이고, 별도 표(`spec.md:68`)는 영속 형태일 뿐 식별자를 도메인에 드러내지 않는다.

VERDICT: SHIP
