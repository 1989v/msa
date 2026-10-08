# Usecase Review — place 허브 최소 행동 계측

## 3라운드 (2026-10-08)

- 대상: `docs/specs/2026-10-08-place-hub-instrumentation/spec.md` 2라운드 개정본 (+ `planning/requirements.md`, `planning/test-quality.md` 「리뷰 2라운드 반영」, `context/open-questions.yml` Q13, `context/review-verdict-round2.md` §2 확정 5건은 재론하지 않음)
- 기준 코드: 워크트리 `wt-impl` (origin/main `8a61f0b`)
- 서브 컨텍스트: `docs/plans/2026-10-08-place-growth-work-plan.md:24,26,68`(S1-12b·완료 조건), `s1-12-instrumentation.md:77-104`
- 표준: ADR-0095(`:83,:140` 개정 예정으로 받음), `docs/standards/test-rules.md`. usecase 전용 표준·`.claude/rules/` 없음
- KB: [[gate-failure-modes]] (1989v, updated 2026-09-11) ① 「비율을 볼 때 분자보다 **분모를 먼저 의심한다**」 — 2라운드와 같은 판, 변경 없음

### 2라운드 항목 판정

| 2R | 판정 | 근거 |
|---|---|---|
| N1 `overlay` 트리거 발화 불가 | **해소** | `spec.md:32` 어휘에서 `overlay` 제거 + `lang`·`other` 추가, `:33` SR-2.4 「오버레이 토글은 목록 질의를 바꾸지 않으므로 SEARCH 가 없다」, `:79` 필터 적용 식에서 제거, `:118` Out of Scope, `open-questions.yml:63-67` Q13, `test-quality.md:32` 「오버레이 토글 → SEARCH 미발화·viewId 불변」. 심판 §2-① 그대로 |
| N2 비율 분자·분모 불일치 | **해소** | `spec.md:80` 결과 view = `trigger != 'landing'`(initial·page·lang·other 포함), `:85` 선택률 = view 단위 + 「분자는 분모 집합 안에서만」, 선택당 지도·찜 = 튜플 단위, `:87-103` SQL. 집합 일치는 아래 「지정 확인 ③」 |
| 메모① 뽑기·이곳 보기 | **해소** | `spec.md:119` Out of Scope |
| 메모② `saved` 둘째 토글 유실 | **해소** | `spec.md:50` SR-5.4 「같은 view 의 이후 토글은 `saved` 와 무관하게 중복 키에 걸려 가지 않는다 … 찜된 채 들어와 해제 → 찜이면 그 view 의 찜 완료는 0」, `:67` 「`saved` 두 방향 케이스는 서로 다른 viewId 로」, `test-quality.md:31-32` |
| 메모③ 같은 검색어 재제출 | **해소** | `spec.md:120` Out of Scope |
| 메모④ SR-1.4 게임 세션 분리·소비자 무정지 | 확인 사항 | 조치 불필요. `spec.md:27` 그대로 유효 |

### 지정 확인 셋

**① 「결과 view」(landing 만 제외)와 「분자는 분모 집합 안에서만」이 initial·page·lang·other 를 일관되게 다루는가 — 일관하다.**

- 정의: `spec.md:80` 결과 view 는 `SEARCH ∧ trigger != 'landing'` → 넷 다 분모. `:84` 건수 제외 행(검색 제출·필터 적용에서 landing·initial·page·lang·other 제외, 결과 view 에서는 landing 만 제외)과 `:24` SR-1.1(`page` 는 건수 제외·분모 포함)이 같은 방향.
- 코드: 넷 다 「카드가 그려지는 view」다. `initial` 은 `PlacePage.tsx:449-469` → `selectRegion` → `sidoCode` 가 차서 `pickingRegion`(`:417`) 이 거짓 → `:1192` 목록 렌더. `page` 는 `:377`(모바일 센티널)·`:1209,:1218`(데스크톱)·`:1231`(더 보기). `lang` 은 `query` deps(`:305`) + 아래 ② 인스턴스 유지. `other` 는 새 viewId 에 결과가 온 경우라 정의상 카드가 있다. `landing` 만 `pickingRegion` 참 → `:1176` 지역 선택 화면.
- 분자 제한: 선택률 SQL 은 view 단위 GROUP 뒤 `WHERE result_view` 라 landing view 의 클릭은 분자·분모 모두에서 빠진다(③).

**② SR-2.3 `lang`·`other` 가 실제 `switchLang`(`:880-884`) 경로와 맞는가 — 맞다. 리마운트가 아니라 인스턴스 유지다.**

- `switchLang` 은 place 호스트에서 `base = ''`(`:882`) 라 `navigate('/en' | '/')`(`:883`) — 같은 SPA 안 이동.
- `App.tsx:204-225`(`/`)와 `:316`(`/en`)이 둘 다 `isPlaceHost ? <PlacePage />` 를 같은 `<Routes>` 직속에, 같은 lazy 타입(`App.tsx:23`)으로, key 없이 그린다(`key={…pathname}` 는 `portal-fe/src` 에 0건). `placeRoute`(`:109-111`)는 비-apex 에서 element 를 그대로 돌려준다. react-router-dom 7.14 선언형 `<Routes>` 는 매치된 route 의 element 를 같은 자리에 두므로 React 가 fiber 를 재사용한다 → **`PlacePage` 는 리마운트되지 않고 `useState` 전부(`sidoCode`·`keyword`·`autoPickedRef`)가 남는다.**
- `lang` 은 `pathname` 파생(`PlacePage.tsx:225-227`) → `query` 가 `lang` 하나만 바뀐 채 재계산 → 새 viewId → 결과 도착 → ref `lang` 소비, `changed: ['lang']`. `autoPickedRef`(`:449`) 가 남아 `initial` 이 다시 나가지 않고, SESSION_START 플래그도 마운트 effect 라 다시 돌지 않는다. 스펙의 「`lang`(언어 전환 — `switchLang` 에서 ref)」와 코드가 같다.
- `other`: ref 없이 결과가 도착하는 코드 경로는 react-query 재조회(포커스·재연결, `staleTime` 60s `:314`)뿐인데 같은 viewId 라 중복 키 `viewId|SEARCH|term|ATTRACTION_LIST|SEARCH` 에 막혀 행이 없다. 실제 `other` 행은 0 에 가깝고 안전망 역할만 한다. 분모 포함 결정은 맞다.

**③ 선택률 SQL 이 정의 표와 같은 집합을 세는가 — 센다.**

- 분모: 내부 질의가 `view_id` 로 GROUP 하고 `result_view = max(action='SEARCH' AND trigger != 'landing')`, 바깥 `WHERE result_view` → `:80` 의 `uniqExact(view_id)` 집합과 같다. SESSION_START(`PAGE`)·IMPRESSION 행은 두 술어 모두 거짓이라 GROUP 안에 섞여도 값을 바꾸지 않는다.
- 분자: `selected = max(action='CLICK' AND section_id IN ('ATTRACTION_LIST','MAP_OVERLAY'))` 가 **같은 GROUP 안**에서 계산되므로 `countIf(selected)` 는 분모 집합 안의 view 만 센다 — `:85` 「분자는 분모 집합 안에서만」 그대로.
- 튜플 비율: `GROUP BY view_id, entity_id` + `WHERE selected` 가 `:81` 결과 선택 튜플 집합이고, `map_open`·`saved` 가 같은 GROUP 안이라 `:85` 「같은 (view_id, entity_id)」 와 같다. `entity_type='ATTRACTION'` 선필터는 SEARCH(`SEARCH`)·SESSION_START(`PAGE`)를 미리 걷어낼 뿐 집합을 바꾸지 않는다.

### 체크리스트 (3R)

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | Actor-goal 쌍 | 통과 | `spec.md:8,12-14` 필수 6종 중 넷 + 세션·지도 열기, `:117` 나머지 둘 이유 |
| 2 | 주/대안/예외 흐름 | 통과 | 주: SEARCH 도착(`:30`). 대안: `initial`·`page`·`lang`·`other`(`:32`). 예외: 검색 실패(`:34`)·수정키(`:37`)·자동완성 패널(`:37`)·오버레이 토글(`:33`)·비로그인/롤백(`:49`) |
| 3 | 사전/사후 조건 | 통과 | SR-10 정의 표 + SQL(`:72-103`), 위 ①~③ |
| 4 | AC 추적성 | 통과 | SR-9(`:66-70`) ↔ `test-quality.md:27-39`, 회귀 주입 8건(`:37`) |
| 5 | 엣지 케이스 확장 | 통과 | 2라운드 N1·N2·메모 셋 전부 닫힘. 남은 것은 아래 메모(정의를 깨지 않음) |
| 6 | 테스트 전략 매핑 | 통과 | `test-quality.md:32` 오버레이·`other` 안전망(「`trigger` undefined 면 실패」)·`saved` 두 방향 viewId 분리 |

### 새 발견

판정에 넣을 것 없음. 아래 메모는 전후 비교 정의를 깨지도, 흐름을 비우지도 않는다.

### 메모 (판정에 넣지 않음)

- **`switchLang` ref 위치**: ref 는 `:881` 의 `if (next === lang) return` **뒤**에 심어야 한다 — 같은 언어 버튼을 다시 누르면 결과 도착 없이 `lang` 이 ref 에 남는다. 다음 조작이 덮어쓰므로 실해는 없지만, `pickSuggestion` 의 early return(`:840`) 에 같은 규칙을 적어 둔 것과 같은 꼴로 한 줄이면 구현자가 헤매지 않는다.
- **패널을 둔 채 view 가 바뀌면 지도·찜 튜플이 갈린다**: `selectedId` 를 비우는 것은 `selectRegion`(`:430`)뿐이고 쪽 넘김(`:1209,:1218`)·분류 칩(`:1046-1050`)·속성 칩(`:1130`)은 패널을 둔다. 그 뒤 패널의 지도 링크(`:1317`)·찜(`:1304`)은 **새 viewId** 로 나가 튜플 (view_new, id) 에 `selected` 가 없다 → 선택당 비율 분자에서 빠지고 절대 건수에만 남는다. 정의는 전후 같아 비교는 성립한다. `:85` 가 자동완성 패널만 예로 들고 있으니 「같은 view 안에서만 짝짓는다 — 패널을 둔 채 쪽·필터를 바꾼 뒤의 지도·찜은 절대 건수에만」 한 줄이면 읽는 사람이 비율을 과소해석하지 않는다.
- **카드 별 찜은 선택 없는 찜이다**: `:1368` 카드 별은 카드를 고르지 않고 찜이 된다 → 선택당 찜 분자 밖, 찜 완료 절대 건수 안. 위와 같은 자리에 「카드 별 찜도 같다」 한 줄. 자동완성 패널보다 이쪽이 더 흔한 분자 밖 경로다.
- **`landing` 에 카드가 잠깐 보일 수 있다**: `:84` 「지역 선택 화면이라 카드가 없다(`:1192`)」는 `sidoRegions` 도착 뒤에만 참이다 — `hasRegionAxis`(`:391`) 가 거짓인 동안 `pickingRegion`(`:417`) 도 거짓이라 전국 결과가 먼저 오면 `:1192` 가 카드를 그린다. 그 클릭은 landing viewId 라 선택률에서는 분자·분모 모두 빠지고(SQL 이 view 단위), 결과 선택 절대 건수에만 남는다. 정의는 안 깨진다.
- **결과 도착 전 연속 조작**: 분류 → 속성을 결과가 오기 전에 누르면 앞 viewId 의 SEARCH 가 없다 — `useQuery` 가 키를 바꿔 앞 결과가 컴포넌트에 오지 않는다. 「본 결과만 센다」와 같은 방향이라 그대로 둔다. 모바일 page ≥ 1 에서 `retry: 3` 을 소진해 실패하면 `store.items`(`:361`) 가 남아 카드는 보이는데 그 viewId 의 SEARCH 가 없다 → 그 클릭은 선택률 분자·분모 모두 밖. 드물다.
- **「상세 페이지 열기」(`:1314`)** 는 계측 밖 — Out of Scope 의 「이곳 보기」와 같은 성격이나 인용이 `:1000-1003` 뿐이다. 한 줄 더하면 좋다.

3라운드 판정: SHIP

---

## 2라운드 (2026-10-08)

- 대상: `docs/specs/2026-10-08-place-hub-instrumentation/spec.md` 개정본 (+ `planning/requirements.md`, `planning/test-quality.md` 「리뷰 1라운드 반영」, `context/open-questions.yml` Q11)
- 기준 코드: 워크트리 `wt-impl` (origin/main `8a61f0b`)
- 서브 컨텍스트: `docs/plans/2026-10-08-place-growth-work-plan.md:24,26`(S1-12b 신설), `:68`(S1-12 완료 조건), `:95`(S3-6a); `docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-12-instrumentation.md:77-84`(필수 6종), `:99-104`(중복 기준)
- 표준: ADR-0095(`docs/adr/ADR-0095-impression-click-pipeline.md:83,140` — 스펙 `:94` 가 개정 예정으로 받음), `docs/standards/test-rules.md`. usecase 차원 전용 표준·`.claude/rules/` 는 없음(Glob 0건)
- KB: [[gate-failure-modes]] (1989v, updated 2026-09-11) ① 「비율을 볼 때 분자보다 **분모를 먼저 의심한다**」 · [[hybrid-search-local-embedding]] (1989v, updated 2026-09-22) 「계측을 켰다 = ① 보냈다 ② accepted ③ 행이 있다」

### 1라운드 발견 판정

| 1R | 판정 | 근거 |
|---|---|---|
| B1 중복 키 한 건 접힘 | **해소** | SR-3.4 불변식(`spec.md:40`), SR-6.3 FE 키(`:55`), SR-7.3 eventId(`:60`), SR-5.4 `saved:true` 만(`:50`), SR-9.1 「카드 → 지도 → 찜」 통합 케이스(`:67`), `test-quality.md:19-20`, ADR-0095 두 줄 개정(`spec.md:94`), 결정 기록 Q11(`open-questions.yml:53-57`). 상세 두 섹션 겹침 노출 2행을 받아들이는 결정이 적혀 있다 |
| R1 첫 진입 숨은 질의 | **해소** | `landing` 정의(`spec.md:32`), SR-10 분모 제외(`:83`). 보내고 분모에서 빼는 쪽을 택했다 |
| R2 기준선 질의 부재 | **해소** | SR-10 표(`spec.md:72-84`). 단 비율 행의 분모·분자가 다른 view 집합을 센다 → N2 |
| R3 6종 대응표 | **해소** | Goal(`spec.md:8`) 「필수 6종 중 넷 + 세션·지도 열기」, Out of Scope(`:98`) `collection_shared`·`directions_clicked` 이유 명시 |
| R4 예외 흐름 셋 | **해소** | 검색 실패 미발화(`spec.md:34`), 수정키 `newTab`(`:37`), 자동완성 패널 CLICK 없음(`:37`). 마지막 결정이 SR-10 비율과 엇갈린다 → N2 |
| R5 모바일 page viewId | **해소** | SR-1.1(`spec.md:24`) + SR-10 `page` 제외(`:83`) |

### 체크리스트

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | Actor-goal 쌍 | 통과 | `spec.md:12-14` 운영자 2·개발자 1, 6종 대응이 Goal·Out of Scope 에 명시(`:8`, `:98`) |
| 2 | 주/대안/예외 흐름 | 부분 | 실패·newTab·suggestion·비로그인·롤백이 적혔다(`:34,:37,:49`). `overlay` 는 결과 도착이 없는 조작이라 SR-2.1 흐름에 붙을 자리가 없다 (N1) |
| 3 | 사전/사후 조건 | 부분 | SR-10 이 사후 조건을 질의로 고정했다(`:72-84`). 비율 행의 분모·분자가 다른 view 집합이다 (N2) |
| 4 | AC 추적성 | 통과 | SR-9 ↔ `test-quality.md:17-25`, 회귀 주입 6건(`:25`) |
| 5 | 엣지 케이스 확장 | 부분 | 중복 키·page·landing·saved 는 닫혔다. overlay(N1)·언어 전환·뽑기 경로가 비어 있다(메모) |
| 6 | 테스트 전략 매핑 | 통과 | N1·N2 결정에 따라 케이스 1~2건 추가 |

### 판정 이유

#### N1 (체크 2·5, 새 발견) — `overlay` 는 SEARCH 가 붙을 「결과 도착」이 없는 조작이다

스펙 결정:
- `spec.md:32` SR-2.3 `trigger` 어휘에 `overlay`
- `spec.md:79` SR-10 필터 적용 분모에 `overlay`
- `spec.md:30` SR-2.1 「검색 결과가 도착하면 그 `viewId` 로 SEARCH 를 한 번」 — 결과 = 관광지 목록 `useQuery` 의 `data`

코드:
- `portal-fe/src/pages/place/PlacePage.tsx:278-306` `query` 의존 배열에 `overlay` 가 없다 → 오버레이 칩(`:1063` `setOverlay`)은 `query` 를 바꾸지 않는다 → 새 viewId 도, 목록 결과 도착도 없다.
- 오버레이 결과는 별도 쿼리(`:684-698` `['place-overlay', overlay, mapView, lang]`)이고 `mapView` 는 지도 `idle` 마다 갱신된다(`:669-682`) → 지도를 끌 때마다 다시 도착한다.

결과: 구현자가 SR-2.1 대로 하면 `overlay` SEARCH 는 **0건**이 되어 필터 적용 분모에서 오버레이가 조용히 빠진다. ref 에 남은 `overlay` 는 조작 없이 오는 다음 도착(예: 언어 전환 `:880-884` → `query` 의 `lang` 의존 `:305`)에 잘못 붙는다. 반대로 오버레이 쿼리 도착에 붙이면 지도 팬마다 「필터 적용」이 쌓인다. `test-quality.md:21` SR-2 경계 목록에 overlay 케이스가 없어 어느 쪽으로 구현돼도 테스트가 못 잡는다.

수정안(둘 중 하나, (a) 권장):
- (a) 이번 기준선에서 오버레이 켜기는 필터 적용으로 세지 않는다 — SR-2.3·SR-10 에서 `overlay` 를 빼고, 「오버레이 사용은 `MAP_OVERLAY` 핀 CLICK(SR-3.2)으로만 남는다」 한 줄.
- (b) 오버레이 칩 ON 시점에 SEARCH(대상 `SEARCH`/`*`, 섹션 `MAP_OVERLAY`, `trigger: overlay`, 현재 viewId — 섹션이 달라 목록 SEARCH 와 중복 키가 갈린다)를 보내고, 지도 `idle` 재조회는 보내지 않는다. 규칙이 하나 더 는다.
- 어느 쪽이든 SR-2.3 에 「ref 가 비어 있는 채 결과가 도착하면(언어 전환 등) `trigger: other` 로 보내고 SR-10 분모에서 뺀다」를 더하고, `test-quality.md` SR-2 경계에 「오버레이 토글 → SEARCH 미발화(또는 (b) 의 1건)」을 추가한다.

#### N2 (체크 3·4, R2·R4 해소의 후속) — SR-10 비율의 분자와 분모가 다른 view 집합을 센다

스펙 결정:
- `spec.md:78` 검색 제출 = `trigger IN ('submit','suggestion','nearMe','area')` 인 view 수
- `spec.md:80` 결과 선택 = `ATTRACTION_LIST`·`MAP_OVERLAY` CLICK — view 조건 없음
- `spec.md:84` 비율 「검색당 선택, 선택당 지도 열기·찜」
- `spec.md:37` 자동완성으로 열린 패널은 CLICK 을 보내지 않는다

코드:
- `PlacePage.tsx:449-469` 첫 진입 자동 시도 선택 → `initial` view 에 결과가 그려지고 카드(`:1201`)·핀(`:603`)을 고를 수 있다. SR-10 은 이 view 를 분모에서 뺀다 → 검색 없이 서울 결과에서 카드를 고르면 **분자에만** 들어간다.
- `PlacePage.tsx:848` `pickSuggestion` → `setSelectedId` 로 패널이 열리고, 그 패널의 지도 링크(`:1317-1324`)·찜(`:1304`)은 SR-4·SR-5 대로 센다 → 「선택당 지도·찜」의 분자에 **선택 CLICK 이 없는 건**이 들어간다.

결과: 「검색당 선택」이 1을 넘을 수 있고, 2단계 개선이 첫 진입 화면(`initial`)을 바꾸면 분모는 그대로인데 분자만 움직여 전후 비교가 뒤틀린다 — [[gate-failure-modes]] ① 그대로다. 운영자 스토리(`spec.md:12` 「같은 정의로 전후 비교」)의 정의가 아직 닫히지 않았다.

수정안:
- 비율을 **view 단위 전환**으로 다시 적는다: 「선택률 = `ATTRACTION_LIST`/`MAP_OVERLAY` CLICK 이 1건 이상인 view 수 ÷ SEARCH view 수(`trigger NOT IN ('page','landing')`)」 — `initial` 은 결과를 본 화면이므로 분모에 넣는다. 검색 제출·필터 적용은 지금처럼 **건수**로 두고 비율의 분모로 쓰지 않는다.
- 자동완성으로 연 패널에도 `CLICK`/`ATTRACTION_LIST`/`payload.source: 'suggestion'` 을 보낸다(사용자가 특정 관광지를 고른 것이 맞다) — SR-3.1 마지막 문장을 뒤집는다. 그러면 「선택당 지도·찜」이 조인 없이 건수÷건수로 성립한다. 뒤집지 않으려면 분자를 `(view_id, entity_id) IN (선택 CLICK 튜플)` 로 제한한다고 SR-10 에 적는다.
- `test-quality.md`: 「자동완성 선택 → CLICK(source suggestion)」 1건(채택 시).

### 사용자 행동 불변 확인

1라운드 §불변 확인이 그대로 유효하다. 개정이 더한 결정(`newTab` `spec.md:37`, 검색 실패 미발화 `:34`, 본문 `sessionId` `:58`)은 모두 기존 분기 **앞에 `track` 만 붙거나** 서버가 무시하던 필드를 읽는 변경이라 카드 early return(`PlacePage.tsx:1349`)·링크 기본 동작·찜 낙관 반전(`useFavorites.ts:33-44`)이 바뀌지 않는다.

### 메모 (판정에 넣지 않음)

- 뽑기(`PlacePage.tsx:964-979`)는 `searchAttractions` 를 `useQuery` 밖에서 직접 불러 SEARCH 가 없고, 「이곳 보기」(`:1000-1003`)는 상세로 이동한다 — 결과 선택도 검색도 아닌 경로. 범위 밖이면 Out of Scope 에 한 줄.
- SR-5.4·SR-9.1 「saved 두 방향」: 같은 view 에서는 **둘째 토글(`saved:false`)부터** 중복 키에 걸린다(`tracker.ts:29-31`, 키에 `saved` 없음). 두 방향 테스트는 찜된 상태에서 시작하거나 viewId 를 바꿔야 한다. 스펙 문장 「둘째 `saved:true` 는 … 가지 않는다」는 결과로는 맞지만 `saved:false` 도 함께 사라진다는 것을 적어 두면 테스트 작성자가 헤매지 않는다.
- 검색 제출 `uniqExact(view_id)`: 같은 검색어를 다시 제출하면 `query` 가 안 바뀌어(`:278-306`) viewId 도 SEARCH 도 없다. 재제출을 안 세는 것이 의도면 한 줄.
- SR-1.4 분리 확인: 게임 세션은 `entity_type='GAME'`(`analytics/.../GameSessionConsumer.kt:47`)이라 `PAGE`/`place-hub` 조건으로 충분하다. recommendation 소비자는 `SESSION_START` 를 `null` 로 흘린다(`RecommendationEventConsumer.kt:71`) — 새 SESSION_START 가 소비자를 멈추지 않는다.
- SR-10 공통 조건 `visitor_id != 'anonymous'` 는 beacon 경로도 게이트웨이 vid 쿠키로 채워지므로 세션 행이 빠지지 않는다(1라운드 §불변 확인과 같음).

2라운드 판정: REVISE

---

## 1라운드 (2026-10-08) — 원문

- 대상: `docs/specs/2026-10-08-place-hub-instrumentation/spec.md` (+ `planning/requirements.md`, `planning/test-quality.md`, `context/open-questions.yml`)
- 기준 코드: 워크트리 `wt-impl` (origin/main `8a61f0b`)
- 서브 컨텍스트: `docs/plans/2026-10-08-place-growth-work-plan.md:68,95`(S1-12 완료 조건 「2단계 전에 같은 정의로 기준선」, S3-6a), `docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-12-instrumentation.md:77-104`(필수 6종·분모·중복 기준)
- 표준: ADR-0095(`docs/adr/ADR-0095-impression-click-pipeline.md:78-84` view_id 중복 규칙), `docs/standards/test-rules.md`
- KB: [[gate-failure-modes]] (1989v, 2026-09-11) ① 「비율은 분모를 먼저 의심한다」 · [[hybrid-search-local-embedding]] (1989v, 2026-09-22) 「계측을 켰다 = 보냈다 + accepted + 행이 있다」

### 체크리스트 (1R)

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | Actor-goal 쌍 | 통과 | `spec.md:10-12` 운영자 2·개발자 1. 단 필수 6종 ↔ 스펙 6종 대응표가 없다 (R3) |
| 2 | 주/대안/예외 흐름 | 부분 | 저장소 실패·찜 실패·비로그인은 적혀 있다(`spec.md:19,41`). 검색 API 실패·수정키 클릭·첫 진입 숨은 질의가 비어 있다 (R1, R4) |
| 3 | 사전/사후 조건 | 부분 | 사후 조건이 「ClickHouse 행이 있다」(`spec.md:59`)까지만이고, 그 행으로 무엇을 어떻게 세는지가 없다 (R2) |
| 4 | AC 추적성 | 통과 | SR-9 ↔ `planning/test-quality.md:5-11`. 단 B1 시나리오(선택 → 지도 → 찜 순서)가 표에 없다 |
| 5 | 엣지 케이스 확장 | 실패 | 같은 관광지의 세 CLICK 이 중복 키 하나로 접힌다 (B1). 페이지 넘김·숨은 첫 질의 (R1, R5) |
| 6 | 테스트 전략 매핑 | 통과 | 회귀 주입 규칙 포함(`test-quality.md:13`). B1 시나리오 추가 필요 |

### 판정 이유 (1R)

#### B1 (체크 5·3) — 결과 선택·지도 열기·찜이 FE 중복 키와 서버 eventId 에서 **한 건으로 접힌다**

스펙 결정:
- `spec.md:30` SR-3.1 카드/핀 선택 = `CLICK` / `ATTRACTION` / 관광지 id
- `spec.md:35` SR-4.1 지도 링크 = `CLICK` / `ATTRACTION` / 관광지 id (섹션 `MAP_LINK`)
- `spec.md:39` SR-5.1 찜 완료 = `CLICK` / `ATTRACTION` / targetKey (섹션 `FAVORITE`)
- `spec.md:32` SR-3.3 「같은 viewId 안 같은 관광지의 같은 action 은 **기존 중복 제거 규칙대로** 한 번만」
- `spec.md:49` SR-7.2 eventId = `viewId:entityType:entityId:action`

코드:
- `portal-fe/src/analytics/tracker.ts:23-25` 키 = `viewId|entityType|entityId|action` — **sectionId 가 없다**. `:29-31` 두 번째는 `seen` 에 걸려 큐에 들어가지도 않는다.
- `analytics/.../EventCollectDtos.kt:58-59` 서버 eventId 도 같은 네 축 — SR-7.2 대로 고쳐도 세 행동의 id 가 같다.
- `portal-fe/src/pages/place/PlacePage.tsx:1317-1324` 지도 링크는 **선택 패널 안**에 있다 → 지도 링크를 누르려면 반드시 먼저 카드(`:1201`) 또는 핀(`:603`, `:727`)을 선택해야 한다 → 그 시점에 `viewId|ATTRACTION|id|CLICK` 이 이미 `seen` 에 있다.
- `PlacePage.tsx:1304`(패널 찜), `:1368`(카드 찜) 도 같은 키.

문서:
- `docs/adr/ADR-0095-impression-click-pipeline.md:83` 「같은 view_id + entity_id 는 노출 1회로 센다」 — 중복 규칙이 ADR 결정이다.
- `s1-12-instrumentation.md:101-103` 이 이미 경고했다: 「같은 대상을 여러 섹션에서 눌러도 섹션별로 다시 기록하지 않는다 … section 을 넣어도 이미 FE 에서 사라진 다른 섹션 클릭은 복구되지 않는다」. 스펙이 이 경고를 받지 않았다.

결과: 주 경로(선택 → 지도 열기 / 선택 → 찜)에서 `directions_clicked` 와 `save_completed` 가 **구조적으로 0** 에 가깝게 샌다. 반대 순서(카드 찜 → 카드 선택)면 `result_clicked` 가 샌다. `requirements.md:37` 의 기준선 질의 `uniqExact(tuple(view_id, entity_type, entity_id, action))` 는 세 분자를 가를 수 없고, `section_id` 를 질의에 넣어도 행이 없다. 운영자 스토리(`spec.md:10`)가 성립하지 않는다.

사람 판단이 필요한 선택지:
- (a) FE 키(`tracker.ts:23-25`)와 서버 eventId(SR-7.2)에 `sectionId` 를 넣고 ADR-0095 §3 을 「같은 view_id + entity_id + **section_id**」로 한 줄 개정. 상세 화면에서 같은 관광지가 두 섹션에 보이면 노출이 2건이 된다 — ADR-0095:70 「CTR 은 지면마다 다른 수치」와 오히려 맞고, 인기 일 집계는 `countIf`(`ClickHouseAttractionPopularityAdapter.kt:55-57`)라 중복 제거 집계가 아니어서 영향 없음. 가장 단순.
- (b) `MAP_LINK`·`FAVORITE` 섹션에만 키를 확장 — 규칙이 둘이 된다.
- (c) 범위 축소 — 허브의 지도 열기·찜은 이번에 세지 않는다고 명시하고 S3-6a 로 넘긴다. 그러면 S1-12 완료 조건(`plan:68`)을 못 채운다.

어느 쪽이든 추가로 적을 것: 찜 on → off 를 같은 view 에서 하면 둘째(`saved:false`)는 어느 선택지에서도 버려진다. 「찜 완료 = `saved:true` 만 센다」를 명시하거나 키에 `saved` 를 넣는다. `test-quality.md` 에 「카드 선택 → 지도 링크 → 찜 순서로 세 건이 전송된다」 시나리오를 추가한다(지금 `:5-6` 에는 각 행동이 따로만 있다).

#### R1 (체크 2·5) — 첫 진입의 숨은 전국 질의와 첫 SEARCH 의 `trigger` 가 정의되지 않았다

- `PlacePage.tsx:308-321` `useQuery` 에 `enabled` 가 없다 → 마운트 즉시 `sidoCode` 없는 전국 질의가 나간다. `:417` `pickingRegion` 은 `sidoRegions` 가 온 뒤에야 참이라 그 전에는 목록도 그려진다. `:449-469` 자동 시도 선택이 **두 번째** 질의를 만든다.
- `spec.md:25` `initial` 은 「첫 진입 자동 시도 선택」만 가리키고, 「직전 조건과 비교」할 직전 조건이 없는 첫 질의의 `trigger`·`changed` 는 미정.
- 결과: 입장마다 사용자 조작 0 으로 SEARCH 가 1~2건 쌓여 `search_submitted` 분모가 부푼다 — [[gate-failure-modes]] ①.
- 수정안: 첫 질의(직전 조건 없음)는 `trigger: 'landing'`(또는 `initial` 로 합치고 자동 선택을 `changed` 로 구분)로 고정하고, 기준선 질의에서 `landing`·`initial`·`page` 를 분모에서 빼는 규칙을 R2 표에 적는다. 결과를 사용자가 못 본 질의(`pickingRegion` 참)는 보내지 않는 쪽이 더 단순하다.

#### R2 (체크 3) — 기준선 질의와 분모가 스펙에 없다

- `spec.md:10` 「ClickHouse 한 질의로 보고 싶다」, `spec.md:59` 는 「action·section 별로 센다」까지. `uniqExact` 는 `requirements.md:37` 에만 있고 스펙 본문에 없다. `s1-12-instrumentation.md:88-97` 분모 표가 스펙으로 이어지지 않았다.
- `plan:68` S1-12 완료 조건이 「같은 정의로 기준선이 잡혀 있음」이라 **정의 자체가 이 스펙의 산출물**이어야 한다. 2단계 뒤에 질의를 정하면 전후 정의가 달라진다.
- 수정안: SR-10 「기준선 정의」 표를 추가한다. 전부 `screen_type='PLACE_HUB'`, `visitor_id != 'anonymous'`, `payload` 는 `String` 컬럼(`V005__events_two_axis.sql:40`)이라 `JSONExtract*` 로 읽는다.
  - 허브 세션: `uniqExact(session_id)` where `action='SESSION_START' AND entity_id='place-hub'`
  - 검색 제출: `uniqExact(view_id)` where `action='SEARCH' AND JSONExtractString(payload,'trigger') IN ('submit','suggestion','nearMe','area')`
  - 필터 적용: 같은 식, `trigger IN ('region','category','attribute','eventStatus','overlay')`
  - 결과 선택: `uniqExact((view_id, entity_id))` where `action='CLICK' AND section_id='ATTRACTION_LIST'`
  - 찜 완료: 같은 식, `section_id='FAVORITE' AND JSONExtractBool(payload,'saved')`
  - 지도 열기: 같은 식, `section_id='MAP_LINK'`
  - 비율: 세션당 검색 · 검색당 선택 · 선택당 지도/찜. 상세 화면(`ATTRACTION_DETAIL`)의 찜·지도 행은 세션 분모가 없음을 명시(Q3 가 「허브를 연 세션」으로 닫혔으므로).

#### R3 (체크 1) — 필수 6종 대응표가 없다: `collection_shared` 가 범위 밖에 없고, `directions_clicked` ≠ 지도 열기가 명시되지 않았다

- `plan:68` S1-12 와 `s1-12-instrumentation.md:77-84` 의 6종은 search_submitted · filter_applied · result_clicked · save_completed · **collection_shared** · **directions_clicked**. `spec.md:6` 은 「여섯 행동」에 세션 시작을 넣어 숫자를 맞췄고, `spec.md:70-75` Out of Scope 에 `collection_shared` 가 없다.
- `spec.md:35` payload `kind: google_maps_search` 로 암시만 한다. `s1-12:84` 는 「지도 열기와 경로 안내 의도를 분리」를 요구했다.
- 수정안: Out of Scope 에 두 줄 — 「`collection_shared`: 공유 기능 없음(`plan:93` S3-4b 뒤 `plan:95` S3-6a)」, 「`directions_clicked`: 이번 `CLICK`/`MAP_LINK` 는 지도 열기이며 길찾기 개시는 S3-6a」. Goal 의 「여섯 행동」 문구를 「필수 6종 중 4종 + 세션 시작 + 지도 열기」로 바로잡는다.

#### R4 (체크 2) — 예외 흐름 셋이 비어 있다

- 검색 실패: `spec.md:23` 은 「결과가 도착하면」만. `PlacePage.tsx:315-320` retry 3 뒤 `isError` 면 SEARCH 가 없다 → 실패한 제출은 분모에서 사라진다. 보내지 않는다면 그렇게 적고(`s1-12:79` 「제출/완료/실패 구분」을 의도적으로 접는다고), 보낸다면 `payload.failed: true` 로.
- 수정키·가운데 클릭: `PlacePage.tsx:1349` 는 수정키면 early return 해 실주소로 이동한다(새 탭에서 상세 열기). 이것도 결과 선택인데 `spec.md:30` 은 「좌클릭(패널 열기)」만 센다. `track` 을 early return **앞**에 두고 `payload.newTab: true` 로 구분한다(RegionPage 의 `TrackedLink.tsx:26` 은 모든 onClick 을 센다).
- 자동완성으로 열리는 패널: `PlacePage.tsx:848` `pickSuggestion` 이 `setSelectedId` 를 직접 부른다 → 패널이 열리지만 CLICK 이 없다. 결과 선택이 아니라는 뜻이면 명시한다(`trigger: 'suggestion'` SEARCH 만 남는다).

#### R5 (체크 5) — 모바일 무한 스크롤에서 `page` 변경이 새 viewId 를 만든다

- `spec.md:17` 「query 가 바뀔 때마다 새 viewId」. `query` 에 `page` 가 들어 있다(`PlacePage.tsx:302-305`). 모바일은 `:323-335` 로 카드를 누적하므로 1쪽 카드의 노출(viewId₁)과 그 카드의 클릭(2쪽 도착 뒤면 viewId₂)이 다른 view 에 놓인다. `useImpression.ts:30-37` 은 최신 viewId 를 쓰되 이미 기록한 카드는 재관찰하지 않는다.
- 결과: 노출↔클릭 짝으로 CTR 을 내면 모바일에서 분자가 샌다. `trigger: 'page'` SEARCH 가 검색 제출 분모에 들어갈 수 있다.
- 수정안: R2 표에서 `page` 를 분모에서 빼고, 「이번 기준선은 view 단위 CTR 을 쓰지 않는다(일 집계 `countIf` 와 같은 단위)」를 적는다. 짝을 지키고 싶으면 모바일 viewId 를 `baseKey`(page 제외, `:326`) 기준으로 두되, 그러면 `page` SEARCH 가 `viewId|SEARCH|키워드|SEARCH` 중복 키에 걸려 버려지므로 entityId 또는 키에 page 를 더해야 한다 — 이번에는 제외 규칙만이 단순하다.

### 사용자 행동 불변 확인 (1R, 파괴 없음)

- 카드: `PlacePage.tsx:1348-1352` preventDefault + onSelect 유지, track 만 앞에 붙는다.
- 지도 링크: `spec.md:36` 명시. `<a target="_blank" rel="noreferrer">`(`:1317-1324`, `AttractionPage.tsx:507-514`) 기본 동작 유지.
- 찜: `FavoriteButton.tsx:53-63` 에 선택 prop 추가, `useFavorites.ts:28-48` 에는 지금 `onSuccess` 가 없다 → 낙관 반전·롤백 경로 불변.
- `installFlushOnLeave`(`tracker.ts:94-106`)는 리스너만 건다.
- 서버: beacon 은 **지금도** 본문에 `visitorId`·`sessionId` 를 싣고 있고(`tracker.ts:65-69`) 서버가 무시해 왔다(`EventCollectDtos.kt:20-23`) → 필드 추가는 호환. 크롤러 거부·100건 상한 불변(`EventCollectController.kt:45-47`, `EventCollectDtos.kt:22-27`).
- 검증 절차 SR-9.3(`spec.md:59`)은 [[hybrid-search-local-embedding]] 의 세 단계(보냈다·accepted·행이 있다)를 모두 포함한다. 헤드리스 UA 는 `CrawlerUserAgents.kt:28` 에 걸리므로 「일반 Chrome UA」 조건이 맞다.

### 메모 (1R, 판정에 넣지 않음)

- SR-2.5 `*` 키워드는 `keyword_scores` 에 `*` 행을 만든다. 읽는 FE 가 없어(grep 0건) 지금은 무해하나 Streams 키워드 지표 오염 여부를 한 줄 적어 두면 좋다.
- SR-2.1 SEARCH 의 `screenRef`(지역 코드)와 SR-3.1 CLICK 의 `screenRef`(검색어 우선)가 같은 화면에서 다른 규칙이다. 한쪽으로 맞추면 조인 없이 읽힌다.
- 테스트 패턴 경로는 `portal-fe/src/pages/place/__tests__/RegionPage.test.tsx:13-16`(스펙 `:13-19` 표기).

1라운드 판정: BLOCK

---

VERDICT: SHIP
