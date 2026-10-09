# 스펙 F(place-return-share-events) TG8.1 — 회귀 주입(SR-4.3)

- 2026-10-09 KST. 임시 사본 `scratchpad/wt-inject-f`(detached `40a8bc94b`)에서 했다. 원본 wt-impl 과 메인 트리는 손대지 않았고, 끝난 뒤 사본을 지웠다.
- 사본 준비: 서브모듈 ai·auth·gifticon 은 메인 `.git/modules` 에서 `clone --shared` 한 뒤 포인터 sha 를 checkout 했다. `portal-fe/node_modules` 는 wt-impl 것을 심링크했다(`package-lock.json` 은 `cmp` 로 동일 확인). 생성 파일 `src/pages/tech/generated/search-architecture.json`(gitignore 대상)은 wt-impl 에서 복사했다. 복사하지 않으면 기준선 tsc 에서 무관한 오류 9건이 난다.
- 주입 전 기준선(전부 종료 0):
  - tsc `npx tsc -b` 종료 0.
  - vitest: `FavoriteButton.test` + `PlacePage.loginReturn` 2 파일 41 passed. `FavoritesPage.share.test` 8 passed. `gaLoader.test` 5 passed.
  - Kotlin(전부 skipped 0): `CollectionShareTest` 10/0, `CollectionShareServiceTest` 14/0, `ShareDisabledDispatchTest` 2/0, `MemberEventConsumerTest` 3/0, `WishlistSchemaIntegrationSpec` 9/0, `SharedCollectionControllerTest` 5/0, `CollectionShareControllerTest` 8/0, `GatewayRouteAuthSpec` 62/0, `ShortLinkRouteSpec` 9/0, `ClickHouseAttractionPopularityAdapterTest` 6/0.
  - 스키마 스펙은 Docker 29.4.1 로 실제 실행됐다(skipped 0).
- 진행 방식: 주입은 한 번에 하나씩 넣고 대상 테스트만 돌렸다. 그 뒤 `git checkout -- .` 로 되돌리고 `git status --porcelain` 이 비었는지 확인했다(28건 모두 clean).
- 컴파일 확인:
  - FE 주입은 건마다 `npx tsc -b` 를 따로 돌렸고, 28건 모두 오류 0건이다.
  - #19·T3 첫 판은 TS2774·TS6133 이 나서 결과를 버렸다. 컴파일되는 형태(`[onBeforeLogin][1]`, `[filterScope].slice(1)`)로 바꿔 다시 쟀다.
  - Kotlin 주입은 테스트 실행이 main·test 컴파일을 포함한다. 모두 결과 xml 이 생겼고 실패는 단언 실패다(컴파일 실패 0).
- 빨강은 모두 해당 단언의 실패다. 같은 파일의 다른 테스트가 통과했으므로 모듈은 정상 로드됐다.
- 범위: tasks.md TG8.1 표 21건(9·15·21 은 세분)과 TG7 메모 셋(①은 #14 와 같은 주입이라 한 번만 셌다), 그리고 TG3·TG4 에서 「처음부터 초록」이던 것(#8·#9·#10·#15)을 다뤘다.

| # | 주입 (diff 요지) | 대상 테스트 | 결과 · 실패한 테스트 |
|---|---|---|---|
| 1 | 의도 저장 삭제 — `FavoriteButton` 의 `writeFavoriteIntent` 호출을 `targetKey === '\u0000'` 조건으로 죽임 | FavoriteButton.test · PlacePage.loginReturn | 종료 1 · 2 failed \| 39 passed (41) — 「ATTRACTION — 의도를 저장하고, onBeforeLogin 을 href 대입 전에 한 번 부른다」·「이어 붙인 시나리오」 |
| 2 | 허브 상태 복원 삭제 — `restored` 를 늘 null | PlacePage.loginReturn | 종료 1 · 6 failed \| 17 passed (23) — 이어 붙인 시나리오 · 비로그인 재마운트 상태 복원 · 외부 입력 검증(유효 복원) · 모바일 복원 등 |
| 3 | 복원 시 기본 질의 억제 삭제 — `triggerRef` 초기값 null · `autoPickedRef` 초기값 false | PlacePage.loginReturn | 종료 1 · 5 failed \| 18 passed (23) — 이어 붙인 시나리오(SEARCH restore 1건) 등 |
| 4 | 1회 가드 삭제 — `clearFavoriteIntent()` 를 첫 await(`/keys`) 뒤로 | PlacePage.loginReturn | 종료 1 · 2 failed \| 21 passed (23) — 이어 붙인 시나리오(StrictMode PUT 1회) · 「/keys 가 늦게 오면 그 뒤에 PUT 한다」 |
| 5 | 복귀가 toggle 재사용 — 이미 찜이면 `removeFavorite` | PlacePage.loginReturn | 종료 1 · 1 failed \| 22 passed (23) — 「이미 찜이면 아무것도 하지 않는다 — PUT·DELETE·알림·계측 0」 |
| 6 | 의도 TTL 판정 삭제 — `age > FAVORITE_INTENT_TTL_MS` 조건 제거 | PlacePage.loginReturn | 종료 1 · 1 failed \| 22 passed (23) — 「10분 지난 의도는 무시한다 — PUT 0」 |
| 7 | 링크 만료 판정 삭제 — `isAlive` 가 `_revokedAt == null` 만 봄 | CollectionShareTest · CollectionShareServiceTest | Test 10 / failures 2 — 만료 경계 「죽었다」 expected false but was true. Service 14 / failures 1 — 「만료·폐기·없음은 같은 NOT_FOUND 다」 예외 없음 |
| 8 | 설정 꺼짐 분기 삭제 — `requireEnabled` 의 throw 를 `Unit` 으로 | ShareDisabledDispatchTest · CollectionShareServiceTest | Dispatch 2 / failures 1 — POST share expected 404 but was 500. Service 14 / failures 1 — expected NOT_FOUND but was INVALID_INPUT(범위 검사가 먼저 남) |
| 9a | 공개 라우트 헤더 제거 삭제 — `wishlist-shared-public` 의 `removeRequestHeader` 셋 | GatewayRouteAuthSpec · ShortLinkRouteSpec | Auth 62 / failures 1 — 「클라이언트가 붙인 신원 헤더는 하나도 넘어가지 않는다」 Values differed at keys X-User-Id, X-User-Roles, Authorization. ShortLink 9 / failures 0 |
| 9b | 〃 `short-link-collection` 의 `removeRequestHeader` 셋 | GatewayRouteAuthSpec · ShortLinkRouteSpec | Auth 62 / failures 1(같은 테스트). ShortLink 9 / failures 1 — 「레이트 리밋을 걸고 신원 헤더 셋을 지운다」 expected true but was false |
| 10 | 공개 경로를 `/api/v1/wishlist/**` 로 넓힘(method GET 유지) | GatewayRouteAuthSpec | 62 / failures 2 — 「한 세그먼트를 넘는 경로는 공개 라우트에 걸리지 않는다」 401 but 204 · 「/collections/{id}/share 는 토큰이 없으면 401」 401 but 204. PUT 401 단언은 GET 한정 조건이 남아 있어 이 주입으로는 깨지지 않는다 |
| 11 | 탈퇴 시 공유 삭제 제거 — `collectionSharePort.deleteAllByMemberId` 줄 삭제 | MemberEventConsumerTest | 3 / failures 1 — 「그 회원의 토큰은 공개 조회에서 NOT_FOUND 다」 예외 없음 |
| 12 | CASCADE 제거 — 사본 V4 에서 `ON DELETE CASCADE` 삭제 | WishlistSchemaIntegrationSpec | tests=9 **skipped=0** failures=2 — FK 규칙 expected "CASCADE" but was "NO ACTION" · 「묶음을 지우면 그 공유 행도 지워진다」 DataIntegrityViolationException |
| 13 | 공개 응답에 `memberId: Long = 0L` 추가 | SharedCollectionControllerTest | 5 / failures 1 — 「키 집합이 정확히 name·items·truncated」 |
| 14 | 섹션 POST_SELECTION 제외 삭제 — 상수에서 `DIRECTIONS`·`SHARE` 제거 (= TG7 메모 ①) | ClickHouseAttractionPopularityAdapterTest | 6 / failures 4 — SQL 리터럴 세 테스트 + 상수 기대값 |
| 14b | 〃 `SHARE` 하나만 제거 | ClickHouseAttractionPopularityAdapterTest | 6 / failures 4 — 같음 |
| 15a | `SharedCollectionController` 에 `@ConditionalOnProperty(kgd.wishlist.share.enabled=true)` | ShareDisabledDispatchTest | 2 / failures 1 — 「공유 컨트롤러 둘은 그래도 빈으로 등록된다」 size 1 but 0(컨텍스트 러너) |
| 15b | `CollectionShareController` 에 같은 애너테이션 | ShareDisabledDispatchTest | 2 / failures 1 — 같음 |
| 16 | `/c` 형식 검사 삭제 — `resolve` 가 `rest` 를 그대로 목적지에 | SharedCollectionControllerTest · CollectionShareServiceTest | Controller 5 / failures 1 — `/c` expected `https://short.test/shared/invalid`. Service 14 / failures 1 — 「그 밖은 설정 호스트의 /shared/invalid 로」 |
| 17 | `url` 호스트를 리터럴 `https://1989v.com` 으로 | CollectionShareControllerTest | 8 / failures 2 — expected `https://short.test/c/…` (생성·조회) |
| 18 | 「공유 링크 만들기」 클릭에서 `onShare?.('copy')` 호출 | FavoritesPage.share.test | 종료 1 · 1 failed \| 7 passed (8) — 「「공유 링크 만들기」는 이벤트가 없고, 이어진 복사가 CLICK SHARE 한 건」 |
| 19 | 허브 별에 `onBeforeLogin` 미전달 — PlaceCard·AttractionDetailBody 의 `onBeforeLogin={[onBeforeLogin][1]}` | PlacePage.loginReturn | 종료 1 · 1 failed \| 22 passed (23) — 이어 붙인 시나리오 |
| 20 | 묶음 막대에 `channels` 미전달 (`COLLECTION_CHANNELS && undefined`) | FavoritesPage.share.test | 종료 1 · 2 failed \| 6 passed (8) — 「X·LinkedIn 은 없고」 포함 막대 두 테스트 |
| 21a | GA 로더 조건 ① 경로 `/shared/` 삭제 | gaLoader.test | 종료 1 · 1 failed \| 4 passed (5) — 「① 수신 화면 경로 /shared/ 에서는 싣지 않는다」 |
| 21b | GA 로더 조건 ② `%2Fshared%2F` 삭제 | gaLoader.test | 종료 1 · 1 failed \| 4 passed (5) — 「② 로그인 next 쿼리에 /shared/ 가 인코딩돼 있으면 싣지 않는다」 |
| 21c | GA 로더 조건 ③ referrer 삭제 | gaLoader.test | 종료 1 · 1 failed \| 4 passed (5) — 「③ 리퍼러 경로가 /shared/ 이면 싣지 않는다」 |
| T2 | FavoritesPage `onShare` 배선 제거 — `channel === ('none' as string) && track(…)` | FavoritesPage.share.test | 종료 1 · 3 failed \| 5 passed (8) — 이어진 복사 1건 · Web Share channel · 칩 전환 새 view |
| T3 | viewId `useMemo` 의존성 비움 (`[filterScope].slice(1)`) | FavoritesPage.share.test | 종료 1 · 1 failed \| 7 passed (8) — 「묶음 칩을 바꿨다 돌아오면 새 view 다」 |

합계: 주입 28건이고 빨강 28/28, 초록으로 남은 주입은 0건이다.
- 표 21항목 가운데 9·15·21 은 대상별로 나눠 각각 2·2·3건으로 셌다. 14 는 14b 를 더해 2건이다.
- TG7 메모 ①은 #14 와 같은 주입이다.
- #10 은 path 만 넓힌 주입이다. 그래서 「PUT 401」 단언은 `method(GET)` 조건에 막혀 깨지지 않았고, collections 401 과 하위 경로 단언이 빨강을 냈다.

## 근거 파일
- `scratchpad/inject-f/run.py`: 주입 정의와 실행기.
- `scratchpad/inject-f/inj-*.log`·`base-*.log`: 주입별·기준선 테스트 출력.
- `scratchpad/inject-f/inj-all.out`·`rows-*.tsv`: 결과 줄. tsc 결과는 각 줄의 마지막 칸에 있다.
