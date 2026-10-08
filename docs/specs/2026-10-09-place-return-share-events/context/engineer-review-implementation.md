# Engineer Review — implementation (1라운드)

대상: `spec.md`, `docs/adr/ADR-0107-wishlist-collection-share-links.md`. 2026-10-09.

## 요약
뼈대(account 폴드·wishlist datasource·Flyway·게이트웨이 선례)는 코드와 맞다. 고칠 것은 아홉 건이다. 그중 셋이 무겁다. ① retention 배치가 wishlist DB 에 닿지 못하고, 따라 하면 account 이미지의 Kafka 리스너가 같이 뜬다. ② `GET …/share` 가 내는 404 두 가지가 구분되지 않아, FE 가 「설정 꺼짐」과 「링크 없음」을 가를 수 없다. ③ 저장 의도에 대상 타입과 소비 위치가 없다.

## 확인된 것 (이슈 없음)
- **sessionStorage 는 왕복 뒤에도 남는다.** 별 클릭은 같은 탭 이동이다(`portal-fe/src/components/favorite/FavoriteButton.tsx:78` `window.location.href`). sessionStorage 는 탭과 origin 단위라, place → apex `/login` → 제공자 → apex 콜백 → place 로 돌아오면 place origin 의 값을 다시 읽을 수 있다. 같은 가정을 이미 OAuth `state` 가 쓰고 있다(`portal-fe/src/auth/auth.ts:146-166`). 앱 간 카카오 로그인처럼 새 탭으로 갈라지면 값이 사라진다. 다만 그 경우 `state` 검사도 같이 실패하므로 새로 생기는 위험은 없다. 로컬은 단일 origin 이라 문제없다.
- **wishlist 는 account 폴드다.** 게이트웨이(`gateway/.../GatewayRouteConfig.kt:365,374` → `http://account:8093`)와 빌드(`account/app/build.gradle.kts:13`)가 그렇게 되어 있다. 새 엔티티는 `com.kgd.wishlist` 아래면 EMF·리포지토리 스캔에 저절로 들어간다(`wishlist/feature/.../WishlistDataSourceConfig.kt:29,82`). 마이그레이션 위치는 `classpath:wishlistdb/migration`(`:70`)이고 현재 V1~V3 이라 **다음 번호는 V4** 다. 다른 세션이 아직 커밋하지 않은 V4 가 있는지는 착수 때 한 번 더 확인한다.
- **트랜잭션 한정자.** account 의 primary TM 은 member 다(`member/feature/.../MemberDataSourceConfig.kt:102-103`). 공유 서비스에도 클래스 레벨 `@Qualifier("wishlistTransactionManager")` 를 붙여야 한다(선례 `WishlistService.kt:19-20`). 빠뜨리면 `verifyTransactionQualifiers` 게이트가 잡는다(`docs/conventions/transactional-usage.md:50-85`).
- **찜 PUT 은 서버에서 멱등이다**(`WishlistService.kt:30-42`). SR-1.3 의 「한 번」은 서버가 아니라 FE 중복 호출만 막으면 된다.

## 이슈

### I-1 (체크 2·3) retention 배치가 wishlist 원장에 닿지 않는다
- 근거: SR-2.6 은 「retention CronJob 대상 표에 한 줄」이라고만 적었다. 그런데 기존 CronJob 둘은 각각 `commerce/atlas`(`k8s/base/retention/cronjob.yaml:43`)와 `commerce/content`(`k8s/base/retention/cronjob-content.yaml:42`) 이미지를 띄운다. 어느 쪽에도 wishlist 코드나 `wishlist_db` 연결이 없다.
- account 이미지로 같은 배치를 만들면 함정이 있다. account 에는 `@KafkaListener` 가 있다(`wishlist/feature/.../MemberEventConsumer.kt:20-24`, `ProductEventConsumer.kt`). atlas·content 에는 리스너가 없어서 `web-application-type=none` 만으로 배치가 끝났던 것이다. account 로 띄우면 배치가 소비 그룹 `wishlist-member-cleanup` 에 합류해 운영 파드의 파티션을 가져간다. 리스너 스레드 때문에 JVM 도 `activeDeadlineSeconds` 까지 내려가지 않는다.
- 수정안(둘 중 하나를 스펙에 적는다):
  - (a) **열람 원장을 이번 범위에서 뺀다.** 읽는 곳이 없다. 통계 화면은 Out of Scope 다(spec.md:42). 빼면 테이블, CronJob, `/privacy` 한 줄, ADR-0077 표 한 줄이 함께 빠진다. YAGNI 상 권장한다.
  - (b) 남긴다면 `retention-account` CronJob 을 새로 만든다. 이미지는 `commerce/account`, 인자는 `--spring.kafka.listener.auto-startup=false`(선례 `account/app/src/test/.../AccountContextLoadSpec.kt:37`) + `web-application-type=none` + `profiles=kubernetes,retention` 이다. 러너는 `wishlist/feature/.../infrastructure/retention/WishlistRetentionRunner` 에 둔다(선례 `place/feature/.../PlaceRetentionRunner.kt:13-28`). `k8s/base/kustomization.yaml` 에 등록하고, 스케줄은 05:00·05:30 과 겹치지 않게 잡는다.

### I-2 (체크 2) `GET …/share` 의 404 가 두 가지 뜻을 갖는다
- 근거: SR-2.2 에서 `GET …/share` 는 「살아 있는 링크 또는 404」를 낸다. SR-2.4 에서 FE 는 「서버 응답(404)으로 공유 버튼을 숨긴다」. 그러면 설정이 켜진 상태에서 아직 링크를 만들지 않은 묶음도 404 를 받는다. FE 는 「만들기」 버튼을 숨겨야 할지 보여야 할지 판단할 수 없고, 켠 뒤에도 첫 링크를 만들 수 없다.
- 수정안: 링크가 없을 때는 `200 { link: null }` 을 내고, 404 는 설정이 꺼졌을 때만 쓴다. 설정이 꺼졌을 때 컨트롤러 빈 자체가 없으면 공통 핸들러가 404 를 그대로 낸다(`common/.../GlobalExceptionHandler.kt:72-77,91-111`). 따라서 `@ConditionalOnProperty` 로 공유 컨트롤러를 통째로 끄는 편이 분기 코드보다 단순하다. SR-4.1 에 「켜짐 + 링크 없음 → 만들기 버튼 보임」 단언을 더한다.

### I-3 (체크 1·2·6) 저장 의도에 대상 타입이 없고, 소비 위치가 정해지지 않았다
- 근거: SR-1.1 의 의도는 `targetKey` 와 만든 시각뿐이다. 그런데 `FavoriteButton` 은 게임·글·상품·관광지가 함께 쓴다(호출 9곳: `GameCard.tsx`·`BlogPostPage.tsx`·`ShopProductDetailPage.tsx` 등). 타입이 없으면 어느 `/wishlist/{type}/{key}` 로 PUT 할지 알 수 없다.
- `useFavorites` 는 별 하나마다 생긴다(`FavoriteButton.tsx:69`). 그래서 소비를 훅 안에 두면 허브의 카드 수만큼 동시에 소비를 시도한다.
- 기존 `toggle` 을 다시 쓰면 위험하다. 이미 찜한 대상이면 DELETE 를 보낸다(`useFavorites.ts:38-45`). 이는 「이미 찜이면 아무것도 안 한다」(SR-1.3)를 뒤집는다.
- 수정안:
  - 의도를 `{type, targetKey, at}` 로 바꾼다. 저장과 소비는 `ATTRACTION` 만 하거나, 소비를 place 화면에 한정한다고 적는다.
  - 소비는 페이지 단위 훅 하나로 한다(`PlacePage`·`AttractionPage` 에서 한 번).
  - 읽기와 삭제는 `await` 전에 동기로 처리해 StrictMode 이중 마운트도 막는다.
  - `/keys` 로딩이 끝난 뒤 판정하고, `toggle` 이 아니라 `addFavorite` 를 직접 부른다.
  - 계측(`resumed:true`)은 그 성공 콜백에서 낸다.
  - apex `/shared/:token` 수신자가 비로그인으로 별을 눌렀을 때 의도를 소비할지도 한 줄로 정한다(현재는 apex 에 소비자가 없다).

### I-4 (체크 6) 「살아 있는 링크는 하나」가 동시 요청에서 깨진다
- 근거: ADR-0107 §1 은 「다시 만들면 이전 것을 폐기」한다고 했다. 폐기와 삽입이 따로 실행되면, 「만들기」를 두 번 누르거나 재시도했을 때 살아 있는 행이 둘 생긴다. MySQL 에는 부분 유일 인덱스가 없어 스키마만으로는 막을 수 없다(`V3__collections.sql` 과 같은 InnoDB).
- 수정안: wishlist TM 트랜잭션 하나 안에서 소유 묶음 행을 `SELECT … FOR UPDATE`(JPA `PESSIMISTIC_WRITE`)로 잠근다. 그 뒤 이전 행을 폐기하고 새 행을 넣는다. 이 단계를 SR-2.2 에 적고, SR-4.2 에 「연속 생성 두 번 → 살아 있는 행 1」을 더한다.

### I-5 (체크 2) 묶음 삭제·회원 탈퇴 때 링크가 정리되지 않는다
- 근거: ADR-0107 §4 는 「묶음을 지우면 링크도 폐기」라고 했지만, 지금 삭제는 JPA `delete` 뿐이다(`WishlistRepositoryAdapter.kt:95-98`). 탈퇴 이벤트는 찜 항목만 지운다(`MemberEventConsumer.kt:32` → `WishlistRepositoryAdapter.kt:68-70`). 묶음은 남으므로, 탈퇴한 회원의 묶음 이름이 토큰으로 계속 공개된다.
- 수정안: V4 에서 `collection_share.collection_id` 에 `FOREIGN KEY … REFERENCES wishlist_collection(id) ON DELETE CASCADE` 를 건다. 탈퇴 처리에는 공유 행 삭제(또는 폐기)를 더한다. 묶음 삭제를 빠뜨린 것은 기존 결함이므로, 이번에 함께 고칠지는 보고하고 묻는다.

### I-6 (체크 4) 공개 열람 응답의 크기 상한이 없다
- 근거: `GET /shared/{token}` 은 인증이 없고 항목 목록을 통째로 낸다(SR-2.2). 묶음당 항목 수에는 상한이 없다(`ManageCollectionUseCase.move` 는 타입도 개수도 보지 않는다, `WishlistService.kt:115-129`). 수신 화면이 `FavoritesPage` 카드를 재사용하면 항목마다 상세를 병렬로 부른다(`FavoritesPage.tsx:132` `Promise.all`).
- 수정안: 응답을 `ATTRACTION` 으로 거르고 최대 100건으로 자른다(소유자 화면의 `size: 100` 과 같다, `FavoritesPage.tsx:128`). 잘렸다면 `truncated` 플래그를 함께 싣는다. `targetType` 을 응답에 넣을지, 거를지도 스펙에 적는다.

### I-7 (체크 2) 게이트웨이 공개 라우트 — 순서는 맞고, 메서드와 헤더는 좁혀야 한다
- 근거: 새 라우트는 `wishlist-service`(`GatewayRouteConfig.kt:368-375`)보다 **앞에** 둬야 한다. `wishlist-count-public` 의 주석이 그 이유다(`:359-366`).
- 경로만으로 열면 `PUT/DELETE /api/v1/wishlist/shared/x` 도 인증 없이 `addItem`·`removeItem` 에 닿는다(`WishlistController.kt:40-78`). 이때 클라이언트가 붙인 `X-User-Id` 가 그대로 전달된다. 지금은 `parseTargetType("shared")` 가 400 을 내서 우연히 막히는 것뿐이다.
- 수정안: `r.method(GET).and().path("/api/v1/wishlist/shared/**")` 로 좁힌다. `removeRequestHeader("X-User-Id")`·`X-User-Roles` 를 더하고(선례 `:250-258`), `requestRateLimiter { shortLinkLimit(it) }`(`:41-45`)를 붙인다.
- `/c/**` 는 새 라우트 `short-link-collection` → `http://account:8093` 이 필요하다. **apex ingress 에 `path: /c` 한 줄**도 필요한데(`k8s/overlays/oci-arm/ingresses/commerce-platform.yaml:85-98`) 스펙에 빠져 있다. 참고로 FE 의 `/c/*` 는 블로그 분류 라우트지만 apex 프로덕션에서는 꺼져 있어(`portal-fe/src/App.tsx:184,281`) 충돌하지 않는다.

### I-8 (체크 3) `ShortLinkPrefix` 에 `c` 를 넣으면 common 이 바뀌어 전 JVM 이미지가 다시 빌드된다
- 근거: CI 는 `common/` 이 바뀌면 모든 백엔드 이미지를 다시 굽고 전체 JVM 테스트를 돌린다(`.github/workflows/images.yml:133-136`, `ci.yml:177`).
- enum 값만 더하는 것으로도 끝나지 않는다. `ShortLinks.serviceOrigins` 는 `getValue` 로 꺼내므로(`common/.../ShortLinks.kt:15-20,38`), 새 접두사에 origin 매핑이 없으면 `destination`·`home` 이 `NoSuchElementException` 을 던진다. `ShortLinkProperties` 에 apex 용 origin 을 더하고 `ShortLinksTest` 도 고쳐야 한다.
- 수정안(트레이드오프를 스펙에 적는다):
  - (a) common 을 건드리지 않는다. wishlist 컨트롤러가 `PREFIX = "/c"` 상수를 갖고(선례 `place/.../AttractionShortLinkController.kt:55`), 목적지 `${origin}/shared/{token}` 을 스스로 만든다. 응답은 `ShortLinkRedirects.redirect` 를 그대로 쓴다. 접두사 목록은 `common/docs/service.md:46` 표에만 한 줄 더한다.
  - (b) 접두사의 단일 원장을 지키려고 common 을 고친다. 이 경우 전 이미지 재빌드가 일어나므로, common 을 바꾸는 다른 변경과 같은 푸시에 묶는다.
  - 이미지 저장소 용량이 무료 범위라는 제약을 생각하면 (a) 를 권장한다.

### I-9 (체크 2) 설정 키가 놓일 곳, `/c` 실패 시 동작
- `kgd.wishlist.share.enabled` 는 wishlist:feature 에 yml 이 없으므로 기본값을 코드(`@ConditionalOnProperty(matchIfMissing=false)`)에 두고, 켤 때는 account 오버레이 env 로 넣는다고 적는다(`account/app/src/main/resources/application.yml` 에는 지금 wishlist 키가 없다).
- `/c/{token}` 은 설정이 꺼졌을 때 404 다(SR-2.4). 켜진 상태에서 토큰이 무효면 어떻게 할지는 정해져 있지 않다. ADR-0106 은 해석에 실패하면 서비스 홈으로 302 를 보낸다(`AttractionShortLinkController.kt:45`, `ShortLinks.kt:42-43`). 이 경로는 DB 를 보지 않고 `/shared/{token}` 으로 302 를 보내고, 무효 판정은 수신 화면의 404 에 맡기면 된다. 그렇게 정하면 SR-4.2 의 「`c` 해석」 테스트 대상도 분명해진다.

## 체크리스트 판정
| # | 항목 | 판정 |
|---|---|---|
| 1 | 참조 클래스·모듈 존재 | 대체로 통과. `SearchTrigger` 는 `PlacePage.tsx:267` 에 있다. `googleMapsDirectionsUrl` 은 `rankView.ts:63`. `POST_SELECTION_SECTIONS` 는 `AggregateAttractionPopularityUseCase.kt:31`, 리터럴 테스트는 `ClickHouseAttractionPopularityAdapterTest.kt:86`. 저장 의도의 타입 누락은 I-3 |
| 2 | 기존 코드와 충돌 | I-2, I-3, I-5, I-7, I-9 |
| 3 | 복잡도 위험 | I-1, I-8 |
| 4 | NFR 안티패턴 | I-6 |
| 5 | 마이그레이션·롤백 | V4 는 전진 전용이고, 롤백은 설정을 끄는 것으로 충분하다. FK 정책은 I-5 |
| 6 | 동시성 | I-3(FE 중복 소비), I-4(링크 둘) |

VERDICT: REVISE
