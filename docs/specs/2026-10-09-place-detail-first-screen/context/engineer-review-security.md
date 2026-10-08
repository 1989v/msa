# Engineer Review — security (1라운드)

대상: `docs/specs/2026-10-09-place-detail-first-screen/spec.md`

## 요약
새 노출 지점은 모두 공개 관광 데이터를 읽기 전용으로 렌더한다. 인증 경계·시크릿·서비스 간 통신은 바뀌지 않는다.
기존 렌더러의 이스케이프 계약은 건전하다: 원문은 `sourceText`(태그 제거 → 엔티티 디코드)를 거친 뒤 `escapeHtml`
(`& < > "`)로 나가고, 속성은 전부 큰따옴표다. JSON-LD 는 `<` 를 `<` 로 바꾼다.
근거: `AttractionPageRenderer.kt:41`, `:156`, `AttractionSeoText.kt:46-58,74-78`.
FE 는 React 텍스트 노드로만 그린다. `pages/place` 에 `dangerouslySetInnerHTML` 이 없다 — `AttractionPage.tsx:465-468`.
남은 문제는 스펙에 새 원문 경로의 이스케이프 순서와 `tel:` 추출 규칙이 비어 있다는 것, 두 가지다.

## 체크리스트 판정
| 항목 | 판정 | 근거 |
|---|---|---|
| 위협 모델링(STRIDE) | 부분 | 이번 변경의 실질 위협은 원천 문자열에 의한 Tampering(저장형 XSS·JSON-LD 탈출)뿐이다. 아래 S-1·S-2 |
| 인증/인가 경계 | 통과 | 새 엔드포인트가 없다. 공개 상세 페이지에 필드만 더한다(SR-4.1, `spec.md:38`) |
| 민감 데이터 흐름 | 통과 | `tel`·`infoCenter` 는 시설 대표번호(공개 원천)라 PII 가 아니다. 새 로깅 없음 |
| 입력 검증 바운더리 | **REVISE** | S-1, S-2 |
| 서비스 간 통신 | 통과 | place → search:batch 내부 호출에 필드 두 개만 추가된다. 방식은 그대로(`spec.md:4`) |
| 시크릿 | 해당 없음 | — |
| 암호화/TLS | 통과 | SSR `<img>` 를 https 주소로 한정했다(SR-3.4, `spec.md:33`) |
| 감사 로깅 | 해당 없음 | 쓰기 경로 없음 |
| 결제/주문 권한 · PCI | 해당 없음 | — |
| Rate Limiting | 통과 | 요청 경로에 새 외부 호출이 없다(SR-2.6, `spec.md:27` "새 외부 호출 없음") |

## 이슈

### S-1 (체크 4: 입력 검증) — 새 원문 출력 지점에 "디코드 뒤 이스케이프" 순서가 명시되지 않았다
- 근거: SR-2.2(`spec.md:23`)는 반복정보 요금 행에 `sourceText` 정규화만 적었다. `sourceText` 는 엔티티를 **되돌린다**
  (`AttractionSeoText.kt:52-57`). 그래서 원문 `&lt;script&gt;` 가 `<script>` 로 바뀐다. 이 값이 `escapeHtml` 없이
  SSR 에 들어가면 저장형 XSS 가 된다. 새로 생기는 원문 출력 지점은 다음과 같다.
  - 방문 요약 `<dl>`(요금 행 `infoRaw.infotext`, 쉬는 날 원문) — SR-3.1
  - 전화 원문 텍스트 — SR-2.6
  - 시군구 브레드크럼 — SR-1.3
  - 집계 문장 — SR-3.3
  - 이웃 제목 — SR-3.2
  - `<img alt>` — SR-3.4
  - JSON-LD `containedInPlace.name` — SR-3.5

  지금 렌더러에서는 `infoRaw` 가 SSR 에 나가지 않는다(`visitorInfo` `AttractionPageRenderer.kt:448-460` 은 `useFee` 만 쓴다). 반복정보 원문이 서버 HTML 로 나가는 것은 이번이 처음이다.
  `source` 표시명(SR-2.5)도 매핑 규칙이 없다. 색인 keyword 값을 그대로 내면 안 된다.
- 수정안: SR-2 에 한 줄을 추가한다.
  > 새 원문 값은 모두 `sourceText` → `escapeHtml` 순서로 SSR 에 나간다(렌더러 계약 `AttractionPageRenderer.kt:41`). JSON-LD 는 기존 `<` 치환을 거친다. `source` 는 허용 목록(TOURAPI→「한국관광공사 TourAPI」, GOCAMPING→「고캠핑」)으로만 이름을 정하고, 그 밖의 값은 고정 문구로 폴백한다.

  SR-5.1 에는 단위 케이스 하나를 추가한다. 요금 행 `infotext` 에 `&lt;img src=x onerror=alert(1)&gt;` 와 `"` 를 넣고, SSR 출력에 `<img` 가 없고 `&lt;img` 만 있음을 단언한다. 같은 값이 JSON-LD 로 갈 경우에는 `</script` 가 없음을 단언한다.
  회귀 주입(SR-5.5)에는 "요금 행 `escapeHtml` 제거 → 빨강"을 하나 추가한다.

### S-2 (체크 4: 입력 검증) — `tel:` 정규화가 "숫자·하이픈만 남김"이라 여러 번호를 이어 붙인다
- 근거: SR-2.6(`spec.md:27`)은 `infoCenter` 에서 숫자와 하이픈만 남겨 링크를 만든다. 그런데 원천 `infoCenter` 는 `<br>` 로 번호
  여러 개를 잇는 경우가 표본 182개 중 11개다(`copy.mjs:837`). 예를 들어 "02-123-4567<br>010-1234-5678" 을 이 규칙대로 바꾸면 `tel:02-123-4567010-1234-5678` 이 된다.
  존재하지 않거나 엉뚱한 번호로 거는 링크가 나간다. 스킴이 고정이라 스크립트 실행 위험은 없다. 문제는 검증 경계가
  "문자 걸러내기"로만 정의돼 형식 검증이 없다는 점이다.
- 수정안: 규칙을 다음처럼 바꾼다.
  > `sourceText` 뒤 첫 번째 전화번호 패턴(예: `\+?\d[\d-]{2,}\d`, 숫자 7~15자리)만 `tel:` 에 쓴다. 일치하는 번호가 없으면 링크 없이 원문만 보인다.

  `href` 값도 `escapeHtml` 을 거친다. SR-5.1 `tel:` 단위 테스트에는 다음 케이스를 넣는다.
  - `<br>` 다중 번호
  - 「1330」
  - 「문의: 없음」(링크 없음)
  - 괄호·공백 포함 번호

## 확인했고 문제없는 것
- 라이선스 URL 은 `copyrightDivCd` Type1/Type3 허용 목록에서만 정해지고, 그 밖의 값이면 생략된다(`spec.md:34`). 원천 값이 URL 로 흘러가지 않는다.
- 이웃·브레드크럼 링크는 내부 경로 빌더(`attractionPath`·`regionPath`)와 `escapeHtml` 을 거친다(`AttractionPageRenderer.kt:368,555`).
- 길찾기는 기존 `googleMapsSearchUrl` 을 재사용한다(`googleMaps.ts:51`, `encodeURIComponent` 기반). 새 외부 호출이 없다.
- JSON-LD `image`(`copy.mjs:676`)는 지금도 원천 URL 을 그대로 싣는다. URL 실행 지점이 아니어서 이번 변경으로 위험이 늘지 않는다.

VERDICT: REVISE
