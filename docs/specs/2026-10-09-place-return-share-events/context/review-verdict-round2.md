# 판정 결과: ADR-0107 여행 묶음 공유 스펙, 심판 2라운드

2라운드 발견 12건을 모두 판정했습니다. **유지 12, 강등 0, 기각 0** 입니다. 인용된 `file:line` 은 모두 `wt-impl` 에서 직접 열어 봤고, 원문과 다른 곳은 없었습니다. 표준·선례에 이 결함들을 받아들인 패턴도 없었습니다. BLOCK 으로 올린 것은 없습니다.

**구현 전에 꼭 고칠 셋**
- **IM-1 + TS-1 (설정 꺼짐 405)**: 레포 선례처럼 `@ConditionalOnProperty` 로 빈을 빼면 `GET /api/v1/wishlist/shared/x` 가 405 + `Allow: PUT, DELETE` 로 나갑니다. 공유 컨트롤러만 띄운 테스트로는 초록불이 납니다.
- **AR-1 (레이어 게이트 ⑤)**: 스펙 SR-2.8 대로 컨트롤러가 `ShortLinkProperties` 를 주입하면 빌드가 실패합니다.
- **IM-2 (허브 상태 저장·복원 자리)**: 복원 자리가 비어 있으면 「initial/landing 0건」이 경쟁 상태에 맡겨집니다. 자동 시도 선택 effect 도 같은 결과를 냅니다.

**리뷰어 수정안과 다르게 반영하는 곳 셋**
- **TS-1**: 리뷰어가 제안한 회귀 주입 「`@ConditionalOnProperty` 로 바꿈 → 빨강」은 `standaloneSetup` 에서는 빨강이 나지 않습니다. 이 방식은 컨트롤러를 손으로 만들어 조건을 평가하지 않기 때문입니다. 그래서 `WebApplicationContextRunner` 로 확인하는 검사를 하나 더 넣었습니다.
- **IM-1**: 꺼짐 분기를 핸들러가 아니라 서비스 첫 줄에 둡니다. `package-structure.md:93` 규칙 11 「설정은 그것을 읽는 레이어가 소유한다」와 SR-2.2 의 배치(`application/share/config`)에 맞추기 위해서입니다.
- **TS-4**: `/c` 의 경계 입력 동작을 사용자 판단 J8 의 권고 기본값으로 정했습니다.

---

## 1. 묶음 표

| 묶음 | 포함 발견 | 판정 | 핵심 증거 |
|---|---|---|---|
| C1 설정 꺼짐 404 의 동작 방식과 테스트 | IM-1, TS-1 | 유지 REVISE | 아래 세 가지가 겹칩니다. ① `WishlistController.kt:40,64` 의 `@PutMapping/@DeleteMapping("/{targetType}/{targetKey}")` ② `GlobalExceptionHandler.kt:99-102` 가 405 의 `Allow` 를 보존 ③ 선례 `TossWebhookController.kt:22`·`SlackEventController.kt:24` 는 빈을 아예 만들지 않음. 레포에는 `@WebMvcTest` 가 0건입니다. |
| C2 허브 상태 저장·복원 자리 | IM-2 | 유지 REVISE | `FavoriteButton.tsx:76-79` 가 동기로 이동합니다. 허브 별은 `PlacePage.tsx:1683,1804`(자식 `AttractionDetailBody`·`PlaceCard`) 안에 있고, SEARCH 는 `:449-482`, 자동 시도 선택은 `:622-632` 입니다. |
| C3 공유 설정·요청 DTO 배선 | IM-3, IM-4, TS-3 | 유지 REVISE | `AccountApplication.kt:16-23` 에 `@ConfigurationPropertiesScan` 이 없습니다. 선례로 `@RequestBody(required = false)` 를 쓰는 곳이 3곳 있습니다(`SellerAdminController.kt:94` 등). |
| C4 토큰의 외부 유출 (GA) | SE-1 | 유지 REVISE | `index.html:15-31` 의 GA 로더는 호스트만 보고 경로는 보지 않습니다. resume 를 뺀 근거가 `:11-14` 에 있습니다. |
| C5 `/c` 해석과 호스트 | AR-1, TS-4 | 유지 REVISE | 게이트 ⑤ 의 허용 패키지는 `build.gradle.kts:291` 이고 위반은 `:439-442` 에서 판정합니다. `ShortLinkProperties.kt:6-7` 에 「호스트는 여기서만」이 적혀 있습니다. 선례 `AttractionShortLinkService.kt:35` 는 서비스가 주입하고, `AttractionShortLinkController.kt:29` 는 `$PREFIX/**` 를 받습니다. |
| C6 스키마 테스트가 건너뛰어짐 | TS-2 | 유지 REVISE | `DealSchemaIntegrationSpec.kt:48-51` 은 `@EnabledIf`(Docker) 입니다. wishlist `build.gradle.kts:29-31` 에는 testcontainers 가 없습니다. |
| C7 공유 막대 탭과 공유 이벤트 손실 | UC-1, DO-1 | 유지 REVISE | 탭은 `FavoriteCollections.tsx:65-67` 에 있습니다(전체·미분류·묶음). `tracker.ts:27-28` 의 중복 키에 채널이 들어가지 않습니다. |

---

## 2. 발견별 판정 JSON

```json
[
  {"id":"IM-1 설정이 꺼졌을 때 다섯 경로 404 보장 방법 없음","verdict":"keep","severity":"REVISE",
   "evidence":[
     {"file":"wishlist/feature/src/main/kotlin/com/kgd/wishlist/presentation/wishlist/controller/WishlistController.kt","line":40,"quote":"@PutMapping(\"/{targetType}/{targetKey}\")"},
     {"file":"wishlist/feature/src/main/kotlin/com/kgd/wishlist/presentation/wishlist/controller/WishlistController.kt","line":64,"quote":"@DeleteMapping(\"/{targetType}/{targetKey}\")"},
     {"file":"common/src/main/kotlin/com/kgd/common/exception/GlobalExceptionHandler.kt","line":100,"quote":"// 405 의 Allow, 415 의 Accept 처럼 상태코드에 규격상 딸린 헤더를 보존한다."},
     {"file":"payment/feature/src/main/kotlin/com/kgd/payment/presentation/webhook/controller/TossWebhookController.kt","line":22,"quote":"@ConditionalOnProperty(prefix = \"payment\", name = [\"pg\"], havingValue = \"toss\")"},
     {"file":"docs/adr/ADR-0107-wishlist-collection-share-links.md","line":11,"quote":"없음·폐기·만료·묶음 삭제·소유자 탈퇴·설정 꺼짐은 모두 같은 **404**"}],
   "reason":"인용이 원문과 같고, 꺼짐 상태에서 GET 이 3세그먼트 이하로 겹치는 경로는 /shared/x 하나뿐임을 매핑 전수로 확인했다. 분기는 핸들러가 아니라 서비스 첫 줄로 옮겨 반영한다(규칙 11)."},
  {"id":"IM-2 허브 상태를 저장·복원하는 자리 미정","verdict":"keep","severity":"REVISE",
   "evidence":[
     {"file":"portal-fe/src/components/favorite/FavoriteButton.tsx","line":78,"quote":"window.location.href = buildLoginHref();"},
     {"file":"portal-fe/src/pages/place/PlacePage.tsx","line":1661,"quote":"function AttractionDetailBody({"},
     {"file":"portal-fe/src/pages/place/PlacePage.tsx","line":451,"quote":"const trigger: SearchTrigger = triggerRef.current ?? (hasSearchedRef.current ? 'other' : 'landing');"},
     {"file":"portal-fe/src/pages/place/PlacePage.tsx","line":624,"quote":"if (autoPickedRef.current || !hasRegionAxis || sidoCode || keyword || geo) return;"}],
   "reason":"원문과 같다. 시도 없이 복원된 상태에서는 자동 시도 선택이 initial SEARCH 를 낸다. 스펙이 이미 요구한 「initial 0건」을 지키려고 복원 자리 편집에 autoPickedRef 초기값을 함께 넣는다. 「다른 호출처 9곳」은 실제로 나머지 7곳이다(전체 9곳 중 PlacePage 2곳)."},
  {"id":"IM-3 공유 설정 클래스 스프링 등록 자리 없음","verdict":"keep","severity":"REVISE",
   "evidence":[
     {"file":"account/app/src/main/kotlin/com/kgd/account/AccountApplication.kt","line":16,"quote":"@SpringBootApplication( scanBasePackages = [ \"com.kgd.member\", \"com.kgd.wishlist\", …"},
     {"file":"common/src/main/kotlin/com/kgd/common/shortlink/ShortLinkAutoConfiguration.kt","line":10,"quote":"@EnableConfigurationProperties(ShortLinkProperties::class)"}],
   "reason":"원문과 같다. 기동 실패는 Docker 가 있어야 도는 AccountContextLoadSpec 에서만 드러나므로 스펙에 고정한다. 강등할 근거(ⓐⓑⓒ)가 없다."},
  {"id":"IM-4 expiresInDays 세 상태 수신 방식 미정","verdict":"keep","severity":"REVISE",
   "evidence":[
     {"file":"docs/specs/2026-10-09-place-return-share-events/spec.md","line":23,"quote":"body `expiresInDays`(생략 = 30, `null` = 만료 없음, 1~365 밖은 400)"},
     {"file":"common/src/main/kotlin/com/kgd/common/exception/GlobalExceptionHandler.kt","line":64,"quote":"@ExceptionHandler(HttpMessageNotReadableException::class)"},
     {"file":"seller/feature/src/main/kotlin/com/kgd/seller/presentation/seller/controller/SellerAdminController.kt","line":94,"quote":"@Valid @RequestBody(required = false) request: ReactivateSellerRequest?,"}],
   "reason":"본문이 없을 때의 동작이 스펙에 없다. `required = false` 선례가 있어 수정안을 그대로 받는다. NullIsSameAsDefault 를 켠 곳은 레포에 없다(grep 0건)."},
  {"id":"SE-1 수신 화면 주소 속 토큰이 GA4 로 넘어감","verdict":"keep","severity":"REVISE",
   "evidence":[
     {"file":"portal-fe/index.html","line":20,"quote":"if (host.split(\".\")[0] === \"resume\") return;"},
     {"file":"portal-fe/index.html","line":13,"quote":"문서 경로(/d/<slug>)까지 리포트에 남는다."},
     {"file":"docs/specs/2026-10-09-place-return-share-events/spec.md","line":29,"quote":"수신자 화면: apex `/shared/:token`"}],
   "reason":"원문과 같다. 같은 이유로 resume 호스트를 뺀 선례가 이미 있어 결함이 분명하다."},
  {"id":"TS-1 공유 컨트롤러만 띄운 WebMvc 테스트는 405 를 놓침","verdict":"keep","severity":"REVISE",
   "evidence":[
     {"file":"docs/specs/2026-10-09-place-return-share-events/spec.md","line":51,"quote":"설정 꺼짐: WebMvc 로 다섯 경로 각각 404."},
     {"file":"seller/feature/src/test/kotlin/com/kgd/seller/presentation/seller/controller/SellerControllerTest.kt","line":47,"quote":".standaloneSetup(SellerController(service, service, applications), SellerAdminController(service, admin))"},
     {"file":"fulfillment/feature/src/test/kotlin/com/kgd/fulfillment/presentation/fulfillment/controller/FulfillmentControllerOwnershipTest.kt","line":42,"quote":".setControllerAdvice(GlobalExceptionHandler())"}],
   "reason":"결함은 맞다. 다만 standaloneSetup 은 컨트롤러를 손으로 만들어 @ConditionalOnProperty 를 평가하지 않으므로, 제안된 회귀 주입은 빨강이 안 난다. 그래서 WebApplicationContextRunner 로 빈 존재를 보는 검사를 보탠다."},
  {"id":"TS-2 스키마 통합 테스트가 Docker 없으면 건너뜀","verdict":"keep","severity":"REVISE",
   "evidence":[
     {"file":"deal/feature/src/test/kotlin/com/kgd/deal/infrastructure/persistence/DealSchemaIntegrationSpec.kt","line":48,"quote":"@org.junit.jupiter.api.condition.EnabledIf("},
     {"file":"wishlist/feature/build.gradle.kts","line":29,"quote":"testImplementation(libs.spring.boot.starter.test)  (testcontainers 없음)"},
     {"file":"deal/feature/build.gradle.kts","line":37,"quote":"testImplementation(libs.testcontainers.junit)"}],
   "reason":"원문과 같다. 건너뛴 실행이 「통과」로 집계돼 회귀 주입의 증거를 무효로 만든다."},
  {"id":"TS-3 expiresInDays 경계·세 상태 테스트 없음","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/specs/2026-10-09-place-return-share-events/spec.md","line":49,"quote":"`expiresInDays` 0·366 → 400"}],
   "reason":"원문과 같다. 생략과 null 의 구분은 역직렬화 층에서만 드러난다(IM-4 와 짝)."},
  {"id":"TS-4 /c 해석 경계 입력 테스트 없음","verdict":"keep","severity":"REVISE",
   "evidence":[
     {"file":"place/feature/src/main/kotlin/com/kgd/place/presentation/shortlink/controller/AttractionShortLinkController.kt","line":29,"quote":"@GetMapping(PREFIX, \"$PREFIX/**\")"},
     {"file":"docs/specs/2026-10-09-place-return-share-events/spec.md","line":54,"quote":"`/c/{token}` → `https://1989v.com/shared/{token}` 302·no-store·noindex."}],
   "reason":"원문과 같다. `/c`·`/c/a/b` 의 동작이 스펙에 없다. 형식 검사 기본값은 J8 로 올린다."},
  {"id":"UC-1 공유 막대가 어느 탭에서 보이는지 미정","verdict":"keep","severity":"REVISE",
   "evidence":[
     {"file":"portal-fe/src/components/favorite/FavoriteCollections.tsx","line":65,"quote":"{chip({ kind: 'all' }, lang === 'en' ? 'All' : '전체')}"},
     {"file":"portal-fe/src/components/favorite/FavoriteCollections.tsx","line":66,"quote":"{chip({ kind: 'unclassified' }, lang === 'en' ? 'Unsorted' : '미분류')}"}],
   "reason":"원문과 같다. 전체·미분류에는 묶음 id 가 없어 `GET …/collections/{id}/share` 를 부를 수 없다."},
  {"id":"DO-1 묶음 공유에서 만들기가 복사를 늘 가림","verdict":"keep","severity":"REVISE",
   "evidence":[
     {"file":"portal-fe/src/analytics/tracker.ts","line":28,"quote":"return `${e.viewId}|${e.entityType}|${e.entityId}|${e.sectionId ?? ''}|${e.action}`;"},
     {"file":"docs/adr/ADR-0107-wishlist-collection-share-links.md","line":16,"quote":"링크 생성·복사는 이벤트 원장 `CLICK` + `entityType:'PAGE'`·`entityId:'favorites'`"}],
   "reason":"J5 가 받아들인 것은 우연한 두 번째 채널이다. 이 건은 첫 공유의 복사가 체계적으로 사라지는 새 사실이라 J5 를 다시 여는 것이 아니다. FavoritesPage 에는 아직 track·viewId 가 없다(grep 0건)."},
  {"id":"AR-1 /c 컨트롤러가 ShortLinkProperties 직접 주입 → 게이트 ⑤","verdict":"keep","severity":"REVISE",
   "evidence":[
     {"file":"build.gradle.kts","line":291,"quote":"val presentationAllowedPkg = listOf(\".usecase.\", \".presentation.\", \".config.\")"},
     {"file":"place/feature/src/main/kotlin/com/kgd/place/application/shortlink/service/AttractionShortLinkService.kt","line":35,"quote":"private val shortLinks: ShortLinks,"},
     {"file":"common/src/main/kotlin/com/kgd/common/shortlink/ShortLinkProperties.kt","line":6,"quote":"단축 주소와 목적지의 호스트는 여기서만 얻는다"},
     {"file":"docs/specs/2026-10-09-place-return-share-events/spec.md","line":27,"quote":"wishlist 공개 컨트롤러가 … `ShortLinkProperties.origin + \"/shared/\" + 인코딩한 token`"}],
   "reason":"`com.kgd.common.shortlink.` 는 허용 패키지 셋 어디에도 해당하지 않아 빌드가 실패한다. 응답 url 의 호스트 하드코딩도 원문에 그대로 있다."}
]
```

---

## 3. spec.md 편집 목록

경로는 `docs/specs/2026-10-09-place-return-share-events/spec.md` 이고, 표기한 줄 번호는 현재 파일 기준입니다.

**E1 · SR-1.2 (13행) 전체 교체** (IM-2)
> 2. 화면 상태: 허브는 별 클릭이 로그인으로 이동하기 직전에 sessionStorage 키 `kgd.placeHubState.v1` 에 {검색어·분류·속성·지역 3단계(areaCode·sidoCode·sigunguCode)·행사 상태·선택 관광지 id·page·createdAt} 을 쓴다(10분). **저장 자리**: `FavoriteButton` 에 선택 prop `onBeforeLogin?: () => void` 를 더하고, `!loggedIn` 분기에서 `window.location.href` 대입 직전에 부른다. PlacePage 는 상태 기록 함수를 `AttractionDetailBody`(`PlacePage.tsx:1661`)·`PlaceCard`(`:1730`) props 로 넘겨 두 별(`:1683`·`:1804`)에 준다. 나머지 호출처 7곳(AttractionPage·FavoritesPage·상점 상세·블로그 2·게임 2)은 바꾸지 않는다. 상태가 바뀔 때마다나 `pagehide` 에서 저장하지 않는다. **복원 자리**: PlacePage 의 첫 상태 선언(`:330`) 앞에 `const [restored] = useState(readPlaceHubState)` 를 두고, 각 상태의 `useState` 초기값을 `restored` 에서 읽는다. 초기값 함수는 **읽기만** 하고, 키 삭제는 마운트 effect(`useEffect(() => clearPlaceHubState(), [])`)에서 한다(StrictMode 는 초기값 함수를 두 번 부른다). 유효한 상태가 있으면 **로그인 여부와 무관하게** 복원한다. 복원했으면 `triggerRef` 초기값을 `'restore'` 로, 자동 시도 선택의 `autoPickedRef`(`:622`) 초기값을 `true` 로 둔다. 그래서 복원 마운트의 SEARCH 는 `trigger:'restore'` 정확히 1건이고, 기본 상태의 `initial`/`landing` 은 0건이다. 복원값은 외부 입력으로 다룬다. 분류·속성·행사 상태는 화면이 아는 값 목록에 있어야 하고, 지역 코드·관광지 id 는 숫자 문자열, page 는 0 이상 정수여야 한다. 하나라도 어긋나면 통째로 버리고 지운다. `restore` 는 SearchTrigger 에 추가하고, 계측 스펙 SR-10 「건수에서 빼는 것」에 넣는다(결과 view 에는 들어간다 — landing 만 빠지므로). 같은 커밋에서 표를 고친다. 상세 페이지는 주소가 곧 상태라 저장 의도만 남긴다.

**E2 · SR-2.2 (21행) 전체 교체** (IM-3, AR-1)
> 2. 레이어(ADR-0083): 포트는 `application/share/port/CollectionSharePort` 다. 유스케이스 인터페이스는 `application/share/usecase/{ManageCollectionShareUseCase, GetSharedCollectionUseCase, ResolveCollectionShortLinkUseCase}` 셋이다(Resolve 는 목적지 문자열을 돌려준다). 설정은 `application/share/config/WishlistShareProperties`(`@ConfigurationProperties(prefix = "kgd.wishlist.share")`, `val enabled: Boolean = false`)이고, 등록은 `infrastructure/config/WishlistShareConfig` 의 `@EnableConfigurationProperties(WishlistShareProperties::class)` 한 곳에서 한다(`AccountApplication` 에 `@ConfigurationPropertiesScan` 이 없다). 구현 서비스는 `application/share/service/` 에 두고 세 UseCase 를 구현한다. 주입은 `CollectionSharePort`·`WishlistShareProperties`·`ShortLinkProperties`(common — 호스트는 여기서만 얻는다)·`Clock` 이다. 어댑터·JPA 엔티티는 `infrastructure/persistence` 에 둔다. 컨트롤러는 `presentation/share/controller/` 에 둘 둔다. 소유자용은 `CollectionShareController`, 공개용은 `SharedCollectionController`(`/api/v1/wishlist/shared/{token}` 과 `/c`)다. 둘 다 UseCase 인터페이스와 `ShortLinkRedirects`(object)만 쓰고, `ShortLinkProperties` 를 직접 주입하지 않는다(레이어 게이트 ⑤). 토큰 생성·만료·폐기 판정은 domain `CollectionShare` 모델(`WishlistCollection.kt` 와 같은 모양)이 하고, 시각은 `Clock` 주입으로 얻는다. 서비스는 클래스 레벨 `@Qualifier("wishlistTransactionManager")`.

**E3 · SR-2.4 (23행) 문장 교체** (IM-4, AR-1)
- 바꿀 문장:
  > `POST /api/v1/wishlist/collections/{id}/share` body `expiresInDays`(생략 = 30, `null` = 만료 없음, 1~365 밖은 400) → `200 {token, url:"https://1989v.com/c/{token}", expiresAt|null}`.
- 새 문장:
  > `POST /api/v1/wishlist/collections/{id}/share` — 파라미터는 `@RequestBody(required = false) request: CreateCollectionShareRequest?`, DTO 는 `data class CreateCollectionShareRequest(val expiresInDays: Int? = 30)`. 본문 없음(`request == null`)과 `{}` 는 30일, 명시 `{"expiresInDays":null}` 은 만료 없음, 1~365 밖은 `BusinessException(INVALID_INPUT)` 400 이다. Jackson `NullIsSameAsDefault` 는 켜지 않는다(켜면 명시 null 이 30 이 된다). 응답은 `200 {token, url, expiresAt|null}` 이고, `url` 은 서비스가 `ShortLinkProperties.origin + "/c/" + token` 으로 만든다(호스트 리터럴 금지). `GET …/share` 의 `link.url` 도 같다.

**E4 · SR-2.5 (24행) 마지막 문장 교체**
- 바꿀 문장:
  > 이 API 와 `/c` 해석은 `X-User-Id` 파라미터가 없는 별도 컨트롤러 `presentation/share/` 에 둔다.
- 새 문장:
  > 이 API 와 `/c` 해석은 `X-User-Id` 파라미터가 없는 별도 컨트롤러 `presentation/share/controller/SharedCollectionController` 에 둔다. 토큰이 `^[A-Za-z0-9]{10}$` 가 아니면 DB 를 조회하지 않고 같은 404 를 낸다.

**E5 · SR-2.8 (27행) 전체 교체** (AR-1, TS-4, J8)
> 8. 짧은 주소 `/c/{token}`: common 은 고치지 않는다. `SharedCollectionController` 가 `PREFIX = "/c"` 상수(선례 `AttractionShortLinkController.kt:29,36,55`)로 `@GetMapping(PREFIX, "$PREFIX/**")` 를 받는다. `requestURI` 에서 `contextPath` 와 `PREFIX + "/"` 를 뗀 나머지를 `ResolveCollectionShortLinkUseCase` 에 넘기고, 받은 목적지로 `ShortLinkRedirects.redirect` 302 한다. 서비스는 DB 를 보지 않는다. 나머지가 `^[A-Za-z0-9]{10}$` 이면 목적지는 `ShortLinkProperties.origin + "/shared/" + 나머지` 다. 아니면(`/c`, `/c/`, `/c/a/b`, `/c/%2F%2Fevil.com`, 길이·문자 불일치) 목적지는 `ShortLinkProperties.origin + "/shared/invalid"` 다. 목적지 호스트는 항상 `ShortLinkProperties.origin` 이다. 무효 토큰은 수신 화면이 「찾을 수 없는 링크」를 그린다(ADR-0106 「빈 화면을 보지 않게」와 같은 취지, ADR-0107 §5). 접두사 목록 갱신은 ADR-0107 §5 와 `wishlist/CLAUDE.md` 에 적는다. `common/` 아래 파일은 건드리지 않는다(전 JVM 재빌드).

**E6 · SR-2.9 (28행) 전체 교체** (IM-1, UC-1)
> 9. 설정 `kgd.wishlist.share.enabled`(기본 false): 꺼지면 소유자 3 + 공개 1 + `/c` 다섯 경로가 모두 404 다(405·400 아님). 방식은 하나로 고정한다. 공유 컨트롤러 둘은 설정과 무관하게 항상 등록한다(`@ConditionalOnProperty` 금지). 빈이 없으면 `GET /api/v1/wishlist/shared/x` 가 `WishlistController` 의 `PUT/DELETE /{targetType}/{targetKey}` 와 경로가 겹쳐, `GlobalExceptionHandler` 가 405 + `Allow: PUT, DELETE` 를 내기 때문이다. 세 UseCase 구현은 첫 줄에서 `enabled == false` 면 `BusinessException(ErrorCode.NOT_FOUND)` 를 던진다. 그래서 꺼짐 404 의 본문은 없는 토큰의 404 와 같다. FE 막대: 막대는 찜 화면에서 묶음 칩(`kind:'one'`)이 선택됐을 때만 그리고, 그때만 `GET …/collections/{id}/share` 를 부른다. 「전체」·「미분류」에서는 막대도 요청도 없다. 응답이 404 면 공유 버튼을 숨기고, `200 link:null` 이면 「공유 링크 만들기」, `200 link` 면 복사(SharePanel 재사용)·폐기를 보인다. 그 밖의 오류(5xx·네트워크)면 숨긴다. FE 에 별도 플래그는 없다.

**E7 · SR-2.10 (29행) 끝에 문장 추가** (SE-1)
> `portal-fe/index.html` 의 GA 로더는 `location.pathname` 이 `/shared/` 로 시작하면 싣지 않는다. 자리는 resume 호스트 제외(`index.html:20`) 바로 다음 줄이다. 토큰이 `page_location` 으로 외부 리포트에 남지 않게 하려는 것이다.

**E8 · SR-3.2 (36행) 문장 교체** (DO-1)
- 바꿀 문장:
  > 묶음 공유 만들기·복사는 `CLICK` + `entityType:'PAGE'`·`entityId:'favorites'`·`screenType:'FAVORITES'`(ScreenType 에 추가)·`sectionId:'SHARE'`·payload `{kind:'collection', channel}` — 묶음 id 는 싣지 않는다.
- 새 문장:
  > 묶음 공유는 SharePanel 의 복사·Web Share·X·LinkedIn 만 보낸다. 형식은 `CLICK` + `entityType:'PAGE'`·`entityId:'favorites'`·`screenType:'FAVORITES'`(ScreenType 에 추가)·`sectionId:'SHARE'`·payload `{kind:'collection', channel}` 이다. 「공유 링크 만들기」는 이벤트를 내지 않는다. 생성 기록은 `collection_share.created_at` 이 남기고, 같은 중복 키로 보내면 뒤이은 복사가 버려지기 때문이다. 묶음 id 는 싣지 않는다. FAVORITES 화면의 viewId 는 묶음 칩을 바꿀 때마다 `newViewId()` 로 새로 만든다.

**E9 · SR-4.1 넷째 항목 (46행) 끝에 추가** (UC-1, DO-1)
> 막대 요청은 묶음 칩을 골랐을 때만 나가고, 전체·미분류에서 `GET …/share` 는 0건이다. 「공유 링크 만들기」 클릭은 track 0건이고, 같은 view 에서 이어진 복사는 track 1건(`kind:'collection'`)이다.

**E10 · SR-4.2 컨트롤러 항목 (50행) 교체** (TS-3)
> - 컨트롤러: 공개 응답 JSON 키 집합이 정확히 `{name, items[{targetType,targetKey}], truncated}` 이고, 101건이면 100건 + truncated 다. `POST …/share` 는 고정 Clock 으로 본다. 본문 없음 → `expiresAt` = Clock + 30일, `{}` → 30일, `{"expiresInDays":null}` → `expiresAt:null`, 1 → 200, 365 → 200, 0·366 → 400. 응답 `url` 은 `ShortLinkProperties.origin + "/c/" + token` 이다.

**E11 · SR-4.2 설정 꺼짐 항목 (51행) 교체** (TS-1)
> - 설정 꺼짐: `MockMvcBuilders.standaloneSetup(WishlistController, CollectionShareController, SharedCollectionController).setControllerAdvice(GlobalExceptionHandler())` 로 세 컨트롤러를 한 디스패처에 올린다(선례 `SellerControllerTest.kt:47`, `FulfillmentControllerOwnershipTest.kt:42`). 서비스는 실제 구현을 쓰고(포트만 mockk), `WishlistShareProperties(enabled = false)` 를 넣는다. 다섯 경로 각각 404 이고 본문이 같아야 한다(`GET /api/v1/wishlist/shared/x` 가 405 가 아님). 별도로 `WebApplicationContextRunner().withPropertyValues("kgd.wishlist.share.enabled=false")` 에 두 공유 컨트롤러와 의존 빈(mockk)을 등록해, 두 컨트롤러 빈이 존재하는지 본다(`@ConditionalOnProperty` 회귀 감지).

**E12 · SR-4.2 스키마 항목 (52행) 끝에 추가** (TS-2)
> wishlist/feature `build.gradle.kts` 에 `testImplementation(libs.testcontainers.junit)`·`testImplementation(libs.testcontainers.mysql)` 을 추가한다(선례 `deal/feature/build.gradle.kts:37-38`).

**E13 · SR-4.2 `/c` 항목 (54행) 교체** (TS-4)
> - `/c/{영숫자 10자}` → `ShortLinkProperties.origin + "/shared/{token}"` 302·no-store·noindex. `/c`, `/c/a/b`, `/c/%2F%2Fevil.com` 은 `Location` 이 정확히 `ShortLinkProperties.origin + "/shared/invalid"` 다(호스트 고정, 단언 하나로). 설정이 꺼졌으면 `/c/x` 는 404 다.

**E14 · SR-4.3 (56행) 끝에 추가** (TS-1, TS-2, TS-4, AR-1, DO-1)
> 공유 컨트롤러에 `@ConditionalOnProperty` 추가 · `/c` 형식 검사 삭제 · `url` 호스트를 리터럴로 · 「공유 링크 만들기」에 track 추가 · 허브 별에 `onBeforeLogin` 미전달. 스키마 스펙(Testcontainers)의 회귀 증거는 테스트 리포트의 실행 건수(skipped 0)와 함께 남긴다. 건너뛴 실행은 회귀 주입의 증거로 쓰지 않는다.

**E15 · SR-4.4 첫 항목 (58행) 다음에 추가** (SE-1)
> - 설정과 무관하게 `https://1989v.com/shared/x` 를 CDP 로 열어 `googletagmanager.com` 요청이 0건인지 본다. 대조군으로 `https://1989v.com/` 은 1건 이상이어야 한다.

**E16 · Existing Code (64행) 목록에 추가**
> `GlobalExceptionHandler.kt:82-102`, `AttractionShortLinkService.kt:35`, `ShortLinkProperties.kt:6-7`, `SellerControllerTest.kt:47`, `portal-fe/index.html:11-20`, `FavoriteCollections.tsx:65-67`, `tracker.ts:21-28`, `PlacePage.tsx:420-482,622-632,1661,1730`, `AccountApplication.kt:16-23`

## 4. ADR-0107 편집 목록

**A1 · §5 (14행) 전체 교체** (AR-1, TS-4)
> 5. **짧은 주소**: apex `/c/{token}` → `/shared/{token}` 302(no-store·noindex). wishlist 가 자기 컨트롤러 상수 `/c` 로 받고, 토큰을 조회하지 않고 넘긴다. 형식(영숫자 10자)이 아니면 `/shared/invalid` 로 보낸다. 목적지 호스트는 `ShortLinkProperties.origin` 에서만 얻는다. 무효 토큰은 수신 화면이 「찾을 수 없는 링크」를 그린다. ADR-0106 의 「실패 시 서비스 목록 302」와 다른 이유는 이렇다. 비공개 자료라 해석 단계에서 유효 여부를 드러내지 않고, 수신 화면이 빈 화면 대신 안내를 보여 주므로 ADR-0106 의 취지는 지켜진다. 접두사 `c` 는 ADR-0106 의 접두사 목록에 더하되, `common` 의 `ShortLinkPrefix` 는 바꾸지 않는다(common 변경은 전 JVM 이미지 재빌드).

**A2 · §7 (16행) 전체 교체** (DO-1)
> 7. **계측**: 묶음 공유 링크의 복사·채널 공유는 이벤트 원장에 `CLICK` + `entityType:'PAGE'`·`entityId:'favorites'`·`screenType:'FAVORITES'`·`sectionId:'SHARE'`, payload `{kind:'collection', channel}` 로 남긴다. 링크 생성은 이벤트를 내지 않는다. 생성 기록은 `collection_share.created_at` 이 이미 남기고, 같은 중복 키라 보내면 뒤이은 복사가 버려진다. 묶음 id 는 싣지 않는다. action·EntityType 을 늘리지 않는다.

**A3 · Consequences 첫 항목 (19행) 끝에 추가** (SE-1)
> 토큰 경로는 외부 분석 도구로 보내지 않는다. 수신 화면 `/shared/` 에서는 GA 를 싣지 않는다(resume 호스트를 뺀 것과 같은 이유).

**A4 · Consequences 둘째 항목 (20행) 끝에 추가** (IM-1)
> 컨트롤러는 항상 등록하고 서비스가 404 를 던진다. 빈을 빼면 `/shared/x` 가 기존 찜 경로(`PUT/DELETE /{targetType}/{targetKey}`)와 겹쳐 405 가 된다.

---

## 5. 3라운드 재리뷰 차원 (마지막 라운드)

| 차원 | 범위 | 볼 범위 |
|---|---|---|
| security | 필수 | E5·E7·A1·A3 그대로인지, 그리고 **NOTES ①②** 를 판정 대상으로 넘긴다 |
| implementation | 필수 | E1(저장·복원 자리, `autoPickedRef`·`triggerRef` 초기값), E2·E3·E6 이 서로 맞물리는지 |
| test-strategy | 필수 | E10~E14. 특히 `WebApplicationContextRunner` 검사가 회귀 주입에 빨강을 내는지(헌법상 주입 없이 「켰다」 금지) |
| usecase | 축소 | E6 의 탭 조건, E9 |
| domain | 축소 | E8·A2 와 SR-3.5 의 J5 문장이 모순 없는지 |
| architecture | 축소 | E2 의 게이트 ⑤ 통과 여부(주입 타입이 전부 `.usecase.`·`.config.` 인지) |

## 6. 사용자 판단 항목

| # | 질문 | 권고 기본값 | 근거 |
|---|---|---|---|
| J8 | `/c` 뒤가 토큰 형식(영숫자 10자)이 아닐 때 | **302 `origin/shared/invalid`** → 수신 화면이 404 안내 | DB 를 보지 않으니 유효 여부가 드러나지 않습니다. 사람이 잘못 친 링크에 JSON 404 를 보이지 않습니다. 호스트는 고정입니다. |
| J9 | 묶음 링크 「만들기」를 이벤트에서 뺄까 (DO-1) | **뺀다** | 생성은 DB 행이 남깁니다. 남기면 첫 복사가 매번 사라집니다. |
| J10 | 로그인 next 로 토큰이 GA 에 가는 경로 (NOTES ①) | **3라운드 security 가 판정.** 수정이 필요하다면 GA 로더 조건을 `location.search` 에 `%2Fshared%2F` 가 들어 있을 때도 미적재로 넓히는 것이 가장 작은 수정입니다 | 입력 발견에 없던 문제라 이번 편집에는 넣지 않았습니다(헌법 4). |
| J11 | 비공개 묶음 링크에 SharePanel 의 X·LinkedIn(공개 게시) 버튼을 그대로 둘까 (NOTES ②) | **3라운드 security·usecase 가 판정.** 권고는 복사·Web Share 만 남기는 것 | 입력 발견에 없던 문제입니다. |

SUMMARY: keep 12 / demote 0 / dismiss 0
NOTES: ① 수신 화면의 별을 누르면 `buildLoginHref()`(`auth.ts:123-128`)가 `/login?next=https%3A%2F%2F1989v.com%2Fshared%2F<token>` 로 보낸다. `/login` 은 GA 를 싣는 apex 화면이라, SE-1 수정 뒤에도 토큰이 GA `page_location` 쿼리로 나갈 수 있다. ② `SharePanel.tsx:63-79` 는 X·LinkedIn 공개 게시 링크를 늘 그리므로, 묶음 공유에 그대로 재사용하면 비공개 링크를 공개 게시하는 버튼이 생긴다. ③ E1 의 `autoPickedRef` 초기값은 새 요구가 아니다. 이미 있는 「initial 0건」 요구를 지키는 데 필요해서 IM-2 의 복원 자리 편집에 포함했다.

판정에 쓴 파일:
- `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-09-place-return-share-events/spec.md`
- `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/adr/ADR-0107-wishlist-collection-share-links.md`
- `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-09-place-return-share-events/context/engineer-review-round2.md`