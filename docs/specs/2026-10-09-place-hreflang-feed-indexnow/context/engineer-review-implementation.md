# Engineer Review — implementation (1라운드)

- 대상: `docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md`
- 체크리스트: `hns/0.15.1/.../reviewers/implementation/checklist.md` (0.16.1 경로 없음)

## 핵심 (그대로 구현하면 기능이 동작하지 않는 것)

### I1. 짝 조건 ③ 「`contentTypeId` 같음」은 국·영 사이에서 절대 참이 안 된다 — 짝 0건
- 스펙: `spec.md:12`
- 코드: 국문·영문 유형 코드 체계가 다르다 — `place/ingest/src/sync_tour.py:47-58`(관광지 12↔76, 문화 14↔78, 레포츠 28↔75, 쇼핑 38↔79, 음식 39↔82, 행사 15↔85, 숙박 32↔80, 코스 25 는 영문 없음).
- 증거: 오라클 1번(같은 범위 판정) 쌍이 영문 `"contentTypeId": "76"` · 국문 `"12"` 다(`evidence/stage1/s1-8-review-pages.json:18,89`). 4·19·23·24번도 76 ↔ 12(`:492,563,2862,2933,3494,3565,3652,3723`).
- 수정안: 「유형 코드를 언어 중립 유형(attraction·culture·…)으로 바꿔 같을 때」로 고치고, 대응표는 search:domain 상수 하나로 둔다(코스 25 는 짝 없음).

### I2. 오라클과 규칙이 서로 어긋난다 — 19번(범위 다름)이 규칙을 통과한다
- 스펙: `spec.md:12`(placeId+50m+유형+일대일), `spec.md:14`(범위 다름 10쌍은 짝이 나오면 안 됨)
- 증거: 19번 영문 1676 ↔ 국문 160 — placeId 같음(`s1-8-review-pages.json:2863,2934`), 거리 32.0m(`s1-8-place-id-pairs.md:76`), 유형 76/12(I1 대응 후 같음). 픽스처 안에서 둘 다 다른 후보가 없어 일대일도 통과한다. S1-8 은 이미 「placeId+50m+category 를 모두 통과하는 범위 불일치 반례」라 적었다(`s1-8-place-id-pairs.md:97`).
- S1-8 이 제안한 후보 조건에는 **제목 일치**가 있다(`s1-8-place-id-pairs.md:105` — 영문 `titleLocal` ↔ 국문 `title` 보수 정규화 일치). 19번은 `월미짱랜드` ≠ `월미 관광특구`(`:2857,2927`)라 이 조건으로 걸러진다.
- 수정안: 조건 ④ 「영문 `titleLocal` 과 국문 원천 제목이 NFKC·공백 제거·casefold 후 일치」를 더한다(S1-8 §1 의 정규화 그대로, `s1-8-place-id-pairs.md:12`). 오라클 30쌍 각각의 기대값(짝/없음)을 스펙 부록 표로 고정한다 — 4·24번은 같은 영문 13645 가 국문 둘과 맞아(`:483-493,554-564,3714-3724`) 둘 다 「없음」이 기대값이다.

### I3. IndexNow 를 tour-sync 직후에 보내면 (a) 옛 본문을 크롤하게 하고 (b) 대부분의 변경을 놓친다
- 스펙: `spec.md:28`(동기화 뒤, 이번 실행 시작 이후 바뀐 것)
- 코드/설정: tour-sync 는 UTC 18:10(`k8s/base/place-ingest/cronjob-tour-sync.yaml:26`), 재색인은 UTC 21:30(`k8s/base/search-batch/cronjob-attraction-reindex.yaml:21`). 상세는 search 색인을 렌더하므로(`ADR-0103-…:16-17,21-22`) 제출 후 3시간 20분 동안 옛 본문이 나간다.
- 해시 입력 필드를 바꾸는 잡이 따로 돈다: 개요 UTC 19:00(`cronjob-overview.yaml:22`), 이용정보 20:00(`cronjob-intro.yaml:28`), 사진 21:00(`cronjob-media.yaml:25`), 구글 18:20(`cronjob-google-places.yaml:24`). 「tour-sync 실행 시작 이후」 창은 이 변경을 전부 놓친다.
- 수정안: 별도 `--job=indexnow` CronJob 을 재색인 뒤(예: UTC 22:30)에 두고, 창은 「직전 성공 제출 시각 이후」(저장처 필요) 또는 고정 24시간 창으로 한다. 변경 목록은 A3(architecture)의 place 내부 조회로 받는다.

### I4. 해시를 무엇으로 계산하는지에 따라 매일 전량이 「변경」이 된다
- 스펙: `spec.md:19`(「새 해시를 계산해 이전과 다를 때만」)
- 코드: `syncFrom` 은 보강 필드를 `?:` 로 병합한다(`place/domain/.../Attraction.kt:364-405`). 같은 bulk 를 목록 동기화(개요 없음)와 개요·이용정보 백필(값 있음)이 함께 쓴다(`Attraction.kt:398-402`).
- 수정안: 「병합이 끝난 뒤의 자기 필드로 계산」을 명시하고, 회귀 테스트로 「개요 없는 목록 레코드 → 해시 그대로」를 넣는다.

### I5. hreflang 이 noindex·sitemap 제외 문서를 가리킬 수 있다
- 스펙: `spec.md:15`(alternateId 가 있으면 건다)
- 코드: 개요 없는 문서·만료 31일 지난 행사는 noindex(`AttractionPageRenderer.kt:63-64`). sitemap 은 개요 없는 문서·사진 없는 숙박을 뺀다(`prerender-seo.mjs:819`). noindex 문서를 대체 주소로 선언하면 계획의 완료 기준 「hreflang 오류 0」(`docs/plans/2026-10-08-place-growth-work-plan.md:98`)을 어긴다.
- 수정안: 짝 판정은 전 문서로(일대일 판정은 보수적으로), **표시**는 양쪽이 모두 색인 대상일 때만. 판정 함수는 search:domain 하나로 SSR·FE 가 같은 규칙을 쓰게 한다(색인 시 `alternateId` 를 이미 거른 값으로 싣는 것이 가장 단순).

### I6. 하이드레이션이 SSR 의 hreflang 을 지운다
- 스펙: `spec.md:15`(SSR·sitemap 만)
- 코드: `useSeo` 가 다중 태그를 통째로 지우고 받은 `alternates` 만 다시 단다(`portal-fe/src/seo/useSeo.ts:69-78`). 관광지 상세는 `alternates` 를 넘기지 않는다(`portal-fe/src/pages/place/AttractionPage.tsx:158-173`). 기존 헬퍼는 두 언어가 같은 경로라고 가정한다(`portal-fe/src/seo/copy.mjs:541-547`) — 짝은 id 가 다르다.
- 수정안: copy.mjs 에 짝 전용 헬퍼(`attractionHreflangAlternates(lang, id, alternateId)`)를 두고 AttractionPage·prerender·SSR(패리티 테스트로 copy.mjs 와 대조, `AttractionSeoText.kt:3-8` 의 방식) 셋이 같은 순서·값을 내게 한다. RSS `<link rel="alternate" type="application/rss+xml">`(`spec.md:24`)도 같은 이유로 useSeo 경로에 들어가야 한다.

## 그 밖

### I7. 1차 투영에 placeId 가 없다 / 계산 위치
- `RegionAggregator.kt:15-29` 에 `googlePlaceId`·제목 없음(원천 제목은 `sourceTitle` 로 있음). 1차 패스(`AttractionApiReindexTasklet.kt:391-418`)에서 계산해야 전량을 본다. 스펙에 명시.

### I8. 정적 sitemap 과 SSR 의 짝이 어긋나는 기간
- sitemap 은 FE 이미지 빌드 때 공개 검색 응답으로 찍는다(`prerender-seo.mjs:816-826`, `indexDoc` `:1003`). `alternateId` 는 매일 재색인으로 바뀐다. 다음 FE 빌드까지 sitemap 의 짝이 낡는다. 수용하되 스펙에 적거나, `indexDoc` 투영에 `alternateId` 를 더하는 것까지 명시(`spec.md:13` 「FE 타입 경로」의 범위).

### I9. 마이그레이션·롤백
- 다음 번호는 V34(최신 `place/feature/src/main/resources/placedb/migration/V33__attraction_short_link_click.sql`). 두 열 nullable 추가 + I3 의 조회를 쓰면 `(content_updated_at)` 인덱스. 롤백은 열이 남아도 옛 코드가 무시하므로 스키마 롤백 불요 — 스펙에 한 줄. Flyway 이력 불변(`MEMORY: flyway-migration-immutable`)이라 번호 충돌 시 새 번호로.
- search 매핑: 정렬에 쓰므로 `date` 타입(doc_values 유지). ADR-0103 은 비필터 필드를 `index:false` 로 둔다(`ADR-0103-…:59`) — 정렬엔 doc_values 만 있으면 된다는 점을 적는다.

### I10. 첫 채움 규모와 null
- 첫 동기화 때 6만여 행이 모두 「첫 채움」이다(`spec.md:18`). `source_modified_at` 이 null 인 행은 `content_updated_at` 도 null — RSS 정렬·IndexNow 에서 제외한다고 명시. 목록 동기화가 닿지 않는 행(행사 창 밖 등)은 계속 null 로 남는다.

### I11. RSS 실패 응답
- 행사 sitemap 은 조회 실패 시 503 을 그대로 내고 빈 200 을 금한다(`portal-fe/nginx.conf:71-74`, `ADR-0103-…:91`). RSS 도 같은 규칙과 nginx location 두 개(`= /feed.xml`, `= /en/feed.xml`, upstream 경로는 언어별 고정 문자열 — `nginx.conf:69-70`)를 스펙에 적는다. 현재 `spec.md:23` 은 두 주소가 같은 upstream `/internal/render/feed.xml` 로 간다고만 써서 언어를 넘길 방법이 없다.

### I12. IndexNow 호출 세부
- 타임아웃(ingest 관례 30초 — `sync_tour.py:164`), 10,000건 분할, 키 위치(`keyLocation`) 호스트 일치, 응답 400/403/422/429 의 로그 문구. 403(키 불일치)은 「꺼진 채」에서도 키 파일 200 확인으로 미리 잡는다(`spec.md:34`).

### 동시성
- tour-sync 와 구글 place_id 보강은 잠금이 없어 겹치면 한쪽이 덮는다(`place/CLAUDE.md:106`). 해시·시각은 같은 트랜잭션 안에서 계산되므로 새 위험은 없다. 두 잡이 겹치면 시각이 두 번 갱신될 수 있음 정도 — 허용.

## 체크 항목
| 항목 | 결과 |
|---|---|
| 참조 클래스 존재 | 존재. 단 `SamePlace.kt:10-26` 은 `SamePlaceGrouper`(같은 파일 `:15-39`) — 줄 번호 보정 |
| 기존 코드와 충돌 | I1·I5·I6 |
| 복잡도 위험 | I3(스케줄·창) |
| NFR 안티패턴 | I11(빈 200 금지), I12(타임아웃) |
| 마이그레이션/롤백 | I9 |
| 동시성 | 허용 범위 |

VERDICT: REVISE
