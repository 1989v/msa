# Engineer Review B — test-strategy · domain · usecase

- 대상: `docs/specs/2026-10-10-place-screen-polish/spec.md` · `tasks.md` · `context/open-questions.yml`
- 표준: `docs/standards/test-rules.md`(Kotlin 전용, FE 규칙 없음), `docs/standards/fe-visual-verification.md`
- 근거 코드: 워크트리 `wt-impl` 기준. 읽기만 했다.

| 관점 | 판정 | 이슈 |
|---|---|---|
| test-strategy | REVISE | 8 |
| domain | REVISE | 2 |
| usecase | REVISE | 6 |

---

## test-strategy

체크리스트: AC→테스트 도출 △ · 층 배정 ○(jsdom 이 못 재는 것은 CDP 로 넘김) · 목 경계 ○ · 테스트 데이터 △ · 음성·경계 △ · 명명 ○

### T1 [High] 넓은/좁은 「짝 단언」은 같은 핸들러를 비교하므로 trigger 주입에 빨강이 나지 않는다
- 근거: 두 폭이 같은 `toggleAttribute` 를 탄다(`PlacePage.tsx:633-635`, 호출 `:1692`). 이번 변경의 목적이 바로 같은 코드를 타게 하는 것이다(spec SR-1.1, `spec.md:18`). 그런데 SR-7.3 의 주입 「속성 칩 핸들러의 trigger 를 다른 값으로 → 짝 단언 빨강」(`spec.md:66`)은 두 폭을 **똑같이** 바꾼다. 「넓은 결과 == 좁은 결과」만 보는 단언은 계속 초록이다. 대상이 아니라 자기 사본을 재는 검사다.
- 수정: 짝 단언마다 **절대값**을 고정한다. `track` SEARCH payload 의 `trigger: 'attribute'` · `changed: ['attributes','page']`, `searchAttractions` 인자의 `attributes` 를 고정한다. 분류·행사 상태·지역도 같은 방식이다. 짝 비교는 보조로 둔다. 주입 기록(`regression-injection.md`)에는 **어느 단언이** 빨강을 냈는지 적는다.

### T2 [Medium] 깨질 기존 넓은 화면 테스트가 목록에 없고, 지역은 「한 단계 추가」로 끝나지 않는다
- 근거: `matchMedia` 를 `false` 로 고정하고 인라인 칩을 바로 누르는 파일이 PlacePage.test.tsx 말고도 있다.
  - `PlacePage.relax.test.tsx:80`(matches false) → `:126,154,167,170,258,277,281,304` 칩 클릭·`aria-pressed`, `:180,255` 드릴다운 `종로구` 칩
  - `PlacePage.langSwitch.test.tsx:40` → `:62,70-78` 속성 칩
  - `PlacePage.tracking.test.tsx:56` → `:241` 속성 칩
  - `PlaceLanding.test.tsx:89` → `:217,279` 속성 칩
- spec 은 「바뀌는 것은 시트·다이얼로그를 먼저 연다 한 단계뿐」이라고 한다(`spec.md:57`). 하지만 지역은 드릴다운 칩 한 번(`RegionDrilldown.tsx:96-101`)이 시트의 「트리거 → 시도 행 → 시군구 행」(`RegionSheet.tsx:82,128`) 세 단계가 되고, 요소도 `.place-chip` 에서 `.place-region-row[aria-current]` 로 바뀐다.
- 수정: tasks 2.1 에 위 파일과 파일별 단계 변경을 적는다. 질의·SEARCH 단언은 그대로 두고, 파일별 단언 수를 바꾸기 전·후로 기록해 줄지 않았음을 보인다.

### T3 [Medium] CSS 회귀 주입의 재현 절차가 비어 있다
- 근거: 「주입한 사본 빌드를 SR-8 스크립트로 재서 빨강」(`spec.md:71`), TG3.1 「로컬 프리뷰에 돌려」(`tasks.md:21`). 무엇을 되돌리는지(4줄 중 어느 것), 프리뷰에 카드·시트 데이터가 어디서 오는지(백엔드 없음)가 없다. `#0000ee` 판정은 UA 기본값에 기대고, 방문한 링크면 보라가 나온다.
- 수정: 주입은 하나씩 한다 — `a.place-card` color · `.place-btn.primary` color · `.kh-sheet-label` · `.place-attr-caption`. 데이터가 없으면 같은 클래스 요소를 실제 자리에 넣어 잰다(`fe-visual-verification.md:137-138`, 배경은 `painted()` 합성 `:183-195`). 판정은 `#0000ee` 대신 「카드 제목 색 ≠ `--ko-text-primary`」와 「대비 < 4.5」로 한다.

### T4 [Medium] 대비 측정에 hover·focus 상태와 지역 페이지 카드가 빠져 있다
- 근거: 표준은 상태도 재라고 한다(`fe-visual-verification.md:135-136`). 카드 hover 는 바탕이 `--ko-surface-2` 로 바뀌고(`PlacePage.css:446-448`), primary hover 는 `--ko-accent-primary-hover` 다(`:155-157`). SR-8.2(`spec.md:75-78`)는 기본 상태만 나열한다. SR-3 이 고치는 지역 페이지 링크 카드(`RegionPage.tsx:246,273`)는 측정 목록에 없다.
- 「픽셀 기준」(`spec.md:75`)의 뜻도 정해지지 않았다. 글리프 픽셀은 안티에일리어싱 때문에 대비 판정에 쓸 수 없다.
- 수정: SR-8.2 에 hover 상태(카드·primary 다섯 곳)와 RegionPage 카드를 더한다. 「픽셀 기준」은 「글자색은 계산값, 바탕은 칠해진 층 합성 + 바탕 영역 픽셀 대조. force-dark 는 기기 dark 조합만(`fe-visual-verification.md:89-90`)」으로 정의한다.

### T5 [Medium] 상세 행동 줄(B)의 폴드 측정이 「밀려나는 쪽」을 표본으로 잡지 못한다
- 근거: 표본 10곳은 스펙 D 에서 **길찾기 넘침**을 보려고 고른 것이다(`place-detail-first-screen/verifications/screens.md:14-16`). B 는 모든 레코드의 요금·쉬는 날을 행동 줄 높이만큼 내린다. 재측정 기준으로 쉬는 날 bottom 이 575–664 이던 레코드는 B 이후 넘칠 수 있는데, 그런 레코드는 이 표본에 없다(표본 최댓값은 533, `screens.md:97`).
- 「1줄 약 44px, 줄바꿈하면 약 90px」(`spec.md:53`)은 잰 값이 아니다. 행동 줄에는 지도·길찾기·전화 셋이 있다(`AttractionPage.tsx:413-468`). 전화가 링크가 아니면 원문 `span` 이 `overflow-wrap: anywhere` 로 여러 줄이 될 수 있어(`PlacePage.css:1365-1369`) 90 을 넘을 수 있다.
- 수정: SR-8.3 표에 다음을 더한다.
  - (a) 표본마다 `[data-place-section="actions"]` 높이를 적는다.
  - (b) 요금·쉬는 날·길찾기를 전→후 열로 적는다.
  - (c) 보조 표본을 둔다. API 에서 이용시간+쉬는 날 원문이 긴 순, 그리고 전화 href 가 없는 레코드로 국·영 각 10곳을 골라 390 에서 쉬는 날 bottom 의 전·후를 잰다.
  - 판정: 보조 표본에서 쉬는 날이 넘치면 Q4 로 보고한다.

### T6 [Low] 단언 정의가 모호한 곳
- RegionSheet 의 첫 행은 항상 「전체 지역」이다(`RegionSheet.tsx:66-75`). 「가장 가까운 시도가 첫 행」(`spec.md:60`)은 「첫 시도 행」으로 고친다. 픽스처의 시도에는 `latitude`/`longitude` 가 있어야 한다(`googleMaps.ts:129`).
- `AttractionPage.test.tsx:149-168` 에는 actions 순서 단언이 아예 없다. 「기대 순서를 고친다」(`spec.md:62`)가 아니라 「actions → visit-summary 단언을 더한다」로 쓴다.
- 「렌더 골든 대조 단언 빨강(UPDATE 없이)」(`spec.md:70`)은 무엇을 주입하는지 빠져 있다. 「SSR actions 절을 원래 자리로 되돌리고 골든은 그대로 → 골든 대조·`:206` 순서 단언 둘 다 빨강」으로 적는다.

### T7 [Low] trigger 주입이 「컴파일되는 회귀」라는 조건이 명시돼 있지 않다
- 근거: vitest 는 타입을 검사하지 않는다. trigger 에 없는 문자열을 넣어도 테스트는 돌고 빨강이 난다. 그러나 그 회귀는 `tsc -b` 를 통과하지 못하는 코드라 실제로 일어날 수 없는 회귀다(`spec.md:66`).
- 수정: 주입값은 trigger 유니온의 다른 멤버(예 `'category'`)로 하고, 주입 사본에서 `npx tsc -b` 가 통과하는지도 기록한다.

### T8 [Low] 허브 측정의 상태 재현과 반복 횟수
- 근거: 속성은 URL 에 없다. 프리셋과 복원 상태만 있다(`PlacePage.tsx:390`). 그래서 「속성 2개 건 상태」(`spec.md:74`)를 만드는 방법이 배포 전(인라인 클릭)과 후(다이얼로그 열기·클릭·닫기)에 다르다. layout-shift 합은 실행마다 흔들리는데 반복 횟수와 관찰 창이 정해져 있지 않다.
- 수정: 상태 재현 절차를 전·후 각각 적고, y 는 다이얼로그를 닫은 뒤 잰다고 명시한다. CLS 는 같은 대기(8초)·사람 UA·캐시 상태로 3회 재고 중앙값을 쓴다.

---

## domain

체크리스트: BC 경계 ○(place FE·search SSR 표현 계층만, 의존·스키마·API 불변 `spec.md:5`) · glossary △ · Avoid 동의어 해당 없음 · 코드 용어 일치 ○ · 애그리거트 불변식 ○ · 도메인 이벤트 해당 없음 · 애그리거트 간 참조 해당 없음 · VO/Entity 해당 없음

### D1 [Low → 규칙상 REVISE] place BC 의 glossary 가 없다
- 근거: `docs/context-map.md:16-38` 매핑에 place 가 없고 `place/**/glossary*.md` 도 없다. spec 의 「방문 요약」·「행동 줄」·「속성 칩」·「지도 오버레이」·「지역 트리거」는 코드(`data-place-section="visit-summary"`·`"actions"`, `place-attr-chip`, `OVERLAY_CATEGORIES`, `place-region-trigger`)와 뜻이 맞는다. 정의된 곳이 없을 뿐이다.
- 수정: 이 spec 을 막을 이유는 아니다. 배포 뒤 `/hns:glossary` 로 place 를 context-map 에 올린다.

### D2 [Low] Q2 의 ADR 인용이 실제 ADR 과 다르다
- 근거: Q2 는 「자동 선택은 하지 않는 규칙(ADR-0071 §3)」이라고 한다(`open-questions.yml:11`). 그런데 ADR-0071 §3 은 첫 진입에 시도를 **한 번 자동 선택**하라고 정한다(`ADR-0071-place-region-drilldown.md:60,67-68`). 이 동작은 `PlacePage.tsx:810` 에 구현돼 있다. 「정렬만 바꾸고 고르지 않는다」는 드릴다운 쪽 규칙이다(`RegionDrilldown.tsx:11-12`). ADR 이 이 spec 에 요구하는 것은 「정렬도 같은 함수(`nearestRegion`)를 쓴다」(`ADR:69-71`)다.
- 수정: Q2·SR-2.3 의 근거를 다음과 같이 고친다. 「시트 정렬은 `nearestRegion` 으로(ADR-0071 §3). 시트는 선택을 바꾸지 않는다(드릴다운 규칙 승계). 첫 진입 한 번 자동 선택(`:810`)은 그대로다」. 관광 분류만 세는 건수 계약은 RegionSheet 도 같다(`RegionSheet.tsx:11-12`). 불변식은 지켜진다.

---

## usecase

체크리스트: 행위자·목표 ○(`spec.md:10-13`) · 주/대안/예외 흐름 △ · 선·후조건 △ · AC 추적 △ · 경계 확장 △ · 테스트 매핑 ○(SR-7·SR-8)

### U1 [Medium] 데스크톱 필터 흐름의 대가가 수치로 적혀 있지 않다 — 첫 화면은 나아지지만 조작은 늘어난다
현재 코드에서 센 클릭 수다(닫기 포함). 전은 인라인 칩(`PlacePage.tsx:1594-1716`, 넓은 화면은 `FilterSheetFrame` 이 children 을 바로 그림 `:1964`), 후는 spec 의 다이얼로그다.

| 작업 | 전 | 후 |
|---|---|---|
| 핵심 분류(전체·자연·행사) | 1 | 1 |
| 그 밖의 분류 | 1 | 3 (열기·칩·닫기) |
| 속성 칩 k개 | k (건수가 늘 보임) | k+2 |
| 행사 상태 | 2 | 4 |
| 지도 오버레이 | 1 (지도에서 바로 확인) | 3, 확인은 닫은 뒤 |
| 시도 선택 | 1 (`RegionDrilldown.tsx:96-101` 즉시 적용) | 3 (트리거·시도 행은 탐색만 `RegionSheet.tsx:82`·「○○ 전체」) |
| 시군구 선택 | 2 | 3 |

- 다이얼로그 뒤의 veil 은 62% 먹빛에 `blur(24px)` 다(`kh-shell.css:122-133`). 칩을 누르는 동안 목록과 지도 반응이 보이지 않는다. 오버레이는 「값만 바꾸고 시트를 열어 둔다」(`spec.md:20`)라서, 넓은 화면에서는 결과를 확인할 수단이 닫기뿐이다.
- 쓰임새는 데스크톱만 따로 볼 수 없다. SEARCH payload 에 기기 구분이 없다(`PlacePage.tsx:563-586`).
- 수정:
  - (a) 위 표를 spec 에 넣고 「첫 카드 y 를 위해 이 비용을 받아들인다」를 결정으로 적는다(Q1 은 분류만 다룬다, `open-questions.yml:6`).
  - (b) 넓은 화면 오버레이는 켜는 순간 다이얼로그를 닫게 한다. 좁은 화면 listFirst 규칙(`PlacePage.tsx:457-463`)과 같은 모양이다. 아니면 열어 두는 이유를 적는다.

### U2 [Medium] 「현재 위치」 표시가 사라진다 — Q2 의 「기능을 잃지 않게」와 어긋난다
- 근거: 드릴다운은 가까운 시도 칩에 「현재 위치 / Near you」 표시를 단다(`RegionDrilldown.tsx:15-16,104`, CSS `PlacePage.css:1691-1699`). SR-2.3 은 정렬만 옮기고(`spec.md:27`), SR-2.4 는 드릴다운 전용 선택자를 지운다(`spec.md:28`). 그러면 `.place-region-near` 가 함께 지워진다. 표시 없이 순서만 바뀌면 왜 그 시도가 맨 앞인지 알 수 없다.
- 수정: 표시와 CSS 를 RegionSheet 로 함께 옮긴다. SR-7.1 에 「가까운 시도 행에 현재 위치 표시가 있다」 단언을 더한다.

### U3 [Medium] Goal 의 「시트 글자 4.5:1 이상」은 이대로면 반드시 미충족이다
- 근거: Goal 은 시트 글자가 4조합 모두 4.5 이상이라고 한다(`spec.md:8`). 그런데 시트 안 속성 건수 `.place-attr-count` 는 `--ko-text-muted` 다(`PlacePage.css:208-214`). 이번에 고치는 caption 과 같은 4.09 짝이다(`spec.md:43`). 0건 칩 `.place-chip.is-empty` 는 `opacity: 0.4` 인데 누를 수 있는 칩이다(`PlacePage.css:220-224`). SR-5.4 는 「고치지 않은 것은 보고」(`spec.md:44`)라서 AC 와 범위가 서로 다르다.
- 수정: `.place-attr-count` 를 SR-5.3 에 넣어 secondary 로 바꾼다(한 줄, 같은 근거). is-empty 는 예외로 둘지 고칠지 정해 Goal 문장과 맞춘다.

### U4 [Low] 데스크톱 다이얼로그 본문 규칙이 좁은 화면 미디어 쿼리 안에 남는다
- 근거: SR-1.4 는 네 선택자만 밖으로 옮긴다(`spec.md:21`). 그런데 시트 본문 배치 `.place-filter-sheet-body`(세로·간격)와 `.place-filter-sheet .place-filters/.place-attr-chips` 접기 해제도 `@media (max-width: 899.98px)` 안에 있다(`PlacePage.css:1054-1068`). 넓은 화면 다이얼로그(최대 폭 440px, `kh-shell.css:153-160`)에서는 이 규칙이 빠진다.
- 수정: 이 두 블록도 옮길 목록에 넣는다. SR-8 에 「1440 다이얼로그에 가로 넘침이 없다(scrollWidth ≤ clientWidth)」를 더한다.

### U5 [Low] 키보드 사용자의 닫힌 뒤 상태가 정해져 있지 않다
- 근거: KhSheet 는 열 때 패널로 포커스를 옮기지만 닫을 때 트리거로 돌려주지 않는다(`KhSheet.tsx:26-39`). 넓은 화면에서는 지금까지 칩이 인라인이라 이 문제가 없었다.
- 수정: 후조건을 「닫으면 포커스가 「필터 N」·지역 트리거로 돌아간다」로 적거나, 이번에는 받아들인다고 적는다. KhSheet 는 공용이라 고치면 영향 범위가 SR-5.2 사용처 전부다.

### U6 [Low] 결과를 미리 알 수 있는 「확인」 항목과 계측 목록 누락
- SR-4.4(`spec.md:38`) 는 계산하면 답이 나온다. `.place-btn:disabled`(`PlacePage.css:143`)와 `.place-btn.primary`(`:148`)는 명시도가 (0,2,0) 으로 같고 primary 가 뒤에 있으니 primary 가 이긴다. 그리고 지금 비활성이 되는 primary 는 없다(`PlacePage.tsx:1496,1872,1905,2022`, `RegionPage.tsx:237`). 기대 결과를 적거나 항목을 뺀다.
- SR-6.4 는 행동 줄 계측을 「MAP_LINK·전화」로 적었다(`spec.md:54`). 실제 행동 줄에는 길찾기 `DIRECTIONS` 도 있다(`AttractionPage.tsx:451`). 목록에 더한다.

---

## 요청 질문에 대한 답

1. **jsdom 으로 못 재는 완료 조건이 CDP 로 정의돼 있는가** — 대체로 그렇다. 첫 카드 y(SR-8.1), 4조합 대비(SR-8.2), 폴드 10곳×2폭(SR-8.3), 번들 최신 확인(SR-8.4)이 있다. 다만 다음이 빠져 있다(T4·T5·T8).
   - hover 상태와 RegionPage 카드
   - 「픽셀 기준」의 정의
   - 속성 2개 상태를 만드는 방법과 CLS 반복 횟수
   - 행동 줄 높이와 쉬는 날 전·후 표
2. **회귀 주입이 컴파일되는 회귀로 빨강을 내는가** — 다섯 가지 중 넷은 그렇다. 속성 trigger 주입은 짝 단언만으로는 빨강이 나지 않는다(T1). 유니온 멤버 조건도 빠져 있다(T7). CSS 주입은 절차가 없다(T3).
3. **데스크톱 필터 흐름이 나아지는가** — 첫 화면(y 438 → ≤320 목표)은 나아진다. 조작은 핵심 분류 셋을 빼면 전부 늘어난다. 지역 1→3, 속성 k→k+2, 오버레이는 결과를 보려면 닫아야 한다. spec 에 이 대가가 적혀 있지 않다(U1). 「현재 위치」 표시도 사라진다(U2).
4. **행동 줄을 위로 올렸을 때 요금·쉬는 날 폴드 위험** — 기존 10곳으로는 「길찾기가 들어오는지」만 확인할 수 있고, 「쉬는 날이 밀려 나가는지」는 확인할 수 없다. 행동 줄 높이 44/90 도 잰 값이 아니다. 행동 줄 높이 기록, 전→후 표, 쉬는 날이 긴 레코드로 된 보조 표본이 필요하다(T5).

VERDICT: REVISE
