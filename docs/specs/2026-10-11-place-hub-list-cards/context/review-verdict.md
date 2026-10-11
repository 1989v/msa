# 리뷰 발견 심판 — place 허브 결과 카드 · 모바일 상세 하단 행동 바

## Overall

**판정: BLOCK 2건 유지. 스펙을 고친 뒤 다시 리뷰해야 한다.**

- 발견 36건(본 발견 33 + 리뷰어가 「참고」로 남긴 3)을 판정했다. 유지 35, 강등 0, 기각 1이다.
- 기각한 1건(U-8)은 리뷰어 스스로 「문제 없음」으로 판정한 확인 항목이다.
- 강등할 근거는 찾지 못했다. 판정에 쓴 인용 줄은 모두 워크트리에서 직접 열어 원문을 확인했다.
- BLOCK 둘(D-1·D-2)은 스펙 결정과 표준·코드 위반을 둘 다 인용하고 있어 BLOCK 자격을 갖춘다.
- 겹치는 발견은 기각하지 않고 「병합」으로 표시했다. 스펙은 한 곳에서 한 번만 고치면 된다.
  - A2 = D-3
  - A3 = D-4 = 보안 참고
  - I9.1 = TS-5
  - A-참고② = U-5
  - I1 ⊃ U-7②

## 판정 표

| id | 원판정 | 심판 | 근거(실측) | 스펙 편집 한 줄 |
|---|---|---|---|---|
| **D-1** 「배지 줄」 용어 충돌 | BLOCK | **keep BLOCK** | `search/glossary.md:94`: 「**배지 줄** — 방문 요약에 칸이 없는 배지 … `<p data-place-section="visit-badges">`」. 스펙 SR-3.1·3.3과 tasks 5.3은 같은 이름을 카드 배지 목록에 쓴다 | 스펙·tasks·k-heritage 견본·DESIGN.md 표의 이름을 「카드 상태 배지」로 바꾸고(CSS 클래스는 그대로), glossary에 항목을 더한다. 내용: 「상세 배지 줄과 다르다 · 부정값·UNKNOWN 미표시」 |
| **D-2** 무장애 배지 조건 | BLOCK | **keep BLOCK** | `AttractionAccessibility.kt:61-63`: 「목록 필터로 여는 코드 … 95% 이상인 키만 … `FILTER_CODES = listOf("WHEELCHAIR","ELEVATOR","RESTROOM")`」. `:18-46`에는 `PROMOTION`·`LACTATION_ROOM` 같은 코드도 있다. `placeAttributes.ts:41-45` `BARRIER_FREE_CHIPS`도 같은 셋이다. 스펙 SR-2.3 5행은 「코드가 하나 이상」이다 | SR-2.3 5행 조건을 `BARRIER_FREE_CHIPS` 코드 import(사본 금지)로 바꾸고 「셋 중 하나 이상」으로 한다. ko·en 문구도 같은 범위로 맞춘다. 회귀 주입에 「아무 코드로 되돌림」을 더한다 |
| A1 `sigunguName` 필수 읽기 필드 누락 | REVISE | keep REVISE | `build.gradle.kts:537-560`의 `searchReadRequired` 범위에서 `sigungu` 검색 0건. `:602-611`이 필수 목록만 막는다 | `searchReadRequired["attractions"]`에 `sigunguName`과 주석을 더하고, TG2 Verify에 `verifySearchIndexContract`를 넣는다. requirements.md:38의 「매핑 1줄」도 고친다 |
| A2 / D-3 `payload.placement` 이름 충돌(병합) | REVISE | keep REVISE | `docs/context-map.md:65`: 「common `Placement` … ads 지면(`AdPlacement`)은 다른 개념」. `AttractionPage.tsx:707` `placement="attraction-end"`. `PlacePage.tsx:2179` `{ source: 'card' }` | SR-6.2·6.3, tasks 3.2·5.1·6.3, R6의 키를 `source: 'action_bar'`로 바꾼다(기존 어휘 재사용) |
| A3 / D-4 / 보안 참고 — 제외가 거부 목록 구조(병합) | REVISE(비차단) | keep REVISE | spec.md:76이 스스로 「화면 종류로 거르지 않으므로」라고 적어 둠. 제외 목록에 넷이 리터럴로 박혀 있음(`ClickHouseAttractionPopularityAdapterTest.kt:86`) | 범위는 그대로 둔다. ADR-0095 한 줄과 open-questions Q9에 「허용 목록 전환 검토」를 기록한다 |
| I1 SharePanel이 바 칸 규격을 못 맞춤 | REVISE | keep REVISE | `SharePanel.tsx:80` 자체 `role="group"`, `:5` 「링크 복사」 글자만. `SharePanel.css:14` `--ko-text-secondary`(`#46464a`, k-heritage.css:43) 대 바 바탕 `--kh-giwa` `#1d1d1f`. spec.md:120은 공용 컴포넌트 수정이 범위 밖 | SR-4.4에 (a)안(바 범위 CSS 덮어쓰기 + 공유 칸은 글자만, 그룹 중첩 허용)을 적는다. SR-8.3 측정 목록에 「바 공유 칸 글자·포커스 링」을 더한다 |
| I2 FavoriteButton 별 대비·칸 전체 누름 | REVISE | keep REVISE | `Favorite.css:15-16` 44×44 고정, `:21` `--ko-text-secondary`, `:26` outline `--ko-text-primary`(=giwa, k-heritage.css:42), `.is-on` `--kh-yeonji`. `FavoriteButton.tsx:94-105`는 자식을 받지 않음 | SR-4.5에 `.place-action-bar .favorite-btn` 덮어쓰기(폭·높이 100%, 켜짐/꺼짐/포커스 색)를 적는다. SR-8.3에 「바 아이콘 ≥3:1 · 포커스 링 ≥3:1」, 회귀 주입에 1줄을 더한다 |
| I3 `hidden`과 전환 충돌 | REVISE | keep REVISE | spec.md:57 `hidden`, :62 160ms 전환. 반증 없음(CSS 우선순위 사실) | SR-4.2에 `.place-action-bar[hidden]{display:none}`을 명시한다. 등장 전환은 `@starting-style`로 하거나 뺀다. CDP 단언을 추가한다 |
| I4 하단 여백·scroll-padding 범위 | REVISE | keep REVISE | spec.md:61은 `html { scroll-padding-bottom }` 범위가 정해져 있지 않음 | SR-4.6에 상세 전용 수식(`:root:has(.place-action-bar)` 또는 data 속성 + unmount 정리)을 적는다. tasks 5.1에 허브 미적용 단언을 더한다 |
| I5 `replaceState(null…)` 라우터 상태 | REVISE | keep REVISE | spec.md:67 「`history.replaceState` 로 지운다」. 기본 동작을 막으면 지울 해시가 없다 | SR-5.3에서 replaceState를 삭제한다. `location.hash` 단언은 유지한다 |
| I6 이동 줄 위치·대상 불일치 | REVISE | keep REVISE | `AttractionPage.tsx:370` `.place-detail-first` 안에 `:469` AttractionAccess, `:489` `section.place-visit`이 있음. 「이용 안내」는 `:626` `section.place-detail-info`(side). `AttractionInfoTabs.tsx:20,71` 「방문 정보/At a glance」, 제목 없는 div. `NearbyExplore.tsx:201` 빈 목록이면 null | SR-5.1에 이동 줄 위치를 확정한다(사용자 판단). SR-5.2에서 「이용 안내」 링크를 「방문 정보」로 바꾸고, 대상 `aria-label`, 표시 판정은 동기 절로만, `focus({preventScroll:true})`를 적는다 |
| I7 sticky 머리띠 높이 누락 | REVISE(비차단) | keep REVISE | `PlacePage.css:879-882` `.place-header { position: sticky; top: 0 }`(≤640) | SR-4.2 IO에 `rootMargin` 머리띠 높이를 주고 조건을 `bottom < rootBounds.top`으로 바꾼다. SR-8.4 기준도 같이 고친다 |
| I8 찜 수 접근성·넘친 배지 계측·max-height | REVISE | keep REVISE | `PlacePage.tsx:2162-2166` 카드가 통째로 `<a>`. spec.md:45 span `aria-label`, :51 overflow 숨김, :72 「그린 배지」 | SR-2.5: 보이는 「찜 n」은 `aria-hidden`, 옆에 시각 숨김 텍스트를 둔다. SR-6.1: 「cardFacts가 낸 배지」로 정의한다. SR-3.3: line-height 고정 + `max-height: calc()`를 SR-8.2의 24px과 맞춘다 |
| I9 / TS-5 테스트 4줄 누락 · 배포 순서 복구(병합) | REVISE | keep REVISE | `ClickHouseAttractionPopularityAdapterTest.kt:60,72,77,79`에 `NOT IN ('MAP_LINK', 'FAVORITE', 'DIRECTIONS', 'SHARE')` 리터럴. tasks 3.1은 `:86`만 적음 | tasks 3.1에 :60·72·77·79를 더한다. SR-6.5에 「순서가 어긋나면 `reaggregateRecent(n)`」을 적는다 |
| A-참고① 로그인 복귀 알림이 바 밑에 깔림 | 참고 | keep MINOR | 리뷰어 인용 `Favorite.css:118-132` z 40. 스펙에 언급 없음 | I4 편집에 「바가 있을 때 `.favorite-resume-notice` bottom을 올린다」 한 줄을 더한다 |
| A-참고② / U-5 SECTION_JUMP는 view당 첫 건(병합) | 참고 / REVISE | keep REVISE | `tracker.ts:26-28` 키 `viewId|entityType|entityId|sectionId|action`에 payload 없음 | SR-6.3에 「PHONE·SECTION_JUMP도 view당 첫 건」을 적는다. Q5 지표는 「이동을 쓴 view 비율」로 바꾼다. 5.1에 두 번째 이동이 버려지는 단언을 더한다 |
| TS-1 대역 때문에 찜·계측 단언 불가 | REVISE | keep REVISE | `AttractionPage.test.tsx:16-20` FavoriteButton 대역에 `aria-pressed` 없음. `:32-35` `track: vi.fn()` | tasks 5.1·5.4: 새 `AttractionPage.actionBar.test.tsx`(진짜 tracker·FavoriteButton, wishlistApi만 대역, `pendingForTest()`)를 둔다 |
| TS-2 matchMedia 대역의 max-width가 늘 false | REVISE | keep REVISE | `AttractionPage.test.tsx:52` `matches: query.includes('min-width') ? wide : false` | SR-4.1에 질의 문자열을 고정한다(`not (min-width: 641px)` 또는 대역 수정을 명시) |
| TS-3 R2 주입이 KST 기기에서 초록 | REVISE | keep REVISE | spec.md:98 「`new Date().getDay()`(UTC)」. `getDay`는 로컬 요일이다. vite/vitest/package.json에서 TZ 검색 0건 | SR-8.9 R2: TZ 고정 + `setSystemTime`을 두고, `new Date(today).getDay()` 변형과 호출부 단언을 더한다 |
| TS-4 R6가 컴파일되지 않는 회귀 | REVISE | keep REVISE | `events.ts:27-59` 닫힌 유니온에 `ACTION_BAR` 없음 | R6를 「바 길찾기 payload 에서 source 제거」 또는 `'MAP_LINK'`로 바꾼다 |
| TS-6 「바 칸 포커스 bottom ≤ 바 top」은 성립 불가 | REVISE | keep REVISE | spec.md:88 원문 「Tab 으로 바 칸을 돌 때 포커스 요소 bottom ≤ 바 top」 | 「본문 포커스 요소(바 칸 제외)」로 고치고, R9가 여기서 빨강을 내는지 적는다 |
| TS-7 기준선·배포 후 표본 불일치 | REVISE | keep REVISE | spec.md:86 「필터 없음 첫 10장」만 있고 id 고정이 없음 | TG1에 id를 기록하고 고정 질의 둘을 정한다. 배포 후에는 같은 id를 비교한다 |
| TS-8 이미지 태그로 제외 확인 | REVISE | keep REVISE | spec.md:90 「`POST_SELECTION_SECTIONS` 가 여섯인지 이미지 태그로 확인」은 대상의 산출물이 아니다 | SR-8.6: 03:30 집계 뒤 `attraction_popularity_daily.clicks`와 원장 재집계를 대조한다(집계 전이면 「대기」) |
| TS-9 PHONE 주입·거리 반올림·PlacePage 테스트 범위 | REVISE | keep REVISE | `placeAttributes.ts:483-485` `` `${meters}m` `` 반올림 없음. R7은 SECTION_JUMP만 다룸 | R7b(PHONE)를 더한다. SR-2.4에 `Math.round(km*1000)`을 적고 테스트 두 값을 넣는다. 4.3 Verify를 `PlacePage*.test.tsx`로 넓힌다 |
| U-1 「눈에 띄게 바뀌었다」 완료 조건 없음 | REVISE | keep REVISE | spec.md:4 출발점이 사용자 지적인데, SR-8.2~8.8에 변화량 지표가 없음. `placeAttributes.ts:47-51` 영문은 반려·무장애 원천이 0 | SR-8.2: ko·en별로 배지·지역·찜이 붙은 카드 수를 잰다. TG1에 같은 id·같은 8장 기준선 캡처를 두고, 6.4에서 비포/애프터를 나란히 놓는다 |
| U-2 배지 순서가 사용자 스토리 2와 충돌 | REVISE | keep REVISE | spec.md:13 스토리 2. SR-2.3 순서상 반려·무장애가 4·5위라 상한 3에서 먼저 잘림 | SR-2.1·2.3에 순서 정책을 정한다(사용자 판단). TG1.3에 축별 채움률을 더한다 |
| U-3 「오늘 정기휴무」가 단정 | REVISE | keep REVISE | spec.md:41이 「명절 휴무를 모른다」를 금지 근거로 씀. 칩 문구 `placeAttributes.ts:55` 「(명절 제외)」 | SR-2.3 표 1행을 「오늘은 정기휴무일 / Regular closing day today」로 바꾸고 접근성 이름에 「매주 {요일} 휴무 규칙 기준」을 붙인다 |
| U-4 지역 라벨이 0px로 줄 수 있음 | REVISE | keep REVISE | SR-3.2 「지역 라벨 칸만 줄어든다」. 리뷰어 폭 계산에 반증 없음 | SR-8.2에 「390 지역 라벨 `clientWidth` ≥ 48px」을 더하거나, 라벨을 주소 줄 자리로 옮긴다(사용자 판단) |
| U-6 `sigunguName`이 지역 집계 유무에 묶임 | REVISE | keep REVISE | 리뷰어 A도 `AttractionSearchDocument.kt:192-200` `region()`이 `regionTypeCount` 조건임을 확인 | TG1.3 기대치를 `exists regionTypeCount AND sigunguName`으로 한다 |
| U-7 자정 경계·공유 칸 글자·찜 수 신선도 | REVISE | keep REVISE | `SharePanel.tsx:5` 복사 채널 글자 「링크 복사」 대 SR-4.4 「공유」 | SR-2.1에 「렌더마다 `todayKst()`」를 적는다. 공유 칸 글자는 I1과 함께 확정한다. 찜 수 기준일 표기를 정한다 |
| U-8 순위 번호·가짜 신호 확인 | (문제 없음) | **dismiss** | ⓒ 리뷰어가 인용 위치(`PlacePage.tsx:502`, SR-2.6)를 확인하고 문제 없음으로 판정함 | — |

## 사용자 판단 목록 (권고 기본값)

1. **용어(D-1)**: 「카드 상태 배지」로 바꾸고 `search/glossary.md`에 항목을 추가한다. CSS 클래스 `.place-card-badges`는 유지한다. *메인 제안과 같다.*
2. **무장애 배지(D-2)**: 필터와 같은 정밀 3종(휠체어·엘리베이터·장애인 화장실) 중 하나 이상일 때만 단다. `BARRIER_FREE_CHIPS` 코드를 import해서 판정한다.
   - 문구 ko는 「휠체어·승강기·장애인 화장실」 중 해당 범위를 말하는 짧은 문구로 한다(예: 「무장애 시설」).
   - 문구 en은 「Accessible facilities」로 한다.
   - 영문은 원천이 0이라 실제로 나오지 않지만 뜻은 맞춘다. *메인 제안과 같다.*
3. **휴무 배지 문구(U-3)**: 「오늘은 정기휴무일 / Regular closing day today」로 하고, 접근성 이름에 규칙 기준을 붙인다. *메인 제안과 같다.*
4. **변화량 완료 조건(U-1)**: ko·en 각각 첫 10장에서 배지·지역 라벨·찜이 붙은 카드 수를 잰다. 같은 관광지 id를 고정해 배포 전·후 8장 캡처를 남긴다. en 배지 카드가 3/10 미만이면 사용자에게 다시 묻는다. *메인 제안과 같다.*
5. **배지 순서(U-2)**: 휴무 → 무료 → 반려 → 무장애 → 주차로, 주차를 맨 뒤로 내린다. 칩 연동 앞당김은 하지 않는다(YAGNI).
6. **이동 줄 위치(I6.1)**: 스펙대로 `.place-detail-first` 뒤에 두되, 「요약·가는 법은 위로 거슬러 가는 이동」임을 SR-5.1에 명시해 수용한다. 행동 줄 바로 뒤로 옮기는 안은 폴드 재측정이 따라와서 권하지 않는다.
7. **바 공유 칸(I1·U-7)**: (a)안을 택한다. 공용 컴포넌트는 수정하지 않고, 바 범위 CSS로만 덮는다. 칸 글자는 SharePanel 그대로(share 「공유」, copy 「링크 복사」)다.
8. **계측 키 이름(A2·D-3)**: 기존 어휘인 `payload.source: 'action_bar'`를 쓴다.
9. **지역 라벨 배치(U-4)**: meta 줄에 유지하고, 390 최소 폭 측정(≥48px)을 완료 조건에 넣는다. 미달이면 주소 줄 자리로 옮긴다.
10. **넘친 배지(I8.2)**: 상한 3을 유지한다. 계측 뜻은 「cardFacts가 낸 배지」로 정의한다.
11. **제외 목록 구조(A3·D-4)**: 이번 범위는 거부 목록을 유지한다. 허용 목록 전환은 Q9로 기록만 한다.

```json
[{"id":"D-1","verdict":"keep","severity":"BLOCK"},{"id":"D-2","verdict":"keep","severity":"BLOCK"},{"id":"A1","verdict":"keep","severity":"REVISE"},{"id":"A2","verdict":"keep","severity":"REVISE"},{"id":"A3","verdict":"keep","severity":"REVISE"},{"id":"I1","verdict":"keep","severity":"REVISE"},{"id":"I2","verdict":"keep","severity":"REVISE"},{"id":"I3","verdict":"keep","severity":"REVISE"},{"id":"I4","verdict":"keep","severity":"REVISE"},{"id":"I5","verdict":"keep","severity":"REVISE"},{"id":"I6","verdict":"keep","severity":"REVISE"},{"id":"I7","verdict":"keep","severity":"REVISE"},{"id":"I8","verdict":"keep","severity":"REVISE"},{"id":"I9","verdict":"keep","severity":"REVISE"},{"id":"A-ref-resume-notice","verdict":"keep","severity":"MINOR"},{"id":"A-ref-section-jump-first","verdict":"keep","severity":"REVISE"},{"id":"SEC-ref-allowlist","verdict":"keep","severity":"REVISE"},{"id":"TS-1","verdict":"keep","severity":"REVISE"},{"id":"TS-2","verdict":"keep","severity":"REVISE"},{"id":"TS-3","verdict":"keep","severity":"REVISE"},{"id":"TS-4","verdict":"keep","severity":"REVISE"},{"id":"TS-5","verdict":"keep","severity":"REVISE"},{"id":"TS-6","verdict":"keep","severity":"REVISE"},{"id":"TS-7","verdict":"keep","severity":"REVISE"},{"id":"TS-8","verdict":"keep","severity":"REVISE"},{"id":"TS-9","verdict":"keep","severity":"REVISE"},{"id":"D-3","verdict":"keep","severity":"REVISE"},{"id":"D-4","verdict":"keep","severity":"REVISE"},{"id":"U-1","verdict":"keep","severity":"REVISE"},{"id":"U-2","verdict":"keep","severity":"REVISE"},{"id":"U-3","verdict":"keep","severity":"REVISE"},{"id":"U-4","verdict":"keep","severity":"REVISE"},{"id":"U-5","verdict":"keep","severity":"REVISE"},{"id":"U-6","verdict":"keep","severity":"REVISE"},{"id":"U-7","verdict":"keep","severity":"REVISE"},{"id":"U-8","verdict":"dismiss","severity":"MINOR"}]
```

SUMMARY: keep 35 / demote 0 / dismiss 1

NOTES: `portal-fe/src/styles/k-heritage.css:297-305` 의 `.kh-slab` 범위는 `--ko-text-secondary`·`--ko-text-primary` 를 판 위 색으로 바꿔 준다. 바에 이 범위를 쓰면 I1·I2 의 글자색 문제 일부가 토큰만으로 풀린다. 다만 포커스 링(`--kh-pine`)과 찜 켜짐 색(`--kh-yeonji`)은 이 범위가 바꾸지 않는다. 고칠 때 참고할 수 있다.

관련 경로:
- 스펙: `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-11-place-hub-list-cards/spec.md`
- 리뷰: `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-11-place-hub-list-cards/context/engineer-review-a.md`
- 리뷰: `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-11-place-hub-list-cards/context/engineer-review-b.md`
- 무장애 필터 코드: `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionAccessibility.kt`
- 용어 사전: `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/search/glossary.md`
---

**반영(2026-10-11)**: D-1 은 spec.md 머리말 「용어(Q10)」·SR-2.3·SR-3.1·3.3·SR-8.2~8.3, tasks.md 머리말·4.1·4.2·5.3(glossary 항목 추가), requirements.md R2·R6 에서, D-2 는 spec.md SR-2.3 표 4행 + `barrierFree` 판정 줄·SR-8.9 R4b, tasks.md 4.1·4.2, requirements.md 목표·제약 에서 해소했다. 사용자 판단 1~11 은 `context/open-questions.yml` Q10~Q19·Q9(+ U-7 찜 기준일 Q20)에 `answered-default` 로 기록했다.
