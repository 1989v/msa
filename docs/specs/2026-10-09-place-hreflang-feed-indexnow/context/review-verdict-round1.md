# 스펙 리뷰 판정 1라운드: place hreflang · 피드 · IndexNow

**결론: 발견 40건 중 유지 37 · 강등 1 · 기각 2입니다. 스펙은 고쳐서 다시 리뷰해야 합니다.**

- 반드시 먼저 고칠 셋은 I1 · I2 · I3입니다.
  - **I1**: 국문·영문 유형 코드가 달라 짝 조건 ③이 늘 거짓이 됩니다. 이대로면 짝이 0건입니다.
  - **I2**: 19번(범위 다름)이 지금 규칙을 통과합니다.
  - **I3**: IndexNow를 수집 직후에 보내면 재색인 전의 옛 본문을 알리게 됩니다.
- BLOCK을 주장한 리뷰어는 없습니다. 리뷰 파일에는 파일 단위 `VERDICT: REVISE`만 있어서, 발견별 등급은 여기서 처음 정했습니다.
- 판정 근거는 전부 워크트리 `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl` 에서 직접 읽어 확인했습니다. 파일은 쓰지 않았습니다.

**오라클을 직접 다시 계산했습니다.** 원자료 `s1-8-review-pages.json` 에서 문서 57개(영문 27 · 국문 30)를 뽑아, 영문 × 국문 조합 전체를 규칙에 넣어 돌렸습니다(스크래치패드 `verdict/cross.py`).
- **제목 조건을 넣고, 일대일을 모든 조건을 만족하는 후보 사이에서 따지면** 짝은 #1–15와 #25, 16쌍입니다. 16쌍 모두 분석자가 「같은 범위」로 판정한 쌍이라 잘못 이은 쌍은 0입니다. 범위 다름 10쌍과 판단 불가 1쌍은 하나도 짝이 되지 않습니다.
- **I2·T1의 "4·24번 둘 다 없음" 기대값은 다른 규칙일 때만 맞습니다.** placeId 후보 하나만 보고 일대일을 따지는 S1-8 §5 조건 4를 쓰면 #4와 #15가 빠져 14쌍이 됩니다. 아래 권고 규칙에서는 **#4와 #15가 「짝」**입니다. 발견 자체는 유지하고 기대값만 고쳤습니다.
- **오라클로는 잡히지 않는 회귀가 둘 있습니다.** 이 픽스처 안에서는 일대일 조건을 지우거나 좌표 조건을 지워도 결과가 같습니다. 그래서 SR-5.2의 해당 회귀 주입에는 합성 사례가 따로 필요합니다.

---

## 1. 묶음 표

| 묶음 | 발견 | 판정 | 등급 | 한 줄 |
|---|---|---|---|---|
| G1 유형 코드 대응 | I1, T2 | 유지 | REVISE | 국문 12 ↔ 영문 76처럼 코드 체계가 달라 조건 ③이 늘 거짓이고, 테스트도 이를 못 잡음 |
| G2 제목 조건 · 오라클 기대값 | I2, T1, U6 | 유지 (U6은 MINOR) | REVISE | #19가 통과함. 제목 조건을 더하고 30쌍 기대값을 고정해야 함 (#4는 위 설명대로 「짝」) |
| G3 계산 위치 · 투영 | A5, I7 | 유지 | REVISE | 1차 패스의 전체 투영에서 search:domain 순수 함수로 계산. 투영에 placeId·titleLocal이 없음 |
| G4 hreflang 표시 | I5, I6, U5 | 유지 (U5는 MINOR) | REVISE | noindex 문서를 가리킬 수 있고, 하이드레이션이 SSR의 링크를 지움. 패리티 필요 |
| G5 ADR 개정 | A1, A2 | 유지 | REVISE | ADR-0062 §8과 ADR-0103 §4·대안 6을 뒤집는데 개정 문안이 없음 |
| G6 해시 · 시각 규칙 | D3, I4, I10, A4, D4 | 유지 | REVISE | 병합 뒤 상태로 계산, source에서 복사 금지, 새 행 규칙, 시각은 인자로, null 처리, 정규화를 place가 따로 소유 |
| G7 IndexNow 시점 · 포트 | A3, I3, U3 | 유지 | REVISE | 재색인 뒤 별도 잡으로. 변경 목록은 place 내부 조회로 받음 |
| G8 IndexNow 키 · 송신 | S1, S2, S4, I12, U4 | 유지 (S4·U4는 MINOR) | REVISE | 두 파드가 같은 Secret을 씀. 키 파일은 place 호스트 · 정확 일치. 응답 코드별 로그 |
| G9 RSS | I11, S3, S5 | 유지 (S5는 MINOR) | REVISE | 언어별 upstream 2개, 실패 시 503, XML 금지 문자 제거 |
| G10 sitemap | I8 | 유지 | REVISE | `indexDoc` 에 alternateId를 싣지 않으면 sitemap에 `xhtml:link` 를 만들 수 없음 |
| G11 용어 | D1, D2 | D1 유지 / D2 강등 | REVISE / MINOR | 「같은 장소」가 `SamePlace` 와 충돌. 「관광지 용어 없음」은 사실과 다름(ⓒ) |
| G12 AC · 테스트 | U1, U2, T3, T4, T5, T6 | 유지 (T5는 MINOR) | REVISE | 「hreflang 오류 0」을 AC로, 예외 흐름, 레이어 배정, 표본 출처 |
| G13 마이그레이션 | I9 | 유지 (메모리 근거 한 줄은 판정에서 제외) | MINOR | 다음 번호 V34, 인덱스, 롤백 불요 |
| G14 통과 기록 | D5, I-동시성 | 기각 | MINOR | 결함을 주장하지 않는 통과·허용 기록 |

---

## 2. 발견별 JSON

```json
[
  {"id":"A1","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/adr/ADR-0062-seo-and-organic-discovery.md","line":136,"quote":"- **hreflang 을 걸지 않는다.** TourAPI 가 국문/영문을 별도 콘텐츠로 관리해"},{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":65,"quote":"// hreflang 없음 — TourAPI 국문/영문은 별도 콘텐츠라 짝을 모른다 (ADR-0062 §8)"}],"reason":"스펙 SR-1.4가 이 ADR 결정을 뒤집는데, 개정 대상은 ADR-0103뿐이다(spec.md:4)."},
  {"id":"A2","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/adr/ADR-0103-place-attraction-server-render-enrichment.md","line":33,"quote":"4. **속성 추출·지역 집계는 색인 시점에 search:domain 순수 함수가 한다.** … 파생값을 place 에 저장하지 않는다"},{"file":"docs/adr/ADR-0103-place-attraction-server-render-enrichment.md","line":52,"quote":"- **파생 속성을 place 컬럼으로** — 마이그레이션·백필·전체 동기화 보존(`syncFrom ?: existing`) 부담이 생기고, 소비자가 없다. 기각."}],"reason":"기각된 대안을 되살리면서 「같은 문서 필드 확장」이라는 이유만 댄다. 상태 비교가 필요하다는 예외 근거가 없다."},
  {"id":"A3","verdict":"keep","severity":"REVISE","evidence":[{"file":"place/ingest/src/place_client.py","line":72,"quote":"def fetch_attractions() -> list[dict]:\n    \"\"\"전량 스캔 — id 키셋(`afterId`)으로 id 오름차순."},{"file":"place/ingest/src/place_client.py","line":96,"quote":"def bulk_upsert(records: list[dict]) -> tuple[int, int]:"}],"reason":"ingest가 바뀐 행을 받을 경로가 전량 스캔뿐이다. 업서트 응답은 건수만 준다."},
  {"id":"A4","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionSeoText.kt","line":4,"quote":"* portal-fe `src/seo/copy.mjs` 의 텍스트 규칙을 옮긴 것 — `sourceText`·`clampDescription`·`escapeHtml`."},{"file":"place/CLAUDE.md","line":31,"quote":"- **임베딩 텍스트를 만드는 규칙은 서버에 없다.** … 규칙이 두 곳에 있으면 해시가 어긋나"}],"reason":"`sourceText` 는 search:domain에만 있고 이미 copy.mjs의 사본이다. 「같은 규칙」이라 적으면 세 번째 사본이 생긴다."},
  {"id":"A5","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/RegionAggregator.kt","line":15,"quote":"data class RegionProjection( val id… lang… contentTypeId… title… sourceTitle (googlePlaceId·titleLocal 없음)"},{"file":"search/batch/src/main/kotlin/com/kgd/search/infrastructure/job/AttractionApiReindexTasklet.kt","line":415,"quote":"val samePlaces = SamePlaceGrouper.group(listed)"}],"reason":"전량을 보는 곳은 1차 투영뿐이다. 그런데 투영에 placeId와 titleLocal이 없다."},
  {"id":"D1","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/SamePlace.kt","line":10,"quote":"* 같은 언어 · 같은 법정동 시군구 · 같은 **원천 제목**이면서 [MAX_METERS] 안에 있는 다른 활성 문서끼리 묶는다."}],"reason":"코드의 SamePlace는 같은 언어 안의 중복 등록을 뜻한다. 그런데 스펙(spec.md:7,14)은 국·영 짝을 「같은 장소」로 부른다."},
  {"id":"D2","verdict":"demote","severity":"MINOR","evidence":[{"file":"search/glossary.md","line":71,"quote":"## 3-1. 관광지 문서 용어 (ADR-0103, 2026-09-30 · 행사·숙박·여행코스 ADR-0104, 2026-10-02)"}],"reason":"ⓒ: 「search/glossary.md 에 관광지 용어 없음」은 사실과 다르다(§3-1에 관광지 용어 표가 있다). place 용어집이 없다는 점과 세 시각을 구분해야 한다는 점만 남으니, 구현 뒤 문서 정리 몫이다."},
  {"id":"D3","verdict":"keep","severity":"REVISE","evidence":[{"file":"place/domain/src/main/kotlin/com/kgd/place/domain/attraction/model/Attraction.kt","line":364,"quote":"overview = source.overview ?: overview"},{"file":"place/feature/src/main/kotlin/com/kgd/place/infrastructure/persistence/attraction/adapter/AttractionRepositoryAdapter.kt","line":35,"quote":"if (existing == null) {\n created++\n AttractionJpaEntity.fromDomain(incoming)"}],"reason":"보강 필드는 `?:` 로 병합되고 새 행은 syncFrom을 지나지 않는다. 그래서 병합 뒤에 계산한다는 것, source에서 복사하지 않는다는 것, 새 행 규칙, 시각을 인자로 받는다는 것이 모두 정해져 있지 않다."},
  {"id":"D4","verdict":"keep","severity":"REVISE","evidence":[{"file":"place/domain/src/main/kotlin/com/kgd/place/domain/attraction/model/Attraction.kt","line":402,"quote":"eventStartDate = source.eventStartDate ?: eventStartDate"},{"file":"docs/adr/ADR-0103-place-attraction-server-render-enrichment.md","line":86,"quote":"- **유형별 본문**: 행사(일정·상태 문구) · 숙박(입실·퇴실) · 여행코스(코스 구성 순서)는 … 자기 절을 그린다."}],"reason":"상세에 그려지는 행사 날짜와 introRaw 키가 해시 입력 목록(spec.md:19)에 없다."},
  {"id":"D5","verdict":"dismiss","severity":"MINOR","evidence":[{"file":"search/batch/src/main/kotlin/com/kgd/search/infrastructure/job/AttractionApiReindexTasklet.kt","line":399,"quote":"response.attractions.filter { it.status == \"ACTIVE\" }.mapTo(projections) { it.toProjection() }"}],"reason":"결함을 주장하지 않는 통과 기록(「경계 — OK」)이라 편집할 대상이 없다."},
  {"id":"I1","verdict":"keep","severity":"REVISE","evidence":[{"file":"place/ingest/src/sync_tour.py","line":48,"quote":"\"attraction\": {\"kor\": \"12\", \"eng\": \"76\"},"},{"file":"docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-8-review-pages.json","line":18,"quote":"\"contentTypeId\": \"76\","}],"reason":"코드 문자열을 그대로 비교하면 30쌍 모두 불일치다(재계산 결과 76/12, 78/14, 79/38, 75/28). 운영에서도 짝이 0건이 된다."},
  {"id":"I2","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-8-place-id-pairs.md","line":97,"quote":"특히 #19·#20·#21·#22는 **placeId + 50m + category 세 조건을 모두 통과하는 범위 불일치 반례**다."},{"file":"docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-8-place-id-pairs.md","line":105,"quote":"3. 영문 `titleLocal`과 국문 `title`이 보수적 정규화 후 일치한다."}],"reason":"재계산해 보면 제목 조건이 없을 때 #16·#19가 짝으로 나온다. 다만 「4·24 둘 다 없음」은 권고 규칙(전 조건 일대일)에서 틀린다. #4가 짝이고, 기대값은 편집 목록 부록 A로 고친다."},
  {"id":"I3","verdict":"keep","severity":"REVISE","evidence":[{"file":"k8s/base/place-ingest/cronjob-tour-sync.yaml","line":26,"quote":"schedule: \"10 18 * * *\""},{"file":"k8s/base/search-batch/cronjob-attraction-reindex.yaml","line":21,"quote":"schedule: \"30 21 * * *\""}],"reason":"상세는 search 색인을 렌더한다. tour-sync 직후에 제출하면 3시간 20분 동안 옛 본문이 나가고, 개요(19:00)·이용정보(20:00) 변경은 그 창 밖이라 놓친다."},
  {"id":"I4","verdict":"keep","severity":"REVISE","evidence":[{"file":"place/domain/src/main/kotlin/com/kgd/place/domain/attraction/model/Attraction.kt","line":364,"quote":"overview = source.overview ?: overview"}],"reason":"들어온 레코드로 해시를 내면 목록 동기화와 개요 백필이 번갈아 다른 해시를 만든다. 그러면 매일 전량이 변경으로 잡힌다."},
  {"id":"I5","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":63,"quote":"noindex = doc.overview.isNullOrEmpty() ||"},{"file":"portal-fe/scripts/prerender-seo.mjs","line":819,"quote":".filter((a) => a.hasOverview && (!PLACE_STAY_TYPES.includes(a.contentTypeId) || a.imageUrl))"}],"reason":"`alternateId` 만 있으면 링크를 걸게 되어 있어서, noindex 문서를 대체 주소로 선언할 수 있다."},
  {"id":"I6","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/seo/useSeo.ts","line":70,"quote":"document.head.querySelectorAll(`[${MULTI}]`).forEach((el) => el.remove());"},{"file":"portal-fe/src/seo/copy.mjs","line":541,"quote":"export function placeHreflangAlternates(sub = '') {"}],"reason":"AttractionPage는 alternates를 넘기지 않는다. 기존 헬퍼는 두 언어가 같은 경로라고 가정하므로 id가 다른 짝에는 쓸 수 없다."},
  {"id":"I7","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/batch/src/main/kotlin/com/kgd/search/infrastructure/job/AttractionApiReindexTasklet.kt","line":461,"quote":"title = titleDisplay ?: title,\n        sourceTitle = title,"}],"reason":"A5와 같은 내용이다. 투영에 placeId와 titleLocal을 더해야 한다."},
  {"id":"I8","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/scripts/prerender-seo.mjs","line":1003,"quote":"export function indexDoc(a, sidoCode) {"}],"reason":"indexDoc 투영에 alternateId를 싣지 않으면 sitemap에 xhtml:link를 아예 만들 수 없다. 다음 빌드까지 낡는다는 점도 적어야 한다."},
  {"id":"I9","verdict":"keep","severity":"MINOR","evidence":[{"file":"place/feature/src/main/resources/placedb/migration/V33__attraction_short_link_click.sql","line":1,"quote":"(최신 마이그레이션 = V33 — 다음 번호 V34)"}],"reason":"V34·인덱스·롤백 불요 지적은 맞다. 메모리 이름을 근거로 든 한 줄은 지시대로 판정에서 뺐다."},
  {"id":"I10","verdict":"keep","severity":"REVISE","evidence":[{"file":"place/domain/src/main/kotlin/com/kgd/place/domain/attraction/model/Attraction.kt","line":406,"quote":"sourceModifiedAt = source.sourceModifiedAt"}],"reason":"source_modified_at 이 null인 행이 첫 채움에서 null로 남으면 RSS·IndexNow가 어떻게 다룰지 정해져 있지 않다."},
  {"id":"I11","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/nginx.conf","line":69,"quote":"# - upstream 경로는 고정 문자열이다. $request_uri·쿼리를 넘기지 않는다"},{"file":"portal-fe/nginx.conf","line":72,"quote":"sitemap 자리에 HTML 200 이 나가면 크롤러가 URL 이 모두 사라졌다고 읽는다."}],"reason":"두 주소가 upstream 하나(spec.md:23)로 가면 언어를 넘길 방법이 없다. 실패 응답 규칙도 없다."},
  {"id":"I12","verdict":"keep","severity":"REVISE","evidence":[{"file":"place/ingest/src/sync_tour.py","line":165,"quote":"with urlopen(url, timeout=30) as res:"}],"reason":"제출 호출의 타임아웃, 분할, keyLocation, 응답 코드별 로그 문구가 스펙에 없다."},
  {"id":"I-동시성","verdict":"dismiss","severity":"MINOR","evidence":[{"file":"place/feature/src/main/kotlin/com/kgd/place/infrastructure/persistence/attraction/adapter/AttractionRepositoryAdapter.kt","line":24,"quote":"@Transactional\n    override fun upsertAll("}],"reason":"리뷰어 스스로 「허용」으로 결론 낸 통과 기록이다. 결함 주장이 없다."},
  {"id":"S1","verdict":"keep","severity":"REVISE","evidence":[{"file":"k8s/base/network-policy/11-allow-egress-https-public.yaml","line":11,"quote":"#   - place-ingest    TourAPI(목록·개요·축제·숙박·여행코스) + …"}],"reason":"키 파일은 portal-fe가, 제출은 place-ingest가 한다. 두 파드가 같은 키를 읽는 경로가 스펙(spec.md:27-28)에 없다."},
  {"id":"S2","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/nginx.conf","line":76,"quote":"if ($host != \"place.1989v.com\") {\n            return 404;"},{"file":"portal-fe/Dockerfile","line":79,"quote":"NGINX_ENVSUBST_FILTER=NGINX_LOCAL_RESOLVERS"}],"reason":"키 파일 location의 호스트 제한과 정확 일치가 정해져 있지 않다. envsubst 필터에도 키 변수가 없다."},
  {"id":"S3","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionSeoText.kt","line":71,"quote":"* 큰따옴표 속성값·요소 본문 전용. `'` 는 이스케이프하지 않으므로"},{"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionSeoText.kt","line":56,"quote":"if (code in 32..0x10FFFF) String(Character.toChars(code)) else \"\""}],"reason":"제어문자 숫자 엔티티만 지우고 날 제어문자는 남는다. XML 1.0은 그런 문자 하나로 문서 전체가 파싱에 실패한다."},
  {"id":"S4","verdict":"keep","severity":"MINOR","evidence":[{"file":"k8s/base/network-policy/11-allow-egress-https-public.yaml","line":33,"quote":"values: [auth, sideapp, quant-ingest, deal-linkcheck, place-ingest, ranking-ingest, db-backup]"}],"reason":"정책 변경은 필요 없고, 용도 주석과 대장 행만 맞추면 된다."},
  {"id":"S5","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md","line":23,"quote":"`Cache-Control: public, max-age=600`"}],"reason":"리뷰어 스스로 「측정 뒤」로 미뤘다(조기 최적화 금지). 스펙에 한 줄만 남긴다."},
  {"id":"T1","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md","line":14,"quote":"「같은 장소」로 판정된 쌍 중 규칙이 짝으로 낸 것·「범위 다름」 10쌍이 짝으로 나오지 않는 것을"}],"reason":"30쌍의 기대값이 정의돼 있지 않다. 「4번은 일대일에서 빠진다」는 권고 규칙에서는 틀리고, 실제 값은 부록 A에 둔다."},
  {"id":"T2","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md","line":32,"quote":"짝 규칙(세 조건 각각 실패, 일대일 → 없음, 오라클 30쌍)"}],"reason":"I1과 같은 근거다. 코드 체계가 같은 픽스처로는 운영에서 짝 0건이 나는 것을 못 잡는다."},
  {"id":"T3","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/AttractionPage.tsx","line":171,"quote":"// hreflang 없음 — TourAPI 는 국문/영문을 별도 콘텐츠로 관리해"}],"reason":"noindex · 하이드레이션 · 패리티 · 병합 · 새 행 · null · XML · 503 · 분할 사례가 SR-5.1에 없다."},
  {"id":"T4","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/standards/test-rules.md","line":11,"quote":"- **Domain 테스트**: Mock 사용 금지, 순수 단위 테스트"},{"file":"place/domain/src/main/kotlin/com/kgd/place/domain/attraction/model/Attraction.kt","line":82,"quote":"val createdAt: LocalDateTime = LocalDateTime.now(),"}],"reason":"레이어 배정이 없고, 시각을 인자로 받지 않으면 도메인 순수 테스트가 성립하지 않는다."},
  {"id":"T5","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/standards/test-rules.md","line":17,"quote":"- 테스트 파일 이름: 구현체와 동일 이름 + `Test` suffix"}],"reason":"새 구현체 이름이 정해져야 테스트 위치가 고정된다."},
  {"id":"T6","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md","line":34,"quote":"짝 있는 표본 3곳의 SSR hreflang, 짝 없는 표본에 없음"}],"reason":"배포 뒤 확인할 표본의 출처가 정해져 있지 않다."},
  {"id":"U1","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/plans/2026-10-08-place-growth-work-plan.md","line":98,"quote":"| S3-5 | hreflang: S1-8 의 짝 후보 → 표본 수동 검증 … | hreflang 오류 0 (→ 영문 색인률) |"}],"reason":"계획의 완료 기준이 AC로 옮겨지지 않았다."},
  {"id":"U2","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/AttractionPage.tsx","line":150,"quote":"// 문서 자신의 언어를 SEO 기준으로 삼는다 — id 는 언어별로 다르므로 /en/attractions/{ko-id}"}],"reason":"어긋난 주소 · 새 관광지 · 실패 · 0건 · 첫 실행 흐름이 정해져 있지 않다."},
  {"id":"U3","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/adr/ADR-0103-place-attraction-server-render-enrichment.md","line":77,"quote":"place 가 search-batch 보다 먼저 배포돼야 한다."}],"reason":"사전 조건(같은 키, 재색인 뒤 송신, 배포 순서)과 사후 조건이 스펙에 없다."},
  {"id":"U4","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/specs/2026-10-09-place-hreflang-feed-indexnow/context/open-questions.yml","line":6,"quote":"answer: 꺼둔 채 배포, 마지막에 사용자 확인"}],"reason":"켜는 절차를 세 줄로 적어 두면 사용자 몫이 한 번에 끝난다."},
  {"id":"U5","verdict":"keep","severity":"MINOR","evidence":[{"file":"portal-fe/src/seo/copy.mjs","line":545,"quote":"{ hreflang: 'x-default', href: placeUrl('en', sub) },"}],"reason":"허브와 같은 규칙이라는 근거 한 줄이면 된다."},
  {"id":"U6","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-8-place-id-pairs.md","line":112,"quote":"긴 항구·해변·트레일의 좌표 차이는 대표점 차이일 수 있어 50m 탈락을 장소 불일치로 단정하지 않는다."}],"reason":"재현율 손실을 감수한다는 점(50m 밖, titleLocal 없음)을 범위 밖 항목으로 명시하면 된다."}
]
```

---

## 3. spec.md 편집 목록

### 3-1. 4행(머리말 인용) 교체문

> 2026-10-09. 사용자 위임. S1-8: 국·영은 contentId가 다른 별개 행이다. 영문 placeId 보유 28.3%, 엄격 짝 8.3%이고, 30쌍 중 10쌍은 범위가 다르다. 그래서 placeId만으로는 자동 hreflang을 걸 수 없고, 제목 일치와 일대일 조건이 필요하다(`evidence/stage1/s1-8-place-id-pairs.md` §4·§5). S1-9: lastmod는 원천 수정일이다. 「실제로 바뀐 URL」을 알려면 본문 정규화 해시가 필요하다(`s1-9-lastmod.md`). 수집은 전량 upsert라 바뀐 행을 모른다. IndexNow 실제 제출은 사용자 몫이고(Q1), 설정으로 꺼 둔다. ADR: ADR-0062 §8(상세 hreflang 금지)과 ADR-0103 §4·대안 6(파생값을 place에 두지 않음)을 각각 개정 블록으로 고친다. 문안은 이 스펙의 §ADR 개정에 있다. 용어: **언어 대체 짝**(국문 문서 ↔ 영문 문서, 필드 `alternateId`)은 **`samePlace`(같은 언어 안의 중복 등록)와 다른 개념**이다. 이 스펙은 「같은 장소」라는 말을 쓰지 않는다.

### 3-2. `## Goal` 부터 끝까지 전체 교체문

```markdown
## Goal
국문·영문 상세가 **언어 대체 짝**일 때만 서로 hreflang 으로 잇고, place 가 본문이 실제로 바뀐 관광지를 알아
RSS(언어별 최근 50)와 IndexNow(꺼 둔 채)로 그 주소만 알린다.

## 세 시각 (혼동 금지)
| 이름 | 열 / 필드 | 뜻 |
|---|---|---|
| 원천 수정일 | `source_modified_at` / `sourceModifiedAt`(색인 `modifiedAt`) | TourAPI `modifiedtime`. sitemap lastmod 의 값 — 바꾸지 않는다 |
| 행 갱신 시각 | `attractions.updated_at` | 행이 저장될 때마다 오른다(전화·이미지만 바뀌어도) |
| 본문 변경 시각 | `content_updated_at` / `contentUpdatedAt` | 아래 SR-2 해시가 달라졌을 때만 오른다. RSS·IndexNow 의 기준 |

## Specific Requirements

### SR-1 언어 대체 짝 (S3-5)
1. **계산 위치**: search:batch 재색인 **1차 패스**(`AttractionApiReindexTasklet.collectRegionPlacements`)가 전체 투영으로
   search:domain 순수 객체 `AlternateLanguagePairer.pair(projections): Map<String, String>`(id → 상대 id, 양방향)을 부른다.
   2차 패스가 문서에 `alternateId` 를 싣는다. `RegionProjection` 에 `googlePlaceId: String?` · `titleLocal: String?` ·
   `hasOverview: Boolean` 을 더한다(투영 증가는 문서당 수십 바이트 — 힙 256MB 안).
   `SamePlaceGrouper` 를 확장하거나 `samePlace` 필드에 섞지 않는다.
2. **유형 대응표**(search:domain 상수 `ContentTypeLang` 하나 — `sync_tour.py:47-58` 과 같은 값, 테스트도 이 상수를 쓴다):

   | 언어 중립 유형 | 국문 | 영문 |
   |---|---|---|
   | attraction | 12 | 76 |
   | culture | 14 | 78 |
   | leisure | 28 | 75 |
   | shopping | 38 | 79 |
   | food | 39 | 82 |
   | stay | 32 | 80 |
   | (짝 판정 제외) 행사 | 15 | 85 |
   | (짝 판정 제외) 코스 | 25 | — |

   표에 없는 코드·제외 유형은 짝 후보가 아니다.
3. **후보 간선** — 국문 문서 K · 영문 문서 E 가 아래를 **모두** 만족:
   ① `E.googlePlaceId` 와 `K.googlePlaceId` 가 둘 다 비어 있지 않고 같다
   ② `RegionAggregator.distanceMeters(E, K) ≤ 50`
   ③ 대응표의 언어 중립 유형이 같다(코드 문자열 비교 금지)
   ④ **제목**: `E.titleLocal` 과 `K.title`(국문 **표시명** = 투영 `title` = `titleDisplay ?: title`, S1-8 이 비교한 값)이
      각각 `Normalizer.normalize(NFKC)` → 모든 공백(`\s` 및 유니코드 공백) 제거 → `lowercase(Locale.ROOT)` 뒤 같다.
      `E.titleLocal` 이 비면 후보 아님.
4. **일대일**: 3의 간선 집합(전체 ACTIVE 투영, 행사·코스 제외)에서 E 의 간선 수 = 1 **이고** K 의 간선 수 = 1 인 간선만 짝.
5. **표시 가능 조건(판정에 포함)**: 4의 짝 중 **양쪽 모두 `hasOverview`** 인 것만 `alternateId` 로 싣는다
   (서버 렌더 noindex 판정 `AttractionPageRenderer.kt:63` 과 같은 기준 — 행사는 2에서 이미 빠짐).
   재색인 로그 한 줄: `Alternate pairs: N (edges E, dropped by uniqueness U, dropped by overview O)`.
6. **경로**: `alternateId`(keyword, doc_values 유지) — 배치 `AttractionIndexDocument` · 색인 매핑(`ATTRACTIONS_INDEX_DEFINITION`) ·
   계약 게이트 · 앱 `AttractionSearchDocument` · 도메인 · `SearchAttractionUseCase` 응답 · FE `Attraction` 타입 ·
   `prerender-seo.mjs indexDoc` 투영.
7. **표시** (세 곳이 같은 순서·값):
   - 헬퍼 `copy.mjs attractionHreflangAlternates(docLang, id, alternateId)` → `[ko, en, x-default]`.
     ko 는 국문 쪽 id 의 `/attractions/{id}`, en 은 영문 쪽 id 의 `/en/attractions/{id}`, x-default = en
     (허브 `placeHreflangAlternates` 와 같은 규칙). **어느 쪽이 국문인지는 문서 `lang`(docLang) 기준** — 요청 경로 아님.
   - SSR(`AttractionPageRenderer`): `alternateId != null` **이고** 자기 noindex 가 아닐 때만 위 세 줄을
     `data-seo-multi` 속성과 함께 낸다(하이드레이션이 지우고 다시 달 수 있게). copy.mjs 출력과 대조하는 패리티 테스트.
   - 하이드레이션(`AttractionPage.tsx`): 같은 조건으로 `useSeo({ alternates: attractionHreflangAlternates(...) })`.
     조건이 아니면 alternates 를 넘기지 않는다.
   - sitemap(`placeDetailSitemapEntries`): 항목의 `alternateId` 가 **상대 언어 sitemap 항목 집합에도 있을 때만**
     `alternates` 를 붙인다. 정적 sitemap 은 FE 빌드 시점 값이라 다음 빌드까지 낡을 수 있다 — 수용(SSR 이 기준).
   - 영문 문서가 없는 관광지에 /en 주소를 만들지 않는다(지금 그대로).
   - 「hreflang 없음」 주석 세 곳(`AttractionPageRenderer.kt:65,117`, `AttractionPage.tsx:171-173`, `prerender-seo.mjs:707-708`)을 새 규칙으로 고친다.
8. **오라클**: 부록 A 의 30쌍. 픽스처는 `s1-8-review-pages.json` 에서 57개 문서의
   `id·lang·contentTypeId·googlePlaceId·latitude·longitude·title(국문)·titleLocal(영문)` 과 쌍별 `expected`(pair|none)를 뽑아
   `search/domain/src/test/resources/attraction/alternate-pairs-oracle.json` 에 둔다. 테스트는 **57개 문서 전체를 한 번에**
   `pair()` 에 넣고(그래야 13645·34965·15093 처럼 여러 쌍에 걸린 문서의 일대일이 판정된다) 30쌍 각각의 결과가 `expected` 와 같음을 단언한다.
   `hasOverview` 는 픽스처 전부 true 로 둔다.

### SR-2 본문 변경 시각 (place)
1. `attractions` 에 `content_hash VARCHAR(80) NULL` · `content_updated_at DATETIME(6) NULL` + 인덱스 `(content_updated_at, id)` — `V34`.
   두 열은 bulk 요청 DTO·`Attraction.syncFrom` 의 source 에서 **읽지 않는다**(자기 계산값).
2. **해시**: place:domain `AttractionContentHash`(자체 정규화 — search `sourceText` 와 일치를 요구하지 않는다).
   - 입력 필드(순서 고정 상수 `HASH_FIELDS`): `title, overview, address, tel, imageUrl, useTime, restDate, useFee, parking,
     parkingFee, infoCenter, eventStartDate, eventEndDate, introRaw`.
   - 필드별 정규화: null → 빈 문자열, `<[^>]*>` 제거, 공백류(유니코드 공백 포함) 연속을 공백 하나로, 앞뒤 trim. 날짜는 ISO.
   - 직렬화: `필드명=값` 을 `\u001F` 로 이어 SHA-256 hex. 저장값 = `"v1:" + hex`. 정규화 규칙을 바꾸면 접두를 `v2:` 로 올린다.
3. **시각 규칙** — `now` 는 호출자가 넘긴다(어댑터가 `LocalDateTime.now(ZoneId.of("Asia/Seoul"))`). 해시는 **병합이 끝난 뒤 자기 필드**로 계산
   (`syncFrom(source, now)` 의 마지막 단계, 생성은 `stampNew(now)`):

   | 상황 | content_hash | content_updated_at |
   |---|---|---|
   | 새 행(생성 경로 `AttractionRepositoryAdapter` `existing == null`) | 계산 | `now` (새 URL 은 변경으로 센다) |
   | 기존 행, 이전 해시 null (첫 채움) | 계산 | `source_modified_at` (null 이면 null) |
   | 기존 행, 이전 해시 접두 ≠ 현재 버전 | 재계산 | 그대로 (null 이면 `source_modified_at`) |
   | 같은 버전 · 같은 해시 | 그대로 | 그대로 |
   | 같은 버전 · 다른 해시 | 새 값 | `now` |

   `content_updated_at` 이 null 인 행은 RSS·IndexNow 에서 빠진다. 목록 동기화가 닿지 않는 행은 계속 null 일 수 있다 — 수용.
4. place API 응답(`/api/places/attractions` 목록·단건)과 search 색인 문서에 `contentUpdatedAt` 을 싣는다(SR-1.6 과 같은 경로 목록,
   색인 매핑 `date`, doc_values 유지 — 정렬용). sitemap lastmod 는 원천 수정일 그대로.

### SR-3 RSS (언어별 최근 갱신 50)
1. 주소: `https://place.1989v.com/feed.xml`(국문) · `/en/feed.xml`(영문). nginx `location = /feed.xml` · `location = /en/feed.xml` 두 개,
   각각 place 호스트 외 404, upstream 고정 문자열 `/internal/render/feed/ko.xml` · `/internal/render/feed/en.xml`
   (행사 sitemap location `nginx.conf:75-89` 를 그대로 따른다 — `proxy_intercept_errors`·셸 폴백 없음, 쿠키·인증 헤더 제거).
   성공에만 `Cache-Control: public, max-age=600`. 엣지 캐시·서버 캐시는 넣지 않는다(측정 뒤).
2. search:app `AttractionFeedRenderer`: 해당 언어, `contentUpdatedAt` 있는 문서, `contentUpdatedAt desc, id asc`, 50건.
   RSS 2.0 — channel(title·link=허브·description·language `ko`|`en`·lastBuildDate=첫 항목 시각), item(title=상세 제목 규칙,
   link·guid(isPermaLink=true)=id 로 조립한 상세 canonical, pubDate=`contentUpdatedAt` 을 `+0900` RFC 1123 으로, description=목록 요약 규칙).
3. 텍스트 처리 순서 고정: `sourceText` → XML 1.0 금지 문자(U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+FFFE, U+FFFF) 제거 →
   XML 이스케이프(`& < > " '`).
4. 색인 조회 실패 → **503 + `Cache-Control: no-store`**(빈 200 금지). 0건 → 200 + 항목 없는 유효 channel.
5. 허브·상세 `<head>` 에 `<link rel="alternate" type="application/rss+xml" title=… href=(해당 언어 feed)>` — SSR 은 `data-seo-multi` 로 내고,
   `useSeo` 에 같은 MULTI 블록에서 처리하는 `feeds` 입력을 더하며, 허브 프리렌더도 같은 값을 낸다.

### SR-4 IndexNow (꺼 둔 채)
1. **키**: 32자 hex 키 하나를 Secret `place-indexnow`(키 `key`, SealedSecret 으로 암호문만 레포에)로 두고
   portal-fe · place-ingest 가 **같은 Secret** 을 env `INDEXNOW_KEY`(secretKeyRef, `optional: false`)로 읽는다.
   k3s-lite 오버레이는 로컬 더미 Secret. 키·요청 본문은 로그에 쓰지 않는다.
2. **키 파일**: `portal-fe/Dockerfile` `NGINX_ENVSUBST_FILTER` 에 `INDEXNOW_KEY` 를 더하고 nginx 에
   `location = /${INDEXNOW_KEY}.txt { if ($host != "place.1989v.com") { return 404; } default_type text/plain; add_header Cache-Control "public, max-age=300"; return 200 "${INDEXNOW_KEY}"; }`.
   넓은 정규식(`\.txt$`)·디렉터리 마운트 금지.
3. **변경 목록 포트(place)**: `GET /internal/attractions/content-updated?since=&until=&afterId=&size=` — 게이트웨이 비경유(`/internal/attractions/**` 관례).
   UseCase 인터페이스 `FindContentUpdatedAttractionsUseCase` + `AttractionRepositoryPort.findContentUpdated(since, until, afterId, size)` + 어댑터(ADR-0083).
   ACTIVE 만, `since ≤ content_updated_at < until`, id 키셋, 응답 `{id, lang}` 목록 + `nextAfterId`.
4. **제출 잡**: place-ingest `--job=indexnow`, 새 CronJob `place-ingest-indexnow` **UTC 22:30(KST 07:30)** — 재색인(UTC 21:30) 뒤라
   제출 시점에 SSR 이 새 본문을 낸다. 창 = `[실행 시각(KST) − 24h, 실행 시각)`, 저장처 없음.
   하루 실패하면 그날 변경은 IndexNow 에서 빠진다(RSS·sitemap 으로 남음 — 수용). 재색인이 실패한 날은 옛 본문을 알릴 수 있다 — 수용.
5. URL = 국문 `https://place.1989v.com/attractions/{id}` · 영문 `…/en/attractions/{id}`. 10,000건씩
   `POST https://api.indexnow.org/indexnow` JSON `{host:"place.1989v.com", key, keyLocation:"https://place.1989v.com/{key}.txt", urlList}`, 타임아웃 30초.
   - 200·202 → 성공(202 = 키 검증 대기). 400·403(「키 불일치 — 키 파일 확인」)·422·429·그 밖·타임아웃 → 코드별 문구로 기록, **잡은 성공(exit 0)**.
   - 0건 → 요청 없이 `IndexNow 대상 0건`.
   - `INDEXNOW_ENABLED`(기본 false) 가 아니면 요청 없이 `IndexNow 비활성 — 보낼 주소 N건`.
6. 외부 데이터 대장(`docs/architecture/data-sources.md`)에 「송신」 행 한 줄(보내는 것: 공개 URL·공개 키, 개인정보 없음).
   `k8s/base/network-policy/11-allow-egress-https-public.yaml` place-ingest 주석에 「+ IndexNow 송신(api.indexnow.org)」. 정책 값은 그대로.

### SR-5 검증
1. **단위**(Kotest BehaviorSpec, 도메인 Mock 금지):
   - `AlternateLanguagePairerTest`(search:domain): 오라클 30쌍(부록 A) · 조건 ①~④ 각각 실패 · 국 12 ↔ 영 76 → 같은 유형 · 국 25·행사 15/85 → 없음 ·
     **합성** 일대다(국문 둘이 ①~④ 모두 만족 → 둘 다 없음) · **합성** 51m → 없음 · 한쪽 개요 없음 → 없음 · `titleLocal` 없음 → 없음.
   - `AttractionContentHashTest` · `AttractionTest`(place:domain): 같은 본문 → 같은 해시 · 공백·태그만 다름 → 같음 · 요금 변경 → 다름 ·
     행사 날짜만 변경 → 다름 · **개요 없는 목록 레코드가 들어와도 해시·시각 그대로** · 표 SR-2.3 다섯 행 각각 · source 에 해시를 넣어 보내도 무시.
   - 재색인: `AttractionApiReindexTaskletTest` 에 `alternateId` 단언(`samePlace` 단언 옆), `AttractionReindexCaptureTest` 역직렬화 경로.
   - `AttractionPageRendererTest`: 짝·자기 noindex 아님 → 세 줄(`data-seo-multi`), 짝 없음/noindex → 없음, `/en/attractions/{국문id}` 요청 → docLang 기준.
     `AttractionHreflangParityTest`: copy.mjs 출력과 대조.
   - FE vitest: `attractionHreflangAlternates`, `AttractionPage` 의 `useSeo` 입력에 alternates 존재/부재, `placeDetailSitemapEntries` 상대 항목 없음 → alternates 없음.
   - `AttractionFeedRendererTest` + 컨트롤러 슬라이스: 정렬·50 상한·언어·제어문자 포함 제목 → 유효 XML·이스케이프·0건·조회 실패 → 503.
   - place 내부 조회: UseCase(MockK 포트) + 어댑터 범위 조건.
   - `place/ingest/tests/indexnow_test.py`(`urlopen` 만 가짜): 꺼짐 → 미전송·건수 로그 · 켜짐 → 본문 `host·key·keyLocation·urlList` ·
     10,001건 → 요청 2회 · 202 성공 · 403/429/500/타임아웃 → 기록 후 exit 0 · 0건 → 미전송 · 로그에 키 없음.
2. **회귀 주입**(임시 사본에서, 각 빨강을 본 뒤에만 「켰다」): 대응표 무시(문자열 비교) · 제목 조건 삭제 · 일대일 삭제(합성 사례가 잡는다) ·
   좌표 조건 삭제(합성 사례가 잡는다) · 개요 조건 삭제 · 해시 비교 삭제(항상 now) · 병합 전 source 로 해시 계산 · 첫 채움 처리 삭제 ·
   새 행 처리 삭제 · RSS 정렬 뒤집기 · XML 금지 문자 제거 삭제 · IndexNow 꺼짐 분기 삭제 · AttractionPage alternates 전달 삭제.
3. **배포 순서**: place(V34·응답 필드·내부 조회) → search:batch·app → portal-fe → place-ingest CronJob.
4. **배포 뒤**:
   - `feed.xml`·`/en/feed.xml` 200, 항목 ≤ 50, XML 파서 통과. 다른 호스트 404.
   - 재색인 로그 `Alternate pairs` 줄. 표본 3곳 = 오라클 「짝」 중 우선 #2(en 2180 ↔ ko 5337) · #3(14206 ↔ 7935) · #9(13515 ↔ 5318).
     운영 응답 `alternateId` 와 양쪽 SSR `<link hreflang>` 세 줄을 확인. 운영 전역 판정에서 짝이 없으면 그 사실을 적고 부록 A 의 다음 「짝」 번호로.
     반례 #19(en 1676·ko 160)·#24(ko 2477)에 hreflang 없음.
   - **hreflang 오류 0(AC)**: `alternateId` 있는 문서 전부를 스크롤해 — 상대 문서 존재 · 상대 `alternateId` = 자기 · 언어 다름 ·
     양쪽 overview 비어 있지 않음 — 위반 건수 0.
   - 키 파일 200·본문 = 키, apex·blog 호스트 404, `/.txt` 404.
   - ingest 로그 `IndexNow 비활성 — 보낼 주소 N건`. 기대 N = 창 안의 새 행 + 원천 수정일이 창 안인 첫 채움 행(0 일 수 있음).

## Existing Code to Leverage
`AttractionJpaEntity.kt:20-25,134-156,172`, `Attraction.kt:325-407(syncFrom)`, `AttractionRepositoryAdapter.kt:24-46`,
`place_client.py:33-105`, `sync_tour.py:47-58(유형 코드)`, `SamePlace.kt:15-39(SamePlaceGrouper — 위치 선례)`, `RegionAggregator.kt:15-29`,
`AttractionApiReindexTasklet.kt:391-418,450-464`, `AttractionPageRenderer.kt:50-70,117,723-724`, `AttractionSeoText.kt:46-80`,
`useSeo.ts:69-78`, `AttractionPage.tsx:150-173`, `copy.mjs:541-547`, `prerender-seo.mjs:707-727,816-826,1003`,
`nginx.conf:64-89(행사 sitemap 동적 선례)`, `Dockerfile:76-80`, `EventSitemapRenderer.kt`,
`evidence/stage1/s1-8-place-id-pairs.md`·`s1-8-review-pages.json`, `s1-9-lastmod.md`.

## Out of Scope
IndexNow 실제 제출 켜기(사용자 — 부록 B), 지역·허브 hreflang 변경, sitemap lastmod 를 contentUpdatedAt 으로 바꾸기, 영문 번역 생성,
ACTIVE → INACTIVE 로 사라진 URL 의 IndexNow 알림(해시는 상태를 보지 않는다), 행사(15·85) hreflang(동적 sitemap 포함),
placeId 없는 짝(#26·#27·#29)·50m 밖 대표점·`titleLocal` 없는 영문 — 재현율 손실로 수용, 수동 매핑 경로,
introRaw 키 순서 변화로 인한 1회성 변경 판정, RSS·제출 캐시(측정 뒤).

## 부록 A — 오라클 기대값 (S1-8 30쌍, 규칙 SR-1.2~1.5, 57문서 동시 판정)
| # | 영문 id | 국문 id | 유형 영/국 | placeId | 거리 | 제목 일치 | S1-8 판정 | 기대 | 이유 |
|---:|---|---|---|---|---:|---|---|---|---|
| 1 | 14815 | 10381 | 76/12 | 같음 | 0.0 | 예 | 같은 범위 | 짝 | 전 조건 · 일대일 |
| 2 | 2180 | 5337 | 76/12 | 같음 | 5.6 | 예 | 같은 범위 | 짝 | 〃 |
| 3 | 14206 | 7935 | 76/12 | 같음 | 6.1 | 예 | 같은 범위 | 짝 | 〃 |
| 4 | 13645 | 4085 | 76/12 | 같음 | 0.0 | 예 | 같은 범위 | 짝 | 13645↔2477(#24)은 제목 불일치라 간선 아님 → 일대일 |
| 5 | 2325 | 3456 | 76/12 | 같음 | 4.5 | 예 | 같은 범위 | 짝 | 전 조건 · 일대일 |
| 6 | 13698 | 8647 | 76/12 | 같음 | 6.7 | 예 | 같은 범위 | 짝 | 〃 |
| 7 | 2194 | 6776 | 76/12 | 같음 | 4.6 | 예 | 같은 범위 | 짝 | 〃 |
| 8 | 18192 | 15369 | 78/14 | 같음 | 5.1 | 예 | 같은 범위 | 짝 | 〃 |
| 9 | 13515 | 5318 | 76/12 | 같음 | 0.0 | 예 | 같은 범위 | 짝 | 〃 |
| 10 | 13853 | 11343 | 76/12 | 같음 | 5.2 | 예 | 같은 범위 | 짝 | 〃 |
| 11 | 18161 | 16711 | 78/14 | 같음 | 6.4 | 예 | 같은 범위 | 짝 | 〃 |
| 12 | 18206 | 17689 | 78/14 | 같음 | 7.5 | 예 | 같은 범위 | 짝 | 〃 |
| 13 | 14200 | 13062 | 76/12 | 같음 | 0.0 | 예 | 같은 범위 | 짝 | 〃 |
| 14 | 2220 | 10334 | 76/12 | 같음 | 0.0 | 예 | 같은 범위 | 짝 | 〃 |
| 15 | 34965 | 22911 | 79/38 | 같음 | 0.0 | 예 | 같은 범위 | 짝 | 34965↔22851(#22)은 제목 불일치 → 일대일 |
| 16 | 15093 | 1015 | 76/12 | 같음 | 0.0 | 아니오 | 판단 불가 | 없음 | 제목(숲속야영장) |
| 17 | 15093 | 19627 | 76/28 | 같음 | 69.7 | 아니오 | 범위 다름 | 없음 | 거리·유형·제목 |
| 18 | 2059 | 20783 | 76/28 | 같음 | 273.1 | 아니오 | 범위 다름 | 없음 | 거리·유형·제목 |
| 19 | 1676 | 160 | 76/12 | 같음 | 32.0 | 아니오 | 범위 다름 | 없음 | 제목(월미짱랜드 ≠ 월미 관광특구) |
| 20 | 34929 | 22869 | 79/38 | 같음 | 0.0 | 아니오 | 범위 다름 | 없음 | 제목 |
| 21 | 34887 | 22857 | 79/38 | 같음 | 0.0 | 아니오 | 범위 다름 | 없음 | 제목 |
| 22 | 34965 | 22851 | 79/38 | 같음 | 0.0 | 아니오 | 범위 다름 | 없음 | 제목 |
| 23 | 14608 | 9095 | 76/12 | 같음 | 215.4 | 아니오 | 범위 다름 | 없음 | 거리·제목 |
| 24 | 13645 | 2477 | 76/12 | 같음 | 4.4 | 아니오 | 범위 다름 | 없음 | 제목 |
| 25 | 22453 | 19751 | 75/28 | 같음 | 6.3 | 예 | 같은 범위 | 짝 | 대응표로 leisure 같음(응답 category 는 다름) |
| 26 | 38412 | 25698 | 79/38 | 없음 | 0.0 | 예 | 같은 범위 | 없음 | placeId 없음(재현율 손실) |
| 27 | 18066 | 16043 | 78/14 | 없음 | 0.0 | 예 | 같은 범위 | 없음 | 〃 |
| 28 | 40604 | 27494 | 79/38 | 없음 | 0.0 | 아니오 | 범위 다름 | 없음 | placeId·제목 |
| 29 | 37669 | 23352 | 79/38 | 없음 | 5.7 | 예 | 같은 범위 | 없음 | placeId 없음(재현율 손실) |
| 30 | 36250 | 28383 | 79/38 | 없음 | 0.0 | 아니오 | 범위 다름 | 없음 | placeId·제목 |

합계: 짝 16(모두 「같은 범위」) / 없음 14(범위 다름 10 · 판단 불가 1 · placeId 없는 같은 범위 3). 오탐 0.
참고 — 제목 조건을 지우면 #16·#19 가 짝으로 나오고 #4·#15 가 일대일에서 빠진다(회귀 주입 기대값).
일대일·좌표 조건을 지워도 이 30쌍의 결과는 같다 → 합성 사례로 잡는다.

## 부록 B — IndexNow 켜기(사용자, Q1)
1. 배포 뒤 `https://place.1989v.com/{key}.txt` 200·본문 = 키 확인.
2. `k8s/base/place-ingest/cronjob-indexnow.yaml` 의 `INDEXNOW_ENABLED` 를 `"true"` 로 커밋 → 다음 KST 07:30 로그에서
   `IndexNow 제출 N건 — 200|202` 확인(403 이면 키 파일·Secret 대조).
3. 되돌리기: 같은 값을 `"false"` 로. 제출한 URL 은 회수할 수 없지만 해가 없다.
```

---

## 4. ADR 개정 문안

**ADR-0062 §8 끝(현재 186행 뒤, §9 앞)에 덧붙임**

```markdown
#### 개정 — 언어 대체 짝에만 hreflang (2026-10-09)

위 「hreflang 을 걸지 않는다」는 짝을 알 수 없어서였다. S1-8 실측(영문 300·수동 30쌍)으로 짝을 고르는 규칙이 생겨
**그 규칙을 통과한 일대일 짝에만** 상세 hreflang 을 건다. 나머지 상세는 지금처럼 없다.

- 규칙: googlePlaceId 같음 · 50m 이내 · 언어 중립 유형 같음(국 12 ↔ 영 76 등 대응표) · 영문 `titleLocal` 과 국문 표시명이
  NFKC·공백 제거·소문자화 후 같음 · 후보 간선이 양쪽 모두 하나뿐 · 양쪽 모두 개요 있음(noindex 아님). 행사·코스는 제외.
  placeId·거리·유형만으로는 관광특구 ↔ 놀이공원, 같은 아울렛의 다른 브랜드가 이어졌다(S1-8 #19~#22) — 제목 조건이 그것을 막는다.
- 계산은 재색인 1차 패스의 search:domain 순수 함수(`AlternateLanguagePairer`), 결과는 문서 필드 `alternateId`.
  SSR·하이드레이션·sitemap 이 같은 헬퍼 값을 쓴다(x-default = 영문, 허브와 같은 규칙).
- 검증: S1-8 30쌍 오라클에서 짝 16 · 오탐 0. 운영 AC 는 「상호 참조·양쪽 색인 대상 위반 0」.
- 감수: placeId 없는 짝·대표점이 50m 를 넘는 긴 시설은 놓친다(재현율 손실, 오연결 아님).
- `/en/attractions/{국문id}` 같은 어긋난 주소에서도 문서 `lang` 기준으로 ko·en 을 정한다(위 canonical 규칙과 같다).
```

**ADR-0103 끝에 새 절 추가**

```markdown
## 개정 — 본문 변경 시각은 place 에 둔다: 결정 4 의 예외 (2026-10-09)

- **문제**: RSS·IndexNow 는 「이 사이트 본문이 실제로 바뀐 관광지」가 필요하다. 원천 수정일은 그 시각이 아니고(S1-9),
  수집은 전량 upsert 라 바뀐 행을 모른다.
- **결정**: place `attractions` 에 `content_hash`·`content_updated_at`(V34)을 둔다. 병합이 끝난 자기 필드의 정규화 해시가
  이전과 다를 때만 시각을 올린다. 정규화는 place:domain 이 따로 갖는다(search `sourceText` 와 일치를 요구하지 않는다 —
  자기 이전 값과만 비교하므로).
- **결정 4·대안 「파생 속성을 place 컬럼으로 — 기각」과 다른 이유**: 결정 4 의 파생값은 원천의 순수 함수라 매 재색인이
  다시 계산하면 된다. 본문 변경 시각은 **이전 실행과의 비교**라 상태가 필요하다. search 는 매일 새 색인을 만들어
  이전 값을 들고 있지 않다. 그래서 색인 시점 순수 함수로 만들 수 없다. 이 두 열 외의 파생값은 여전히 결정 4 를 따른다.
- **부담**: `syncFrom` 은 두 열을 source 에서 읽지 않는다(전체 동기화가 지우지 않게). 첫 채움은 변경으로 세지 않고
  원천 수정일을 쓴다. 정규화를 바꾸면 해시 접두 버전을 올려 시각을 보존한다.
- 소비자: search 색인 `contentUpdatedAt`(RSS 정렬), place 내부 조회 `/internal/attractions/content-updated`(IndexNow 제출 잡).
```

---

## 5. 다시 리뷰할 차원

| 차원 | 필수 여부 | 볼 곳 |
|---|---|---|
| implementation | 필수 | SR-1.2~1.5 규칙, SR-4 스케줄·창, nginx·envsubst, 부록 A 재현 |
| test-strategy | 필수 | 부록 A 고정 방식, 합성 사례, 회귀 주입 13종, 레이어 배정 |
| architecture | 필수 | ADR 개정 두 건, 내부 조회 포트(ADR-0083), 1차 패스 위치 |
| domain | 필수 | SR-2.3 시각 규칙 표, 「세 시각」 용어, `samePlace` 와 구분 |
| security | 변경 절만 | SR-4.1·4.2(Secret 공유, location 정확 일치), SR-3.3 |
| usecase | 변경 절만 | SR-5.4 AC, 부록 B, Out of Scope 수용 항목 |

---

## 6. 사용자에게 물을 것 (권고 기본값 포함)

1. **짝 표시를 바로 켤지.** 계획 S3-5는 「표본 수동 검증 → 사이트맵 hreflang」 순서입니다. **권고**: 스위치 없이 켜서 배포하고, 배포 직후 운영 짝 중 무작위 30쌍을 S1-8 방식으로 수동 확인합니다. 범위 다름이 1건이라도 나오면 규칙을 고쳐 다시 색인합니다.
2. **일대일을 무엇 기준으로 따질지.** **권고**: 전 조건을 만족하는 후보 사이에서 따집니다(짝 16 · 오탐 0). 보수안은 S1-8 조건 4처럼 placeId 후보 하나로 따지는 것으로, #4·#15가 빠져 짝 14가 됩니다.
3. **새 관광지를 「변경」으로 셀지.** **권고**: 셉니다. `content_updated_at = now` 로 두어 새 URL이 RSS와 IndexNow에 나가게 합니다.
4. **IndexNow 대상 범위.** **권고**: 저장처 없이 고정 24시간 창을 쓰고 UTC 22:30에 실행합니다. 하루 실패하면 그날 몫을 놓치는 것은 감수합니다.
5. **행사 hreflang.** **권고**: 제외합니다. 기간이 끝나면 noindex로 바뀌고, 행사 sitemap은 동적이기 때문입니다.
6. **해시에 `introRaw` 원문을 넣을지.** **권고**: 넣습니다. 숙박 입·퇴실과 코스 변경을 잡을 수 있습니다. 대신 키 순서가 바뀌면 한 번 거짓 변경이 생깁니다.
7. **x-default.** **권고**: 영문으로 둡니다. 허브와 같은 규칙입니다.
8. **Q1 IndexNow 켜기.** 지금처럼 사용자 몫이고, 절차는 부록 B에 있습니다.

---

SUMMARY: keep 37 / demote 1 / dismiss 2

NOTES: 판정 범위 밖이라 발견으로 올리지 않은 것이 셋 있습니다.
- RSS·IndexNow 대상에서 noindex 문서(개요 없음)를 뺄지는 스펙이 정하지 않았습니다.
- `syncFrom` 밖에서 해시 입력 필드를 바꾸는 경로(어드민 편집 등)가 있는지 구현 전에 grep으로 확인해야 합니다.
- IndexNow 잡의 오늘 기준을 KST로 쓴다는 것은 시각 규칙(memory time-in-kst)과 함께 태스크 단계에서 한 번 더 확인하면 됩니다.