# 요구사항 — place 허브 결과 카드 · 모바일 상세 하단 행동 바

## 목표
1. 허브 결과 카드가 「어디·오늘 가도 되는지·무엇이 되는지」를 한눈에 준다 — 시군구 라벨, 카드 상태 배지(오늘 정기휴무·연중무휴·입장 무료·반려·무장애·주차 순, 무장애는 목록 필터 정밀 3종일 때만), 거리, 이 사이트 찜 수(하한 3). 리뷰·평점은 없으므로 만들지 않는다.
2. 390×844 상세에서 첫 화면을 지나 스크롤해도 길찾기·찜·공유·전화가 한 번에 닿고, 절(요약·가는 법·방문 정보·주변)로 바로 뛴다.
3. 카드·행동 바 클릭이 기존 원장 규약(ADR-0095)대로 남고, 인기 집계(`clicks`·`unique_clickers`)를 부풀리지 않는다.

## 벤치마크 근거 (리포트 `place 관광지 검색 글로벌 벤치마킹.md`)
- §3.1 표 5순위 「결과 카드에 상태 배지·시군구 라벨·거리·순위 번호」(영향 중·비용 낮음), 10순위 「모바일 고정 액션 바(길찾기·저장·공유) + 섹션 점프 탭」(영향 중·비용 중).
- §3.2 「결과 카드」: 원문 — 「카드 최소 집합은 「사진 · 이름 · 분류 · 평가 신호 · 한 줄 설명」이고, 리뷰 없는 Lonely Planet 은 「Attraction in Gangnam & Southern Seoul」처럼 동네 라벨로 분류 정보를 강화한다」, 「place 카드는 지금 개요 2줄을 싣는데, 이를 「시군구 라벨 + 상태 배지(오늘 휴무·무료·주차·반려) + 거리(내 주변일 때) + 사실 한 줄」로 바꾸고, 정렬이 인기순일 때 Japan-Guide 식 순위 번호를 붙인다」.
- §3.2 「모바일 허브」: Google Maps 의 「지도 위 시트 + 하단 고정 액션 바」(9to5google 2025-04).
- 평가 신호는 이 사이트에서 실제로 잰 것만 쓴다 — 회원 찜 수(`savedCount`, 하한 3, `visitSignals.ts:20-23`). 순위 번호는 인기순 정렬이 없어 붙이지 않는다(아래 브라운필드 ⑤).

## 브라운필드 지도 (2026-10-11, 경로는 레포 루트 기준)
- **① 지금 카드** `portal-fe/src/pages/place/PlacePage.tsx:2122-2227` `PlaceCard` — 사진 88px(`:2190-2202`) · 찜 별(`:2204-2213`) · 제목 h3(`:2215`) · 현지명(`:2216`) · meta 줄 = 분류 + `distanceKm.toFixed(1)km`(`:2217-2220`) · `EventLine`(`:2221`) · 주소 1줄(`:2222`) · 개요 2줄(`:2223`). 지역 페이지 `RegionPage.tsx:280-296,305-330` 은 같은 `.place-card` 클래스에 별도 마크업. CSS `PlacePage.css:434-524`(개요 `-webkit-line-clamp: 2` `:518-524`). 기존 단언 `__tests__/PlacePage.test.tsx:334`(개요 텍스트).
- **② 목록 응답에 있는 것** — 목록은 `toResult(summarize = true)`(`search/app/.../application/attraction/service/SearchAttractionService.kt:164`), 단건은 `false`(`:242`). 목록에도 실리는 값: `category` · `sidoName`(`:309`) · `distanceKm`(`:313`, geo 질의일 때만) · `closureState`·`closedWeekdays`(`:321-322`) · `attrParking`·`attrCreditCard`·`attrStrollerRental`·`petPolicy`·`attrAdmission`(`:323-327`) · `savedCount`(`:344`, 하한 미만 null — `SearchAttractionUseCase.kt:152-156`) · `barrierFree`(`:349`, 「목록·단건 모두」 `SearchAttractionUseCase.kt:167`) · `wellnessThemeName` · `thumbnailUrl` · `contentTypeId`·`eventStart/End`. FE 타입 `portal-fe/src/api/placeApi.ts:66,74,80-87,105,109`.
- **③ 목록에서 빠지는 것** — `region`(시군구 이름·코드 포함, `SearchAttractionService.kt:328`) · `similarElsewhere` · `uniqueClickers14d`(`:343`) · `barrierFreeDetail` · `congestion` · `relatedPlaces` · `samePlace` · `access`(`:358`). KDoc 근거 「지역 안 위치 — 단건 조회에만 싣는다(목록 응답을 무겁게 하지 않는다)」(`SearchAttractionUseCase.kt:143`). **시군구 이름은 목록 응답에 없다.**
- **④ 시군구 이름의 출처** — 색인 문서 필드 `sigunguName`(`search/app/.../opensearch/AttractionSearchDocument.kt:92`), 재색인이 언어별 이름표로 채운다(`search/batch/.../job/AttractionApiReindexTasklet.kt:130-131,573`, 색인 매핑 `search/batch/.../indexing/AttractionIndexDocument.kt:282`). 도메인에서는 `AttractionRegion.sigunguName`(`search/domain/.../AttractionRegion.kt:12`)이고 `regionTypeCount` 가 있을 때만 `region()` 이 만들어진다(`AttractionSearchDocument.kt:192-200`). 즉 목록에 실으려면 응답에 평평한 필드 하나(`sigunguName`)를 더하고 summarize 와 상관없이 채우면 된다. 이름표를 못 받은 회차는 null 이다(`Tasklet.kt:131` 로그) — 화면은 `sidoName` 으로 물러난다.
- **⑤ 정렬** API 는 `relevance`·`distance`·`eventStart`·`saved`·`clicked` 를 받지만(`SearchAttractionUseCase.kt:23`) 허브는 `eventStart`(행사) · `distance`(geo) · `relevance` 만 보낸다(`PlacePage.tsx:502`). 허브 목록에 인기순이 없으므로 관련도·거리 순서에 번호를 붙이면 「순위」로 읽혀 가짜 평가 신호가 된다.
- **⑥ 상태 판정 재료** `placeAttributes.ts:314-328` `closureBadge`(연중무휴·매주 X요일 휴무, 요일 없는 WEEKLY 는 그리지 않음) · `:343-363` `visitorBadges`(UNKNOWN 은 그리지 않음 — 「모른다」가 「아니다」로 읽히지 않게) · 칩 문구 「오늘 정기휴무일 아님(명절 제외)」(`:55`). 오늘 날짜는 `seo/eventSchedule` 의 `todayKst()`(`:31`) — 행사 상태와 같은 이유로 응답에 상태를 싣지 않는다(`SearchAttractionUseCase.kt` `eventStart` KDoc).
- **⑦ 상세 행동 줄** `AttractionPage.tsx:410-466` `.place-detail-actions`(지도 열기 `MAP_LINK` · 길찾기 `DIRECTIONS` · 전화 — 전화는 계측 없음) · 공유 `SharePanel`(`:386-404`, `SHARE` + `payload.channel`) · 찜 `FavoriteButton`(`:375-381`) · 전화 판정 `:278-279`(`attractionPhone`, href 없으면 글만). 절 표지 `data-place-section`: `actions`·`access`(`AttractionAccess.tsx`)·`visit-summary`·`info`(`AttractionInfoTabs.tsx`)·`explore`(`NearbyExplore.tsx`)·`recommend`. 행동 줄은 직전 스펙(`docs/specs/2026-10-10-place-screen-polish` SR-6)으로 방문 요약 위에 와 있다.
- **⑧ 모바일 셸** place 호스트에는 하단 탭바가 없다(`components/shell/KhTabBar.tsx:16-18`). 상세 머리띠는 ≤640px 에서 sticky z 200(`PlacePage.css:878-886`). 하단 고정 요소 선례는 허브 보기 전환(`PlacePage.css:1076-1088`, `--kh-shell-bottom` · z 200). 탭바 면 토큰 `--kh-giwa`·`--kh-slab-border`(`styles/kh-shell.css:32-44`). z 스케일 `docs/conventions/frontend-design.md:139-150`.
- **⑨ 계측 규약** `analytics/tracker.ts:20-34` 와 서버 `EventCollectDtos.kt:60-68` 이 `(viewId, entityType, entityId, sectionId, action)` 으로 중복을 거른다 — payload 는 키에 없다. 인기 집계는 `entity_type = 'ATTRACTION'` 전체에서 `POST_SELECTION_SECTIONS`(`MAP_LINK`·`FAVORITE`·`DIRECTIONS`·`SHARE`, `analytics/.../AggregateAttractionPopularityUseCase.kt:31`)만 뺀다(`ClickHouseAttractionPopularityAdapter.kt:43-66`). 화면 종류로 거르지 않으므로 **상세 화면의 새 섹션 클릭도 빼지 않으면 인기 클릭으로 들어간다.** FE 섹션 유니온 `analytics/events.ts:27-60`, 기대 고정 테스트 `ClickHouseAttractionPopularityAdapterTest.kt` — 기대 집합 `:86` 과 SQL 리터럴 `:60·72·77·79` 다섯 곳.
- **⑩ 서버 렌더·프리렌더** 허브 프리렌더 목록은 제목 링크뿐(`portal-fe/scripts/prerender-seo.mjs:1294-1311`), 지역 프리렌더도 같다(`:1447`). 상세 서버 렌더 행동 줄은 전화 하나(`AttractionPageRenderer.kt:626`). 화면은 `createRoot` 로 서버 본문을 갈아 끼운다(`portal-fe/src/main.tsx:31`).

## 범위
- R1 검색 응답에 `sigunguName` 한 필드(목록·단건 모두). FE 타입 한 줄.
- R2 허브 카드 내용 교체: meta 줄(분류 · 시군구 라벨 · 거리 · 찜 N) + 카드 상태 배지(최대 3, 한 줄) + 개요 1줄. 「카드 상태 배지」는 상세의 「배지 줄」(`search/glossary.md`, `visit-badges`)과 다른 것이라 이름을 따로 둔다(리뷰 심판 D-1). 주소 줄은 카드에서 뺀다. 판정 함수는 `placeAttributes.ts` 의 순수 함수 하나.
- R3 모바일 상세(≤640px) 하단 행동 바 — 길찾기 · 찜 · 공유 · 전화. 행동 줄이 화면 위로 지나간 뒤에만 보인다.
- R4 모바일 상세 절 이동 줄 — 요약 · 가는 법 · 방문 정보 · 주변(있는 절만).
- R5 계측: 카드 노출·클릭 payload 에 배지 코드, 행동 바는 기존 섹션 + `payload.source: 'action_bar'`(카드 `source: 'card'` 와 같은 어휘 — `placement` 는 광고 지면 이름과 겹친다, 리뷰 심판 A2·D-3), 새 섹션 `PHONE`·`SECTION_JUMP` 를 인기 집계 제외 목록에 더한다.
- R6 k-heritage 견본에 카드 상태 배지·하단 행동 바 견본 추가, `search/glossary.md` 에 「카드 상태 배지」 항목.

## 범위 밖
- 「가봤다」(리포트 #9), 리뷰·평점·순위 번호, 인기순 정렬, 지역 페이지(`RegionPage`) 카드 내용 교체(후속 Q), 허브 데스크톱 상세 패널, 프리렌더·서버 렌더 목록 변경, 분석 대시보드.

## 제약
- 최소 수정: search 응답 필드 1 + `toResult` 1줄 + 색인 읽기 계약 `searchReadRequired["attractions"]` 에 `sigunguName` 1줄(색인 매핑은 그대로), FE 카드·상세·CSS·이벤트 유니온, analytics 상수 1줄 + 테스트 기대, k-heritage 견본. 색인 매핑·재색인 변경 없음(`sigunguName` 은 이미 색인에 있다).
- hex 금지, 토큰만. 배지 모양은 상태 표시 9999px(`PlacePage.css:1455` 주석).
- UNKNOWN·NO·PAID 는 카드에 그리지 않는다 — 배지가 없다는 것은 「아니다」가 아니다. 카드에는 확인된 긍정값과 휴무만.
- 무장애 배지는 목록 필터와 같은 정밀 3종(`WHEELCHAIR`·`ELEVATOR`·`RESTROOM`, `AttractionAccessibility.FILTER_CODES` = FE `BARRIER_FREE_CHIPS`) 기준이다. 원천의 다른 코드(`PROMOTION`·`LACTATION_ROOM` 등)는 라벨 정밀도가 검증되지 않았다(리뷰 심판 D-2).
