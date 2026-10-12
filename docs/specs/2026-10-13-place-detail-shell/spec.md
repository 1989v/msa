# place 관광지 상세 — 서버 렌더 데이터 싣기 · 모바일 하단 행동 바가 탭바 자리로

2026-10-13. 대상: `place.1989v.com/attractions/:id` · `/en/attractions/:id`.

## 목표

1. 상세 화면이 서버 렌더(search `AttractionPageRenderer`)가 이미 가진 데이터로 첫 화면을 그린다. 상세 API 재호출이 실패해도 서버 렌더 본문이 실패 문구 한 줄로 바뀌지 않는다(크롤러가 `/api` 를 못 받던 때 Soft 404 의 원인).
2. 모바일 상세에서는 하단 탭바를 그리지 않고, 하단 행동 바(길찾기·찜·공유·전화)가 그 자리(화면 맨 아래, safe-area 포함)에 붙는다.

## 요구

### 서버 렌더 데이터

- 렌더 HTML 의 `#root` **앞**에 `<script type="application/json" id="attraction-data">` 를 싣는다. 내용은 `/api/search/attractions/{id}` 응답의 `data` 와 같은 객체다.
  - `AttractionDetailResponse` 를 presentation 에서 `application/attraction/usecase` 로 옮겨 API 컨트롤러와 렌더 서비스가 한 DTO 를 쓴다(사본 없음).
  - 문서→결과 변환 `toResult` 를 `SearchAttractionService` 밖 `internal` 함수로 내렸다. 렌더 서비스는 이미 받은 문서로 같은 변환을 거쳐 색인 조회는 그대로 한 번이다. 단축 주소는 `AttractionShortUrlUseCase` 로 API 와 같은 값을 붙인다.
  - `#root` 안이 아니라 앞에 두는 이유: React 가 첫 커밋에서 `#root` 를 비우므로, 지연 로드된 상세 화면이 읽기 전에 사라질 수 있다.
- JSON 안의 `<` `>` `&` U+2028 U+2029 는 `<` 꼴로 바꾼다. 원문에 `</script>` 가 있어도 블록을 닫지 못한다.
- 404 페이지에는 싣지 않는다 — 화면이 API 로 404 를 판정하는 경로가 그대로다.
- FE `AttractionPage` 는 마운트 때 노드를 읽고 바로 지운다(`ssrAttractionData.ts`). id·언어가 지금 경로와 같을 때만 `initialData` 로 쓰고 `staleTime` 10분으로 첫 로드 재호출을 막는다. 없거나 깨졌으면 지금처럼 API 를 부른다.

### 상세 셸

- `shellTabsFor`: place 호스트의 `/(en/)?attractions/:id` 는 `null`. 허브·지역·가이드는 그대로 지도·내 찜·서비스.
- 탭바가 없으면 `data-tabbar` 가 빠져 `--kh-shell-bottom` 여백도 없다. `.place-action-bar` 는 `bottom: 0` 에 붙고 safe-area 를 스스로 갖는다. 탭바 유무로 갈리던 규칙(`:root[data-tabbar='on'] .place-action-bar`, `html[data-tabbar='on']:has(.place-action-bar) .place-page`)은 상세에 더는 해당이 없어 지웠고, `scroll-padding-bottom`·문서 끝 여백·찜 복귀 알림 위치는 바 높이 + safe-area 로 잡는다.
- 바 표시 규칙(행동 줄이 머리띠 밑으로 지나간 뒤에만)은 그대로다.
- `Footer.css` 의 `#root :has(+ .site-footer) { margin-bottom }` 이 고정 바를 띄우던 함정(2026-10-11 기록)은 기존 `#root .place-action-bar.kh-slab { margin-bottom: 0 }` 이 계속 막는다 — 실측 `marginBottom 0px`.

## 검증 결과

| 확인 | 명령 / 방법 | 결과 |
|---|---|---|
| 렌더·패리티·컨트롤러·서비스 | `./gradlew :search:app:test --tests '*AttractionPageRenderer*' --tests '*ParityTest' --tests '*AttractionPageControllerTest' --tests '*AttractionPageServiceTest' --tests '*AttractionSearchController*'` | 13 클래스 304건 실패 0, BUILD SUCCESSFUL |
| 옮긴 변환 함수 | `--tests '*SearchAttractionServiceTest'` | 77건 실패 0 |
| 골든 HTML 12개 | 스크립트 블록을 지운 결과가 이전 골든과 바이트 동일 | 12/12 「스크립트 추가만」. `visit-summary-golden.json` 등 JSON 골든 무변경 |
| SSR 데이터 = API data | `AttractionPageControllerTest` — 같은 문서로 렌더 HTML 의 스크립트와 API 응답 `data` 를 JSON 트리로 비교 | 같음 |
| FE | `npx vitest run` appShell · AttractionPage.ssrData · AttractionPage · AttractionPage.actionBar | 4 파일 119건 통과 |
| 타입 | `npx tsc --noEmit -p .` | exit 0 |
| 빌드 | `npm run build` | exit 0 |

### 회귀 주입 (워킹트리 사본을 고쳤다 되돌림)

| 주입 | 빨개진 테스트 |
|---|---|
| 렌더러 이스케이프에서 `<`·`>` 치환 제거 | 「제목의 </script> 가 블록을 닫지 못한다」「JSON 으로 읽으면 원래 글자로 돌아온다」 + 골든 8개 |
| FE `initialData: undefined` | 「API 를 부르지 않는다」「읽은 뒤 노드를 지운다」 |
| FE `staleTime: 0` | 「API 를 부르지 않는다」(마운트 직후 재조회) |
| `shellTabsFor` 상세 분기 제거 | 「place 관광지 상세는 탭바가 없다」 |

### 화면 실측 (390×844 모바일, 2026-10-13 KST)

`VITE_API_URL= vite build` 산출물을 `scripts/serve.mjs` 로 내고(`/api` 는 운영 place 호스트로 프록시, `/api/v1/events` 는 로컬에서 202) `http://place.localhost:4317` 로 열었다. 로컬은 서버 렌더가 없어 상세는 API 경로로 그려진다. 크롬은 `scripts/cdp-chrome.sh` 독립 프로필 헤드리스, start·측정·stop 을 한 명령으로 묶었고 끝난 뒤 「이 세션」 크롬 `(없음)`. 드라이버 `scripts/measure.mjs`, 원값 `measure.json`.

- 측정 번들: 상세·허브 모두 `index-Dm_Fwnz8.js` — 이번에 넣은 `/^\/(en\/)?attractions\/[^/]+\/?$/` 가 이 파일에 있다.

| 확인 | 값 |
|---|---|
| ① 상세 탭바 노드 · `data-tabbar` · `--kh-shell-bottom` | 0개 · 없음 · 없음 |
| 첫 화면 바 | `hidden` (표시 규칙 유지) |
| ② 바 bottom / 뷰포트 높이 | 844 / 844 (top 788, 높이 56, 계산 bottom `0px`, margin-bottom `0px`; 헤드리스 safe-area 0) |
| ③ 문서 끝 마지막 내용 bottom ≤ 바 top | 739.8 ≤ 788 (`p.site-footer-copy`), `scroll-padding-bottom` 56px |
| ④ 허브 `/` 탭바 | 1개, `data-tabbar=on`, 지도·내 찜·서비스, top 791 / bottom 844, 행동 바 0개 |

캡처: `verifications/detail-390-ko-77-end.png`(상세 문서 끝, 바가 화면 맨 아래) · `verifications/hub-390-ko.png`(허브, 탭바 그대로).

## 남은 것

- safe-area 가 있는 실기기(iOS 홈 인디케이터)에서 바 아래 여백은 헤드리스로 재지 못했다(값 0). 배포 뒤 실기기 확인이 필요하다.
- 서버 렌더 데이터의 원천 사진 주소는 API 와 같은 원천값(`http://tong…` 일 수 있음)이다. 마크업(og:image·JSON-LD·본문 img)은 그대로 https 로 고쳐 내고, 데이터 스크립트만 원천값을 싣는다.
- 운영 서버 렌더 + 데이터 스크립트로 API 호출이 실제로 빠지는지는 배포 뒤 운영에서 네트워크 기록으로 확인해야 한다(로컬은 서버 렌더가 없다).
