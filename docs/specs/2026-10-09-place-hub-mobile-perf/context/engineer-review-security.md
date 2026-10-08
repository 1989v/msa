# Engineer Review — security (1라운드)

대상: `docs/specs/2026-10-09-place-hub-mobile-perf/spec.md`
범위: 쿼리 `layout` 처리, 사진 주소 https 치환(mixed content), 지도 스크립트 지연 로드.

## 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|------|------|------|
| 1 | 위협 모델링(STRIDE) | 해당 적음 | 인증·쓰기 경로 없음. 위협 면은 Tampering(쿼리 입력)·전송 무결성(http 사진)뿐 |
| 2 | 인증/인가 경계 | 해당 없음 | 공개 읽기 화면, 새 API 없음 (spec.md:4 「의존·스키마 변경 없음」) |
| 3 | 민감 데이터 흐름 | 통과 | PII·토큰 없음. 지도 키는 기존대로 공개값 + referrer 제한 (`googleMaps.ts:2-3`), 지연 로드는 호출 시점만 바꾼다 (spec.md:19) |
| 4 | 입력 검증 바운더리 | 통과 | `layout` 은 두 값 화이트리스트, 무효 값은 기본값 (spec.md:18), vitest 로 고정 (spec.md:40). canonical·프리렌더·계측 주소에 넣지 않음 (spec.md:18) |
| 4b | XSS — 치환 뒤 출력 | REVISE-1 일부 | InfoWindow 는 HTML 문자열이라 `escapeHtml` 을 거친다 (`PlacePage.tsx:1290`). 치환 순서를 스펙에 명시 필요 |
| 5 | 서비스 간 통신 | 해당 없음 | — |
| 6 | 시크릿 관리 | 통과 | 키 빌드타임 주입 유지 (`googleMaps.ts:15`), 스크립트 URL `encodeURIComponent` (`googleMaps.ts:25`) |
| 7 | 전송 암호화 | REVISE-1 | mixed content 제거가 목적인데 치환 대상 목록이 실제 호출처보다 좁다 |
| 8 | 감사 로깅 | 해당 없음 | 계측은 기존 이벤트 재사용 (spec.md:22) |
| C | 결제·주문 권한·Rate limit | 해당 없음 | — |

## 이슈

### REVISE-1 (체크 #7, #4b) — https 치환 대상 호출처 열거와 규칙 형태 명시

근거: SR-4.2(spec.md:34)는 「화면에 내보내는 모든 사진 주소(카드·패널·상세·SSR `<img>`·JSON-LD image)」라고 하지만 Existing Code(spec.md:47)는 카드 img(`PlacePage.tsx:1793-1798`)만 짚는다. 실제로 원천 주소가 그대로 나가는 곳은 더 있다.

- 갤러리·사진 뷰어: `placeView.ts:273` 주석과 키 처리가 「원천이 http/https 를 섞어 준다」고 밝힌다. 결과는 `AttractionPage.tsx:329,373`, `PhotoViewer.tsx:74` 로 그대로 나간다
- 상세 패널: `PlacePage.tsx:1678`
- 지도 InfoWindow 의 `data-src`: `PlacePage.tsx:1290`
- 지역 카드: `RegionPage.tsx:248,287`
- 근처 탐색 썸네일: `NearbyExplore.tsx:250`
- FE JSON-LD: `copy.mjs:676` 은 `attraction.imageUrl` 을 그대로 넣는다. 프리렌더와 `AttractionPage.tsx:165` 가 같이 쓴다
- SSR: 본문에는 `<img>` 가 없다(렌더러 grep 결과 0건). 실제 출력은 `og:image`·`og:image:secure_url`(`AttractionPageRenderer.kt:54,145-146`)과 JSON-LD(`:241`)다. 지금은 `secure_url` 에 http 가 들어갈 수 있다

수정안:
1. SR-4.2 에 위 호출처를 열거한다. SSR 항목은 「`<img>`」를 「og:image·og:image:secure_url·JSON-LD image」로 고친다. `galleryImages` 는 출력 단계에서 `secureImageUrl` 을 거치게 하고, 중복 판정 키(`placeView.ts:273`)는 그대로 둔다
2. 규칙 형태를 고정한다. **문자열 맨 앞이 `http://tong.visitkorea.or.kr/` 와 정확히 일치할 때만** 스킴을 바꾼다. 포함(contains)이나 앵커 없는 정규식은 쓰지 않는다. 그렇게 하지 않으면 `http://evil/?u=http://tong.visitkorea.or.kr/` 같은 값의 일부가 바뀐다. 패리티 표(SR-5.2)에 이 사례와 대소문자 다른 호스트를 넣는다
3. 순서를 명시한다. HTML 문자열에 넣는 곳(`PlacePage.tsx:1290`, Kotlin 메타)은 **치환 → escape** 순서로 쓴다. 치환은 escape 를 대신하지 않는다
4. SR-5.3 회귀 주입에 「갤러리 경로의 치환 제거 → 빨강」을 더한다. 카드만 검사하면 나머지 호출처는 지켜지지 않는다

## 비차단 관찰 (조치 불요)

- `layout` 값을 className·DOM 에 그대로 반영하지 말고, 파싱된 enum 값만 쓴다. 스펙의 화이트리스트(spec.md:18)로 이미 충족된다
- 지도 지연 로드는 공격면을 넓히지 않는다. 같은 로더, 같은 키, 같은 출처를 쓴다 (`googleMaps.ts:18-35`)
- `prerender-seo.mjs:408-409` 는 `og:image` 를 escape 없이 넣는다. 다만 place 페이지는 고정 OG 카드(`copy.mjs:482,493,557,565`)를 쓰므로 TourAPI 값이 이 경로로 흐르지 않는다. 이번 범위 밖이며 보고만 한다

VERDICT: REVISE
