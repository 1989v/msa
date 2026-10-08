# spec-review 심판 1라운드: 관광지 상세 첫 화면 스펙 (`docs/specs/2026-10-09-place-detail-first-screen/spec.md`)

결론: 발견 34건 중 33건 유지, 1건 강등(S-1 → MINOR), 기각 0건이다. 34건은 중복을 묶으면 14개 묶음이 된다.
- BLOCK 은 없다.
- 인용된 `file:line` 은 워크트리(`3d75179aa`)에서 전부 원문과 맞았다. 반증된 발견은 없다.
- 「스펙 결정 ↔ 문서 위반」을 둘 다 인용한 것은 usecase R1(출처 폴백 ↔ S1-11 「TourAPI로 자동 추정 금지」) 하나다. 리뷰어가 REVISE 로 냈고, 확인 상태 칸과 바닥 출처 줄을 나누면 풀리는 충돌이라 등급을 올리지 않았다(헌법 3, 애매하면 유지).

## 1. 묶음 표

| 묶음 | 내용 | 포함 발견 | 판정 |
|---|---|---|---|
| B1 | place 쪽은 할 일이 없다. 실제 빈 곳은 search:batch `PlaceApiClient` | arch A1 · impl R1 · domain D4(일부) | 유지 REVISE |
| B2 | 요금 규칙을 한 곳으로 모으고, 표시와 판정에 같은 입력을 쓴다 | arch A2 · domain D1 · impl R3 · test T3 · test T4(요금 부분) | 유지 REVISE |
| B3 | 새 필드가 지나는 경로 목록과 `searchReadRequired` 가 빠졌다. 배선 테스트도 없다 | arch A3 · impl R6 · test T1 | 유지 REVISE |
| B4 | 「확인 상태」 칸과 바닥 출처 줄(출처표시 의무)을 나눈다. 표시명 표, null 폴백 | domain D5 · impl R4 · usecase R1 · arch 참고 | 유지 REVISE (arch 참고는 MINOR) |
| B5 | `tel:` 정규화가 번호를 이어 붙인다 | impl R5 · security S-2 · usecase R2 · test T5(tel) | 유지 REVISE |
| B6 | 휴무 괄호 단서: 쪼개기 전 처리, 휴무가 옮겨 가는 단서, 부정 표본, 닫히지 않은 괄호 | test T2 · usecase R3 · impl R8(괄호 부분) | 유지 REVISE, 사용자 판단 U1 |
| B7 | 기존 절과 겹친다(집계 문장, 배지 「방문 정보 요약」, 이웃 절 이름, 유형 범위, 「정보 없음」 신설) | domain D2 · domain D3 · domain D4(분류·집계) · impl R7 · usecase R5 | 유지 REVISE, 사용자 판단 U2 |
| B8 | SSR `<img>` 의 width·height 를 가져올 곳이 없고, http 주소 처리가 정해지지 않았다 | impl R8(img) · usecase R6 · test T5(img) | 유지 REVISE, 사용자 판단 U4 |
| B9 | 파서 v2 를 확인하기 전에 v3 가 나간다. 롤백 절차, 수동 재색인 조건 | impl R2 | 유지 REVISE |
| B10 | 골든은 정답을 재지 않는다. 순서·license·FE↔SSR 패리티·폴드 측정 기준 | test T4 · T5(나머지) · T6 · T7 | 유지 REVISE |
| B11 | S2-7 재측정에 기대값이 없다. S3-7 완료 판정 시점이 없다 | usecase R4 · usecase R8 | 유지 REVISE |
| B12 | 영문 요금 행 이름 | usecase R7 | 유지 REVISE, 사용자 판단 U5 |
| B13 | 새 원문의 이스케이프 순서 | security S-1 | 강등 → MINOR |
| B14 | 필드명·용어 표기(`modifiedAt`, `attrAdmission`, glossary 등록) | domain D2(등록) · domain D4(이름) | 유지 (REVISE 묶음에 딸린 MINOR 편집) |

## 2. 발견별 판정 JSON

```json
[
  {"id":"arch-A1 place API 변경 불필요 — 이미 응답에 있다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"place/feature/src/main/kotlin/com/kgd/place/presentation/attraction/dto/AttractionDtos.kt","line":140,"quote":"val source: String,"},
               {"file":"place/feature/src/main/kotlin/com/kgd/place/presentation/attraction/dto/AttractionDtos.kt","line":159,"quote":"val copyrightDivCd: String?,"},
               {"file":"search/batch/src/main/kotlin/com/kgd/search/infrastructure/client/PlaceApiClient.kt","line":32,"quote":"필드를 여기 추가하지 않으면 기본값 null 이 조용히 이긴다."}],
   "reason":"AttractionResponse 는 두 필드를 이미 싣고, PlaceApiClient 에는 없다(grep 결과 sourceModifiedAt 만 있음). 스펙 SR-4.1·4.2 가 사실과 다르다."},
  {"id":"arch-A2 요금 출처 규칙이 세 곳에 복제","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionAttributeParser.kt","line":7,"quote":"요금·주차·휴무를 여기서 다시 찾으면 place 의 접기 규칙과 두 벌이 된다."},
               {"file":"portal-fe/src/pages/place/placeView.ts","line":306,"quote":"export function repeatInfoRows(raw: string | null | undefined): IntroRow[]"}],
   "reason":"파서 경계 주석과 어긋나고, FE·SSR·파서 세 벌을 맞추는 게이트가 없다."},
  {"id":"arch-A3 색인 필드 전달 목록에 빠진 고리","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/application/attraction/service/SearchAttractionService.kt","line":240,"quote":"parkingFee = parkingFee,"},
               {"file":"build.gradle.kts","line":538,"quote":"val searchReadRequired = mapOf("}],
   "reason":"parkingFee 추적 경로가 실제로 존재하고, 계약 게이트는 서비스 매핑을 보지 않는다."},
  {"id":"arch-참고 source 표시명 두 벌·고캠핑 중복","verdict":"keep","severity":"MINOR",
   "evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":615,"quote":"doc.camping?.let { if (en) \"GoCamping\" else \"고캠핑\" },"}],
   "reason":"리뷰어 스스로 비차단으로 적었다. B4 에 합친다."},
  {"id":"domain-D1 요금 반복정보 폴백 소유가 search 로 넘어감","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionAttributeParser.kt","line":10,"quote":"data class AttractionAttributeSource( val restDate… val useFee… intro"}],
   "reason":"A2 와 같은 발견이다(B2)."},
  {"id":"domain-D2 신조어 glossary 미등록·방문 요약과 기존 절 관계","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":475,"quote":"return \"<h2>${if (en) \"At a glance\" else \"방문 정보 요약\"}</h2><ul>$list</ul>\""}],
   "reason":"기존 「방문 정보 요약」 절이 실제로 있다. 대체인지 병존인지가 스펙에 없다(B7)."},
  {"id":"domain-D3 「가까운 같은 종류」는 기존 용어 개명·FE 와 어긋남","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":557,"quote":"\"Similar places nearby\" else \"같은 분류 가까운 곳\""},
               {"file":"search/glossary.md","line":81,"quote":"자기 자신과 「같은 분류 가까운 곳」 제외"},
               {"file":"portal-fe/src/pages/place/__tests__/AttractionPage.test.tsx","line":140,"quote":"같은 분류 가까운 곳 · 주변 명소 · 편의시설은 따로 절을 갖지 않는다 — 주변 탐색 하나로 합쳤다"}],
   "reason":"용어 원문, FE 가 절을 합쳐 둔 사실이 모두 확인된다."},
  {"id":"domain-D4 필드명·적용 규칙 오인용","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/batch/src/main/kotlin/com/kgd/search/infrastructure/job/AttractionApiReindexTasklet.kt","line":309,"quote":"modifiedAt = attraction.sourceModifiedAt,"},
               {"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":540,"quote":"\"$place $type ${region.typeCount}곳 중 $category ${categoryCount}곳\""}],
   "reason":"place 단계 불필요(B1)와 집계 문장 중복(B7)이 실재한다. 이름 표기 두 건은 같은 편집에 딸린 MINOR 다."},
  {"id":"domain-D5 출처 줄을 source 값으로 바꾸면 출처 의무 흔들림","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":386,"quote":"// 출처표시 의무 (data-sources.md §0) — 화면 바닥글과 같은 문구"},
               {"file":"docs/architecture/data-sources.md","line":100,"quote":"`place` 화면은 \"출처: 한국관광공사 TourAPI\","}],
   "reason":"스펙 SR-2.5 가 의무 문구의 첫 항목을 코드값으로 바꾸게 읽힌다."},
  {"id":"impl-R1 place 단계 할 일 없음, 실제 공백은 search 배치","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"place/feature/src/main/kotlin/com/kgd/place/presentation/attraction/dto/AttractionDtos.kt","line":20,"quote":"data class UpsertAttractionItem("}],
   "reason":"스펙이 인용한 :41 은 적재 요청이고 `place/app` 디렉토리는 없다(ls 결과 place/feature 만 있음). B1."},
  {"id":"impl-R2 파서 v3 운영 순서·롤백 없음","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/specs/2026-10-08-place-text-and-states/verifications/deploy-check.md","line":16,"quote":"| 파서 v2 | 미확인 — 다음 정기 재색인(… 10-09 06:30 KST) 뒤"},
               {"file":"docs/specs/2026-10-08-place-text-and-states/spec.md","line":36,"quote":"롤백: 이전 search:batch 이미지로 되돌린 뒤 재색인 1회."},
               {"file":"search/batch/src/main/kotlin/com/kgd/search/infrastructure/job/AttractionApiReindexTasklet.kt","line":337,"quote":"aliasManager.updateAliasAndCleanup(indexAlias, newIndexName, maxRetention = 1)"}],
   "reason":"v2 미확인은 부모가 준 사실과 같다. 직전 스펙에는 있던 롤백이 이 스펙에는 없다."},
  {"id":"impl-R3 요금 행 규칙 세 벌·판정과 표시 우선순위 어긋남","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionAttributeParser.kt","line":181,"quote":"startsFree && !hasAmount -> Admission.FREE / startsFree -> Admission.UNKNOWN"}],
   "reason":"합친 입력으로 판정하면 useFee=무료 + 금액 행에서 표시는 「무료」, 판정은 UNKNOWN 이 된다. B2."},
  {"id":"impl-R4 확인 상태가 출처표시 의무 문구를 코드값으로","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"portal-fe/src/pages/place/placeAttributes.ts","line":190,"quote":"en ? 'Source: Korea Tourism Organization TourAPI' : '출처: 한국관광공사 TourAPI',"}],
   "reason":"B4."},
  {"id":"impl-R5 tel: 정규화가 S2-7 표본에서 깨진 링크","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/research/2026-10-07-tourism-growth/evidence/stage2/s2-7-fact-check.md","line":28,"quote":"행사장 02-319-1220운영사 02-737-6444"},
               {"file":"docs/research/2026-10-07-tourism-growth/evidence/stage2/s2-7-fact-check.md","line":38,"quote":"02-2153-0310, 0311 (12:00~13:0"}],
   "reason":"「숫자·하이픈만 남김」을 그대로 적용하면 번호가 이어 붙는다. B5."},
  {"id":"impl-R6 브레드크럼 JSON-LD·toApi·응답 DTO 경로 누락","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"portal-fe/src/seo/copy.mjs","line":796,"quote":"관광지 상세 breadcrumb — 허브 › 시도 › 관광지. 화면(AttractionPage)과 서버 렌더가 같은 세 칸을 심어야 한다"},
               {"file":"portal-fe/src/seo/__tests__/attractionJsonLdGolden.test.ts","line":30,"quote":"function toApi({ location, ldongRegnCd, eventStartEffective, eventEndEffective, ...rest }: IndexDoc)"}],
   "reason":"toApi 가 sigunguName 을 region 아래로 옮기지 않는다. placeApi.ts 에서 modifiedAt 검색 0건. B3."},
  {"id":"impl-R7 기존 절 중복·유형 적용 범위 미정","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":377,"quote":"append(typeSection(lang, doc, today) ?: visitorInfo(lang, doc))"},
               {"file":"portal-fe/src/pages/place/AttractionPage.tsx","line":439,"quote":"다 없으면 블록 자체를 내지 않는다(빈 표는 \"정보 없음\"보다 나쁘다)."}],
   "reason":"「정보 없음」 문구는 주석에만 있고 화면에는 아직 없다. 유형별 절이 visitorInfo 를 대신하는 구조도 확인된다. B7."},
  {"id":"impl-R8 SSR img width·height 출처 없음·괄호 순서","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":725,"quote":"const val OG_IMAGE_W = 1200"},
               {"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionAttributeParser.kt","line":65,"quote":"for (segment in main.split(',', '/', '\\n')"}],
   "reason":"색인 매핑에 width 가 0건이다. 쪼개기가 괄호 처리보다 먼저 일어난다. B8·B6."},
  {"id":"security-S-1 새 원문 출력에 디코드 뒤 이스케이프 순서 미명시","verdict":"demote","severity":"MINOR",
   "evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":41,"quote":"원문은 모두 [sourceText](태그 제거 → 디코드) 뒤 [escapeHtml] 을 거쳐 나간다."},
               {"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":455,"quote":"\"<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>\""}],
   "reason":"ⓑ 렌더러가 모든 원문 출력에 sourceText→escapeHtml 을 이미 계약으로 적고 실제로 쓴다. 남는 것은 infoRaw 가 SSR 에 처음 나가는 경로의 단언 하나뿐이다."},
  {"id":"security-S-2 tel: 정규화가 여러 번호를 이어 붙임","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"portal-fe/src/seo/copy.mjs","line":837,"quote":"(표본 182개 중 21개: infoCenter `<br>` 11 · useTime `<br>` 8 · 개행 10)."}],
   "reason":"B5."},
  {"id":"test-T1 파서 입력 확장이 색인 경로에 닿는지 재는 테스트 없음","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/batch/src/main/kotlin/com/kgd/search/infrastructure/job/AttractionApiReindexTasklet.kt","line":221,"quote":"AttractionAttributeParser.parse( AttractionAttributeSource( restDate… useFee = attraction.useFee"},
               {"file":"search/batch/src/main/kotlin/com/kgd/search/infrastructure/client/PlaceApiClient.kt","line":71,"quote":"val infoRaw: String? = null,"}],
   "reason":"태스클릿이 infoRaw 를 갖고 있으면서도 넘기지 않는다. 파서 단위 테스트는 이 공백을 못 잡는다. B3."},
  {"id":"test-T2 휴무 v3 가 기존 의도적 UNKNOWN 픽스처와 충돌","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/domain/src/test/resources/attributes/raw-fixtures.tsv","line":41,"quote":"restDate\tko\tUNKNOWN\t매주 월요일 (단, 월요일이 공휴일인 경우 그 다음날 휴무) / 1월 1일 …"},
               {"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionAttributeParser.kt","line":54,"quote":"격주·월 n회·다음날·전날처럼 요일을 확정할 수 없게 만드는 말. 휴일 문구와 섞여 있어도 UNKNOWN 이다."}],
   "reason":"4811 은 tsv:41 과 같은 종류인데 스펙만으로는 기대값을 읽어 낼 수 없다. 사용자 판단 U1."},
  {"id":"test-T3 요금 확장 경계 미정·픽스처 형식","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/domain/src/test/kotlin/com/kgd/search/domain/attraction/model/AttractionAttributeParserTest.kt","line":118,"quote":"parse(useFee = row.raw).freeAdmission.name shouldBe row.expected"}],
   "reason":"픽스처 표에 반복정보를 넣을 칸이 없다. B2."},
  {"id":"test-T4 FE↔SSR 같은 문구 패리티 없음","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/app/src/test/kotlin/com/kgd/search/infrastructure/render/FooterLinksParityTest.kt","line":12,"quote":"(파일 실존 — 프리렌더 골든 ↔ 서버 렌더 패리티 선례)"}],
   "reason":"선례가 실제로 있고, SR-3.1 의 「같은 문구」를 재는 장치는 없다."},
  {"id":"test-T5 경계·부정 케이스 누락","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":552,"quote":"val nearby = region.sameCategoryNearby.filterNot { ended(it.eventEndEffective, today) }"}],
   "reason":"모두 끝난 행사 0건, Type2 license, modifiedAt null 같은 케이스가 계획에 없다."},
  {"id":"test-T6 골든은 정답 아님·관광지 골든 없음","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/app/src/test/kotlin/com/kgd/search/infrastructure/render/AttractionPageRendererTest.kt","line":567,"quote":"갱신은 명시 플래그로만: UPDATE_RENDER_GOLDEN=1"},
               {"file":"search/app/src/test/kotlin/com/kgd/search/infrastructure/render/AttractionPageRendererTest.kt","line":145,"quote":"섹션 순서는 개요 → 방문 정보 원문 → 배지 → 지역 안 위치"}],
   "reason":"골든 사례가 행사·숙박·코스뿐이다. 순서 단언은 문구 indexOf 를 쓴다."},
  {"id":"test-T7 화면 측정 판정 기준 모호","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":44,"quote":"요금·쉬는 날·길찾기의 y 좌표가 664 이하인지 CDP 로"}],
   "reason":"top 기준인지 bottom 기준인지 정해지지 않았다. 번들이 최신인지 확인하는 절차도 없다."},
  {"id":"usecase-R1 출처 폴백이 S1-11 매핑과 어긋남","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-11-trust-field-mapping.md","line":80,"quote":"값 미전달·미지원이면 「출처: 정보 없음」. TourAPI로 자동 추정 금지"},
               {"file":"docs/plans/2026-10-08-place-growth-work-plan.md","line":79,"quote":"출처·원천 갱신일·수집일은 S1-11 매핑대로"}],
   "reason":"스펙 결정과 입력 문서가 정면으로 어긋나지만, 칸과 바닥 줄을 나누면 해소된다. 리뷰어 등급 유지. B4."},
  {"id":"usecase-R2 tel: 정규화 깨진 링크","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/research/2026-10-07-tourism-growth/evidence/stage2/s2-7-fact-check.md","line":31,"quote":"02-724-0274~6"}],"reason":"B5."},
  {"id":"usecase-R3 휴무 v3 부정 표본 없음","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/research/2026-10-07-tourism-growth/evidence/stage2/s2-7-fact-check.md","line":18,"quote":"매월 마지막 월요일 (단, 공휴일일 경우 공휴일이 끝난 다음날) / 1월…"}],"reason":"B6."},
  {"id":"usecase-R4 S2-7 재측정 기대값 없음","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/research/2026-10-07-tourism-growth/evidence/stage2/s2-7-fact-check.md","line":46,"quote":"입장 UNKNOWN 인데 원문에 「무료」가 있음: 9건 — … 13354 K-컬처 스크린 …"},
               {"file":"docs/research/2026-10-07-tourism-growth/evidence/stage2/s2-7-fact-check.md","line":5,"quote":"주차 정규화는 파서 v1 기준"}],
   "reason":"13354 는 반복정보 요금 11건 목록(:45)에 없어서 이번 변경으로 바뀌지 않는다."},
  {"id":"usecase-R5 집계 문장·이웃 절이 기존 SSR 과 겹침","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":540,"quote":"\"$place $type ${region.typeCount}곳 중 $category ${categoryCount}곳\""}],"reason":"B7."},
  {"id":"usecase-R6 SSR img width·height 출처 없음","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/plans/2026-10-08-place-growth-work-plan.md","line":83,"quote":"`http://tong.visitkorea.or.kr` 사진 https 치환(적재 시). … 히어로 `<img>` SSR 은 이미지 SEO·CLS 항목"}],
   "reason":"S2-5 와 범위가 겹친다. B8, 사용자 판단 U4."},
  {"id":"usecase-R7 영문 요금 출처 규칙 비어 있음","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":23,"quote":"이름이 「입장료」「관람료」「이용요금」(공백 무시)인 행"}],
   "reason":"레포에 영문 infoname 표본이 없어 반증할 수 없다. 사용자 판단 U5."},
  {"id":"usecase-R8 S3-7 완료 조건 일부가 사용자 몫","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/plans/2026-10-08-place-growth-work-plan.md","line":101,"quote":"Schema.org 검증(일반)과 Google 리치 결과 테스트(지원 기능만)를 **구분**해 둘 다 오류 0"}],
   "reason":"완료 판정 시점이 정해져 있지 않다. creator·sameAs 축소도 적혀 있지 않다."}
]
```

SUMMARY: keep 33 / demote 1 / dismiss 0
NOTES: 계약 게이트는 `searchReadRequired` 에 넣은 필드만 막는다. 이번 세 필드(`source`·`copyrightDivCd`·`feeText`)는 반드시 넣어야 표시가 조용히 비지 않는다.

## 3. spec.md 편집 목록 (구현자가 그대로 반영)

아래 [U1]~[U6] 표시가 붙은 문장은 사용자 판단 항목의 권고 기본값으로 적었다. 사용자가 다르게 고르면 그 문장만 바꾼다.

**E1 — 1행 source 주석**: `, place/app -->` → `, search/batch/src/main/kotlin/com/kgd/search/infrastructure/client/PlaceApiClient.kt -->`

**E2 — 4행 「ADR 불요」 문장**:
- 바꿀 문장: `서비스 간 통신 방식은 그대로(place API 응답 필드 추가).`
- 새 문장: `서비스 간 통신 방식은 그대로다. place API 는 이미 `source`·`copyrightDivCd` 를 응답에 싣고 있어 변경이 없고, search:batch 가 받아 쓰기만 한다.`

**E3 — SR-1 전체 교체**
```
### SR-1 첫 화면 순서 (FE · SSR 같은 순서)
1. 브레드크럼(허브 › 시도 › 시군구 — 색인 `sigunguName`·`ldongSignguCd` 가 없으면 시도까지) → 제목(h1)·찜 → **방문 요약**(SR-2) → 행동 줄(SR-2.6) → 개요(좁은 화면 접기 유지) → 이하 기존 절 순서 유지.
2. 방문 요약은 `typeSection` 이 null 인 유형(행사·숙박·여행코스를 뺀 전부)에만 붙는다. 행사·숙박·코스는 지금 유형별 절을 그대로 두고 행동 줄만 붙인다.
3. [U2] 일반 유형에서 방문 요약은 SSR `visitorInfo`(「이용 안내」)와 `badges`(「방문 정보 요약」/「At a glance」) 두 절을 대체한다. FE 의 같은 두 절도 같다. 배지의 해석값(연중무휴·주차 가능 등)은 해당 칸 값으로 흡수하고, 「많이 클릭한 곳」은 방문 요약 맨 아래 한 줄로 남긴다.
4. FE 사진 히어로는 방문 요약 **아래**로 내린다. 데스크톱은 2열(왼쪽 요약·행동, 오른쪽 히어로)로, 지금 높이를 넘지 않게 — 세부 배치는 DESIGN.md 토큰과 `docs/design/k-heritage.html` 견본을 따른다.
5. SSR 은 FE 와 같은 순서로 절을 낸다. 절마다 `data-place-section` 속성(visit-summary · actions · same-category-nearby)을 붙인다. [U6] JSON-LD `BreadcrumbList` 도 시군구 단계를 넣는다(copy.mjs `attractionBreadcrumbJsonLd` 와 Kotlin `breadcrumbJsonLd` 를 함께 바꾸고 골든 사례에 넣는다).
6. 패리티 예외: 「같은 분류 가까운 곳」은 SSR 전용 절이다. FE 는 「주변 탐색」에 합쳐 두며(`AttractionPage.test.tsx:140`) 이번에 바꾸지 않는다.
```

**E4 — SR-2 전체 교체**
```
### SR-2 방문 요약 (값의 출처와 규칙)
1. 칸: 요금 · 이용시간 · 쉬는 날(+정기휴무 요일) · 주차 · 반려동물 · 무장애 · 확인 상태. 값이 없는 칸은 「정보 없음 / Not provided」로 남긴다 — 이 문구는 이번에 새로 만든다(지금 상세에는 없다). 불가·아니오로 바꾸지 않는다(S2-4).
2. 요금 텍스트(새 파생 색인 필드 `feeText`): 규칙 원본은 search:domain 순수 함수 `AttractionFee.text(useFee, infoRaw)` 한 곳이다.
   - `sourceText(useFee)` 가 비어 있지 않으면 그 값만 쓴다.
   - 비었으면(null · 빈 문자열 · 공백뿐) `infoRaw` 에서 `infoname` 의 공백을 지운 값이 「입장료」「관람료」「이용요금」 중 하나인 행을 고른다. 그 행들의 `infotext` 를 `serialnum` 오름차순으로 각각 `sourceText` 한 뒤 「 / 」로 잇는다. 「주차요금」 등 다른 이름은 제외한다.
   - 둘 다 없으면 null 이다.
   - 재색인 태스클릿이 이 값을 한 번 계산해 `feeText`(text, `index: false`)로 싣는다. SSR·FE 는 이 필드만 읽고 규칙 사본을 두지 않는다. 원천 `useFee`·`infoRaw` 는 그대로 둔다(외부 데이터 3규칙 ②).
3. 입장 무료 판정(도메인 `freeAdmission`, 색인 `attrAdmission`): `AttractionAttributeSource` 에 `feeText` 를 더하고, `admission()` 은 `useFee` 대신 `feeText` 를 읽는다 — 표시와 같은 값이다. 규칙 표는 지금 그대로 쓴다. 태스클릿(`AttractionApiReindexTasklet.kt:221-229`)이 `AttractionFee.text(attraction.useFee, attraction.infoRaw)` 를 한 번 계산해 파서와 문서에 같은 값을 넘긴다. 파서 KDoc(`AttractionAttributeParser.kt:6-8`)은 「요금은 place `use_fee` + 반복정보 요금 행 폴백, 규칙은 `AttractionFee` 한 곳」으로 고친다. 파서 `VERSION` 2 → 3.
4. 휴무 파서(같은 VERSION 3): 쉼표·빗금으로 쪼개기(`:65`) **전에** 괄호 단서를 처리한다.
   - [U1] 괄호 `(`…`)` 안에 휴무가 옮겨 가는 말(「다음날」「다음 평일」「그 다음」「전날」「대신」)이 있으면 지금처럼 UNKNOWN 이다.
   - 그런 말이 없고 여는 말(「정상 개장」「개방」 등)만 있으면 괄호를 떼고 요일을 읽는다. 단서는 쉬는 날 원문에 그대로 보인다.
   - 괄호가 닫히지 않으면 UNKNOWN 이다.
   - 「매월 마지막 월요일 (단, …)」처럼 매주가 아닌 문장은 괄호를 떼도 UNKNOWN 이다.
   - 영문 괄호 단서는 지금 동작을 유지한다.
5. 확인 상태 칸: 「출처: {표시명} · 원천 갱신일: YYYY-MM-DD」(S1-11 §4 문구).
   - 표시명 표: TOURAPI → 「한국관광공사 TourAPI」 / 「Korea Tourism Organization TourAPI」 · GOCAMPING → 「한국관광공사 고캠핑」 / 「Korea Tourism Organization GoCamping」 · null 이나 그 밖의 값 → 「출처: 정보 없음」 / 「Source: Not provided」. TourAPI 로 추정하지 않는다(S1-11).
   - 원천 갱신일은 색인 `modifiedAt`(= place `sourceModifiedAt`)이다. null 이면 「원천 갱신일: 정보 없음」.
   - [U3] 수집일은 S1-11 대로 「수집일: 정보 없음」을 낸다(신설은 Out of Scope).
   - JSON-LD `dateModified` 는 넣지 않는다.
   - 바닥 출처 줄(출처표시 의무, SSR `sourceLine` · FE `placeSourceLine`)은 확인 상태와 별개로 유지한다. 첫 항목은 `source=GOCAMPING` 이면 「출처: 한국관광공사 고캠핑」, 그 밖(TOURAPI·null·모르는 값)이면 지금 고정 문구다. 의무 문구라 null 이어도 비우지 않는다(`data-sources.md:99-100`). 첫 항목이 고캠핑이면 덧붙는 「고캠핑」은 빼서 한 번만 낸다.
6. 행동 줄:
   - 길찾기는 지금 「구글 지도에서 보기」 링크를 요약 아래로 올린다(새 외부 호출 없음).
   - 전화는 `infoCenter`(비면 `tel`)를 `sourceText` 한 뒤, 처음 나오는 전화번호 **하나만** `tel:` 링크로 만든다. 패턴: `(?:\+82[- ]?)?0\d{1,3}[- ]?\d{3,4}[- ]?\d{4}`, 이것이 없을 때만 대표번호 `\b1\d{3}(?:-\d{4})?\b`. href 는 숫자와 `+` 만 남긴다.
   - 패턴이 없으면 링크 없이 원문만 보인다. 둘 다 비면 전화 항목을 내지 않는다. 원문은 보이는 글로 둔다.
7. 새로 나가는 원문 값(요금·쉬는 날·전화·시군구·이웃 제목·`alt`·`containedInPlace.name`)은 모두 `sourceText` → `escapeHtml` 순서다(렌더러 계약 `AttractionPageRenderer.kt:41`). `tel:` href 도 `escapeHtml` 을 거친다.
```

**E5 — SR-3 전체 교체**
```
### SR-3 고유 블록 (S3-7)
1. 사실 표: SSR 방문 요약을 `<dl data-place-section="visit-summary">`(이름·값 쌍)로 낸다 — FE 와 같은 칸·같은 문구(SR-5.1 패리티 골든으로 잰다).
2. 거리순 이웃 링크: 기존 「같은 분류 가까운 곳 / Similar places nearby」를 `regionSection` 밖 독립 절(`data-place-section="same-category-nearby"`)로 옮긴다. 이름은 유지한다(glossary 3-1). 끝난 행사를 거른 **뒤**(`:552`) 0건이면 절을 내지 않는다. SSR 전용(SR-1.6).
3. 집계 문장: 새 문장을 만들지 않는다. 기존 `regionSection` 문장(「{시군구} {유형} N곳 중 {분류} M곳」, `AttractionPageRenderer.kt:535-545`, {분류}=원천 소분류 이름 `categoryName`)을 S3-7 집계 문장으로 본다.
4. SSR 사진: 대표 사진 1장을 `<img src alt="{제목}">` 으로 낸다.
   - [U4] `https://` 이면 그대로, `http://tong.visitkorea.or.kr/` 이면 `https://` 로 바꿔 낸다. 그 밖의 http 는 내지 않는다.
   - `width`·`height` 는 원천에 크기가 없어 넣지 않는다(크기·CLS 는 S2-5).
   - 사진이 없으면 내지 않는다.
5. JSON-LD 보강(TouristAttraction): `containedInPlace`(시군구 → 시도 `AdministrativeArea`, 이름만), `image` 를 `ImageObject`(`contentUrl`, `license`, `creditText` 「한국관광공사」)로 바꾼다.
   - `license` 는 `copyrightDivCd` 가 Type1 이면 공공누리 제1유형 URL, Type3 이면 제3유형 URL, 그 밖의 값(Type2 등)이나 null 이면 넣지 않는다.
   - `isAccessibleForFree` 는 SR-2.3 결과로 자연히 늘어난다.
   - `sameAs`·`creator` 는 원천이 없어 넣지 않는다(Out of Scope — 계획 S3-7 에서 줄어든 항목).
6. 규칙 원본은 지금처럼 `copy.mjs` `attractionJsonLd` 이고 Kotlin 이 골든 패리티로 따른다.
   - `jsonld-golden.json` 케이스: 사진 Type1·Type3·Type2·없음, 시군구 있음·없음.
   - 골든 생성기 `toApi`(`attractionJsonLdGolden.test.ts:30`)는 색인 `sigunguName` 을 copy.mjs 가 읽는 자리로 옮기도록 고친다.
```

**E6 — SR-4 전체 교체**
```
### SR-4 색인 필드 전달
1. place 는 바꾸지 않는다 — `AttractionResponse` 가 이미 `source`(`AttractionDtos.kt:140`)·`copyrightDivCd`(`:159`)를 싣는다.
   - 고칠 곳: search:batch `PlaceApiClient.AttractionDto` 필드와 `fetchPageAfter` 손 매핑(`PlaceApiClient.kt:32-33, 177-218` — 데이터 클래스에만 넣으면 null 로 색인된다), 태스클릿 문서 조립(`AttractionApiReindexTasklet.kt:267-322`), search:domain `AttractionDocument`, batch `AttractionIndexDocument`(필드·변환), `attractions-index.json`(`source`·`copyrightDivCd` keyword, `feeText` text `index: false`), app `AttractionSearchDocument`(필드·변환), `SearchAttractionUseCase` 결과, `SearchAttractionService` 매핑, FE `placeApi.ts` `Attraction`(`source`·`copyrightDivCd`·`feeText`·`modifiedAt`).
   - `searchReadRequired`(`build.gradle.kts:538`)에 `source`·`copyrightDivCd`·`feeText` 를 넣는다.
   - 외부 데이터 3규칙 ③은 해당 없다 — place 컬럼·왕복 경로가 그대로이고, 재색인은 매번 새로 쌓는다.
2. 선행 조건: 2026-10-09 06:30 KST 정기 재색인 로그에서 `attribute parser v2` 와 영문 N/A 주차 UNKNOWN 건수를 확인해 `docs/specs/2026-10-08-place-text-and-states/verifications/deploy-check.md` 에 적은 **뒤에** v3 search:batch 를 배포한다. S2-7 「전」 값도 v2 재색인 뒤 같은 30곳으로 다시 받는다.
3. 배포 순서: search:batch(색인) → 재색인 → search:app·portal-fe(표시). 새 필드가 없을 때의 폴백:
   - 확인 상태 칸은 「출처: 정보 없음」, 바닥 출처 줄은 지금 고정 문구.
   - `feeText` 가 없으면 지금처럼 `useFee` 만 보인다.
4. 롤백: v2 search:batch 이미지로 되돌리고 재색인 1회. `attributeParserVersion` 이 2 로 돌아왔는지 확인한다. 새 필드는 비고 표시는 3 의 폴백으로 돌아간다.
5. 수동 재색인은 정기 회차(21:30 UTC)와 겹치지 않는 시각에, 실행 중인 Job 이 없는지 확인한 뒤 1회만 돌린다(`concurrencyPolicy: Forbid` 는 수동 Job 을 막지 않는다).
```

**E7 — SR-5 전체 교체**
```
### SR-5 검증
1. 단위 (반복정보 케이스는 픽스처 표가 아니라 given/then 개별 케이스):
   - `AttractionFee.text`:
     - useFee 있음 → 그 값.
     - useFee 「무료」 + 반복정보 「입장료 3,000원」 → 「무료」, 판정 FREE.
     - useFee 공백뿐 → 반복정보.
     - 요금 행 둘(입장료·관람료) → serialnum 순 「 / 」.
     - 「입장 료」 → 일치.
     - 「주차요금」 → 제외.
     - 둘 다 없음 → null.
   - 파서 v3 픽스처:
     - 77 원문 → MON.
     - [U1] 4811 원문 → UNKNOWN.
     - tsv:41·79 기대값 유지.
     - 16151 원문 → UNKNOWN.
     - 쉼표 없는 괄호 「매주 화요일(공휴일 정상 개장)」 → TUE.
     - 닫히지 않은 괄호 → UNKNOWN.
     - 반복정보만 「무료」 → FREE, 금액 → PAID.
     - `fixtures.size` 단언을 새 행 수로 고친다.
   - 태스클릿: `useFee=null` + `infoRaw` 무료 행 → bulk `attrAdmission=FREE`·`feeText`, 금액 행 → PAID. `source`·`copyrightDivCd` 를 단 dto → bulk 에 같은 값. 재색인 캡처(`AttractionReindexCaptureTest`)에도 세 필드를 넣는다.
   - `PlaceApiClientTest`: 두 필드 역직렬화.
   - `SearchAttractionService`: API 결과에 세 필드가 실린다.
   - 확인 상태: source TOURAPI·GOCAMPING·null·기타 × 국·영, `modifiedAt` null, SSR HTML 에 「원천 갱신일: YYYY-MM-DD」 텍스트.
   - 바닥 출처 줄: GOCAMPING + camping 일 때 「고캠핑」이 한 번만.
   - `tel:` 기대값:
     - 「행사장 02-319-1220운영사 02-737-6444」 → `tel:023191220`
     - 「02-724-0274~6」 → `tel:027240274`
     - 「02-2153-0310, 0311 (12:00~13:0」 → `tel:0221530310`
     - 「K-컬처 스퀘어 운영사무국 02-2068-1176」 → `tel:0220681176`
     - `02-123-4567<br>010-1234-5678` → `tel:021234567`
     - 「1330」 → `tel:1330`
     - 「문의: 없음」 → 링크 없음
   - XSS: 요금 행 `infotext` 에 `&lt;img src=x onerror=alert(1)&gt;` 와 `"` → SSR 에 `<img` 없이 `&lt;img` 만.
   - 순서 단언: 골든과 별개로 `data-place-section` 표지 기준, `order.none { it < 0 }` + `order shouldBe order.sorted()`. 기존 `AttractionPageRendererTest.kt:145-150`·`:189-195` 를 새 순서로 고친다. FE 는 DOM 순서 단언.
   - 브레드크럼 시군구(화면·BreadcrumbList).
   - 이웃: 0건, 그리고 「목록은 있으나 모두 끝난 행사」 → 절 없음.
   - SSR `<img>`: https 그대로 · tong http → https · 그 밖 http → 없음 · 사진 없음 → 없음.
   - JSON-LD: license 절대값 `it`(Type1 → 제1유형 URL, Type3 → 제3유형 URL, Type2·null → 속성 없음) + 골든 새 케이스 + 패리티.
   - 관광지(12) 국·영 골든 HTML 추가(갱신은 `UPDATE_RENDER_GOLDEN=1`).
   - FE↔SSR 방문 요약 패리티: FE 방문 요약 함수의 출력(칸 이름·값)을 골든 JSON 으로 쓰고, Kotlin 이 렌더된 `<dl>` 에서 뽑아 비교한다(`FooterLinksParityTest` 방식). 케이스는 feeText 있음·useFee 만·둘 다 없음 × source 있음·없음 × 국·영.
   - 색인 매핑 계약 게이트.
2. S2-7 30곳 재측정: 「전」은 v2 재색인 뒤 같은 30곳, 같은 집계 스크립트로 받는다. 기대값을 미리 적는다:
   - [U1] 휴무 누락 2 → 1(4811 은 휴무가 옮겨 가는 단서라 UNKNOWN 유지).
   - 요금 칸 「정보 없음」 11 → 0.
   - 입장 UNKNOWN 9건 중 13354 는 반복정보 요금 행이 없어 남는다. 나머지 8건은 재색인 전에 각 id 의 반복정보 요금 행 원문으로 기대값(FREE·PAID·UNKNOWN)을 표에 먼저 적는다.
   - 안 바뀌는 id 는 이유와 함께 「남는 건」으로 둔다.
3. 화면: 390×844(가시 664px)에서 요금·쉬는 날·길찾기 요소의 `getBoundingClientRect().bottom ≤ 664` 를 CDP 로 잰다(30곳 중 표본 5곳, 국·영). 1280×800 도 같다. 측정 전에 로드된 번들에 이번에 넣은 심볼이 있는지 확인하고, 옛 번들 측정은 버린다. 가독성 우선 — 못 맞추면 실측과 이유를 남긴다.
4. 구조화 데이터: 표본 5 URL 을 validator.schema.org 로 오류 0. Google 리치 결과 테스트는 표본 3 URL 을 사용자 몫으로 넘기고(Q2), 결과를 받기 전까지 S3-7 은 「구현 완료·검증 대기」다.
5. 회귀 주입(임시 사본) — 아래 각각이 빨간불을 내야 한다:
   - 괄호 여는 말 처리 삭제 → 77 단언 빨강
   - 휴무 이동 말 판정 삭제 → 4811 UNKNOWN 단언 빨강
   - `AttractionFee` 반복정보 폴백 삭제 → 빨강
   - 태스클릿에서 `feeText` 전달 삭제 → 태스클릿 단언 빨강
   - `SearchAttractionService` 매핑 한 줄 삭제 → 서비스 단언 빨강
   - 확인 상태 null 폴백 삭제 → 「출처: 정보 없음」 단언 빨강
   - 요금 행 `escapeHtml` 제거 → XSS 단언 빨강
   - FE 방문 요약 문구 한쪽만 변경 → 패리티 빨강
   - SSR 방문 요약을 개요 뒤로 → 순서 단언 빨강
   - ImageObject license 매핑 뒤바꿈 → 절대값 단언과 골든 패리티 빨강
   - 색인 매핑에서 새 필드 삭제 → 계약 게이트 빨강
6. 문서: 구현 뒤 `search/glossary.md` 3-1 절에 「방문 요약」「확인 상태」「행동 줄」「feeText」를 등록한다.
```

**E8 — Existing Code to Leverage**: `AttractionDtos.kt:41,159` → `AttractionDtos.kt:140,159`. 끝에 `PlaceApiClient.kt:32-80,177-218`, `SearchAttractionService.kt:240`, `build.gradle.kts:538`, `attractionJsonLdGolden.test.ts:30` 를 더한다.

**E9 — Out of Scope 끝에 추가**: `영문 반복정보 요금 행 이름(영문 요금 칸은 이번에 변화 없음 [U5]), 영문 휴무 괄호 단서, SSR 사진 크기·https 적재 치환(S2-5), 계획 S3-7 의 creator·sameAs(원천 없음), 수집일 신설.`

## 4. 재리뷰가 필요한 차원
- **architecture**: 파생 색인 필드 `feeText` 를 새로 두고 파서 입력 경계를 바꿨다.
- **implementation**: 경로 목록, 운영 순서, 롤백이 새로 들어갔다.
- **test-strategy**: SR-5 를 전면 교체했다.
- **usecase**: 재측정 기대값, S1-11 정합.
- domain·security 는 수정안을 그대로 반영해 재리뷰가 필요 없다. 다만 U2 에서 기본값이 아닌 쪽(병존)을 고르면 domain 은 다시 본다.

## 5. 사용자 판단 항목 (권고 기본값)

| # | 질문 | 권고 기본값 | 근거 |
|---|---|---|---|
| U1 | 휴무가 옮겨 가는 단서(4811 「…개방하며 그 다음 첫 번째 평일」, tsv:41 「그 다음날 휴무」)를 MON 으로 볼지 UNKNOWN 으로 둘지 (test T2) | **UNKNOWN 유지.** 「정상 개장·개방」만 붙은 77 은 MON. S2-7 휴무 누락 기대값은 2→1 | 파서 규칙 `:54` 「다음날·전날 … UNKNOWN」과 픽스처 41·79 의 의도를 그대로 지킨다. 4811 을 MON 으로 하면 공휴일 다음 평일 휴무가 「그날 연다」로 읽힌다. 원문은 쉬는 날 칸에 그대로 보이므로 잃는 정보가 없다. 대안(MON)을 고르면 tsv:41 도 MON 으로 바뀌고 회귀 주입 목록이 달라진다 |
| U2 | 방문 요약이 기존 「이용 안내」·「방문 정보 요약」 배지 절을 대체할지 병존할지 | **일반 유형에서 대체.** 「많이 클릭한 곳」은 요약 아래 한 줄 | 병존하면 같은 휴무·주차가 첫 화면에 두 번 나가고, 순서 단언이 다른 절의 같은 문구를 집는다(T6) |
| U3 | 수집일 표시 | **S1-11 대로 「수집일: 정보 없음」** | 계획 S2-2(`plan:79`)가 「S1-11 매핑대로」를 명시한다. 생략하려면 그 이유를 스펙에 한 줄 남겨야 한다 |
| U4 | SSR `<img>` 의 크기와 http 주소 | **width·height 생략, `tong.visitkorea.or.kr` http → https, 그 밖 http 는 내지 않음** | 원천에 크기가 없어 값을 지어낼 수밖에 없다. CLS·적재 치환은 계획 S2-5(`plan:83`) 몫이다 |
| U5 | 영문 요금 행 이름 | **이번 범위 밖**(Out of Scope 명시) | 레포에 영문 `infoname` 표본이 없어 목록을 근거 있게 만들 수 없다. S2-7 30곳은 국문이다 |
| U6 | BreadcrumbList JSON-LD 에도 시군구를 넣을지 | **넣는다**(copy.mjs·Kotlin·골든 함께) | 보이는 브레드크럼과 구조화 데이터가 같은 단계를 갖게 된다. 안 넣어도 위반은 아니라 사용자가 반대하면 SR-1.5 의 해당 문장만 지운다 |

참고 경로(전부 워크트리 `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl` 기준):
- `docs/specs/2026-10-09-place-detail-first-screen/spec.md`
- `docs/specs/2026-10-09-place-detail-first-screen/context/engineer-review-*.md`