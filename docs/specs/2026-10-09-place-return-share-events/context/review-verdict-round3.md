# 3라운드(마지막) 판정: 8건 모두 유지

8건 모두 인용한 `file:line` 을 직접 열어 확인했고, 반증할 증거는 하나도 없었습니다. BLOCK 은 없고 8건 모두 REVISE 입니다.

## 묶음 표

| ID | 판정 | 등급 | 한 줄 |
|---|---|---|---|
| SEC-R3-1 (J10) | 유지 | REVISE | 토큰이 `/login` 의 GA 로 새는 경로가 둘이다. `next` 쿼리와 같은 출처 리퍼러다 |
| SEC-R3-2 (J11) | 유지 | REVISE | 묶음 막대에서 X·LinkedIn 을 뺀다 |
| IMP-R3-1 | 유지 | REVISE | geo·exactFor 를 저장하지 않는다. 복원할 때 `autoPickedRef=true` 라 시도 고르기 화면이 된다 |
| IMP-R3-2 | 유지 | REVISE | 모바일에서 page>0 을 복원하면 그 쪽만 그린다 |
| IMP-R3-3 | 유지 | REVISE | 범위 검사를 어디서 할지 정하지 않았다. `@Valid` 를 달면 꺼짐 상태에서 400 이 난다 |
| TS-R3-1 | 유지 | REVISE | 기본 origin 이면 「호스트 리터럴」 주입이 초록으로 남는다 |
| TS-R3-2 | 유지 | REVISE | ContextRunner 에 컨트롤러를 등록하는 방법을 고정하지 않았다 |
| TS-R3-3 | 유지 | REVISE | 헤더 누락 · 매퍼 · `%25` 재인코딩 |

참고로 spec 이 인용한 PlacePage 줄 번호는 워크트리 **HEAD 커밋본** 기준입니다. 워킹트리의 `PlacePage.tsx` 에는 다른 스펙(mobile-perf)의 미커밋 변경이 있어 줄 번호가 밀려 있습니다. 판정은 `git show HEAD:` 기준으로 했습니다.

## 발견별 JSON

```json
[
  { "id": "SEC-R3-1", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/auth/auth.ts", "line": 124, "quote": "const target = next ?? window.location.href;" },
      { "file": "portal-fe/src/components/favorite/FavoriteButton.tsx", "line": 78, "quote": "window.location.href = buildLoginHref();" },
      { "file": "portal-fe/index.html", "line": 20, "quote": "if (host.split(\".\")[0] === \"resume\") return;  (호스트만 보고 GA 적재)" },
      { "file": "(grep) portal-fe/index.html·src·nginx.conf·k8s·gateway", "line": 0, "quote": "Referrer-Policy 설정 0건 (atlas 설명 JSON 한 건만 걸림)" },
      { "file": "portal-fe/src/pages/LoginPage.tsx", "line": 12, "quote": "sessionStorage.setItem(LOGIN_NEXT_KEY, next);" }
    ],
    "reason": "next 쿼리와 같은 출처 리퍼러로 토큰이 GA 에 가는 두 경로가 모두 코드에서 확인되고 반증이 없어 유지한다." },
  { "id": "SEC-R3-2", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/components/share/SharePanel.tsx", "line": 70, "quote": "href={`https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}`}" },
      { "file": "portal-fe/src/components/share/SharePanel.tsx", "line": 79, "quote": "href={`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`}" },
      { "file": "docs/specs/2026-10-09-place-return-share-events/spec.md", "line": 36, "quote": "묶음 공유는 SharePanel 의 복사·Web Share·X·LinkedIn 만 보낸다." }
    ],
    "reason": "SharePanel 은 X·LinkedIn 을 조건 없이 그리고 X 의 text 에 title 을 싣는다. 스펙이 이를 그대로 재사용·계측하므로 유지한다." },
  { "id": "IMP-R3-1", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/pages/place/PlacePage.tsx(HEAD)", "line": 584, "quote": "const pickingRegion = hasRegionAxis && !sidoCode && !keyword && !geo;" },
      { "file": "portal-fe/src/pages/place/PlacePage.tsx(HEAD)", "line": 626, "quote": "if (autoPickedRef.current || !hasRegionAxis || sidoCode || keyword || geo) return;" },
      { "file": "portal-fe/src/pages/place/PlacePage.tsx(HEAD)", "line": 334, "quote": "const [exactFor, setExactFor] = useState<string | null>(null);" },
      { "file": "docs/specs/2026-10-09-place-return-share-events/spec.md", "line": 13, "quote": "{검색어·분류·속성·지역 3단계(areaCode·sidoCode·sigunguCode)·행사 상태·선택 관광지 id·page·createdAt}" }
    ],
    "reason": "저장 필드에 geo·exactFor 가 없어 복원이 원래 화면을 만들지 못한다. 리뷰어가 든 경로(selectRegion 이 geo 를 둔다)는 틀렸으나 결론은 다른 경로로 성립해 유지한다(:603 은 setGeo(null), 실제 경로는 :683 시도 해제 뒤 제안·「이 지역 검색」)." },
  { "id": "IMP-R3-2", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/pages/place/PlacePage.tsx(HEAD)", "line": 495, "quote": "const prev = store.key === baseKey ? store.items : [];" },
      { "file": "portal-fe/src/pages/place/placeView.ts", "line": 25, "quote": "if (page === 0) return incoming; … return fresh.length === 0 ? prev : [...prev, ...fresh];" },
      { "file": "portal-fe/src/pages/place/PlacePage.tsx(HEAD)", "line": 933, "quote": "if (!isMobile || page === 0) {" }
    ],
    "reason": "첫 마운트의 prev 가 빈 배열이고 모바일 page>0 에서는 fitBounds 를 건너뛴다. 코드 그대로라 유지한다." },
  { "id": "IMP-R3-3", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "seller/feature/.../SellerAdminController.kt", "line": 94, "quote": "@Valid @RequestBody(required = false) request: ReactivateSellerRequest?," },
      { "file": "wishlist/feature/build.gradle.kts", "line": 18, "quote": "implementation(libs.spring.boot.starter.validation)" },
      { "file": "common/.../GlobalExceptionHandler.kt", "line": 64, "quote": "@ExceptionHandler(HttpMessageNotReadableException::class) … badRequest()" },
      { "file": "docs/specs/2026-10-09-place-return-share-events/spec.md", "line": 23, "quote": "1~365 밖은 `BusinessException(INVALID_INPUT)` 400 이다." }
    ],
    "reason": "wishlist 에 validation 의존성이 있고 `@Valid` 선례가 있어, 검사 자리를 정하지 않으면 「꺼짐=404」가 깨질 수 있다. 유지한다." },
  { "id": "TS-R3-1", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "common/src/main/kotlin/com/kgd/common/shortlink/ShortLinkProperties.kt", "line": 15, "quote": "val origin: String = \"https://1989v.com\"," },
      { "file": "docs/specs/2026-10-09-place-return-share-events/spec.md", "line": 56, "quote": "`url` 호스트를 리터럴로" }
    ],
    "reason": "기본값과 리터럴이 같아 주입한 회귀가 초록으로 남는다. 검사가 자기 사본을 재는 모양이라 유지한다." },
  { "id": "TS-R3-2", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-return-share-events/spec.md", "line": 51, "quote": "두 공유 컨트롤러와 의존 빈(mockk)을 등록해, 두 컨트롤러 빈이 존재하는지 본다" },
      { "file": "commerce/app/src/test/kotlin/com/kgd/commerce/payment/PaymentPgSelectionSpec.kt", "line": 52, "quote": ".withUserConfiguration(TossPgConfig::class.java, MockPgConfig::class.java, WebhookProbe::class.java)" }
    ],
    "reason": "등록 방법을 정하지 않으면 조건 주입이 빨강을 낸다는 보장이 없다. 조건부 빈을 withUserConfiguration 으로 넣는 레포 선례도 있어 유지한다(withBean 이 조건을 건너뛰는지는 반증하지 못했으므로 애매하면 유지)." },
  { "id": "TS-R3-3", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "wishlist/feature/.../WishlistController.kt", "line": 42, "quote": "@RequestHeader(\"X-User-Id\") userId: String," },
      { "file": "seller/feature/src/test/.../SellerControllerTest.kt", "line": 48, "quote": ".setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))" },
      { "file": "docs/specs/2026-10-09-place-return-share-events/spec.md", "line": 54, "quote": "`/c/%2F%2Fevil.com` 은 `Location` 이 정확히 …" }
    ],
    "reason": "필수 헤더, 매퍼 선례, MockMvc 템플릿 인코딩 셋 모두 단언이 엉뚱한 이유로 통과·실패하게 만들 수 있어 유지한다." }
]
```

## spec.md 편집 목록

**R1 · SR-1.2 (13행) 저장 필드 교체** (IMP-R3-1)
- 바꿀 문구: `{검색어·분류·속성·지역 3단계(areaCode·sidoCode·sigunguCode)·행사 상태·선택 관광지 id·page·createdAt}`
- 새 문구:
```text
{검색어·exactFor·분류·속성·지역 3단계(areaCode·sidoCode·sigunguCode)·geo{lat,lng,radiusKm}·행사 상태·선택 관광지 id·page·createdAt}
```

**R2 · SR-1.2 (13행) 「각 상태의 `useState` 초기값을 `restored` 에서 읽는다.」 바로 뒤에 추가** (IMP-R3-1, IMP-R3-2)
```text
keywordInput 초기값은 복원한 keyword 다. 모바일(window.matchMedia(MOBILE_QUERY).matches)이면 page 는 0 으로 복원한다. 모바일 목록은 0쪽부터 누적되고 지도 맞춤도 0쪽에서만 돌기 때문이다. 이때 선택 관광지 id 가 첫 쪽 결과에 없으면 선택만 버린다. 데스크톱은 저장한 page 그대로 복원한다.
```

**R3 · SR-1.2 (13행) 「지역 코드·관광지 id 는 숫자 문자열, page 는 0 이상 정수여야 한다.」 바로 뒤에 추가** (IMP-R3-1)
```text
geo 는 없거나, lat·lng·radiusKm 셋이 모두 유한한 수이고 radiusKm 이 0 초과여야 한다. exactFor 는 없거나 문자열이어야 한다.
```

**R4 · SR-2.4 (23행) 「1~365 밖은 `BusinessException(INVALID_INPUT)` 400 이다.」 바로 뒤에 추가** (IMP-R3-3)
```text
범위 검사는 서비스가 꺼짐 분기 다음 줄에서 한다. DTO 에 Bean Validation 애너테이션과 @Valid 를 달지 않는다. 달면 꺼짐 분기보다 먼저 400 이 난다.
```

**R5 · SR-2.9 (28행) 「꺼지면 소유자 3 + 공개 1 + `/c` 다섯 경로가 모두 404 다(405·400 아님).」 바로 뒤에 추가** (IMP-R3-3)
```text
형식이 맞는 요청 기준이다. 경로 변수 타입 불일치(/collections/abc/share)와 깨진 JSON 은 서비스에 닿기 전에 걸리므로 설정과 무관하게 400 이다.
```

**R6 · SR-2.9 (28행) 문장 교체** (SEC-R3-2)
- 바꿀 문장: `` `200 link` 면 복사(SharePanel 재사용)·폐기를 보인다. ``
- 새 문장:
```text
200 link 면 복사·Web Share(SharePanel 을 channels={['copy','share']} 로 재사용)·폐기를 보인다. 묶음 막대에는 X·LinkedIn 공개 게시 링크를 두지 않는다.
```

**R7 · SR-2.10 (29행) 문장 교체** (SEC-R3-1)
- 바꿀 문장: `` `portal-fe/index.html` 의 GA 로더는 `location.pathname` 이 `/shared/` 로 시작하면 싣지 않는다. ``
- 새 문장:
```text
portal-fe/index.html 의 GA 로더는 다음 셋 중 하나면 싣지 않는다. ① location.pathname 이 /shared/ 로 시작한다. ② location.search 에 %2Fshared%2F 가 있다(대소문자 무시). ③ document.referrer 의 경로가 /shared/ 로 시작한다. 앱 안에서 /shared/ 로 가는 SPA 링크는 두지 않는다. GA 가 이미 실린 문서에서는 history page_view 가 토큰 경로를 보내기 때문이다.
```
뒤에 이어지는 「자리는 resume 호스트 제외(`index.html:20`) 바로 다음 줄이다.」와 「토큰이 `page_location` 으로…」는 그대로 둡니다.

**R8 · SR-3.2 (36행) 문장 교체 두 곳** (SEC-R3-2)
- 바꿀 문장: `묶음 공유는 SharePanel 의 복사·Web Share·X·LinkedIn 만 보낸다.`
- 새 문장:
```text
묶음 공유는 SharePanel 의 복사·Web Share 만 보낸다(묶음 막대에는 X·LinkedIn 이 없다).
```
- 바꿀 문장: `` SharePanel 에 선택적 `onShare(channel)` 콜백을 더한다. ``
- 새 문장:
```text
SharePanel 에 선택적 onShare(channel) 콜백과 선택 prop channels?: ReadonlyArray<'copy' | 'share' | 'x' | 'linkedin'> 를 더한다. channels 기본값은 넷 다라 기존 호출처는 바뀌지 않는다.
```

**R9 · SR-4.1 넷째 항목 (46행) 끝에 추가** (SEC-R3-2)
```text
묶음 막대에는 X·LinkedIn 앵커가 0개다.
```

**R10 · SR-4.2 컨트롤러 항목 (50행) 끝에 추가** (TS-R3-1, TS-R3-3)
```text
테스트의 ShortLinkProperties 는 운영 기본값과 다른 origin 으로 만든다(예: ShortLinkProperties(origin = "https://short.test")). MockMvc 는 .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build())) 로 운영과 같은 Kotlin 모듈 매퍼를 쓴다(선례 SellerControllerTest.kt:48). 기본 변환기로 통과한 결과는 운영 동작의 증거가 아니다.
```

**R11 · SR-4.2 설정 꺼짐 항목 (51행) 문장 교체 + 추가** (TS-R3-2, TS-R3-3)
- 바꿀 문장: `` 별도로 `WebApplicationContextRunner().withPropertyValues("kgd.wishlist.share.enabled=false")` 에 두 공유 컨트롤러와 의존 빈(mockk)을 등록해, 두 컨트롤러 빈이 존재하는지 본다(`@ConditionalOnProperty` 회귀 감지). ``
- 새 문장:
```text
별도로 WebApplicationContextRunner().withPropertyValues("kgd.wishlist.share.enabled=false") 에서 컨트롤러 둘은 withUserConfiguration(CollectionShareController::class.java, SharedCollectionController::class.java) 로 넣고(선례 PaymentPgSelectionSpec.kt:52), UseCase 셋은 withBean(…) { mockk() } 로 넣어 두 컨트롤러 빈이 존재하는지 본다. @ConditionalOnProperty(prefix = "kgd.wishlist.share", name = ["enabled"], havingValue = "true") 를 주입해 빨강이 나는 실행 기록을 남긴다.
```
- 같은 항목 끝에 추가:
```text
소유자 경로 셋은 X-User-Id: 1 을 붙여 보낸다. 필수 헤더 누락 400 이 404 를 가리지 않게 하려는 것이다. 이 MockMvc 도 R10 과 같은 메시지 변환기를 쓴다.
```

**R12 · SR-4.2 `/c` 항목 (54행) 끝에 추가** (TS-R3-1, TS-R3-3)
```text
이 검사도 운영값이 아닌 origin 으로 만든 ShortLinkProperties 로 Location 을 단언한다. 인코딩된 입력은 get(URI.create("/c/%2F%2Fevil.com")) 로 보낸다. get(String) 은 % 를 %25 로 다시 인코딩한다.
```

**R13 · SR-4.3 (56행) 회귀 주입 목록에 추가** (SEC-R3-2)
- 「허브 별에 `onBeforeLogin` 미전달」 바로 뒤에 넣습니다.
```text
 · 묶음 막대에 channels 미전달
```

**R14 · SR-4.4 (59행) 항목 교체** (SEC-R3-1)
- 바꿀 문장: `` 설정과 무관하게 `https://1989v.com/shared/x` 를 CDP 로 열어 `googletagmanager.com` 요청이 0건인지 본다. 대조군으로 `https://1989v.com/` 은 1건 이상이어야 한다. ``
- 새 문장:
```text
설정과 무관하게 CDP 로 세 경우의 googletagmanager.com 요청이 0건인지 본다. ① https://1989v.com/shared/x 를 연다. ② https://1989v.com/login?next=https%3A%2F%2F1989v.com%2Fshared%2Fx 를 직접 연다. ③ /shared/x 에서 별을 눌러 /login 으로 이동한다. 대조군으로 https://1989v.com/ 은 1건 이상이어야 한다.
```

**R15 · Existing Code (65행) 목록에 추가**
```text
placeView.ts:25-29, SellerControllerTest.kt:48, PaymentPgSelectionSpec.kt:52, SellerAdminController.kt:94, GlobalExceptionHandler.kt:64
```

## ADR-0107 편집 목록

**B1 · §7 (16행) 교체 + 추가** (SEC-R3-2)
- 바꿀 문구: `묶음 공유 링크의 복사·채널 공유는`
- 새 문구:
```text
묶음 공유 링크의 복사·Web Share 는
```
- §7 끝에 추가:
```text
묶음 막대에는 X·LinkedIn 공개 게시 링크를 두지 않는다. 비공개 묶음 토큰과 묶음 이름이 공개 게시물이 되면 토큰 엔트로피와 404 은닉이라는 방어선이 무의미해진다. 수신자에게 넘기는 경로는 1:1 채널(복사·Web Share)로 충분하다.
```

**B2 · Consequences 첫 항목 (19행) 문장 교체** (SEC-R3-1)
- 바꿀 문장: `` 수신 화면 `/shared/` 에서는 GA 를 싣지 않는다(resume 호스트를 뺀 것과 같은 이유). ``
- 새 문장:
```text
수신 화면 /shared/ 에서는 GA 를 싣지 않는다. 그 토큰을 쿼리(로그인 next)나 같은 출처 리퍼러로 들고 온 문서(로그인 화면)에서도 싣지 않는다(resume 호스트를 뺀 것과 같은 이유).
```

## 사용자 판단 항목

| # | 질문 | 권고 기본값(편집에 반영함) | 근거 |
|---|---|---|---|
| J10 | 토큰이 `/login` 의 GA 로 가는 경로를 어떻게 막을까 | **GA 로더 조건을 셋으로 넓힌다**: 경로 `/shared/`, 쿼리 `%2Fshared%2F`, 리퍼러 경로 `/shared/` (R7·R14·B2) | 쿼리만 막으면 같은 출처 리퍼러 경로가 남습니다. 레포에 `Referrer-Policy` 가 없어 브라우저 기본값이 전체 URL 을 보냅니다. 대신 `/shared/` 에서 바로 들어간 첫 화면 하나는 GA 집계에서 빠집니다. |
| J11 | 묶음 공유에 X·LinkedIn 버튼을 둘까 | **두지 않는다.** SharePanel `channels` prop 으로 복사·Web Share 만 둔다 (R6·R8·R9·R13·B1) | 비공개 토큰과 묶음 이름이 공개 게시물이 됩니다. 기본값이 넷 다라 기존 호출처는 바뀌지 않습니다. |

이번 판정과 별개로 남겨 둘 것이 셋 있습니다.
- **IMP-R3-1 근거의 오류**: 리뷰어는 「selectRegion 이 시도를 비우고 geo 를 둔다」고 썼지만 실제로는 반대로 `setGeo(null)` 합니다(HEAD `:603`). 결함 자체는 시도 해제(`:683`) 뒤 검색 제안이나 「이 지역 검색」으로 geo 만 남는 경로로 성립합니다.
- **SEC-R3-1 대안**: `/shared/` 화면에서만 `<meta name="referrer" content="origin">` 을 두는 방법도 있습니다. 권고안에는 넣지 않았습니다.
- **J10 의 집계 손실**: 리퍼러 조건 때문에 수신 화면에서 다른 apex 화면으로 넘어간 첫 문서도 GA 에서 빠집니다.

SUMMARY: keep 8 / demote 0 / dismiss 0
NOTES: IMP-R3-1 근거 경로가 틀렸지만 결론은 성립한다. J10 리퍼러 조건으로 `/shared/` 에서 다른 apex 화면으로 간 첫 문서도 GA 에서 빠진다.

판정에 쓴 파일:
- /private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-09-place-return-share-events/spec.md
- /private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/adr/ADR-0107-wishlist-collection-share-links.md
- /private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-09-place-return-share-events/context/engineer-review-round3.md
- /private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/verdict/pp-wthead.tsx (HEAD 커밋본 PlacePage 를 꺼낸 사본, 판정용)