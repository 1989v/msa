# 엔지니어 재리뷰 3라운드 (마지막) — ADR-0107 묶음 공유 · 로그인 복귀

범위는 `review-verdict-round2.md` §5 의 표다. 이미 판정된 항목은 다시 열지 않았다. 확인한 것은 세 가지다. 편집 E1~E16·A1~A4 가 반영됐는지, 편집끼리 맞물리는지, 편집이 새로 만든 결함이 있는지. NOTES ①② 와 J10·J11 도 함께 판정했다.

**반영 확인**: E1~E16·A1~A4 는 모두 본문에 들어가 있다(spec.md 13·21·23·24·27·28·29·36·46·50~54·56·59·65행, ADR-0107 14·16·19·20행). 원문과 다른 곳은 없었다.

## 차원별 판정

| 차원 | 범위 | 판정 | 새 발견 |
|---|---|---|---|
| security | 필수 | **REVISE** | 2 (J10 · J11) |
| implementation | 필수 | **REVISE** | 3 |
| test-strategy | 필수 | **REVISE** | 3 |
| usecase | 축소 | **REVISE** | 0건(E6·E9 는 SHIP). J11 은 SEC-R3-2 와 공동 판정 |
| domain | 축소 | **SHIP** | 0건(J11 채택 시 문구만 따라 고침 — SEC-R3-2 편집에 포함) |
| architecture | 축소 | **SHIP** | 0 |

BLOCK 은 없다.

---

## security

E5·E7·A1·A3 는 반영된 그대로 맞물린다.
- 목적지 호스트는 항상 `ShortLinkProperties.origin` 이다(spec.md:27). 기본값은 `ShortLinkProperties.kt:15` 의 `"https://1989v.com"` 이다.
- 형식이 아닌 나머지는 `/shared/invalid` 로 간다. `invalid` 는 7자라 공개 API 의 `^[A-Za-z0-9]{10}$` 검사(spec.md:24)에서 DB 조회 없이 404 가 된다. 수신 화면 안내와 이어진다.
- GA 로더 제외 자리는 resume 제외(`index.html:20`) 다음 줄로 정확하다(spec.md:29).

### SEC-R3-1 · J10 판정: 수정 필요. 경로는 next 쿼리에 리퍼러 하나가 더 있다

- **근거**:
  - `auth.ts:124-127` 은 `next` 에 현재 href 를 통째로 넣는다(`/login?next=https%3A%2F%2F1989v.com%2Fshared%2F<token>`). `/login` 은 apex 화면이라, `index.html:15-31` 의 로더가 호스트만 보고 GA 를 싣는다. `gtag('config', id)`(`index.html:31`)의 `page_location` 은 쿼리까지 포함하므로 토큰이 나간다(NOTES ①).
  - **리퍼러 경로가 하나 더 있다.** 별 클릭은 `FavoriteButton.tsx:78` 의 `window.location.href = …` 이라 새 문서를 연다. 레포 어디에도 `Referrer-Policy` 가 없다(grep 0건, portal-fe·k8s 전체). 그래서 브라우저 기본값(strict-origin-when-cross-origin)이 적용되고, 같은 출처(apex→apex) 이동에는 전체 URL 이 리퍼러로 간다. `/login` 의 GA 는 `document.referrer` = `https://1989v.com/shared/<token>` 을 `page_referrer` 로 보낸다. J10 의 권고(`location.search` 에서 `%2Fshared%2F` 검사)만으로는 이 경로가 남는다.
  - OAuth 단계는 안전하다. `LoginPage.tsx:10-12` 는 next 를 sessionStorage 에 두고 제공자에 넘기지 않는다. 콜백 문서의 리퍼러는 제공자(교차 출처라 출처만)다.
- **수정안**(SR-2.10 끝 문장 교체, ADR-0107 Consequences 첫 항목 같은 취지):
  > GA 로더는 `location.pathname` 이 `/shared/` 로 시작하거나, `location.search` 에 `%2Fshared%2F`(대소문자 무시)가 있거나, `document.referrer` 의 경로가 `/shared/` 로 시작하면 싣지 않는다. 자리는 resume 제외(`index.html:20`) 다음 줄이다. 앱 안에서 `/shared/` 로 가는 SPA 링크는 두지 않는다. GA 가 이미 실린 문서에서는 history page_view 가 토큰 경로를 보내기 때문이다.
  - SR-4.4 의 CDP 항목(spec.md:59)에 두 경우를 더한다. ① `https://1989v.com/login?next=https%3A%2F%2F1989v.com%2Fshared%2Fx` 를 직접 연다. ② `/shared/x` 에서 별을 눌러 `/login` 으로 이동한다. 두 경우 모두 `googletagmanager.com` 요청이 0건이어야 한다. 대조군은 그대로 `/` 1건 이상이다.

### SEC-R3-2 · J11 판정: 권고 채택. 묶음 공유에서는 복사·Web Share 만 남긴다

- **근거**:
  - `SharePanel.tsx:68-85` 는 X·LinkedIn 공개 게시 링크를 늘 그린다. 그런데 spec.md:28 은 SharePanel 을 재사용하고, spec.md:36 은 「복사·Web Share·X·LinkedIn」을 계측한다. 비공개 묶음 토큰이 공개 게시물로 나가면 ADR-0107 Consequences(19행)가 둔 방어선 「토큰 엔트로피 + 404 은닉」이 무의미해진다.
  - X 의 `text` 에는 `title`(`SharePanel.tsx:70`)이 실린다. 묶음 이름이 그대로 공개 문구가 된다.
  - 찜 화면은 GA 가 실리는 문서다(`App.tsx:239-240` `/favorites`). GA4 향상된 측정의 외부 링크 클릭이 켜져 있으면 X·LinkedIn 앵커의 `link_url` 에 인코딩된 토큰 주소가 실려 나간다(콘솔 설정은 레포에서 확인 불가). 앵커를 빼면 이 경로도 함께 닫힌다.
- **수정안**:
  - SharePanel 에 선택 prop `channels?: ReadonlyArray<'copy' | 'share' | 'x' | 'linkedin'>` 를 더한다. 기본값은 넷 다라 기존 호출처는 그대로다. 묶음 막대는 `['copy','share']` 로 부른다.
  - spec.md:36 과 ADR-0107 §7(16행)의 「복사·Web Share·X·LinkedIn」/「복사·채널 공유」를 「복사·Web Share」로 고친다.
  - SR-4.1 공유 막대 항목(spec.md:46)에 「묶음 막대에 X·LinkedIn 앵커 0개」를 더한다. SR-4.3 회귀 주입에 「묶음 막대에 `channels` 미전달」을 더한다.
  - usecase 차원도 같은 판정이다. 수신자가 링크를 받는 경로는 1:1 채널(Web Share → 메신저)이면 충분하고, 공개 게시는 ADR-0107 Context 「공유는 명시적일 때만」의 범위를 넘는다.

---

## implementation

E2·E3·E6 은 서로 맞물린다. 주입 셋(`CollectionSharePort`·`WishlistShareProperties`·`ShortLinkProperties`·`Clock`)은 서비스에만 있다(spec.md:21). `url`·목적지 호스트는 서비스가 만든다(spec.md:23,27). 꺼짐 분기는 세 UseCase 첫 줄이다(spec.md:28). `ShortLinkProperties` 빈은 `AutoConfiguration.imports:12` → `ShortLinkAutoConfiguration.kt:10` 으로 account 앱에도 등록된다. Jackson 3 Kotlin 모듈은 `wishlist/feature/build.gradle.kts:13` 에 있고 `NullIsSameAsDefault` 를 켠 곳이 없다(common grep 0건). 그래서 E3 의 세 상태 구분(생략·`{}` → 30, 명시 null → 만료 없음)이 성립한다.

### IMP-R3-1 · `autoPickedRef=true` 복원이 「내 주변」 상태를 전국 시도 고르기 화면으로 바꾼다

- **근거**:
  - E1(spec.md:13)의 저장 필드에는 `geo` 와 `exactFor` 가 없다. 그런데 복원하면 `autoPickedRef` 를 `true` 로 둔다.
  - 「내 주변」 검색 중 별을 누른 경우를 보자. `selectRegion` 이 시도를 비우고 `setGeo` 를 둔 상태다(`PlacePage.tsx:603`, 1174 `nearMe`). 이 상태로 복원하면 sido·keyword·geo 가 모두 빈다. `pickingRegion`(`:584`)이 참이 되고 자동 선택은 막혀(`:626`) 전국 시도 마커 화면이 된다. 원래 화면도 아니고 기본 첫 화면도 아니다. E1 전에는 자동 선택이 돌아 적어도 기본 화면으로 갔다. 그래서 이 결함은 E1 이 새로 만든 것이다.
  - `exactFor`(`:334`, 질의 `:394`)도 빠져 있다. 「원래 검색어로 검색」 상태가 보정 검색으로 돌아온다. `keywordInput`(`:331`)은 `keyword` 와 같은 값으로 채운다는 말이 없다.
- **수정안**: E1 저장 필드에 `geo{lat,lng,radiusKm}`·`exactFor` 를 더하고, 검증 문장에 「geo 의 세 값은 유한한 수, radiusKm 은 0 초과」를 더한다. 복원 문장에는 「`keywordInput` 초기값은 복원한 `keyword`」를 넣는다. 좌표를 탭 수명 저장소(10분)에 두는 것은 이미 메모리에 있는 값이라 새 노출이 아니다.

### IMP-R3-2 · 모바일에서 page>0 을 복원하면 그 쪽 30건만 남는다

- **근거**:
  - 모바일 목록은 누적분이다(`PlacePage.tsx:525`). 누적은 `mergePages(prev, incoming, page)`(`placeView.ts:25-29`)가 하고, 첫 마운트의 `prev` 는 빈 배열이다(`:493-496`). page=3 으로 복원하면 0~2쪽은 없고 3쪽만 그린다.
  - 지도도 맞춰지지 않는다. `if (!isMobile || page === 0) map.fitBounds(...)`(`:933`)라 기본 중심 `{36.5,127.8}`(`:762`)에 머문다. 사용자가 별을 누른 카드는 화면에 있지만, 그 앞 목록과 지도는 원래 모습이 아니다.
- **수정안**: E1 복원 문장에 「모바일(`MOBILE_QUERY`)이면 page 를 0 으로 복원한다(누적 목록은 0쪽부터 다시 쌓인다). 선택 관광지 id 가 첫 쪽에 없으면 선택만 버린다」를 더한다. 데스크톱은 쪽 단위 화면이라 지금 문장 그대로 둔다.

### IMP-R3-3 · 「꺼지면 다섯 경로 모두 404(400 아님)」는 범위 검사 자리가 정해져야 성립한다

- **근거**:
  - spec.md:28 은 꺼짐 상태에서 다섯 경로 모두 404 라고 한다. 그런데 spec.md:23(E3)은 1~365 범위 위반을 `BusinessException(INVALID_INPUT)` 400 이라고만 하고, 어디서 검사하는지는 정하지 않았다. 레포 선례는 `@Valid` + Bean Validation 이다(`SellerAdminController.kt:94` `@Valid @RequestBody(required = false)`). 구현자가 DTO 에 `@Min(1) @Max(365)` 를 달면 서비스 첫 줄의 꺼짐 분기보다 먼저 400 이 난다. 꺼짐 상태에서 `{"expiresInDays":0}` 가 400 이 된다.
  - 같은 이유로 꺼짐 상태에서도 경로 변수 타입 불일치(`/collections/abc/share`)와 깨진 JSON 은 서비스에 닿기 전에 400 이 된다(`GlobalExceptionHandler.kt:64`).
- **수정안**: spec.md:23 에 「범위 검사는 서비스가 꺼짐 분기 다음 줄에서 한다. DTO 에 Bean Validation 애너테이션·`@Valid` 를 달지 않는다」를 넣는다. spec.md:28 의 「다섯 경로 모두 404」 뒤에는 「형식이 맞는 요청 기준. 경로 변수 타입 불일치·깨진 JSON 은 설정과 무관하게 400」을 덧붙인다. 그러면 E11 테스트가 무엇을 404 로 단언하는지도 분명해진다.

---

## test-strategy

E10~E14 는 반영됐다. 회귀 주입 목록(spec.md:56)과 단언(spec.md:46,50,51,54)도 짝이 맞는다. 단 아래 셋은 「주입했는데 초록」이 되거나 단언 근거가 흔들리는 자리다.

### TS-R3-1 · 기본 origin 으로 테스트하면 「url 호스트를 리터럴로」 주입이 빨강을 내지 않는다

- **근거**: spec.md:56 은 회귀 주입으로 「`url` 호스트를 리터럴로」를 요구한다. 그런데 spec.md:50·54 의 단언은 `ShortLinkProperties.origin + "/c/" + token` 과 `… + "/shared/invalid"` 다. 테스트가 `ShortLinkProperties()` 기본값을 쓰면 origin 은 `"https://1989v.com"`(`ShortLinkProperties.kt:15`)이다. 리터럴 `"https://1989v.com"` 으로 바꿔도 값이 같아 초록이다. 검사가 대상이 아니라 자기 사본을 재는 모양이다.
- **수정안**: spec.md:50·54 에 「테스트의 `ShortLinkProperties` 는 운영값과 다른 origin(예: `https://short.test`)으로 만든다」를 넣는다. `/c` 의 `Location` 도 같은 값으로 단언한다.

### TS-R3-2 · `WebApplicationContextRunner` 검사는 컨트롤러를 등록하는 방법을 고정해야 빨강이 보장된다

- **근거**: spec.md:51 은 「두 공유 컨트롤러와 의존 빈(mockk)을 등록해」라고만 한다. `@ConditionalOnProperty` 는 `withUserConfiguration(…)` 경로(AnnotatedBeanDefinitionReader)에서는 등록 시점에 평가된다. 반면 공급자 기반 `withBean(type, supplier)` 은 컨텍스트 구현에 따라 조건 평가를 건너뛸 수 있다. 컨트롤러를 후자로 넣으면 spec.md:56 의 「`@ConditionalOnProperty` 추가」 주입이 초록으로 남을 수 있다.
- **수정안**: spec.md:51 문장을 바꾼다. 「컨트롤러 둘은 `withUserConfiguration(CollectionShareController::class.java, SharedCollectionController::class.java)` 로, UseCase 셋은 `withBean(…) { mockk() }` 로 넣는다. `@ConditionalOnProperty(prefix="kgd.wishlist.share", name=["enabled"], havingValue="true")` 를 주입해 빨강이 나는지 본 실행 기록을 남긴다」.

### TS-R3-3 · 단언이 엉뚱한 이유로 통과하거나 실패하지 않게 할 입력 세부 셋

- **근거와 수정안**:
  1. **소유자 경로의 헤더**: 꺼짐 테스트(spec.md:51)의 소유자 경로 셋에 `X-User-Id` 가 없으면 필수 헤더 누락 400 이 404 를 가린다. 「소유자 경로는 `X-User-Id: 1` 을 붙여 보낸다」를 넣는다.
  2. **역직렬화 경로**: E10 의 세 상태 구분은 역직렬화 층에서 갈린다(spec.md:50). 선례 `SellerControllerTest.kt:48` 처럼 `.setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))` 로 운영과 같은 Kotlin 모듈 매퍼를 쓴다고 적는다. 기본 변환기로 통과한 결과는 운영 동작의 증거가 아니다.
  3. **인코딩된 입력**: `/c/%2F%2Fevil.com`(spec.md:54)을 `get(String)` 으로 보내면 템플릿 인코딩이 `%` 를 `%25` 로 다시 바꾼다. 그러면 요청 경로가 `/c/%252F%252Fevil.com` 이 된다. 결과 단언은 그대로 맞지만 의도한 입력이 아니다. `get(URI.create("/c/%2F%2Fevil.com"))` 로 보낸다고 적는다.

---

## usecase (축소)

- E6 탭 조건(spec.md:28)은 실제 칩 모양과 맞는다. 칩은 `{kind:'one', id}`(`FavoriteCollections.tsx:67`)이고, 전체·미분류(`:65-66`)에는 id 가 없다. E9(spec.md:46)의 「전체·미분류에서 `GET …/share` 0건」과 「만들기 track 0 · 이은 복사 track 1」도 E6·E8 과 모순이 없다.
- J11 은 SEC-R3-2 와 같이 판정했다(복사·Web Share 만). 이 편집이 들어가야 해서 판정은 REVISE 다.

## domain (축소)

- E8(spec.md:36)·A2(ADR:16)와 SR-3.5(spec.md:39)는 모순이 없다. 중복 키는 `viewId|entityType|entityId|sectionId|action` 이다(`tracker.ts:27`). 생성이 이벤트를 내지 않으니 첫 복사는 늘 남는다. viewId 를 칩마다 새로 만드니 묶음 사이 충돌도 없다. 남는 유실은 같은 view 의 두 번째 채널뿐이고, J5 가 받아들인 범위 그대로다.
- J11 을 채택하면 E8·A2 의 채널 목록 문구만 바꾸면 된다(SEC-R3-2 편집에 포함).

## architecture (축소)

- E2(spec.md:21) 대로면 레이어 게이트 ⑤ 를 통과한다. 두 컨트롤러가 주입하는 타입은 `application/share/usecase/*` 셋뿐이고, 셋 다 `.usecase.` 에 해당한다(`build.gradle.kts:291,439`). `ShortLinkRedirects` 는 object 라 주입이 아니다(`ShortLinkRedirects.kt:11`).
- `WishlistShareProperties` 는 `.config.` 다. infrastructure → application config 방향이라 ⑥ 에도 걸리지 않는다. common import 는 ⑦ 의 `ownRoots + "common"`(`build.gradle.kts:369`)으로 허용된다.

---

## 발견 요약

| ID | 차원 | 한 줄 | 수정 자리 |
|---|---|---|---|
| SEC-R3-1 | security | J10: next 쿼리 외에 같은 출처 리퍼러로도 토큰이 `/login` 의 GA 로 감 | spec.md:29·59, ADR:19 |
| SEC-R3-2 | security·usecase | J11: 묶음 막대에서 X·LinkedIn 제거(공개 게시·이름 노출·외부 링크 클릭 계측) | SharePanel `channels`, spec.md:36·46·56, ADR:16 |
| IMP-R3-1 | implementation | 복원 + `autoPickedRef=true` 가 「내 주변」 상태를 전국 시도 고르기로 바꿈. geo·exactFor 미저장 | spec.md:13 |
| IMP-R3-2 | implementation | 모바일 page>0 복원이 그 쪽 30건만 그리고 지도는 기본 중심 | spec.md:13 |
| IMP-R3-3 | implementation | 범위 검사 자리 미정. Bean Validation 이면 꺼짐 상태에서 400 | spec.md:23·28 |
| TS-R3-1 | test-strategy | 기본 origin 이면 「호스트 리터럴」 주입이 초록 | spec.md:50·54 |
| TS-R3-2 | test-strategy | ContextRunner 등록 방법 미고정. `withBean` 이면 조건 주입이 초록일 수 있음 | spec.md:51 |
| TS-R3-3 | test-strategy | 헤더 누락 400 · 매퍼 불일치 · `%25` 재인코딩 | spec.md:50·51·54 |

VERDICT: REVISE
