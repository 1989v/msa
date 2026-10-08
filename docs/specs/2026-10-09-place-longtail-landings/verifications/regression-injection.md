# 스펙 G1(place-longtail-landings) TG6 6.2 — 회귀 주입(SR-5.3 + 그룹별 「처음부터 초록」 항목)

- 2026-10-09 KST. 임시 사본 `scratchpad/wt-inject-g1`(detached `c7c6f8c0c`)에서 했다. 원본 wt-impl 과 메인 트리는 손대지 않았고, 끝난 뒤 사본을 제거했다. 커밋 없음.
- 사본 준비: 이번 대상은 portal-fe 뿐이다. 서브모듈 중 portal-fe 안에 있는 것은 `portal-fe/public/games` 하나인데, 원본 wt-impl 에서도 초기화돼 있지 않고 메인 `.git/modules` 에도 포인터 sha `bf2c524` 가 없다. 그래서 빈 디렉터리로 뒀다. 기준선 tsc·vitest 는 이 상태로 통과했다. ai·auth·gifticon 은 Kotlin 쪽이라 이번 주입과 관계가 없어 받지 않았다. `portal-fe/node_modules` 는 wt-impl 것을 심링크했고, package-lock.json 은 `cmp` 로 같은 것을 확인했다.
- 기준선(주입 전): `node scripts/render-content.mjs` 종료 0. vitest 14 파일(landingDecisions·landingMeta·placeApi·selectPlaceLandings·prerenderPlaceLandings·prerenderPlace·PlaceLanding·PlacePage·PlacePage.tracking·renderContent·prerenderTechSearch·guidesLint·prerenderGuides·GuidePage) **14 passed · 207 passed**. `npx tsc -b` 종료 0, error TS 0건.
- 주입은 한 번에 하나씩 넣었다. 대상 테스트만 돌린 뒤 `git checkout -- .` 로 되돌렸고, 38건 모두 `git status --porcelain` 이 비어 있었다.
- 컴파일 확인: `src/` 의 TS·mjs 를 고친 주입은 매번 `npx tsc -b` 를 돌렸다. 7번만 TS2322 오류가 1건 났다. 그래서 7번은 무효로 치고 37번(빈 문자열형)으로 다시 주입했다. 나머지 tsc 대상 주입은 error TS 0건이다. `scripts/*.mjs` 와 `nginx.conf`, 편집 원본 md 는 tsc 범위(`include: ["src"]`) 밖이다.
- 빨강은 모두 해당 단언이 실패한 것이다. 같은 파일의 다른 테스트가 통과했으니 모듈은 정상으로 로드됐다. 구문 오류 흔적(SyntaxError/Transform failed)은 0건이다. nginx 주입은 사본의 `portal-fe/nginx.conf` 를 고친 뒤 사본의 check 스크립트로 판정했다(실제 `nginx:1.27-alpine`).

## 주입 표

| # | 주입 | 출처 | 대상 | 결과 · 잡은 테스트(또는 계약 항목) |
|---|---|---|---|---|
| 1 | 하한 10→9 (`copy.mjs` `PLACE_LANDING_MIN_RESULTS = 9`) | tasks | landingDecisions.test.ts | **빨강** 1 failed \| 4 passed — 「속성 랜딩 결정 수치 > 하한 10 · 속성당 5 · 합산 20 · Jaccard 0.5」 |
| 1 | 〃 (대조) | tasks | selectPlaceLandings·prerenderPlaceLandings·PlaceLanding·prerenderGuides | **초록(의도한 결과)** 4 files · 68 passed — 경계 테스트가 상수로 계산하므로 landingDecisions 만 빨강이다 |
| 2 | 선정 함수 `>=` → `>` (`c.count < MIN` → `<= MIN`) | tasks · TG2 | selectPlaceLandings | **빨강** 5 failed \| 15 passed — 「하한 — MIN−1 은 제외, MIN 은 포함」 외 4 |
| 3 | 속성당 상한 제거 | tasks | selectPlaceLandings | **빨강** 2 failed — 「속성당 상한 — 한 속성 후보가 상한보다 많으면 상한 수만」 · 「동점은 코드 오름차순」 |
| 4 | 합산 상한 제거 | tasks | selectPlaceLandings | **빨강** 1 failed — 「합산 상한 — 국 20 + 영 10 후보(같은 건수)면 합산 상한 수, 국문이 먼저」 |
| 5 | 분류 필터 제거 — 선정 스크립트 `buildCandidates` | tasks | selectPlaceLandings | **빨강** 1 failed — 「질의 인자 — 모든 질의에 관광 분류, 시도 2자리 · 시군구 3자리, 필터 질의는 size 30」 |
| 6 | 분류 필터 제거 — 프리렌더 `fetchPlaceLandings` | tasks | prerenderPlaceLandings | **빨강** 1 failed \| 22 passed — 「항목마다 필터 질의 1회: 관광 분류·시도 2자리·시군구 3자리·속성 파라미터·size 30」 |
| 7 | 분류 필터 제거 — SPA 프리셋 질의 (`undefined`) | tasks | PlaceLanding | **무효** — tsc TS2322 1건이 나서 컴파일되는 회귀가 아니다(37번으로 다시 주입) |
| 37 | 분류 필터 제거 — SPA 프리셋 질의 (`preset ? ''`, tsc 0건) | tasks | PlaceLanding | **빨강** 1 failed \| 15 passed — 「프리셋 질의 — sigunguCode 는 3자리, category 는 관광 분류, 속성 파라미터 하나」 |
| 8 | 스위치 false 인데 noindex 제거 — 프리렌더(`noindex: !p.linkable`) | tasks | prerenderPlaceLandings | **빨강** 1 failed — 「스위치 false 면 하한 이상·비은퇴여도 noindex」 |
| 9 | 스위치 false 인데 noindex 제거 — SPA(`!INDEXABLE` → `INDEXABLE`) | tasks | PlaceLanding | **빨강** 3 failed — 「스위치가 꺼져 있으면 N 이 충분해도 noindex」 외 2 |
| 10 | nginx 랜딩 location 삭제 | tasks · TG3 | check-nginx-place-landings.sh | **빨강** exit 1 — ① `/regions/11110/parking`·`/en/…` 프리렌더 아님, ② `/regions/11110/foo` 404 기대 → **200**·SPA 셸, `/en/regions/11110/pet`·`/regions/99999/parking` 도 200 셸 |
| 11 | nginx 랜딩 location 을 옛 지역 301 블록 앞으로 | 지시 · TG3 | check-nginx-place-landings.sh | **빨강** exit 1 — ④ `/regions/29110/parking`·`/en/regions/46230/free` 301 기대 → **404**, Location 빈 값 |
| 11 | 〃 | 〃 | check-nginx-legacy-regions.sh | 초록 exit 0 — 이 스크립트는 세그먼트 둘인 랜딩 주소를 다루지 않는다(예상대로) |
| 12 | nginx 옛 지역 301 정규식에서 `(/[^/]+)?` 제거 | TG3 | check-nginx-place-landings.sh | **빨강** exit 1 — ④ 두 주소 301 기대 → **404** |
| 12 | 〃 | 〃 | check-nginx-legacy-regions.sh | 초록 exit 0 — 시도·시군구 옛 주소는 그대로 301(예상대로) |
| 13 | (참고) 랜딩 location 을 지역 location 뒤로 | tasks 원문 | check-nginx-place-landings.sh | **초록** exit 0 · PASSED — 구현 메모대로 무동작이다. 지역 정규식은 세그먼트 하나만 받아 순서와 관계없이 랜딩 주소를 못 가로챈다. 이 항목은 11번이 대신한다 |
| 14 | draft noindex 제거 — 프리렌더 편집 페이지 | tasks · TG5 | prerenderGuides | **빨강** 1 failed — 「draft → noindex · 「검수 전 초안」 띠 · sitemap·llms 제외 · 목록 없음 · 허브 링크 없음」 |
| 15 | draft noindex 제거 — SPA GuidePage | tasks · TG5 | GuidePage | **빨강** 1 failed — 「/guides/:slug — 조각 순서대로 그리고, draft 는 띠와 noindex」 |
| 16 | published 게이트(검수자·검수일) 제거 | tasks · TG5 | renderContent | **빨강** 1 failed — 「published 인데 검수자·검수일이 비면 실패」 |
| 17 | 프리셋을 effect 로 주입(초기값 대신 마운트 effect 로 setSidoCode·setSigunguCode) | tasks · TG4 | PlaceLanding | **빨강** 8 failed \| 8 passed — heading·sentence(ko·en), 로그인 복귀보다 프리셋이 이긴다, noindex 2, facet null, 질의 인자, N 재계산 없음. **주의: 지목된 「좌표 granted/denied — SEARCH trigger 열은 [landing] 하나」 두 테스트는 초록이었다** — effect 가 첫 응답 전에 돌아 SEARCH 기록이 랜딩 조건 한 번만 남는다. 회귀는 다른 단언이 잡는다 |
| 18 | 랜딩 조회를 부분 실패 가드 밖으로(`fetchSeoSections` try 제거) | tasks · TG3 | prerenderPlaceLandings | **빨강** 1 failed — 「랜딩 조회 하나만 실패해도 섹션 실패 — 다른 섹션이 성공했으면 PartialSeoFailure」 |
| 19 | 편집 원본에 금칙 표현 한 줄(`seoul-free-indoor.md` 끝에 「제가 직접 가 본 곳만 골랐습니다.」) | tasks · TG5 | guidesLint | **빨강** 1 failed \| 6 passed — 「seoul-free-indoor.md → 종료 코드 0」 |
| 20 | 선정 스크립트가 `previous` 를 버림 | tasks · TG2 | selectPlaceLandings | **빨강** 5 failed — 「이번에 안 뽑힌 기존 항목은 retired 로 남고 상한 계산에서 빠진다」 외 4(기존 항목 유지 묶음 전부) |
| 21 | 후보 조립 `count` 에 facet 건수 | tasks · TG2 | selectPlaceLandings | **빨강** 1 failed — 「count 는 facet 건수가 아니라 필터 질의의 totalElements, ids 는 상위 결과 id」 |
| 22 | SPA N 을 facet 건수로(`chipCount(data.attributeFacets, …)`) | tasks · TG4 | PlaceLanding | **빨강** 6 failed — 「첫 결과의 facet 이 null 이어도 N 은 totalElements, 결과 전에는 noindex」 외 5 |
| 23 | 프리셋 `sigunguCode` 5자리(`entry.code`) | tasks · TG4 | PlaceLanding | **빨강** 5 failed — 「프리셋 질의 — sigunguCode 는 3자리 …」, trigger 열 granted/denied, 조건 변경 뒤 표지, 로그인 복귀 |
| 24 | SPA 카드를 이스케이프 없이 HTML 문자열로 이어 `dangerouslySetInnerHTML` | tasks · TG5 | GuidePage | **빨강** 2 failed — 「카드 이름의 `<script>` 는 요소가 아니라 글자다」 · 「조각 순서대로…」 |
| 25 | 표지 id 형식 검사 제거 | tasks · TG5 | renderContent | **빨강** 1 failed — 「표지 id 가 13자리면(집합은 일치) 형식 위반으로 실패」 |
| 26 | 은퇴 항목도 상한에 셈(previous 의 retired 를 picked·perAttr 에 미리 넣음) | TG2 | selectPlaceLandings | **빨강** 2 failed — 「다시 뽑히면 retired · retiredAt 을 지우고 selectedAt 은 처음 값」 · 「이미 은퇴한 항목의 retiredAt 은 처음 값을 유지한다」 |
| 27 | 재선정 시 `selectedAt` 덮어씀(`selectedAt: today`) | TG2 | selectPlaceLandings | **빨강** 1 failed — 「다시 뽑히면 … selectedAt 은 처음 값」 |
| 28 | facet null 을 조용히 건너뜀(`continue`) | TG2 | selectPlaceLandings | **빨강** 1 failed — 「facet 이 null 이면 예외 — 조용히 건너뛰지 않는다」 |
| 29 | sitemap 에 retired 포함 | TG3 | prerenderPlaceLandings | **빨강** 2 failed — 「스위치 false → 랜딩 0건」 · 「스위치 true → 하한 이상·비은퇴만, lastmod …」 |
| 30 | title 중복 게이트만 제거(`['description']`) | TG3 | prerenderPlaceLandings | **초록** 23 passed — 픽스처의 중복 항목은 title·description 이 함께 겹친다. 그래서 남은 description 게이트가 같은 예외를 낸다. title 게이트만 빠진 회귀는 이 테스트로 구별되지 않는다(고치지 않고 기록) |
| 38 | title·description 중복 게이트 전부 제거(30번 보강) | TG3 | prerenderPlaceLandings | **빨강** 1 failed — 「품질 게이트: 랜딩 간 title·description 이 겹치면 빌드를 세운다」 |
| 31 | 모집단 밖 code 도 파일 생성(지역 행 대체값 + 조회 건너뛰기 제거) | TG3 | prerenderPlaceLandings | **빨강** 2 failed — 「모집단 밖 code 항목 → 파일 없음 + 경고」 · 「모집단 밖 항목은 조회하지 않는다」 |
| 32 | 색인된 뒤 조건 바꾸면 N 재계산 | TG4 | PlaceLanding | **빨강** 1 failed — 「하한 이상으로 색인된 뒤 조건을 바꿔 건수가 줄어도 다시 계산하지 않는다」 |
| 33 | restored 가 프리셋을 이김(복원 상태를 늘 읽고 시도·시군구 우선순위를 뒤집음) | TG4 | PlaceLanding | **빨강** 1 failed — 「남아 있던 로그인 복귀 상태보다 프리셋이 이긴다 — 첫 질의는 랜딩 조건, trigger landing」 |
| 34 | 은퇴·목록 밖 랜딩 링크 검사 제거 | TG5 | renderContent | **빨강** 2 failed — 「목록 밖 랜딩 링크면 실패」 · 「은퇴 랜딩 링크면 실패」 |
| 35 | 출현 수 = 형식 일치 수 검사 제거 | TG5 | renderContent | **빨강** 1 failed — 「홑따옴표 표지는 출현 수 ≠ 형식 일치 수로 실패」 |
| 36 | placeApi 가 re-export 대신 사본 배열(같은 값) | TG1 | placeApi.test | **빨강** 1 failed \| 4 passed — 「placeApi 가 내보내는 것은 copy.mjs 의 같은 배열이다(사본 아님)」 |

## 합계

- 주입 38건(번호 1~38)이다. 그중 7번은 tsc 오류로 무효이고 37번으로 다시 주입했다. 유효한 주입은 37건이다.
- 빨강은 35건이다. 초록으로 남은 것은 2건이다.
  - 13번: 랜딩을 지역 location 뒤로 옮겨도 무동작이다. tasks.md 원문 항목이고, 구현 메모대로 11번이 대신한다.
  - 30번: title 게이트만 지우면 description 게이트가 가려 초록이다. 게이트 전체를 지운 38번은 빨강이다.
- 대조(빨강이 아니어야 하는 것): 1번 하한 10→9 에서 landingDecisions 를 뺀 4파일 68건은 초록이다(스펙 의도). 11·12번에서 check-nginx-legacy-regions.sh 는 초록이다(범위 밖).
- 지목한 단언과 실제로 잡은 단언이 다른 것: 17번(프리셋 effect 주입). tasks.md 가 지목한 「trigger 열 `['landing']`」 테스트 2건은 초록이고, heading·noindex·질의 인자 등 다른 테스트 8건이 빨강이다.
- tasks.md TG6 6.2 표의 19항목은 모두 위 표에 있다. 「랜딩 location 을 지역 location 뒤로」는 13번(참고, 무동작)과 대체 11번으로 다뤘다. 「분류 필터 제거」는 선정·프리렌더·SPA 3곳(5·6·37)으로 나눴고, 「스위치 noindex 제거」(8·9)와 「draft noindex 제거」(14·15)는 프리렌더·SPA 로 나눴다.

## 근거 파일
- `scratchpad/inject-g1/run.py`: 주입 정의와 실행기. `rows.tsv` 에 결과 행, `run.out` 에 전체 진행이 있다.
- `scratchpad/inject-g1/inj<NN>-*.log`: 주입별 테스트·nginx 출력. `inj<NN>-tsc.log` 는 컴파일 확인 결과다.
- `scratchpad/inject-g1/base-vt.log` · `base-tsc.log` · `render-content-base.log`: 기준선.

## 후속 — 30번(title 중복 게이트만 제거) 초록 메움 (2026-10-09 05:5x KST, 메인)

- 원인: 기존 픽스처가 title·description 을 함께 겹치게 해서 description 게이트가 같은 예외를 냈다.
- 조치: `prerenderPlaceLandings.test.ts` 에 「title 만 겹쳐도 세운다」 케이스를 더했다. 이름이 같은 다른 시군구(코드 11999)라 title 은 같고 N 이 달라 description 은 다르다. 예외 메시지에 `title 중복` 이 있어야 한다.
- 주입 재확인: 게이트 루프를 `['description']` 로 바꾸면 이 케이스가 `Tests 1 failed` · 되돌리면 `24 passed`.
- 13번(랜딩↔지역 location 순서)은 두 정규식이 겹치지 않아 무동작인 주입이다. 대신 11번(옛 301 블록 앞으로)이 빨강이다.
