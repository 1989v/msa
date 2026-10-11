# Engineer Review A — architecture · implementation · security

대상: `docs/specs/2026-10-11-place-hub-list-cards/` (spec.md · tasks.md · context/open-questions.yml · planning/requirements.md)
기준 코드: 이 워크트리 HEAD. 경로는 레포 루트 기준이다.

| 관점 | 판정 | 이슈 |
|---|---|---|
| architecture | **REVISE** | 3 |
| implementation | **REVISE** | 9 |
| security | **SHIP** | 0 (참고 1) |

---

## 1. Architecture — REVISE

### A1 — REVISE · `sigunguName` 이 필수 읽기 필드(`searchReadRequired`)에 없다
- 근거: 이번 스펙에서 `sigunguName` 은 허브 카드 meta 줄이 읽는 값이 된다(spec.md:21, SR-2.2 spec.md:27). 그런데 계약 게이트의 필수 목록 `build.gradle.kts:537-556` 에 없다. 게이트는 읽기 클래스가 필드를 빠뜨려도 `searchReadOmitted` 에 사유 한 줄만 있으면 통과시킨다(`build.gradle.kts:612-616`). 필수 목록에 든 것만 막는다(`:602-611`). 지금은 `AttractionSearchDocument.kt:92` 가 읽고 있어 통과하지만, 나중에 빠지면 카드가 조용히 시도로 물러나고 아무 테스트도 실패하지 않는다. 직전 스펙 셋이 같은 지적으로 `savedCount`·`access`·`source` 등을 넣었다(`docs/specs/2026-10-10-place-visits-and-access/context/review-verdict.md:35`).
- 수정안: SR-1.3 의 「색인 매핑·재색인은 바꾸지 않는다」는 그대로 둔다. `searchReadRequired["attractions"]` 에 `"sigunguName"` 한 줄과 주석(「허브 카드 지역 라벨·상세 시군구 링크가 읽는다」)을 더한다. tasks 2.2 와 2.3 Verify 에 `./gradlew verifySearchIndexContract` 를 넣는다. requirements.md:38 의 「매핑 1줄」 제약도 같이 고친다.
- 참고(채움 경로 확인, 이슈 아님): 배치는 `sigunguName` 을 `region?.sigunguName` 으로만 쓴다(`search/batch/.../AttractionIndexDocument.kt:282`). 지역 배치가 있을 때만 `regionOf` 가 불린다(`AttractionApiReindexTasklet.kt:265-268`). 그래서 색인 필드의 유무는 `regionTypeCount` 의 유무와 같다. 읽기 쪽 `region()`(`AttractionSearchDocument.kt:192-200`)을 거쳐 `region?.sigunguName`(SR-1.2)으로 꺼내도 값을 잃지 않는다. KDoc 의 「지역 집계가 없는 문서는 null」(spec.md:20)은 정확하다.

### A2 — REVISE · `payload.placement` 키 이름이 원장의 `Placement` 와 겹친다
- 근거: 원장 이벤트에는 이미 `placement` 라는 구조 필드가 있고, 화면·섹션 위치(`screenType`·`sectionId`…)를 뜻한다(`analytics/.../EventCollectDtos.kt:74-82`, `common/.../analytics/Placement.kt:18`). 스펙은 같은 이름을 payload 키로 쓴다. 뜻은 「같은 섹션 안 UI 위치(행동 줄/바)」다(spec.md:73, Q8 open-questions.yml:43). ClickHouse 질의나 Kotlin 코드에서 `placement` 를 보면 어느 쪽인지 문맥 없이는 가를 수 없다.
- 수정안: payload 키를 `surface`(또는 `via`)로 바꾸고 값은 `'action_bar'` 로 둔다. SR-6.2·6.3, tasks 3.2·5.1·6.3, R6, `events.ts` 주석 문구를 함께 고친다. 바꾸지 않을 거면 ADR-0095 에 「payload.placement 는 원장 Placement 와 다르다」를 한 줄 적는다.

### A3 — REVISE(비차단) · 인기 집계 제외가 거부 목록이라 새 섹션마다 같은 누수가 되풀이된다
- 근거: 집계는 `section_id NOT IN (POST_SELECTION_SECTIONS)` 로 거른다(`ClickHouseAttractionPopularityAdapter.kt:42-44,64-65`). 화면 종류로는 거르지 않는다(`:67`). 이번 스펙이 `PHONE`·`SECTION_JUMP` 를 더하는 것도 이 구조 때문이다(spec.md:76). 2026-10-09 에는 길찾기·공유를 더했다(ADR-0095:130-132). 클릭 섹션이 생길 때마다 analytics 를 같이 배포해야 하고, 순서를 놓치면 그날 `clicks`·`clickBoost` 가 부푼다(spec.md:77).
- 수정안: 이번 범위에서는 스펙대로 둔다. 다만 ADR-0095 에 적을 한 줄(SR-6.4)에 「다음 후속 행동 섹션이 또 생기면 허용 목록(`ATTRACTION_LIST`·`MAP_OVERLAY`·주변/추천 섹션)으로 뒤집는 것을 검토」를 기록한다. 원칙(「목록 밖이 아니라 선택 뒤」, `AggregateAttractionPopularityUseCase.kt:27-29`)을 바꾸는 판단이라 ADR 개정 대상이고, 여기서는 기록만 한다.

### 통과 항목
- 레이어: search 변경은 application 서비스 매핑 한 줄과 UseCase 결과 필드 하나다(`SearchAttractionService.kt:328` 근처). 응답 DTO 는 UseCase 결과를 그대로 싣는다(`presentation/search/dto/AttractionDetailResponse.kt:13`). 도메인·포트 변경이 없다. analytics 는 application 상수 하나다.
- 모듈 깊이: `cardFacts` 는 배지 순서·상한·부정값 미표시·KST 요일 판정을 한 함수 뒤에 숨긴다(spec.md:26-46). 지금 부르는 곳은 `PlaceCard` 하나다. 그래도 RegionPage 후속(Q3, open-questions.yml:18)과 단위 테스트가 근거라 삭제 테스트를 통과한다. 새 인터페이스나 1-어댑터 seam 이 없다.
- 지식 사본: `SAVED_MIN` import(spec.md:45)·`distanceLabel`·`closureBadge` 판정 재사용(spec.md:40,44)이 맞다. 서버 `ClosedToday.isRegularlyOpen`(`search/domain/.../ClosedToday.kt:18-22`)과 FE `closedToday` 배지가 같은 규칙을 따로 갖게 된다. 그러나 질의 필터와 화면 표시라는 다른 경계이고, R2(spec.md:98)가 KST 경계를 고정하므로 수용한다.

---

## 2. Implementation — REVISE

### I1 — REVISE · `SharePanel` 을 그대로 쓰면 바 칸 규격(아이콘·글자·판 위 색·포커스)을 만족할 수 없다
- 근거: `SharePanel` 은 자체 `role="group"` 래퍼(`components/share/SharePanel.tsx:80`)와 글자만 있는 버튼을 그린다. 복사 채널의 글자는 「링크 복사/복사됨」이다(`:5,90`). 스펙은 공유 칸에 「아이콘 + 공유」(spec.md:59)를 요구하고, 바는 이미 `role="group"` 이다(spec.md:62). 그러면서 컴포넌트 수정은 범위 밖으로 둔다(spec.md:120). 버튼 색 `--ko-text-secondary`(`SharePanel.css:14`)는 라이트에서 `#46464a`, 바 바탕 `--kh-giwa`(`#1d1d1f`, `styles/k-heritage.css:25,43`)라 대비가 약 1.9:1 이다. 포커스 링 `--kh-pine`(`k-heritage.css:54`)도 기와 위에서 보이지 않는다.
- 수정안: 둘 중 하나를 고른다. (a) 바 전용 CSS(`.place-action-bar .share-panel__btn{…}`)로 색·포커스·칸 채움을 덮고, 「공유 칸은 아이콘 없이 글자만, 복사 채널은 '링크 복사'」로 SR-4.4 를 고친다. 그룹 중첩은 허용한다고 적는다. (b) `SharePanel` 에 `label`/`icon` 선택 prop 을 더한다. 그러면 범위 밖 목록(spec.md:120)에서 SharePanel 을 빼고 `src/components/share` 테스트를 Verify 에 둔다(tasks 5.4 에는 이미 있다). 어느 쪽이든 SR-8.3 대비 측정 목록에 「바 공유 칸 글자·포커스 링」을 명시한다.

### I2 — REVISE · `FavoriteButton` 별이 기와 판 위에서 안 보이고, 「칸 전체 누름」이 성립하지 않는다
- 근거: 기본(비 compact) 별 색은 `--ko-text-secondary`(`components/favorite/Favorite.css:21`)라 라이트에서 기와 위 약 1.9:1 이다. 찜한 상태 `--kh-yeonji`(`:48`, `#a2231d`)도 기와 위 약 2:1 이다. 포커스 윤곽 `--ko-text-primary`(`:26`)는 라이트에서 기와 그 자체라 0 대비다. 버튼은 44×44 고정이고(`:15-16`) 자식을 받지 않는다(`FavoriteButton.tsx:94-105`). 그래서 옆에 둔 `aria-hidden` 글자 「찜」(spec.md:59)을 눌러도 아무 일이 없다. SR-8.3(spec.md:87)은 「바 글자」만 재고 아이콘 비텍스트 대비(3:1)·포커스는 재지 않는다.
- 수정안: SR-4.5 에 바 범위 덮어쓰기를 적는다. `.place-action-bar .favorite-btn{width:100%;height:100%;color:var(--kh-on-slab)}`, 켜진 상태와 `:focus-visible` 색을 정한다. 글자는 버튼 위에 `pointer-events:none` 으로 겹치거나 버튼이 칸을 다 채우게 한다. SR-8.3 에 「바 아이콘 4칸 ≥ 3:1(켜짐·꺼짐), 바 포커스 링 ≥ 3:1」을 더한다. 회귀 주입 표에 「바 별 색 덮어쓰기 제거 → 대비 < 3」 한 줄을 둔다.

### I3 — REVISE · `hidden` 속성과 표시 전환(opacity·transform)이 서로 막는다
- 근거: SR-4.2 는 숨김을 `hidden` 속성으로 한다(spec.md:57). SR-4.7 은 160ms 전환을 요구한다(spec.md:62). 바에 `display:flex` 를 주면 작성자 규칙이 UA 의 `[hidden]{display:none}` 을 이긴다. 그러면 「숨김」 상태에서도 그려지고 접근성 트리에 남는다. 반대로 `display:none` 이 되면 나타날 때 전환이 돌지 않는다.
- 수정안: CSS 에 `.place-action-bar[hidden]{display:none}` 을 명시한다. 등장 전환은 `@starting-style` 로 하거나 전환 요구를 뺀다(reduced-motion 분기도 단순해진다). tasks 5.1 에 「hidden 일 때 계산 display = none」 단언을 더한다. jsdom 은 CSS 를 계산하지 않으므로 이 단언은 CDP 측정(SR-8.4)에 둔다.

### I4 — REVISE · 하단 여백·`scroll-padding-bottom` 의 적용 범위가 정해지지 않았다
- 근거: `.place-page` 는 허브·지역·상세가 같이 쓴다(`PlacePage.css:2-17,872-876`). `html{scroll-padding-bottom}`(spec.md:61)을 미디어 쿼리 안 전역 규칙으로 두면 같은 번들의 모든 화면(허브·블로그 등 ≤640)에 붙는다.
- 수정안: SR-4.6 에 범위를 적는다. 상세 루트에 수식 클래스(예: `.place-page.has-action-bar`)를 두고, `html` 쪽은 `:root:has(.place-action-bar)` 로 한정하거나 effect 에서 `data-` 속성을 걸고 정리(unmount 시 제거)한다. tasks 5.1 에 「허브 렌더 시 루트에 그 속성이 없다」를 더한다.

### I5 — REVISE · `history.replaceState` 로 해시를 지우면 라우터 상태가 날아갈 수 있다
- 근거: 클릭에서 기본 동작을 막으므로(spec.md:67) 주소에 해시가 애초에 붙지 않는다. 이 상태에서 `history.replaceState(null, '', …)` 를 부르면 React Router 가 `history.state` 에 둔 `{usr,key,idx}` 를 지운다. 그러면 뒤로 가기와 스크롤 복원이 어긋난다. 주소 이동은 라우터를 거친다(`AttractionPage.tsx:333-335` `Navigate`).
- 수정안: SR-5.3 에서 replaceState 를 뺀다(막았으니 지울 해시가 없다). 남기려면 `history.replaceState(history.state, '', pathname + search)` 로 적는다. tasks 5.1 의 「`location.hash` 가 비어 있다」 단언은 그대로 둔다.

### I6 — REVISE · 절 이동 줄의 위치·대상이 실제 DOM 과 어긋난다
- 근거:
  1. 「요약」(`section.place-visit`, `AttractionPage.tsx:488-499`)과 「가는 법」(`AttractionAccess`, `:469-487`)은 `.place-detail-first` **안**에 있다(`:370-659`). 이동 줄은 그 뒤에 둔다(spec.md:65). 그래서 두 링크는 위로 거슬러 올라가는 이동이고, 도착하면 이동 줄은 흐름 속 아래로 돌아가 sticky 가 아니다. 스펙은 이것을 언급하지 않는다.
  2. 「이용 안내 → `AttractionInfoTabs`」(spec.md:66)인데 그 컴포넌트의 이름은 「방문 정보/At a glance」(`AttractionInfoTabs.tsx:20,60`)다. 「이용 안내」(`L.info`)라는 제목의 절은 `.place-detail-side` 안의 `section.place-detail-info`(`AttractionPage.tsx:626-636`)로 따로 있다. 링크 글자와 도착 절 제목이 다르다.
  3. `AttractionInfoTabs` 루트는 제목이 없는 `div`(`AttractionInfoTabs.tsx:71`)다. 「포커스 뒤 절 제목부터 읽는다」(spec.md:15,67)가 이 절에서는 성립하지 않는다.
  4. `NearbyExplore` 는 목록이 비면 `null` 이다(`NearbyExplore.tsx:201`). 목록은 비동기다(`AttractionPage.tsx:304-325`). 「둘 미만이면 그리지 않는다」(spec.md:66) 때문에, 동기 절이 하나뿐인 유형(행사·숙박은 요약이 없다, `:275`)에서는 주변 목록이 도착할 때 44px 줄이 끼어든다. 레이아웃 이동이 생긴다(SR-8.5 대상).
- 수정안: (1) SR-5.1 에 「요약·가는 법은 이동 줄보다 위에 있다」를 적고 받아들일지 정한다. 대안은 이동 줄을 `.place-detail-lead` 안 행동 줄 바로 뒤에 두는 것이다(그러면 첫 화면 폴드·길찾기 폴드 측정 SR-8.4 를 다시 확인해야 한다). (2) 링크 글자를 「방문 정보/At a glance」로 바꾸거나 대상을 `section.place-detail-info` 로 바꾼다. (3) 포커스 대상에 `aria-labelledby`/`aria-label` 을 준다(정보 탭이면 `L.group`). (4) 줄 표시 여부는 동기 절(요약·가는 법·정보)로만 정하고, 주변 링크는 나중에 끼어도 높이가 변하지 않게 한다. 또는 주변 링크를 처음부터 자리만 두고 비활성으로 둔다. 스크롤은 `scrollIntoView` 뒤 `focus({ preventScroll: true })` 로 적는다. 아니면 포커스가 한 번 더 스크롤해 부드러운 스크롤이 끊긴다.

### I7 — REVISE(비차단) · 행동 줄 관찰에 sticky 머리띠 높이가 빠졌다
- 근거: ≤640 에서 머리띠는 `position: sticky; top:0`(`PlacePage.css:879-887`)이다. 표시 조건 `boundingClientRect.bottom < 0`(spec.md:57)은 행동 줄이 머리띠 밑으로 다 가려진 뒤에도 머리띠 높이만큼 더 내려야 참이 된다. 그 구간에서는 행동 줄도 바도 안 보인다.
- 수정안: IO 에 `rootMargin: -${--place-header-h} 0px 0px 0px` 을 주고 조건을 `bottom < rootBounds.top` 으로 바꾼다. SR-5.1 의 ResizeObserver 값과 같은 것을 쓴다. SR-8.4 의 「bottom < 0 까지 스크롤하면 300ms 안에 표시」도 기준을 머리띠 bottom 으로 고친다.

### I8 — REVISE · 카드: 찜 수 접근성 문구와 넘친 배지의 계측
- 근거:
  1. 카드는 통째로 `<a>`(`PlacePage.tsx:2162-2225`)라 이름은 안 글자의 합이다. 「찜 n」 span 에 `aria-label`(spec.md:45)을 달면 generic 요소라 무시된다.
  2. 배지 줄은 `overflow:hidden` 으로 넘친 배지를 숨긴다(spec.md:51). 그러나 숨은 배지도 링크 이름에 읽힌다. 그리고 `payload.badges` 는 「그린 배지」(spec.md:72)라 사용자가 보지 못한 code 까지 실린다. 390px 에서 「반려동물 일부 구역」 같은 긴 배지가 세 번째일 때 생긴다.
  3. `max-height` 「한 줄」의 값이 정해지지 않았다. 배지 높이는 글자 0.72rem × line-height + 위아래 padding + 테두리다(`.place-badge` 기준 `PlacePage.css:1456-1462`). 값이 조금만 작아도 첫 줄이 통째로 숨는다.
- 수정안: (1) 보이는 「찜 n」에 `aria-hidden`, 옆에 시각 숨김 텍스트로 「이 사이트 회원 n명이 찜」을 둔다. (2) 계측 뜻을 「cardFacts 가 낸 배지(최대 3)」로 고쳐 적거나, 상한을 폭 기준(ko 3 / en 2)으로 줄여 넘침 자체를 없앤다. (3) `.place-card-badges` 에 `line-height` 를 고정하고 `max-height` 를 같은 식(`calc(…)`)으로 적는다. SR-8.2 의 「배지 줄 ≤ 24px」와 맞춘다.

### I9 — REVISE · 테스트 고칠 곳 누락과 배포 순서가 어긋났을 때의 복구
- 근거:
  1. `ClickHouseAttractionPopularityAdapterTest` 는 `:86` 의 집합 말고도 SQL 문자열에 네 섹션을 그대로 적은 단언이 있다(`:60,72,77,79`). tasks 3.1 은 `:86` 만 적는다(tasks.md:22).
  2. 배포 순서(spec.md:77)를 어기면 그날 집계가 부푼다. 복구 경로가 스펙에 없다. 접기는 날짜별로 지우고 다시 넣으므로 몇 번을 돌려도 같다(`AggregateAttractionPopularityUseCase.kt:14-20` `reaggregateRecent`).
- 수정안: tasks 3.1 에 `:60·:72·:77·:79` 를 더한다. SR-6.5 에 한 줄을 더한다. 「FE 가 먼저 떴으면 analytics 배포 뒤 `reaggregateRecent(n)` 으로 그 날짜를 다시 접는다. 다음 재색인이 `clickBoost` 를 바로잡는다」. 롤백은 비대칭이 없다. 옛 search 응답에는 `sigunguName` 이 없고, FE 는 시도로 물러난다(spec.md:27).

### 통과 항목
- 참조 존재: `SearchAttractionService.kt:164,242,328`, `AttractionSearchDocument.kt:92,192-200`, `placeAttributes.ts:308-312,343,483,493`, `visitSignals.ts:23`, `seo/eventSchedule.ts:31`, `useMediaQuery.ts:8`, `kh-shell.css:32-44`, `PlacePage.css:1076-1088,1455` 가 모두 실제와 맞는다.
- 탭바 충돌 없음: place 호스트는 `KhTabBar` 를 그리지 않는다(`components/shell/KhTabBar.tsx:16-18,38`). 그래서 `--kh-shell-bottom` 도 없다(`kh-shell.css:55-63`). 허브의 모바일 상세는 `KhSheet`(`PlacePage.tsx:2014-2017`)라 `AttractionPage` 의 바와 같은 화면에 동시에 뜨지 않는다. 사진 보기(z 1000, `PlacePage.css:627-629`)가 바 위에 온다.
- 남는 겹침(이슈 아님, 참고): 로그인 복귀 알림 `.favorite-resume-notice` 는 하단 16px · z 40 이다(`Favorite.css:118-132`). 바(z 200)가 보이는 동안 나오면 바 밑에 깔린다. 복귀 직후는 첫 화면이라 바가 숨어 있어 실제로는 드물다. 바가 있을 때 알림의 `bottom` 을 바 높이만큼 올리는 한 줄을 I4 와 같이 처리하면 된다.
- 찜 동기: 두 별은 같은 react-query 키를 공유한다(`useFavorites.ts:25-56`). SR-4.3 의 「함께 바뀐다」가 성립한다.
- 계측 수용: payload 는 `Map<String, Any?>` 라 배열 `badges` 가 400 을 내지 않는다(`EventCollectDtos.kt:57,89`). 저장은 JSON 문자열이다(`EventRepositoryAdapter.kt:52`). `analytics.events` 를 직접 읽는 다른 ATTRACTION 소비자는 없다(`place/ingest/src/popularity.py:7` 은 집계 표만 읽는다).
- 참고: `SECTION_JUMP` 도 중복 키에 payload 가 없다(`tracker.ts:26-28`). 그래서 view 당 첫 이동 하나만 남는다. Q5(스크롤 스파이 후속 판단, open-questions.yml:28)의 근거로 쓸 때 「view 당 첫 target 분포」라고 SR-6.3 에 한 줄 적는다.

---

## 3. Security — SHIP

| 항목 | 판정 | 근거 |
|---|---|---|
| 정보 노출 | 통과 | `sigunguName` 은 공개 행정 지명이다. 단건 응답에는 이미 `region.sigunguName` 으로 나간다(`SearchAttractionService.kt:331`). `PHONE` payload 는 `{ placement? }` 뿐이고 번호를 남기지 않는다(spec.md:75). `badges` 는 고정 code 다 |
| 입력·출력 경계(XSS) | 통과 | 카드·바 글자는 React 텍스트 노드다. 전화 href 는 숫자·`+` 만 남긴 `tel:` 이다(`seo/copy.mjs:1113`). 길찾기 URL 은 `encodeURIComponent` 로 조립한다(`pages/place/googleMaps.ts:80-84`). 새 탭은 `rel="noreferrer"` 다(`AttractionPage.tsx:440`) |
| 인증·인가 | 통과 | 바의 찜은 `FavoriteButton` 그대로라 게스트 → apex 로그인 경로가 같다(`FavoriteButton.tsx:83-89`, ADR-0079). 새 API·권한이 없다 |
| 공유 주소 | 통과 | 단축 주소 → canonical 순서이고 현재 주소(쿼리·해시)를 싣지 않는다(`SharePanel.tsx:49`). 바도 `url` 을 넘긴다(spec.md:58) |
| 변조(계측) | 통과 | 새 섹션 둘을 집계에서 빼므로 상세의 반복 클릭으로 `clickBoost` 를 올리는 길이 늘지 않는다(spec.md:76) |
| 시크릿·암호화·서비스 간 통신 | 해당 없음 | 새 시크릿·내부 호출이 없다 |

- 참고(기존 위험, 이번 변경으로 커지지 않음): 원장 집계가 거부 목록이라, 클라이언트가 임의 `sectionId` 로 CLICK 을 보내면 지금도 `clicks` 에 들어간다(`ClickHouseAttractionPopularityAdapter.kt:64`, `EventCollectDtos.kt:45`). A3 의 허용 목록 전환이 이 표면도 함께 줄인다. 이번 스펙의 차단 사유는 아니다.

VERDICT: REVISE
