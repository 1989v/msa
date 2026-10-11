# 단위 검증 — 허브 필터 한 줄·지역 시트·시트 포커스 (TG2, SR-7.1)

## 영향받는 기존 7개 파일 — 단언 수 전·후

「전」은 `git show HEAD:<파일>`, 「후」는 워킹트리. `expect(` 출현 수와 `it(`·`it.each(` 수다. 기존 단언은 지우지 않았고 `mobile` 값도 바꾸지 않았다.

| 파일 | 단언 전 → 후 | 테스트 전 → 후 | 바뀐 것 |
|---|---|---|---|
| `PlacePage.test.tsx` | 149 → 149 | 46 → 46 | 분류 전부·속성·행사 상태·오버레이 칩과 구 지역 `<select>` 를 「필터」 다이얼로그 안에서 찾는다(`openFilters` 도우미 — 열려 있으면 그대로 쓴다). 「다음」 전에 Escape 로 닫는다. 시군구 선택은 트리거 → 시군구 행. 오버레이를 켜면 다이얼로그가 닫히므로 다시 열어 `aria-pressed` 를 본다 |
| `PlacePage.relax.test.tsx` | 88 → 88 | 20 → 20 | 같은 방식 + 조건 해제 버튼을 누르기 전 Escape. 시군구는 `pickSigungu`(트리거 → 시군구 행). 「시도 목록이 늦게 와도」의 도착 확인 단언 한 줄은 대상을 드릴다운 칩(`/서울특별시/` 버튼들)에서 지역 트리거(`/^지역 선택/`)로 바꿨다 — 같은 사실(시도 자료 도착)을 보는 단언이고 드릴다운이 없어져 옛 대상이 사라졌다 |
| `PlacePage.langSwitch.test.tsx` | 9 → 9 | 1 → 1 | 칩 선택 전 「필터」 열기, EN 전에 Escape, 영문 화면에서 다시 「Filters」 열고 그 안의 묶음을 본다 |
| `PlacePage.tracking.test.tsx` | 36 → 36 | 4 → 4 | 속성 칩을 다이얼로그 안에서 누르고 닫은 뒤 카드 별을 누른다 |
| `PlaceLanding.test.tsx` | 39 → 39 | 10 → 10 | 「입장 무료」 두 곳을 다이얼로그 안에서 누른다 |
| `PlacePage.loginReturn.test.tsx` | 64 → 64 | 10 → 10 | 「역사」(핵심 셋 밖)를 다이얼로그 안에서 누르고 「다음」 전에 닫는다 |
| `PlacePage.layout.test.tsx` | 77 → 113 | 19 → 25 | 넓은 화면 `.place-filter-bar` 없음 → **있음**(유일한 기대 뒤집기). 새 테스트 6개 — 아래 |

## 새 단언

- `PlacePage.layout.test.tsx` 「넓은 화면」: 필터 한 줄 칩이 전체·자연·행사 셋이고, 열기 전에는 속성 칩·분류 전부(`[data-category]`)·오버레이 칩·속성 묶음이 DOM 에 없다. 연 다이얼로그는 `kh-sheet--dialog`·`place-filter-sheet` 를 갖는다. 오버레이 칩을 켜면 다이얼로그가 닫히고, 다시 열면 켠 값이 남아 있다.
- `PlacePage.layout.test.tsx` 「넓은/좁은 짝」 4개 — 같은 클릭을 두 폭에서 하고 SEARCH payload·질의를 **기대 리터럴**로 고정한 뒤 두 폭끼리도 비교한다.
  - 속성 칩: `trigger: 'attribute'` · `changed: ['attributes','page']` · `attributes: ['parking']`, 질의 `parking: 'YES'`. 넓은 화면 시트만 `kh-sheet--dialog`.
  - 분류 칩(한 줄): `trigger: 'category'` · `changed: ['category','listEventStatus','page']` · 질의 `category: 'nature'`.
  - 행사 상태: `trigger: 'eventStatus'` · `changed: ['listEventStatus','page']` · 질의 `festival`·`WEEKEND`.
  - 지역 시트: 트리거 → 시군구 행, `trigger: 'region'` · `changed: ['sidoCode','sigunguCode']` · `sido '11'`·`sigungu '110'`. 넓은 화면 시트만 `kh-sheet--dialog`.
- `RegionSheet.test.tsx`(새 파일, 단언 12): 좌표가 있으면 가장 가까운 시도(부산)가 「전체 지역」 다음 첫 시도 행이고 `.place-region-near` 「현재 위치」가 그 행 하나에만 있다. `onChange` 는 불리지 않고 「전체 지역」이 `aria-current` 그대로다. 좌표가 없으면 자료 순서·표시 없음. 영문 「Near you」. `className` 전달. 시도 → 시군구 행 선택 시 `onChange({sidoCode:'26', sigunguCode:'110'})` 후 닫힘.
- `KhSheet.test.tsx`(새 파일, 단언 8): ① Escape 로 닫으면 `document.activeElement` 가 연 버튼 ② 안의 버튼으로 닫아도 같다 ③ 마지막 요소에서 Tab → 첫 요소 ④ 첫 요소·판에서 Shift+Tab → 마지막 요소 ⑤ 가운데 요소의 Tab 은 막지 않는다.

## 실행 결과 (2026-10-11)

```
$ cd portal-fe && npx vitest run src/pages/place src/components/shell && npx tsc -b
 Test Files  19 passed (19)
      Tests  366 passed (366)
tsc=0
```

회귀 주입 결과는 `regression-injection.md`.
