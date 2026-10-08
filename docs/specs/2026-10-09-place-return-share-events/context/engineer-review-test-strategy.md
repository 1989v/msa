# Engineer Review — test-strategy (1라운드)

대상: `docs/specs/2026-10-09-place-return-share-events/spec.md`
기준: hns `reviewers/test-strategy/checklist.md`, `docs/standards/test-rules.md`
Seed: spec · `context/open-questions.yml` · ADR-0107 · `FavoriteButton.tsx`/`useFavorites.ts`/`auth.ts` · 기존 테스트(`FavoriteButton.test.tsx`, `ClickHouseAttractionPopularityAdapterTest.kt`, `GatewayRouteAuthSpec.kt`, `ShortLinkRouteSpec.kt`, `privacyRetention.test.ts`), `k8s/base/retention/`

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| C1 | 요구사항마다 테스트가 있나 | 부분 — F2·F6·F7 |
| C2 | 레이어 배정 | 부분 — F4·F5 |
| C3 | 목 경계 | 부분 — F1·F3 |
| C4 | 테스트 데이터 전략 | 부분 — F1·F8 |
| C5 | 부정·경계 케이스 | 부분 — F3·F6·F9 |
| C6 | 이름 규칙 | 통과(선례 따름: `*Test`=단위, `*Spec`=라우트·스키마 통합) |

## Findings

### F1 [C3·C4] 복귀 테스트가 저장 의도를 손으로 심으면 자기 근거가 된다 — 로그인 완주 대체가 성립하지 않는다
- 근거: spec:33 「로그인 상태 복귀 마운트 → … PUT 1회」, spec:36 「단위·컴포넌트 테스트로 대신」. 의도의 키·모양은 spec:12 에서 구현이 정한다.
- 문제: 복귀 테스트가 sessionStorage 를 직접 채우면, 쓰는 쪽(게스트 클릭)과 읽는 쪽(복귀)이 키·필드명·시각 단위가 어긋나도 둘 다 초록이다. 운영에서 완주를 못 재는 이상 이 이음매가 유일한 증거다.
- 수정안: SR-4.1 에 **이어 붙인 시나리오 하나**를 명시한다 — 게스트로 허브 렌더 → 필터 조작 → 별 클릭(쓰기, `location.href` 가로채기는 `FavoriteButton.test.tsx:76-85` 선례) → 언마운트 → `portal_user_id` 쿠키 설정 → 같은 sessionStorage 로 재마운트 → 질의 인자·PUT 1회·의도 삭제·`resumed:true`. 저장소를 손으로 심는 테스트는 TTL 경계용으로만 둔다.
- 추가: URL 절반도 테스트가 없다(`buildLoginHref`/`safeNext` 테스트 0건, `auth.ts:102-128`). place 호스트 href → `buildLoginHref` → `safeNext` 왕복이 원래 href 를 돌려주는지 하나 둔다. `isProd1989vHost` 가 모듈 로드 시점 값(`auth.ts:18-19`)이라 `vi.resetModules` + location 스텁 뒤 import 해야 한다고 적는다.
- 운영 부분 측정: 게스트 절반(별 클릭 → 저장 키 존재 · `next` 가 place href)은 계정 없이 CDP 로 잴 수 있다. SR-4.4 는 전부를 「미확인」으로 두지 말고 「게스트 절반 실측 + 로그인 뒤 절반만 미확인」으로 나눈다.

### F2 [C1] 「이미 찜이면 PUT 0회」만 보면 DELETE 회귀를 놓친다
- 근거: spec:14 「이미 찜이면 아무것도 안 한다」, spec:33 「이미 찜이면 PUT 0회」. 기존 `toggle` 은 키가 있으면 `removeFavorite` 를 부른다(`useFavorites.ts:39-41`).
- 문제: 구현이 복귀에 `toggle()` 을 재사용하면 이미 찜인 대상이 **해제**되는데 PUT 은 0회라 테스트는 초록이다.
- 수정안: 단언에 `removeFavorite` 0회, 알림 없음, `track` 0회를 함께 넣는다. `/keys` 응답을 지연시킨 변형(하이드레이션 전 복귀)도 하나 둔다.

### F3 [C3·C5] 「PUT 1회」를 버튼 하나로 재면 다중 마운트 중복을 못 잡는다
- 근거: spec:14 「화면에 있든 없든 … 한 번」. 허브는 카드마다 `FavoriteButton` 을 둔다(`FavoriteButton.tsx:44-46`). 앱은 `StrictMode`(`main.tsx:32`) — `ShopOAuthCallbackPage.tsx:16` 이 같은 이유로 가드를 둔다.
- 수정안: 별 여러 개가 있는 허브 전체를 `StrictMode` 로 감싸 렌더해 PUT 1회·`CLICK/FAVORITE` 1건을 단언한다. 회귀 주입 목록(spec:35)에 「1회 가드 삭제」를 더한다.

### F4 [C1·C2] 의도에 대상 타입이 없어 PUT 기대값을 정할 수 없다
- 근거: spec:12 의도 = `targetKey`·시각뿐. `FavoriteButton` 은 상품·게임·관광지·글 공용이고(`FavoriteButton.tsx:44-45`), apex 에는 상점(PRODUCT)과 새 수신자 화면 `/shared/:token`(ATTRACTION, spec:23)이 같은 sessionStorage 를 쓴다.
- 문제: `addFavorite(type, key)` 의 `type` 이 어디서 오는지 스펙에 없어 테스트가 단언할 값이 없다. 다른 타입의 의도가 엉뚱한 타입으로 PUT 될 수 있다.
- 수정안: 의도에 `targetType` 을 넣고, 테스트 「다른 타입 화면에서 남긴 의도는 이 화면이 PUT 하지 않는다(또는 그 타입으로 PUT)」를 SR-4.1 에 추가한다. 수신자 화면 별의 복귀도 케이스로 넣는다.

### F5 [C1·C5] SR-2.2 와 SR-2.4 가 충돌해 두 테스트가 동시에 통과할 수 없다
- 근거: spec:20 `GET …/share` = 「살아 있는 링크 또는 404」, spec:22 「FE 는 서버 응답(404)으로 공유 버튼을 숨긴다」, spec:33 「서버 404 면 버튼 없음」.
- 문제: 설정이 켜져 있고 아직 링크가 없을 때도 404 라서, 「만들기」 버튼이 영영 안 보인다. 「켜짐+링크 없음 → 만들기 보임」 테스트와 「404 → 버튼 없음」 테스트는 양립하지 않는다.
- 수정안: 링크 없음은 `200 {link:null}`(또는 204), 설정 꺼짐만 404 로 구분하고, 테스트 세 칸(꺼짐 404 → 숨김 / 켜짐·없음 → 만들기 / 켜짐·있음 → 복사·폐기)을 적는다. 404 외 오류(500·네트워크)일 때 동작도 한 줄 정한다.

### F6 [C1·C5] 공유 서버 쪽 부정 케이스 누락
- 근거: ADR-0107 §4 「묶음을 지우면 링크도 폐기」(`ADR-0107-…md:13`), §2 소유자 정보 비노출(`:11`), §6 열람 원장 토큰·시각만(`:15`). spec:34 에는 셋 다 없다.
- 수정안 (Kotest 에 추가):
  - 묶음 삭제 뒤 토큰 열람 → 404.
  - 공개 응답 JSON 필드 집합이 정확히 `{name, items[{targetKey, addedAt}]}` — 컨트롤러 테스트에서 키 집합 일치로. FE 「소유자 정보 없음」(spec:33)만으로는 서버가 내보내는 것을 못 본다.
  - 열람 시 원장 행 1건, 저장 열이 토큰·시각뿐.
  - 「소유자 아닌 사람 403/404」(spec:34)를 하나로 정한다. 기존 `findCollection(id, memberId)` 가 남의 것을 null 로 돌려주므로(`WishlistRepositoryAdapter.kt:92-93`) 404 가 선례와 맞다. 둘 중 하나로 적혀 있으면 테스트가 무엇이든 통과한다.
  - 게이트웨이: 공개 라우트 옆의 소유자 경로 `/api/v1/wishlist/collections/{id}/share` 는 토큰 없으면 401 — `GatewayRouteAuthSpec.kt:301` 「같은 접두의 다른 결제 경로는 공개로 열리지 않는다」 선례. 공개 라우트는 `wishlist-service` 보다 앞에 선언해야 걸린다(`GatewayRouteConfig.kt:359-375`). 회귀 주입에 「공개 경로를 `/api/v1/wishlist/**` 로 넓힘」을 더한다.

### F7 [C1·C2] 설정 꺼짐 404 를 서비스 테스트로만 보면 경로 하나가 빠져도 모른다
- 근거: spec:22 「위 API 전부와 `/c/` 해석이 404」, spec:34 은 「공유 서비스 … 설정 꺼짐 → 404」로 서비스 레이어에 둔다.
- 문제: 플래그가 컨트롤러 조건(`@ConditionalOnProperty` 등)으로 구현되면 서비스 테스트는 그 분기를 보지 않는다. 네 API + `/c/` 중 하나만 빠지는 것이 가장 흔한 회귀다.
- 수정안: HTTP 레이어(MockMvc/WebMvc, 속성 false)에서 다섯 경로를 표로 돌려 전부 404 를 단언한다. 회귀 주입 「설정 꺼짐 분기 삭제」(spec:35)는 이 테스트로 빨강을 확인한다.

### F8 [C2·C4] 저장소·보존기간 테스트의 자리가 아직 없다
- 근거: spec:34 「레포지토리(마이그레이션 적용 후 행)」 — wishlist 에는 저장소·스키마 테스트가 0건이다(`wishlist/**/src/test` 는 `WishlistItemTest`·`WishlistCollectionTest`·`WishlistServiceTest` 뿐). spec:24 「retention CronJob 대상 표에 한 줄」 — 그런데 원장 정리 CronJob 은 atlas·content 이미지 둘뿐이고(`k8s/base/retention/cronjob.yaml:43`, `cronjob-content.yaml:42`) wishlist 가 사는 account 이미지에는 없다.
- 수정안:
  - 스키마는 선례 `PlaceSchemaIntegrationSpec`·`DealSchemaIntegrationSpec` 모양으로 `WishlistSchemaIntegrationSpec`(Testcontainers MySQL + Flyway)에 둔다. 「토큰 유일」은 무작위값을 반복 생성하는 단위 테스트로는 증명되지 않으므로 여기서 같은 토큰 두 번 삽입 → 유일 제약 위반으로 본다. 단위 테스트는 길이 10·영숫자만 본다.
  - 만료·`expiresInDays` 30 기본은 `Clock` 주입으로 시각을 고정한다고 적는다(지금 스펙에 시간 고정 수단이 없다).
  - 보존기간: 새 러너 Spec(`PlaceRetentionRunnerSpec.kt:26` 「90일로 스윕이 불린다」 선례) + `privacyRetention.test.ts:19-25` `RETENTION_RUNNERS` 에 새 러너 경로 추가 + 방침 문구 비교 케이스 한 줄. account 이미지에 정리 작업이 없다는 점은 배포 쪽 결정이 필요하다고 표시한다.

### F9 [C1·C5] 계측 기대값이 하나 빠져 있고, 복원 계측의 부정 케이스가 없다
- 근거: spec:28 묶음 공유 `CLICK`+`SHARE`(`kind:'collection'`), spec:30 「EventAction·EntityType 은 늘리지 않는다」. 그런데 `EntityType` 에는 묶음이 없고(`events.ts:3-12`) 묶음 막대 화면의 `ScreenType` 도 없다(`events.ts:16-20`).
- 문제: 묶음 공유 이벤트의 `entityType`·`entityId`·`screenType` 기대값이 없어서 테스트를 결정적으로 쓸 수 없다.
- 수정안: 세 값을 스펙에 고정한다(예: `entityType:'PAGE'`, `entityId` = 묶음 id 를 쓸지 여부). 복원(spec:13)은 「복원 마운트에서 SEARCH 가 정확히 1건, `trigger:'restore'`, 그 앞에 기본 상태의 `initial`/`landing` SEARCH 가 없다」로 단언한다 — 첫 마운트 기본 질의와 복원 질의가 둘 다 나가는 것이 가장 그럴듯한 회귀다. `MAP_LINK` 가 그대로 `MAP_LINK` 를 내는지도 한 줄(spec:27 「그대로」).
- 참고: `POST_SELECTION_SECTIONS` 갱신(spec:29)은 상수 테스트(`ClickHouseAttractionPopularityAdapterTest.kt:86`)만이 아니라 SQL 리터럴 네 곳(`:60`, `:72`, `:77`, `:79`)을 함께 바꿔야 한다. 상수 줄만 바꾸면 SQL 줄이 빨강이고, 주입 「제외 삭제」는 그 SQL 줄이 잡는다. FE 유니언과 서버 집합은 주석으로만 묶여 있으니(`events.ts:41-46`), `privacyRetention.test.ts` 처럼 Kotlin 파일을 텍스트로 읽어 대조하는 검사를 선택 사항으로 둔다.

### F10 [C5] 로그인하지 않고 돌아온 경우가 정의되지 않았다
- 근거: spec:13 「로그인 뒤 허브 첫 마운트에서 … 복원」, spec:14 「로그인 상태로 돌아왔고」.
- 문제: 로그인 화면에서 취소하고 비로그인으로 돌아오면 상태를 복원하는지, 의도를 남기는지 지우는지가 없다. 테스트 기대값이 없다.
- 수정안: 「비로그인 복귀 → 상태 복원 O/X, 의도 유지(10분 내 재시도 시 사용)/삭제」를 정하고 케이스 하나를 더한다. 「만료 판정 삭제」 주입(spec:35)이 의도 TTL 인지 공유 링크 만료인지도 나눠 적는다(둘 다 필요).

## 회귀 주입 목록 보강 요약 (spec:35 에 추가)
1회 가드 삭제(F3) · 복귀가 `toggle` 재사용(F2) · 공개 경로 확장(F6) · 묶음 삭제 시 폐기 삭제(F6) · 공개 응답에 `memberId` 추가(F6) · 복원 시 기본 질의 억제 삭제(F9) · 의도 TTL 과 링크 만료를 각각.

## 결론
테스트 목록의 뼈대(spec:33-36)는 맞다. 다만 로그인 완주를 대신하려면 쓰기·읽기를 잇는 테스트가 있어야 하고(F1), 스펙 안 충돌(F5)과 정해지지 않은 기대값(F4·F9·F10) 때문에 지금 상태로는 몇몇 테스트를 결정적으로 쓸 수 없다. 사람 판단이 필요한 위반은 없고 수정안이 구체적이라 REVISE.

VERDICT: REVISE
