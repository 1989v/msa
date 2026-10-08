# Task Breakdown: 로그인 복귀 완주 + 여행 묶음 공유 + 행동 이벤트 (S3-3 · S3-4b · S3-6a)

Total Task Groups: 8. 정본 `spec.md`(3라운드 반영). 결정 `docs/adr/ADR-0107-wishlist-collection-share-links.md`(Status 제안 — 승인은 사용자 몫, 구현은 `kgd.wishlist.share.enabled=false` 로 꺼진 채 배포). 열린 질문은 `context/open-questions.yml` 권고 기본값(Q1 · J10 · J11).
표준: `docs/standards/test-rules.md`(Kotest BehaviorSpec + MockK), `docs/conventions/package-structure.md`(ADR-0083 레이어·게이트 ④⑤), `docs/conventions/jpa-persistence.md`, `docs/conventions/transactional-usage.md`, `docs/standards/fe-visual-verification.md`, DESIGN.md.

착수 전 메모
- **PlacePage 는 스펙 E(place-hub-mobile-perf) TG2 가 막 고쳤다(커밋 `948f34bc3`)** — 모바일 두 변형·필터 시트·`MOBILE_QUERY` 가 들어간 그 위에서 한다. 스펙에 적힌 줄 번호(`:330`·`:622`·`:1661`·`:1683`·`:1730`·`:1804`)는 착수 시 다시 grep 해서 맞춘다.
- **AttractionPage 행동 줄은 스펙 D(place-detail-first-screen) TG5 몫이고 아직 미구현이다** — 길찾기 링크(TG7)는 그 행동 줄이 들어온 뒤에 얹는다. 스펙 D TG5 가 늦으면 TG7 의 길찾기만 보류하고 나머지는 진행한다.
- 공유 워킹트리: 메인 트리에 다른 세션의 미커밋 analytics 변경(streaming·consumer·`EventRepositoryAdapter`)과 `common/.../EventType.kt` 삭제가 있다. 이번 작업은 `AggregateAttractionPopularityUseCase`·`ClickHouseAttractionPopularityAdapterTest` 만 건드리므로 겹치지 않지만, 커밋은 경로를 좁혀 `git add` 하고 `git diff --cached` 로 핵심 라인을 확인한다.

### 라우팅 판단 (레포 확인 결과)
| 경로 | 지금 가는 곳 | 필요한 변경 |
|---|---|---|
| `GET /api/v1/wishlist/shared/{token}` | apex ingress `/api` → gateway → `wishlist-service`(인증 필터, `GatewayRouteConfig.kt:368`)라 **비로그인은 401** | gateway 공개 라우트 `wishlist-shared-public` 을 `wishlist-count-public`(`:362`) 과 `wishlist-service` 사이에 추가. ingress 변경 없음 |
| `/c`, `/c/{token}` | apex ingress 에 `/c` 블록이 없어 `/` catch-all → **portal-fe SPA 셸**로 떨어진다. gateway 에도 라우트 없음 | ingress 단축 주소 블록(`commerce-platform.yaml:84-98`, `/r`·`/p`·`/g`·`/b`)에 `- path: /c` + gateway `short-link-collection` → `http://account:8093` |
| `/shared/:token` (수신 화면) | apex `/` → portal-fe, nginx `location /` SPA 폴백이 셸을 낸다 | 인프라 변경 없음. `App.tsx` apex 라우트 한 줄만. 프리렌더·sitemap·llms 에 넣지 않는다 |
| 소유자 API `…/collections/{id}/share` | `wishlist-service` 인증 라우트가 이미 덮는다 | 없음 |

`ShortLinkProperties` 는 common `AutoConfiguration.imports:12` 로 account 에도 등록된다(`scanBasePackages` 와 무관). account 에는 `Clock` 빈이 없다 — TG2 가 등록한다.

### Flyway 번호
wishlist 최신은 `V3__collections.sql` → 이번은 **`wishlist/feature/src/main/resources/wishlistdb/migration/V4__collection_share.sql`**. 2026-10-09 메인 트리 미커밋 V 파일은 game(V93)·place(V17~V19)뿐이라 wishlist 와 겹치지 않는다. 커밋 직전에 다시 본다 — `git -C ~/IdeaProjects/msa status --porcelain -- wishlist/feature/src/main/resources/wishlistdb/migration` 와 `git log origin/main --oneline -- wishlist/feature/src/main/resources/wishlistdb/migration` 가 V4 를 갖고 있으면 번호를 올린다. main 은 곧 배포 브랜치라 커밋한 마이그레이션은 고치지 않는다.

---

### Task Group 1: 도메인 모델 `CollectionShare` + 스키마 V4 (SR-2.1 · SR-2.2 domain)
**Dependencies:** None · **Phase:** wishlist:domain + wishlist:feature(리소스·테스트 의존성) · **Required Skills:** Kotlin domain(프레임워크 의존 0), Flyway, Testcontainers MySQL
- [x] 1.1 테스트 먼저
  - `wishlist/domain/src/test/kotlin/com/kgd/wishlist/domain/model/CollectionShareTest.kt`: 토큰 10자·`^[A-Za-z0-9]{10}$`(SecureRandom, 생성 100회 모두 형식 일치), 고정 `Clock` 으로 기본 30일 `expiresAt`, 만료 없음(`null`), `isAlive(now)` — 만료 시각 경계(직전 살아 있음·같거나 뒤 죽음), 폐기 뒤 죽음, `revoke(now)` 두 번 멱등, 1~365 밖 일수 거부
  - `wishlist/feature/src/test/kotlin/com/kgd/wishlist/infrastructure/persistence/WishlistSchemaIntegrationSpec.kt`(`DealSchemaIntegrationSpec` 모양 — Testcontainers MySQL + `ScopedFlywayMigrator` 로 `wishlistdb/migration`): V4 적용 후 `collection_share` 컬럼·인덱스, 같은 토큰 두 번 삽입 → 유일 제약 위반, 묶음 삭제 → 공유 행 CASCADE
- [x] 1.2 `wishlist/domain/src/main/kotlin/com/kgd/wishlist/domain/model/CollectionShare.kt` — `WishlistCollection.kt` 와 같은 모양(팩토리 `create(collectionId, memberId, expiresInDays: Int?, clock)` · `revoke(now)` · `isAlive(now)` · `TOKEN_PATTERN` 상수). 시각은 인자로 받은 `Clock`/`Instant` 에서만 얻는다
- [x] 1.3 `V4__collection_share.sql` — `id` PK · `token CHAR(10) NOT NULL UNIQUE` · `collection_id BIGINT NOT NULL` FK → `wishlist_collection(id) ON DELETE CASCADE` · `member_id BIGINT NOT NULL` + 인덱스 · `created_at` · `expires_at NULL` · `revoked_at NULL`. 위 「Flyway 번호」 확인을 먼저 한다
- [x] 1.4 `wishlist/feature/build.gradle.kts` 에 `testImplementation(libs.testcontainers.junit)`·`testImplementation(libs.testcontainers.mysql)`(선례 `deal/feature/build.gradle.kts:37-38`). 락파일·다른 빌드 설정은 건드리지 않는다
- [x] 1.5 Verify: `./gradlew :wishlist:domain:test --tests '*CollectionShareTest' --rerun` + `./gradlew :wishlist:feature:test --tests '*WishlistSchemaIntegrationSpec' --rerun` + `./gradlew verifyFlywayWiring`. 스키마 스펙은 Docker 부재 시 skip 되므로 `wishlist/feature/build/test-results/test/TEST-*WishlistSchemaIntegrationSpec.xml` 의 `skipped="0"`·`tests>0` 을 증거로 남긴다(skip 된 실행은 통과로 치지 않는다)

### Task Group 2: application — 포트·유스케이스·서비스·설정 (SR-2.2 · 2.3 · 2.4 · 2.5 · 2.8 · 2.9)
**Dependencies:** TG1 · **Phase:** wishlist:feature application · **Required Skills:** ADR-0083 레이어, `@Transactional`(wishlist TM), Kotest + MockK
- [x] 2.1 테스트 먼저 — `wishlist/feature/src/test/kotlin/com/kgd/wishlist/application/share/service/CollectionShareServiceTest.kt`(포트는 인메모리 대역 — 「살아 있는 행 수」를 셀 수 있어야 한다, 고정 `Clock`, `ShortLinkProperties(origin = "https://short.test")`)
  - 재생성 → 이전 행 `revoked_at` 설정, 연속 생성 두 번 → 살아 있는 행 1
  - `expiresInDays` 0·366 → `BusinessException(INVALID_INPUT)`, 1·365·`null`(만료 없음) 통과
  - 없는 묶음 id 와 남의 묶음 id → 같은 `NOT_FOUND`(코드·메시지 동일)
  - 공개 조회: 만료·폐기·없음 → 같은 `NOT_FOUND`, 형식이 틀린 토큰은 포트 호출 0(`verify(exactly = 0)`)
  - 공개 조회 결과: ATTRACTION 만, createdAt 내림차순 100건 + 101건이면 `truncated = true`
  - `url` = `ShortLinkProperties.origin + "/c/" + token`(테스트 origin 으로 단언)
  - Resolve: 영숫자 10자 → `origin + "/shared/" + rest`, 그 밖(`""`, `"a/b"`, `"%2F%2Fevil.com"`, 9·11자) → `origin + "/shared/invalid"`, 포트 호출 0
  - 꺼짐(`WishlistShareProperties(enabled = false)`): 세 UseCase 모든 메서드가 첫 줄에서 `NOT_FOUND`, 범위 검사(0일)보다 404 가 먼저
- [x] 2.2 포트 `application/share/port/CollectionSharePort.kt` — 소유 묶음 잠금 조회(`PESSIMISTIC_WRITE` 는 어댑터 몫, 시그니처는 도메인 타입만), 살아 있는 행 조회·폐기·삽입, 토큰 조회, 공개 항목 조회(ATTRACTION·limit 101), `deleteAllByMemberId`
- [x] 2.3 유스케이스 인터페이스 `application/share/usecase/{ManageCollectionShareUseCase, GetSharedCollectionUseCase, ResolveCollectionShortLinkUseCase}.kt`(Resolve 는 목적지 문자열 반환). 응답 타입은 `application/share/dto/` 에 둔다(`service` 패키지 금지)
- [x] 2.4 설정 `application/share/config/WishlistShareProperties.kt` — `@ConfigurationProperties(prefix = "kgd.wishlist.share")`, `val enabled: Boolean = false`. 등록은 `infrastructure/config/WishlistShareConfig.kt` 의 `@EnableConfigurationProperties(WishlistShareProperties::class)` 한 곳 + `Clock` 빈(account 에 없음 — 이름을 한정해 member 쪽과 겹치지 않게)
- [x] 2.5 서비스 `application/share/service/CollectionShareService.kt` — 세 UseCase 구현, 클래스 레벨 `@Transactional` + `@Qualifier("wishlistTransactionManager")`, 주입은 `CollectionSharePort`·`WishlistShareProperties`·`ShortLinkProperties`·`Clock` 만. 순서: 꺼짐 분기 → 범위 검사 → 소유 묶음 잠금 → 살아 있는 행 폐기 → 삽입. `ShortLinkProperties` 는 여기서만 읽는다
- [x] 2.6 Verify: `./gradlew :wishlist:feature:test --tests '*CollectionShareServiceTest' --rerun` + `./gradlew verifyLayerDependencies`

### Task Group 3: 어댑터·컨트롤러 둘·`/c` 해석·탈퇴 정리 (SR-2.2 · 2.4 · 2.5 · 2.6 · 2.8 · 2.9)
**Dependencies:** TG2 · **Phase:** wishlist:feature infrastructure + presentation, account:app 컨텍스트 · **Required Skills:** JPA 비관적 잠금, MockMvc standalone, `WebApplicationContextRunner`, Kafka consumer
- [x] 3.1 테스트 먼저
  - `wishlist/feature/src/test/kotlin/com/kgd/wishlist/presentation/share/controller/CollectionShareControllerTest.kt`: MockMvc `.setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))`(선례 `SellerControllerTest.kt:48`) + 실제 서비스(포트만 mockk/대역) + 고정 Clock + `ShortLinkProperties(origin = "https://short.test")`. `POST …/share` 본문 없음 → `expiresAt` = Clock + 30일, `{}` → 30일, `{"expiresInDays":null}` → `expiresAt:null`, 1·365 → 200, 0·366 → 400, `url` 단언. `GET …/share` 링크 없음 → `200 {"link":null}`, `DELETE` 두 번 → 200 둘. 없는 묶음·남의 묶음 → 같은 404 본문
  - `…/presentation/share/controller/SharedCollectionControllerTest.kt`: 공개 응답 JSON 키 집합이 정확히 `{name, items[{targetType,targetKey}], truncated}`(소유자 id·시각 없음), 101건 → 100 + `truncated:true`. `/c/{영숫자 10자}` → 302 `Location` = `https://short.test/shared/{token}` + `Cache-Control: no-store` + `X-Robots-Tag: noindex`. `/c`, `/c/a/b`, `get(URI.create("/c/%2F%2Fevil.com"))` → `Location` 이 정확히 `https://short.test/shared/invalid`(단언 하나로)
  - `…/presentation/share/controller/ShareDisabledDispatchTest.kt`: `standaloneSetup(WishlistController, CollectionShareController, SharedCollectionController).setControllerAdvice(GlobalExceptionHandler())`, 같은 메시지 변환기, 실제 서비스 + `WishlistShareProperties(enabled = false)`. 소유자 셋(`X-User-Id: 1` 첨부)·`GET /api/v1/wishlist/shared/x`·`/c/x` 다섯 경로가 모두 404 + 본문 동일(`shared/x` 가 405 아님). 별도 Given 에서 `WebApplicationContextRunner().withPropertyValues("kgd.wishlist.share.enabled=false").withUserConfiguration(CollectionShareController::class.java, SharedCollectionController::class.java)` + UseCase 셋 `withBean(…) { mockk() }` → 두 컨트롤러 빈 존재(선례 `PaymentPgSelectionSpec.kt:52`)
  - `…/infrastructure/consumer/MemberEventConsumerTest.kt`: `member.withdrawn` 레코드 → 찜 삭제 + `collection_share` 를 `member_id` 로 삭제(같은 트랜잭션), 그 뒤 공개 조회 → `NOT_FOUND`
- [x] 3.2 JPA: `infrastructure/persistence/entity/CollectionShareJpaEntity.kt`, `repository/CollectionShareJpaRepository.kt`, `adapter/CollectionShareAdapter.kt`(포트 구현). 소유 묶음 잠금은 `WishlistCollectionJpaRepository` 에 `@Lock(PESSIMISTIC_WRITE)` 조회 하나를 더한다. 공개 항목은 ATTRACTION·createdAt 내림차순 `limit 101`. EMF·리포지토리 스캔이 `com.kgd.wishlist` 전체라(`WishlistDataSourceConfig.kt:29,82`) 설정 변경 없음
- [x] 3.3 `MemberEventConsumer.onMemberWithdrawn` 에 `collectionSharePort.deleteAllByMemberId(memberId)` 한 줄(같은 `@Transactional`). 묶음 행이 남는 기존 결함은 고치지 않고 보고만
- [x] 3.4 컨트롤러 `presentation/share/controller/CollectionShareController.kt`(소유자 3, `@RequestBody(required = false) request: CreateCollectionShareRequest?`, DTO `data class CreateCollectionShareRequest(val expiresInDays: Int? = 30)` — Bean Validation·`@Valid` 없음, `NullIsSameAsDefault` 켜지 않음)와 `SharedCollectionController.kt`(`X-User-Id` 파라미터 없음, `GET /api/v1/wishlist/shared/{token}` + `PREFIX = "/c"` 로 `@GetMapping(PREFIX, "$PREFIX/**")` — `requestURI` 에서 `contextPath`·`"$PREFIX/"` 를 뗀 나머지를 Resolve 에 넘기고 `ShortLinkRedirects.redirect`). 둘 다 `@ConditionalOnProperty` 없이 항상 등록, UseCase 인터페이스와 `ShortLinkRedirects` 만 쓴다(`ShortLinkProperties` 주입 금지 — 게이트 ⑤). DTO 는 `presentation/share/dto/`
- [x] 3.5 `WishlistController` 클래스 주석을 「공개 예외: /count, /shared/{token}(별도 컨트롤러)」로
- [x] 3.6 Verify: `./gradlew :wishlist:feature:test --tests '*CollectionShareControllerTest' --tests '*SharedCollectionControllerTest' --tests '*ShareDisabledDispatchTest' --tests '*MemberEventConsumerTest' --rerun` + `./gradlew :account:app:test --tests '*AccountContextLoadSpec' --rerun`(새 `Clock`·설정 빈이 컨텍스트를 깨지 않는지 — skip 이면 리포트 `skipped` 수를 적는다) + `./gradlew verifyLayerDependencies verifyTestConventions`

### Task Group 4: 게이트웨이 라우트 + apex 인그레스 (SR-2.7 · SR-2.13)
**Dependencies:** TG3(백엔드 경로 확정) · **Phase:** gateway + k8s/overlays/oci-arm · **Required Skills:** Spring Cloud Gateway 라우트 순서, ingress-nginx Prefix
- [x] 4.1 테스트 먼저
  - `gateway/src/test/kotlin/com/kgd/gateway/config/GatewayRouteAuthSpec.kt` 증보(선례 `:301`): 무토큰 `GET /api/v1/wishlist/shared/abcdefghij` 가 인증 없이 통과, 백엔드 스텁이 받은 요청에 `X-User-Id`·`X-User-Roles`·`Authorization` 없음(클라이언트가 붙여 보내도), `PUT /api/v1/wishlist/shared/x` 는 공개 라우트에 안 걸리고 401, `GET /api/v1/wishlist/shared/a/b` 는 공개 라우트에 안 걸림, 무토큰 `GET /api/v1/wishlist/collections/1/share` → 401, 공개 라우트가 `wishlist-service` 보다 앞 순서
  - `gateway/src/test/kotlin/com/kgd/gateway/config/ShortLinkRouteSpec.kt` 증보: `short-link-collection` 의 uri 호스트 `account`, 인증 필터 없음, `StripPrefix parts = 0`, `RequestRateLimiter` 필터 존재, 신원 헤더 제거. `wishlist-shared-public` 에도 `RequestRateLimiter` 존재
- [x] 4.2 `GatewayRouteConfig.kt`: `wishlist-shared-public` = `method(GET)` + `path("/api/v1/wishlist/shared/{token}")` + `removeRequestHeader` 셋 + `requestRateLimiter { shortLinkLimit(it) }` → `http://account:8093`, `wishlist-count-public` 다음·`wishlist-service` 앞. `short-link-collection` = `path("/c", "/c/**")` + 같은 헤더 제거 + `shortLinkLimit` + `stripPrefix(0)` → `http://account:8093`, `short-link-content` 다음
- [x] 4.3 `k8s/overlays/oci-arm/ingresses/commerce-platform.yaml` apex 단축 주소 블록에 `- path: /c`(Prefix, gateway). 블록 주석의 접두사 목록에 `/c` 추가. 다른 호스트 블록에는 넣지 않는다
- [x] 4.4 Verify: `./gradlew :gateway:test --tests '*GatewayRouteAuthSpec' --tests '*ShortLinkRouteSpec' --rerun` + `kubectl kustomize k8s/overlays/oci-arm | grep -n -A2 'path: /c$'`(렌더만 — 클러스터에 적용하지 않는다. 운영 조회는 `ssh msa-oci` 로만)

### Task Group 5: FE 로그인 복귀 — 의도 저장·허브 상태 저장/복원·의도 소비 (SR-1)
**Dependencies:** None(백엔드와 독립, 스펙 E TG2 위) · **Phase:** portal-fe · **Required Skills:** React StrictMode 이중 마운트, sessionStorage, vitest + RTL
- [x] 5.1 테스트 먼저
  - `portal-fe/src/pages/place/__tests__/PlacePage.loginReturn.test.tsx` — 이어 붙인 시나리오(필수): 게스트 허브 렌더 → 필터 조작 → 허브 별 클릭(`location.href` 가로채기, `FavoriteButton.test.tsx:76-85` 선례) → 언마운트 → `portal_user_id` 쿠키 → 같은 sessionStorage 로 `StrictMode` 재마운트(별 여러 개) → 질의 인자 복원·SEARCH 1건 `trigger:'restore'`(initial/landing 0건)·PUT 1회·의도 삭제·`CLICK/FAVORITE` 1건 `resumed:true`. 같은 파일에 경계: 10분 지난 의도 무시, 이미 찜이면 PUT·DELETE·알림·track 0, `/keys` 지연 변형, PUT 실패 → 별 비움·의도 삭제·`console.warn` 1, 형식이 틀린 허브 상태(분류 미지값·지역 코드 비숫자·page 음수·geo 반쪽·radiusKm 0) → 복원 안 함·삭제, 비로그인 재마운트 → 상태 복원 O·의도 유지·PUT 0, 모바일 `matchMedia` → page 0 복원·첫 쪽에 없는 선택만 버림
  - `portal-fe/src/components/favorite/__tests__/FavoriteButton.test.tsx` 증보: 비로그인 ATTRACTION 클릭 → `kgd.favoriteIntent.v1` 저장 + `onBeforeLogin` 이 `href` 대입 전에 1회, PRODUCT·GAME·BLOG_POST 는 의도 미저장, `onBeforeLogin` 없을 때 기존 동작 그대로
  - `portal-fe/src/pages/place/__tests__/AttractionPage.test.tsx` 증보: 로그인 마운트 + 유효 의도 → PUT 1회·「찜했습니다」·`resumed:true` 1건, 비로그인 → 의도 유지
  - `portal-fe/src/auth/__tests__/auth.loginReturn.test.ts`(새 파일): `clearLocalSession` 이 두 키 삭제, `vi.resetModules` + location 스텁 뒤 import 한 `buildLoginHref` → `safeNext` 왕복이 place href 를 돌려준다
- [x] 5.2 저장 모듈 `portal-fe/src/components/favorite/favoriteIntent.ts`(키 `kgd.favoriteIntent.v1`, `{targetType:'ATTRACTION', targetKey, createdAt}`, 10분, 읽기·쓰기·삭제 — 저장소 예외는 삼킨다)와 페이지 단위 훅 `useResumeFavoriteIntent`(조건: `isLoggedIn()` + 유효 의도 + ATTRACTION `/keys` 성공 뒤. 읽기·삭제는 첫 await 전 동기. 있으면 무동작, 없으면 `addFavorite` 직접 호출 → keys 캐시 갱신·알림·`resumed:true` FAVORITE CLICK(tracking 받는 화면만). 실패면 의도 삭제 + `console.warn`)
- [x] 5.3 `FavoriteButton.tsx`: 선택 prop `onBeforeLogin?: () => void`, `!loggedIn` 분기에서 ATTRACTION 이면 의도 기록 → `onBeforeLogin?.()` → `window.location.href` 대입. 나머지 호출처 7곳은 바꾸지 않는다
- [x] 5.4 `PlacePage.tsx`: 허브 상태 모듈(키 `kgd.placeHubState.v1`, 10분, 값 검증 — 분류·속성·행사 상태는 화면이 아는 목록, 지역 코드·관광지 id 숫자 문자열, page 0 이상 정수, geo 셋 유한·radiusKm > 0, exactFor 없음 또는 문자열, 하나라도 어긋나면 통째로 버리고 삭제). 첫 상태 선언 앞에 `const [restored] = useState(readPlaceHubState)`, 각 `useState` 초기값·`keywordInput` 을 `restored` 에서, 마운트 effect 에서 `clearPlaceHubState()`. 복원했으면 `triggerRef` 초기값 `'restore'`, `autoPickedRef` 초기값 `true`. `SearchTrigger` 에 `'restore'`. 기록 함수를 `AttractionDetailBody`·`PlaceCard` props 로 넘겨 두 별의 `onBeforeLogin` 에. 상세 페이지는 의도만. 훅 `useResumeFavoriteIntent` 를 PlacePage·AttractionPage 에 한 번씩
- [x] 5.5 `auth.ts` `clearLocalSession` 이 두 키 삭제. 로그인 next 는 그대로(SR-1.4). 온톨로지가 참조하는 `safeNext`·`COOKIE_DOMAIN`·`buildGoogleAuthUrl`·`getOAuthRedirectUri` 시그니처는 바꾸지 않는다
- [x] 5.6 계측 스펙 `docs/specs/2026-10-08-place-hub-instrumentation/spec.md` SR-10 「건수에서 빼는 것」 행에 `restore` 추가(결과 view 에는 들어간다) — **5.4 와 같은 커밋**
- [x] 5.7 Verify: `cd portal-fe && npx vitest run src/pages/place/__tests__/PlacePage.loginReturn.test.tsx src/components/favorite/__tests__/FavoriteButton.test.tsx src/pages/place/__tests__/AttractionPage.test.tsx src/auth/__tests__/auth.loginReturn.test.ts src/pages/place/__tests__/PlacePage.tracking.test.tsx src/pages/place/__tests__/PlacePage.layout.test.tsx && npx tsc -b`(뒤 둘은 기존 허브 계측·모바일 변형이 복원 코드로 깨지지 않는지)

### Task Group 6: FE 묶음 공유 막대 · SharePanel channels · 수신 화면 · GA 로더 조건 (SR-2.9 · 2.10)
**Dependencies:** TG3(API 모양), TG5(수신 화면의 의도 소비 훅) · **Phase:** portal-fe · **Required Skills:** DESIGN.md 토큰, SharePanel, 라우팅(apex)
- [ ] 6.1 테스트 먼저
  - `portal-fe/src/components/share/__tests__/SharePanel.test.tsx` 증보: `channels` 미지정 → 넷 다(기존 호출처 불변), `channels={['copy','share']}` → X·LinkedIn 앵커 0
  - `portal-fe/src/components/favorite/__tests__/FavoritesPage.share.test.tsx`(새 파일): 막대 세 칸(404 → 숨김 / `link:null` → 「공유 링크 만들기」 / `link` → 복사·Web Share·폐기) + 5xx·네트워크 → 숨김. 「전체」·「미분류」에서 `GET …/share` 0건·막대 없음, 묶음 칩 선택 시에만 1건. 묶음 막대 X·LinkedIn 앵커 0
  - `portal-fe/src/components/favorite/__tests__/SharedCollectionPage.test.tsx`(새 파일): 세 상태(404 → 「찾을 수 없거나 만료된 링크」, 토큰 `invalid` 도 같은 문구 / 항목 0·하이드레이션 전부 실패 → 빈 상태 / 정상 카드), `noindex`, 소유자 정보 텍스트 없음, 묶음 이름 `<img onerror>` 픽스처가 텍스트로만 렌더, 각 카드 별이 수신자 자신의 찜(PUT 대상 = 그 targetKey), 로그인 + 유효 의도 → 의도 소비 1회
  - `portal-fe/src/analytics/__tests__/gaLoader.test.ts`(새 파일): `portal-fe/index.html` 의 GA 로더 스크립트를 읽어 location·referrer 스텁으로 실행 — ① `/shared/x` ② `?next=https%3A%2F%2F1989v.com%2Fshared%2Fx`(대문자 `%2f` 변형 포함) ③ referrer `https://1989v.com/shared/x` 셋 다 `googletagmanager` 스크립트 0, 대조군 `/` 는 1, resume 호스트 제외 그대로
- [ ] 6.2 `wishlistApi.ts`: `fetchCollectionShare(id)`(404 를 구분해 돌려준다)·`createCollectionShare(id, expiresInDays?)`·`revokeCollectionShare(id)`·`fetchSharedCollection(token)`
- [ ] 6.3 `SharePanel.tsx`: 선택 prop `channels?: ReadonlyArray<'copy' | 'share' | 'x' | 'linkedin'>`(기본 넷 다)
- [ ] 6.4 `FavoritesPage`/`FavoriteCollections`: `kind:'one'` 칩일 때만 공유 막대 + 그때만 `GET …/share`. 막대는 SharePanel 을 `channels={['copy','share']}` 로. FE 별도 플래그 없음 — 404 가 곧 꺼짐
- [ ] 6.5 수신 화면 `portal-fe/src/components/favorite/SharedCollectionPage.tsx` + `App.tsx` apex 라우트 `/shared/:token`. 카드는 `FavoritesPage` 카드 재사용, 묶음 이름은 텍스트로만(`dangerouslySetInnerHTML` 금지), `noindex`, sitemap·llms·프리렌더 목록에 넣지 않는다. 앱 안에 `/shared/` 로 가는 SPA 링크를 두지 않는다
- [ ] 6.6 `portal-fe/index.html` GA 로더: resume 호스트 제외(`:20`) 바로 다음 줄에 조건 셋(경로 `/shared/` 시작 · `location.search` 에 `%2Fshared%2F` 대소문자 무시 · `document.referrer` 경로 `/shared/` 시작)
- [ ] 6.7 Verify: `cd portal-fe && npx vitest run src/components/share src/components/favorite src/analytics/__tests__/gaLoader.test.ts && npx tsc -b && npx vite build`(index.html 변경이 빌드 산출물에 그대로 들어가는지 `grep -c '%2Fshared%2F' dist/index.html`)

### Task Group 7: 계측 — 길찾기 · 상세 공유 · FAVORITES 공유 이벤트 · POST_SELECTION (SR-3)
**Dependencies:** TG6(묶음 막대), 스펙 D TG5(상세 행동 줄 — 길찾기만) · **Phase:** portal-fe + analytics:app · **Required Skills:** 이벤트 원장(ADR-0095), tracker 중복 키, ClickHouse SQL 리터럴
- [ ] 7.1 테스트 먼저
  - `AttractionPage.test.tsx` 증보: 길찾기 링크 `href` = `googleMapsDirectionsUrl(...)`, 클릭 → `CLICK` + `sectionId:'DIRECTIONS'` + payload `kind:'google_maps_directions'`, 기존 지도 링크는 그대로 `MAP_LINK`. 상세 SharePanel 복사·Web Share·X·LinkedIn 각각 → `entityType:'ATTRACTION'`·`entityId`=관광지 id·`screenType:'ATTRACTION_DETAIL'`·`sectionId:'SHARE'`·payload `{kind:'attraction', channel}` 전부 단언
  - `FavoritesPage.share.test.tsx` 증보: 「공유 링크 만들기」 클릭 → track 0, 같은 view 의 이어진 복사 → track 1(`entityType:'PAGE'`·`entityId:'favorites'`·`screenType:'FAVORITES'`·`sectionId:'SHARE'`·payload `{kind:'collection', channel:'copy'}`, 묶음 id 없음), 묶음 칩 전환 → viewId 바뀜
  - `SharePanel.test.tsx` 증보: `onShare(channel)` 이 채널마다 1회
  - `analytics/app/src/test/kotlin/com/kgd/analytics/infrastructure/popularity/ClickHouseAttractionPopularityAdapterTest.kt`: 상수 기대값 `setOf("MAP_LINK", "FAVORITE", "DIRECTIONS", "SHARE")` + SQL 리터럴 네 곳(`:60`·`:72`·`:77`·`:79`)의 `NOT IN (...)` 갱신
- [ ] 7.2 `events.ts`: SectionId 에 `DIRECTIONS`·`SHARE`(「선택 뒤 후속 행동」 주석 묶음 안), ScreenType 에 `FAVORITES`. EventAction·EntityType 은 늘리지 않는다. 중복 키는 바꾸지 않는다(두 번째 채널 유실 수용)
- [ ] 7.3 `SharePanel.tsx` 선택 `onShare?(channel)`. AttractionPage 의 SharePanel 에 상세 공유 계측, 스펙 D 행동 줄에 길찾기 링크(`googleMapsDirectionsUrl` — rank 선례 `rankView.ts:63-69`. 재사용 위치는 착수 때 place 쪽 `googleMaps.ts` 와 비교해 한 곳으로)
- [ ] 7.4 `FavoritesPage`: 묶음 칩 바뀔 때마다 `newViewId()`, 막대 SharePanel `onShare` → 위 형식 1건. 생성 버튼은 이벤트 없음
- [ ] 7.5 `AggregateAttractionPopularityUseCase.POST_SELECTION_SECTIONS` 에 `DIRECTIONS`·`SHARE`(상수 한 줄 — 어댑터 SQL 은 상수에서 조립)
- [ ] 7.6 Verify: `cd portal-fe && npx vitest run src/pages/place/__tests__/AttractionPage.test.tsx src/components/favorite/__tests__/FavoritesPage.share.test.tsx src/components/share src/analytics && npx tsc -b` + `./gradlew :analytics:app:test --tests '*ClickHouseAttractionPopularityAdapterTest' --rerun`

### Task Group 8: 회귀 주입 · 문서 · 온톨로지 참조 · 배포 · 운영 확인 (SR-4.3 · SR-4.4 · SR-2.12)
**Dependencies:** TG1–7 · **Phase:** 검증 + 문서 + 배포 · **Required Skills:** 임시 워크트리 회귀 주입, CDP(독립 프로필 헤드리스 크롬), `ssh msa-oci`
- [ ] 8.1 회귀 주입(SR-4.3) — **임시 사본 워크트리**에서 한 건씩 넣고 아래 테스트의 빨강을 본 뒤 되돌린다. 컴파일되는 회귀여야 한다(구문 오류 빨강은 증거 아님). 결과 → `verifications/regression-injection.md`(주입 diff 한 줄 · 실패한 테스트 이름 · 실패 줄)

  | # | 주입 | 빨강이 나야 하는 테스트 |
  |---|---|---|
  | 1 | 의도 저장 삭제 | `FavoriteButton.test` · `PlacePage.loginReturn` |
  | 2 | 허브 상태 복원 삭제 | `PlacePage.loginReturn`(질의 인자) |
  | 3 | 복원 시 기본 질의 억제(`triggerRef`/`autoPickedRef` 초기값) 삭제 | `PlacePage.loginReturn`(SEARCH 1건 `restore`) |
  | 4 | 1회 가드(첫 await 전 읽기·삭제) 삭제 | `PlacePage.loginReturn`(StrictMode PUT 1회) |
  | 5 | 복귀가 `toggle` 재사용 | `PlacePage.loginReturn` 이미 찜 경계(DELETE 0) |
  | 6 | 의도 TTL 판정 삭제 | `PlacePage.loginReturn` 10분 경계 |
  | 7 | 링크 만료 판정 삭제 | `CollectionShareTest` · `CollectionShareServiceTest` |
  | 8 | 설정 꺼짐 분기 삭제 | `ShareDisabledDispatchTest` · `CollectionShareServiceTest` |
  | 9 | 공개 라우트 헤더 제거 삭제 | `GatewayRouteAuthSpec` · `ShortLinkRouteSpec` |
  | 10 | 공개 경로를 `/api/v1/wishlist/**` 로 넓힘 | `GatewayRouteAuthSpec`(PUT 401·collections 401) |
  | 11 | 탈퇴 시 공유 삭제 제거 | `MemberEventConsumerTest` |
  | 12 | CASCADE 제거(새 V 파일이 아니라 사본의 V4 수정) | `WishlistSchemaIntegrationSpec` — 리포트 `skipped="0"` 과 함께 |
  | 13 | 공개 응답에 `memberId` 추가 | `SharedCollectionControllerTest`(키 집합) |
  | 14 | 섹션 POST_SELECTION 제외 삭제 | `ClickHouseAttractionPopularityAdapterTest` |
  | 15 | 공유 컨트롤러에 `@ConditionalOnProperty` 추가 | `ShareDisabledDispatchTest`(컨텍스트 러너 · 405) |
  | 16 | `/c` 형식 검사 삭제 | `SharedCollectionControllerTest` · `CollectionShareServiceTest` |
  | 17 | `url` 호스트를 리터럴로 | `CollectionShareControllerTest`(`https://short.test`) |
  | 18 | 「공유 링크 만들기」에 track 추가 | `FavoritesPage.share.test`(track 0 · 이어진 복사 1) |
  | 19 | 허브 별에 `onBeforeLogin` 미전달 | `PlacePage.loginReturn` |
  | 20 | 묶음 막대에 `channels` 미전달 | `FavoritesPage.share.test`(X·LinkedIn 0) |
  | 21 | GA 로더 조건 하나씩 삭제(①②③) | `gaLoader.test` |
- [ ] 8.2 문서: `wishlist/CLAUDE.md` Key Rules 공개 경로 문장에 「공유 토큰 열람」, API 표에 네 행 + `/c/{token}`, `/c` 접두사와 설정 키·켜는 env(`KGD_WISHLIST_SHARE_ENABLED`, account 오버레이 — 승인 전에는 넣지 않는다). ADR-0106 접두사 목록은 ADR-0107 §5 가 갖는다. 열람 원장 없음이라 ADR-0077 표·`/privacy` §6·retention 변경 없음. 문서-소스 추적(`docs/standards/doc-index-tracking.md`) 갱신 대상이면 같은 커밋
- [ ] 8.3 온톨로지 참조 확인 — 이번에 고친 파일·심볼을 가리키는 항목이 아직 맞는지:
  `grep -n -E 'path: (wishlist/|gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig|analytics/app/src/main/kotlin/com/kgd/analytics/(application|infrastructure)/popularity|portal-fe/src/(components/(favorite|share)|auth/auth|analytics/(events|tracker)|pages/place/(PlacePage|AttractionPage))|portal-fe/index.html|k8s/overlays/oci-arm/ingresses/commerce-platform)' code-dictionary/feature/src/main/resources/ontology/*.yaml`
  2026-10-09 기준 걸리는 것: `auth.ts`(security.yaml 6곳 — `safeNext`·`COOKIE_DOMAIN`·`buildGoogleAuthUrl`·`getOAuthRedirectUri`·`Max-Age=0; SameSite=Lax`·`scope=openid`), `GatewayRouteConfig.kt`(3곳 — `class GatewayRouteConfig(`·`fun routeLocator(`·`requiredRoles = listOf("ROLE_ADMIN")`), `commerce-platform.yaml`(5곳). 각 `symbol` 문자열이 파일에 그대로 있는지 `grep -F` 로 확인하고, 바뀌었으면 yaml 수정 + `manifest.yaml` `revision` 올림(ADR-0100). 개념 추가(공유 토큰 등)는 이번 범위 밖
- [ ] 8.4 배포: 커밋·푸시는 사용자 확인 뒤. 이미지 넷 — account(wishlist)·gateway·analytics·portal-fe. 인그레스는 Argo 가 반영. **설정은 켜지 않는다**(Q1). 운영 조회·kubectl 은 `ssh msa-oci` 로만(로컬 기본 컨텍스트는 회사 EKS)
- [ ] 8.5 배포 뒤 확인(SR-4.4) → `verifications/post-deploy.md`. 재기 전에 새 번들 해시·이번에 넣은 심볼(예: `%2Fshared%2F`)이 응답에 있는지 먼저 본다
  - `curl -s -o /dev/null -w '%{http_code}' https://1989v.com/api/v1/wishlist/shared/x` → 404, `curl -s -o /dev/null -w '%{http_code}' https://1989v.com/c/x` → 404(설정 꺼짐)
  - CDP(독립 프로필 헤드리스 크롬, start·측정·stop 한 명령): ① `https://1989v.com/shared/x` ② `https://1989v.com/login?next=https%3A%2F%2F1989v.com%2Fshared%2Fx` 직접 ③ `/shared/x` 에서 별 → `/login` 이동 — 셋 다 `googletagmanager.com` 요청 0, 대조군 `https://1989v.com/` 1건 이상
  - 길찾기·상세 공유: 일반 Chrome UA CDP 로 보낸 건수 = `202 accepted` = ClickHouse 행(계측 스펙 SR-9.4 방식)
  - 로그인 복귀: 게스트 절반(허브 별 → sessionStorage 두 키 존재 · next 가 place href)을 CDP 로 실측, 로그인 뒤 절반은 「미확인」
  - S3-4b 완료 판정은 Q1 승인 → `KGD_WISHLIST_SHARE_ENABLED=true` 뒤 수신자 열람·찜 확인. 그 전까지 미완으로 적는다
- [ ] 8.6 Verify: `bash -c 'cd portal-fe && npx vitest run src/pages/place/__tests__/PlacePage.loginReturn.test.tsx src/pages/place/__tests__/AttractionPage.test.tsx src/components/favorite src/components/share src/auth/__tests__/auth.loginReturn.test.ts src/analytics && npx tsc -b'` + `./gradlew :wishlist:domain:test --tests '*CollectionShareTest' :wishlist:feature:test --tests '*CollectionShare*' --tests '*SharedCollectionControllerTest' --tests '*ShareDisabledDispatchTest' --tests '*MemberEventConsumerTest' --tests '*WishlistSchemaIntegrationSpec' --rerun` + `./gradlew :gateway:test --tests '*GatewayRouteAuthSpec' --tests '*ShortLinkRouteSpec' --rerun` + `./gradlew :analytics:app:test --tests '*ClickHouseAttractionPopularityAdapterTest' --rerun` + `./gradlew verifyLayerDependencies verifyFlywayWiring verifyTestConventions` + 8.3 grep 결과 + `verifications/` 두 파일 존재
