# 운영 확인 — 유입 행·분류·봇 집계 (2026-10-11 20:08~20:12 KST)

## SR-8.4 (a) 유입 행 (tasks 8.5)

드라이버: 독립 프로필 헤드리스 크롬(`scripts/cdp-chrome.sh start entry` → 측정 → `stop entry`, 한 명령), 일반 Chrome UA, 캐시 끔.
`Page.navigate({url, referrer: 'https://www.google.com/search?q=x', referrerPolicy: 'unsafeUrl'})`.
판정 근거는 페이지가 낸 값(`document.referrer`, 보낸 이벤트 본문)과 ClickHouse 원장 행이다.

| 항목 | 값 |
|---|---|
| 진입 URL | `https://place.1989v.com/attractions/1?utm_source=test&utm_medium=spec&utm_campaign=i0-5` |
| 로드된 번들 | `assets/index-vVB_BRMw.js` (운영 현행) |
| 페이지 `document.referrer` | `https://www.google.com/search?q=x` — `q=` 를 담았으므로 증거로 인정 |
| 보낸 이벤트 | `PAGE/place-entry` `SESSION_START` `PLACE_ENTRY`, 응답 202 |
| ClickHouse 행 (`view_id=7446b6d5-…`) | `2026-10-11 11:08:38.607` UTC · `{"referrerHost":"www.google.com","landingType":"detail","lang":"ko","utmSource":"test","utmMedium":"spec","utmCampaign":"i0-5"}` |
| 경로·검색어 | payload 에 `search`·`q=`·경로 없음 |

`utmMedium=spec` 이라 SR-9 일 집계에서는 빠진다(설계대로).

## SR-9 분류 리터럴 대조 (tasks 8.7)

SR-9 의 `multiIf` 를 그대로 `FROM values(...)` 에 넣어 운영 ClickHouse(`clickhouse-0`, analytics 계정)에서 실행했다.

| referrerHost | 기대 | 결과 |
|---|---|---|
| `www.google.com` · `www.google.co.kr` · `com.google.android.googlequicksearchbox` | search_google | 일치 3/3 |
| `m.search.naver.com` | search_naver | 일치 |
| `blog.naver.com` · `m.cafe.naver.com` | community_naver | 일치 2/2 |
| `search.daum.net` | search_daum | 일치 |
| `cafe.daum.net` | community_daum | 일치 |
| `www.bing.com` | search_bing | 일치 |
| `chatgpt.com` | ai | 일치 |
| `blog.1989v.com` · `1989v.com` | internal | 일치 2/2 |
| `self` · `''` | self · direct | 일치 2/2 |
| `google.com.evil.io` · `naver.com.evil.io` · `www.naver.com` · `a b` | other | 일치 4/4 |

18/18 일치.

## 봇 집계 표 (tasks 8.7 앞부분)

| 질의 | 결과 |
|---|---|
| `crawler_requests_hourly FINAL` 행·요청 합 | 7행 · 30건 · 시간 04:00~09:00 UTC |
| place 호스트 일 요청(10-11 KST) | googlebot 7 (304 0) · oai-searchbot 1 |
| 커버리지 `crawler_log_coverage_hourly` | 10-11: 고유 시간 8 · partial 5 — 잡 배포 첫날이라 하한값 |

봇 수치는 주간 합계로 읽는다(SR-9 읽는 법). 8.6 의 portal-fe 로그 grep 대조는 하지 않았다.
