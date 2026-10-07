측정 시각(KST): 2026-10-08T04:13:58.666131+09:00 ~ 2026-10-08T04:17:30.442881+09:00 | 도구: Python 3.14.6 / urllib.request / html.parser.HTMLParser(convert_charrefs=True), Git origin/main a8d1c97ef498 | 표본: 영문 상세 30개(HTML/API 각각 성공 30), 영문 허브 정적 HTML 1개 | 명령: python3 /Users/gideok-kwon/IdeaProjects/msa/docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-6-measure.py → python3 /Users/gideok-kwon/IdeaProjects/msa/docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-6-retry.py → python3 /Users/gideok-kwon/IdeaProjects/msa/docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-6-report.py

# S1-6 — 영문 텍스트 결함 UI 표본

**사실:** 상세 30개 서버 렌더 `<body>`의 텍스트 노드에서 지정 패턴 노출은 **0건, 0/30페이지**다. 같은 id의 API 관광지 본문·이용정보 필드에서는 **63회, 8/30페이지**에 지정 패턴이 남았다. 이 API 발생 횟수는 화면 노출 횟수가 아니다. 허브 카드의 실제 클라이언트 렌더 노출은 **미확인**이다.

## 측정 방법과 범위

- 공개 사이트·API만 GET. 브라우저 UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36`. 수집은 직렬이고 요청 시작 간격을 최소 0.3초로 제한했다(초당 5건 이하). 본 수집 68회 + 동일 URL 오류 재시도 5회 = 73회, 사전 탐색 9회 포함 작업 전체 82회(실패 요청 포함, 2,000건 이하). 리다이렉트로 다른 호스트에 간 요청은 없다.
- UI 집계는 서버 HTML을 HTMLParser로 파싱하여 `<body>` 아래 텍스트 노드에서 한 번의 HTML 엔티티 해석 후에도 남은 리터럴을 센다. `script/style/template/noscript`, `hidden`, `aria-hidden=true` 하위, 속성·head·JSON-LD는 제외했다. CSS 계산·JS 실행·접힘 상태·실제 픽셀 가시성은 미확인이다.
- 패턴은 대소문자 구분 `&rsquo;`, `&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `<br`, `&#\d+;`이고, 문자열 출현 횟수를 센다. `<br>` 실제 태그·정상적인 `&amp;` HTML 이스케이프는 UI 결함으로 세지 않는다. `&ldquo;` 등 비지정 엔티티·대문자 `<BR>`·16진 숫자 엔티티는 이 합계 밖이다.
- API는 바깥 JSON을 파싱한 뒤 `title/titleLocal/address/tel/overview/useTime/restDate/useFee/parking/parkingFee/infoCenter`와 `introRaw`, `infoRaw`의 JSON 문자열을 펼친 텍스트 값들을 검사했다. 이미지 메타데이터·외부 링크/영상 카탈로그·속성 코드 등은 이 본문/이용정보 합계에서 제외했다. API 전체 응답의 모든 문자열 합계가 아니다.
- 파생 필드와 원천 introRaw에 같은 문구가 있으면 API에서는 각각 센다. 따라서 API 합계에는 필드 간 중복이 포함되며, 원천 결함 고유 개수나 UI 개수로 해석하면 안 된다.
- 최초 5개 요청은 SSL EOF/handshake timeout으로 실패했다. 같은 표본을 재시도하여 HTML 30/30, API 30/30을 확보했다. 실패를 0건으로 처리하거나 다른 표본으로 바꾸지 않았다.

## Sitemap 모집단과 고정 표본

[sitemap.xml](https://place.1989v.com/sitemap.xml)의 모든 하위 sitemap을 읽고 `/en/attractions/숫자`만 취했다. 언어 전용 sitemap 이름은 없으며 영문 상세는 다음 3개 파일에 들어 있었다. 인덱스 파일 순서 → 각 파일의 `<loc>` 원래 순서로 합치고 URL을 중복 제거했다. 모집단 15086개. 정렬을 추가하지 않았으므로 id 숫자순 표본이 아니다.

| 영문 상세 포함 sitemap | 영문 상세 수 |
|---|---:|
| [sitemap-places-3.xml](https://place.1989v.com/sitemap-places-3.xml) | 13,416 |
| [sitemap-places-4.xml](https://place.1989v.com/sitemap-places-4.xml) | 1,559 |
| [sitemap-places-events.xml](https://place.1989v.com/sitemap-places-events.xml) | 111 |

고정 시드 `20261007`, Python `random.Random`. 모집단을 30개 연속 구간으로 나누고 각 구간에서 1개를 뽑았다: 0-based 경계 `[b*N//30, (b+1)*N//30)`; 첫 구간은 최초 URL, 마지막 구간은 최후 URL을 고정하고 나머지 28구간은 `rng.randrange(lo, hi)`를 순서대로 적용했다. 아래 앞·중간·끝은 각각 10구간이다. 시드 표본 중 쇼핑/Tax Refund Shop 비중이 높다. 이 30개로 전 사이트 결함률을 추정하지 않는다. 전체 15,086 URL 목록·수집 응답·해시는 원시 증거 파일에 남겼다.

## UI/API 나란히 집계 — 표본 URL 목록 겸용

UI 열은 지정 패턴의 서버 `<body>` 텍스트 노출 총합이며, API 기타 열은 제목·주소·파생 이용필드·introRaw의 합이다. 0은 성공 응답을 검사한 결과다.

| 번호/구간 | 모집단 순번(1-based) | 표본 URL | UI 본문 | API overview | API 기타 | API infoRaw | API 합계 |
|---|---:|---|---:|---:|---:|---:|---:|
| 1/앞 | 1 | [https://place.1989v.com/en/attractions/21](https://place.1989v.com/en/attractions/21) | 0 | 0 | 0 | 0 | 0 |
| 2/앞 | 619 | [https://place.1989v.com/en/attractions/14139](https://place.1989v.com/en/attractions/14139) | 0 | 1 | 0 | 0 | 1 |
| 3/앞 | 1,423 | [https://place.1989v.com/en/attractions/37536](https://place.1989v.com/en/attractions/37536) | 0 | 0 | 0 | 0 | 0 |
| 4/앞 | 1,932 | [https://place.1989v.com/en/attractions/38416](https://place.1989v.com/en/attractions/38416) | 0 | 0 | 0 | 0 | 0 |
| 5/앞 | 2,193 | [https://place.1989v.com/en/attractions/39290](https://place.1989v.com/en/attractions/39290) | 0 | 0 | 0 | 0 | 0 |
| 6/앞 | 2,554 | [https://place.1989v.com/en/attractions/40233](https://place.1989v.com/en/attractions/40233) | 0 | 0 | 0 | 0 | 0 |
| 7/앞 | 3,167 | [https://place.1989v.com/en/attractions/41772](https://place.1989v.com/en/attractions/41772) | 0 | 0 | 0 | 0 | 0 |
| 8/앞 | 3,832 | [https://place.1989v.com/en/attractions/43163](https://place.1989v.com/en/attractions/43163) | 0 | 0 | 0 | 0 | 0 |
| 9/앞 | 4,341 | [https://place.1989v.com/en/attractions/44637](https://place.1989v.com/en/attractions/44637) | 0 | 0 | 0 | 0 | 0 |
| 10/앞 | 4,886 | [https://place.1989v.com/en/attractions/1802](https://place.1989v.com/en/attractions/1802) | 0 | 0 | 4 | 0 | 4 |
| 11/중간 | 5,445 | [https://place.1989v.com/en/attractions/35140](https://place.1989v.com/en/attractions/35140) | 0 | 0 | 0 | 0 | 0 |
| 12/중간 | 5,820 | [https://place.1989v.com/en/attractions/1861](https://place.1989v.com/en/attractions/1861) | 0 | 21 | 0 | 0 | 21 |
| 13/중간 | 6,416 | [https://place.1989v.com/en/attractions/42322](https://place.1989v.com/en/attractions/42322) | 0 | 0 | 0 | 0 | 0 |
| 14/중간 | 6,589 | [https://place.1989v.com/en/attractions/43958](https://place.1989v.com/en/attractions/43958) | 0 | 0 | 0 | 0 | 0 |
| 15/중간 | 7,184 | [https://place.1989v.com/en/attractions/45267](https://place.1989v.com/en/attractions/45267) | 0 | 0 | 0 | 0 | 0 |
| 16/중간 | 7,986 | [https://place.1989v.com/en/attractions/35524](https://place.1989v.com/en/attractions/35524) | 0 | 0 | 0 | 0 | 0 |
| 17/중간 | 8,463 | [https://place.1989v.com/en/attractions/14571](https://place.1989v.com/en/attractions/14571) | 0 | 0 | 4 | 16 | 20 |
| 18/중간 | 8,614 | [https://place.1989v.com/en/attractions/1937](https://place.1989v.com/en/attractions/1937) | 0 | 4 | 0 | 0 | 4 |
| 19/중간 | 9,308 | [https://place.1989v.com/en/attractions/36814](https://place.1989v.com/en/attractions/36814) | 0 | 0 | 0 | 0 | 0 |
| 20/중간 | 9,839 | [https://place.1989v.com/en/attractions/38181](https://place.1989v.com/en/attractions/38181) | 0 | 0 | 0 | 0 | 0 |
| 21/끝 | 10,479 | [https://place.1989v.com/en/attractions/39949](https://place.1989v.com/en/attractions/39949) | 0 | 0 | 0 | 0 | 0 |
| 22/끝 | 10,945 | [https://place.1989v.com/en/attractions/42406](https://place.1989v.com/en/attractions/42406) | 0 | 0 | 0 | 0 | 0 |
| 23/끝 | 11,116 | [https://place.1989v.com/en/attractions/43072](https://place.1989v.com/en/attractions/43072) | 0 | 0 | 0 | 0 | 0 |
| 24/끝 | 11,986 | [https://place.1989v.com/en/attractions/38876](https://place.1989v.com/en/attractions/38876) | 0 | 0 | 0 | 0 | 0 |
| 25/끝 | 12,121 | [https://place.1989v.com/en/attractions/14693](https://place.1989v.com/en/attractions/14693) | 0 | 0 | 0 | 0 | 0 |
| 26/끝 | 12,815 | [https://place.1989v.com/en/attractions/40056](https://place.1989v.com/en/attractions/40056) | 0 | 0 | 0 | 0 | 0 |
| 27/끝 | 13,527 | [https://place.1989v.com/en/attractions/14987](https://place.1989v.com/en/attractions/14987) | 0 | 0 | 4 | 4 | 8 |
| 28/끝 | 13,580 | [https://place.1989v.com/en/attractions/18136](https://place.1989v.com/en/attractions/18136) | 0 | 0 | 2 | 0 | 2 |
| 29/끝 | 14,404 | [https://place.1989v.com/en/attractions/22345](https://place.1989v.com/en/attractions/22345) | 0 | 0 | 2 | 1 | 3 |
| 30/끝 | 15,086 | [https://place.1989v.com/en/attractions/65816](https://place.1989v.com/en/attractions/65816) | 0 | 0 | 0 | 0 | 0 |
| **합계** | | **30개** | **0** | **26** | **16** | **21** | **63** |

각 URL의 id와 동일한 [공개 API](https://api.1989v.com/api/search/attractions/21) 형식 `https://api.1989v.com/api/search/attractions/{id}`을 요청했다. 응답의 `data.id`와 `data.lang=en`도 30개 모두 확인했다.

## 패턴별 합계

| 패턴 | UI 본문 노출 | API 텍스트 발생 |
|---|---:|---:|
| `&rsquo;` | 0 | 5 |
| `&nbsp;` | 0 | 3 |
| `&amp;` | 0 | 0 |
| `&lt;` | 0 | 0 |
| `&gt;` | 0 | 0 |
| `<br` | 0 | 55 |
| `&#\d+;` | 0 | 0 |

## 발생 필드와 렌더 요소

**UI 결함 selector/절:** 관측 없음(0건). 아래 selector는 결함이 있는 요소가 아니라, API 원문을 정리하여 보여 주는 정상 본문 요소의 대조 증거다.

| id / 절 | API 지정 패턴 | 서버 텍스트/selector 관측 |
|---|---|---|
| 14139 / 개요 | overview의 `clinic&rsquo;s` 1회 | `clinic’s`로 관측. `#root > div:nth-of-type(1) > p:nth-of-type(3)` |
| 1861 / 개요 | overview: `&rsquo;` 2, `&nbsp;` 2, `<br` 17 | `‘beauty’`와 줄바꿈으로 관측. `#root > div:nth-of-type(1) > p:nth-of-type(3)` |
| 1937 / 개요 | overview: `&rsquo;` 2, `&nbsp;` 1, `<br` 1 | `BTS street + RM mural` 뒤 줄바꿈. `#root > div:nth-of-type(1) > p:nth-of-type(3)` |
| 18136 / Visitor info·Admission | useFee, introRaw.usefee 각각 `<br` 1 | 요금 사이 줄바꿈. `#root > div:nth-of-type(1) > dl:nth-of-type(1) > dd:nth-of-type(3)` |
| 22345 / Visitor info·Hours | useTime, introRaw.usetimeleports 각각 `<br` 1 | `11:00-17:00` 뒤 줄바꿈. `#root > div:nth-of-type(1) > dl:nth-of-type(1) > dd:nth-of-type(1)` |
| 14571·14987 / infoCenter | infoCenter와 introRaw.infocenter 각각 `<br` 2 | 서버 visitorInfo는 Hours/Closed/Admission/Parking만 출력한다. 해당 연락처 정보는 이 경로에서 미출력이고 정리 효과로 계산하지 않는다. |
| 14571·14987·22345 / 반복정보 | infoRaw의 `<br` 각각 16·4·1 | 서버 본문은 infoRaw 반복정보를 출력하지 않는다. 독립 SPA 상세는 repeatInfoRows → sourceText 경로가 있으나 실행 후 화면은 미확인이다. |

발생 필드 전체 합계(0인 패턴은 생략):

| API 필드 | 패턴별 횟수 | 합계 |
|---|---|---:|
| `infoCenter` | `<br` 6 | 6 |
| `infoRaw[1].infotext` | `<br` 5 | 5 |
| `infoRaw[3].infotext` | `<br` 16 | 16 |
| `introRaw.infocenter` | `<br` 6 | 6 |
| `introRaw.usefee` | `<br` 1 | 1 |
| `introRaw.usetimeleports` | `<br` 1 | 1 |
| `overview` | `&rsquo;` 5, `&nbsp;` 3, `<br` 18 | 26 |
| `useFee` | `<br` 1 | 1 |
| `useTime` | `<br` 1 | 1 |

## 영문 허브와 “Not closed today”

[영문 허브 /en](https://place.1989v.com/en)의 정적 `<body>`는 지역 링크와 관광지 링크 목록이다. `.place-card` 요소 0개, `Not closed today` 텍스트 0개, 지정 패턴의 본문 텍스트 노출 0건이다. 이 0은 **카드 0건/무결함 확인이 아니라 카드 표본 자체가 없는 서버 응답 결과**다. JS 번들 `/assets/index-C5A32Ajr.js`를 로드하는 SPA 경로가 있으나 클라이언트 카드는 **미확인**이다.

**미확인 사유:** 사전 검사 `pgrep -fl "Google Chrome.*headless"`가 `sysmon request failed with error: sysmond service not found` / `pgrep: Cannot get process list`로 실패했다(exit 3). 이 환경에서 사용자 요구인 종료 후 잔류 0을 확인할 수 없어 헤드리스 Chrome은 시작하지 않았다. 사용자 Chrome이나 MCP 프로필도 접근하지 않았다. 실제 잔류 상태 자체는 미확인이다.

**코드 확인:** `Not closed today`는 카드의 실시간 영업 배지가 아니라, 허브 분류 필터 아래 `div.place-attr-group[role=group][aria-label="Visitor info filters"] > div.place-attr-chips > button[data-attr="openToday"]`의 첫 속성 필터다. 옆에 Parking/Credit cards/Stroller rental 등이 나오고 버튼에는 패싯 건수가 붙으며, 아래 문구는 `Filters only places that list this information`이다. 행사를 선택한 경우 이 속성 필터 묶음은 숨긴다. 클릭 시 `openToday=true` 검색 파라미터를 보낸다. **추정:** 영어 문구는 “오늘 문 닫지 않았다”는 현재 영업 상태로 읽힐 수 있으나 한국어 라벨은 “오늘 정기휴무 아님”이다. 위치·의미는 origin/main 코드 기준이며 배포 화면에서의 실제 배치·오독은 미확인이다.

## origin/main 렌더 경로 설명

코드는 로컬 워킹트리가 아닌 **origin/main `a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24`**의 `git show`로만 읽었다. `AttractionSeoText.sourceText`(45–59행)는 원천 `<br>`/블록 종료를 줄바꿈으로 바꾸고 태그를 제거한 다음 명명·10진 숫자 엔티티를 한 번 디코딩한다. `AttractionPageRenderer` 개요(376행)는 `escapeHtml(sourceText(doc.overview))`, Visitor info(447–463행)는 같은 순서, 유형별 introRaw(432–434행)는 `introText → sourceText → definitionList → escapeHtml`로 출력한다. 따라서 정상적인 HTML 이스케이프가 텍스트에서 다시 엔티티로 남지는 않는다. 제목·주소·연관 제목 등에는 escapeHtml만 쓰는 경로도 있다. SPA 독립 상세 `AttractionPage.tsx`(403–411, 443–446행)는 overviewText/sourceText를 거친 값을 React 텍스트로 출력하며, 이 함수의 원본은 `seo/copy.mjs`(844–860행)다. 반면 허브 `PlacePage.tsx`의 `PlaceCard`(1379행, `.place-card-overview`)와 선택 상세 패널 `AttractionDetailBody`(1313행, `.place-detail-overview`)는 `{attraction.overview}`를 직접 텍스트로 넣는다. `placeApi.ts`는 data를 그대로 반환하므로 이 두 경로에는 엔티티 디코딩·태그 제거가 없다. **추정:** API 원문 패턴이 해당 카드/패널 응답에 들어오면 React의 텍스트 출력에서는 `&rsquo;`·`<br>` 등이 그대로 보일 수 있다. 이번 상세 SSR 0건과 별개이며, 실제 허브 목록 API·카드 화면을 확인하지 않아 발생 건수를 확정하지 않는다. 코드 발췌는 [origin/main 렌더 근거](s1-6-origin-main-render-evidence.md)에 있다.

## 수정 지점 제안 — 3줄

1. `PlacePage.tsx`의 카드·선택 상세 패널 overview에 기존 `sourceText/overviewText`를 적용하고 정리 후 빈값은 숨긴다. 허브 카드/패널은 실제 브라우저로 재확인한다.
2. 서버/SPA의 같은 텍스트 필드를 표본으로 대조하여 출력 누락(infoCenter/infoRaw)과 정규화 효과를 구분하고, 이중 인코딩 입력은 한 번 디코딩 정책의 잔여 패턴을 별도 검증한다.
3. `placeAttributes.ts`의 영문 `Not closed today`를 정기휴무만 뜻하는 문구(예: `No scheduled closure today`)로 바꾸고 현재 영업시간 확인이 아니라는 보조 설명을 검토한다.

## 재현·검증 증거와 한계

- [수집 스크립트](s1-6-measure.py): sitemap 목록, 30개 표본, 직렬·UA 요청, 파서 및 패턴 규칙.
- [최초 원시 증거](s1-6-measurement.jsonl): 첫 줄 메타데이터 다음 JSON 객체에 전체 모집단·상세 HTML/API 원문·요청 시각/상태/응답 SHA-256·허브 HTML을 저장했다.
- [동일 표본 재시도 스크립트](s1-6-retry.py) / [재시도 원시 증거](s1-6-retry.jsonl): 최초 실패 5요청 보완. 기존 파일은 변경하지 않았다.
- [보고서 집계 스크립트](s1-6-report.py): 재시도 보완 후 30개 id/lang 검증 및 infoRaw 집계를 포함하여 이 보고서를 생성한다. 파일 생성은 exclusive mode(`x`)로 기존 산출물을 덮어쓰지 않는다.
- 원시 JSONL은 첫 메타데이터 줄을 건너뛰고 JSON 객체를 파싱한다. JSON 문자열의 유니코드 줄 구분자 때문에 Python `splitlines()` 대신 첫 `\n`으로만 나눈다.
- **미확인:** 클라이언트 상세/허브 카드 DOM·가시성, 허브 목록 API가 보내는 텍스트의 차이, 배포 서버와 origin/main 커밋 일치 여부, 전 사이트 결함률, 실제 영업 여부. 운영·사내 시스템은 접근하지 않았다.
