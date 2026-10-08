# Engineer Review — test-strategy (1라운드)

- 대상: `docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md`
- 체크리스트: `hns/0.15.1/.../reviewers/test-strategy/checklist.md` (0.16.1 경로 없음)

## 좋은 점
- 회귀 주입 6종이 요구사항별로 하나씩 있다(`spec.md:33`) — 「빨강을 본 뒤에만 켰다」 원칙과 맞다.
- 오라클을 1단계 실측(30쌍)에서 가져온다(`spec.md:14`). 픽스처에 필요한 필드(id·lang·좌표·`contentTypeId`·`googlePlaceId`·`title`·`titleLocal`)가 원자료에 다 있다(`evidence/stage1/s1-8-review-pages.json:9-19,80-90`).

## Findings

### T1. 오라클의 기대값이 정의돼 있지 않고, 현재 규칙으로는 오라클이 실패한다
- 스펙: `spec.md:14` — 「같은 장소로 판정된 쌍 중 규칙이 짝으로 낸 것」은 무엇을 단언하는지 모호하다(19쌍 전부 짝? 일부?).
- 증거: 19번(범위 다름)은 placeId·32m·유형(대응 후) 모두 같고 픽스처 안에서 일대일이다(`s1-8-review-pages.json:2853-2863,2924-2934`, 거리 `s1-8-place-id-pairs.md:76`) → 규칙이 짝으로 낸다. 같은 범위인 4번은 같은 영문(13645)이 24번 국문과도 맞아 일대일에서 빠진다(`s1-8-review-pages.json:483-493,3714-3724`).
- 수정안: 스펙 부록에 30쌍 × {기대: 짝/없음, 이유} 표를 고정하고 테스트는 그 표를 데이터로 쓴다. 규칙에 제목 일치 조건을 더하면(implementation I2) 19번은 「없음」이 된다. 「판단 불가」 16번은 「없음」을 기대값으로.

### T2. 유형 코드 대응이 테스트에 없다
- 근거: 국·영 유형 코드가 다르다(`place/ingest/src/sync_tour.py:47-58`). 현재 SR-5.1 의 「세 조건 각각 실패」(`spec.md:32`)는 같은 코드 체계 픽스처로 짜면 통과하고 운영에서 0건이 된다.
- 수정안: 단위 사례에 「ko 12 ↔ en 76 → 같은 유형」, 「ko 25(코스) → 짝 없음」을 더하고, 회귀 주입에 「대응표 무시(코드 문자열 비교)」를 더한다 — 오라클 픽스처가 실제 76/12 값을 쓰면 이 회귀가 빨강이 된다.

### T3. 빠진 음성·경계 사례
- noindex 대상(개요 없음·만료 행사)이 짝일 때 hreflang 을 내지 않음 — `AttractionPageRenderer.kt:63-64`, `prerender-seo.mjs:819` (implementation I5).
- 하이드레이션 뒤에도 hreflang 이 남음 — `useSeo.ts:69-78` 가 다중 태그를 지운다. vitest 로 `AttractionPage` 의 `useSeo` 입력에 alternates 가 들어가는지(기존 `portal-fe/src/seo/__tests__/prerenderPlace.test.ts:119-135` 의 hreflang 사례와 같은 층).
- SSR ↔ copy.mjs 패리티 — 기존 JSON-LD 패리티 테스트 방식(`AttractionSeoText.kt:6-8`)으로 hreflang 줄도 대조.
- `syncFrom` 병합 경로: 「개요 없는 목록 레코드가 들어와도 해시 그대로」(`Attraction.kt:364` `?:` 병합) — 매일 전량 변경 회귀를 잡는 유일한 사례.
- 새 행(생성 경로, `AttractionRepositoryAdapter.kt:35-37`)의 해시·시각.
- `source_modified_at` null 인 첫 채움 → `content_updated_at` null → RSS·IndexNow 제외.
- 행사 날짜만 바뀜 → 해시 변경(domain D4 반영 시).
- RSS: 제어문자 포함 제목 → 유효 XML(security S3), 색인 조회 실패 → 503(빈 200 아님, `nginx.conf:71-74` 선례), 결과 0건.
- IndexNow: 10,001건 → 요청 2회, 403/429 → 기록 후 Job 성공, 타임아웃.

### T4. 레이어 배정과 Mock 경계를 적어 둔다
- 짝 판정·해시·시각 불변식: 도메인 순수 테스트(Kotest BehaviorSpec, Mock 금지 — `docs/standards/test-rules.md:6,11`). 시각은 인자로 넘겨야 순수 테스트가 된다(`Attraction.kt:82` 는 `LocalDateTime.now()` 직접 호출).
- 재색인에 `alternateId` 가 실리는지: 기존 `search/batch/src/test/.../AttractionApiReindexTaskletTest.kt:603-605`(`samePlace` 단언)와 같은 자리, `search/app/src/test/.../AttractionReindexCaptureTest.kt:115-117` 의 역직렬화 경로 — ADR-0103 은 필드 누락을 역직렬화 테스트가 잡았다고 기록(`ADR-0103-…:79`).
- IndexNow: 파이썬 ingest 테스트(`place/ingest/tests/`)에서 HTTP 경계(`urlopen`)만 가짜로 — 요청 본문의 `host`·`key`·`keyLocation`·`urlList` 를 단언.
- RSS 렌더: search:app 단위(렌더러) + 컨트롤러 슬라이스 하나(503).

### T5. 테스트 이름
- 파일은 구현체 이름 + `Test`(`test-rules.md:17`). 새 판정기·RSS 렌더러·place 조회 UseCase 가 정해지면 그 이름을 스펙에 적어 태스크가 위치를 고정하게 한다.

### T6. 배포 뒤 확인에 「짝이 있는 표본」의 출처가 없다
- 스펙: `spec.md:34`
- 수정안: 표본 3곳은 오라클에서 「짝」 기대값인 쌍(예: 2번 2180↔5337, 3번 14206↔7935 — `s1-8-place-id-pairs.md:59-60`)으로 미리 정하고, 운영 응답의 `alternateId` 와 SSR `<link hreflang>` 둘 다 본다. IndexNow 는 꺼진 채라 「키 파일 200 + 본문이 키와 같음」까지 확인한다.

## 체크 항목
| 항목 | 결과 |
|---|---|
| AC 마다 테스트 | 대체로 있음 — T1(오라클 기대값), T3(SR-1.4 하이드레이션·SR-3.2 링크) 부족 |
| 레이어 배정 | T4 로 명시 필요 |
| Mock 경계 | T4 |
| 테스트 데이터 | 오라클 픽스처 OK, 기대값 표 필요(T1) |
| 음성·경계 | T2·T3 |
| 이름 규칙 | T5 |

VERDICT: REVISE
