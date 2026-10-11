# Engineer Review A — architecture · implementation · security

대상: `docs/specs/2026-10-10-place-visits-and-access/spec.md` · `tasks.md` · `context/open-questions.yml`
읽은 표준: CLAUDE.md(외부 데이터 3규칙·원천 대장), `docs/conventions/jpa-persistence.md`, `search/CLAUDE.md`, `wishlist/CLAUDE.md`, `k8s/CLAUDE.md`, `k8s/base/network-policy/04-allow-backend-to-backend.yaml`, 루트 `build.gradle.kts`(검색 색인 계약·파드 토폴로지 게이트)
날짜: 2026-10-11

## 요약

| 관점 | 판정 | BLOCK | REVISE | MINOR |
|---|---|---|---|---|
| architecture | REVISE | 0 | 2 | 2 |
| implementation | REVISE | 0 | 6 | 4 |
| security | REVISE | 0 | 1 | 3 |

요청받은 확인 항목:
- **사용자 요청 경로의 외부 호출**: 없다. 찜 집계는 재색인 배치만 부르고, 가는 법은 색인에서, 지역 방문자는 place·레디스에서 읽는다(spec:8, :96).
- **bulk 전체 동기화 함정**: 이번 변경은 `/api/places/attractions/bulk`(`place/ingest/src/place_client.py:103-104` "전체 동기화다 — 부분 레코드를 보내면 나머지 필드가 null 로 덮인다")를 쓰지 않는다. 새 표 셋은 따로 있다. 다만 새 표의 「통째로 교체」 자체에 부분 반영 문제가 있다(I2·I3).
- **서비스 간 DB 공유**: 없다. 내부 API를 호출하고 집계만 받는다(spec:55). 관례와 맞는다.
- **「인기」 금지**: 절 제목은 지킨다. 다만 SR-1.3 예시 문구가 SR-1.2 를 어긴다(I0).
- **Flyway**: place 의 다음 번호는 V35 다(마지막 `V34__attraction_content_hash.sql`).

---

## Architecture

### A1 — REVISE · 색인 필드 두 개(`savedCount`·`access`)의 읽기 경로와 `searchReadRequired` 가 빠졌다
- 근거: tasks 3.3(`tasks.md:42`)과 6.1(`tasks.md:66`)은 batch 쓰기 쪽만 고친다. 그런데 계약 게이트는 읽기 클래스가 필드를 빠뜨려도 사유 한 줄만 있으면 통과시킨다(`build.gradle.kts:604-611`). 막는 것은 `searchReadRequired`(`build.gradle.kts:537-552`)에 든 필드뿐이다. `search/CLAUDE.md:38` 은 "읽기 클래스는 `ignoreUnknown = true` 라 필드를 빠뜨려도 컴파일이 통과하고 값만 조용히 빈다"고 적고 있다.
- 영향: 상세 근거 줄·「가는 법」 절·서버 렌더가 아무 신호 없이 사라질 수 있다.
- 수정안: SR-3.2·SR-6.4 에 지나는 경로를 적는다. 쓰기 `AttractionIndexDocument`, 읽기 `AttractionSearchDocument`, `SearchAttractionUseCase` 결과, `SearchAttractionService` 매핑, `AttractionPageRenderer`, FE `placeApi.ts` 순이다. `searchReadRequired["attractions"]` 에 `savedCount`·`access` 를 넣는다. 기준 시각 필드를 새로 두면(I7) 그것도 넣는다.

### A2 — REVISE · `attraction_access` 의 「stop 참조」가 통째로 교체되는 원천 표를 가리킨다
- 근거: 원천 표는 "자료 기준일로 통째로 교체"한다(spec:69). 그런데 `attraction_access` 는 "stop 참조"를 갖는다(spec:71). 대리 키 id 를 참조하면 원천을 바꾼 뒤 계산이 실패하거나 잡이 중간에 죽을 때 참조가 끊긴다. FK 를 걸면 원천 삭제가 막힌다.
- 수정안: 참조를 원천의 자연 키 `(kind, 원천 역·정류장 번호)` 로 정한다. extras 응답에 나갈 이름·영문 이름·노선·기준일은 `attraction_access` 행에 그 시점 값으로 함께 저장한다. 그러면 extras 조회에 조인이 없고, 원천 교체와 계산 사이 창에도 결과가 일관된다. `jpa-persistence.md` §1 의 plain ID 원칙과도 맞는다.

### A3 — MINOR · 근거 문구가 두 벌인데 대조하는 것은 하한뿐이다. 인용한 「선례」는 테스트가 아니다
- 근거: SR-1.4(spec:45)는 "선례 `FREQUENTLY_CLICKED_MIN` ↔ `AttractionClickSignal.MIN_SAMPLE`"을 든다. 그러나 이 짝은 주석으로만 묶여 있다(`portal-fe/src/pages/place/placeAttributes.ts:285-287`). portal-fe 테스트 중 `AttractionClickSignal` 을 읽는 것은 없다. tasks 1.3 의 "선례대로 FE 테스트가 서버 상수 파일을 읽어 대조"(`tasks.md:24`)는 실제로는 새로 만드는 검사다. 국·영 문구도 FE 와 Kotlin 렌더러에 따로 있다.
- 수정안: (1) 대조는 새로 만든다고 명시하고, 회귀 주입 대상(tasks 6.7)에 넣는다. (2) 근거 줄 문구는 `AttractionJsonLdParityTest` 처럼 골든 픽스처로 대조한다(`search/CLAUDE.md:102`). (3) `FREQUENTLY_CLICKED_MIN` 은 `placeAttributes.ts:287` 에서 `visitSignals.ts` 로 옮기고 원래 자리는 재수출한다. 사본을 두지 않는다. (4) 금지어 검사(tasks 1.1)는 `visitSignals.ts` 만 본다. `AttractionPageRenderer.kt` 의 문자열도 grep 게이트(tasks 1.4) 대상에 넣는다.

### A4 — MINOR · 새 NetworkPolicy 에 `kgd.io/host-of: wishlist` 를 단다
- 근거: wishlist 는 account 파드에 접혀 있다(`account/app/src/main/kotlin/com/kgd/account/AccountApplication.kt:19` `"com.kgd.wishlist"`). k8s/CLAUDE.md:115 는 "폴드를 따라가야 하는 정책은 `kgd.io/host-of: {domain}` 을 달아 둔다"고 하고, 선례로 `allow-search-batch-to-atlas` 가 있다(`04-allow-backend-to-backend.yaml:128-135`). 게이트는 `build.gradle.kts:829-842` 에 있다. spec 이 든 선례 `allow-search-batch-to-place` 에는 이 표식이 없다.
- 수정안: SR-3.7·tasks 3.5 에 `metadata.annotations: kgd.io/host-of: wishlist` 를 적는다. `podSelector` 는 `app.kubernetes.io/name: account` 다. 파일 머리 주석의 허용 쌍 목록(`:4-17`)에도 한 줄 더한다.

---

## Implementation

### I0 — REVISE · SR-1.3 예시 문구가 SR-1.2 와 tasks 1.1 테스트를 어긴다
- 근거: SR-1.2 는 "「방문자」라는 말은 `KTO_REGION_VISITORS` 에만 쓴다"(spec:43)고 하고, tasks 1.1 은 "`SITE_CLICKS` 문구에 「방문자」가 없음"을 확인한다(`tasks.md:20`). 그런데 SR-1.3 예시는 「이 사이트 방문자 클릭(같은 사람은 한 번) · 이 관광지 · 최근 14일」이다(spec:44).
- 수정안: 예시를 「이 사이트 클릭(같은 사람은 한 번) · 이 관광지 · 최근 14일」로 바꾼다. SR-4.1 의 「N명이 눌렀습니다」(spec:64)는 이 규칙을 지킨다.

### I1 — REVISE · 0.02° 격자로는 역 반경 2,000m 가 경도 방향에서 3×3 이웃 밖으로 나간다
- 근거: SR-6.1(spec:75)은 격자 0.02°, SR-6.2(spec:76)는 역 반경 2,000m 다. 경도 0.02° 는 위도 37°에서 약 1.78km, 33°(제주)에서 약 1.87km 다. 둘 다 2km 보다 짧다. 그래서 칸 오른쪽 끝 근처 관광지에서 동쪽 1.9km 에 있는 역은 두 칸 건너에 놓이고, 3×3 탐색이 놓친다. 정류장(500m)은 문제가 없다.
- 수정안: 이웃 칸 수를 `ceil(radius / cell_width(lat))` 로 계산하거나, 종류별 칸 크기를 반경 이상으로 둔다(역 0.03°). tasks 5.2(`tasks.md:57`)에 "경도 방향 1.9km·두 칸 건너 역" 경계 사례를 넣는다.

### I2 — REVISE · 버스 20.6만 행 「통째로 교체」가 요청 약 42개로 나뉘어 원자적이지 않다
- 근거: spec 은 "받은 원천의 행을 통째로 교체"하고 "0행이면 이전 행을 지우지 않는다"(spec:69)고 하면서 "5,000행 묶음으로 보낸다"(spec:71)고 한다. 중간 묶음에서 실패하는 경우는 정하지 않았다. 지금 place 의 통째 교체 선례는 모두 요청 하나 단위다(`place_client.py:198-214`, 시군구 하나 = 요청 하나). 요청당 상한은 2,000건이다(`place_client.py:16` "place 가 요청당 2000건으로 제한한다").
- 수정안: 교체 단위를 원천의 `도시코드` 로 둔다. 요청 하나가 도시 하나를 통째로 바꾸고, 보내지 않은 도시는 건드리지 않는다(congestion·related 와 같은 방식). 묶음 크기도 기존 상한 2,000 에 맞춘다. 다른 방법은 `load_id` 로 적재한 뒤 마지막 commit 호출 한 번에 바꿔 끼우는 것이다.

### I3 — REVISE · `attraction_access` 에 지난 회차 행이 남는다
- 근거: "범위 안에 없으면 행을 만들지 않는다"(spec:76)와 "관광지 단위로 통째로 교체"(spec:77)를 함께 쓰면, 이번에 결과가 0이 된 관광지는 요청에 실리지 않는다. 그러면 지난 회차의 역·정류장이 그대로 남는다. 비활성·삭제 관광지 행도 마찬가지다. `fetch_attractions()` 는 상태를 거르지 않는다(`place_client.py:72-93`).
- 수정안: 계산한 ACTIVE 관광지는 빈 목록까지 전부 보낸다. 실린 적 없는 관광지 행은 종류별로 회차 시각(`computed_at`)을 기준으로 지운다. 관광지 단위보다 회차 단위 교체가 더 간단하다.

### I4 — REVISE · `sort=saved|clicked` 가 하이브리드 경로를 피해야 한다. 지역 절에서는 하한 미만 항목도 걸러야 한다
- 근거: 하이브리드 경로에는 정렬을 걸 수 없다(`search/CLAUDE.md:88-90`). 지금 벡터 레그를 끄는 조건은 거리순·시작일순뿐이다(`SearchAttractionService.kt:188`). 또 재색인은 클릭을 읽으면 없는 관광지를 0으로 싣는다(`AttractionApiReindexTasklet.kt:327-328`). 그래서 `sort=clicked` 상위 6에 0·1·2명 문서가 섞인다. SR-4.2(spec:65)는 "3 미만이면 숨김"만 말하고 항목 하한은 말하지 않는다.
- 수정안: SR-3.6 에 "saved·clicked 정렬은 벡터 레그를 끈다(`resolveEmbedding` 조건 추가)"를 적고 `SearchAttractionServiceTest` 에 한 건 더한다. SR-3.4·SR-4.2 에는 "항목은 하한 이상(`savedCount ≥ SAVED_MIN`, `uniqueClickers14d ≥ FREQUENTLY_CLICKED_MIN`)만 세고, 그것이 3 미만이면 절을 숨긴다"를 적는다. 거르는 것은 정렬 결과를 하한에서 자르는 FE 한 곳이면 된다.

### I5 — REVISE · 새 레디스 캐시 이름을 등록하지 않으면 실행 중에 깨진다
- 근거: place 캐시 매니저는 `disableCreateOnMissingCache()` 로 등록되지 않은 이름을 막는다(`place/feature/.../infrastructure/cache/RegionCacheConfig.kt:89-93`, "이름을 모르는 캐시는 만들지 않는다"). SR-2.2 는 `placeRegionVisitorRanking`(TTL 26시간)을 쓴다고 하지만(spec:49), tasks 2.2(`tasks.md:33`)에는 등록 작업이 없다.
- 수정안: tasks 2.2 에 `RegionCaches` 상수, `RegionCacheConfig` 직렬화기·TTL 등록, `RegionVisitorSyncService` 에서 `@CachePut` 을 프록시로 호출하는 것을 넣는다(`RegionVisitorService.kt:23-25` 와 같은 방식).

### I6 — MINOR · 잡 메모리 추정에 관광지 전량이 빠졌다. 실행 시각이 다른 전량 스캔 잡과 겹친다
- 근거: spec 의 추정은 정류장만 센 100MB 다(spec:97). `fetch_attractions()` 는 원문 필드를 담은 전량 dict 를 메모리에 든다(`place_client.py:72-93`, 전량 스캔은 약 100Mi — `cronjob-media.yaml:68`). 여기에 정류장 20.6만 행의 원천 전 컬럼 dict 가 더해진다. 실행 시각 월 KST 01:30 은 일 UTC 16:30 이다. 같은 전량 스캔 잡 `air-stations`(`cronjob-air-stations.yaml:19` `"50 16 * * 0"`)가 20분 뒤에 뜬다. 무료 티어 제약은 "용량은 증설이 아니라 동시성 축소"다. 또 spec:96 「주 2회 파일 받기」와 spec:68 「주 1회」가 서로 다르다.
- 수정안: 관광지는 `(id, lat, lng)` 투영만 남긴다(ACTIVE 만). 정류장은 계산용으로 튜플·배열에 두고, 원천 전 컬럼은 적재 묶음을 보낸 뒤 놓는다. TG0.4 에서는 이 상태로 RSS 를 잰다. 실행 시각은 다른 place-ingest 전량 스캔과 겹치지 않는 자리로 옮기거나 `concurrencyPolicy: Forbid` 와 함께 이유를 적는다. spec:96 은 「주 1회, 파일 2개」로 고친다.

### I7 — MINOR · 「기준 시각」을 어디서 읽는지 정하지 않았다
- 근거: SR-3.5 는 "기준 시각을 붙인다"(spec:59)고 하지만 색인에는 재색인 시각 필드가 없다. 클릭 14일 창도 마찬가지다.
- 수정안: 색인에 `signalsAsOf`(date, `index:false`)를 하나 두거나, 기준 시각을 표시하지 않는 쪽으로 정한다. 필드를 두면 A1 의 경로와 `searchReadRequired` 에 함께 넣는다.

### I8 — MINOR · 찜 수가 언어 문서마다 따로 센다
- 근거: 상세 찜 키는 `attraction.id` 다(`portal-fe/src/pages/place/AttractionPage.tsx:360-363`). wishlist 키는 "attraction=숫자 id 문자열"이다(`wishlist/CLAUDE.md:30`). 국·영 문서는 id 가 다르므로 영문 상세의 `savedCount` 는 거의 3에 닿지 않는다.
- 수정안: "언어 문서별로 센다(합치지 않는다)"를 SR-3.2 에 적는다. 합치려면 `alternateId` 가 필요한데 기본값이 꺼져 있다(`search/CLAUDE.md:112`). 이번 범위에서는 적는 것으로 충분하다.

### I9 — MINOR · wishlist 집계 질의에 쓸 인덱스가 없다
- 근거: 유니크 키는 `(member_id, target_type, target_key)` 다(`wishlist/feature/.../V2__polymorphic_target.sql:15`). 앞 칼럼이 `member_id` 라 `GROUP BY target_type, target_key` 는 전체를 훑는다.
- 수정안: 지금 규모에서는 하루 1콜이라 문제가 없다. TG0.5 에서 행 수를 같이 적고, 수십만 행을 넘으면 `(target_type, target_key)` 인덱스 마이그레이션을 검토한다고 남긴다.

---

## Security

### S1 — REVISE · `SAVED_MIN = 3` 은 개인정보 통제가 아니다. 이미 공개 API 가 정확한 수를 낸다
- 근거: SR-3.3 은 하한의 이유를 "한두 명의 행동이 드러나지 않게"라고 적는다(spec:57). 그러나 `GET /api/v1/wishlist/count?type=&key=` 는 로그인 없이 어떤 type·key 든 정확한 수를 낸다(`WishlistController.kt:116-132`, 게이트웨이 공개 라우트 `GatewayRouteConfig.kt:362-363`). ATTRACTION 도 포함이다. 또 SR-3.5 의 "찜 단추의 실시간 수"(spec:59)는 존재하지 않는다. 관광지 찜 단추는 수를 부르지 않고, 이 API 를 부르는 곳은 `portal-fe/src/api/gameApi.ts:236` 하나다.
- 수정안: 둘 중 하나를 고른다. (a) 하한을 「표시 정책」으로 다시 적고 이유를 "적은 수는 신호가 아니다"로 바꾼다. (b) 정말 개인정보 통제로 쓰려면 공개 `/count` 를 GAME 으로 좁힌다. 이 경우 wishlist 쪽 범위가 바뀌므로 사용자 판단이 필요하다. 어느 쪽이든 SR-3.5 의 "찜 단추의 실시간 수" 문장은 지운다.

### S2 — MINOR · 내부 집계 API 의 경계는 선례를 따른다. `min` 하한만 서버가 강제한다
- 근거: `/internal` 은 게이트웨이 라우트가 없다. 이것을 라우트 전체로 확인하는 테스트도 이미 있다(`gateway/src/test/.../GatewayRouteAuthSpec.kt:427-433`). 클러스터 안 접근은 L4 NetworkPolicy 로만 가른다(`04-allow-backend-to-backend.yaml:6-7`). 응답에 회원 id·시각이 없는 것도 맞다(spec:55).
- 수정안: SR-3.7 의 "확인 후 테스트 한 건"은 기존 테스트로 충족된다고 적는다. `min` 은 서버에서 `max(min, 1)` 로 막고 상한을 정한다(응답 크기). 기본값은 `SAVED_MIN` 으로 둔다.

### S3 — MINOR · 공개 GET `visitor-ranking/{sidoCode}` 는 캐시하기 전에 코드를 검증한다
- 근거: `/api/places/**` GET 은 인증 없이 열려 있다(`GatewayRouteConfig.kt:820-825`). 임의 문자열로 캐시 키(TTL 26시간)가 생기면 레디스에 키가 쌓인다. 기존 추이 API 는 `RegionVisitorDaily.requireLevel(code)` 로 먼저 거른다(`RegionVisitorService.kt:28`).
- 수정안: SR-2.2 에 "2자리 시도 코드이고 존재하는 시도가 아니면 400, 캐시하지 않음"을 적고 테스트 한 건을 더한다.

### S4 — MINOR · env 로 받는 원천 파일은 크기·형식을 제한한다
- 근거: 파일 주소를 env 로 받고(spec:68), Q3 대안은 Object Storage PAR 이다(`open-questions.yml:18`). 받는 쪽 제한은 적혀 있지 않다.
- 수정안: `https` 만 허용하고, 받기 시간 제한과 최대 바이트(실측 크기 × 3 정도)를 둔다. 헤더 컬럼 집합이 TG0 표본과 다르면 실패시킨다. 원천 컬럼이 조용히 바뀌어 3규칙 ①이 깨지는 것도 이것으로 잡힌다.

---

VERDICT: REVISE
