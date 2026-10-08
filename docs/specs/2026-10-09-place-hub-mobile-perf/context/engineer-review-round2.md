# Engineer Review — 2라운드 (place 모바일 허브 변형 + 성능)

대상: `docs/specs/2026-10-09-place-hub-mobile-perf/spec.md` (심판 편집 E-1~E-10 반영본). 1라운드에서 판정된 33건은 다시 열지 않았다. 아래 발견은 모두 이번 개정에서 새로 생겼거나 개정문이 놓친 것이다.

| 차원 | 판정 | 새 이슈 |
|---|---|---|
| implementation | REVISE | 4 |
| test-strategy | REVISE | 4 |
| usecase | REVISE | 2 |
| architecture | SHIP | 0 (반영 확인) |
| security | SHIP | 0 (반영 확인, 적용 지점 누락 1건은 I2-1 로 처리) |
| domain | SHIP | 0 (반영 확인) |

## implementation — REVISE

**I2-1 「적용 지점(전부)」에 통합 검색 썸네일이 빠졌다** (체크 2: 기존 코드와 충돌 없음)
- 스펙: `spec.md:50` 의 「적용 지점(전부)」 목록에 `UnifiedSearchPage` 가 없다.
- 코드: `search/app/.../unified/service/SearchUnifiedService.kt:75` `thumbnailUrl = it.thumbnailUrl ?: it.imageUrl` 로 관광지 원천 주소가 통합 검색 hit 에 실리고, `portal-fe/src/pages/search/UnifiedSearchPage.tsx:227` `<img className="usearch-thumb" src={hit.thumbnailUrl} …>` 가 그대로 출력한다.
- 수정안: 목록에 `UnifiedSearchPage.tsx:227` 을 더한다. hit 은 관광지 외 유형(블로그·게임)도 섞이지만 규칙이 tong 앞부분 일치라 다른 호스트는 그대로 지나가므로 무조건 적용해도 된다.

**I2-2 preconnect 를 둘 「place 셸 head」가 존재하지 않는다** (체크 1: 참조 대상 존재)
- 스펙: `spec.md:47` 「`<link rel="preconnect">` 를 place 셸 head 에 하나 둔다」.
- 코드: place 전용 셸은 없다. 모든 호스트가 `index.html` 하나를 틀로 쓰고(`prerender-seo.mjs:166`), 허브는 `renderPlaceHubs` 의 `compose(shell, …)`(`:1117`), 상세는 Kotlin SSR(`AttractionPageRenderer.kt:68`)이 head 를 만든다. `index.html` 에 넣으면 전 호스트의 head·프리렌더 산출물이 바뀐다(SR-4.4 의 「다른 산출물 바이트 동일」 정신과도 어긋난다).
- 수정안: 위치를 하나로 정한다. 측정 대상이 허브 LCP 이므로 「`renderPlaceHubs` 의 head(=`_hosts/place.1989v.com*.html`)에만 넣고, 다른 프리렌더 산출물은 바이트가 같아야 한다」로 적고, SPA 폴백·상세 SSR 에는 넣지 않는다고 명시한다.

**I2-3 지도 키가 없을 때 오버레이 칩이 돌아올 수 없는 상태로 보낸다** (체크 3: 복잡도 위험)
- 스펙: `spec.md:22` 「`hasMapKey` 가 false 면 버튼을 그리지 않는다」 + `spec.md:25` 「오버레이 칩 … 목록 상태에서 누르면 … 지도 상태로 전환」.
- 코드: 오버레이 칩은 `hasMapKey` 와 무관하게 그려진다(`PlacePage.tsx:1364-1370`). 키가 없으면 지도 자리는 placeholder 다(`:1619-1620`).
- 결과: 키 없는 환경에서 칩을 누르면 지도 상태(placeholder)로 넘어가고 「목록 보기」 버튼은 그려지지 않아 목록으로 돌아올 방법이 없다.
- 수정안: SR-1.6 첫 항목에 「`hasMapKey` 가 false 면 전환하지 않는다(오버레이 칩도 지금처럼 동작만 하고 상태는 목록 그대로)」 또는 「키가 없으면 오버레이 칩을 그리지 않는다」 중 하나를 적는다.

**I2-4 지도 상태 진입 fitBounds 가 「이 지역 검색」 버튼을 바로 띄운다** (체크 2)
- 스펙: `spec.md:23` 「지도 상태로 들어간 직후 현재 결과로 fitBounds 를 한 번 다시 하고(idle 뒤 SIDO 줌 상한 규칙 유지)」.
- 코드: `zoom_changed` 가 `setMapMoved(true)` 를 부르고(`PlacePage.tsx:769`), 기존 fitBounds 는 idle 에서 `setMapMoved(false)` 로 되돌린다(`:934-939`). 스펙은 이 리셋을 적지 않았다.
- 수정안: 「idle 뒤 SIDO 줌 상한과 `mapMoved` 리셋을 기존 `:932-940` 과 같이 한다」로 바꾼다. 아울러 기존 마커 effect 의 `!isMobile || page === 0` 분기(`:932`)가 첫 진입 시 page>0 이면 fit 하지 않으므로, 진입 fit 은 그 분기와 별개라는 것도 한 줄 적는다.

## test-strategy — REVISE

**T2-1 `.place-card-img` 셀렉터가 사진 없는 카드의 div 까지 잡는다** (체크 3·5)
- 스펙: `spec.md:68` 「모든 `.place-card-img` 에 width·height」.
- 코드: 사진이 없으면 `<div className="place-card-img place-card-img-empty" aria-hidden />`(`PlacePage.tsx:1800`). 이 div 에는 width·height 속성이 없으니 단언이 빨갛거나, 구현자가 div 에 속성을 붙여 맞추게 된다.
- 수정안: `img.place-card-img` 로 좁힌다. 같은 이유로 「eager 정확히 2개」는 픽스처의 앞 두 카드에 사진이 있어야 성립한다 — 기존 `item()` 픽스처는 `imageUrl: null`(`PlacePage.test.tsx:45`)이라 사진 있는 카드 3장 이상 픽스처를 쓴다고 적고, 첫 카드에 사진이 없을 때 eager 를 「카드 순번 0·1」로 줄지 「사진 있는 앞 2장」으로 줄지도 SR-4.1 에 정한다.

**T2-2 `[data-src^="http://tong."]` 0개 단언이 저절로 통과한다** (체크 5)
- 스펙: `spec.md:70` 렌더 단위 단언에 `[data-src^=…]` 0개.
- 코드: 허브에서 `data-src` 는 「뽑기」 시트를 열었을 때만 그려진다(`PlacePage.tsx:1284-1290`). 시트를 열지 않는 테스트에서는 치환을 지워도 0개다.
- 수정안: 허브 렌더 단위 테스트에서 「뽑기」를 눌러 `PickSheet` 를 연 뒤 data-src 를 단언한다고 적는다. SR-5.3 회귀 주입에 「InfoWindow(뽑기) 호출부에서 `secureImageUrl` 제거 → 빨강」을 더한다.

**T2-3 「폭 전환(matchMedia 변경)」을 기존 목으로는 일으킬 수 없다** (체크 3)
- 스펙: `spec.md:59-60` 폭 전환 뒤 `loadGoogleMaps` 재호출 없음.
- 코드: 기존 목은 `addEventListener: vi.fn()` 이고 호출마다 새 객체에 `matches` 를 고정한다(`PlacePage.test.tsx:66-71`). `useMediaQuery` 는 같은 객체의 `mql.matches` 를 change 이벤트로 다시 읽는다(`useMediaQuery.ts:12-15`) — 리스너를 보관하지 않으면 변경을 흘릴 수 없다.
- 수정안: SR-5.1 목 경계에 「쿼리별로 하나의 mql 객체를 돌려주고, `matches` 를 바꾼 뒤 보관한 change 리스너를 `act()` 안에서 호출한다」를 더한다.

**T2-4 새 패리티 골든 파일이 CI 검사에 걸리지 않는다** (체크 4)
- 스펙: `spec.md:73` 「`secure-image-golden.json` … (선례 … CI 의 git diff 검사)」.
- 코드: CI 는 파일별로 검사한다 — `.github/workflows/ci.yml:305` jsonld, `:311-312` footer. 새 파일은 목록에 없고, 아직 추적되지 않은 파일에는 `git diff --exit-code` 가 0 을 낸다.
- 수정안: `ci.yml` 에 `secure-image-golden.json` 단계를 footer 선례(`:311-312`)처럼 `git diff --exit-code` + `git status --porcelain` 두 줄로 더한다고 SR-5.2 에 적는다(태스크 목표로 정당화되는 CI 변경).

## usecase — REVISE

**U2-1 「폴드 안 카드」 정의가 하단 고정 버튼을 빼지 않는다** (체크 4: AC 추적성)
- 스펙: `spec.md:44` 「top ≥ 0 이고 bottom ≤ 664 인 .place-card 의 수」 + `spec.md:22` listFirst 목록 상태의 「화면 하단 고정 버튼」.
- 문제: 고정 버튼이 가린 카드도 rect 기준으로는 「완전히 보임」으로 세어진다. 기본값 ⓐ 의 완료 조건이 실제보다 후하게 나온다.
- 수정안: 「bottom ≤ 664 − (하단 고정 버튼이 있으면 그 top 과 664 중 작은 값까지)」, 즉 가시 하한을 `min(664, 고정 버튼 getBoundingClientRect().top)` 으로 잰다고 적는다.

**U2-2 오버레이 칩 대안 흐름의 사후 조건이 비어 있다** (체크 2·3)
- 스펙: `spec.md:25` 오버레이 칩은 필터 시트(`KhSheet`, 모달) 안에 있고 누르면 지도 상태로 전환한다.
- 문제: 전환 뒤 모달 시트가 열린 채인지 닫히는지가 없다. 열린 채면 veil 이 지도를 덮어 전환이 보이지 않는다(`KhSheet` 모달 성질은 1라운드 G3 근거 `KhSheet.tsx:30,63`). 키 없는 경우의 막다른 상태는 I2-3.
- 수정안: 「오버레이 칩으로 지도 상태에 들어가면 필터 시트를 닫는다(onClose 와 같은 경로)」처럼 사후 조건을 한 줄 적고, SR-5.1 의 「오버레이 칩 → 지도 상태 전환」 단언에 시트 닫힘을 함께 넣는다.

## architecture — SHIP (1라운드 반영 대조)
- A-1 원본 위치: `spec.md:49` copy.mjs 원본 + placeView 재수출 + Kotlin 동명 함수. 반영.
- A-2 지도 생명주기: `spec.md:21` `!mapRequested` 반환 조건·의존 배열·div 상시 마운트. 반영.
- A-3 계측 규약: `spec.md:34` 전환 미계측·Q3. 반영.
- A-4 shellBody 한정: `spec.md:53` `renderPlaceHubs` 전용 래퍼/옵션 인자 + 다른 산출물 바이트 동일. 반영.
- A-5 N 정의: `spec.md:38`. 반영.

## security — SHIP (1라운드 반영 대조)
- 앞부분 일치 규칙·포함 검사 금지: `spec.md:48`. 반영.
- 치환 → escape 순서: `spec.md:51`. 반영.
- 회귀 단언(악성 쿼리 문자열·대소문자 호스트): `spec.md:69`, http 원천 픽스처 `spec.md:70,73`. 반영.
- 적용 지점 누락(통합 검색)은 I2-1 로 implementation 에서 처리한다.

## domain — SHIP (1라운드 반영 대조)
- D-2 「지도 열기」 정의 보존: `spec.md:34`. 반영.
- D-3 결과 패널은 KhSheet 아님(비모달): `spec.md:23`. 반영.
- D-5 geo 제외: `spec.md:38`. 반영.
- D-1·D-4 는 MINOR 로 판정된 그대로 둔다.
- 심판 메모(새 면 4조합 대비 측정)는 `spec.md:76` 에 들어갔다.

VERDICT: REVISE
