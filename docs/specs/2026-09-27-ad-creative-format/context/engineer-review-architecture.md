# Engineer Review — Architecture

- 대상: `docs/specs/2026-09-27-ad-creative-format/spec.md`
- 체크리스트: hns 0.16.1 `spec-review/reviewers/architecture/checklist.md`
- 근거 범위: 스펙·`planning/requirements.md`·`context/open-questions.yml`(빈 목록) · 상위 스펙 `docs/specs/2026-09-23-ad-network/spec.md` · ADR-0098 · `ads/CLAUDE.md`·`ads/glossary.md` · `ads/domain`·`ads/feature`·`portal-fe/src/components/ads`·`portal-fe/src/pages/games` · `k8s/base/engagement`
- 같은 폴더에 `tasks*`·`status*` 는 아직 없다
- KB(`HNS_KB_PATH`, 1989v 볼트): 확장-축소(expand/contract) 마이그레이션이나 광고 최저가를 다루는 개념 페이지는 없다. 인용할 만큼 관련 있는 페이지를 찾지 못했다

## 체크리스트 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 레이어 책임 분리 | 통과(단서 있음) | 형태 규격·비율·최저가 판정을 도메인(`AdPlacement`·`Auction`·`CreativeImageRules`)에 둔다. 소재 내용 규칙이 놓일 자리는 아래 A-7 |
| 상향 의존 없음 | 통과 | 스펙 안에 infrastructure → application 의존이 없다. `verifyArchitecture` 게이트가 지킨다(`ads/CLAUDE.md` 「구조 상태」) |
| 외부 연동은 포트 경유 | 해당 없음 | 새 외부 연동이 없다 |
| 모듈 경계 변경 근거 | 통과 | 경계 변경이 없고 ads 안에서 끝난다. ADR-0098 은 개정한다(SR-9) |
| 패턴 일관성 | 수정 필요 | 지면을 읽는 경로가 둘이다(A-4). HOUSE 경로가 정의되지 않았다(A-1) |
| 순환 의존 없음 | 통과 | — |
| 트랜잭션 경계 소유 | 수정 필요 | 형태 잠금이 두 애그리거트(캠페인·소재)에 걸친 불변식인데 강제 위치가 없다(A-7) |
| 인터페이스 표면 최소 | 통과 | `fitsImage`·`accepts` 에 형태 인자 하나만 더한다 |
| 얕은 통과 모듈 없음 | 통과 | 새 FE 띠배너 컴포넌트는 `AdSlot`·`HouseBanner` 두 곳이 쓴다 → 삭제 테스트에서 복잡도가 두 호출처로 흩어지므로 제 몫을 한다 |
| 정보 은닉 | 수정 필요 | 허용 오차가 화면에 사본으로 남는다(A-5) |
| 경계면(seam) 현실성 | 통과 | 새 인터페이스·포트가 없다 |
| 용어집 기반 이름 | 수정 필요 | A-6 |

## Findings

### A-1 [중] HOUSE 가 형태 규격 아래에서 어떻게 도는지 정의되지 않았다 — 게임 목록 위 HOUSE 가 사라질 수 있다
- 스펙: SR-2 「캠페인은 광고 형태를 하나 갖는다(기본 CARD, 기존 행은 CARD)」, SR-4 「후보 인덱스는 (지면, 형태) 기준으로 사전 필터」, SR-1 「`game-list-banner` = BANNER 6.4:1 0.05」, SR-5 「없으면 지금처럼 HOUSE 를 돌린다」
- 코드: 시드 HOUSE 캠페인은 `game-list-banner` 만 타기팅한다(`ads/feature/src/main/resources/adsdb/migration/V1__ads.sql:295-300`). V4 가 끝나면 이 캠페인은 CARD 가 되고, 지면에는 BANNER 규격만 남는다
- HOUSE 이미지는 타기팅 지면 비율로 검사한다(`HouseCreativeService.kt:43` → `CreativeImageRules.kt:36`). 형태 규격 도입 뒤에는 「어느 형태의 규격으로 보나」가 정해지지 않는다. `game-list-banner` 에는 CARD 규격이 없으므로, CARD 로 보면 HOUSE 이미지 업로드가 막힌다
- 지금 인덱스는 HOUSE 후보를 형태와 무관하게 쌓는다(`CandidateIndexService.kt:70-72`). SR-4 필터를 HOUSE 에도 적용하면 (game-list-banner, CARD) 규격이 없어 HOUSE 목록이 빈다
- 수정안: SR-2·SR-3·SR-4 에 한 줄씩 더한다. 「형태 규격 판정(규격 존재·최저가·비율)은 PAID 에만 한다. HOUSE 캠페인·소재는 지면 형태와 무관하게 HOUSE 목록에 오른다. HOUSE 이미지 비율은 그 지면의 어느 규격에든 맞으면 통과한다(또는 검사하지 않는다)」. `verifyTargeting` 의 HOUSE 분기(`Campaign.kt:74-77`)는 지금처럼 등록 여부만 본다고 명시한다

### A-2 [중] 옛 지면 컬럼을 「더 읽지 않는다」고만 적었다 — 새 지면 INSERT 가 깨지고, 겹치는 동안 옛 파드가 어긋난 값을 본다
- 스펙: SR-8 「`ad_placement` 의 `format`·`aspect_ratios`·`floor_micros` 는 이번에 지우지 않는다 — 롤링 배포 중 옛 파드가 읽는다. 코드는 더 읽지 않는다」
- 스키마: 세 컬럼은 `NOT NULL` 이고 기본값이 없다. `floor_micros >= 1000` CHECK 도 걸려 있다(`V1__ads.sql:109-111,119`). 코드가 이 값을 쓰지 않으면 어드민 지면 등록(`PlacementRepositoryAdapter.kt:32-35`, `PlacementJpaEntity.kt:62-73`)의 INSERT 가 실패한다. 스펙에는 쓰기 쪽 규칙이 없다
- 겹치는 창은 실제로 있다. engagement 는 `replicas: 1`(`k8s/base/engagement/deployment.yaml:12`)에 기본 RollingUpdate 라서 새 파드가 Flyway 를 돌린 뒤 옛 파드가 잠시 함께 떠 있다. 태그 롤백 때도 옛 코드가 V4 스키마를 읽는다
- `game-list-banner`: V4 는 지면 단위 `paid_allowed` 를 켠다(SR-1). 그런데 옛 컬럼은 `BANNER`·`1.91:1`·`100000` 그대로다(`V1__ads.sql:280`). 이 창에서는 옛 파드의 `requirePaidTargeting`(`Campaign.kt:160-169`)과 `Auction.run`(`Auction.kt:24`)이 1.91:1 CARD 유료 광고를 게임 목록 위 띠에 허용한다
- 수정안: SR-8 에 두 가지를 적는다. ① V5 전까지 새 코드는 옛 세 컬럼에 **대표 규격을 계속 적는다**. 대표 규격은 CARD 가 있으면 CARD, 없으면 첫 규격이다. 새 코드는 이 컬럼을 읽지 않는다. ② V4 가 `game-list-banner` 의 옛 컬럼도 `6.4:1`·`50000` 으로 함께 고친다. 롤백 시 어드민이 V4 뒤에 바꾼 최저가는 옛 컬럼 기준으로 되돌아간다는 점도 한 줄 적는다

### A-3 [중] 릴리스 순서가 없고, `format` 이 없는 응답을 「모르는 형태」로 버린다
- 스펙: SR-5 「`adsApi.parseAd`: `format` 을 읽고 … 모르는 형태면 광고를 버린다」
- 코드: 지금 `parseAd` 는 `format` 을 보지 않는다(`portal-fe/src/components/ads/adsApi.ts:133-141`). portal-fe 와 engagement 는 따로 배포된다. FE 가 먼저 나가거나 백엔드만 롤백되면 응답에 `format` 이 없고, **모든 유료 광고가 버려져** AdSense·HOUSE 로 넘어간다
- 반대로 백엔드가 먼저 나가면 옛 FE 가 BANNER 를 `AdCard` 에 빈 설명으로 그린다. `body` 가 `""` 여도 `isString` 을 통과한다(`adsApi.ts:137`)
- 상위 스펙은 릴리스 순서와 되돌리기를 절로 뒀다(`docs/specs/2026-09-23-ad-network/spec.md:134-136`, `ads/CLAUDE.md` 「릴리스 순서와 되돌리기」)
- 수정안: SR-5 를 「`format` 이 **없으면 CARD**, 있는데 모르는 값이면 버린다」로 바꾼다. 「릴리스 순서」 절을 더한다 — ① engagement(V4 + `format` 응답) ② portal-fe·admin-fe(형태 선택·띠배너 렌더) ③ 다음 릴리스 V5. 되돌리기는 ②만 되돌려도 안전하다는 것과, ①을 되돌리면 BANNER 캠페인이 옛 규칙으로 보인다는 것을 적는다

### A-4 [중] `AdPlacement` 를 만드는 곳이 둘이다 — 형태 규격 로딩이 한쪽에서 빠질 수 있다
- 코드: 어드민·캠페인 경로는 `PlacementRepositoryAdapter.kt:25-30`, 결정 인덱스는 `CandidateSourceAdapter.kt:84` 가 각각 `PlacementJpaEntity.toDomain()` 을 부른다. 형태 규격이 자식 표(`ad_placement_format`)로 가면 두 곳 모두 조인해야 한다
- 스펙의 「Existing Code to Leverage」는 `CandidateSourceAdapter` 를 적지 않았다. 한쪽만 고치면 어드민 화면은 맞는데 결정은 규격 없는 지면을 보는 식으로 조용히 갈린다
- 수정안: SR-1 또는 「Existing Code」에 한 줄 더한다. 「지면 + 형태 규격 조립은 한 곳에서만 한다. 두 어댑터가 같은 로더를 쓰거나, `CandidateSourceAdapter` 가 `PlacementPort` 를 거친다. 규격 추가·변경·제거는 `adsTransactionManager` 트랜잭션 하나에서 부모 `updated_at` 과 함께 쓴다」

### A-5 [하] 비율 허용 오차가 화면에 사본으로 남는다 — 스펙 안의 규칙과 부딪힌다
- 스펙: SR-6 「비율(형태 규격, 서버와 같은 허용 오차)」 그리고 「허용 값(용량·픽셀)은 카탈로그가 서버 상수를 싣는다 — 화면에 사본을 두지 않는다」
- 코드: 허용 오차는 `AspectRatio.TOLERANCE = 0.01`(`ads/domain/.../placement/model/AspectRatio.kt:20`)이다. 카탈로그 목록(SR-2)에는 용량·픽셀만 있어서 오차는 FE 상수로 복제된다
- 수정안: SR-6 의 카탈로그 상수에 `aspectTolerance`(또는 규격별 최소·최대 비율 수치)를 더한다

### A-6 [하] 이름 — `PlacementFormat` 이 캠페인 속성이 되고, 「형태 규격」에 코드 이름이 없다
- 코드: `PlacementFormat` 의 KDoc 은 「지면의 크기군」이다(`PlacementFormat.kt:3`). 용어집은 소재 항목에서 「배너」를 「형식 하나일 뿐」이라며 피하라고 적어 뒀다(`ads/glossary.md:12`). 이번 스펙은 이 타입을 캠페인의 「광고 형태」로 쓴다
- 스펙은 새 VO 「형태 규격」의 코드 이름을 정하지 않았다
- 수정안: 둘 중 하나를 정해 SR-9 에 적는다. (a) 타입 이름을 그대로 두고 KDoc·용어집 코드 칸을 「광고 형태 — 지면 규격과 캠페인이 함께 쓴다」로 고친다(최소 수정) (b) `AdFormat` 으로 바꾼다. 형태 규격 VO 이름(예: `FormatSpec`)도 용어집 코드 칸에 넣는다

### A-7 [하] 형태별 내용 규칙과 형태 잠금이 어디서 강제되는지 없다
- 코드: 유료 소재 내용은 서비스가 `PaidCreativeContent(title, body, …)` 로 만든다(`CreativeService.kt:62,77`). 제목·설명 필수 검사는 `CreativeContent.requireText`(`CreativeContent.kt:16-20`)에 있고 형태를 모른다
- SR-3(BANNER 는 설명이 비어야 한다)을 서비스에서 가르면 「CARD 캠페인에 설명 없는 소재」를 **만들 수는 있고 잡히기만** 하는 상태가 된다
- SR-2 「소재가 하나라도 있으면 바꿀 수 없다」는 캠페인과 소재 두 애그리거트에 걸친 불변식이다. 소재 업로드와 형태 변경이 동시에 커밋되면 CARD 소재가 BANNER 캠페인 아래 남는다. 그 소재는 비율 필터에 걸려 게재되지 않을 뿐 조용히 남는다
- 수정안: ① 형태별 내용 규칙은 도메인 팩토리(`Creative.submit`/`revise` 가 캠페인 형태를 받아 내용 종류를 고른다)에 둔다고 SR-3 에 적는다 ② 형태 변경은 캠페인 행 잠금(`FOR UPDATE`) 아래에서 소재 수를 확인한다고 적는다. 더 단순하게는 「형태는 만든 뒤 바꿀 수 없다」로 줄이는 방법도 있다(콘솔 잠금 문구만 남는다)
- 참고(선택): `ad_creative.body` 를 NULL 허용으로 바꾸는 대신 `''` 로 저장하면 V4 의 ALTER 와 엔티티 nullable 전환이 빠진다. 응답은 어차피 `""` 다(SR-4). 옛 파드는 NULL 이든 `''` 든 `skipInvalid` 로 건너뛴다(`CandidateSourceAdapter.kt:77,105-108`). 그래서 롤링 안전성에는 차이가 없고 스키마 단순성만 다르다

## 요약

차단급 위반은 없다. 형태 규격을 지면 애그리거트의 자식으로 두고, 경매가 형태를 가로질러 eCPM 하나로 고르는 설계는 기존 레이어·경매 구조(`Auction.kt:19-32`)와 맞는다. 스펙이 비워 둔 곳은 셋이다.

- HOUSE 경로(A-1)
- 옛 컬럼에 대한 쓰기 규칙과 겹치는 창(A-2)
- 릴리스 순서(A-3)

셋 모두 구현 전에 한 줄씩 정하면 된다.

VERDICT: REVISE

## Round 2

대상: 개정 2(2026-09-27). 1차 판정 합본은 `context/review-verdict.md`. 이번에 다시 읽은 코드는 `Creative.kt`·`CreativeContent.kt`·`CreativeJpaEntity.kt`·`CreativeRepositoryAdapter.kt`·`CandidateSourceAdapter.kt`·`CandidateIndexService.kt`·`CandidateSnapshot.kt`·`V1__ads.sql` 이다.

### 1차 지적 해소 여부

| id | 상태 | 근거(개정 2) |
|---|---|---|
| A-1 HOUSE 경로 | 해소 | SR-2 `spec.md:31` 은 규격 존재·최저가·비율을 모두 면제하고 이미지는 「어느 규격에든」 맞으면 된다고 적었다. SR-4 `spec.md:42` 는 HOUSE 에 형태 필터를 걸지 않는다. 지금 인덱스의 HOUSE 분기(`CandidateIndexService.kt:70-72`)와 맞는다 |
| A-2 옛 컬럼 쓰기·겹치는 창 | 해소 | SR-8 `spec.md:68-69` 에 대표 규격 쓰기와 `game-list-banner` 옛 컬럼 보정이 들어갔다. `spec.md:71` 에 롤백 뒤 최저가도 적었다. `spec.md:70` 은 배포 중 지면 생성을 금지한다(옛 파드가 규격 행 없이 지면을 만드는 창) |
| A-3 릴리스 순서·format 없음 | 해소 | SR-5 `spec.md:48` 은 `format` 이 없으면 CARD 로 본다. SR-8 `spec.md:70-71` 에 순서 ①②③과 되돌리기를 적었다 |
| A-4 지면 로더 둘 | 해소 | SR-1 `spec.md:23` 이 한 로더를 쓰고 한 트랜잭션에서 부모 `updated_at` 을 갱신한다고 정했다 |
| A-5 허용 오차 사본 | 해소 | SR-2 `spec.md:32` 카탈로그에 「비율 허용 오차」가 들어갔다. SR-6 `spec.md:61` 은 사본을 금지한다 |
| A-6 이름 | 해소 | `spec.md:9` 는 `FormatSpec` 을 정했다. SR-9 `spec.md:75` 는 `PlacementFormat` KDoc 을 「광고 형태」로 바꾸고 소재 행의 「배너」 Avoid 문구를 정정한다 |
| A-7 형태 잠금·내용 규칙 | 대부분 해소 | SR-2 `spec.md:29` 로 형태를 바꿀 수 없게 했다. 두 애그리거트에 걸친 불변식과 잠금이 없어진다. 내용 규칙을 **어디서** 강제하는지는 여전히 적혀 있지 않다. 아래 R2-2 로 넘긴다 |

### 체크리스트 재판정(바뀐 항목만)

| 항목 | 판정 | 근거 |
|---|---|---|
| 패턴 일관성 | 수정 필요(하) | 지면 로더는 하나로 정했다. 소재 로더에는 같은 판단이 빠졌다(R2-1) |
| 트랜잭션 경계 소유 | 통과 | 형태를 바꿀 수 없어서 애그리거트 사이 불변식이 없다 |
| 정보 은닉 | 통과 | A-5 해소 |
| 용어집 기반 이름 | 통과 | A-6 해소 |
| 레이어 책임 분리 | 통과(단서) | 「유료 소재」를 구체 타입 `PaidCreativeContent` 하나로 판정하는 자리가 넷이다(R2-2) |

### 새 지적

#### R2-1 [중] 소재 행을 읽을 때 BANNER 를 무엇으로 가르는지 없다 — 소재 로더도 둘이다
- 스펙: SR-3 `spec.md:35` 는 BANNER 를 「`title` 칸에 대체 텍스트, `body` 는 `''`」로 저장한다. 행에는 종류 표시가 없다
- 코드: 행을 내용 종류로 되돌리는 판별자는 지금 **광고주 종류 하나**다. MEMBER 면 `PaidCreativeContent`, SYSTEM 이면 `HouseCreativeContent` 를 만든다(`CreativeJpaEntity.kt:74-77`). 이 규칙대로면 BANNER 행은 `PaidCreativeContent("", …)` 로 복원된다. 그러면 `requireText` 가 던진다(`CreativeContent.kt:18`)
- 이 변환을 부르는 곳이 둘이다. 어드민·광고주 경로는 `CreativeRepositoryAdapter.kt:33-36`, 결정 인덱스는 `CandidateSourceAdapter.kt:77` 이다. 인덱스 쪽은 `skipInvalid` 안이라 **BANNER 소재가 조용히 빠진다.** 광고주 목록 쪽은 예외가 난다. A-4 에서 지면 로더에 대해 본 것과 같은 모양이다
- 수정안: SR-3 또는 SR-8 에 한 줄 더한다. 「소재 행의 내용 종류는 (광고주 종류, 캠페인 `creative_format`)으로 가른다. 두 어댑터가 같은 변환을 쓰고, 변환은 캠페인 형태를 인자로 받는다」. `body == ''` 로 가르는 방법은 쓰지 않는다. 문구 검증이 판별자를 겸하게 된다

#### R2-2 [하] 「유료 소재」가 구체 타입 하나로 박혀 있다 — BANNER 를 받을 상위 타입이 정해지지 않았다
- 스펙: SR-3 `spec.md:35` 는 `BannerCreativeContent` 를 봉인 계층에 **형제**로 더한다. `spec.md:36` 은 「소재 등록·수정은 모두 캠페인 형태와 내용 종류가 맞는지 검사」라고 적었다. 검사하는 자리는 적지 않았다
- 코드: 유료를 `PaidCreativeContent` 로 판정하는 곳이 넷이다
  - `Creative.submit(campaign, content: PaidCreativeContent)` — `Creative.kt:79`
  - 인덱스의 `is PaidCreativeContent` 분기 — `CandidateIndexService.kt:73`
  - `PaidCandidate.content: PaidCreativeContent` — `CandidateSnapshot.kt:52`
  - 서비스의 `PaidCreativeContent(...)` 생성 — `CreativeService.kt:62,77`
- 인덱스의 `when` 은 봉인 계층이라 컴파일러가 빠진 분기를 잡는다. 그 분기가 `PaidCandidate` 에 들어갈 수 있는지는 스펙이 정하지 않았다
- HOUSE 도 걸린다. HOUSE 캠페인은 기본 CARD 가 된다(`spec.md:29`, 시드 캠페인 `V1__ads.sql:295-297`). 그런데 HOUSE 소재는 `HouseCreativeContent` 다(`Creative.kt:94`). 「CARD ↔ `PaidCreativeContent`」 대응을 HOUSE 에도 적용하면 HOUSE 소재 등록이 막힌다. SR-2 의 HOUSE 면제(`spec.md:31`)는 규격만 말하고 내용 종류는 말하지 않는다
- 수정안: SR-3 에 적는다
  - ① 유료 내용은 봉인 하위 계층(예: `PaidContent` = `PaidCreativeContent` | `BannerCreativeContent`)으로 묶는다. `PaidCandidate.content` 와 `Creative.submit` 이 그 타입을 받는다
  - ② 형태 ↔ 내용 종류 검사는 `Creative.submit` 안에서 한다. `campaign` 을 이미 받고 있다. 형태를 바꿀 수 없고 `revise` 가 종류 동일성을 본다(`Creative.kt:53`). 그러니 수정 경로에는 따로 검사가 필요 없다. 서비스에서 가르면 잘못된 조합을 쓸 수는 있고 잡히기만 한다
  - ③ HOUSE 는 형태와 무관하게 `HouseCreativeContent` 라고 SR-2 면제 목록에 한 줄 더한다

#### 참고(판정에 넣지 않음)
- `spec.md:70` 은 「①과 ② 사이에는 BANNER 캠페인이 생기지 않는다」고 적었다. 근거는 콘솔이 형태를 고르지 못한다는 것이다. 그런데 ① 뒤 광고주 API 는 이미 형태 필드를 받는다. API 를 직접 부르면 생길 수 있다. 결과는 옛 번들이 빈 설명 카드를 그리는 정도라서(`adsApi.ts:137`) 표시 문제로 끝난다. 막으려면 ① 에서 BANNER 생성을 설정 토글로 닫고 ② 와 함께 연다. 아니면 이 창을 받아들인다고 적는다

### 요약
1차 지적 일곱은 모두 반영됐다. 형태를 바꿀 수 없게 한 결정은 A-7 의 애그리거트 사이 불변식을 통째로 없앤다. 대안 중 가장 단순한 쪽이다. 새로 비는 곳은 두 가지이고, 둘 다 스펙에 한두 줄로 닫힌다.
- 소재 행을 읽을 때 BANNER 를 가르는 판별자와 그 변환을 쓰는 두 어댑터(R2-1)
- 유료 내용의 상위 타입과 검사 위치, HOUSE 내용 면제(R2-2)

차단급은 없다.

VERDICT: REVISE

## Round 3

대상: 개정 3(2026-09-27). 2차 판정 합본은 `context/review-verdict.md` 「개정 2 (2차)」. 이번에 다시 읽은 코드는 `CandidateSourceAdapter.kt`·`CreativeRepositoryAdapter.kt`·`CreativeJpaEntity.kt`·`Creative.kt`·`CreativeStatus.kt` 이다.

### 2차 지적 해소 여부

| id | 상태 | 근거(개정 3) |
|---|---|---|
| R2-1 소재 행 판별자·로더 둘 | 해소 | SR-3 `spec.md:38` 은 내용 종류를 (광고주 종류, 캠페인 `creative_format`)으로 가르고 `body == ''` 추정을 금지한다. 두 어댑터가 같은 변환을 쓴다. 인덱스 쪽은 이미 캠페인 행을 먼저 읽고 소재를 캠페인별로 매핑한다(`CandidateSourceAdapter.kt:58,73-77`). 형태를 한 칸 더 넘기면 된다. 광고주 경로는 광고주 종류를 묶어 조회하는 자리(`CreativeRepositoryAdapter.kt:33-36`)에서 캠페인 형태도 같이 묶어 읽으면 된다 |
| R2-2 유료 상위 타입·검사 위치·HOUSE | 해소 | SR-3 `spec.md:36` 에서 `PaidContent` 봉인 하위 계층을 정했다. `Creative.submit` 과 `PaidCandidate.content` 가 이 타입을 받는다. `spec.md:37` 은 대조를 `Creative.submit` 한 곳으로 정하고 서비스 사본을 금지한다. 지금 `submit` 은 이미 `campaign` 을 받는다(`Creative.kt:79`). HOUSE 는 `createHouse` 가 따로 있다(`Creative.kt:94`). SR-2 `spec.md:31` 은 HOUSE 소재를 형태와 무관하게 `HouseCreativeContent` 로 둔다고 적었다 |
| 참고 ①~② API BANNER 창 | 해소 | SR-8 `spec.md:74` 는 옛 번들의 `parseAd` 가 이 광고를 버리고 AdSense 로 넘어간다고 적고, 이 창을 받아들인다. `spec.md:33` 은 형태 없는 생성을 CARD 로 받는다 |

### 새 설계 요소 점검

- `game-list-banner` 유료를 V4 에서 끈 채로 두고 ②' 에서 켠다(`spec.md:26,73`). A-2 의 옛 파드 창에서 1.91:1 유료가 띠에 들어가는 경로가 옛 컬럼 보정(`spec.md:71`)에 더해 한 겹 더 닫힌다. 문제없다
- ① 되돌리기의 ARCHIVED + `body = title`(`spec.md:75`): `ARCHIVED` 는 기존 상태다(`CreativeStatus.kt:4`). 옛 코드의 인덱스는 APPROVED 만 읽는다(`CandidateSourceAdapter.kt:74`). 따라서 보관된 BANNER 소재는 결정에 오르지 않는다. 광고주 목록에서는 `body = title` 로 채워 `requireText` 를 통과한다. BANNER 캠페인 행은 옛 코드에서 CARD 로 보이지만 게재할 소재가 없다. 스펙 문구대로 안전하다
- 옛 모양 최저가 PATCH 를 대표 규격에 적용한다(`spec.md:74`). 대표 규격 쓰기 규칙(`spec.md:72`)과 같은 정의라서 새 판별 규칙이 생기지 않는다

### 체크리스트 재판정(바뀐 항목만)

| 항목 | 판정 | 근거 |
|---|---|---|
| 패턴 일관성 | 통과 | 지면(`spec.md:23`)과 소재(`spec.md:38`) 모두 변환을 하나로 정했다 |
| 레이어 책임 분리 | 통과 | 형태 ↔ 내용 대조가 도메인 팩토리 한 곳에 있다(`spec.md:37`) |

### 새 지적

없다. 표현 수준의 차이만 남았고 판정에 넣지 않는다.

### 요약
2차 지적 둘과 참고 하나가 모두 개정 3 에 반영됐다. 새로 들어온 결정 셋(유료 켜기 시점을 ②' 로 미룸, ARCHIVED 되돌리기, 옛 PATCH 호환)도 기존 구조와 맞는다. 아키텍처 차원에서 남은 것은 없다.

VERDICT: SHIP
