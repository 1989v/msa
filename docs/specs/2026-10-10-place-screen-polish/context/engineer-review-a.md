# Engineer Review A — architecture · implementation · security (+ FE 접근성)

대상: `docs/specs/2026-10-10-place-screen-polish/spec.md` · `tasks.md` · `context/open-questions.yml`
근거 트리: 워크트리 `wt-impl` (읽기 전용). 표준: DESIGN.md §12, `docs/conventions/frontend-design.md`, `docs/design/k-heritage.html`, `docs/standards/fe-visual-verification.md`.

| 관점 | 판정 | 이슈 수 |
|---|---|---|
| architecture | REVISE | 3 |
| implementation | REVISE | 9 |
| FE 접근성·대비 | REVISE | 6 |
| security | SHIP | 0 |

---

## 1. Architecture — REVISE

**A1 (REVISE) 문서 동기화 대상이 스펙에 없다.** 동작이 바뀌는데 설명이 옛 상태로 남는 곳:
- `search/glossary.md:95` 「행동 줄 — 방문 요약(배지 줄) **다음** 줄」 → SR-6 뒤에는 거짓이다.
- `AttractionPageRenderer.kt:424-428` KDoc 「제목 → 방문 요약 → 배지 줄 → 행동 줄」.
- `RegionSheet.tsx:6-13` 「모바일 <900px 전용」, RegionDrilldown 참조(`:9`,`:12`,`:120`).
- `PlacePage.tsx:686-687`(RegionDrilldown 캐시 키), `:1546`·`:1550`(「좁은 화면」 필터 한 줄), `:1707`, `:1947-1950`(FilterSheetFrame 「넓은 화면은 툴바에 그대로」).
- `AttractionPage.test.tsx:1317` 주석 「길찾기는 요약 아래로 옮겼다」.
- `docs/design/k-heritage.html:73`(`.label`)·`:230`(`footer .mark`)이 황토 원색을 글씨에 쓴다. SR-5.1 이 시트 라벨을 `--kh-ocher-text` 로 바꾸면 견본과 코드가 갈린다. CLAUDE.md 「규칙을 바꿨으면 이 문서도 같이 고친다」.

수정안: SR-9 「문서 동기화」를 추가하고 위 목록을 그대로 둔다. 견본은 `--ocher-text: #8a6346`(다크는 원색)을 정의해 `.label`·`.mark` 에 쓴다. DESIGN.md:345-348 이 이미 그 규칙이므로 견본만 늦은 상태다.

**A2 (MINOR) `FilterSheetFrame` 이 바뀐 뒤 얕은 래퍼가 된다(Deletion Test).** 지금은 `mobile` 분기가 있어 쓸모가 있다(`PlacePage.tsx:1964`). SR-1.3 뒤에는 `if (!open) return null` + `className` 고르기뿐이고 호출자는 하나(`:1594`)다. 지우면 복잡도가 그 한 곳으로 모인다. 수정안: `RegionSheet` 와 같은 꼴로 `{filterSheetOpen && <KhSheet … className={isMobile ? 'place-filter-sheet' : 'place-filter-sheet kh-sheet--dialog'}>}` 를 인라인하고 함수를 지운다. 남기려면 이유를 SR-1.3 에 한 줄 적는다.

**A3 (MINOR) ADR 불요 판단은 맞다.** ADR-0071 §3(`docs/adr/ADR-0071-place-region-drilldown.md:56-71`)은 축·자동 선택·`nearestRegion` 함수 공유만 정하고 칩이냐 시트냐는 정하지 않는다. 다만 「드릴다운 정렬도 같은 함수를 쓴다」(`:69-71`)가 RegionSheet 로 옮겨 가므로 SR-2.3 에 「`googleMaps.ts:129` `nearestRegion` 을 그대로 import, 사본 금지」를 명시한다.

## 2. Implementation — REVISE

**I1 (REVISE) SR-1.4 의 이동 목록에 `.place-filter-sheet-body` 가 빠졌다.** `PlacePage.css:1054-1058`(세로 flex · gap 0.75rem)이 좁은 화면 미디어 쿼리(`:945`) 안에 있다. 넓은 화면 다이얼로그에서 분류 묶음 · 행사 상태 · 속성 묶음이 간격 없이 붙는다. 수정안: 이동 목록을 `.place-filter-bar`, `.place-filter-row`(+`.place-filter-row .place-region-trigger` `:1027`, `.place-filter-row > …` `:1033`), `.place-filter-open`, `.place-filter-summary`, `.place-filter-sheet-body` 로 고친다. `:1060-1068`(가로 스크롤 해제)은 좁은 화면 전용이라 그대로 둔다.

**I2 (REVISE) 넓은 화면 지역 트리거가 한 줄 전체로 늘어난다.** `.place-region-trigger` 는 `width: 100%`(`:1750`)이고 `.place-filter-row .place-region-trigger` 는 `flex: 1 1 auto`(`:1028`)다. 1440 에서 트리거가 1000px 넘게 늘고 칩·「필터」는 오른쪽 끝으로 밀린다. 수정안: 넓은 화면에서 `.place-filter-bar` 에 `.place-search` 와 같은 `max-width: 40rem`(`:96`)을 준다. 또는 `@media (min-width: 900px)` 에서 트리거를 `flex: 0 1 16rem` 으로 둔다.

**I3 (REVISE) 드릴다운 삭제 — 「드릴다운에만 쓰던 선택자」를 스펙에 못박는다.** grep 결과:
- 지워도 되는 것: `.place-region`(`PlacePage.css:1658`), `.place-region-sep`(`:1671`), `.place-chip.active .place-region-count`(`:1687`). `.place-region-near`(`:1692`)는 I4 를 받으면 남긴다.
- **남겨야 하는 것**(다른 사용처 있음): `.place-region-crumbs` — `GuidePage.tsx:45`, `GuideIndexPage.tsx:26`, `RegionPage.tsx:188` / `.place-region-list` — `RegionPage.tsx:222` / `.place-region-count` — `RegionSheet.tsx:87,115,132`, `RegionPage.tsx:226` / `.place-region-hint` — `PlacePage.tsx:1746`, `RegionSheet.tsx:62`.
- `RegionDrilldown` 파일 사용처는 `PlacePage.tsx:31,1709` 뿐이다. `nearestRegion` 은 `PlacePage.tsx:810` 과 `googleMaps.test.ts` 가 계속 쓴다. 파일을 지워도 된다. `docs/doc-index*.json` 에도 참조가 없다.
- 수정안: SR-2.4 에 위 두 목록을 그대로 둔다. 「같은 grep」만 적으면 `place-region` 접두어가 `-crumbs`·`-list` 까지 걸려 지울 위험이 있다.

**I4 (REVISE) 정렬만 옮기면 「현재 위치」 표시가 사라진다.** 드릴다운은 가까운 시도 칩에 `L.near`(「현재 위치」/「Near you」) 배지를 붙인다(`RegionDrilldown.tsx:104`, CSS `:1691-1699`). 이 배지가 없으면 시도 목록 맨 앞에 경기가 오는 이유가 화면에 없어서, 순서가 깨진 것으로 읽힌다. 수정안: SR-2.3 을 「정렬 + 첫 행 `place-region-near` 배지(문구 그대로)」로 넓힌다. SR-7.1 단언에 배지 텍스트를 더한다. 비용은 UI 문구 두 개와 CSS 한 블록 유지뿐이다.

**I5 (REVISE) 영향받는 기존 테스트 목록이 3개 파일보다 넓다.** 넓은 화면(`matches:false`)에서 툴바 칩을 바로 누르는 테스트:
- `PlacePage.relax.test.tsx:126,154,167,170,180,255,258,277,281` — `180`·`255` 는 드릴다운 칩 「종로구」 클릭이라 트리거 → 행으로 **두 단계**가 된다.
- `PlacePage.langSwitch.test.tsx:62,70-78`, `PlaceLanding.test.tsx:217,279`, `PlacePage.tracking.test.tsx:241`, `PlacePage.loginReturn.test.tsx:165`, `PlacePage.test.tsx:92-106,163,341-356`.
- 이름 중복: 다이얼로그가 열리면 「전체」·「자연」·「행사」가 필터 한 줄과 다이얼로그에 하나씩 생긴다. `getByRole('button', { name: '행사' })`(`relax.test.tsx:167,281`), `getByRole(…'자연')`(`:154`)이 다중 일치로 실패한다.
- 수정안: SR-7.1 · tasks 2.1 의 「기존 테스트 파일」에 위 7개 파일을 적는다. 다이얼로그 안 칩은 `within(getByRole('dialog', { name: '필터' }))` 로 찾는다. 다이얼로그는 aria-modal 인데 jsdom 은 뒤 요소 클릭을 막지 않는다. 그래서 relax 패널 버튼을 누르기 전에 Escape 로 닫는 단계도 넣어 실제 사용 흐름과 맞춘다. 「바뀌는 것은 한 단계뿐」이라는 문장은 지역(두 단계)에서 거짓이므로 고친다.

**I6 (REVISE) SR-6 · SR-7 의 코드 앵커가 틀렸다.**
- FE 순서 테스트는 `AttractionPage.test.tsx:149-168` 이 아니다. 이 블록은 actions 를 보지 않는다. 실제 순서 단언은 `:1296-1319`(`visit-summary → visit-badges → actions` 기대)다.
- SSR `:568`·`:605` 는 함수 정의 줄이다. 순서를 정하는 호출부는 `AttractionPageRenderer.kt:445-450` 이다. 수정은 `:450` 의 `append(actions(…))` 를 `:445`(`val typed`) 앞으로 올리는 것이다.
- 수정안: 앵커를 위로 바꾼다. 행동 줄의 정확한 자리를 「전화 줄(FE `AttractionPage.tsx:394`, SSR `:444`) 다음, 방문 요약 앞」으로 적는다. 스펙 문장 「제목(h1)·찜 → 행동 줄」은 분류·전화 줄을 빼먹어 구현자가 그 둘 위로 올릴 수 있다.

**I7 (MINOR) 렌더 골든 diff 기대를 파일 단위로 좁힌다.** 유형별 절이 있는 문서(행사·숙박·코스)는 `typed != null` 이라 방문 요약을 내지 않는다(`:446-449`). 그래서 행동 줄의 상대 위치가 그대로다. diff 는 `golden/attraction-ko.html`·`attraction-en.html`·`attraction-http-image-ko.html` 세 파일에만 나와야 하고, event·stay·course 9개는 바이트가 그대로여야 한다. `AttractionPageRendererTest.kt:703`(숙박 순서)도 그대로 초록이어야 한다. SR-6.2 에 이 기준을 적어 게이트로 쓴다.

**I8 (MINOR) SR-4.4 는 정적으로 결론이 난다.** `.place-btn:disabled`(`PlacePage.css:143`)와 `.place-btn.primary`(`:148`)는 둘 다 (0,2,0)이고 primary 가 뒤에 있어 primary 글자색이 이긴다. 다섯 사용처(`PlacePage.tsx:1496,1872,1905,2022`, `RegionPage.tsx:237`) 중 `disabled` 를 받는 곳은 없다. 수정안: 「비활성 primary 없음 — 측정 불요」로 바꾼다. 실측 항목 하나가 줄어든다.

**I9 (MINOR) 시군구 질의 조건·주석.** `PlacePage.tsx:691` `enabled: sidoCode != null && (isMobile || sigunguCode != null)` 는 「모바일 시트가 곧 쓸 목록」을 미리 받는 조건이다. 넓은 화면도 시트를 쓰게 되면 `isMobile` 항은 의미를 잃는다. 동작은 맞다. 시트가 열릴 때 RegionSheet 자신이 같은 키로 받는다(`RegionSheet.tsx:46-51`). 수정안: 조건을 `sigunguCode != null` 로 줄이거나 그대로 두고 주석(`:686-687`)만 고친다. 둘 중 하나를 스펙에 적는다.

## 3. FE 접근성·대비 — REVISE

**F1 (REVISE · 우선) 넓은 화면 필터가 모달이 되는데 KhSheet 에 포커스 가두기·되돌리기가 없다.** `KhSheet.tsx:26-39` 은 열릴 때 패널에 포커스를 주고 Escape 만 듣는다. Tab 순환이 없고, 닫혀 언마운트될 때 트리거로 포커스를 돌려주지 않는다. 지금 넓은 화면의 분류·속성 칩은 툴바 안 인라인이라 Tab 만으로 닿는다. 바뀐 뒤에는 다이얼로그 끝에서 Tab 이 veil 뒤 페이지로 빠지고, 닫으면 포커스가 `body` 로 떨어진다. 데스크톱에서는 키보드가 주 입력이다. `frontend-design.md:249`(논리적 탭 순서) · `:254`(전체 기능 키보드)와 어긋난다. 이미 넓은 화면 다이얼로그로 쓰는 `ServiceExplorer.tsx:51`·`PickSheet.tsx:47` 도 같은 결함을 갖고 있다.
수정안: SR-1 에 「KhSheet — 열 때 `document.activeElement` 를 기억했다가 언마운트 시 복원, 패널 안 첫·끝 포커스 가능 요소 사이 Tab/Shift+Tab 순환」을 넣는다. 공용 컴포넌트라 8개 사용처가 함께 고쳐진다. vitest 단언 셋을 둔다: ①「필터」 클릭 → Tab 반복 시 포커스가 dialog 밖으로 안 나감 ② Escape → 포커스가 「필터」 버튼 ③ 지역 트리거도 같음. 회귀 주입은 복원 줄 삭제로 한다.

**F2 (REVISE) 지역 시트 `onClose` 가 렌더마다 새 함수라 포커스를 뺏는다.** `KhSheet` 효과는 `[onClose]` 에 묶여 있다(`KhSheet.tsx:39`). 허브는 이 이유로 필터 시트 닫기를 `useCallback` 으로 고정했다(`PlacePage.tsx:451-452` 주석). `RegionSheet` 에는 인라인 `() => setRegionSheetOpen(false)`(`:1590`)를 넘긴다. 시트가 떠 있는 동안 허브가 다시 그려지면(질의 응답·패싯 도착) 포커스가 패널로 튄다. 키보드로 행을 고르던 데스크톱 사용자에게는 위치가 사라지는 것과 같다. 수정안: `closeRegionSheet = useCallback(…, [])` 를 SR-2.1 에 넣는다.

**F3 (REVISE) SR-8.2 「필터·지역 시트 안 글자 전부 ≥ 4.5」는 지금 범위로는 통과할 수 없다.**
- `.place-attr-count`(`PlacePage.css:208-214`)는 `--ko-text-muted` 이고 시트 바탕 `--ko-surface-1` 위에 있다. 이 값은 스펙이 고치는 캡션과 같은 4.09:1 이다. 속성 칩마다 하나씩 붙는다.
- `.place-chip.is-empty { opacity: 0.4 }`(`:222-224`)는 누를 수 있는 활성 칩이다(`:220-221` 주석). 그래서 WCAG 비활성 예외에 들지 않고, 대비는 2:1 아래로 떨어진다.
- 수정안: SR-5.3 에 `.place-attr-count` → `--ko-text-secondary` 를 더한다. `.chip.active` 는 이미 `inherit` 다. `.is-empty` 는 사람 판단이 필요하다(Q6 신설). (a) SR-8.2 에서 명시적으로 빼고 보고만 하거나, (b) 투명도 대신 muted 색 + 점선 테두리로 바꿔 글자 4.5 를 지킨다. 권고는 (a)로 이번 범위를 지키고 (b)를 후속으로 두는 것이다.

**F4 (REVISE) 같은 카드 안의 같은 꼴 결함 둘이 범위 밖에 남는다.** Goal 은 「카드 제목」만 재지만, 같은 `.place-card` 안에 아래 둘이 있다.
- `.place-card-meta { color: var(--kh-ocher, …) }`(`PlacePage.css:484-491`, 0.72rem): 황토 원색이 `--ko-surface-1` 위에 있다. 라이트 2.79:1 로 시트 라벨과 같은 값이다.
- `.place-card-addr { color: var(--ko-text-muted) }`(`:493-499`, 0.8rem): 4.09:1 이다. 바로 위 `.place-card-local` 은 같은 이유로 이미 secondary 다(`:474-475`).

둘 다 허브 카드(`PlacePage.tsx:2142,2147`)와 지역 페이지 카드(`RegionPage.tsx:258,260,294`)에 나온다. 수정안: SR-3.3 으로 넣는다. meta 는 `var(--kh-ocher-text, var(--ko-accent-text, var(--ko-accent-primary)))`, addr 는 `var(--ko-text-secondary)` 다. SR-8.2 카드 항목에 meta·addr 대비를 더한다. 다크는 두 값 모두 이미 통과하므로 라이트만 바뀐다.

**F5 (MINOR) SR-5.2 시트 라벨 사용처는 7곳이 아니라 8곳이다.** 허브 모바일 상세 시트 `PlacePage.tsx:1916`(`label={L.attractionLabel}`)이 빠졌다. 전체 목록: `GNB.tsx:132`, `KhTabBar.tsx:95`, `ServiceExplorer.tsx:51`, `PickSheet.tsx:47`, `SpaceSwitcher.tsx:70`, `RegionSheet.tsx:61`, `PlacePage.tsx:1916`, `PlacePage.tsx:1967`. 바탕을 덮는 변형은 없다. `dsp-sheet`(`dispenser.css:158`)는 패딩 변수만 둔다. 그래서 모든 사용처를 `--ko-surface-1` 기준으로 재면 된다.

**F6 (REVISE) 언어 토글 — 활성뿐 아니라 비활성도 라이트에서 미달이다.** `.place-lang-btn { color: var(--ko-text-muted) }`(`PlacePage.css:77`, 0.8rem)가 한지 위에 있다. 토큰 값으로 계산하면 #77767b / #f9f8f2 = **4.23:1** 이다. 활성(`:82-85`)은 다크에서 2.03:1 이다(스펙 Q3). 아래 Q3 판단에 합친다.

## 4. Security — SHIP

화면 구성과 CSS 만 바뀐다. 새 입력·출력·외부 호출·저장이 없다.
- STRIDE: 새 신뢰 경계가 없다. RegionSheet `origin` 은 `geo` 상태(`PlacePage.tsx:1713` 와 같은 출처)를 클라이언트 정렬에만 쓰고 전송하지 않는다. 위치 정보 흐름은 지금과 같다.
- 출력 이스케이프: SSR 은 절 순서만 바뀌고 `actions()` 의 `escapeHtml`(`AttractionPageRenderer.kt:603-604`)이 그대로다. `PickSheet` 문자열 HTML(`PlacePage.tsx:1524-1528`)은 손대지 않는다.
- 측정(SR-8)은 운영에 읽기 GET 만 보내고, 사람 UA 를 쓰는 이유는 원장 필터(계측 오염 방지)다. 보안 영향은 없다.

---

## Q3 판단 — 「분석·계획한 것 모두 진행」 아래에서 범위에 넣는가

사용자 지시는 Q3 답(「승인하면 같은 토큰으로 한 줄씩 고친다」)의 승인으로 읽는다. **둘 다 넣는다.** 다만 바닥글은 조건을 붙인다.

| 대상 | 판단 | 근거 |
|---|---|---|
| `.place-lang-btn.active`(`PlacePage.css:82-85`) | **넣는다** | SR-4 와 같은 결함(청자 위 `--ko-surface-0`)이고 같은 수정이다. place 전용 한 줄이고, 누르는 컨트롤의 글자다 |
| `.place-lang-btn`(비활성, `:77`) | **넣는다**(F6) | 같은 버튼이고, 4.23:1 로 같은 muted 꼴이다 |
| `.site-footer-mark`(`Footer.css:41-43`) | **넣는다 — 조건부** | 글자 「1989V」(`Footer.tsx:33`)는 로고타입이라 WCAG 1.4.3 예외다. 그래도 DESIGN.md:345-348 「황토 글씨는 `--kh-ocher-text`」 규칙에는 어긋난다. 전 호스트 공용 푸터라 영향 범위가 place 밖이다 |

스펙 수정안(그대로 붙여 쓸 문안):

```text
### SR-4 (추가) 5. 언어 토글
`.place-lang-btn.active`(`PlacePage.css:82-85`)의 color 를 `var(--kh-hanji, var(--ko-surface-0))` 로, 비활성 `.place-lang-btn`(`:77`)을 `var(--ko-text-secondary)` 로 바꾼다. 활성은 다크 2.03 → 8.6:1, 비활성은 라이트 4.23 → 8.8:1(계산값)이다. SR-8.2 에 허브 머리띠의 언어 토글 두 상태를 더한다.

### SR-5 (추가) 5. 바닥글 낙관
`.site-footer-mark`(`Footer.css:42`)를 `var(--kh-ocher-text, var(--ko-text-muted))` 로 바꾼다. 바닥글 바탕은 `--ko-surface-0`(한지)이라 라이트 2.89 → 5.0:1 이다(DESIGN.md:347). 「2.79 추정」은 시트 바탕(surface-1) 값이라 고친다. 로고타입이라 WCAG 예외지만 DESIGN.md 의 글씨색 규칙을 따른다. 견본 `docs/design/k-heritage.html:230` 의 `footer .mark` 와 `:73` 의 `.label` 도 같은 값으로 고친다(--ocher-text 변수 추가, 다크는 원색). 전 호스트 공용이므로 SR-8.2 는 place 와 apex `/` 두 화면에서 4조합을 잰다.

### Out of Scope 수정
「언어 토글 … 보고만 한다(Q3)」 문장을 지우고 Q3 status 를 answered(이번 범위 포함)로 바꾼다.
```

tasks.md 반영: 3.2 구현 목록에 언어 토글 두 줄, 바닥글 한 줄, 카드 meta·addr(F4), `.place-attr-count`(F3)를 더한다. 3.3 측정에 apex `/` 바닥글을 더한다. TG2 에 KhSheet 포커스 가두기·복원(F1)과 `closeRegionSheet` 고정(F2)을 넣는다.

---

## 요약 — 고치면 SHIP 이 되는 것

1. 포커스 가두기·복원을 KhSheet 에 넣고, 지역 시트 `onClose` 를 고정한다(F1·F2).
2. CSS 이동 목록에 `.place-filter-sheet-body` 를 넣고, 넓은 화면 트리거 폭을 제한한다(I1·I2).
3. 드릴다운 CSS 의 지울 목록과 남길 목록을 명시하고, 「현재 위치」 배지를 시트로 옮긴다(I3·I4).
4. 영향받는 테스트 7개 파일과 이름 중복 처리를 적고, FE·SSR 앵커를 고친다(I5·I6).
5. 같은 꼴 대비 결함(카드 meta·addr, 속성 건수, 언어 토글, 바닥글)을 범위에 넣고, `.is-empty` 는 Q6 로 판단을 받는다(F3·F4·F6·Q3).
6. 문서 동기화(glossary·KDoc·견본·주석)를 SR-9 로 둔다(A1).

VERDICT: REVISE
