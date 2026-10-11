# Task Breakdown: place 방문 근거 표시 + 가는 법 (S4-3 · S4-4)

## Overview
Total Task Groups: 7 (TG0 실측 + 지금 범위 TG1~TG6). SR-8·SR-9(사용자 확인 뒤)는 여기 없다 — Q1·Q2·Q4 답이 오면 tasks 를 늘린다.
정본은 `spec.md`. 표준: `docs/standards/test-rules.md`(Kotest BehaviorSpec + MockK), `docs/conventions/jpa-persistence.md`, `docs/architecture/data-sources.md` §0(3규칙), `docs/standards/fe-visual-verification.md`, root `DESIGN.md`.
순서: TG0 → (TG1 · TG3 병렬) → TG2 → TG4 → TG5 → TG6. 같은 파일(`AttractionPage.tsx`·`AttractionPageRenderer.kt`·`attractions-index.json`·`AttractionApiReindexTasklet.kt`)을 고치는 그룹은 순서대로.

### Task Group 0: 원천 실측 (코드 변경 없음) (SR-5.1 · SR-5.3 · 무료 티어)
**Dependencies:** None
- [ ] 0.1 두 원천 파일을 받아 행 수·인코딩(EUC-KR/UTF-8)·컬럼 원문·좌표 순서를 `verifications/source-sample.md` 에 적는다. 원천 파일은 스크래치패드에만 둔다(레포에 커밋하지 않는다) · 원천별 헤더 원문을 `EXPECTED_COLUMNS` 로 옮길 수 있게 그대로 적고, 파일 크기를 잰다(최대 바이트 = × 3)
- [ ] 0.2 파일 주소가 로그인 없이 받히는지, 갱신 때 주소가 바뀌는지(`atchFileId`) 확인 → Q3 답
- [ ] 0.3 철도 위경도가 WGS84 인지: 운영 관광지 중 역 이름을 가진 곳 5곳과 대조 → Q5 답
- [ ] 0.4 관광지 ACTIVE `(id, lat, lng)` 투영 + 정류장 계산용 튜플 상태에서 최대 RSS 를 잰다 → 잡 `resources.limits` 값
- [ ] 0.5 wishlist ATTRACTION 대상 찜 분포(3 이상인 대상 수)를 `ssh msa-oci` 로 센다 → SR-3.4 절이 실제로 나올지 · `wishlist_items` 전체 행 수도 적는다
- [ ] 0.6 클릭 분포: `uniqueClickers14d ≥ 5` 관광지 수, 그런 곳이 3곳 이상인 시군구 수(재색인 로그 「최소 표본 이상 N곳」) → CDP 표본 페이지 확정
- [ ] 0.7 서울·부산의 외지인+외국인 상위 10 시군구를 뽑아 보고, 원천의 외지인 정의(일상 이동 포함 여부)를 인용 → Q11 답
- [ ] 0.8 버스 원천 `도시코드·관리도시명` ↔ 시군구 코드 대응을 정한다(안 되면 「관광지 10km 안 유효 정류장 0」을 미연계로 판정)

### Task Group 1: 근거 문구·하한 단일 원본 (SR-1)
**Dependencies:** None · **Phase:** portal-fe, search/domain
- [ ] 1.1 테스트 먼저 — `portal-fe/src/pages/place/__tests__/visitSignals.test.ts`
  - 금지어(「많이 본」「인기」「핫플」)가 국·영 문구 어디에도 없음(문구 객체를 순회해 판정)
  - `SITE_CLICKS` 문구에 「방문자」가 없음, `KTO_REGION_VISITORS` 문구에만 있음
  - 근거 줄 함수가 원천·대상·기간 세 칸을 모두 낸다(빈 칸이면 줄을 내지 않는다)
  - `SAVED_MIN`(3) · `FREQUENTLY_CLICKED_MIN`(5) 리터럴 단언
  - 하한 단언은 리터럴 경계로: 찜 2 → 줄 없음, 3 → 줄 있음 · 클릭 4 → 없음, 5 → 있음
- [ ] 1.2 `visitSignals.ts` — 근거 종류·문구(국·영)·하한·`formatSignalLine(kind, {target, period})`
- [ ] 1.3 search/domain 에 `SAVED_MIN` 상수(`AttractionClickSignal.MIN_SAMPLE` 옆). FE↔서버 대조 테스트를 **새로 만든다**(선례 없음): Kotlin 파일을 `readFileSync` 로 읽어 `SAVED_MIN`·`MIN_SAMPLE` 을 뽑아 FE 값과 대조, 정규식 0건이면 실패. `FREQUENTLY_CLICKED_MIN` 은 `visitSignals.ts` 로 옮기고 `placeAttributes.ts` 는 다시 내보내기만
- [ ] 1.4 grep 게이트: `scripts/` 의 기존 FE 게이트 묶음에 「`congestion` 으로 정렬·순위 금지」 한 줄(`visitSignals.ts`·`RegionPage.tsx`·`AttractionPageRenderer.kt` 대상) + 「`AttractionPageRenderer.kt` 문자열에 「인기」「많이 본」「핫플」 없음, 사이트 근거 줄에 「방문자」 없음」 한 줄. 회귀 주입(임시 사본에 congestion 정렬 한 줄)으로 빨간불 확인
- [ ] 1.5 `search/glossary.md` `uniqueClickers14d` 정의를 「최근 14일 관광지 상세를 클릭한 고유 이용자 수」로 바꾼다. 구현 뒤 `/hns:glossary` 로 `place/glossary.md`(spec SR-1.5 용어)를 만들고 `docs/context-map.md` BC 표에 place 한 줄

### Task Group 2: 시도 「타지 방문자가 많은 시군구」 (SR-2)
**Dependencies:** TG1
- [ ] 2.1 테스트 먼저 — place `RegionVisitorRankingServiceTest`(BehaviorSpec)
  - 다 받은 달만 쓴다(일부만 받은 최근 달은 건너뛴다)
  - 값 = 외지인+외국인, 현지인 제외 · 옛 코드 29·46 제외 · 상위 10 · 같은 값이면 코드 오름차순
  - 방문자 PUT 뒤 받은 시도의 레디스 키를 다시 쓴다(write-through)
  - 다 받은 달은 시도 안 모든 시군구 기준 · 시군구 3개 미만 시도(36 세종)는 빈 결과 · 다 받은 달이 없으면 빈 결과
  - 없는·잘못된 `sidoCode` → 400, 캐시 키 미생성
- [ ] 2.2 UseCase 인터페이스 + Port + Adapter(ADR-0083 레이어), 컨트롤러 `GET /api/places/administrative-regions/{sidoCode}/visitor-ranking` + `RegionCaches.VISITOR_RANKING` 상수 · `RegionCacheConfig` 직렬화기·TTL 26시간 등록 · `RegionVisitorSyncService` 에서 `@CachePut` 을 다른 빈으로 호출
- [ ] 2.3 FE `RegionPage.tsx` 시도 페이지에 절 추가 — 근거 줄은 `formatSignalLine`. 시군구 페이지·상세에는 순위 없음
- [ ] 2.4 상세에 「{시군구} 방문 추이 보기」 링크 한 줄(수치 없음) — `AttractionPage.test.tsx` 에 링크 대상·문구 단언
- [ ] 2.5 검증: `./gradlew :place:feature:test --tests '*RegionVisitorRanking*'`, `npx vitest run src/pages/place/__tests__/RegionPage.test.tsx` · `RegionPage.test.tsx` 사례: 시도에만 절 · 시군구엔 없음 · 「약」 · 소수 버림 · 세종 숨김

### Task Group 3: 찜 집계 → 색인 (SR-3.1~3.3 · SR-3.6 · SR-3.7)
**Dependencies:** None
- [ ] 3.1 테스트 먼저 — wishlist `WishlistInternalControllerTest`(3.2 의 컨트롤러 이름 `WishlistInternalController`): `min` 미만 제외 · 응답에 memberId·시각 없음 · 잘못된 type 400
- [ ] 3.2 wishlist UseCase + Port 메서드(`countGroupedByTarget(type, min)`) + JPA 집계 질의 + 내부 컨트롤러 · HAVING 하한은 `WishlistSchemaIntegrationSpec` 에서 실제 질의로 검증(2·3 리터럴) · `min` 은 `max(min,1)`, 상한 10,000
- [ ] 3.3 search batch: 클라이언트 + `AttractionIndexDocument.savedCount` + 매핑(`integer`, `index:false`). 실패 시 필드 없이 계속 + 요약 로그. 테스트: 정상·실패·하한 미만 · 읽기 `AttractionSearchDocument`·UseCase 결과·서비스 매핑까지 `savedCount`·`signalsAsOf` 를 잇고 `searchReadRequired` 에 넣는다 · `savedCount` 는 언어 문서 id 단위
- [ ] 3.4 search app: `sort=saved|clicked` → 하한 이상 문서만(`savedCount ≥ 3`, `uniqueClickers14d ≥ 5`) 내림차순, 벡터 레그 끔. `SearchAttractionServiceTest`: 하한 미만·값 없는 문서가 응답에 없음, 키워드가 있어도 하이브리드 경로를 타지 않음
- [ ] 3.5 NetworkPolicy `allow-search-batch-to-account` 한 블록(`kgd.io/host-of: wishlist`, `podSelector: app.kubernetes.io/name: account`) + 파일 머리 허용 쌍 한 줄. 게이트웨이 `/internal` 은 기존 `GatewayRouteAuthSpec` 으로 충족(새 테스트 없음)
- [ ] 3.6 검증: `./gradlew :wishlist:feature:test --tests '*WishlistInternalController*' :search:batch:test --tests '*AttractionApiReindex*' :search:app:test --tests '*SearchAttractionService*'`

### Task Group 4: 근거 절·근거 줄 화면 (SR-3.4 · SR-3.5 · SR-4)
**Dependencies:** TG1, TG3
- [ ] 4.1 테스트 먼저 — `RegionPage.test.tsx`: 시군구 페이지 「많이 찜한 곳」「이 사이트에서 많이 누른 곳」이 각자 `sort` 로 질의, 3 미만이면 절 없음, 근거 줄 세 칸 · 경계·기대 문구는 리터럴 · 응답 2건이면 절 없음
- [ ] 4.2 `AttractionPage.test.tsx`: `savedCount`·`uniqueClickers14d` 하한 이상만 근거 줄, 기준 시각 표시, 기존 배지 유지 · 경계·기대 문구는 리터럴 · 응답 2건이면 절 없음
- [ ] 4.3 구현(RegionPage · AttractionPage · placeApi 타입)
- [ ] 4.4 서버 렌더 `AttractionPageRenderer` 에 같은 근거 줄(하한은 search 상수). 골든 JSON 갱신은 바뀐 줄만 · 렌더러 출력에 금지어 없음 · 사이트 근거 줄에 「방문자」 없음 · 경계 리터럴(상수 이름 금지) · FE↔서버 근거 줄 골든 대조

### Task Group 5: 역·정류장 적재와 사전 계산 (SR-5 · SR-6)
**Dependencies:** TG0
- [ ] 5.1 테스트 먼저 — `place/ingest/tests/transit_stops_test.py`: TG0 원천 표본(키·URL 지운 실제 행)으로 파싱 · 원천 컬럼 전부 보존 · 좌표 범위 밖/뒤바뀜 → `valid_coord=false` · 0행이면 실패 · 열 이름 바꾼 표본 → 예외·`put_*` 미호출 · 열 하나 더한 표본 → 예외 · 무효 비율 5% 초과 → 예외 · 행 수 ±20% 초과 → 예외
- [ ] 5.2 `nearest_stops` 순수 함수 테스트: 하버사인 값(알려진 두 점) · 반경 경계(2,000m/500m 포함·제외) · 같은 이름 쌍 중 가까운 것 하나 · 상한 2 · 격자 경계를 넘는 이웃 · 경도 방향 1.9km·두 칸 건너 역(위도 37°) 포함 · 환승역 노선별 두 행 → 한 역·노선 합침
- [ ] 5.3 `src/transit_stops.py` + `main.py` 잡 등록 + `place_client.put_transit_*`·`put_attraction_access`
- [ ] 5.4 place: Flyway V35 세 표(원천 표에 적재 회차 id, `attraction_access` 는 원천 자연 키 + 이름·노선 사본) · 내부 PUT(원천 2,000행 묶음 적재 → 활성화 호출로 회차 전환 → 옛 회차 삭제, 0행 거부) · access PUT 은 rank·거리 상한 검증 400 · extras 조회에 `access`(조인 없음). 테스트: 3번째 묶음 실패 → 조회는 옛 회차 · 이번 회차에 없는 관광지 행 삭제. `PlaceSchemaIntegrationSpec` 증보
- [ ] 5.5 CronJob `place-ingest-transit-stops`(`0 15 * * 0` = 월 KST 00:00, `concurrencyPolicy: Forbid`, 메모리는 TG0.4 값) · env 두 개 · egress 는 기존 place-ingest 정책
- [ ] 5.6 대장 `data-sources.md` §1 두 행 + 본문 절, `portal-fe/src/seo/dataSources.mjs` 출처 두 줄
- [ ] 5.7 검증: `pytest place/ingest/tests/transit_stops_test.py`, `./gradlew :place:feature:test --tests '*AttractionAccess*' --tests '*PlaceSchemaIntegrationSpec*'`

### Task Group 6: 가는 법 화면 + 운영 확인 (SR-6.4 · SR-7 · 검증)
**Dependencies:** TG4, TG5
- [ ] 6.1 search batch `access` 매핑(`enabled:false`)·문서 필드, 재색인 테스트 증보 · 읽기 문서·UseCase·매핑에 `access` 를 잇고 `searchReadRequired` 에 넣는다
- [ ] 6.2 테스트 먼저 — `AttractionAccess.test.tsx`: 「직선거리」가 모든 거리 앞에, 1km 경계 표기, 도보 시간 문구 없음, 항목 없으면 절 없음, 영문 역명/「Bus stop」 · 기대 문구 리터럴(「직선거리 999m」「직선거리 1.0km」) · 「서울역」에 「역」 중복 없음 · 미연계 지역 → 「이 지역은 버스정류장 위치 자료가 없습니다」, 연계 지역 범위 밖 → 버스 줄 없음
- [ ] 6.3 `AttractionAccess.tsx` + `AttractionPage` 배치(길찾기 옆) + 서버 렌더 같은 목록 · `AttractionPageRendererTest` 에 가는 법 목록 증보 + FE·서버 같은 문구 골든 대조
- [ ] 6.4 배포 후: `transit-stops` 1회 수동 실행 로그(행 수·무효 좌표 수·관광지 중 역/정류장이 붙은 비율), 재색인 소요 전후 · search-batch→account 임시 파드 탐침(15초 대기 + 무관 라벨 대조군)
- [ ] 6.5 표본 10곳 직선거리 대조(±30m) → `verifications/distance-check.md`
- [ ] 6.6 CDP 4조합(국·영 × 모바일·데스크톱)으로 상세·시도·시군구 근거 줄과 가는 법 DOM 텍스트 기록. 헤드리스 크롬은 start·측정·stop 한 명령 · 대상은 TG0.6 으로 고른 근거 있는 표본 + 근거 없는 페이지(절 숨김), 표본 0이면 컴포넌트 테스트로만 확인했다고 적는다
- [ ] 6.7 회귀 주입(임시 사본, 컴파일·tsc 통과하는 회귀만): FE `SAVED_MIN` 2 · search/domain `SAVED_MIN` 2 · batch `min` 2 · 「직선거리」 문구 빼기 · congestion 정렬 한 줄 · 헤더 검사 한 줄 삭제 — 각각 빨개지는 테스트 이름을 `verifications/regression-injection.md` 에
