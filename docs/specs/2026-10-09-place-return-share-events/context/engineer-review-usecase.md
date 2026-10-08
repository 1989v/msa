# Engineer Review — usecase (1라운드)

대상: `docs/specs/2026-10-09-place-return-share-events/spec.md` · `docs/adr/ADR-0107-wishlist-collection-share-links.md`
대조: 계획서 S3-3·S3-4·S3-4b·S3-6a(`docs/plans/2026-10-08-place-growth-work-plan.md:95-99`), S1-10 증거(`evidence/stage1/s1-10-login-return.md:86-95`), 계측 스펙(`docs/specs/2026-10-08-place-hub-instrumentation/spec.md`)

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | Actor-goal | 대체로 명확(비로그인 방문자·회원 소유자·수신자). 단 저장 의도의 대상 범위가 불명 — U2 |
| 2 | Main/Alt/Exception | 정상 흐름은 있음. 공유 버튼 노출 조건이 자기모순(U1), 로그인 포기·묶음 삭제 흐름 누락(U3·U5) |
| 3 | Pre/Postconditions | 자동 찜의 선행 조건(keys 로드)·공유 생성 응답이 비어 있음 — U4·U6 |
| 4 | AC 추적 | S3-3 의 「조건·선택·저장 의도 복원」은 SR-1 로 추적됨. S3-4b·S3-6a 완료 조건은 배포 뒤 확인 절차가 없음 — U8 |
| 5 | Edge case | U3·U5·U7 |
| 6 | 테스트 매핑 | SR-4 가 대부분 덮음. U1·U5·U6 의 Kotest/vitest 항목이 없음 |

S1-10 의 「안 되는 것」 셋(허브 조건 `:90`, 허브 선택 `:91`, 저장 의도 `:92`)은 SR-1.2·SR-1.3 이 모두 받는다. 계측 스펙 SR-10 「건수에서 빼는 것」(`:84`)에 `restore` 를 넣는 것도 정합하다 — 결과 view 는 `landing` 만 빼므로(`:80`) 복원 view 는 분모에 들어간다는 점만 SR-1.2 에 한 줄 적으면 된다.

## 이슈

**U1 (체크 2·6) 공유 버튼 노출이 자기모순** — SR-2.2(`spec.md:20`)는 `GET …/share` 가 「살아 있는 링크 또는 404」, SR-2.4(`spec.md:22`)는 「FE 는 서버 응답(404)으로 공유 버튼을 숨긴다」. 설정을 켜도 링크가 아직 없는 묶음은 404 라 버튼이 숨고, 첫 링크를 만들 길이 없다.
수정안: 켜짐+링크 없음은 `200 {link:null}`(또는 204), 404 는 설정 꺼짐·남의 묶음에만. SR-4.1 에 「켜짐·링크 없음 → 만들기 버튼 보임」 vitest 한 줄.

**U2 (체크 1) 저장 의도의 대상 타입·소비 위치 미정** — 의도는 `targetKey`·시각만(`spec.md:12`)인데 `FavoriteButton` 은 게임·블로그·상점에서도 쓰인다(`GameCard.tsx`, `PostCard.tsx`, `ShopProductDetailPage.tsx`, 컴포넌트 주석 `FavoriteButton.tsx:45`). 소비 위치도 허브·상세만 언급(`spec.md:13`)되고, 수신자 화면 `/shared/:token` 의 별(`spec.md:23`)과 apex `/favorites` 의 별은 빠져 있다.
수정안: 의도에 `type` 을 넣고 저장은 `type==='ATTRACTION'` 일 때만, 소비 지점을 「허브·상세·`/shared/:token`」으로 열거(또는 수신자 화면은 복귀 자동 찜 제외라고 명시).

**U3 (체크 2·5) 로그인 포기·우회 흐름** — 「로그인 뒤 허브 첫 마운트」(`spec.md:13`)를 무엇으로 판정하는지 없다. 로그인 화면에서 뒤로 와 비로그인으로 마운트하면 복원하는지, 의도가 남은 채 10분 안에 헤더 로그인 등 다른 경로로 로그인하면 자동 PUT 이 나가는지가 정해지지 않았다.
수정안: 「복원·자동 찜은 `isLoggedIn()`(`auth.ts:45-47`)이 참일 때만, 비로그인 마운트에서는 허브 상태만 복원하고 의도는 그대로 둔다(또는 지운다)」 중 하나를 고르고 vitest 에 그 경우를 추가.

**U4 (체크 3) 자동 찜의 선행 조건** — 「이미 찜이면 아무것도 안 한다」(`spec.md:14`)는 keys 쿼리 로드 뒤에만 판정할 수 있다(`useFavorites.ts:27-34`). 기존 `toggle` 은 키가 있으면 DELETE 를 보낸다(`useFavorites.ts:39-41`). 로드 전에 판정하거나 `toggle` 을 재사용하면 이미 찜한 대상의 찜이 풀린다.
수정안: 「keys 쿼리 성공 뒤 1회, `addFavorite` 직접 호출(토글 금지), keys 조회 실패면 의도를 지우고 PUT 하지 않음」을 명시. 실패 시 「기록만」의 기록처(콘솔·원장)도 정한다.

**U5 (체크 2·5·6) 묶음 삭제 → 링크 폐기 누락** — ADR-0107 §4(`ADR-0107…md:13`)는 「묶음을 지우면 링크도 폐기」인데 SR-2 에 없다. 기존 FK 는 `ON DELETE SET NULL`(`V3__collections.sql:24-25`)이라 저절로 되지 않는다. 빈 묶음·항목이 전부 하이드레이션 실패(`FavoritesPage.tsx:116-118`)인 수신자 화면 상태도 없다.
수정안: SR-2.2 에 「묶음 삭제 시 share 행 `revoked_at` 설정(또는 FK CASCADE)」, SR-4.2 에 「삭제 뒤 토큰 404」, SR-2.5 에 빈 상태 문구.

**U6 (체크 3·4) 공유 API 의 사후 조건·입력 경계** — `POST …/share` 응답 모양(토큰·복사할 URL이 `/c/{token}` 인지 `/shared/{token}` 인지·`expiresAt`)이 없다(`spec.md:20`). `expiresInDays` 의 0·음수·상한도 없다. SR-4.2 는 남의 묶음에 「403/404」(`spec.md:34`)로 열려 있어 AC 로 쓸 수 없다.
수정안: 응답 `{token, url(/c/…), expiresAt|null}`, `expiresInDays` 1~365 밖이면 400, 남의 묶음은 404(ADR-0107 §2 존재 은닉과 같게)로 하나만 고른다.

**U7 (체크 5) 계측의 엔티티·화면·중복 키** — 묶음 공유 CLICK 의 `entityType`·`screenType` 이 정해지지 않았다. `EntityType` 에 묶음이 없고(`events.ts:3-12`) SR-3.4 가 늘리지 않는다고 했으며, `PAGE` 는 섹션을 못 갖는다(`events.ts:70-79`). `ScreenType` 에도 찜/공유 화면이 없다(`events.ts:16-20`). 또 중복 키 `viewId|entityType|entityId|sectionId|action`(계측 스펙 `:55`) 때문에 같은 view 에서 복사 후 X 공유를 하면 둘째 채널이 버려진다. S3-6a 완료 조건 「중복 제거」(`plan:99`)를 어떻게 읽는지 적혀야 한다.
수정안: 묶음 공유의 entity·screen 값을 정하고(필요하면 ScreenType 추가 — 주석상 허용, `events.ts:15`), 「view·대상당 첫 공유 1건만 남는다(채널 유실 수용)」 또는 「channel 을 키에 넣는다」 중 하나를 명시.

**U8 (체크 4) S3-4b·S3-6a 완료 조건의 배포 확인** — S3-4b 완료 조건은 「수신자 세션에서 열람·저장 동작 확인」(`plan:97`), S3-6a 는 「이벤트 수집 확인」(`plan:99`)인데, SR-4.4(`spec.md:36`)는 설정 꺼짐 404 두 건만 본다. 길찾기·상세 공유는 설정과 무관하게 켜지므로, 계측 스펙 SR-9.4 처럼 「보낸 건수 = 202 accepted = ClickHouse 행」 확인을 지금 할 수 있다.
수정안: SR-4.4 에 ① DIRECTIONS·SHARE(attraction) 수집 3수 대조 ② 「S3-4b 완료는 Q1 승인 뒤 켠 상태에서 수신자 열람·찜 확인으로 판정, 그 전까지 미완」 한 줄.

## 판정
비차단 이슈 8건. U1 은 그대로 구현하면 기능이 켜져도 쓸 수 없으므로 구현 전에 고친다.

VERDICT: REVISE
