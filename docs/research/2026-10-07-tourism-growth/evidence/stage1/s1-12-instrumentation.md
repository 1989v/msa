측정 시각(KST): 2026-10-08T04:30:07+09:00 | 도구: Git 2.50.1 (Apple Git-155), Python 3.14.6 urllib, Node v22.22.3, Chrome 154.0.8037.98(버전 조회만) | 표본: 필수 행동 6종, 공개 GET 3회(허브 1·검색 1·상세 1), 브라우저 행동 0회 | 명령: git ls-tree -r origin/main --name-only | grep -iE "analytics|track|event|ledger"; git show origin/main:<path>; python3 - <<'PY' … urllib.request … PY

# S1-12 — 기존 행동 계측 점검

## 판정

**place 허브의 6종 행동 전환율 기준선은 현재 origin/main 코드만으로 동일 정의로 잡을 수 없다.** 공통 이벤트 수집기는 있으나 허브 검색·필터·결과 선택에 연결되어 있지 않다. 통합 검색과 관광지 상세/지역의 일부 링크에는 SEARCH·IMPRESSION·CLICK이 있다. 이 제한된 화면의 지표는 별도로 정의할 수 있지만, 운영 원장 적재 여부는 「미확인」이다.

코드 사실과 공개 HTTP 관측을 구분했다. 「없음」은 아래 origin/main 스냅샷의 조사 범위에서 호출/구현을 찾지 못했다는 뜻이며, 운영 전체에 데이터가 없다는 뜻이 아니다. 앞으로 필요한 정의는 제안이며 현재 수집 사실이 아니다.

## 범위·재현 방법

- 코드 기준: `origin/main = a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24`. fetch 없이 기존 원격 추적 ref를 읽었다. 현재 GitHub 최신 커밋 및 배포 SHA는 「미확인」.
- 탐색 명령: `git ls-tree -r origin/main --name-only | grep -iE 'analytics|track|event|ledger|PlacePage|AttractionPage|FavoriteButton'`.
- 후속 탐색: `git ls-tree -r origin/main --name-only | grep -iE 'search/.*(interaction|ranking|view|migration)|common/.*Crawler|gateway/.*application|wishlist/.*migration'`.
- 내용 확인: `git show origin/main:<path>`; Python subprocess로 이를 호출해 줄 번호와 주변 코드를 읽었다. portal-fe/src의 비테스트 TS/TSX, search/app·domain의 주 소스, place·wishlist 및 관련 analytics/common/gateway 소스를 검색했다. 로컬 소스 내용은 읽지 않았다.
- 새 보고서 1개만 독점 생성(`Path.open('x')`). 기존 파일 수정, git add/commit/push/stash, kubectl/ssh/DB/사내 도구는 사용하지 않았다.
- 공개 네트워크: Python 3.14.6 urllib로 GET 총 3회. 순차 실행, 연속 API 요청 간 0.3초 대기. 자동 redirect 추가 요청은 없었다. 일반 브라우저 UA는 아래와 같고, 외부 스크립트·지도 제공자에는 요청하지 않았다.

```text
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36
```

## 1. 현재 FE 행동과 발화 지점

| 화면/행동 | 실제 수집 이름 | 속성/발화 조건 | 전송 또는 기능 API | 근거 |
|---|---|---|---|---|
| PlacePage 검색 | 공통 이벤트 없음 | submit → runKeywordSearch → 쿼리 변경 → React Query 검색. submit 이벤트를 기록하지 않음 | GET `/api/search/attractions?...` | C1, C2 |
| PlacePage 필터 | 공통 이벤트 없음 | 유형·지역·행사 상태·방문 속성 등의 state 변경 및 조회. 이전/이후 필터와 사용자 적용 이유를 보내지 않음 | 같은 검색 GET | C1 |
| PlacePage 결과 선택 | 공통 이벤트 없음 | 일반 카드 `<a>`의 좌클릭을 preventDefault하고 onSelect 호출하여 상세 패널 표시. 수정키 클릭은 일반 링크 이동 | 선택 상세 GET `/api/search/attractions/{id}` | C1, C2 |
| UnifiedSearchPage 검색 | `entityType=SEARCH`, `action=SEARCH` | API 성공 후 기록, 0건 포함. q/type 변경에 새 viewId. submit 시점이 아니며 URL 직접 진입/대상 타입 변경도 포함. 실패/빈 q는 제외 | POST `/api/v1/events` | C3 |
| UnifiedSearchPage 결과 | `entityType=각 결과 유형`, `action=IMPRESSION/CLICK` | SEARCH_GROUP, screenRef=검색어, sectionIndex=그룹 순서, itemIndex=결과 순서 | 같은 POST | C3, C4 |
| AttractionPage 주변 탐색·추천 | `ATTRACTION × IMPRESSION/CLICK` | ATTRACTION_DETAIL, screenRef=원 관광지 id, sectionId/sectionIndex/itemIndex. NearbyExplore 및 추천 링크에 연결 | 같은 POST | C5, C6 |
| RegionPage 이달 행사 | `ATTRACTION × IMPRESSION/CLICK` | PLACE_REGION, screenRef=지역 code, REGION_EVENTS_THIS_MONTH, 섹션·결과 순서 | 같은 POST | C7 |
| 찜 | 행동 분석 이벤트 없음 | FavoriteButton → useFavorites 낙관적 토글; 실패 시 롤백. 비로그인 클릭은 로그인 이동 | PUT/DELETE `/api/v1/wishlist/{type}/{targetKey}` | C8, C9 |
| 여행 묶음 | 공유 이벤트/공유 API 없음 | 생성·이름 변경·삭제·찜 이동 API만 있음 | `/api/v1/wishlist/collections`, `.../collection` | C9, C10 |
| 구글 지도 링크 | 공통 이벤트 없음 | 일반 `<a target=_blank>`; tracker/onClick 없음. 실제 링크는 Google Maps **장소 검색**이며 경로 안내 개시가 아님 | `https://www.google.com/maps/search/?api=1&...` | C1, C5, C11 |

공통 이벤트 속성은 `entityType, entityId, action, screenType, screenRef?, sectionId, sectionIndex?, itemIndex?, payload?, viewId, occurredAt`이다(C12). 통합 SEARCH payload는 `understoodType, residual, requestedType, groups={type:total}`이며 검색어는 entityId에 들어간다(C3). 검색어의 개인정보 포함 가능성을 막는 정제 로직은 해당 발화 코드에서 찾지 못했다. 이번 공개 요청에는 관광지명만 사용했다.

IMPRESSION 정의는 면적 50% 이상이 1초 연속 노출될 때이고, CLICK은 TrackedLink의 onClick이다(C4). 화면 렌더 전체/페이지 방문과 같지 않다. 카드·지도·코스 링크 모두에 자동으로 적용되는 계측도 아니다. 선언된 PLACE_HUB/ATTRACTION_LIST 타입만으로 실제 허브 발화를 인정하지 않았다.

광고의 `/api/v1/ads/events`(노출 토큰·fill)와 `/api/v1/ads/click/...`(리다이렉트)은 별도 경로이다. 광고 성과를 관광지 일반 검색 결과 클릭으로 합치면 안 된다(C13). 공개 HTML에는 Cloudflare beacon 스크립트 URL도 있으나 실행/페이로드/대시보드는 「미확인」이다.

## 2. 백엔드 수집·저장 경로

### 공통 행동 원장

코드 경로: FE POST `/api/v1/events` → gateway analytics-service(`http://analytics:8090`) → EventCollectController → EventCollectService → AnalyticsEventPublisher → Kafka `analytics.event.collected` → EventIngestionConsumer → ClickHouse `analytics.events`(B1~B5).

- FE는 20건 또는 5초에 flush한다. fetch는 X-Visitor-Id/X-Session-Id 헤더를 전송하고, 이탈(pagehide/hidden)에는 sendBeacon으로 식별자를 본문에 넣는다. 실패 시 재전송하지 않으며 큐는 요청 전에 비운다(C14).
- 수집 DTO는 1~100건, 대상/동작/대상 ID 필수. payload의 null 키는 제거한다. occurredAt은 브라우저 발생 시각이며 없으면 서버 현재 시각(B2).
- controller는 202와 accepted 건수를 응답한다. Kafka 발행은 비동기이고 실패는 콜백 로그로 남는다. **202/accepted는 ClickHouse 저장 성공의 증거가 아니다**(B1, B3).
- consumer는 100건 또는 10초 및 종료 시 DB에 배치 저장하고, 쓰기 실패 시 메모리 버퍼를 유지한다(B4). 실제 운영 전달·재시작 손실 여부는 「미확인」.
- `analytics.events`는 entity/action, 화면·섹션·순서, view/visitor/session/user, timestamp, payload, experiment 정보를 저장한다. V005 기준 **MergeTree**, 월 파티션, 90일 TTL. 고유 제약/자동 event_id 중복 제거 엔진은 없다(B5, B6).
- `analytics.attraction_popularity_daily`에는 관광지별 KST 일자 노출/클릭 수와 unique_clickers 집계 상태가 들어간다. 노출/클릭은 원장 `countIf`, 방문자는 `uniqStateIf(visitor_id)`이고 anonymous를 제외한다. 이 일 집계는 화면·섹션·세션 분모를 보존하지 않는다(B7).
- 스키마 초기화 코드는 SQL 적용 이력을 확인하여 한 번만 실행한다. 파일 내 과거 운영 관측 주석은 이번 운영 측정으로 인용하지 않았다. 현재 운영 스키마/이력은 「미확인」(B8).

### search의 다른 경로와 조회 원장 여부

- gateway `/api/search/**` → search:8083. 관광지 검색/상세 controller와 SearchAttractionService에서 사용자 행동 원장 쓰기는 찾지 못했다. SearchAttractionService는 결과마다 UUID searchId를 **생성하여 반환**하지만 원장 저장은 하지 않는다. Micrometer hybrid/bm25/intent/correction 카운터는 조회 처리 지표이며 사용자 submit/세션의 분모가 아니다(B9, B10).
- 상품용 POST `/api/search/impressions`, `/api/search/clicks`는 searchId/productId/categoryId/position/userId를 받아 Kafka `search.impression.logged`, `search.click.logged`로 발행한다. analytics bandit consumer는 Redis `bandit:state:{scope}:{productId}`의 클릭/노출을 증가시킨다. 이 경로에서 SEARCH 요청 행이나 ClickHouse 행동 원장 INSERT는 찾지 못했다(B11~B13).
- 해당 상품 이벤트의 Redis 중복 키는 `bandit:seen:{kind}:{searchId}:{productId}`, TTL 300초이며 scope는 실제 키에 없다. Redis 실패 시 첫 발생으로 간주하는 best-effort 방식이다. **관광지 허브 클릭에는 연결되어 있지 않다**(B13).
- search 소스/DDL에서 독립적인 SEARCH 검색 원장 및 관광지 상세 조회 원장 테이블은 확인되지 않았다. 공통 `analytics.events`의 SEARCH는 **통합 검색 FE가 보내는 행**이다. API 접근 로그·검색 응답 searchId·추천 카드 노출을 검색 제출/상세 방문 원장으로 대체할 수 없다. 운영에 코드 밖 별도 로그/원장이 있는지는 「미확인」.
- wishlist의 `wishlist_items`는 member_id/target_type/target_key/created_at 및 collection_id 상태를 저장한다. 회원×대상 UNIQUE, PUT은 기존 행 반환으로 멱등, DELETE는 행 제거. 보존 중인 찜의 생성 수는 셀 수 있으나 해제된 찜·재찜 전체 이력과 익명 세션 전환은 복원할 수 없다. `wishlist_collections`는 묶음 상태이며 공유 이력이 아니다(B14, C10).

### 크롤러·방문자·세션

- EventCollectController는 CrawlerUserAgents 판정 시 **202, accepted=0**으로 버린다(B1). UA 없음/공백, Google/Bing/Yeti 등 검색 봇, Meta·AI 봇, HeadlessChrome/PhantomJS/Lighthouse, `bot/`, `crawler`, `spider`, ReactorNetty 및 `(compatible; 이름...)` 패턴을 대소문자 무시로 제외한다(B15). 일반 UA로 위장한 봇 제외는 보장하지 않는다. 상품 bandit controller에는 이 UA 검사를 찾지 못했다(B11).
- gateway VisitorIdFilter는 vid 쿠키가 있으면 재사용, 없으면 UUID를 만든다. X-Visitor-Id를 **항상 덮어쓴다**. 새 vid는 path=/, HttpOnly, 365일, Domain/Secure/SameSite를 이 코드에서 지정하지 않는다. Cache-Control public 응답에는 새 쿠키를 싣지 않는다(B16).
- FE는 localStorage `kgd.visitorId`, sessionStorage `kgd.sessionId`에 각각 임의 ID를 둔다. 세션은 저장소/탭 수명이며 30분 비활동 종료 로직은 없다. 저장소 실패 시 그 런타임 임시 ID를 쓴다(C15).
- 두 방문자 정의는 같지 않다. 수집 요청의 FE visitor 헤더는 gateway에서 vid 기준 값으로 바뀐다. vid가 아직 없거나 호스트가 바뀌면 동일 방문자 연결이 불안정할 수 있다. 운영 쿠키/프록시 실제 동작은 「미확인」.
- **beacon 식별자 계약 불일치:** FE는 visitorId/sessionId를 본문에 넣지만 CollectEventsRequest에는 이 필드가 없고 controller는 헤더만 읽는다. 헤더 없는 beacon에서 sessionId는 visitorId로 fallback한다(B1, B2, C14). 「추정」: 추가 헤더 보정이 없는 배포라면 fetch의 탭 세션과 beacon의 방문자 세션이 섞여 uniqExact(session_id)가 부풀거나 합쳐질 수 있다. body 추가 필드의 운영 수용/거절 여부는 「미확인」.

## 3. 계획의 6종 이벤트 대응

| 필요한 이벤트 | 현재 대응 판정 | 현재 집계 가능한 범위/한계 | 최소 보완 |
|---|---|---|---|
| search_submitted | **다른 이름으로 일부 있음:** SEARCH×SEARCH, UNIFIED_SEARCH. **허브 없음** | 성공한 통합 검색 화면 단위, 0건 포함. 제출 수가 아니며 오류 제출 누락·타입 변경 포함 | 허브의 실제 제출마다 기록; 제출/완료/실패 구분, searchId와 조건 연결 |
| filter_applied | **없음** | 통합 검색 대상 변경은 SEARCH로 다시 기록되지만 필터 적용 사건으로 구분 불가 | 변경한 필터·전후 값·적용 원인·연결 searchId |
| result_clicked | **다른 이름으로 일부 있음:** ATTRACTION×CLICK | 통합 결과·지역 이달 행사·상세 주변/추천 링크만. **허브 카드 선택/지도 핀 클릭 없음** | 허브 선택 지점 연결; 원 목록·검색 ID·결과 순서 |
| save_completed | **없음**(상태 PUT은 있음) | 현존 wishlist_items 생성 상태만; 행동 완료·해제 이력/검색 귀속 불가 | 서버 성공 후 기록; 신규 저장과 멱등 재응답 구분 |
| collection_shared | **없음**(공유 기능도 확인 안 됨) | 묶음 CRUD는 공유가 아님 | 새 공유 기능에서 시도/성공·채널 정의 후 기록 |
| directions_clicked | **없음**(지도 장소 검색 링크는 있음) | 외부 링크 클릭을 집계하지 않음; 길찾기 시작과도 다름 | 우선 지도 열기와 경로 안내 의도 정의를 분리하여 클릭 기록 |

「있음(동일 이름)」에 해당하는 이벤트는 6종 모두 없다. 다른 이름의 부분 대응을 place 허브의 동일 행동으로 인정하지 않았다.

## 4. 분모·중복 기준과 기준선 제안

| 분모/단위 | 셀 수 있는 위치 | 판정 |
|---|---|---|
| place 허브 검색 제출 수 | 현재 공통 원장 발화 없음 | **불가**. GET 수에는 페이지·지도 영역·overlay·뽑기·재시도 등이 섞이며 FE 캐시는 GET도 생략 |
| 통합 검색 성공 화면 수 | analytics.events: entity_type=SEARCH, action=SEARCH, screen_type=UNIFIED_SEARCH의 고유 view_id | **코드상 가능**, 운영 적재 「미확인」. search_submitted와 다른 정의 |
| 관측 세션 수 | analytics.events의 고유 session_id | **제한적**. 계측 이벤트가 발생한 세션만이며 허브만 방문/무클릭 세션 누락; fetch/beacon 세션 정의 불일치부터 해결 필요 |
| 전체 방문 세션 수 | 독립 session_start/page_view 발화 확인 안 됨 | **불가**. enum SESSION_START 존재만으로 발화를 인정하지 않음 |
| 추적 링크 CTR | 같은 screen/view/대상에서 IMPRESSION·CLICK | **코드상 제한적으로 가능**. 순위·섹션 및 중복 규칙 고정, 저장 성공 확인 필요 |
| 찜 완료율 | 현존 찜 상태 / 세션 또는 검색 | **불가**. 성공 이벤트와 검색/세션 귀속 없음 |

중복은 다음처럼 구분해야 한다.

1. FE tracker 키: `(viewId, entityType, entityId, action)`. 같은 대상을 여러 섹션에서 눌러도 섹션별로 다시 기록하지 않는다. 반복 클릭은 1건, 새 view는 새 건(C14).
2. 서버 eventId: `viewId:entityId:action`; **entityType/섹션/visitor/session은 빠진다**. viewId 없으면 임의 UUID(B2). 서로 다른 타입의 동일 ID가 한 통합 화면에 있으면 eventId만으로 합칠 위험이 있다.
3. ClickHouse는 중복 행을 저장할 수 있다. 잠정 기준선은 `uniqExact(tuple(view_id, entity_type, entity_id, action))` 등 코드 단위에 맞춘 쿼리로 계산하고, 빈 view_id의 행은 별도 품질군으로 분리해야 한다. section을 넣어도 이미 FE에서 사라진 다른 섹션 클릭은 복구되지 않는다. 기존 popularity의 countIf는 중복 제거 집계가 아니다(B6, B7).
4. 클릭 전에 1초 노출을 채우지 못할 수도 있다. 모든 클릭을 노출 건수로 나누면 관측 CTR이 왜곡될 수 있으므로 동일 view/대상의 노출과 연결된 클릭률과 전체 클릭 수를 별도로 둔다.

**2단계 전 제안:** 허브의 submit·filter·result 선택·save 성공·지도 클릭 연결, 무행동 방문도 포함하는 세션 시작/페이지 방문, fetch/beacon 동일 식별자 계약, 위 중복 단위를 먼저 확정한다. 짧은 QA에서 실제 수집 응답과 원장 적재를 확인한 다음 그 정의로 사전 기간을 측정한다. 이는 추가 설계 제안이며 이번에 구현하지 않았다.

## 5. 라이브 읽기 확인과 미확인

공개 API 확인 시각: **2026-10-08 04:27:33~ KST**. 다음은 HTTP 읽기 관측이며 브라우저 조작/계측 요청 캡처가 아니다.

| 순서 | URL | 관측 |
|---|---|---|
| 1 | https://place.1989v.com/ | 200, HTML 13,509 문자, Cache-Control `no-cache, must-revalidate`; 제목 `한국 관광지 검색 — 지역별 가볼 만한 곳·여행지 지도 \| K-관광`; entry `/assets/index-C5A32Ajr.js`와 Cloudflare beacon URL 포함 |
| 2 | https://api.1989v.com/api/search/attractions?lang=ko&keyword=%EA%B2%BD%EB%B3%B5%EA%B6%81&page=0&size=1 | 200, totalElements=265, 결과 id=1/경복궁. data에 searchId/attractions/totalElements/totalPages/currentPage/correctedKeyword/attributeFacets 존재. 임의 검색 ID는 기록하지 않음 |
| 3 | https://api.1989v.com/api/search/attractions/1 | 200, 경복궁 상세 반환 |

재현 명령 형태(응답 원문은 개인정보/식별자 없이 위 표에 필요한 필드만 기록):

```python
# python3 - <<'PY' ... PY 로 실행; 각 요청 timeout=20~25초
req = urllib.request.Request(url, headers={'User-Agent': browser_ua})
with urllib.request.urlopen(req, timeout=20) as response:
    data = json.load(response)  # HTML은 read().decode()
# 두 API 요청 사이 time.sleep(0.3)
```

- **「미확인」브라우저 검색 1회·결과 클릭 1회 및 계측 URL/실제 payload/응답:** Playwright/Puppeteer/ws 패키지는 현재 Node 환경에서 unavailable이었다. 독립 Chrome 프로필은 브라우저 부수 파일을 생성하므로 지정 경로의 새 증거 파일만 허용한 쓰기 제한을 우선하여 실행하지 않았다. Google Chrome 154.0.8037.98은 버전 조회만 했고 헤드리스 프로세스는 띄우지 않았다. 사용자 Chrome/MCP 프로필은 접근하지 않았다.
- **「미확인」배포 코드와 origin/main 동일성, vid 쿠키·세션 실제 전달, Kafka/ClickHouse 적재·운영 조회수·분모.** API GET 성공은 이 항목을 확인하지 않는다. 합성 이벤트 POST는 하지 않았다.
- 공개 스크립트 URL만 확인했고 JS 실행 및 Cloudflare 서비스 요청은 하지 않았다. 실제 계측 POST를 관측하지 못했으므로 payload 예시를 라이브 사실로 제시하지 않았다.

## 6. 결론의 세 묶음

- **기존 정의로 제한적 기준선 후보:** 통합 검색 성공 화면 수(SEARCH), 그 화면의 결과 클릭/가시 노출, 지역 이달 행사 및 상세 주변·추천 링크 클릭/가시 노출. 운영 적재 확인 후에만 수치 기준선을 확정할 수 있으며 허브 전환율과 분리한다.
- **최소 추가 필요:** 허브 search_submitted/filter_applied/result_clicked, save_completed, 지도 열기 클릭(길찾기 정의 별도), 전체 세션 분모, 식별자·중복 계약 정리. 검색 원장/searchId가 있다는 전제로 착수하면 안 된다.
- **새 기능용:** collection_shared 및 실제 경로 안내 액션. 공유 성공/링크 복사/공유 시도와 지도 검색/길찾기를 구분한 뒤 이벤트 정의를 정한다.

## 코드 근거 색인

모든 줄 번호는 위 origin/main SHA의 `git show` 출력 기준이다. 경로 뒤 숫자는 시작 줄이다.

| ID | 경로:줄 | 확인 내용 |
|---|---|---|
| C1 | portal-fe/src/pages/place/PlacePage.tsx:310, 910, 1030, 1317, 1344 | 검색 쿼리/submit/필터/지도 링크/카드 선택 |
| C2 | portal-fe/src/api/placeApi.ts:404 | 관광지 검색·상세 API |
| C3 | portal-fe/src/pages/search/UnifiedSearchPage.tsx:29, 45, 213 | viewId, SEARCH 발화 및 결과 TrackedLink |
| C4 | portal-fe/src/analytics/TrackedLink.tsx:25; portal-fe/src/analytics/useImpression.ts:13 | 클릭 및 가시 노출 정의 |
| C5 | portal-fe/src/pages/place/AttractionPage.tsx:221, 507, 608 | 상세 view/지도 링크/추천 계측 |
| C6 | portal-fe/src/pages/place/NearbyExplore.tsx:240, 283 | 주변 결과 계측 |
| C7 | portal-fe/src/pages/place/RegionPage.tsx:155, 271 | 지역 행사 계측 |
| C8 | portal-fe/src/components/favorite/FavoriteButton.tsx:68; portal-fe/src/components/favorite/useFavorites.ts:28 | 찜 클릭·낙관적 토글/롤백 |
| C9 | portal-fe/src/api/wishlistApi.ts:47, 83 | 찜·묶음 API |
| C10 | portal-fe/src/components/favorite/FavoriteCollections.tsx:109; wishlist/feature/src/main/resources/wishlistdb/migration/V3__collections.sql | 묶음 조작과 저장 상태 |
| C11 | portal-fe/src/pages/place/googleMaps.ts:44 | 지도 search URL |
| C12 | portal-fe/src/analytics/events.ts:3, 42 | 이벤트 모델 |
| C13 | portal-fe/src/components/ads/adsApi.ts:55, 68, 232 | 광고 전용 경로·식별자 |
| C14 | portal-fe/src/analytics/tracker.ts:12, 23, 45, 94 | flush·중복·식별자·이탈 |
| C15 | portal-fe/src/analytics/identity.ts:8, 38 | visitor/session/view 생성 |
| B1 | analytics/app/src/main/kotlin/com/kgd/analytics/presentation/event/controller/EventCollectController.kt:27, 43 | 수집·크롤러·헤더 fallback |
| B2 | analytics/app/src/main/kotlin/com/kgd/analytics/presentation/event/dto/EventCollectDtos.kt:20, 56 | DTO·eventId 생성 |
| B3 | analytics/app/src/main/kotlin/com/kgd/analytics/application/event/service/EventCollectService.kt:19; common/src/main/kotlin/com/kgd/common/analytics/AnalyticsEventPublisher.kt:11 | accepted·비동기 Kafka 발행 |
| B4 | analytics/app/src/main/kotlin/com/kgd/analytics/infrastructure/messaging/EventIngestionConsumer.kt:29 | Kafka→배치/시간 flush |
| B5 | analytics/app/src/main/kotlin/com/kgd/analytics/infrastructure/persistence/EventRepositoryAdapter.kt:19 | INSERT 컬럼 |
| B6 | analytics/app/src/main/resources/clickhouse/analytics/V005__events_two_axis.sql:13 | 원장 스키마/엔진/TTL |
| B7 | analytics/app/src/main/kotlin/com/kgd/analytics/infrastructure/popularity/ClickHouseAttractionPopularityAdapter.kt:51; analytics/app/src/main/resources/clickhouse/analytics/V006__attraction_popularity_daily.sql:9; V007__attraction_unique_clickers.sql:17(동일 디렉토리) | 관광지 일 집계 |
| B8 | analytics/app/src/main/kotlin/com/kgd/analytics/infrastructure/schema/ClickHouseSchemaInitializer.kt:32 | 스키마 적용 이력 |
| B9 | gateway/src/main/resources/application.yml:37; gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt:369 | analytics/search 라우팅 |
| B10 | search/app/src/main/kotlin/com/kgd/search/presentation/search/controller/AttractionSearchController.kt:41, 100; search/app/src/main/kotlin/com/kgd/search/application/attraction/service/SearchAttractionService.kt:43, 79, 123 | 관광지 조회 경로/searchId/처리 카운터 |
| B11 | search/app/src/main/kotlin/com/kgd/search/presentation/search/controller/SearchController.kt:56 | 상품 노출·클릭 수집 |
| B12 | search/app/src/main/kotlin/com/kgd/search/infrastructure/bandit/BanditEventKafkaAdapter.kt:25, 74 | 상품 이벤트 토픽 |
| B13 | analytics/app/src/main/kotlin/com/kgd/analytics/infrastructure/bandit/SearchClickConsumer.kt:26; SearchImpressionConsumer.kt:16(동일 디렉토리); BanditStateRedisWriter.kt:43(동일 디렉토리) | Redis 집계와 5분 중복 방어 |
| B14 | wishlist/feature/src/main/kotlin/com/kgd/wishlist/application/wishlist/service/WishlistService.kt:30, 52; wishlist/feature/src/main/resources/wishlistdb/migration/V2__polymorphic_target.sql:4 | 찜 상태/멱등/삭제 |
| B15 | common/src/main/kotlin/com/kgd/common/web/CrawlerUserAgents.kt:20, 42 | 제외 UA 규칙 |
| B16 | gateway/src/main/kotlin/com/kgd/gateway/filter/VisitorIdFilter.kt:27 | vid 발급/덮어쓰기/캐시 예외 |
