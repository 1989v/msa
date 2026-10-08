# Engineer Review — implementation (1라운드)

스펙: `docs/specs/2026-10-09-place-detail-first-screen/spec.md` · 2026-10-09 · 워크트리 `scratchpad/wt-impl` 기준

## 체크리스트

| # | 항목 | 판정 | 요지 |
|---|---|---|---|
| 1 | 참조 클래스·모듈 존재 | 부분 | 대부분 있다. 다만 `place/app` 은 실제로 `place/feature` 이고, place 응답에는 두 필드가 이미 있다(R1). search 쪽 실제 수정 지점(`PlaceApiClient.AttractionDto`·UseCase 결과·`toApi`)이 목록에 없다(R1·R6) |
| 2 | 기존 코드와 충돌 | 이슈 | 출처 줄이 출처표시 의무 문구와 겹친다(R4). 집계 문장이 `regionSection` 문구와 겹친다(R7). 브레드크럼에 시군구를 넣으면 JSON-LD와 어긋난다(R6) |
| 3 | 복잡도 위험 | 이슈 | 요금 행 규칙이 세 곳에 복제된다(R3). 방문 요약은 새로 만드는 블록이다(R7). 유형별 적용 범위가 비어 있다(R7) |
| 4 | NFR 안티패턴 | 이슈 | `tel:` 정규화가 S2-7 표본에서 깨진 링크를 만든다(R5). `<img>` width·height 출처가 없다(R8) |
| 5 | 마이그레이션·롤백 | 이슈 | 파서 v3 롤백 절차가 없다. 아직 확인 안 된 v2 와 순서가 겹친다(R2) |
| 6 | 동시성 | 경미 | 수동 재색인은 CronJob `Forbid` 의 보호를 받지 않는다(R2) |

## 근거와 수정안

**R1 — place 단계는 할 일이 없다. 실제 공백은 search 배치 클라이언트다.**
- 근거: place 응답 DTO 에 이미 `source`(`place/feature/.../AttractionDtos.kt:140`)·`copyrightDivCd`(`:159`)가 있다. 스펙이 인용한 `:41` 은 적재 요청(`UpsertAttractionItem`)이다. 반면 search 배치가 받는 `PlaceApiClient.AttractionDto`(`search/batch/.../PlaceApiClient.kt:35-80`)에는 두 필드가 없다. 스펙 머리의 `place/app` 경로도 실제와 다르다(`spec.md:1`).
- 수정: SR-4.1 을 「place 변경 없음(응답에 이미 있음)」으로 고친다. 수정 지점은 `PlaceApiClient.AttractionDto` → 태스클릿 `AttractionDocument(...)`(`AttractionApiReindexTasklet.kt:267-322`) → `AttractionIndexDocument` → 매핑이다. SR-4.2 배포 순서는 `search:batch → 재색인 → search:app·portal-fe` 로 줄인다. 「전체 동기화 경로 필드 목록」은 이번에 place 컬럼을 늘리지 않으니 해당이 없다고 적는다. 재색인은 매번 처음부터 다시 쌓으므로 별도 필드 목록이 없다.

**R2 — 파서 v3 운영 순서: v2 가 아직 확인되지 않았고 롤백 절차가 없다.**
- 근거: v2 확인은 「다음 정기 재색인(10-09 06:30 KST) 뒤 미확인」 상태다(`docs/specs/2026-10-08-place-text-and-states/verifications/deploy-check.md:16`, `docs/plans/2026-10-09-place-growth-remaining-handoff.md:29`). S2-7 기준 표도 「파서 v1 기준」으로 찍혔다(`evidence/stage2/s2-7-fact-check.md:5`). v3 이미지가 올라가면 다음 재색인부터 `attributeParserVersion` 이 3 이 된다(`AttractionAttributes.kt:19`). 그러면 v2 의 「버전 2 로그 + 영문 N/A 주차 UNKNOWN 건수」 확인을 다시 할 수 없다. 직전 스펙은 롤백을 적어 뒀는데(`2026-10-08-.../spec.md:36`) 이 스펙에는 없다. CronJob 은 `concurrencyPolicy: Forbid`(`k8s/base/search-batch/cronjob-attraction-reindex.yaml:21-22`)다. 그런데 이 설정은 `create job --from` 으로 띄운 수동 Job 은 막지 않는다. 그리고 alias 교체는 `maxRetention = 1` 이라 옛 인덱스를 지운다(`AttractionApiReindexTasklet.kt:337`).
- 수정: SR-4.2 앞에 다음 선행 조건을 둔다.
  1. 06:30 재색인 로그에서 `attribute parser v2` 를 확인하고, N/A 주차 건수를 `deploy-check.md` 에 적는다. 그 뒤에 v3 search:batch 를 배포한다.
  2. S2-7 의 「전」 값은 v2 재색인 뒤 같은 30곳으로 다시 받는다. v1 표를 그대로 쓰면 v2 변화(주차)가 섞인다.
  3. 롤백: v2 search:batch 이미지 + 재색인 1회. `attributeParserVersion` 이 2 로 돌아왔는지 확인한다. 새 두 필드는 비고 표시는 폴백으로 돌아간다(SR-4.2).
  4. 수동 재색인은 21:30 UTC 정기 회차와 겹치지 않는 시각에, 실행 중인 Job 이 없는지 확인한 뒤 1회만 돌린다.

**R3 — 요금 행 규칙이 세 벌로 복제되고, 무료 판정과 표시 우선순위가 어긋난다.**
- 근거: SR-2.2(표시)는 「`useFee` 우선, 없으면 반복정보 행」이다. SR-2.3(판정)은 「`useFee` + 반복정보 요금 행으로 입력을 넓힌다」라서 둘을 합쳐 읽는다. `useFee`=「무료」인데 반복정보에 금액이 있으면 어떻게 될까. 판정은 `startsFree && hasAmount` 로 UNKNOWN 이 된다(`AttractionAttributeParser.kt:175-184`). 표시는 「무료」다. 같은 행 이름 규칙이 세 곳에 따로 생긴다. 하나는 파서(배치, 지금 입력 `AttractionAttributeSource` 에 infoRaw 가 없다 — `:10-16`), 하나는 SSR(`visitorInfo` `AttractionPageRenderer.kt:448-460`), 하나는 FE(`repeatInfoRows` `placeView.ts:306`)다. 이 셋을 맞추는 게이트도 없다.
- 수정:
  1. 판정 입력을 표시와 같은 우선순위(`useFee` 가 있으면 그것만, 없으면 반복정보 요금 행)로 정한다.
  2. 행이 여럿이면 합치는 규칙(원천 `serialnum` 순, 구분자)을 정한다.
  3. 규칙은 `search:domain` 함수 하나(예: `AttractionFee.text(useFee, infoRows)`)로 두고 파서와 SSR 이 같이 부른다.
  4. FE 사본은 기존 골든 방식(`ci.yml:97-101` 의 행사 일정 골든처럼 domain 이 쓰고 FE 가 읽는 픽스처)으로 같은지 확인한다.
  5. 파서 픽스처는 표 행 수 단언(`AttractionAttributeParserTest.kt:19` `145`)도 함께 바뀐다.

**R4 — 「확인 상태」가 출처표시 의무 문구를 원천 코드값으로 바꾸게 읽힌다.**
- 근거: SR-2.5 는 「고정 문구 SSR `:739`·FE `placeAttributes.ts:187` 를 이 값으로」라고 한다. 그런데 그 줄은 출처표시 의무 줄이다(`AttractionPageRenderer.kt:386-387` 주석 「출처표시 의무 (data-sources.md §0)」, `:610-619`). 무장애·웰니스·고캠핑·빅데이터 원천 이름도 거기 덧붙는다. `source` 값은 `TOURAPI`/`GOCAMPING` 같은 코드다. 그대로 넣으면 「한국관광공사」가 빠진다. GOCAMPING 문서는 덧붙는 「고캠핑」과 이름이 두 번 나온다(`:615`, `placeAttributes.ts:194`).
- 수정: 코드 → 표시명 표를 둔다(TOURAPI → 「한국관광공사 TourAPI」, GOCAMPING → 「한국관광공사 고캠핑」, 모르는 값과 null → 지금 고정 문구). 출처 바닥 줄은 이 표를 써서 기관명을 그대로 남기고, 덧붙는 이름과 겹치면 하나만 낸다. 「확인 상태」 칸은 같은 표를 쓰는 별개 문구라고 적는다.

**R5 — `tel:` 정규화가 S2-7 표본 안에서 깨진 링크를 만든다.**
- 근거: SR-2.6 은 「숫자·하이픈만 남겨 링크로」다. 표본의 문의 원문에는 다음 같은 값이 있다(`s2-7-fact-check.md:28,31,38`).
  - 「행사장 02-319-1220운영사 02-737-6444」 → 그대로 하면 `0231912200…` 처럼 두 번호가 붙는다
  - 「02-724-0274~6」
  - 「02-2153-0310, 0311 (12:00~13:0」
- 수정: 원문에서 **첫 번째 전화번호 패턴**(예: `0\d{1,2}-?\d{3,4}-?\d{4}` · `0507-…` · `010-…`)만 링크로 만든다. 맞는 패턴이 없으면 링크 없이 원문만 보인다. 단위 테스트에 위 세 원문을 넣는다(SR-5.1).

**R6 — 새 필드·시군구가 화면까지 가는 경로 중 빠진 곳.**
- 근거:
  - 시군구 브레드크럼: copy.mjs 는 「화면과 서버 렌더가 같은 세 칸을 심어야 한다 — 어긋나면 렌더 전후로 지역 단계가 생겼다 사라진다」고 적어 둔다(`portal-fe/src/seo/copy.mjs:796-807`). SR-1 은 보이는 브레드크럼에만 시군구를 넣고 `BreadcrumbList`(`AttractionPageRenderer.kt:330-343`) 이야기는 없다.
  - 골든 입력 변환: 골든 생성기는 색인 `_source` 를 `toApi` 로 바꿔 copy.mjs 에 넣는다(`attractionJsonLdGolden.test.ts:31-40`). 색인의 시군구는 평평한 `sigunguName`(`attractions-index.json:498`)이고, API 는 `region.sigunguName`(`placeApi.ts:154`)이다. `toApi` 를 안 고치면 「시군구 있음」 골든 사례가 copy.mjs 쪽에서 시군구 없이 만들어진다.
  - 응답 DTO: FE 타입에는 `modifiedAt` 이 없다(`placeApi.ts`, 검색 0건). API 결과에는 있다(`SearchAttractionUseCase.kt:111`).
- 수정: SR-1·SR-3.6 에 다음을 넣는다.
  1. `BreadcrumbList` 도 허브 › 시도 › 시군구 › 관광지로 함께 바꿀지 정한다. 바꾸면 골든 사례에 넣는다.
  2. `toApi` 에서 `sigunguName → region.sigunguName` 으로 바꾸고, 새 필드(`source`·`copyrightDivCd`)도 매핑한다.
  3. SR-4.1 수정 목록에 다음 셋을 더한다: `SearchAttractionUseCase` 결과와 `SearchAttractionService` 매핑(`:251` 근처), FE `Attraction` 의 `modifiedAt`·`source`·`copyrightDivCd`, `searchReadRequired`(`build.gradle.kts:538-550`)에 두 필드 추가. 지금 계약 게이트는 읽기 쪽이 빠뜨린 필드를 사유와 함께 허용한다(`:605-608`). 그래서 표시가 읽는 필드는 필수 목록에 넣어야 조용히 빠지지 않는다.
  4. 재색인 캡처 왕복 테스트(`AttractionReindexCaptureTest.kt`)에 두 필드 대조군을 추가한다. 태스클릿 픽스처에 값을 넣어야 캡처(`ci.yml:105-109`)가 무언가를 잰다.

**R7 — 기존 절과 겹치는 부분과 유형별 적용 범위가 정해지지 않았다.**
- 근거:
  - 집계 문장: 지금 `regionSection` 이 이미 「{시군구} {유형} N곳 중 {분류} M곳」을 낸다(`AttractionPageRenderer.kt:535-545`). SR-3.3 의 새 문장은 같은 숫자를 다시 쓴다.
  - 배지 절: 「방문 정보 요약」 배지 절(`:466-475`, FE 라벨 `AttractionPage.tsx:78`)이 SR-2 의 새 방문 요약과 이름·내용이 겹친다.
  - 「정보 없음」: SR-2.1 은 「정보 없음」을 S2-4 규칙이라고 하지만 FE·SSR 어디에도 그 문구가 아직 없다(검색 0건). 새로 만드는 블록이다.
  - 유형: 행사·숙박·코스는 `typeSection` 이 `visitorInfo` 를 대신한다(`:377`, `:398-414`). 이 유형들에 방문 요약이 붙는지 정해져 있지 않다. 지금 골든 HTML 은 행사·숙박·코스뿐이고 일반 관광지 사례가 없다(`AttractionPageRendererTest.kt:577-587`).
- 수정:
  1. 집계 문장은 `regionSection` 문구를 대체하는지 추가하는지 정한다. 기존 배지 절은 방문 요약으로 흡수되어 사라지는지 정한다.
  2. 방문 요약이 붙는 유형을 정한다(권고: 관광지·문화시설·레포츠·쇼핑·음식. 행사·숙박·코스는 유형별 절 유지).
  3. 일반 관광지 골든 HTML 사례(국·영)를 추가한다. 갱신은 `UPDATE_RENDER_GOLDEN=1`(`:569`)이라는 것도 적는다.

**R8 — SSR `<img>` 의 width·height 를 가져올 곳이 없다.**
- 근거: 색인에는 이미지 크기가 없다. OG 크기도 실측이 아니라 상수 1200×630 이다(`AttractionPageRenderer.kt:148-149,725-726`). 원천은 http·https 를 섞어 준다(`placeView.ts:265`).
- 수정: width·height 를 고정 비율 상자 값(예: TourAPI 대표 사진의 통상 비율)으로 둘지, 생략하고 CSS `aspect-ratio` 를 쓸지 정한다. http 주소는 https 로 바꿀지, 내지 않을지 정한다. 파서 v3 의 괄호 단서는 닫히지 않은 괄호(표본 `s2-7-fact-check.md:15` 끝이 잘림)도 처리해야 한다. 쉼표로 쪼개기(`AttractionAttributeParser.kt:65`) **전에** 괄호를 떼야 한다고 순서를 적는다.

## 판정 요약

차단할 만한 구조 문제는 없다. 스펙 결정이 코드나 문서와 정면으로 부딪히는 곳도 없다. 다만 다음 넷은 구현 전에 스펙에서 정해야 한다.
- R2 운영 순서 — v2 확인 → v3 순서, 롤백
- R3 요금 규칙 한 곳으로
- R4 출처표시 문구 보존
- R5 `tel:` 정규화

VERDICT: REVISE
