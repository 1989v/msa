# 발견 판정: place 방문 근거 표시와 가는 법 스펙 (리뷰 A·B 전 40건)

**결론: 40건 모두 유지합니다(keep 40 / demote 0 / dismiss 0).** 인용된 `file:line` 을 하나씩 열어 봤는데, 원문과 다른 인용이 없었습니다. 표준에서 허용된 패턴이라는 근거도, 레포에 같은 패턴이 있다는 근거도 찾지 못했습니다. 그래서 강등·기각할 근거가 없습니다.

D1 은 BLOCK 을 유지합니다. 스펙 결정(spec:43)과 위반(spec:44, `search/glossary.md:77`)이 둘 다 인용돼 있어서입니다.

두 리뷰가 같은 결함을 따로 지적한 곳이 여럿 있습니다. 중복은 기각 사유가 아니라서 둘 다 유지했고, 편집 목록에서는 한 번에 고치도록 묶었습니다.

워크트리 루트: `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl` (아래 경로는 모두 여기 기준).

## 1. 묶음 표

| 묶음 | 발견 | 판정 · 등급 | 고칠 곳 |
|---|---|---|---|
| 「방문자」라는 말 | D1 · I0 | keep · D1 BLOCK, I0 REVISE | SR-1.2·1.3, 용어 표, search 용어집 |
| 용어 정의·찜 이름 | D2 · D3 | keep · REVISE | 용어 표 새로 둠, 절 제목 |
| 찜 하한의 성격·실시간 수 | S1 | keep · REVISE | SR-3.3·3.5 |
| 찜 수가 언어 문서별 | I8 · D4 | keep · MINOR / REVISE | SR-3.2 |
| 색인 읽기 경로·`searchReadRequired` | A1 · I7 | keep · REVISE / MINOR | SR-3.2·6.4 |
| 절 항목 하한·하이브리드 경로 | I4 · T1 · U1 | keep · REVISE | SR-3.4·3.6·4.2 |
| 하한 대조의 「선례」가 실제로 없음 | A3 · T4 · T5 | keep · MINOR / REVISE / REVISE | SR-1.4, tasks 1.1·1.3·1.4 |
| 회귀 주입·경계 테스트 | T3 · T6 · T7 · T8 | keep · REVISE ×3, MINOR | 검증, tasks 다수 |
| 시도 순위 | I5 · S3 · U5 · U6 · U7 | keep · REVISE ×4, MINOR | SR-2 |
| 원천 교체가 한 번에 끝나지 않음 | I2 · U4 | keep · REVISE | SR-5.2·5.4·6.3 |
| access 의 참조·옛 행·불변식 | A2 · D5 · I3 · D6 | keep · REVISE, MINOR ×2, REVISE | SR-5.4·6.2·6.3 |
| 원천 열 변화·파일 받기 | T2 · S4 | keep · REVISE / MINOR | SR-5.1·5.2 |
| 격자·메모리·실행 시각 | I1 · I6 · U8 | keep · REVISE, MINOR ×2 | SR-6.1, 무료 티어 절 |
| 가는 법 화면 | U2 · U3 | keep · REVISE | SR-7 |
| 경계·네트워크 정책 | A4 · S2 · I9 | keep · MINOR | SR-3.1·3.7, TG0 |

## 2. 발견별 판정 JSON

```json
[
 {"id":"A1","verdict":"keep","severity":"REVISE","evidence":[{"file":"build.gradle.kts","line":537,"quote":"val searchReadRequired = mapOf( \"attractions\" to setOf(… \"congestion\", … \"relatedPlaces\""},{"file":"search/CLAUDE.md","line":38,"quote":"읽기 클래스는 `ignoreUnknown = true` 라 필드를 빠뜨려도 컴파일이 통과하고 값만 조용히 빈다"}],"reason":"인용이 원문과 같고, 새 필드 savedCount·access 가 필수 읽기 목록에 없어 화면에서 조용히 빠질 수 있다 — 반증 없음."},
 {"id":"A2","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":69,"quote":"받은 원천(철도/버스)의 행을 자료 기준일로 통째로 교체하고"},{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":71,"quote":"`attraction_access`(attraction_id, kind `RAIL|BUS`, stop 참조, `distance_m`"}],"reason":"통째로 교체되는 표의 대리 키를 참조하는 모양이 스펙에 그대로 있다 — 반증 없음."},
 {"id":"A3","verdict":"keep","severity":"MINOR","evidence":[{"file":"portal-fe/src/pages/place/placeAttributes.ts","line":285,"quote":"search `AttractionClickSignal.MIN_SAMPLE`(search/domain) 과 같은 값이어야 한다"}],"reason":"portal-fe 테스트에서 MIN_SAMPLE·AttractionClickSignal 을 grep 하면 0건이다. 주석으로만 묶여 있어 「선례」가 실제로 없다."},
 {"id":"A4","verdict":"keep","severity":"MINOR","evidence":[{"file":"k8s/base/network-policy/04-allow-backend-to-backend.yaml","line":135,"quote":"kgd.io/host-of: codedictionary"},{"file":"account/app/src/main/kotlin/com/kgd/account/AccountApplication.kt","line":19,"quote":"\"com.kgd.wishlist\","}],"reason":"k8s/CLAUDE.md:115 가 폴드를 따라가는 정책에 host-of 를 요구하는데, 스펙이 든 선례(:98)에는 그 표식이 없다."},
 {"id":"I0","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":44,"quote":"「이 사이트 방문자 클릭(같은 사람은 한 번) · 이 관광지 · 최근 14일」"}],"reason":"spec:43 의 규칙을 바로 다음 줄이 어긴다(D1 과 같은 결함)."},
 {"id":"I1","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":75,"quote":"격자(0.02°) 버킷으로 후보를 좁히고 하버사인으로 직선거리를 구한다"}],"reason":"위도 37°에서 경도 0.02° 는 약 1.78km 로 반경 2,000m 보다 짧다. 계산 반증 없음."},
 {"id":"I2","verdict":"keep","severity":"REVISE","evidence":[{"file":"place/ingest/src/place_client.py","line":199,"quote":"그 시군구의 행을 통째로 바꾼다 … 보내지 않은 시군구는 건드리지 않는다"},{"file":"place/ingest/src/place_client.py","line":16,"quote":"BULK_CHUNK = 2000          # place 가 요청당 2000건으로 제한한다"}],"reason":"기존 「통째 교체」는 모두 요청 하나 단위다. 여러 묶음에 걸친 교체에서 중간 실패를 어떻게 할지 스펙이 정하지 않았다."},
 {"id":"I3","verdict":"keep","severity":"MINOR","evidence":[{"file":"place/ingest/src/place_client.py","line":72,"quote":"def fetch_attractions() -> list[dict]: … 전량 스캔 — id 키셋(`afterId`)으로 id 오름차순"}],"reason":"상태로 거르지 않고, 결과가 0인 관광지는 보내지 않아 옛 행이 남는다 — 반증 없음."},
 {"id":"I4","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/application/attraction/service/SearchAttractionService.kt","line":188,"quote":"if (!hybrid.enabled || !queryVector.enabled || geo?.sortByDistance == true || sortByEventStart) {"},{"file":"search/batch/src/main/kotlin/com/kgd/search/infrastructure/job/AttractionApiReindexTasklet.kt","line":328,"quote":"uniqueClickers14d = uniqueClickers?.let { it[attraction.id.toString()] ?: 0 },"}],"reason":"벡터 레그를 끄는 조건에 saved·clicked 가 없고, 재색인이 클릭 없는 관광지를 0으로 싣는다."},
 {"id":"I5","verdict":"keep","severity":"REVISE","evidence":[{"file":"place/feature/src/main/kotlin/com/kgd/place/infrastructure/cache/RegionCacheConfig.kt","line":93,"quote":".disableCreateOnMissingCache()"}],"reason":"등록하지 않은 캐시 이름은 실행 중에 실패하는데 tasks 2.2 에 등록 작업이 없다."},
 {"id":"I6","verdict":"keep","severity":"MINOR","evidence":[{"file":"k8s/base/place-ingest/cronjob-air-stations.yaml","line":19,"quote":"schedule: \"50 16 * * 0\""},{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":96,"quote":"`transit-stops` 주 2회 파일 받기"}],"reason":"월 KST 01:30(일 UTC 16:30) 실행이 air-stations 와 20분 차이로 붙고, 주 1회(spec:68)와 주 2회(spec:96)가 어긋난다."},
 {"id":"I7","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":59,"quote":"재색인 주기 하루) — 기준 시각을 붙인다"}],"reason":"색인 매핑에 기준 시각 필드가 없다 — 반증 없음."},
 {"id":"I8","verdict":"keep","severity":"MINOR","evidence":[{"file":"portal-fe/src/pages/place/AttractionPage.tsx","line":361,"quote":"targetKey={attraction.id}"},{"file":"wishlist/CLAUDE.md","line":30,"quote":"targetKey 는 **불투명 문자열** (game·blog=slug, product·attraction=숫자 id 문자열)"}],"reason":"찜이 언어 문서 id 단위로 쌓인다는 것이 원문으로 확인된다."},
 {"id":"I9","verdict":"keep","severity":"MINOR","evidence":[{"file":"wishlist/feature/src/main/resources/wishlistdb/migration/V2__polymorphic_target.sql","line":15,"quote":"ADD CONSTRAINT uk_member_target UNIQUE (member_id, target_type, target_key);"}],"reason":"인덱스가 member_id 로 시작해 target 기준으로 묶는 집계를 돕지 못한다(V3·V4 에도 해당 인덱스 없음)."},
 {"id":"S1","verdict":"keep","severity":"REVISE","evidence":[{"file":"wishlist/feature/src/main/kotlin/com/kgd/wishlist/presentation/wishlist/controller/WishlistController.kt","line":116,"quote":"이 대상을 몇 명이 찜했나 — **로그인 없이 부를 수 있다.**"},{"file":"portal-fe/src/api/gameApi.ts","line":236,"quote":"`/api/v1/wishlist/count?type=GAME&key=${encodeURIComponent(slug)}`"}],"reason":"공개 API 가 정확한 수를 이미 내고 있고, 관광지 찜 단추는 수를 부르지 않는다. 하한을 개인정보 통제라고 한 이유와 「실시간 수」 문장이 모두 사실과 다르다."},
 {"id":"S2","verdict":"keep","severity":"MINOR","evidence":[{"file":"gateway/src/test/kotlin/com/kgd/gateway/GatewayRouteAuthSpec.kt","line":427,"quote":"Given(\"클러스터 안 전용 경로 /internal\")"}],"reason":"기존 테스트가 이미 충족한다는 지적이 맞다. min 하한을 서버에서 막는 규정은 스펙에 없다."},
 {"id":"S3","verdict":"keep","severity":"MINOR","evidence":[{"file":"place/feature/src/main/kotlin/com/kgd/place/application/region/service/RegionVisitorService.kt","line":28,"quote":"val level = RegionVisitorDaily.requireLevel(code)"}],"reason":"기존 추이 API 는 코드를 먼저 거르는데, 새 순위 API 스펙에는 그 단계가 없다."},
 {"id":"S4","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":68,"quote":"파일 주소는 env(`TRANSIT_RAIL_FILE_URL`·`TRANSIT_BUS_FILE_URL`)로 받는다"}],"reason":"받는 쪽의 크기·형식 제한이 스펙에 없다 — 반증 없음."},
 {"id":"T1","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/tasks.md","line":43,"quote":"값 없는 문서는 뒤"},{"file":"search/batch/src/main/kotlin/com/kgd/search/infrastructure/job/AttractionApiReindexTasklet.kt","line":328,"quote":"?: 0 },"}],"reason":"size=6 정렬 응답에 하한 미만 문서가 섞여 절이 숨지 않는다(I4 와 같은 결함)."},
 {"id":"T2","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":69,"quote":"받기 실패·0행이면 이전 행을 지우지 않고 Job 을 실패시킨다"}],"reason":"실패 조건이 받기 실패·0행뿐이라 열 이름이 바뀌거나 열이 늘어도 잡지 못한다."},
 {"id":"T3","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/app/src/test/kotlin/com/kgd/search/presentation/render/AttractionPageRendererTest.kt","line":380,"quote":"val min = AttractionClickSignal.MIN_SAMPLE"}],"reason":"기존 테스트가 경계값을 상수 이름으로 만들어서, 상수를 낮추는 회귀를 넣어도 초록이 된다."},
 {"id":"T4","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/placeAttributes.ts","line":287,"quote":"export const FREQUENTLY_CLICKED_MIN = 5;"}],"reason":"FE 테스트가 서버 상수를 읽는 코드가 0건이라 「선례대로」라는 서술이 사실과 다르다(A3 과 같은 결함)."},
 {"id":"T5","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/tasks.md","line":19,"quote":"금지어(「많이 본」「인기」「핫플」)가 국·영 문구 어디에도 없음(문구 객체를 순회해 판정)"}],"reason":"검사 대상이 visitSignals.ts 하나뿐이고 렌더러 문구는 아무도 보지 않는다."},
 {"id":"T6","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/tasks.md","line":35,"quote":"2.4 상세 근거 줄 … 기존 `/visitors` 응답 재사용(새 API 없음)"}],"reason":"2.4·6.3 등 테스트 항목이 없는 수용 기준이 있다는 것이 tasks 원문으로 확인된다."},
 {"id":"T7","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/tasks.md","line":14,"quote":"0.5 wishlist ATTRACTION 대상 찜 분포(3 이상인 대상 수)를 `ssh msa-oci` 로 센다"}],"reason":"TG0 이 클릭 분포를 재지 않아, CDP 검증 표본이 있는지 미리 알 수 없다."},
 {"id":"T8","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/standards/test-rules.md","line":17,"quote":"테스트 파일 이름: 구현체와 동일 이름 + `Test` suffix"}],"reason":"컨트롤러 클래스 이름이 tasks 3.2 에 정해져 있지 않다."},
 {"id":"D1","verdict":"keep","severity":"BLOCK","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":43,"quote":"「방문자」라는 말은 `KTO_REGION_VISITORS` 에만 쓴다"},{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":44,"quote":"「이 사이트 방문자 클릭(같은 사람은 한 번)"},{"file":"search/glossary.md","line":77,"quote":"최근 14일 관광지 상세를 클릭한 고유 방문자 수"}],"reason":"스펙 결정과 문서 위반이 둘 다 인용돼 BLOCK 자격을 갖춘다."},
 {"id":"D2","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/context-map.md","line":18,"quote":"BC 표 18-38행에 place 행 없음(grep 'place' 0건), place/glossary.md 없음"}],"reason":"place 용어집이 없다는 것이 실측으로 확인된다."},
 {"id":"D3","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/components/favorite/FavoriteButton.tsx","line":33,"quote":"title: '찜하기', undoTitle: '찜 해제',"},{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":54,"quote":"### SR-3 「많이 저장한 곳」 — 찜 수"}],"reason":"한 근거를 「찜」과 「저장」 두 이름으로 부른다."},
 {"id":"D4","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":2001,"quote":"targetKey={attraction.id}"}],"reason":"I8 과 같은 사실이다. 근거 줄의 대상 칸 「이 관광지」 정의에 영향을 준다."},
 {"id":"D5","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":71,"quote":"stop 참조"}],"reason":"A2 와 같은 결함 — 반증 없음."},
 {"id":"D6","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":77,"quote":"결과는 관광지 단위로 통째로 교체(`PUT /internal/attractions/access`)"}],"reason":"PUT 쪽 검증 규정이 없다 — 반증 없음."},
 {"id":"U1","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":65,"quote":"`sort=clicked`(새 값) 상위 6, 3 미만이면 숨김"}],"reason":"T1 을 사용자 흐름 쪽에서 본 것이다."},
 {"id":"U2","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":34,"quote":"BIS 연계 지자체만 담긴다 — 빠진 군이 있다"},{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":81,"quote":"항목이 없으면 절을 숨긴다"}],"reason":"「자료 없음」과 「주변에 없음」을 가르는 규정이 없다."},
 {"id":"U3","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":81,"quote":"「{역명}역 ({노선}) · 직선거리 {N}m」"}],"reason":"「서울역역」이 될 수 있고, 노선별 행 때문에 환승역이 두 번 나올 수 있다. TG0 전이라 반증할 수 없다."},
 {"id":"U4","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":76,"quote":"범위 안에 없으면 행을 만들지 않는다"}],"reason":"I2·I3 과 같은 결함을 흐름 쪽에서 본 것이다."},
 {"id":"U5","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":48,"quote":"다 받은 달 판정은 지금 월 합계 규칙과 같다"}],"reason":"시도 범위의 「다 받은 달」 정의와 시군구가 적은 시도의 처리가 비어 있다."},
 {"id":"U6","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/spec.md","line":48,"quote":"현지인 제외 — 생활 이동이 섞여 관광 신호가 아니다"}],"reason":"외지인 값에 통근이 포함되는지 원천 정의가 인용돼 있지 않다 — 반증 없음."},
 {"id":"U7","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/architecture/data-sources.md","line":238,"quote":"**공개 지연 30일** — 2026-10-02 18시에 받은 가장 최근 날이 2026-09-02 였다"}],"reason":"같은 시군구 관광지 전부에 같은 숫자가 붙는다 — 사용자 판단 항목이다."},
 {"id":"U8","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/specs/2026-10-10-place-visits-and-access/context/open-questions.yml","line":44,"quote":"찜 절이 전국에서 거의 안 나오면 절은 두되 숨김 상태로 배포"}],"reason":"주기 표기가 어긋나 있고, 절이 이미 데이터 규칙으로 숨으므로 별도 숨김 스위치는 필요 없다(YAGNI)."}
]
```

## 3. spec.md 편집 목록

**E1 (D1·I0) SR-1.2 바꿈.** 찾을 문구: 「「방문자」라는 말은 `KTO_REGION_VISITORS` 에만 쓴다 — 사이트 클릭은 방문이 아니다.」
```text
2. 금지 이름: 「많이 본 곳」「인기」「핫플」. 「방문자」라는 말은 `KTO_REGION_VISITORS` 에만 쓴다 — 사이트 클릭은 방문이 아니다. 이 사이트에서 행동한 사람은 「이용자」(영문 「people on this site」)로 부르고 「방문자/visitors」를 쓰지 않는다. 코드 식별자(`visitor_id`·`uniqueClickers14d`)는 바꾸지 않는다.
```

**E2 (D1·I0) SR-1.3 예시 바꿈.** 바꿀 문장:
```text
「이 사이트 방문자 클릭(같은 사람은 한 번) · 이 관광지 · 최근 14일」
```
새 문장:
```text
「이 사이트 이용자 클릭(같은 사람은 한 번) · 이 관광지 · 최근 14일」
```

**E3 (A3·T4) SR-1.4 바꿈.** 바꿀 문장: 「두 값이 같은지 테스트가 본다(선례 `FREQUENTLY_CLICKED_MIN` ↔ `AttractionClickSignal.MIN_SAMPLE`).」
```text
두 값이 같은지 보는 테스트를 **새로 만든다** — 지금 `FREQUENTLY_CLICKED_MIN` ↔ `AttractionClickSignal.MIN_SAMPLE` 은 주석으로만 묶여 있고 대조하는 테스트가 없다. FE 테스트가 Kotlin 상수 파일을 읽어 `const val (SAVED_MIN|MIN_SAMPLE) = (\d+)` 를 뽑고, 0건이면 실패한다. `FREQUENTLY_CLICKED_MIN` 은 `visitSignals.ts` 로 옮기고 `placeAttributes.ts` 는 다시 내보내기만 한다(사본 금지). 서버 렌더 근거 줄 문구는 FE 와 골든 픽스처로 대조한다(`AttractionJsonLdParityTest` 방식).
```

**E4 (D2·D3) SR-1 끝에 5번 추가.**
```text
5. 용어(place 용어집이 생기기 전까지 여기가 원본): 방문자 = 관광공사 이동통신 추정 인원(`KTO_REGION_VISITORS`) · 타지 방문자 = 외지인+외국인 · 다 받은 달 = 시도 안 모든 시군구가 그 달의 모든 날을 받은 달 · 이용자 = 이 사이트에서 행동한 사람 · 찜 = wishlist 항목(코드 이름 `savedCount`·`SITE_SAVES` 의 「saved」는 찜을 뜻한다) · 근거 줄 = 원천·대상·기간을 밝히는 출처 문장(배지 줄의 「많이 클릭한 곳」 배지와 다르다 — 배지는 그대로 둔다) · 직선거리 = 두 좌표 사이 하버사인 거리.
```

**E5 (D3) 절 제목 「많이 저장한 곳」을 전부 「많이 찜한 곳」으로 바꿈.** SR-3 제목, SR-3.4 본문, tasks 4.1 이 대상입니다.
```text
### SR-3 「많이 찜한 곳」 — 찜 수
```

**E6 (S1, 권고 a) SR-3.3 바꿈.** 바꿀 문장: 「미만은 색인에 싣지 않는다(한두 명의 행동이 드러나지 않게).」
```text
미만은 색인에 싣지 않는다. 이 하한은 **표시 정책**이다 — 적은 수는 신호가 아니라서 둔다. 개인정보 통제가 아니다: 공개 `GET /api/v1/wishlist/count` 가 로그인 없이 어떤 대상이든 정확한 수를 낸다(이번 범위에서 좁히지 않는다).
```

**E7 (S1·I7) SR-3.5 바꿈.** 바꿀 문장: 「찜 단추의 실시간 수와 다를 수 있다(재색인 주기 하루) — 기준 시각을 붙인다.」
```text
기준 시각은 색인 `signalsAsOf`(date, `index:false`, 재색인 날짜)를 읽어 「{YYYY-MM-DD} 기준」으로 붙인다.
```

**E8 (A1·D4·I8) SR-3.2 끝에 덧붙임.**
```text
`savedCount` 는 **언어 문서 id 단위**로 센다 — 국·영 찜을 합치지 않는다(합치려면 `alternateId` 가 필요한데 기본값이 꺼져 있다). 근거 줄의 대상 「이 관광지」는 이 문서를 뜻한다. 값이 지나는 경로: 쓰기 `AttractionIndexDocument` → 읽기 `AttractionSearchDocument` → `SearchAttractionUseCase` 결과 → `SearchAttractionService` 매핑 → `AttractionPageRenderer` → FE `placeApi.ts`. `searchReadRequired["attractions"]` 에 `savedCount`·`signalsAsOf` 를 넣는다.
```

**E9 (I4·T1·U1) SR-3.6 바꿈.** 바꿀 문장: 「검색 API `sort` 에 `saved` 를 더한다(없는 값은 지금처럼 relevance).」
```text
6. 검색 API `sort` 에 `saved`·`clicked` 를 더한다. 이 정렬은 하한을 함께 건다 — `saved` 는 `savedCount ≥ SAVED_MIN`, `clicked` 는 `uniqueClickers14d ≥ FREQUENTLY_CLICKED_MIN` 인 문서만 돌려준다(하한 미만·값 없는 문서는 응답에 없다). 두 정렬은 벡터 레그를 끈다(`resolveEmbedding` 조건에 추가) — 하이브리드 경로에는 정렬을 걸 수 없다.
```

**E10 (I4·T1·U1) SR-3.4 와 SR-4.2 의 「항목이 3 미만이면 절을 숨긴다」 / 「3 미만이면 숨김」 바꿈.**
```text
응답(이미 하한 이상만 담긴다)이 3건 미만이면 절을 숨긴다.
```

**E11 (A4·S2) SR-3.7 바꿈.** 바꿀 문장: 「게이트웨이는 `/internal/**` 를 막는다(확인 후 테스트 한 건).」
```text
정책 `allow-search-batch-to-account` 에 `metadata.annotations: kgd.io/host-of: wishlist` 를 달고 `podSelector` 는 `app.kubernetes.io/name: account`, 파일 머리 허용 쌍 목록에 한 줄. 게이트웨이 `/internal` 차단은 기존 `GatewayRouteAuthSpec`(「클러스터 안 전용 경로 /internal」)이 이미 확인한다 — 새 테스트 없음. 내부 집계는 `min` 을 서버에서 `max(min, 1)` 로 막고 기본값은 `SAVED_MIN`, 응답 상한 10,000건.
```

**E12 (I5·S3·U5) SR-2.2 끝에 덧붙임.**
```text
캐시 이름 `RegionCaches.VISITOR_RANKING` 을 `RegionCacheConfig` 에 직렬화기·TTL 과 함께 등록한다(등록하지 않은 이름은 막힌다). write-through 는 `RegionVisitorSyncService` 가 다른 빈의 `@CachePut` 을 불러 프록시를 탄다. `sidoCode` 는 존재하는 2자리 시도 코드가 아니면 400 이고 캐시하지 않는다. 캐시가 비었으면 조회 때 계산한다(`@Cacheable`).
```

**E13 (U5·U6) SR-2.1 바꿈.** 바꿀 문장: 「다 받은 달 판정은 지금 월 합계 규칙과 같다(`data-sources.md` §방문자 「다 받은 달만 월 합계」).」
```text
다 받은 달은 **시도 안 모든 시군구**가 그 달의 모든 날을 받은 달이다(시군구마다 따로 판정하지 않는다). 다 받은 달이 없거나 시군구가 3개 미만인 시도(세종·제주)는 절을 숨긴다. 외지인 산정에 통근·통학이 포함되는지 원천 정의를 `data-sources.md` 방문자 절에 인용하고, 포함이면 근거 줄 끝에 「통근 포함」을 붙인다(TG0.7).
```

**E14 (U7, 권고 ①) SR-2.4 의 두 번째 문장 바꿈.** 바꿀 문장: 「관광지 상세에는 근거 줄 하나만: 「이 관광지가 있는 {시군구}의 {월} 타지 방문자 약 N명 — 관광지 하나의 값이 아닙니다」(SR-1.3 형식).」
```text
관광지 상세에는 시군구 방문자 수를 내지 않고 링크 한 줄만 둔다: 「{시군구} 방문 추이 보기」(영문 「Visitor trend in {sigungu}」) → 시군구 지역 페이지. 같은 숫자를 시군구 안 관광지 전부에 붙이지 않기 위해서다.
```

**E15 (I2·U4·A2·D5·D6) SR-5.4 바꿈.** 바꿀 문장: 「`attraction_access`(attraction_id, kind `RAIL|BUS`, stop 참조, `distance_m`, rank, 원천 기준일, 계산 시각). 버스 20.6만 행은 5,000행 묶음으로 보낸다.」
```text
`attraction_access`(attraction_id, kind `RAIL|BUS`, 원천 자연 키 — 철도 역사 코드 · 버스 `도시코드+정류장번호`, 그 시점의 이름·영문 이름·노선 사본, `distance_m`, rank, 원천 기준일, 계산 회차 `computed_at`). 대리 키 참조·FK 를 두지 않는다 — extras 조회에 조인이 없고, 원천 교체와 계산 사이에도 결과가 일관된다. Flyway 는 V35. 원천 교체는 회차 단위다: 적재 회차 id 로 새 행을 2,000행 묶음으로 쌓고, 전부 성공하면 활성화 호출 한 번으로 활성 회차를 바꾼 뒤 옛 회차를 지운다. 중간 묶음이 실패하면 활성 회차가 그대로다. access PUT 은 `rank ∈ {1,2}`, `distance_m ≤ 종류별 상한`(역 2,000·정류장 500)을 검증해 어긋나면 400. 규칙의 원본은 ingest 상수다.
```

**E16 (T2·S4) SR-5.2 의 「받기 실패·0행이면 이전 행을 지우지 않고 Job 을 실패시킨다.」 뒤에 덧붙임.**
```text
다음도 실패로 친다(이전 행 보존): 헤더 집합이 원천별 `EXPECTED_COLUMNS`(TG0.1 원문)와 다름(빠짐·늘어남 모두) · 무효 좌표 비율 5% 초과 · 행 수가 이전 활성 회차보다 ±20% 넘게 변함. 받기는 `https` 만, 시간 제한 300초, 최대 바이트 = TG0 실측 크기 × 3.
```

**E17 (I1·I6) SR-6.1 바꿈.** 바꿀 문장: 「격자(0.02°) 버킷으로 후보를 좁히고 하버사인으로 직선거리를 구한다.」
```text
격자(0.02°) 버킷으로 후보를 좁히되 이웃 칸 수는 `ceil(반경 / 그 위도의 칸 폭)` 으로 계산한다(역 2,000m 는 경도 방향에서 3×3 밖으로 나간다). 거리는 하버사인. 메모리: 관광지는 ACTIVE 의 `(id, lat, lng)` 만 남기고, 정류장 원천 전 컬럼은 적재 묶음을 보낸 뒤 놓고 계산용 튜플만 둔다.
```

**E18 (U3) SR-6.2 끝에 덧붙임.**
```text
같은 역의 노선별 행은 역명(+200m 안)으로 묶어 한 역으로 세고 노선을 「1·4호선」처럼 합친다.
```

**E19 (I3·U4) SR-6.3 바꿈.** 바꿀 문장: 「결과는 관광지 단위로 통째로 교체(`PUT /internal/attractions/access`).」
```text
결과는 회차 단위로 교체한다(`PUT /internal/attractions/access`). 계산한 ACTIVE 관광지는 빈 목록까지 전부 보내고, 이번 회차에 실리지 않은 관광지(비활성·삭제 포함)의 행은 회차 끝에 `computed_at` 기준으로 지운다.
```

**E20 (A1) SR-6.4 끝에 덧붙임.**
```text
`searchReadRequired["attractions"]` 에 `access` 를 넣고, E8 과 같은 경로(읽기 문서 → UseCase 결과 → 서비스 매핑 → 렌더러 → `placeApi.ts`)를 지난다.
```

**E21 (U2·U3) SR-7.1 바꿈.** 바꿀 문장: 「상세 「가는 법」 절(지도·길찾기 단추 옆): 「{역명}역 ({노선}) · 직선거리 {N}m」 형식」
```text
상세 「가까운 역·정류장」 절(지도·길찾기 단추 옆, 첫 행동은 구글 지도 대중교통 길찾기 링크): 「{역명}역 ({노선}) · 직선거리 {N}m」 형식 — 원천 역명이 「역」으로 끝나면 붙이지 않는다. 관광지 시군구가 버스 원천의 연계 지역 밖이면 버스 칸에 「이 지역은 버스정류장 위치 자료가 없습니다」(영문 「No bus stop data for this area」)를 낸다. 연계 판정 방법은 TG0 에서 정한다.
```

**E22 (I6·U8) 무료 티어 절 바꿈.** 바꿀 문장: 「외부 호출은 CronJob 만: `transit-stops` 주 2회 파일 받기.」
```text
외부 호출은 CronJob 만: `transit-stops` 주 1회, 파일 2개(UTC 일 15:00 = 월 KST 00:00 — 다른 place-ingest 전량 스캔과 겹치지 않는 자리, `concurrencyPolicy: Forbid`).
```
같은 맥락으로 SR-5.1 의 「(CronJob 주 1회, 월 KST 01:30)」는 다음으로 바꿉니다.
```text
(CronJob 주 1회, 월 KST 00:00)
```

**E23 (I9) 무료 티어 절 끝에 덧붙임.**
```text
- wishlist 집계는 `(target_type, target_key)` 인덱스 없이 전체를 훑는다 — 하루 1콜이라 지금은 둔다. TG0.5 에서 행 수를 적고 수십만 행을 넘으면 인덱스 마이그레이션을 검토한다.
```

**E24 (T3·T7) 검증 절 끝에 두 줄 추가.**
```text
- 경계 테스트는 **리터럴**로 쓴다(찜 2·3, 클릭 4·5, 999m·1000m, 기대 문구 「직선거리 1.0km」) — 상수 이름으로 경계를 만들면 상수를 낮춰도 초록이다. 회귀 주입은 사본마다 따로(FE `SAVED_MIN` · search/domain `SAVED_MIN` · batch 가 넘기는 `min` · 헤더 검사 한 줄), 컴파일·tsc 를 통과하는 회귀로 한다.
- CDP 대상은 「근거가 있는 표본 페이지」와 「근거가 없는 페이지(절 숨김)」를 TG0 분포로 미리 정한다. 표본이 0이면 그 근거는 컴포넌트 테스트로만 확인했다고 적는다.
```

## 4. tasks.md 편집 목록

- **TG0, 0.1 끝에 덧붙임 (T2·S4):**
```text
· 원천별 헤더 원문을 `EXPECTED_COLUMNS` 로 옮길 수 있게 그대로 적고, 파일 크기를 잰다(최대 바이트 = × 3)
```
- **TG0, 0.4 바꿈 (I6):**
```text
- [ ] 0.4 관광지 ACTIVE `(id, lat, lng)` 투영 + 정류장 계산용 튜플 상태에서 최대 RSS 를 잰다 → 잡 `resources.limits` 값
```
- **TG0, 0.5 끝에 덧붙임 (I9):**
```text
· `wishlist_items` 전체 행 수도 적는다
```
- **TG0 에 0.6~0.8 추가 (T7·U6·U2):**
```text
- [ ] 0.6 클릭 분포: `uniqueClickers14d ≥ 5` 관광지 수, 그런 곳이 3곳 이상인 시군구 수(재색인 로그 「최소 표본 이상 N곳」) → CDP 표본 페이지 확정
- [ ] 0.7 서울·부산의 외지인+외국인 상위 10 시군구를 뽑아 보고, 원천의 외지인 정의(일상 이동 포함 여부)를 인용 → Q11 답
- [ ] 0.8 버스 원천 `도시코드·관리도시명` ↔ 시군구 코드 대응을 정한다(안 되면 「관광지 10km 안 유효 정류장 0」을 미연계로 판정)
```
- **1.1 끝에 덧붙임 (T3):**
```text
  - 하한 단언은 리터럴 경계로: 찜 2 → 줄 없음, 3 → 줄 있음 · 클릭 4 → 없음, 5 → 있음
```
- **1.3 바꿈 (A3·T4):**
```text
- [ ] 1.3 search/domain 에 `SAVED_MIN` 상수(`AttractionClickSignal.MIN_SAMPLE` 옆). FE↔서버 대조 테스트를 **새로 만든다**(선례 없음): Kotlin 파일을 `readFileSync` 로 읽어 `SAVED_MIN`·`MIN_SAMPLE` 을 뽑아 FE 값과 대조, 정규식 0건이면 실패. `FREQUENTLY_CLICKED_MIN` 은 `visitSignals.ts` 로 옮기고 `placeAttributes.ts` 는 다시 내보내기만
```
- **1.4 대상에 렌더러 문구 추가 (T5·A3):** 「(`visitSignals.ts`·`RegionPage.tsx`·`AttractionPageRenderer.kt` 대상)」 뒤에
```text
+ 「`AttractionPageRenderer.kt` 문자열에 「인기」「많이 본」「핫플」 없음, 사이트 근거 줄에 「방문자」 없음」 한 줄
```
- **1.5 추가 (D1·D2):**
```text
- [ ] 1.5 `search/glossary.md` `uniqueClickers14d` 정의를 「최근 14일 관광지 상세를 클릭한 고유 이용자 수」로 바꾼다. 구현 뒤 `/hns:glossary` 로 `place/glossary.md`(spec SR-1.5 용어)를 만들고 `docs/context-map.md` BC 표에 place 한 줄
```
- **2.1 사례 추가 (U5·S3·T6):**
```text
  - 다 받은 달은 시도 안 모든 시군구 기준 · 시군구 3개 미만 시도(36 세종)는 빈 결과 · 다 받은 달이 없으면 빈 결과
  - 없는·잘못된 `sidoCode` → 400, 캐시 키 미생성
```
- **2.2 끝에 덧붙임 (I5):**
```text
+ `RegionCaches.VISITOR_RANKING` 상수 · `RegionCacheConfig` 직렬화기·TTL 26시간 등록 · `RegionVisitorSyncService` 에서 `@CachePut` 을 다른 빈으로 호출
```
- **2.4 바꿈 (U7 권고 ①):**
```text
- [ ] 2.4 상세에 「{시군구} 방문 추이 보기」 링크 한 줄(수치 없음) — `AttractionPage.test.tsx` 에 링크 대상·문구 단언
```
- **2.5 끝에 덧붙임 (T6):**
```text
· `RegionPage.test.tsx` 사례: 시도에만 절 · 시군구엔 없음 · 「약」 · 소수 버림 · 세종 숨김
```
- **3.1 이름 고정 (T8):** 「wishlist `CountWishlistTargetsInternalControllerTest`」를 다음으로 바꿉니다.
```text
wishlist `WishlistInternalControllerTest`(3.2 의 컨트롤러 이름 `WishlistInternalController`)
```
- **3.2 끝에 덧붙임 (T6):**
```text
· HAVING 하한은 `WishlistSchemaIntegrationSpec` 에서 실제 질의로 검증(2·3 리터럴) · `min` 은 `max(min,1)`, 상한 10,000
```
- **3.3 끝에 덧붙임 (A1·I7):**
```text
· 읽기 `AttractionSearchDocument`·UseCase 결과·서비스 매핑까지 `savedCount`·`signalsAsOf` 를 잇고 `searchReadRequired` 에 넣는다 · `savedCount` 는 언어 문서 id 단위
```
- **3.4 바꿈 (I4·T1):**
```text
- [ ] 3.4 search app: `sort=saved|clicked` → 하한 이상 문서만(`savedCount ≥ 3`, `uniqueClickers14d ≥ 5`) 내림차순, 벡터 레그 끔. `SearchAttractionServiceTest`: 하한 미만·값 없는 문서가 응답에 없음, 키워드가 있어도 하이브리드 경로를 타지 않음
```
- **3.5 바꿈 (A4·S2):**
```text
- [ ] 3.5 NetworkPolicy `allow-search-batch-to-account` 한 블록(`kgd.io/host-of: wishlist`, `podSelector: app.kubernetes.io/name: account`) + 파일 머리 허용 쌍 한 줄. 게이트웨이 `/internal` 은 기존 `GatewayRouteAuthSpec` 으로 충족(새 테스트 없음)
```
- **4.1·4.2 끝에 각각 덧붙임 (T1·T3):**
```text
· 경계·기대 문구는 리터럴 · 응답 2건이면 절 없음
```
- **4.4 끝에 덧붙임 (T5·T3):**
```text
· 렌더러 출력에 금지어 없음 · 사이트 근거 줄에 「방문자」 없음 · 경계 리터럴(상수 이름 금지) · FE↔서버 근거 줄 골든 대조
```
- **5.1 끝에 덧붙임 (T2):**
```text
· 열 이름 바꾼 표본 → 예외·`put_*` 미호출 · 열 하나 더한 표본 → 예외 · 무효 비율 5% 초과 → 예외 · 행 수 ±20% 초과 → 예외
```
- **5.2 끝에 덧붙임 (I1·U3):**
```text
· 경도 방향 1.9km·두 칸 건너 역(위도 37°) 포함 · 환승역 노선별 두 행 → 한 역·노선 합침
```
- **5.4 바꿈 (A2·I2·D6·U4):**
```text
- [ ] 5.4 place: Flyway V35 세 표(원천 표에 적재 회차 id, `attraction_access` 는 원천 자연 키 + 이름·노선 사본) · 내부 PUT(원천 2,000행 묶음 적재 → 활성화 호출로 회차 전환 → 옛 회차 삭제, 0행 거부) · access PUT 은 rank·거리 상한 검증 400 · extras 조회에 `access`(조인 없음). 테스트: 3번째 묶음 실패 → 조회는 옛 회차 · 이번 회차에 없는 관광지 행 삭제. `PlaceSchemaIntegrationSpec` 증보
```
- **5.5 바꿈 (I6):** 「(주 1회, 메모리는 TG0.4 값)」를 다음으로 바꿉니다.
```text
(`0 15 * * 0` = 월 KST 00:00, `concurrencyPolicy: Forbid`, 메모리는 TG0.4 값)
```
- **6.1 끝에 덧붙임 (A1):**
```text
· 읽기 문서·UseCase·매핑에 `access` 를 잇고 `searchReadRequired` 에 넣는다
```
- **6.2 끝에 덧붙임 (T3·U2·U3):**
```text
· 기대 문구 리터럴(「직선거리 999m」「직선거리 1.0km」) · 「서울역」에 「역」 중복 없음 · 미연계 지역 → 「이 지역은 버스정류장 위치 자료가 없습니다」, 연계 지역 범위 밖 → 버스 줄 없음
```
- **6.3 끝에 덧붙임 (T6):**
```text
· `AttractionPageRendererTest` 에 가는 법 목록 증보 + FE·서버 같은 문구 골든 대조
```
- **6.4 끝에 덧붙임 (T6):**
```text
· search-batch→account 임시 파드 탐침(15초 대기 + 무관 라벨 대조군)
```
- **6.6 끝에 덧붙임 (T7):**
```text
· 대상은 TG0.6 으로 고른 근거 있는 표본 + 근거 없는 페이지(절 숨김), 표본 0이면 컴포넌트 테스트로만 확인했다고 적는다
```
- **6.7 바꿈 (T3):**
```text
- [ ] 6.7 회귀 주입(임시 사본, 컴파일·tsc 통과하는 회귀만): FE `SAVED_MIN` 2 · search/domain `SAVED_MIN` 2 · batch `min` 2 · 「직선거리」 문구 빼기 · congestion 정렬 한 줄 · 헤더 검사 한 줄 삭제 — 각각 빨개지는 테스트 이름을 `verifications/regression-injection.md` 에
```

**open-questions.yml 추가·수정:**
- Q8 답의 「절은 두되 숨김 상태로 배포」는 「데이터 규칙(3건 미만)으로 스스로 숨는다 — 별도 스위치 없음」으로 바꿉니다.
- Q10 을 새로 둡니다: 사이트 쪽 사람을 부르는 말(D1).
- Q11 을 새로 둡니다: 외지인 정의에 통근이 포함되는지(U6).
- Q12 를 새로 둡니다: 상세의 시군구 방문자 줄(U7).
- Q13 을 새로 둡니다: 절 제목과 역 반경(U3).

## 5. 사용자 판단 항목 (권고 기본값을 위 편집에 반영함)

| # | 항목 | 넣은 기본값 | 다른 선택지 |
|---|---|---|---|
| D1 | 이 사이트에서 행동한 사람을 부르는 말 | 「이용자」(영문 「people on this site」) | 「사람」 |
| S1 | 찜 하한 3의 성격 | (a) 표시 정책 — 이유는 「적은 수는 신호가 아니다」, 공개 `/count` 는 그대로 | (b) 개인정보 통제로 쓰고 공개 `/count` 를 GAME 으로 좁힘(wishlist 범위가 바뀜) |
| U7 | 상세에 시군구 방문자 줄을 낼지 | ① 수치 없이 「{시군구} 방문 추이 보기」 링크만 | ② 「{시도} 시군구 중 N위」를 붙여 수치를 남김 · ③ 원안 그대로 |
| D3 | 절 제목 | 「많이 찜한 곳」 | 「많이 저장한 곳」을 유지하고 용어 표에 대응만 적음 |
| U3 | 가는 법 절 제목·역 반경 | 제목 「가까운 역·정류장」, 반경 2,000m 유지 | 제목 「가는 법」 유지 + 반경 1,000~1,500m |
| I7 | 기준 시각 | 색인 `signalsAsOf` 필드 하나 추가 | 기준 시각을 표시하지 않음 |
| I2·U4 | 원천 교체 단위 | 적재 회차 id + 마지막에 전환 | 버스 `도시코드` 단위 요청(congestion·related 와 같은 방식) |
| U6 | 외지인에 통근이 섞이는지 | TG0.7 실측·정의 인용 뒤, 포함이면 근거 줄에 「통근 포함」 | 값을 외국인만으로 좁힘 |

판정 밖에서 하나 눈에 띈 것이 있습니다(새 발견은 추가하지 않는다는 규칙에 따라 판정하지는 않았습니다). `wishlist/glossary.md` 가 아직 `productId` 시절 정의로 남아 있습니다. D3 이 범위 밖이라며 이미 보고한 내용이라 여기서는 기록만 남깁니다.

SUMMARY: keep 40 / demote 0 / dismiss 0
NOTES: 중복 묶음 — I0=D1, A2=D5, I4=T1=U1, A3=T4, I2·I3=U4, I6≈U8①. 편집 목록에서는 묶음마다 한 번씩 반영함.

---

반영 메모(2026-10-11): D1 BLOCK 은 E1(SR-1.2 「이용자」 규칙)·E2(SR-1.3 예시 「이 사이트 이용자 클릭」)로 해소됨.
