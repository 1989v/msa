# 스펙 리뷰 판정 — place 화면 다듬기

- **대상**: `docs/specs/2026-10-10-place-screen-polish/spec.md` · `tasks.md` · `open-questions.yml`
- **입력**: `context/engineer-review-a.md`(A·I·F·Q3), `context/engineer-review-b.md`(T·D·U)
- **등급 매핑**: 리뷰 B의 High·Medium은 REVISE로, Low는 MINOR로 옮겼습니다.
- **중복 발견**: 양쪽 리뷰가 같은 문제를 짚은 경우(I1=U4, I4=U2, I5=T2, F1=U5, F3=U3, I8=U6a)는 둘 다 유지했습니다. 스펙 편집은 한 번만 하면 됩니다.

| id | 원판정 | 심판 | 근거 (직접 확인) | 스펙에 반영할 편집 한 줄 |
|---|---|---|---|---|
| A1 문서 동기화 누락 | REVISE | keep · REVISE | `search/glossary.md:95` "방문 요약(배지 줄) 다음 줄" · `AttractionPageRenderer.kt:424` "제목 → 방문 요약 → 배지 줄 → 행동 줄" · `RegionSheet.tsx:6` "(모바일 <900px 전용)" · `AttractionPage.test.tsx:1317` "길찾기는 요약 아래로 옮겼다" · `k-heritage.html:73,230` `color: var(--ocher)` | SR-9 「문서 동기화」를 추가합니다. 대상은 glossary:95, KDoc:424-428, RegionSheet 주석, PlacePage 주석 4곳, 테스트 주석, k-heritage 견본의 `.label`·`.mark` 입니다. 견본은 Q3·SR-5 결정을 따릅니다. |
| A2 FilterSheetFrame 얕은 래퍼 | MINOR | keep · MINOR | `PlacePage.tsx:1964` `if (!mobile) return <>{children}</>;`. 이 분기가 사라지면 남는 건 open 확인과 className 선택뿐입니다. | SR-1.3에 「인라인하고 함수를 지운다」 또는 「남기는 이유」 중 하나를 적습니다. |
| A3 nearestRegion 사본 금지 명시 | MINOR | keep · MINOR | ADR-0071:69-71 "드릴다운 정렬도 **같은 함수**를 쓴다" | SR-2.3에 「`googleMaps.ts` 의 `nearestRegion` 을 그대로 import, 사본 금지」를 넣습니다. |
| I1 `.place-filter-sheet-body` 이동 누락 | REVISE | keep · REVISE | `PlacePage.css:945` `@media (max-width: 899.98px)` 안에 `:1054` `.place-filter-sheet-body {` 가 있습니다. | SR-1.4 이동 목록에 `.place-filter-row .place-region-trigger`, `.place-filter-row > …`, `.place-filter-sheet-body`, `.place-filter-sheet .place-filters/.place-attr-chips`(U4)를 더합니다. |
| I2 넓은 화면 트리거가 한 줄 전체로 늘어남 | REVISE | keep · REVISE | `PlacePage.css:1750` `width: 100%;` · `:1028` `flex: 1 1 auto;` | SR-1.4에 「넓은 화면에서 필터 바 `max-width: 40rem` 또는 트리거 `flex: 0 1 16rem`」을 정해 적습니다. |
| I3 드릴다운 CSS 지울 것·남길 것 | REVISE | keep · REVISE | grep 결과 `place-region-crumbs`는 RegionPage:188·GuidePage:45·GuideIndexPage:26에서, `-list`는 RegionPage:222, `-count`는 RegionSheet:87,115,132, `-hint`는 PlacePage:1746·RegionSheet:62에서 씁니다. | SR-2.4에 지울 목록(`.place-region`·`-sep`·`.place-chip.active .place-region-count`)과 남길 목록을 그대로 적습니다. |
| I4 「현재 위치」 배지 소실 | REVISE | keep · REVISE | `RegionDrilldown.tsx` `{region.code === nearCode && <span className="place-region-near">{L.near}</span>}` · CSS:1691 | SR-2.3을 「정렬 + 가까운 시도 행에 `place-region-near` 배지(문구 그대로)」로 넓히고, SR-7.1에 배지 단언을 더합니다. |
| I5 영향받는 기존 테스트 7개 파일 | REVISE | keep · REVISE | `relax.test.tsx:80` `matches: false` · `:167` `getByRole('button', { name: '행사' })` · `:180` `/^종로구/` · `tracking:56` · `langSwitch:40` · `PlaceLanding:89` | SR-7.1·tasks 2.1에 7개 파일을 적습니다. 다이얼로그 안 칩은 `within(dialog)`로 찾습니다. 「한 단계뿐」 문구는 지역이 두세 단계가 되므로 고칩니다. |
| I6 FE·SSR 코드 위치 오류 | REVISE | keep · REVISE | `AttractionPage.test.tsx:149-168`에는 actions 단언이 없고, 실제 순서 단언은 `:1296-` 입니다. 순서를 정하는 SSR 호출부는 `:445-450` `append(actions(…))` 입니다. | SR-6.1·SR-7.1의 위치를 `:1296-1319`·`Renderer.kt:445-450`으로 바꾸고, 자리를 「전화 줄 다음, 방문 요약 앞」으로 적습니다. |
| I7 렌더 골든 diff 파일 단위 | MINOR | keep · MINOR | `Renderer.kt:446` `if (typed == null) {`. 유형별 절이 있는 문서는 방문 요약이 없어 상대 위치가 그대로입니다. | SR-6.2에 「diff 는 attraction-ko/en/http-image-ko 세 파일만, event·stay·course 는 바이트 불변」을 적습니다. |
| I8 SR-4.4는 정적으로 결론 | MINOR | keep · MINOR | `PlacePage.css:143` `.place-btn:disabled` → `:148` `.place-btn.primary`. 명시도가 같고 primary가 뒤에 있습니다. disabled를 받는 primary 사용처도 없습니다. | SR-4.4를 「비활성 primary 없음 — 측정 불요」로 바꿉니다. |
| I9 시군구 질의 `isMobile` 조건 | MINOR | keep · MINOR | `PlacePage.tsx:691` `enabled: sidoCode != null && (isMobile \|\| sigunguCode != null)` | SR-2.1에 「조건을 그대로 두고 `:686-687` 주석만 고친다」(권고) 또는 조건 축소 중 하나를 적습니다. |
| F1 KhSheet 포커스 가두기·복원 없음 | REVISE | keep · REVISE | `KhSheet.tsx:27` `panelRef.current?.focus();`. 효과 정리 함수(`:35-38`)에 포커스 복원과 Tab 순환이 없습니다. | SR-1에 「KhSheet: 열 때 activeElement 기억 → 닫을 때 복원, 패널 안 Tab 순환」과 vitest 단언 셋을 넣습니다. 공용 컴포넌트 범위는 사용자 판단 목록 1번입니다. |
| F2 지역 시트 onClose 인라인 | REVISE | keep · REVISE | `PlacePage.tsx:1590` `onClose={() => setRegionSheetOpen(false)}` · `:451` "고정해야 칩을 누른 뒤 포커스가 칩에 남는다" | SR-2.1에 `closeRegionSheet = useCallback(…, [])`을 넣습니다. |
| F3 `.place-attr-count`·`.is-empty` 대비 | REVISE | keep · REVISE | `PlacePage.css:213` `color: var(--ko-text-muted);` · `:222` `.place-chip.is-empty { opacity: 0.4; }` | SR-5.3에 `.place-attr-count` → secondary를 넣습니다. `.is-empty`는 Q6를 새로 만들어 다룹니다(사용자 판단 목록 2번). |
| F4 카드 meta·addr 같은 꼴 결함 | REVISE | keep · REVISE | `PlacePage.css:490` `color: var(--kh-ocher, var(--ko-accent-primary));` · `:495` `.place-card-addr { … var(--ko-text-muted)` | SR-3.3을 추가합니다(meta → `--kh-ocher-text` 폴백, addr → secondary). SR-8.2 카드 항목에 meta·addr를 더합니다(사용자 판단 목록 3번). |
| F5 시트 라벨 사용처 8곳 | MINOR | keep · MINOR | `PlacePage.tsx:1916` `<KhSheet label={L.attractionLabel}`이 목록에 빠져 있습니다. `dsp-sheet`(`dispenser.css:158`)는 패딩 변수만 둡니다. | SR-5.2 목록에 허브 모바일 상세 시트를 더하고, 「바탕을 덮는 변형 없음 → 모두 surface-1 기준」을 적습니다. |
| F6 언어 토글 비활성도 라이트 미달 | REVISE | keep · REVISE | `PlacePage.css:77` `.place-lang-btn` `color: var(--ko-text-muted);`. 4.23:1은 리뷰어 계산값이고, 반증할 근거가 없어 유지합니다. | Q3 결정에 합칩니다(사용자 판단 목록 4번). |
| A-Q3 언어 토글·바닥글 범위 포함 | REVISE | keep · REVISE | `PlacePage.css:82-85` `.place-lang-btn.active … color: var(--ko-surface-0);` · `Footer.css:42` `color: var(--kh-ocher, …)`. 푸터는 바탕 지정이 없어 한지 위이므로 DESIGN.md:347 "2.89:1"이 맞고 스펙의 "2.79 추정"은 틀립니다. | 사용자 판단 목록 4번의 기본값대로 SR-4.5·Out of Scope·Q3 status를 고칩니다. |
| T1 짝 단언이 trigger 주입에 빨강을 못 냄 | High | keep · REVISE | `spec.md:66` "속성 칩 핸들러의 trigger 를 다른 값으로 → 짝 단언 빨강". 두 폭이 같은 `toggleAttribute`를 타서 넓은 화면과 좁은 화면이 같이 바뀝니다. | SR-7.1 짝 단언마다 절대값(`trigger:'attribute'`·`changed`·`attributes` 인자)을 고정하고, 주입 기록에 빨강을 낸 단언 이름을 남깁니다. |
| T2 기존 테스트 목록·지역 단계 | Medium | keep · REVISE | I5와 같습니다. RegionSheet 시도 행은 `onClick={() => setBrowseSido(region.code)}`로 탐색만 합니다. | I5와 함께 반영하고, 파일별 단언 수를 바꾸기 전·후로 기록합니다. |
| T3 CSS 회귀 주입 절차 비어 있음 | Medium | keep · REVISE | `spec.md:71` "주입한 사본 빌드를 SR-8 스크립트로 재서 빨강…`#0000ee`" · `fe-visual-verification.md:137` "같은 클래스의 요소를 DOM 에 넣어 재도 된다" | SR-7.3에 「4줄 하나씩 주입, 데이터 없으면 같은 클래스 요소를 주입해 재기, 판정은 `색 ≠ --ko-text-primary`·대비 < 4.5」를 적습니다. |
| T4 hover·focus 상태와 RegionPage 카드 누락 | Medium | keep · REVISE | `fe-visual-verification.md:135` "hover·focus 등 상태도 잰다" · `spec.md:75`는 「허브 카드 제목」만 적습니다. | SR-8.2에 hover(카드·primary)와 RegionPage 카드를 더하고, 「픽셀 기준」을 「글자 계산값 + 바탕 칠한 층 합성」으로 정의합니다. |
| T5 행동 줄(B)이 밀어내는 쪽 표본 없음 | Medium | keep · REVISE | `screens.md:97` 12933 쉬는 날 533이 표본 최댓값입니다. `spec.md:53` "1줄 약 44px, 줄바꿈하면 약 90px"는 잰 값이 아닙니다. | SR-8.3에 표본별 actions 높이, 전→후 열, 보조 표본(쉬는 날 긴 순·전화 링크 없는 레코드, 국·영 각 10곳)을 더합니다. |
| T6 단언 정의 모호 | Low | keep · MINOR | `RegionSheet.tsx` 첫 `<li>`가 `{L.all}`(전체 지역)입니다. `AttractionPage.test.tsx:149-168`에는 actions 단언이 없습니다. | SR-7.1 「첫 행」을 「첫 시도 행」으로, 「기대 순서를 고친다」를 「단언을 더한다」로 고칩니다. SR-7.3 골든 주입 내용을 명시합니다. |
| T7 trigger 주입이 컴파일되는 회귀여야 함 | Low | keep · MINOR | `spec.md:66`에 주입값 조건이 없습니다. 메모리 규칙 「주입은 컴파일되는 회귀여야」와 맞지 않습니다. | SR-7.3에 「trigger 유니온의 다른 멤버로 주입, 주입 사본 `tsc -b` 통과 기록」을 적습니다. |
| T8 허브 측정 상태 재현·CLS 반복 | Low | keep · MINOR | `spec.md:74` "속성 2개 건 상태"에 재현 절차가 없고, CLS 반복 횟수도 없습니다. 반증할 근거가 없어 유지합니다. | SR-8.1에 전·후 상태 재현 절차, 「y 는 다이얼로그 닫은 뒤」, CLS 3회 중앙값을 적습니다. |
| D1 place glossary 없음 | Low→REVISE | **demote · MINOR** | ⓒ에 해당합니다. 「정의된 곳이 없다」는 사실과 다릅니다. `docs/context-map.md:7`이 `search/glossary.md`를 매핑하고, 그 파일 `:92-95`에 **방문 요약·배지 줄·행동 줄**이 정의돼 있습니다. 미정의는 속성 칩·지도 오버레이·지역 트리거뿐입니다. | 스펙은 고치지 않습니다. 후속으로 남은 세 용어를 glossary에 올립니다. |
| D2 Q2의 ADR 인용 오류 | Low | keep · MINOR | ADR-0071:67 "자동 선택은 **한 번만** 동작한다"인데, Q2는 "자동 선택은 하지 않는 규칙(ADR-0071 §3)"이라고 적었습니다. | Q2·SR-2.3 근거를 「정렬은 `nearestRegion`(ADR-0071 §3), 시트는 선택을 바꾸지 않음(드릴다운 규칙 승계), 첫 진입 자동 선택 1회는 그대로」로 고칩니다. |
| U1 데스크톱 필터 클릭 수 증가 미기재 | Medium | keep · REVISE | `PlacePage.tsx:1964`에서 넓은 화면은 칩이 인라인입니다. `spec.md:20` "넓은 화면의 오버레이 칩은 지금처럼 값만 바꾸고 시트를 열어 둔다" | 클릭 수 전·후 표를 SR-1에 넣고, 「첫 카드 y 를 위해 감수」를 결정으로 적습니다. 오버레이 동작은 사용자 판단 목록 5·6번입니다. |
| U2 「현재 위치」 표시 소실 | Medium | keep · REVISE | I4와 같습니다. CSS:1690 "현재 위치의 시도라는 표시" | I4와 함께 반영합니다. |
| U3 Goal과 SR-5.4 범위 충돌 | Medium | keep · REVISE | `spec.md:8` "시트 글자는 … 4.5:1 이상" vs `:44` "고치지 않은 것이 걸리면 목록으로 보고" | F3 반영 뒤 Goal에 「`.is-empty` 예외(Q6)」를 명시해 AC와 범위를 맞춥니다. |
| U4 다이얼로그 본문 규칙이 미디어 쿼리 안 | Low | keep · MINOR | I1과 같습니다(`PlacePage.css:1054-1068`). | I1과 함께 반영합니다. SR-8에 「1440 다이얼로그 scrollWidth ≤ clientWidth」를 더합니다. |
| U5 닫힌 뒤 포커스 후조건 | Low | keep · MINOR | F1과 같습니다(`KhSheet.tsx:26-39`). | F1과 함께 반영합니다. |
| U6 SR-4.4 미리 알 수 있음 · DIRECTIONS 계측 누락 | Low | keep · MINOR | `AttractionPage.tsx:451` `sectionId: 'DIRECTIONS',`인데 `spec.md:54`는 "MAP_LINK·전화"만 적었습니다. | SR-6.4 계측 목록에 `DIRECTIONS`를 더합니다(SR-4.4는 I8에서 처리). |

**SUMMARY: keep 34 / demote 1 / dismiss 0**

## Overall
**REVISE**입니다. 아래를 반영하면 구현에 들어갈 수 있습니다.
1. **포커스 처리**: 공용 시트에 포커스 가두기·복원을 넣고, 지역 시트 닫기 함수를 고정합니다(F1·F2).
2. **필터 바 CSS**: 미디어 쿼리 밖으로 옮길 목록을 바로잡고, 넓은 화면 트리거 폭을 제한합니다(I1·I2).
3. **드릴다운 정리**: 지울 CSS와 남길 CSS를 나눠 적고, 「현재 위치」 배지를 지역 시트로 옮깁니다(I3·I4).
4. **위치와 테스트 목록**: 테스트·SSR 코드 위치를 고치고, 영향받는 테스트 7개 파일을 적습니다(I5·I6).
5. **회귀 주입 보강**: 단언에 절대값을 고정하고, 컴파일되는 회귀로 주입하고, CSS 주입 절차를 적습니다(T1·T3·T7).
6. **측정 보강**: hover 상태, RegionPage 카드, 행동 줄 보조 표본을 더합니다(T4·T5).
7. **문서 동기화**: SR-9를 둡니다(A1).
8. **근거 정정**: ADR-0071 §3 인용을 고칩니다(D2).

## 사용자 판단 목록 (권고 기본값으로 진행하고, 이견이 있을 때만 뒤집습니다)
1. **KhSheet 포커스 가두기·복원(F1)**: 공용 컴포넌트라 GNB·탭바·서비스 탐색·뽑기·블로그 공간 전환까지 8곳이 함께 바뀝니다. **기본값: 넣습니다.** 이번 변경으로 데스크톱 키보드 사용자가 새로 잃는 접근이라, 빼면 회귀를 내보내는 셈입니다. 서비스 탐색과 뽑기 시트(`ServiceExplorer`·`PickSheet`)의 기존 결함도 같이 고쳐집니다.
2. **Q6 0건 칩(`.is-empty`, opacity 0.4)**: **기본값: (a) 이번 대비 판정에서 명시적으로 빼고 실측값만 보고합니다.** (b) 투명도 대신 muted 색 + 점선 테두리로 바꾸는 안은 후속으로 둡니다.
3. **카드 meta·addr 대비(F4)**: Goal은 카드 제목만 다루지만 같은 카드 안의 같은 결함입니다. **기본값: 넣습니다.** 각각 한 줄이고 라이트만 바뀝니다.
4. **Q3 언어 토글·바닥글**:
   - 언어 토글(활성은 다크 2.03, 비활성은 라이트 4.23): **기본값: 넣습니다.** place 전용 버튼이고 수정 방식도 SR-4와 같습니다.
   - 바닥글 `1989V`: **기본값: 넣지 않고 보고만 합니다.** 로고타입이라 WCAG 1.4.3 예외이고, 전 호스트 공용이라 place 범위 밖입니다. 스펙의 "2.79 추정"은 "2.89(DESIGN.md:347)"로 고칩니다.
   - k-heritage 견본 `.label`: 시트 라벨을 바꾸므로 같이 고칩니다. 견본의 `.mark`는 바닥글 결정을 따릅니다.
5. **데스크톱 필터 클릭 수 증가(U1)**: 바뀌면 그 밖의 분류 1→3, 속성 k→k+2, 시도 1→3번이 됩니다. **기본값: 첫 카드 y ≤ 320을 위해 감수하고, 전·후 표를 스펙에 결정으로 남깁니다.**
6. **넓은 화면에서 오버레이를 켜면 다이얼로그 닫기(U1-b)**: **기본값: 켜는 순간 닫습니다.** 다이얼로그 뒤 veil이 62% 먹빛에 blur(24px)라 지도 반응이 안 보이고, 좁은 화면 listFirst 규칙과도 같은 모양이 됩니다. 그 결과 SR-1.3의 「넓은 화면은 열어 둔다」 문장을 바꿉니다.

NOTES: `PlacePage.loginReturn.test.tsx:63`는 `MOBILE_QUERY`만 토글하고 나머지는 false입니다. 넓은 화면 경로가 I5 목록과 같은 방식으로 깨지는지는 구현할 때 함께 보면 됩니다.