# 엔지니어 리뷰 2라운드 — 로그인 복귀 · 여행 묶음 공유 · 행동 이벤트

범위는 심판 1라운드 §5 를 따랐다. security·implementation·test-strategy·usecase 는 전체를 봤고, domain·architecture 는 축소 범위만 봤다. 1라운드에서 판정된 묶음 B1~B15 와 J1~J7 은 다시 열지 않았고, 아래에는 **새로 찾은 결함만** 적었다. 근거는 모두 `wt-impl` 에서 직접 확인했다.

| 차원 | 판정 | 건수 |
|---|---|---|
| security | REVISE | 1 |
| implementation | REVISE | 4 |
| test-strategy | REVISE | 4 |
| usecase | REVISE | 1 |
| domain (축소) | REVISE | 1 |
| architecture (축소) | REVISE | 1 |

---

## implementation — REVISE

**IM-1 (NOTES ①) 설정이 꺼졌을 때 「다섯 경로 404」를 보장할 방법이 스펙에 없다. 이 레포 선례를 따르면 405 가 샌다**
- 근거:
  - 선례 컨트롤러 둘은 설정이 꺼지면 빈을 아예 만들지 않는다 — `TossWebhookController.kt:22` `@ConditionalOnProperty(prefix = "payment", name = ["pg"], havingValue = "toss")`, `SlackEventController.kt:24`. 구현자는 이 방식을 따르기 쉽다.
  - 빈이 없으면 `GET /api/v1/wishlist/shared/x` 는 `WishlistController.kt:40`(`@PutMapping("/{targetType}/{targetKey}")`)·`:64`(`@DeleteMapping`)과 경로만 맞고 메서드가 안 맞는다. 그래서 `HttpRequestMethodNotSupportedException` 이 난다.
  - `GlobalExceptionHandler.kt:82-84,99-102` 는 이 예외를 405 그대로, `Allow: PUT, DELETE` 헤더까지 붙여 내보낸다.
  - 나머지 네 경로(`/collections/{id}/share` 셋, `/c/x`)는 매핑이 없어 `NoResourceFoundException` 이 되고 404 가 나온다. 즉 다섯 중 하나만 어긋난다.
  - 설정이 꺼졌을 때 ADR §2 의 「같은 404」(`ADR-0107:11`)가 깨진다.
- 수정안: SR-2.9 에 동작 방식을 고정한다.
  - 「공유 컨트롤러 둘(소유자·공개/`/c`)은 설정과 무관하게 항상 등록한다(`@ConditionalOnProperty` 금지).
  - 각 핸들러 첫 줄에서 `WishlistShareProperties.enabled` 가 false 면 `BusinessException(ErrorCode.NOT_FOUND)` 를 던진다.」
  - 이렇게 하면 본문도 `GlobalExceptionHandler.kt:24,35` 를 거쳐, 토큰이 없을 때의 404 와 바이트 단위로 같아진다.
  - SR-4.3 회귀 주입 목록의 「설정 꺼짐 분기 삭제」와도 짝이 맞는다.

**IM-2 (NOTES ③) 허브 상태를 저장하는 자리와 복원하는 자리가 정해지지 않았다**
- 근거:
  - 로그인 이동은 범용 컴포넌트 안에서 동기로 일어난다 — `FavoriteButton.tsx:76-79` `if (!loggedIn) { window.location.href = buildLoginHref(); return; }`.
  - 허브의 별은 PlacePage 본문이 아니라 자식 컴포넌트 안에 있다. 상세 `AttractionDetailBody`(`PlacePage.tsx:1660-1687`)와 카드(`:1734-1809`)라서 허브 상태에 바로 닿지 못한다.
  - 상태가 바뀔 때마다나 `pagehide` 에서 저장하는 방식은 대안이 못 된다. 그러면 로그인과 상관없이 10분 안에 허브에 다시 들어올 때마다 옛 필터가 복원된다(SR-1.2 는 「로그인 여부와 무관하게 복원」).
  - 복원을 effect 에서 하면 기본 질의가 먼저 나간다. `viewId = useMemo(() => newViewId(), [query])`(`PlacePage.tsx:420`)이고 SEARCH 전송 effect 가 `:449-482` 에 있기 때문이다. 그러면 SR-1.2 의 「initial/landing 0건」이 경쟁 상태에 맡겨진다.
- 수정안: SR-1.2 에 두 가지를 적는다.
  - 저장: `FavoriteButton` 에 선택 prop `onBeforeLogin?: () => void` 을 더하고 `!loggedIn` 분기에서 이동 직전에 부른다. PlacePage 는 상태 기록 함수를 `AttractionDetailBody`·카드 경유로 허브의 ATTRACTION 별 전부에 넘긴다. 다른 호출처 9곳은 바뀌지 않는다.
  - 복원: 첫 렌더의 `useState` 초기값 함수에서 **읽기만** 하고, 키 삭제는 마운트 effect 에서 한다. StrictMode 는 초기값 함수를 두 번 부르므로, 초기값 함수 안에서 지우면 어느 호출 결과가 쓰이느냐에 따라 복원이 사라질 수 있다.

**IM-3 공유 설정 클래스를 스프링에 등록하는 자리가 없다**
- 근거:
  - `AccountApplication.kt:17` 은 `scanBasePackages` 만 있고 `@ConfigurationPropertiesScan` 이 없다.
  - 공용 설정은 `ShortLinkAutoConfiguration.kt:10` 처럼 `@EnableConfigurationProperties` 로 직접 켠다.
  - SR-2.2 는 `application/share/config/WishlistShareProperties` 의 위치만 정했다.
- 수정안: 「`infrastructure/config/WishlistShareConfig` 에 `@EnableConfigurationProperties(WishlistShareProperties::class)`」 한 줄을 더한다. 빠뜨리면 `AccountContextLoadSpec` 에서 기동이 실패해 드러나긴 하지만, 그 전에 스펙에서 막는다.

**IM-4 `expiresInDays` 의 세 가지 상태(생략·null·값)를 받는 방식이 정해지지 않았다**
- 근거:
  - SR-2.4 는 「생략 = 30, `null` = 만료 없음」이라고 했다.
  - 역직렬화는 `jackson-module-kotlin` 이 한다(`wishlist/feature/build.gradle.kts:13`). 생략과 명시 null 의 구분이 기본값 처리 설정(NullIsSameAsDefault)에 따라 뒤바뀐다.
  - 본문 자체가 없는 POST 는 `@RequestBody` 기본값 required 때문에 400 이 된다(`GlobalExceptionHandler.kt:64-69`).
- 수정안: SR-2.4 에 다음을 적는다.
  - 「`@RequestBody(required = false)`. 본문 없음 = 키 생략 = 30일, 명시 `null` = 만료 없음.」
  - 요청 DTO 는 `val expiresInDays: Int? = 30`.
  - 테스트는 TS-3 을 본다.

## security — REVISE

**SE-1 수신 화면 주소 속 토큰이 GA4 로 넘어간다**
- 근거:
  - apex 는 resume 를 뺀 모든 호스트에서 GA4 를 싣는다(`portal-fe/index.html:15-32`). 향상된 측정이 SPA 경로까지 `page_location` 으로 보낸다(`:8`).
  - 수신 화면은 `apex /shared/{token}` 이고(SR-2.10), `/c/{token}` 302 의 목적지도 그 주소다(SR-2.8).
  - 그러면 「링크를 가진 사람만」 여는 토큰이 Google 리포트에 경로로 남아, GA 열람 권한만 있으면 남의 묶음을 열 수 있다.
  - 같은 이유로 이력서 호스트는 GA 를 이미 뺐다 — `index.html:11-14`「문서 경로(/d/<slug>)까지 리포트에 남는다」, `:20`.
- 수정안: SR-2.10 에 「`index.html` GA 로더는 `location.pathname` 이 `/shared/` 로 시작하면 싣지 않는다(resume 선례와 같은 자리)」를 더한다. ADR-0107 Consequences 의 방어선 문장에도 「토큰 경로는 외부 분석 도구로 보내지 않는다」를 덧붙인다. 확인은 SR-4.4 의 배포 뒤 CDP 실측에서 `/shared/x` 를 열었을 때 `googletagmanager` 요청이 0건인지 본다.

## test-strategy — REVISE

**TS-1 설정 꺼짐 404 를 보는 WebMvc 테스트가 공유 컨트롤러만 띄우면 운영에서 날 405 를 놓친다**
- 근거:
  - 405 는 `WishlistController.kt:40,64` 의 경로와 겹쳐서 생긴다(IM-1).
  - 공유 컨트롤러만 띄운 슬라이스에서는 `/shared/x` 가 404 로 초록불이 나고, 운영에서는 405 가 난다. 검사가 대상이 아니라 자기 슬라이스를 재는 셈이다.
- 수정안: SR-4.2 「설정 꺼짐」 항목을 「`MockMvcBuilders.standaloneSetup(WishlistController, 공유 컨트롤러들).setControllerAdvice(GlobalExceptionHandler())` 로 같은 디스패처에 함께 올리고 다섯 경로 각각 404·본문 동일」로 바꾼다(선례 `SellerControllerTest.kt:47`). 회귀 주입에 「공유 컨트롤러를 `@ConditionalOnProperty` 로 바꿈 → 빨강」을 더한다.

**TS-2 스키마 통합 테스트는 Docker 가 없으면 건너뛰기만 해서, 회귀 주입이 초록으로 보일 수 있다**
- 근거:
  - 선례는 Docker 가 없으면 테스트를 끈다 — `DealSchemaIntegrationSpec.kt:48-51` `@EnabledIf(... disabledReason = "Docker 미연결 …")`.
  - SR-4.3 의 「CASCADE 제거」·「같은 토큰 두 번」 회귀 주입은 이 스펙에서만 잡힌다. 건너뛰면 결과는 빨강이 아니라 「통과」다.
  - wishlist 에는 Testcontainers 의존성도 없다(`wishlist/feature/build.gradle.kts:29-31`, deal 은 `deal/feature/build.gradle.kts:37-38`).
- 수정안: SR-4.2 에 두 가지를 적는다.
  - 「testcontainers junit·mysql 을 wishlist testImplementation 에 추가」.
  - SR-4.3 에 「스키마 스펙의 증거는 테스트 리포트의 실행 건수(skipped 0)와 함께 남긴다. 건너뛴 실행은 회귀 주입 증거로 쓰지 않는다」.

**TS-3 `expiresInDays` 의 경계·세 가지 상태를 보는 테스트가 없다**
- 근거: SR-4.2 의 서비스 테스트는 「0·366 → 400」만 본다. IM-4 의 생략 / `null` / 본문 없음 구분은 JSON 역직렬화 층에서만 드러나므로 서비스 테스트로는 잡을 수 없다.
- 수정안: 컨트롤러 테스트에 다음 다섯 가지를 더한다.
  - 본문 없음 → `expiresAt` = 고정 Clock + 30일
  - `{}` → 30일
  - `{"expiresInDays":null}` → `expiresAt:null`
  - 1 → 200
  - 365 → 200

**TS-4 `/c` 해석의 경계 입력 테스트가 없다**
- 근거: SR-4.2 는 정상 토큰의 302 하나만 본다. 컨트롤러는 `"$PREFIX/**"` 를 받는 선례 모양이라(`AttractionShortLinkController.kt:29,36`) `/c`, `/c/a/b`, `/c/%2F%2Fevil.com` 도 들어온다.
- 수정안: 「위 세 입력 모두 `Location` 이 `ShortLinkProperties.origin` + `/shared/` 로 시작한다(호스트 고정)」를 단언 하나로 더한다. `/c` 단독일 때 동작(수신 화면 404 안내로 302 하거나 404)도 SR-2.8 에 한 줄로 정한다.

## usecase — REVISE

**UC-1 공유 막대가 어느 탭에서 보이는지 정해지지 않았다**
- 근거:
  - 찜 화면 탭에는 묶음 말고도 「전체」·「미분류」가 있다(`FavoriteCollections.tsx:65-66`).
  - 미분류는 `collection_id IS NULL` 이라(ADR-0080) 공유할 묶음 id 가 없다.
  - SR-2.9 는 응답에 따른 막대 세 상태만 정했고, 어느 화면 상태에서 `GET …/share` 를 부르는지는 정하지 않았다.
- 수정안: SR-2.9 에 「공유 막대는 묶음 칩이 선택됐을 때만 그리고 그때만 `GET …/share` 를 부른다. 전체·미분류에서는 막대도 요청도 없다」를 더한다.
- 참고: SR-1.2~1.3 의 비로그인 복귀 흐름에서 남은 빈칸은 IM-2(저장·복원 자리) 하나뿐이다. 나머지(10분 무효·비로그인 재마운트 시 의도 유지·소비 조건)는 1라운드 반영으로 닫혔다.

## domain (축소) — REVISE

**DO-1 묶음 공유에서는 「만들기」가 「복사」를 늘 가린다. J5(두 번째 채널 유실 수용)가 예상한 것보다 손실이 크다**
- 근거:
  - ADR §7(`ADR-0107:16`)과 SR-3.2 는 「링크 생성·복사」를 같은 `CLICK`·`PAGE`·`favorites`·`SHARE` 로 보낸다.
  - 트래커 중복 키는 `viewId|entityType|entityId|sectionId|action` 이다(SR-3.5). 첫 공유는 항상 「만들기 → 복사」 순서라, 같은 view 에서 복사가 매번 버려진다.
  - J5 가 받아들인 것은 우연한 두 번째 채널이었다. 그런데 이 경우는 실제 공유 행동(복사) 자체가 체계적으로 사라진다.
  - FAVORITES 화면의 viewId 를 언제 새로 만드는지도 정해지지 않았다.
- 수정안: ADR §7·SR-3.2 를 「복사·채널 공유만 보낸다. 생성은 `collection_share.created_at` 이 이미 기록하므로 이벤트를 내지 않는다」로 줄인다. SR-3.2 에 「FAVORITES viewId 는 묶음 칩을 바꿀 때마다 새로 만든다」를 더한다. 중복 키는 그대로 둔다(J5 와 충돌하지 않는다).
- SR-2.5 응답 용어 `{name, items[{targetType,targetKey}], truncated}` 는 기존 `WishlistItemResponse`(`WishlistController.kt:205-212`)의 필드명과 맞는다. 이상 없다.

## architecture (축소) — REVISE

**AR-1 `/c` 컨트롤러가 `ShortLinkProperties` 를 직접 주입하면 레이어 게이트 ⑤ 에 걸려 빌드가 실패한다**
- 근거:
  - SR-2.8 은 「wishlist 공개 컨트롤러가 … `ShortLinkProperties.origin + "/shared/" + …`」라고 적었다.
  - 게이트 ⑤ 는 presentation 생성자 주입 타입의 선언 패키지가 `.usecase.`·`.presentation.`·`.config.` 중 하나여야 한다고 본다(`build.gradle.kts:291,439-442`). `com.kgd.common.shortlink` 는 셋 다 아니다. 면제 목록은 비어 있어야 정상이다(`:245-247`).
  - 선례는 목적지 조립을 application 서비스에 둔다 — `AttractionShortLinkService.kt:35` 가 `ShortLinks` 를 주입하고, 컨트롤러는 `ResolveAttractionShortLinkUseCase` 만 받는다.
  - SR-2.4 의 응답 `url:"https://1989v.com/c/{token}"` 도 호스트를 하드코딩했다. `ShortLinkProperties.kt:6-7` 은 「호스트는 여기서만 얻는다」라고 적고 있다.
- 수정안: SR-2.2·2.8 을 고친다.
  - 「`application/share/usecase/ResolveCollectionShortLinkUseCase`(목적지 문자열 반환). 구현 서비스가 `ShortLinkProperties` 를 주입한다. 컨트롤러는 UseCase 와 `ShortLinkRedirects` 만 쓴다.」
  - 「POST/GET 응답의 `url` 도 같은 서비스가 `origin + "/c/" + token` 으로 만든다.」
  - 컨트롤러 위치는 모듈 관례대로 `presentation/share/controller/`(`package-structure.md:43-46`).
- SR-2.2 의 나머지 배치(port·usecase·config·domain `CollectionShare`)와 common 을 고치지 않는다는 결정(J2)은 이상 없다.

---

VERDICT: REVISE
